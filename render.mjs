// render.mjs: renders the kit in plain Node, with no Chrome, no WebGL and no GPU. It runs the scripts that studio.html
// lists (config, core, the characters, timeline, sheets, your scenes), with runtime/p5lite.js standing in for p5 +
// p5.brush, on @napi-rs/canvas (Skia). Frames render in parallel on worker threads.
//
//     node render.mjs --sheet=0.5,1,1.5,2 [--cols=4] [--w=480] --out=out/check/a.jpg        contact sheet
//     node render.mjs --strip=2.0:2.5 [--cols=6] [--w=320] --out=out/check/strip.jpg        every frame in a stretch
//     node render.mjs --sheet=2.1,2.2 --crop=760,300,400,400 --w=600 --out=out/check/face.jpg full-res crops
//     node render.mjs --strip=2.0:2.5 --crop-at=960,780,500,400 --out=out/check/feet.jpg      crops following a world point
//     node render.mjs --stills=1.2,3.4 --out=out/stills                                     full-res PNGs
//     node render.mjs --clip [--range=0:4] --out=out/video.mp4                               straight to MP4 (parallel)
//     node render.mjs --frames [--range=0:8]                                                JPEG frames → out/frames (resumable)
//     node render.mjs --encode --out=out/video.mp4                                           out/frames → MP4
//     node render.mjs --loop=emotions --png --out=out/loop_emotions                          a loop's cycle as PNGs
//   Other flags: --fps=24, --workers=N (default: CPU cores - 1), --audio=song.mp3, --ffmpeg=<path>,
//   --scene=src/scenes/a.js[,b.js] (render these scenes instead of the ones studio.html lists), --duration=<s> (override
//   PROJECT.duration, e.g. --scene=src/scenes/demo.js --duration=11), --bpm=<n> (override PROJECT.bpm),
//   --no-sound (--clip scores the scene's window.SOUND with audio/synth.mjs unless you pass --audio or this),
//   --page=studio.html (which page's <script src> list to run), --root=<project folder> (default: this file's folder).
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import vm from 'node:vm';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, statSync, renameSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { availableParallelism, cpus } from 'node:os';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
// the kit's lettering font (sheet labels, letter(), sfx()); browsers get it from Google Fonts, Node from runtime/fonts
const FONTS = resolve(HERE, 'runtime/fonts');
for (const f of existsSync(FONTS) ? readdirSync(FONTS) : []) if (/\.(ttf|otf)$/i.test(f)) GlobalFonts.registerFromPath(resolve(FONTS, f));

// ---------- the page: every script of studio.html in one sandbox ----------
export async function loadPage({ root = HERE, page = 'studio.html', loop = null, scenes = null, duration = null, bpm = null } = {}) {
  const html = readFileSync(resolve(root, page), 'utf8');
  const srcs = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/g)].map(m => m[1])
    .filter(s => !/^(https?:)?\/\//.test(s) && !s.includes('node_modules/') && !s.includes('p5lite'))
    .filter(s => !scenes || !s.startsWith('src/scenes/')).concat(scenes || []);
  let out = null;
  const sb = {
    console, performance, setTimeout, clearTimeout, URLSearchParams,
    __newCanvas: (w, h) => createCanvas(w, h),
    location: { search: '?render' },
    document: {
      createElement: () => createCanvas(300, 150),
      getElementById: id => id === 'out' ? (out ||= createCanvas(vm.runInContext('W', sb), vm.runInContext('H', sb))) : null,
      fonts: { load: async () => [] }, addEventListener() {}, readyState: 'complete',
    },
  };
  sb.window = sb;
  vm.createContext(sb);
  const run = file => vm.runInContext(readFileSync(file, 'utf8'), sb, { filename: file });
  run(resolve(HERE, 'runtime/p5lite.js'));
  for (const s of srcs) { run(resolve(root, s)); if (/(^|\/)config\.js$/.test(s)) { if (duration) vm.runInContext(`PROJECT.duration = ${+duration}`, sb); if (bpm) vm.runInContext(`PROJECT.bpm = ${+bpm}`, sb); } }
  await vm.runInContext('setup()', sb);
  if (loop && !vm.runInContext(`!!LOOPS[${JSON.stringify(loop)}] && (window.LOOP = LOOPS[${JSON.stringify(loop)}], true)`, sb)) throw new Error(`no loop named "${loop}"`);
  vm.runInContext('window.__frame = async t => { T = t; await redraw(); composite(t); return outC; }', sb);
  return {
    scripts: srcs,
    length: vm.runInContext('window.LOOP ? window.LOOP.len : DUR', sb),
    eval: code => vm.runInContext(code, sb),
    async frame(t, mime = 'image/jpeg', q = .93) {
      const c = await sb.__frame(t);
      return mime === 'image/png' ? c.encode('png') : c.encode('jpeg', Math.round(q * 100));
    },
    async sheet(ts, cols, w, crop, at) {
      const { url, ms } = await sb.renderSheet(ts, cols, w, crop, at);
      return { buf: Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'), ms };
    },
  };
}

// ---------- worker threads: each holds its own page and renders the frames it's sent ----------
if (!isMainThread) {
  const page = await loadPage(workerData);
  parentPort.on('message', async ({ i, t, mime, q }) => {
    // posted as a copy: napi-rs buffers live in external memory, which can't be transferred
    try { const buf = await page.frame(t, mime, q); parentPort.postMessage({ i, buf }); }
    catch (e) { parentPort.postMessage({ i, err: e.stack || String(e) }); }
  });
  parentPort.postMessage({ ready: true });
}

// Render jobs [{ i, t }] across n workers; onFrame(i, buf) is called as each finishes (out of order).
async function renderPool(opts, jobs, n, mime, q, onFrame) {
  n = Math.max(1, Math.min(n, jobs.length));
  let next = 0;
  await Promise.all(Array.from({ length: n }, () => new Promise((ok, bad) => {
    const w = new Worker(fileURLToPath(import.meta.url), { workerData: opts });
    const send = () => { if (next >= jobs.length) { w.terminate(); ok(); return; } const j = jobs[next++]; w.postMessage({ ...j, mime, q }); };
    w.on('message', async m => {
      if (m.err) { w.terminate(); bad(new Error(m.err)); return; }
      if (!m.ready) await onFrame(m.i, Buffer.from(m.buf));
      send();
    });
    w.on('error', bad);
  })));
}

// ---------- CLI ----------
if (isMainThread && process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.length ? v.join('=') : true]; }));
  const opts = { root: resolve(args.root || HERE), page: args.page || 'studio.html', loop: args.loop || null, scenes: args.scene ? String(args.scene).split(',') : null, duration: args.duration || null, bpm: args.bpm || null };
  const fps = +(args.fps || 24), FRAMES_DIR = resolve(opts.root, 'out/frames');
  const workers = +(args.workers || Math.max(1, (availableParallelism?.() ?? cpus().length) - 1));
  const times = s => String(s).split(',').map(Number), span = s => String(s).split(':').map(Number);
  const fields = s => { const o = []; let d = 0, cur = ''; for (const ch of String(s)) { if (ch === ',' && !d) { o.push(cur); cur = ''; continue; } d += ch === '(' ? 1 : ch === ')' ? -1 : 0; cur += ch; } o.push(cur); return o.map(v => isNaN(+v) ? v : +v); };
  const outPath = (p, def) => resolve(p || def);
  const ffmpeg = () => {
    for (const c of [args.ffmpeg, process.env.FFMPEG_PATH, 'ffmpeg']) if (c && !spawnSync(c, ['-version']).error) return c;
    try { const p = createRequire(import.meta.url)('ffmpeg-static'); if (p && existsSync(p)) return p; } catch {}
    console.error('ffmpeg not found: run `npm install` (it brings ffmpeg-static), install ffmpeg, or pass --ffmpeg=<path>'); process.exit(1);
  };
  const run = (cmd, a) => new Promise((ok, bad) => { const p = spawn(cmd, a, { stdio: 'inherit' }); p.on('close', c => c ? bad(new Error(cmd + ' exited ' + c)) : ok()); });
  const t0 = Date.now();

  if (args.encode) {
    const out = outPath(args.out, 'out/video.mp4'), audio = args.audio;
    mkdirSync(dirname(out), { recursive: true });
    await run(ffmpeg(), ['-y', '-loglevel', 'error', '-stats', '-framerate', String(fps), '-i', `${FRAMES_DIR}/f%05d.jpg`,
      ...(audio ? ['-i', audio, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k', '-shortest'] : []),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
    console.log('wrote ' + out);
  } else if (args.sheet || args.strip) {
    const page = await loadPage(opts), out = outPath(args.out, 'out/sheet.jpg'); mkdirSync(dirname(out), { recursive: true });
    let ts;
    if (args.strip) { const [a, b] = span(args.strip); ts = []; for (let i = Math.round(a * fps); i <= Math.round(b * fps); i++) ts.push(i / fps); }
    else ts = times(args.sheet);
    const crop = args.crop ? times(args.crop) : null, at = args['crop-at'] ? fields(args['crop-at']) : null;
    const { buf, ms } = await page.sheet(ts, +(args.cols || (args.strip ? 6 : 3)), +(args.w || (args.strip ? 320 : 640)), crop, at);
    writeFileSync(out, buf);
    console.log(`${out}  (${ts.length} frames)  ms/frame: ${ms.join(' ')}`);
  } else if (args.stills) {
    const page = await loadPage(opts), out = outPath(args.out, 'out/stills'); mkdirSync(out, { recursive: true });
    for (const s of times(args.stills)) {
      const t1 = Date.now(), f = `${out}/t${s.toFixed(2).replace('.', '_')}.png`;
      writeFileSync(f, await page.frame(s, 'image/png'));
      console.log(`${f}  ${Date.now() - t1} ms`);
    }
  } else if (args.png || args.frames || args.clip) {
    const probe = await loadPage(opts), len = probe.length;
    const [a, b] = args.range ? span(args.range) : typeof args.clip === 'string' ? span(args.clip) : [0, len];
    if (args.png) {
      // a loop's full cycle (frame n equals frame 0, so it isn't rendered), or --range=a:b
      const n = Math.round((b - a) * fps), out = outPath(args.out, `out/${opts.loop ? 'loop_' + opts.loop : 'png'}`); mkdirSync(out, { recursive: true });
      await renderPool(opts, Array.from({ length: n }, (_, i) => ({ i, t: a + i / fps })), workers, 'image/png', 1,
        (i, buf) => writeFileSync(`${out}/f${String(i).padStart(4, '0')}.png`, buf));
      console.log(`${n} frames → ${out}  (${((Date.now() - t0) / n).toFixed(0)} ms/frame effective)`);
    } else if (args.frames) {
      mkdirSync(FRAMES_DIR, { recursive: true });
      const first = Math.round(a * fps), last = Math.min(Math.ceil(len * fps) - 1, Math.round(b * fps) - 1), todo = [];
      for (let i = first; i <= last; i++) { const f = `${FRAMES_DIR}/f${String(i).padStart(5, '0')}.jpg`; if (!existsSync(f) || statSync(f).size < 1000) todo.push({ i, t: i / fps }); }
      console.log(`${todo.length} frames to render (${last - first + 1 - todo.length} already done), ${workers} workers`);
      let done = 0;
      await renderPool(opts, todo, workers, 'image/jpeg', .94, (i, buf) => {
        const f = `${FRAMES_DIR}/f${String(i).padStart(5, '0')}.jpg`; writeFileSync(f + '.tmp', buf); renameSync(f + '.tmp', f);
        if (++done % 24 === 0 || done === todo.length) console.log(`frame ${done}/${todo.length}  ${((Date.now() - t0) / done).toFixed(0)} ms/frame effective`);
      });
    } else {
      const out = outPath(args.out, 'out/clip.mp4'); mkdirSync(dirname(out), { recursive: true });
      let audio = args.audio || probe.eval('PROJECT.audio || ""');
      if (!audio && !args['no-sound'] && probe.eval('!!window.SOUND')) {   // the scene scores itself: synthesise it
        const { renderSound, writeWav } = await import('./audio/synth.mjs');
        audio = out.replace(/\.mp4$/i, '') + '.wav'; writeWav(audio, renderSound(probe.eval('window.SOUND'), len));
        console.log(`scored ${audio}`);
      }
      const ff = spawn(ffmpeg(), ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
        ...(audio ? ['-ss', String(a), '-t', String(b - a), '-i', resolve(opts.root, audio), '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k', '-shortest'] : []),
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
      const closed = new Promise(r => ff.on('close', r));
      // frames finish out of order across workers; hand them to ffmpeg in order
      const n = Math.round((b - a) * fps), ready = new Map(); let written = 0;
      await renderPool(opts, Array.from({ length: n }, (_, i) => ({ i, t: a + i / fps })), workers, 'image/jpeg', .93, async (i, buf) => {
        ready.set(i, buf);
        while (ready.has(written)) {
          const f = ready.get(written); ready.delete(written);
          if (!ff.stdin.write(f)) await new Promise(r => ff.stdin.once('drain', r));
          if (++written % 24 === 0 || written === n) console.log(`frame ${written}/${n}  ${((Date.now() - t0) / written).toFixed(0)} ms/frame effective`);
        }
      });
      ff.stdin.end(); await closed;
      console.log(`wrote ${out}  (${workers} workers, ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    }
  } else {
    console.log('nothing to do: see the usage notes at the top of render.mjs');
  }
}
