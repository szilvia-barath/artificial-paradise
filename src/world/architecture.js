import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BLOCKS, FLOORS, CEILINGS, STAIRWELL, ROOMS } from './layout.js';

// Builds the basement from the solid wall blocks, floors and ceilings in layout.js,
// plus Room 4's brick vaults and the stair shaft. UVs are world metres (u along the
// wall, v = height), so brick courses line up across every wall and doorway.
// Geometry is merged per material to keep draw calls low.
// Returns { group, segments } where segments are 2D collision lines [[x,z],[x,z]].

export function buildArchitecture(materials) {
  const group = new THREE.Group();
  group.name = 'architecture';
  const buckets = new Map(); // material key -> geometries[]
  const segments = [];

  const push = (key, geo) => {
    if (!materials[key]) throw new Error(`Unknown material ${key}`);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(geo);
  };

  // Vertical quad on an axis-aligned wall plane. `face` is the direction it looks.
  const wallQuad = (key, face, at, a0, a1, y0, y1) => {
    if (a1 - a0 < 1e-3 || y1 - y0 < 1e-3) return;
    const geo = new THREE.PlaneGeometry(a1 - a0, y1 - y0);
    const uv = geo.attributes.uv;
    // u runs left -> right as seen from the front
    const flipU = face === '-z' || face === '+x';
    for (let i = 0; i < uv.count; i++) {
      const s = uv.getX(i);
      const u = flipU ? a1 - s * (a1 - a0) : a0 + s * (a1 - a0);
      uv.setXY(i, u, y0 + uv.getY(i) * (y1 - y0));
    }
    const mid = (a0 + a1) / 2;
    const ym = (y0 + y1) / 2;
    if (face === '+z') geo.translate(mid, ym, at);
    else if (face === '-z') { geo.rotateY(Math.PI); geo.translate(mid, ym, at); }
    else if (face === '+x') { geo.rotateY(Math.PI / 2); geo.translate(at, ym, mid); }
    else if (face === '-x') { geo.rotateY(-Math.PI / 2); geo.translate(at, ym, mid); }
    push(key, geo);
  };

  // Horizontal rectangle (floor faces up, ceiling faces down), optional rectangular hole.
  const flat = (key, r, y, up, hole) => {
    const shape = new THREE.Shape();
    shape.moveTo(r.x0, r.z0);
    shape.lineTo(r.x1, r.z0);
    shape.lineTo(r.x1, r.z1);
    shape.lineTo(r.x0, r.z1);
    shape.lineTo(r.x0, r.z0);
    if (hole) {
      const h = new THREE.Path();
      h.moveTo(hole.x0, hole.z0);
      h.lineTo(hole.x0, hole.z1);
      h.lineTo(hole.x1, hole.z1);
      h.lineTo(hole.x1, hole.z0);
      h.lineTo(hole.x0, hole.z0);
      shape.holes.push(h);
    }
    const geo = new THREE.ShapeGeometry(shape);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i), y, pos.getY(i));
    // shape (x, y) -> world (x, z) flips the winding: the face now looks down
    if (up) geo.index.array.reverse();
    geo.computeVertexNormals();
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i), pos.getZ(i));
    push(key, geo);
  };

  // ---------------------------------------------------------------- wall blocks
  for (const b of BLOCKS) {
    const y0 = b.y0 ?? 0;
    const y1 = b.y1;
    const f = b.faces || {};
    wallQuad(f.px || b.mat, '+x', b.x1, b.z0, b.z1, y0, y1);
    wallQuad(f.nx || b.mat, '-x', b.x0, b.z0, b.z1, y0, y1);
    wallQuad(f.pz || b.mat, '+z', b.z1, b.x0, b.x1, y0, y1);
    wallQuad(f.nz || b.mat, '-z', b.z0, b.x0, b.x1, y0, y1);
    if (y0 > 0.01) {
      // underside of a lintel / header
      const geo = new THREE.PlaneGeometry(b.x1 - b.x0, b.z1 - b.z0);
      geo.rotateX(Math.PI / 2);
      geo.translate((b.x0 + b.x1) / 2, y0, (b.z0 + b.z1) / 2);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, b.x0 + uv.getX(i) * (b.x1 - b.x0), b.z0 + uv.getY(i) * (b.z1 - b.z0));
      push(b.reveal || b.mat, geo);
    }
    if (y1 < 2) {
      // top of a half wall (counters get their own slab in props.js)
      flat(b.mat, b, y1, true);
    }
    if (y0 < 1.2) {
      segments.push([[b.x0, b.z0], [b.x1, b.z0]]);
      segments.push([[b.x1, b.z0], [b.x1, b.z1]]);
      segments.push([[b.x1, b.z1], [b.x0, b.z1]]);
      segments.push([[b.x0, b.z1], [b.x0, b.z0]]);
    }
  }

  // ---------------------------------------------------------------- floors, ceilings
  for (const fl of FLOORS) flat(fl.mat, fl, fl.y ?? 0, true);
  for (const c of CEILINGS) flat(c.mat, c, c.y, false, c.hole);

  // Room 4: shallow brick vaults between steel beams, as in DSC_0110–0116
  {
    const r = ROOMS.find((rm) => rm.id === 'r4');
    const spring = 2.75;
    const rise = 0.14;
    const bays = 8;
    const L = (r.x1 - r.x0) / bays;
    const segs = 10;
    for (let i = 0; i < bays; i++) {
      const bx0 = r.x0 + i * L;
      // A strip of quads following the arc y(t) across the bay, extruded along z.
      const pos = [];
      const uvs = [];
      const idx = [];
      for (let k = 0; k <= segs; k++) {
        const t = k / segs;
        const x = bx0 + t * L;
        const y = spring + rise * Math.sin(Math.PI * t);
        pos.push(x, y, r.z0, x, y, r.z1);
        uvs.push(x, r.z0, x, r.z1);
        if (k < segs) {
          const a = k * 2;
          idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); // faces down
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      push('vault', geo);
    }
    // beams (bottom flange + web) spanning north–south
    for (let i = 0; i <= bays; i++) {
      const x = r.x0 + i * L;
      const beam = new THREE.BoxGeometry(0.16, 0.2, r.z1 - r.z0);
      beam.translate(x, spring + 0.07, (r.z0 + r.z1) / 2);
      push('beam', beam);
    }
  }

  // ---------------------------------------------------------------- stair shaft
  // The flight climbs west through Room 1's wall into a dark shaft lit from the street.
  {
    const s = STAIRWELL;
    const top = 5.6;
    const west = -2.3;
    wallQuad('shaft', '+z', s.z0, west, s.x1, 3.0, top);
    wallQuad('shaft', '+z', s.z0, west, -0.4, 0, 3.0);
    wallQuad('shaft', '-z', s.z1, west, s.x1, 3.0, top);
    wallQuad('shaft', '-z', s.z1, west, -0.4, 0, 3.0);
    wallQuad('shaft', '-x', s.x1, s.z0, s.z1, 3.0, top);
    wallQuad('shaft', '+x', west, s.z0, s.z1, 0, top);
    flat('darkCeiling', { x0: west, x1: s.x1, z0: s.z0, z1: s.z1 }, top, false);
    flat('darkFloor', { x0: west, x1: -0.4, z0: s.z0, z1: s.z1 }, 0, true);
  }

  for (const [key, geos] of buckets) {
    const merged = mergeGeometries(geos, false);
    const mesh = new THREE.Mesh(merged, materials[key]);
    mesh.name = `arch:${key}`;
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
  }

  return { group, segments, stairwell: STAIRWELL };
}
