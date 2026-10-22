# PROGRESS — Artificial Paradise: Digital Exhibition

## Status
- [x] **M1 Skeleton + deploy**: Vite + Three.js, procedural 3-room basement (walls, doorways with reveals, stairwell, partition), furniture, lights, first-person controls (pointer lock + WASD, touch joystick + drag look), wall collision, loading screen + Enter, GitHub Pages workflow.
- [x] **M2 The art**: 22 perspective-corrected crops (sharp → WebP: 1600 detail / 1024 texture / 512 thumb / in-situ photo), hung on the walls with fake spotlight pools and wall labels; video stills on animated screen shaders; artwork viewer (prev/next, in-situ toggle, exhibition text, walk-to). All content in `src/data/exhibition.json`; crop corners in `scripts/crops.json`.
- [x] **M3 Wow factor**: generative GLSL projection in Room 3 (natural fbm forest ⇄ quantised leaf grid + tower blocks, cell-by-cell dissolve, glitch bands, brick-modulated, projector beam with dust); Web Audio ambience (drone with drifting chords, room tone + mains hum, spatial bar murmur with glass clinks near Room 2, pulse + data blips near the projection) feeding an AnalyserNode → shader/light/post; post chain (bloom, ACES, vignette, grain, chromatic aberration, custom glitch pulse on room change); guided tour (T); minimap with click-to-jump; rooms menu; Behind-the-scenes panel. Static props merged (≤ ~90 draw calls per view).
- [ ] M4 Polish

## Next
M4: OG image, README, mobile check, final polish.

## Known issues
- GitHub Pages must be switched on once: Settings → Pages → Source "Deploy from a branch" → `gh-pages` / `(root)`.

## How to continue
`npm install && npm run dev` → http://localhost:5173. Floor plan: `src/world/layout.js`. Content: `src/data/exhibition.json`.
