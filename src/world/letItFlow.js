import * as THREE from 'three';

// #16 Let it Flow (2024): trees projected over the whole end wall of Room 4, and a
// "river" of crushed plastic that winds out of the projected forest across the floor.
// The projection is the photographed image (DSC_0113, perspective-corrected); the
// river follows its course in DSC_0112–0117 and is built from instanced pieces.

const BASE = import.meta.env.BASE_URL;
const WALL_X = 25.67;
const Z0 = 1.73;
const Z1 = 5.94;
const TOP = 2.42;

// centreline of the river, from the projection wall towards the curtain
const COURSE = [
  [25.62, 2.72], [25.0, 2.78], [24.3, 2.98], [23.6, 2.8], [22.9, 3.08],
  [22.2, 3.62], [21.6, 4.1], [21.0, 4.36], [20.45, 4.48],
];

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function buildLetItFlow(manager) {
  const group = new THREE.Group();
  group.name = 'let-it-flow';
  const rand = rng(16);

  // ---------------------------------------------------------------- projection
  const projMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.95, 0.95, 0.95) });
  const loader = new THREE.TextureLoader(manager);
  loader.load(`${BASE}img/w16-let-it-flow-tex.webp`, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    projMat.map = t;
    projMat.needsUpdate = true;
    // full resolution once loaded in the background
    new THREE.TextureLoader().load(`${BASE}img/w16-let-it-flow.webp`, (hi) => {
      hi.colorSpace = THREE.SRGBColorSpace;
      hi.anisotropy = 8;
      projMat.map = hi;
      projMat.needsUpdate = true;
      t.dispose();
    });
  });
  const proj = new THREE.Mesh(new THREE.PlaneGeometry(Z1 - Z0, TOP), projMat);
  proj.rotation.y = -Math.PI / 2;
  proj.position.set(WALL_X - 0.005, TOP / 2, (Z0 + Z1) / 2);
  group.add(proj);

  // ---------------------------------------------------------------- the river
  const curve = new THREE.CatmullRomCurve3(COURSE.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const palette = [
    [0x2f62e0, 30], [0x3f86f0, 18], [0x1e3fa8, 10], [0xdfe8f2, 16], [0xf4f4f0, 6],
    [0xd23a3a, 4], [0xe8792a, 2], [0x3aa04a, 4], [0xe8c63a, 3], [0x8a4ad8, 5], [0x1a1a1e, 2],
  ];
  const total = palette.reduce((s, p) => s + p[1], 0);
  const pick = (bias) => {
    let r = rand() * total;
    if (bias && rand() < bias) return new THREE.Color(rand() < 0.7 ? 0xf2f4f6 : 0xdfe8f2);
    for (const [c, w] of palette) { if ((r -= w) <= 0) return new THREE.Color(c); }
    return new THREE.Color(palette[0][0]);
  };

  // one crumpled piece: a jittered, flattened icosahedron
  const pieceGeo = new THREE.IcosahedronGeometry(1, 1);
  {
    const p = pieceGeo.attributes.position;
    const jr = rng(4);
    const seen = new Map();
    for (let i = 0; i < p.count; i++) {
      const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
      if (!seen.has(key)) seen.set(key, 0.65 + jr() * 0.6);
      const k = seen.get(key);
      p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k);
    }
    pieceGeo.computeVertexNormals();
  }
  const plastic = new THREE.MeshStandardMaterial({ roughness: 0.32, metalness: 0.05 });
  // plastic catches the projector's light: give each piece a little glow of its own colour
  plastic.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * diffuseColor.rgb * 0.35;',
    );
  };
  const N = 1400;
  const pieces = new THREE.InstancedMesh(pieceGeo, plastic, N);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const len = curve.getLength();
  for (let i = 0; i < N; i++) {
    const t = Math.pow(rand(), 0.9);
    const c = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    // narrow where it leaves the wall, widest at the pile of white bags at the end
    const width = 0.14 + 0.05 * Math.sin(t * 9) + (t > 0.86 ? (t - 0.86) * 1.4 : 0);
    const off = (rand() - 0.5) * 2 * width * (0.4 + 0.6 * rand());
    const x = c.x - tan.z * off;
    const z = c.z + tan.x * off;
    const s = 0.018 + rand() * 0.035 + (rand() < 0.06 ? 0.03 : 0);
    const flat = 0.25 + rand() * 0.35;
    e.set(rand() * 0.6 - 0.3, rand() * Math.PI * 2, rand() * 0.6 - 0.3);
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(x, s * flat * 0.8 + rand() * 0.03, z), q, new THREE.Vector3(s * (1 + rand()), s * flat, s));
    pieces.setMatrixAt(i, m);
    pieces.setColorAt(i, pick(t > 0.86 ? 0.55 : 0));
  }
  pieces.instanceColor.needsUpdate = true;
  group.add(pieces);

  // confetti of tiny plastic bits scattered over the floor around the river
  const flecks = 380;
  const fleckGeo = new THREE.PlaneGeometry(1, 1);
  fleckGeo.rotateX(-Math.PI / 2);
  const fleckMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
  const fl = new THREE.InstancedMesh(fleckGeo, fleckMat, flecks);
  for (let i = 0; i < flecks; i++) {
    const c = curve.getPointAt(rand());
    const r = 0.3 + rand() * 1.4;
    const a = rand() * Math.PI * 2;
    const s = 0.008 + rand() * 0.016;
    e.set(0, rand() * Math.PI, 0);
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(c.x + Math.cos(a) * r, 0.003, Math.min(5.85, Math.max(1.8, c.z + Math.sin(a) * r))), q, new THREE.Vector3(s, 1, s * 0.7));
    fl.setMatrixAt(i, m);
    fl.setColorAt(i, new THREE.Color(rand() < 0.5 ? 0x5a52c8 : rand() < 0.5 ? 0x3d7be0 : 0xd8dde8));
  }
  fl.instanceColor.needsUpdate = true;
  group.add(fl);

  // projector flicker: the lamp breathes by a couple of percent, nothing more
  const update = (t, light) => {
    const f = 0.97 + 0.02 * Math.sin(t * 0.9) + 0.01 * Math.sin(t * 2.3);
    projMat.color.setScalar(0.95 * f);
    if (light) light.intensity = light.userData.base * f;
  };

  return { group, update, length: len };
}
