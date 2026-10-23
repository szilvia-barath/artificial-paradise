import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { OBSTACLES } from './layout.js';

// Furniture and fixtures, placed from the photos. Kept low-poly; static meshes are
// merged per material at the end, repeated parts are instanced.

const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
const cyl = (rt, rb, h, mat, seg = 16) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);

function obstacle(x0, x1, z0, z1) {
  OBSTACLES.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1) });
}

function place(obj, x, y, z, ry = 0) {
  obj.position.set(x, y, z);
  obj.rotation.y = ry;
  return obj;
}

// Box spanning explicit world bounds.
function slab(mat, x0, x1, y0, y1, z0, z1) {
  return place(box(x1 - x0, y1 - y0, z1 - z0, mat), (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
}

// Thin cylinder between two points.
function rod(mat, a, b, r = 0.01, seg = 6) {
  const d = new THREE.Vector3().subVectors(b, a);
  const m = cyl(r, r, d.length(), mat, seg);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}

// Black wire-mesh grid (the folding chairs' seat and back), alpha-tested.
function wireGridMaterial() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 64, 64);
  g.strokeStyle = '#fff';
  g.lineWidth = 2.2;
  for (let i = 0; i <= 64; i += 8) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(64, i); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 4);
  return new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.5, metalness: 0.4, alphaMap: t, alphaTest: 0.5, side: THREE.DoubleSide });
}

// Folding wire chair as in Room 2 (DSC_0056–0059). Faces +z at ry = 0.
function wireChair(materials, gridMat, cushion = false) {
  const c = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.4), gridMat);
  seat.rotation.x = -Math.PI / 2;
  seat.position.set(0, 0.45, 0.02);
  c.add(seat);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.3), gridMat);
  back.position.set(0, 0.74, -0.2);
  back.rotation.x = -0.12;
  c.add(back);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  for (const s of [-1, 1]) {
    const x = s * 0.21;
    c.add(rod(materials.black, V(x, 0, 0.2), V(x, 0.9, -0.22), 0.009));
    c.add(rod(materials.black, V(x, 0, -0.2), V(x, 0.45, 0.2), 0.009));
    c.add(rod(materials.black, V(x, 0.45, -0.18), V(x, 0.45, 0.22), 0.008));
  }
  c.add(rod(materials.black, V(-0.21, 0.89, -0.22), V(0.21, 0.89, -0.22), 0.008));
  if (cushion) {
    const k = box(0.4, 0.05, 0.38, new THREE.MeshStandardMaterial({ color: 0xd9cdb3, roughness: 1 }));
    k.position.set(0, 0.48, 0.02);
    c.add(k);
  }
  return c;
}

export function buildProps(materials) {
  const g = new THREE.Group();
  g.name = 'props';
  const anim = []; // per-frame callbacks (t, dt)
  const gridMat = wireGridMaterial();

  // ================================================================ Room 1
  // Positions measured in the 360° panorama (see layout.js). WX: west wall face,
  // EX: face of the two piers on the Room 2 side, RX: back of the doorway recess.
  const WX = 0.35;
  const EX = 4.85;
  const RX = 5.4;
  const SZ = 6.55;

  // Stairs along the north wall, rising west through the wall into the stair shaft
  // (DSC_0013–0016, panorama). Treads are dark, the open side is a white brick
  // stringer with a red-brick coping and a black railing.
  {
    const run = 0.26;
    const rise = 0.19;
    const foot = 2.69;
    const steps = 17;
    const width = 1.95;
    const inRoom = Math.round((foot - WX) / run);
    const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), materials.stair, steps);
    const m = new THREE.Matrix4();
    for (let i = 0; i < steps; i++) {
      const h = rise * (i + 1);
      const x1 = foot - run * i;
      m.compose(new THREE.Vector3(x1 - run / 2, h / 2, width / 2), new THREE.Quaternion(), new THREE.Vector3(run + 0.002, h, width));
      inst.setMatrixAt(i, m);
    }
    g.add(inst);
    // stringer wall: the stair profile extruded 0.15 m on the open (south) side
    const shape = new THREE.Shape();
    shape.moveTo(foot, 0);
    for (let i = 0; i < inRoom; i++) shape.lineTo(foot - run * i, rise * (i + 1) + 0.06);
    shape.lineTo(WX - 0.02, rise * inRoom + 0.06);
    shape.lineTo(WX - 0.02, 0);
    shape.lineTo(foot, 0);
    const sg = new THREE.ExtrudeGeometry(shape, { depth: 0.15, bevelEnabled: false });
    const stringer = new THREE.Mesh(sg, materials.whiteBrick);
    stringer.position.z = width;
    g.add(stringer);
    // red brick coping along the top edge
    const len = Math.hypot(run * inRoom, rise * inRoom);
    const coping = box(len, 0.07, 0.17, materials.stairBrick);
    coping.position.set(foot - (run * inRoom) / 2 + 0.02, (rise * inRoom) / 2 + rise / 2 + 0.1, width + 0.075);
    coping.rotation.z = -Math.atan2(rise, run);
    g.add(coping);
    // railing posts + handrail
    const railH = 0.9;
    const top = (x) => ((foot - x) / run) * rise + rise + 0.06;
    for (let x = foot - 0.15; x > WX; x -= 0.75) {
      g.add(rod(materials.black, new THREE.Vector3(x, top(x), width + 0.075), new THREE.Vector3(x, top(x) + railH, width + 0.075), 0.014));
    }
    g.add(rod(materials.black, new THREE.Vector3(foot - 0.15, top(foot - 0.15) + railH, width + 0.075), new THREE.Vector3(WX - 0.1, top(WX - 0.1) + railH, width + 0.075), 0.02));
    obstacle(WX - 0.4, foot + 0.02, 0, width + 0.16);
    // folding chairs stacked on the steps against the north wall
    for (let k = 0; k < 2; k++) {
      for (let j = 0; j < 4; j++) {
        const x = 2.05 - k * 0.55;
        const step = Math.floor((foot - x) / run);
        const ch = wireChair(materials, gridMat);
        place(ch, x, rise * (step + 1) + j * 0.05, 0.32 + j * 0.035, -Math.PI / 2);
        ch.rotation.z = 0.04 * j;
        g.add(ch);
      }
    }
  }

  // Grey bench along the south wall, turning up the west wall (the L on the plan)
  {
    const H = 0.45;
    g.add(slab(materials.bench, WX, EX - 0.02, 0, H - 0.03, SZ - 0.43, SZ));
    g.add(slab(materials.benchTop, WX, EX, H - 0.03, H, SZ - 0.47, SZ));
    g.add(slab(materials.bench, WX, WX + 0.47, 0, H - 0.03, 5.68, SZ - 0.43));
    g.add(slab(materials.benchTop, WX, WX + 0.51, H - 0.03, H, 5.64, SZ - 0.43));
    obstacle(WX, EX, SZ - 0.49, SZ);
    obstacle(WX, WX + 0.52, 5.62, SZ - 0.43);
    // two white heating pipes on the wall just above the bench
    for (const y of [0.56, 0.63]) {
      const p = cyl(0.016, 0.016, EX - WX, materials.white, 8);
      p.rotation.z = Math.PI / 2;
      g.add(place(p, (WX + EX) / 2, y, SZ - 0.03));
    }
  }

  // Plinths either side of the doorway, standing in the recess
  for (const z of [3.42, 4.82]) {
    g.add(place(box(0.32, 1.15, 0.32, materials.white), RX - 0.18, 0.575, z));
    obstacle(RX - 0.36, RX, z - 0.17, z + 0.17);
  }
  // electric box and cables left of the doorway (DSC_0020)
  g.add(place(box(0.03, 0.16, 0.13, materials.white), RX - 0.015, 1.62, 3.48));

  // Radiators (aluminium sections)
  const radiator = (x, z, ry, w = 0.8, h = 0.85) => {
    const r = new THREE.Group();
    const fins = Math.round(w / 0.08);
    const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, h, 0.09), materials.white, fins);
    const m = new THREE.Matrix4();
    for (let i = 0; i < fins; i++) {
      m.makeTranslation(-w / 2 + (i + 0.5) * (w / fins), h / 2, 0);
      inst.setMatrixAt(i, m);
    }
    r.add(inst);
    place(r, x, 0.1, z, ry);
    g.add(r);
  };
  radiator(WX + 0.08, 3.5, Math.PI / 2, 0.94);
  radiator(WX + 0.08, 5.46, Math.PI / 2, 0.42);
  radiator(EX - 0.08, 5.59, -Math.PI / 2, 0.94);

  // High basement windows on the street wall (night: dark glass): the one with the
  // round vent beside the stairs, the other above the small radiator by the bench
  for (const [z, w] of [[3.69, 0.81], [5.49, 0.75]]) {
    const y0 = 1.78;
    const y1 = 2.56;
    g.add(slab(materials.whiteBrick, WX - 0.4, WX + 0.06, y0 - 0.06, y0, z - w / 2 - 0.06, z + w / 2 + 0.06)); // sill
    g.add(slab(materials.white, WX - 0.05, WX + 0.02, y0, y1, z - w / 2, z + w / 2)); // frame
    g.add(slab(materials.windowGlass, WX + 0.02, WX + 0.03, y0 + 0.05, y1 - 0.05, z - w / 2 + 0.05, z + w / 2 - 0.05));
    for (let k = 1; k < 4; k++) g.add(slab(materials.white, WX + 0.03, WX + 0.045, y0 + 0.05, y1 - 0.05, z - w / 2 + (k * w) / 4 - 0.012, z - w / 2 + (k * w) / 4 + 0.012));
    g.add(slab(materials.white, WX + 0.03, WX + 0.045, (y0 + y1) / 2 - 0.012, (y0 + y1) / 2 + 0.012, z - w / 2 + 0.05, z + w / 2 - 0.05));
  }
  // the round vent in the first window
  {
    const vent = cyl(0.075, 0.075, 0.02, new THREE.MeshStandardMaterial({ color: 0x2a3550, roughness: 0.4 }), 20);
    vent.rotation.z = Math.PI / 2;
    g.add(place(vent, WX + 0.05, 2.36, 3.62));
  }

  // White pipes running up beside the doorway to Room 2 (DSC_0021)
  for (const z of [4.6, 4.66]) g.add(place(cyl(0.017, 0.017, 2.9, materials.white, 8), RX - 0.03, 1.45, z));

  // ================================================================ Room 2
  {
    // bar counter tops (dark laminate) over the brick half walls
    g.add(slab(materials.counterTop, 7.62, 9.72, 1.0, 1.05, 4.78, 5.36));
    g.add(slab(materials.counterTop, 9.64, 10.14, 1.0, 1.05, 4.18, 4.92));
    // behind the bar: low cabinets, shelves with glasses, kettle, bottles
    g.add(slab(materials.white, 7.72, 9.66, 0, 0.88, 5.52, 5.93));
    g.add(slab(materials.counterTop, 7.7, 9.68, 0.88, 0.92, 5.5, 5.94));
    for (const y of [1.42, 1.78]) g.add(slab(materials.wood, 7.8, 9.55, y, y + 0.025, 5.7, 5.93));
    const glassGeo = new THREE.CylinderGeometry(0.035, 0.028, 0.12, 10);
    const n = 22;
    const glasses = new THREE.InstancedMesh(glassGeo, materials.glass, n);
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const row = i < 9 ? 0 : i < 18 ? 1 : 2;
      const k = row === 2 ? i - 18 : i % 9;
      const x = row === 2 ? 8.6 + k * 0.1 : 7.95 + k * 0.17;
      const y = row === 0 ? 1.505 : row === 1 ? 1.865 : 1.11;
      const z = row === 2 ? 5.0 + (k % 2) * 0.08 : 5.81;
      m.makeTranslation(x, y, z);
      glasses.setMatrixAt(i, m);
    }
    g.add(glasses);
    const kettle = cyl(0.075, 0.095, 0.22, materials.white, 16);
    g.add(place(kettle, 8.05, 1.03, 5.7));
    const bottleMat = new THREE.MeshStandardMaterial({ color: 0x3a1f16, roughness: 0.2, metalness: 0.1 });
    for (let i = 0; i < 3; i++) {
      g.add(place(cyl(0.035, 0.035, 0.24, bottleMat, 10), 9.2 + i * 0.09, 1.04, 5.72));
      g.add(place(cyl(0.012, 0.02, 0.08, bottleMat, 8), 9.2 + i * 0.09, 1.2, 5.72));
    }
    obstacle(7.42, 9.72, 4.78, 5.94);

    // round black café table and the folding wire chairs under Artificial Paradise II
    const table = new THREE.Group();
    table.add(place(cyl(0.3, 0.3, 0.025, materials.black, 32), 0, 0.75, 0));
    table.add(place(cyl(0.03, 0.03, 0.74, materials.black, 10), 0, 0.37, 0));
    table.add(place(cyl(0.2, 0.22, 0.025, materials.black, 24), 0, 0.012, 0));
    g.add(place(table, 8.2, 0, 2.3));
    obstacle(7.9, 8.5, 2.0, 2.6);
    g.add(place(wireChair(materials, gridMat), 7.12, 0, 2.08, 0.1));
    obstacle(6.88, 7.36, 1.85, 2.32);
    g.add(place(wireChair(materials, gridMat, true), 8.85, 0, 2.6, -1.9));
    obstacle(8.6, 9.1, 2.35, 2.85);

    // enamel pendant lamps (DSC_0083)
    for (const [x, z] of [[7.35, 3.2], [8.5, 3.75]]) {
      const lamp = new THREE.Group();
      lamp.add(place(cyl(0.005, 0.005, 0.5, materials.black, 4), 0, 2.5, 0));
      lamp.add(place(cyl(0.05, 0.19, 0.15, materials.black, 24), 0, 2.2, 0));
      const inner = cyl(0.045, 0.18, 0.13, materials.white, 24);
      inner.material = materials.white.clone();
      inner.material.side = THREE.BackSide;
      lamp.add(place(inner, 0, 2.2, 0));
      lamp.add(place(new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), materials.warmBulb), 0, 2.13, 0));
      g.add(place(lamp, x, 0, z));
    }

    // closed door to the toilets
    g.add(slab(materials.door, 6.08, 6.92, 0, 2.02, 5.9, 5.94));
    g.add(slab(materials.white, 6.02, 6.08, 0, 2.08, 5.89, 5.94));
    g.add(slab(materials.white, 6.92, 6.98, 0, 2.08, 5.89, 5.94));
    g.add(slab(materials.white, 6.02, 6.98, 2.02, 2.08, 5.89, 5.94));
    g.add(place(box(0.12, 0.02, 0.04, materials.steel), 6.8, 1.02, 5.88));

    // gate in front of the storage alcove (DSC_0058–0060), with lumber stored behind
    for (let x = 8.7; x < 9.68; x += 0.11) g.add(slab(materials.white, x, x + 0.016, 0.05, 2.08, 1.58, 1.6));
    for (const y of [0.05, 1.0, 2.06]) g.add(slab(materials.white, 8.66, 9.69, y, y + 0.025, 1.57, 1.61));
    for (let i = 0; i < 5; i++) {
      const b = box(0.12, 2.0, 0.025, materials.wood);
      place(b, 8.8 + i * 0.17, 1.0, 0.25 + i * 0.06);
      b.rotation.x = -0.12;
      g.add(b);
    }
    obstacle(8.65, 9.7, 1.5, 1.62);
  }

  // ================================================================ Room 4
  {
    // ceiling-hung projector for Let it Flow
    const proj = new THREE.Group();
    proj.add(place(box(0.36, 0.13, 0.3, materials.black), 0, 2.38, 0));
    proj.add(place(cyl(0.02, 0.02, 0.45, materials.black, 6), 0, 2.66, 0));
    const lens = cyl(0.045, 0.045, 0.03, materials.led, 16);
    lens.rotation.z = Math.PI / 2;
    proj.add(place(lens, 0.19, 2.38, 0));
    g.add(place(proj, 17.4, 0, 3.83));

    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x55575c, roughness: 0.6 });
    // low heating pipe along the north wall + big drain pipes coming down (DSC_0104–0109)
    const low = cyl(0.03, 0.03, 9.9, pipeMat, 8);
    low.rotation.z = Math.PI / 2;
    g.add(place(low, 20.7, 0.42, 1.78));
    for (const [x, y0] of [[19.9, 0.42], [21.4, 1.9], [22.15, 1.9], [24.4, 0.42]]) {
      const r = x === 21.4 || x === 22.15 ? 0.065 : 0.03;
      g.add(place(cyl(r, r, 2.9 - y0, pipeMat, 10), x, (2.9 + y0) / 2, 1.73 + r + 0.02));
    }
    // gas meter by the partition (DSC_0098–0101)
    g.add(place(box(0.22, 0.3, 0.16, materials.white), 16.3, 1.62, 1.82));
    g.add(place(cyl(0.025, 0.025, 0.12, new THREE.MeshStandardMaterial({ color: 0xe6c21e, roughness: 0.5 }), 8), 16.3, 1.83, 1.82));
    g.add(place(cyl(0.018, 0.018, 1.45, pipeMat, 8), 16.2, 0.72, 1.79));

    // curtain bunched at the south side of the opening between Room 3 and Room 4
    const cg = new THREE.PlaneGeometry(0.55, 2.42, 18, 1);
    const pos = cg.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 46) * 0.045);
    cg.computeVertexNormals();
    const curtain = new THREE.Mesh(cg, materials.curtain);
    g.add(place(curtain, 15.84, 1.22, 4.5, Math.PI / 2));
    obstacle(15.78, 15.92, 4.2, 4.82);
  }

  // ================================================================ track lights
  {
    const rails = [
      { x0: 0.9, x1: 4.4, z: 2.9, y: 3.0 },
      { x0: 0.9, x1: 4.4, z: 5.0, y: 3.0 },
      { x0: 10.3, x1: 15.1, z: 3.83, y: 2.75 },
    ];
    const per = 4;
    const spotGeo = new THREE.CylinderGeometry(0.04, 0.055, 0.15, 12);
    spotGeo.rotateX(Math.PI / 2);
    const count = rails.length * per;
    const spots = new THREE.InstancedMesh(spotGeo, materials.black, count);
    const lenses = new THREE.InstancedMesh(new THREE.CircleGeometry(0.036, 12), materials.led, count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    let k = 0;
    for (const r of rails) {
      g.add(place(box(r.x1 - r.x0, 0.03, 0.05, materials.black), (r.x0 + r.x1) / 2, r.y - 0.02, r.z));
      for (let i = 0; i < per; i++) {
        const x = r.x0 + 0.4 + (i / (per - 1)) * (r.x1 - r.x0 - 0.8);
        q.setFromEuler(new THREE.Euler(0.8, i % 2 ? 0 : Math.PI, 0, 'YXZ'));
        const p = new THREE.Vector3(x, r.y - 0.13, r.z);
        m.compose(p, q, new THREE.Vector3(1, 1, 1));
        spots.setMatrixAt(k, m);
        const lp = new THREE.Vector3(0, 0, 0.076).applyQuaternion(q).add(p);
        m.compose(lp, q, new THREE.Vector3(1, 1, 1));
        lenses.setMatrixAt(k, m);
        k++;
      }
    }
    g.add(spots, lenses);
  }

  mergeStatic(g);
  return { group: g, anim };
}

// Bake every plain (non-instanced) mesh into one merged mesh per material: a few
// hundred small meshes of furniture become a couple of dozen draw calls.
function mergeStatic(group) {
  group.updateMatrixWorld(true);
  const byMat = new Map();
  group.traverse((o) => {
    if (o.isMesh && !o.isInstancedMesh) {
      if (!byMat.has(o.material)) byMat.set(o.material, []);
      byMat.get(o.material).push(o);
    }
  });
  for (const [mat, meshes] of byMat) {
    if (meshes.length < 2) continue;
    const geos = meshes.map((m) => {
      const geo = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone());
      geo.applyMatrix4(m.matrixWorld);
      for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
      geo.morphAttributes = {};
      geo.clearGroups();
      return geo;
    });
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    for (const m of meshes) m.parent.remove(m);
    const mesh = new THREE.Mesh(merged, mat);
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
  }
}
