import * as THREE from 'three';
import texMeta from '../data/textures.json';
import { initTextures, photoTexture } from './textures.js';

// Materials. Wall bricks are the redrawn brick patterns from the Drive folder, scaled so a
// course is 7.7 cm as measured in the gallery (src/data/textures.json); tiles, plaster and
// planks are drawn into canvases.
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

// Worn concrete for the stair treads (panorama): grey-brown, darker where feet wear it, with
// chips and dust; drawn once, 1 m per tile.
function wornConcreteCanvas(seed = 23) {
  const size = 256;
  const rand = rng(seed);
  const c = canvas(size);
  const g = c.getContext('2d');
  g.fillStyle = '#857e75';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 90; i++) {
    const v = 95 + rand() * 60;
    g.fillStyle = `rgba(${v},${v - 6},${v - 12},${0.12 + rand() * 0.2})`;
    g.beginPath();
    g.ellipse(rand() * size, rand() * size, 8 + rand() * 40, 5 + rand() * 22, rand() * 3, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 160; i++) {
    g.fillStyle = `rgba(30,26,22,${0.25 + rand() * 0.4})`;
    g.fillRect(rand() * size, rand() * size, 1 + rand() * 4, 1 + rand() * 3);
  }
  speckle(g, size, rand, 9000, 0.12);
  return c;
}

// Bare, unpainted old brick (the stair's open side in the panorama): 25 x 6.5 cm bricks in
// stretcher bond, each its own red-brown, some scorched darker, in recessed grey-beige
// mortar. One tile is 1 x 0.462 m (6 courses of 7.7 cm); `bump` holds the mortar joints.
function bareBrickCanvases(seed = 41) {
  const W = 512;
  const H = 236; // 512 px per metre
  const rand = rng(seed);
  const colour = canvas(W);
  colour.height = H;
  const bump = canvas(W);
  bump.height = H;
  const a = colour.getContext('2d');
  const b = bump.getContext('2d');
  a.fillStyle = '#c9c1b4';
  a.fillRect(0, 0, W, H);
  b.fillStyle = '#000';
  b.fillRect(0, 0, W, H);
  const course = H / 6;
  const len = W / 4; // 25 cm
  const joint = 5; // about 1 cm
  for (let r = 0; r < 6; r++) {
    const off = (r % 2) * (len / 2);
    for (let i = -1; i < 5; i++) {
      const x = i * len + off + joint / 2;
      const y = r * course + joint / 2;
      const hue = 12 + rand() * 12;
      const light = 48 + rand() * 10 - (rand() < 0.15 ? 7 : 0);
      a.fillStyle = `hsl(${hue}, ${24 + rand() * 14}%, ${light}%)`;
      a.fillRect(x, y, len - joint, course - joint);
      // old mortar smeared over the brick faces and edges
      for (let k = 0; k < 4; k++) {
        a.fillStyle = `rgba(150,140,125,${0.1 + rand() * 0.25})`;
        a.fillRect(x + rand() * (len - joint) * 0.8, y + (rand() < 0.5 ? 0 : course - joint - 4), 8 + rand() * 30, 2 + rand() * 4);
      }
      // worn, chipped faces
      for (let k = 0; k < 14; k++) {
        a.fillStyle = rand() < 0.5 ? `rgba(40,20,12,${0.08 + rand() * 0.14})` : `rgba(200,160,130,${0.08 + rand() * 0.14})`;
        a.fillRect(x + rand() * (len - joint), y + rand() * (course - joint), 2 + rand() * 9, 1 + rand() * 4);
      }
      b.fillStyle = '#fff';
      b.fillRect(x + 1, y + 1, len - joint - 2, course - joint - 2);
    }
  }
  speckle(a, W, rand, 6000, 0.1);
  return { colour, bump };
}

// Damp stains on the whitewashed wall the stairs run along, just above the treads (the
// close-up of the flight): faint grey water marks spreading up from where each tread meets
// the wall, darker at their lower edge and tide lines, grey grime, a few spots where the
// paint has flaked to the render. Transparent, laid over the wall; one tile is 2 x 0.6 m,
// the bottom of the tile at the treads.
function stairStainCanvas(seed = 57) {
  const W = 1024;
  const H = 308;
  const rand = rng(seed);
  const c = canvas(W);
  c.height = H;
  const g = c.getContext('2d');
  g.clearRect(0, 0, W, H);
  // soft grey damp rising from the bottom edge, uneven along the wall
  for (let i = 0; i < 26; i++) {
    const x = rand() * W;
    const r = 30 + rand() * 90;
    const h = H * (0.25 + rand() * 0.55);
    const grd = g.createRadialGradient(x, H, 2, x, H, Math.max(r, h));
    const a = 0.1 + rand() * 0.12;
    grd.addColorStop(0, `rgba(112,108,102,${a})`);
    grd.addColorStop(0.55, `rgba(128,124,118,${a * 0.6})`);
    grd.addColorStop(1, 'rgba(140,136,130,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.ellipse(x, H, r * 1.3, h, 0, Math.PI, Math.PI * 2);
    g.fill();
  }
  // tide lines: thin, wavy brown edges where the damp dried
  for (let i = 0; i < 9; i++) {
    let x = rand() * W;
    const y0 = H * (0.35 + rand() * 0.45);
    g.strokeStyle = `rgba(100,96,90,${0.08 + rand() * 0.1})`;
    g.lineWidth = 1 + rand() * 1.5;
    g.beginPath();
    g.moveTo(x, y0);
    const len = 60 + rand() * 160;
    for (let k = 0; k < 12; k++) {
      x += len / 12;
      g.lineTo(x, y0 + Math.sin(k * 1.3 + i) * 6 + (rand() - 0.5) * 4);
    }
    g.stroke();
  }
  // grey grime at the foot, along the treads
  const foot = g.createLinearGradient(0, H, 0, H * 0.7);
  foot.addColorStop(0, 'rgba(80,78,74,0.2)');
  foot.addColorStop(1, 'rgba(80,78,74,0)');
  g.fillStyle = foot;
  g.fillRect(0, H * 0.7, W, H * 0.3);
  // a few spots of flaked paint showing the ochre render
  for (let i = 0; i < 6; i++) {
    const x = rand() * W;
    const y = H * (0.55 + rand() * 0.4);
    for (let k = 0; k < 7; k++) {
      g.fillStyle = `rgba(${150 + rand() * 15},${147 + rand() * 12},${140 + rand() * 12},${0.2 + rand() * 0.2})`;
      g.beginPath();
      g.ellipse(x + (rand() - 0.5) * 30, y + (rand() - 0.5) * 12, 4 + rand() * 12, 3 + rand() * 6, rand() * 3, 0, Math.PI * 2);
      g.fill();
    }
  }
  // dark specks
  for (let i = 0; i < 700; i++) {
    g.fillStyle = `rgba(85,82,78,${0.06 + rand() * 0.16})`;
    g.fillRect(rand() * W, H * (0.4 + rand() * 0.6), 1 + rand() * 2, 1 + rand() * 2);
  }
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

export function createMaterials(renderer, manager, { lowPower = false } = {}) {
  // Strong anisotropic filtering keeps floor tiles and brick sharp at grazing angles.
  const aniso = Math.min(lowPower ? 4 : 16, renderer.capabilities.getMaxAnisotropy());
  initTextures(renderer, manager);
  // The json gives the real size in metres of one brick tile and its number of courses.
  const photoTex = (name, srgb) => photoTexture(name, (t) => {
    const m = texMeta[name.replace('-bump', '')];
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1 / m.w, 1 / m.h);
    t.anisotropy = aniso;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  });
  const bricks = {};
  for (const name of Object.keys(texMeta)) bricks[name] = { map: photoTex(name, true), bump: photoTex(`${name}-bump`, false) };
  // Shader variation (surface.js): texture offsets are kept to whole brick courses, so the
  // mortar lines stay straight where two offsets blend.
  const course = (name) => [0, 1 / (texMeta[name].courses || Math.round(texMeta[name].h / 0.077))];

  const tiles = tileCanvases();
  const tileAlbedo = tex(tiles.albedo, true, 1.2, aniso);
  const tileBump = tex(tiles.bump, false, 1.2, aniso);
  const concrete = tex(concreteCanvas(), true, 2, aniso);
  const planks = tex(planksCanvas(), true, 1, aniso);
  const worn = tex(wornConcreteCanvas(), true, 1, aniso);
  const stainMap = tex(stairStainCanvas(), true, 1, aniso);
  stainMap.repeat.set(0.5, 1 / 0.6);
  stainMap.wrapT = THREE.ClampToEdgeWrapping;
  const bare = bareBrickCanvases();
  const bareMap = tex(bare.colour, true, 1, aniso);
  const bareBump = tex(bare.bump, false, 1, aniso);
  for (const t of [bareMap, bareBump]) t.repeat.set(1, 1 / 0.462);

  const brickMat = (name, color, rough = 0.95, bumpScale = 2.2, wash = false) => {
    const m = new THREE.MeshStandardMaterial({ color, bumpScale, roughness: rough, metalness: 0 });
    bricks[name].map.into(m, 'map');
    bricks[name].bump.into(m, 'bumpMap');
    m.userData.surface = { offset: course(name), wash };
    return m;
  };
  const surface = (m, offset) => {
    m.userData.surface = { offset };
    return m;
  };

  return {
    // walls (colours read off the photos under neutral light)
    whiteBrick: brickMat('brick-white', 0xf4f2ec, 0.95, 2.2, true),
    warmBrick: brickMat('brick-warm', 0xefe2bf, 0.95, 2.2, true),
    greyBrick: brickMat('brick-grey', 0x7c7d83),
    greyBrickReveal: brickMat('brick-grey', 0x4d4e53), // the shaded sides of Room 3's niches
    // Room 4 is nearly black in the photos and the ambient light is shared by all rooms,
    // so its surfaces are dark here; the projection wall only just shows under the video
    darkBrick: brickMat('brick-grey', 0x131418, 0.95, 1.6),
    // Room 4's north wall is bare, unpainted brick: browner and rougher than the whitewash
    rawBrick: brickMat('brick-warm', 0x241e18, 0.97, 2.6),
    ledge: surface(new THREE.MeshStandardMaterial({ color: 0x2a2926, roughness: 0.95, map: concrete }), [0, 0]),
    dimBrick: brickMat('brick-white', 0x34302c, 0.95, 2.2, true),
    projWall: brickMat('brick-white', 0x645a54, 0.95, 1.2),
    vault: brickMat('brick-white', 0x191817, 0.95, 1.6),
    shaft: brickMat('brick-grey', 0x3b3c41),
    plaster: surface(new THREE.MeshStandardMaterial({ color: 0xf4f3ef, roughness: 0.95, map: concrete }), [0, 0]),
    // (offsets in whole 30 cm tiles keep the grout grid)
    floor: surface(new THREE.MeshStandardMaterial({
      color: 0xbab3a8,
      map: tileAlbedo,
      bumpMap: tileBump,
      bumpScale: 0.6,
      roughness: 0.5,
      metalness: 0.0,
    }), [0.25, 0.25]),
    floorGrey: surface(new THREE.MeshStandardMaterial({
      color: 0x8c867d,
      map: tileAlbedo,
      bumpMap: tileBump,
      bumpScale: 0.6,
      roughness: 0.55,
    }), [0.25, 0.25]),
    floorDark: surface(new THREE.MeshStandardMaterial({ color: 0x151412, map: tileAlbedo, roughness: 0.62 }), [0.25, 0.25]),
    darkFloor: new THREE.MeshStandardMaterial({ color: 0x1b1a19, roughness: 0.9 }),
    ceiling: surface(new THREE.MeshStandardMaterial({ color: 0xf1f0ec, map: concrete, roughness: 1, emissive: 0x2a2a2a }), [0, 0]),
    // (lit only by bounce: the pendants shine down)
    planks: surface(new THREE.MeshStandardMaterial({ color: 0xe9e6df, map: planks, roughness: 0.95, emissive: 0x3a362f }), [0, 1 / 8]),
    darkCeiling: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 1 }),
    beam: new THREE.MeshStandardMaterial({ color: 0x101012, roughness: 0.6, metalness: 0.4 }),
    // furniture & fixtures
    bench: new THREE.MeshStandardMaterial({ color: 0x55575c, roughness: 0.7, metalness: 0.2 }),
    benchTop: new THREE.MeshStandardMaterial({ color: 0x6b6d72, roughness: 0.8 }),
    counterTop: new THREE.MeshStandardMaterial({ color: 0x55565a, roughness: 0.55 }),
    white: new THREE.MeshStandardMaterial({ color: 0xf4f4f2, roughness: 0.7 }),
    black: new THREE.MeshStandardMaterial({ color: 0x111113, roughness: 0.5, metalness: 0.3 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x9a9ca0, roughness: 0.35, metalness: 0.8 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x6b5442, roughness: 0.8 }),
    door: new THREE.MeshStandardMaterial({ color: 0x8c8678, roughness: 0.7 }),
    // the stairs (panorama): worn grey concrete treads, a band of bare red brick along the
    // open side
    stair: new THREE.MeshStandardMaterial({ color: 0x8e8b86, map: worn, roughness: 0.9 }), // dark, worn
    stairStain: new THREE.MeshStandardMaterial({ map: stainMap, transparent: true, depthWrite: false, roughness: 1, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }),
    stairBrick: new THREE.MeshStandardMaterial({ map: bareMap, bumpMap: bareBump, bumpScale: 3, roughness: 0.95 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xcfe2e8, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.22, depthWrite: false }),
    clearPlastic: new THREE.MeshStandardMaterial({ color: 0xe8f0f2, roughness: 0.15, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x9ccf5a, roughness: 0.55, emissive: 0x1c3a0a }),
    led: new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 4, 4.2) }),
    warmBulb: new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 3.6, 2) }),
    // frosted, grey-blue basement glass (the window by the stairs, close up)
    windowGlass: new THREE.MeshStandardMaterial({ color: 0x9aa1b3, emissive: 0x4a5064, roughness: 0.65 }),
    reededGlass: new THREE.MeshStandardMaterial({ color: 0xb4bac8, emissive: 0x5a6074, roughness: 0.5 }),
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
