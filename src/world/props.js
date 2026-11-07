import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { OBSTACLES, R1, R1_NICHES, NICHE } from './layout.js';
import { dirtAlong } from './surface.js';
import { uvMetres } from './materials.js';
import { PLANT, BARS, BAR_BOTTOM } from './paradiseFactory.js';

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
  g.lineWidth = 1.6;
  for (let i = 0; i <= 64; i += 8) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(64, i); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(5, 5);
  t.anisotropy = 8;
  // alpha to coverage keeps the wires as wires at a distance instead of a solid panel
  return new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.45, metalness: 0.5, alphaMap: t, alphaTest: 0.35, alphaToCoverage: true, side: THREE.DoubleSide });
}

// Perforated grey steel sheet (the bench fronts in _artificial paradise 01 - 02): round holes
// on an 8 mm grid, one texture tile = 25 cm, so UVs in metres repeat it 4 times a metre.
function perforatedMaterial() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#a3a5aa'; // lit from above only, the vertical sheet reads darker
  g.fillRect(0, 0, S, S);
  g.fillStyle = '#26272b';
  const pitch = S / 32; // 32 holes per 25 cm
  for (let y = pitch / 2; y < S; y += pitch) {
    for (let x = pitch / 2; x < S; x += pitch) {
      g.beginPath();
      g.arc(x, y, pitch * 0.3, 0, Math.PI * 2);
      g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 4);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.55, metalness: 0.15 });
}

// A cable lying along a path of points (on the floor, down a wall).
function cable(mat, pts, r = 0.004) {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  return new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(12, pts.length * 10), r, 5, false), mat);
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
    // a thin cream fabric seat pad tied to the frame (DSC_0059, DSC_0083)
    const k = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.028, 24), new THREE.MeshStandardMaterial({ color: 0xd8ceb6, roughness: 1 }));
    k.scale.set(0.38, 1, 0.36);
    k.position.set(0, 0.47, 0.02);
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
  const WX = R1.west;
  const EX = R1.east;
  const RX = R1.recess;
  const SZ = R1.D;

  // Stairs along the north wall, rising west through the wall into the stair shaft
  // (DSC_0013–0016, panorama, close-ups of the flight). Treads are dark, worn concrete; the
  // open side is a whitewashed brick wall topped by a row of bare bricks set on edge, square
  // to the slope, with a little brick pier at its foot; a black railing.
  {
    const run = 0.26;
    const rise = 0.19;
    const foot = EX - 2.54; // last step ends ~50 cm before Wrong Data Landscape Dresden
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
    // the brick-on-edge coping: one brick every 7.7 cm along the slope, each showing its
    // 6.5 x 12 cm end on the side, in its own red-brown, set a little irregularly in pale
    // mortar, overhanging the whitewashed wall on both sides
    {
      const len = Math.hypot(run * inRoom, rise * inRoom);
      const L = Math.hypot(run, rise);
      const d = new THREE.Vector2(-run / L, rise / L); // up the slope
      const nrm = new THREE.Vector2(rise / L, run / L); // square to it, upwards
      const angle = -Math.atan2(rise, run);
      const zc = width + 0.075;
      const base = (s) => new THREE.Vector2(foot, rise + 0.06).addScaledVector(d, s);
      const mortar = box(len, 0.1, 0.235, new THREE.MeshStandardMaterial({ color: 0xcfc8ba, roughness: 1 }));
      const mc = base(len / 2).addScaledVector(nrm, 0.045);
      mortar.position.set(mc.x, mc.y, zc);
      mortar.rotation.z = angle;
      g.add(mortar);
      const n = Math.floor(len / 0.077);
      const brickMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.93 });
      const bricks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.065, 0.12, 0.25), brickMat, n);
      const q2 = new THREE.Quaternion();
      const e2 = new THREE.Euler();
      const c = new THREE.Color();
      const r = (k) => (Math.sin(k * 12.9898) * 43758.5453) % 1; // fixed jitter per brick
      for (let i = 0; i < n; i++) {
        const p = base((i + 0.5) * 0.077).addScaledVector(nrm, 0.055 + Math.abs(r(i + 1)) * 0.008);
        e2.set(r(i + 7) * 0.03, r(i + 3) * 0.02, angle + r(i + 5) * 0.05);
        q2.setFromEuler(e2);
        m.compose(new THREE.Vector3(p.x, p.y, zc + r(i + 9) * 0.012), q2, new THREE.Vector3(1, 1, 1));
        bricks.setMatrixAt(i, m);
        const t = Math.abs(r(i + 11));
        c.setHSL(0.03 + t * 0.035, 0.3 + Math.abs(r(i + 13)) * 0.18, 0.25 + Math.abs(r(i + 17)) * 0.12 - (t > 0.85 ? 0.07 : 0), THREE.SRGBColorSpace);
        // old whitewash left on some of them
        if (Math.abs(r(i + 19)) > 0.84) c.lerp(new THREE.Color(0xd9d3c8), 0.45 + Math.abs(r(i + 23)) * 0.3);
        bricks.setColorAt(i, c);
      }
      g.add(bricks);
      // the little brick pier the coping starts from, at the foot of the flight
      const pier = new THREE.Mesh(uvMetres(new THREE.BoxGeometry(0.26, 0.36, 0.27), 0.26, 0.36), materials.stairBrick);
      pier.position.set(foot + 0.09, 0.18, zc);
      g.add(pier);
      obstacle(foot - 0.04, foot + 0.22, width - 0.06, width + 0.21);
    }
    // railing posts + handrail
    const railH = 0.9;
    const top = (x) => ((foot - x) / run) * rise + rise + 0.06;
    for (let x = foot - 0.15; x > WX; x -= 0.75) {
      g.add(rod(materials.black, new THREE.Vector3(x, top(x), width + 0.075), new THREE.Vector3(x, top(x) + railH, width + 0.075), 0.014));
    }
    g.add(rod(materials.black, new THREE.Vector3(foot - 0.15, top(foot - 0.15) + railH, width + 0.075), new THREE.Vector3(WX - 0.1, top(WX - 0.1) + railH, width + 0.075), 0.02));
    obstacle(WX - 0.4, foot + 0.02, 0, width + 0.16);
  }

  // Grey bench along the south wall, turning up the west wall (the L on the plan): a dark
  // board on a box faced with perforated steel sheet in panels (_artificial paradise 01 - 02)
  {
    const H = 0.45;
    const perf = perforatedMaterial();
    const seamMat = new THREE.MeshStandardMaterial({ color: 0x3a3b3f, roughness: 0.5, metalness: 0.5 });
    // a perforated panel face: from a to b along the floor (x, z), facing out by (nx, nz)
    const face = (ax, az, bx, bz, nx, nz) => {
      const len = Math.hypot(bx - ax, bz - az);
      const geo = new THREE.PlaneGeometry(len, H - 0.05);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len, uv.getY(i) * (H - 0.05));
      const m = new THREE.Mesh(geo, perf);
      m.position.set((ax + bx) / 2 + nx * 0.002, 0.02 + (H - 0.05) / 2, (az + bz) / 2 + nz * 0.002);
      m.rotation.y = Math.atan2(nx, nz);
      g.add(m);
      // panel seams every ~60 cm
      const n = Math.max(1, Math.round(len / 0.6));
      for (let k = 1; k < n; k++) {
        const t = k / n;
        const s = new THREE.Mesh(new THREE.BoxGeometry(0.008, H - 0.05, 0.004), seamMat);
        s.position.set(ax + (bx - ax) * t + nx * 0.003, 0.02 + (H - 0.05) / 2, az + (bz - az) * t + nz * 0.003);
        s.rotation.y = Math.atan2(nx, nz);
        g.add(s);
      }
    };
    face(WX + 0.47, SZ - 0.43, EX - 0.02, SZ - 0.43, 0, -1); // long front
    face(WX + 0.47, SZ - 0.87, WX + 0.47, SZ - 0.43, 1, 0); // front of the return
    face(WX, SZ - 0.87, WX + 0.47, SZ - 0.87, 0, -1); // end of the return
    g.add(slab(materials.bench, WX, EX - 0.02, 0, H - 0.03, SZ - 0.43, SZ));
    g.add(slab(materials.benchTop, WX, EX, H - 0.03, H, SZ - 0.47, SZ));
    g.add(slab(materials.bench, WX, WX + 0.47, 0, H - 0.03, SZ - 0.87, SZ - 0.43));
    g.add(slab(materials.benchTop, WX, WX + 0.51, H - 0.03, H, SZ - 0.91, SZ - 0.43));
    obstacle(WX, EX, SZ - 0.49, SZ);
    obstacle(WX, WX + 0.52, SZ - 0.93, SZ - 0.43);
    // two white heating pipes on the wall just above the bench
    dirtAlong(WX, 0.6, SZ - 0.03, EX, 0.6, SZ - 0.03);
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
  const radiator = (x, z, ry, w = 0.8, h = 0.85, y = 0.1, mat = materials.white) => {
    const r = new THREE.Group();
    const fins = Math.round(w / 0.08);
    const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, h, 0.09), mat, fins);
    const m = new THREE.Matrix4();
    for (let i = 0; i < fins; i++) {
      m.makeTranslation(-w / 2 + (i + 0.5) * (w / fins), h / 2, 0);
      inst.setMatrixAt(i, m);
    }
    r.add(inst);
    place(r, x, y, z, ry);
    g.add(r);
  };
  // the two on the street wall stand in the window niches
  const NX = WX - NICHE.depth; // back of the niches
  radiator(NX + 0.07, 3.53, Math.PI / 2, 0.94);
  radiator(NX + 0.07, SZ - 1.09, Math.PI / 2, 0.42);
  radiator(EX - 0.08, 5.59, -Math.PI / 2, 0.94);

  // High basement windows at the back of the niches (_artificial paradise 01 - 02 and the
  // close-up of the window by the stairs): a thick white frame with an inner sash, frosted
  // grey-blue glass, reeded in its lower part, the grille outside showing through it only
  // faintly, a boxed white lintel above and a stepped sill below
  const barMat = new THREE.MeshStandardMaterial({ color: 0x737a8c, roughness: 0.7, emissive: 0x2c3040 });
  for (const { z0: nz0, z1: nz1, win: { z, w } } of R1_NICHES) {
    const y0 = NICHE.sill;
    const y1 = NICHE.top - 0.03;
    const f = 0.07; // outer frame
    const s = 0.035; // inner sash
    g.add(slab(materials.white, NX, NX + 0.05, y0, y1, z - w / 2, z + w / 2)); // frame
    g.add(slab(materials.white, NX + 0.05, NX + 0.07, y0 + f - s, y1 - f + s, z - w / 2 + f - s, z + w / 2 - f + s)); // sash
    const gy0 = y0 + f;
    const gy1 = y1 - f;
    const split = gy0 + (gy1 - gy0) * 0.42;
    g.add(slab(materials.reededGlass, NX + 0.07, NX + 0.072, gy0, split, z - w / 2 + f, z + w / 2 - f));
    g.add(slab(materials.windowGlass, NX + 0.07, NX + 0.072, split, gy1, z - w / 2 + f, z + w / 2 - f));
    for (let k = 1; k < 5; k++) {
      const bz = z - w / 2 + f + (k * (w - 2 * f)) / 5;
      g.add(slab(barMat, NX + 0.072, NX + 0.075, gy0, gy1, bz - 0.006, bz + 0.006));
    }
    for (let k = 1; k < 4; k++) {
      const by = gy0 + (k * (gy1 - gy0)) / 4;
      g.add(slab(barMat, NX + 0.072, NX + 0.075, by - 0.006, by + 0.006, z - w / 2 + f, z + w / 2 - f));
    }
    // the boxed lintel across the top of the niche, standing a little proud of the wall
    g.add(slab(materials.white, WX - 0.25, WX + 0.04, NICHE.top - 0.03, NICHE.top + 0.13, nz0 - 0.03, nz1 + 0.03));
    // the sill: two shallow steps out to the face of the wall
    g.add(slab(materials.white, NX, WX - 0.08, y0 - 0.04, y0, z - w / 2 - 0.02, z + w / 2 + 0.02));
    g.add(slab(materials.white, NX, WX, y0 - 0.09, y0 - 0.04, z - w / 2 - 0.02, z + w / 2 + 0.02));
  }
  // the round vent in the window by the stairs: a blue mesh disc in a white ring
  {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const vg = c.getContext('2d');
    vg.fillStyle = '#3d5cc4';
    vg.fillRect(0, 0, 64, 64);
    vg.strokeStyle = 'rgba(15,20,45,0.85)';
    vg.lineWidth = 1.4;
    for (let i = 2; i < 64; i += 5) {
      vg.beginPath(); vg.moveTo(i, 0); vg.lineTo(i, 64); vg.stroke();
      vg.beginPath(); vg.moveTo(0, i); vg.lineTo(64, i); vg.stroke();
    }
    const vt = new THREE.CanvasTexture(c);
    vt.colorSpace = THREE.SRGBColorSpace;
    const vent = new THREE.Mesh(new THREE.CircleGeometry(0.067, 28), new THREE.MeshStandardMaterial({ map: vt, roughness: 0.5, emissive: 0x101830 }));
    vent.rotation.y = Math.PI / 2;
    g.add(place(vent, NX + 0.078, 2.27, R1_NICHES[0].win.z));
    const ring = cyl(0.074, 0.074, 0.012, materials.white, 28);
    ring.rotation.z = Math.PI / 2;
    g.add(place(ring, NX + 0.07, 2.27, R1_NICHES[0].win.z));
  }
  // the heating pipe along the foot of the street wall, between the radiators
  {
    const p = cyl(0.016, 0.016, 2.6, materials.white, 8);
    p.rotation.x = Math.PI / 2;
    g.add(place(p, WX + 0.03, 0.06, 4.8));
    dirtAlong(WX + 0.03, 0.06, 3.5, WX + 0.03, 0.06, 6.1);
  }

  // Cables on the floor (_artificial paradise 01 - 02): the screen's black lead down the wall
  // to its adapter, two white power strips, and leads on to the plant's pump and the LED
  // bars; a white lead comes down the wall from the little sensor beside the window
  {
    const Y = 0.005; // lying on the floor
    const black = materials.black;
    const white = materials.white;
    const screenZ = 5.23;
    const ad = [0.62, 4.98]; // the screen's adapter
    const p1 = [1.02, 4.62]; // power strips
    const p2 = [1.42, 4.3];
    g.add(cable(black, [[WX + 0.03, 1.14, screenZ], [WX + 0.035, 0.6, screenZ + 0.01], [WX + 0.04, Y + 0.02, screenZ + 0.02], [0.15, Y, 5.12], [0.4, Y, 5.1], [ad[0] - 0.05, Y, ad[1]]]));
    g.add(place(box(0.11, 0.035, 0.065, black), ad[0], 0.0175, ad[1], 0.3));
    g.add(cable(black, [[ad[0] + 0.05, Y, ad[1] - 0.02], [0.78, Y, 4.92], [0.86, Y, 4.7], [p1[0] - 0.12, Y, p1[1] + 0.03]], 0.003));
    for (const [[x, z], ry] of [[p1, 0.6], [p2, -0.4]]) {
      g.add(place(box(0.3, 0.04, 0.055, white), x, 0.02, z, ry));
      for (const o of [-0.06, 0.04]) g.add(place(box(0.035, 0.045, 0.035, black), x + Math.cos(ry) * o, 0.06, z - Math.sin(ry) * o, ry));
    }
    // strip to strip, and the first strip to the wall socket by the radiator
    g.add(cable(white, [[p1[0] + 0.12, Y, p1[1] - 0.07], [1.15, Y, 4.42], [1.08, Y, 4.33], [p2[0] - 0.13, Y, p2[1] - 0.05]], 0.0045));
    g.add(cable(white, [[p1[0] - 0.1, Y, p1[1] + 0.06], [0.55, Y, 4.5], [0.2, Y, 4.42], [WX + 0.04, Y + 0.02, 4.4], [WX + 0.03, 0.28, 4.4]], 0.0045));
    g.add(place(box(0.03, 0.08, 0.08, white), WX + 0.015, 0.3, 4.4));
    // from the second strip to the pump in the plant's water box and up to the foot of each LED bar
    g.add(cable(black, [[p2[0] + 0.12, Y, p2[1] - 0.04], [1.7, Y, 4.12], [1.85, Y, 3.95], [PLANT.x - 0.15, Y, PLANT.z + 0.12], [PLANT.x - 0.1, 0.1, PLANT.z + 0.05]], 0.003));
    for (const [i, bar] of BARS.entries()) {
      g.add(cable(i ? white : black, [[p2[0] + 0.1, Y, p2[1] + 0.02], [1.65 + i * 0.2, Y, 4.35 - i * 0.05], [bar.x - 0.15, Y, bar.z + 0.1], [bar.x - 0.02, Y, bar.z], [bar.x - 0.015, BAR_BOTTOM * 0.5, bar.z], [bar.x - 0.01, BAR_BOTTOM, bar.z]], 0.003));
    }
    // the sensor beside the first window and its lead down the pier
    const sensorZ = R1_NICHES[1].z0 - 0.08;
    g.add(place(cyl(0.035, 0.035, 0.05, white, 16).rotateZ(Math.PI / 2), WX + 0.025, 2.3, sensorZ));
    g.add(cable(white, [[WX + 0.02, 2.27, sensorZ], [WX + 0.02, 1.2, sensorZ - 0.01], [WX + 0.025, Y + 0.02, sensorZ - 0.02], [0.2, Y, 5.25], [0.5, Y, 4.85], [p1[0] - 0.13, Y, p1[1] + 0.01]], 0.0045));
  }

  // White pipes running up beside the doorway to Room 2 (DSC_0021)
  dirtAlong(RX - 0.03, 0, 4.63, RX - 0.03, 2.9, 4.63);
  for (const z of [4.6, 4.66]) g.add(place(cyl(0.017, 0.017, 2.9, materials.white, 8), RX - 0.03, 1.45, z));

  // ================================================================ Room 2
  {
    // bar counter tops (dark laminate) over the brick half walls
    g.add(slab(materials.counterTop, 7.689, 9.87, 1.0, 1.05, 4.628, 5.179));
    g.add(slab(materials.counterTop, 9.788, 10.29, 1.0, 1.05, 4.058, 4.761));
    // behind the bar: low cabinets, shelves with glasses, kettle, bottles
    g.add(slab(materials.white, 7.793, 9.808, 0, 0.88, 5.331, 5.72));
    g.add(slab(materials.counterTop, 7.772, 9.829, 0.88, 0.92, 5.312, 5.73));
    for (const y of [1.42, 1.78]) g.add(slab(materials.wood, 7.876, 9.694, y, y + 0.025, 5.502, 5.72));
    const glassGeo = new THREE.CylinderGeometry(0.035, 0.028, 0.12, 10);
    const n = 22;
    const glasses = new THREE.InstancedMesh(glassGeo, materials.glass, n);
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const row = i < 9 ? 0 : i < 18 ? 1 : 2;
      const k = row === 2 ? i - 18 : i % 9;
      const x = row === 2 ? 8.707 + k * 0.1 : 8.032 + k * 0.17;
      const y = row === 0 ? 1.505 : row === 1 ? 1.865 : 1.11;
      const z = row === 2 ? 4.837 + (k % 2) * 0.08 : 5.6;
      m.makeTranslation(x, y, z);
      glasses.setMatrixAt(i, m);
    }
    g.add(glasses);
    // wine bottles where the white roll stood: dark green glass, dark foil on the neck
    const wineMat = new THREE.MeshStandardMaterial({ color: 0x1d3a22, roughness: 0.15, metalness: 0.1 });
    const foilMat = new THREE.MeshStandardMaterial({ color: 0x5a1420, roughness: 0.4, metalness: 0.5 });
    for (let i = 0; i < 3; i++) {
      const bx = 8.05 + i * 0.085;
      g.add(place(cyl(0.037, 0.037, 0.22, wineMat, 14), bx, 1.03, 5.502));
      g.add(place(cyl(0.014, 0.034, 0.05, wineMat, 12), bx, 1.165, 5.502));
      g.add(place(cyl(0.014, 0.014, 0.07, foilMat, 10), bx, 1.225, 5.502));
    }
    const bottleMat = new THREE.MeshStandardMaterial({ color: 0x3a1f16, roughness: 0.2, metalness: 0.1 });
    for (let i = 0; i < 3; i++) {
      g.add(place(cyl(0.035, 0.035, 0.24, bottleMat, 10), 9.331 + i * 0.09, 1.04, 5.51));
      g.add(place(cyl(0.012, 0.02, 0.08, bottleMat, 8), 9.331 + i * 0.09, 1.2, 5.51));
    }
    obstacle(7.481, 9.87, 4.628, 5.73);

    // round black café table and the folding wire chairs under Artificial Paradise II
    const table = new THREE.Group();
    // (DSC_0059, DSC_0083: a glossy black round top on a single black column and round foot)
    const gloss = new THREE.MeshStandardMaterial({ color: 0x0d0d0f, roughness: 0.22, metalness: 0.2 });
    table.add(place(cyl(0.3, 0.3, 0.02, gloss, 40), 0, 0.75, 0));
    table.add(place(cyl(0.3, 0.29, 0.012, materials.black, 40), 0, 0.734, 0));
    table.add(place(cyl(0.022, 0.022, 0.7, gloss, 14), 0, 0.38, 0));
    table.add(place(cyl(0.022, 0.06, 0.05, gloss, 14), 0, 0.04, 0));
    table.add(place(cyl(0.21, 0.23, 0.018, gloss, 32), 0, 0.009, 0));
    g.add(place(table, 8.292, 0, 2.272));
    obstacle(7.98, 8.603, 1.987, 2.557);
    g.add(place(wireChair(materials, gridMat, true), 7.169, 0, 2.063, 0.1));
    obstacle(6.92, 7.419, 1.844, 2.291);
    g.add(place(wireChair(materials, gridMat, true), 8.967, 0, 2.557, -1.9));
    obstacle(8.707, 9.227, 2.319, 2.794);

    // enamel pendant lamps (DSC_0083)
    for (const [x, z] of [[7.408, 3.127], [8.603, 3.649]]) {
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
    g.add(slab(materials.door, 6.089, 6.962, 0, 2.02, 5.692, 5.73));
    g.add(slab(materials.white, 6.027, 6.089, 0, 2.08, 5.682, 5.73));
    g.add(slab(materials.white, 6.962, 7.024, 0, 2.08, 5.682, 5.73));
    g.add(slab(materials.white, 6.027, 7.024, 2.02, 2.08, 5.682, 5.73));
    g.add(place(box(0.12, 0.02, 0.04, materials.steel), 6.837, 1.02, 5.673));

    // grille in front of the storage alcove (DSC_0058–0060): dark galvanised steel, round
    // rods ending in points above the top bar, three flat bars; lumber stored behind
    {
      const steel = new THREE.MeshStandardMaterial({ color: 0x4a4c50, roughness: 0.55, metalness: 0.6 });
      for (let x = 8.86; x < 9.82; x += 0.16) {
        g.add(rod(steel, new THREE.Vector3(x, 0.06, 1.59), new THREE.Vector3(x, 2.0, 1.59), 0.008, 6));
        g.add(place(new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.05, 6), steel), x, 2.025, 1.59));
      }
      for (const y of [0.25, 1.05, 1.86]) g.add(slab(steel, 8.78, 9.83, y, y + 0.035, 1.575, 1.582));
    }
    for (let i = 0; i < 5; i++) {
      const b = box(0.12, 2.0, 0.025, materials.wood);
      place(b, 8.915 + i * 0.17, 1.0, 0.25 + i * 0.06);
      b.rotation.x = -0.12;
      g.add(b);
    }
    obstacle(8.759, 9.85, 1.5, 1.62);
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
    g.add(place(proj, 17.48, 0, 3.725));

    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x55575c, roughness: 0.6 });
    // low heating pipe along the north wall + big drain pipes coming down (DSC_0104–0109)
    const low = cyl(0.03, 0.03, 9.48, pipeMat, 8);
    low.rotation.z = Math.PI / 2;
    g.add(place(low, 20.64, 0.42, 1.778));
    dirtAlong(15.9, 0.42, 1.778, 25.38, 0.42, 1.778);
    for (const [x, y0, r] of [[18.917, 0.42, 0.03], [24.184, 0.42, 0.03]]) {
      g.add(place(cyl(r, r, 2.9 - y0, pipeMat, 10), x, (2.9 + y0) / 2, 1.73 + r + 0.02));
      dirtAlong(x, y0, 1.75 + r, x, 2.9, 1.75 + r);
    }
    // a second low pipe above the first (DSC_0109)
    const low2 = cyl(0.028, 0.028, 9.48, pipeMat, 8);
    low2.rotation.z = Math.PI / 2;
    g.add(place(low2, 20.64, 0.66, 1.776));
    // the two big drain pipes coming down from the top pipe (DSC_0109, DSC_0111): one
    // straight down to an elbow into the wall at about 1 m, the other joining it at a slant
    {
      const r = 0.065;
      const z = 1.73 + r + 0.02;
      const V = (x, y) => new THREE.Vector3(x, y, z);
      const parts = [[V(20.305, 2.9), V(20.305, 1.05)], [V(20.976, 2.9), V(20.976, 2.0)], [V(20.976, 2.0), V(20.37, 1.42)]];
      for (const [a, b] of parts) g.add(rod(pipeMat, a, b, r, 12));
      // bottom elbow: a short bend turning into the wall
      g.add(place(cyl(r, r, 0.12, pipeMat, 12).rotateX(Math.PI / 2), 20.305, 1.0, z - 0.05));
      for (const y of [2.2, 1.65]) g.add(place(cyl(r + 0.012, r + 0.012, 0.06, pipeMat, 12), 20.305, y, z));
      g.add(place(cyl(r + 0.012, r + 0.012, 0.06, pipeMat, 12), 20.976, 2.25, z));
      dirtAlong(20.305, 1.0, z, 20.305, 2.9, z);
      dirtAlong(20.976, 2.0, z, 20.976, 2.9, z);
    }
    // small black box with a light and a round camera high on the north wall, right of the
    // drains (DSC_0109, DSC_0111)
    g.add(place(box(0.11, 0.24, 0.1, materials.black), 22.75, 2.28, 1.79));
    g.add(place(box(0.04, 0.03, 0.04, materials.led), 22.77, 2.42, 1.8));
    g.add(place(new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), materials.black), 22.48, 2.22, 1.77));
    // the pale pipe with collars above the projection, and the dark one along the top of the
    // north wall (DSC_0113; height and thickness from the 4 m wall's scale)
    const palePipe = new THREE.MeshStandardMaterial({ color: 0x3f3c37, roughness: 0.65 });
    // the pipe over the projection is white paint; the projector lights it (DSC_0113–0114)
    const endPipe = new THREE.MeshStandardMaterial({ color: 0x8e8a83, roughness: 0.6 });
    const along = (r, len, mat, x, y, z) => {
      const m = cyl(r, r, len, mat, 14);
      m.rotation.x = Math.PI / 2;
      return place(m, x, y, z);
    };
    g.add(along(0.085, 3.75, endPipe, 25.295, 2.58, 3.725));
    dirtAlong(25.295, 2.58, 1.85, 25.295, 2.58, 5.6);
    for (const z of [2.43, 3.43, 4.46, 5.54]) g.add(along(0.1, 0.1, endPipe, 25.295, 2.58, z));
    // its branch near the north corner, slanting up and then straight into the ceiling
    g.add(rod(endPipe, new THREE.Vector3(25.295, 2.58, 2.62), new THREE.Vector3(25.295, 2.76, 2.42), 0.075, 12));
    g.add(rod(endPipe, new THREE.Vector3(25.295, 2.74, 2.42), new THREE.Vector3(25.295, 2.92, 2.42), 0.075, 12));

    // the dark conduit along the middle of the ceiling with four LED floodlights on it, the
    // projector hanging at its west end (DSC_0111, DSC_0113, DSC_0114)
    {
      const x0 = 17.48;
      const x1 = 23.9;
      g.add(slab(materials.black, x0, x1, 2.665, 2.72, 3.69, 3.76));
      const lampFace = new THREE.MeshStandardMaterial({ color: 0x9a9b9e, roughness: 0.4, metalness: 0.3 });
      for (const [x, tilt, side] of [[19.1, 0.7, 1], [20.4, 0.55, -1], [21.75, 0.7, 1], [23.0, 0.6, -1]]) {
        const f = new THREE.Group();
        f.add(place(box(0.13, 0.035, 0.11, materials.black), 0, 0, 0));
        f.add(place(box(0.11, 0.004, 0.09, lampFace), 0, -0.019, 0));
        f.add(place(box(0.02, 0.06, 0.02, materials.black), 0, 0.04, 0));
        f.rotation.z = tilt; // tipped towards the end wall
        f.rotation.x = side * 0.25;
        g.add(place(f, x, 2.6, 3.725 + side * 0.03));
      }
    }
    // (the big one is painted white like the walls and runs the whole room, as in the lit
    // photo of the empty room)
    const top = cyl(0.1, 0.1, 9.5, palePipe, 12);
    top.rotation.z = Math.PI / 2;
    g.add(place(top, 20.65, 2.56, 1.84));
    for (const x of [17.2, 19.6, 22.0, 24.4]) {
      const c = cyl(0.115, 0.115, 0.09, palePipe, 12);
      c.rotation.z = Math.PI / 2;
      g.add(place(c, x, 2.56, 1.84));
    }
    dirtAlong(15.9, 2.56, 1.84, 25.4, 2.56, 1.84);
    // a whitewashed radiator standing on the concrete ledge by the entrance
    radiator(17.1, 1.79, 0, 0.96, 0.55, 0.46, palePipe);

    // gas meter by the partition (DSC_0098–0101)
    g.add(place(box(0.22, 0.3, 0.16, materials.white), 16.427, 1.62, 1.816));
    g.add(place(cyl(0.025, 0.025, 0.12, new THREE.MeshStandardMaterial({ color: 0xe6c21e, roughness: 0.5 }), 8), 16.427, 1.83, 1.816));
    g.add(place(cyl(0.018, 0.018, 1.45, pipeMat, 8), 16.331, 0.72, 1.787));
    dirtAlong(16.331, 0, 1.787, 16.331, 1.45, 1.787);

    // curtain bunched at the south side of the opening between Room 3 and Room 4
    const cg = new THREE.PlaneGeometry(0.55, 2.42, 18, 1);
    const pos = cg.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 46) * 0.045);
    cg.computeVertexNormals();
    const curtain = new THREE.Mesh(cg, materials.curtain);
    g.add(place(curtain, 15.986, 1.22, 4.362, Math.PI / 2));
    obstacle(15.929, 16.063, 4.077, 4.666);
  }

  // ================================================================ track lights
  {
    const rails = [
      { x0: R1.west + 0.6, x1: R1.east - 0.45, z: 2.9, y: 3.0 },
      { x0: R1.west + 0.6, x1: R1.east - 0.45, z: R1.D * 0.74, y: 3.0 },
      { x0: 10.45, x1: 15.25, z: 3.725, y: 2.75 },
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
