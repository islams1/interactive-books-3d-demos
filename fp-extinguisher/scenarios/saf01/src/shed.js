/* =====================================================================
   3. THE FARM SHED (SAF-01) — 11:00, daylight through the open door behind you and a window.
      Back wall: the overloaded extension board on a crate, straw sacks on its right, a diesel drum on its left,
      and three extinguishers on brackets — water (red, the nearest), dry powder, CO₂. Left wall: the doorway
      to Eng. Karim's office. The draught comes in through the open door and runs towards the back wall.
      Photographed CC0 materials, HDRI daylight and props from Poly Haven (assets/polyhaven/LICENSE.md).
   ===================================================================== */
const RW = 12, RD = 9, RH = 3.3;                  // x -6..6, z -4.5..4.5; ridge RH + 1.1
const F = new V3(1.6, 0, -4.0);                   // fire centre (the floor under the board)
const FIRE_BASE = new V3(1.6, .5, -4.18);         // the board itself = the base of the fire
const FIRE_Y0 = .4;                               // flames start at the board
const STRAW = new V3(3.05, 0, -3.85);             // where the flame jumps if water hits the board
const WIND = new V3(0, 0, -1);                    // the draught: in through the door (z+), towards the back wall
const AABB = [];                                  // [minX, maxX, minZ, maxZ]
const block = (x0, x1, z0, z1) => AABB.push([x0, x1, z0, z1]);
const LAMP_POS = [];                              // the full-body figures are lit by these (LOOK)
const HIQ = () => quality !== 'low';
const OFF = k => params.has('no' + k) || (!HIQ() && ['maps', 'bounce', 'overlay'].includes(k));   // test switches (?nobounce ?noshaft ?nooverlay ?noprops ?nomaps); low quality drops the costly ones

/* ---- photographed PBR materials (albedo + GL normal + AO/rough/metal), UVs in metres so one material tiles everything ---- */
const PH = 'assets/polyhaven/', texL = new THREE.TextureLoader(), PBR = {}, SHED_TEX = [];
function pbr(id, extra = {}) {
  if (!PBR[id]) {
    const ld = (f, srgb) => { let done; SHED_TEX.push(new Promise(r => { done = r; })); const t = texL.load(`${PH}tex/${id}/${f}.jpg`, done, undefined, done); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; return t; };
    PBR[id] = { map: ld('diff', true), normalMap: ld('nor', false), arm: ld('arm', false) };
  }
  const T = PBR[id];
  if (OFF('maps')) return new THREE.MeshStandardMaterial({ map: T.map, roughness: .85, metalness: 0, ...extra, metalness: 0 });
  return new THREE.MeshStandardMaterial({ map: T.map, normalMap: T.normalMap, aoMap: T.arm, roughnessMap: T.arm, metalnessMap: T.arm, roughness: 1, metalness: 1, ...extra });
}
// box / plane UVs in metres (+ the mesh's place, so neighbouring wall sheets continue the same texture)
function uvM(geo, tile, off = [0, 0, 0], rot = 0) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + off[0], y = p.getY(i) + off[1], z = p.getZ(i) + off[2], ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ax >= ay && ax >= az) { u = -z * Math.sign(n.getX(i)); v = y; } else if (ay >= az) { u = x; v = z; } else { u = x * Math.sign(n.getZ(i)); v = y; }
    if (rot) { const c = Math.cos(rot), s = Math.sin(rot); [u, v] = [u * c - v * s, u * s + v * c]; }
    uv.setXY(i, u / tile, v / tile);
  }
  uv.needsUpdate = true; return geo;
}
const M = {
  wall: pbr('corrugated_iron_02', { metalness: .7, envMapIntensity: .45 }),   // galvanised sheet, 2.7 m tile (indoors: little sky to reflect)
  roof: pbr('rusty_corrugated_iron', { side: THREE.DoubleSide, color: 0x7f746c, metalness: .35, envMapIntensity: .25 }),   // 2 m, the dark underside of an old tin roof
  floor: pbr('dirt_floor', { metalness: 0 }),                           // packed earth, 2.07 m
  wood: pbr('old_planks_02', { metalness: 0 }),                         // 2 m
  sack: pbr('hessian_230', { metalness: 0, color: 0xb59d78 }),
  straw: pbr('reed_roof_03', { metalness: 0, color: 0xf0e2b8 }),        // dry straw ends
  plaster: pbr('grey_plaster_02', { metalness: 0 }),
  yard: pbr('brown_mud_dry', { metalness: 0 }),
};
M.straw.color.setRGB(1.6, 1.42, .98);                              // the reed photo is darker than fresh straw: lift it to hay
const TILE = { wall: 2.7, roof: 2, floor: 2.07, wood: 2, sack: .4, straw: .9, plaster: 1, yard: 1.3 };
const P = (geo, key, p = [0, 0, 0], r = [0, 0, 0], shadow = true, parent = world, rot = 0) => mk(uvM(geo, TILE[key], p, rot), M[key], parent, p, r, shadow);

const officeSignTex = canvasTex(512, 128, (g, w, h) => {
  g.fillStyle = '#ece6d6'; g.fillRect(0, 0, w, h); blotches(g, w, h, 8, '120,100,70', .12, 50); g.strokeStyle = '#2c3a4a'; g.lineWidth = 6; g.strokeRect(4, 4, w - 8, h - 8);
  g.fillStyle = '#2c3a4a'; g.textAlign = 'center'; g.font = `700 46px ${"'IBM Plex Sans Arabic', sans-serif"}`; g.fillText('مكتب م. كريم', w / 2, 62);
  g.font = '700 26px sans-serif'; g.fillText("ENG. KARIM'S OFFICE", w / 2, 104);
});
const dieselTex = canvasTex(512, 256, (g, w, h) => {                 // a worn yellow label on the drum
  g.clearRect(0, 0, w, h); g.fillStyle = '#e5b627'; g.fillRect(150, 30, 212, 196); blotches(g, w, h, 30, '90,60,20', .22, 40);
  g.fillStyle = '#111'; g.textAlign = 'center'; g.font = '700 46px sans-serif'; g.fillText('DIESEL', w / 2, 92);
  g.font = `700 52px ${"'IBM Plex Sans Arabic', sans-serif"}`; g.fillText('سولار', w / 2, 160);
  g.beginPath(); g.moveTo(w / 2, 168); g.lineTo(w / 2 + 24, 212); g.lineTo(w / 2 - 24, 212); g.closePath(); g.lineWidth = 5; g.stroke(); g.font = '700 30px sans-serif'; g.fillText('!', w / 2, 206);
  speckle(g, w, h, 1500, .25, false);
});

/* ---- daylight: the HDRI is the sky outside + the image-based light; the sun is put where the HDRI's sun is
       (21.6° up, from the door / window side), so the light through the door and window matches the sky ---- */
const SUN_HDRI = new V3(.751, .369, .548).normalize();
sun.position.copy(SUN_HDRI).multiplyScalar(22).add(new V3(0, 0, -.5)); sun.target.position.set(0, 0, -.5);
sun.intensity = 4.6; sun.color.set(0xfff0dc);
sun.shadow.mapSize.set(HIQ() ? 2048 : 1024, HIQ() ? 2048 : 1024);
Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 9, bottom: -9, near: 2, far: 45 }); sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -.00025; sun.shadow.normalBias = .025; sun.shadow.radius = 2.5;
SUN_DIR.copy(SUN_HDRI); sunH.position.copy(sun.position); sunH.intensity = 1.5;
hemi.intensity = .09; hemi.color.set(0xc9d6e6); hemi.groundColor.set(0x5a4a36);          // little open sky reaches inside a shed
handsScene.traverse(o => { if (o.isHemisphereLight) o.intensity = .26; });
renderer.toneMappingExposure = 1.05;
world.environmentIntensity = .2; handsScene.environmentIntensity = .26;
// the sun patches on the floor light the room back up a little (warm bounce, no shadows)
if (!OFF('bounce')) for (const [x, y, z, k] of [[-2.6, .35, 2.7, 1.6], [2.6, .45, -2.9, 1.0]]) { const b = new THREE.PointLight(0xffdfb8, k, 7, 1.4); b.position.set(x, y, z); world.add(b); }
const SHED_HDRI = new RGBELoader().loadAsync(`${PH}hdri/belfast_farmhouse_2k.hdr`).then(hdr => {
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  const env = pmrem.fromEquirectangular(hdr).texture;
  world.environment = env; handsScene.environment = env;
  world.background = hdr; world.backgroundIntensity = .85;
}).catch(e => console.warn('hdri not loaded', e));

/* ---- floor, yard, walls (door / window / office openings), gables, roof, rafters ---- */
P(new THREE.PlaneGeometry(RW, RD), 'floor', [0, 0, 0], [-Math.PI / 2, 0, 0], false);
P(new THREE.PlaneGeometry(70, 70), 'yard', [0, -.02, 0], [-Math.PI / 2, 0, 0], false);
const T_W = .08;
function wallZ(z, rects) { for (const [u0, u1, y0, y1] of rects) P(box(u1 - u0, y1 - y0, T_W), 'wall', [(u0 + u1) / 2, (y0 + y1) / 2, z]); }
function wallX(x, rects) { for (const [u0, u1, y0, y1] of rects) P(box(T_W, y1 - y0, u1 - u0), 'wall', [x, (y0 + y1) / 2, (u0 + u1) / 2]); }
wallZ(-RD / 2, [[-RW / 2, RW / 2, 0, RH]]);
wallZ(RD / 2, [[-RW / 2, -.85, 0, RH], [.85, RW / 2, 0, RH], [-.85, .85, 2.45, RH]]);
wallX(RW / 2, [[-RD / 2, -1.8, 0, RH], [-.3, RD / 2, 0, RH], [-1.8, -.3, 0, 1.15], [-1.8, -.3, 2.1, RH]]);
wallX(-RW / 2, [[-RD / 2, 1.0, 0, RH], [2.0, RD / 2, 0, RH], [1.0, 2.0, 2.2, RH]]);
const gable = new THREE.Shape([new THREE.Vector2(-RD / 2, 0), new THREE.Vector2(RD / 2, 0), new THREE.Vector2(0, 1.1)]);
for (const sx of [-1, 1]) { const g = new THREE.ShapeGeometry(gable); g.computeVertexNormals(); const m = mk(g, M.wall, world, [sx * RW / 2, RH, 0], [0, Math.PI / 2, 0]); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, g.attributes.position.getX(i) / TILE.wall, (g.attributes.position.getY(i) + RH) / TILE.wall); m.material = M.wall.clone(); m.material.side = THREE.DoubleSide; }
const roofL = Math.hypot(RD / 2 + .3, 1.1), roofA = Math.atan2(1.1, RD / 2 + .3);
P(box(RW + .6, .05, roofL), 'roof', [0, RH + .55, (RD / 2 + .3) / 2], [roofA, 0, 0]);
P(box(RW + .6, .05, roofL), 'roof', [0, RH + .55, -(RD / 2 + .3) / 2], [-roofA, 0, 0]);
const woodDark = pbr('old_planks_02', { metalness: 0, color: 0x8a7563 }), steelDark = std(0x3c3f44, .55, .6);
const beam = (w, h, d, p, r = [0, 0, 0]) => mk(uvM(box(w, h, d), TILE.wood, p), woodDark, world, p, r);
beam(RW, .16, .16, [0, RH + 1.02, 0]);
for (const x of [-4, 0, 4]) { beam(.14, .16, RD, [x, RH - .08, 0]); beam(.12, 1.05, .12, [x, RH + .5, 0]); }
for (const x of [-5.9, 5.9]) for (const z of [-4.4, -1.5, 1.5, 4.4]) beam(.12, RH, .12, [x, RH / 2, z]);            // posts
for (const z of [-4.42, 4.42]) beam(RW - .2, .12, .1, [0, 1.4, z]);                                                    // girts
// light leaking between the sheets and the roof (bright slits read as a real tin shed)
const leakMat = new THREE.MeshBasicMaterial({ color: 0xfff3dc, fog: false, transparent: true, opacity: .85, side: THREE.DoubleSide });
for (const [x, z, w, ry] of [[-3, -RD / 2 + .045, 5.2, 0], [3.2, -RD / 2 + .045, 4.4, 0], [RW / 2 - .045, 2.4, 3.4, Math.PI / 2], [-RW / 2 + .045, -2.4, 3.6, Math.PI / 2]]) {
  mk(new THREE.PlaneGeometry(w, .012), leakMat, world, [x, RH - .02, z], [0, ry, 0], false);
}

/* ---- the open door (leaf swung out into the yard) + frame; the window with a dirty pane ---- */
for (const sx of [-1, 1]) beam(.1, 2.45, .14, [sx * .9, 1.225, RD / 2]);
beam(1.9, .12, .14, [0, 2.5, RD / 2]);
P(box(1.6, 2.35, .05), 'wall', [-1.6, 1.18, RD / 2 + .75], [0, -1.05, 0]);
beam(.14, .08, 1.62, [RW / 2, 1.15, -1.05]); beam(.14, .08, 1.62, [RW / 2, 2.1, -1.05]);
for (const z of [-1.3, -.8]) mk(box(.05, .95, .04), steelDark, world, [RW / 2, 1.62, z]);
const grimeTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = 'rgba(190,185,170,.18)'; g.fillRect(0, 0, w, h); blotches(g, w, h, 40, '120,105,80', .22, 60); speckle(g, w, h, 3000, .25, false); });
mk(new THREE.PlaneGeometry(1.5, .9), new THREE.MeshStandardMaterial({ map: grimeTex, transparent: true, roughness: .25, metalness: 0, depthWrite: false }), world, [RW / 2 - .01, 1.62, -1.05], [0, -Math.PI / 2, 0], false);

/* ---- the adjoining office (behind the left wall; you see Eng. Karim through the doorway) ---- */
P(new THREE.PlaneGeometry(3.4, 4.2), 'wood', [-7.7, .003, 1.5], [-Math.PI / 2, 0, 0], false);
P(box(.08, 2.7, 4.2), 'plaster', [-9.4, 1.35, 1.5]);
for (const z of [-.6, 3.6]) P(box(3.4, 2.7, .08), 'plaster', [-7.7, 1.35, z]);
P(box(3.4, .06, 4.2), 'plaster', [-7.7, 2.7, 1.5]);
mk(box(.06, .9, 1.3), new THREE.MeshBasicMaterial({ color: 0xe9f0f4, fog: false }), world, [-9.35, 1.6, .6], [0, 0, 0], false);   // office window (bright)
P(box(1.2, .05, .65), 'wood', [-8.7, .76, 2.6]); for (const [dx, dz] of [[-.55, -.28], [.55, -.28], [-.55, .28], [.55, .28]]) mk(box(.04, .74, .04), steelDark, world, [-8.7 + dx, .37, 2.6 + dz]);
mk(box(.36, .24, .03), std(0x18191b, .4), world, [-8.85, 1.0, 2.62], [0, Math.PI / 2, 0]); mk(box(.06, .12, .06), steelDark, world, [-8.9, .84, 2.62]);
beam(1.06, .08, .08, [-RW / 2, 2.24, 1.5], [0, Math.PI / 2, 0]);
for (const z of [.97, 2.03]) beam(.14, 2.2, .07, [-RW / 2, 1.1, z]);
mk(new THREE.PlaneGeometry(.9, .225), new THREE.MeshStandardMaterial({ map: officeSignTex, roughness: .7 }), world, [-RW / 2 + .05, 2.5, 1.5], [0, Math.PI / 2, 0], false);
{ const l = new THREE.PointLight(0xfff2de, 4, 6, 1.6); l.position.set(-7.7, 2.45, 1.5); world.add(l); }

/* ---- Poly Haven props (real scale, loaded async; the scene waits for them before it starts) ---- */
const gltfL = new GLTFLoader(), MODEL = {}, SHED_PROPS = [];
function loadModel(id) {
  return MODEL[id] ??= gltfL.loadAsync(`${PH}models/${id}/${id}_1k.gltf`).then(g => {
    g.scene.traverse(o => { if (o.isMesh) {
      // glass with transmission makes three.js re-render the whole scene into a texture every frame (−15 fps here): plain glass instead
      if ([].concat(o.material).some(m => m.transmission > 0)) o.material = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: .08, metalness: 0, transparent: true, opacity: .35, depthWrite: false });
      o.castShadow = o.receiveShadow = true; for (const m of [].concat(o.material)) { for (const k of ['map', 'normalMap', 'roughnessMap']) if (m[k]) m[k].anisotropy = 8; m.envMapIntensity = 1; } } });
    return g.scene;
  });
}
function prop(id, p, ry = 0, s = 1, more) {          // p = floor position [x, y, z]; s = scale (number or [sx, sy, sz])
  if (OFF('props')) return Promise.resolve();
  if ((params.get('skip') || '').split(',').includes(id)) return Promise.resolve();
  const pr = loadModel(id).then(src => {
    const r = src.clone(true); r.position.set(...p); r.rotation.y = ry;
    if (Array.isArray(s)) r.scale.set(...s); else r.scale.setScalar(s);
    if (more) more(r); world.add(r); return r;
  }).catch(e => console.warn('prop not loaded:', id, e));
  SHED_PROPS.push(pr); return pr;
}

/* ---- two hanging bulbs (pull-chain sockets on a cord) ---- */
for (const [x, z] of [[-2.6, -.4], [2.6, -1.8]]) {
  mk(cyl(.004, .004, 1.0, 6), std(0x1c1c1c, .6), world, [x, RH - .45, z], [0, 0, 0], false);
  prop('pull_chain_light_socket', [x, RH - .95, z], .7);
  prop('lightbulb_01', [x, RH - 1.1, z], 0, 1, r => { r.rotation.x = Math.PI; r.traverse(o => { if (o.isMesh) { o.castShadow = false; o.material = new THREE.MeshStandardMaterial({ color: 0xfff4e0, emissive: 0xffd49a, emissiveIntensity: 2.4, roughness: .15, transparent: true, opacity: .9 }); } }); });
  mk(new THREE.SphereGeometry(.012, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff1d8 }), world, [x, RH - 1.15, z], [0, 0, 0], false);
  const l = new THREE.PointLight(0xffdcb0, 2.6, 7, 1.7); l.position.set(x, RH - 1.16, z); world.add(l); LAMP_POS.push(l.position.clone());
}
while (LAMP_POS.length < 6) LAMP_POS.push(new V3(0, -200, 0));   // the relit-figure shader takes 6 lamps; the far ones add nothing

/* ---- the overloaded extension board on an old crate, the wall socket, plugs and tangled cables ---- */
const BOARD = { extra: [], fixed: [] };
prop('wooden_crate_01', [1.6, .008, -4.2], 0, [.82, 1.2, .9]);                 // 0.68 x 0.42 x 0.37 m
block(1.26, 1.94, -4.5, -4.0);
const plastic = c => new THREE.MeshPhysicalMaterial({ color: c, roughness: .42, clearcoat: .3, clearcoatRoughness: .5 });
mk(rbox(.36, .045, .09, .012), plastic(0xe9e4d8), world, [1.6, .445, -4.22]);
mk(box(.02, .012, .012), new THREE.MeshBasicMaterial({ color: 0xff2a14 }), world, [1.43, .47, -4.22], [0, 0, 0], false);   // its lit switch
const plugCols = [0x1c1c1c, 0xf2f2ee, 0x2a5fb8, 0x1c1c1c, 0xd8d2c0, 0xb2251c];
plugCols.forEach((c, i) => {
  const x = 1.46 + i * .056, p = mk(rbox(.034, .05, .044, .006), plastic(c), world, [x, .49, -4.22]);
  const cab = new THREE.CatmullRomCurve3([new V3(x, .515, -4.22), new V3(x + (i - 2.5) * .03, .57, -4.1), new V3(x + (i - 2.5) * .12, .22, -3.97), new V3(x + (i - 2.5) * .35, .012, -3.92), new V3(x + (i - 2.5) * .55 + .2, .01, -3.55 + i * .07)]);
  const m = mk(new THREE.TubeGeometry(cab, 24, .0048, 6), plastic(c === 0xf2f2ee ? 0xdedad0 : 0x1e1e1e), world, [0, 0, 0], [0, 0, 0], false);
  if (i > 1) BOARD.extra.push(p, m);
});
mk(rbox(.05, .07, .06, .008), plastic(0xf2f2ee), world, [1.74, .53, -4.22]); mk(rbox(.034, .05, .044, .006), plastic(0x1c1c1c), world, [1.74, .585, -4.22]);   // an adaptor stacked on a plug
mk(rbox(.12, .12, .03, .01), plastic(0xece8de), world, [1.6, 1.15, -4.44]);
for (const dx of [-.025, .025]) mk(cylZ(.006, .01, 8), std(0x111111, .6), world, [1.6 + dx, 1.15, -4.42], [0, 0, 0], false);
mk(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new V3(1.6, 1.12, -4.42), new V3(1.58, .8, -4.36), new V3(1.44, .47, -4.26)]), 16, .006, 6), plastic(0x202020), world, [0, 0, 0], [0, 0, 0], false);
mk(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ map: scorchTex, transparent: true, depthWrite: false, opacity: .6 }), world, [1.6, .9, -4.455], [0, 0, 0], false);
for (const [x, y] of [[.9, .5], [2.4, .5]]) {         // after a good ending: Eng. Karim moves the plugs to separate sockets
  const s = mk(rbox(.12, .12, .03, .01), plastic(0xece8de), world, [x, y, -4.44]); const p = mk(rbox(.034, .05, .044, .006), plastic(0x1c1c1c), world, [x, y, -4.41]);
  s.visible = p.visible = false; BOARD.fixed.push(s, p);
}

/* ---- straw sacks + a bale on the board's right, the diesel drum (+ a jerrycan) on its left ---- */
const twine = std(0x6b4a2a, .9);
function pillow(w, h, d, e = .38) {                 // a stuffed sack: a squashed super-ellipsoid with a soft sag on top
  const g = new THREE.SphereGeometry(1, 28, 20), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const sx = Math.sign(p.getX(i)) * Math.abs(p.getX(i)) ** e, sy = Math.sign(p.getY(i)) * Math.abs(p.getY(i)) ** e, sz = Math.sign(p.getZ(i)) * Math.abs(p.getZ(i)) ** e;
    const top = Math.max(0, sy), sag = top * (1 - Math.abs(sx)) * (1 - Math.abs(sz)) * .12;
    p.setXYZ(i, sx * w / 2 * (1 - .06 * top), (sy - sag) * h / 2, sz * d / 2 * (1 - .06 * top));
  }
  g.computeVertexNormals(); return g;
}
function sack(x, y, z, ry) { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; world.add(g); const m = P(pillow(.56, .5, .42), 'sack', [0, 0, 0], [0, 0, 0], true, g); m.scale.y = .9 + rnd() * .12; m.rotation.z = (rnd() - .5) * .08; return g; }
function bale(x, y, z, ry, w = 1.05, d = .55) { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; world.add(g); P(rbox(w, .5, d, .06), 'straw', [0, 0, 0], [0, 0, 0], true, g, Math.PI / 2); for (const dx of [-w * .27, w * .27]) mk(box(.012, .505, d + .006), twine, g, [dx, 0, 0], [0, 0, 0], false); return g; }
for (const [x, y, z, ry] of [[2.38, .25, -4.18, .1], [2.95, .25, -4.2, -.08], [3.5, .25, -4.16, .14], [2.66, .72, -4.2, -.05], [3.22, .72, -4.18, .1]]) sack(x, y, z, ry);
bale(3.05, .25, -3.62, 0, 1.1, .5);
block(2.06, 3.82, -4.5, -3.34);
prop('barrel_03', [.62, 0, -4.08], .4, .94, r => {                            // 0.59 x 0.87 m steel drum + its diesel label
  mk(new THREE.CylinderGeometry(.302, .302, .4, 32, 1, true, -1.1, 2.2), new THREE.MeshStandardMaterial({ map: dieselTex, transparent: true, roughness: .6, alphaTest: .05 }), world, [.62, .42, -4.08], [0, 0, 0], false);
});
prop('metal_jerrycan', [1.08, 0, -3.72], -.55);
block(.9, 1.26, -3.85, -3.6);
block(.3, .94, -4.5, -3.76);
// three extinguishers on brackets, signs above (built at start-up: see buildWallRack)
const SLOT = { water: new V3(-.55, .62, -4.355), powder: new V3(-1.55, .62, -4.355), co2: new V3(-2.55, .62, -4.355) };
for (const s of Object.values(SLOT)) { mk(box(.14, .26, .02), steelDark, world, [s.x, .95, -4.45]); mk(box(.06, .03, .12), steelDark, world, [s.x, .86, -4.4]); }
const EXT_HOME = new V3(0, -10, 0);                 // the extinguisher in your hands lives here until you take one

/* ---- hay bales (left back corner), the low bench with a tool chest (right wall), shelves, tools, feed sacks ---- */
bale(-5.2, .25, -3.95, 0); bale(-4.05, .25, -3.95, .05); bale(-5.2, .75, -3.95, -.04); bale(-4.6, .25, -3.1, 1.5);
block(-5.95, -3.45, -4.5, -2.75);
prop('WoodenTable_01', [5.45, 0, 2.0], Math.PI / 2);                            // 1.8 x 0.55 m old bench along the wall
prop('metal_tool_chest', [5.5, .55, 1.55], -Math.PI / 2, .8);
prop('wooden_bucket_01', [5.35, .55, 2.6], .6, .8);
block(5.0, 6, .95, 3.05);
prop('steel_frame_shelves_01', [5.62, 0, -2.6], -Math.PI / 2, .1);             // 1.1 x 2.1 m shelving
for (const [x, y, z, ry] of [[5.3, 0, -3.95, .3], [5.28, .17, -3.9, .12], [4.85, 0, -4.05, -.2]]) prop('cement_bag', [x, y, z], ry);
block(5.05, 6, -3.2, -2.0); block(4.85, 5.5, -4.25, -3.55);
prop('rusted_spade_01', [5.78, .52, 3.95], 0, 1, r => { r.rotation.order = 'ZYX'; r.rotation.set(.05, Math.PI / 2, -.16); });
prop('sledgehammer_01', [5.74, .74, 4.22], 0, 1, r => { r.rotation.order = 'ZYX'; r.rotation.set(-.04, Math.PI / 2, -.14); });
prop('garden_hose_wall_mounted_01', [5.93, 1.45, 3.2], -Math.PI / 2);
for (const [x, z, ry] of [[4.2, 3.9, .3], [3.6, 4.05, -.2]]) sack(x, .25, z, ry);
block(3.3, 4.55, 3.65, 4.5);
prop('old_tyre', [-5.25, .08, 3.85], 0, 1, r => { r.rotation.x = Math.PI / 2; });
prop('old_tyre', [-5.2, .24, 3.83], 0, 1, r => { r.rotation.set(Math.PI / 2, 0, .4); });
prop('ladder_sectioned_01', [-5.5, 0, 3.0], 0, 1, r => { r.rotation.order = 'ZYX'; r.rotation.set(0, Math.PI / 2, .17); });
block(-6, -4.85, 2.7, 4.5);

/* ---- wear: dirt + stains on the floor, grime at the wall foot, loose straw, cobwebs ---- */
const grimeFloor = canvasTex(1024, 768, (g, w, h) => {               // multiplied over the floor: darker towards walls, corners and under things
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
  const X = x => (x + RW / 2) / RW * w, Z = z => (z + RD / 2) / RD * h, edge = 70;
  for (const [x0, y0, x1, y1] of [[0, 0, edge, 0], [w, 0, w - edge, 0], [0, 0, 0, edge], [0, h, 0, h - edge]]) {
    const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, 'rgba(70,55,40,.55)'); gr.addColorStop(1, 'rgba(70,55,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }
  const blob = (x, z, rx, rz, a, c = '40,30,22') => { const gr = g.createRadialGradient(X(x), Z(z), 0, X(x), Z(z), Math.max(rx, rz) / RW * w); gr.addColorStop(0, `rgba(${c},${a})`); gr.addColorStop(1, `rgba(${c},0)`); g.save(); g.translate(X(x), Z(z)); g.scale(1, rz / rx); g.translate(-X(x), -Z(z)); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.restore(); };
  for (const [x, z, rx, rz, a] of [[1.6, -4.2, .7, .4, .5], [.62, -4.08, .55, .55, .55], [2.95, -4.1, 1.3, .6, .45], [3.05, -3.6, .8, .45, .4], [-4.6, -3.7, 1.7, 1.0, .5],
    [5.45, 2.0, .7, 1.4, .4], [5.5, -2.6, .7, .9, .45], [4.0, 4.0, 1.0, .6, .35], [-5.3, 3.8, .7, .6, .35]]) blob(x, z, rx, rz, a);
  blob(.75, -3.7, .55, .4, .55, '20,16,12'); blob(1.1, -3.6, .3, .22, .6, '15,12,10');            // diesel / oil stains by the drum
  blotches(g, w, h, 60, '60,48,34', .08, 90);
  for (let i = 0; i < 1600; i++) { const x = rnd() * w, y = rnd() * h; g.fillStyle = `rgba(50,40,28,${.05 + rnd() * .1})`; g.fillRect(x, y, 2 + rnd() * 3, 2 + rnd() * 3); }
});
if (!OFF('overlay')) mk(new THREE.PlaneGeometry(RW, RD), new THREE.MeshBasicMaterial({ map: grimeFloor, blending: THREE.MultiplyBlending, premultipliedAlpha: true, transparent: true, depthWrite: false, fog: false }), world, [0, .004, 0], [-Math.PI / 2, 0, 0], false);
const footTex = canvasTex(256, 256, (g, w, h) => { const gr = g.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, 'rgb(105,88,66)'); gr.addColorStop(.35, 'rgb(190,178,158)'); gr.addColorStop(1, 'rgb(255,255,255)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); blotches(g, w, h, 40, '90,70,50', .12, 40); });
const footMat = new THREE.MeshBasicMaterial({ map: footTex, blending: THREE.MultiplyBlending, premultipliedAlpha: true, transparent: true, depthWrite: false, fog: false });
for (const [x, z, len, ry] of [[0, -RD / 2 + .045, RW, 0], [-3.43, RD / 2 - .045, 5.15, Math.PI], [3.43, RD / 2 - .045, 5.15, Math.PI], [RW / 2 - .045, 0, RD, -Math.PI / 2], [-RW / 2 + .045, -1.75, 5.5, Math.PI / 2], [-RW / 2 + .045, 3.25, 2.5, Math.PI / 2]])
  if (!OFF('overlay')) mk(new THREE.PlaneGeometry(len, .7), footMat, world, [x, .35, z], [0, ry, 0], false);
if (HIQ()) {                                                        // loose straw on the floor (instanced)
  const n = 1400, geo = new THREE.BoxGeometry(.0035, .0016, 1), strawM = std(0xcfae66, .9), im = new THREE.InstancedMesh(geo, strawM, n), o = new THREE.Object3D(), col = new THREE.Color();
  const spots = [[3.0, -3.3, 1.4, .7, .45], [-4.6, -2.7, 1.8, 1.0, .3], [1.9, -3.6, .9, .5, .1], [4.0, 3.5, 1.0, .6, .1], [0, 3.8, 1.2, 1.6, .05]];
  for (let i = 0; i < n; i++) {
    let s = spots[0], r = rnd(); for (const sp of spots) { if (r < sp[4]) { s = sp; break; } r -= sp[4]; }
    const a = rnd() * TAU, d = Math.sqrt(rnd());
    o.position.set(s[0] + Math.cos(a) * d * s[2], .004 + rnd() * .006, s[1] + Math.sin(a) * d * s[3]); o.rotation.set((rnd() - .5) * .2, rnd() * TAU, (rnd() - .5) * .2); o.scale.set(1, 1, .04 + rnd() * .1); o.updateMatrix();
    im.setMatrixAt(i, o.matrix); im.setColorAt(i, col.setHSL(.11 + rnd() * .03, .45 + rnd() * .2, .45 + rnd() * .25));
  }
  im.receiveShadow = true; world.add(im);
  const webTex = canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(235,235,230,.55)'; g.lineWidth = 1;
    for (let k = 0; k < 9; k++) { const a = k / 8 * Math.PI / 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * w, Math.sin(a) * h); g.stroke(); }
    for (let r = 20; r < w; r += 18 + rnd() * 10) { g.beginPath(); for (let k = 0; k <= 8; k++) { const a = k / 8 * Math.PI / 2, rr = r * (.92 + rnd() * .12); k ? g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.stroke(); }
  });
  const webM = new THREE.MeshBasicMaterial({ map: webTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: .7 });
  for (const [x, z, ry] of [[-RW / 2 + .06, -RD / 2 + .06, 0], [RW / 2 - .06, -RD / 2 + .06, -Math.PI / 2], [RW / 2 - .06, RD / 2 - .06, Math.PI]]) mk(new THREE.PlaneGeometry(.7, .7), webM, world, [x + (x < 0 ? .35 : -.35) * Math.cos(ry), RH - .35, z], [0, ry + Math.PI / 4, Math.PI], false);
}

/* ---- sunlight shafts through the door and the window (soft additive planes) + motes in them ---- */
const shaftTex = canvasTex(64, 256, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.25, 'rgba(255,255,255,.8)'); gr.addColorStop(.75, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'destination-in'; const g2 = g.createLinearGradient(0, 0, 0, h); g2.addColorStop(0, 'rgba(0,0,0,1)'); g2.addColorStop(.7, 'rgba(0,0,0,.45)'); g2.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = g2; g.fillRect(0, 0, w, h); g.globalCompositeOperation = 'source-over';
});
shaftTex.colorSpace = THREE.NoColorSpace;
const shaftMat = new THREE.MeshBasicMaterial({ map: shaftTex, color: 0xffe9c8, transparent: true, opacity: .085, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
const SHAFTS = new THREE.Group(); world.add(SHAFTS);
function shaft(cx, cy, cz, w, h, len, opa) {          // a slab of light from an opening (centre / size), pointing down the sun ray
  const into = SUN_HDRI.clone().negate();
  for (const [ww, rot] of [[w, 0], [h, Math.PI / 2], [w * .7, Math.PI / 4]]) {
    const geo = new THREE.PlaneGeometry(ww, len); geo.translate(0, -len / 2, 0);
    const m = new THREE.Mesh(geo, shaftMat.clone()); m.material.opacity = opa;
    m.position.set(cx, cy, cz);
    m.quaternion.setFromUnitVectors(new V3(0, -1, 0), into); m.rotateY(rot); m.renderOrder = 4; SHAFTS.add(m);
  }
}
if (HIQ() && !OFF('shaft')) { shaft(0, 1.4, RD / 2 + .1, 1.7, 2.3, 8.5, .11); shaft(RW / 2 + .05, 1.62, -1.05, .9, 1.4, 6.5, .12); }

/* everything above is placed; the scenario starts once the props and the sky are in (with a time-out, never blocks) */
const SHED_READY = Promise.race([Promise.allSettled([...SHED_PROPS, SHED_HDRI, ...SHED_TEX]), new Promise(r => setTimeout(r, 15000))]);
window.__shed = { world, sun, THREE };                         // debug handle (raycasts in tests)
