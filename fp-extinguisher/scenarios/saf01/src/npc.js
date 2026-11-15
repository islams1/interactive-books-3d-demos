/* ---- Rocketbox NPCs look at whoever they attend to (the speaker, or you): neck ~40%, head ~60%, eased.
   c.lookAt = 'player' | V3 (world) | null (ahead). The scanned figure (Eng. Karim) uses fbLook instead. ---- */
let camShake = 0;
function unlockAudio() {}                                   // no voice clips in SAF-01 (subtitles only)
const _nlq = new Q4(), _nlq2 = new Q4(), _nlv = new V3(), _nlv2 = new V3(), _nlr = new V3();
function npcLook(c, dt) {
  if (c.fullBody || c.gone) return;
  if (!c.lk) { c.headB = c.fbx.getObjectByName('Bip01_Head'); c.neckB = c.fbx.getObjectByName('Bip01_Neck'); c.lk = { y: 0, p: 0 }; }
  if (!c.headB) return;
  c.fbx.updateMatrixWorld(true);
  let ty = 0, tp = 0;
  const tgt = c.lookAt === 'player' ? camera.position : c.lookAt;
  if (tgt) {
    c.headB.getWorldPosition(_nlv); _nlv2.copy(tgt).sub(_nlv);
    let dy = Math.atan2(_nlv2.x, _nlv2.z) - c.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    if (Math.abs(dy) < 2) { ty = clamp(dy, -1.1, 1.1); tp = clamp(Math.atan2(_nlv2.y, Math.hypot(_nlv2.x, _nlv2.z)), -.45, .35); }
  }
  const k = Math.min(1, dt * 5); c.lk.y += (ty - c.lk.y) * k; c.lk.p += (tp - c.lk.p) * k;
  _nlr.set(Math.cos(c.yaw), 0, -Math.sin(c.yaw));                       // his right: a positive turn about it tips the face down
  for (const [b, part] of [[c.neckB, .4], [c.headB, .6]]) {
    if (!b) continue;
    _nlq.setFromAxisAngle(UP, c.lk.y * part).multiply(_nlq2.setFromAxisAngle(_nlr, -c.lk.p * part));
    const w = b.getWorldQuaternion(new Q4()).premultiply(_nlq);
    b.parent.getWorldQuaternion(_nlq2).invert(); b.quaternion.copy(_nlq2.multiply(w)); b.updateMatrixWorld(true);
  }
}
