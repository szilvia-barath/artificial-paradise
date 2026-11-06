// Brick wall textures from the redrawn patterns (Drive folder 1i0rrs-Q1zXtG1YnOwbJPMsl5C3N5Fq5C:
// brick-<name>-color.png and brick-<name>-bump.png) to public/tex/brick-<name>.webp and
// -bump.webp, with each tile's size in metres in src/data/textures.json, then the KTX2 files.
//  - Each tile is scaled so one course is 7.7 cm, as measured in the gallery; the course
//    counts are read off the colour images.
//  - The grey and warm bump files in the folder show a different wall from their colour
//    images (11 and 27 courses against 14 and 28), so their relief would not follow the
//    bricks: those bumps are derived from the colour image instead (luminance, high-passed).
//  - Every bump is set to the relief strength the walls had before (grey levels per metre of
//    wall, measured on the earlier photo-cut bumps), so the materials' bumpScale still fits.
//   node scripts/make_bricks.mjs <folder with the Drive PNGs>
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';

const SRC = process.argv[2];
if (!SRC) throw new Error('usage: node scripts/make_bricks.mjs <folder with the Drive PNGs>');
const COURSE = 0.077; // m
const MAX = 1024; // px, longest side of the web texture
const BRICKS = {
  grey: { courses: 14, bump: 'derive', relief: 2120 },
  white: { courses: 14, bump: 'file', relief: 5490 },
  warm: { courses: 28, bump: 'derive', relief: 2960 },
};

// mean absolute grey-level step between neighbouring texels, per metre of wall
function reliefPerMetre(data, w, h, widthM) {
  let s = 0;
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) s += Math.abs(data[y * w + x + 1] - data[y * w + x]) + Math.abs(data[(y + 1) * w + x] - data[y * w + x]);
  }
  return ((s / ((w - 1) * (h - 1))) * w) / widthM / 2;
}

const meta = JSON.parse(await readFile('src/data/textures.json', 'utf8'));
for (const [name, b] of Object.entries(BRICKS)) {
  const colour = `${SRC}/brick-${name}-color.png`;
  const { width, height } = await sharp(colour).metadata();
  const k = Math.min(1, MAX / Math.max(width, height));
  const w = Math.round(width * k);
  const h = Math.round(height * k);
  const hM = +(b.courses * COURSE).toFixed(3);
  const wM = +((hM * width) / height).toFixed(3);
  await sharp(colour).resize(w, h, { kernel: 'lanczos3' }).webp({ quality: 88 }).toFile(`public/tex/brick-${name}.webp`);

  // height: the supplied bump, or the colour's luminance minus its blur (mortar dark = low)
  let grey;
  if (b.bump === 'file') {
    grey = await sharp(`${SRC}/brick-${name}-bump.png`).greyscale().resize(w, h, { kernel: 'lanczos3' }).raw().toBuffer();
  } else {
    const lum = await sharp(colour).greyscale().resize(w, h, { kernel: 'lanczos3' }).raw().toBuffer();
    const blur = await sharp(lum, { raw: { width: w, height: h, channels: 1 } }).blur(Math.max(2, h / b.courses / 2)).raw().toBuffer();
    grey = Buffer.alloc(w * h);
    for (let i = 0; i < grey.length; i++) grey[i] = Math.max(0, Math.min(255, 128 + lum[i] - blur[i]));
  }
  // set the relief strength around mid-grey
  let mean = 0;
  for (const v of grey) mean += v;
  mean /= grey.length;
  const gain = b.relief / reliefPerMetre(grey, w, h, wM);
  const bump = Buffer.alloc(w * h);
  for (let i = 0; i < bump.length; i++) bump[i] = Math.max(0, Math.min(255, Math.round(128 + (grey[i] - mean) * gain)));
  await sharp(bump, { raw: { width: w, height: h, channels: 1 } }).webp({ quality: 90 }).toFile(`public/tex/brick-${name}-bump.webp`);

  meta[`brick-${name}`] = { w: wM, h: hM, courses: b.courses, source: `Drive folder 1i0rrs-Q1zXtG1YnOwbJPMsl5C3N5Fq5C, bump ${b.bump === 'file' ? 'as supplied' : 'derived from the colour'}` };
  console.log(`brick-${name}: ${w}x${h} px, ${wM} x ${hM} m, ${b.courses} courses, bump ${b.bump}, relief gain ${gain.toFixed(2)}`);
}
await writeFile('src/data/textures.json', `${JSON.stringify(meta, null, 1)}\n`);
execFileSync(process.execPath, ['scripts/make_ktx2.mjs'], { stdio: 'inherit' });
