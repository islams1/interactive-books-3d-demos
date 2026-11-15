// AQ-01 "Still in Lane Four" - procedural people (kids, adults, crowd).
// Everything is generated here: no external assets.
//
// Each Person is ONE SkinnedMesh (1 draw call) on a 18-bone skeleton. Poses are procedural
// (FK + two-bone IK), cross-faded by slerping bone quaternions.
//
// Conventions: root origin = pelvis centre (hip-joint height). Local -Z = facing/travel. +X = the person's right.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const V3 = THREE.Vector3, Q = THREE.Quaternion, M4 = THREE.Matrix4, Col = THREE.Color;
const PI = Math.PI, TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sst = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const sst5 = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
const frac = x => x - Math.floor(x);
function mulberry(seed) { let a = (seed | 0) + 0x6D2B79F5; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const _X = new V3(1, 0, 0), _Y = new V3(0, 1, 0), _Z = new V3(0, 0, 1);
const qx = a => new Q().setFromAxisAngle(_X, a);
const qy = a => new Q().setFromAxisAngle(_Y, a);
const qz = a => new Q().setFromAxisAngle(_Z, a);
function Qm(...qs) { const r = new Q(); for (const q of qs) r.multiply(q); return r; }
const qinv = q => q.clone().invert();

// ---------- smooth periodic key splines (Catmull-Rom with non-uniform times) ----------
// keys: [[phase, v0, v1, ...], ...] phases ascending in [0,1). Returns array of components.
function splN(keys, x) {
  x = frac(x);
  const n = keys.length, nc = keys[0].length - 1;
  if (x < keys[0][0]) x += 1;
  let i = n - 1;
  for (let k = 0; k < n - 1; k++) { if (x < keys[k + 1][0]) { i = k; break; } }
  const T = j => keys[((j % n) + n) % n][0] + Math.floor(j / n);
  const K = (j, c) => keys[((j % n) + n) % n][c];
  const t0 = T(i), t1 = T(i + 1), h = t1 - t0, u = (x - t0) / h, u2 = u * u, u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
  const out = new Array(nc);
  for (let c = 1; c <= nc; c++) {
    const m0 = (K(i + 1, c) - K(i - 1, c)) / (T(i + 1) - T(i - 1));
    const m1 = (K(i + 2, c) - K(i, c)) / (T(i + 2) - T(i));
    out[c - 1] = h00 * K(i, c) + h10 * h * m0 + h01 * K(i + 1, c) + h11 * h * m1;
  }
  return out;
}
const spl1 = (keys, x) => splN(keys, x)[0];

// ---------- table interpolation (cubic Hermite, finite-difference tangents) ----------
function tabAt(tab, u, out) {
  const n = tab.length; let i = 0;
  while (i < n - 2 && u > tab[i + 1][0]) i++;
  const a = tab[i], b = tab[i + 1], h = b[0] - a[0];
  const t = clamp((u - a[0]) / h, 0, 1), t2 = t * t, t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
  const nf = a.length;
  for (let f = 1; f < nf; f++) {
    const m0 = i > 0 ? (b[f] - tab[i - 1][f]) / (b[0] - tab[i - 1][0]) : (b[f] - a[f]) / h;
    const m1 = i + 1 < n - 1 ? (tab[i + 2][f] - a[f]) / (tab[i + 2][0] - a[0]) : (b[f] - a[f]) / h;
    out[f] = h00 * a[f] + h10 * h * m0 + h01 * b[f] + h11 * h * m1;
  }
  return out;
}

// ---------- skin weight ramps ----------
function ramp(knots) {
  return c => {
    if (c <= knots[0][0]) return [knots[0][1], knots[0][1], 0];
    for (let i = 0; i < knots.length - 1; i++) {
      if (c <= knots[i + 1][0]) { const t = (c - knots[i][0]) / (knots[i + 1][0] - knots[i][0]); return [knots[i][1], knots[i + 1][1], t * t * (3 - 2 * t)]; }
    }
    const l = knots[knots.length - 1][1]; return [l, l, 0];
  };
}

// ramp over a coordinate that DEcreases along the knot list (e.g. y down a limb)
function rampD(knots) { const f = ramp(knots.map(k => [-k[0], k[1]])); return c => f(-c); }

// ---------- geometry accumulation ----------
function newG() { return { pos: [], col: [], si: [], sw: [], idx: [], rg: [] }; }
const _c = new Col();

// A tube along p0->p1 with elliptical cross-sections (rx along ex, rz along ez) from a station table.
// tab rows: [u, rx, rz, ox, oz] (units of o.k); o.col(u,phi,pos)->hex; o.w(pos,u)->[b0,b1,t]; o.rad(u,phi)->radius multiplier
function addTube(G, o) {
  const p0 = o.p0, p1 = o.p1, k = o.k || 1;
  const a = new V3().subVectors(p1, p0), len = a.length(); a.normalize();
  const ex = o.ex || _X, ez = o.ez || _Z;
  const flip = new V3().crossVectors(a, ez).dot(ex) < 0;
  const seg = o.seg || 10, n = o.n || 12;
  const us = [];
  for (let i = 0; i <= n; i++) us.push(i / n);
  for (const b of (o.breaks || [])) { us.push(Math.max(0, b - 1e-4), Math.min(1, b + 1e-4)); }
  us.sort((p, q) => p - q);
  const base = G.pos.length / 3, row = [0, 0, 0, 0, 0], p = new V3();
  for (const u of us) {
    tabAt(o.tab, u, row);
    const rx = Math.max(0.0004, row[1] * k), rz = Math.max(0.0004, row[2] * k), ox = row[3] * k, oz = row[4] * k;
    for (let s = 0; s < seg; s++) {
      const phi = s / seg * TAU, c = Math.cos(phi), sn = Math.sin(phi), m = o.rad ? o.rad(u, phi) : 1;
      p.copy(p0).addScaledVector(a, u * len).addScaledVector(ex, ox + rx * m * c).addScaledVector(ez, oz + rz * m * sn);
      G.pos.push(p.x, p.y, p.z);
      const hex = o.col ? o.col(u, phi, p) : 0xffffff;
      _c.setHex(hex); G.col.push(_c.r, _c.g, _c.b);
      const w = o.w ? o.w(p, u) : [0, 0, 0];
      G.si.push(w[0], w[1], 0, 0); G.sw.push(1 - w[2], w[2], 0, 0);
      G.rg.push(o.region ? o.region(u, phi, p) : 0);
    }
  }
  for (let r = 0; r < us.length - 1; r++) for (let s = 0; s < seg; s++) {
    const s2 = (s + 1) % seg;
    const a0 = base + r * seg + s, a1 = base + r * seg + s2, b0 = base + (r + 1) * seg + s, b1 = base + (r + 1) * seg + s2;
    if (!flip) G.idx.push(a0, b0, a1, b0, b1, a1); else G.idx.push(a0, a1, b0, b0, a1, b1);
  }
}
function finishGeometry(G, skinned) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(G.pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(G.col, 3));
  if (skinned) {
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(G.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(G.sw, 4));
  } else g.setAttribute('aRegion', new THREE.Float32BufferAttribute(G.rg, 1));
  g.setIndex(G.idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

// ---------- skeleton ----------
const BN = ['pelvis', 'spine', 'chest', 'neck', 'head', 'gog', 'uaR', 'faR', 'haR', 'uaL', 'faL', 'haL', 'thR', 'shR', 'ftR', 'thL', 'shL', 'ftL'];
const B = {}; BN.forEach((n, i) => B[n] = i);
const PARENT = [-1, 0, 1, 2, 3, 4, 2, 6, 7, 2, 9, 10, 0, 12, 13, 0, 15, 16];

function makeDims(sp) {
  const H = sp.H, adult = sp.adult, s = H / 1.55;
  const headH = (adult ? 0.130 : 0.145) * H;
  const D = { H, s, adult, headH };
  D.thigh = 0.245 * H; D.shin = (adult ? 0.225 : 0.215) * H; D.ankleH = 0.045 * H;
  D.hip = D.thigh + D.shin + D.ankleH;               // hipHeight
  D.top = H - D.hip;                                  // top of head above pelvis
  D.headY = D.top - 0.76 * headH;                     // head bone (abs, above pelvis)
  D.neckBase = D.headY - 0.07 * H;
  D.spineY = 0.06 * H; D.chestY = 0.11 * H;           // rel offsets (spine from pelvis, chest from spine)
  D.neckY = D.neckBase - (D.spineY + D.chestY);       // neck bone rel chest
  D.headRel = 0.07 * H;
  D.shX = 0.112 * H * (adult ? (sp.sex === 'f' ? 0.93 : 1.02) : (sp.sex === 'f' ? 0.95 : 1));
  D.shY = D.neckBase - 0.015 * H - (D.spineY + D.chestY);  // shoulder rel chest
  D.ua = 0.186 * H; D.fa = 0.146 * H; D.hand = 0.108 * H;
  D.hipX = 0.062 * H * (sp.sex === 'f' ? 1.06 : 1);
  D.sit = 0.062 * H;                                  // pelvis centre above seat surface
  return D;
}

// ---------- the person's mesh (single skinned geometry) ----------
function buildBody(sp, D, bones) {
  const G = newG(), H = D.H, k = H;
  const female = sp.sex === 'f', kid = !sp.adult, bld = sp.build ?? 0.5;
  const wk = 0.92 + 0.16 * bld, limbK = 0.88 + 0.26 * bld;
  const skin = sp.skin, role = sp.role || 'spectator';
  const C = sp.cols;                                  // clothing colours
  const sideSin = phi => Math.sin(phi);               // sin<0 => toward -Z (front)
  const W = {};
  // ---- colours ----
  const torsoCol = (y, phi) => {
    const front = sideSin(phi) < 0;
    if (kid) {
      if (female) return y < (front ? 0.262 * H : 0.232 * H) ? C.suit : skin;
      return y < 0.052 * H ? C.suit : skin;
    }
    if (y > D.neckBase - 0.012 * H) return skin;
    if (C.reflect && ((y > 0.062 * H && y < 0.082 * H) || (y > 0.17 * H && y < 0.19 * H))) return C.reflect;
    if (C.reflect && Math.abs(Math.cos(phi)) < 0.16 && y > 0.04 * H) return C.reflect;
    return y < -0.035 * H ? C.bottom : C.top;
  };
  const legCol = (u, phi) => {
    if (kid) { if (female) return u < 0.05 ? C.suit : skin; return u < 0.585 ? C.suit : skin; }
    if (C.shorts) return u < 0.5 ? C.bottom : skin;
    if (C.reflect && u > 0.66 && u < 0.7) return C.reflect;
    return u < 0.975 ? C.bottom : skin;
  };
  const armCol = u => {
    if (kid) return skin;
    if (C.reflect && u > 0.27 && u < 0.32) return C.reflect;
    if (C.longSleeve) return u < 0.95 ? C.top : skin;
    return u < 0.37 ? C.top : skin;
  };
  const footCol = (u, phi) => {
    if (kid) return skin;
    if (C.flipflop) return Math.sin(phi) < -0.55 ? 0x2a2a2a : skin;
    return Math.sin(phi) < -0.7 ? 0x2b2b2b : C.shoe;
  };
  const hairLine = (u, phi) => lerp(0.34, 0.60, Math.max(0, -Math.sin(phi)));
  const headCol = (u, phi) => {
    const inCap = u > hairLine(u, phi);
    if (kid) {
      if (inCap) return C.cap;
      const front = -Math.sin(phi);
      if (u > 0.47 && u < 0.56 && front < 0.5 && sp.gogStrap !== false) return 0x14181d;  // goggle strap
      return skin;
    }
    return inCap ? C.hair : skin;
  };
  // ---- skinning ramps ----
  const torsoW = ramp([[-0.1 * H, B.pelvis], [0.035 * H, B.pelvis], [0.09 * H, B.spine], [0.135 * H, B.spine], [0.2 * H, B.chest], [D.neckBase - 0.02 * H, B.chest], [D.neckBase + 0.02 * H, B.neck]]);
  const sY = D.spineY + D.chestY;
  // ---- torso ----
  {
    const nbH = D.neckBase / H;
    const rows = [[-0.08, .016, .016, 0], [-0.066, .056, .045, .006], [-0.04, .082, .058, .006], [0, .092, .064, .008], [0.04, .086, .060, .004], [0.085, .077, .052, 0],
      [0.14, .083, .055, -.002], [0.20, .093, .060, -.004], [nbH - 0.075, .100, .062, -.004], [nbH - 0.040, .111, .056, 0], [nbH - 0.019, .098, .047, .004], [nbH - 0.004, .056, .037, .005], [nbH + 0.012, .026, .026, .005]];
    const y0 = -0.08, y1 = D.neckBase / H + 0.012, span = y1 - y0;
    const tab = rows.map(([y, rx, rz, oz]) => {
      let fx = wk, fz = wk;
      if (female) { if (y < 0.06) fx *= 1.06; else if (y < 0.13) fx *= 0.95; if (y > 0.17 && y < 0.27) { fz *= kid ? 1.04 : 1.1; } }
      else if (!kid) { if (y > 0.2) fx *= 1.05; }
      if (!kid) { fx *= 0.98; fz *= 1.0; }
      return [(y - y0) / span, rx * fx, rz * fz, 0, oz - (female && !kid && y > 0.17 && y < 0.27 ? 0.006 : 0)];
    });
    const brk = kid ? (female ? [(0.262 - y0) / span, (0.232 - y0) / span] : [(0.052 - y0) / span]) : [(-0.035 - y0) / span, (D.neckBase / H - 0.012 - y0) / span, ...(C.reflect ? [(0.062 - y0) / span, (0.082 - y0) / span, (0.17 - y0) / span, (0.19 - y0) / span] : [])];
    addTube(G, { p0: new V3(0, y0 * H, 0), p1: new V3(0, y1 * H, 0), k, tab, n: 26, seg: 14, breaks: brk, col: (u, phi, p) => torsoCol(p.y, phi), w: p => torsoW(p.y) });
  }
  // ---- neck ----
  addTube(G, {
    p0: new V3(0, D.neckBase - 0.012 * H, 0.004 * H), p1: new V3(0, D.headY + 0.04 * H, 0.004 * H), k,
    tab: [[0, 0.036, 0.034, 0, 0], [0.3, 0.028, 0.029, 0, 0], [1, 0.026, 0.028, 0, -0.002]], n: 5, seg: 10,
    col: () => skin, w: p => ramp([[D.neckBase - 0.012 * H, B.chest], [D.neckBase + 0.025 * H, B.neck], [D.headY + 0.0 * H, B.neck], [D.headY + 0.04 * H, B.head]])(p.y)
  });
  // ---- head ----
  {
    const chinY = D.top - D.headH, hh = D.headH;
    const sc = hh / (0.145 * H);                       // table is for a kid head; scale by height ratio
    const tab = [[0, .008, .012, 0, -.002], [0.05, .030, .038, 0, -.012], [0.15, .040, .048, 0, -.008], [0.35, .048, .057, 0, -.003], [0.55, .0505, .060, 0, 0], [0.75, .047, .0575, 0, .002], [0.9, .036, .044, 0, .003], [0.97, .020, .026, 0, .003], [1, .005, .006, 0, .003]];
    const capK = kid ? 1.014 : 1.0, hairK = 1.05;
    addTube(G, {
      p0: new V3(0, chinY, 0.0), p1: new V3(0, D.top, 0.0), k: k * sc, tab, n: 22, seg: 16,
      rad: (u, phi) => (u > hairLine(u, phi)) ? (kid ? capK : (u < 0.97 ? hairK : 1.0)) : 1,
      col: (u, phi) => headCol(u, phi), w: () => [B.head, B.head, 0]
    });
    // ears (adults only; kids wear caps) and nose
    const eyeY = chinY + 0.52 * hh;
    if (!kid) for (const sx of [-1, 1]) addTube(G, { p0: new V3(sx * 0.049 * H, chinY + 0.45 * hh, 0.006 * H), p1: new V3(sx * 0.0585 * H, chinY + 0.45 * hh, 0.006 * H), ex: _Y, ez: _Z, k, tab: [[0, .014, .010, 0, 0], [0.5, .016, .011, 0, 0], [1, .004, .003, 0, 0]], n: 2, seg: 8, col: () => skin, w: () => [B.head, B.head, 0] });
    addTube(G, { p0: new V3(0, chinY + 0.47 * hh, -0.052 * H), p1: new V3(0, chinY + 0.44 * hh, -0.074 * H), ex: _X, ez: _Y, k, tab: [[0, .009, .009, 0, 0], [0.5, .007, .008, 0, 0], [1, .003, .003, 0, 0]], n: 3, seg: 8, col: () => skin, w: () => [B.head, B.head, 0] });
    // goggles (kids): separate bone so they can be pushed up on the cap
    if (kid && sp.goggles !== false) {
      const gy = eyeY;
      for (const sx of [-1, 1]) addTube(G, {
        p0: new V3(sx * 0.027 * H, gy, -0.050 * H), p1: new V3(sx * 0.027 * H, gy, -0.078 * H), ex: _X, ez: _Y, k, seg: 12, n: 6, breaks: [0.78],
        tab: [[0, .012, .012, 0, 0], [0.12, .0215, .0185, 0, 0], [0.7, .0215, .0185, 0, 0], [0.86, .019, .0165, 0, 0], [0.97, .0145, .012, 0, 0], [1, .004, .004, 0, 0]],
        col: u => u < 0.78 ? C.gogFrame : 0x0e1218, w: () => [B.gog, B.gog, 0]
      });
      addTube(G, { p0: new V3(-0.006 * H, gy + 0.002 * H, -0.061 * H), p1: new V3(0.006 * H, gy + 0.002 * H, -0.061 * H), ex: _Z, ez: _Y, k, seg: 6, n: 1, tab: [[0, .006, .005, 0, 0], [1, .006, .005, 0, 0]], col: () => C.gogFrame, w: () => [B.gog, B.gog, 0] });
    }
    // ponytail (adult women, some kids' hair is under the cap)
    if (!kid && female && sp.ponytail !== false) {
      addTube(G, {
        p0: new V3(0, D.top - 0.40 * hh, 0.046 * H), p1: new V3(0, D.neckBase - 0.075 * H, 0.080 * H), k,
        tab: [[0, .018, .018, 0, 0], [0.2, .026, .026, 0, 0], [0.7, .025, .025, 0, 0], [1, .010, .010, 0, 0]], n: 8, seg: 8, col: () => C.hair,
        w: p => ramp([[D.neckBase - 0.075 * H, B.chest], [D.neckBase + 0.02 * H, B.neck], [D.headY + 0.02 * H, B.head]])(p.y)
      });
    }
  }
  // ---- arms ----
  for (const sd of [1, -1]) {
    const ua = sd === 1 ? B.uaR : B.uaL, fa = sd === 1 ? B.faR : B.faL, ha = sd === 1 ? B.haR : B.haL;
    const shy = sY + D.shY, ex = sd * D.shX, yE = shy - D.ua, yW = yE - D.fa;
    const p0 = new V3(ex, shy + 0.008 * H, 0), p1 = new V3(ex, yW - 0.004 * H, 0);
    const L = (p0.y - p1.y);
    const tab = [[0, .018, .018], [0.04, .040, .040], [0.12, .043, .044], [0.25, .038, .040], [0.40, .033, .035], [0.50, .0305, .033], [0.57, .030, .033], [0.66, .0315, .034], [0.80, .026, .028], [0.92, .0205, .0215], [1, .0165, .0165]]
      .map(r => [r[0], r[1] * limbK, r[2] * limbK, 0, 0]);
    const aw = rampD([[shy - 0.0 * H, ua], [yE + 0.05 * H, ua], [yE - 0.05 * H, fa], [yW - 0.01 * H, fa]]);
    addTube(G, { p0, p1, ex: _X, ez: _Z, k, tab, n: 26, seg: 10, breaks: kid ? [] : (C.reflect ? [0.27, 0.32, 0.37] : [0.37]), col: (u) => armCol(u), w: p => aw(p.y) });
    // hand
    const hw = rampD([[yW + 0.03 * H, fa], [yW - 0.012 * H, ha]]);
    addTube(G, {
      p0: new V3(ex, yW + 0.014 * H, 0), p1: new V3(ex, yW - D.hand, 0), ex: _X, ez: _Z, k, n: 8, seg: 8,
      tab: [[0, .0055, .0075], [0.08, .0095, .0135], [0.25, .0100, .0175], [0.45, .0090, .0230], [0.62, .0080, .0225], [0.85, .0062, .0180], [0.97, .0042, .0100], [1, .002, .004]],
      col: () => sp.skin, w: p => hw(p.y)
    });
    // thumb: on the front (-Z) edge
    addTube(G, {
      p0: new V3(ex - sd * 0.006 * H, yW - 0.030 * H, -0.0185 * H), p1: new V3(ex - sd * 0.004 * H, yW - 0.080 * H, -0.0245 * H), ex: _X, ez: _Z, k, n: 3, seg: 6,
      tab: [[0, .0085, .0085], [0.4, .0095, .0095], [1, .005, .005]], col: () => sp.skin, w: () => [ha, ha, 0]
    });
  }
  // ---- legs ----
  for (const sd of [1, -1]) {
    const th = sd === 1 ? B.thR : B.thL, sh = sd === 1 ? B.shR : B.shL, ft = sd === 1 ? B.ftR : B.ftL;
    const hx = sd * D.hipX, yK = -D.thigh, yA = -D.thigh - D.shin;
    const p0 = new V3(hx, 0.004 * H, 0), p1 = new V3(hx, yA - 0.004 * H, 0);
    const tab = [[0, .020, .020], [0.03, .048, .050], [0.12, .055, .057], [0.30, .050, .052], [0.46, .040, .042], [0.53, .036, .040], [0.60, .036, .040, 0, 0], [0.68, .036, .044, 0, .006], [0.80, .028, .032, 0, .003], [0.93, .022, .024], [1, .0205, .0225]]
      .map(r => [r[0], r[1] * limbK * (female ? 1.04 : 1) , r[2] * limbK * (female ? 1.04 : 1), r[3] || 0, r[4] || 0]);
    const lw = rampD([[0.012 * H, B.pelvis], [-0.045 * H, th], [yK + 0.05 * H, th], [yK - 0.05 * H, sh], [yA + 0.03 * H, sh], [yA - 0.004 * H, ft]]);
    addTube(G, { p0, p1, k, tab, n: 36, seg: 10, breaks: kid ? (female ? [0.05] : [0.585]) : (C.shorts ? [0.5] : [0.975]), col: (u, phi) => legCol(u, phi), w: p => lw(p.y) });
    // foot (tube along Z: ex = X (width), ez = Y (height)); axis at sole level
    const soleY = yA - 0.045 * H;
    addTube(G, {
      p0: new V3(hx, soleY, 0.040 * H), p1: new V3(hx, soleY, -0.118 * H), ex: _X, ez: _Y, k, n: 10, seg: 10,
      tab: [[0, .008, .008, 0, .008], [0.06, .020, .026, 0, .026], [0.18, .022, .031, 0, .031], [0.40, .024, .0225, 0, .0225], [0.62, .0275, .016, 0, .016], [0.84, .026, .012, 0, .012], [0.96, .017, .007, 0, .007], [1, .006, .004, 0, .004]],
      col: (u, phi) => footCol(u, phi), w: () => [ft, ft, 0]
    });
  }
  return finishGeometry(G, true);
}

// =====================================================================================
// Rig: pose buffer + FK/IK helpers
// =====================================================================================
function solve2(org, tgt, L1, L2, pole, sign) {
  const d = tgt.clone().sub(org); let dist = d.length();
  const maxR = (L1 + L2) * 0.9995, minR = Math.abs(L1 - L2) * 1.02 + 1e-3;
  dist = clamp(dist, minR, maxR);
  const dir = d.lengthSq() > 1e-10 ? d.normalize() : new V3(0, -1, 0);
  const pn = pole.clone(); pn.addScaledVector(dir, -pn.dot(dir));
  if (pn.lengthSq() < 1e-8) { pn.crossVectors(dir, _X); if (pn.lengthSq() < 1e-8) pn.crossVectors(dir, _Z); }
  pn.normalize();
  const cosA = clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
  const d1 = dir.clone().multiplyScalar(cosA).addScaledVector(pn, sinA);
  const joint = org.clone().addScaledVector(d1, L1);
  const end = org.clone().addScaledVector(dir, dist);
  const d2 = end.clone().sub(joint).normalize();
  const ey = d1.clone().negate();
  const ezv = pn.clone().multiplyScalar(sign); ezv.addScaledVector(ey, -ezv.dot(ey)).normalize();
  const ex = new V3().crossVectors(ey, ezv);
  const q1 = new Q().setFromRotationMatrix(new M4().makeBasis(ex, ey, ezv));
  const rotX = Math.atan2(-d2.dot(ezv), -d2.dot(ey));
  const q2rel = qx(rotX);
  return { q1, q2rel, q2w: q1.clone().multiply(q2rel), joint, end };
}

class Rig {
  constructor(D) {
    this.D = D; this.q = BN.map(() => new Q()); this.pp = new V3(); this.gogUp = 0;
    this.pq = new Q(); this.cq = new Q(); this.cp = new V3();
  }
  reset() { for (const q of this.q) q.identity(); this.pp.set(0, 0, 0); this.gogUp = 0; this.pq.identity(); this.cq.identity(); }
  // body: yaw about world Y, lean = sideways tilt (+ = right side down), pitch (+ = lean back / head toward +Z), roll about the body's long axis
  body(o) {
    this.pp.set(o.x || 0, o.y || 0, o.z || 0);
    this.q[0].copy(Qm(qy(o.yaw || 0), qz(-(o.lean || 0)), qx(o.pitch || 0), qy(o.roll || 0)));
  }
  tq(flex, twist, side) { return Qm(qx(-(flex || 0)), qz(-(side || 0)), qy(twist || 0)); }
  sp(f, t, s) { this.q[B.spine].copy(this.tq(f, t, s)); }
  ch(f, t, s) { this.q[B.chest].copy(this.tq(f, t, s)); }
  neck(f, t, s) { this.q[B.neck].copy(this.tq(f, t, s)); }
  hd(f, t, s) { this.q[B.head].copy(this.tq(f, t, s)); }
  fk() {
    const D = this.D;
    this.pq.copy(this.q[0]);
    const sq = this.pq.clone().multiply(this.q[B.spine]);
    const sp = new V3(0, D.spineY, 0).applyQuaternion(this.pq).add(this.pp);
    this.cq.copy(sq).multiply(this.q[B.chest]);
    this.cp.copy(sp).add(new V3(0, D.chestY, 0).applyQuaternion(sq));
  }
  shoulder(sd) { return new V3(sd * this.D.shX, this.D.shY, 0).applyQuaternion(this.cq).add(this.cp); }
  hip(sd) { return new V3(sd * this.D.hipX, 0, 0).applyQuaternion(this.pq).add(this.pp); }
  chestPt(v) { return v.clone().applyQuaternion(this.cq).add(this.cp); }      // chest-local point -> root space
  chestDir(v) { return v.clone().applyQuaternion(this.cq); }
  pelvisPt(v) { return v.clone().applyQuaternion(this.pq).add(this.pp); }
  pelvisDir(v) { return v.clone().applyQuaternion(this.pq); }
  armFK(sd, o) {
    const [ua, fa, ha] = sd === 1 ? [B.uaR, B.faR, B.haR] : [B.uaL, B.faL, B.haL];
    this.q[ua].copy(Qm(qx(o.flex || 0), qz(sd * (o.abd || 0)), qy(-sd * (o.sup || 0))));
    this.q[fa].copy(Qm(qx(o.elbow || 0), qy(-sd * (o.fsup || 0))));
    this.q[ha].copy(Qm(qx(o.wr || 0), qz(sd * (o.dev || 0))));
  }
  armIK(sd, tgt, pole, handQ, wr, dev) {
    const [ua, fa, ha] = sd === 1 ? [B.uaR, B.faR, B.haR] : [B.uaL, B.faL, B.haL];
    const r = solve2(this.shoulder(sd), tgt, this.D.ua, this.D.fa, pole, 1);
    this.q[ua].copy(qinv(this.cq).multiply(r.q1));
    this.q[fa].copy(r.q2rel);
    this.q[ha].copy(handQ ? qinv(r.q2w).multiply(handQ) : Qm(qx(wr || 0), qz(sd * (dev || 0))));
    return r;
  }
  legFK(sd, o) {
    const [th, sh, ft] = sd === 1 ? [B.thR, B.shR, B.ftR] : [B.thL, B.shL, B.ftL];
    this.q[th].copy(Qm(qx(o.flex || 0), qz(sd * (o.abd || 0)), qy(-sd * (o.out || 0))));
    this.q[sh].copy(qx(-(o.knee || 0)));
    this.q[ft].copy(Qm(qx(-(o.plantar || 0)), qz(sd * (o.inv || 0))));
  }
  legIK(sd, tgt, pole, footQ, plantar) {
    const [th, sh, ft] = sd === 1 ? [B.thR, B.shR, B.ftR] : [B.thL, B.shL, B.ftL];
    const r = solve2(this.hip(sd), tgt, this.D.thigh, this.D.shin, pole, -1);
    this.q[th].copy(qinv(this.pq).multiply(r.q1));
    this.q[sh].copy(r.q2rel);
    this.q[ft].copy(footQ ? qinv(r.q2w).multiply(footQ) : qx(-(plantar || 0)));
    return r;
  }
}

// =====================================================================================
// Poses. Each state fn(R, t, params, me) fills the rig for time t (seconds in state).
// Units: metres designed for a 1.55 m child; lengths are multiplied by D.s (= height/1.55).
// =====================================================================================
const ST = {};
const v3 = (x, y, z) => new V3(x, y, z);

function relaxedArms(R, t, o = {}) {
  const ph = o.ph || 0;
  R.armFK(1, { flex: 0.07 + 0.02 * Math.sin(t * 0.5 + ph), abd: 0.10, elbow: 0.20, sup: 0.15, wr: 0.05 });
  R.armFK(-1, { flex: 0.05 + 0.02 * Math.sin(t * 0.47 + 1 + ph), abd: 0.10, elbow: 0.22, sup: 0.15, wr: 0.05 });
}
function plantedLegs(R, o = {}) {
  const D = R.D, s = D.s, gy = -D.hip + D.ankleH, fx = D.hipX * (o.wide || 1.45);
  for (const sd of [1, -1]) {
    const f = (sd === 1 ? o.R : o.L) || {};
    R.legIK(sd, v3(sd * fx + (f.x || 0), gy + (f.dy || 0), (f.z ?? -0.01 * s)), v3(sd * 0.10, 0, -1), Qm(qy(-sd * (f.out ?? 0.15)), qx(f.pitch || 0)));
  }
}

ST.stand = (R, t, p) => {
  const D = R.D, s = D.s;
  const w = 0.6 * Math.sin(t * 0.83) + 0.4 * Math.sin(t * 0.31 + 1), br = Math.sin(t * TAU * 0.26);
  R.body({ y: -0.016 * s + 0.0025 * s * br, x: 0.014 * s * w, lean: -0.022 * w, yaw: 0.03 * Math.sin(t * 0.21) });
  R.sp(0.012 + 0.008 * br, 0.03 * Math.sin(t * 0.35), 0.018 * w);
  R.ch(0.01 * br, 0, 0); R.neck(0.03, 0, 0);
  R.hd(-0.03, 0.24 * Math.sin(t * 0.27) + 0.1 * Math.sin(t * 0.61), 0.02 * Math.sin(t * 0.4));
  R.fk();
  relaxedArms(R, t);
  plantedLegs(R);
  R.gogUp = 1;
};

ST.walk = (R, t, p, me) => {
  const D = R.D, s = D.s, speed = p.speed || 1.1;
  const a = Math.min(0.34 * s, 0.30 * s * Math.sqrt(speed / 1.07)), T = 2 * a / (0.6 * speed);
  me.walkCycle = T;
  const ph = frac(t / T + (p.phase || 0));
  const bob = 0.016 * s * Math.cos(4 * PI * (ph - 0.3));
  const sway = 0.022 * s * Math.sin(TAU * (ph - 0.05));
  const yaw = 0.09 * Math.cos(TAU * ph), lean = -0.04 * Math.sin(TAU * (ph - 0.05));
  R.body({ y: -0.030 * s + bob, x: sway, yaw, lean, pitch: -0.03 });
  R.sp(0.03, -1.3 * yaw, -lean * 0.9); R.ch(0.01, 0, 0); R.neck(0.03, 0, 0); R.hd(-0.04, 0.3 * yaw, 0);
  R.fk();
  const gy = -D.hip + D.ankleH;
  for (const sd of [1, -1]) {
    const f = frac(ph + (sd === 1 ? 0 : 0.5)); let z, dy, pitch;
    if (f < 0.6) {
      const u = f / 0.6; z = -a + 2 * a * u;
      dy = 0.018 * s * (1 - sst(0, 0.15, u)) + 0.085 * s * sst(0.72, 1.0, u);
      pitch = 0.22 * (1 - sst(0, 0.2, u)) - 0.62 * sst(0.55, 1, u);
    } else {
      const u = (f - 0.6) / 0.4, e = u * u * (3 - 2 * u);
      z = a - 2 * a * e;
      dy = lerp(0.085, 0.018, e) * s + 0.06 * s * Math.sin(PI * u);
      pitch = lerp(-0.62, 0.22, sst(0.1, 0.85, u));
    }
    R.legIK(sd, v3(sd * 0.082 * s, gy + dy, z - 0.01 * s), v3(sd * 0.06, 0, -1), Qm(qy(-sd * 0.12), qx(pitch)));
    const fl = 0.40 * (speed / 1.1) * (sd === 1 ? -Math.cos(TAU * ph) : Math.cos(TAU * ph));
    R.armFK(sd, { flex: fl, abd: 0.08, elbow: 0.25 + 0.35 * Math.max(0, fl), sup: 0.1, wr: 0.05 });
  }
  R.gogUp = 1;
};

// ---------- motion tables (root offsets along the true centre-of-mass paths) ----------
const DIVE_T = 2.0, CLIMB_T = 2.2, LAUNCH_OFF = 0.40, LAUNCH_T = 2.0;
function sampleTab(T, t) {
  if (!T) return { forward: 0, up: 0 };
  const x = clamp(t, 0, T.n * T.dt) / T.dt, i = Math.min(T.n - 1, Math.floor(x)), f = x - i;
  return { forward: lerp(T.f[i], T.f[i + 1], f), up: lerp(T.u[i], T.u[i + 1], f) };
}
function hermiteKnots(kn, t) {   // kn: [t, a, b, va, vb]
  let i = 0; while (i < kn.length - 2 && t > kn[i + 1][0]) i++;
  const a = kn[i], b = kn[i + 1], h = b[0] - a[0], u = clamp((t - a[0]) / h, 0, 1), u2 = u * u, u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
  return [h00 * a[1] + h10 * h * a[3] + h01 * b[1] + h11 * h * b[3], h00 * a[2] + h10 * h * a[4] + h01 * b[2] + h11 * h * b[4]];
}
function buildDiveTable(D, blockH) {
  const s = D.s, dt = 1 / 120, n = Math.round(2.4 / dt), f = new Float32Array(n + 1), u = new Float32Array(n + 1);
  const y0 = blockH + D.hip - 0.24 * s;      // world height of the pelvis in the blockReady crouch
  const kn = [[0, 0, 0, 0, 0], [0.2, 0.06 * s, 0.02 * s, 0.8 * s, 0.4 * s], [0.3, 0.22 * s, 0.12 * s, 2.0 * s, 1.1 * s], [0.4, 0.50 * s, 0.27 * s, 3.0 * s, 1.4 * s]];
  let te = 0, fe = 0, ue = 0, wet = false;
  for (let i = 0; i <= n; i++) {
    const t = i * dt; let ff, uu;
    if (t <= 0.4) [ff, uu] = hermiteKnots(kn, t);
    else if (!wet) {
      const tau = t - 0.4; ff = 0.50 * s + 3.0 * s * tau; uu = 0.27 * s + 1.4 * s * tau - 4.905 * tau * tau;
      if (y0 + uu <= 0) { wet = true; te = t; fe = ff; ue = uu; }
    }
    if (wet) {
      const q = (t - te) / Math.max(0.3, 2.0 - te), d = 0.85 * s;
      const yw = -d * Math.sin(PI * Math.pow(clamp(q, 0, 1), 0.7));
      ff = fe + 2.6 * (t - te) - 1.1 * (t - te) * (t - te) / (2 * Math.max(0.3, 2.0 - te));
      uu = yw - y0;
      if (q > 1) uu = -y0;
    }
    f[i] = ff; u[i] = uu;
  }
  return { dt, n, f, u, te, y0 };
}
function buildLaunchTable(D) {
  const s = D.s, dt = 1 / 120, n = Math.round(2.4 / dt), f = new Float32Array(n + 1), u = new Float32Array(n + 1);
  const yh = -0.42 * s;    // hang pelvis height (bone offset)
  const kn = [[0, 0, 0, 0, 0], [0.12, 0, -0.04 * s, 0, -0.3 * s], [0.22, 0.12 * s, 0.05 * s, 1.0 * s, 1.3 * s], [0.31, 0.38 * s, 0.26 * s, 3.0 * s, 2.3 * s], [0.40, 0.66 * s, 0.46 * s, 3.2 * s, 1.5 * s]];
  let te = 0, fe = 0, wet = false;
  for (let i = 0; i <= n; i++) {
    const t = i * dt; let ff, uu;
    if (t <= 0.4) [ff, uu] = hermiteKnots(kn, t);
    else if (!wet) {
      const tau = t - 0.4; ff = 0.66 * s + 3.0 * s * tau; uu = 0.46 * s + 1.5 * s * tau - 4.905 * tau * tau;
      if (yh + uu <= 0 && tau > 0.1) { wet = true; te = t; fe = ff; }
    }
    if (wet) {
      const q = (t - te) / Math.max(0.4, 2.0 - te), d = 0.42 * s;
      ff = fe + 2.5 * (t - te) - 0.9 * (t - te) * (t - te) / (2 * Math.max(0.4, 2.0 - te));
      uu = -d * Math.sin(PI * Math.pow(clamp(q, 0, 1), 0.7)) - yh;
      if (q > 1) uu = -yh - 0.0;
    }
    f[i] = ff; u[i] = uu;
  }
  return { dt, n, f, u, te };
}
const climbKeys = D => {
  const s = D.s;
  return [[0, -0.565 * s, 0], [0.38, -0.66 * s, 0.0], [0.7, -0.40 * s, 0.10 * s], [1.1, 0.19, 0.44 * s], [1.5, 0.12 + 0.36 * s, 0.62 * s], [1.9, 0.12 + 0.66 * s, 0.76 * s], [2.2, 0.12 + D.hip, 0.80 * s]];
};
function climbBoneY(D, t) { return -(0.10 + 0.30 * D.H) * (1 - sst(0.35, 1.2, t)); }
function buildClimbTable(D) {
  const dt = 1 / 120, n = Math.round(2.4 / dt), f = new Float32Array(n + 1), u = new Float32Array(n + 1), tab = climbKeys(D), r = [0, 0, 0];
  for (let i = 0; i <= n; i++) { const t = Math.min(i * dt, CLIMB_T); tabAt(tab, t, r); u[i] = r[1] - climbBoneY(D, t); f[i] = r[2]; }
  return { dt, n, f, u };
}
// ---------- breaststroke speed profile ----------
const BR_SPEED_KEYS = [[0, 0.95], [0.1, 0.8], [0.25, 0.55], [0.35, 0.75], [0.45, 1.05], [0.55, 0.5], [0.62, 0.42], [0.72, 1.5], [0.78, 1.45], [0.88, 1.2]];
const BR_SPEED_NORM = (() => { let s = 0; for (let i = 0; i < 200; i++) s += spl1(BR_SPEED_KEYS, i / 200); return 200 / s; })();
function state_speedFactor(me) {
  if (me.state !== 'breaststroke') return 1;
  return clamp(spl1(BR_SPEED_KEYS, me.speedPhase) * BR_SPEED_NORM, 0, 1.6);
}

// ---------- shared pose helpers ----------
function standCore(R, t, o = {}) {
  const D = R.D, s = D.s;
  const w = 0.6 * Math.sin(t * 0.83) + 0.4 * Math.sin(t * 0.31 + 1), br = Math.sin(t * TAU * 0.26);
  R.body({ y: -0.016 * s + 0.0025 * s * br, x: 0.014 * s * w, lean: -0.022 * w, yaw: 0.03 * Math.sin(t * 0.21) + (o.yaw || 0) });
  R.sp(0.012 + 0.008 * br, 0.03 * Math.sin(t * 0.35) + (o.twist || 0), 0.018 * w);
  R.ch(0.01 * br, 0, 0); R.neck(0.03, 0, 0);
  R.hd(o.hf ?? -0.03, o.ht ?? (0.24 * Math.sin(t * 0.27) + 0.1 * Math.sin(t * 0.61)), 0.02 * Math.sin(t * 0.4));
  R.fk();
  plantedLegs(R);
  R.gogUp = 1;
}
function legIKblend(R, sd, tgt, pole, footQ, plantar, w) {
  const ft = sd === 1 ? B.ftR : B.ftL;
  R.legIK(sd, tgt, pole, footQ);
  const a = R.q[ft].clone();
  R.legIK(sd, tgt, pole, null, plantar);
  R.q[ft].copy(a.slerp(R.q[ft], w));
}
const lerpV = (a, b, t) => a.clone().lerp(b, t);

ST.stand = (R, t) => { standCore(R, t); relaxedArms(R, t); };

ST.point = (R, t, p) => {
  const D = R.D, s = D.s, sd = p.arm === 'L' ? -1 : 1;
  standCore(R, t, { yaw: -sd * 0.05, twist: -sd * 0.12, ht: -sd * 0.18 + 0.03 * Math.sin(t * 0.8) });
  const k = sst(0, 0.5, t);
  R.armFK(sd, { flex: 0.1 + 1.38 * k, abd: 0.05 + 0.05 * k, elbow: 0.2 * (1 - k) + 0.04, sup: 0.2, wr: 0.0 });
  R.armFK(-sd, { flex: 0.06, abd: 0.10, elbow: 0.25, sup: 0.15, wr: 0.05 });
  R.gogUp = 1;
};

ST.whistle = (R, t, p) => {
  const D = R.D, H = D.H, s = D.s, br = t > 0.7 ? 0.5 + 0.5 * Math.sin(t * 5.5) : 0;
  standCore(R, t, { hf: -0.02, ht: 0.05 * Math.sin(t * 0.5) });
  R.ch(0.02 + 0.04 * br, 0, 0);
  R.fk();
  const mouthY = D.top - 0.72 * D.headH, k = sst(0, 0.65, t);
  const tgt = lerpV(v3(0.22 * s, -0.02 * s, -0.02 * s), v3(0.028 * H, mouthY - 0.095 * H, -0.068 * H), k);
  R.armIK(1, tgt, v3(0.6, -1, 0.2), null, 0.0);
  R.armFK(-1, { flex: 0.06, abd: 0.10, elbow: 0.25, sup: 0.15, wr: 0.05 });
  R.gogUp = 1;
};

ST.clipboard = (R, t, p) => {
  const D = R.D, H = D.H, s = D.s, glance = 0.5 + 0.5 * Math.sin(t * 0.6);
  standCore(R, t, { hf: 0.12 + 0.25 * glance, ht: 0.1 * Math.sin(t * 0.3) });
  R.fk();
  const Hq = Qm(qx(0.32), qx(PI / 2));
  R.armIK(-1, v3(-0.118 * H, 0.125 * H, -0.150 * H), v3(-0.5, -1, 0.3), Hq);
  const wr = 0.012 * s * Math.sin(t * 3.1);
  R.armIK(1, v3(0.035 * H + wr, 0.150 * H, -0.172 * H), v3(0.5, -1, 0.3), null, 0.2);
  R.gogUp = 1;
};

ST.sitHigh = (R, t) => {
  const D = R.D, s = D.s, scan = Math.tanh(2.2 * Math.sin(t * 0.5));
  const br = Math.sin(t * TAU * 0.26);
  R.body({ y: 0.002 * s * br, pitch: 0.05 });
  R.sp(-0.03 + 0.01 * br, -0.25 * scan, 0); R.ch(-0.02, -0.2 * scan, 0); R.neck(0.0, 0, 0); R.hd(0.02, -0.55 * scan, 0);
  R.fk();
  for (const sd of [1, -1]) {
    R.legFK(sd, { flex: 1.50, abd: 0.12, knee: 1.45, out: 0.12, plantar: 0.15 });
    R.armIK(sd, v3(sd * (D.hipX + 0.03 * s), 0.085 * s, -0.25 * s), v3(sd * 0.6, -0.2, 0.8), null, 0.1);
  }
  R.gogUp = 1;
};

ST.crouchEdge = (R, t) => {
  const D = R.D, s = D.s, br = Math.sin(t * TAU * 0.3), gy = -D.hip + D.ankleH;
  R.body({ y: -0.40 * s + 0.003 * br, z: 0.14 * s, pitch: -0.42 });
  R.sp(0.30, -0.08, 0); R.ch(0.18, 0, 0); R.neck(-0.35, 0, 0); R.hd(-0.2, 0.15 * Math.sin(t * 0.4), 0);
  R.fk();
  for (const sd of [1, -1]) R.legIK(sd, v3(sd * 0.115 * s, gy, -0.04 * s), v3(sd * 0.3, 0, -1), Qm(qy(-sd * 0.2)));
  R.armIK(1, v3(0.17 * s, -D.hip + 0.03, -0.32 * s), v3(0.7, 0, 0.6), null, 0.2);
  R.armFK(-1, { flex: 0.95, abd: 0.15, elbow: 0.55, sup: 0.2, wr: 0.1 });
  R.gogUp = 1;
};

ST.standBehindBlock = (R, t) => {
  const D = R.D, s = D.s, T = 4.4, ph = t % T;
  const wA = sst(0, 0.3, ph) * (1 - sst(1.5, 1.8, ph)), wS = sst(1.7, 2.0, ph) * (1 - sst(2.8, 3.1, ph)), wH = sst(3.2, 3.4, ph) * (1 - sst(4.2, 4.4, ph));
  const hu = (ph - 3.3) * 1.9, hop = wH * Math.max(0, Math.sin(TAU * hu)), land = wH * Math.max(0, -Math.sin(TAU * hu));
  const sh = wS * Math.sin(t * TAU * 4.5), sw = Math.sin(TAU * 0.8 * ph);
  R.body({ y: -0.03 * s + 0.05 * s * hop - 0.035 * s * land, lean: 0.02 * sh, yaw: 0.12 * wA * sw });
  R.sp(0.05, -0.3 * wA * sw, 0.03 * sh); R.ch(0, -0.35 * wA * sw, 0.05 * sh); R.neck(0.05, 0, 0); R.hd(-0.06, 0.2 * wA * sw, 0);
  R.fk();
  const gy = -D.hip + D.ankleH;
  for (const sd of [1, -1]) {
    R.legIK(sd, v3(sd * 0.125 * s, gy + 0.07 * s * hop, -0.01 * s), v3(sd * 0.1, 0, -1), Qm(qy(-sd * 0.15), qx(-0.5 * hop)));
    const swing = wA * 1.15 * sw * (sd === 1 ? 1 : -1);
    R.armFK(sd, { flex: swing + wS * 0.15 * Math.sin(t * TAU * 4.5 + sd) + 0.08, abd: 0.12 + 0.4 * wA * Math.abs(sw) + 0.15 * hop, elbow: 0.25 + 0.35 * wS + 0.3 * hop, sup: 0.1, wr: 0.1 + 0.2 * sh });
  }
  R.gogUp = 0;
};

// grip/feet positions of the track-start in root space (world-fixed: shifted by the root offset cv)
function readyLimbs(R, cv, footBlend) {
  const D = R.D, s = D.s, gy = -D.hip + D.ankleH - cv.up, fz = cv.forward;
  const feet = [[1, 0.09 * s, -0.08 * s], [-1, -0.09 * s, 0.20 * s]];
  for (const [sd, x, z] of feet) {
    const tgt = v3(x, gy, z + fz);
    if (footBlend) {
      const trail = R.pelvisPt(v3(sd * 0.035 * s, -0.69 * s, footBlend.z(sd)));
      legIKblend(R, sd, lerpV(tgt, trail, footBlend.w), v3(sd * 0.15, 0, -1), Qm(qy(-sd * 0.1)), 0.9, footBlend.w);
    } else R.legIK(sd, tgt, v3(sd * 0.15, 0, -1), Qm(qy(-sd * 0.1)));
  }
}
function gripTarget(R, sd, cv) { const D = R.D, s = D.s; return v3(sd * 0.20 * s, -D.hip + 0.015 - cv.up, -0.285 * s + cv.forward); }

ST.blockReady = (R, t) => {
  const D = R.D, s = D.s, br = Math.sin(t * TAU * 0.3), cv = { up: 0, forward: 0 };
  R.body({ y: -0.24 * s + 0.003 * br, z: 0.05 * s, pitch: -0.40 });
  R.sp(0.45, 0, 0); R.ch(0.30, 0, 0); R.neck(-0.45, 0, 0); R.hd(-0.1, 0, 0);
  R.fk();
  readyLimbs(R, cv);
  for (const sd of [1, -1]) R.armIK(sd, gripTarget(R, sd, cv), v3(sd * 0.7, 0, 0.5), null, 0.25);
  R.gogUp = 0;
};

// ---------- DIVE ----------
ST.dive = (R, t, p, me) => {
  const D = R.D, s = D.s, T = me._tabs.dive || (me._tabs.dive = buildDiveTable(D, 0.75)), cv = sampleTab(T, t), te = Math.max(0.85, T.te);
  const ext = sst(0.18, 0.42, t);
  const keys = [[0.4, 0.12], [te - 0.12, -0.75], [te + 0.05, -0.85], [te + 0.3, -0.45], [te + 0.5, 0.0], [te + 0.7, 0.15], [Math.max(te + 0.9, 2.0), 0.0]];
  const thb = t <= 0.4 ? 0.12 : tabAt(keys, t, [0, 0])[1];
  const pitch = lerp(-0.40, -PI / 2 + thb, ext);
  const dolph = sst(te + 0.2, te + 0.5, t) * 0.32, wv = TAU * 2.2 * (t - te);
  R.body({ y: -0.24 * s, z: 0.05 * s, pitch });
  R.sp(0.45 * (1 - ext) + dolph * Math.sin(wv), 0, 0); R.ch(0.30 * (1 - ext) + 0.6 * dolph * Math.sin(wv - 0.7), 0, 0);
  R.neck(-0.45 * (1 - ext) + 0.15 * ext, 0, 0); R.hd(-0.1 * (1 - ext), 0, 0);
  R.fk();
  const fw = sst(0.36, 0.5, t), amp = 0.12 * s * dolph / 0.32;
  readyLimbs(R, cv, { w: fw, z: sd => amp * Math.sin(wv - 1.1 + (sd === 1 ? 0 : 0.35)) });
  // arms: grip -> streamline -> breaststroke pull-out
  const pt0 = te + 0.35, q = clamp((t - pt0) / (2.0 - pt0), 0, 1);
  const pkeys = [[0, -0.15, 0.48, 0], [0.25, 0.22, 0.36, -0.22], [0.45, 0.12, -0.10, -0.30], [0.62, 0.05, -0.42, -0.16], [0.82, -0.02, -0.05, -0.18], [1, -0.15, 0.42, -0.04]];
  const pr = tabAt(pkeys, q, [0, 0, 0, 0]), wP = sst(pt0 - 0.05, pt0 + 0.08, t), wS = sst(0.30, 0.52, t);
  for (const sd of [1, -1]) {
    const grip = gripTarget(R, sd, cv);
    const sw = R.chestPt(v3(sd * -0.15 * s, 0.48 * s, 0));
    const side = R.chestDir(v3(sd * 0.28 * s * Math.sin(PI * wS), 0, 0));
    let tgt = lerpV(grip, sw, wS).add(side);
    if (wP > 0) tgt = lerpV(tgt, R.chestPt(v3(sd * pr[1] * s, pr[2] * s, pr[3] * s)), wP);
    R.armIK(sd, tgt, R.chestDir(v3(sd * 0.3 * wP, 0, 1)), null, 0.1);
  }
  R.gogUp = 0;
};

// ---------- BACKSTROKE ----------
const BK_PULL = [ // phase, l(outwards), u(head), v(back/down)
  [0.00, 0.03, 0.49, -0.04], [0.08, 0.10, 0.46, 0.13], [0.18, 0.18, 0.34, 0.29], [0.30, 0.16, 0.12, 0.32], [0.42, 0.10, -0.20, 0.26], [0.50, 0.07, -0.41, 0.14], [0.56, 0.06, -0.495, 0.0]];
function bkArmKeys(ab) {
  const keys = BK_PULL.map(r => [r[0], r[1], r[2], r[3], 0.25, -0.15, 0.9]);
  // recovery arc: straight arm swinging over, thumb out first
  const th = [[0.60, 0.30, 0.12], [0.68, 0.85, 0.17], [0.76, 1.55, 0.2], [0.84, 2.25, 0.2], [0.91, 2.8, 0.15], [0.97, 3.05, 0.08]];
  for (const [ph, a, ab2] of th) {
    const R0 = 0.495, dx = Math.sin(ab2), dy = -Math.cos(ab2) * Math.cos(a), dz = -Math.cos(ab2) * Math.sin(a);
    keys.push([ph, R0 * dx, R0 * dy, R0 * dz, 0.0, 0.0, 1.0]);
  }
  keys.sort((a, b) => a[0] - b[0]);
  return keys;
}
const BK_KEYS = bkArmKeys();
ST.backstroke = (R, t, p, me) => {
  const D = R.D, s = D.s, T = p.cycle || 1.3, ph = frac(t / T + (p.phase || 0)), A = 0.66;
  const rollR = A * Math.sin(TAU * (ph + 0.06));
  R.body({ y: -0.085 * s, yaw: PI, pitch: PI / 2 - 0.06, roll: -rollR * 0.85 });
  R.sp(-0.04, 0, 0); R.ch(0, -0.3 * rollR, 0); R.neck(-0.12, 0.0, 0); R.hd(0.0, 0.95 * rollR, 0);
  R.fk();
  for (const sd of [1, -1]) {
    const k = splN(BK_KEYS, ph + (sd === 1 ? 0 : 0.5));
    const tgt = R.chestPt(v3(sd * k[0] * s, k[1] * s, k[2] * s));
    R.armIK(sd, tgt, R.chestDir(v3(sd * k[3], k[4], k[5])), null, 0.1);
    const psi = TAU * 3 * ph + (sd === 1 ? 0 : PI);
    const z = -0.14 * s * Math.sin(psi);
    legIKblend(R, sd, R.pelvisPt(v3(sd * 0.06 * s, -0.66 * s, z)), v3(sd * 0.1, 0, -1), null, 0.9, 1);
  }
  R.gogUp = 0;
};

// ---------- BREASTSTROKE ----------
const BS_ARMS = [[0.0, -0.12, 0.49, -0.02, 0.3, 0, -0.2], [0.12, -0.10, 0.49, -0.03, 0.3, 0, -0.2], [0.22, 0.06, 0.45, -0.10, 0.9, 0, 0.3], [0.30, 0.22, 0.38, -0.16, 0.9, 0, 0.4],
  [0.38, 0.20, 0.22, -0.28, 0.9, 0, 0.1], [0.46, 0.02, 0.10, -0.22, 0.4, -0.3, -0.8], [0.54, -0.12, 0.22, -0.14, 0.4, -0.3, -0.5], [0.62, -0.13, 0.40, -0.07, 0.3, 0, -0.3], [0.70, -0.12, 0.49, -0.03, 0.3, 0, -0.2]];
const BS_LEGS = [[0.0, 0.0, 0.06, 0.05, 0.75, 0.1], [0.30, 0.05, 0.08, 0.2, 0.7, 0.2], [0.40, 0.45, 0.22, 1.2, 0.2, 0.5], [0.52, 0.75, 0.35, 2.2, -0.5, 0.9], [0.58, 0.7, 0.45, 1.9, -0.5, 0.9],
  [0.66, 0.3, 0.5, 0.8, -0.2, 0.6], [0.74, 0.05, 0.15, 0.15, 0.4, 0.1], [0.82, 0.0, 0.05, 0.05, 0.8, 0.1]];
ST.breaststroke = (R, t, p, me) => {
  const D = R.D, s = D.s, T = p.cycle || 1.2, ph = frac(t / T + (p.phase || 0));
  me.speedPhase = ph;
  const b = sst(0.28, 0.42, ph) - sst(0.52, 0.66, ph);
  R.body({ y: -0.07 * s - 0.07 * s * b, pitch: -PI / 2 + 0.10 * b + 0.03, z: 0.02 * s * b });
  R.sp(-0.18 * b, 0, 0); R.ch(-0.2 * b, 0, 0); R.neck(0.08 - 0.5 * b, 0, 0); R.hd(0, 0, 0);
  R.fk();
  const a = splN(BS_ARMS, ph);
  for (const sd of [1, -1]) {
    R.armIK(sd, R.chestPt(v3(sd * a[0] * s, a[1] * s, a[2] * s)), R.chestDir(v3(sd * a[3], a[4], a[5])), null, 0.1);
  }
  const l = splN(BS_LEGS, ph), out = spl1([[0, 0.1], [0.3, 0.2], [0.5, 0.9], [0.66, 0.6], [0.78, 0.1]], ph);
  for (const sd of [1, -1]) R.legFK(sd, { flex: l[0], abd: l[1], knee: l[2], plantar: l[3], out: out * 0.6 * 0 + l[4] * 0.5, inv: 0 });
  R.gogUp = 0;
};

// ---------- backstroke start / touch / hold / climb ----------
ST.backstrokeStart = (R, t, p, me) => {
  const D = R.D, s = D.s, T = me._tabs.launch || (me._tabs.launch = buildLaunchTable(D));
  const tau = me.goT === null ? -1 : Math.min(LAUNCH_T, t - me.goT), cv = tau < 0 ? { up: 0, forward: 0 } : sampleTab(T, tau), te = Math.max(0.7, T.te);
  const br = Math.sin(t * TAU * 0.3), wall = 0.40 * s;
  const pk = [[0, -0.35], [0.12, -0.5], [0.3, 0.3], [0.42, 1.0], [0.62, 1.75], [te, 2.0], [te + 0.2, 1.9], [te + 0.5, 1.58], [Math.max(te + 0.9, 2.0), 1.57]];
  const pitch = tau < 0 ? -0.35 + 0.015 * br : tabAt(pk, tau, [0, 0])[1];
  R.body({ y: -0.42 * s, z: -0.04 * s, yaw: PI, pitch });
  const ex = tau < 0 ? 0 : sst(0.1, 0.35, tau);
  const dolph = tau < 0 ? 0 : sst(te + 0.3, te + 0.6, tau) * 0.3, wv = TAU * 2.2 * (tau - te);
  R.sp(0.1 - 0.25 * ex + dolph * Math.sin(wv), 0, 0); R.ch(0.15 - 0.3 * ex + 0.6 * dolph * Math.sin(wv - 0.7), 0, 0); R.neck(-0.5 * ex + 0.1 * br, 0, 0); R.hd(0, 0, 0);
  R.fk();
  const hy = 0.30, gy = -0.30, fz = wall - 0.035 * s;
  const footQ = Qm(qy(PI), qx(PI / 2));
  const fw = tau < 0 ? 0 : sst(0.37, 0.48, tau), amp = 0.12 * s * dolph / 0.3;
  for (const sd of [1, -1]) {
    const tgt = v3(sd * 0.12 * s, gy - cv.up, fz + cv.forward);
    const trail = R.pelvisPt(v3(sd * 0.035 * s, -0.69 * s, amp * Math.sin(wv - 1.1 + (sd === 1 ? 0 : 0.35))));
    legIKblend(R, sd, lerpV(tgt, trail, fw), v3(sd * 0.2, 0.3, 1), footQ, 0.9, fw);
    const grip = v3(sd * 0.20 * s, hy - cv.up, wall - 0.03 + cv.forward);
    const wS = tau < 0 ? 0 : sst(0.12, 0.5, tau);
    const stream = R.chestPt(v3(sd * -0.15 * s, 0.48 * s, 0)), side = R.chestDir(v3(sd * 0.3 * s * Math.sin(PI * wS), 0.0, -0.15 * s * Math.sin(PI * wS)));
    R.armIK(sd, lerpV(grip, stream, wS).add(side), R.chestDir(v3(sd * 0.5, -0.3, 0.8)), null, 0.1);
  }
  R.gogUp = 0;
};

ST.touchWall = (R, t, p, me) => {
  const D = R.D, s = D.s, r = sst(0.4, 1.4, t), br = Math.sin(t * 2);
  R.body({ y: -0.12 * s - 0.02 * s * r, yaw: PI, pitch: PI / 2 - 0.05 - 0.1 * r, roll: -0.35 * (1 - r) + 0.02 * br });
  R.sp(-0.04, 0, 0); R.ch(0, 0, 0); R.neck(-0.12 + 0.1 * r, 0, 0); R.hd(0, 0.3 * (1 - r), 0);
  R.fk();
  R.armIK(1, R.chestPt(v3(0.03 * s, 0.50 * s, -0.02 * s)), R.chestDir(v3(0.1, 0, 1)), null, 0.1);
  R.armFK(-1, { flex: 0.25 + 0.2 * r, abd: 0.22 + 0.3 * r, elbow: 0.2, sup: 0.2, wr: 0.1 });
  const kick = 0.8 * Math.exp(-t / 1.0);
  for (const sd of [1, -1]) legIKblend(R, sd, R.pelvisPt(v3(sd * (0.06 + 0.05 * r) * s, -0.66 * s, -0.14 * s * kick * Math.sin(TAU * 3.2 * t + (sd === 1 ? 0 : PI)))), v3(sd * 0.1, 0, -1), null, 0.8, 1);
  R.gogUp = 0;
};

function holdPose(R, t, hands) {
  const D = R.D, s = D.s, py = -(0.10 + 0.30 * D.H);
  const w = TAU * 0.4;
  R.body({ y: py + 0.012 * Math.sin(t * 1.3), pitch: -0.12 });
  R.sp(0.04, 0, 0); R.ch(0.02, 0, 0); R.neck(-0.25, 0, 0); R.hd(-0.08, -0.9 + 0.1 * Math.sin(t * 0.5), 0.08);
  R.fk();
  for (const sd of [1, -1]) {
    R.armIK(sd, hands(sd), v3(sd * 0.6, -1, 0.1), null, 0.2);
    R.legFK(sd, { flex: -0.18 + 0.14 * Math.sin(w * t + (sd === 1 ? 0 : PI)), abd: 0.1, knee: 0.5 + 0.3 * Math.sin(w * t + (sd === 1 ? 0 : PI) + 1), plantar: 0.5 });
  }
}
ST.holdWall = (R, t) => { const s = R.D.s; holdPose(R, t, sd => v3(sd * 0.22 * s, 0.10 - 0.0, -0.45 * s)); R.gogUp = 0; };

ST.climbOut = (R, t, p, me) => {
  const D = R.D, s = D.s, T = me._tabs.climb || (me._tabs.climb = buildClimbTable(D)), cv = sampleTab(T, t);
  const tt = Math.min(t, CLIMB_T), push = sst(0.45, 1.1, tt), stand = sst(1.6, 2.2, tt);
  const by = climbBoneY(D, tt);
  R.body({ y: by, pitch: -(0.12 + 0.75 * push) * (1 - stand) });
  R.sp(0.04 + 0.3 * push * (1 - stand), 0, 0); R.ch(0.02 + 0.2 * push * (1 - stand), 0, 0); R.neck(-0.25 - 0.3 * push * (1 - stand) + 0.25 * stand, 0, 0); R.hd(-0.08, -0.9 * (1 - sst(0.2, 1, tt)), 0);
  R.fk();
  const fix = (x, y, z) => v3(x, y - cv.up, z + cv.forward);   // world-fixed point -> root space
  for (const sd of [1, -1]) {
    const hand = lerpV(v3(sd * 0.22 * s, 0.10, -0.40 * s), v3(sd * 0.22 * s, 0.125, -0.55 * s), sst(0, 0.4, tt));
    const release = sst(1.4, 1.9, tt);
    const free = R.chestPt(v3(sd * 0.22 * s, -0.30 * s, -0.25 * s));
    R.armIK(sd, lerpV(fix(hand.x, hand.y, hand.z), free, release), v3(sd * 0.6, -0.4, 0.8), null, 0.2);
  }
  // legs: right knee onto the deck, then both feet planted
  const dk = 0.12, gy = dk + D.ankleH;
  const rK = sst(0.95, 1.35, tt), rF = sst(1.45, 1.85, tt), lF = sst(1.7, 2.1, tt);
  const hang = sd => R.pelvisPt(v3(sd * 0.08 * s, -0.66 * s, 0.12 * s + 0.1 * s * Math.sin(tt * 7 + sd)));
  { // right
    let a = lerpV(hang(1), fix(0.10 * s, dk + 0.07, -0.20 * s), rK);
    a = lerpV(a, fix(0.11 * s, gy, -0.78 * s), rF);
    R.legIK(1, a, v3(0.3, 0.2, -1), rF > 0.5 ? Qm(qy(-0.1)) : null, 0.7);
  }
  {
    let a = lerpV(hang(-1), fix(-0.11 * s, gy, -0.82 * s), lF);
    R.legIK(-1, a, v3(-0.3, 0.2, -1), lF > 0.5 ? Qm(qy(0.1)) : null, 0.6);
  }
  R.gogUp = 0;
};

// ---------- WATER: treading / panic ----------
ST.tread = (R, t) => {
  const D = R.D, s = D.s, py = -(0.12 + 0.30 * D.H), w = TAU / 0.9, w2 = TAU / 0.85;
  R.body({ y: py + 0.015 * Math.sin(t * 1.4), pitch: -0.05 });
  R.sp(0.02, 0, 0); R.ch(0.0, 0, 0); R.neck(0.0, 0, 0); R.hd(-0.05, 0.25 * Math.sin(t * 0.4), 0);
  R.fk();
  for (const sd of [1, -1]) {
    const th = (sd === 1 ? 1 : -1) * w * t + (sd === 1 ? 0 : PI);
    R.legIK(sd, R.pelvisPt(v3(sd * (0.21 + 0.10 * Math.cos(th)) * s, -0.38 * s, (-0.17 + 0.10 * Math.sin(th)) * s)), v3(sd * 0.5, 0.3, -1), null, 0.4);
    const sc = Math.sin(w2 * t + (sd === 1 ? 0 : 1.2));
    R.armIK(sd, v3(sd * (0.26 + 0.09 * sc) * s, -0.11 * s - 0.02 * Math.cos(w2 * t * 2), (-0.36 - 0.04 * Math.cos(w2 * t)) * s + py * 0), v3(sd * 0.5, -1, 0.3), Qm(qx(PI / 2 - 0.2), qz(sd * 0.2 * sc)));
  }
  R.gogUp = 0;
};
ST.stopScream = (R, t) => {
  const D = R.D, s = D.s, py = -(0.14 + 0.30 * D.H), k = Math.exp(-t / 1.2);
  R.body({ y: py + 0.03 * Math.sin(t * 5), pitch: 0.22 + 0.1 * k });
  R.sp(-0.05, 0.1 * Math.sin(t * 3.1), 0.05 * Math.sin(t * 4.3)); R.ch(-0.05, 0, 0); R.neck(-0.45 * k - 0.15, 0, 0); R.hd(-0.1, 0.35 * Math.sin(t * 2.3) * (1 - k), 0.1 * Math.sin(t * 3.7));
  R.fk();
  for (const sd of [1, -1]) {
    const f = sd === 1 ? 1 : 1.27, a = t * 7 * f + sd;
    R.armIK(sd, R.chestPt(v3(sd * (0.30 + 0.20 * Math.sin(a)) * s, (0.05 + 0.28 * Math.sin(a * 0.8 + 1)) * s, (-0.20 - 0.22 * Math.cos(a)) * s)), v3(sd * 0.4, -1, 0.3), null, 0.2);
    R.legFK(sd, { flex: 0.35 * Math.sin(8 * t + sd * 2), abd: 0.25, knee: 0.7 + 0.5 * Math.sin(8 * t + sd * 2 + 1), plantar: 0.4 });
  }
  R.gogUp = 0;
};

// ---------- WATER: unconscious casualty (limp, slow) ----------
ST.drift = (R, t) => {
  const D = R.D, s = D.s, bob = 0.012 * s * Math.sin(t * TAU / 3.2);
  R.body({ y: -0.30 * s + bob, yaw: PI, pitch: PI / 2 - 0.38 + 0.02 * Math.sin(t * 0.7), roll: 0.05 * Math.sin(t * 0.5) });
  R.sp(-0.03, 0, 0); R.ch(-0.03, 0, 0); R.neck(-0.28, 0, 0.05 * Math.sin(t * 0.4)); R.hd(-0.1, 0.15, 0);
  R.fk();
  for (const sd of [1, -1]) {
    R.armFK(sd, { flex: 0.12 + 0.05 * Math.sin(t * 0.6 + sd), abd: 0.72 + 0.05 * Math.sin(t * 0.5 + sd * 2), elbow: 0.25, sup: -0.3, wr: -0.5 });
    R.legFK(sd, { flex: 0.08, abd: 0.14, knee: 0.22 + 0.04 * Math.sin(t * 0.5 + sd), plantar: 0.5, out: 0.2 });
  }
  R.gogUp = 0;
};
ST.rollFaceDown = (R, t) => {
  const D = R.D, s = D.s, u = sst5(0, 1, t / 2.5), ua = sst5(0, 1, (t - 0.35) / 2.5), sw = Math.sin(t * 0.6);
  R.body({ y: lerp(-0.30, -0.15, u) * s + 0.01 * s * Math.sin(t * 1.9), yaw: PI, pitch: PI / 2 - lerp(0.38, 0.08, u), roll: -PI * u });
  R.sp(lerp(-0.10, 0.1, u), 0, 0); R.ch(lerp(-0.08, 0.1, u), 0, 0); R.neck(lerp(-0.35, 0.55, ua), 0, 0.05 * Math.sin(t * 0.4)); R.hd(lerp(-0.1, 0.3, ua), lerp(0.15, 0.3, u), 0);
  R.fk();
  for (const sd of [1, -1]) {
    R.armFK(sd, { flex: lerp(0.45, 1.35, ua) + 0.05 * sw, abd: lerp(0.65, 0.45, ua), elbow: lerp(0.35, 0.2, ua), sup: -0.3, wr: -0.5 });
    R.legFK(sd, { flex: lerp(-0.08, 0.85, ua), abd: 0.14, knee: lerp(0.22, 0.35, ua), plantar: 0.5, out: 0.2 });
  }
  R.gogUp = 0;
};
ST.sink = (R, t) => {
  const D = R.D, s = D.s, k = sst(0, 1, t / 2), sw = Math.sin(t * 0.7);
  R.body({ y: -0.15 * s * (1 - k), yaw: PI, pitch: PI / 2 - 0.08 + 0.12 * k, roll: -PI });
  R.sp(0.1, 0, 0); R.ch(0.1 - 0.12 * k, 0, 0); R.neck(lerp(0.55, 0.2, k), 0, 0.05 * sw); R.hd(lerp(0.3, 0.1, k), 0.3, 0);
  R.fk();
  for (const sd of [1, -1]) {
    R.armFK(sd, { flex: lerp(1.35, 0.3, k) + 0.06 * sw, abd: lerp(0.45, 0.8, k), elbow: lerp(0.2, 0.45, k), sup: -0.3, wr: lerp(-0.5, 0.2, k) });
    R.legFK(sd, { flex: lerp(0.85, 0.1, k), abd: 0.14 + 0.05 * k, knee: lerp(0.35, 0.55, k), plantar: 0.5, out: 0.2 });
  }
  R.gogUp = 0;
};
ST.bottom = (R, t) => {
  const D = R.D, s = D.s;
  R.body({ y: 0.098 * s, yaw: PI, pitch: PI / 2, roll: -PI });
  R.sp(0.04, 0, 0); R.ch(0.04, 0, 0); R.neck(0.25, 0, 0); R.hd(0.1, 0.5, 0);
  R.fk();
  R.armFK(1, { flex: 2.6, abd: 0.55, elbow: 0.3, sup: -0.3, wr: -0.3 });
  R.armFK(-1, { flex: 0.25, abd: 0.5, elbow: 0.2, sup: -0.3, wr: -0.3 });
  R.legFK(1, { flex: 0.04, abd: 0.12, knee: 0.1, plantar: 0.4, out: 0.2 });
  R.legFK(-1, { flex: 0.08, abd: 0.14, knee: 0.25, plantar: 0.4, out: 0.2 });
  R.gogUp = 0;
};

// =====================================================================================
// Person
// =====================================================================================
const PERSON_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.0 });

function propGeom(boxes) {
  const parts = boxes.map(b => {
    const g = new THREE.BoxGeometry(b.w, b.h, b.d); g.translate(b.x || 0, b.y || 0, b.z || 0);
    const c = new Col(b.c), n = g.attributes.position.count, arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3)); return g;
  });
  const g = mergeGeometries(parts); parts.forEach(p => p.dispose()); return g;
}

class Person {
  constructor(sp) {
    this.sp = sp; const D = this.D = makeDims(sp); this.R = new Rig(D);
    this.hipHeight = D.hip; this.height = D.H; this.sitHeight = D.sit; this.scale = D.s;
    this.root = new THREE.Group(); this.root.name = 'person';
    const bones = this.bones = BN.map(n => { const b = new THREE.Bone(); b.name = n; return b; });
    const eyeAbs = D.top - D.headH + 0.52 * D.headH;
    this.gogRest = new V3(0, eyeAbs - D.headY, -0.061 * D.H);
    const off = {
      pelvis: [0, 0, 0], spine: [0, D.spineY, 0], chest: [0, D.chestY, 0], neck: [0, D.neckY, 0], head: [0, D.headRel, 0], gog: [this.gogRest.x, this.gogRest.y, this.gogRest.z],
      uaR: [D.shX, D.shY, 0], faR: [0, -D.ua, 0], haR: [0, -D.fa, 0], uaL: [-D.shX, D.shY, 0], faL: [0, -D.ua, 0], haL: [0, -D.fa, 0],
      thR: [D.hipX, 0, 0], shR: [0, -D.thigh, 0], ftR: [0, -D.shin, 0], thL: [-D.hipX, 0, 0], shL: [0, -D.thigh, 0], ftL: [0, -D.shin, 0]
    };
    BN.forEach((n, i) => { bones[i].position.set(...off[n]); if (PARENT[i] >= 0) bones[PARENT[i]].add(bones[i]); });
    // geometry built with absolute rest coordinates
    const geo = buildBody(sp, D, bones);
    const mesh = this.mesh = new THREE.SkinnedMesh(geo, PERSON_MAT);
    mesh.frustumCulled = false; mesh.name = 'body';
    mesh.add(bones[0]); this.root.add(mesh); this.root.updateMatrixWorld(true);
    this.skeleton = new THREE.Skeleton(bones); mesh.bind(this.skeleton);
    this.props = {};
    this._buildProps();
    // state
    this.state = ''; this.t = 0; this.params = {}; this.prev = null; this.blendT = 0; this.blendDur = 0;
    this.A = this._buf(); this.Bf = this._buf();
    this.speedPhase = 0;
    this.wallOffset = 0.40 * D.s;   // backstrokeStart: wall is this far behind the root (local +Z)
    this.holdWallDistance = 0.38;   // holdWall/climbOut: wall face is this far ahead (local -Z)
    this.touchDistance = (D.spineY + D.chestY + D.shY) + (D.ua + D.fa) * 0.97 + D.hand * 0.8; // touchWall: wall this far ahead of root
    this.hangDepth = -(0.10 + 0.30 * D.H);
    this.diveDone = false; this.climbDone = false;
    this._tabs = {};
    this.set('stand', { blend: 0 }); this.update(0);
  }
  _buf() { return { q: BN.map(() => new Q()), pp: new V3(), gog: 0 }; }
  _buildProps() {
    const s = this.D.s;
    // clipboard: held by the left hand (visible only in the 'clipboard' state)
    const cb = new THREE.Mesh(propGeom([
      { w: 0.235 * s, h: 0.320 * s, d: 0.011 * s, c: 0x6b4a2b },
      { w: 0.205 * s, h: 0.285 * s, d: 0.004 * s, z: 0.0065 * s, c: 0xf1f1ec },
      { w: 0.07 * s, h: 0.032 * s, d: 0.016 * s, y: 0.158 * s, z: 0.004 * s, c: 0x9aa0a6 }]), PERSON_MAT);
    cb.position.set(0.12 * s, -0.06 * s, 0); cb.quaternion.copy(qx(-PI / 2)); cb.visible = false; cb.frustumCulled = true; this.bones[B.haL].add(cb); this.props.clipboard = cb;
    // whistle (right hand, 'whistle' state)
    const wh = new THREE.Mesh(propGeom([{ w: 0.026 * s, h: 0.016 * s, d: 0.016 * s, c: 0xc9ced4 }, { w: 0.012 * s, h: 0.014 * s, d: 0.014 * s, x: -0.016 * s, c: 0xe8e8ea }]), PERSON_MAT);
    wh.position.set(0, -0.10 * this.D.H, -0.012 * this.D.H); wh.visible = false; this.bones[B.haR].add(wh); this.props.whistle = wh;
  }
  // ---------- state machine ----------
  set(state, opts = {}) {
    if (!ST[state]) throw new Error('unknown state ' + state);
    const { blend = 0.3, ...params } = opts;
    if (this.state && blend > 0) { this.prev = { state: this.state, t: this.t, params: this.params }; this.blendT = 0; this.blendDur = blend; }
    else this.prev = null;
    this.state = state; this.t = 0; this.params = params;
    this.goT = null; this.diveDone = false; this.climbDone = false;
    if (state === 'dive') this._tabs.dive = buildDiveTable(this.D, params.blockHeight ?? 0.75);
    if (state === 'backstrokeStart') this._tabs.launch = buildLaunchTable(this.D);
    if (state === 'climbOut') this._tabs.climb = buildClimbTable(this.D, params);
    return this;
  }
  go() { this.params.go = true; }
  update(dt) {
    this.t += dt;
    const p = this.params;
    if (this.state === 'backstrokeStart' && this.goT === null && p.go) this.goT = this.t;
    if (this.prev) { this.prev.t += dt; this.blendT += dt; }
    this._eval(ST[this.state], this.t, p, this.Bf);
    let out = this.Bf;
    if (this.prev && this.blendT < this.blendDur) {
      this._eval(ST[this.prev.state], this.prev.t, this.prev.params, this.A);
      const w = sst(0, 1, this.blendT / this.blendDur);
      for (let i = 0; i < BN.length; i++) this.A.q[i].slerp(this.Bf.q[i], w);
      this.A.pp.lerp(this.Bf.pp, w); this.A.gog = lerp(this.A.gog, this.Bf.gog, w);
      out = this.A;
    } else this.prev = null;
    for (let i = 0; i < BN.length; i++) this.bones[i].quaternion.copy(out.q[i]);
    this.bones[0].position.copy(out.pp);
    const up = out.gog, g = this.bones[B.gog], H = this.D.H;
    g.position.set(this.gogRest.x, this.gogRest.y + up * 0.050 * H, this.gogRest.z + up * 0.020 * H);
    g.quaternion.copy(qx(0.62 * up));
    this.props.clipboard.visible = this.state === 'clipboard';
    this.props.whistle.visible = this.state === 'whistle';
    this.diveDone = this.state === 'dive' && this.t >= DIVE_T;
    this.climbDone = this.state === 'climbOut' && this.t >= CLIMB_T;
  }
  _eval(fn, t, p, buf) {
    const R = this.R; R.reset();
    fn(R, t, p, this);
    const gOpt = p.goggles === 'up' ? 1 : p.goggles === 'on' ? 0 : R.gogUp;
    for (let i = 0; i < BN.length; i++) buf.q[i].copy(R.q[i]);
    buf.pp.copy(R.pp); buf.gog = gOpt;
  }
  // ---------- extras ----------
  speedFactor() { return state_speedFactor(this); }
  diveCurve(t) { const T = this._tabs.dive || (this._tabs.dive = buildDiveTable(this.D, 0.75)); return sampleTab(T, t); }
  launchCurve(t) { const T = this._tabs.launch || (this._tabs.launch = buildLaunchTable(this.D)); return sampleTab(T, t); }
  climbCurve(t) { const T = this._tabs.climb || (this._tabs.climb = buildClimbTable(this.D, this.params)); return sampleTab(T, t); }
  get isLaunched() { return this.state === 'backstrokeStart' && this.goT !== null && (this.t - this.goT) >= LAUNCH_OFF; }
  get goTime() { return this.goT; }
  dispose() {
    this.mesh.geometry.dispose(); this.skeleton.dispose();
    for (const k in this.props) this.props[k].geometry.dispose();
    this.root.removeFromParent();
  }
}

// =====================================================================================
// Public factories
// =====================================================================================
const SKINS = [0xf1c6a5, 0xe3b08a, 0xd29b72, 0xb97f55, 0x9a6540, 0x7a4c30, 0x5d3a25];
const HAIRS = [0x1a1410, 0x2b1d14, 0x4a3020, 0x7a5230, 0xb08a52, 0x2a2a2c, 0x8a8a8a];
const GOGS = [0xe8eef2, 0x2f6fed, 0xff5a36, 0x16c1a0, 0x1a1a1a];

export function makeKid(o = {}) {
  const r = mulberry(o.seed ?? 1);
  const H = clamp(o.height ?? 1.55, 1.40, 1.72);
  const sp = {
    H, adult: false, sex: o.sex || 'm', build: o.build ?? 0.5, skin: o.skin ?? SKINS[Math.floor(r() * 5)],
    cols: { cap: o.cap ?? 0xd8232a, suit: o.suit ?? 0x1c2f6b, gogFrame: GOGS[Math.floor(r() * GOGS.length)] }, goggles: o.goggles
  };
  return new Person(sp);
}

const ROLE_DEF = {
  referee: { top: 0xf4f4f2, bottom: 0xf1f1ef, shoe: 0xdedede },
  official: { top: 0xf2f2f0, bottom: 0x1b2744, shoe: 0x2a2a2e },
  lifeguard: { top: 0xc8202a, bottom: 0x1b2744, shoe: 0x2a2a2e, shorts: true, flipflop: true },
  coach: { top: 0x1f4f9a, bottom: 0x16213c, shoe: 0xe6e6e6, longSleeve: true },
  medic: { top: 0x1e5a3e, bottom: 0x1b4a34, shoe: 0x202020, reflect: 0xd8dccb },
  spectator: { top: 0x7a8fa6, bottom: 0x3a3f4a, shoe: 0x3a3a3a }
};
export function makeAdult(o = {}) {
  const r = mulberry(o.seed ?? 1), role = o.role || 'spectator', d = ROLE_DEF[role] || ROLE_DEF.spectator;
  const sex = o.sex || 'm';
  const H = clamp(o.height ?? (sex === 'f' ? 1.66 : 1.78), 1.5, 2.0);
  const sp = {
    H, adult: true, sex, role, build: o.build ?? (0.3 + 0.4 * r()), skin: o.skin ?? SKINS[Math.floor(r() * SKINS.length)],
    cols: {
      top: o.top ?? d.top, bottom: o.bottom ?? d.bottom, hair: o.hair ?? HAIRS[Math.floor(r() * HAIRS.length)], shoe: d.shoe, reflect: d.reflect,
      shorts: d.shorts || (role === 'spectator' && r() < 0.25), longSleeve: d.longSleeve || (role === 'spectator' && r() < 0.3), flipflop: d.flipflop
    }
  };
  return new Person(sp);
}

// =====================================================================================
// Crowd: seated spectators, 2 draw calls (body InstancedMesh + arms InstancedMesh)
// =====================================================================================
export const STATE_NAMES = Object.keys(ST);

function crowdGeometries() {
  const H = 1.70, k = H, py = 0.10;
  const Gb = newG(), Ga = newG();
  const reg = (v) => () => v;
  // torso
  const y0 = -0.07, y1 = 0.345;
  const rows = [[-0.07, .016, .016, 0], [-0.055, .062, .048, .006], [-0.03, .084, .06, .006], [0, .092, .064, .008], [0.04, .086, .06, .004], [0.085, .078, .054, 0], [0.14, .084, .057, -.002],
    [0.20, .094, .062, -.004], [0.245, .101, .064, -.004], [0.28, .105, .058, 0], [0.30, .088, .046, .004], [0.322, .05, .036, .005], [0.345, .026, .026, .005]];
  const span = y1 - y0;
  addTube(Gb, { p0: new V3(0, py + y0 * H, 0), p1: new V3(0, py + y1 * H, 0), k, n: 12, seg: 10, tab: rows.map(([y, rx, rz, oz]) => [(y - y0) / span, rx, rz, 0, oz]), col: () => 0xffffff, region: (u, phi, p) => (p.y > py + 0.31 * H ? 0 : (p.y < py - 0.02 * H ? 3 : 1)) });
  // neck + head
  addTube(Gb, { p0: new V3(0, py + 0.32 * H, 0.004 * H), p1: new V3(0, py + 0.40 * H, 0.004 * H), k, n: 2, seg: 8, tab: [[0, .036, .034, 0, 0], [1, .026, .028, 0, 0]], col: () => 0xffffff, region: reg(0) });
  const hh = 0.13 * H, top = py + 0.5 * H * 0.99 + 0.0, chin = top - hh, sc = hh / (0.145 * H);
  addTube(Gb, {
    p0: new V3(0, chin, 0), p1: new V3(0, top, 0), k: k * sc, n: 10, seg: 10,
    tab: [[0, .008, .012, 0, -.002], [0.05, .030, .038, 0, -.012], [0.15, .040, .048, 0, -.008], [0.35, .048, .057, 0, -.003], [0.55, .0505, .060, 0, 0], [0.75, .047, .0575, 0, .002], [0.9, .036, .044, 0, .003], [0.97, .020, .026, 0, .003], [1, .005, .006, 0, .003]],
    rad: (u, phi) => u > lerp(0.34, 0.60, Math.max(0, -Math.sin(phi))) ? 1.05 : 1, col: () => 0xffffff, region: (u, phi) => u > lerp(0.34, 0.60, Math.max(0, -Math.sin(phi))) ? 2 : 0
  });
  // legs: thigh forward (-Z), shin down, foot
  for (const sd of [1, -1]) {
    const hx = sd * 0.062 * H, tl = 0.43, sl = 0.43;
    addTube(Gb, { p0: new V3(hx, py + 0.005, 0.03), p1: new V3(hx, py + 0.005, -tl), ex: _X, ez: _Y, k, n: 6, seg: 8, tab: [[0, .03, .03, 0, 0], [0.08, .056, .058, 0, -.0], [0.5, .048, .05, 0, 0], [1, .038, .04, 0, 0]], col: () => 0xffffff, region: reg(3) });
    addTube(Gb, { p0: new V3(hx, py + 0.005, -tl), p1: new V3(hx, py - sl, -tl - 0.03), k, n: 6, seg: 8, tab: [[0, .038, .04, 0, 0], [0.2, .037, .042, 0, .004], [0.6, .029, .033, 0, .002], [1, .021, .023, 0, 0]], col: () => 0xffffff, region: reg(3) });
    addTube(Gb, { p0: new V3(hx, py - sl - 0.035, -tl - 0.01), p1: new V3(hx, py - sl - 0.035, -tl - 0.26), ex: _X, ez: _Y, k, n: 3, seg: 8, tab: [[0, .008, .008, 0, .008], [0.15, .024, .03, 0, .03], [0.7, .028, .016, 0, .016], [1, .006, .004, 0, .004]], col: () => 0x2a2a2a, region: reg(4) });
  }
  // arm (origin = shoulder joint, hangs down, forearm tilts forward)
  const ua = 0.30, fa = 0.27, bend = 0.35;
  const ep = new V3(0, -ua, 0), wp = new V3(0, -ua - fa * Math.cos(bend), -fa * Math.sin(bend));
  const uTab = [[0, .020, .020], [0.07, .046, .046], [0.25, .042, .043], [0.6, .034, .036], [0.9, .030, .031], [1, .029, .029]];
  addTube(Ga, { p0: new V3(0, 0.016 * H, 0), p1: ep, k, n: 6, seg: 8, tab: uTab, col: () => 0xffffff, region: (u) => (u < 0.62 ? 1 : 0) });
  addTube(Ga, { p0: ep, p1: wp, k, n: 5, seg: 8, tab: [[0, .030, .031], [0.2, .032, .034], [0.7, .025, .027], [1, .0185, .0185]], col: () => 0xffffff, region: reg(0) });
  const hd = wp.clone().sub(ep).normalize();
  addTube(Ga, { p0: wp.clone().addScaledVector(hd, -0.01), p1: wp.clone().addScaledVector(hd, 0.15), ex: _X, ez: new V3(0, 0, 1).addScaledVector(hd, -hd.z).normalize(), k, n: 4, seg: 8, tab: [[0, .009, .013], [0.3, .010, .0225], [0.65, .008, .0225], [1, .003, .006]], col: () => 0xffffff, region: reg(0) });
  return [finishGeometry(Gb, false), finishGeometry(Ga, false)];
}

function crowdMaterial(sway, uni) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = uni.uTime; sh.uniforms.uExc = uni.uExc;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aRegion; attribute vec3 iSkin; attribute vec3 iShirt; attribute vec3 iHair; attribute vec3 iPants; attribute float iPhase;
        uniform float uTime; uniform float uExc;`)
      .replace('#include <color_vertex>', `#include <color_vertex>
        vec3 rc = aRegion < 0.5 ? iSkin : (aRegion < 1.5 ? iShirt : (aRegion < 2.5 ? iHair : (aRegion < 3.5 ? iPants : vec3(1.0))));
        vColor = color * rc;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        ${sway ? `float hh = max(position.y - 0.12, 0.0);
        float ex = clamp(uExc * 2.0 - 0.3, 0.0, 1.0);
        transformed.x += (sin(uTime * 0.8 + iPhase) * 0.016 + ex * sin(uTime * 9.0 + iPhase * 3.0) * 0.012) * hh;
        transformed.z += sin(uTime * 0.6 + iPhase * 1.7) * 0.012 * hh;
        transformed.y += ex * abs(sin(uTime * 7.0 + iPhase * 2.3)) * 0.07 * step(0.12, position.y);` : ''}`);
  };
  m.customProgramCacheKey = () => 'aq01crowd' + (sway ? 1 : 0);
  return m;
}

const SHIRTS = [0xc0392b, 0x2e6fb5, 0xf1c40f, 0x27ae60, 0xecf0f1, 0x34495e, 0xe67e22, 0x8e44ad, 0x16a085, 0xd35498, 0x7f8c8d, 0x1f2a36, 0xf5b7b1, 0x58d68d];
const PANTS = [0x23303f, 0x3b4a5c, 0x1b1b1f, 0x5a4a3a, 0x7a8a9a, 0x2c3e2f, 0x44464d];

export function makeCrowd(opts = {}) {
  const seats = opts.seats || [], N = seats.length, r = mulberry(opts.seed ?? 11);
  const [gb, ga] = crowdGeometries();
  const uni = { uTime: { value: 0 }, uExc: { value: 0 } };
  const body = new THREE.InstancedMesh(gb, crowdMaterial(true, uni), Math.max(1, N));
  const arms = new THREE.InstancedMesh(ga, crowdMaterial(false, uni), Math.max(1, 2 * N));
  const mk = (n, sz) => new THREE.InstancedBufferAttribute(new Float32Array(n * sz), sz);
  const bA = { iSkin: mk(N, 3), iShirt: mk(N, 3), iHair: mk(N, 3), iPants: mk(N, 3), iPhase: mk(N, 1) };
  const aA = { iSkin: mk(2 * N, 3), iShirt: mk(2 * N, 3), iHair: mk(2 * N, 3), iPants: mk(2 * N, 3), iPhase: mk(2 * N, 1) };
  const base = [], info = [], c = new Col();
  const m = new M4(), qq = new Q(), pos = new V3(), scl = new V3();
  for (let i = 0; i < N; i++) {
    const st = seats[i], sc = 0.86 + 0.16 * r(), phase = r() * 100;
    qq.setFromAxisAngle(_Y, st.rotY || 0); pos.set(st.x, st.y, st.z); scl.setScalar(sc);
    const Mi = new M4().compose(pos, qq, scl); base.push(Mi); body.setMatrixAt(i, Mi);
    const skin = new Col(SKINS[Math.floor(r() * SKINS.length)]), shirt = new Col(SHIRTS[Math.floor(r() * SHIRTS.length)]), hair = new Col(HAIRS[Math.floor(r() * HAIRS.length)]), pants = new Col(PANTS[Math.floor(r() * PANTS.length)]);
    for (const [A, idx] of [[bA, i], [aA, 2 * i], [aA, 2 * i + 1]]) {
      A.iSkin.setXYZ(idx, skin.r, skin.g, skin.b); A.iShirt.setXYZ(idx, shirt.r, shirt.g, shirt.b); A.iHair.setXYZ(idx, hair.r, hair.g, hair.b); A.iPants.setXYZ(idx, pants.r, pants.g, pants.b); A.iPhase.setX(idx, phase);
    }
    info.push({ phase, thresh: 0.15 + 0.85 * r(), e: 0, sc, idle: 0.6 + 0.3 * r() });
  }
  for (const k in bA) gb.setAttribute(k, bA[k]); for (const k in aA) ga.setAttribute(k, aA[k]);
  body.count = N; arms.count = 2 * N; body.frustumCulled = false; arms.frustumCulled = false;
  body.instanceMatrix.needsUpdate = true;
  const group = new THREE.Group(); group.name = 'crowd'; group.add(body, arms);
  let time = 0; const tm = new M4(), rot = new M4(), rot2 = new M4(), tmp = new M4();
  function update(dt, excitement = 0) {
    time += dt; uni.uTime.value = time; uni.uExc.value = excitement;
    for (let i = 0; i < N; i++) {
      const f = info[i], target = excitement > f.thresh ? 1 : 0, k = 1 - Math.exp(-dt * 5);
      f.e += (target - f.e) * k;
      for (let sd = -1; sd <= 1; sd += 2) {
        const left = sd === -1, ph = f.phase + (left ? 1.7 : 0);
        const idleF = f.idle + 0.04 * Math.sin(time * 0.5 + ph), cheerF = 2.85 + 0.35 * Math.sin(time * 7.5 + ph * 2) * (0.5 + excitement * 0.5);
        const flex = lerp(idleF, cheerF, f.e), abd = lerp(0.07, 0.28 + 0.12 * Math.sin(time * 6 + ph), f.e);
        tm.setPosition(sd * 0.19, 0.1 + 0.30 * 1.7, 0);
        rot.makeRotationZ(sd * abd); rot2.makeRotationX(flex);
        tmp.multiplyMatrices(base[i], tm).multiply(rot2).multiply(rot);
        arms.setMatrixAt(2 * i + (left ? 1 : 0), tmp);
      }
    }
    arms.instanceMatrix.needsUpdate = true;
  }
  update(0, 0);
  return { object: group, update, dispose() { gb.dispose(); ga.dispose(); body.dispose(); arms.dispose(); } };
}
