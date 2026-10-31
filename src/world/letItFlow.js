import * as THREE from 'three';
import RIVER from '../data/river.json';
import { OBSTACLES } from './layout.js';
import { createVideo } from './video.js';

// #16 Let it Flow (2024), Room 4, as in the documentation video and the installation photos.
// A nearly black room lit only by its projections. On the end wall the video Siluett, bright
// trees on the dark wall. On the floor a river of melted plastic, rebuilt from the artist's
// top-down photograph of it (PLANE copy.png, scaled by its 30 cm tiles and checked against
// DSC_0113 and the photos' EXIF focal length): one relief mesh, soft lumps and folds read
// from the photo (scripts/make_river.py). From above, the video Let it Flow (a night sky with
// the river glowing in it) is projected over the floor, turned so its river lies on the
// plastic; its specks are the dots on the floor in the photos. That projection is all that
// lights the plastic, so its folds are shaded here against the lamp.

const BASE = import.meta.env.BASE_URL;
const WALL_X = 25.4;
const Z0 = 1.73;
const Z1 = 5.73;
// Measured on DSC_0113 (the 4 m wall is 259 px/m): the picture stands on the floor, reaches
// 2.30 m, just under the pipe, and at 16:9 is 4.09 m wide, a little wider than the wall.
const TOP = 2.3;
const VIDEO_ASPECT = 16 / 9;
const WALL_GAIN = 1.3; // the file's trees are mid grey; a projector in the dark makes them bright
const WALL_TINT = new THREE.Color(0.88, 1, 1); // the lamp is cool in the photos
const FLOOR_TINT = new THREE.Color(1, 1.12, 1.32);
const FLOOR_PEAK = 0.34; // the black floor returns far less of the lamp than white plastic does
const LAMP = new THREE.Vector3(23.6, 2.8, 3.7); // over the river
const AMBIENT = 0.14; // the little room light the plastic gets besides the projection
const P = RIVER.projection;

// Shows a texture on the end wall without stretching it: it fills the wall's height and
// what is too wide for the wall falls off both sides, as with a projector.
function coverWall(tex, aspect) {
  const shown = (Z1 - Z0) / TOP / aspect;
  tex.repeat.x = shown;
  tex.offset.x = (1 - shown) / 2;
}

// floor projection frame (video turned 180°): u runs west from xEast, v runs north
const projUV = /* glsl */ `
  vec2 letItFlowUV(vec3 w) {
    return vec2((${P.xEast.toFixed(3)} - w.x) / ${P.lengthM.toFixed(3)},
                0.5 + (w.z - ${P.zCentre.toFixed(3)}) / ${P.widthM.toFixed(3)});
  }
`;

export function buildLetItFlow(manager) {
  const group = new THREE.Group();
  group.name = 'let-it-flow';
  const loader = new THREE.TextureLoader(manager);
  const srgb = (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };

  // ---------------------------------------------------------------- wall projection
  const wallVideo = createVideo('video/w16-projection.mp4', {
    pos: new THREE.Vector3(WALL_X, 1.2, (Z0 + Z1) / 2),
    sound: true,
    near: 4.5,
    work: 'w16-let-it-flow',
  });
  coverWall(wallVideo.tex, VIDEO_ASPECT);
  // The video's first frame stands in until it plays. Either is added as light over the wall
  // (a projector cannot darken), so the brick shows through.
  const projMat = new THREE.MeshBasicMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  loader.load(`${BASE}video/w16-projection.webp`, (t) => {
    coverWall(srgb(t), VIDEO_ASPECT);
    if (!projMat.map) {
      projMat.map = t;
      projMat.needsUpdate = true;
    }
  });
  const proj = new THREE.Mesh(new THREE.PlaneGeometry(Z1 - Z0, TOP), projMat);
  proj.rotation.y = -Math.PI / 2;
  proj.position.set(WALL_X - 0.005, TOP / 2, (Z0 + Z1) / 2);
  group.add(proj);

  // ---------------------------------------------------------------- floor projection
  const floorVideo = createVideo('video/w16-floor.mp4');
  // The frame is narrower than the room and scaled so that its river is the plastic's size,
  // so zooming it to the walls would pull the two apart. It stays put, and the strips
  // between its long edges and the side walls continue its specks in reflection.
  floorVideo.tex.wrapT = THREE.MirroredRepeatWrapping;
  const floorMat = new THREE.MeshBasicMaterial({
    color: FLOOR_TINT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    vertexColors: true,
    opacity: 0,
  });
  // Whatever the video's brightness, the dark floor only rises so far: the river of light
  // that misses the plastic stays as faint as the specks, as in the photos.
  floorMat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
      diffuseColor.rgb = ${FLOOR_PEAK.toFixed(2)} * (1.0 - exp(-diffuseColor.rgb / ${FLOOR_PEAK.toFixed(2)}));`,
    );
  };
  {
    // a plane from wall to wall, its UVs following letItFlowUV; on the dark floor the far
    // end of the frame would be a hard line, so the last metre fades out
    const x0 = P.xEast - P.lengthM;
    const zMid = (Z0 + Z1) / 2;
    const geo = new THREE.PlaneGeometry(P.lengthM, Z1 - Z0, 5, 1);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    const fade = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + x0 + P.lengthM / 2;
      const z = pos.getZ(i) + zMid;
      uv.setXY(i, (P.xEast - x) / P.lengthM, 0.5 + (z - P.zCentre) / P.widthM);
      fade.fill(x - x0 < 0.01 ? 0 : 1, i * 3, i * 3 + 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(fade, 3));
    const floorProj = new THREE.Mesh(geo, floorMat);
    floorProj.position.set(x0 + P.lengthM / 2, 0.004, zMid);
    floorProj.renderOrder = 2;
    group.add(floorProj);
  }

  // ---------------------------------------------------------------- the river
  const riverMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(AMBIENT, AMBIENT, AMBIENT),
    map: srgb(loader.load(`${BASE}tex/river.webp`)),
    normalMap: loader.load(`${BASE}tex/river-normal.webp`),
    normalScale: new THREE.Vector2(1, 1),
    roughness: 0.34,
    metalness: 0,
    alphaTest: 0.5,
  });
  const projUniform = { value: null };
  const projStrength = { value: 0 };
  // The floor projection lands on the plastic: its light takes the plastic's colour, falls
  // off over the folds as they turn from the lamp, and glints on the melted, glossy surface.
  riverMat.onBeforeCompile = (sh) => {
    sh.uniforms.lifProj = projUniform;
    sh.uniforms.lifStrength = projStrength;
    sh.uniforms.lifLamp = { value: LAMP };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLifPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvLifPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vLifPos;\nuniform sampler2D lifProj;\nuniform float lifStrength;\nuniform vec3 lifLamp;\n${projUV}`)
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        if (lifStrength > 0.0) {
          // the brightest of the light around each point: the video's river and the plastic
          // differ in outline, and in the room the light reaches all of the plastic
          vec3 lifLight = vec3(0.1, 0.11, 0.14);
          for (int i = 0; i < 8; i++) {
            float a = float(i) * 0.7854;
            lifLight = max(lifLight, texture2D(lifProj, letItFlowUV(vLifPos + vec3(cos(a), 0.0, sin(a)) * 0.11)).rgb);
          }
          lifLight = max(lifLight, texture2D(lifProj, letItFlowUV(vLifPos)).rgb) * vec3(0.92, 0.96, 1.1) * lifStrength;
          vec3 lifL = normalize((viewMatrix * vec4(lifLamp, 1.0)).xyz + vViewPosition);
          vec3 lifH = normalize(lifL + normalize(vViewPosition));
          float lifDiff = 0.22 + 0.78 * max(dot(normal, lifL), 0.0);
          float lifSpec = pow(max(dot(normal, lifH), 0.0), 42.0);
          totalEmissiveRadiance += lifLight * (diffuseColor.rgb / ${AMBIENT.toFixed(3)} * lifDiff + 0.3 * lifSpec);
        }`,
      );
  };
  // relief mesh from the height grid (0 = no plastic), built once the image is in
  new THREE.ImageLoader(manager).load(`${BASE}tex/river-height.png`, (img) => {
    const [gw, gh] = RIVER.grid;
    const c = document.createElement('canvas');
    c.width = gw;
    c.height = gh;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const px = g.getImageData(0, 0, gw, gh).data;
    const h = (i, j) => px[(j * gw + i) * 4];
    // only the grid points the plastic touches become vertices
    const slot = new Int32Array(gw * gh).fill(-1);
    const positions = [];
    const uvs = [];
    const vertex = (i, j) => {
      const k = j * gw + i;
      if (slot[k] < 0) {
        const u = i / (gw - 1);
        const v = j / (gh - 1);
        const val = h(i, j);
        slot[k] = positions.length / 3;
        positions.push(RIVER.xTop - v * RIVER.lengthM, val ? ((val - 1) / 254) * RIVER.hmax + 0.002 : 0, RIVER.zLeft + u * RIVER.widthM);
        uvs.push(u, 1 - v);
      }
      return slot[k];
    };
    const index = [];
    for (let j = 0; j < gh - 1; j++) {
      for (let i = 0; i < gw - 1; i++) {
        if (!(h(i, j) || h(i + 1, j) || h(i, j + 1) || h(i + 1, j + 1))) continue;
        const a = vertex(i, j);
        const b = vertex(i + 1, j);
        const c2 = vertex(i, j + 1);
        const d = vertex(i + 1, j + 1);
        index.push(a, c2, b, b, c2, d); // counter-clockwise seen from above
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(index);
    geo.computeVertexNormals();
    const river = new THREE.Mesh(geo, riverMat);
    river.name = 'plastic-river';
    group.add(river);
  });
  // keep visitors off the installation
  for (const [x0, x1, z0, z1] of RIVER.obstacles) OBSTACLES.push({ x0, x1, z0, z1 });

  // Videos play from Room 3 on, so they are running before the end wall comes into view; the
  // projector lamp breathes a little.
  const update = (t, light, camPos) => {
    const on = !camPos || camPos.x > 9.85;
    wallVideo.want(on);
    floorVideo.want(on);
    if (wallVideo.ready && projMat.map !== wallVideo.tex) {
      projMat.map = wallVideo.tex;
      projMat.needsUpdate = true;
    }
    if (floorVideo.ready && floorMat.map !== floorVideo.tex) {
      floorMat.map = floorVideo.tex;
      floorMat.opacity = 1;
      floorMat.needsUpdate = true;
      projUniform.value = floorVideo.tex;
      projStrength.value = 1;
    }
    const f = 0.97 + 0.02 * Math.sin(t * 0.9) + 0.01 * Math.sin(t * 2.3);
    projMat.color.copy(WALL_TINT).multiplyScalar(WALL_GAIN * f);
    if (light) light.intensity = light.userData.base * f;
  };

  return { group, update };
}
