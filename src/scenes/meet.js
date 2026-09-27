// meet.js: "Sprout", a 12-second example with both characters. Like demo.js, it's one idea to learn from, not a
// template: don't reuse its story, garden or staging (see ANIMATION_GUIDE.md).
//
// Logline: Clawd wants its seed to grow, but nothing happens, so it gives up and trudges off. Behind its back the seed
//          wakes up as Sprout, who calls it back.
// World:   a garden bed on a warm afternoon. Sky ochre-cream, sap hills, brown soil, a blue watering can. The sun's
//          glow warms up once Sprout is out.
// Motif:   the watering can: Clawd pours it, sets it down by the mound, and it stays there through the payoff.
// Arcs:    Clawd hopeful → bored → sad → surprised → excited. Sprout sleepy → surprised → hopeful → excited → happy.
// Shots:
//   A  0–4.6   [in: iris opens on Clawd]  Clawd waters the mound, waits, gives up, sets the can down, turns and
//              trudges left. At 4.0 the camera starts pushing in on the mound, and the push carries into B.
//      reads:  0–0.6 Clawd and the mound, can in hand · 0.6–2.0 the pour (wind-up, tilt, drops land on the mound) ·
//              2.0–2.8 the wait (Clawd leans in, hopeful: nothing) · 2.8–3.3 bored · 3.3–3.7 sad, the can goes down ·
//              3.7–4.6 the turn and the trudge away
//   B  4.6–12  [the push-in from A carries through]  Clawd leaves frame. The mound trembles, two leaves poke out,
//              Sprout pops up, wakes, looks for Clawd. The camera pulls back to show them both. Sprout calls, Clawd
//              turns, and they hop together.
//      reads:  4.6–5.3 Clawd walks out of frame · 5.3–5.9 the mound trembles · 5.9–6.8 leaves poke out and wiggle ·
//              6.8–7.4 Sprout pops out of the soil · 7.4–8.2 it wakes (!) · 8.2–8.9 it looks left, the camera pulls
//              back and finds Clawd, sulking · 9.0–9.5 Sprout jumps and waves · 9.5–10.0 Clawd hears it, turns ·
//              10.0–10.8 both light up and hop, Sprout a beat after Clawd · 11.0–12.0 iris closes on the pair, holds, shuts
(() => {
  const G = 880, MX = 1150, tA = 4.6;   // ground line, the mound's x, the cut
  const SKY = '#F3DBAA', SOIL = '#8A5A3C', SOILDK = '#5E3B26', CAN = '#5B7DB8';
  const CX = 760, CX2 = 480, CU = 24, SU = 22;   // Clawd's start and sulking x, its size, Sprout's size

  // ---------- the garden ----------
  function world(t, warm) {
    boilSeed('sky');
    paint(rectPts(-800, -600, W + 1600, H + 1200), { wash: SKY, ink: null });
    paint(ellPts(1500, 250, 950, 430, 30, 10), { fill: '#F5BE82', fillOp: 90 + 40 * warm, bleed: .3, tex: .5, ink: null });
    glow(1560, 230, 240 + 90 * warm, '#FFD27A', .4 + .5 * warm);
    boilSeed('sun');
    paint(ellPts(1560, 230, 68, 68, 24, 1.5), { wash: '#FFE6A6', ink: PAL.ink, sw: .7 });
    boilSeed('hills');
    paint(ellPts(420, G + 70, 1150, 300, 40, 3), { fill: mixCol(PAL.sap, SKY, .5), fillOp: 160, bleed: .15, tex: .6, ink: null });
    paint(ellPts(1650, G + 90, 1050, 250, 40, 3), { fill: mixCol(PAL.sap, PAL.teal, .35), fillOp: 140, bleed: .15, tex: .6, ink: null });
  }
  function ground(t) {
    boilSeed('ground');
    paint(rectPts(-800, G - 6, W + 1600, 900, 3), { wash: mixCol(PAL.sap, '#E8D29A', .3), fill: PAL.sap, fillOp: 80, bleed: .05, tex: .6, ink: null });
    inkLine([[-300, G - 4], [W / 2, G - 8], [W + 300, G - 3]], 1, PAL.ink, 'ink', .5);
    for (let i = 0; i < 26; i++) {   // grass tufts, each swaying on its own clock
      const x = -200 + hash(i) * 2300; if (Math.abs(x - MX) < 230) continue;
      boilSeed('tuft' + i);
      const s = wob(t, .5, hash(i + 9)) * 5;
      for (const k of [-1, 0, 1]) inkLine([[x + k * 7, G - 4], [x + k * 11 + s, G - 24 - 9 * hash(i + k)]], .8, mixCol(PAL.sap, PAL.ink, .35), 'inkfine', .4);
    }
  }
  // The seed bed. shake = how hard the mound trembles, rise 0..1 = Sprout coming up (the mound spreads and sinks).
  function mound(t, shake, rise) {
    boilSeed('patch');
    paint(ellPts(MX, G + 14, 200, 30, 24, 2), { wash: SOIL, fill: SOILDK, fillOp: 70, bleed: .05, tex: .6, ink: PAL.ink, sw: .8 });
    boilSeed('mound');
    const h = 42 * (1 - .75 * rise), w = 118 + 55 * rise, P = [];
    for (let i = 0; i <= 16; i++) {
      const a = Math.PI * i / 16, q = shake * Math.sin(t * 55 + i * 1.7);
      P.push([MX - w * Math.cos(a) + q * 3, G + 10 - h * Math.sin(a) * (1 + .08 * Math.sin(i * 2.3)) + q * 4]);
    }
    paint(P, { wash: SOIL, fill: SOILDK, fillOp: 90, bleed: .05, tex: .7, ink: PAL.ink, sw: .9 });
    for (let i = 0; i < 5; i++) paint(ellPts(MX - 70 + i * 35, G - h * .45 + 6 * hash(i), 6, 4, 8), { wash: SOILDK, ink: null });   // clods
  }
  // dirt flung out as Sprout comes up (t0 = when it starts)
  function crumbs(t, t0, n, reach) {
    for (let i = 0; i < n; i++) {
      const k = seg(t, t0 + i * .02, t0 + .45 + i * .03); if (k <= 0 || k >= 1) continue;
      const side = i % 2 ? 1 : -1, x0 = MX + side * 20 * hash(i), x1 = MX + side * (80 + reach * hash(i + 3)), p = arcPt([x0, G - 30], [x1, G + 4], 70 + 90 * hash(i + 5), k);
      boilSeed('crumb' + i);
      paint(ellPts(p[0], p[1], 7 + 4 * hash(i), 5 + 3 * hash(i), 8), { wash: i % 3 ? SOIL : SOILDK, ink: PAL.ink, sw: .5 });
    }
  }

  // ---------- the watering can: drawn upright, with its grip at (0, 0) ----------
  const CS = 1.4;   // the can's size, in Clawd units
  const SPOUT = u => [4.25 * u * CS, -.3 * u * CS];
  function can(u, sw, tilt) {
    u *= CS; push(); rotate(tilt);
    inkLine([[.35 * u, -.25 * u], [1.3 * u, -1.15 * u], [2.25 * u, -.25 * u]], sw * 2.2, PAL.ink, 'ink', .7);   // handle
    paint(ribbon([[2.3 * u, 1.2 * u], [3.4 * u, .3 * u], [4.05 * u, -.2 * u]], .5 * u, .28 * u), { wash: CAN, ink: PAL.ink, sw: sw * .7 });
    paint(ellPts(4.2 * u, -.3 * u, .32 * u, .42 * u, 12, 0, .7), { wash: mixCol(CAN, PAL.ink, .3), ink: PAL.ink, sw: sw * .6 });
    paint(rrPts(.1 * u, -.3 * u, 2.4 * u, 2 * u, .35 * u, u * .03), { wash: CAN, fill: mixCol(CAN, PAL.ink, .3), fillOp: 60, tex: .5, ink: PAL.ink, sw: sw * .8 });
    paint(ellPts(.9 * u, .3 * u, .5 * u, .3 * u, 10), { fill: PAL.cream, fillOp: 120, ink: null });   // shine
    pop();
  }
  // Where Clawd's right-arm tip is (q view, facing right), from the same pose clawd() gets.
  function armTip(x, y, u, o) {
    const a = o.aR ?? .2, sq = (o.sq || 0) + (o.take || 0), sx = 1 + sq * .6, sy = 1 - sq, r = o.rot || 0;
    const lx = (5 + .55 * clamp((Math.abs(a) - .7) / .9) + 2.2 * Math.cos(a)) * u * sx, ly = (-4.5 - 2.2 * Math.sin(a)) * u * sy;
    return [x + (o.dx || 0) * u + lx * Math.cos(r) - ly * Math.sin(r), y + (o.dy || 0) * u + lx * Math.sin(r) + ly * Math.cos(r)];
  }
  // In the arm hook: undo the arm's rotation, the body's squash and tilt, so the can hangs upright from the hand.
  const holdCan = (o, tilt) => (u, sw) => {
    const sq = (o.sq || 0) + (o.take || 0);
    rotate(o.aR ?? .2); scale(1 / (1 + sq * .6), 1 / (1 - sq)); rotate(-(o.rot || 0)); can(u, sw, tilt);
  };

  // ---------- Clawd, across both shots ----------
  const tPour = 1.0, tPlace = 3.55, tTurn = 3.7, tGo = 3.85, tStop = 5.6, tHear = 9.5;
  function clawdPose(t) {
    const mood = emotions(t, [[0, 'hopeful', { lookX: .8, lookY: .5 }], [2.8, 'bored', { lookX: .6, lookY: .4 }], [3.3, 'sad'],
                              [tHear, 'surprised', { lookX: -.6 }], [10.0, 'excited']]);
    let o = { ...mood }, x = CX, tilt = 0;
    if (t < tTurn) {   // facing the mound, can in the right hand
      o.view = 'q';
      const up = ease(seg(t, .6, 1.0)) - ease(seg(t, 2.0, 2.3)), down = ease(seg(t, 3.3, tPlace));
      o.aR = lerp(-.2, .6, up) - 1.4 * down + .05 * Math.sin(t * 3);
      o.aL = lerp(mood.aL ?? .2, -.4, seg(t, .6, 1));
      tilt = .75 * (easeOut(seg(t, tPour, tPour + .2)) - ease(seg(t, 1.8, 2.0)));
      o.dx = .5 * ease(seg(t, 2.0, 2.5)) * (1 - seg(t, 2.8, 3.2));                 // leans in to watch
      o.sq = (mood.sq || 0) + .2 * down * (1 - ease(seg(t, tPlace, tTurn)));        // crouches to set the can down
    } else if (t < tGo) {
      Object.assign(o, turn(t, tTurn, tGo, .125, -.25));
    } else if (t < tHear + .1) {   // trudges left, then sulks with its back to the mound
      const w = stroll(t, tGo, tStop, CX, CX2, CU);
      x = w.x; Object.assign(o, { view: 'side', flip: true, walk: t < tStop ? w.walk : null, dy: (mood.dy || 0) * .3 + w.dy });
    } else {
      x = CX2;
      Object.assign(o, turn(t, tHear + .1, tHear + .3, -.25, .125));   // round to face Sprout, via the front
      const hop = jump(t, 10.3, 10.75, 3.2);
      o.dy = (mood.dy || 0) + hop.dy; o.sq = (mood.sq || 0) + hop.sq;
    }
    if (t >= tTurn && t < tHear + .1) x = t < tGo ? CX : x;
    return { x, o, tilt };
  }

  // ---------- Sprout ----------
  function sproutPose(t) {
    // how deep it is (in u, + = under the soil): hidden, leaves poke out, then it pops up with an overshoot
    let dy = t < 5.9 ? 11.5 : t < 6.8 ? lerp(11.5, 7.6, backOut(seg(t, 5.9, 6.25))) : lerp(7.6, 0, backOut(seg(t, 6.8, 7.3)));
    const mood = emotions(t, [[0, 'sleepy'], [7.75, 'surprised'], [8.2, 'hopeful', { lookX: -1 }], [9.0, 'excited', { emote: '!', lookX: -1 }], [10.1, 'happy']]);
    const o = { ...mood, boilKey: 'sprout' };
    if (t < 7.4) { o.emoteK = seg(t, 5.95, 6.25); o.leafDroop = -.3; o.leaf = .3 * Math.sin(t * 14) * seg(t, 6.2, 6.4); o.aL = o.aR = -.9; o.noShadow = dy > .3; }
    if (t > 8.2) Object.assign(o, turn(t, 8.2, 8.35, 0, -.125));
    if (t > 9.0 && t < 9.95) o.aL = lerp(o.aL ?? .2, 1.2 + .5 * Math.sin((t - 9) * 14), ease(seg(t, 9, 9.15)) * (1 - ease(seg(t, 9.8, 9.95))));
    const hop = jump(t, 9.05, 9.45, 2.2), hop2 = jump(t, 10.4, 10.85, 3);
    o.dy = dy + (mood.dy || 0) * (t > 7.4 ? 1 : 0) + hop.dy + hop2.dy; o.sq = (mood.sq || 0) + hop.sq + hop2.sq;
    return o;
  }

  // ---------- the camera: one continuous move across the cut ----------
  const cam = t => kf(t, [[0, [1000, 700, 1.3]], [4.0, [1010, 700, 1.34]], [tA, [1230, 770, 1.75]], [8.2, [1220, 765, 1.77]], [8.9, [830, 700, 1.25]], [12, [825, 695, 1.3]]]);

  function frame(t, lt, dur) {
    const [cx, cy, z] = cam(t), warm = ease(seg(t, 6.8, 8.9));
    camBegin(cx + 10 * Math.sin(t * .7), cy, z);
    world(t, warm);
    const S = sproutPose(t), under = S.dy > .3;
    if (under && t > 5.8) sprout(MX, G + 4, SU, S);   // still under the soil: the ground and the mound cover it
    ground(t);
    const shake = seg(t, 5.3, 5.5) * (1 - seg(t, 7.3, 7.5)) * (.6 + .4 * Math.sin(t * 9));
    mound(t, t > 5.3 ? shake : 0, ease(seg(t, 6.8, 7.3)));
    crumbs(t, 5.95, 6, 60); crumbs(t, 6.8, 12, 150);
    const C = clawdPose(t), cL = { ...C.o, boilKey: 'clawd' };
    const placed = armTip(CX, G, CU, clawdPose(tPlace).o);
    if (t >= tPlace) { boilSeed('can'); push(); translate(...placed); can(CU, clamp(CU / 15, .45, 2.4), 0); pop(); }
    else cL.armR = holdCan(cL, C.tilt);
    clawd(C.x, G, CU, cL);
    if (t < tPlace) {   // water: drops from the spout rose, landing on the mound
      const tip = armTip(CX, G, CU, cL), [sx0, sy0] = SPOUT(CU), c = Math.cos(C.tilt), s = Math.sin(C.tilt);
      const sp = [tip[0] + sx0 * c - sy0 * s, tip[1] + sx0 * s + sy0 * c];
      for (let i = 0; i < 14; i++) {
        const t0 = tPour + .12 + i * .045, k = seg(t, t0, t0 + .32); if (k <= 0 || k >= 1 || t0 > 1.85) continue;
        const p = arcPt(sp, [MX - 40 + 70 * hash(i), G - 34 + 6 * hash(i + 2)], -10, k);
        boilSeed('drop' + i); paint(ellPts(p[0], p[1], 5.5, 8, 8), { wash: PAL.sky, ink: PAL.ink, sw: .5 });
      }
    }
    if (!under) sprout(MX, G + 4, SU, S);
    const eyeC = toScreen(C.x, G - 4 * CU), mid = toScreen((CX2 + MX) / 2, G - 120);
    camEnd();
    boilSeed('transition');
    if (t < .6) iris(...eyeC, lerp(0, 1500, easeIn(t / .6)));
    if (t > 11.0) {   // iris to the pair, hold, shut
      const r = t < 11.45 ? lerp(1500, 520, ease(seg(t, 11.0, 11.45))) : t < 11.7 ? lerp(520, 500, seg(t, 11.45, 11.7)) : lerp(500, 0, easeIn(seg(t, 11.7, 11.95)));
      iris(...mid, r);
    }
  }

  // Two shots, one camera move: the push-in that ends A is where B begins.
  shots([[0, frame], [tA, frame]]);
})();
