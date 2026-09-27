// p5lite.js: the slice of p5 and p5.brush that src/core.js uses, painted with plain Canvas2D.
//
// Load it in place of p5.min.js + p5.brush.js and the kit runs unchanged (core.js, clawd.js, timeline.js, your scenes):
// no WebGL, no GPU and no Chrome needed, so it also runs in Node (see render.mjs). The look is an approximation of
// p5.brush: tapered ink strokes, layered watercolour fills with darker edges, flat washes, hatching and dry brush.
//
// What it keeps from p5: WEBGL's centred origin (core.js translates by -W/2, -H/2), push/pop/translate/rotate/scale,
// seeded random() (so boilSeed() and the 12 fps boil work the same), images with tint and ADD blending (glow()), and
// createGraphics. Every brush shape draws immediately and takes exactly ONE value from random() to seed its own
// wobble, so an element's look depends only on its boilSeed(), as in the original.
(function (G) {
  const newCanvas = G.__newCanvas || ((w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; });
  let cv = null, ctx = null, stack = [], st = { blend: 'source-over', tint: null };

  // ---------- p5 core ----------
  G.WEBGL = 'webgl'; G.P2D = 'p2d'; G.ADD = 'lighter'; G.BLEND = 'source-over'; G.MULTIPLY = 'multiply';
  const base = () => ctx.setTransform(1, 0, 0, 1, cv.width / 2, cv.height / 2);   // WEBGL puts (0, 0) at the centre
  G.createCanvas = (w, h) => {
    cv = newCanvas(w, h); ctx = cv.getContext('2d');
    G.drawingContext = ctx; G.width = w; G.height = h; base(); return cv;
  };
  G.pixelDensity = G.noLoop = G.loop = G.noiseSeed = G.angleMode = () => {};
  G.resetMatrix = () => base();
  G.push = () => { ctx.save(); stack.push(st); st = { ...st }; };
  G.pop = () => { ctx.restore(); st = stack.pop() || st; };
  G.translate = (x, y) => ctx.translate(x, y);
  G.rotate = a => ctx.rotate(a);
  G.scale = (x, y = x) => ctx.scale(x, y);
  G.blendMode = m => { st.blend = m; };
  G.tint = (...a) => { const c = a.length >= 3 ? { r: a[0], g: a[1], b: a[2], a: a[3] ?? 255 } : { ...col(a[0]), a: a[1] ?? 255 }; st.tint = c; };
  G.noTint = () => { st.tint = null; };
  G.color = c => col(c);
  G.red = c => col(c).r; G.green = c => col(c).g; G.blue = c => col(c).b; G.alpha = c => col(c).a;

  let tmp = null;   // scratch canvas for tinted images
  G.image = (img, x, y, w, h) => {
    const src = img.canvas || img.elt || img; w ??= src.width; h ??= src.height;
    ctx.save(); ctx.globalCompositeOperation = st.blend;
    if (st.tint) {
      if (!tmp || tmp.width < src.width || tmp.height < src.height) tmp = newCanvas(src.width, src.height);
      const t = tmp.getContext('2d'); t.setTransform(1, 0, 0, 1, 0, 0); t.globalCompositeOperation = 'copy';
      t.drawImage(src, 0, 0); t.globalCompositeOperation = 'source-in';
      t.fillStyle = rgba(st.tint, 1); t.fillRect(0, 0, src.width, src.height);
      ctx.globalAlpha = st.tint.a / 255; ctx.drawImage(tmp, 0, 0, src.width, src.height, x, y, w, h);
    } else ctx.drawImage(src, x, y, w, h);
    ctx.restore();
  };
  G.createGraphics = (w, h) => {
    const c = newCanvas(w, h), g = c.getContext('2d');
    return { canvas: c, elt: c, drawingContext: g, width: w, height: h, pixelDensity() {},
             clear() { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h); g.restore(); } };
  };

  // Seeded random, like p5's: random() → [0, 1), random(n), random(a, b), random(array).
  let seed = 1 >>> 0;
  const next = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  G.randomSeed = s => { seed = (s >>> 0) || 1; };
  G.random = (a, b) => { const r = next(); if (a === undefined) return r; if (Array.isArray(a)) return a[Math.floor(r * a.length)]; return b === undefined ? r * a : a + r * (b - a); };
  // a private stream for one brush shape, seeded from ONE draw of random()
  const rngFrom = s => () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  G.redraw = async () => {
    if (!ctx) return;
    stack = []; st = { blend: 'source-over', tint: null };
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    base(); if (G.draw) await G.draw();
  };

  // ---------- colour ----------
  const cache = new Map();
  function col(c) {
    if (c && typeof c === 'object') return { r: c.r ?? 0, g: c.g ?? 0, b: c.b ?? 0, a: c.a ?? 255 };
    if (cache.has(c)) return cache.get(c);
    let r = 0, g = 0, b = 0, a = 255, s = String(c).trim();
    if (s[0] === '#') {
      if (s.length === 4) s = '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
      const n = parseInt(s.slice(1, 7), 16); r = n >> 16 & 255; g = n >> 8 & 255; b = n & 255;
      if (s.length === 9) a = parseInt(s.slice(7, 9), 16);
    } else { const m = s.match(/[\d.]+/g); if (m) { [r, g, b] = m.map(Number); if (m[3] != null) a = m[3] <= 1 ? m[3] * 255 : +m[3]; } }
    const o = { r, g, b, a }; cache.set(c, o); return o;
  }
  const rgba = (c, k = 1) => { const o = col(c); return `rgba(${o.r},${o.g},${o.b},${Math.max(0, Math.min(1, k * o.a / 255))})`; };

  // ---------- geometry ----------
  const lp = (a, b, k) => a + (b - a) * k;
  // Catmull-Rom through the points, blended toward the straight polyline by 1 - curv (0 = polygon, 1 = round).
  function smooth(P, curv, closed) {
    const n = P.length; if (n < 3 || curv <= 0) return closed ? P.concat([P[0]]) : P.slice();
    const at = i => closed ? P[(i + n) % n] : P[Math.max(0, Math.min(n - 1, i))], out = [], spans = closed ? n : n - 1;
    for (let i = 0; i < spans; i++) {
      const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2), steps = Math.max(2, Math.min(12, Math.round(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 6)));
      for (let k = 0; k < steps; k++) {
        const u = k / steps, u2 = u * u, u3 = u2 * u, q = [0, 1].map(d => .5 * (2 * p1[d] + (p2[d] - p0[d]) * u + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * u2 + (3 * p1[d] - p0[d] - 3 * p2[d] + p3[d]) * u3));
        out.push([lp(lp(p1[0], p2[0], u), q[0], curv), lp(lp(p1[1], p2[1], u), q[1], curv)]);
      }
    }
    out.push(closed ? out[0] : P[n - 1]);
    return out;
  }
  // evenly spaced points along a polyline
  function resample(P, step) {
    const out = [P[0]]; let carry = 0;
    for (let i = 1; i < P.length; i++) {
      const a = P[i - 1], b = P[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]); if (!d) continue;
      let s = step - carry;
      while (s <= d) { out.push([lp(a[0], b[0], s / d), lp(a[1], b[1], s / d)]); s += step; }
      carry = d - (s - step);
    }
    const L = P[P.length - 1], E = out[out.length - 1]; if (Math.hypot(L[0] - E[0], L[1] - E[1]) > step * .3) out.push(L);
    return out;
  }
  const path = P => { ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1]); ctx.closePath(); };
  const bbox = P => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [x, y] of P) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 }; };
  // smooth 1D noise along a stroke: a few random knots, eased between
  const noise1 = (rnd, knots = 5) => { const v = Array.from({ length: knots + 1 }, () => rnd() * 2 - 1); return s => { const x = s * knots, i = Math.min(knots - 1, Math.floor(x)), f = x - i, e = f * f * (3 - 2 * f); return lp(v[i], v[i + 1], e); }; };

  // ---------- p5.brush ----------
  // Brushes: weight (px at sw 1), scatter, opacity 0..255, pressure [start, end], noise; bristles > 1 = dry, streaky marks.
  const BR = {
    pen:      { weight: 1, scatter: .2, opacity: 250, pressure: [1.2, .8], noise: .1 },
    rotring:  { weight: .9, scatter: .05, opacity: 250, pressure: [1, 1], noise: .02 },
    '2B':     { weight: .8, scatter: .5, opacity: 150, pressure: [1.1, .8], noise: .3, bristles: 2 },
    HB:       { weight: .7, scatter: .4, opacity: 140, pressure: [1, .8], noise: .3, bristles: 2 },
    '2H':     { weight: .6, scatter: .3, opacity: 120, pressure: [1, .8], noise: .3, bristles: 2 },
    cpencil:  { weight: .8, scatter: .5, opacity: 140, pressure: [1, .8], noise: .3, bristles: 2 },
    charcoal: { weight: 1.6, scatter: 1.2, opacity: 120, pressure: [1, .7], noise: .4, bristles: 3 },
    marker:   { weight: 2.5, scatter: .1, opacity: 90, pressure: [1, 1], noise: .1 },
    marker2:  { weight: 2.5, scatter: .1, opacity: 90, pressure: [1, 1], noise: .1 },
    spray:    { weight: 3, scatter: 3, opacity: 60, pressure: [1, 1], noise: .5, bristles: 5 },
  };
  // p5.brush weights read heavier than Canvas px; WK maps them onto the kit's intended line weights.
  const WK = .95;
  const B = { name: 'pen', col: '#000', w: 1, on: false, wash: null, fill: null, bleed: .1, tex: .4, border: .35, hatch: null, hs: null, shape: null };

  // One tapered stroke along P, filled as a single outline (so its width can swell and thin like a real brush).
  function inkStroke(P, closed, def, colr, w, rnd) {
    const base = Math.max(.35, def.weight * w * WK), opa = (def.opacity ?? 230) / 255;
    if (def.bristles > 1 || (def.scatter ?? 0) > 1) return bristles(P, closed, def, colr, base, opa, rnd);
    const Q = resample(P, Math.max(1.5, base * .9)), n = Q.length; if (n < 2) return;
    const nz = noise1(rnd, Math.max(3, Math.round(n / 12))), sc = noise1(rnd, Math.max(3, Math.round(n / 10)));
    const [p0, p1] = def.pressure || [1, 1], L = [], R = [];
    for (let i = 0; i < n; i++) {
      const s = i / (n - 1), a = Q[Math.max(0, i - 1)], b = Q[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
      const taper = closed ? 1 : Math.min(1, .35 + 1.8 * Math.min(s, 1 - s) * Math.max(3, n / 8) / 3);
      const hw = base * lp(p0, p1, s) * (1 + (def.noise ?? .1) * 1.6 * nz(s)) * taper / 2, off = (def.scatter ?? 0) * base * .35 * sc(s);
      const nx = -dy / d, ny = dx / d, cx = Q[i][0] + nx * off, cy = Q[i][1] + ny * off;
      L.push([cx + nx * hw, cy + ny * hw]); R.push([cx - nx * hw, cy - ny * hw]);
    }
    ctx.fillStyle = rgba(colr, opa);
    ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]);
    for (let i = 1; i < n; i++) ctx.lineTo(L[i][0], L[i][1]);
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
    ctx.closePath(); ctx.fill();
    // round the ends of open strokes
    if (!closed) for (const [p, q] of [[Q[0], L[0]], [Q[n - 1], L[n - 1]]]) { const r = Math.hypot(q[0] - p[0], q[1] - p[1]); ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI * 2); ctx.fill(); }
  }
  // Dry brush, pencil and charcoal: several thin broken strands across the stroke's width.
  function bristles(P, closed, def, colr, base, opa, rnd) {
    const k = Math.max(2, Math.round(def.bristles || 3)), spread = base * (1 + (def.scatter ?? 1) * .4), Q = resample(P, Math.max(2, base * .6)), n = Q.length;
    if (n < 2) return;
    ctx.save(); ctx.strokeStyle = rgba(colr, opa * .75); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let j = 0; j < k; j++) {
      const off = (j / (k - 1) - .5) * spread + (rnd() - .5) * base * .3, nz = noise1(rnd, 4);
      ctx.lineWidth = Math.max(.4, base / k * (1.2 + rnd()));
      ctx.beginPath(); let pen = false;
      for (let i = 0; i < n; i++) {
        const s = i / (n - 1), a = Q[Math.max(0, i - 1)], b = Q[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
        const o = off + nz(s) * base * .3, x = Q[i][0] - dy / d * o, y = Q[i][1] + dx / d * o;
        if (rnd() < .12) { pen = false; continue; }   // the paper shows through
        if (pen) ctx.lineTo(x, y); else { ctx.moveTo(x, y); pen = true; }
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  // Flat wash: the shape's colour, evenly.
  function wash(P, colr, op) {
    path(P); ctx.fillStyle = rgba(colr, op / 255); ctx.fill();
  }
  // Watercolour: several translucent, slightly wandering copies of the shape, with darker edges and a few blooms.
  function watercolour(P, colr, op, bleed, tex, border, rnd) {
    const bb = bbox(P), size = Math.min(700, Math.sqrt(bb.w * bb.h) || 1), cx = (bb.x0 + bb.x1) / 2, cy = (bb.y0 + bb.y1) / 2;
    let D = P; for (let r = 0; r < 2 && D.length < 90; r++) D = D.flatMap((p, i) => { const q = D[(i + 1) % D.length]; return [p, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]]; });
    const layers = 4, a = op / 255;
    for (let l = 0; l < layers; l++) {
      const amt = (bleed * .45 + .012) * size, nz = noise1(rnd, Math.max(4, Math.round(D.length / 6)));
      const Q = D.map((p, i) => {
        const dx = p[0] - cx, dy = p[1] - cy, d = Math.hypot(dx, dy) || 1, o = amt * (nz(i / D.length) * .8 + (rnd() - .5) * .35) * (l === 0 ? .4 : 1);
        return [p[0] + dx / d * o, p[1] + dy / d * o];
      });
      path(Q); ctx.fillStyle = rgba(colr, a * .13 * (1 - tex * .25 * rnd())); ctx.fill();
      if (border > 0) { ctx.strokeStyle = rgba(colr, a * border * .2); ctx.lineWidth = Math.max(1, size * .012); ctx.lineJoin = 'round'; ctx.stroke(); }
    }
    if (tex > .05 && size > 12) {   // pigment blooms: soft darker patches inside the shape
      ctx.save(); path(P); ctx.clip();
      const m = Math.round(2 + tex * 5);
      for (let i = 0; i < m; i++) {
        const x = bb.x0 + rnd() * bb.w, y = bb.y0 + rnd() * bb.h, r = size * (.12 + rnd() * .25);
        ctx.beginPath(); ctx.ellipse(x, y, r, r * (.5 + rnd() * .5), rnd() * 3, 0, Math.PI * 2);
        ctx.fillStyle = rgba(colr, a * .1 * tex); ctx.fill();
      }
      ctx.restore();
    }
  }
  function hatching(P, h, hs, rnd) {
    const bb = bbox(P), d = Math.max(2, h.d || 5), ang = h.a || 0, rand = h.o?.rand ?? .15;
    const def = BR[hs?.b] || BR.HB, colr = hs?.c || '#2B2233', w = hs?.w ?? 1;
    const cx = (bb.x0 + bb.x1) / 2, cy = (bb.y0 + bb.y1) / 2, R = Math.hypot(bb.w, bb.h) / 2 + d;
    ctx.save(); path(P); ctx.clip();
    for (let o = -R; o <= R; o += d) {
      const j = (rnd() - .5) * rand * d, c = Math.cos(ang), s = Math.sin(ang), ox = -s * (o + j), oy = c * (o + j);
      inkStroke([[cx + ox - c * R, cy + oy - s * R], [cx + ox + c * R, cy + oy + s * R]], false, def, colr, w, rnd);
    }
    ctx.restore();
  }
  function shape(P, curv, closed) {
    if (!P || P.length < 2) return;
    const rnd = rngFrom(Math.floor(next() * 4294967296));
    ctx.save(); ctx.globalCompositeOperation = 'source-over';
    if (closed && P.length > 2) {
      const F = curv > 0 ? smooth(P, curv, true) : P;
      if (B.wash) wash(F, B.wash[0], B.wash[1]);
      if (B.fill) watercolour(F, B.fill[0], B.fill[1], B.bleed, B.tex, B.border, rnd);
      if (B.hatch) hatching(F, B.hatch, B.hs, rnd);
    }
    if (B.on) inkStroke(smooth(P, curv, closed), closed, BR[B.name] || BR.pen, B.col, B.w, rnd);
    ctx.restore();
  }

  G.brush = {
    load() {}, instance() {}, seed() {}, scaleBrushes() {},
    add(name, def) { BR[name] = { ...def }; },
    box() { return Object.keys(BR); },
    set(name, c, w = 1) { B.name = name; B.col = c; B.w = w; B.on = true; },
    pick(name) { B.name = name; B.on = true; },
    stroke(c) { B.col = c; B.on = true; }, strokeWeight(w) { B.w = w; }, noStroke() { B.on = false; },
    wash(c, op = 255) { B.wash = [c, op]; }, noWash() { B.wash = null; },
    fill(c, op = 170) { B.fill = [c, op]; }, noFill() { B.fill = null; },
    fillBleed(b) { B.bleed = b; }, bleed(b) { B.bleed = b; }, fillTexture(t = .4, b = .35) { B.tex = t; B.border = b; },
    hatch(d = 5, a = 0, o = {}) { B.hatch = { d, a, o }; }, hatchStyle(b = 'HB', c = '#000', w = 1) { B.hs = { b, c, w }; }, noHatch() { B.hatch = null; },
    beginShape(curv = 0) { B.shape = { curv, pts: [] }; },
    vertex(x, y) { B.shape && B.shape.pts.push([x, y]); },
    endShape(close) { if (B.shape) shape(B.shape.pts, B.shape.curv, !!close); B.shape = null; },
    polygon(pts) { shape(pts, 0, true); },
    spline(pts, curv = .5) { if (B.on) shape(pts, curv, false); },
    line(x1, y1, x2, y2) { if (B.on) shape([[x1, y1], [x2, y2]], 0, false); },
    rect(x, y, w, h) { shape([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], 0, true); },
    circle(x, y, r) { const p = []; for (let i = 0; i < 32; i++) p.push([x + Math.cos(i / 32 * 6.2832) * r, y + Math.sin(i / 32 * 6.2832) * r]); shape(p, 0, true); },
    reDraw() {}, reBlend() {},
  };

  // In a browser, start the sketch the way p5 does once every script has run.
  if (!G.__newCanvas && typeof document !== 'undefined') {
    const start = () => { if (typeof G.setup === 'function') G.setup(); };
    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start) : setTimeout(start);
  }
})(globalThis);
