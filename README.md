# Artificial Paradise: Digital Exhibition

A walkable 3D reconstruction of **Artificial Paradise**, the solo exhibition by Kristóf Szabó (KristofLab) at MAMŰ Gallery, Budapest, 10–31 January 2025.

The rooms, the hang and the wall surfaces are rebuilt from installation photographs and the gallery's measured floor plan: 17 works (acrylic paintings, giclée prints, videos and two installations) hang where they hung, at their real sizes, in the artist's own reproductions, and the screens play the artist's videos.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/
npm run preview    # serve dist/
```

## Edit the content

- `src/i18n/en.json` and `src/i18n/hu.json`: every text a visitor reads, in English and Hungarian. `ui` holds the interface (navbar, buttons, hints); the rest is the exhibition text, credits, room names, the media and caption of each work (matched by id) and, in `descriptions`, the artist's texts on the works and series. A key missing from `hu.json` falls back to English.
- `src/data/exhibition.json`: official titles, sizes, years, images and the position of every work (`hang.face/at/along/y/w/h`, in metres), which artist's text each work shows (`desc`), its installation photos (`situ`), and the Contact panel (`contacts`: an entry stays hidden until its `href` is filled in, and a group with none shows "coming soon").
- `public/video/`: short loops of the artist's videos played on the screens, with the videos' own sound where they have one, played from the screen's place in the rooms (`scripts/make_videos.sh`, `src/audio/ambience.js`); the full videos and the video documentation stay on Google Drive and play in the artwork viewer (`video.full` in `exhibition.json`).
- `scripts/make_river.py`: rebuilds the melted plastic river of Let it Flow from the artist's top-down image.
- `src/world/layout.js`: floor plan (wall blocks, doorways, ceilings).
- `npm run images` re-cuts the images listed in `scripts/crops.json`: the reproductions and installation photos from `reproductions/` (the room folders from the exhibition's Drive folder, not in git), the rest from the original photos (DSC_*.JPG must be in the repo root).
- `npm run textures -- <folder>` makes the brick wall textures from the redrawn patterns (the Drive folder's `brick-*-color.png` / `-bump.png`), sized for 7.7 cm courses, and their KTX2 versions.
- `npm run plant -- <file.glb>` prepares the artist's 3D model of the Paradise Factory plant (`public/models/paradise-factory-plant.glb`).

## Languages

English and Hungarian, switched from the navbar without reloading (the in-world text sheets are redrawn too). The first visit follows the browser language; `?lang=en` / `?lang=hu` links open a given language, and a choice made in the navbar is remembered.

## Deploy

Every push to `main` (or a `claude/**` branch) runs `.github/workflows/deploy.yml`, which builds the site and publishes `dist/` to the `gh-pages` branch. Once, in the repository settings: **Settings → Pages → Build and deployment → Deploy from a branch → `gh-pages` / `(root)`**. The site is then at `https://<user>.github.io/artificial-paradise/`.

## Credits

Artist: Kristóf Szabó / KristofLab. Curator and text: Luca Cserhalmi. Opening speech: Barnabás Zemlényi-Kovács. Gallery: MAMŰ, Budapest. Supported by the National Cultural Fund of Hungary, the Hungarian Academy of Arts and the Municipality of Budapest District VII. Photography: Kristóf Szabó. Digital exhibition: Szilvia Barath.

All artworks © Kristóf Szabó / KristofLab, shown in the artist's reproductions and in installation photographs for documentation purposes. The code is separate from the artworks, which are not licensed for reuse.
