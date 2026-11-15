// Still in Lane Four (AQ-01) - indoor competition pool soundscape.
// Fully synthesized with the Web Audio API: no audio files, no dependencies.
//
//   import { createHallAudio } from './aq01/audio.js';
//   const hall = createHallAudio(audioCtx);   // after a user gesture
//   hall.startAmbience();
//
// Units: metres, Y up. Pool along X (-25..25), water at y = 0, hall ~70 x 40 x 12 m.
// Every one-shot also accepts an optional trailing `when` (AudioContext time) so it can be
// scheduled ahead or rendered into an OfflineAudioContext (used by test-audio.html).

const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const pick = (a) => a[(Math.random() * a.length) | 0];

// vowel formants F1, F2, F3 (Hz)
const VOW = {
  a: [730, 1090, 2440], e: [530, 1840, 2480], i: [270, 2290, 3010],
  o: [570, 840, 2410], u: [300, 870, 2240], ae: [660, 1720, 2410],
};
const VKEYS = Object.keys(VOW);

export function createHallAudio(ctx, opts = {}) {
  const o = Object.assign({ autoEvents: true, volume: 0.8, reverbSeconds: 3.0, hrtfVoices: 14 }, opts);
  const sr = ctx.sampleRate;
  const isOffline = typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext;
  const now = () => ctx.currentTime;

  // ---------------------------------------------------------------- noise buffers (made once)
  function makeNoise(seconds, kind) {
    const len = (seconds * sr) | 0;
    const b = ctx.createBuffer(1, len, sr);
    const d = b.getChannelData(0);
    if (kind === 'white') {
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } else if (kind === 'pink') { // Paul Kellet economy filter
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
      }
    } else { // brown
      let l = 0;
      for (let i = 0; i < len; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.5; }
    }
    return b;
  }
  const WHITE = makeNoise(2, 'white');
  const PINK = makeNoise(6, 'pink');
  const BROWN = makeNoise(4, 'brown');

  // Clapping texture: dense random hand-claps (short decaying noise ticks), ~3 s loop.
  function makeClaps() {
    const len = (3 * sr) | 0;
    const b = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      const n = 150; // claps per 3 s => 50/s
      for (let k = 0; k < n; k++) {
        const at = (Math.random() * (len - 600)) | 0;
        const amp = rnd(0.2, 1);
        const tau = rnd(0.0008, 0.0025) * sr;
        const lenC = (tau * 6) | 0;
        let lp = 0;
        for (let i = 0; i < lenC; i++) {
          const w = Math.random() * 2 - 1;
          lp += 0.55 * (w - lp);
          d[at + i] += lp * amp * Math.exp(-i / tau);
        }
      }
    }
    return b;
  }
  const CLAPS = makeClaps();

  // ---------------------------------------------------------------- reverb impulse response
  // Tiled natatorium: dense early reflections off walls/glass/ceiling, long bright tail whose
  // high end decays faster than the lows, stereo-decorrelated, pre-delay ~12 ms.
  function makeIR(rt60) {
    const len = (rt60 * 1.1 * sr) | 0;
    const b = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      let lp = 0;
      const pre = (0.012 * sr) | 0;
      for (let i = pre; i < len; i++) {
        const t = (i - pre) / sr;
        const env = Math.exp((-6.9078 * t) / rt60);
        const fc = 2200 + 8000 * Math.exp(-t / 1.1); // air/tile damping: bright start, darker tail
        const a = 1 - Math.exp((-TAU * fc) / sr);
        lp += a * (Math.random() * 2 - 1 - lp);
        const ramp = t < 0.03 ? t / 0.03 : 1; // build-up of echo density
        d[i] = lp * env * ramp * 1.6;
      }
      // early reflections (sparse, strong, bright)
      for (let k = 0; k < 28; k++) {
        const t = 0.014 + Math.pow(Math.random(), 1.4) * 0.14;
        const at = (t * sr) | 0;
        const amp = (Math.random() < 0.5 ? -1 : 1) * 0.9 * Math.exp(-t / 0.07) * rnd(0.5, 1);
        d[at] += amp; d[at + 1] += amp * 0.5; d[at + 2] += amp * 0.2;
      }
    }
    return b;
  }

  // ---------------------------------------------------------------- bus graph
  const master = ctx.createGain();
  master.gain.value = o.volume;
  const comp = ctx.createDynamicsCompressor(); // safety limiter against stacked peaks
  comp.threshold.value = -8; comp.knee.value = 6; comp.ratio.value = 10;
  comp.attack.value = 0.003; comp.release.value = 0.25;
  master.connect(comp); comp.connect(ctx.destination);

  const airBus = ctx.createGain();       // everything heard in the hall (dry + reverb)
  const uw1 = ctx.createBiquadFilter(); uw1.type = 'lowpass'; uw1.Q.value = 0;
  const uw2 = ctx.createBiquadFilter(); uw2.type = 'lowpass'; uw2.Q.value = 0;
  const FREE = Math.min(20000, sr * 0.45);
  uw1.frequency.value = FREE; uw2.frequency.value = FREE;
  const airOut = ctx.createGain();
  airBus.connect(uw1); uw1.connect(uw2); uw2.connect(airOut); airOut.connect(master);

  const subBus = ctx.createGain();       // underwater-only layer (rumble) bypasses the muffling
  subBus.connect(master);
  const bubbleBus = ctx.createGain(); bubbleBus.gain.value = 0.2; bubbleBus.connect(master);

  const reverbIn = ctx.createGain();
  const convolver = ctx.createConvolver();
  convolver.buffer = makeIR(o.reverbSeconds);
  const revHP = ctx.createBiquadFilter(); revHP.type = 'highpass'; revHP.frequency.value = 160;
  const revReturn = ctx.createGain(); revReturn.gain.value = 0.9;
  reverbIn.connect(convolver); convolver.connect(revHP); revHP.connect(revReturn); revReturn.connect(airBus);

  // ---------------------------------------------------------------- listener
  const L = { x: 0, y: 2, z: 0 };
  function setListener(pos, forward, up) {
    const l = ctx.listener;
    L.x = pos.x; L.y = pos.y; L.z = pos.z;
    const f = forward || { x: 0, y: 0, z: -1 }, u = up || { x: 0, y: 1, z: 0 };
    if (l.positionX) {
      l.positionX.value = pos.x; l.positionY.value = pos.y; l.positionZ.value = pos.z;
      l.forwardX.value = f.x; l.forwardY.value = f.y; l.forwardZ.value = f.z;
      l.upX.value = u.x; l.upY.value = u.y; l.upZ.value = u.z;
    } else {
      l.setPosition(pos.x, pos.y, pos.z); l.setOrientation(f.x, f.y, f.z, u.x, u.y, u.z);
    }
  }
  setListener(L, { x: 0, y: 0, z: -1 }, { x: 0, y: 1, z: 0 });
  const dist = (p) => Math.hypot(p.x - L.x, p.y - L.y, p.z - L.z);

  // ---------------------------------------------------------------- positional output helper
  let hrtfActive = 0;
  function makeOut(pos, send) {
    const input = ctx.createGain();
    let pn = null, hrtf = false, dead = false;
    if (pos) {
      pn = ctx.createPanner();
      hrtf = hrtfActive < o.hrtfVoices;
      pn.panningModel = hrtf ? 'HRTF' : 'equalpower';
      pn.distanceModel = 'inverse';
      pn.refDistance = 4; pn.rolloffFactor = 0.9; pn.maxDistance = 200;
      if (pn.positionX) { pn.positionX.value = pos.x; pn.positionY.value = pos.y; pn.positionZ.value = pos.z; }
      else pn.setPosition(pos.x, pos.y, pos.z);
      if (hrtf) hrtfActive++;
      input.connect(pn); pn.connect(airBus);
    } else input.connect(airBus);
    // reverb send: diffuse field level falls much slower with distance than the direct sound
    const s = ctx.createGain();
    s.gain.value = send / (1 + (pos ? dist(pos) : 4) / 8);
    input.connect(s); s.connect(reverbIn);
    return {
      input,
      dispose() {
        if (dead) return; dead = true;
        try { input.disconnect(); s.disconnect(); if (pn) pn.disconnect(); } catch (e) { /* ignore */ }
        if (hrtf) hrtfActive--;
      },
    };
  }

  function noiseSrc(buf, t, stopT, loop = true) {
    const s = ctx.createBufferSource();
    s.buffer = buf; s.loop = loop;
    s.start(t, Math.random() * (buf.duration - 0.2));
    if (stopT != null) s.stop(stopT);
    return s;
  }
  function bp(f, q, type = 'bandpass') {
    const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b;
  }
  function gainNode(v) { const g = ctx.createGain(); g.gain.value = v; return g; }
  function lfo(rate, depth, target, t = 0) { // oscillator -> gain -> AudioParam
    const os = ctx.createOscillator(); os.frequency.value = rate;
    const g = gainNode(depth); os.connect(g); g.connect(target);
    os.start(t || now());
    return { os, g };
  }

  // ---------------------------------------------------------------- babble voice (crowd building block)
  // saw "glottal" source + noise -> two vowel formants -> syllable-rate AM; slow vowel drift & pitch drift.
  function babbleVoice(dest, p, t0, t1) {
    const nodes = [], oscs = [];
    const mk = (n) => { nodes.push(n); return n; };
    const sum = mk(ctx.createGain());
    const saw = mk(ctx.createOscillator()); oscs.push(saw);
    saw.type = 'sawtooth'; saw.frequency.value = p.f0;
    const sg = mk(gainNode(p.voiced)); saw.connect(sg); sg.connect(sum);
    const dl = mk(ctx.createOscillator()); oscs.push(dl); dl.frequency.value = rnd(0.5, 2.2);
    const dg = mk(gainNode(p.f0 * 0.07)); dl.connect(dg); dg.connect(saw.frequency);
    const ns = noiseSrc(p.pinkNoise ? PINK : WHITE, t0, t1); nodes.push(ns);
    const ng = mk(gainNode(p.noise)); ns.connect(ng); ng.connect(sum);
    const F = VOW[p.vowel];
    const b1 = mk(bp(F[0] * p.fs, p.q)), b2 = mk(bp(F[1] * p.fs, p.q * 1.3));
    const g2 = mk(gainNode(0.6));
    sum.connect(b1); sum.connect(b2); b2.connect(g2);
    const vl = mk(ctx.createOscillator()); oscs.push(vl); vl.frequency.value = rnd(0.8, 2.6);
    const vg = mk(gainNode(450)); vl.connect(vg); vg.connect(b1.detune); vg.connect(b2.detune);
    const amp = mk(gainNode(p.base));
    b1.connect(amp); g2.connect(amp);
    const a1 = mk(ctx.createOscillator()); oscs.push(a1); a1.frequency.value = p.amRate;
    const a1g = mk(gainNode(p.amDepth)); a1.connect(a1g); a1g.connect(amp.gain);
    const a2 = mk(ctx.createOscillator()); oscs.push(a2); a2.frequency.value = rnd(0.3, 1.1);
    const a2g = mk(gainNode(p.amDepth * 0.8)); a2.connect(a2g); a2g.connect(amp.gain);
    const pan = mk(ctx.createStereoPanner()); pan.pan.value = p.pan;
    amp.connect(pan); pan.connect(dest);
    for (const os of oscs) { os.start(t0); if (t1 != null) os.stop(t1); }
    return { amp, oscs, nodes, ns };
  }

  // ---------------------------------------------------------------- ambience
  const crowdBus = ctx.createGain();   // babble sum (dry)
  const crowdSwell = ctx.createGain(); crowdSwell.gain.value = 1;
  const crowdLevelG = ctx.createGain();
  let crowdLevel = 0.6;
  const CROWD_MAX = 0.6;
  crowdLevelG.gain.value = crowdLevel * CROWD_MAX;
  const crowdSend = gainNode(0.9);
  const crowdHP = bp(90, 0.7, 'highpass');
  crowdBus.connect(crowdHP); crowdHP.connect(crowdSwell); crowdSwell.connect(crowdLevelG);
  crowdLevelG.connect(airBus); crowdLevelG.connect(crowdSend); crowdSend.connect(reverbIn);

  let ambienceOn = false;
  let timers = [];
  let rumbleStarted = false;

  function startRumble() {
    if (rumbleStarted) return; rumbleStarted = true;
    const t = now();
    const n = noiseSrc(BROWN, t, null);
    const lp = bp(130, 0.5, 'lowpass');
    const g = gainNode(0.9);
    n.connect(lp); lp.connect(g); g.connect(rumbleGain);
    const sine = ctx.createOscillator(); sine.frequency.value = 47; const sg = gainNode(0.12);
    sine.connect(sg); sg.connect(rumbleGain); sine.start(t);
  }
  const rumbleGain = gainNode(0); rumbleGain.connect(subBus);

  function startAmbience() {
    if (ambienceOn) return; ambienceOn = true;
    const t = now();
    startRumble();

    // 14 babble voices: 9 adult/low, 5 younger/high; spread across the stereo field.
    for (let i = 0; i < 14; i++) {
      const young = i >= 9;
      babbleVoice(crowdBus, {
        f0: young ? rnd(200, 320) : rnd(95, 190), voiced: young ? 0.18 : 0.22, noise: 0.9,
        vowel: pick(VKEYS), fs: young ? 1.12 : 1, q: young ? 4 : 5,
        base: 0.5, amRate: rnd(2.8, 6), amDepth: 0.22, pan: rnd(-0.9, 0.9) * (i % 2 ? 1 : -1) * 0.9 + (i % 2 ? 0.1 : -0.1),
      }, t, null);
    }
    // diffuse roar of the hall (pink, tilted down) and bright tile hiss
    const roar = noiseSrc(PINK, t, null); const rl = bp(1600, 0.4, 'lowpass'); const rg = gainNode(0.55);
    roar.connect(rl); rl.connect(rg); rg.connect(crowdBus);
    const hiss = noiseSrc(WHITE, t, null); const hb = bp(4200, 0.6); const hg = gainNode(0.07);
    hiss.connect(hb); hb.connect(hg); hg.connect(crowdBus);
    const gm = lfo(0.13, 0.12, rg.gain, t); void gm;

    // water lapping in the gutters: two slow-AM layers left/right
    for (const [side, r1, r2] of [[-1, 0.21, 0.47], [1, 0.17, 0.39]]) {
      const n = noiseSrc(PINK, t, null);
      const f = bp(700, 0.7); const f2 = bp(2600, 0.5, 'lowpass');
      const g = gainNode(0.5);
      lfo(r1, 0.3, g.gain, t); lfo(r2, 0.15, g.gain, t);
      const p = ctx.createStereoPanner(); p.pan.value = side * 0.7;
      const out = gainNode(0.22);
      n.connect(f); f.connect(f2); f2.connect(g); g.connect(p); p.connect(out);
      out.connect(airBus); const sd = gainNode(0.4); out.connect(sd); sd.connect(reverbIn);
    }

    // ventilation hum
    const vent = gainNode(0.5);
    for (const [fr, a] of [[50, 0.012], [100.4, 0.01], [150.8, 0.006], [61.5, 0.008]]) {
      const os = ctx.createOscillator(); os.frequency.value = fr; const g = gainNode(a);
      os.connect(g); g.connect(vent); os.start(t);
    }
    const vn = noiseSrc(BROWN, t, null); const vl = bp(260, 0.5, 'lowpass'); const vg = gainNode(0.09);
    vn.connect(vl); vl.connect(vg); vg.connect(vent);
    const vn2 = noiseSrc(PINK, t, null); const vb = bp(850, 1.5); const vg2 = gainNode(0.02);
    vn2.connect(vb); vb.connect(vg2); vg2.connect(vent);
    vent.connect(airBus);

    if (o.autoEvents) {
      scheduleLoop(() => announce(), 3, 6, 6, 15);
      scheduleLoop(() => randomCrowdEvent(), 1.5, 4, 2.5, 7);
    }
  }

  function scheduleLoop(fn, firstMin, firstMax, min, max) {
    const rec = { id: 0, stopped: false };
    const run = () => {
      if (rec.stopped) return;
      if (ctx.state === 'running') { try { fn(); } catch (e) { console.warn('[hallAudio]', e); } }
      rec.id = setTimeout(run, rnd(min, max) * 1000);
    };
    rec.id = setTimeout(run, rnd(firstMin, firstMax) * 1000);
    timers.push(rec);
  }
  function clearTimers() { for (const r of timers) { r.stopped = true; clearTimeout(r.id); } timers = []; }

  function randomPos(yMin = 1.0, yMax = 2.4) {
    // spectators/coaches: along both long sides and in the stand
    const side = Math.random() < 0.5 ? -1 : 1;
    return { x: rnd(-27, 27), y: rnd(yMin, yMax), z: side * rnd(14, 19) };
  }

  function randomCrowdEvent() {
    const r = Math.random();
    const lvl = 0.3 + crowdLevel * 0.7;
    if (r < 0.4) laugh(randomPos(), now() + 0.02, lvl);
    else if (r < 0.75) shout(randomPos(), now() + 0.02, lvl);
    else swell(rnd(0.15, 0.4) * lvl, rnd(1.2, 2.5));
    if (Math.random() < 0.25) shout(randomPos(), now() + rnd(0.1, 0.5), lvl);
  }

  function swell(amount, dur, when) {
    const t = when ?? now();
    crowdSwell.gain.cancelScheduledValues(t);
    crowdSwell.gain.setTargetAtTime(1 + amount, t, 0.35);
    crowdSwell.gain.setTargetAtTime(1, t + dur, 0.8);
  }

  function setCrowd(level) {
    crowdLevel = clamp(level, 0, 1);
    crowdLevelG.gain.setTargetAtTime(crowdLevel * CROWD_MAX, now(), 0.6);
  }

  // ---------------------------------------------------------------- one-shot voice sounds
  let shoutActive = 0;
  // a single shouted / called-out voice somewhere in the hall
  function shout(pos, when, level = 1) {
    if (shoutActive >= 8) return;
    const t = when ?? now();
    const dur = rnd(0.35, 0.85);
    const f0 = rnd(170, 360);
    const out = makeOut(pos || randomPos(), 0.9);
    const saw = ctx.createOscillator(); saw.type = 'sawtooth';
    saw.frequency.setValueAtTime(f0 * 0.93, t);
    saw.frequency.linearRampToValueAtTime(f0 * 1.12, t + dur * 0.3);
    saw.frequency.linearRampToValueAtTime(f0 * 0.9, t + dur);
    const vib = lfo(rnd(5, 7), f0 * 0.015, saw.frequency, t);
    const n = noiseSrc(WHITE, t, t + dur + 0.1);
    const ng = gainNode(0.5); n.connect(ng);
    const sum = ctx.createGain(); saw.connect(sum); ng.connect(sum);
    const V = VOW[pick(['a', 'a', 'o', 'e', 'ae'])];
    const b1 = bp(V[0] * 1.15, 6), b2 = bp(V[1] * 1.1, 8), b3 = bp(V[2], 8);
    const g2 = gainNode(0.6), g3 = gainNode(0.3);
    sum.connect(b1); sum.connect(b2); b2.connect(g2); sum.connect(b3); b3.connect(g3);
    const env = ctx.createGain();
    b1.connect(env); g2.connect(env); g3.connect(env);
    const peak = 0.5 * level;
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(peak, t + 0.06);
    env.gain.setValueAtTime(peak * 0.8, t + dur * 0.6);
    env.gain.linearRampToValueAtTime(0, t + dur);
    env.connect(out.input);
    saw.start(t); saw.stop(t + dur + 0.1);
    shoutActive++;
    saw.onended = () => { shoutActive--; out.dispose(); try { vib.os.stop(); } catch (e) { /* */ } };
    vib.os.stop(t + dur + 0.1);
  }

  // laughter: a run of descending "ha" pulses
  function laugh(pos, when, level = 1) {
    if (shoutActive >= 8) return;
    const t = when ?? now();
    const pulses = 4 + ((Math.random() * 3) | 0);
    const gap = rnd(0.13, 0.19);
    const dur = pulses * gap + 0.1;
    const f0 = rnd(190, 330);
    const out = makeOut(pos || randomPos(), 0.9);
    const saw = ctx.createOscillator(); saw.type = 'sawtooth';
    const n = noiseSrc(WHITE, t, t + dur + 0.1); const ng = gainNode(0.9);
    const sum = ctx.createGain(); n.connect(ng); ng.connect(sum); saw.connect(sum);
    const V = VOW.a;
    const b1 = bp(V[0] * 1.05, 5), b2 = bp(V[1] * 1.05, 7); const g2 = gainNode(0.7);
    sum.connect(b1); sum.connect(b2); b2.connect(g2);
    const env = ctx.createGain(); b1.connect(env); g2.connect(env);
    env.gain.setValueAtTime(0, t);
    for (let i = 0; i < pulses; i++) {
      const pt = t + i * gap, k = 1 - i * 0.1, pk = 0.4 * level * k;
      saw.frequency.setValueAtTime(f0 * (1 - i * 0.04) * 1.08, pt);
      saw.frequency.linearRampToValueAtTime(f0 * (1 - i * 0.04), pt + gap * 0.8);
      env.gain.setValueAtTime(0.0001, pt);
      env.gain.linearRampToValueAtTime(pk, pt + 0.02);
      env.gain.linearRampToValueAtTime(0.0001, pt + gap * 0.85);
    }
    env.gain.linearRampToValueAtTime(0, t + dur);
    env.connect(out.input);
    saw.start(t); saw.stop(t + dur + 0.1);
    shoutActive++;
    saw.onended = () => { shoutActive--; out.dispose(); };
  }

  // PA announcer: bandlimited speech-like syllable stream, two ceiling speakers, second one delayed.
  let announcing = false;
  function announce(when) {
    if (announcing) return 0;
    const t0 = when ?? now() + 0.02;
    const words = 3 + ((Math.random() * 4) | 0);
    // build syllable plan
    const plan = []; let tt = 0;
    const base = rnd(100, 135);
    for (let w = 0; w < words; w++) {
      const syl = 1 + ((Math.random() * 3) | 0);
      for (let s = 0; s < syl; s++) {
        const d = rnd(0.09, 0.17);
        plan.push({ t: tt, d, v: VOW[pick(VKEYS)], cons: Math.random() < 0.65, amp: rnd(0.55, 1) });
        tt += d + rnd(0.0, 0.03);
      }
      tt += rnd(0.07, 0.2);
    }
    const total = tt + 0.2;
    announcing = true;

    const saw = ctx.createOscillator(); saw.type = 'sawtooth';
    const nz = noiseSrc(WHITE, t0, t0 + total + 0.1);
    const nB = bp(3200, 1.2); const nEnv = gainNode(0); nz.connect(nB); nB.connect(nEnv);
    const sum = ctx.createGain(); saw.connect(sum);
    const f1 = bp(600, 4), f2 = bp(1500, 5), f3 = bp(2500, 6);
    const g2 = gainNode(0.6), g3 = gainNode(0.3);
    sum.connect(f1); sum.connect(f2); sum.connect(f3); f2.connect(g2); f3.connect(g3);
    const vEnv = gainNode(0);
    f1.connect(vEnv); g2.connect(vEnv); g3.connect(vEnv);
    const mix = ctx.createGain(); vEnv.connect(mix); nEnv.connect(mix);
    // PA: 300 Hz - 3.4 kHz, mild saturation
    const hp = bp(320, 0.7, 'highpass'), lp = bp(3300, 0.7, 'lowpass'), lp2 = bp(3300, 0.7, 'lowpass');
    const sh = ctx.createWaveShaper();
    const curve = new Float32Array(257); for (let i = 0; i < 257; i++) curve[i] = Math.tanh(((i - 128) / 128) * 2.2);
    sh.curve = curve;
    const trim = gainNode(1.1);
    mix.connect(hp); hp.connect(lp); lp.connect(lp2); lp2.connect(sh); sh.connect(trim);

    // intonation contour: rises over each word, falls at phrase end
    let f0 = base; saw.frequency.setValueAtTime(f0, t0);
    vEnv.gain.setValueAtTime(0, t0);
    for (const s of plan) {
      const st = t0 + s.t, en = st + s.d;
      const prog = s.t / total;
      f0 = base * (1 + 0.12 * Math.sin(s.t * 5.5) - 0.18 * prog) * (Math.random() < 0.15 ? 1.12 : 1);
      saw.frequency.setTargetAtTime(f0, st, 0.025);
      f1.frequency.setTargetAtTime(s.v[0] * 1.05, st, 0.02);
      f2.frequency.setTargetAtTime(s.v[1] * 1.0, st, 0.02);
      f3.frequency.setTargetAtTime(s.v[2], st, 0.02);
      vEnv.gain.setTargetAtTime(s.amp, st + 0.01, 0.015);
      vEnv.gain.setTargetAtTime(0.05, en - 0.02, 0.012);
      if (s.cons) { // fricative / plosive burst at syllable onset
        nEnv.gain.setValueAtTime(0, st - 0.04);
        nEnv.gain.linearRampToValueAtTime(rnd(0.15, 0.5), st - 0.02);
        nEnv.gain.linearRampToValueAtTime(0, st + 0.02);
      }
    }
    vEnv.gain.setTargetAtTime(0, t0 + total - 0.15, 0.03);
    saw.start(t0); saw.stop(t0 + total + 0.1);

    const spk = [
      { pos: { x: -16, y: 9, z: -19 }, delay: 0 },
      { pos: { x: 16, y: 9, z: 19 }, delay: rnd(0.05, 0.09) },
    ];
    const outs = spk.map((s) => {
      const out = makeOut(s.pos, 0.55);
      if (s.delay) { const dn = ctx.createDelay(0.5); dn.delayTime.value = s.delay; trim.connect(dn); dn.connect(out.input); }
      else trim.connect(out.input);
      return out;
    });
    saw.onended = () => { announcing = false; outs.forEach((x) => x.dispose()); };
    return total;
  }

  // ---------------------------------------------------------------- cheer
  let cheerActive = 0;
  function cheer(intensity = 0.7, dur = 4, when) {
    if (cheerActive >= 2) return;
    intensity = clamp(intensity, 0, 1);
    const t = when ?? now();
    const end = t + dur;
    const stopT = end + 3.5;
    cheerActive++;
    const g = ctx.createGain(); g.gain.value = 0;
    const send = gainNode(0.9);
    g.connect(airBus); g.connect(send); send.connect(reverbIn);
    const peak = 1.5 * intensity;
    g.gain.setValueAtTime(0, t);
    g.gain.setTargetAtTime(peak, t, 0.4);
    g.gain.setTargetAtTime(peak * (0.55 + 0.1 * Math.random()), t + dur * 0.55, 0.8);
    g.gain.setTargetAtTime(0, end, 0.7);
    // 8 effortful voices (higher pitch, wider formants, faster AM)
    const bus = ctx.createGain(); bus.connect(g);
    const voices = [];
    for (let i = 0; i < 8; i++) {
      const hi = i % 3 !== 0;
      voices.push(babbleVoice(bus, {
        f0: hi ? rnd(220, 380) : rnd(130, 200), voiced: 0.5, noise: 0.7,
        vowel: pick(['a', 'a', 'o', 'e', 'ae']), fs: hi ? 1.18 : 1.08, q: 3.5,
        base: 0.5, amRate: rnd(2, 4.5), amDepth: 0.25, pan: rnd(-0.85, 0.85),
      }, t, stopT));
    }
    // clapping texture
    const clap = ctx.createBufferSource(); clap.buffer = CLAPS; clap.loop = true;
    clap.start(t, Math.random() * 2); clap.stop(stopT);
    const cb = bp(2100, 0.5); const cg = gainNode(0.75 * clamp(intensity + 0.1, 0, 1));
    clap.connect(cb); cb.connect(cg); cg.connect(g);
    // individual parents calling swimmers' names
    const shouts = Math.min(12, Math.round(dur * (1 + intensity * 2)));
    for (let i = 0; i < shouts; i++) shout(null, t + rnd(0.2, dur), 0.8 + 0.5 * intensity);
    swell(0.25 * intensity, dur * 0.7, t);
    clap.onended = () => { cheerActive--; try { g.disconnect(); send.disconnect(); bus.disconnect(); } catch (e) { /* */ } };
    return voices;
  }

  // ---------------------------------------------------------------- whistle / start signal
  function whistle(kind = 'short', pos = null, when) {
    const t0 = when ?? now() + 0.01;
    let blasts;
    if (kind === 'long') blasts = [[0, 2.0]];
    else if (kind === 'series') {
      const n = 3 + ((Math.random() * 2) | 0); blasts = [];
      for (let i = 0; i < n; i++) blasts.push([i * 0.34, 0.2]);
    } else blasts = [[0, 0.25]];
    const last = blasts[blasts.length - 1];
    const total = last[0] + last[1] + 0.1;
    const f0 = rnd(2850, 3150) * (kind === 'long' ? 0.99 : 1);
    const out = makeOut(pos, 0.55);
    const o1 = ctx.createOscillator(); o1.type = 'triangle'; o1.frequency.value = f0;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f0 * 2.03;
    const o2g = gainNode(0.22);
    const sum = ctx.createGain(); o1.connect(sum); o2.connect(o2g); o2g.connect(sum);
    const rate = rnd(27, 34);                        // pea rattle
    const amp = gainNode(0.62);                      // base level; the pea swings it
    const L1 = lfo(rate, 0.38, amp.gain, t0);         // amplitude warble
    lfo(rate, f0 * 0.022, o1.frequency, t0);          // frequency warble (pea shifts the air-column)
    lfo(rate, f0 * 0.045, o2.frequency, t0);
    if (kind === 'long') lfo(5.2, f0 * 0.006, o1.frequency, t0);
    // breath noise inside the whistle cavity
    const n = noiseSrc(WHITE, t0, t0 + total + 0.1);
    const nb = bp(f0 * 1.05, 2.2); const ng = gainNode(0.9);
    n.connect(nb); nb.connect(ng);
    const body = bp(f0, 0.8, 'peaking'); body.gain.value = 6;
    sum.connect(amp); ng.connect(amp); amp.connect(body);
    const env = ctx.createGain(); body.connect(env);
    env.gain.setValueAtTime(0, t0);
    const peak = kind === 'long' ? 0.5 : 0.42;
    for (const [bt, bd] of blasts) {
      const st = t0 + bt;
      env.gain.setValueAtTime(0, st);
      env.gain.linearRampToValueAtTime(peak, st + 0.015);
      env.gain.setValueAtTime(peak * (kind === 'long' ? 0.9 : 1), st + bd - 0.03);
      env.gain.linearRampToValueAtTime(0, st + bd + 0.02);
      o1.frequency.setValueAtTime(f0 * 0.96, st);
      o1.frequency.linearRampToValueAtTime(f0, st + 0.05);
    }
    env.connect(out.input);
    o1.start(t0); o2.start(t0); o1.stop(t0 + total + 0.1); o2.stop(t0 + total + 0.1);
    L1.os.stop(t0 + total + 0.1);
    o1.onended = () => out.dispose();
  }

  function startSignal(pos = null, when) {
    const t0 = when ?? now() + 0.01;
    const dur = 0.55;
    const out = makeOut(pos, 0.6);
    const f = 1050;
    const sq = ctx.createOscillator(); sq.type = 'square'; sq.frequency.value = f;
    const s2 = ctx.createOscillator(); s2.type = 'sine'; s2.frequency.value = f * 2;
    const s2g = gainNode(0.5);
    const lp = bp(5200, 0.5, 'lowpass'); const hp = bp(500, 0.7, 'highpass');
    const env = ctx.createGain();
    sq.connect(lp); s2.connect(s2g); s2g.connect(lp); lp.connect(hp); hp.connect(env);
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(0.85, t0 + 0.003);
    env.gain.setValueAtTime(0.85, t0 + dur);
    env.gain.linearRampToValueAtTime(0, t0 + dur + 0.012);
    env.connect(out.input);
    sq.start(t0); s2.start(t0); sq.stop(t0 + dur + 0.05); s2.stop(t0 + dur + 0.05);
    sq.onended = () => out.dispose();
  }

  // ---------------------------------------------------------------- water
  let splashActive = 0, heavyActive = 0;
  function splash(pos, size = 0.4, when) {
    size = clamp(size, 0, 1);
    if (splashActive >= 10 && size < 0.8) return;
    if (splashActive >= 14) return;
    const t = when ?? now();
    const dur = (0.09 + size * 0.3) * rnd(0.8, 1.25);
    const out = makeOut(pos, 0.35);
    const n = noiseSrc(WHITE, t, t + dur + 0.1);
    const f0 = rnd(1900, 3400) - size * 900;
    const b = bp(f0, rnd(0.6, 1.3));
    b.frequency.setValueAtTime(f0, t); b.frequency.exponentialRampToValueAtTime(f0 * 0.4, t + dur);
    const g = ctx.createGain();
    const peak = (0.3 + 0.85 * size) * rnd(0.8, 1.1);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.004);
    g.gain.setTargetAtTime(0, t + 0.006, dur / 4);
    if (size > 0.4) { // spatter of droplets after the main slap
      const t2 = t + rnd(0.04, 0.1);
      g.gain.setValueAtTime(peak * 0.3, t2);
      g.gain.setTargetAtTime(0, t2 + 0.003, dur / 3);
    }
    n.connect(b); b.connect(g); g.connect(out.input);
    if (size > 0.22) { // water-body "bloop"
      const os = ctx.createOscillator(); os.type = 'sine';
      const fb = rnd(240, 420) * (1 - size * 0.35);
      os.frequency.setValueAtTime(fb, t); os.frequency.exponentialRampToValueAtTime(fb * 0.4, t + 0.14);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(0.07 * size, t + 0.006);
      og.gain.setTargetAtTime(0, t + 0.008, 0.035);
      os.connect(og); og.connect(out.input); os.start(t); os.stop(t + 0.25);
    }
    splashActive++;
    n.onended = () => { splashActive--; out.dispose(); };
  }

  // shared heavy water impact (dive, feet-first jump)
  function waterImpact(pos, t, P) {
    if (heavyActive >= 4) return;
    const out = makeOut(pos, P.send);
    const stopT = t + P.tail + 0.4;
    // slap
    const n = noiseSrc(WHITE, t, stopT);
    const lp = bp(P.lp, 0.4, 'lowpass');
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(P.peak, t + 0.004);
    g.gain.setTargetAtTime(0, t + 0.006, P.dec / 3);
    n.connect(lp); lp.connect(g); g.connect(out.input);
    // slap click (bright)
    const ck = noiseSrc(WHITE, t, t + 0.05); const ch = bp(3000, 0.7, 'highpass'); const cg = ctx.createGain();
    cg.gain.setValueAtTime(P.peak * 0.7, t); cg.gain.setTargetAtTime(0, t + 0.002, 0.008);
    ck.connect(ch); ch.connect(cg); cg.connect(out.input);
    // thump of displaced water
    const os = ctx.createOscillator(); os.type = 'sine';
    os.frequency.setValueAtTime(P.thumpF, t); os.frequency.exponentialRampToValueAtTime(P.thumpF * 0.35, t + 0.3);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(P.thump, t + 0.012);
    og.gain.setTargetAtTime(0, t + 0.02, 0.09);
    os.connect(og); og.connect(out.input); os.start(t); os.stop(t + 0.7);
    // churning wash with gurgle AM
    const wn = noiseSrc(PINK, t, stopT); const wb = bp(rnd(700, 1100), 0.8); const wg = ctx.createGain();
    wg.gain.setValueAtTime(0, t + 0.02); wg.gain.linearRampToValueAtTime(P.wash, t + 0.12);
    wg.gain.setTargetAtTime(0, t + 0.15, P.tail / 3.2);
    const gur = lfo(rnd(9, 15), P.wash * 0.5, wg.gain, t); gur.os.stop(stopT);
    wn.connect(wb); wb.connect(wg); wg.connect(out.input);
    // bubbles / droplets
    for (let i = 0; i < P.drops; i++) {
      const bt = t + rnd(0.1, P.tail * 0.9), bf = rnd(500, 1900);
      const bo = ctx.createOscillator(); bo.type = 'sine';
      bo.frequency.setValueAtTime(bf, bt); bo.frequency.exponentialRampToValueAtTime(bf * 1.8, bt + 0.05);
      const bg = ctx.createGain();
      bg.gain.setValueAtTime(0, bt); bg.gain.linearRampToValueAtTime(rnd(0.02, 0.06) * P.peak * 2, bt + 0.004);
      bg.gain.setTargetAtTime(0, bt + 0.006, 0.02);
      bo.connect(bg); bg.connect(out.input); bo.start(bt); bo.stop(bt + 0.12);
    }
    heavyActive++;
    wn.onended = () => { heavyActive--; out.dispose(); };
  }

  function diveEntry(pos, when) {
    waterImpact(pos, when ?? now(), { send: 0.4, lp: 5200, peak: 0.95, dec: 0.3, thumpF: 130, thump: 0.3, wash: 0.2, tail: 0.9, drops: 5 });
  }
  function bigSplash(pos, when) {
    waterImpact(pos, when ?? now(), { send: 0.45, lp: 4500, peak: 0.9, dec: 0.55, thumpF: 80, thump: 0.8, wash: 0.34, tail: 1.6, drops: 12 });
  }

  // ---------------------------------------------------------------- underwater
  let underwater = false;
  function setUnderwater(on) {
    underwater = !!on; const t = now();
    const f = underwater ? 350 : FREE;
    uw1.frequency.setTargetAtTime(f, t, underwater ? 0.07 : 0.12);
    uw2.frequency.setTargetAtTime(f, t, underwater ? 0.07 : 0.12);
    airOut.gain.setTargetAtTime(underwater ? 0.85 : 1, t, 0.1);
    rumbleGain.gain.setTargetAtTime(underwater ? 0.22 : 0, t, 0.25);
    bubbleBus.gain.setTargetAtTime(underwater ? 1 : 0.2, t, 0.1);
    if (underwater) startRumble();
  }

  let bubbleActive = 0;
  function bubbles(intensity = 0.5, when) {
    intensity = clamp(intensity, 0, 1);
    const t = when ?? now();
    const count = 3 + Math.round(intensity * 9);
    for (let i = 0; i < count; i++) {
      if (bubbleActive >= 24) break;
      const bt = t + rnd(0, 0.15 + intensity * 0.5);
      const bf = rnd(260, 900);
      const os = ctx.createOscillator(); os.type = 'sine';
      os.frequency.setValueAtTime(bf, bt);
      os.frequency.exponentialRampToValueAtTime(bf * rnd(1.4, 2.0), bt + 0.09);
      const g = ctx.createGain();
      const pk = rnd(0.04, 0.12) * (0.5 + intensity);
      g.gain.setValueAtTime(0, bt); g.gain.linearRampToValueAtTime(pk, bt + 0.006);
      g.gain.setTargetAtTime(0, bt + 0.01, rnd(0.02, 0.05));
      os.connect(g); g.connect(bubbleBus); os.start(bt); os.stop(bt + 0.25);
      bubbleActive++; os.onended = () => { bubbleActive--; g.disconnect(); };
    }
    // the gurgle of the exhale itself
    const gt = t, gd = 0.25 + intensity * 0.5;
    const n = noiseSrc(PINK, gt, gt + gd + 0.2); const f = bp(rnd(350, 600), 1.2); const g = ctx.createGain();
    g.gain.setValueAtTime(0, gt); g.gain.linearRampToValueAtTime(0.06 * (0.4 + intensity), gt + 0.05);
    g.gain.setTargetAtTime(0, gt + 0.08, gd / 3);
    lfo(rnd(14, 22), 0.03, g.gain, gt).os.stop(gt + gd + 0.2);
    n.connect(f); f.connect(g); g.connect(bubbleBus); n.onended = () => g.disconnect();
  }

  // ---------------------------------------------------------------- transport
  function setMasterVolume(v) { master.gain.setTargetAtTime(clamp(v, 0, 2), now(), 0.05); }
  function suspend() { if (!isOffline) return ctx.suspend(); }
  function resume() { if (!isOffline) return ctx.resume(); }
  function dispose() { clearTimers(); try { master.disconnect(); } catch (e) { /* */ } }

  return {
    master, ctx,
    startAmbience, setCrowd, cheer, whistle, startSignal, splash, diveEntry, bigSplash,
    setListener, setUnderwater, bubbles, setMasterVolume, suspend, resume,
    // extras
    shout, laugh, announce, swell, dispose,
    stats: () => ({ splash: splashActive, heavy: heavyActive, hrtf: hrtfActive, shout: shoutActive, cheer: cheerActive, bubbles: bubbleActive }),
  };
}
