// The tripod-grip model: parameter vector <-> pose + pen, the cost (contacts, clearances, anatomy), and a full report.
import { loadRig, D } from './rig.mjs';
import { makeEval, PEN, rAt, paperScan } from './evalgrip.mjs';

export const NAMES = ['th.opp', 'th.palm', 'th.pron', 'th.mcp', 'th.ip', 'th.mcpAbd',
  'i.mcp', 'i.pip', 'i.dip', 'i.abd', 'i.roll', 'm.mcp', 'm.pip', 'm.dip', 'm.abd', 'm.roll',
  'r.mcp', 'r.pip', 'r.dip', 'r.abd', 'l.mcp', 'l.pip', 'l.dip', 'l.abd', 'T.x', 'T.y', 'T.z', 'pen.theta', 'pen.phi'];
// anatomical guide ranges, TOTAL flexion (deg)
export const RANGES = {
  'th.mcp': [10, 25], 'th.ip': [10, 20], 'th.mcpAbd': [-10, 10], 'th.opp': [-45, 45], 'th.palm': [-45, 45], 'th.pron': [-45, 45],
  'i.mcp': [20, 45], 'i.pip': [50, 100], 'i.dip': [10, 25], 'i.abd': [-10, 8], 'i.roll': [-15, 15],
  'm.mcp': [25, 45], 'm.pip': [40, 70], 'm.dip': [10, 25], 'm.abd': [-8, 10], 'm.roll': [-15, 15],
  'r.mcp': [40, 60], 'r.pip': [60, 100], 'r.dip': [10, 60], 'r.abd': [-6, 10],
  'l.mcp': [40, 60], 'l.pip': [60, 100], 'l.dip': [10, 60], 'l.abd': [-6, 15],
};

export async function makeModel(opts = {}) {
  const rig = await loadRig();
  const ev = makeEval(rig);
  const { V3, digits, bones, NV, VD, PW, R } = rig;
  const W = Object.assign({ jointW: .3, thetaLo: 45, thetaHi: 60, footI: 25, tFoot: [5, 14], mFoot: [-7, 0], webMax: 2.5, gap: [.1, .5], facingW: 80, paperW: 1, alt: 55, tipLift: 4, axW: .05, wristLo: -.1, wristHi: .45, wristW: 200, tipZone: 14, foldW: 0, foldMax: 4, thTipW: 0, thTipAbove: 0,
    ax: { th2: [35, 70], i2: [30, 60], m2: [25, 60] } }, opts);
  // ---- capsules inside each phalanx (bind-pose bone-local cm), for finger-vs-finger interpenetration ----
  const caps = [];
  digits.forEach((ids, d) => ids.forEach((id, k) => caps.push({ d, k, id })));
  const capFit = [];
  {
    // reconstruct each owned vertex's bone-local position from the rest skinning: local = inverse(bone.matrixWorld) * world(rest)
    rig.applyPose(restPose(rig)); rig.skin();
    for (const c of caps) {
      const inv = bones[c.id].matrixWorld.clone().invert(), pts = [];
      for (let i = 0; i < NV; i++) if (VD[i] === c.id) pts.push(new V3(PW[i * 3], PW[i * 3 + 1], PW[i * 3 + 2]).applyMatrix4(inv));
      const xs = pts.map(p => p.x).sort((a, b) => a - b), q = f => xs[Math.min(xs.length - 1, Math.max(0, Math.round(f * (xs.length - 1))))];
      const x0 = q(.12), x1 = q(.88), mid = pts.filter(p => p.x > x0 && p.x < x1);
      const yc = mid.reduce((a, p) => a + p.y, 0) / mid.length, zc = mid.reduce((a, p) => a + p.z, 0) / mid.length;
      const rr = mid.map(p => Math.hypot(p.y - yc, p.z - zc)).sort((a, b) => a - b), rc = rr[Math.floor(rr.length * .2)] * .85;
      capFit.push({ ...c, a: [x0, yc, zc], b: [x1, yc, zc], rc, n: pts.length });
    }
  }
  const digitVerts = [0, 1, 2, 3, 4].map(d => { const s = new Set(digits[d]); const a = []; for (let i = 0; i < NV; i++) if (s.has(VD[i])) a.push(i); return Int32Array.from(a); });
  const handVerts = [], seenPos = new Set();      // unique positions only (the geometry is non-indexed)
  rig.skin();
  for (let i = 0; i < NV; i++) { if (!(VD[i] === R.iH || digits.flat().includes(VD[i]))) continue; const key = [0, 1, 2].map(k => Math.round(PW[i * 3 + k] * 1e5)).join(','); if (seenPos.has(key)) continue; seenPos.add(key); handVerts.push(i); }
  const handMask = new Uint8Array(NV); for (const i of handVerts) handMask[i] = 1;
  // ulnar rest set: ring + little phalanges and the ulnar edge of the hand bone (bind x > 25 mm)
  rig.applyPose(restPose(rig)); rig.skin();
  // the thumb-index web fold: the two skin vertices at the crotch of the first web space (rest pose, hand frame mm)
  const nearestV = (x, y, z) => { let b = -1, bd = 1e9; for (let i = 0; i < NV; i++) { const d = (PW[i * 3] * 1e3 - x) ** 2 + (PW[i * 3 + 1] * 1e3 - y) ** 2 + (PW[i * 3 + 2] * 1e3 - z) ** 2; if (d < bd) { bd = d; b = i; } } return b; };
  const foldV = [nearestV(-30.1, -20.3, -69.7), nearestV(-36.6, -11.4, -69.2)];
  const foldPt = () => new V3((PW[foldV[0] * 3] + PW[foldV[1] * 3]) / 2, (PW[foldV[0] * 3 + 1] + PW[foldV[1] * 3 + 1]) / 2, (PW[foldV[0] * 3 + 2] + PW[foldV[1] * 3 + 2]) / 2);
  const ulnarMask = new Uint8Array(NV);
  const tipMask = new Uint8Array(NV);
  for (let i = 0; i < NV; i++) {
    const b = VD[i];
    if ([digits[3][0], digits[3][1], digits[4][0], digits[4][1]].includes(b) || (b === R.iH && PW[i * 3] > .025)) ulnarMask[i] = 1;
    if ([digits[2][2], digits[3][2], digits[4][2]].includes(b)) tipMask[i] = 1;          // middle / ring / little distal phalanges
  }
  const _A = new V3(), _B = new V3();
  function capsulePen() {     // sum of squared penetrations (mm^2) of digit vertices into other digits' capsules (beyond tol), and the worst
    let sum = 0, worst = 0, pair = '';
    for (const s of capFit) {
      const m = bones[s.id].matrixWorld; _A.set(...s.a).applyMatrix4(m); _B.set(...s.b).applyMatrix4(m);
      const r = s.rc * .01, abx = _B.x - _A.x, aby = _B.y - _A.y, abz = _B.z - _A.z, L2 = abx * abx + aby * aby + abz * abz;
      const cx = (_A.x + _B.x) / 2, cy = (_A.y + _B.y) / 2, cz = (_A.z + _B.z) / 2, Rb = Math.sqrt(L2) / 2 + r, Rb2 = Rb * Rb;
      for (let d = 0; d < 5; d++) {
        if (d === s.d) continue;
        if (s.k === 0 && s.d === 0 && d === 1) continue;                  // thumb metacarpal vs index: the web, skip
        const vs = digitVerts[d];
        for (let n = 0; n < vs.length; n++) {
          const i = vs[n], vx = PW[i * 3], vy = PW[i * 3 + 1], vz = PW[i * 3 + 2];
          if ((vx - cx) ** 2 + (vy - cy) ** 2 + (vz - cz) ** 2 > Rb2) continue;
          const px = vx - _A.x, py = vy - _A.y, pz = vz - _A.z;
          let t = (px * abx + py * aby + pz * abz) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
          const dist = Math.hypot(px - abx * t, py - aby * t, pz - abz * t), pen = (r - dist) * 1000 - .6;
          if (pen > 0) { sum += pen * pen; if (pen > worst) { worst = pen; pair = `${'TIMRL'[d]} into ${'TIMRL'[s.d]}${s.k}`; } }
        }
      }
    }
    return { sum, worst, pair };
  }
  const decode = x => {
    const P = { th: { opp: x[0], palm: x[1], pron: x[2], mcp: x[3], ip: x[4], mcpAbd: x[5] },
      f: [null, { mcp: x[6], pip: x[7], dip: x[8], abd: x[9], roll: x[10] }, { mcp: x[11], pip: x[12], dip: x[13], abd: x[14], roll: x[15] },
        { mcp: x[16], pip: x[17], dip: x[18], abd: x[19] }, { mcp: x[20], pip: x[21], dip: x[22], abd: x[23] }] };
    const T = new V3(x[24], x[25], x[26]).multiplyScalar(1e-3), th = x[27] * D, ph = x[28] * D;
    const u = new V3(Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th));
    return { P, T, u };
  };
  const flat = (v, lo, hi) => v < lo ? lo - v : v > hi ? v - hi : 0;
  const dirTo = (q, T, u) => { const s = q.clone().sub(T).dot(u), foot = T.clone().addScaledVector(u, s); return { s, foot, n: foot.sub(q).normalize() }; };
  function cost(x, detail = false, extra = {}) {
    const { P, T, u } = decode(x);
    rig.applyPose(P); rig.skin(); ev.penPass(T, u, 30);
    let c = 0; const terms = {};
    const add = (k, v) => { c += v; if (detail) terms[k] = (terms[k] || 0) + v; };
    const TC = ev.TC, TT = ev.TT;
    const z = { I: ev.minOf(ev.Z.indexPad), T: ev.minOf(ev.Z.thumbPad), M: ev.minOf(ev.Z.midSide) };
    const gapPen = g => { if (!isFinite(g)) return 5e3; g *= 1000; return g < W.gap[0] ? (W.gap[0] - g) ** 2 * (g < 0 ? 400 : 60) : g > W.gap[1] ? (g - W.gap[1]) ** 2 * 60 : 0; };
    add('gapI', gapPen(z.I.m)); add('gapT', gapPen(z.T.m)); add('gapM', gapPen(z.M.m));
    const fI = z.I.at >= 0 ? TT[z.I.at] * 1000 : 0, fT = z.T.at >= 0 ? TT[z.T.at] * 1000 : 0, fM = z.M.at >= 0 ? TT[z.M.at] * 1000 : 0;
    add('footI', 1.5 * flat(fI, W.footI - 1, W.footI + 1) ** 2);
    add('footT', 1 * flat(fT - fI, W.tFoot[0], W.tFoot[1]) ** 2);
    add('footM', 1 * flat(fM - fI, W.mFoot[0], W.mFoot[1]) ** 2);
    // every skin triangle outside the pen; the tip region free; ring/little away from the pen
    const ringLittle = new Set([...digits[3], ...digits[4]]), midSet = new Set(digits[2]);
    for (let t = 0; t < rig.NT; t++) {
      const cm = TC[t] * 1000; if (!isFinite(cm)) continue;
      if (cm < .1) add('pen', 300 * (.1 - cm) ** 2);
      const tt = TT[t] * 1000;
      if (tt < W.tipZone && cm < 2.1) add('tipFree', 30 * (2.1 - cm) ** 2);
      else if (tt < fI - 3 && !midSet.has(rig.TB[t]) && cm < 1.5) add('lowFree', 10 * (1.5 - cm) ** 2);
      if (ringLittle.has(rig.TB[t]) && cm < 3) add('rlFree', 10 * (3 - cm) ** 2);
    }
    // the shaft rests in the web (radial side of the index proximal phalanx / thumb-index web), above the pads
    const wz = ev.minOf(ev.Z.web, t => TT[t] * 1000 > fI + 8);
    const gw = isFinite(wz.m) ? wz.m * 1000 : 30;
    add('web', 8 * Math.max(0, gw - W.webMax) ** 2);
    // ... and passes the web fold closely, on its dorsal side
    {
      const F = foldPt(), dF = F.clone().sub(T), sF = dF.dot(u), foot = T.clone().addScaledVector(u, sF), off = foot.clone().sub(F);
      const dist = off.length() * 1000 - PEN.r * 1000, dorsal = off.y * 1000;
      add('fold', W.foldW * (Math.max(0, dist - W.foldMax) ** 2 + Math.max(0, -dorsal - 1) ** 2));
      if (detail) Object.assign(extra, { foldDist: dist, foldDorsal: dorsal, foldAlong: sF * 1000, fold: F });
    }
    // pen to forearm axis (+Z of the hand frame)
    const theta = Math.acos(Math.max(-1, Math.min(1, u.z))) / D;
    add('theta', 3 * flat(theta, W.thetaLo, W.thetaHi) ** 2);
    // anatomy: total angles inside the guide ranges, CMC mild regularisation
    x.slice(0, 24).forEach((v, i) => { const r = (W.ranges && W.ranges[NAMES[i]]) || RANGES[NAMES[i]]; if (r) add('joints', (W.jointWs && W.jointWs[NAMES[i]] || W.jointW) * flat(v, r[0], r[1]) ** 2); });
    add('cmcReg', .004 * (x[0] ** 2 + x[1] ** 2 + x[2] ** 2));
    // pads face the pen; the middle finger offers its radial side
    if (z.I.at >= 0 && z.T.at >= 0 && z.M.at >= 0) {
      const qI = ev.ptOf(z.I.at), qT = ev.ptOf(z.T.at), qM = ev.ptOf(z.M.at);
      const nI = rig.dirW(digits[1][2], [0, 1, 0]).normalize(), nT = rig.dirW(digits[0][2], [0, 1, 0]).normalize(), nM = rig.dirW(digits[2][2], [0, .25, 1]).normalize();
      const dI = dirTo(qI, T, u), dT = dirTo(qT, T, u), dM = dirTo(qM, T, u);
      const fcI = nI.dot(dI.n), fcT = nT.dot(dT.n), fcM = nM.dot(dM.n);
      add('facing', W.facingW * (Math.max(0, .75 - fcI) ** 2 + Math.max(0, .75 - fcT) ** 2 + .75 * Math.max(0, .55 - fcM) ** 2));
      // spread around the pen (angles between the contact directions, seen down the pen)
      const aI = dI.n.clone().negate(), aT = dT.n.clone().negate(), aM = dM.n.clone().negate();
      const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1, a.dot(b)))) / D;
      const tI = ang(aT, aI), mI = ang(aM, aI), mT = ang(aM, aT);
      add('spread', .05 * (flat(tI, 95, 165) ** 2 + flat(mI, 95, 160) ** 2 + flat(mT, 80, 160) ** 2));
      if (detail) Object.assign(extra, { qI, qT, qM, fcI, fcT, fcM, tI, mI, mT });
    }
    // how each distal phalanx crosses the pen (angle between the phalanx, base -> tip, and the pen, top -> tip)
    {
      const dn = u.clone().negate(), axA = (d, k) => Math.acos(Math.max(-1, Math.min(1, rig.dirW(digits[d][k], [1, 0, 0]).normalize().dot(dn)))) / D;
      const a0 = axA(0, 2), a1 = axA(1, 2), a2 = axA(2, 2);
      add('crossing', W.axW * (flat(a0, ...W.ax.th2) ** 2 + flat(a1, ...W.ax.i2) ** 2 + flat(a2, ...W.ax.m2) ** 2));
      // the thumb tip stays above the index pad along the pen (it does not reach down toward the point)
      const thTip = rig.lm(digits[0][2], [2.66, -.14, -.02]), sTh = thTip.clone().sub(T).dot(u) * 1000;
      add('thumbTip', W.thTipW * Math.max(0, fI + W.thTipAbove - sTh) ** 2);
      if (detail) Object.assign(extra, { axTh: a0, axI: a1, axM: a2, sThTip: sTh });
    }
    const cp = capsulePen();
    add('fingers', 20 * cp.sum);
    if (W.paperW > 0) {                    // the hand rests on the paper on its ulnar side at alt 55
      const pr = paperRest(T, u, W.alt);
      add('paper', W.paperW * pr.cost);
      if (detail) extra.paperRes = pr;
    }
    if (detail) Object.assign(extra, { terms, z, fI, fT, fM, gw, wz, theta, cp, T, u });
    return c;
  }
  // the paper plane through the tip at altitude alt that touches the hand: N(phi) = sin(alt) u + cos(alt) (cos phi e1 + sin phi e2).
  // A resting hand = a roll phi where the lowest skin point is exactly on the paper (a zero of mAll(phi)). Of the two zeros, the
  // one with the radial side up (smallest N.x) is the hand lying on its little-finger side. Cost: the ulnar set (ring / little /
  // hypothenar) must be what touches there (mU = 0), and the hand must be turned like a writer's (radial side and back of the hand up).
  const _N = new V3(), _e1 = new V3(), _e2 = new V3();
  function heights(T, u, alt, ph) {
    const sa = Math.sin(alt * D), ca = Math.cos(alt * D);
    _N.copy(u).multiplyScalar(sa).addScaledVector(_e1, ca * Math.cos(ph * D)).addScaledVector(_e2, ca * Math.sin(ph * D));
    let mAll = Infinity, iAll = -1, mU = Infinity, iU = -1, mTip = Infinity;
    for (let n = 0; n < handVerts.length; n++) {
      const i = handVerts[n], h = (PW[i * 3] - T.x) * _N.x + (PW[i * 3 + 1] - T.y) * _N.y + (PW[i * 3 + 2] - T.z) * _N.z;
      if (h < mAll) { mAll = h; iAll = i; }
      if (ulnarMask[i] && h < mU) { mU = h; iU = i; }
      if (tipMask[i] && h < mTip) mTip = h;
    }
    return { ph, N: _N.clone(), mAll, iAll, mU, iU, mTip };
  }
  function paperRest(T, u, alt = 55, step = 5) {
    _e1.set(0, 1, 0); if (Math.abs(u.y) > .9) _e1.set(1, 0, 0); _e1.addScaledVector(u, -_e1.dot(u)).normalize(); _e2.crossVectors(u, _e1);
    const scan = []; for (let ph = 0; ph < 360; ph += step) scan.push(heights(T, u, alt, ph));
    const zeros = [];
    for (let k = 0; k < scan.length; k++) {
      const a = scan[k], b = scan[(k + 1) % scan.length];
      if ((a.mAll > 0) === (b.mAll > 0)) continue;
      let lo = a.ph, hi = a.ph + step, flo = a.mAll;
      for (let it = 0; it < 10; it++) { const m = (lo + hi) / 2, r = heights(T, u, alt, m); if ((r.mAll > 0) === (flo > 0)) { lo = m; flo = r.mAll; } else hi = m; }
      zeros.push(heights(T, u, alt, (lo + hi) / 2));
    }
    const maxAll = Math.max(...scan.map(r => r.mAll)), minAll = Math.min(...scan.map(r => r.mAll));
    if (!zeros.length) {         // never touches (floats at every roll) or always cuts through
      const r = maxAll < 0 ? scan.reduce((p, q) => q.mAll > p.mAll ? q : p) : scan.reduce((p, q) => q.mAll < p.mAll ? q : p);
      return { ...r, none: true, depth: Math.abs(r.mAll) * 1000, cost: 400 + (Math.abs(r.mAll) * 1000) ** 2, maxAll, minAll };
    }
    zeros.sort((p, q) => p.N.x - q.N.x);
    const z = zeros[0], depth = (z.mU - z.mAll) * 1000;          // mm the ulnar set floats above the paper when something else touches
    const radialUp = -z.N.x, backUp = z.N.y, wristUp = z.N.z;
    const nat = 60 * Math.max(0, .35 - radialUp) ** 2 + 60 * Math.max(0, radialUp - .85) ** 2 + 60 * Math.max(0, .45 - backUp) ** 2 + W.wristW * Math.max(0, W.wristLo - wristUp) ** 2 + W.wristW * Math.max(0, wristUp - W.wristHi) ** 2;
    const tipLift = z.mTip * 1000, tipC = 10 * Math.max(0, W.tipLift - tipLift) ** 2;
    return { ...z, depth, radialUp, backUp, wristUp, dorsalUp: backUp, tipLift, zeros: zeros.length, cost: depth ** 2 + nat + tipC, nat, maxAll, minAll };
  }
  function restPose(rig) {
    const rf = rig.restFlex;
    return { th: { opp: 0, palm: 0, pron: 0, mcp: rf[0][1], ip: rf[0][2], mcpAbd: 0 }, f: [null, ...[1, 2, 3, 4].map(d => ({ mcp: rf[d][0], pip: rf[d][1], dip: rf[d][2], abd: 0, roll: 0 }))] };
  }
  return { rig, ev, decode, cost, capsulePen, capFit, paperRest, handMask, ulnarMask, tipMask, digitVerts, W, foldPt, foldV };
}
