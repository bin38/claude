// sprout.js: Sprout, Clawd's friend. A round mint seed-pod with a two-leaf sprout on its head, noodle arms, round eyes
// and two little feet. Clawd is a block and Sprout is an egg, so the two read apart at a glance, even in silhouette.
// u matches Clawd's: the body is 6.6u wide and 7.2u tall, the feet reach the ground at y 0 and the leaves top out near
// -11u, so at the same u Sprout stands a head shorter than Clawd, with its leaves poking up past it.
//
// sprout(x, y, u, o) takes the same options as clawd() (pose, view, face, colour, extras, boil), so everything that
// drives Clawd drives Sprout too: feel(), emotions(), turn(), jump(), take(), stroll(), move(). What's its own:
//   face:   round eyes (o.eyeStyle 'round'; pass 'slit' for Clawd's), sitting lower and closer together
//   leaves: they act. They wilt when Sprout is low, stand up when it's excited or alarmed, shiver when it's scared,
//           and drag behind squash, stretch and tilts (follow-through). leaf: extra angle in radians (+ opens them
//           outward), leafDroop: -1..1 to set the mood by hand (1 = wilted flat, -1 = standing straight up), noLeaf.
//   lid:    Sprout has no lunchbox lid; furious shows its teeth instead.
//   colour: SPROUT_COL, shifted by tint like Clawd's (bodyCols in clawd.js).
// Body-local front-view coordinates, for o.draw: body x -3.3u..3.3u, y -8.2u..-1u; eyes at (±1.5u, -5.3u); mouth near
// (0, -4.3u); belly patch around (0, -3.2u). o.armL / o.armR are called at the arm tip, in arm space, as in clawd().
// tintScale: mood tints at half strength. Mint mixed with the warm tints (rosy, flush) turns grey, and Sprout's leaves
// and cheeks already carry the mood.
const SPROUT_COL = { col: '#74B9A7', dk: '#3E8475', lt: '#C4E7D7', leaf: '#8DC05A', leafDk: '#557F34', tintScale: .5 };

// Drawn key views, as for Clawd (every view faces screen-right; flip: true mirrors). Numbers are in u.
//   w: body width scale.  face: cx (centre x), fw (width scale), sides (which eyes show), mx (mouth x, face units),
//   bx (cheek x, face units).  belly: belly patch x, or null.  seam: the seed line down the back, or null.
//   leaf: where the stem leaves the head.  feet: [x, far].  arms: [shoulderX, dir, which, layer] as in VIEWS.
const SPROUT_VIEWS = {
  front: { w: 1, face: { cx: 0, fw: 1, sides: [-1, 1], mx: 0, bx: 3.5 }, belly: 0, seam: null, leaf: 0,
           feet: [[-1.45, 0], [1.45, 0]], arms: [[-2.95, -1, 'L', 0], [2.95, 1, 'R', 0]] },
  q:     { w: 1, face: { cx: 1, fw: .8, sides: [-1, 1], mx: .4, bx: 3.3 }, belly: .9, seam: null, leaf: .35,
           feet: [[-1.1, 1], [1.5, 0]], arms: [[3.0, 1, 'R', 2], [-2.8, -1, 'L', 1]] },
  side:  { w: .92, face: { cx: 1.75, fw: .6, sides: [1], mx: 1.6, bx: 2 }, belly: 1.55, seam: null, leaf: .55,
           feet: [[-.75, 1], [.75, 0]], arms: [[.3, 0, 'L', 1]] },
  qback: { w: 1, face: null, belly: null, seam: -.9, leaf: -.35,
           feet: [[1.1, 1], [-1.5, 0]], arms: [[-3.0, -1, 'R', 2], [2.8, 1, 'L', 1]] },
  back:  { w: 1, face: null, belly: null, seam: 0, leaf: 0,
           feet: [[-1.45, 0], [1.45, 0]], arms: [[-2.95, -1, 'R', 0], [2.95, 1, 'L', 0]] },
};
for (const V of Object.values(SPROUT_VIEWS)) { V.L = -3.4 * V.w; V.R = 3.4 * V.w; }   // edges, for smearTrail

// How the leaves feel, by eye shape: + wilts them, - stands them up.
const LEAF_MOOD = { sad: .85, teary: .8, cry: .95, x: 1, sleepy: .6, closed: .15, narrow: .25, look: .1, squeeze: .2,
                    scared: -.55, wide: -.45, spark: -.5, shine: -.3, heart: -.25, happy: -.15, red: -.7, angry: -.4,
                    determined: -.3, swirl: .4, blank: .3, dot: .2, shades: -.1 };

const eggPts = (u, w, j = 0) => {
  const p = []; for (let i = 0; i < 30; i++) { const a = i / 30 * TAU, s = Math.sin(a); p.push([Math.cos(a) * 3.3 * u * w * (1 + .1 * s) + jit(j), -4.6 * u + s * 3.6 * u + jit(j)]); }
  return p;
};

function sprout(x, y, u, o = {}) {
  const id = o.boilKey ?? ++CLAWD_N, rs = part => boilSeed(`sprout ${id} ${part}`);
  x += (o.dx || 0) * u;
  const V = SPROUT_VIEWS[o.view] || SPROUT_VIEWS.front;
  const dy = (o.dy || 0) * u, sq = (o.sq || 0) + (o.take || 0), sm = clamp(o.smear || 0);
  const sw = clamp(u / 15, .45, 2.4) * (o.swMul || 1), J = u * .06;
  const { col, dk, lt } = bodyCols(o, SPROUT_COL), far = mixCol(dk, PAL.ink, .22);

  rs('shadow');
  if (!o.noShadow) {
    const f = 1 - Math.min(.5, Math.abs(o.dy || 0) * .06);
    paint(ellPts(x, y + u * .15, u * 3.9 * f * V.w, u * .8 * f, 20), { fill: PAL.ink, fillOp: 90, bleed: .25, tex: .3, border: .1, ink: null });
  }
  if (sm > .05) smearTrail(x, y + dy, u * .72, V, sm, o.smearDir ?? (o.flip ? -1 : 1), col);

  push();
  translate(x, y + dy);
  if (o.rot) rotate(o.rot);
  scale((o.flip ? -1 : 1) * (o.sx ?? 1) * (1 + sq * .6) * (1 + sm * .35), (o.sy ?? 1) * (1 - sq));

  // noodle arms: one tapered ribbon each, widening into a mitten at the tip
  const arm = ([px, dir, which, layer]) => {
    rs('arm' + which);
    // a noodle hangs: held "straight out" (a = 0) it droops well below the shoulder and bends; raised, it straightens
    const a0 = which === 'L' ? (o.aL ?? .2) : (o.aR ?? .2), a = a0 - .55 * (1 - clamp(a0 / 1.4)), hook = which === 'L' ? o.armL : o.armR;
    push(); translate(px * u * V.w, -4.1 * u);
    if (dir === 0) { translate(0, .3 * u); rotate(.7 - a); }   // side view: the near arm reaches forward
    else { rotate(dir < 0 ? a : -a); if (dir < 0) scale(-1, 1); }
    const sag = .75 * u * Math.max(0, Math.cos(a));
    paint(ribbon([[-.4 * u, 0], [1.1 * u, sag], [2.4 * u, sag * .55]], .5 * u, .82 * u), { wash: layer === 2 ? mixCol(col, dk, .45) : col, washOp: 255, ink: PAL.ink, sw: sw * .75 });
    if (hook) { translate(2.4 * u, sag * .55); hook(u, sw); }
    pop();
  };

  V.arms.filter(a => a[3] !== 1).forEach(arm);
  // feet: two round pads under the body, far one darker; walk lifts them (and swings them, in profile)
  V.feet.forEach(([fx, isFar], i) => {
    rs('foot' + i);
    let lift = 0, sx = 0;
    if (o.walk != null) {
      const ph = (o.walk + (i ? .5 : 0)) * TAU;
      if (o.view === 'side') { sx = Math.sin(ph) * .75; lift = Math.max(0, Math.cos(ph)) * .55; }
      else lift = Math.max(0, Math.sin(ph)) * .6;
    }
    paint(ellPts((fx + sx) * u, (-.5 - lift) * u, .95 * u, .52 * u, 14, J * .5), { wash: isFar ? far : dk, washOp: 255, ink: PAL.ink, sw: sw * .8 });
  });
  if (!o.noLeaf) { rs('leaf'); sproutLeaves(u, sw, o, V, id); }

  rs('body');
  const body = eggPts(u, V.w, J);
  paint(body, { wash: col, washOp: 255, ink: null });
  paint(ellPts(-1.1 * u * V.w, -6.4 * u, 1.9 * u * V.w, 1.2 * u, 16, J, -.25), { fill: lt, fillOp: V.face ? 130 : 90, bleed: .2, tex: .8, border: .8, ink: null });
  paint(ellPts(0, -2.1 * u, 2.3 * u * V.w, .9 * u, 16, J), { fill: dk, fillOp: 110, bleed: .04, tex: .7, border: .5, ink: null });
  if (V.belly != null) paint(ellPts(V.belly * u, -3.2 * u, 1.8 * u * (V.face.fw * .5 + .5), 1.55 * u, 18, J * .6), { wash: mixCol(col, PAL.cream, .6), washOp: 220, ink: null });
  if (V.seam != null) inkLine([[V.seam * u, -7.7 * u], [(V.seam + .25) * u, -5 * u], [V.seam * u, -2.3 * u]], sw * .55, PAL.ink, 'inkfine', .6);
  paint(body, { ink: PAL.ink, sw });
  if (o.gloom > .02) sproutGloom(u, sw, V, o.gloom);

  if (V.face) {
    const F = V.face, k = .6;   // Clawd's face system, drawn smaller and lower: face units are Clawd's front-view units
    push(); translate(F.cx * u * V.w, -5.3 * u); scale(k * F.fw, k); translate(0, 6 * u);
    const fsw = sw / k * .85;
    if (o.blush) blush(u, fsw, F, o.blush === true ? 1 : o.blush);
    if (o.hat === 'mask' && F.sides.length > 1) paint([[-4.4 * u, -7.7 * u], [4.4 * u, -7.7 * u], [3.6 * u, -4.9 * u], [.5 * u, -5.4 * u], [-.5 * u, -5.4 * u], [-3.6 * u, -4.9 * u]], { wash: PAL.violet, ink: PAL.ink, sw: fsw * .7 });
    rs('eyes'); eyes(u, { ...o, eyeStyle: o.eyeStyle ?? 'round' }, fsw, F.sides, sm);
    rs('mouth'); push(); translate(F.mx * u, 0); mouth(u, o.mouth ?? ((o.lid || 0) > .05 ? 'teeth' : null), fsw); pop();
    if (['cat', 'masq', 'bowtie'].includes(o.hat)) faceHat(u, o.hat, fsw, F.sides);
    pop();
  }
  // hats: Clawd's, scaled to perch on the top of the egg
  rs('hat'); push(); translate(V.leaf * .6 * u, -8.05 * u); scale(.62 * V.w, .62); translate(0, 8 * u); hat(u, o.hat, sw / .62); pop();
  V.arms.filter(a => a[3] === 1).forEach(arm);
  rs('draw'); if (o.draw) o.draw(u, sw);
  pop();

  rs('emote');
  if (o.emote) {
    const top = EMOTE_TOP.includes(o.emote), dir = o.flip ? -1 : 1;
    const ex = top ? x + dir * V.leaf * u : x + dir * (V.R + .6) * u, ey = y + dy + (top ? -12.2 : -7.8) * u * (1 - sq);
    emote(o.emote, ex, ey, u * .8, o.emoteK ?? 1, o.emoteAge ?? T);
  }
  rs('after');   // so whatever is drawn next doesn't depend on this pose
}

// The sprout: a curved stem and two leaves, a big one leaning forward and a small one back. The mood (from the eyes,
// or o.leafDroop) opens or folds them, squash and stretch drag them down, a tilt swings them the other way.
function sproutLeaves(u, sw, o, V, id) {
  const kind = Array.isArray(o.eyes) ? o.eyes[0] : o.eyes || 'normal';
  const mood = clamp(o.leafDroop ?? (LEAF_MOOD[kind] ?? 0) + (o.gloom || 0) * .6, -1, 1);
  const shiver = kind === 'scared' ? .07 * Math.sin(T * 42) : 0;
  const sway = .09 * Math.sin(T * TAU * .45 + hash(typeof id === 'number' ? id : 7) * 6) + shiver;
  const drag = Math.min(.9, Math.abs(o.sq || 0) * 2.4), lean = -(o.rot || 0) * 1.3 + sway * .6;
  const bx = V.leaf * u, by = -7.9 * u, sl = 1.55 * u, tx = bx + Math.sin(lean) * sl, ty = by - Math.cos(lean) * sl;
  const { col: leafC, dk: leafD } = bodyCols(o, { col: SPROUT_COL.leaf, dk: SPROUT_COL.leafDk, lt: SPROUT_COL.leaf });
  inkLine([[bx, by + .3 * u], [bx + Math.sin(lean) * sl * .45 + .12 * u, by - sl * .5], [tx, ty]], sw * 1.5, leafD, 'ink', .6);
  const open = o.leaf || 0;
  const leaf = (side, len, wid, ang) => {
    const a = side * clamp(ang, .12, 2.1) + lean, curl = .12 + .35 * Math.max(0, mood) + .2 * drag, P = [], n = 9;
    for (let i = 0; i <= n; i++) { const s = i / n, h = wid / 2 * Math.pow(Math.sin(Math.PI * s), .7) * (1 - .2 * s); P.push([curl * len * s * s - h, -len * s]); }
    for (let i = n - 1; i > 0; i--) { const s = i / n, h = wid / 2 * Math.pow(Math.sin(Math.PI * s), .7) * (1 - .2 * s); P.push([curl * len * s * s + h, -len * s]); }
    push(); translate(tx, ty); rotate(a); scale(side, 1);
    paint(P, { wash: leafC, washOp: 255, fill: leafD, fillOp: 60, bleed: .05, tex: .5, border: .6, ink: PAL.ink, sw: sw * .75, curv: .35 });
    inkLine([[0, -len * .08], [curl * len * .25, -len * .5], [curl * len * .55, -len * .78]], sw * .4, leafD, 'inkfine', .5);
    pop();
  };
  leaf(-1, 2.1 * u, 1.05 * u, .95 + mood * 1.0 + drag + open);   // the small leaf, behind
  leaf(1, 2.9 * u, 1.35 * u, .7 + mood * 1.1 + drag + open);      // the big leaf, leaning forward
}

// Gloom: a dark wash over the top of the head, with hanging gloom lines.
function sproutGloom(u, sw, V, g) {
  const cap = []; for (let i = 0; i <= 14; i++) { const a = Math.PI * (1.12 + .76 * i / 14); cap.push([Math.cos(a) * 3.2 * u * V.w, -4.6 * u + Math.sin(a) * 3.5 * u]); }
  paint(cap, { fill: PAL.indigo, fillOp: 150 * g, bleed: .08, tex: .5, border: .6, ink: null });
  for (let i = 0; i < 4; i++) { const gx = (-1.5 + i) * u * V.w; inkLine([[gx, -7.7 * u + Math.abs(gx) * .12], [gx + jit(u * .05), (-7.7 + 2 * g * (.7 + .3 * hash(i))) * u]], sw * .45, PAL.ink, 'inkfine', 0); }
}

// Sprout's dances: move() works as it is. sproutDancer() is dancer() for Sprout.
function sproutDancer(x, y, u, style, t, extra = {}) { sprout(x, y, u, { ...move(style, t, extra.seed || 0), ...extra }); }
