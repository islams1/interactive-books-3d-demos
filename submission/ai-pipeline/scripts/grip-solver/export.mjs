// Write tripod.json from solved parameter vectors: absolute local finger-bone quaternions, the pen, the contacts, the ulnar rest,
// optional variants, and diagnostics. usage: node export.mjs <sol.json> [up.json down.json] [--out path]
import fs from 'node:fs';
import { makeModel, NAMES } from './model.mjs';
import { PEN } from './evalgrip.mjs';
const SP = 'C:/Users/islam/AppData/Local/Temp/claude/286b4c16deb48d99/684824e4-3f75-4671-9b23-5f0f63cc85fe/scratchpad/';
const args = process.argv.slice(2), outI = args.indexOf('--out');
const out = outI >= 0 ? args.splice(outI, 2)[1] : SP + 'grip/tripod.json';
const [mainF, upF, downF] = args;
const M = await makeModel(JSON.parse(fs.readFileSync(mainF, 'utf8')).opts || {});
const { rig, ev, decode, cost } = M; const { V3, bones, digits } = rig;
const r4 = a => a.map(v => +(+v).toFixed(6));
const mm1 = v => +(v * 1000).toFixed(2);
function snapshot(x) {
  const ex = {}; const c = cost(x, true, ex);
  const { P, T, u } = decode(x);
  const bonesQ = {};
  digits.forEach(ids => ids.forEach(id => { const q = bones[id].quaternion; bonesQ[bones[id].name] = r4([q.x, q.y, q.z, q.w]); }));
  // a side vector for the pen roll: from the pen axis toward the index contact
  const foot = q => T.clone().addScaledVector(u, q.clone().sub(T).dot(u));
  const side = ex.qI ? ex.qI.clone().sub(foot(ex.qI)) : new V3(1, 0, 0); side.addScaledVector(u, -side.dot(u)).normalize();
  const webPt = ex.wz && ex.wz.at >= 0 ? ev.ptOf(ex.wz.at) : null;
  const contacts = { thumb: ex.qT?.toArray().map(v => +v.toFixed(5)), index: ex.qI?.toArray().map(v => +v.toFixed(5)), middle: ex.qM?.toArray().map(v => +v.toFixed(5)), web: webPt?.toArray().map(v => +v.toFixed(5)) };
  return { c, ex, P, T, u, side, bonesQ, contacts, x };
}
const S = snapshot(JSON.parse(fs.readFileSync(mainF, 'utf8')).x);
// paper rest at 45 / 55 / 65 degrees with the ulnar set
const rest = {}; for (const alt of [45, 55, 65]) { const pr = M.paperRest(S.T, S.u, alt, 1); rest[alt] = pr; }
const restTable = {}; for (let alt = 40; alt <= 62; alt++) { const pr = M.paperRest(S.T, S.u, alt, 1); if (!pr.none && pr.depth < .5) restTable[alt] = { normal: r4(pr.N.toArray()), rest: r4([rig.PW[pr.iAll * 3], rig.PW[pr.iAll * 3 + 1], rig.PW[pr.iAll * 3 + 2]]), touching: rig.boneName(rig.VD[pr.iAll]), fingertips_mm: +pr.tipLift.toFixed(1) }; }
const r55 = rest[55], ulnarP = new V3(rig.PW[r55.iU * 3], rig.PW[r55.iU * 3 + 1], rig.PW[r55.iU * 3 + 2]);
// re-pose the main grip (paperRest only reads PW, but keep the state clean)
cost(S.x);
const ja = ev.jointAngles();
const perDigitMin = {}; ['thumb', 'index', 'middle', 'ring', 'little'].forEach((n, d) => { const r = ev.minOf(ev.digitTris[d]); perDigitMin[n] = isFinite(r.m) ? mm1(r.m) : '>8'; });
const rh = ev.minOf(ev.handTris); perDigitMin.palm = isFinite(rh.m) ? mm1(rh.m) : '>8';
const tipReg = (() => { let m = Infinity; for (let t = 0; t < rig.NT; t++) if (isFinite(ev.TC[t]) && ev.TT[t] < .014) m = Math.min(m, ev.TC[t]); return isFinite(m) ? mm1(m) : '>8'; })();
const u = S.u, ex = S.ex;
// thumb metacarpal in anatomical terms (hand frame): palmar abduction = out of the palm plane; radial abduction = in the palm plane,
// away from the index metacarpal (wrist -> index knuckle)
const thDir = new V3(1, 0, 0).transformDirection(bones[digits[0][0]].matrixWorld).normalize();
const idxMeta = rig.Wp(bones[digits[1][0]]).normalize();
const palmarAbd = Math.asin(-thDir.y) * 180 / Math.PI;
const pXZ = v => new V3(v.x, 0, v.z).normalize(), radialAbd = pXZ(thDir).angleTo(pXZ(idxMeta)) * 180 / Math.PI;
// the pad / side normals of the contacts in the hand frame (for the game, if it wants to check facing)
const webQ = ex.wz && ex.wz.at >= 0 ? ev.ptOf(ex.wz.at) : null, webFoot = webQ ? webQ.clone().sub(S.T).dot(u) * 1000 : null;
const diag = {
  cost: +S.c.toFixed(3), terms: Object.fromEntries(Object.entries(ex.terms).map(([k, v]) => [k, +v.toFixed(3)])),
  gaps_mm: { thumb: mm1(ex.z.T.m), index: mm1(ex.z.I.m), middle: mm1(ex.z.M.m), web: +ex.gw.toFixed(2) },
  min_skin_to_pen_mm: perDigitMin, tip_cone_clearance_mm: tipReg,
  grip_mm: { index: +ex.fI.toFixed(1), thumb: +ex.fT.toFixed(1), middle: +ex.fM.toFixed(1), note: 'distance along the pen from the tip to each contact' },
  pen_forearm_deg: +ex.theta.toFixed(1),
  pen_forearm_deg_wrist_ext20: +(u.angleTo(new V3(0, Math.sin(20 * Math.PI / 180), Math.cos(20 * Math.PI / 180))) * 180 / Math.PI).toFixed(1),
  thumb_metacarpal_deg: { palmar_abduction: +palmarAbd.toFixed(1), radial_abduction: +radialAbd.toFixed(1), note: 'rest pose: palmar 33.8, radial 17.0' },
  phalanx_to_pen_deg: { thumb_distal: +ex.axTh?.toFixed(1), index_distal: +ex.axI?.toFixed(1), middle_distal: +ex.axM?.toFixed(1), note: 'angle between the distal phalanx (base -> tip) and the pen (top -> tip)' },
  web_fold: { pen_surface_to_fold_mm: +ex.foldDist?.toFixed(1), fold_to_axis_dorsal_mm: +ex.foldDorsal?.toFixed(1), along_pen_mm: +ex.foldAlong?.toFixed(1), point: ex.fold?.toArray().map(v => +v.toFixed(5)), note: 'web fold = the two skin vertices at the crotch of the first web space; dorsal > 0 = the pen passes on the back-of-hand side' },
  thumb_tip_along_pen_mm: +ex.sThTip?.toFixed(1), web_contact_along_pen_mm: webFoot === null ? null : +webFoot.toFixed(1),
  pad_facing_cos: { index: +ex.fcI?.toFixed(2), thumb: +ex.fcT?.toFixed(2), middle_side: +ex.fcM?.toFixed(2) },
  around_pen_deg: { thumb_index: +ex.tI?.toFixed(0), middle_index: +ex.mI?.toFixed(0), middle_thumb: +ex.mT?.toFixed(0) },
  finger_interpenetration_mm: +ex.cp.worst.toFixed(2),
  joints_total_flexion_deg: Object.fromEntries(Object.entries(ja).map(([k, a]) => [k, a.map(v => +v.toFixed(1))])),
  params: Object.fromEntries(NAMES.map((n, i) => [n, +S.x[i].toFixed(2)])),
  paper: Object.fromEntries(Object.entries(rest).map(([alt, r]) => [alt, { normal_hand: r.N.toArray().map(v => +v.toFixed(4)), ulnar_set_above_paper_mm: +(r.depth ?? NaN).toFixed(2), radial_up: +(r.radialUp ?? NaN).toFixed(2), back_up: +(r.backUp ?? NaN).toFixed(2), wrist_up: +(r.wristUp ?? NaN).toFixed(2), touching: r.iAll >= 0 ? rig.boneName(rig.VD[r.iAll]) : null, none: !!r.none }])),
};
const J = { units: 'm', frame: 'game hand-root frame as in agr03 loadHand (Z = -(wrist->middle knuckle), X = ulnar on the right hand, Y = back of hand); hand scale 1 (S_CM)',
  bones: S.bonesQ, pen: { tip: r4(S.T.toArray()), dir: r4(u.toArray()), side: r4(S.side.toArray()), length: PEN.L, radius: PEN.r, cone: PEN.cone },
  contacts: S.contacts, ulnarRest: r4(ulnarP.toArray()),
  paper: { alt: 55, normal: r4(r55.N.toArray()), note: 'page normal in the hand-root frame when the pen stands at alt deg and the hand rests on ulnarRest; align it with the page normal, then choose the azimuth about it',
    alts: restTable },
  display: { az: 35 }, diagnostics: diag };
if (upF && downF) {
  J.variants = {};
  for (const [k, f] of [['up', upF], ['down', downF]]) {
    const V = snapshot(JSON.parse(fs.readFileSync(f, 'utf8')).x);
    J.variants[k] = { bones: V.bonesQ, pen: { tip: r4(V.T.toArray()), dir: r4(V.u.toArray()), side: r4(V.side.toArray()) }, contacts: V.contacts,
      diagnostics: { gaps_mm: { thumb: mm1(V.ex.z.T.m), index: mm1(V.ex.z.I.m), middle: mm1(V.ex.z.M.m), web: +V.ex.gw.toFixed(2) },
        grip_mm: { index: +V.ex.fI.toFixed(1), thumb: +V.ex.fT.toFixed(1), middle: +V.ex.fM.toFixed(1) },
        tip_shift_mm: r4(V.T.clone().sub(S.T).multiplyScalar(1000).toArray()), tip_shift_on_page_mm: +V.T.clone().sub(S.T).multiplyScalar(1000).length().toFixed(2),
        tip_off_page_mm: +(V.T.clone().sub(S.T).dot(r55.N) * 1000).toFixed(3), pen_turn_deg: +(V.u.angleTo(S.u) * 180 / Math.PI).toFixed(2),
        joint_change_deg: Object.fromEntries(NAMES.slice(0, 16).map((n, i) => [n, +(V.x[i] - S.x[i]).toFixed(2)])) } };
  }
}
fs.writeFileSync(out, JSON.stringify(J, null, 1));
fs.mkdirSync('c:/book/fp-extinguisher/grip', { recursive: true });
fs.writeFileSync('c:/book/fp-extinguisher/grip/tripod.json', JSON.stringify(J, null, 1));
console.log(JSON.stringify(diag, null, 0).slice(0, 4000));
