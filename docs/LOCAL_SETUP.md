# Local Setup

Every command below was checked against the project on 2026-11-15. The static-server commands were run and returned HTTP 200 for `saf01.html`, `agr03.html`, `aq01.html`, `aq01/people.js`, `aq01/audio.js`, `index.html`, `assets/audio/saf01/manifest.json`, `grip/tripod.json`, `pumpjack/`, `pumpjack-drill/` and `pumpjack-field/`.

## 1. Prerequisites

| Requirement | Version used | Needed for |
|---|---|---|
| Desktop browser with WebGL (Chrome or Edge recommended) | current | Running the demos |
| Any static HTTP server | Python 3.11.9 `http.server` was used | Serving the files. ES modules and `fetch()` do not work over `file://`. |
| Internet access | — | three.js 0.170.0 from `cdn.jsdelivr.net` and Google Fonts load at runtime |
| Keyboard + mouse | — | All scenario games (pointer lock) |

There is **nothing to install**: no `npm install`, no virtual environment and no dependencies.

## 2. Installation

Get the folders below from the developer. There is no repository URL yet.

- **Scenario games:** `fp-extinguisher/` with its `assets/` subfolder. The private folders `assets/fullbody/`, `assets/splat/` and `assets/avatar/` are not needed by the default game paths.
- **Machine explorers:** `pumpjack/`, `pumpjack-drill/`, `pumpjack-field/`.

## 3. Environment configuration

The games need **no environment variables**. `C:\book\.env` (`ELEVENLABS_API_KEY`) is read only by the offline voice-generation script, never by the games.

## 4. Development server

Scenario games (the web root must be `fp-extinguisher`, because asset paths are relative to it):

```bash
cd C:\book\fp-extinguisher
python -m http.server 8765
```

| Page | URL |
|---|---|
| SAF-01 | http://127.0.0.1:8765/saf01.html |
| AGR-03 | http://127.0.0.1:8765/agr03.html |
| AQ-01 | http://127.0.0.1:8765/aq01.html |
| Extinguisher Drill (prototype) | http://127.0.0.1:8765/index.html |
| Voice samples | http://127.0.0.1:8765/voice-samples.html |

Machine explorers:

```bash
cd C:\book
python -m http.server 8770
```
Then open http://127.0.0.1:8770/pumpjack/, `/pumpjack-drill/` and `/pumpjack-field/`.

Useful URL switches (verified in code):

| URL | Effect |
|---|---|
| `saf01.html?lang=en` | English UI |
| `saf01.html?q=low` | Low graphics tier |
| `saf01.html?step=2` | Start at step 2 |
| `saf01.html?ending=3` | Jump to ending 3 |
| `saf01.html?demo=1` | Autopilot demo |
| `agr03.html?auto=water` | Autopilot path that ends in E3 (also `1`, `spray`, `shade`, `blame`) |
| `agr03.html?ending=2` | Jump to ending E2 |
| `agr03.html?from=2` | Start at step 2 |
| `aq01.html?auto=good` | Demo with a timely whistle (also `late`, `none`) |
| `aq01.html?freeze` | Stop the real-time loop; step it from the console with `window.__aq.tick(n)` |
| `aq01.html?standin&mute` | Run without `people.js` / `audio.js` |
| SAF-01, AGR-03 or the Drill + `?perf` | Writes `window.__perf` (GPU, fps, frame times) after a few seconds. AQ-01 has no `?perf`. |
| `pumpjack/?lang=ar` | Arabic interface |
| `pumpjack/#gearbox+cut` | Deep link: select a part and a mode (`#<part>`, `#explode`, `#cut`, `#xray`, `#down`, `#open`, `#iso`, combined with `+`) |

## 5. Build commands

**There is no build step.** The HTML files are the deployable artifacts.

**Warning:** `fp-extinguisher/scenarios/saf01/build_saf01.py` exists, but it is **out of date**. Running it would overwrite `saf01.html` with an older version that has no voices, no transcript and no Renderpeople bodies. Do not run it.

## 6. Production preview and deployment

- **Preview:** serve the deploy folder exactly as it will be hosted. Then open http://127.0.0.1:8780/.
  ```bash
  cd C:\book\deploy\saf01
  python -m http.server 8780
  ```
- **How the live links were deployed** (manual process, Vercel CLI, requires the developer's Vercel login):
  1. Copy the game page to `deploy/<game>/index.html` together with only the asset folders that game uses. The developer used a sync script; a copy is in `submission/ai-pipeline/scripts/deploy/sync_deploy.py`.
  2. From that folder run: `npx vercel@latest deploy --prod --yes --scope <team>`. This command comes from the developer's notes; the first links were temporary deployments that were claimed later.
- **Live URLs (HTTP 200 on 2026-11-15):**
  - SAF-01: https://instant-crystal-wnj8dit-islams-projects-5b27661f.vercel.app/
  - AGR-03: https://fast-dune-d4l8zrv-islams-projects-5b27661f.vercel.app/

## 7. External dependencies

| Dependency | Needed at | Fallback |
|---|---|---|
| `cdn.jsdelivr.net` (three.js 0.170.0) | Runtime | None. The page will not start without it. |
| `fonts.googleapis.com` / `fonts.gstatic.com` | Runtime | Browser default fonts. The notebook handwriting fonts would fall back too. |
| ElevenLabs API | Only to regenerate voices (offline) | Existing MP3 files are used |
| Vercel | Only for hosting | Any static host |

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Blank page, console error about modules or CORS | Opened with `file://` | Serve over HTTP (section 4) |
| 404s for `assets/...` | Server started in the wrong folder | Start the server inside `fp-extinguisher/` |
| Long black or empty screen at start (SAF-01, AGR-03) | ~100 MB of assets load in stages, with no progress bar | Wait; or use `?q=low`. There is no progress UI (known limitation). |
| No voices | English mode (voices are Arabic only), `?novoice`, or audio blocked until a user click | Use Arabic, and click Start |
| Mouse look does not work | Pointer lock not granted | Click the 3D view; press Esc to release |
| Very low frame rate | Weak GPU | `?q=low`; close other GPU-heavy tabs |
| Live link answers 403 to scripts | Vercel bot protection | Open it in a normal browser |
