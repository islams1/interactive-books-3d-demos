# Builds C:\book\fp-extinguisher\saf01.html from index.html (re-runnable). Every anchor must match exactly once.
import io, os, sys
ROOT = r'C:\book\fp-extinguisher'
SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src')
f = io.open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
part = lambda n: io.open(os.path.join(SRC, n), encoding='utf-8').read()


def rep(a, b, count=1):
    global f
    n = f.count(a)
    if n != count: sys.exit(f'ANCHOR x{n} (want {count}): {a[:90]!r}')
    f = f.replace(a, b)


def cut(start, end, repl='', keep_end=True):
    """replace text from `start` up to (not incl.) `end` with repl"""
    global f
    i = f.find(start); j = f.find(end, i + 1)
    if i < 0 or j < 0 or f.count(start) != 1: sys.exit(f'CUT anchors: {start[:70]!r} .. {end[:50]!r} ({i},{j})')
    f = f[:i] + repl + f[j:]


# ---- page, css, html ----
rep('<title>Extinguisher Drill</title>', '<title>SAF-01 · The Wrong Extinguisher</title>')
rep('@media (max-width:820px){ #log,#pass{display:none} #obj{width:auto;right:16px} #stats{display:none} }', '''@media (max-width:820px){ #log,#pass{display:none} #obj{width:auto;right:16px} #stats{display:none} }
/* SAF-01: subtitles, choices, the look card, endings */
#sub{position:fixed;left:50%;bottom:150px;transform:translateX(-50%);width:max-content;max-width:min(780px,90vw);padding:10px 16px;font-size:16px;line-height:1.6;text-align:center;opacity:0;transition:opacity .2s}
#sub.on{opacity:1}
#sub b,#choices .q b,#look b{display:block;font:700 11px var(--mono);letter-spacing:.14em;color:var(--acc);text-transform:uppercase;margin-bottom:2px}
body.ar #sub b,body.ar #choices .q b,body.ar #look b{font:700 13px var(--ar);letter-spacing:0}
#sub[data-who=you] b{color:#7fc8ff} #sub[data-who=look] b{color:var(--mute)}
#choices{position:fixed;left:50%;bottom:118px;transform:translateX(-50%);width:min(640px,92vw);display:none;flex-direction:column;gap:6px;pointer-events:auto;z-index:6}
#choices.on{display:flex}
#choices .q{padding:9px 14px;font-size:15.5px;line-height:1.55}
#choices button{display:flex;gap:10px;align-items:center;padding:9px 12px;text-align:start;font-size:14.5px;line-height:1.45}
#choices button:hover{border-color:var(--acc)} #choices button .kc{flex:none}
#look{position:fixed;left:50%;top:15%;transform:translateX(-50%);width:min(520px,90vw);padding:11px 15px;font-size:14.5px;line-height:1.6;opacity:0;transition:opacity .2s;border-color:rgba(255,255,255,.25)}
#look.on{opacity:1}
#fade{position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;z-index:8;transition:opacity 1.4s}
#result .card{width:min(780px,94vw);scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.22) transparent}
.dl{margin:10px 0 4px} .dl ul{list-style:none;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:5px;margin-top:6px}
.dl li{padding:5px 10px;border-radius:6px;border:1px solid var(--line);font-size:13px;line-height:1.45}
.dl li.good{border-color:rgba(60,207,126,.55)} .dl li.bad{border-color:rgba(255,176,32,.6)}
.warn{color:var(--warn)} #rLesson{margin-top:10px;color:#f0ebe2} #rLimits{line-height:1.6}''')
rep('  <div id="toast" class="glass"></div>', '''  <div id="toast" class="glass"></div>
  <div id="sub" class="glass"><b id="subWho"></b><span id="subTxt"></span></div>
  <div id="choices"></div>
  <div id="look" class="glass"><b id="lookWho"></b><span id="lookTxt"></span></div>''')
rep('<canvas id="c"></canvas>', '<canvas id="c"></canvas>\n<div id="fade"></div>')
rep('''    <div class="metrics" id="rMetrics"></div>
    <div class="btns"><button class="btn" id="btnAgain" data-t="again"></button></div>''', '''    <div id="rMetrics"></div>
    <p id="rLesson"></p>
    <p class="note" id="rLimits"></p>
    <div class="btns"><button class="btn" id="btnStep2" data-t="step2btn"></button><button class="btn ghost" id="btnAgain" data-t="again"></button></div>''')

# ---- quality / lights: an 11:00 shed lit through the door and a window ----
rep("const FOG = new THREE.Color(0x26252a);", "const FOG = new THREE.Color(0xc4cfd8);          // SAF-01: bright late-morning haze outside the door")
rep("world.fog = new THREE.FogExp2(FOG.clone(), 0.012);", "world.fog = new THREE.FogExp2(FOG.clone(), 0.006);")
rep("const hemi = new THREE.HemisphereLight(0xdfe4ea, 0x3b342b, .65); world.add(hemi);", "const hemi = new THREE.HemisphereLight(0xdfe4ea, 0x4a3f30, .42); world.add(hemi);")
rep("const sun = new THREE.DirectionalLight(0xfff1df, 1.15);\nsun.position.set(2.5, 9, 3.5); sun.target.position.set(0, 0, -1);",
    "const sun = new THREE.DirectionalLight(0xfff1df, 2.6);          // 11:00 sun, in through the open door and the window\nsun.position.set(4.5, 7.5, 10); sun.target.position.set(0, 0, -1);")
rep("Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 7, bottom: -7, near: 1, far: 20 });", "Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 9, bottom: -9, near: 1, far: 32 });")

# ---- section 3: the warehouse -> the farm shed ----
cut('/* =====================================================================\n   3. THE WAREHOUSE', '/* =====================================================================\n   4. EXTINGUISHER', part('shed.js') + '\n')
# the extinguisher keeps handles on its label + horn (to show water / dry powder / CO₂)
rep("  mk(new THREE.CylinderGeometry(.0868, .0868, .21, 40, 1, true, -.95, 1.9), std(0xffffff, .5, 0, { map: labelTex }), g, [0, .25, 0]);",
    "  const label = mk(new THREE.CylinderGeometry(.0868, .0868, .21, 40, 1, true, -.95, 1.9), std(0xffffff, .5, 0, { map: labelTex }), g, [0, .25, 0]);")
rep("  mk(horn, black, nozzle, [0, 0, -.056]);", "  const hornM = mk(horn, black, nozzle, [0, 0, -.056]);")
rep("  return { g, lever, pin, needle, nozzle, tip, tail, hose, grips, red };", "  return { g, lever, pin, needle, nozzle, tip, tail, hose, grips, red, label, horn: hornM };")
rep("ext.position.copy(EXT_HOME); ext.rotation.y = Math.PI / 2;", "ext.position.copy(EXT_HOME); ext.visible = false;            // SAF-01: shown once you take one of the three from the wall")

# ---- the cast ----
cut('const WORKERS = [', 'const crowd = { list: [], clips: {} };', part('workers.js'))
rep("        if (part === 'opacity') return new THREE.MeshStandardMaterial({ map: tex(base + '_color.png', true), alphaTest: .5, side: THREE.DoubleSide, roughness: .8 });",
    "        if (part === 'opacity') return w.tex ? new THREE.MeshBasicMaterial({ visible: false }) : new THREE.MeshStandardMaterial({ map: tex(base + '_color.png', true), alphaTest: .5, side: THREE.DoubleSide, roughness: .8 });")
rep("        return new THREE.MeshStandardMaterial({ userData: { part }, map:", "        if ((w.hide || []).includes(part)) return new THREE.MeshBasicMaterial({ visible: false, userData: { part } });\n        return new THREE.MeshStandardMaterial({ userData: { part }, map:")
rep("map: tex(base + '_color.jpg', true), normalMap: tex(base + '_normal.jpg', false),", "map: tex(w.tex ? w.tex[0] : base + '_color.jpg', true), normalMap: tex(w.tex ? w.tex[1] : base + '_normal.jpg', false),")
rep("...[...w.script, ...w.after].filter(s => s.clip).map(s => s.clip)", "...[...w.script, ...(w.after || [])].filter(s => s.clip).map(s => s.clip)")
rep("    if (c.chase) { chaseStep(c, dt); placeWorker(c); c.mixer.update(dt); if (c.relax) c.relax(dt, false); continue; }\n", "    if (c.gone) continue;\n")
rep("    if (fire.out && !c.calm) {", "    if (fire.out && !c.calm && c.w.after) {")
rep("      if (s.face) turnTo(c, s.face[0], s.face[1], dt, 3);", "      if (c.turnTo) turnTo(c, c.turnTo.x, c.turnTo.z, dt, 3); else if (s.face) turnTo(c, s.face[0], s.face[1], dt, 3);")
rep("""          c.pos.x = clamp(c.pos.x + Math.sin(c.yaw) * Math.min(v, L), -RW / 2 + .4, RW / 2 - .4);
          c.pos.z = clamp(c.pos.z + Math.cos(c.yaw) * Math.min(v, L), -RD / 2 + .4, RD / 2 - .4);""",
"""          const nx = c.pos.x + Math.sin(c.yaw) * Math.min(v, L), nzz = c.pos.z + Math.cos(c.yaw) * Math.min(v, L);   // scripted paths (s.free) may leave the shed: the door, the office
          c.pos.x = s.free ? nx : clamp(nx, -RW / 2 + .4, RW / 2 - .4); c.pos.z = s.free ? nzz : clamp(nzz, -RD / 2 + .4, RD / 2 - .4);""")
rep("    if (c.look) c.look(dt);\n  }\n}", "    if (c.look) c.look(dt);\n    npcLook(c, dt);\n  }\n}")
# the slap / chase / shout feature is not part of this situation
cut('/* ---- the scanned man: T = slap.', '/* ---- Gaussian-splat head (scanned person)', part('npc.js') + '\n')
# the old scan-head / GLB avatar paths are unused here (the woman is not in this situation); relaxPose stays
cut('/* ---- Gaussian-splat head (scanned person)', 'function relaxPose(c, kk = 1) {')
cut('const SPLAT_FIT = ', '/* ---- full-body figure (assets/fullbody')
# Eng. Karim can look at whoever is speaking (c.lookAt), not only at you
rep("  const youW = camera.getWorldPosition(new V3()).sub(f.H.getWorldPosition(new V3())), dist = youW.length();",
    "  const lt = f.c.lookAt, ltP = lt && lt !== 'player';                         // SAF-01: the speaker, when someone else talks\n  const youW = (ltP ? lt.clone() : camera.getWorldPosition(new V3())).sub(f.H.getWorldPosition(new V3())), dist = youW.length();")
rep("  const near = chasing || (dist < (walking ? 3 : 4.5) && Math.abs(youY) < 1.45);", "  const near = chasing || ltP || (dist < (walking ? 3 : 4.5) && Math.abs(youY) < 1.45);\n  if (ltP) { g.mode = 'you'; g.next = Math.max(g.next, g.t + 1); }")

# ---- particles: a faint dust drift in the door light (the draught) ----
rep("const spray = new PSys(QUAL.high.spray, [[.97, .97, .94], [.9, .9, .87], [.82, .82, .8]], false);",
    "const spray = new PSys(QUAL.high.spray, [[.97, .97, .94], [.9, .9, .87], [.82, .82, .8]], false);\nconst dust = new PSys(90, [[1, .94, .8], [1, .94, .8], [1, .94, .8]], true);        // SAF-01: dust in the door light shows the draught")

# ---- sim state ----
rep("const LIMIT = 90;", "const LIMIT = 600;                                      // SAF-01: ~10 minutes, no time-out (the clock counts up)")
rep("const player = { pos: new V3(.4, 0, 4.4), vel: new V3(), yaw: 0, pitch: -.05,", "const player = { pos: new V3(0, 0, 2.4), vel: new V3(), yaw: 0, pitch: -.08,")
rep("const fire = { health: .72, out: false, hitT: 0 };", "const fire = { health: .3, out: false, hitT: 0, spread: 0 };   // a small fire at the board; spread = ending 3 (straw)")
rep("let smokeLevel = .12;", "let smokeLevel = .05;")
rep("""    if (type === 'fire_out') endGame(true, 'r_win');
    if (type === 'time_up') endGame(false, 'r_time');
    if (type === 'extinguisher_empty' && !fire.out) setTimeout(() => { if (!fire.out && !sim.ended) endGame(false, 'r_empty'); }, 2500);""",
"""    if (type === 'fire_out') SAF.onFireOut();
    if (type === 'extinguisher_empty' && !fire.out) SAF.onEmpty();""")
rep("    if (['pin_slip', 'too_close', 'extinguisher_empty', 'time_up'].includes(e.type)) li.className = 'warn';", "    if (['pin_slip', 'too_close', 'extinguisher_empty', 'mistake', 'flame_jumped'].includes(e.type) || e.good === false) li.className = 'warn';")

# ---- input: E looks / takes, 1-3 answer when a question is open, no T ----
rep("  if (e.code === 'KeyE') tryTake();", "  if (e.code === 'KeyE' && !safUseE()) tryTake();")
rep("  if (e.code === 'KeyT') trySlap();\n", "")
rep("  if (gi >= 0) H.gesture = H.gesture === GEST_KEYS[gi] ? null : GEST_KEYS[gi];",
    "  const ci = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4'].indexOf(e.code);\n  if (ci >= 0 && SAF.choice) { SAF.pick(ci % 4); return; }\n  if (gi >= 0) H.gesture = H.gesture === GEST_KEYS[gi] ? null : GEST_KEYS[gi];")
rep("function lock() { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }",
    "function lock() { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }\ncanvas.addEventListener('click', () => { if (sim.started && !input.locked && !sim.ended && !sim.demo) lock(); });")

# ---- hands: no slap swing ----
cut("  if (SLAP.t < SLAP.dur) {", "  cur.R.ab = lerp(cur.R.ab || 0")

# ---- fire: small at the board, grows slowly, drifts with the draught; water on the board = the flame jumps ----
rep("    if (sim.t - fire.hitT > .6) fire.health = Math.min(1, fire.health + dt * .012);",
    "    if (sim.t - fire.hitT > .6) fire.health = Math.min(Math.max(fire.health, SAF.fireCap), fire.health + dt * SAF.fireGrow);")
rep("  const hp = fire.health, R = .3 + .55 * hp;", "  const hp = fire.health, R = .18 + .45 * hp;")
rep("flames.spawn(F.x + Math.cos(a) * r, .2 + rnd() * .5, F.z + Math.sin(a) * r,", "flames.spawn(F.x + Math.cos(a) * r, FIRE_Y0 + rnd() * .3, F.z + Math.sin(a) * r,")
rep("  flames.update(dt, (i, k, d) => {", """  if (fire.spread) {                                     // SAF-01 ending 3: the flame has jumped to the straw
    fire.spread = Math.min(1, fire.spread + dt * .35);
    let k = dt * 220 * fire.spread * (q.flames / QUAL.high.flames);
    while (k-- > 1) { const a = rnd() * TAU, r = Math.sqrt(rnd()) * (.4 + .55 * fire.spread); flames.spawn(STRAW.x + Math.cos(a) * r, .15 + rnd() * .75 * fire.spread, STRAW.z + Math.sin(a) * r * .55, (rnd() - .5) * .3, 1 + rnd() * 1.4, (rnd() - .5) * .3, (.5 + rnd() * .5) * (.7 + fire.spread * .7), .5 + rnd() * .5); }
    sAcc += dt * 40 * fire.spread; smokeLevel = Math.min(1, smokeLevel + dt * .06 * fire.spread);
  }
  flames.update(dt, (i, k, d) => {""")
rep("smoke.spawn(F.x + (rnd() - .5) * .6, 1.3 + rnd() * .5, F.z + (rnd() - .5) * .6,", "smoke.spawn(F.x + (rnd() - .5) * .6, .75 + rnd() * .5, F.z + .1 + (rnd() - .5) * .5,")
rep("    v[i * 3] = clamp(v[i * 3], -.8, .8); v[i * 3 + 2] = clamp(v[i * 3 + 2], -.8, .8);",
    "    v[i * 3] += WIND.x * .3 * d; v[i * 3 + 2] += WIND.z * .3 * d;          // the draught pushes the smoke away from the door\n    v[i * 3] = clamp(v[i * 3], -.8, .8); v[i * 3 + 2] = clamp(v[i * 3 + 2], -.8, .8);")
rep("        spray.flag[i] = 1; v[i * 3] *= .25; v[i * 3 + 1] *= .25; v[i * 3 + 2] *= .25;\n        fire.health -= (y < .8 ? .00055 : .00008) * hitScale;               // the base matters, the flames barely",
    "        spray.flag[i] = 1; v[i * 3] *= .25; v[i * 3 + 1] *= .25; v[i * 3 + 2] *= .25;\n        if (SAF.extType === 'water') SAF.waterHit = true;                 // water on an electrical board: no effect here — the flame jumps\n        else fire.health -= (y < .8 ? .00055 : .00008) * hitScale;           // the base matters, the flames barely")
rep("  // fire light flicker", """  dAcc += dt * 16;                                        // dust drifting in on the draught
  while (dAcc > 1) { dAcc--; dust.spawn((rnd() - .5) * 1.6, .25 + rnd() * 1.9, RD / 2 - .1 - rnd() * 1.8, WIND.x * .3 + (rnd() - .5) * .08, (rnd() - .5) * .05, WIND.z * .3 + (rnd() - .5) * .08, .012 + rnd() * .016, 6 + rnd() * 4); }
  dust.update(dt, (i, k) => { dust.size[i] = dust.s0[i]; dust.al[i] = .5 * Math.min(1, k * 4) * (1 - k); });
  // fire light flicker""")
rep("let fAcc = 0, sAcc = 0, pAcc = 0;", "let fAcc = 0, sAcc = 0, pAcc = 0, dAcc = 0;")
rep("  const fl = hp * (26 + nz(sim.t * 9) * 9);", "  const fl = hp * (18 + nz(sim.t * 9) * 7) + fire.spread * 40;")
rep("  world.fog.density = .01 + smokeLevel * .045 + emo.smokeHead * .05;", "  world.fog.density = .004 + smokeLevel * .04 + emo.smokeHead * .05;")

# ---- HUD ----
cut('function objective() {', 'function prompt() {', 'function objective() { return safObjective(); }\n')
rep("  { const m = theMan(); if (sim.running && m && manInReach(m)) return ['T', T('p_slap')]; }", "  if (SAF.cine || SAF.ended || SAF.choice) return null;          // no key hints over a cut-scene or a question\n  if (SAF.target) return ['E', safPrompt(SAF.target)];")
rep("  const left = Math.max(0, LIMIT - sim.t);\n  $('#timer').textContent = fmt(left); $('#timer').classList.toggle('low', left < 20);", "  $('#timer').textContent = fmt(sim.t);")
cut('function endGame(win, reasonKey) {', 'function showMenu(v) {')
rep("['P', 'c_p'], ['RMB', 'c_hose'], ['LMB', 'c_sq'], ['G', 'c_drop'], ['Esc', 'c_esc']];", "['P', 'c_p'], ['RMB', 'c_hose'], ['LMB', 'c_sq'], ['1 - 3', 'c_choose'], ['G', 'c_drop'], ['Esc', 'c_esc']];")
rep("['E', 'h_use'], ['1-6', 'h_gest'], ['T', 'h_slap']]", "['E', 'h_use'], ['1-3', 'h_choose'], ['1-6', 'h_gest']]")
rep("  renderLog();\n}\nfunction applyQuality() {", "  renderLog();\n  safRelang();\n}\nfunction applyQuality() {")
rep("$('#btnAgain').onclick = () => location.reload();", "$('#btnAgain').onclick = () => { location.href = location.pathname + '?lang=' + LANG; };\n$('#btnStep2').onclick = () => { location.href = location.pathname + '?step=2&lang=' + LANG; };   // ending 3: Eng. Karim restarts you at step 2")

# ---- demo = the scenario autopilot ----
cut('const DEMO = [', 'const demo = { i: -1, t: 0 };', 'const DEMO = [];                                        // SAF-01: the demo button runs the scenario autopilot (SAF.auto)\n')
rep("  sim.demo = true; sim.running = true; sim.started = true; demo.i = -1; demo.t = 0;", "  sim.demo = true; sim.running = true; sim.started = true; demo.i = -1; demo.t = 0; SAF.auto = true;")
rep("  sim.demo = false; demoCtl.move = null; demoCtl.look = null; demoCtl.sweep = 0; H.squeezeHeld = false;", "  sim.demo = false; demoCtl.move = null; demoCtl.look = null; demoCtl.sweep = 0; H.squeezeHeld = false; SAF.auto = false; SAF.drive = null;")

# ---- the scenario module (before the main loop) ----
rep("/* =====================================================================\n   18. MAIN LOOP", part('saf.js') + "\n/* =====================================================================\n   18. MAIN LOOP")

# ---- main loop ----
rep("    if (live && sim.t >= LIMIT && !fire.out) Engine.dispatch('time_up');", "    if (live) updateSAF(dt);")
rep("  updateSlap(dt);\n", "")
rep("  if (draw) updateSplatHeads();\n", "")

# ---- start-up: Eng. Karim's figure, the wall rack, test hooks ----
rep("for (const t of [signTex, exitTex, labelTex]) t.userData.redraw();", "for (const t of [signTex, exitTex, labelTex, officeSignTex, dieselTex, ...Object.values(EXT_LABEL), ...Object.values(EXT_SIGN)]) t.userData.redraw();")
cut("try {\n  const fw = crowd.list.find(c => c.w.av === 'Construction_Female_01');", "applyLang(); applyQuality();", """try {
  const k = crowd.list.find(c => c.w.man);                // Eng. Karim: the scanned full-body man in the suit
  if (k) await attachFullBody(k, { base: params.get('manfig') || 'assets/fullbody/man/figure', name: 'karim', skin: FB_SKIN_MAN, phys: { hair: 'short', cloth: 'tie' } });
} catch (e) { console.warn('Eng. Karim figure not loaded:', e); }
buildWallRack();
""")
i = f.find("if (WARM) { document.body.dataset.state = JSON.stringify({ state: H.state")
j = f.find("\n", i)
f = f[:i] + "if (WARM) document.body.dataset.state = JSON.stringify({ step: SAF.step, obj: SAF.obj, q: SAF.q.map(a => a.say || (a.ask && a.qk) || (a.wait !== undefined ? 'wait' : a.until ? 'until' : 'run')), mistakes: SAF.mistakes, log: SAF.log, fire: +fire.health.toFixed(2), H: [H.state, H.ext], npc: crowd.list.map(c => [c.w.id, +c.pos.x.toFixed(1), +c.pos.z.toFixed(1), !!c.gone]) });" + f[j:]
cut("if (params.get('slap') === '1' && theMan()) {", "clock.getDelta();")

# STR: drop the slap texts; ACT entries for the scenario events
rep("  p_slap: ['اضغط T للقلم', 'Press T to slap'], h_slap: ['للقلم', 'slap'],\n", "")
rep("Object.assign(ACT, { decision: ['قرار', 'decision'],", "Object.assign(ACT, { alarm: ['نبّه', 'alarm raised'], flame_jumped: ['اللهب نط على القش', 'flame jumped to the straw'], report: ['بلّغ', 'reported'], decision: ['قرار', 'decision'],")

# depth pre-pass: the list of particle systems to skip was only filled when renderFullBodies made the target itself; updateFullBodies
# makes it first, so the list stayed empty and smoke/dust points were drawn as depth squares over Karim. Refill it when the world changes.
rep("  if (!FBR.rt) { fbResize(); world.traverse(o => { if (o.isPoints || o.isSprite) FBR.noDepth.push(o); }); }",
    "  if (!FBR.rt) fbResize();\n  if (FBR.ndN !== world.children.length) { FBR.ndN = world.children.length; FBR.noDepth.length = 0; world.traverse(o => { if (o.isPoints || o.isSprite || (o.isMesh && !Array.isArray(o.material) && o.material.depthWrite === false)) FBR.noDepth.push(o); }); }")   # + light shafts / decals / cobwebs: never in front of a figure's depth

# ---- real CO2 extinguishers have no pressure gauge (powder / water keep theirs) ----
rep("function setExtType(E, type) {", "function setExtType(E, type) {" + chr(10) + "  E.needle.parent.visible = type !== 'co2';")

# ---- the photoreal shed (src/shed.js): HDRI loader import; the cast waits until the props and the sky are in ----
rep("import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';", "import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';\nimport { RGBELoader } from 'three/addons/loaders/RGBELoader.js';")
rep("try { await loadWorkers(); } catch (e) { console.warn('workers not loaded:', e); }", "try { await SHED_READY; } catch (e) { console.warn('shed props:', e); }\ntry { await loadWorkers(); } catch (e) { console.warn('workers not loaded:', e); }")

io.open(os.path.join(ROOT, 'saf01.html'), 'w', encoding='utf-8').write(f)
print('saf01.html written', len(f), 'chars', f.count('\n'), 'lines')
