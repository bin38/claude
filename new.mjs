// new.mjs: start a new video project from this kit, so every video gets its own folder and history.
//
//   node new.mjs ../my-video [--duration=12] [--bpm=110]
//
// Copies the engine (src/config, core, clawd, sprout, timeline, sheets), the runtime and renderer, the guide, the model
// sheets and the two example scenes (into reference/, to read), and starts src/scenes/main.js from the guide's
// template. studio.html loads main.js. Nothing here is special: it's the same files, so edit any of them freely.
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const KIT = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2), dest = argv.find(a => !a.startsWith('--'));
const args = Object.fromEntries(argv.filter(a => a.startsWith('--')).map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
if (!dest) { console.error('usage: node new.mjs <folder> [--duration=12] [--bpm=110]'); process.exit(1); }
const D = resolve(dest);
if (existsSync(D) && readdirSync(D).length) { console.error(`${D} exists and isn't empty`); process.exit(1); }

const copy = (from, to = from) => { if (existsSync(resolve(KIT, from))) cpSync(resolve(KIT, from), resolve(D, to), { recursive: true }); };
mkdirSync(resolve(D, 'src/scenes'), { recursive: true });
for (const f of ['config', 'core', 'clawd', 'sprout', 'timeline', 'sheets']) copy(`src/${f}.js`);
for (const f of ['demo', 'meet']) copy(`src/scenes/${f}.js`, `reference/${f}.js`);   // examples to read, not templates to copy
for (const f of ['ANIMATION_GUIDE.md', 'LICENSE', 'docs', 'runtime', 'render.mjs', 'new.mjs', 'package-lock.json', '.claude/skills']) copy(f);

// config
const cfg = resolve(D, 'src/config.js');
writeFileSync(cfg, readFileSync(cfg, 'utf8').replace(/const PROJECT = \{[^}]*\}/, `const PROJECT = { duration: ${+(args.duration || 12)}, bpm: ${+(args.bpm || 120)}, offset: 0 }`));

// studio.html: the kit's page, loading main.js instead of the demo
const html = readFileSync(resolve(KIT, 'studio.html'), 'utf8').replace(/<script src="src\/scenes\/[\w-]+\.js"><\/script>/, '<script src="src/scenes/main.js"></script>');
writeFileSync(resolve(D, 'studio.html'), html);

// the first scene: the guide's template, ready to replace
writeFileSync(resolve(D, 'src/scenes/main.js'), `// main.js: your video. Storyboard first (STORYBOARD.md, see ANIMATION_GUIDE.md), then replace this shot.
(() => {
  function opening(t, lt, dur) {                     // t = video time, lt = time in this shot, dur = shot length
    camBegin(960 + 20 * Math.sin(lt * .6), 540, 1 + .02 * lt);   // slow drift and push: the camera is never dead
    boilSeed('bg');
    paint(rectPts(-200, -200, W + 400, H + 400), { wash: PAL.sky, ink: null });
    paint(ellPts(960, 1150, 1400, 380, 40, 2), { wash: PAL.sap, ink: PAL.ink, sw: 1 });
    const mood = emotions(lt, [[0, 'bored'], [1.2, 'surprised'], [1.7, 'excited']]);
    const hop = jump(lt, 2.2, 2.7, 3);
    clawd(960, 860, 26, { ...mood, dy: mood.dy + hop.dy, sq: mood.sq + hop.sq });
    const at = toScreen(960, 860 - 4 * 26);
    camEnd();
    if (lt < .45) iris(...at, lerp(0, 1500, easeIn(lt / .45)));                    // transition in
    if (lt > dur - .5) iris(...at, lerp(1500, 0, easeIn((lt - (dur - .5)) / .5)));  // transition out
  }
  shots([[0, opening]]);
})();
`);

writeFileSync(resolve(D, '.gitignore'), 'node_modules\nout/\n');
const name = basename(D).replace(/[^a-z0-9-]+/gi, '-').toLowerCase(), kit = JSON.parse(readFileSync(resolve(KIT, 'package.json'), 'utf8'));
writeFileSync(resolve(D, 'package.json'), JSON.stringify({
  name, version: '0.1.0', private: true, type: 'module',
  scripts: { sheet: 'node render.mjs --sheet=0.5,1.5,2.5,3.5 --cols=4 --w=480 --out=out/check/sheet.jpg', video: 'node render.mjs --clip --out=out/video.mp4' },
  dependencies: kit.dependencies, optionalDependencies: kit.optionalDependencies,
}, null, 2) + '\n');

console.log(`new video project: ${D}
  cd ${dest} && npm install         # one small dependency (@napi-rs/canvas) + ffmpeg
  npm run sheet                     # contact sheet → out/check/sheet.jpg
  npm run video                     # MP4 → out/video.mp4
  open studio.html                  # scrub it in any browser
Then ask Claude Code: "Read ANIMATION_GUIDE.md, then make a 15-second video of ..."`);
