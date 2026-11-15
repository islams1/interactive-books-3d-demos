// Grip evaluation on the skinned right hand: exact pen-axis <-> skin-triangle clearances, contact gaps, joint angles, paper rest.
import { segSeg, ptTri, D } from './rig.mjs';
export const PEN = { L: .14, r: .0043, cone: .014, rTip: .0007 };
export const rAt = t => t >= PEN.cone ? PEN.r : t <= 0 ? PEN.rTip : PEN.rTip + (PEN.r - PEN.rTip) * t / PEN.cone;

export function makeEval(rig) {
  const { NT, T3, TB, TL, PW, NW, digits, R, bones, boneName, V3 } = rig;
  const idx = (d, k) => digits[d][k];
  const owner = t => TB[t];
  const listWhere = f => { const a = []; for (let t = 0; t < NT; t++) if (f(t, TL[t * 3], TL[t * 3 + 1], TL[t * 3 + 2])) a.push(t); return Int32Array.from(a); };
  // ---- zones (bind-pose bone-local cm of the triangle centroids; +x along the bone, +y pad side, +z radial on the right hand) ----
  const Z = {
    indexPad: listWhere((t, x, y) => owner(t) === idx(1, 2) && y > .12 && x > .55 && x < 2.1),
    thumbPad: listWhere((t, x, y) => owner(t) === idx(0, 2) && y > .55 && x > .4 && x < 2.4),
    midSide: listWhere((t, x, y, z) => (owner(t) === idx(2, 2) && z > .3 && y > -.4 && x < 1.75) || (owner(t) === idx(2, 1) && z > .4 && x > 1.4)),
  };
  // the first web space: thumb metacarpal / proximal, index proximal radial half, and the hand-bone skin near the index + thumb MCPs
  rig.update();
  const iMCP = rig.Wp(bones[idx(1, 0)]), tMCP = rig.Wp(bones[idx(0, 1)]), webMid0 = iMCP.clone().lerp(tMCP, .5);
  rig.skin();
  const centroid = t => { const c = new V3(); for (let k = 0; k < 3; k++) { const i = T3[t * 3 + k]; c.x += PW[i * 3]; c.y += PW[i * 3 + 1]; c.z += PW[i * 3 + 2]; } return c.multiplyScalar(1 / 3); };
  Z.web = listWhere((t, x, y, z) => {
    const b = owner(t);
    if (b === idx(1, 0)) return z > .2 && x < 2.2;                                 // index proximal phalanx, radial half, near the knuckle
    if (b === idx(0, 0) || b === idx(0, 1)) return true;                          // thumb metacarpal / proximal phalanx
    if (b === R.iH) return centroid(t).distanceTo(webMid0) < .028;                // hand skin around the first web space
    return false;
  });
  const zoneMask = new Uint8Array(NT);
  for (const k of ['indexPad', 'thumbPad', 'midSide', 'web']) for (const t of Z[k]) zoneMask[t] = 1;
  const byBone = new Map(); for (let t = 0; t < NT; t++) { if (!byBone.has(TB[t])) byBone.set(TB[t], []); byBone.get(TB[t]).push(t); }
  const digitTris = [0, 1, 2, 3, 4].map(d => Int32Array.from(digits[d].flatMap(id => byBone.get(id) || [])));
  const handTris = Int32Array.from(byBone.get(R.iH) || []), foreTris = Int32Array.from([...(byBone.get(R.iF) || []), ...(byBone.get(R.iU) || [])]);
  // ---- per-triangle pen clearance ----
  const TC = new Float64Array(NT), TT = new Float64Array(NT), TQ = new Float64Array(NT * 3);
  const o8 = new Float64Array(8), o3 = new Float64Array(3);
  function penPass(T, u, cullMm = 14, cullNear = 8) {
    const L = PEN.L, ex = T.x + u.x * L, ey = T.y + u.y * L, ez = T.z + u.z * L, cullFar = PEN.r + cullMm / 1000, cullN = PEN.r + cullNear / 1000;
    for (let t = 0; t < NT; t++) {
      const a = T3[t * 3], b = T3[t * 3 + 1], c = T3[t * 3 + 2];
      const ax = PW[a * 3], ay = PW[a * 3 + 1], az = PW[a * 3 + 2], bx = PW[b * 3], by = PW[b * 3 + 1], bz = PW[b * 3 + 2], cx = PW[c * 3], cy = PW[c * 3 + 1], cz = PW[c * 3 + 2];
      // quick cull: perpendicular distance of the vertices to the axis line
      const sa = (ax - T.x) * u.x + (ay - T.y) * u.y + (az - T.z) * u.z, sb = (bx - T.x) * u.x + (by - T.y) * u.y + (bz - T.z) * u.z, sc = (cx - T.x) * u.x + (cy - T.y) * u.y + (cz - T.z) * u.z;
      const pa = Math.hypot(ax - T.x - sa * u.x, ay - T.y - sa * u.y, az - T.z - sa * u.z), pb = Math.hypot(bx - T.x - sb * u.x, by - T.y - sb * u.y, bz - T.z - sb * u.z), pc = Math.hypot(cx - T.x - sc * u.x, cy - T.y - sc * u.y, cz - T.z - sc * u.z);
      const edge = Math.max(Math.hypot(ax - bx, ay - by, az - bz), Math.hypot(bx - cx, by - cy, bz - cz), Math.hypot(cx - ax, cy - ay, cz - az));
      if (Math.min(pa, pb, pc) - edge > (zoneMask[t] ? cullFar : cullN) || Math.max(sa, sb, sc) < -.01 || Math.min(sa, sb, sc) > L + .01) { TC[t] = Infinity; TT[t] = NaN; continue; }
      let best = Infinity, bs = 0, qx = 0, qy = 0, qz = 0;
      // segment vs the three edges
      for (const [p0x, p0y, p0z, p1x, p1y, p1z] of [[ax, ay, az, bx, by, bz], [bx, by, bz, cx, cy, cz], [cx, cy, cz, ax, ay, az]]) {
        const d2 = segSeg(T.x, T.y, T.z, ex, ey, ez, p0x, p0y, p0z, p1x, p1y, p1z, o8);
        if (d2 < best) { best = d2; bs = o8[0]; qx = o8[5]; qy = o8[6]; qz = o8[7]; }
      }
      // the two segment end points vs the triangle
      for (const [s, px, py, pz] of [[0, T.x, T.y, T.z], [1, ex, ey, ez]]) {
        const d2 = ptTri(px, py, pz, ax, ay, az, bx, by, bz, cx, cy, cz, o3);
        if (d2 < best) { best = d2; bs = s; qx = o3[0]; qy = o3[1]; qz = o3[2]; }
      }
      // the segment piercing the triangle (Moller-Trumbore)
      {
        const e1x = bx - ax, e1y = by - ay, e1z = bz - az, e2x = cx - ax, e2y = cy - ay, e2z = cz - az, dx = ex - T.x, dy = ey - T.y, dz = ez - T.z;
        const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x, det = e1x * px + e1y * py + e1z * pz;
        if (Math.abs(det) > 1e-14) {
          const inv = 1 / det, tx = T.x - ax, ty = T.y - ay, tz = T.z - az, uu = (tx * px + ty * py + tz * pz) * inv;
          if (uu >= 0 && uu <= 1) { const qx2 = ty * e1z - tz * e1y, qy2 = tz * e1x - tx * e1z, qz2 = tx * e1y - ty * e1x, vv = (dx * qx2 + dy * qy2 + dz * qz2) * inv;
            if (vv >= 0 && uu + vv <= 1) { const s = (e2x * qx2 + e2y * qy2 + e2z * qz2) * inv; if (s >= 0 && s <= 1) { best = 0; bs = s; qx = T.x + dx * s; qy = T.y + dy * s; qz = T.z + dz * s; } } }
        }
      }
      const tt = bs * L, d = Math.sqrt(best);
      TC[t] = d - rAt(tt); TT[t] = tt; TQ[t * 3] = qx; TQ[t * 3 + 1] = qy; TQ[t * 3 + 2] = qz;
    }
  }
  const minOf = (list, filt) => { let m = Infinity, at = -1; for (const t of list) { if (filt && !filt(t)) continue; if (TC[t] < m) { m = TC[t]; at = t; } } return { m, at }; };
  const ptOf = t => t < 0 ? null : new V3(TQ[t * 3], TQ[t * 3 + 1], TQ[t * 3 + 2]);
  // ---- joint angles: total anatomical flexion about each bone's +Z, abduction about +Y (fingers), for reporting ----
  const Wp = rig.Wp, perp = rig.perp;
  function jointAngles() {
    const out = {};
    const names = ['thumb', 'index', 'middle', 'ring', 'little'];
    digits.forEach((ids, d) => {
      out[names[d]] = ids.map((id, k) => {
        const b = bones[id], lz = new V3(0, 0, 1).transformDirection(b.matrixWorld), lx = new V3(1, 0, 0).transformDirection(b.matrixWorld);
        const parentDir = k === 0 ? Wp(b).sub(Wp(rig.hand)).normalize() : new V3(1, 0, 0).transformDirection(bones[ids[k - 1]].matrixWorld);
        const a = perp(parentDir, lz), c = perp(lx, lz); return Math.atan2(new V3().crossVectors(a, c).dot(lz), a.dot(c)) / D;
      });
    });
    return out;
  }
  return { Z, digitTris, handTris, foreTris, TC, TT, TQ, penPass, minOf, ptOf, jointAngles, webMid0, byBone };
}

// paper planes through the tip with the pen at altitude alt: normal N(phi) = sin(alt) u + cos(alt) (cos phi e1 + sin phi e2)
export function paperScan(rig, T, u, altDeg, ulnarSet, stepDeg = 1, allSet = null) {
  const { PW, NV, V3 } = rig;
  const e1 = Math.abs(u.y) < .9 ? new V3(0, 1, 0) : new V3(1, 0, 0); e1.addScaledVector(u, -e1.dot(u)).normalize();
  const e2 = new V3().crossVectors(u, e1);
  const sa = Math.sin(altDeg * D), ca = Math.cos(altDeg * D), res = [];
  for (let ph = 0; ph < 360; ph += stepDeg) {
    const c = Math.cos(ph * D), s = Math.sin(ph * D);
    const N = new V3().addScaledVector(u, sa).addScaledVector(e1, ca * c).addScaledVector(e2, ca * s);
    let mAll = Infinity, iAll = -1, mU = Infinity, iU = -1;
    for (let i = 0; i < NV; i++) {
      if (allSet && !allSet[i]) continue;
      const h = (PW[i * 3] - T.x) * N.x + (PW[i * 3 + 1] - T.y) * N.y + (PW[i * 3 + 2] - T.z) * N.z;
      if (h < mAll) { mAll = h; iAll = i; }
      if (ulnarSet[i] && h < mU) { mU = h; iU = i; }
    }
    res.push({ ph, N, mAll, iAll, mU, iU });
  }
  return res;
}
