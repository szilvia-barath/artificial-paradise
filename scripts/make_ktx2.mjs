// KTX2 (Basis Universal) versions of the photo textures in public/tex, which the GPU keeps
// compressed (ETC1S, about a sixth of the memory of the decoded .webp), with mipmaps. The
// normal map uses Basis' normal-map mode. The .webp files stay as the fallback.
// Also copies three's Basis transcoder to public/basis for KTX2Loader.
//   node scripts/make_ktx2.mjs
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import sharp from 'sharp';
import { encodeToKTX2 } from 'ktx2-encoder';

const TEX = 'public/tex';
const COLOUR = ['brick-grey', 'brick-warm', 'brick-white', 'river'];
const BUMP = ['brick-grey-bump', 'brick-warm-bump', 'brick-white-bump'];
const NORMAL = ['river-normal'];

// Basis blocks are 4x4 texels, so each side is rounded to a multiple of 4. The image is
// flipped because compressed textures can't be flipped on upload (flipY), and the UVs
// expect the same orientation as the .webp.
const decode = async (buf) => {
  const img = sharp(buf);
  const { width, height } = await img.metadata();
  const w = Math.round(width / 4) * 4;
  const h = Math.round(height / 4) * 4;
  const data = await img.resize(w, h, { fit: 'fill', kernel: 'lanczos3' }).flip().ensureAlpha().raw().toBuffer();
  return { width: w, height: h, data: new Uint8Array(data) };
};

for (const name of [...COLOUR, ...BUMP, ...NORMAL]) {
  const colour = COLOUR.includes(name);
  const src = await readFile(`${TEX}/${name}.webp`);
  const out = await encodeToKTX2(new Uint8Array(src), {
    imageDecoder: decode,
    generateMipmap: true,
    isUASTC: false,
    isNormalMap: NORMAL.includes(name),
    isPerceptual: colour,
    isSetKTX2SRGBTransferFunc: colour,
    qualityLevel: 230,
    compressionLevel: 4,
    needSupercompression: true,
  });
  await writeFile(`${TEX}/${name}.ktx2`, out);
  console.log(`${name}.ktx2`, `${(src.length / 1024).toFixed(0)} KB webp ->`, `${(out.length / 1024).toFixed(0)} KB`);
}

await mkdir('public/basis', { recursive: true });
for (const f of ['basis_transcoder.js', 'basis_transcoder.wasm']) {
  await copyFile(`node_modules/three/examples/jsm/libs/basis/${f}`, `public/basis/${f}`);
}
