import * as THREE from 'three';
import { wallFrame } from './layout.js';
import sizes from '../data/images.json';

// Hangs the works from exhibition.json: prints as thin mounted panels, videos as
// glowing flat screens (with a subtle scanline/glitch shader), installations and the
// projection as clickable anchors. Fake spotlights = additive light pools on the wall.
// Textures load lazily: 512px thumbs first, 1024px versions once you get close.

const BASE = import.meta.env.BASE_URL;
const url = (p) => `${BASE}${p}`;

function radialTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size * 0.42, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, inner);
  grd.addColorStop(0.45, inner.replace(/[\d.]+\)$/, '0.45)'));
  grd.addColorStop(1, outer);
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function labelTexture(work) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#f7f6f2';
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#111';
  g.font = '600 22px Helvetica, Arial, sans-serif';
  g.fillText('KristofLab', 16, 34);
  g.font = 'italic 20px Helvetica, Arial, sans-serif';
  g.fillText(work.title.length > 22 ? `${work.title.slice(0, 21)}…` : work.title, 16, 62);
  g.font = '15px Helvetica, Arial, sans-serif';
  g.fillStyle = '#555';
  g.fillText(`${work.medium.split(',')[0].slice(0, 26)}, ${work.year}`, 16, 90);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const screenVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const screenFrag = /* glsl */ `
  uniform sampler2D map;
  uniform sampler2D mapB;
  uniform float mixB;
  uniform float time;
  uniform float seed;
  uniform float glitch;
  uniform float brightness;
  varying vec2 vUv;
  float hash(float n) { return fract(sin(n) * 43758.5453); }
  void main() {
    vec2 uv = vUv;
    // slow drift, like a camera move in the footage
    vec2 drift = vec2(sin(time * 0.05 + seed) * 0.012, cos(time * 0.04 + seed * 2.0) * 0.01);
    uv = (uv - 0.5) * 0.96 + 0.5 + drift;
    // occasional horizontal slice glitch
    float slice = floor(uv.y * 24.0);
    float g = step(0.985 - glitch * 0.25, hash(slice + floor(time * 9.0) + seed * 13.0));
    uv.x += g * (hash(slice * 3.1 + time) - 0.5) * 0.08;
    vec3 a = texture2D(map, uv).rgb;
    vec3 b = texture2D(mapB, uv).rgb;
    vec3 col = mix(a, b, mixB);
    // RGB split on glitched slices
    col.r = mix(col.r, texture2D(map, uv + vec2(0.006, 0.0)).r, g);
    // scanlines + LCD flicker
    col *= 0.92 + 0.08 * sin(vUv.y * 900.0);
    col *= 0.97 + 0.03 * sin(time * 50.0 + seed);
    // vignette of the panel
    vec2 d = abs(vUv - 0.5) * 2.0;
    col *= 1.0 - 0.18 * pow(max(d.x, d.y), 6.0);
    gl_FragColor = vec4(col * brightness, 1.0);
    #include <colorspace_fragment>
  }
`;

export function buildGallery(data, materials, manager, renderer) {
  const group = new THREE.Group();
  group.name = 'gallery';
  const hitMeshes = [];
  const screens = [];
  const lazy = []; // { work, material(s), loaded, pos }
  const loader = new THREE.TextureLoader(manager);
  const lazyLoader = new THREE.TextureLoader();
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const poolTex = radialTexture('rgba(255,250,240,1)');
  const shadowTex = radialTexture('rgba(0,0,0,0.85)', 'rgba(0,0,0,0)');
  const sideMat = new THREE.MeshStandardMaterial({ color: 0xf4f3ef, roughness: 0.6 });
  const bezelMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0b, roughness: 0.35, metalness: 0.4 });

  const prepTex = (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = aniso;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  };

  for (const work of data.works) {
    const size = sizes[work.id] || [1600, 1200];
    const aspect = size[0] / size[1];

    if (work.hang) {
      const f = wallFrame(work.room, work.hang.wall, work.hang.along);
      const w = work.hang.width;
      const h = w / aspect;
      const holder = new THREE.Group();
      holder.position.set(f.x, work.hang.y, f.z);
      holder.rotation.y = f.rotY;
      holder.userData.work = work;
      const isScreen = work.type === 'video';

      // light pool (fake spotlight wash) — additive, so it brightens the brick behind
      const pool = new THREE.Mesh(
        new THREE.PlaneGeometry(w * 2.3 + 0.6, h * 2.0 + 0.8),
        new THREE.MeshBasicMaterial({
          map: poolTex,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          opacity: isScreen ? 0.0 : 0.32,
          color: isScreen ? 0x6fb6ff : 0xfff6e8,
          toneMapped: false,
        }),
      );
      pool.position.set(0, 0.18, 0.004);
      pool.renderOrder = 1;
      holder.add(pool);

      if (isScreen) {
        const bez = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, h + 0.04, 0.045), bezelMat);
        bez.position.z = 0.025;
        holder.add(bez);
        const mat = new THREE.ShaderMaterial({
          uniforms: {
            map: { value: null },
            mapB: { value: null },
            mixB: { value: 0 },
            time: { value: 0 },
            seed: { value: Math.random() * 10 },
            glitch: { value: 0 },
            brightness: { value: 1.15 },
          },
          vertexShader: screenVert,
          fragmentShader: screenFrag,
        });
        const screen = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
        screen.position.z = 0.0485;
        screen.userData.work = work;
        holder.add(screen);
        hitMeshes.push(screen);
        // screen glow on the wall
        pool.material.opacity = work.room === 'r3' ? 0.05 : 0.1;
        const frames = work.frames && work.frames.length ? work.frames : [work.image];
        const entry = { work, mat, frames, textures: [], idx: 0, t: Math.random() * 6 };
        screens.push(entry);
        frames.forEach((fr, i) => {
          loader.load(url(`${fr}-thumb.webp`), (t) => {
            entry.textures[i] = prepTex(t);
            if (i === 0) { mat.uniforms.map.value = t; mat.uniforms.mapB.value = t; }
          });
        });
        lazy.push({ work, entry, pos: new THREE.Vector3(f.x, work.hang.y, f.z), loaded: false });
      } else {
        // Mounted print: thin panel with white edges, artwork on the front face
        const front = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, metalness: 0, emissive: 0xffffff, emissiveIntensity: 0.18 });
        const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.025), sideMat);
        body.position.z = 0.0125;
        holder.add(body);
        const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), front);
        panel.position.z = 0.0252;
        panel.userData.work = work;
        holder.add(panel);
        hitMeshes.push(panel);
        // soft contact shadow
        const sh = new THREE.Mesh(
          new THREE.PlaneGeometry(w * 1.15 + 0.06, h * 1.12 + 0.08),
          new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.55 }),
        );
        sh.position.set(0.015, -0.03, 0.002);
        holder.add(sh);
        loader.load(url(`${work.image}-thumb.webp`), (t) => {
          prepTex(t);
          front.map = t;
          front.emissiveMap = t;
          front.needsUpdate = true;
        });
        lazy.push({ work, front, pos: new THREE.Vector3(f.x, work.hang.y, f.z), loaded: false });
      }

      // Wall label beside the work
      const label = new THREE.Mesh(
        new THREE.PlaneGeometry(0.16, 0.08),
        new THREE.MeshStandardMaterial({ map: labelTexture(work), roughness: 0.8, emissive: 0xffffff, emissiveIntensity: 0.15, emissiveMap: null }),
      );
      label.material.emissiveMap = label.material.map;
      label.position.set(w / 2 + 0.2, -0.32, 0.004);
      if (work.hang.wall === 'PW' || work.id === 'r3-print-4' || work.id === 'r2-video-3') label.position.x = -(w / 2 + 0.2);
      label.userData.work = work;
      holder.add(label);
      hitMeshes.push(label);

      group.add(holder);
      work._pin = { x: f.x, z: f.z };
      work._focus = { x: f.x + f.nx * Math.max(1.6, w * 1.5), z: f.z + f.nz * Math.max(1.6, w * 1.5), look: [f.x, work.hang.y, f.z] };
    } else if (work.anchor) {
      // Installation / projection: invisible but clickable volume
      const a = work.anchor;
      const s = work.type === 'projection' ? [0.2, 2.4, 4.2] : work.id === 'r3-river' ? [8.5, 0.25, 2.6] : [1.2, 1.8, 4.6];
      const hit = new THREE.Mesh(new THREE.BoxGeometry(...s), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.set(a.x, a.y, a.z);
      if (work.id === 'r1-hydroponics') hit.position.set(8.9, 1.3, 3.2);
      hit.userData.work = work;
      group.add(hit);
      hitMeshes.push(hit);
      work._pin = { x: a.x, z: a.z };
      work._focus = { x: work.view.x, z: work.view.z, look: [a.x, a.y, a.z] };
    }
  }

  // Exhibition text panel on Room 1's north wall, next to the doorway
  {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 720;
    const g = c.getContext('2d');
    g.fillStyle = '#fbfaf7';
    g.fillRect(0, 0, 512, 720);
    g.fillStyle = '#111';
    g.font = '300 44px Helvetica, Arial, sans-serif';
    g.fillText('ARTIFICIAL', 36, 82);
    g.fillText('PARADISE', 36, 130);
    g.font = '16px Helvetica, Arial, sans-serif';
    g.fillStyle = '#444';
    g.fillText('KristofLab · MAMŰ Gallery · 10–31.01.2025', 36, 170);
    g.fillStyle = '#222';
    g.font = '15px Helvetica, Arial, sans-serif';
    let y = 212;
    const wrap = (text) => {
      const words = text.split(' ');
      let line = '';
      for (const wd of words) {
        const test = line ? `${line} ${wd}` : wd;
        if (g.measureText(test).width > 440) { g.fillText(line, 36, y); y += 21; line = wd; } else line = test;
      }
      if (line) { g.fillText(line, 36, y); y += 30; }
    };
    data.text.forEach(wrap);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = aniso;
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 0.59),
      new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.2 }),
    );
    const f = wallFrame('r1', 'N', 4.6, 0.01);
    panel.position.set(f.x, 1.55, f.z);
    panel.rotation.y = f.rotY;
    panel.userData.text = true;
    group.add(panel);
    hitMeshes.push(panel);
  }

  // Progressive upgrade to 1024 px textures for works near the visitor.
  const upgrade = (camPos) => {
    for (const l of lazy) {
      if (l.loaded || l.pos.distanceTo(camPos) > 7.5) continue;
      l.loaded = true;
      if (l.front) {
        lazyLoader.load(url(`${l.work.image}-tex.webp`), (t) => {
          prepTex(t);
          const old = l.front.map;
          l.front.map = t;
          l.front.emissiveMap = t;
          l.front.needsUpdate = true;
          if (old) old.dispose();
        });
      } else if (l.entry) {
        l.entry.frames.forEach((fr, i) => {
          lazyLoader.load(url(`${fr}-tex.webp`), (t) => {
            prepTex(t);
            const old = l.entry.textures[i];
            l.entry.textures[i] = t;
            if (old) old.dispose();
          });
        });
      }
    }
  };

  let upgradeTimer = 0;
  const update = (t, dt, camPos, level = 0) => {
    upgradeTimer -= dt;
    if (upgradeTimer <= 0) { upgradeTimer = 0.5; upgrade(camPos); }
    for (const s of screens) {
      const u = s.mat.uniforms;
      u.time.value = t;
      u.glitch.value = level;
      if (s.frames.length > 1) {
        s.t += dt;
        const period = 7;
        const phase = s.t % period;
        const n = s.frames.length;
        const cur = Math.floor(s.t / period) % n;
        const next = (cur + 1) % n;
        u.map.value = s.textures[cur] || u.map.value;
        u.mapB.value = s.textures[next] || u.map.value;
        u.mixB.value = THREE.MathUtils.smoothstep(phase, period - 1.2, period);
      } else if (s.textures[0]) {
        u.map.value = s.textures[0];
        u.mapB.value = s.textures[0];
      }
    }
  };

  return { group, hitMeshes, update };
}
