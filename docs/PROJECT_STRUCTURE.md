# Project Structure

This file describes the workspace `C:\book` as inspected on 2026-11-15. There is no `package.json`, no build configuration and no git repository. Every demo is a static HTML page.

```
C:\book
├─ .env                              ELEVENLABS_API_KEY (read only by the offline voice scripts; value not shown)
├─ .claude/settings.local.json       Claude Code local permissions (browser tool domains)
├─ <Arabic-named>.mp3                personal audio clip, identical to fp-extinguisher/assets/audio/murtada.mp3; rights unverified
├─ INTERACTIVE_3D_MACHINE_SPEC.md    build spec written as instructions for AI agents (machine explorers)
├─ fp-extinguisher/                  ← scenario games; serve this folder as the web root
│  ├─ saf01.html                     SAF-01 The Wrong Extinguisher (shipped)            286,888 B · 3,708 lines
│  ├─ agr03.html                     AGR-03 The Wilting Tomato (shipped)                226,913 B · 2,558 lines
│  ├─ aq01.html                      AQ-01 Still in Lane Four (work in progress)         70,725 B ·   874 lines
│  ├─ aq01/
│  │  ├─ people.js                   procedural swimmers, officials, crowd (ES module)  1,159 lines
│  │  ├─ audio.js                    synthesised hall sound, Web Audio (ES module)        743 lines
│  │  ├─ test-people.html            test bench for people.js
│  │  └─ test-audio.html             test bench for audio.js
│  ├─ index.html                     Extinguisher Drill: the prototype SAF-01 was generated from  3,079 lines
│  ├─ grip/tripod.json               offline-solved pen grip used by AGR-03 (loadGrip)
│  ├─ scenarios/saf01/
│  │  ├─ build_saf01.py              anchor-patch generator: index.html + src → saf01.html (DRIFTED, do not run)
│  │  └─ src/                        saf.js, shed.js, npc.js, workers.js: text fragments inserted by the build
│  ├─ assets/
│  │  ├─ anim/                       10 Rocketbox motion-capture clips (.fbx), MIT
│  │  ├─ Construction_Female_01/ Construction_Male_01/ Construction_Male_02/ Male_Adult_01/
│  │  │                              Rocketbox bodies (.fbx + .jpg), MIT; Male_Adult_01 = first-person hands
│  │  ├─ ROCKETBOX_LICENSE.md        MIT licence text
│  │  ├─ polyhaven/                  CC0 textures, glTF models, HDRI + LICENSE.md + assets.json
│  │  ├─ renderpeople/               6 scanned people (.glb + 2K .jpg): carla, claudia, eric, manuel, nathan, sophia
│  │  ├─ audio/agr03/, audio/saf01/  voice lines: <key>.mp3 + <key>.json (letter timings) + manifest.json
│  │  ├─ audio/murtada.mp3, samples/ human recording used by the Drill prototype; sample voices
│  │  ├─ sketchfab/rigged_hand.glb   CC-BY-SA hand (experimental ?hand=sketch)
│  │  ├─ meta/generic_*.glb          hands of unknown provenance (experimental ?hand=meta)
│  │  ├─ fullbody/  splat/  avatar/  PRIVATE: Gaussian-splat scans and research-only bodies (R&D; never deployed)
│  ├─ tools/                         scan_orient.py, ply_to_splat.py, straight_check.py, eye_measure.py,
│  │                                 measure_fit.py (scan pipeline); shoot.ps1 (screenshots); perf.mjs (fps probe)
│  ├─ backups/                       38 dated HTML snapshots (agr03 ×33, saf01 ×5) + 7 PNG review shots
│  ├─ skin_options.png               a skin-tone comparison image (R&D)
│  ├─ voice-samples.html             listening page for all generated voice lines
│  ├─ rp-test.html                   Renderpeople + Rocketbox retarget test bench (R&D)
│  ├─ look-lab.html, avatar-test.html  scanned-figure lighting and animation labs (R&D)
│  ├─ grip-test.html                 pen-grip test bench (R&D)
│  └─ SCAN_CHARACTER_GUIDE.md        Arabic runbook: building a character from a splat scan
├─ pumpjack/index.html               machine explorer: Ironhorse PJ-320 pumpjack (procedural)   1,917 lines
├─ pumpjack-drill/index.html         + drilling-to-first-oil timeline                           2,134 lines
├─ pumpjack-field/index.html         + field of extra pumpjacks; static.html = variant without the drilling timeline
├─ deploy/
│  ├─ saf01/  agr03/                 Vercel deploy copies (index.html + only the assets each game needs)
│  │                                 .env.local holds a Vercel token; .vercel/ holds the project link (not to be shared)
│  │                                 deploy/agr03/game.html = identical copy of its index.html
│  ├─ extinguisher-drill/  oil-field/  older anonymous deploy copies (expired links)
│  ├─ _vercel_links/                 archived .vercel folders of expired temporary deployments
│  └─ redirect-old-link.cmd          one-off Vercel firewall redirect command (not run by the code)
├─ submission/                       earlier submission documents + copies of the offline generation scripts
├─ docs/                             THIS documentation
├─ Gsplat-unity-virtual-human/       third-party research clone (MIT code; research-only data), not used at runtime
├─ SplattingAvatar/                  third-party research clone (CC BY-NC-SA), not used
├─ gaussians_099.ply, gaussians_362.ply   PRIVATE personal 3D scans
└─ rigged_hand.glb                   duplicate of assets/sketchfab/rigged_hand.glb
```

## Responsibilities of the important files

| File | Responsibility | Key functions / objects | Talks to | Why it matters |
|---|---|---|---|---|
| `fp-extinguisher/saf01.html` | The whole SAF-01 game: UI, renderer, world, NPCs, voices, hands, fire, scenario, endings, loop | `SAF` runner (`updateSAF`), `Engine`, `updateHands`, `updateFire`, `attachRP` / `updateRP`, `speak` / `updateFace`, `finish` | assets (static `fetch`), three.js CDN | Most complete reference of the runtime patterns |
| `fp-extinguisher/agr03.html` | The whole AGR-03 game, including the notebook writing and pot-lift systems | `G`, `updateFlow`, `useE`, `judge`, `endingFor`, `NB` / `nbUpdate`, `loadGrip`, `potLift` | assets, `grip/tripod.json` | Shows how systems were copied from SAF-01 and extended |
| `fp-extinguisher/aq01.html` | AQ-01 phase 1: pool hall, water and glare, timeline, whistle | `S`, `at`, `updateHeats`, `glareCover`, `whistle`, `endPhase1` | `aq01/people.js`, `aq01/audio.js` via dynamic `import()` | Only game that is partly modular; zero asset files |
| `fp-extinguisher/aq01/people.js` | Procedural skinned people and crowd | `makeKid`, `makeAdult`, `makeCrowd`, pose table `ST` | three.js | Reusable zero-asset characters |
| `fp-extinguisher/aq01/audio.js` | Synthesised natatorium sound | `createHallAudio` | Web Audio | Reusable ambience without licensed samples |
| `fp-extinguisher/index.html` | Extinguisher Drill prototype | hand state machine, fire, stress | assets incl. private scans | Engine base of SAF-01 |
| `fp-extinguisher/scenarios/saf01/build_saf01.py` | Generated `saf01.html` from `index.html` on 2026-11-10 | `rep`, `cut` anchor functions | writes `saf01.html` | No longer the source of truth |
| `fp-extinguisher/grip/tripod.json` | Finger-bone quaternions, pen pose, contacts and diagnostics for the writing hand | — | read by `loadGrip` in AGR-03 | Example of offline-solved data driving runtime animation |
| `fp-extinguisher/assets/audio/*/manifest.json` | Line key → speaker, duration, voice id, model | — | read by `loadVoices` | The contract between the voice pipeline and the games |
| `INTERACTIVE_3D_MACHINE_SPEC.md` | Instructions for an AI agent to build a new machine explorer from an idea | Part Table schema, checklist, test procedure | `pumpjack/index.html` as reference | Precedent for spec-driven generation |
