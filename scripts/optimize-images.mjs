// Image pipeline: original DSC_*.JPG photos -> perspective-corrected artwork crops -> WebP.
//
//   npm run images            (process everything listed in scripts/crops.json)
//   npm run images -- r1-print-2   (only some ids)
//
// For every entry in crops.json:
//   public/img/<id>.webp        detail view, max 1600 px
//   public/img/<id>-tex.webp    in-scene texture, max 1024 px
//   public/img/<id>-thumb.webp  thumbnail, max 512 px
//   public/img/<id>-situ.webp   the whole source photo ("in situ"), max 1400 px
// and src/data/images.json with the pixel size of each detail image (for aspect ratios).
//
// `quad` = four corners [TL, TR, BR, BL] in normalised photo coordinates (0..1, after EXIF
// rotation). Tweak them in crops.json if a crop looks off, then re-run.

import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public', 'img');
const crops = JSON.parse(await fs.readFile(path.join(root, 'scripts', 'crops.json'), 'utf8'));
const only = process.argv.slice(2);

// Solve the 3x3 homography H mapping (x,y) in the output rectangle to (u,v) in the source.
function homography(src, dst) {
  // src: 4 output points, dst: 4 source points
  const A = [];
  const b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  // Gaussian elimination
  const n = 8;
  for (let i = 0; i < n; i++) {
    let max = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[max][i])) max = r;
    [A[i], A[max]] = [A[max], A[i]];
    [b[i], b[max]] = [b[max], b[i]];
    for (let r = i + 1; r < n; r++) {
      const f = A[r][i] / A[i][i];
      for (let c = i; c < n; c++) A[r][c] -= f * A[i][c];
      b[r] -= f * b[i];
    }
  }
  const h = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i];
    for (let c = i + 1; c < n; c++) s -= A[i][c] * h[c];
    h[i] = s / A[i][i];
  }
  return [...h, 1];
}

async function warp(photoPath, quadN, aspectOverride) {
  const img = sharp(photoPath, { limitInputPixels: false }).rotate();
  const meta = await sharp(photoPath, { limitInputPixels: false }).metadata();
  const rotated = meta.orientation >= 5;
  const W = rotated ? meta.height : meta.width;
  const H = rotated ? meta.width : meta.height;
  const quad = quadN.map(([u, v]) => [u * W, v * H]);
  // Bounding box of the quad -> extract only that region (keeps memory low)
  const xs = quad.map((p) => p[0]);
  const ys = quad.map((p) => p[1]);
  const left = Math.max(0, Math.floor(Math.min(...xs)) - 2);
  const top = Math.max(0, Math.floor(Math.min(...ys)) - 2);
  const right = Math.min(W, Math.ceil(Math.max(...xs)) + 2);
  const bottom = Math.min(H, Math.ceil(Math.max(...ys)) + 2);
  const bw = right - left;
  const bh = bottom - top;
  const { data } = await img.extract({ left, top, width: bw, height: bh }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const local = quad.map(([x, y]) => [x - left, y - top]);
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const wTop = dist(local[0], local[1]);
  const wBot = dist(local[3], local[2]);
  const hL = dist(local[0], local[3]);
  const hR = dist(local[1], local[2]);
  const aspect = aspectOverride || (wTop + wBot) / (hL + hR);
  const outW = Math.min(2000, Math.round(Math.max(wTop, wBot, Math.max(hL, hR) * aspect)));
  const outH = Math.round(outW / aspect);
  const Hm = homography([[0, 0], [outW, 0], [outW, outH], [0, outH]], local);
  const out = Buffer.alloc(outW * outH * 3);
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const w = Hm[6] * px + Hm[7] * py + Hm[8];
      let u = (Hm[0] * px + Hm[1] * py + Hm[2]) / w - 0.5;
      let v = (Hm[3] * px + Hm[4] * py + Hm[5]) / w - 0.5;
      u = Math.max(0, Math.min(bw - 1.001, u));
      v = Math.max(0, Math.min(bh - 1.001, v));
      const x0 = Math.floor(u);
      const y0 = Math.floor(v);
      const fx = u - x0;
      const fy = v - y0;
      const i00 = (y0 * bw + x0) * 3;
      const i10 = i00 + 3;
      const i01 = i00 + bw * 3;
      const i11 = i01 + 3;
      const o = (y * outW + x) * 3;
      for (let c = 0; c < 3; c++) {
        const top = data[i00 + c] * (1 - fx) + data[i10 + c] * fx;
        const bot = data[i01 + c] * (1 - fx) + data[i11 + c] * fx;
        out[o + c] = top * (1 - fy) + bot * fy;
      }
    }
  }
  return sharp(out, { raw: { width: outW, height: outH, channels: 3 } });
}

const sizes = { '': [1600, 82], '-tex': [1024, 80], '-thumb': [512, 74] };

await fs.mkdir(outDir, { recursive: true });
const manifestPath = path.join(root, 'src', 'data', 'images.json');
let manifest = {};
try { manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')); } catch { /* new */ }

for (const [id, spec] of Object.entries(crops)) {
  if (only.length && !only.includes(id)) continue;
  let photoPath = path.join(root, `${spec.photo}.JPG`);
  try { await fs.access(photoPath); } catch { photoPath = path.join(root, `${spec.photo}.jpg`); }
  const t0 = Date.now();
  let base;
  if (spec.full) {
    base = sharp(photoPath, { limitInputPixels: false }).rotate();
  } else {
    base = await warp(photoPath, spec.quad, spec.aspect);
  }
  if (spec.enhance) base = base.normalise({ lower: 0.5, upper: 99.6 }).modulate({ saturation: 1.06 });
  const buf = await base.png().toBuffer();
  let size;
  for (const [suffix, [max, q]] of Object.entries(sizes)) {
    const info = await sharp(buf)
      .resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: q, effort: 5 })
      .toFile(path.join(outDir, `${id}${suffix}.webp`));
    if (suffix === '') size = [info.width, info.height];
  }
  // In-situ photo (whole frame) for the viewer
  await sharp(photoPath, { limitInputPixels: false }).rotate()
    .resize({ width: 1400, height: 1400, fit: 'inside' })
    .webp({ quality: 74, effort: 5 })
    .toFile(path.join(outDir, `${id}-situ.webp`));
  manifest[id] = size;
  console.log(`${id.padEnd(16)} ${spec.photo}  ${size.join('x')}  ${Date.now() - t0} ms`);
}

await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 1)}\n`);
console.log(`wrote ${Object.keys(manifest).length} entries -> src/data/images.json`);
