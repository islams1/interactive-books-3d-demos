# Interactive 3D Machine Explorer — Build Spec for AI Agents

> **ملخص بالعربي:** الملف ده مرجع كامل لأي Agent. تديله **فكرة الماكينة** + **الملف ده**، فيبني موقع تفاعلي 3D بنفس أسلوب فيديو `elvar_official_twitter.mp4`: موديل 3D مفصّل يتلف ويتعمل له زووم لحد ما تدخل جواه، كل جزء بيتداس عليه، في وضع تفكيك (Exploded) وقطاع (Cutaway) وأشعة (X-Ray)، أزرار للأجزاء تحت، لوحات بيانات حية على الجنب، وجولة تلقائية (Operation Log) بخط زمني.
> المثال الشغال: `pumpjack/index.html` (وحدة ضخ بترول بالعارضة — "الحمار الهزاز").

---

## 0. How to use this file (instructions to the agent)

You will receive: **(a)** a machine idea (e.g. "jet engine", "excavator", "pumpjack", "watch movement") and **(b)** this file.

Do this, in order:

1. Read this whole spec. Open `pumpjack/index.html` as the **reference implementation**: copy its structure, then swap the machine.
2. Research the machine: list its real assemblies, how they connect, and how motion flows through them (power source → transmission → output). Write the **Part Table** (§5) before writing code.
3. Build **one self-contained `index.html`** in a new folder (`<machine>/index.html`). There's no build step. Load Three.js through an import map from a CDN.
4. Model every part **procedurally** from Three.js primitives (§6). Don't use external model files unless the user supplies a GLB (§6.6).
5. Implement every **MUST** item in the checklist (§13).
6. Test headlessly with screenshots (§12) for: home view, each part focused, exploded, cutaway, mobile. Fix whatever looks wrong before you report back.

Don't ask the user questions the idea already answers. Pick sensible engineering defaults and list them in the inspector specs.

---

## 1. The reference look (decoded from the video)

The video shows a robotic squid ("Teuthis KR-10") in a **light, technical, "engineering HUD" style**:

| Element | Description |
|---|---|
| Background | Warm off-white `#f1ede6`, faint drawn orbit circles/arcs around the model, faint ground grid |
| Model | White/cream painted parts, **orange `#ff5a1f` accents**, near-black graphite details, lots of small dark bolts/dots |
| Top-left | Orange square logo block + big bold title `Name MODEL-01 /` (orange slash), small spaced-caps kicker above and subtitle below |
| Top-right | Thin metric strip: segmented "load" bar (IDLE / CRUISE / BURST), SIM ID, RUNTIME, STATUS with pulsing orange dot, OPERATOR |
| Left column | Stacked data cards, each numbered `01, 02…`: big number + unit, mini line chart, segmented bars, 3-column stat rows |
| Right column | Cards: live gauge, **ASSEMBLIES** chips (isolate a part), **DISPLAY** toggles (LABELS / EXPLODED / JET WAKE / TURNTABLE), **SUBSYSTEMS** list with colored status pills (OPEN / SEALED / RUNNING / IDLE / DETACHED) |
| In-scene labels | Small orange square + bold spaced-caps title + grey sub-note, joined to a dot on the part by a thin orange leader line |
| Center-left | "OPERATING MODE" kicker + huge orange word (JETTING / HOLDING / TEARDOWN) + small sub-line |
| Bottom | **OPERATION LOG**: orange round play/pause, timeline with tick marks for each scripted step, current action text in orange (`OPERATOR · EXPLODED ON`), `00:16 / 00:24`, "8 OPERATOR ACTIONS" |
| Footer | Tiny spaced-caps line left + brand line right ending in `//////` |
| Motion | Camera moves smoothly between parts; parts slide apart (exploded); covers open (OPTICS OPEN, MANTLE OPEN); turntable spin; everything keeps animating while you inspect |

Fonts: **Space Grotesk 700** (titles, big numbers), **JetBrains Mono** (all HUD text, uppercase, letter-spacing .15–.3em), plus an Arabic font (**IBM Plex Sans Arabic**) when there's Arabic text.

---

## 2. Tech stack (fixed)

- **Three.js r170** via import map (pin the exact version):
  ```html
  <script type="importmap">{"imports":{
    "three":"https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
    "three/addons/":"https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"}}</script>
  ```
- Addons used: `OrbitControls`, `RoomEnvironment` (PMREM reflections with no HDR file), `RoundedBoxGeometry`.
- Plain HTML/CSS/JS in **one file**. No framework, no bundler.
- Charts: plain 2D `<canvas>`. Labels: HTML divs plus one full-screen `<svg>` for the leader lines.

---

## 3. File architecture (sections inside `index.html`)

Keep these numbered sections in this order. The reference file follows it exactly.

```
<style>      tokens → header → panels → side columns → bottom dock/log → HUD → labels → loader → responsive
<body>       canvas#scene, svg#leaders, div#labels, div#tip, header, #left, #right, #bottom, HUD, footer, #loader
<script type=module>
  1. RENDERER / SCENE / CAMERA     (renderer flags, env map, lights, ground shadow, grid, decor rings)
  2. MATERIALS + PART SYSTEM       (MAT factory, class Part, geometry helpers)
  3. MACHINE CONSTANTS             (all key dimensions + pivot points as named constants)
  4. BUILDERS                      (one buildXxx(part) per assembly) + EXPLODE offsets + ORDER
  5. KINEMATICS                    (solve(drive) → every moving transform)
  6. STATE                         (single state object)
  7. CAMERA MOVES                  (VIEWS, flyTo, focusPart)
  8. UI WIRING                     (dock, subsystems, inspector, toggles, sliders, tour)
  9. PICKING                       (raycast click / hover / double-click dive, keyboard)
 10. LABELS                        (project anchors, de-overlap, leader lines)
 11. CHARTS                        (canvas sparkline + domain chart)
 12. MAIN LOOP                     (tick(dt): drive → kinematics → explode → materials → camera → render → HUD)
     deep links (#part+mode), ?warm=N test hook, loader fade
```

---

## 4. Design tokens (copy verbatim)

```css
:root{
  --bg:#f1ede6; --panel:rgba(251,249,245,.9); --line:#e3dcd1; --ink:#1b1c1f; --mute:#8d867b;
  --acc:#ff5a1f; --ok:#27a36a; --col:258px; --gut:14px;
  --mono:'JetBrains Mono',ui-monospace,monospace; --sans:'Space Grotesk',system-ui,sans-serif;
  --ar:'IBM Plex Sans Arabic',system-ui,sans-serif;
}
```

- Panel: `background var(--panel)`, `1px solid var(--line)`, `radius 6px`, `backdrop-filter: blur(10px)`, padding `14px 16px`.
- Panel header `.ph`: bold spaced caps on the left, with a 3×13px orange bar before it; grey index number on the right (`01`…`09`).
- Chip/button: mono 10px, letter-spacing .17em, white background, 1px line border. Active state `.on` = orange fill with white text.
- Status pill: green = running/nominal, orange = open/sectioned/detached/attention, beige = idle.
- **Compact HUD (the user asked for this; keep the UI small so the model dominates):** header 72px (title 26px); columns **258px**, `top:84px`, 14px gutter, and they scroll internally; panel padding `10px 12px`; panel titles 9.5px; big numbers 28px; chips 8.5px; bottom dock and log sit between the columns with a 36px play button. The canvas is full-screen behind everything.
- Responsive:
  - At ≤1280px the side columns become slide-in drawers, toggled by `DATA` / `PARTS` buttons in the header.
  - At ≤700px the header is compact, the dock is a single horizontal scroll row, and the HUD corners and footer are hidden.

Three.js materials (roughness/metalness tuned for the light look):

| key | color | rough | metal | use |
|---|---|---|---|---|
| paint | `#efebe4` | .42 | .06 | main body |
| orange | `#ff5a1f` | .42 | .05 | accents, guards, weights, handles |
| dark | `#2a2c30` | .5 | .4 | bearings, bolts, frames |
| steel | `#bfc3c9` | .24 | .92 | shafts, gears, rods |
| copper | `#c8743c` | .3 | .8 | windings, bronze gears |
| rubber | `#1b1c1e` | .85 | 0 | belts, hoses, tyres |
| glass / smoke | transparent .2 / .38 | | | casings, tubes (depthWrite false) |

Renderer: `antialias`, `ACESFilmicToneMapping` (exposure ~1.05), `SRGBColorSpace`, `PCFSoftShadowMap` with one 2048 shadow map, `localClippingEnabled = true`, `scene.environment = PMREM(RoomEnvironment)`, fog in the background color.

---

## 5. The Part Table (write this first for every new machine)

Each assembly is one row and becomes one `Part`. Aim for **8–15 parts**: fewer feels thin, more clutters the dock.

| field | meaning | example (pumpjack) |
|---|---|---|
| `id` | code key | `gearbox` |
| `no` | 2-digit index shown everywhere | `04` |
| `short` | dock / label text (1 word, caps) | `GEARBOX` |
| `name` | English name | `Gear Reducer` |
| `ar` | Arabic name | `صندوق التروس` |
| `sub` | one-line spec in caps | `API 320D · DOUBLE REDUCTION` |
| `desc` | 1–3 sentences on **what it does and how** (Arabic if the user writes Arabic) | … |
| `specs` | exactly 4 `[label, value]` pairs | `['Ratio','12.5 : 1']` … |
| `view` | preferred camera direction for focus `[x,y,z]` | `[.25,.35,1]` |
| explode offset | where the whole part flies in EXPLODED | `[0,0,0]` |
| teardown subs | sub-pieces that move apart on that part's TEAR DOWN | cover `[0,2.3,0]` |
| cut | which materials get sectioned + section plane normal | housing, normal `(0,0,-1)` |
| callouts | 2–5 feature labels shown when the part is selected | `BULL GEAR · 60 T` |
| motion | how it moves, from which driver | `bull.rot = φ` |

**Motion chain** (write it out as a list, for example):
`motor θm = φ·R_gear·R_belt → sheave → input pinion θi = φ·R_gear → intermediate → bull gear φ → crank → pitman (4-bar solve) → beam θ → horsehead arc → bridle s = R·θ → polished rod → downhole plunger`

A single **driver variable** (`phi`, which grows with `speed × dt`) moves everything. That keeps all parts in sync forever.

---

## 6. Modeling rules (procedural, "high detail but cheap")

### 6.1 Units and constants
- Use **meters**, Y up, the machine centered near the origin, ground at `y=0`.
- Put every pivot, radius and length in named constants (`P`, `C`, `CR`, `PL`, …). Kinematics and geometry must read the **same** constants, or the parts won't line up.

### 6.2 Helpers you should have (all in the reference)
- `mk(geo, mat, parent, pos, rot)`: creates the mesh with cast and receive shadows.
- `box`, `rbox` (RoundedBox), `cyl`, `cylZ`/`cylX` (axis-aligned cylinders), `tubeZ`/`tubeY` (hollow tubes via extruded ring).
- `sector(r1, r2, a0, a1, depth)`: annular sector. Use it for counterweights, arc faces and guards.
- `strut(a, b, w, d)`: a box spanning two 3D points. Use it for frames, legs, braces and linkages.
- `gearGeo(teeth, r, depth, bore)`: extruded gear with teeth and lightening holes.
- `bolts(mat, parent, list, axis)`: **InstancedMesh** of hex bolts. Use instancing for any repeated detail (bolts, rivets, fins, rotor bars, couplings).
- `hull()`: convex hull of sampled circles, which gives a belt/chain path → `TubeGeometry` over a `CurvePath` of `LineCurve3`.

### 6.3 Detail budget
- **Exterior**: silhouettes, bevels (RoundedBox), flanges, bolt rings, stiffeners, nameplates (thin orange boxes), handles, guards, ladders and rails.
- **Interior** (what you see in cutaway or teardown): real internals. Gears that mesh at pitch radius and turn at correct ratios, rotor/stator/windings, pistons and valves, oil level (translucent box), shafts that pass through bearings.
- Target **< 400 draw calls** and **< 400k triangles**. Merge or instance repeated items. `curveSegments` 16–64.

### 6.4 Hierarchy pattern (important)
```
part.root                      ← position = explodeOffset × explode   (global teardown)
 ├─ static meshes (world coords)
 ├─ subGroup                   ← position = subOff × max(explode, part.open)   (per-part teardown)
 │    └─ movingGroup           ← kinematic transform set every frame (rotation / position)
 └─ pivotGroup @ pivot point   ← rotation.z = θ  (rocking/rotating members)
```
Never put a kinematic transform and an explode offset on the **same** object: wrap one in the other.

### 6.5 Section (cutaway) materials
- Ask for housings with `part.m('paint', true)`. The `true` creates a separate material clone with `side: DoubleSide`, `clippingPlanes: [part.clip]` and `clipShadows: true`.
- Internals use the normal (non-cut) material, so they stay whole when the housing is cut open.
- Each frame, set the plane from the part's `clipN` / `clipP` (in root-local space, converted to world space). Animate it by pushing the plane `6 m × (1 − cut)` out of the part, so the cut sweeps in smoothly and clipping never toggles (toggling would recompile shaders).

### 6.6 If the user provides GLB models
Load them with `GLTFLoader` (+ `DRACOLoader` if compressed). Split the loaded scene into Parts by node name, re-assign the materials to the palette above (keep the maps), and keep every other system unchanged.

---

## 7. Kinematics

- Solve the mechanism **analytically each frame** from the driver `phi`. Never integrate positions over time, or drift builds up.
- For linkages, solve the 4-bar with circle–circle intersection (see `solve(phi)` in the reference) and pick the branch closest to the assembled pose.
- Derive velocity and acceleration with central differences in `phi` (`(s(φ+h)−s(φ−h))/2h · ω`), not in time. That gives smooth readouts for the charts.
- Gear trains: `θout = −θin · Nin/Nout` per mesh. Belts keep the same direction with ratio `r_driver / r_driven`.
- Flexible members (ropes, belts, hoses): rebuild a tiny geometry only when the driving angle changes by more than a threshold, and dispose of the old one.
- Speed control: `speed += (target − speed)·(1−e^(−dt·1.4))` gives a natural spin-up and coast-down.

---

## 8. Interaction spec (MUST)

| Input | Result |
|---|---|
| Drag / right-drag / wheel | Orbit / pan / zoom (`OrbitControls`, damping 0.08, `zoomToCursor = true`, `minDistance 0.3`, so you can go **inside** parts) |
| Hover a part | Orange emissive glow on that part, cursor turns into a pointer, dark tooltip `04 GEAR REDUCER · CLICK` follows the mouse |
| Click a part | Select: fly the camera to its bounding box along `part.view`, open the Inspector, highlight its dock chip and subsystem row, show its callout labels |
| Click empty space | Deselect |
| Double-click a point | **Dive**: fly to 30% of the current distance, aimed at the clicked point (look inside) |
| Dock chip / subsystem row / label click | Same as clicking that part |
| Inspector buttons | `FOCUS` (closer), `ISOLATE` (other parts fade to 6% opacity), `TEAR DOWN` (only this part's subs fly apart), `SECTION` (cutaway), `✕` |
| Display toggles | `LABELS`, `EXPLODED`, `CUTAWAY`, `X-RAY` (housings 15% opacity), domain mode (e.g. `DOWNHOLE`), `TURNTABLE` (autoRotate) |
| Sliders | Speed (0 = stop with coast-down), Explode 0–100% |
| View buttons | FRONT / SIDE / TOP / ISO / RESET VIEW |
| Keyboard | `Space` tour play/pause · `L E C X D T` toggles · `R` run/stop · `←/→` previous/next part · `Esc` reset |
| Deep link | `#gearbox`, `#gearbox+open+iso`, `#motor+cut`, `#explode`, applied on load and on `hashchange` |

**View-only mode (MUST):** as soon as the user orbits or zooms the canvas (`controls 'start'`), clicks a part in 3D, or double-clicks to dive, add `body.immersive`. This slides the side columns out left and right, slides the bottom dock and log down, and fades the HUD corner text. Only the header, the 3D view and its labels stay. A dark pill button `☰ SHOW PANELS / ☰ إظهار اللوحات` appears at the bottom center to bring the cards back; `Esc` and `H` do the same. Clicks on panel buttons (dock chips, subsystem rows) do **not** trigger it. Deep link: `#view`.

Any manual interaction **pauses the guided tour** and cancels any camera flight in progress (`controls 'start'` event).

Picking details: raycast against all part meshes. Skip a hit when the part is ghosted, when the hit point is on the clipped side of a section plane, or when the object is hidden. Hover raycasts run at most every 2nd frame.

---

## 9. Labels (leader lines)

- Each Part has `anchor` (main label) and `callouts[]` (Object3Ds placed **inside the moving groups**, so the labels ride along with the motion).
- Every frame:
  1. Project each anchor.
  2. Drop anchors that are behind the camera, off screen, or under the side panels.
  3. Choose a side (left or right of the canvas center).
  4. Label y = anchor y − 30. Sort per side and push labels down to keep a 36px gap.
  5. Draw an SVG polyline: anchor dot → elbow (±46px) → label edge.
- Show all main labels when nothing is selected. Show only that part's labels plus its callouts when one is selected. Hide labels while the camera is flying.
- Pool the DOM nodes: never create or destroy them per frame, and only change `textContent` when it actually differs.

---

## 9b. Labels on spinning parts stay still (MUST)
Mark every continuously rotating group with `group.userData.spin = true` (gears, cranks, rotors, pulleys, drums, fans, wheels). When a callout or anchor is added to such a group, `Part.callout()` **re-parents it to the group's non-rotating parent, on the rotation axis** (same x/y as the group, same z offset). The label then never orbits with the part. Parts that only translate or rock gently (rods, beams) may keep their labels attached.

## 9c. Bilingual UI: English only OR Arabic only (MUST)
- Header has a language switch `EN | عربي`, saved in `localStorage`; `?lang=ar` forces Arabic. **Never mix languages in one mode.**
- Static text: every element has `data-i18n="key"`, and `I18N = { key: [en, ar] }`; `applyLang(l)` fills them and re-renders the dynamic UI (dock, subsystems, inspector, log, tick tooltips).
- Part data has both languages: `short/shortAr`, `name/ar`, `sub/subAr`, `descEn/desc`, `specs/specsAr` (labels **and** values), and callouts through `CALL_AR[title] = [arTitle, arNote]`. Units are translated too (`kN → ك.ن`, `RPM → لفة/د`, `SPM → ش/د`).
- Mode words, status pills, log entries (`log(en, ar, who)`), tour steps (`{l, a}`), tooltip, chart axis words: all go through the dictionary.
- Arabic CSS: `body.ar` swaps `--mono`/`--sans` to IBM Plex Sans Arabic and sets `letter-spacing:0 !important` (spacing breaks joined Arabic letters). Panels/labels get `direction:rtl`; keep `direction:ltr` on the timeline, sliders, segmented bars and canvases. Use logical properties (`margin-inline-start`, `border-inline-start`). Arabic text needs about 2px larger font sizes.

## 10. HUD data and the guided tour

### 10.1 Live data (left column)
Compute plausible engineering values from the kinematics, not random numbers:
- Card 01: primary rate (SPM / RPM / thrust…) + sparkline of the main output position.
- Card 02: a **domain chart**. Pumpjack uses a dynamometer card (load vs. position, traced live). Other examples: an engine P-V diagram, an excavator bucket-force curve.
- Card 03: power / current / torque + segmented bars.
- Card 04: controls (run/stop, speed, explode, views).
- Header: segmented load bar (40 segments; past 80% they turn orange), runtime clock, status = current mode.
- Mode word (big orange): computed every few frames: `TEARDOWN > DOMAIN MODE > CUTAWAY > X-RAY > INSPECT > RUNNING > STANDBY`.
- Subsystem pills are derived from state, with this priority: `DETACHED` (exploded) > `OPEN` (part torn down) > `SECTIONED` > running/idle/nominal.

Throttle DOM writes (text every 4th frame, canvases every 2nd).

### 10.2 Operation log / tour
`TOUR = [{ l: 'LABEL', d: seconds, run(){…} }, …]`, with 7–9 steps and 35–45 s total. The tour **auto-plays on load**. Suggested beats:
1. SYSTEM ONLINE (home view)
2. Start the power source (focus + section the motor/engine)
3. Open the transmission (isolate + tear down the cover)
4. Main mechanism
5. Output / end effector
6. Domain special view (inside, underground, airflow…)
7. TEARDOWN (explode + turntable)
8. REASSEMBLE

The timeline has tick marks with hover tooltips. Clicking the track seeks to that point and re-runs the step. When the play button reaches the end, it restarts the tour. Log text: `OPERATOR · <step>` for the tour, `USER · <action>` for manual actions.

---

## 11. Performance rules (MUST)

- `renderer.setPixelRatio(min(devicePixelRatio, 2))`. If the average frame time stays above 26ms for 3s, step the pixel ratio down by 0.5 (min 1).
- One shadow-casting light. Keep the shadow camera tight around the machine.
- Never allocate in the loop (reuse vectors). The only exception is the small rope/belt geometries, which you rebuild on threshold and dispose of.
- Use InstancedMesh for repeats. Opacity changes don't need `needsUpdate`; never toggle `clippingPlanes` at runtime.
- `dt = min(clock.getDelta(), 0.05)`, so a background tab doesn't explode the simulation.
- Materials are cloned **per part**, so ghosting and highlighting one part never affects another.

---

## 12. Testing procedure (MUST)

The browser extension may not reach `localhost`. Test with local headless Chrome:

1. Serve the folder: `python -m http.server 8766 --bind 127.0.0.1` (start it detached).
2. The page supports `?warm=N`, which fast-forwards N frames before the first render (headless rAF is slow), and writes the camera to `body[data-cam]`.
3. Screenshot:
   ```
   chrome --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --window-size=1920,1080 \
     --virtual-time-budget=2500 --enable-logging=stderr --v=0 --user-data-dir=<fresh temp dir> \
     --screenshot=out.png "http://127.0.0.1:8766/index.html?warm=90&c=<random>#gearbox+open+iso"
   ```
   Use a **fresh `--user-data-dir`** and a random query string every time, or Chrome serves the cached old file. Grep stderr for `CONSOLE` to catch JS errors.
4. Required shots: home, every part `#id`, `#explode`, `#<part>+cut`, the domain mode, mobile (`--window-size=412,900`).
5. Check:
   - No console errors.
   - The model fills the gap between the panels in the home view.
   - The focused part sits above the bottom dock and isn't hidden behind another part. If it is, change `view` (the reference had to view the motor from the back, because the belt guard blocks the front).
   - Labels don't overlap.
   - The internals are visible in cutaway.

Common pitfalls hit while building the reference:
- `Object.assign(this, info)` overwrote a method named `sub`, because `info.sub` is a string. Don't give methods the same names as data fields.
- Focus distance needs about **1.55 × (bounding radius / sin(fov/2))**, plus a downward target shift of `0.22 × radius`. The side panels and bottom dock cover about 40% of the screen.
- For a very long assembly (a 16 m well), focus on the interesting end with a custom box, not the whole bounding box.

---

## 13. Acceptance checklist

**MUST**
- [ ] Single `index.html`, Three.js pinned via import map, no console errors
- [ ] 8–15 Parts, each with no/short/name/ar/sub/desc/4 specs/view/callouts
- [ ] Every moving part is driven from one driver variable through real kinematics
- [ ] Hover glow + tooltip, click-select-fly, double-click dive, zoom to inside
- [ ] Inspector with FOCUS / ISOLATE / TEAR DOWN / SECTION
- [ ] Global EXPLODED (button + slider) and per-part TEAR DOWN
- [ ] CUTAWAY with clipping planes showing modeled internals; X-RAY; TURNTABLE; LABELS
- [ ] Bottom ASSEMBLIES dock (all parts + ALL) and OPERATION LOG tour with a timeline
- [ ] Left live-data cards with at least one domain chart; right DISPLAY + SUBSYSTEMS
- [ ] Leader-line labels that follow the motion, de-overlapped
- [ ] Deep links `#part+mode`, keyboard shortcuts, `?warm=N`
- [ ] Compact HUD sizes (§4), language switch EN-only / AR-only (§9c), still labels on spinning parts (§9b)
- [ ] Responsive drawers ≤1180px, phone layout ≤700px
- [ ] Headless screenshots reviewed (§12)

**SHOULD**
- [ ] Domain-specific special mode (underground, airflow particles, heat map…)
- [ ] Particles for fluid/air flow (Points, updated in place)
- [ ] Arabic descriptions when the user writes in Arabic

---

## 14. Worked example: pumpjack (`pumpjack/index.html`)

| no | part | moves | teardown / section | interior detail |
|---|---|---|---|---|
| 01 | Prime Mover | rotor θm | fan cowl back, rotor slides out; section top half | stator, Cu end windings, 24 rotor bars, fan |
| 02 | V-Belt Drive | sheaves | guard off; section | 3 belts on hull path, grooves, spokes |
| 03 | Band Brake | drum | band off | ratchet lever, linkage |
| 04 | Gear Reducer | 3 shafts | cover lifts 2.3 m; section front half | 60T bull, 40T/16T intermediate, 12T pinion, oil sump |
| 05 | Cranks & CW | φ | L/R spread ±1.9 m | wrist pins, CW bolts |
| 06 | Pitman & Equalizer | 4-bar | arms spread, equalizer lifts | bearings |
| 07 | Walking Beam | θ | lifts 2.4 m | stiffeners, tail bearing |
| 08 | Samson Post | — | saddle bearing lifts | ladder, deck, rails |
| 09 | Horsehead | θ | — | arc face R = 4.2 m centred on the saddle, rope wraps the arc |
| 10 | Bridle | s = R·θ | — | ropes, carrier bar, clamp |
| 11 | Wellhead | rod | BOP + stuffing box lift | tee, wing valve, gauge, flowline |
| 12 | Downhole Pump | rods + plunger | section casing/tubing | traveling & standing ball valves that open by stroke direction, rising oil particles, strata |
| 13 | Base | — | drops 1.1 m | skid, pedestal, pad, anchors |

Motion: `crank φ → 4-bar(C, CR=.9, PL=4.0, BK=3.4, P) → beam θ → polished rod s = 4.2·θ (≈ 89 in stroke) → plunger`.
Loads: rod weight + fluid load (transferred over 20% of the stroke after each reversal) + acceleration term → dynamometer card. Torque = TF·(load − counterbalance) → gear-load %, kW, amps.

---

## 15. Prompt template for the user

> Build an interactive 3D explorer of **<MACHINE>** following `INTERACTIVE_3D_MACHINE_SPEC.md`. Reference implementation: `pumpjack/index.html`. Parts I care about: <optional list>. Language for descriptions: <Arabic/English>. Output folder: `<machine>/`.
