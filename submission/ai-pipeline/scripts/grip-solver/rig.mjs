// The Rocketbox Male_Adult_01 RIGHT hand exactly as agr03.html loadHand()/driveHand() sees it, in node.
// World = the game's hand-root frame (X ulnar, Y back of hand, Z = -(wrist->middle knuckle)), metres, scale 1:
// hand.matrixWorld = compose(0, offH, S_CM) — what driveHand does with handP = 0, handQ = identity, h.scale = 1.
// Skinning = three.js 'attached' skinning with the game's weight renormalisation and triangle filter.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const SP = 'C:/Users/islam/AppData/Local/Temp/claude/286b4c16deb48d99/684824e4-3f75-4671-9b23-5f0f63cc85fe/scratchpad/';
const TH = SP + 'dl_three/node_modules/three/';
export const FBX_PATH = 'c:/book/fp-extinguisher/assets/Male_Adult_01/Male_Adult_01.fbx';
export const D = Math.PI / 180;

export async function loadRig() {
  globalThis.document = globalThis.document || { createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, style: {} }) };
  globalThis.self = globalThis;
  const THREE = await import(pathToFileURL(TH + 'build/three.module.js').href);
  const { FBXLoader } = await import(pathToFileURL(TH + 'examples/jsm/loaders/FBXLoader.js').href);
  const w0 = console.warn; console.warn = () => {};
  const buf = fs.readFileSync(FBX_PATH);
  const fbx = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
  console.warn = w0;
  fbx.updateMatrixWorld(true);
  let mesh = null; fbx.traverse(o => { if (o.isSkinnedMesh && !mesh) mesh = o; });
  const V3 = THREE.Vector3, Q4 = THREE.Quaternion, M4 = THREE.Matrix4;
  const basisQ = (X, Y, Z) => new Q4().setFromRotationMatrix(new M4().makeBasis(X, Y, Z));
  const perp = (v, a) => v.clone().addScaledVector(a, -v.dot(a)).normalize();
  const bones = mesh.skeleton.bones, bi = nm => bones.findIndex(b => b.name === nm);
  const bindW = i => mesh.bindMatrix.clone().multiply(mesh.skeleton.boneInverses[i].clone().invert());
  const posOf = i => new V3().setFromMatrixPosition(bindW(i)).multiplyScalar(.01);
  const qOf = i => { const p = new V3(), q = new Q4(), s = new V3(); bindW(i).decompose(p, q, s); return q; };
  // ---- the game's loadHand, both sides (for the weight renormalisation), keep R ----
  const driven = new Set(), armSet = new Set(), S = {};
  for (const [key, side] of [['R', 1], ['L', -1]]) {
    const n = x => `Bip01_${key}_${x}`;
    const iU = bi(n('UpperArm')), iF = bi(n('Forearm')), iH = bi(n('Hand'));
    const digits = [0, 1, 2, 3, 4].map(d => [n('Finger' + d), n('Finger' + d + '1'), n('Finger' + d + '2')].map(bi));
    [iU, iF, iH, ...digits.flat()].forEach(i => driven.add(i));
    [iF, iH, ...digits.flat()].forEach(i => armSet.add(i));
    const pU = posOf(iU), pF = posOf(iF), pH = posOf(iH);
    const f = posOf(digits[2][0]).sub(pH).normalize(), thumbward = posOf(digits[1][0]).sub(posOf(digits[4][0])).normalize();
    const Z = f.clone().negate(), X = perp(side > 0 ? thumbward.clone().negate() : thumbward.clone(), Z), Y = new V3().crossVectors(Z, X).normalize();
    const frameH = basisQ(X, Y, Z);
    const dF = pH.clone().sub(pF).normalize(), Xf = perp(X, dF), Zf = dF.clone().negate(), Yf = new V3().crossVectors(Zf, Xf);
    const dU = pF.clone().sub(pU).normalize(), Xu = perp(Xf, dU), Zu = dU.clone().negate(), Yu = new V3().crossVectors(Zu, Xu);
    const off = (frame, i) => frame.clone().invert().multiply(qOf(i));
    S[key] = { side, iU, iF, iH, digits, upper: bones[iU], fore: bones[iF], hand: bones[iH], offH: off(frameH, iH), offF: off(basisQ(Xf, Yf, Zf), iF),
      offU: off(basisQ(Xu, Yu, Zu), iU), frameH, pH, L1: pU.distanceTo(pF), L2: pF.distanceTo(pH) };
    for (const b of [bones[iU], bones[iF], bones[iH]]) { b.matrixWorldAutoUpdate = false; b.matrixAutoUpdate = false; }
  }
  const R = S.R, hand = R.hand, digits = R.digits;
  const J = digits.map(ids => ids.map(id => ({ id, bone: bones[id], rest: bones[id].quaternion.clone() })));
  const g = mesh.geometry, pos = g.attributes.position, nrmA = g.attributes.normal, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, nV = pos.count;
  const mats = [].concat(mesh.material), bodyMat = mats.findIndex(m => /body/i.test(m.name));
  const armW = new Float32Array(nV), W = new Float32Array(nV * 4), I = new Int32Array(nV * 4);
  for (let v = 0; v < nV; v++) {
    let a = 0, d = 0; const w = [sw.getX(v), sw.getY(v), sw.getZ(v), sw.getW(v)], ix = [si.getX(v), si.getY(v), si.getZ(v), si.getW(v)];
    for (let k = 0; k < 4; k++) { if (armSet.has(ix[k])) a += w[k]; if (driven.has(ix[k])) d += w[k]; else w[k] = 0; }
    armW[v] = a;
    for (let k = 0; k < 4; k++) { W[v * 4 + k] = d > 0 ? w[k] / d : w[k]; I[v * 4 + k] = ix[k]; }
  }
  const triMat = t => { for (const gr of g.groups) if (t * 3 >= gr.start && t * 3 < gr.start + gr.count) return gr.materialIndex; return 0; };
  const Rset = new Set([R.iF, R.iH, ...digits.flat()]), Rall = new Set([R.iU, ...Rset]);
  const domOf = v => { let b = -1, bw = -1; for (let k = 0; k < 4; k++) if (W[v * 4 + k] > bw) { bw = W[v * 4 + k]; b = I[v * 4 + k]; } return b; };
  const tris = [];                                           // [a, b, c] vertex ids of the kept right-arm triangles
  const nT = nV / 3;
  for (let t = 0; t < nT; t++) {
    if (g.groups.length && bodyMat >= 0 && triMat(t) !== bodyMat) continue;
    const a = t * 3, b = a + 1, c = a + 2;
    if (!(armW[a] > .35 && armW[b] > .35 && armW[c] > .35)) continue;
    if (![a, b, c].every(v => Rall.has(domOf(v)))) continue;
    tris.push(a, b, c);
  }
  // compact vertex list
  const vmap = new Map(), vlist = [];
  for (const v of tris) if (!vmap.has(v)) { vmap.set(v, vlist.length); vlist.push(v); }
  const NV = vlist.length, NT = tris.length / 3;
  const T3 = new Int32Array(tris.length); for (let i = 0; i < tris.length; i++) T3[i] = vmap.get(tris[i]);
  const P0 = new Float64Array(NV * 3), N0 = new Float64Array(NV * 3), VW = new Float64Array(NV * 4), VI = new Int32Array(NV * 4), VD = new Int32Array(NV);
  vlist.forEach((v, i) => {
    P0[i * 3] = pos.getX(v); P0[i * 3 + 1] = pos.getY(v); P0[i * 3 + 2] = pos.getZ(v);
    N0[i * 3] = nrmA.getX(v); N0[i * 3 + 1] = nrmA.getY(v); N0[i * 3 + 2] = nrmA.getZ(v);
    for (let k = 0; k < 4; k++) { VW[i * 4 + k] = W[v * 4 + k]; VI[i * 4 + k] = I[v * 4 + k]; }
    VD[i] = domOf(v);
  });
  // triangle owner = the bone with the most total weight over its 3 vertices
  const TB = new Int32Array(NT);
  for (let t = 0; t < NT; t++) {
    const acc = new Map();
    for (let c = 0; c < 3; c++) { const i = T3[t * 3 + c]; for (let k = 0; k < 4; k++) { const w = VW[i * 4 + k]; if (w > 0) acc.set(VI[i * 4 + k], (acc.get(VI[i * 4 + k]) || 0) + w); } }
    let b = -1, bw = -1; for (const [k, w] of acc) if (w > bw) { bw = w; b = k; } TB[t] = b;
  }
  // bind-pose bone-local coordinates (cm) of each vertex for its owner bone, and of each triangle centroid for the triangle owner
  const localOf = (i, boneIdx) => new V3(P0[i * 3], P0[i * 3 + 1], P0[i * 3 + 2]).applyMatrix4(mesh.bindMatrix).applyMatrix4(mesh.skeleton.boneInverses[boneIdx]);
  const TL = new Float64Array(NT * 3);
  for (let t = 0; t < NT; t++) { const c = new V3(); for (let k = 0; k < 3; k++) c.add(localOf(T3[t * 3 + k], TB[t])); c.multiplyScalar(1 / 3); TL[t * 3] = c.x; TL[t * 3 + 1] = c.y; TL[t * 3 + 2] = c.z; }
  // ---- posing ----
  const AX = new V3(1, 0, 0), AY = new V3(0, 1, 0), AZ = new V3(0, 0, 1), qa = new Q4(), qb = new Q4(), qc = new Q4();
  const offHi = R.offH.clone().invert(), inParent = v => v.clone().applyQuaternion(offHi);
  const AXP_Y = inParent(new V3(0, 1, 0)), AXP_mZ = inParent(new V3(0, 0, -1));
  const setRoot = () => {
    hand.matrixWorld.compose(new V3(), R.offH, new V3(.01, .01, .01));
    const elbow = new V3(0, 0, R.L2);                         // straight wrist: forearm along +Z (frame = identity)
    R.fore.matrixWorld.compose(elbow, R.offF.clone(), new V3(.01, .01, .01));
    R.upper.matrixWorld.compose(new V3(0, 0, R.L2 + R.L1), R.offU.clone(), new V3(.01, .01, .01));
  };
  setRoot();
  const update = () => { for (const c of hand.children) c.updateMatrixWorld(true); };
  for (const d of [0, 1, 2, 3, 4]) for (const j of J[d]) j.bone.quaternion.copy(j.rest);
  update();
  const Wp = b => new V3().setFromMatrixPosition(b.matrixWorld);
  const restFlex = digits.map((ids, d) => ids.map((id, k) => {
    const b = bones[id], lz = new V3(0, 0, 1).transformDirection(b.matrixWorld), lx = new V3(1, 0, 0).transformDirection(b.matrixWorld);
    const parentDir = k === 0 ? Wp(b).sub(Wp(hand)).normalize() : new V3(1, 0, 0).transformDirection(bones[ids[k - 1]].matrixWorld);
    const a = perp(parentDir, lz), c = perp(lx, lz); return Math.atan2(new V3().crossVectors(a, c).dot(lz), a.dot(c)) / D;
  }));
  // pose: { th: {opp, palm, pron, mcp, ip, mcpAbd}, f: [null, {mcp,pip,dip,abd,roll}, ...] }  angles in degrees;
  // fingers: TOTAL anatomical flexion (rest + added) about each bone's own +Z; thumb CMC: added rotations (opp about hand +Y,
  // palm about hand -Z, both premultiplied in the hand-bone space, pron about the metacarpal's own X); thumb MCP / IP: TOTAL flexion about +Z.
  function setJoint(j, flexAdded, abd = 0, roll = 0) {
    j.bone.quaternion.copy(j.rest).multiply(qa.setFromAxisAngle(AY, abd * D)).multiply(qb.setFromAxisAngle(AZ, flexAdded * D)).multiply(qc.setFromAxisAngle(AX, roll * D));
  }
  function applyPose(P) {
    for (const d of [1, 2, 3, 4]) {
      const f = P.f[d];
      setJoint(J[d][0], f.mcp - restFlex[d][0], f.abd || 0, f.roll || 0);
      setJoint(J[d][1], f.pip - restFlex[d][1], 0, f.roll1 || 0);
      setJoint(J[d][2], f.dip - restFlex[d][2]);
    }
    const t = P.th, j0 = J[0][0];
    j0.bone.quaternion.copy(j0.rest).multiply(qc.setFromAxisAngle(AX, (t.pron || 0) * D));
    j0.bone.quaternion.premultiply(qa.setFromAxisAngle(AXP_mZ, (t.palm || 0) * D)).premultiply(qb.setFromAxisAngle(AXP_Y, (t.opp || 0) * D));
    setJoint(J[0][1], t.mcp - restFlex[0][1], t.mcpAbd || 0, t.mcpRoll || 0);
    setJoint(J[0][2], t.ip - restFlex[0][2]);
    update();
  }
  // ---- skinning (three.js attached mode: world = sum w * bone.matrixWorld * boneInverse * bindMatrix * v) ----
  const usedBones = [...new Set(Array.from(VI))].filter(b => b >= 0);
  const BM = new Map(); for (const b of usedBones) BM.set(b, new Float64Array(16));
  const tmpM = new M4();
  const PW = new Float64Array(NV * 3), NW = new Float64Array(NV * 3);
  function skin() {
    for (const b of usedBones) { tmpM.copy(bones[b].matrixWorld).multiply(mesh.skeleton.boneInverses[b]).multiply(mesh.bindMatrix); BM.get(b).set(tmpM.elements); }
    for (let i = 0; i < NV; i++) {
      const x = P0[i * 3], y = P0[i * 3 + 1], z = P0[i * 3 + 2], nx = N0[i * 3], ny = N0[i * 3 + 1], nz = N0[i * 3 + 2];
      let ox = 0, oy = 0, oz = 0, mx = 0, my = 0, mz = 0;
      for (let k = 0; k < 4; k++) {
        const w = VW[i * 4 + k]; if (!(w > 0)) continue; const e = BM.get(VI[i * 4 + k]);
        ox += w * (e[0] * x + e[4] * y + e[8] * z + e[12]); oy += w * (e[1] * x + e[5] * y + e[9] * z + e[13]); oz += w * (e[2] * x + e[6] * y + e[10] * z + e[14]);
        mx += w * (e[0] * nx + e[4] * ny + e[8] * nz); my += w * (e[1] * nx + e[5] * ny + e[9] * nz); mz += w * (e[2] * nx + e[6] * ny + e[10] * nz);
      }
      PW[i * 3] = ox; PW[i * 3 + 1] = oy; PW[i * 3 + 2] = oz;
      const l = Math.hypot(mx, my, mz) || 1; NW[i * 3] = mx / l; NW[i * 3 + 1] = my / l; NW[i * 3 + 2] = mz / l;
    }
    return PW;
  }
  const boneName = b => bones[b].name.replace('Bip01_R_', '');
  const digitOfBone = new Map(); digits.forEach((ids, d) => ids.forEach((id, k) => digitOfBone.set(id, { d, k })));
  // world landmark from bone-local cm
  const lm = (boneIdx, p) => new V3(...p).applyMatrix4(bones[boneIdx].matrixWorld);
  const dirW = (boneIdx, v) => new V3(...v).transformDirection(bones[boneIdx].matrixWorld);
  return { THREE, V3, Q4, M4, basisQ, perp, mesh, bones, R, hand, digits, J, restFlex, applyPose, update, skin, PW, NW, NV, NT, T3, TB, TL, VD, VW, VI,
    boneName, digitOfBone, lm, dirW, Wp, setJoint, offH: R.offH, offF: R.offF, AXP_Y, AXP_mZ };
}

// ---------- exact geometry (plain arrays, metres) ----------
// closest point on triangle abc to p (Ericson 5.1.5); writes into out, returns squared distance
export function ptTri(px, py, pz, ax, ay, az, bx, by, bz, cx, cy, cz, out) {
  const abx = bx - ax, aby = by - ay, abz = bz - az, acx = cx - ax, acy = cy - ay, acz = cz - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
  let qx, qy, qz;
  if (d1 <= 0 && d2 <= 0) { qx = ax; qy = ay; qz = az; }
  else {
    const bpx = px - bx, bpy = py - by, bpz = pz - bz;
    const d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
    if (d3 >= 0 && d4 <= d3) { qx = bx; qy = by; qz = bz; }
    else {
      const vc = d1 * d4 - d3 * d2;
      if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); qx = ax + v * abx; qy = ay + v * aby; qz = az + v * abz; }
      else {
        const cpx = px - cx, cpy = py - cy, cpz = pz - cz;
        const d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
        if (d6 >= 0 && d5 <= d6) { qx = cx; qy = cy; qz = cz; }
        else {
          const vb = d5 * d2 - d1 * d6;
          if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); qx = ax + w * acx; qy = ay + w * acy; qz = az + w * acz; }
          else {
            const va = d3 * d6 - d5 * d4;
            if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); qx = bx + w * (cx - bx); qy = by + w * (cy - by); qz = bz + w * (cz - bz); }
            else { const den = 1 / (va + vb + vc), v = vb * den, w = vc * den; qx = ax + abx * v + acx * w; qy = ay + aby * v + acy * w; qz = az + abz * v + acz * w; }
          }
        }
      }
    }
  }
  out[0] = qx; out[1] = qy; out[2] = qz;
  return (px - qx) ** 2 + (py - qy) ** 2 + (pz - qz) ** 2;
}
// closest points between segments p1q1 and p2q2 (Ericson 5.1.9); out = [s, t, c1x,c1y,c1z, c2x,c2y,c2z]; returns squared distance
export function segSeg(p1x, p1y, p1z, q1x, q1y, q1z, p2x, p2y, p2z, q2x, q2y, q2z, out) {
  const d1x = q1x - p1x, d1y = q1y - p1y, d1z = q1z - p1z, d2x = q2x - p2x, d2y = q2y - p2y, d2z = q2z - p2z;
  const rx = p1x - p2x, ry = p1y - p2y, rz = p1z - p2z;
  const a = d1x * d1x + d1y * d1y + d1z * d1z, e = d2x * d2x + d2y * d2y + d2z * d2z, f = d2x * rx + d2y * ry + d2z * rz;
  let s, t; const EPS = 1e-14;
  if (a <= EPS && e <= EPS) { s = t = 0; }
  else if (a <= EPS) { s = 0; t = Math.min(1, Math.max(0, f / e)); }
  else {
    const c = d1x * rx + d1y * ry + d1z * rz;
    if (e <= EPS) { t = 0; s = Math.min(1, Math.max(0, -c / a)); }
    else {
      const b = d1x * d2x + d1y * d2y + d1z * d2z, den = a * e - b * b;
      s = den !== 0 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)); } else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (b - c) / a)); }
    }
  }
  const c1x = p1x + d1x * s, c1y = p1y + d1y * s, c1z = p1z + d1z * s, c2x = p2x + d2x * t, c2y = p2y + d2y * t, c2z = p2z + d2z * t;
  out[0] = s; out[1] = t; out[2] = c1x; out[3] = c1y; out[4] = c1z; out[5] = c2x; out[6] = c2y; out[7] = c2z;
  return (c1x - c2x) ** 2 + (c1y - c2y) ** 2 + (c1z - c2z) ** 2;
}
