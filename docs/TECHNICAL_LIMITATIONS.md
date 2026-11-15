# Technical Limitations and Recommendations

Each entry lists **Description**, **Evidence**, **Impact**, **Current workaround** and **Recommended solution**. Only issues confirmed in code or files are listed as confirmed. Items that could not be measured are marked **Not verified**. References are `path:line`, verified on 2026-11-15.

Severity: **High** = blocks production or a commercial release · **Medium** = limits scale, quality or maintainability · **Low** = clean-up.

---

## A. Architecture and code

### L1: Scenario logic is hard-coded JavaScript (High)

| Field | Detail |
|---|---|
| Description | The scenario is not data. Dialogue, questions, branching and ending rules are JS literals and callbacks inside each game file. |
| Evidence | SAF-01 situation module from the banner at `fp-extinguisher/saf01.html:3049`: `afterReason` `:3294`, `step1` `:3362`, `finish` `:3420`. AGR-03 `askAction` `agr03.html:2204`, `judge` `:2214`, `endingFor` `:2239`. AQ-01 timeline `at(...)` / `atT(...)` calls at `aq01.html:600-616`. |
| Impact | Content can't be validated or generated automatically, and a tool can't enumerate the paths. Every content change needs a developer, and each new scenario is a new code file. |
| Current workaround | Autopilot paths (`?auto=…`) exercise the main branches by hand. |
| Recommended solution | A Situation JSON schema (scenes, actions, ratings, transitions, endings, 3D cues) plus a data-driven runner that keeps the existing queue semantics (`say / ask / wait / until / run`). |

### L2: The training engine is a mock (High)

| Field | Detail |
|---|---|
| Description | The `Engine` only logs events. There is no score, no competencies, no persistence and no reporting. |
| Evidence | `Engine` `saf01.html:2367` (section 8, "ENGINE (mock)", `:2365`); `Engine` `agr03.html:2361`. Nothing is written to storage or the network. |
| Impact | Results are lost on reload, and teachers and the platform receive no learning data. |
| Current workaround | Debrief screens list decisions and mistakes. AGR-03 suggests a rubric level per axis (shown, not stored). |
| Recommended solution | Use a deterministic decision engine with ratings, points, competencies and caps. Send every learner act as an event (xAPI or an attempts API). |

### L3: Code duplication between games (High)

| Field | Detail |
|---|---|
| Description | Games are made by copying earlier games. |
| Evidence | 81 % of `index.html` non-blank lines appear verbatim in `saf01.html`. SAF-01 and AGR-03 share 63 function names (27 nearly identical: bodies at least 95 % similar), e.g. `attachRP`, `updateRP`, `speak`, `setupFace`, `updateFace`, `npcLook`, `loadClip`, `dlgTick`, `pbr`, `uvM`. |
| Impact | Every fix has to be ported by hand, and the copies drift apart. For example, AGR-03's characters gesture while they talk (`GEST`, `speechMarks`), and SAF-01's do not. |
| Current workaround | None. |
| Recommended solution | Extract shared ES modules (character, voice, hands, runner, UI, FX) and import them from both games, as a first step with no behaviour change. |

### L4: The SAF-01 build script has drifted (High until retired)

| Field | Detail |
|---|---|
| Description | `build_saf01.py` regenerates an older SAF-01 and writes it over the shipped file. |
| Evidence | Rebuilding from the script gives 3,319 lines, while the shipped `saf01.html` has 3,708 (54 differing hunks). The script's `src/npc.js` says there are no voice clips, and `src/workers.js` makes Karim a splat figure. The script's output path is `fp-extinguisher/saf01.html`. |
| Impact | Re-running it silently loses the voices, the chat transcript, the Renderpeople bodies and the new fire. |
| Current workaround | The script has not been used since 2026-11-10. |
| Recommended solution | Retire it, or regenerate it from the current file. Put the code under version control. |

### L5: No version control, CI or automated tests (High)

| Field | Detail |
|---|---|
| Description | The project has no repository, no pipeline and no test suite. |
| Evidence | No `.git` in `C:\book`. There are 38 HTML snapshots (plus 7 PNG images) in `fp-extinguisher/backups/`. No test framework or CI configuration exists. |
| Impact | There is no history, review or regression protection. |
| Current workaround | Dated backups, plus manual autopilot and screenshot checks. |
| Recommended solution | A git repository (with LFS for assets) and CI that runs every autopilot path headlessly, compares screenshots and checks a frame-time budget. |

### L6: Monolithic files with shared mutable state (Medium)

| Field | Detail |
|---|---|
| Description | Each game is one module scope with many mutable globals, and the sections are coupled to each other. |
| Evidence | `updateFire` reads `SAF.extType` and `SAF.fireCap`; the HUD calls `safObjective` (`saf01.html:3569`); `Engine` calls `SAF.onFireOut` (`:3397`) and `SAF.onEmpty` (`:3414`). State objects sit at `saf01.html:2346-2360`, `:3194`, and `agr03.html:2044`. |
| Impact | The code is hard to test in isolation, hard to review, and risky to change. Save/resume is not possible. |
| Current workaround | Numbered section banners. |
| Recommended solution | Modules with explicit APIs, an event bus between FX, interaction and scenario code, and a serialisable scenario state. |

### L7: Test hooks ship to learners (Medium)

| Field | Detail |
|---|---|
| Description | Debug URL switches and a stress slider are reachable in production. |
| Evidence | 71 URL parameters in SAF-01 and 60 in AGR-03. `window.__saf` `saf01.html:3582`, `window.__agr` `agr03.html:2550`, `window.__aq` `aq01.html:870`. The menu has a "Stress override (testing)" slider. |
| Impact | Learners can skip steps, jump to endings or change the simulation. |
| Current workaround | None. |
| Recommended solution | Put them behind a dev build flag or `?dev=1` with a guard. |

---

## B. Assets, loading and performance

### L8: Staged loading, no progress UI, uncompressed assets (Medium)

| Field | Detail |
|---|---|
| Description | Assets load in stages. Each stage waits for the previous one, while files inside a stage load in parallel. Nothing is drawn until all stages are done. |
| Evidence | Boot `await` stages at `saf01.html:3675-3705` and `agr03.html:2530-2555`. FBX clips are parsed at runtime. No Draco, KTX2 or meshopt references exist. The deploy folders are about 100 MB each (`deploy/saf01` 102.6 MB, `deploy/agr03` 99 MB). |
| Impact | Long blank start on slow connections. Higher bandwidth cost. |
| Current workaround | Browser HTTP cache. |
| Recommended solution | Fully parallel loading with a progress screen, GLB clips retargeted offline, KTX2 textures, meshopt geometry, hashed CDN files, lazy loading per scene. |

### L9: Unused files in the deployments (Low)

| Field | Detail |
|---|---|
| Description | The deploy copy contains assets that SAF-01 never references. |
| Evidence | `deploy/saf01/assets` includes Renderpeople carla, claudia and sophia; clips `m_idle_angry_01/02`, `m_run_*`, `m_work_table`; `*_normal_orig.jpg`; `nathan_color_mud.jpg` (about 26 MB). `deploy/agr03` ships all 6 Renderpeople bodies, of which 4 are unused by default (about 15 MB). |
| Impact | Bandwidth and storage. Licensed files are exposed for no reason. |
| Current workaround | None. |
| Recommended solution | A per-game asset manifest that drives the deploy copy. |

### L10: Each NPC is skinned twice (Low)

| Field | Detail |
|---|---|
| Description | A hidden Rocketbox rig plays the clip, and its pose is copied to the visible Renderpeople skeleton every frame. |
| Evidence | `updateRP` at `saf01.html:1119` and `agr03.html:929`. |
| Impact | Extra CPU work per character. **Not measured.** |
| Current workaround | None. |
| Recommended solution | Retarget clips offline to the visible rig and play them directly. |

### L11: AQ-01 per-frame cost not profiled (Medium, Not verified)

| Field | Detail |
|---|---|
| Description | Each frame renders the scene twice (refraction pass plus main pass) and rebuilds the shadow map. The pool shaders run per-pixel loops. |
| Evidence | `refrRT` `aq01.html:412`, `tick` `:830`, water shader in the section from `:408`. |
| Impact | Possibly low frame rates on integrated or mobile GPUs. **Not measured.** |
| Current workaround | Pixel ratio cap; refraction at 0.6× resolution. |
| Recommended solution | Profile it; cache static shadows; give the refraction pass its own quality tier. |

### L12: Runtime CDN dependency without integrity checks (Medium)

| Field | Detail |
|---|---|
| Description | three.js and the fonts are fetched from third-party CDNs at runtime. |
| Evidence | Import maps pointing to `cdn.jsdelivr.net/npm/three@0.170.0/`; Google Fonts `<link>`. There are no `integrity` attributes. |
| Impact | Offline or restricted networks (e.g. schools) break the app. Supply-chain exposure. |
| Current workaround | Version is pinned to 0.170.0. |
| Recommended solution | Self-host the pinned build and the fonts with the app. |

---

## C. Interaction, platform and content

### L13: Desktop-only input (Medium)

| Field | Detail |
|---|---|
| Description | All scenario games need pointer lock, a keyboard and a mouse. |
| Evidence | Input sections (`saf01.html` section 9 from `:2392`). SAF-01 CSS hides HUD panels below 820 px and the transcript below 960 px. AGR-03 states "keyboard and mouse needed" in its intro text (`STR.note`). |
| Impact | Unusable on phones and tablets. |
| Current workaround | None. |
| Recommended solution | Touch look and move, tap-to-act on objects, and an "assisted" interaction mode for complex gestures such as PASS. |

### L14: English mode has no voices (Medium)

| Field | Detail |
|---|---|
| Description | Only Arabic lines are voiced. |
| Evidence | `speak` returns `null` when `LANG !== 'ar'` (`agr03.html:802`); same rule in SAF-01 `speak` (`:1160`). |
| Impact | English learners get subtitles only, so the lip-sync is driven by text timing. |
| Current workaround | Subtitles with text-timed lips. |
| Recommended solution | Generate an English voice pack with the same `gen_lines.py` contract. |

### L15: Voice/text drift (Low)

| Field | Detail |
|---|---|
| Description | Editing a line's text does not regenerate its audio. The game then silently falls back to text-based timing. |
| Evidence | `dlgTick` compares the text length with the timing length (`agr03.html:2380`; SAF `:3538`). In SAF, `x_co2` is spoken with a different spelling, so it always falls back. |
| Impact | Audio can say something different from the subtitle. |
| Current workaround | Manual regeneration with `gen_lines.py --keys=…`. |
| Recommended solution | Key voice files by a hash of the text and regenerate them in CI. |

### L16: Brief rules simplified (Medium)

| Field | Detail |
|---|---|
| Description | Some rules from the client briefs are implemented in a simpler form. |
| Evidence | SAF-01 `finish` (`:3420`) gives ending 2 for any mistake, while the brief says "one corrected / one missed". `LIMIT = 600` (`:2345`) only feeds stress, so there is no time limit. AQ-01 `endPhase1` (`:781`) uses 3 outcomes instead of the brief's E1–E5 bands: a whistle within 25 s, a whistle before heat 4 dives in, or later. The session ends on its own at T+170. |
| Impact | Assessment differs from the brief. |
| Current workaround | Debrief text explains each outcome. |
| Recommended solution | Encode the brief's rules as data in the decision engine, and validate them against the brief. |

### L17: AQ-01 phases 2–4 missing (High for that demo)

| Field | Detail |
|---|---|
| Description | Only phase 1 exists. The rescue, voices, decisions, E1–E5 endings and the debrief are missing. |
| Evidence | `whistle` (`aq01.html:714`) ends the session after 3.2 s, and `endPhase1` (`:781`) shows the result. No rescue states are used for the player. |
| Impact | The scenario's core learning loop (recognise → stop → rescue → hand over) is incomplete. |
| Current workaround | None. |
| Recommended solution | Build the remaining phases on the shared player, not as another copied file. |

---

## D. Licensing, compliance, security

### L18: Asset and voice licensing (High for commercial release)

| Field | Detail |
|---|---|
| Description | Some assets have licences that are restricted or unverified. |
| Evidence | `assets/renderpeople/` has no licence file and is served as loose files in `deploy/*/assets/renderpeople/`. `assets/sketchfab/rigged_hand.glb` is CC-BY-SA per its glTF metadata. `assets/meta/*.glb` has no provenance. Voice files come from an ElevenLabs free-plan account (developer's notes). Renderpeople's and ElevenLabs' terms were **not verified from files in the workspace**. |
| Impact | Possible blocker for commercial or learning-platform use. |
| Current workaround | `?rp=0` switches SAF-01 and AGR-03 to Rocketbox bodies (MIT). |
| Recommended solution | An asset registry with the licence per file; written consent or licence-clean replacements; a commercial TTS plan. |

### L19: Private data in the workspace (High if published)

| Field | Detail |
|---|---|
| Description | Personal 3D scans and research-only bodies sit next to the code. |
| Evidence | `gaussians_*.ply`, `fp-extinguisher/assets/splat/`, `assets/fullbody/`, `assets/avatar/`. |
| Impact | Privacy and licence breach if pushed to a repository or deployed. |
| Current workaround | They are excluded from the deploy copies. |
| Recommended solution | Move them out of the source tree; add `.gitignore` rules before creating any repository. |

### L20: Secrets handling (Medium)

| Field | Detail |
|---|---|
| Description | Secrets are kept as plain files inside the workspace. |
| Evidence | `C:\book\.env` (`ELEVENLABS_API_KEY`); `deploy/*/.env.local` (`VERCEL_OIDC_TOKEN`). The values were not inspected. |
| Impact | Risk of leaking them through a repository or a deploy. |
| Current workaround | `.gitignore` files exist inside the deploy folders. |
| Recommended solution | A secret store, a root `.gitignore`, and key rotation if a key has ever been shared. |
