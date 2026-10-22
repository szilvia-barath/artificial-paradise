# PROGRESS — Artificial Paradise: Digital Exhibition

## Status
- [x] **M1 Skeleton + deploy**: Vite + Three.js, procedural 3-room basement (walls, doorways with reveals, stairwell, partition), furniture, lights, first-person controls (pointer lock + WASD, touch joystick + drag look), wall collision, loading screen + Enter, GitHub Pages workflow.
- [ ] M2 The art
- [ ] M3 Wow factor
- [ ] M4 Polish

## Next
M2: crop artworks from photos (sharp → WebP), hang them, artwork viewer overlay.

## Known issues
- GitHub Pages must be switched on once: Settings → Pages → Source "Deploy from a branch" → `gh-pages` / `(root)`.

## How to continue
`npm install && npm run dev` → http://localhost:5173. Floor plan: `src/world/layout.js`. Content: `src/data/exhibition.json`.
