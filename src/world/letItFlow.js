import * as THREE from 'three';
import RIVER from '../data/river.json';
import { OBSTACLES } from './layout.js';
import { createVideo } from './video.js';

// #16 Let it Flow (2024), Room 4. On the end wall the projected video Siluett (trees in
// grey silhouette, DSC_0112–0117). On the floor a river of melted plastic, rebuilt from
// the artist's top-down photograph of it (PLANE copy.png, scaled by its 30 cm tiles and
// checked against DSC_0113): one relief mesh whose height comes from the cut-out's shape
// and the photo's light and shade. From above, the video Let it Flow (a night sky with
// the river glowing in it) is projected over the floor, turned so its river lies on the
// plastic; its specks are the white dots on the floor in the photos. Both projections
// fill the room: the wall one edge to edge and up to the beam, the floor one wall to wall.

const BASE = import.meta.env.BASE_URL;
const WALL_X = 25.4;
const Z0 = 1.73;
const Z1 = 5.73;
const TOP = 2.72; // underside of the beam along the end wall
const VIDEO_ASPECT = 16 / 9;
const P = RIVER.projection;

// Shows a texture on the end wall without stretching it: it fills the wall's height and
// what is too wide for the wall falls off both sides, as with a projector zoomed to fit.
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
  // The photographed projection stands in until the video plays; the video is added as
  // light over the wall (a projector cannot darken), so the brick shows through.
  const projMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.95, 0.95, 0.95), toneMapped: false });
  let still = null;
  loader.load(`${BASE}img/w16-let-it-flow-tex.webp`, (t) => {
    still = srgb(t);
    coverWall(still, t.image.width / t.image.height);
    if (!projMat.map) {
      projMat.map = still;
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
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    opacity: 0,
  });
  {
    // a plane from wall to wall, its UVs following letItFlowUV
    const x0 = P.xEast - P.lengthM;
    const zMid = (Z0 + Z1) / 2;
    const geo = new THREE.PlaneGeometry(P.lengthM, Z1 - Z0);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + x0 + P.lengthM / 2;
      const z = pos.getZ(i) + zMid;
      uv.setXY(i, (P.xEast - x) / P.lengthM, 0.5 + (z - P.zCentre) / P.widthM);
    }
    const floorProj = new THREE.Mesh(geo, floorMat);
    floorProj.position.set(x0 + P.lengthM / 2, 0.004, zMid);
    floorProj.renderOrder = 2;
    group.add(floorProj);
  }

  // ---------------------------------------------------------------- the river
  const riverMat = new THREE.MeshStandardMaterial({
    map: srgb(loader.load(`${BASE}tex/river.webp`)),
    normalMap: loader.load(`${BASE}tex/river-normal.webp`),
    normalScale: new THREE.Vector2(0.8, 0.8),
    roughness: 0.3,
    metalness: 0,
    alphaTest: 0.5,
  });
  const projUniform = { value: null };
  const projStrength = { value: 0 };
  // the floor projection lands on the plastic too
  riverMat.onBeforeCompile = (sh) => {
    sh.uniforms.lifProj = projUniform;
    sh.uniforms.lifStrength = projStrength;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLifPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvLifPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vLifPos;\nuniform sampler2D lifProj;\nuniform float lifStrength;\n${projUV}`)
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        vec2 lifUV = letItFlowUV(vLifPos);
        if (lifStrength > 0.0 && lifUV.x > 0.0 && lifUV.x < 1.0 && lifUV.y > 0.0 && lifUV.y < 1.0)
          totalEmissiveRadiance += texture2D(lifProj, lifUV).rgb * diffuseColor.rgb * lifStrength;`,
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
    const positions = new Float32Array(gw * gh * 3);
    const uvs = new Float32Array(gw * gh * 2);
    for (let j = 0; j < gh; j++) {
      for (let i = 0; i < gw; i++) {
        const k = j * gw + i;
        const u = i / (gw - 1);
        const v = j / (gh - 1);
        const val = h(i, j);
        positions[k * 3] = RIVER.xTop - v * RIVER.lengthM;
        positions[k * 3 + 1] = val ? ((val - 1) / 254) * RIVER.hmax + 0.002 : 0;
        positions[k * 3 + 2] = RIVER.zLeft + u * RIVER.widthM;
        uvs[k * 2] = u;
        uvs[k * 2 + 1] = 1 - v;
      }
    }
    const index = [];
    for (let j = 0; j < gh - 1; j++) {
      for (let i = 0; i < gw - 1; i++) {
        const a = j * gw + i;
        const b = a + 1;
        const c2 = a + gw;
        const d = c2 + 1;
        if (!(h(i, j) || h(i + 1, j) || h(i, j + 1) || h(i + 1, j + 1))) continue;
        index.push(a, c2, b, b, c2, d); // counter-clockwise seen from above
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(index);
    geo.computeVertexNormals();
    const river = new THREE.Mesh(geo, riverMat);
    river.name = 'plastic-river';
    group.add(river);
  });
  // keep visitors off the installation
  for (const [x0, x1, z0, z1] of RIVER.obstacles) OBSTACLES.push({ x0, x1, z0, z1 });

  // Videos play while the visitor is in Rooms 3–4; the projector lamp breathes a little.
  const update = (t, light, camPos) => {
    const on = !camPos || camPos.x > 12.5;
    wallVideo.want(on);
    floorVideo.want(on);
    if (wallVideo.ready && projMat.map !== wallVideo.tex) {
      projMat.map = wallVideo.tex;
      projMat.transparent = true;
      projMat.blending = THREE.AdditiveBlending;
      projMat.depthWrite = false;
      projMat.needsUpdate = true;
    }
    if (floorVideo.ready && floorMat.map !== floorVideo.tex) {
      floorMat.map = floorVideo.tex;
      floorMat.opacity = 0.7;
      floorMat.needsUpdate = true;
      projUniform.value = floorVideo.tex;
      projStrength.value = 0.8;
    }
    const f = 0.97 + 0.02 * Math.sin(t * 0.9) + 0.01 * Math.sin(t * 2.3);
    projMat.color.setScalar(0.95 * f);
    if (light) light.intensity = light.userData.base * f;
  };

  return { group, update };
}
