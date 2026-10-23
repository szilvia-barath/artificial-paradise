# PROGRESS: Artificial Paradise, Digital Exhibition

## Status
- [x] **M1 Skeleton + deploy**: Vite + Three.js, first-person controls (pointer lock + WASD, touch joystick + drag look), wall collision, loader + Enter, GitHub Pages workflow.
- [x] **M2 The art** (redone as a reconstruction):
  - Floor plan traced from the gallery's own room sheet (the plan + works list photographed in DSC_0049, also supplied by the owner) at 0.026 m per plan pixel, cross-checked with the Room 1 panorama (camera solved from corner bearings), brick courses (7.7 cm) and floor tiles (30 cm). Rooms run west → east: Room 1 (stairs, bench) → Room 2 (narrow: videos, table + chairs, bar; storage alcove and toilets not walkable) → Room 3 | Room 4, one long room split only by two wall stubs and a curtain.
  - All 17 works from the room sheet, with real titles, media, sizes and years, at their numbered spots; paintings at their canvas sizes; crops forced to the canvas proportions (`scripts/crops.json`).
  - Paradise Factory (#3) modelled in the middle of Room 1 (hydroponic pipe, ZZ plant on a drip, LED bars); position triangulated from the panorama.
  - Let it Flow (#16): the photographed projection (DSC_0113) on the end wall plus the plastic river on the floor. The old generative shader piece is removed.
  - Wall textures cut from the photos (`scripts/make_textures.py`): white brick (DSC_0074), Room 2 cream brick (DSC_0061), grey brick (DSC_0087).
- [x] **M3** (kept, toned down): Web Audio room tone, bar murmur, projector fan; light post (bloom, grain, vignette, small transition pulse); guided tour along the works in catalogue order through the doorways; minimap; rooms menu; works list; Behind-the-scenes panel. No effects on the artworks themselves (screens show the photographed frames, crossfading only where several frames exist).
- [ ] **M4 Polish**: OG screenshot image, README check, phone performance pass.

## Next
1. Real video files for #3 (screen), 6, 7, 8, 15, 16, 17 would replace the stills (put them in `public/video/` and point `frames`/a new `video` field at them).
2. Owner to confirm/replace the visual captions in `src/data/exhibition.json` (`note` field marks them).
3. OG image (`public/og.jpg`) from a screenshot of Room 1.

## Known issues / assumptions
- The R2/R3 doorway width and pass-through were fitted to DSC_0098/0130 rather than the plan (the plan's north pillar looked too wide against the photos).
- Painting hanging heights come from the panorama and photos (±10 cm).
- The stair top continues into an invented dark shaft (not photographed).
- GitHub Pages must be switched on once: Settings → Pages → Source "Deploy from a branch" → `gh-pages` / `(root)`.

## How to continue
`npm install && npm run dev` → http://localhost:5173. Floor plan + walls: `src/world/layout.js`. Content: `src/data/exhibition.json`. Furniture: `src/world/props.js`. Installations: `src/world/paradiseFactory.js`, `src/world/letItFlow.js`.
Regenerate crops: `npm run images` (needs the original DSC_*.JPG in the repo root). Regenerate wall textures: `npm run textures` (Python 3 + Pillow + NumPy).
