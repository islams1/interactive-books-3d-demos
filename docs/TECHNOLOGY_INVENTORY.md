# Technology Inventory

Only technologies verified in the workspace are listed. "Runtime" means the technology runs in the learner's browser. "Dev" means it runs only on the developer machine.

| # | Technology | Version | Layer | Verified usage | Evidence | Essential? |
|---|---|---|---|---|---|---|
| 1 | JavaScript (ES modules, top-level `await`) | ES2022 features | Runtime | All application code, inline in each HTML file | every page's `<script type="module">` | Essential |
| 2 | HTML5 / CSS3 | — | Runtime | UI overlay (HUD, menu, transcript, choices, debrief), RTL layout | page heads and bodies | Essential |
| 3 | three.js | **0.170.0** (pinned in import maps) | Runtime | Rendering, scene graph, materials, `AnimationMixer`, `AudioListener` / `PositionalAudio`, loaders | import maps in `saf01.html`, `agr03.html:118-124`, `aq01.html`, `index.html`, `pumpjack*/index.html` | Essential |
| 4 | three.js addon `FBXLoader` | 0.170.0 | Runtime | Rocketbox bodies and motion clips | SAF, AGR, Drill | Replaceable (GLB clips) |
| 5 | three.js addon `GLTFLoader` | 0.170.0 | Runtime | Renderpeople GLBs, Poly Haven models, experimental GLB hands | SAF, AGR | Essential |
| 6 | three.js addon `RGBELoader` | 0.170.0 | Runtime | HDRI `belfast_farmhouse_2k.hdr` | SAF, AGR | Replaceable |
| 7 | three.js addon `RoomEnvironment` | 0.170.0 | Runtime | Fallback image-based lighting | SAF, AGR, pumpjack | Replaceable |
| 8 | three.js addon `RoundedBoxGeometry` | 0.170.0 | Runtime | Rounded procedural parts | SAF, AGR, pumpjack | Replaceable |
| 9 | three.js addon `SkeletonUtils` | 0.170.0 | Runtime | Cloning the GLB hands | SAF (experimental path), Drill | Optional |
| 9b | three.js addon `Sky` | 0.170.0 | Runtime | Sky dome | `pumpjack-field/index.html` | Optional |
| 10 | three.js addon `BufferGeometryUtils` | 0.170.0 | Runtime | Merging procedural people geometry | `aq01/people.js` | Optional |
| 11 | three.js addon `OrbitControls` | 0.170.0 | Runtime | Orbit camera in the machine explorers | `pumpjack/index.html` | Essential there |
| 12 | jsDelivr CDN | — | Runtime delivery | Serves three.js and addons | import-map URLs `https://cdn.jsdelivr.net/npm/three@0.170.0/...` | Replaceable (self-host) |
| 13 | Google Fonts | — | Runtime delivery | IBM Plex Sans Arabic, Aref Ruqaa, Caveat, JetBrains Mono, Space Grotesk; Noto Kufi Arabic and Noto Sans (AQ) | `<link>` in page heads | Replaceable |
| 14 | WebGL 2 (three.js 0.170 `WebGLRenderer` requires WebGL 2) | browser | Runtime | GPU rendering | `WebGLRenderer` | Essential |
| 15 | Web Audio API | browser | Runtime | Voice playback with positional audio; full sound synthesis in AQ-01 (noise buffers, oscillators, `ConvolverNode`, HRTF `PannerNode`, `DynamicsCompressor`) | `speak` in SAF/AGR; `aq01/audio.js` `createHallAudio` | Essential |
| 16 | Pointer Lock API | browser | Runtime | Mouse-look | input sections | Replaceable |
| 17 | Canvas 2D API | browser | Runtime | Notebook pages, labels, signs, scoreboard textures | `nbDraw` (AGR), `canvasTex`, `canvasNum` (AQ) | Essential (notebook) |
| 18 | Web Worker (Blob) | browser | Runtime (experimental) | Depth sorting for the Gaussian-splat figure | SAF splat section (only with `?karim=scan`) | Optional |
| 19 | localStorage | browser | Runtime | Language, quality and gloves preferences (`fp-lang`, `fp-q`, `fp-gloves`, `aq-lang`, `pj-lang`) | — | Replaceable |
| 20 | Vercel (static hosting + CLI) | CLI `vercel@latest` via npx | Deployment | Hosting SAF-01 and AGR-03 | `deploy/*/.vercel/project.json` (project names only) | Replaceable |
| 21 | ElevenLabs Text-to-Speech API | model `eleven_v3` | **Dev only** | Generated the 83 voice files with per-letter timings | `assets/audio/*/manifest.json` (`"model": "eleven_v3"`); `gen_lines.py` copy in `submission/ai-pipeline/scripts/tts/` | Replaceable |
| 22 | Claude Code (Anthropic) | main model `claude-opus-5-5`; some subagents on `claude-sonnet-5-5` / `claude-haiku-5-5` | **Dev only** | Wrote the code of all demos | development transcripts; `INTERACTIVE_3D_MACHINE_SPEC.md` | Process tool |
| 23 | Python | 3.11.9 | Dev | Build script, scan tools, voice / asset / deploy scripts | `scenarios/saf01/build_saf01.py`, `tools/*.py` | Dev-only |
| 24 | Node.js | 20.20.2 | Dev | `tools/perf.mjs` (fps probe via DevTools protocol); grip solver | `fp-extinguisher/tools/perf.mjs` | Dev-only |
| 25 | Google Chrome (headless) | installed browser | Dev | Screenshots (SwiftShader) and GPU perf runs | `tools/shoot.ps1`, `tools/perf.mjs` | Dev-only |
| 26 | Blender (headless) | 5.2 | Dev | FBX→GLB conversion, AO baking, scan fitting | script copies in `submission/ai-pipeline/scripts/assets`, `character-scan` | Dev-only |
| 27 | Microsoft Rocketbox avatars + animations | — | Asset | NPC animation source, first-person hands | `assets/ROCKETBOX_LICENSE.md` (MIT) | Essential (licence-clean) |
| 28 | Poly Haven | — | Asset | Textures, props, HDRI | `assets/polyhaven/LICENSE.md` (CC0) | Essential (licence-clean) |
| 29 | Renderpeople free samples | — | Asset | Visible NPC bodies | `assets/renderpeople/*` (no licence file in the folder) | Replaceable |
| 30 | Sketchfab "Rigged hand" | — | Asset (experimental) | GLB hand behind `?hand=sketch` | glTF `asset.extras`: CC-BY-SA-4.0 | Optional |

## Not present (checked)

- **Package management, build and type tooling:** no npm/yarn/pnpm manifests, no bundler (Vite/Webpack/Rollup), no TypeScript.
- **Frameworks and libraries:** no UI framework (React/Vue/Svelte), no state library, no physics engine (Rapier/Cannon/Ammo), no animation library beyond three.js.
- **Backend:** no server framework, no database, no authentication.
- **Testing and delivery:** no CI, no test framework, no service worker.
- **Runtime AI:** none. No AI SDK or API is called at runtime.
