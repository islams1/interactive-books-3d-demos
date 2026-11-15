/* =====================================================================
   SAF-01 · THE WRONG EXTINGUISHER — the situation: dialogue, choices, the three steps, scoring, endings.
   A training simulation in a made-up shed, not a real emergency procedure (see the Limits on the end panel).
   Flow: a queue of actions — { say }, { ask }, { wait }, { until }, { run } — processed every tick of sim time,
   so it also runs (deterministically) during the headless ?warm= fast-forward.
   ===================================================================== */
Object.assign(STR, {
  kicker: ['موقف SAF-01 · تدريب سلامة', 'Situation SAF-01 · safety training'],
  title: ['الطفاية الغلط', 'The Wrong Extinguisher'],
  intro: ['مخزن مزرعة، الساعة 11 الصبح. الباب وراك ومفتوح. دخان طالع من مشترك كهربا محمّل فوق طاقته، جنبه شكاير قش وبرميل سولار. على الحيطة 3 طفايات: مية (الحمرا، الأقرب)، بودرة جافة، وCO₂. محمود زميلك جنب الباب، عم فتحي شغال جوه، وم. كريم المشرف في المكتب اللي جنبكم. نبّه الأول، بُص قبل ما تختار، استخدم الطفاية صح، وبلّغ.',
          'A farm shed at 11:00. The door is behind you and clear. Smoke is coming from an overloaded extension board next to straw sacks and a diesel drum. Three extinguishers hang on the wall: water (red, the nearest), dry powder and CO₂. Mahmoud, your classmate, is near the door; Mr. Fathy works inside; Eng. Karim, the supervisor, is in the next office. Raise the alarm, look before you choose, use it properly, and report.'],
  note: ['محتاج كيبورد وماوس. الاختيارات بالأرقام 1–3 (أو بالماوس لو المؤشر ظاهر). تدريب فصل بسيط — مش إجراء حريق معتمد.',
         'Needs a keyboard and mouse. Choices with the number keys 1–3 (or the mouse when the pointer is free). A basic classroom game — not an approved fire procedure.'],
  demo: ['شوف الحل الصحيح', 'Watch a strong run'], time: ['الوقت', 'Time'],
  obj_s1: ['الخطوة 1 — نبّه: الناس والتبليغ الأول', 'Step 1 — Raise the alarm: people and the alarm first'],
  obj_wait: ['محمود بينادي م. كريم…', 'Mahmoud is fetching Eng. Karim…'],
  obj_s2: ['الخطوة 2 — بُص (E) على اللي بيولّع واللي جنبه، وبعدين خد طفاية من على الحيطة وقول ليه', 'Step 2 — Look (E) at what is burning and what is near it, then take one extinguisher from the wall and say why'],
  obj_s3: ['الخطوة 3 — استخدمها', 'Step 3 — Use it'], obj_take: ['خد الطفاية', 'Take the extinguisher'],
  obj_rep: ['بلّغ م. كريم', 'Report to Eng. Karim'],
  o_draught: ['اقف والهوا في ضهرك (ناحية الباب)، على بُعد 2–3 متر', 'Stand with the draught behind you (door side), 2–3 m away'],
  p_look: ['بُص على', 'Look at'], p_pickx: ['خد', 'Take'],
  t_draught: ['خلي الهوا في ضهرك — اقف ناحية الباب', 'Keep the draught behind you — stand on the door side'],
  c_choose: ['اختار رد', 'Pick an answer'], h_choose: ['اختار', 'choose'], c_take: ['بُص / خد', 'Look / take'],
  lesson: ['الدرس: بُص قبل ما تمسك. المية مش بتتستخدم على حريق كهربا؛ الدليل بيقول البودرة الجافة مناسبة له. (المصدر: دليل الطالب، الوحدة 1، الدرس 1)',
           'Lesson: look before you grab. Water is not used on an electrical fire; the guide says dry powder suits it. (Source: Student Guide, Unit 1, lesson 1)'],
  limits: ['حدود: دي لعبة فصل بسيطة، مش تقييم معتمد ولا إجراء حريق. في حريق حقيقي: نبّه الناس، اطلع برّه، واطلب المساعدة. ضابط دفاع مدني أو لجنة السلامة في المدرسة لازم يراجعوا الصياغة قبل الاستخدام.',
           'Limits: this is a basic classroom game, not an approved assessment or fire procedure. In a real fire: warn people, get out, call for help. A civil-defence officer or the school safety committee should check the wording before use.'],
  again: ['ابدأ من الأول', 'Start again'], step2btn: ['م. كريم يرجّعك للخطوة 2', 'Eng. Karim restarts you at step 2'],
  dec_h: ['قراراتك', 'Your decisions'], mis_h: ['اللي فاتك (اللعبة بتقولك)', 'What you missed (the game tells you which)'], none: ['ولا حاجة — كله صح', 'Nothing — all correct'],
});
Object.assign(ACT, { decision: ['قرار', 'decision'], mistake: ['ملاحظة', 'noted'], inspect: ['بص على', 'looked at'], choose_extinguisher: ['اختار طفاية', 'chose an extinguisher'], ending: ['النهاية', 'ending'] });

const L2 = p => p ? p[LANG === 'ar' ? 0 : 1] : '';
const WHO = { mahmoud: ['محمود', 'Mahmoud'], fathy: ['عم فتحي', 'Mr. Fathy'], karim: ['م. كريم', 'Eng. Karim'], you: ['أنت (أحمد)', 'You (Ahmed)'],
  s1: ['الخطوة 1 — نبّه', 'Step 1 — Raise the alarm'], s2: ['الخطوة 2 — بُص، وبعدين اختار', 'Step 2 — Look, then choose'], look: ['بتبص', 'You look'], narr: ['', ''] };
const OBJ_NAMES = { board: ['المشترك الكهربا', 'the extension board'], straw: ['شكاير القش', 'the straw sacks'], diesel: ['برميل السولار', 'the diesel drum'],
  water: ['طفاية المية (الحمرا)', 'the water extinguisher (red)'], powder: ['طفاية البودرة الجافة', 'the dry powder extinguisher'], co2: ['طفاية CO₂', 'the CO₂ extinguisher'] };
const TXT = {
  fathy_open: ['البوردة بتطلّع دخان! بسرعة — الحمرا جنبك أهي، امسكها!', 'The board is smoking! Quick — the red one is right there, grab it!'],
  q_s1: ['بتعمل إيه الأول؟', 'What do you do first?'],
  o1_both: ['محمود، كلّم م. كريم حالًا. وعم فتحي، اطلع برّه دلوقتي.', 'Mahmoud, call Eng. Karim now. Mr. Fathy, get out now.'],
  o1_fathy: ['عم فتحي، اطلع برّه بسرعة.', 'Mr. Fathy, get out quickly.'],
  o1_grab: ['هجيب الحمرا وأطفيها على طول.', "I'll grab the red one and put it out right away."],
  mah_sure: ['متأكد؟ مش الأول نطلّع عم فتحي ونبلّغ م. كريم؟', "Are you sure? Shouldn't we get Mr. Fathy out and tell Eng. Karim first?"],
  o_fix_alarm: ['عندك حق — كلّم م. كريم، وعم فتحي يطلع برّه.', "You're right — call Eng. Karim, and Mr. Fathy, get out."],
  o_no_time: ['لا، مفيش وقت.', "No, there's no time."],
  mah_anyway: ['طيب، أنا هنادي م. كريم بردو. عم فتحي، اطلع برّه!', "OK — I'll fetch Eng. Karim anyway. Mr. Fathy, get out!"],
  mah_callq: ['أنادي م. كريم؟', 'Should I fetch Eng. Karim?'], o_yes_call: ['أيوه، ناديه حالًا.', 'Yes, get him now.'],
  mah_ok: ['حاضر، هناديه.', "On it — I'll get him."], fathy_ok: ['ماشي، أنا طالع.', "Right, I'm going out."],
  karim_arrive: ['أنا هنا. إنت اللي شفتها الأول — بُص على اللي بيولّع واللي جنبه قبل ما تختار.', "I'm here. You saw it first — look at what is burning and what is near it before you choose."],
  ins_board: ['مشترك كهربا محمّل فوق طاقته — فيشات كتير على بوردة واحدة. اللي بيولّع هنا كهربا.', 'An overloaded extension board — too many plugs on one board. What is burning here is electrical.'],
  ins_straw: ['شكاير قش ناشف لازقة في البوردة — بتمسك نار بسرعة.', 'Dry straw sacks right next to the board — they catch fire fast.'],
  ins_diesel: ['برميل سولار — سائل قابل للاشتعال.', 'A diesel drum — a flammable liquid.'],
  q_reason_water: ['خدت طفاية المية. ليه؟', 'You took the water extinguisher. Why?'],
  q_reason_powder: ['خدت طفاية البودرة الجافة. ليه؟', 'You took the dry powder extinguisher. Why?'],
  q_reason_co2: ['خدت طفاية CO₂. ليه؟', 'You took the CO₂ extinguisher. Why?'],
  r1: ['النار كهربا (البوردة) — والنوع ده مناسب لها.', "It's an electrical fire (the board) — this type suits it."],
  r2: ['دي الأقرب — مفيش وقت.', "It's the nearest — no time to lose."],
  r3: ['دي أكبر واحدة.', "It's the biggest one."],
  mah_electric: ['استنى — دي كهربا؟', 'Wait — is it electrical?'],
  w_change: ['عندك حق — هختار واحدة تانية.', "You're right — I'll pick another one."], w_insist: ['متأكد، هرش مية.', "I'm sure — water."],
  karim_co2: ['دي لحرايق السوائل القابلة للاشتعال. الدليل بيقول البودرة الجافة مناسبة لحرايق الكهربا.', 'That one is for flammable-liquid fires. The guide says dry powder suits electrical fires.'],
  karim_reason: ['اختيار صح — بس السبب: النار كهربا، والبودرة الجافة مناسبة لها.', "Right choice — but the reason is: it's an electrical fire, and dry powder suits it."],
  karim_good: ['صح. حريق كهربا — بودرة جافة.', 'Right. An electrical fire — dry powder.'],
  karim_go: ['اشد المسمار، اقف والهوا في ضهرك، ووجّه على قاعدة النار. اضغط وحرّك يمين وشمال.', 'Pull the pin, stand with the draught behind you and aim at the base. Squeeze and sweep side to side.'],
  adv_jump: ['المية لمست البوردة — واللهب نط على القش!', 'The water hit the board — and the flame jumped to the straw!'],
  karim_out: ['كله برّه! اطلعوا حالًا!', 'Everyone out — now!'],
  karim_rep: ['خلاص طفيت. قولّي حصل إيه؟', "It's out. Tell me what happened."],
  p_full: ['هقولك بالتفصيل.', "I'll give you the full report."], p_short: ['"طفيت وخلاص."', '"It\'s out."'],
  q_what: ['إيه اللي ولّع؟', 'What burned?'], w_board: ['المشترك الكهربا.', 'The extension board.'], w_straw: ['شكاير القش.', 'The straw sacks.'], w_diesel: ['برميل السولار.', 'The diesel drum.'],
  q_which: ['استخدمت أنهي طفاية؟', 'Which extinguisher did you use?'], x_powder: ['البودرة الجافة.', 'Dry powder.'], x_water: ['المية.', 'Water.'], x_co2: ['CO₂.', 'CO₂.'],
  q_cause: ['السبب المحتمل؟', 'The likely cause?'], c_plugs: ['فيشات كتير على بوردة واحدة.', 'Too many plugs on one board.'], c_smoke: ['حد كان بيدخّن.', 'Someone was smoking.'], c_leak: ['السولار سرّب.', 'The diesel leaked.'],
  karim_end1: ['النار انطفت في لحظات. هنقل الفيشات على برايز منفصلة.', "The fire was out in moments. I'll move the plugs to separate sockets."],
  karim_end2: ['وصلت في الآخر. بُص على الملاحظات.', 'You got there in the end. Look at the notes.'],
  karim_empty: ['الطفاية خلصت — ارجع، أنا هكمّل.', "It's empty — step back, I'll finish it."],
};
const MIST = {
  alarm_late: ['التبليغ اتأخر — م. كريم اتنادى بعد ما محمود سأل.', 'The alarm came late — Eng. Karim was only fetched after Mahmoud asked.'],
  grab_first: ['جريت على الطفاية قبل الناس والتبليغ (ورجعت عنها).', 'You went for an extinguisher before people and the alarm (you corrected it).'],
  grab_insist: ['جريت على الطفاية قبل الناس والتبليغ.', 'You went straight for an extinguisher before people and the alarm.'],
  no_look: ['اخترت قبل ما تبص على اللي بيولّع.', 'You chose before looking at what was burning.'],
  water_first: ['اخترت المية الأول لحريق كهربا (وغيّرت بعد سؤال محمود).', 'You picked water for an electrical fire first (you changed after Mahmoud asked).'],
  co2_first: ['اخترت CO₂ الأول — ده لحرايق السوائل القابلة للاشتعال.', 'You picked CO₂ first — it is for flammable-liquid fires.'],
  reason: ['الطفاية صح، بس السبب اللي قلته مش هو.', 'Right extinguisher, but not the right reason.'],
  downwind: ['رشيت والهوا مش في ضهرك.', 'You sprayed without the draught behind you.'],
  aim: ['معظم الرش مكانش على قاعدة النار.', 'Most of the spray was not at the base of the fire.'],
  no_sweep: ['محركتش يمين وشمال وانت بترش.', 'You did not sweep from side to side.'],
  report_short: ['التقرير كان "طفيت وخلاص" بس.', 'Your report was only "it\'s out".'],
  report_what: ['في التقرير: اللي ولّع مش مظبوط.', 'In the report: what burned was wrong.'],
  report_which: ['في التقرير: نوع الطفاية مش مظبوط.', 'In the report: the extinguisher was wrong.'],
  report_cause: ['في التقرير: السبب مش مظبوط (فيشات كتير على بوردة واحدة).', 'In the report: the cause was wrong (too many plugs on one board).'],
  empty: ['الطفاية خلصت قبل ما النار تطفى — م. كريم كمّل.', 'The extinguisher ran out before the fire was out — Eng. Karim finished it.'],
};
const ENDINGS = {
  1: { t: ['اختيار صح، وترتيب صح', 'Right tool, right order'], x: ['الناس الأول، سبب لاختيارك، بودرة جافة، الخطوات بالترتيب، وتقرير كامل. النار انطفت في لحظات، وم. كريم نقل الفيشات على برايز منفصلة.', 'People first, a reason for your choice, dry powder, the steps in order and a full report. The fire was out in moments. Eng. Karim moved the plugs to separate sockets.'], cls: 'win' },
  2: { t: ['وصلت في الآخر', 'Got there in the end'], x: ['النار طفيت — بس فيه حاجة فاتتك أو صلّحتها في السكة. دي هي:', 'The fire is out — but there was something you corrected or missed. Here it is:'], cls: 'warn' },
  3: { t: ['مية على البوردة', 'Water on the board'], x: ['أصرّيت على المية. اللهب نط على القش. كله طلع بأمان واتطلب المطافي، بس المخزن راح.', 'You insisted on water. The flame jumped to the straw. Everyone left safely and the fire brigade was called, but the shed was lost.'], cls: 'lose' },
};

// ---- the three extinguishers: labels, signs, the wall rack; the one in your hands takes the chosen type ----
const EXT_SPEC = {
  water: { band: '#c8211a', en: 'WATER', ar: 'مياه', amt: '9 L', cls: ['A'] },
  powder: { band: '#1f4fb4', en: 'DRY POWDER', ar: 'بودرة كيماوية جافة', amt: '6 kg', cls: ['A', 'B', 'C'] },
  co2: { band: '#151515', en: 'CO₂', ar: 'ثاني أكسيد الكربون', amt: '5 kg', cls: ['B'] },
};
const extLabelTex = s => canvasTex(512, 256, (g, w, h) => {
  g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, w, h); g.fillStyle = s.band; g.fillRect(0, 0, w, 76);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '700 46px sans-serif'; g.fillText(s.en, w / 2, 56);
  g.fillStyle = '#222'; g.font = `700 34px ${AR_FONT}`; g.fillText(s.ar, w / 2, 124); g.font = '700 38px sans-serif'; g.fillText(s.amt, w / 2, 170);
  s.cls.forEach((l, i) => { const x = w / 2 + (i - (s.cls.length - 1) / 2) * 76; g.strokeStyle = '#222'; g.lineWidth = 4; g.strokeRect(x - 28, 188, 56, 50); g.font = '700 34px sans-serif'; g.fillText(l, x, 226); });
});
const extSignTex = s => canvasTex(256, 320, (g, w, h) => {
  g.fillStyle = '#f7f5ef'; g.fillRect(0, 0, w, h); g.fillStyle = s.band; g.fillRect(0, 0, w, 110);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = `700 44px ${AR_FONT}`; g.fillText(s.ar.split(' ')[0], w / 2, 60); g.font = '700 30px sans-serif'; g.fillText(s.en, w / 2, 98);
  g.fillStyle = '#222'; g.font = '700 26px sans-serif'; g.fillText(s.amt, w / 2, 150);
  s.cls.forEach((l, i) => { const x = w / 2 + (i - (s.cls.length - 1) / 2) * 66; g.strokeStyle = '#222'; g.lineWidth = 5; g.strokeRect(x - 26, 178, 52, 52); g.font = '700 34px sans-serif'; g.fillText(l, x, 216); });
  g.font = `600 22px ${AR_FONT}`; g.fillText('طفاية حريق · EXTINGUISHER', w / 2, 290);
});
const EXT_LABEL = {}, EXT_SIGN = {};
for (const [k, s] of Object.entries(EXT_SPEC)) { EXT_LABEL[k] = extLabelTex(s); EXT_SIGN[k] = extSignTex(s); }
function setExtType(E, type) {
  E.label.material = E.label.material.clone(); E.label.material.map = EXT_LABEL[type]; E.label.material.needsUpdate = true;
  if (type === 'co2') { E.horn.scale.set(4.2, 4.2, 6); E.horn.position.z = -.2; } else { E.horn.scale.set(1, 1, 1); E.horn.position.z = -.056; }   // CO₂: the big black horn
}
const DISPLAY = {};
function buildWallRack() {
  for (const type of Object.keys(EXT_SPEC)) {
    const E = buildExtinguisher(); setExtType(E, type);
    E.nozzle.position.set(-.098, .34, 0); E.nozzle.rotation.set(-Math.PI / 2, 0, 0);
    E.g.position.copy(SLOT[type]); world.add(E.g); E.g.updateMatrixWorld(true);
    const n = E.g.worldToLocal(E.tail.getWorldPosition(new V3())), mid = HOSE_P1.clone().lerp(n, .5); mid.y -= .06 + .12 * Math.min(1, HOSE_P1.distanceTo(n) * 2);
    E.hose.geometry.dispose(); E.hose.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([HOSE_O, HOSE_P1, mid, n]), 28, .0085, 7);
    DISPLAY[type] = E;
    mk(new THREE.PlaneGeometry(.3, .375), new THREE.MeshBasicMaterial({ map: EXT_SIGN[type] }), world, [SLOT[type].x, 1.62, -4.455], [0, 0, 0], false);
  }
}
const LOOKS = [
  { id: 'board', p: new V3(1.6, .48, -4.2), r: 3.8, kind: 'inspect' },
  { id: 'straw', p: new V3(3.0, .55, -4.05), r: 3.8, kind: 'inspect' },
  { id: 'diesel', p: new V3(.62, .55, -4.06), r: 3.8, kind: 'inspect' },
  ...Object.keys(SLOT).map(t => ({ id: t, p: SLOT[t].clone().add(new V3(0, .32, .05)), r: 1.9, kind: 'pick' })),
];

// ---- scenario state + the action queue ----
const SAF = {
  step: 0, obj: 'obj_s1', q: [], picked: -1, choice: null, log: [], mistakes: [], inspected: new Set(), watches: [], talker: null,
  extType: null, fireCap: .5, fireGrow: .0028, ended: 0, begun: false, busy: false, reporting: false, cine: false,
  from: clamp(+(params.get('step') || 1), 1, 3), auto: params.has('auto'), autoStop: params.get('autostop'), choose: params.get('choose'), insist: params.has('insist'), s1pick: params.get('s1'),
  target: null, drive: null, driving: false, upT: 0, sprT: 0, downWarned: false, waterHit: false, look: null, lookT: 0,
};
SAF.add = (...a) => SAF.q.push(...a);
SAF.now = (...a) => SAF.q.unshift(...a);
SAF.pick = i => { if (SAF.choice && i >= 0 && i < SAF.choice.opts.length && SAF.picked < 0) SAF.picked = i; };
const npc = id => crowd.list.find(c => c.w.id === id);
function headPos(c) { const f = FB.find(x => x.c === c); return (f ? f.H : c.fbx.getObjectByName('Bip01_Head')).getWorldPosition(new V3()); }
function setScript(c, steps) { if (!c) return; c.script = steps; c.loop = false; c.i = -1; c.t = 0; }
const goF = (x, z, gait = 'walk') => ({ a: 'go', to: [x, z], gait, free: true });
const arrived = c => !c || (c.i === c.script.length - 1 && c.script[c.i] && c.script[c.i].a === 'idle');
function hideNPC(c) { if (!c) return; c.gone = true; c.fbx.visible = false; c.pos.set(40, 0, 40); }
function placeNPC(c, x, z, face, clip = 'm_idle_nervous_03') { if (!c) return; c.pos.set(x, 0, z); c.yaw = Math.atan2(face[0] - x, face[1] - z); setScript(c, [idle(clip, Infinity, face)]); placeWorker(c); }
function mistake(k) { if (!SAF.mistakes.includes(k)) { SAF.mistakes.push(k); Engine.dispatch('mistake', { k }); } }
function decide(k, good) { SAF.log.push({ k, good }); Engine.dispatch('decision', { k, good }); }
const upwind = () => new V3(F.x - player.pos.x, 0, F.z - player.pos.z).normalize().dot(WIND) > .5;

function qStart(a) {
  if (a.say) { SAF.talker = a.say; showSub(a.say, a.k); }
  if (a.ask) { SAF.choice = a; renderChoices(); $('#choices').classList.add('on'); }
  if (a.run) a.run();
}
function qDone(a) {
  if (a.say) return a._t >= (a.d || 2.5);
  if (a.ask) return SAF.picked >= 0;
  if (a.wait !== undefined) return a._t >= a.wait;
  if (a.until) return a.until() || (a.max !== undefined && a._t > a.max);
  return true;
}
function qEnd(a) {
  if (a.say) { $('#sub').classList.remove('on'); SAF.talker = null; }
  if (a.ask) { const i = SAF.picked; SAF.picked = -1; SAF.choice = null; $('#choices').classList.remove('on'); a.cb(i); }
}
function updateSAF(dt) {
  if (!SAF.begun) { SAF.begun = true; startFlow(); }
  for (let i = SAF.watches.length - 1; i >= 0; i--) if (SAF.watches[i]()) SAF.watches.splice(i, 1);
  let a = SAF.q[0], first = true, n = 0;
  while (a && n++ < 60) {
    if (!a._s) { a._s = 1; a._t = 0; qStart(a); } else if (first) a._t += dt;
    first = false;
    if (!qDone(a)) break;
    SAF.q.shift(); qEnd(a); a = SAF.q[0];
  }
  autoPick(); attend(); lookTargets(); autoRun(dt); drive(dt);
  if (SAF.step === 3 && H.spraying) {                       // "stand with the draught behind you"
    SAF.sprT += dt; if (upwind()) SAF.upT += dt;
    if (SAF.sprT > 1.6 && SAF.upT / SAF.sprT < .5 && !SAF.downWarned && SAF.extType === 'powder') { SAF.downWarned = true; toast('t_draught'); mistake('downwind'); }
  }
  if (SAF.lookT > 0) { SAF.lookT -= dt; if (SAF.lookT <= 0) $('#look').classList.remove('on'); }
}

// ---- who looks at whom: the speaker looks at you, the others at the speaker; otherwise at you when you are close ----
function attend() {
  const talker = SAF.talker && npc(SAF.talker) && !npc(SAF.talker).gone ? npc(SAF.talker) : null;
  for (const c of crowd.list) {
    if (c.gone) continue;
    const s = c.script[c.i], walking = s && s.a === 'go', near = player.pos.distanceTo(c.pos) < 6;
    c.lookAt = walking ? null : talker === c ? 'player' : talker ? headPos(talker) : (SAF.talker === 'you' || near) ? 'player' : null;
    c.turnTo = !walking && (talker === c || (SAF.talker === 'you' && near)) ? player.pos : null;
  }
}

// ---- E on the board / straw / drum (look) or on one of the three extinguishers (take + say why) ----
function lookTargets() {
  SAF.target = null;
  if (SAF.step !== 2 || SAF.busy || SAF.q.length || sim.ended || H.state !== 'free' || H.ext === 'hand') return;
  const look = new V3(0, 0, -1).applyQuaternion(camera.quaternion); let best = null, bd = .9;
  for (const t of LOOKS) {
    if (t.kind === 'pick' && !DISPLAY[t.id].g.visible) continue;
    const d = t.p.clone().sub(camera.position), L = d.length(); if (L > t.r) continue;
    const dot = look.dot(d.normalize()); if (dot > bd) { bd = dot; best = t; }
  }
  SAF.target = best;
}
function safPrompt(t) { return (t.kind === 'inspect' ? T('p_look') : T('p_pickx')) + ' ' + L2(OBJ_NAMES[t.id]); }
function safUseE() {
  const t = SAF.target; if (!t || !sim.running) return false;
  if (t.kind === 'inspect') { SAF.inspected.add(t.id); SAF.look = t.id; SAF.lookT = 4.2; renderLook(); $('#look').classList.add('on'); Engine.dispatch('inspect', { what: t.id }); }
  else pickExt(t.id);
  return true;
}
function pickExt(type) {
  if (SAF.step !== 2 || SAF.busy) return;
  SAF.busy = true; SAF.target = null; $('#look').classList.remove('on');
  if (!SAF.inspected.has('board')) mistake('no_look');
  SAF.now({ ask: true, who: 'you', qk: 'q_reason_' + type, opts: ['r1', 'r2', 'r3'], best: 0, cb: r => afterReason(type, r) });
}
function afterReason(type, r) {
  Engine.dispatch('choose_extinguisher', { type, reason: ['electrical', 'nearest', 'biggest'][r] });
  const sayWhy = { say: 'you', k: 'r' + (r + 1), d: 2.2 };
  if (type === 'water') {
    decide('pick_water', false);
    SAF.now(sayWhy, { say: 'mahmoud', k: 'mah_electric', d: 2.2 }, { ask: true, who: 'mahmoud', qk: 'mah_electric', opts: ['w_change', 'w_insist'], best: 0, cb: w => {
      if (w === 0) { mistake('water_first'); decide('w_change', true); SAF.now({ say: 'you', k: 'w_change', d: 2 }, { run: () => { SAF.busy = false; } }); }
      else { decide('w_insist', false); SAF.insisted = true; SAF.now({ say: 'you', k: 'w_insist', d: 1.6 }, { run: () => takeExt('water', true) }); }
    } });
  } else if (type === 'co2') {
    decide('pick_co2', false);
    SAF.now(sayWhy, { say: 'karim', k: 'karim_co2', d: 4.6 }, { run: () => { mistake('co2_first'); SAF.busy = false; } });
  } else {
    decide(r === 0 ? 'pick_powder_reason' : 'pick_powder', r === 0);
    if (r === 0) SAF.now(sayWhy, { say: 'karim', k: 'karim_good', d: 2.2 }, { run: () => takeExt('powder') });
    else SAF.now(sayWhy, { say: 'karim', k: 'karim_reason', d: 3.8 }, { run: () => { mistake('reason'); takeExt('powder'); } });
  }
}
function takeExt(type, cine) {
  SAF.extType = type; SAF.step = 3; SAF.obj = 'obj_s3'; SAF.fireCap = Math.max(SAF.fireCap, .62);
  DISPLAY[type].g.visible = false;
  setExtType(EX, type); ext.position.copy(SLOT[type]); ext.rotation.set(0, 0, 0); ext.visible = true; ext.updateMatrixWorld(true);
  const sc = type === 'water' ? [[.82, .9, 1], [.7, .82, .95], [.62, .72, .86]] : [[.97, .97, .94], [.9, .9, .87], [.82, .82, .8]];
  ['uC0', 'uC1', 'uC2'].forEach((u, i) => spray.mat.uniforms[u].value.setRGB(...sc[i]));
  H.state = 'reach'; H.reach = { t: 0, from: cur.R.p.clone(), fromQ: cur.R.q.clone(), hes: 0 };
  if (!cine) SAF.add({ until: () => H.ext === 'hand' }, { say: 'karim', k: 'karim_go', d: 4.6 });
  else {                                                   // ending 3: you insisted — the water goes on the board
    SAF.cine = true;
    SAF.add({ until: () => H.ext === 'hand' }, { run: () => startAutoPin() }, { until: () => !H.hasPin, max: 4 }, { wait: .5 }, { run: () => toggleHose() }, { wait: .5 },
      { run: () => { SAF.drive = { to: [F.x - .1, F.z + 2.6], look: FIRE_BASE }; } }, { until: () => Math.hypot(player.pos.x - F.x + .1, player.pos.z - F.z - 2.6) < .25, max: 7 },
      { run: () => { H.squeezeHeld = true; } }, { until: () => SAF.waterHit, max: 5 }, { run: adverse });
  }
}
function adverse() {
  H.squeezeHeld = false; fire.spread = .02; fire.health = 1; SAF.fireCap = 1;
  Engine.dispatch('flame_jumped');
  SAF.now({ say: 'look', k: 'adv_jump', d: 2.4 }, { run: evacuate }, { say: 'karim', k: 'karim_out', d: 2.2 },
    { run: () => { SAF.drive = { to: [0, 4.05], look: new V3(0, 1.5, 9) }; } }, { wait: 3.4 },
    { run: () => { $('#fade').style.opacity = 1; } }, { wait: 1.6 }, { run: () => showEnding(3) });
}
function evacuate() {
  setScript(npc('karim'), [goF(-1.6, 3.2, 'fast'), goF(-.3, 4.4, 'fast'), goF(-.5, 7.4, 'fast'), idle('m_idle_nervous_03', Infinity, [0, 0])]);
  setScript(npc('mahmoud'), [goF(.2, 5.2, 'fast'), goF(1.6, 7.6, 'fast'), idle('m_idle_nervous_03', Infinity, [0, 0])]);
}

// ---- the flow ----
function startFlow() {
  const end = +params.get('ending') || 0;
  if (SAF.from >= 2 || end) { skipStep1(); SAF.obj = 'obj_s2'; }
  if (end) { demoEnding(end); return; }
  if (SAF.from === 1) {
    SAF.step = 1; SAF.obj = 'obj_s1';
    SAF.add({ wait: .9 }, { say: 'fathy', k: 'fathy_open', d: 3.8 }, { ask: true, who: 's1', qk: 'q_s1', opts: ['o1_both', 'o1_fathy', 'o1_grab'], best: 0, cb: step1 });
  } else if (SAF.from === 2) SAF.add({ wait: .6 }, { say: 'karim', k: 'karim_arrive', d: 4.2 }, { run: beginStep2 });
  else { beginStep2(); decide('pick_powder_reason', true); takeExt('powder'); }
}
function skipStep1() {
  hideNPC(npc('fathy'));
  placeNPC(npc('mahmoud'), -1.25, 3.7, [.8, -3.5]);
  placeNPC(npc('karim'), -3.0, 1.1, [0, 2.4], 'm_idle_look_around_01');
}
function step1(i) {
  if (i === 0) { decide('o1_both', true); Engine.dispatch('alarm'); SAF.now({ say: 'you', k: 'o1_both', d: 2.6 }, ...alarm()); }
  else if (i === 1) {
    decide('o1_fathy', false); mistake('alarm_late');
    SAF.now({ say: 'you', k: 'o1_fathy', d: 1.8 }, { run: fathyOut }, { say: 'fathy', k: 'fathy_ok', d: 1.6 }, { say: 'mahmoud', k: 'mah_callq', d: 1.8 },
      { ask: true, who: 'mahmoud', qk: 'mah_callq', opts: ['o_yes_call'], best: 0, cb: () => { Engine.dispatch('alarm'); SAF.now({ say: 'you', k: 'o_yes_call', d: 1.6 }, ...alarm(true)); } });
  } else {
    decide('o1_grab', false);
    SAF.now({ say: 'you', k: 'o1_grab', d: 2.2 }, { say: 'mahmoud', k: 'mah_sure', d: 3.4 },
      { ask: true, who: 'mahmoud', qk: 'mah_sure', opts: ['o_fix_alarm', 'o_no_time'], best: 0, cb: j => {
        if (j === 0) { mistake('grab_first'); decide('o_fix_alarm', true); Engine.dispatch('alarm'); SAF.now({ say: 'you', k: 'o_fix_alarm', d: 2.4 }, ...alarm()); }
        else { mistake('grab_insist'); decide('o_no_time', false); SAF.now({ say: 'you', k: 'o_no_time', d: 1.4 }, { say: 'mahmoud', k: 'mah_anyway', d: 2.8 }, ...alarm(false, true)); }
      } });
  }
}
function fathyOut() {
  const c = npc('fathy'); if (!c || c.gone) return;
  setScript(c, [goF(2.2, .6, 'fast'), goF(.55, 3.4, 'fast'), goF(.25, 5.6, 'fast'), goF(2.8, 8.6, 'fast'), idle('m_idle_nervous_03', Infinity, [0, 0])]);
  SAF.watches.push(() => { if (arrived(c)) { hideNPC(c); return true; } return false; });
}
function alarm(fathyDone, quiet) {
  return [
    ...(fathyDone ? [] : [{ run: fathyOut }, { say: 'fathy', k: 'fathy_ok', d: 1.5 }]),
    { run: () => { setScript(npc('mahmoud'), [goF(-3.6, 2.6, 'fast'), goF(-5.3, 1.65, 'fast'), idle('m_idle_look_around_01', Infinity, [-7.5, 1.5])]); SAF.obj = 'obj_wait'; } },
    ...(quiet ? [] : [{ say: 'mahmoud', k: 'mah_ok', d: 1.8 }]),
    { until: () => arrived(npc('mahmoud')), max: 14 }, { wait: .5 },
    { run: () => {
      setScript(npc('karim'), [goF(-6.4, 1.5), goF(-5.0, 1.35), goF(-3.0, 1.1), idle('m_idle_look_around_01', Infinity, [0, 2.4])]);
      setScript(npc('mahmoud'), [goF(-4.5, 2.7), goF(-2.6, 3.4), goF(-1.25, 3.7), idle('m_idle_nervous_03', Infinity, [.8, -3.5])]);
    } },
    { until: () => arrived(npc('karim')), max: 16 },
    { say: 'karim', k: 'karim_arrive', d: 4.4 }, { run: beginStep2 },
  ];
}
function beginStep2() { SAF.step = 2; SAF.obj = 'obj_s2'; SAF.busy = false; SAF.fireCap = Math.max(SAF.fireCap, .55); }
SAF.onFireOut = () => {
  if (SAF.reporting || SAF.ended || SAF.extType !== 'powder') return;
  SAF.reporting = true; SAF.step = 4; SAF.obj = 'obj_rep'; H.squeezeHeld = false; SAF.drive = null;
  if (!pass.sweep) mistake('no_sweep');
  if (stats.sprayT > 1 && stats.aimT / stats.sprayT < .35) mistake('aim');
  if (SAF.sprT > 1.6 && SAF.upT / SAF.sprT < .5) mistake('downwind');
  SAF.add({ wait: 1.4 }, { say: 'karim', k: 'karim_rep', d: 2.4 }, { ask: true, who: 'karim', qk: 'karim_rep', opts: ['p_full', 'p_short'], best: 0, cb: p => {
    if (p === 1) { decide('p_short', false); mistake('report_short'); SAF.now({ say: 'you', k: 'p_short', d: 1.6 }, { run: finish }); return; }
    decide('p_full', true);
    const rep = (part, opts, ok) => ({ ask: true, who: 'karim', qk: 'q_' + part, opts, best: 0, cb: i => { const good = ok(i); decide(opts[i], good); if (!good) mistake('report_' + part); SAF.now({ say: 'you', k: opts[i], d: 1.5 }); } });
    SAF.now({ say: 'you', k: 'p_full', d: 1.4 },
      rep('what', ['w_board', 'w_straw', 'w_diesel'], i => i === 0),
      rep('which', ['x_powder', 'x_water', 'x_co2'], i => ['powder', 'water', 'co2'][i] === SAF.extType),
      rep('cause', ['c_plugs', 'c_smoke', 'c_leak'], i => i === 0),
      { run: () => { Engine.dispatch('report', { full: true }); finish(); } });
  } });
};
SAF.onEmpty = () => SAF.watches.push(() => {
  if (fire.out || SAF.ended) return true;
  SAF._emptyT = SAF._emptyT || sim.t;
  if (sim.t - SAF._emptyT > 2.5) { mistake('empty'); SAF.now({ say: 'karim', k: 'karim_empty', d: 3 }, { run: () => { fire.health = 0; } }); return true; }
  return false;
});
function finish() {
  const n = SAF.insisted ? 3 : SAF.mistakes.length ? 2 : 1;
  if (n === 1) SAF.now({ say: 'karim', k: 'karim_end1', d: 3.6 }, { run: () => { BOARD.extra.forEach(m => m.visible = false); BOARD.fixed.forEach(m => m.visible = true); } }, { wait: 1.2 }, { run: () => showEnding(1) });
  else SAF.now({ say: 'karim', k: 'karim_end2', d: 2.6 }, { wait: .6 }, { run: () => showEnding(2) });
}
function showEnding(n) {
  if (SAF.ended) return;
  SAF.ended = n; sim.ended = true; H.squeezeHeld = false; SAF.drive = null;
  Engine.dispatch('ending', { n });
  if (document.pointerLockElement) document.exitPointerLock();
  renderEnding(); $('#result').classList.remove('hide');
}
function renderEnding() {
  const n = SAF.ended; if (!n) return;
  const E = ENDINGS[n];
  $('#rTitle').textContent = L2(E.t); $('#rTitle').className = E.cls;
  $('#rReason').textContent = L2(E.x);
  const mis = n === 3 ? '' : `<div class="dl"><span class="k">${T('mis_h')}</span><ul>${SAF.mistakes.length ? SAF.mistakes.map(k => `<li class="bad">${L2(MIST[k])}</li>`).join('') : `<li class="good">${T('none')}</li>`}</ul></div>`;
  const dec = `<div class="dl"><span class="k">${T('dec_h')}</span><ul>${SAF.log.map(d => `<li class="${d.good ? 'good' : 'bad'}">${L2(TXT[d.k]) || L2(DEC_TXT[d.k])}</li>`).join('') || '<li>—</li>'}</ul></div>`;
  $('#rMetrics').innerHTML = mis + dec;
  $('#rLesson').textContent = T('lesson'); $('#rLimits').textContent = T('limits');
  $('#btnStep2').style.display = n === 3 ? '' : 'none';
}
const DEC_TXT = { pick_water: ['اخترت طفاية المية', 'You picked the water extinguisher'], pick_co2: ['اخترت طفاية CO₂', 'You picked the CO₂ extinguisher'],
  pick_powder: ['اخترت البودرة الجافة (بسبب مش هو)', 'You picked dry powder (for the wrong reason)'], pick_powder_reason: ['اخترت البودرة الجافة لأن النار كهربا', 'You picked dry powder because the fire is electrical'] };
function demoEnding(n) {                                     // ?ending=1|2|3 — straight to an ending (screenshots)
  SAF.step = 4;
  if (n === 3) {
    SAF.insisted = true; SAF.extType = 'water'; decide('o1_both', true); decide('pick_water', false); decide('w_insist', false);
    fire.spread = .6; fire.health = 1; SAF.fireCap = 1; smokeLevel = .35; hideNPC(npc('karim')); hideNPC(npc('mahmoud'));
    SAF.add({ wait: 2.2 }, { run: () => { $('#fade').style.opacity = .85; } }, { wait: 1.2 }, { run: () => showEnding(3) });
    return;
  }
  SAF.extType = 'powder'; fire.out = true; fire.health = 0; decide('o1_both', true);
  if (n === 2) { decide('pick_water', false); decide('w_change', true); mistake('water_first'); decide('pick_powder_reason', true); decide('p_short', false); mistake('report_short'); }
  else { decide('pick_powder_reason', true); decide('p_full', true); decide('w_board', true); decide('x_powder', true); decide('c_plugs', true); BOARD.extra.forEach(m => m.visible = false); BOARD.fixed.forEach(m => m.visible = true); }
  SAF.add({ wait: 1 }, { run: () => showEnding(n) });
}

// ---- autopilot (?auto / the menu demo button) and the ?choose= hook ----
function autoPick() {
  const a = SAF.q[0]; if (!a || !a.ask || !a._s || SAF.picked >= 0 || a._t < .9) return;
  let p = -1;
  if (SAF.autoStop && a.qk === SAF.autoStop) return;
  if (SAF.auto) p = a.best ?? 0;
  else if (a.qk === 'q_s1' && SAF.s1pick != null) p = +SAF.s1pick;
  else if (SAF.choose && a.qk && a.qk.startsWith('q_reason')) p = 0;
  else if (SAF.choose && a.qk === 'mah_electric' && SAF.insist) p = 1;
  if (p >= 0) SAF.pick(p);
}
function aimAt(p) { const d = p.clone().sub(camera.position); player.yaw = Math.atan2(-d.x, -d.z); player.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)); }
function autoRun(dt) {
  if (sim.ended) return;
  if (SAF.choose && SAF.step === 2 && !SAF.q.length && !SAF.busy && !SAF.chosen) {      // ?choose=water|powder|co2
    const t = LOOKS.find(l => l.id === SAF.choose); if (!t) return;
    player.pos.set(t.p.x, 0, -2.95); camera.position.set(t.p.x, 1.65, -2.95); aimAt(t.p);
    if (SAF.target === t) { SAF.chosen = true; safUseE(); }
    return;
  }
  const ins = params.get('inspect');                                                   // ?inspect=board|straw|diesel (screenshots)
  if (ins && SAF.step === 2 && !SAF.q.length && !SAF.busy && !SAF.inspected.has(ins)) {
    const t = LOOKS.find(l => l.id === ins); if (!t) return;
    player.pos.set(1.1, 0, -1.6); camera.position.set(1.1, 1.65, -1.6); aimAt(t.p);
    if (SAF.target === t) safUseE();
    return;
  }
  if (!SAF.auto) return;
  const A = SAF.ai || (SAF.ai = { t: 0 }); A.t += dt;
  if (SAF.step === 2 && !SAF.q.length && !SAF.busy) {
    const next = ['board', 'straw', 'diesel'].find(k => !SAF.inspected.has(k));
    const t = LOOKS.find(l => l.id === (next || 'powder'));
    SAF.drive = { to: next ? [1.15, -1.75] : [-1.55, -2.95], look: t.p };
    if (SAF.target === t && A.t > .5) { A.t = next ? -1.4 : 0; if (!next) SAF.drive = null; safUseE(); }
  }
  if (SAF.step === 3 && H.ext === 'hand' && !SAF.reporting && !SAF.cine) {
    if (H.hasPin) { if (H.state !== 'pin') startAutoPin(); }
    else if (!H.hose) { if (H.pin.held <= 0) toggleHose(); }
    else {
      SAF.drive = { to: [F.x - .15, F.z + 2.55], look: FIRE_BASE, sweep: true };
      H.squeezeHeld = !fire.out && Math.hypot(player.pos.x - F.x + .15, player.pos.z - F.z - 2.55) < .35;
    }
  }
}
function drive(dt) {
  const d = SAF.drive;
  if (!d) { if (SAF.driving) { SAF.driving = false; demoCtl.move = null; demoCtl.look = null; demoCtl.sweep = 0; } return; }
  SAF.driving = true; demoWalk(d.to[0], d.to[1], 1.9); demoCtl.look = d.look; demoCtl.sweep = d.sweep ? Math.sin(sim.t * 3.2) * .16 : 0;
}

// ---- UI: subtitles, choices, the look card ----
function showSub(who, k) { $('#subWho').textContent = L2(WHO[who]); $('#subTxt').textContent = L2(TXT[k]); $('#sub').dataset.who = who; $('#sub').classList.add('on'); SAF.sub = [who, k]; }
function renderChoices() {
  const a = SAF.choice; if (!a) return;
  $('#choices').innerHTML = (a.qk ? `<div class="q glass"><b>${L2(WHO[a.who])}</b><span>${L2(TXT[a.qk])}</span></div>` : '') +
    a.opts.map((k, i) => `<button class="glass" data-i="${i}"><span class="kc">${i + 1}</span><span>${L2(TXT[k])}</span></button>`).join('');
  $('#choices').querySelectorAll('button').forEach(b => b.onclick = () => { SAF.pick(+b.dataset.i); if (sim.started && !input.locked && !sim.ended) lock(); });
}
function renderLook() { if (!SAF.look) return; $('#lookWho').textContent = L2(OBJ_NAMES[SAF.look]); $('#lookTxt').textContent = L2(TXT['ins_' + SAF.look]); }
function safRelang() { if (SAF.sub && $('#sub').classList.contains('on')) showSub(...SAF.sub); renderChoices(); renderLook(); renderEnding(); }
function safObjective() {
  if (SAF.ended) return '';
  if (SAF.step === 3) {
    if (SAF.cine || H.state === 'reach') return T('obj_s3');
    if (H.ext !== 'hand') return H.ext === 'floor' ? T('p_pick') : T('obj_take');
    if (H.hasPin) return T('o_pin');
    if (!H.hose) return T('o_hose');
    const d = Math.hypot(camera.position.x - F.x, camera.position.z - F.z);
    if (!upwind() || d > 3.6) return T('o_draught');
    return T('o_spray');
  }
  return T(SAF.obj);
}
window.__saf = { SAF, crowd, FB, FBR, player, fire, H, world, camera, renderer, THREE };   // test hook (tools / headless probes)
