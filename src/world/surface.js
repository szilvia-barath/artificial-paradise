import * as THREE from 'three';

// Shader variation for the tiled room surfaces, on top of their textures:
//  - anti-tiling: a slow noise picks one of eight offsets of the texture and blends between
//    neighbours (Quilez' "texture repetition" technique), so the same bricks don't line up
//    every metre. Offsets can be kept to whole courses or tiles (material.userData.surface);
//  - large, soft overlays by world position, which never repeat: a brightness drift, damp
//    rising from the floor with a tide line, dirt around and run down below the pipes, and
//    patchy whitewash (thick, flat coats and thin ones where the brick shows through).
// Patched into the materials together with the plan AO (ao.js), which supplies vAoPos.

const MAX_PIPES = 16;
// Pipe axes [ax, ay, az, bx, by, bz] in metres, registered by props.js where the pipes are built.
export const PIPES = [];
export const dirtAlong = (ax, ay, az, bx, by, bz) => PIPES.push([ax, ay, az, bx, by, bz]);

export function surfaceUniforms() {
  const a = [];
  const b = [];
  for (let i = 0; i < MAX_PIPES; i++) {
    const p = PIPES[i] || [0, -9, 0, 0, -9, 0];
    a.push(new THREE.Vector3(p[0], p[1], p[2]));
    b.push(new THREE.Vector3(p[3], p[4], p[5]));
  }
  return { pipeA: { value: a }, pipeB: { value: b }, pipeCount: { value: Math.min(PIPES.length, MAX_PIPES) } };
}

export const SURFACE_PARS = /* glsl */ `
uniform vec2 surfOffset;
uniform vec3 pipeA[${MAX_PIPES}];
uniform vec3 pipeB[${MAX_PIPES}];
uniform int pipeCount;
float sHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float sNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(sHash(i), sHash(i + vec2(1, 0)), f.x), mix(sHash(i + vec2(0, 1)), sHash(i + vec2(1, 1)), f.x), f.y);
}
float sFbm(vec2 p) {
  return (0.5 * sNoise(p) + 0.25 * sNoise(p * 2.03 + 17.1) + 0.125 * sNoise(p * 4.07 + 3.7) + 0.0625 * sNoise(p * 8.11 + 9.2)) / 0.9375;
}
vec2 sOffset(float i) {
  vec2 o = fract(sin(vec2(3.1, 7.7) * i + vec2(0.3, 1.7)) * vec2(43758.5, 22578.1));
  return mix(o, floor(o / max(surfOffset, 1e-4)) * surfOffset, step(1e-5, surfOffset));
}
vec4 antiTile(sampler2D s, vec2 uv) {
  vec2 dx = dFdx(uv);
  vec2 dy = dFdy(uv);
  float l = sNoise(uv * 0.43) * 8.0;
  float i = floor(l);
  float f = fract(l);
  vec4 a = textureGrad(s, uv + sOffset(i), dx, dy);
  vec4 b = textureGrad(s, uv + sOffset(i + 1.0), dx, dy);
  vec3 d = a.rgb - b.rgb;
  return mix(a, b, smoothstep(0.2, 0.8, f - 0.1 * (d.x + d.y + d.z)));
}
`;

// Replaces three's map_fragment; AO_KIND (0 floor, 1 wall, 2 ceiling) comes from ao.js.
export const SURFACE_FRAG = /* glsl */ `
#ifdef USE_MAP
  diffuseColor *= antiTile(map, vMapUv);
#endif
{
  vec3 wp = vAoPos;
  #if AO_KIND == 1
    vec2 sp = vec2(wp.x + wp.z, wp.y); // walls are axis-aligned: run along them, and up
  #else
    vec2 sp = wp.xz;
  #endif
  // soft drift in tone over a few metres
  diffuseColor.rgb *= 0.92 + 0.16 * sFbm(sp * 0.33 + 4.0);
  #if AO_KIND == 1
    #ifdef SURF_WASH
      // whitewash: thick coats hide the brick under the plain colour, thin ones let it show
      float wash = sFbm(sp * vec2(0.9, 1.3) + 11.0);
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuse, 0.55 * (1.0 - smoothstep(0.3, 0.45, wash)));
      diffuseColor.rgb *= mix(vec3(1.0), vec3(0.84, 0.79, 0.72), 0.75 * smoothstep(0.55, 0.72, wash));
    #endif
    // damp rising from the floor: uneven edge, darker and browner below, a tide line on it
    float edge = 0.16 + 0.42 * sFbm(vec2(sp.x * 0.75, 2.0)) + 0.05 * sNoise(vec2(sp.x * 6.0, 5.0));
    float damp = 1.0 - smoothstep(edge - 0.1, edge + 0.03, wp.y);
    damp *= 0.55 + 0.45 * sFbm(sp * 2.1 + 31.0);
    float tide = exp(-pow((wp.y - edge) / 0.022, 2.0));
    diffuseColor.rgb *= mix(vec3(1.0), vec3(0.72, 0.69, 0.63), damp) * (1.0 - 0.13 * tide);
    // dirt around the pipes, and run down the wall below them
    float dirt = 0.0;
    for (int i = 0; i < ${MAX_PIPES}; i++) {
      if (i >= pipeCount) break;
      vec3 a = pipeA[i];
      vec3 ab = pipeB[i] - a;
      float t = clamp(dot(wp - a, ab) / dot(ab, ab), 0.0, 1.0);
      vec3 c = a + ab * t;
      vec3 v = wp - c;
      float below = max(0.0, -v.y);
      float side = length(v.xz);
      float along = dot(c.xz, vec2(1.0));
      float halo = exp(-length(v) / 0.09);
      float run = exp(-below / 0.38) * step(0.001, below) * exp(-side / 0.12)
        * smoothstep(0.4, 0.8, sNoise(vec2(along * 11.0, wp.y * 1.6)));
      dirt = max(dirt, 0.7 * halo + 0.55 * run);
    }
    dirt = clamp(dirt, 0.0, 1.0) * (0.6 + 0.4 * sFbm(sp * 3.0 + 7.0));
    diffuseColor.rgb *= mix(vec3(1.0), vec3(0.58, 0.53, 0.46), dirt);
  #endif
}
`;

// Bump map lookups go through the same anti-tiling, so relief and colour stay together.
export const antiTileBump = (src) => src.replace(/texture2D\(\s*bumpMap,/g, 'antiTile(bumpMap,');
