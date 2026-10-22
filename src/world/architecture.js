import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ROOMS, WALLS, PARTITION, REVEALS, CEILING, roomById } from './layout.js';

// Builds the procedural basement: walls with doorways, reveals, partition, floor and
// ceiling. Geometry is merged per material to keep draw calls low.
// Returns { group, segments } where segments are 2D collision lines [[x,z],[x,z]].

const STAIRWELL = { x0: 6.4, x1: 10, z0: 5.75, z1: 7 };

export function buildArchitecture(materials) {
  const group = new THREE.Group();
  group.name = 'architecture';
  const buckets = new Map(); // material key -> geometries[]
  const segments = [];

  const push = (key, geo) => {
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(geo);
  };

  // A vertical quad from (x0,z0) to (x1,z1), y from y0 to y1, facing normal (nx,nz).
  // uOffset keeps brick courses continuous along a wall.
  const quad = (key, ax, az, bx, bz, y0, y1, nx, nz, uOffset = 0) => {
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 1e-3 || y1 - y0 < 1e-3) return;
    const geo = new THREE.PlaneGeometry(len, y1 - y0);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, uOffset + uv.getX(i) * len, y0 + uv.getY(i) * (y1 - y0));
    }
    const m = new THREE.Matrix4();
    const angle = Math.atan2(nx, nz);
    m.makeRotationY(angle);
    m.setPosition((ax + bx) / 2, (y0 + y1) / 2, (az + bz) / 2);
    geo.applyMatrix4(m);
    push(key, geo);
  };

  // Build one room wall, split by gaps (doorways) and material spans.
  const buildWall = (w) => {
    const r = roomById(w.room);
    let axis; // coordinate that varies along the wall
    let fixed;
    let nx = 0;
    let nz = 0;
    let lo;
    let hi;
    switch (w.face) {
      case 'N': axis = 'x'; fixed = r.z0; nz = 1; lo = r.x0; hi = r.x1; break;
      case 'S': axis = 'x'; fixed = r.z1; nz = -1; lo = r.x0; hi = r.x1; break;
      case 'W': axis = 'z'; fixed = r.x0; nx = 1; lo = r.z0; hi = r.z1; break;
      case 'E': axis = 'z'; fixed = r.x1; nx = -1; lo = r.z0; hi = r.z1; break;
    }
    const gaps = (w.gaps || []).slice().sort((a, b) => a.from - b.from);
    // Breakpoints for material spans
    const cuts = new Set([lo, hi]);
    for (const g of gaps) { cuts.add(g.from); cuts.add(g.to); }
    for (const s of w.spans || []) { cuts.add(Math.max(lo, s.from)); cuts.add(Math.min(hi, s.to)); }
    const pts = [...cuts].filter((v) => v >= lo && v <= hi).sort((a, b) => a - b);
    const P = (t) => (axis === 'x' ? [t, fixed] : [fixed, t]);
    for (let i = 0; i < pts.length - 1; i++) {
      const t0 = pts[i];
      const t1 = pts[i + 1];
      const mid = (t0 + t1) / 2;
      const span = (w.spans || []).find((s) => mid >= s.from && mid <= s.to);
      const key = span ? span.mat : w.mat;
      const gap = gaps.find((g) => mid > g.from && mid < g.to);
      // Plane orientation: the quad is built from a->b; we want its front to face (nx,nz).
      const [ax, az] = P(t0);
      const [bx, bz] = P(t1);
      if (gap) {
        quad(key, ax, az, bx, bz, gap.top, CEILING, nx, nz, t0);
      } else {
        quad(key, ax, az, bx, bz, 0, CEILING, nx, nz, t0);
        segments.push([[ax, az], [bx, bz]]);
      }
    }
  };

  WALLS.forEach(buildWall);

  // Doorway reveals: two jambs + soffit spanning the wall thickness.
  for (const rv of REVEALS) {
    if (rv.axis === 'z') {
      // wall lies along x, thickness in z
      quad(rv.mat, rv.from, rv.at0, rv.from, rv.at1, 0, rv.top, 1, 0);
      quad(rv.mat, rv.to, rv.at0, rv.to, rv.at1, 0, rv.top, -1, 0);
      segments.push([[rv.from, rv.at0], [rv.from, rv.at1]]);
      segments.push([[rv.to, rv.at0], [rv.to, rv.at1]]);
      const soffit = new THREE.PlaneGeometry(rv.to - rv.from, rv.at1 - rv.at0);
      soffit.rotateX(Math.PI / 2);
      soffit.translate((rv.from + rv.to) / 2, rv.top, (rv.at0 + rv.at1) / 2);
      push(rv.mat, soffit);
    } else {
      // wall lies along z, thickness in x
      quad(rv.mat, rv.at0, rv.from, rv.at1, rv.from, 0, rv.top, 0, 1);
      quad(rv.mat, rv.at0, rv.to, rv.at1, rv.to, 0, rv.top, 0, -1);
      segments.push([[rv.at0, rv.from], [rv.at1, rv.from]]);
      segments.push([[rv.at0, rv.to], [rv.at1, rv.to]]);
      const soffit = new THREE.PlaneGeometry(rv.at1 - rv.at0, rv.to - rv.from);
      soffit.rotateX(Math.PI / 2);
      soffit.translate((rv.at0 + rv.at1) / 2, rv.top, (rv.from + rv.to) / 2);
      push(rv.mat, soffit);
    }
  }

  // Partition wall in Room 3 (both faces + end cap facing the south wall is flush).
  {
    const p = PARTITION;
    const pieces = [[p.z0, p.gap.from], [p.gap.to, p.z1]];
    for (const [z0, z1] of pieces) {
      quad(p.matWest, p.x0, z0, p.x0, z1, 0, CEILING, -1, 0, z0);
      quad(p.matEast, p.x1, z0, p.x1, z1, 0, CEILING, 1, 0, z0);
      segments.push([[p.x0, z0], [p.x0, z1]]);
      segments.push([[p.x1, z0], [p.x1, z1]]);
    }
    quad(p.matWest, p.x0, p.gap.from, p.x0, p.gap.to, p.gap.top, CEILING, -1, 0);
    quad(p.matEast, p.x1, p.gap.from, p.x1, p.gap.to, p.gap.top, CEILING, 1, 0);
  }

  // Floor: one plane under everything.
  {
    const x0 = -0.5;
    const x1 = 26.5;
    const z0 = -5.5;
    const z1 = 7.5;
    const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (x1 - x0), uv.getY(i) * (z1 - z0));
    geo.rotateX(-Math.PI / 2);
    geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    push('floor', geo);
  }

  // Ceiling: per-room rectangles (plus doorway strips), Room 1 has the stairwell hole.
  {
    const ceilRect = (x0, x1, z0, z1, hole) => {
      const shape = new THREE.Shape();
      shape.moveTo(x0, z0);
      shape.lineTo(x1, z0);
      shape.lineTo(x1, z1);
      shape.lineTo(x0, z1);
      shape.lineTo(x0, z0);
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
      // Shape is in XY; map to XZ at ceiling height facing down.
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        pos.setXYZ(i, x, CEILING, y);
      }
      // Mapping shape (x, y) -> world (x, z) turns the +Z face normal into -Y: faces down.
      geo.computeVertexNormals();
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i), pos.getZ(i));
      push('ceiling', geo);
    };
    for (const r of ROOMS) ceilRect(r.x0, r.x1, r.z0, r.z1, r.id === 'r1' ? STAIRWELL : null);
  }

  // Stairwell shaft above the hole (dark walls going up to a cool "street" light).
  {
    const s = STAIRWELL;
    const top = CEILING + 2.4;
    quad('darkBrick', s.x0, s.z0, s.x1, s.z0, CEILING, top, 0, 1, s.x0);
    quad('darkBrick', s.x1, s.z0, s.x1, s.z1, CEILING, top, -1, 0, s.z0);
    quad('darkBrick', s.x0, s.z1, s.x0, s.z0, CEILING, top, 1, 0, s.z0);
    quad('whiteBrick', s.x0, s.z1, s.x1, s.z1, CEILING, top, 0, -1, s.x0);
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
