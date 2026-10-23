import * as THREE from 'three';
import { ROOMS, OBSTACLES } from './layout.js';

// Baked ambient occlusion from the floor plan, the cheap way to ground the rooms without
// real-time shadows. One small texture over the plan holds, per point on the floor:
//   R: how open it is (darker towards walls and furniture),
//   G: the ceiling height of the room it belongs to.
// The material shaders read it by world position: floors and ceilings darken along the
// walls, walls darken towards the floor and the ceiling. One texture fetch per pixel.

const PX = 20; // texels per metre
const B = { x0: -3, z0: -1.2, x1: 27, z1: 8.4 };

function bake(segments) {
  const W = Math.round((B.x1 - B.x0) * PX);
  const H = Math.round((B.z1 - B.z0) * PX);
  const wall = new Float32Array(W * H).fill(9);
  const prop = new Float32Array(W * H).fill(9);
  const RANGE = 0.9; // beyond this the occlusion is negligible

  const stamp = (field, [[ax, az], [bx, bz]]) => {
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - RANGE - B.x0) * PX));
    const i1 = Math.min(W - 1, Math.ceil((Math.max(ax, bx) + RANGE - B.x0) * PX));
    const j0 = Math.max(0, Math.floor((Math.min(az, bz) - RANGE - B.z0) * PX));
    const j1 = Math.min(H - 1, Math.ceil((Math.max(az, bz) + RANGE - B.z0) * PX));
    const dx = bx - ax;
    const dz = bz - az;
    const l2 = dx * dx + dz * dz || 1e-9;
    for (let j = j0; j <= j1; j++) {
      const pz = B.z0 + (j + 0.5) / PX;
      for (let i = i0; i <= i1; i++) {
        const px = B.x0 + (i + 0.5) / PX;
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2));
        const d = Math.hypot(px - ax - dx * t, pz - az - dz * t);
        const k = j * W + i;
        if (d < field[k]) field[k] = d;
      }
    }
  };
  for (const s of segments) stamp(wall, s);
  for (const o of OBSTACLES) {
    for (const s of [
      [[o.x0, o.z0], [o.x1, o.z0]],
      [[o.x1, o.z0], [o.x1, o.z1]],
      [[o.x1, o.z1], [o.x0, o.z1]],
      [[o.x0, o.z1], [o.x0, o.z0]],
    ]) stamp(prop, s);
  }

  const data = new Uint8Array(W * H * 4);
  for (let j = 0; j < H; j++) {
    const pz = B.z0 + (j + 0.5) / PX;
    for (let i = 0; i < W; i++) {
      const px = B.x0 + (i + 0.5) / PX;
      const k = j * W + i;
      const open = (1 - 0.5 * Math.exp(-wall[k] / 0.2)) * (1 - 0.32 * Math.exp(-prop[k] / 0.16));
      // ceiling of the nearest room (so wall faces between rooms get a sensible value)
      let ceil = 3;
      let best = Infinity;
      for (const r of ROOMS) {
        const d = Math.hypot(Math.max(r.x0 - px, 0, px - r.x1), Math.max(r.z0 - pz, 0, pz - r.z1));
        if (d < best) { best = d; ceil = r.ceiling; }
      }
      data[k * 4] = Math.round(open * 255);
      data[k * 4 + 1] = Math.round((ceil / 4) * 255);
      data[k * 4 + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

const KIND = { floor: 0, wall: 1, ceiling: 2 };

const FRAG = /* glsl */ `
  vec4 aoS = texture2D(aoPlan, (vAoPos.xz - aoBounds.xy) * aoBounds.zw);
  #if AO_KIND == 0
    float aoK = aoS.r;
  #elif AO_KIND == 1
    float aoCeil = aoS.g * 4.0;
    float aoK = mix(0.66, 1.0, smoothstep(0.0, 0.55, vAoPos.y)) * mix(0.8, 1.0, smoothstep(0.0, 0.4, aoCeil - vAoPos.y));
  #else
    float aoK = mix(1.0, aoS.r, 0.75);
  #endif
  diffuseColor.rgb *= aoK;
`;

function patch(material, kind, uniforms) {
  material.defines = { ...material.defines, AO_KIND: KIND[kind] };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vAoPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvAoPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vAoPos;\nuniform sampler2D aoPlan;\nuniform vec4 aoBounds;')
      .replace('#include <map_fragment>', `#include <map_fragment>\n${FRAG}`);
  };
}

// Bake once the walls and furniture exist, then patch the room materials.
export function applyPlanAO(materials, segments) {
  const uniforms = {
    aoPlan: { value: bake(segments) },
    aoBounds: { value: new THREE.Vector4(B.x0, B.z0, 1 / (B.x1 - B.x0), 1 / (B.z1 - B.z0)) },
  };
  const groups = {
    floor: ['floor', 'floorDark'],
    wall: ['whiteBrick', 'warmBrick', 'greyBrick', 'greyBrickShade', 'darkBrick', 'dimBrick', 'projWall', 'plaster'],
    ceiling: ['ceiling', 'planks'],
  };
  for (const [kind, keys] of Object.entries(groups)) for (const key of keys) patch(materials[key], kind, uniforms);
}
