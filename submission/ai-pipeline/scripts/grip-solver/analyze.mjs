// shape metrics of a solved grip: phalanx-to-pen angles, web opening, fingertip heights over the paper
import fs from 'node:fs';
import { makeModel } from './model.mjs';
const M = await makeModel(); const { rig, decode, cost } = M; const { V3, bones, digits } = rig;
for (const f of process.argv.slice(2)) {
  const x = JSON.parse(fs.readFileSync(f, 'utf8')).x, ex = {}; cost(x, true, ex);
  const { T, u } = decode(x);
  const ax = (d, k) => new V3(1, 0, 0).transformDirection(bones[digits[d][k]].matrixWorld).normalize();
  const ang = (a, b) => (Math.acos(Math.max(-1, Math.min(1, a.dot(b)))) * 180 / Math.PI).toFixed(0);
  const dn = u.clone().negate();                                       // pen toward the tip
  const s = [];
  for (const [nm, d] of [['thumb', 0], ['index', 1], ['middle', 2], ['ring', 3], ['little', 4]]) s.push(`${nm} distal/pen ${ang(ax(d, 2), dn)} mid/pen ${ang(ax(d, 1), dn)} prox/pen ${ang(ax(d, 0), dn)}`);
  console.log(f, '|', s.join(' | '));
  // web opening: thumb MCP and IP joint to the index MCP
  const P = i => rig.Wp(bones[i]);
  console.log(`  thumb MCP->index MCP ${(P(digits[0][1]).distanceTo(P(digits[1][0])) * 1e3).toFixed(1)} mm, thumb IP->index PIP ${(P(digits[0][2]).distanceTo(P(digits[1][1])) * 1e3).toFixed(1)} mm, thumb tip dir vs index distal ${ang(ax(0, 2), ax(1, 2))}`);
  const pr = ex.paperRes; if (pr) {
    const N = pr.N, h = i => ((rig.PW[i * 3] - T.x) * N.x + (rig.PW[i * 3 + 1] - T.y) * N.y + (rig.PW[i * 3 + 2] - T.z) * N.z) * 1e3;
    const lows = {}; for (let i = 0; i < rig.NV; i++) { if (!M.handMask[i]) continue; const b = rig.boneName(rig.VD[i]); lows[b] = Math.min(lows[b] ?? 1e9, h(i)); }
    console.log('  lowest point above the paper per bone (mm):', Object.entries(lows).sort((a, b) => a[1] - b[1]).slice(0, 9).map(([b, v]) => `${b} ${v.toFixed(1)}`).join(', '));
    console.log(`  paper N ${N.toArray().map(v => v.toFixed(2))} touching ${rig.boneName(rig.VD[pr.iAll])}`);
  }
}
