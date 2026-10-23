# PROGRESS: Artificial Paradise, Digital Exhibition

## Status
- [x] **M1 Skeleton + deploy**: Vite + Three.js, first-person controls (pointer lock + WASD, touch joystick + drag look), wall collision, loader + Enter, GitHub Pages workflow.
- [x] **M2 The art** (redone as a reconstruction):
  - Room 1 is parametric (`R1` in `src/world/layout.js`; walls, stairs, bench, radiators, windows, Paradise Factory, lights and the Room 1 hangs all follow it). The 360° panorama solve gave 4.5 × 6.55 m, but the owner reports the real room is larger (little space between the last stair and the first painting), so it is **provisionally 5.0 × 7.0 m** until the owner's tape measurements arrive. The Room 2 doorway sits in a 55 cm recess between two thick piers (z 3.70–4.55), plinths either side. Street wall, south → north: bench L, small radiator + window, screen (#3), big radiator + round-vent window, stair opening. Plant at (1.85, 3.35), hydroponic pipe along x 1.27. Spawn faces Human as Error VI (what you see coming down the stairs).
  - Scale confirmed by the OpenStreetMap outline of Damjanich utca 39 (corner building; its Murányi utca wing is 26.5 m deep, the reconstructed basement is 26.1 m outer length). Minimap shows true north (rooms run towards bearing 146° from the Damjanich utca front).
  - Floor plan traced from the gallery's own room sheet (the plan + works list photographed in DSC_0049, also supplied by the owner) at 0.026 m per plan pixel, cross-checked with the Room 1 panorama (camera solved from corner bearings), brick courses (7.7 cm) and floor tiles (30 cm). Rooms run west → east: Room 1 (stairs, bench) → Room 2 (narrow: videos, table + chairs, bar; storage alcove and toilets not walkable) → Room 3 | Room 4, one long room split only by two wall stubs and a curtain.
  - All 17 works from the room sheet, with real titles, media, sizes and years, at their numbered spots; paintings at their canvas sizes; crops forced to the canvas proportions (`scripts/crops.json`).
  - Paradise Factory (#3) modelled in the middle of Room 1 (hydroponic pipe, ZZ plant on a drip, LED bars); position triangulated from the panorama.
  - Let it Flow (#16): the photographed projection (DSC_0113) on the end wall plus the plastic river on the floor. The old generative shader piece is removed.
  - Wall textures cut from the photos (`scripts/make_textures.py`): white brick (DSC_0074), Room 2 cream brick (DSC_0061), grey brick (DSC_0087).
- [x] **M3** (kept, toned down): Web Audio room tone, bar murmur, projector fan; light post (bloom, grain, vignette, small transition pulse); guided tour along the works in catalogue order through the doorways; minimap; rooms menu; works list; Behind-the-scenes panel. No effects on the artworks themselves (screens show the photographed frames, crossfading only where several frames exist).
- [ ] **M4 Polish**:
  - [x] Loading page redesigned in the exhibition's key-visual style: the Supertree collage as background (poster logotype removed so it never shows behind the panel; portrait crop for phones), film grain, a white panel with the blue `|Artificial| |Paradise| KristofLab` logotype, blue monospace text and an outlined `| Enter |` button. Assets in `public/brand/`.
  - [x] OG image (`public/og.jpg`) from the key visual.
  - [ ] Phone performance pass.

## Next
1. Real video files for #3 (screen), 6, 7, 8, 15, 16, 17 would replace the stills (put them in `public/video/` and point `frames`/a new `video` field at them).
2. Owner to confirm/replace the visual captions in `src/data/exhibition.json` (`note` field marks them).
3. Room 1 tape measurements from the owner → set `R1.W` / `R1.D` in `src/world/layout.js`, then the Room 1 `hang` values in `exhibition.json` (#3 screen on the street wall, #4/#5 on the bench wall).

## Known issues / assumptions
- The R2/R3 doorway width and pass-through were fitted to DSC_0098/0130 rather than the plan (the plan's north pillar looked too wide against the photos).
- Painting hanging heights come from the panorama and photos (±10 cm).
- Outer walls are modelled 40 cm thick. If the real façade walls are thicker (old Budapest basements are often 60–90 cm), the rooms would be up to ~3% shorter than modelled.
- The stair top continues into an invented dark shaft (not photographed).
- **GitHub Pages is currently publishing `main` (raw source), which cannot run.** Settings → Pages → Build and deployment → Source "Deploy from a branch" → Branch `gh-pages` / `(root)` → Save. The workflow already builds into `gh-pages` on every push.

## How to continue
`npm install && npm run dev` → http://localhost:5173. Floor plan + walls: `src/world/layout.js`. Content: `src/data/exhibition.json`. Furniture: `src/world/props.js`. Installations: `src/world/paradiseFactory.js`, `src/world/letItFlow.js`.
Regenerate crops: `npm run images` (needs the original DSC_*.JPG in the repo root). Regenerate wall textures: `npm run textures` (Python 3 + Pillow + NumPy).
