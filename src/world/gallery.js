import * as THREE from 'three';
import { wallFrame, ROOMS } from './layout.js';

// Hangs the works from exhibition.json: prints as thin mounted panels, videos as
// glowing flat screens (with a subtle scanline/glitch shader), installations and the
// installations as clickable volumes. Fake spotlights = additive light pools on the wall.
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
  g.font = '600 20px Helvetica, Arial, sans-serif';
  g.fillText(`${work.no} · KristofLab`, 16, 32);
  g.font = 'italic 19px Helvetica, Arial, sans-serif';
  const title = work.title.replace(' (screen)', '');
  g.fillText(title.length > 24 ? `${title.slice(0, 23)}…` : title, 16, 60);
  g.font = '14px Helvetica, Arial, sans-serif';
  g.fillStyle = '#555';
  g.fillText([work.medium.split(':')[0].split(',')[0], work.size, work.year].filter(Boolean).join(', ').slice(0, 34), 16, 88);
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
  uniform float brightness;
  varying vec2 vUv;
  void main() {
    // The frames are shown as photographed; only a slow crossfade between them.
    vec3 col = mix(texture2D(map, vUv).rgb, texture2D(mapB, vUv).rgb, mixB);
    // faint LCD falloff at the panel edges
    vec2 d = abs(vUv - 0.5) * 2.0;
    col *= 1.0 - 0.1 * pow(max(d.x, d.y), 8.0);
    gl_FragColor = vec4(col * brightness, 1.0);
    #include <colorspace_fragment>
  }
`;

// Clickable volumes for the installations: [cx, cy, cz, sx, sy, sz]
const HIT_BOXES = {
  'w03-paradise-factory': [
    [1.85, 1.3, 3.35, 0.9, 2.6, 0.9], // plant, tank and LED bars
    [1.27, 1.1, 3.35, 0.35, 0.6, 2.45], // hydroponic pipe
  ],
  'w16-let-it-flow': [
    [25.6, 1.2, 3.83, 0.12, 2.4, 4.2], // projection on the end wall
    [22.6, 0.12, 3.6, 6.2, 0.24, 2.4], // plastic river
  ],
};

function wrapText(g, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  for (const wd of words) {
    const test = line ? `${line} ${wd}` : wd;
    if (g.measureText(test).width > maxW) { g.fillText(line, x, y); y += lh; line = wd; } else line = test;
  }
  if (line) { g.fillText(line, x, y); y += lh; }
  return y;
}

function textSheetCanvas(data) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 724;
  const g = c.getContext('2d');
  g.fillStyle = '#fbfaf7';
  g.fillRect(0, 0, 512, 724);
  g.fillStyle = '#111';
  g.font = '300 40px Helvetica, Arial, sans-serif';
  g.fillText('ARTIFICIAL', 36, 78);
  g.fillText('PARADISE', 36, 122);
  g.font = '15px Helvetica, Arial, sans-serif';
  g.fillStyle = '#444';
  g.fillText('KristofLab · MAMŰ Gallery · 10–31.01.2025', 36, 160);
  g.fillStyle = '#222';
  g.font = '14px Helvetica, Arial, sans-serif';
  let y = 200;
  for (const p of data.text) y = wrapText(g, p, 36, y, 440, 19) + 10;
  g.fillStyle = '#666';
  g.font = 'italic 13px Helvetica, Arial, sans-serif';
  wrapText(g, data.textCredit, 36, y + 4, 440, 17);
  return c;
}

// The sheet on the wall by the bar: the plan with numbered spots and the works list.
function roomSheetCanvas(data) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 724;
  const g = c.getContext('2d');
  g.fillStyle = '#f7f6f2';
  g.fillRect(0, 0, 512, 724);
  g.fillStyle = '#222';
  g.font = '22px "Courier New", monospace';
  g.fillText('|Artificial Paradise|KristofLab|', 28, 52);
  // plan
  const ox = 30;
  const oy = 80;
  const s = 17;
  g.strokeStyle = '#333';
  g.lineWidth = 2;
  for (const r of ROOMS) g.strokeRect(ox + r.x0 * s, oy + r.z0 * s, (r.x1 - r.x0) * s, (r.z1 - r.z0) * s);
  g.font = 'bold 11px Helvetica, Arial, sans-serif';
  g.fillStyle = '#111';
  for (const w of data.works) {
    const p = w.hang ? { x: w.hang.face.includes('x') ? w.hang.at : w.hang.along, z: w.hang.face.includes('z') ? w.hang.at : w.hang.along } : w.anchor;
    if (!p || w.id.endsWith('-screen')) continue;
    g.fillText(String(w.no), ox + p.x * s - 4, oy + p.z * s + 4);
  }
  // list
  g.font = '12.5px Helvetica, Arial, sans-serif';
  g.fillStyle = '#222';
  let y = oy + 7.6 * s + 30;
  for (const w of data.works) {
    if (w.id.endsWith('-screen')) continue;
    const bits = [w.title, w.size, w.medium.split(':')[0].split(',')[0], w.year].filter(Boolean);
    g.fillText(`${w.no} · ${bits.join(', ')}`, 28, y);
    y += 21;
  }
  return c;
}

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
    if (work.hang) {
      const hg = work.hang;
      const f = wallFrame(hg.face, hg.at, hg.along);
      const w = hg.w;
      const h = hg.h;
      const holder = new THREE.Group();
      holder.position.set(f.x, hg.y, f.z);
      holder.rotation.y = f.rotY;
      holder.userData.work = work;
      const isScreen = work.type === 'video';

      // light pool (fake spotlight wash) — additive, so it brightens the brick behind
      const pool = new THREE.Mesh(
        new THREE.PlaneGeometry(w * 2.0 + 0.6, h * 1.7 + 0.8),
        new THREE.MeshBasicMaterial({
          map: poolTex,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          opacity: isScreen ? 0.0 : 0.26,
          color: isScreen ? 0xc8d8ee : 0xfff6e8,
          toneMapped: false,
        }),
      );
      pool.position.set(0, 0.12, 0.004);
      pool.renderOrder = 1;
      holder.add(pool);

      if (isScreen) {
        // slim-bezel flat screen
        const bez = new THREE.Mesh(new THREE.BoxGeometry(w + 0.024, h + 0.024, 0.04), bezelMat);
        bez.position.z = 0.022;
        holder.add(bez);
        const mat = new THREE.ShaderMaterial({
          uniforms: {
            map: { value: null },
            mapB: { value: null },
            mixB: { value: 0 },
            brightness: { value: 1.1 },
          },
          vertexShader: screenVert,
          fragmentShader: screenFrag,
        });
        const screen = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
        screen.position.z = 0.0425;
        screen.userData.work = work;
        holder.add(screen);
        hitMeshes.push(screen);
        // screen glow on the wall
        pool.material.opacity = work.room === 'r4' ? 0.035 : 0.08;
        const frames = work.frames && work.frames.length ? work.frames : [work.image];
        const entry = { work, mat, frames, textures: [], idx: 0, t: Math.random() * 6 };
        screens.push(entry);
        frames.forEach((fr, i) => {
          loader.load(url(`${fr}-thumb.webp`), (t) => {
            entry.textures[i] = prepTex(t);
            if (i === 0) { mat.uniforms.map.value = t; mat.uniforms.mapB.value = t; }
          });
        });
        lazy.push({ work, entry, pos: new THREE.Vector3(f.x, hg.y, f.z), loaded: false });
      } else {
        // Canvas on a stretcher (paintings) or a thin mounted print
        const depth = work.type === 'painting' ? 0.035 : 0.012;
        const front = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, metalness: 0, emissive: 0xffffff, emissiveIntensity: 0.16 });
        const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), sideMat);
        body.position.z = depth / 2;
        holder.add(body);
        const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), front);
        panel.position.z = depth + 0.0005;
        panel.userData.work = work;
        holder.add(panel);
        hitMeshes.push(panel);
        // soft contact shadow
        const sh = new THREE.Mesh(
          new THREE.PlaneGeometry(w * 1.1 + 0.06, h * 1.08 + 0.08),
          new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.5 }),
        );
        sh.position.set(0.015, -0.03, 0.002);
        holder.add(sh);
        loader.load(url(`${work.image}-thumb.webp`), (t) => {
          prepTex(t);
          front.map = t;
          front.emissiveMap = t;
          front.needsUpdate = true;
        });
        lazy.push({ work, front, pos: new THREE.Vector3(f.x, hg.y, f.z), loaded: false });
      }

      // Wall label beside the work, at the usual 1.35 m
      if (hg.label !== 'none') {
        const label = new THREE.Mesh(
          new THREE.PlaneGeometry(0.16, 0.08),
          new THREE.MeshStandardMaterial({ map: labelTexture(work), roughness: 0.8, emissive: 0xffffff, emissiveIntensity: 0.15 }),
        );
        label.material.emissiveMap = label.material.map;
        const side = hg.label === 'left' ? -1 : 1;
        label.position.set(side * (w / 2 + 0.2), 1.35 - hg.y, 0.004);
        label.userData.work = work;
        holder.add(label);
        hitMeshes.push(label);
      }

      group.add(holder);
      const back = Math.max(1.5, Math.max(w, h) * 1.35);
      work._pin = { x: f.x, z: f.z };
      work._focus = work.view
        ? { x: work.view.x, z: work.view.z, look: [f.x, hg.y, f.z] }
        : { x: f.x + f.nx * back, z: f.z + f.nz * back, look: [f.x, hg.y, f.z] };
    } else if (work.anchor) {
      // Installations: invisible but clickable volumes around the real objects
      const a = work.anchor;
      for (const [cx, cy, cz, sx, sy, sz] of HIT_BOXES[work.id] || [[a.x, a.y, a.z, 1, 2, 1]]) {
        const hit = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), new THREE.MeshBasicMaterial({ visible: false }));
        hit.position.set(cx, cy, cz);
        hit.userData.work = work;
        group.add(hit);
        hitMeshes.push(hit);
      }
      work._pin = { x: a.x, z: a.z };
      work._focus = { x: work.view.x, z: work.view.z, look: [a.x, a.y, a.z] };
    }
  }

  // Exhibition texts and the room sheet (works list + plan), pinned up as in the photos
  for (const sh of data.sheets || []) {
    const c = sh.kind === 'roomsheet' ? roomSheetCanvas(data) : textSheetCanvas(data);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = aniso;
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(0.3, 0.42),
      new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.18 }),
    );
    const f = wallFrame(sh.face, sh.at, sh.along, 0.006);
    panel.position.set(f.x, sh.y, f.z);
    panel.rotation.y = f.rotY;
    panel.userData.text = sh.kind;
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
  const update = (t, dt, camPos) => {
    upgradeTimer -= dt;
    if (upgradeTimer <= 0) { upgradeTimer = 0.5; upgrade(camPos); }
    for (const s of screens) {
      const u = s.mat.uniforms;
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
