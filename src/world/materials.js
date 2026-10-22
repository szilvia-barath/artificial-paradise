import * as THREE from 'three';

// Procedural textures drawn once into canvases: painted brick, floor tiles, concrete.
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

// One metre of painted brick: 4 bricks across, 15 courses.
function brickCanvases(seed = 7) {
  const size = 512;
  const rand = rng(seed);
  const albedo = canvas(size);
  const bump = canvas(size);
  const a = albedo.getContext('2d');
  const b = bump.getContext('2d');
  a.fillStyle = '#cfcfcf';
  a.fillRect(0, 0, size, size);
  b.fillStyle = '#202020';
  b.fillRect(0, 0, size, size);
  const rows = 15;
  const cols = 4;
  const bh = size / rows;
  const bw = size / cols;
  const mortar = 4;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * bw * 0.5;
    for (let c = -1; c <= cols; c++) {
      const x = c * bw + off + (rand() - 0.5) * 3;
      const y = r * bh;
      const tone = 232 + (rand() - 0.5) * 16;
      a.fillStyle = `rgb(${tone},${tone},${tone})`;
      a.fillRect(x + mortar / 2, y + mortar / 2, bw - mortar, bh - mortar);
      const h = 170 + rand() * 60;
      b.fillStyle = `rgb(${h},${h},${h})`;
      b.fillRect(x + mortar / 2, y + mortar / 2, bw - mortar, bh - mortar);
      // Chipped paint / worn edges
      for (let k = 0; k < 6; k++) {
        const d = 90 + rand() * 60;
        b.fillStyle = `rgba(${d},${d},${d},0.6)`;
        b.beginPath();
        b.arc(x + rand() * bw, y + rand() * bh, rand() * 4 + 1, 0, Math.PI * 2);
        b.fill();
      }
    }
  }
  speckle(a, size, rand, 9000, 0.08);
  speckle(b, size, rand, 6000, 0.25);
  return { albedo, bump };
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
  a.fillStyle = '#6b6560';
  a.fillRect(0, 0, size, size);
  b.fillStyle = '#000';
  b.fillRect(0, 0, size, size);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const v = 200 + (rand() - 0.5) * 22;
      a.fillStyle = `rgb(${v},${v - 4},${v - 10})`;
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

export function createMaterials(renderer) {
  const aniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const brick = brickCanvases();
  const brickAlbedo = tex(brick.albedo, true, 1, aniso);
  const brickBump = tex(brick.bump, false, 1, aniso);
  const tiles = tileCanvases();
  const tileAlbedo = tex(tiles.albedo, true, 1.2, aniso);
  const tileBump = tex(tiles.bump, false, 1.2, aniso);
  const concrete = tex(concreteCanvas(), true, 2, aniso);

  const brickMat = (color, rough = 0.92, bumpScale = 1.6) =>
    new THREE.MeshStandardMaterial({
      color,
      map: brickAlbedo,
      bumpMap: brickBump,
      bumpScale,
      roughness: rough,
      metalness: 0,
    });

  return {
    whiteBrick: brickMat(0xf1efe9),
    warmBrick: brickMat(0xe2cc98),
    greyBrick: brickMat(0x6c6b70),
    darkBrick: brickMat(0x2b2c31, 0.95, 1.2),
    whitePlaster: new THREE.MeshStandardMaterial({ color: 0xf3f2ee, roughness: 0.95, map: concrete }),
    floor: new THREE.MeshStandardMaterial({
      color: 0xd0c8bc,
      map: tileAlbedo,
      bumpMap: tileBump,
      bumpScale: 0.6,
      roughness: 0.55,
      metalness: 0.0,
    }),
    ceiling: new THREE.MeshStandardMaterial({ color: 0x8f8d89, map: concrete, roughness: 1 }),
    bench: new THREE.MeshStandardMaterial({ color: 0x4a4b4f, roughness: 0.8 }),
    white: new THREE.MeshStandardMaterial({ color: 0xf4f4f2, roughness: 0.7 }),
    black: new THREE.MeshStandardMaterial({ color: 0x111113, roughness: 0.5, metalness: 0.3 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x9a9ca0, roughness: 0.35, metalness: 0.8 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x3d3027, roughness: 0.8 }),
    stair: new THREE.MeshStandardMaterial({ color: 0x5a3f33, roughness: 0.9, map: brickAlbedo }),
    glass: new THREE.MeshStandardMaterial({ color: 0xbfd8e0, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.25, depthWrite: false }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x7cc24a, roughness: 0.6, emissive: 0x1a3a08 }),
    led: new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 4, 4.2) }),
    warmBulb: new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 3.6, 2) }),
    windowGlass: new THREE.MeshStandardMaterial({ color: 0x0d1420, emissive: 0x0a1626, roughness: 0.2, metalness: 0.4 }),
    curtain: new THREE.MeshStandardMaterial({ color: 0xd8d2c6, roughness: 1, side: THREE.DoubleSide }),
  };
}

// Scale a geometry's UVs so 1 UV unit == 1 metre (textures repeat per metre).
export function uvMetres(geo, w, h) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h);
  uv.needsUpdate = true;
  return geo;
}
