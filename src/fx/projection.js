import * as THREE from 'three';
import { CEILING } from '../world/layout.js';

// "Artificial Paradise (generative)": a live GLSL piece projected on the end wall of
// Room 3. It drifts between a NATURAL state (pale projected trees, domain-warped fbm
// canopy, like the forest projection at MAMŰ) and an ARTIFICIAL state (a quantised grid
// of synthetic leaves over tower-block silhouettes with lit windows). Cells dissolve
// between the two states one by one; audio bands drive scale, glitch and sparkle.

const vert = /* glsl */ `
  varying vec2 vUv;
  varying vec2 vWall;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWall = vec2(wp.z, wp.y);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const frag = /* glsl */ `
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uHigh;
  uniform float uLevel;
  uniform float uState;
  uniform float uGlitch;
  uniform float uAspect;
  uniform sampler2D uBrick;
  varying vec2 vUv;
  varying vec2 vWall;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float hash1(float n) { return fract(sin(n) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
    for (int i = 0; i < 5; i++) { v += a * noise(p); p = r * p * 2.03; a *= 0.5; }
    return v;
  }

  // ---------- natural: pale trees + canopy, projected light on a dark wall
  vec3 natural(vec2 uv, float t) {
    vec2 p = vec2(uv.x * uAspect, uv.y) * 2.2;
    vec2 w = vec2(fbm(p + vec2(0.0, t * 0.05)), fbm(p + vec2(5.2, -t * 0.04)));
    float f = fbm(p * 1.7 + w * 2.2 + vec2(t * 0.02, 0.0));
    float canopy = smoothstep(0.48, 0.78, f) * smoothstep(0.15, 0.65, uv.y);
    vec3 col = vec3(0.02, 0.035, 0.03);
    col += vec3(0.38, 0.62, 0.42) * canopy * (0.75 + 0.6 * uMid);
    col += vec3(0.85, 1.0, 0.7) * pow(canopy, 5.0) * 0.6;
    // trunks: wobbling pale lines with branches
    float trunks = 0.0;
    for (int i = 0; i < 5; i++) {
      float fi = float(i);
      float cx = 0.1 + fi * 0.2 + (hash1(fi * 7.1) - 0.5) * 0.08;
      float sway = (noise(vec2(uv.y * 3.0, fi * 3.0 + t * 0.15)) - 0.5) * 0.07 * uv.y;
      float wdt = mix(0.016, 0.005, uv.y) * (0.8 + hash1(fi) * 0.6);
      float d = abs(uv.x - cx - sway);
      trunks += smoothstep(wdt, wdt * 0.4, d) * smoothstep(0.92, 0.35, uv.y + hash1(fi * 3.3) * 0.1);
      // two branches
      for (int b = 0; b < 2; b++) {
        float fb = float(b);
        float y0 = 0.35 + hash1(fi * 11.0 + fb) * 0.3;
        float dir = fb < 0.5 ? -1.0 : 1.0;
        vec2 q = vec2(uv.x - cx - sway, uv.y - y0);
        float along = q.y;
        float bd = abs(q.x - dir * along * 0.9);
        trunks += smoothstep(0.004, 0.0015, bd) * step(0.0, along) * (1.0 - smoothstep(0.0, 0.2, along)) * 0.55;
      }
    }
    col = mix(col, vec3(0.78, 0.9, 0.82), clamp(trunks, 0.0, 1.0) * 0.85);
    return col;
  }

  // ---------- artificial: grid of synthetic leaves + tower blocks
  vec3 artificial(vec2 uv, float t) {
    float cells = 14.0 + floor(uBass * 4.0) * 2.0;
    vec2 g = vec2(uv.x * uAspect, uv.y) * cells;
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5;
    float h = hash(id + 0.37);
    float ang = h * 6.2831 + t * (h - 0.5) * 0.6;
    mat2 R = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
    vec2 q = R * f;
    float leaf = length(q * vec2(1.0, 2.3)) - (0.34 + 0.1 * uMid);
    float vein = smoothstep(0.03, 0.0, abs(q.y)) * step(leaf, 0.0);
    vec3 pal = mix(vec3(0.45, 1.0, 0.25), vec3(0.1, 0.95, 0.8), step(0.55, h));
    pal = mix(pal, vec3(1.0, 0.25, 0.62), step(0.9, h));
    float blink = 0.55 + 0.45 * sin(t * 1.7 + h * 40.0);
    vec3 col = vec3(0.01, 0.015, 0.03);
    col += pal * smoothstep(0.03, -0.03, leaf) * blink;
    col -= vein * 0.25;
    // the grid itself
    vec2 gl = smoothstep(0.47, 0.5, abs(f));
    col += vec3(0.1, 0.35, 0.3) * max(gl.x, gl.y) * 0.45;

    // tower-block skyline
    float bx = floor(uv.x * uAspect * 3.2);
    float bh = 0.22 + 0.4 * hash1(bx * 3.7);
    float inB = step(uv.y, bh) * step(0.08, fract(uv.x * uAspect * 3.2));
    vec2 wg = vec2(fract(uv.x * uAspect * 3.2) * 7.0, uv.y * 46.0);
    vec2 wid = floor(wg);
    float win = step(0.25, fract(wg.x)) * step(0.3, fract(wg.y));
    float lit = step(0.55 - uHigh * 0.4, hash(wid + bx + floor(t * 0.7)));
    vec3 bcol = vec3(0.04, 0.03, 0.06) + win * lit * vec3(1.0, 0.75, 0.45) * 0.9;
    bcol += vec3(0.9, 0.2, 0.55) * 0.12;
    col = mix(col, bcol, inB);
    return col;
  }

  void main() {
    vec2 uv = vUv;
    float t = uTime;

    // horizontal glitch bands (audio + state transitions)
    float band = floor(uv.y * 28.0);
    float on = step(1.0 - uGlitch * 0.6, hash(vec2(band, floor(t * 12.0))));
    uv.x += on * (hash(vec2(band * 1.7, floor(t * 20.0))) - 0.5) * 0.15;

    // per-cell dissolve between natural and artificial
    vec2 cell = floor(vec2(uv.x * uAspect, uv.y) * 9.0);
    float k = hash(cell + 3.1);
    float s = smoothstep(k - 0.08, k + 0.08, uState);

    vec3 nat = natural(uv, t);
    vec3 art = artificial(uv, t);
    vec3 col = mix(nat, art, s);

    // RGB tear on glitched bands
    col = mix(col, col.brg * vec3(1.2, 0.9, 1.3), on * 0.5);
    // projector falloff, flicker and scan
    vec2 d = (vUv - 0.5) * vec2(1.0, 1.2);
    col *= 1.0 - dot(d, d) * 0.9;
    col *= 0.94 + 0.06 * sin(t * 60.0) * uHigh;
    col *= 0.85 + 0.15 * smoothstep(0.0, 1.0, sin(vUv.y * 700.0) * 0.5 + 0.5);
    col *= 0.85 + uLevel * 0.6;
    // modulate by the brick wall the light lands on
    float brick = texture2D(uBrick, vWall).r;
    col *= 0.55 + 0.6 * brick;
    // edge mask (projector frame)
    vec2 e = smoothstep(0.0, 0.015, vUv) * smoothstep(0.0, 0.015, 1.0 - vUv);
    col *= e.x * e.y;
    gl_FragColor = vec4(col * 1.35, 1.0);
  }
`;

const beamVert = /* glsl */ `
  varying float vT;
  varying vec3 vPos;
  attribute float along;
  void main() {
    vT = along;
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const beamFrag = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uLevel;
  varying float vT;
  varying vec3 vPos;
  float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  void main() {
    // dust motes drifting in the beam
    vec3 p = floor(vPos * 110.0 + vec3(0.0, -uTime * 1.5, uTime * 0.8));
    float dust = step(0.9965, hash(p));
    float a = (0.016 + dust * 0.22) * smoothstep(0.0, 0.15, vT) * (1.0 - vT * 0.5) * (0.7 + uLevel);
    gl_FragColor = vec4(uColor * a, 1.0);
  }
`;

export function buildProjection(materials) {
  const W = 4.2;
  const H = W * 9 / 16;
  const cx = 25.97;
  const cy = 1.5;
  const cz = -2.8;
  const brick = materials.darkBrick.map;
  const uniforms = {
    uTime: { value: 0 },
    uBass: { value: 0 },
    uMid: { value: 0 },
    uHigh: { value: 0 },
    uLevel: { value: 0 },
    uState: { value: 0 },
    uGlitch: { value: 0 },
    uAspect: { value: W / H },
    uBrick: { value: brick },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat);
  plane.position.set(cx, cy, cz);
  plane.rotation.y = -Math.PI / 2;
  plane.renderOrder = 2;

  // Projector beam: a pyramid from the lens to the image corners
  const apex = new THREE.Vector3(18.4, CEILING - 0.42, -2.8);
  const corners = [
    new THREE.Vector3(cx, cy + H / 2, cz + W / 2),
    new THREE.Vector3(cx, cy + H / 2, cz - W / 2),
    new THREE.Vector3(cx, cy - H / 2, cz - W / 2),
    new THREE.Vector3(cx, cy - H / 2, cz + W / 2),
  ];
  const pos = [];
  const along = [];
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    pos.push(apex.x, apex.y, apex.z, a.x, a.y, a.z, b.x, b.y, b.z);
    along.push(0, 1, 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('along', new THREE.Float32BufferAttribute(along, 1));
  const beamUniforms = { uTime: uniforms.uTime, uColor: { value: new THREE.Color(0.6, 0.9, 0.75) }, uLevel: uniforms.uLevel };
  const beam = new THREE.Mesh(
    g,
    new THREE.ShaderMaterial({
      uniforms: beamUniforms,
      vertexShader: beamVert,
      fragmentShader: beamFrag,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
  );
  beam.frustumCulled = false;

  const group = new THREE.Group();
  group.add(plane, beam);

  // State machine: long natural/artificial phases, audio pushes it around.
  const tmpColor = new THREE.Color();
  const update = (t, dt, audio, projLight) => {
    uniforms.uTime.value = t;
    const lerp = (u, v, k) => u.value + (v - u.value) * Math.min(1, dt * k);
    uniforms.uBass.value = lerp(uniforms.uBass, audio.bass, 8);
    uniforms.uMid.value = lerp(uniforms.uMid, audio.mid, 8);
    uniforms.uHigh.value = lerp(uniforms.uHigh, audio.high, 10);
    uniforms.uLevel.value = lerp(uniforms.uLevel, audio.level, 6);
    const cycle = 0.5 + 0.5 * Math.sin(t * 0.11) + 0.25 * Math.sin(t * 0.31 + 1.3);
    uniforms.uState.value = window.__apState ?? THREE.MathUtils.clamp(cycle * 0.85 + audio.bass * 0.3 - 0.05, 0, 1);
    const transitioning = 1 - Math.abs(uniforms.uState.value - 0.5) * 2;
    uniforms.uGlitch.value = Math.min(1, transitioning * 0.5 + audio.glitch * 0.9 + audio.bass * 0.15);
    // Spill colour: green for natural, magenta/cyan for artificial
    const s = uniforms.uState.value;
    tmpColor.setRGB(0.35 + 0.5 * s, 0.75 - 0.35 * s, 0.5 + 0.25 * s);
    beamUniforms.uColor.value.copy(tmpColor);
    if (projLight) {
      projLight.color.copy(tmpColor);
      projLight.intensity = 2 + uniforms.uLevel.value * 4;
    }
  };

  return { group, update, plane };
}
