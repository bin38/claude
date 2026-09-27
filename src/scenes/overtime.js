// overtime.js: "Overtime", a 16.8-second short with its own score (window.SOUND, rendered by audio/synth.mjs).
//   node render.mjs --scene=src/scenes/overtime.js --duration=16.8 --bpm=90 --clip --out=out/overtime.mp4
//
// Logline: Clawd is coding late at night and the build fails, so it hunts the bug all night, finds it, squashes it,
//          and falls asleep at dawn.
// World:   a little room at night, lit by the monitor. Cold blue, a red flare when the build fails, green when it
//          passes, then warm dawn through the window. Everything is shown, nothing is written: the code is coloured
//          bars, the error is a red ✕, the bug is a bug.
// Motif:   the wall clock (its tick keeps going when the music stops; it spins through the night) and the coffee
//          mugs (the stack grows as the night goes on). Sprout, the desk plant, sleeps through it and wakes at dawn.
// Arcs:    Clawd vibing → surprised → determined → exhausted → furious → sly → the idea → triumph → relief → asleep.
// Score:   90 bpm. A lo-fi groove that tape-stops on the error, leaving the clock ticking in the silence. A low drone
//          and ticks that speed up through the night, silence for the bug, a riser into the slam, bells when it
//          passes. Warm chords, plucks and birds at dawn; a snore.
// Shots:
//   A  0–4.6    [in: iris opens on Clawd]  Clawd types to the beat, headphones on · 3.0–3.33 winds up and hits Enter ·
//               3.6 the screen goes red (✕), the music stops · 3.6–4.6 Clawd's take, in red light, clock ticking.
//               From 4.1 the camera pushes in, and the push carries into B.
//   B  4.6–11.1 4.6–5.6 typing like mad · 5.6–8.0 the night passes: the clock spins, the moon sets, mugs stack up,
//               two more red ✕s, Clawd wilts · 8.0–8.85 fury: the lid opens, steam · 8.8 a bug peeks out of the code ·
//               8.95 Clawd sees it · 9.3 the idea · 9.45–9.9 the bug bolts down onto the desk · 9.75–10.15 wind-up ·
//               10.2 SLAM · 10.25 green ✓, bells · 10.35 triumph.  [out: brush wipe in dawn colours]
//   C  11.1–16.8 dawn in the window · 11.65 Clawd jumps for joy · 12.5 relief · 13.2 a yawn, arms up · 13.9 head down
//               on the desk, asleep · 14.55 Sprout wakes in the sun, looks at Clawd, loves it · 15.9 iris closes.
(() => {
  // ---------- layout (world px) ----------
  const DESKY = 780, CX = 760, CU = 34, CY = DESKY + 3.2 * CU;             // desk top, Clawd (feet hidden behind the desk)
  const MON = { x0: 1000, x1: 1480, y0: 380, y1: 700 }, SX0 = 1018, SX1 = 1462, SY0 = 398, SY1 = 682, SCX = (SX0 + SX1) / 2, SCY = (SY0 + SY1) / 2;
  const WIN = { x0: 170, x1: 560, y0: 110, y1: 430 }, CLK = [1260, 280, 58], POT = 320, MUGX = 470, MH = 46;
  const tEnter = 5 * BEAT, tErr = 3.6, tA = 4.6, tLapse0 = 5.6, tLapse1 = 8.0, tFury = 8.0, tBug = 8.8, tSee = 8.95, tIdea = 9.3,
        tRun = 9.45, tWind = 9.75, tSlam = 10.2, tOK = 10.25, tC = 11.1, tJump = 11.65, tYawn = 13.2, tDown = 13.9, tWake = 14.55;
  const MUGS = [0, 6.0, 6.7, 7.4];                                        // when each mug lands (the first is there already)
  const FLASH = [tErr, 6.35, 7.15, 8.02];                                 // each failed build
  const WALL = '#B9A58F', WOOD = '#9A6B4A', WOODDK = '#6E4A33', NIGHT = '#141A3A', SCREEN = { code: '#1E2440', err: '#4A1622', ok: '#163A2A' };
  const SYN = ['#C792EA', '#82AAFF', '#C3E88D', '#F78C6C', '#89DDFF', '#E6E1CF'];

  // ---------- typing: every key press, shared by the arms, the keyboard, the screen and the sound ----------
  const KEYS = [];   // [time, arm (0 = L, 1 = R)]
  for (let b = 0; b * BEAT < 3.25; b += .5) { const t = b * BEAT + (b % 1 ? .12 * BEAT : 0); if (t > .9) KEYS.push([t, KEYS.length % 2]); }   // swung eighths
  for (let t = 4.72; t < 5.6; t += .07 + .03 * hash(t * 13)) KEYS.push([t, KEYS.length % 2]);                                               // frantic
  for (let t = 5.6; t < 6.8; t += .11 + .05 * hash(t * 17)) KEYS.push([t, KEYS.length % 2]);                                                // steady
  for (let t = 6.8; t < 7.95; t += .26 + .15 * hash(t * 19)) if (hash(t * 23) > .25) KEYS.push([t, KEYS.length % 2]);                      // flagging
  const typed = t => { let lo = 0, hi = KEYS.length; while (lo < hi) { const m = (lo + hi) >> 1; if (KEYS[m][0] <= t) lo = m + 1; else hi = m; } return lo; };
  const press = (t, arm) => { for (let i = typed(t) - 1; i >= 0 && i > typed(t) - 7; i--) if (KEYS[i][1] === arm) return Math.exp(-(t - KEYS[i][0]) * 22); return 0; };

  // ---------- time of night on the wall clock (hours) ----------
  const clockH = t => t < tLapse0 ? 23 + 5 / 60 + t / 60 * .6 : t < tLapse1 ? lerp(23.15, 28.67, ease(seg(t, tLapse0, tLapse1))) : t < tC ? 28.67 + (t - tLapse1) * .06 : 29.83 + (t - tC) * .03;
  const screenState = t => t < tErr ? 'code' : t < tOK ? 'err' : 'ok';
  const dawnK = t => t < tC ? 0 : ease(seg(t, tC - .1, tC + .7));

  // ---------- the room ----------
  function room(t) {
    const dk = dawnK(t);
    boilSeed('sky');   // the window: night sky and moon, or dawn and the sun, framed by the wall drawn over it
    paint(rectPts(WIN.x0, WIN.y0, WIN.x1 - WIN.x0, WIN.y1 - WIN.y0), { wash: mixCol('#1B2352', '#F4C28A', dk), ink: null });
    if (dk < 1) {
      for (let i = 0; i < 14; i++) { const x = WIN.x0 + 20 + hash(i) * 350, y = WIN.y0 + 15 + hash(i + 50) * 230; paint(starPts(x, y, 3 + 3 * hash(i + 9), .35, 4), { wash: PAL.cream, washOp: 200 * (1 - dk), ink: null }); }
      const k = ease(seg(t, tLapse0, tLapse1)), mp = arcPt([300, 200], [640, 520], -60, k);
      boilSeed('moon'); paint(ellPts(mp[0], mp[1], 42, 42, 20, 1), { wash: PAL.cream, fill: PAL.ochre, fillOp: 40, ink: PAL.ink, sw: .7 });
    }
    if (dk > 0) {
      paint(ellPts(380, 430, 420, 170, 24, 6), { fill: '#F29B7F', fillOp: 120 * dk, bleed: .3, tex: .5, ink: null });
      const sy = lerp(500, 330, ease(seg(t, tC, tC + 2.5)));
      glow(400, sy, 160, '#FFD27A', .9 * dk);
      boilSeed('sun'); paint(ellPts(400, sy, 46, 46, 20, 1), { wash: '#FFE3A0', ink: PAL.ink, sw: .7 });
    }
    boilSeed('wall');   // the wall, as four panels around the window
    for (const [x, y, w, h] of [[-700, -600, 3300, WIN.y0 + 600], [-700, WIN.y1, 3300, 1400], [-700, WIN.y0, WIN.x0 + 700, WIN.y1 - WIN.y0], [WIN.x1, WIN.y0, 2200, WIN.y1 - WIN.y0]])
      paint(rectPts(x, y, w, h), { wash: WALL, ink: null });
    paint(ellPts(900, 300, 800, 380, 24, 8), { fill: mixCol(WALL, PAL.clay, .25), fillOp: 60, bleed: .3, tex: .7, ink: null });
    boilSeed('window');
    paint(rectPts(WIN.x0, WIN.y0, WIN.x1 - WIN.x0, WIN.y1 - WIN.y0, 1.5), { ink: PAL.ink, sw: 1.6 });
    inkLine([[(WIN.x0 + WIN.x1) / 2, WIN.y0], [(WIN.x0 + WIN.x1) / 2, WIN.y1]], 1.3, PAL.ink, 'ink', 0);
    inkLine([[WIN.x0, (WIN.y0 + WIN.y1) / 2], [WIN.x1, (WIN.y0 + WIN.y1) / 2]], 1.3, PAL.ink, 'ink', 0);
    paint(rectPts(WIN.x0 - 20, WIN.y1, WIN.x1 - WIN.x0 + 40, 18, 1), { wash: mixCol(WALL, PAL.cream, .4), ink: PAL.ink, sw: 1 });
    // the bookshelf
    boilSeed('shelf');
    paint(rectPts(1570, 240, 250, 460, 1.5), { wash: WOODDK, ink: PAL.ink, sw: 1.2 });
    for (let s = 0; s < 3; s++) {
      const sy = 390 + s * 150;
      paint(rectPts(1580, sy, 230, 12), { wash: WOOD, ink: PAL.ink, sw: .8 });
      let x = 1590;
      for (let i = 0; x < 1780; i++) { const w = 16 + 14 * hash(s * 20 + i), h = 70 + 50 * hash(s * 30 + i); paint(rectPts(x, sy - h, w, h, .8), { wash: [PAL.rose, PAL.teal, PAL.ochre, PAL.violet, PAL.sky, PAL.sap][(s * 3 + i) % 6], ink: PAL.ink, sw: .6 }); x += w + 3; }
    }
    clock(t);
  }
  function clock(t) {
    const [x, y, r] = CLK, h = clockH(t);
    boilSeed('clock');
    paint(ellPts(x, y, r + 8, r + 8, 26, 1), { wash: PAL.clayDk, ink: PAL.ink, sw: 1.2 });
    paint(ellPts(x, y, r, r, 26, 1), { wash: PAL.cream, ink: PAL.ink, sw: .8 });
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; inkLine([[x + Math.cos(a) * r * .8, y + Math.sin(a) * r * .8], [x + Math.cos(a) * r * .92, y + Math.sin(a) * r * .92]], i % 3 ? .5 : .9, PAL.ink, 'inkfine', 0); }
    const ha = (h % 12) / 12 * TAU - Math.PI / 2, ma = frac(h) * TAU - Math.PI / 2;
    inkLine([[x, y], [x + Math.cos(ha) * r * .5, y + Math.sin(ha) * r * .5]], 2, PAL.ink, 'ink', 0);
    inkLine([[x, y], [x + Math.cos(ma) * r * .78, y + Math.sin(ma) * r * .78]], 1.3, PAL.ink, 'ink', 0);
    paint(ellPts(x, y, 5, 5, 10), { wash: PAL.ink, ink: null });
  }
  function desk(t) {
    boilSeed('desk');
    paint(rectPts(140, DESKY + 16, 1680, 600, 2), { wash: WOODDK, fill: mixCol(WOODDK, PAL.ink, .3), fillOp: 60, tex: .6, ink: PAL.ink, sw: 1.2 });
    paint(rectPts(130, DESKY - 8, 1700, 26, 1.5), { wash: WOOD, fill: mixCol(WOOD, PAL.cream, .3), fillOp: 60, tex: .5, ink: PAL.ink, sw: 1.2 });
    inkLine([[180, DESKY + 60], [1780, DESKY + 64]], .6, mixCol(WOODDK, PAL.ink, .4), 'inkfine', .3);
  }
  function keyboard(t) {
    boilSeed('keyboard');
    paint([[560, DESKY - 12], [1000, DESKY - 12], [1022, DESKY + 12], [538, DESKY + 12]], { wash: '#454058', ink: PAL.ink, sw: 1 });
    const n = typed(t), hot = n && t - KEYS[n - 1][0] < .09 ? Math.floor(hash(n * 3.7) * 48) : -1;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 16; c++) {
      const x = 566 + c * 27 + r * 7 - (r === 2 ? 14 : 0), y = DESKY - 9 + r * 7;
      paint(rectPts(x, y, 22, 5), { wash: r * 16 + c === hot ? PAL.cream : '#6C6684', ink: null });
    }
  }
  function monitor(t) {
    const st = screenState(t);
    boilSeed('monitor');
    paint(rectPts(1215, MON.y1 - 6, 50, 66, 1), { wash: '#3A3650', ink: PAL.ink, sw: 1 });
    paint(ellPts(1240, DESKY - 6, 95, 12, 18, 1), { wash: '#3A3650', ink: PAL.ink, sw: 1 });
    paint(rrPts(MON.x0, MON.y0, MON.x1 - MON.x0, MON.y1 - MON.y0, 14, 1.2), { wash: '#2E2A40', ink: PAL.ink, sw: 1.4 });
    paint(rectPts(SX0, SY0, SX1 - SX0, SY1 - SY0), { wash: SCREEN[st], ink: null });
    // the code: rows of coloured bars that scroll up as Clawd types
    const scroll = typed(t) / 5, top = Math.floor(scroll), fr = scroll - top, errRow = top + 6;   // the failing line: always the 7th on screen
    for (let k = 0; k < 12; k++) {
      const r = top + k, y = SY0 + 16 + k * 23 - fr * 23; if (y < SY0 + 6 || y > SY1 - 18) continue;
      const bad = st !== 'code' && r === errRow, a = st === 'code' ? 235 : st === 'err' ? (bad ? 255 : 120) : 190;
      if (bad && st === 'err') paint(rectPts(SX0 + 6, y - 5, SX1 - SX0 - 12, 20), { wash: '#8C2233', ink: null });
      let x = SX0 + 18 + Math.floor(hash(r * 3.1) * 4) * 22;
      for (let s = 0, n = 1 + Math.floor(hash(r * 5.7) * 4); s < n && x < SX1 - 60; s++) {
        const w = 26 + 80 * hash(r * 7 + s * 13);
        paint(rrPts(x, y, Math.min(w, SX1 - 30 - x), 10, 5), { wash: bad && st === 'err' ? '#FF8A8A' : SYN[Math.floor(hash(r * 11 + s) * SYN.length)], washOp: a, ink: null });
        x += w + 10;
      }
    }
    if (st === 'code' && (t * 2 % 1) < .6) paint(rectPts(SX0 + 30, SY1 - 30, 10, 14), { wash: PAL.cream, ink: null });   // the cursor
    // the verdict: a red ✕ that pops on every failed build, then a green ✓
    if (st === 'err') {
      const last = FLASH.filter(f => f <= t).pop(), k = backOut(seg(t, last, last + .25)), p = 1 + .06 * Math.sin(t * 8);
      push(); translate(SX1 - 80, SY0 + 70); scale(k * p);
      paint(ellPts(0, 0, 44, 44, 24), { wash: '#E0484F', ink: PAL.ink, sw: 1.2 });
      inkLine([[-18, -18], [18, 18]], 3.2, PAL.cream, 'ink', 0); inkLine([[18, -18], [-18, 18]], 3.2, PAL.cream, 'ink', 0);
      pop();
    } else if (st === 'ok') {
      const k = backOut(seg(t, tOK, tOK + .3));
      push(); translate(SCX, SCY); scale(k * (1 + .04 * Math.sin(t * 5)));
      paint(ellPts(0, 0, 74, 74, 28), { wash: '#4FBF73', ink: PAL.ink, sw: 1.4 });
      inkLine([[-34, 2], [-10, 26], [36, -26]], 5, PAL.cream, 'ink', 0);
      pop();
    }
  }
  // the light the screen throws, and the flare of each failed build
  function screenLight(t) {
    const st = screenState(t), last = FLASH.filter(f => f <= t).pop() ?? -9, fl = st === 'err' ? Math.exp(-(t - last) * 3) : 0;
    const col = st === 'code' ? '#7FA7FF' : st === 'err' ? '#FF5A5A' : '#6CFF9A', a = (st === 'ok' ? .5 + .8 * Math.exp(-(t - tOK) * 2) : .45 + .6 * fl) * (1 - .7 * dawnK(t));
    glow(SCX - 120, SCY + 40, 760, col, a);
  }
  function mugs(t) {
    MUGS.forEach((t0, i) => {
      if (t < t0 - .3) return;
      const y0 = DESKY - 6 - i * MH, x = MUGX + [0, 5, -4, 7][i], fall = seg(t, t0 - .3, t0), land = t - t0;
      const y = t0 === 0 ? y0 : lerp(y0 - 700, y0, easeIn(fall)), sq = land > 0 ? .25 * Math.exp(-land * 12) * Math.cos(land * 30) : -.12 * fall;
      boilSeed('mug' + i);
      push(); translate(x, y); scale(1 + sq * .5, 1 - sq);
      const col = [PAL.cream, PAL.rose, PAL.sky, PAL.ochre][i];
      paint(ribbon([[20, -34], [34, -26], [34, -14], [20, -8]], 7, 7), { wash: col, ink: PAL.ink, sw: .8 });
      paint(rrPts(-22, -MH + 2, 44, MH - 2, 7, .5), { wash: col, fill: mixCol(col, PAL.ink, .2), fillOp: 50, tex: .5, ink: PAL.ink, sw: 1 });
      paint(ellPts(0, -MH + 5, 19, 5, 14), { wash: '#4A2C1E', ink: PAL.ink, sw: .6 });
      pop();
      if (i === MUGS.filter(m => m <= t).length - 1 && t < tC) for (let s = 0; s < 2; s++) {   // steam from the newest mug
        const ph = frac(t * .6 + s * .5), yy = y - MH - 10 - ph * 60;
        inkLine([[x - 6 + s * 10, yy + 30], [x - 12 + s * 10 + 6 * Math.sin(t * 3 + s), yy + 15], [x - 4 + s * 10, yy]], .7, mixCol(PAL.cream, WALL, .3), 'inkfine', .6);
      }
    });
  }
  // Sprout, the desk plant, standing in its pot
  function plant(t) {
    const mood = emotions(t, [[0, 'sleepy', { emote: null }], [tWake, 'surprised', { emote: null }], [tWake + .35, 'happy', { lookX: 1 }], [tWake + .8, 'love', { lookX: 1 }]]);
    const o = { ...mood, boilKey: 'plant', noShadow: true, aL: -.7, aR: -.7, ...(t > tWake + .3 ? turn(t, tWake + .3, tWake + .42, 0, .125) : {}) };
    if (t > tWake + .35) { o.aL = mood.aL; o.aR = mood.aR; }
    sprout(POT, DESKY - 64, 11, o);
    boilSeed('pot');
    paint([[POT - 48, DESKY - 72], [POT + 48, DESKY - 72], [POT + 36, DESKY - 4], [POT - 36, DESKY - 4]], { wash: PAL.clay, fill: PAL.clayDk, fillOp: 70, tex: .5, ink: PAL.ink, sw: 1 });
    paint(rectPts(POT - 54, DESKY - 80, 108, 16, .5), { wash: PAL.clayLt, ink: PAL.ink, sw: 1 });
  }
  // the bug: a little beetle on the screen, then on the desk
  const BUGPATH = [[tRun, [SX1 - 80, 0]], [tRun + .18, [SX0 + 80, SY1 - 14]], [tRun + .3, [SX0 + 30, MON.y1 + 4]], [tRun + .45, [1003, DESKY - 8]]];
  function bugAt(t, rowY) {
    if (t < tBug || t > tSlam + .45) return null;
    if (t < tRun) return { x: lerp(SX1 + 10, SX1 - 80, backOut(seg(t, tBug, tBug + .3))), y: rowY - 4, dir: 1 };
    if (t < tRun + .45) { const [x, y] = kf(t, BUGPATH.map(([k, p]) => [k, [p[0], p[1] || rowY + 2]]), x => x); return { x, y: y + 2 * Math.sin(t * 60), dir: 1, run: true }; }
    return { x: 1003, y: DESKY - 8, dir: 1, flat: t > tSlam };
  }
  function bug(t) {
    const rowY = SY0 + 16 + 6 * 23 - (typed(t) / 5 % 1) * 23, b = bugAt(t, rowY);   // it hides in the failing line
    if (!b) return;
    boilSeed('bug');
    push(); translate(b.x, b.y); scale(b.dir * 1.7, 1.7);   // lime on the red screen, so the eye finds it
    if (b.flat) {   // squashed flat, then gone in a puff of stars
      const k = seg(t, tSlam, tSlam + .4);
      if (k < .5) { paint(ellPts(0, 2, 26, 6, 14), { wash: '#A8D84E', ink: PAL.ink, sw: .8 }); for (let i = 0; i < 6; i++) inkLine([[-18 + i * 7, 2], [-22 + i * 9, 10]], .6, PAL.ink, 'inkfine', 0); }
      pop();
      for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * .5, q = easeOut(k); if (k > 0 && k < 1) paint(starPts(b.x + Math.cos(a) * 60 * q, b.y - 10 + Math.sin(a) * 50 * q, 9 * (1 - k * .6), .4, 4), { wash: PAL.ochre, washOp: 255 * (1 - k), ink: PAL.ink, sw: .5 }); }
      return;
    }
    const leg = b.run ? Math.sin(t * 70) * 4 : Math.sin(t * 8) * 1.5;
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) inkLine([[-8 + i * 8, 0], [-12 + i * 9 + (i % 2 ? leg : -leg) * s, 10 * s * .9 + 4]], .7, PAL.ink, 'inkfine', 0);
    paint(ellPts(0, -2, 15, 10, 16), { wash: '#B6E05A', fill: '#5E8A2A', fillOp: 60, ink: PAL.ink, sw: .8 });
    for (const [sx, sy] of [[-4, -6], [5, -4], [1, 3]]) paint(ellPts(sx, sy, 2.4, 2, 8), { wash: PAL.ink, ink: null });
    inkLine([[0, -12], [0, 8]], .6, PAL.ink, 'inkfine', 0);
    paint(ellPts(-15, -3, 6, 6, 10), { wash: PAL.ink, ink: null });
    for (const s of [-1, 1]) inkLine([[-18, -6], [-26 - 3 * Math.sin(t * 20 + s), -14 + 6 * s * .3]], .6, PAL.ink, 'inkfine', .3);
    paint(ellPts(-17, -5, 1.6, 1.6, 6), { wash: PAL.cream, ink: null });
    pop();
  }

  // ---------- Clawd ----------
  const MOODS = [[0, 'happy', { emote: 'music' }], [tErr + .02, 'surprised', { lookX: .7 }], [tA, 'determined', { lookX: .8, lookY: .3 }],
    [6.8, 'sleepy', { emote: null, lookX: .8, lookY: .3 }], [tFury, 'furious'], [tSee, 'suspicious', { lookX: 1, lookY: .4 }], [tIdea, 'idea', { lookX: 1, lookY: .4 }],
    [tWind, 'determined', { lookX: 1, lookY: .7 }], [tSlam + .15, 'starstruck'], [tC + .2, 'excited'], [12.5, 'relieved'], [tYawn, 'sleepy', { emote: null, mouth: 'yawn' }], [tDown, 'sleepy']];
  function clawdPose(t) {
    const m = emotions(t, MOODS), o = { ...m, hat: 'headphones', boilKey: 'clawd', noShadow: true, view: 'q' };
    const typing = (t > .9 && t < 3.25) || (t > 4.7 && t < 7.95);
    if (typing) { o.aL = -.35 + .08 * Math.sin(t * 5) - .5 * press(t, 0); o.aR = -.4 + .08 * Math.sin(t * 5 + 1) - .5 * press(t, 1); }
    if (t > 3.0 && t < tErr + .3) {   // the wind-up and the Enter
      o.aR = t < tEnter ? lerp(-.4, 1.1, easeOut(seg(t, 3.0, 3.25))) - 1.5 * easeIn(seg(t, 3.25, tEnter)) : -.45;
      o.sq = (o.sq || 0) + (t > tEnter ? .12 * Math.exp(-(t - tEnter) * 10) : -.05 * seg(t, 3.0, 3.25));
    }
    if (t > 7.9 && t < 8.97) Object.assign(o, t < 8.85 ? turn(t, 7.92, 8.05, .125, 0) : turn(t, 8.85, 8.97, 0, .125));   // fury faces us (the lid)
    if (t > tWind - .05 && t < tSlam + .4) {   // wind-up, slam, hold
      const up = easeOut(seg(t, tWind, tWind + .3)), down = easeIn(seg(t, tSlam - .06, tSlam));
      o.aR = lerp(lerp(o.aR ?? .2, 1.6, up), -.95, down); o.aL = lerp(.2, -.4, up);
      o.sq = (o.sq || 0) - .1 * up * (1 - down) + (t > tSlam ? .22 * Math.exp(-(t - tSlam) * 9) * Math.cos((t - tSlam) * 30) : 0);
      o.smear = t > tSlam - .08 && t < tSlam + .02 ? .6 : 0; o.smearDir = 1;
    }
    if (t >= tC) {   // dawn: face us to celebrate, then yawn, then sleep on the desk
      Object.assign(o, turn(t, tC + .1, tC + .25, .125, 0));
      const hop = jump(t, tJump, tJump + .45, 2.6); o.dy = (o.dy || 0) + hop.dy; o.sq = (o.sq || 0) + hop.sq;
      if (t > tYawn) { const s = ease(seg(t, tYawn, tYawn + .4)) * (1 - ease(seg(t, tDown - .2, tDown))); o.aL = lerp(o.aL ?? .2, 1.4, s); o.aR = lerp(o.aR ?? .2, 1.3, s); o.sq = (o.sq || 0) - .1 * s; }
      if (t > tDown - .2) { const d = ease(seg(t, tDown - .2, tDown + .3)); o.dy = lerp(o.dy || 0, 1.25, d); o.rot = lerp(o.rot || 0, .12, d); o.aL = lerp(o.aL ?? .2, -1.1, d); o.aR = lerp(o.aR ?? .2, -1.05, d); o.sq = (o.sq || 0) + .06 * d + .02 * Math.sin(t * 2.6) * d; }
    }
    return o;
  }

  // ---------- camera ----------
  const cam = t => kf(t, [[0, [990, 560, 1]], [4.1, [990, 565, 1.02]], [tA, [930, 620, 1.3]], [tBug, [945, 615, 1.36]], [tBug + .5, [1010, 620, 1.4]], [tC - .01, [1010, 620, 1.4]], [tC, [990, 560, 1]], [13.4, [930, 590, 1.08]], [15.0, [610, 650, 1.5]], [16.8, [600, 655, 1.56]]]);
  function shake(t) {
    const hits = [[tErr, 9], [tFury, 6], [tSlam, 16]].map(([h, a]) => t > h ? shakeXY(t, a * Math.exp(-(t - h) * 8)) : [0, 0]);
    return hits.reduce((s, h) => [s[0] + h[0], s[1] + h[1]], [0, 0]);
  }

  function frame(t, lt, dur) {
    const [cx, cy, z] = cam(t), [sx, sy] = shake(t), dk = dawnK(t);
    camBegin(cx + sx + 8 * Math.sin(t * .6), cy + sy, z);
    room(t);
    boilSeed('night1'); paint(rectPts(-700, -600, 3300, 2300), { wash: NIGHT, washOp: 160 * (1 - dk) + 40, ink: null });   // the room in the dark
    clawd(CX, CY, CU, clawdPose(t));
    desk(t); keyboard(t); mugs(t); plant(t);
    boilSeed('night2'); paint(rectPts(-700, -600, 3300, 2300), { wash: NIGHT, washOp: 70 * (1 - dk), ink: null });          // the cast, less so
    monitor(t); bug(t); screenLight(t);
    if (dk > 0) glow(420, 430, 900, '#FFD9A0', .55 * dk);   // morning light through the window
    const at = toScreen(CX, CY - 5 * CU), mid = toScreen((POT + CX) / 2 + 40, DESKY - 70);
    camEnd();
    boilSeed('transition');
    if (t < .7) iris(...at, lerp(0, 1600, easeIn(t / .7)));
    if (t < tC && lt > dur - .3) brushWipe((lt - (dur - .3)) / .6, ['#F2B36B', '#E98A8A']);
    if (t >= tC && lt < .3) brushWipe(.5 + lt / .6, ['#F2B36B', '#E98A8A']);
    if (t > 15.9) { const r = t < 16.35 ? lerp(1600, 470, ease(seg(t, 15.9, 16.35))) : t < 16.55 ? 470 : lerp(470, 0, easeIn(seg(t, 16.55, 16.78))); iris(...mid, r); }
  }
  shots([[0, frame], [tC, frame]]);

  // ---------- the score ----------
  const E = [], note = (t, inst, midi, dur, vel = .6, pan = 0) => E.push({ t, type: 'note', inst, midi, dur, vel, pan }),
        drum = (t, kind, vel = .6, o = {}) => E.push({ t, type: 'drum', kind, vel, ...o }), sfx = (t, kind, o = {}) => E.push({ t, type: 'sfx', kind, ...o });
  const chord = (t, notes, dur, vel = .5, inst = 'keys') => notes.forEach((m, i) => note(t + i * .012, inst, m, dur, vel * (1 - i * .06), -.3 + .2 * i));
  // A: the lo-fi groove, until the error
  sfx(0, 'crackle', { dur: tErr, vel: .35 });
  [[0, [53, 57, 60, 64], 41], [2 * BEAT, [52, 55, 59, 62], 40], [4 * BEAT, [50, 53, 57, 60], 38]].forEach(([t, c, b]) => { chord(t, c, 2 * BEAT - .05, .5); note(t, 'bass', b, .55, .7); note(t + 1.5 * BEAT, 'bass', b + 7, .25, .5); });
  for (let b = 0; b < 5.5; b += .5) {
    const t = b * BEAT + (b % 1 ? .12 * BEAT : 0); if (t >= tErr) break;
    drum(t, 'hat', b % 1 ? .35 : .5);
    if (b % 2 === 0 || b === 2.5) drum(t, 'kick', b === 2.5 ? .55 : .8);
    if (b % 2 === 1) drum(t, 'snare', .5);
  }
  E.push({ t: tErr, type: 'tapestop', dur: .3, until: tA });   // stops before the 4.0 tick, which then sounds alone
  // the clock: a beat-locked tick-tock all night, racing through the time-lapse
  for (let t = 0; t < tC - .3; ) {
    const step = t < tLapse0 ? BEAT : t < tLapse1 ? BEAT / (2 + 4 * ease(seg(t, tLapse0, 6.8)) * (1 - seg(t, 7.4, tLapse1))) : BEAT;
    sfx(t, 'tick', { vel: t > tErr && t < tA ? .75 : .38, hi: Math.round(t / BEAT * 2) % 2 === 1 }); t += step;
  }
  // typing, Enter, the errors
  KEYS.forEach(([t], i) => sfx(t, 'key', { vel: t < tErr ? .35 : .5 }));
  sfx(tEnter, 'enter', { vel: .9 }); drum(tEnter, 'snare', .7);
  FLASH.forEach((t, i) => sfx(t + .02, 'buzz', { n: i === 0 || i === FLASH.length - 1 ? 2 : 1, vel: i === 0 ? .9 : .5 }));
  // B: the drone, a heartbeat, frantic hats, the time-lapse
  note(tA, 'pad', 45, 2.3, .8); note(tA, 'pad', 52, 2.3, .6); note(tA, 'pad', 57, 2.3, .5);
  note(6.8, 'pad', 41, 2.0, .7, -.2); note(6.8, 'pad', 48, 2.0, .5, .2); note(6.8, 'pad', 57, 2.0, .4);
  for (let t = tA; t < tBug - .1; t += BEAT) { drum(t, 'kick', .45); drum(t + BEAT / 2, 'kick', .25); }
  for (let t = tA; t < tLapse0; t += BEAT / 4) drum(t, 'hat', .22 + .1 * ((t / BEAT * 4) % 2 < 1));
  for (let t = tA; t < tFury; t += BEAT / 2) note(t, 'bass', t < 6.8 ? 33 : 29, .2, .45);
  sfx(tLapse0 - .1, 'whoosh', { dur: .5, f0: 200, f1: 1800, vel: .4 });
  MUGS.slice(1).forEach(t => { sfx(t - .28, 'whoosh', { dur: .28, f0: 2500, f1: 500, vel: .3, pan: -.4 }); sfx(t, 'clunk', { vel: .7, pan: -.4 }); });
  // fury
  drum(tFury, 'kick', 1); note(tFury, 'pad', 38, .9, .8); note(tFury, 'pad', 50, .9, .6); note(tFury, 'lead', 62, .3, .5); note(tFury + .15, 'lead', 61, .5, .45);
  sfx(tFury + .1, 'hiss', { dur: .8, vel: .8 });
  // the bug: silence but a held high note, the skitter, the idea, the riser, the slam, the bells
  note(tBug, 'pad', 76, 1.35, .35, .3); sfx(tBug, 'skitter', { dur: .28, vel: .5, pan: .5 });
  sfx(tIdea, 'ding', { midi: 88, vel: .8 });
  sfx(tRun, 'skitter', { dur: .45, vel: .6, pan: .3 });
  sfx(tWind, 'riser', { dur: tSlam - tWind, vel: .6 });
  sfx(tSlam, 'slam', { vel: 1 }); sfx(tSlam + .03, 'poof', { vel: .6 });
  sfx(tOK, 'chime', { midi: 84, vel: .8 }); chord(tOK + .05, [48, 55, 60, 64, 67], .9, .6);
  sfx(tC - .35, 'whoosh', { dur: .7, f0: 400, f1: 3500, vel: .5 });
  // C: dawn
  sfx(tC, 'crackle', { dur: 16.8 - tC, vel: .25 });
  const P = [[tC, [48, 55, 59, 64], 36, [60, 64, 67, 71]], [tC + 2 * BEAT * 1, [53, 57, 60, 64], 41, [65, 69, 72, 76]], [tC + 4 * BEAT, [45, 52, 55, 60], 45, [64, 67, 72, 76]], [tC + 6 * BEAT, [53, 57, 60, 64], 41, [65, 69, 72, 77]], [tC + 8 * BEAT, [48, 55, 62, 64, 67], 36, [72, 74, 76, 79]]];
  P.forEach(([t, c, b, arp], i) => {
    const last = i === P.length - 1, d = last ? 16.8 - t : 2 * BEAT - .05;
    chord(t, c, d, .45); note(t, 'bass', b, last ? d : .9, .55);
    if (!last) arp.forEach((m, k) => note(t + k * BEAT / 2, 'pluck', m, .4, .45, -.3 + .2 * k));
    else arp.forEach((m, k) => note(t + k * .09, 'bell', m, 1, .35, -.3 + .2 * k));
  });
  sfx(tJump, 'pop', { vel: .6 }); note(tJump, 'lead', 79, .12, .4); note(tJump + .1, 'lead', 84, .2, .4);
  [[tC + .4, .7], [12.9, .4], [tWake, .6], [15.4, .45]].forEach(([t, p]) => sfx(t, 'chirp', { pan: -.6, vel: .5, n: 2 + Math.round(hash(t) * 2) }));
  sfx(tDown + .1, 'thud', { vel: .5 });
  sfx(tDown + .5, 'snore', { n: 2, period: 1.1, vel: .5 });
  sfx(tWake, 'pop', { vel: .35, pan: -.5 }); note(tWake + .8, 'bell', 96, .3, .25, -.5); note(tWake + .95, 'bell', 100, .3, .2, -.5);
  window.SOUND = { events: E, master: { reverb: .22, music: 1, fx: 1.05 } };
})();
