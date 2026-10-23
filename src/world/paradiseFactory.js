import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { OBSTACLES } from './layout.js';

// #3 Paradise Factory (2024), modelled from the Room 1 panorama and DSC_0011–0015:
//  - a white PVC pipe of lettuce seedlings hanging on chains under an LED tube,
//    parallel to the west wall;
//  - in the middle of the room, a ZZ plant (Zamioculcas) in a clear plastic tank fed
//    by a hanging bottle, between two floor-to-ceiling LED bars.
// Positions come from the panorama (camera solved from the corners and the canvases).

const PIPE = { x: 1.27, z0: 2.14, z1: 4.55, y: 1.0 };
export const PLANT = { x: 1.85, z: 3.35 };
const CEIL = 3.0;

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function chain(mat, x, z, y0, y1) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, y1 - y0, 4), mat);
  m.position.set(x, (y0 + y1) / 2, z);
  return m;
}

export function buildParadiseFactory(materials) {
  const g = new THREE.Group();
  g.name = 'paradise-factory';
  const rand = rng(31);
  const pvc = new THREE.MeshStandardMaterial({ color: 0xf2f2ef, roughness: 0.35 });
  const chainMat = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.3, metalness: 0.9 });
  const capMat = new THREE.MeshStandardMaterial({ color: 0xc8352c, roughness: 0.5 });

  // ---------------------------------------------------------------- hydroponic line
  {
    const len = PIPE.z1 - PIPE.z0;
    const zc = (PIPE.z0 + PIPE.z1) / 2;
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, len, 24), pvc);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(PIPE.x, PIPE.y, zc);
    g.add(pipe);
    for (const z of [PIPE.z0, PIPE.z1]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.06, 24), pvc);
      cap.rotation.x = Math.PI / 2;
      cap.position.set(PIPE.x, PIPE.y, z);
      g.add(cap);
    }
    // LED tube above it: aluminium bar with a glowing diffuser underneath
    const ledY = PIPE.y + 0.27;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.025, len - 0.1), materials.steel);
    bar.position.set(PIPE.x, ledY, zc);
    g.add(bar);
    const diff = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.012, len - 0.14), materials.led);
    diff.position.set(PIPE.x, ledY - 0.016, zc);
    g.add(diff);
    // chains to the ceiling (pipe and lamp hang separately)
    for (const z of [PIPE.z0 + 0.25, PIPE.z1 - 0.25]) {
      g.add(chain(chainMat, PIPE.x - 0.03, z, PIPE.y + 0.05, CEIL));
      g.add(chain(chainMat, PIPE.x + 0.03, z + 0.06, ledY, CEIL));
    }
    // seedlings in the pipe's planting holes: a few tiny light-green leaves each
    const holes = 24;
    const leafGeo = new THREE.SphereGeometry(0.018, 6, 4);
    leafGeo.scale(1.6, 0.35, 0.8);
    leafGeo.translate(0.022, 0, 0);
    const per = 4;
    const leaves = new THREE.InstancedMesh(leafGeo, materials.leaf, holes * per);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    let k = 0;
    for (let i = 0; i < holes; i++) {
      const z = PIPE.z0 + 0.15 + (i / (holes - 1)) * (len - 0.3);
      const size = 0.7 + rand() * 0.7;
      for (let j = 0; j < per; j++) {
        e.set(-0.5 - rand() * 0.6, (j / per) * Math.PI * 2 + rand(), 0, 'YXZ');
        q.setFromEuler(e);
        m.compose(new THREE.Vector3(PIPE.x, PIPE.y + 0.06 + rand() * 0.02, z), q, new THREE.Vector3(size, size, size));
        leaves.setMatrixAt(k++, m);
      }
    }
    g.add(leaves);
    OBSTACLES.push({ x0: PIPE.x - 0.12, x1: PIPE.x + 0.12, z0: PIPE.z0, z1: PIPE.z1 });
  }

  // ---------------------------------------------------------------- plant on a drip
  {
    const { x, z } = PLANT;
    // clear storage tank with dark water/roots, white fittings and red caps
    const tank = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.3), materials.clearPlastic);
    tank.position.set(x, 0.15, z);
    g.add(tank);
    const water = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.17, 0.28), new THREE.MeshStandardMaterial({ color: 0x3d2a1d, roughness: 0.4, transparent: true, opacity: 0.85 }));
    water.position.set(x, 0.09, z);
    g.add(water);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.02, 0.32), materials.clearPlastic);
    lid.position.set(x, 0.31, z);
    g.add(lid);
    for (const dx of [-0.12, 0.12]) {
      const fit = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 12), pvc);
      fit.position.set(x + dx, 0.37, z - 0.08);
      g.add(fit);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 12), capMat);
      cap.position.set(x + dx, 0.44, z - 0.08);
      g.add(cap);
    }

    // stems: tapered tubes along gently curving paths; glossy leaflets in pairs
    const stemGeos = [];
    const leafletGeo = (() => {
      const s = new THREE.Shape();
      s.absellipse(0, 0, 0.032, 0.065, 0, Math.PI * 2, false, 0);
      const geo = new THREE.ShapeGeometry(s, 10);
      geo.translate(0, 0.065, 0);
      // slight cupping
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) p.setZ(i, -Math.abs(p.getX(i)) * 0.35);
      geo.computeVertexNormals();
      return geo;
    })();
    const stems = 8;
    const leafMats = [];
    for (let i = 0; i < stems; i++) {
      const h = 0.85 + rand() * 0.75;
      const a = (i / stems) * Math.PI * 2 + rand() * 0.5;
      const lean = 0.06 + rand() * 0.14;
      const bx = x + Math.cos(a) * 0.04;
      const bz = z + Math.sin(a) * 0.03;
      const pts = [];
      for (let k = 0; k <= 5; k++) {
        const t = k / 5;
        pts.push(new THREE.Vector3(
          bx + Math.cos(a) * lean * t * t,
          0.32 + h * t,
          bz + Math.sin(a) * lean * t * t,
        ));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const tube = new THREE.TubeGeometry(curve, 12, 0.011 - 0.003 * (i % 3) * 0.5, 6, false);
      stemGeos.push(tube);
      // leaflets along the upper two-thirds
      const pairs = 6 + Math.floor(rand() * 5);
      for (let j = 0; j < pairs; j++) {
        const t = 0.32 + (j / pairs) * 0.66;
        const p = curve.getPointAt(t);
        const tan = curve.getTangentAt(t);
        for (const side of [-1, 1]) {
          leafMats.push({ p, tan, side, rot: a + Math.PI / 2 + (j % 2) * 0.25, tilt: 0.7 + rand() * 0.35, s: 0.75 + (1 - Math.abs(t - 0.7)) * 0.45 });
        }
      }
      // top leaflet
      leafMats.push({ p: curve.getPointAt(1), tan: curve.getTangentAt(1), side: 0, rot: a, tilt: 0.15, s: 0.9 });
    }
    const stemMesh = new THREE.Mesh(mergeGeometries(stemGeos, false), materials.zzStem);
    g.add(stemMesh);
    const leaves = new THREE.InstancedMesh(leafletGeo, materials.zzLeaf, leafMats.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    leafMats.forEach((L, i) => {
      // leaflets fan out sideways from the stem and tilt upward
      e.set(0, L.rot, L.side * L.tilt, 'YXZ');
      q.setFromEuler(e);
      m.compose(L.p, q, new THREE.Vector3(L.s, L.s, L.s));
      leaves.setMatrixAt(i, m);
    });
    g.add(leaves);

    // drip feed: an upturned plastic bottle on four chains, a clear tube down to the tank
    const bottleY = 2.12;
    const prof = [
      [0.0, 0.0], [0.012, 0.0], [0.012, 0.03], [0.045, 0.08], [0.047, 0.26], [0.04, 0.3], [0.0, 0.31],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const bottle = new THREE.Mesh(new THREE.LatheGeometry(prof, 18), materials.clearPlastic);
    bottle.position.set(x, bottleY, z);
    g.add(bottle);
    const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.09, 16), new THREE.MeshStandardMaterial({ color: 0xd8d2a0, roughness: 0.2, transparent: true, opacity: 0.6 }));
    liquid.position.set(x, bottleY + 0.13, z);
    g.add(liquid);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.6;
      const top = new THREE.Vector3(x + Math.cos(a) * 0.18, CEIL, z + Math.sin(a) * 0.18);
      const bot = new THREE.Vector3(x + Math.cos(a) * 0.045, bottleY + 0.3, z + Math.sin(a) * 0.045);
      const d = new THREE.Vector3().subVectors(top, bot);
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, d.length(), 4), chainMat);
      c.position.copy(bot).addScaledVector(d, 0.5);
      c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      g.add(c);
    }
    const tubeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, bottleY, z),
      new THREE.Vector3(x + 0.05, 1.6, z + 0.03),
      new THREE.Vector3(x + 0.08, 0.9, z - 0.02),
      new THREE.Vector3(x + 0.1, 0.4, z - 0.06),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(tubeCurve, 24, 0.004, 5, false), materials.clearPlastic));
    // clear supply hose across the floor to the hydroponic pipe
    const hose = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x - 0.2, 0.02, z + 0.05),
      new THREE.Vector3(1.6, 0.01, 3.95),
      new THREE.Vector3(1.4, 0.01, 4.45),
      new THREE.Vector3(PIPE.x, 0.3, PIPE.z1 - 0.1),
      new THREE.Vector3(PIPE.x, PIPE.y - 0.05, PIPE.z1 - 0.05),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(hose, 40, 0.006, 5, false), materials.clearPlastic));

    // the two vertical LED bars, floor to ceiling, either side of the plant
    for (const [px, pz] of [[x - 0.15, z + 0.17], [x + 0.15, z - 0.17]]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.03, CEIL - 0.02, 0.03), materials.black);
      bar.position.set(px, CEIL / 2, pz);
      g.add(bar);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.034, CEIL - 0.1, 0.012), materials.led);
      strip.position.set(px, CEIL / 2, pz);
      strip.rotation.y = Math.PI / 4;
      g.add(strip);
    }
    OBSTACLES.push({ x0: x - 0.32, x1: x + 0.32, z0: z - 0.32, z1: z + 0.32 });
  }

  return g;
}
