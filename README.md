# Interactive Books: 3D Scenario Demos

Browser-based 3D training scenarios built from client situation briefs by Islam Sherif.

| Demo | What the learner does | Live |
|---|---|---|
| **SAF-01 The Wrong Extinguisher** | Raise the alarm, choose the right extinguisher and say why, use it with PASS, report | https://instant-crystal-wnj8dit-islams-projects-5b27661f.vercel.app/ |
| **AGR-03 The Wilting Tomato** | Check the plant, write evidence in a 3D notebook, recommend the right treatment | https://fast-dune-d4l8zrv-islams-projects-5b27661f.vercel.app/ |
| **AQ-01 Still in Lane Four** (phase 1) | Spot a swimmer sinking silently under surface glare, blow the whistle in time | local only |

## Documentation

- [docs/Islam_Sherif_Interactive_Books_Technical_Documentation.md](docs/Islam_Sherif_Interactive_Books_Technical_Documentation.md): the full technical documentation, 12 sections.
- [docs/Islam_Sherif_Interactive_Books_Diagrams.pdf](docs/Islam_Sherif_Interactive_Books_Diagrams.pdf): the 9 diagrams.
- [docs/](docs/): supporting documents (project structure, technology inventory, limitations, AI integration, local setup, detailed reference).

## Run locally

There is no build step and nothing to install. You need Python 3 (or any static web server) and a desktop browser.

```bash
cd fp-extinguisher
python -m http.server 8765
# open http://127.0.0.1:8765/saf01.html   (also agr03.html, aq01.html, index.html)
```

The machine explorers run from the repository root:
```bash
python -m http.server 8770
# open http://127.0.0.1:8770/pumpjack/
```

Three.js 0.170.0 and the fonts load from public CDNs, so an internet connection is needed.

## Repository layout

```
fp-extinguisher/                 scenario games (web root)
  saf01.html  agr03.html  aq01.html  aq01/  index.html (prototype)
  assets/                        characters, animations, textures, voice recordings
  grip/tripod.json               solved pen grip (AGR-03)
  tools/                         screenshot / frame-rate / scan tools
pumpjack/ pumpjack-drill/ pumpjack-field/   machine explorers (fully procedural)
submission/ai-pipeline/scripts/  offline scripts: voices (ElevenLabs), Blender conversion, grip solver, deploy sync, tests
docs/                            documentation and diagrams
INTERACTIVE_3D_MACHINE_SPEC.md   build spec written for AI agents (machine explorers)
```

## Not included, on purpose

- **Secrets and deploy state:** API keys (`.env`) and Vercel deploy folders.
- **Personal and research-only data:** personal 3D scans and research-only bodies (`assets/fullbody`, `assets/splat`, `assets/avatar`). The R&D pages `avatar-test.html` and `look-lab.html`, and SAF-01's experimental `?karim=scan` option, need these files and will not work from this repository.
- **Assets with unclear rights:** a personal audio clip used only by the prototype, and hand models of unknown origin (`assets/meta`). The prototype runs without them.
- **History and third-party code:** HTML backup snapshots and third-party research repositories.

## Asset licences

| Source | Licence |
|---|---|
| Microsoft Rocketbox | MIT (`fp-extinguisher/assets/ROCKETBOX_LICENSE.md`) |
| Poly Haven | CC0 (`fp-extinguisher/assets/polyhaven/LICENSE.md`) |
| Renderpeople (free samples) | Restricted. Use in training needs Renderpeople's written consent, and the files must not be redistributed. Keep this repository private. |
| Sketchfab "Rigged hand" | CC-BY-SA 4.0 |
| ElevenLabs voice files | Generated on a free plan. Check the commercial terms before any release. |
