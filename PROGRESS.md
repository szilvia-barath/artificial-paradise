# PROGRESS — Artificial Paradise: Digital Exhibition

## Status
- [x] **M1 Skeleton + deploy**: Vite + Three.js, procedural 3-room basement (walls, doorways with reveals, stairwell, partition), furniture, lights, first-person controls (pointer lock + WASD, touch joystick + drag look), wall collision, loading screen + Enter, GitHub Pages workflow.
- [x] **M2 The art**: 22 perspective-corrected crops (sharp → WebP: 1600 detail / 1024 texture / 512 thumb / in-situ photo), hung on the walls with fake spotlight pools and wall labels; video stills on animated screen shaders; artwork viewer (prev/next, in-situ toggle, exhibition text, walk-to). All content in `src/data/exhibition.json`; crop corners in `scripts/crops.json`.
- [ ] M3 Wow factor
- [ ] M4 Polish

## Next
M3: generative audio-reactive projection, Web Audio ambience, post-processing, guided tour, minimap.

## Known issues
- GitHub Pages must be switched on once: Settings → Pages → Source "Deploy from a branch" → `gh-pages` / `(root)`.

## How to continue
`npm install && npm run dev` → http://localhost:5173. Floor plan: `src/world/layout.js`. Content: `src/data/exhibition.json`.
