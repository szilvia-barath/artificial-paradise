# Artificial Paradise: Digital Exhibition

A walkable 3D reconstruction of **Artificial Paradise**, the solo exhibition by Kristóf Szabó (KristofLab) at MAMŰ Gallery, Budapest, 10–31 January 2025.

The rooms, the hang and the wall surfaces are rebuilt from installation photographs and the gallery's floor plan: 17 works (acrylic paintings, giclée prints, videos and two installations) hang where they hung, at their real sizes.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/
npm run preview    # serve dist/
```

## Edit the content

- `src/i18n/en.json` and `src/i18n/hu.json`: every text a visitor reads, in English and Hungarian. `ui` holds the interface (navbar, buttons, hints); the rest is the exhibition text, credits, room names and the media and caption of each work (matched by id). A key missing from `hu.json` falls back to English.
- `src/data/exhibition.json`: official titles, sizes, years, images and the position of every work (`hang.face/at/along/y/w/h`, in metres).
- `src/world/layout.js`: floor plan (wall blocks, doorways, ceilings).
- `npm run images` re-cuts the artwork crops listed in `scripts/crops.json` from the original photos (DSC_*.JPG must be in the repo root).
- `npm run textures` re-cuts the brick wall textures from the photos (Python 3 with Pillow and NumPy).

## Languages

English and Hungarian, switched from the navbar without reloading (the in-world wall labels and text sheets are redrawn too). The first visit follows the browser language; `?lang=en` / `?lang=hu` links open a given language, and a choice made in the navbar is remembered.

## Deploy

Every push to `main` (or a `claude/**` branch) runs `.github/workflows/deploy.yml`, which builds the site and publishes `dist/` to the `gh-pages` branch. Once, in the repository settings: **Settings → Pages → Build and deployment → Deploy from a branch → `gh-pages` / `(root)`**. The site is then at `https://<user>.github.io/artificial-paradise/`.

## Credits

Artist: Kristóf Szabó / KristofLab. Gallery: MAMŰ, Budapest. Text: Luca Cserhalmi. Opening: Barabás Zemlényi-Kovács. Digital exhibition and photography: Szilvia Barath.

All artworks © Kristóf Szabó / KristofLab, reproduced from installation photographs for documentation purposes. The code is separate from the artworks, which are not licensed for reuse.
