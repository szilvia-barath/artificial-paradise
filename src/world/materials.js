import * as THREE from 'three';
import texMeta from '../data/textures.json';

// Materials. Wall bricks are real textures cut from the exhibition photos
// (scripts/make_textures.py); tiles, plaster and planks are drawn into canvases.
// Everything is tiled per metre (geometry UVs are in metres, see uvMetres()).

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function speckle(ctx, size, rand, amount, alpha) {
  for (let i = 0; i < amount; i++) {
    const v = rand() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgba(${v},${v},${v},${rand() * alpha})`;
    const s = rand() * 2.2 + 0.4;
    ctx.fillRect(rand() * size, rand() * size, s, s);
  }
}

function tileCanvases(seed = 3) {
  const size = 512;
  const rand = rng(seed);
  const albedo = canvas(size);
  const bump = canvas(size);
  const a = albedo.getContext('2d');
  const b = bump.getContext('2d');
  const n = 4; // 4 tiles per 1.2 m -> 30 cm tiles
  const t = size / n;
  a.fillStyle = '#9d978e';
  a.fillRect(0, 0, size, size);
  b.fillStyle = '#000';
  b.fillRect(0, 0, size, size);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const v = 206 + (rand() - 0.5) * 18;
      a.fillStyle = `rgb(${v},${v - 3},${v - 7})`;
      a.fillRect(i * t + 2, j * t + 2, t - 4, t - 4);
      b.fillStyle = '#fff';
      b.fillRect(i * t + 2, j * t + 2, t - 4, t - 4);
    }
  }
  speckle(a, size, rand, 14000, 0.07);
  return { albedo, bump };
}

function concreteCanvas(seed = 11) {
  const size = 256;
  const rand = rng(seed);
  const c = canvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c8c6c2';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 60; i++) {
    const v = 180 + rand() * 40;
    ctx.fillStyle = `rgba(${v},${v},${v},0.15)`;
    ctx.beginPath();
    ctx.arc(rand() * size, rand() * size, rand() * 50 + 10, 0, Math.PI * 2);
    ctx.fill();
  }
  speckle(ctx, size, rand, 5000, 0.08);
  return c;
}

function tex(c, srgb, repeatMetres = 1, maxAniso = 4) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / repeatMetres, 1 / repeatMetres);
  t.anisotropy = maxAniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Planked ceiling of Room 2: white-painted boards between heavier joists.
function planksCanvas(seed = 5) {
  const size = 256;
  const rand = rng(seed);
  const c = canvas(size);
  const g = c.getContext('2d');
  g.fillStyle = '#e9e7e2';
  g.fillRect(0, 0, size, size);
  const boards = 8; // 8 boards per metre
  for (let i = 0; i < boards; i++) {
    const v = 226 + (rand() - 0.5) * 14;
    g.fillStyle = `rgb(${v},${v - 1},${v - 4})`;
    g.fillRect(0, (i * size) / boards + 1, size, size / boards - 2);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(0, (i * size) / boards, size, 1.5);
  }
  speckle(g, size, rand, 3000, 0.06);
  return c;
}

const BASE = import.meta.env.BASE_URL;

export function createMaterials(renderer, manager) {
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const loader = new THREE.TextureLoader(manager);
  // Brick textures cut from the photos by scripts/make_textures.py; the json gives the
  // real size in metres of one tile so the courses come out at 7.7 cm.
  const photoTex = (name, srgb) => {
    const t = loader.load(`${BASE}tex/${name}.webp`);
    const m = texMeta[name.replace('-bump', '')];
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1 / m.w, 1 / m.h);
    t.anisotropy = aniso;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const bricks = {};
  for (const name of Object.keys(texMeta)) bricks[name] = { map: photoTex(name, true), bump: photoTex(`${name}-bump`, false) };

  const tiles = tileCanvases();
  const tileAlbedo = tex(tiles.albedo, true, 1.2, aniso);
  const tileBump = tex(tiles.bump, false, 1.2, aniso);
  const concrete = tex(concreteCanvas(), true, 2, aniso);
  const planks = tex(planksCanvas(), true, 1, aniso);

  const brickMat = (name, color, rough = 0.95, bumpScale = 2.2) =>
    new THREE.MeshStandardMaterial({
      color,
      map: bricks[name].map,
      bumpMap: bricks[name].bump,
      bumpScale,
      roughness: rough,
      metalness: 0,
    });

  return {
    // walls (colours read off the photos under neutral light)
    whiteBrick: brickMat('brick-white', 0xf4f2ec),
    warmBrick: brickMat('brick-warm', 0xefe2bf),
    greyBrick: brickMat('brick-grey', 0x7c7d83),
    greyBrickShade: brickMat('brick-grey', 0x5c5d62),
    darkBrick: brickMat('brick-grey', 0x2e2f33, 0.95, 1.6),
    dimBrick: brickMat('brick-white', 0x8d8a83),
    projWall: brickMat('brick-white', 0xcfcdc7, 0.95, 1.2),
    vault: brickMat('brick-white', 0x7a7671, 0.95, 1.6),
    shaft: brickMat('brick-grey', 0x3b3c41),
    plaster: new THREE.MeshStandardMaterial({ color: 0xf4f3ef, roughness: 0.95, map: concrete }),
    floor: new THREE.MeshStandardMaterial({
      color: 0xbab3a8,
      map: tileAlbedo,
      bumpMap: tileBump,
      bumpScale: 0.6,
      roughness: 0.5,
      metalness: 0.0,
    }),
    floorDark: new THREE.MeshStandardMaterial({ color: 0x6f6a63, map: tileAlbedo, bumpMap: tileBump, bumpScale: 0.6, roughness: 0.45 }),
    darkFloor: new THREE.MeshStandardMaterial({ color: 0x1b1a19, roughness: 0.9 }),
    ceiling: new THREE.MeshStandardMaterial({ color: 0xf1f0ec, map: concrete, roughness: 1, emissive: 0x2a2a2a }),
    planks: new THREE.MeshStandardMaterial({ color: 0xe9e6df, map: planks, roughness: 0.95, emissive: 0x1e1c18 }),
    darkCeiling: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 1 }),
    beam: new THREE.MeshStandardMaterial({ color: 0x2f3033, roughness: 0.6, metalness: 0.4 }),
    // furniture & fixtures
    bench: new THREE.MeshStandardMaterial({ color: 0x55575c, roughness: 0.7, metalness: 0.2 }),
    benchTop: new THREE.MeshStandardMaterial({ color: 0x6b6d72, roughness: 0.8 }),
    counterTop: new THREE.MeshStandardMaterial({ color: 0x55565a, roughness: 0.55 }),
    white: new THREE.MeshStandardMaterial({ color: 0xf4f4f2, roughness: 0.7 }),
    black: new THREE.MeshStandardMaterial({ color: 0x111113, roughness: 0.5, metalness: 0.3 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x9a9ca0, roughness: 0.35, metalness: 0.8 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x6b5442, roughness: 0.8 }),
    door: new THREE.MeshStandardMaterial({ color: 0x8c8678, roughness: 0.7 }),
    stair: new THREE.MeshStandardMaterial({ color: 0x3c3a3a, roughness: 0.9 }),
    stairBrick: new THREE.MeshStandardMaterial({ color: 0xa8634a, roughness: 0.95, map: bricks['brick-grey'].map }),
    glass: new THREE.MeshStandardMaterial({ color: 0xcfe2e8, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.22, depthWrite: false }),
    clearPlastic: new THREE.MeshStandardMaterial({ color: 0xe8f0f2, roughness: 0.15, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x9ccf5a, roughness: 0.55, emissive: 0x1c3a0a }),
    zzLeaf: new THREE.MeshStandardMaterial({ color: 0x3f7a2c, roughness: 0.35, metalness: 0.05, side: THREE.DoubleSide }),
    zzStem: new THREE.MeshStandardMaterial({ color: 0x6f9a3e, roughness: 0.5 }),
    led: new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 4, 4.2) }),
    warmBulb: new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 3.6, 2) }),
    windowGlass: new THREE.MeshStandardMaterial({ color: 0x1c2430, emissive: 0x18243a, roughness: 0.2, metalness: 0.3 }),
    curtain: new THREE.MeshStandardMaterial({ color: 0xcdc7bb, roughness: 1, side: THREE.DoubleSide }),
    paper: new THREE.MeshStandardMaterial({ color: 0xf6f5f1, roughness: 0.9 }),
  };
}

// Scale a geometry's UVs so 1 UV unit == 1 metre (textures repeat per metre).
export function uvMetres(geo, w, h) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h);
  uv.needsUpdate = true;
  return geo;
}
