// audio/synth.mjs: music and sound effects made from code, like the pictures. A scene declares window.SOUND, a list of
// timed events, and this renders it to a stereo WAV: no samples, no downloads, the same result every time.
//
//   node audio/synth.mjs --scene=src/scenes/overtime.js --duration=16.8 --bpm=90 --out=out/overtime.wav
//   (render.mjs --clip does this by itself when the page defines SOUND and no --audio is given)
//
// SOUND = { events: [...], master?: { reverb: .25, gain: 1 } }. Every event has t (seconds) and type:
//   { type: 'note', inst, midi, dur, vel, pan }    inst: keys (electric piano), bass, pad, bell, pluck, lead
//   { type: 'drum', kind, vel, pan }               kind: kick, snare, hat, openhat, rim, tick
//   { type: 'sfx', kind, vel, pan, dur, ... }      kind: key, enter, buzz, whoosh, riser, clunk, hiss, ding, slam, poof,
//                                                  pop, chime, chirp, snore, skitter, tick, thud, crackle (see SFX)
//   { type: 'tapestop', dur, until }               the music slows to a stop over dur, then stays silent until `until`
//   { type: 'duck', dur, amt }                     turns the music down by amt for dur (so an effect can speak)
// Notes, drums and pads go to the music bus (with reverb, and subject to tapestop and duck); sfx to the effects bus.
// vel is 0..1 and pan -1..1. Anything random is seeded from the event's time, so a render never changes.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 44100, TAU = Math.PI * 2;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const rng = seed => { let s = (Math.floor(seed * 100003) ^ 0x9e3779b9) >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// ---------- building blocks ----------
class Bus {
  constructor(n) { this.L = new Float32Array(n); this.R = new Float32Array(n); }
  // add a mono voice fn(i, t) → sample, starting at time t0 for len seconds, panned
  add(t0, len, pan, fn) {
    const i0 = Math.max(0, Math.round(t0 * SR)), n = Math.min(this.L.length - i0, Math.round(len * SR));
    const gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4);
    for (let i = 0; i < n; i++) { const s = fn(i, i / SR); this.L[i0 + i] += s * gl; this.R[i0 + i] += s * gr; }
  }
}
const lp1 = fc => { const a = 1 - Math.exp(-TAU * fc / SR); let y = 0; return x => (y += a * (x - y)); };
const hp1 = fc => { const l = lp1(fc); return x => x - l(x); };
// RBJ band-pass (constant peak), with a settable centre
function bandpass(q = 4) {
  let b0, b1, b2, a1, a2, x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const set = f => { const w = TAU * Math.min(f, SR * .45) / SR, al = Math.sin(w) / (2 * q), a0 = 1 + al; b0 = al / a0; b1 = 0; b2 = -al / a0; a1 = -2 * Math.cos(w) / a0; a2 = (1 - al) / a0; };
  set(1000);
  const f = x => { const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
  f.set = set; return f;
}
const env = (t, a, d, len) => t < a ? t / a : t > len ? 0 : Math.exp(-(t - a) / d) * Math.min(1, (len - t) / .02);   // attack, exp decay, cut
const adsr = (t, a, r, len) => (t < a ? t / a : 1) * (t > len - r ? Math.max(0, (len - t) / r) : 1);
const saw = ph => 2 * (ph - Math.floor(ph + .5));
const sq = ph => (ph - Math.floor(ph)) < .5 ? 1 : -1;

// ---------- instruments (music bus) ----------
const INST = {
  // electric piano: FM with a decaying index, a soft tine and a slow stereo tremolo
  keys(bus, e) {
    const f = mtof(e.midi), len = (e.dur ?? .8) + 1.2, v = (e.vel ?? .6) * .22;
    bus.add(e.t, len, e.pan ?? 0, (i, t) => {
      const idx = 1.4 * Math.exp(-t * 3), a = env(t, .004, .9 + 200 / f, len) * adsr(t, .004, .35, (e.dur ?? .8) + .35);
      return v * a * Math.sin(TAU * f * t + idx * Math.sin(TAU * f * t)) * (1 + .12 * Math.sin(TAU * 4.5 * t)) + v * .15 * a * Math.exp(-t * 18) * Math.sin(TAU * f * 7 * t);
    });
  },
  bass(bus, e) {
    const f = mtof(e.midi), len = (e.dur ?? .5) + .15, v = (e.vel ?? .7) * .38, l = lp1(700);
    bus.add(e.t, len, 0, (i, t) => l(v * adsr(t, .008, .12, len) * (Math.sin(TAU * f * t) + .35 * Math.sin(TAU * 2 * f * t) * Math.exp(-t * 6))));
  },
  // pad: three detuned saws through a low-pass that opens slowly
  pad(bus, e) {
    const f = mtof(e.midi), len = e.dur ?? 2, v = (e.vel ?? .5) * .07, l = lp1(e.cut ?? 700), l2 = lp1(e.cut ?? 700);
    bus.add(e.t, len, e.pan ?? 0, (i, t) => { const s = saw(f * t) + saw(f * 1.006 * t + .3) + saw(f * .994 * t + .6); return v * adsr(t, e.attack ?? .6, e.release ?? .8, len) * l2(l(s)); });
  },
  bell(bus, e) {
    const f = mtof(e.midi), len = (e.dur ?? .4) + 2, v = (e.vel ?? .5) * .2;
    bus.add(e.t, len, e.pan ?? 0, (i, t) => v * Math.exp(-t * 2.2) * Math.sin(TAU * f * t + 2.2 * Math.exp(-t * 4) * Math.sin(TAU * f * 3.5 * t)));
  },
  // Karplus-Strong string
  pluck(bus, e) {
    const f = mtof(e.midi), N = Math.max(2, Math.round(SR / f)), buf = new Float32Array(N), r = rng(e.t + e.midi), v = (e.vel ?? .5) * .3, len = (e.dur ?? .5) + 1.5;
    for (let k = 0; k < N; k++) buf[k] = r() * 2 - 1;
    let p = 0, prev = 0;
    bus.add(e.t, len, e.pan ?? 0, () => { const s = buf[p], n = buf[(p + 1) % N]; buf[p] = .996 * .5 * (s + n); p = (p + 1) % N; prev += .5 * (s - prev); return v * prev; });
  },
  lead(bus, e) {
    const f = mtof(e.midi), len = e.dur ?? .4, v = (e.vel ?? .5) * .09, l = lp1(2200);
    bus.add(e.t, len + .1, e.pan ?? 0, (i, t) => v * adsr(t, .01, .08, len + .1) * l(sq(f * t + .002 * Math.sin(TAU * 5 * t)) * .6 + saw(f * t) * .4));
  },
};
const DRUM = {
  kick: (bus, e) => { const v = (e.vel ?? .8) * .9; let ph = 0; bus.add(e.t, .5, 0, (i, t) => { ph += (48 + 95 * Math.exp(-t * 28)) / SR; return v * (Math.sin(TAU * ph) * Math.exp(-t * 7.5) + .3 * Math.exp(-t * 300) * Math.sin(TAU * 1500 * t)); }); },
  snare: (bus, e) => { const r = rng(e.t), v = (e.vel ?? .6) * .45, b = bandpass(1.2), l = lp1(5000); b.set(1800); bus.add(e.t, .35, e.pan ?? .05, (i, t) => v * (l(b(r() * 2 - 1)) * 2.2 * Math.exp(-t * 16) + .5 * Math.sin(TAU * 185 * t) * Math.exp(-t * 22))); },
  hat: (bus, e) => { const r = rng(e.t), v = (e.vel ?? .4) * .16, h = hp1(7000); bus.add(e.t, .08, e.pan ?? .25, (i, t) => v * h(r() * 2 - 1) * Math.exp(-t * 70)); },
  openhat: (bus, e) => { const r = rng(e.t), v = (e.vel ?? .4) * .13, h = hp1(6500); bus.add(e.t, .4, e.pan ?? .25, (i, t) => v * h(r() * 2 - 1) * Math.exp(-t * 9)); },
  rim: (bus, e) => { const v = (e.vel ?? .5) * .3; bus.add(e.t, .06, e.pan ?? -.1, (i, t) => v * Math.sin(TAU * 1700 * t) * Math.exp(-t * 90)); },
  tick: (bus, e) => { const v = (e.vel ?? .4) * .22, hi = e.hi ? 1.25 : 1; bus.add(e.t, .05, e.pan ?? .3, (i, t) => v * (Math.sin(TAU * 3100 * hi * t) * Math.exp(-t * 160) + .6 * Math.sin(TAU * 1250 * hi * t) * Math.exp(-t * 110))); },
};

// ---------- sound effects (effects bus) ----------
const SFX = {
  // one keyboard key: a plastic click with a little randomness in pitch and weight
  key(bus, e) { const r = rng(e.t), v = (e.vel ?? .5) * (.7 + .5 * r()) * .35, f = 2600 + 1800 * r(), h = hp1(1800); bus.add(e.t, .05, e.pan ?? (r() - .5) * .4, (i, t) => v * (h(r() * 2 - 1) * Math.exp(-t * 260) + .35 * Math.sin(TAU * f * t) * Math.exp(-t * 400) + .3 * Math.sin(TAU * 240 * t) * Math.exp(-t * 90))); },
  enter(bus, e) { SFX.key(bus, { ...e, vel: 1 }); const v = (e.vel ?? .8) * .5; bus.add(e.t, .2, 0, (i, t) => v * Math.sin(TAU * (160 + 60 * Math.exp(-t * 40)) * t) * Math.exp(-t * 25)); },
  // the error: two flat buzzes, down a step
  buzz(bus, e) {
    const v = (e.vel ?? .8) * .16, l = lp1(2400), n = e.n ?? 2;
    bus.add(e.t, .28 * n, e.pan ?? 0, (i, t) => { const k = Math.floor(t / .28), u = t - k * .28; if (u > .2) return 0; const f = k % 2 ? 139 : 185; return v * l(sq(f * t + .003 * Math.sin(TAU * 30 * t))) * Math.min(1, u / .005, (.2 - u) / .02); });
  },
  // noise through a band-pass sweeping from f0 to f1
  whoosh(bus, e) {
    const r = rng(e.t), d = e.dur ?? .5, v = (e.vel ?? .5) * .5, b = bandpass(2.5), f0 = e.f0 ?? 300, f1 = e.f1 ?? 2800;
    bus.add(e.t, d, e.pan ?? 0, (i, t) => { if (i % 32 === 0) b.set(f0 * Math.pow(f1 / f0, t / d)); return v * b(r() * 2 - 1) * Math.sin(Math.PI * t / d) ** 2; });
  },
  riser(bus, e) { SFX.whoosh(bus, { ...e, f0: 200, f1: 5000, vel: (e.vel ?? .5) * .8 }); const d = e.dur ?? 1, v = (e.vel ?? .5) * .05; let ph = 0; bus.add(e.t, d, 0, (i, t) => { ph += (200 * Math.pow(4, t / d)) / SR; return v * saw(ph) * (t / d); }); },
  // a mug landing on the desk: a wooden thud and a ceramic ring
  clunk(bus, e) { const v = (e.vel ?? .7) * .5; bus.add(e.t, .9, e.pan ?? -.3, (i, t) => v * (Math.sin(TAU * 95 * t) * Math.exp(-t * 22) + .25 * Math.sin(TAU * 1318 * t) * Math.exp(-t * 7) + .12 * Math.sin(TAU * 2793 * t) * Math.exp(-t * 11))); },
  hiss(bus, e) { const r = rng(e.t), d = e.dur ?? 1, v = (e.vel ?? .5) * .12, h = hp1(3000); bus.add(e.t, d, e.pan ?? 0, (i, t) => v * h(r() * 2 - 1) * Math.min(1, t / .05) * Math.max(0, 1 - t / d) * (.7 + .3 * Math.sin(TAU * 7 * t))); },
  ding(bus, e) { INST.bell(bus, { ...e, midi: e.midi ?? 88, vel: e.vel ?? .8 }); INST.bell(bus, { ...e, t: e.t + .01, midi: (e.midi ?? 88) + 7, vel: (e.vel ?? .8) * .5 }); },
  // the slam: a hand hitting the desk, with a wet little splat
  slam(bus, e) { const r = rng(e.t), v = (e.vel ?? .9), l = lp1(900); let ph = 0; bus.add(e.t, .6, 0, (i, t) => { ph += (55 + 120 * Math.exp(-t * 35)) / SR; return v * (.8 * Math.sin(TAU * ph) * Math.exp(-t * 9) + .5 * l(r() * 2 - 1) * Math.exp(-t * 14)); }); },
  poof(bus, e) { const r = rng(e.t), v = (e.vel ?? .6) * .3, h = hp1(1200); bus.add(e.t, .35, e.pan ?? .2, (i, t) => v * (h(r() * 2 - 1) * Math.exp(-t * 12) + .4 * Math.sin(TAU * (600 + 1800 * t) * t) * Math.exp(-t * 10))); },
  pop(bus, e) { const v = (e.vel ?? .5) * .35; bus.add(e.t, .15, e.pan ?? 0, (i, t) => v * Math.sin(TAU * (500 + 2500 * t) * t) * Math.exp(-t * 30)); },
  // success: a rising major arpeggio on bells
  chime(bus, e) { const root = e.midi ?? 84; [0, 4, 7, 12, 16].forEach((s, k) => INST.bell(bus, { t: e.t + k * .075, midi: root + s, vel: (e.vel ?? .7) * (1 - k * .1), pan: -.4 + k * .2 })); },
  // a bird: quick rising FM chirps
  chirp(bus, e) {
    const v = (e.vel ?? .4) * .12, n = e.n ?? 3, r = rng(e.t), base = 2600 + 900 * r();
    for (let k = 0; k < n; k++) { const t0 = e.t + k * (.11 + .04 * r()); let ph = 0; bus.add(t0, .09, e.pan ?? .6, (i, t) => { ph += (base + 2200 * t / .09 + 300 * Math.sin(TAU * 60 * t)) / SR; return v * Math.sin(TAU * ph) * Math.sin(Math.PI * t / .09); }); }
  },
  // a snore: breathing noise, in then out, low-passed, `n` times from t
  snore(bus, e) {
    const r = rng(e.t), v = (e.vel ?? .4) * .5, n = e.n ?? 2, per = e.period ?? 2.2, l = lp1(380), l2 = lp1(380);
    bus.add(e.t, n * per, e.pan ?? -.1, (i, t) => { const u = (t % per) / per, a = u < .45 ? Math.sin(Math.PI * u / .45) : u < .9 ? .5 * Math.sin(Math.PI * (u - .45) / .45) : 0; return v * a * l2(l(r() * 2 - 1)) * (1 + .6 * Math.sin(TAU * 32 * t)); });
  },
  // bug legs on plastic: a skittering run of tiny ticks
  skitter(bus, e) { const r = rng(e.t), d = e.dur ?? .5, v = (e.vel ?? .4) * .25; for (let t0 = 0; t0 < d; t0 += .018 + .02 * r()) { const f = 4000 + 2000 * r(), a = v * (.5 + .5 * r()); bus.add(e.t + t0, .012, e.pan ?? .3, (i, t) => a * Math.sin(TAU * f * t) * Math.exp(-t * 500)); } },
  // the clock: the tick drum, but on the effects bus, so it keeps going through a tape stop
  tick(bus, e) { DRUM.tick(bus, e); },
  thud(bus, e) { const v = (e.vel ?? .6) * .6; bus.add(e.t, .4, e.pan ?? 0, (i, t) => v * Math.sin(TAU * (70 + 40 * Math.exp(-t * 30)) * t) * Math.exp(-t * 12)); },
  // vinyl crackle, for dur seconds: sparse clicks over a low hiss
  crackle(bus, e) { const r = rng(e.t), d = e.dur ?? 4, v = (e.vel ?? .3), l = lp1(2500); bus.add(e.t, d, 0, () => { const c = r() < 12 / SR ? (r() * 2 - 1) * .5 : 0; return v * (l(r() * 2 - 1) * .012 + c * .25); }); },
};

// Schroeder reverb: four combs into two all-passes
function reverb(L, R, wet) {
  if (wet <= 0) return;
  const run = (x, off) => {
    const combs = [1116, 1188, 1277, 1356].map(n => ({ b: new Float32Array(n + off), p: 0, lp: 0 })), aps = [556, 441].map(n => ({ b: new Float32Array(n + off), p: 0 }));
    const out = new Float32Array(x.length);
    for (let i = 0; i < x.length; i++) {
      let s = 0; const inp = x[i] * .3;
      for (const c of combs) { const y = c.b[c.p]; c.lp = y * .75 + c.lp * .25; c.b[c.p] = inp + c.lp * .8; c.p = (c.p + 1) % c.b.length; s += y; }
      for (const a of aps) { const y = a.b[a.p]; a.b[a.p] = s + y * .5; a.p = (a.p + 1) % a.b.length; s = y - s * .5; }
      out[i] = s;
    }
    return out;
  };
  const wl = run(L, 0), wr = run(R, 23);
  for (let i = 0; i < L.length; i++) { L[i] += wl[i] * wet; R[i] += wr[i] * wet; }
}

export function renderSound(sound, duration) {
  const n = Math.ceil((duration + .05) * SR), music = new Bus(n), fx = new Bus(n), ev = [...(sound.events || [])].sort((a, b) => a.t - b.t);
  for (const e of ev) {
    if (e.type === 'note') (INST[e.inst] || INST.keys)(music, e);
    else if (e.type === 'drum') (DRUM[e.kind] || DRUM.rim)(music, e);
    else if (e.type === 'sfx') { if (!SFX[e.kind]) throw new Error(`unknown sfx "${e.kind}"`); SFX[e.kind](fx, e); }
  }
  const m = sound.master || {};
  reverb(music.L, music.R, m.reverb ?? .22);
  reverb(fx.L, fx.R, m.fxReverb ?? .08);
  // tape stops and ducks act on the finished music bus
  for (const e of ev.filter(e => e.type === 'tapestop')) {
    const i0 = Math.round(e.t * SR), d = Math.round((e.dur ?? .6) * SR), i1 = Math.min(n, Math.round((e.until ?? e.t + e.dur) * SR)), L = music.L.slice(), R = music.R.slice();
    for (let i = i0; i < i1; i++) {
      const k = (i - i0) / d; if (k >= 1) { music.L[i] = music.R[i] = 0; continue; }
      const src = i0 + d * (k - k * k / 2), j = Math.floor(src), f = src - j, g = 1 - k * k;
      music.L[i] = (L[j] * (1 - f) + L[j + 1] * f) * g; music.R[i] = (R[j] * (1 - f) + R[j + 1] * f) * g;
    }
  }
  for (const e of ev.filter(e => e.type === 'duck')) {
    const i0 = Math.round(e.t * SR), d = Math.round((e.dur ?? .5) * SR), a = e.amt ?? .5;
    for (let i = i0; i < Math.min(n, i0 + d); i++) { const k = (i - i0) / d, g = 1 - a * Math.sin(Math.PI * Math.min(1, k * 4)) ** .5 * (k > .75 ? (1 - k) * 4 : 1); music.L[i] *= g; music.R[i] *= g; }
  }
  // mix, soft-clip, normalise to -1 dBFS
  const L = new Float32Array(n), R = new Float32Array(n), g = m.gain ?? 1, mv = m.music ?? 1, fv = m.fx ?? 1;
  let peak = 1e-9;
  for (let i = 0; i < n; i++) { L[i] = Math.tanh((music.L[i] * mv + fx.L[i] * fv) * g); R[i] = Math.tanh((music.R[i] * mv + fx.R[i] * fv) * g); peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); }
  const k = .89 / peak; for (let i = 0; i < n; i++) { L[i] *= k; R[i] *= k; }
  return { L, R, sr: SR };
}

export function writeWav(path, { L, R, sr }) {
  const n = L.length, buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) { buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 46 + i * 4); }
  mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, buf);
}

// CLI: render the SOUND of the page's scene
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.length ? v.join('=') : true]; }));
  const { loadPage } = await import('../render.mjs');
  const page = await loadPage({ scenes: args.scene ? String(args.scene).split(',') : null, duration: args.duration || null, bpm: args.bpm || null });
  const sound = page.eval('window.SOUND || null');
  if (!sound) { console.error('the scene defines no window.SOUND'); process.exit(1); }
  const out = resolve(args.out || 'out/sound.wav'), t0 = Date.now();
  writeWav(out, renderSound(sound, page.length));
  console.log(`${out}  (${sound.events.length} events, ${page.length}s, ${Date.now() - t0} ms)`);
}
