// Independent check of tripod.json: fresh rig, copy the 15 quaternions into bone.quaternion (what the game will do), skin, and
// measure the pen against every skin triangle; also the page rest at the stored normals.
import fs from 'node:fs';
import { loadRig } from './rig.mjs';
import { makeEval, PEN } from './evalgrip.mjs';
const J = JSON.parse(fs.readFileSync(process.argv[2] || 'tripod.json', 'utf8'));
const rig = await loadRig(); const ev = makeEval(rig); const { V3, bones, NT, TB } = rig;
const byName = n => bones.find(b => b.name === n);
function check(label, B, pen) {
  for (const [n, q] of Object.entries(B)) byName(n).quaternion.set(...q);
  rig.update(); rig.skin();
  const T = new V3(...pen.tip), u = new V3(...pen.dir).normalize(); ev.penPass(T, u, 30);
  const g = k => { const r = ev.minOf(ev.Z[k]); return { m: r.m * 1e3, t: ev.TT[r.at] * 1e3 }; };
  const I = g('indexPad'), Th = g('thumbPad'), Mi = g('midSide');
  let minAll = Infinity, at = -1; for (let t = 0; t < NT; t++) if (ev.TC[t] < minAll) { minAll = ev.TC[t]; at = t; }
  let cone = Infinity; for (let t = 0; t < NT; t++) if (isFinite(ev.TC[t]) && ev.TT[t] < .014) cone = Math.min(cone, ev.TC[t]);
  console.log(`${label}: gaps thumb ${Th.m.toFixed(2)} @${Th.t.toFixed(1)}  index ${I.m.toFixed(2)} @${I.t.toFixed(1)}  middle ${Mi.m.toFixed(2)} @${Mi.t.toFixed(1)} mm; ` +
    `min skin-pen ${(minAll * 1e3).toFixed(2)} mm (${rig.boneName(TB[at])}); cone clear ${(cone * 1e3).toFixed(1)} mm; pen-handZ ${(Math.acos(u.z) * 180 / Math.PI).toFixed(1)} deg`);
  return { T, u };
}
const m = check('main', J.bones, J.pen);
// page rest: all hand vertices above the plane through the tip with the stored alt-55 normal; the lowest = the ulnar rest
const N = new V3(...J.paper.normal); let lo = Infinity, li = -1;
const handB = new Set([rig.R.iH, ...rig.digits.flat()]);
for (let i = 0; i < rig.NV; i++) { if (!handB.has(rig.VD[i])) continue; const h = (rig.PW[i * 3] - m.T.x) * N.x + (rig.PW[i * 3 + 1] - m.T.y) * N.y + (rig.PW[i * 3 + 2] - m.T.z) * N.z; if (h < lo) { lo = h; li = i; } }
console.log(`page (alt 55): pen-to-page ${(Math.asin(m.u.dot(N)) * 180 / Math.PI).toFixed(2)} deg, lowest skin ${(lo * 1e3).toFixed(2)} mm on ${rig.boneName(rig.VD[li])}, ulnarRest height ${(new V3(...J.ulnarRest).sub(m.T).dot(N) * 1e3).toFixed(2)} mm`);
for (const k of Object.keys(J.variants || {})) { const v = J.variants[k]; const r = check(`variant ${k}`, v.bones, v.pen); console.log(`   tip moved ${(r.T.distanceTo(m.T) * 1e3).toFixed(2)} mm, off the page ${(r.T.clone().sub(m.T).dot(N) * 1e3).toFixed(2)} mm`); }
