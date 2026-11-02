import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { OBSTACLES, R1 } from './layout.js';

// #3 Paradise Factory (2024), modelled from the Room 1 panorama and DSC_0011–0015:
//  - a white hydroponic (NFT) channel of lettuce seedlings hanging on chains under an
//    LED tube. It runs diagonally, from beside the monitor on the window wall towards
//    the middle of the room: in the panorama both of its ends sit at the same height,
//    i.e. the same distance from the camera, which a pipe parallel to the wall can't;
//  - at its north-east end a ZZ plant (Zamioculcas) in a clear plastic tank, fed from a
//    hanging bottle, between two floor-to-ceiling LED bars standing north and south of it.
// Positions are in the panorama's solved frame (camera bearings exact, distances from
// the floor line and the channel's 1 m height), scaled to the measured room.

const sx = R1.W / 4.5;
const sz = R1.D / 6.55;
const P = (x, z) => ({ x: R1.west + x * sx, z: z * sz });
const A = P(0.84, 4.51); // south-west end of the channel, by the monitor
const B = P(1.64, 2.72); // north-east end, beside the plant
export const PIPE = { a: A, b: B, y: 1.0 };
export const PLANT = P(1.8, 3.42);
const BARS = [P(1.9, 3.14), P(2.0, 3.7)];
const CEIL = 3.0;

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Leaf textures drawn once: a glossy ZZ leaflet and a pale lettuce seedling leaf.
function leafTexture(kind) {
  const W = 128;
  const H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const zz = kind === 'zz';
  // outline: ovate with a pointed tip (ZZ) or a rounded spoon (lettuce)
  g.beginPath();
  g.moveTo(W / 2, H - 4);
  if (zz) {
    g.bezierCurveTo(W * 0.02, H * 0.72, W * 0.06, H * 0.2, W / 2, 4);
    g.bezierCurveTo(W * 0.94, H * 0.2, W * 0.98, H * 0.72, W / 2, H - 4);
  } else {
    g.bezierCurveTo(W * 0.38, H * 0.7, W * -0.08, H * 0.32, W * 0.18, H * 0.1);
    g.bezierCurveTo(W * 0.36, -H * 0.02, W * 0.64, -H * 0.02, W * 0.82, H * 0.1);
    g.bezierCurveTo(W * 1.08, H * 0.32, W * 0.62, H * 0.7, W / 2, H - 4);
  }
  g.closePath();
  const grd = g.createLinearGradient(0, H, 0, 0);
  if (zz) {
    grd.addColorStop(0, '#1d3f14');
    grd.addColorStop(0.5, '#2a5a1c');
    grd.addColorStop(1, '#244f18');
  } else {
    grd.addColorStop(0, '#d8eda0');
    grd.addColorStop(0.35, '#a8d468');
    grd.addColorStop(1, '#86c24a');
  }
  g.fillStyle = grd;
  g.fill();
  g.save();
  g.clip();
  // midrib and side veins
  g.strokeStyle = zz ? 'rgba(170,210,120,0.55)' : 'rgba(240,250,210,0.8)';
  g.lineWidth = zz ? 3 : 4;
  g.beginPath();
  g.moveTo(W / 2, H);
  g.quadraticCurveTo(W / 2 + 3, H / 2, W / 2, 6);
  g.stroke();
  g.lineWidth = zz ? 1.2 : 2;
  g.strokeStyle = zz ? 'rgba(120,170,80,0.35)' : 'rgba(235,248,200,0.55)';
  for (let i = 1; i < 9; i++) {
    const y = H - i * (H / 9);
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(W / 2, y);
      g.quadraticCurveTo(W / 2 + s * W * 0.22, y - H * 0.05, W / 2 + s * W * 0.42, y - H * 0.11);
      g.stroke();
    }
  }
  // edge darkening (ZZ) / lighter rim (lettuce)
  g.lineWidth = 6;
  g.strokeStyle = zz ? 'rgba(20,45,12,0.45)' : 'rgba(255,255,220,0.35)';
  g.stroke();
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// a leaf blade: a subdivided plane, cupped across and arched along its length
function bladeGeometry(w, h, cup, arch) {
  const geo = new THREE.PlaneGeometry(w, h, 4, 8);
  geo.translate(0, h / 2, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / (w / 2);
    const y = p.getY(i) / h;
    p.setZ(i, -cup * x * x * w + arch * Math.sin(y * Math.PI) * h * 0.15 - arch * y * y * h * 0.25);
  }
  geo.computeVertexNormals();
  return geo;
}

function chain(mat, a, b) {
  const d = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, d.length(), 4), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}

export function buildParadiseFactory(materials) {
  const g = new THREE.Group();
  g.name = 'paradise-factory';
  const rand = rng(31);
  const pvc = new THREE.MeshStandardMaterial({ color: 0xf3f3f0, roughness: 0.32 });
  const chainMat = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.3, metalness: 0.9 });
  const capMat = new THREE.MeshStandardMaterial({ color: 0xc8352c, roughness: 0.5 });
  const lettuceMat = new THREE.MeshStandardMaterial({ map: leafTexture('lettuce'), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.55, emissive: 0x1a2a08 });
  const zzMat = new THREE.MeshStandardMaterial({ map: leafTexture('zz'), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.22, metalness: 0.05 });
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();

  // ---------------------------------------------------------------- hydroponic line
  {
    const a = new THREE.Vector3(A.x, PIPE.y, A.z);
    const b = new THREE.Vector3(B.x, PIPE.y, B.z);
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    dir.normalize();
    const yaw = Math.atan2(dir.x, dir.z); // rotation that turns +z onto the channel
    const line = new THREE.Group();
    line.position.copy(a).addScaledVector(dir, len / 2);
    line.rotation.y = yaw;
    g.add(line);
    // square-ish NFT channel (10 x 6 cm) with rounded corners and end caps
    const sec = new THREE.Shape();
    const w = 0.05;
    const h = 0.03;
    const r = 0.012;
    sec.moveTo(-w + r, -h);
    sec.lineTo(w - r, -h);
    sec.quadraticCurveTo(w, -h, w, -h + r);
    sec.lineTo(w, h - r);
    sec.quadraticCurveTo(w, h, w - r, h);
    sec.lineTo(-w + r, h);
    sec.quadraticCurveTo(-w, h, -w, h - r);
    sec.lineTo(-w, -h + r);
    sec.quadraticCurveTo(-w, -h, -w + r, -h);
    const channel = new THREE.Mesh(new THREE.ExtrudeGeometry(sec, { depth: len, bevelEnabled: false, curveSegments: 4 }), pvc);
    channel.position.z = -len / 2;
    line.add(channel);
    for (const z of [-len / 2 - 0.015, len / 2]) {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.112, 0.072, 0.015), pvc);
      cap.position.z = z + 0.0075;
      line.add(cap);
    }
    // drain at the south-west end: white elbow, red-capped connector, clear tube to the floor
    const elbow = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.12, 12), pvc);
    elbow.position.set(-0.07, -0.02, -len / 2 + 0.03);
    line.add(elbow);
    const red = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 10), capMat);
    red.position.set(-0.07, -0.095, -len / 2 + 0.03);
    line.add(red);
    const drop = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.07, -0.11, -len / 2 + 0.03),
      new THREE.Vector3(-0.05, -0.6, -len / 2 + 0.1),
      new THREE.Vector3(0.05, -0.98, -len / 2 + 0.35),
    ]);
    line.add(new THREE.Mesh(new THREE.TubeGeometry(drop, 20, 0.005, 5, false), materials.clearPlastic));
    // LED tube 20 cm above: dark housing, glowing diffuser underneath
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.022, len - 0.06), materials.black);
    led.position.y = 0.2;
    line.add(led);
    const diff = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.008, len - 0.1), materials.led);
    diff.position.y = 0.186;
    line.add(diff);
    // chains to the ceiling: channel and lamp hang separately, near each end
    const world = (lx, ly, lz) => new THREE.Vector3(lx, ly, lz).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).add(line.position);
    for (const z of [-len / 2 + 0.2, len / 2 - 0.2]) {
      g.add(chain(chainMat, world(0, 0.03, z), world(0.02, CEIL - PIPE.y, z + 0.05)));
      g.add(chain(chainMat, world(0, 0.212, z + 0.06), world(-0.02, CEIL - PIPE.y, z + 0.1)));
    }
    // lettuce seedlings: a small rosette of 4–6 leaves in each planting slot
    const slots = Math.round(len / 0.085);
    const leafGeo = bladeGeometry(0.034, 0.05, 0.35, 0.6);
    const per = 6;
    const leaves = new THREE.InstancedMesh(leafGeo, lettuceMat, slots * per);
    const tint = new THREE.Color();
    let k = 0;
    for (let i = 0; i < slots; i++) {
      const z = -len / 2 + 0.06 + (i / (slots - 1)) * (len - 0.12);
      const size = 0.65 + rand() * 0.75; // some seedlings well ahead of others
      const n = 4 + Math.floor(rand() * 3);
      for (let j = 0; j < per; j++) {
        if (j >= n) {
          m4.makeScale(0, 0, 0);
        } else {
          const ang = (j / n) * Math.PI * 2 + rand() * 0.6;
          const tilt = 0.35 + (j % 2) * 0.3 + rand() * 0.25; // inner leaves stand up
          e.set(-Math.PI / 2 + tilt, ang, 0, 'YXZ');
          q.setFromEuler(e);
          const s = size * (j < 2 ? 0.75 : 1);
          m4.compose(new THREE.Vector3((rand() - 0.5) * 0.008, h + 0.004, z), q, new THREE.Vector3(s, s, s));
        }
        leaves.setMatrixAt(k, m4);
        tint.setHSL(0.24 + rand() * 0.04, 0.45, 0.85 + rand() * 0.15);
        leaves.setColorAt(k++, tint);
      }
    }
    line.add(leaves);
    // keep visitors out from under the line: small boxes along its diagonal
    for (let i = 0; i < 6; i++) {
      const p = new THREE.Vector3().copy(a).lerp(b, (i + 0.5) / 6);
      OBSTACLES.push({ x0: p.x - 0.16, x1: p.x + 0.16, z0: p.z - 0.16, z1: p.z + 0.16 });
    }
  }

  // ---------------------------------------------------------------- ZZ plant on a drip
  {
    const { x, z } = PLANT;
    // clear storage box on a low metal frame, dark water and roots, white fittings
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.012, 0.34), materials.steel);
    frame.position.set(x, 0.1, z);
    g.add(frame);
    for (const [dx, dz] of [[-0.21, -0.15], [0.21, -0.15], [-0.21, 0.15], [0.21, 0.15]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.1, 6), materials.steel);
      leg.position.set(x + dx, 0.05, z + dz);
      g.add(leg);
    }
    const tank = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.3), materials.clearPlastic);
    tank.position.set(x, 0.25, z);
    g.add(tank);
    // the tank's edges are framed in aluminium angle (documentation video)
    const edge = (sx, sy, sz, px, py, pz) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), materials.steel);
      b.position.set(x + px, py, z + pz);
      g.add(b);
    };
    for (const dy of [0.112, 0.388]) {
      for (const dz of [-0.152, 0.152]) edge(0.43, 0.014, 0.014, 0, dy, dz);
      for (const dx of [-0.212, 0.212]) edge(0.014, 0.014, 0.31, dx, dy, 0);
    }
    for (const dx of [-0.212, 0.212]) for (const dz of [-0.152, 0.152]) edge(0.014, 0.28, 0.014, dx, 0.25, dz);
    // clear nutrient water with the roots hanging into it, and the black pump with its red tap
    const water = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.28), new THREE.MeshStandardMaterial({ color: 0xa89a6e, roughness: 0.1, transparent: true, opacity: 0.32, depthWrite: false }));
    water.position.set(x, 0.18, z);
    g.add(water);
    const rootMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2c, roughness: 0.8 });
    const roots = [];
    for (let i = 0; i < 16; i++) {
      const a = rand() * Math.PI * 2;
      const r = 0.02 + rand() * 0.04;
      const pts = [];
      for (let t = 0; t <= 4; t++) {
        const f = t / 4;
        pts.push(new THREE.Vector3(x + Math.cos(a) * r * (1 + f * 1.8) + (rand() - 0.5) * 0.02, 0.39 - f * (0.15 + rand() * 0.08), z + Math.sin(a) * r * (1 + f * 1.5) + (rand() - 0.5) * 0.02));
      }
      roots.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, 0.0025 + rand() * 0.002, 4, false));
    }
    g.add(new THREE.Mesh(mergeGeometries(roots, false), rootMat));
    const pump = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.06), materials.black);
    pump.position.set(x - 0.12, 0.145, z + 0.07);
    g.add(pump);
    const tap = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.05, 10), new THREE.MeshStandardMaterial({ color: 0xc8261e, roughness: 0.5 }));
    tap.rotation.z = Math.PI / 2;
    tap.position.set(x - 0.06, 0.15, z + 0.07);
    g.add(tap);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.018, 0.32), materials.clearPlastic);
    lid.position.set(x, 0.395, z);
    g.add(lid);
    // the stems rise from a black net pot set into the lid
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.06, 18, 1, true), new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.6, side: THREE.DoubleSide }));
    pot.position.set(x, 0.395, z);
    g.add(pot);
    const media = new THREE.Mesh(new THREE.CircleGeometry(0.072, 18), new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: 0.95 }));
    media.rotation.x = -Math.PI / 2;
    media.position.set(x, 0.415, z);
    g.add(media);
    for (const dx of [-0.13, 0.13]) {
      const fit = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.1, 12), pvc);
      fit.position.set(x + dx, 0.45, z - 0.09);
      g.add(fit);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.03, 12), capMat);
      cap.position.set(x + dx, 0.51, z - 0.09);
      g.add(cap);
    }

    // stems: thick at the base, tapering, slightly swollen, mottled darker green
    const stemTex = (() => {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 256;
      const sg = c.getContext('2d');
      const grd = sg.createLinearGradient(0, 256, 0, 0);
      grd.addColorStop(0, '#556b30');
      grd.addColorStop(1, '#3f6a26');
      sg.fillStyle = grd;
      sg.fillRect(0, 0, 64, 256);
      for (let i = 0; i < 140; i++) {
        sg.fillStyle = `rgba(30,45,18,${0.15 + rand() * 0.3})`;
        sg.beginPath();
        sg.ellipse(rand() * 64, rand() * 256, 1 + rand() * 3, 3 + rand() * 7, 0, 0, Math.PI * 2);
        sg.fill();
      }
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    const stemMat = new THREE.MeshStandardMaterial({ map: stemTex, roughness: 0.4 });
    const stemGeos = [];
    const leafPlacements = [];
    // fleshy stems fanning out of the pot, the tallest about 1.1 m
    const stems = 8;
    for (let i = 0; i < stems; i++) {
      const hgt = 0.62 + rand() * 0.5 + (i % 3 === 0 ? 0.12 : 0);
      const a = (i / stems) * Math.PI * 2 + rand() * 0.5;
      const lean = 0.14 + rand() * 0.22;
      const bx = x + Math.cos(a) * 0.03;
      const bz = z + Math.sin(a) * 0.025;
      const pts = [];
      for (let s = 0; s <= 6; s++) {
        const t = s / 6;
        pts.push(new THREE.Vector3(bx + Math.cos(a) * lean * t * t, 0.42 + hgt * t, bz + Math.sin(a) * lean * t * t));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const tube = new THREE.TubeGeometry(curve, 14, 0.011, 7, false);
      // taper: shrink rings towards the top (TubeGeometry rings are in order along the path)
      const pos = tube.attributes.position;
      const ring = 8;
      for (let v = 0; v < pos.count; v++) {
        const seg = Math.floor(v / ring) / 14;
        const c = curve.getPointAt(Math.min(1, seg));
        const k = 1.35 - seg * 0.85; // thick, fleshy base tapering to the tip
        pos.setXYZ(v, c.x + (pos.getX(v) - c.x) * k, pos.getY(v), c.z + (pos.getZ(v) - c.z) * k);
      }
      tube.computeVertexNormals();
      stemGeos.push(tube);
      // 6–8 pairs of large glossy leaflets along the upper 60%, held out like a feather:
      // in the plane of the stem's lean, angled 20–40° up, largest in the middle
      const pairs = 6 + Math.floor(rand() * 3);
      for (let j = 0; j < pairs; j++) {
        const t = 0.4 + (j / pairs) * 0.58;
        const p = curve.getPointAt(t);
        const sizeK = 0.85 + Math.sin(((t - 0.4) / 0.6) * Math.PI) * 0.4;
        for (const side of [-1, 1]) {
          leafPlacements.push({ p, yaw: a + Math.PI / 2 + side * (Math.PI / 2 - 0.5 - rand() * 0.25), up: 0.35 + rand() * 0.35, s: sizeK * (0.9 + rand() * 0.2) });
        }
      }
      leafPlacements.push({ p: curve.getPointAt(1), yaw: a + Math.PI / 2, up: 0.9, s: 0.8 });
    }
    g.add(new THREE.Mesh(mergeGeometries(stemGeos, false), stemMat));
    const leafletGeo = bladeGeometry(0.055, 0.12, 0.2, 0.3);
    const leaflets = new THREE.InstancedMesh(leafletGeo, zzMat, leafPlacements.length);
    const tint = new THREE.Color();
    leafPlacements.forEach((L, i) => {
      // blade's +y along the leaflet, tipped up from horizontal by L.up
      e.set(-(Math.PI / 2 - L.up), L.yaw, 0, 'YXZ');
      q.setFromEuler(e);
      m4.compose(L.p, q, new THREE.Vector3(L.s, L.s, L.s));
      leaflets.setMatrixAt(i, m4);
      tint.setHSL(0.27 + rand() * 0.03, 0.25, 0.75 + rand() * 0.25);
      leaflets.setColorAt(i, tint);
    });
    g.add(leaflets);

    // drip feed: an upturned plastic bottle on chains, a clear line down into the box
    const bottleY = 2.1;
    const prof = [
      [0.0, 0.0], [0.012, 0.0], [0.012, 0.03], [0.045, 0.08], [0.047, 0.26], [0.04, 0.3], [0.0, 0.31],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const bottle = new THREE.Mesh(new THREE.LatheGeometry(prof, 18), materials.clearPlastic);
    bottle.position.set(x, bottleY, z);
    g.add(bottle);
    // the "growing fluid": yellowish, two thirds full, a green cap on the neck
    const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.043, 0.17, 16), new THREE.MeshStandardMaterial({ color: 0xd8c25a, roughness: 0.2, transparent: true, opacity: 0.72 }));
    liquid.position.set(x, bottleY + 0.165, z);
    g.add(liquid);
    const neckCap = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.028, 14), new THREE.MeshStandardMaterial({ color: 0x3f9a3a, roughness: 0.5 }));
    neckCap.position.set(x, bottleY - 0.005, z);
    g.add(neckCap);
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2 + 0.6;
      g.add(chain(chainMat, new THREE.Vector3(x + Math.cos(ang) * 0.045, bottleY + 0.3, z + Math.sin(ang) * 0.045), new THREE.Vector3(x + Math.cos(ang) * 0.18, CEIL, z + Math.sin(ang) * 0.18)));
    }
    const drip = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, bottleY, z),
      new THREE.Vector3(x + 0.06, 1.55, z + 0.04),
      new THREE.Vector3(x + 0.1, 0.9, z - 0.03),
      new THREE.Vector3(x + 0.13, 0.5, z - 0.09),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(drip, 24, 0.004, 5, false), materials.clearPlastic));
    // supply hose over the floor to the channel's north-east end
    const hose = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x - 0.13, 0.45, z - 0.09),
      new THREE.Vector3(x - 0.2, 0.05, z - 0.2),
      new THREE.Vector3((x + B.x) / 2 - 0.1, 0.01, (z + B.z) / 2),
      new THREE.Vector3(B.x, 0.35, B.z + 0.08),
      new THREE.Vector3(B.x, PIPE.y - 0.04, B.z + 0.05),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(hose, 40, 0.006, 5, false), materials.clearPlastic));

    // the "growing fluid" card, hung on a chain in front of the plant (documentation video)
    {
      const c = document.createElement('canvas');
      c.width = 300;
      c.height = 400;
      const cg = c.getContext('2d');
      cg.fillStyle = '#f2f1ec';
      cg.fillRect(0, 0, 300, 400);
      cg.fillStyle = '#2e2e2e';
      cg.strokeStyle = '#2e2e2e';
      cg.lineWidth = 9;
      // the sprout: a curling stem and two leaves
      cg.beginPath();
      cg.moveTo(150, 250);
      cg.bezierCurveTo(120, 220, 185, 200, 150, 160);
      cg.stroke();
      cg.beginPath();
      cg.ellipse(124, 150, 26, 13, -0.6, 0, Math.PI * 2);
      cg.fill();
      cg.beginPath();
      cg.ellipse(176, 132, 30, 15, 0.5, 0, Math.PI * 2);
      cg.fill();
      cg.font = '30px monospace';
      cg.textAlign = 'center';
      cg.fillText('growing fluid', 150, 320);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      const paper = new THREE.MeshStandardMaterial({ color: 0xf2f1ec, roughness: 0.9 });
      const card = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.002), [paper, paper, paper, paper, new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }), paper]);
      card.position.set(x + 0.04, 1.42, z + 0.22);
      card.rotation.y = 0.35;
      g.add(card);
      g.add(chain(chainMat, new THREE.Vector3(x + 0.04, 1.52, z + 0.22), new THREE.Vector3(x + 0.04, CEIL, z + 0.24)));
    }

    // the two LED bars, floor to ceiling, their light strips turned towards the plant
    for (const bar of BARS) {
      const toPlant = Math.atan2(x - bar.x, z - bar.z);
      const post = new THREE.Group();
      post.position.set(bar.x, 0, bar.z);
      post.rotation.y = toPlant;
      post.add(new THREE.Mesh(new THREE.BoxGeometry(0.035, CEIL - 0.02, 0.025), materials.black).translateY(CEIL / 2));
      post.add(new THREE.Mesh(new THREE.BoxGeometry(0.022, CEIL - 0.12, 0.006), materials.led).translateY(CEIL / 2).translateZ(0.014));
      g.add(post);
    }
    OBSTACLES.push({ x0: x - 0.3, x1: x + 0.3, z0: z - 0.3, z1: z + 0.3 });
    for (const bar of BARS) OBSTACLES.push({ x0: bar.x - 0.06, x1: bar.x + 0.06, z0: bar.z - 0.06, z1: bar.z + 0.06 });
  }

  return g;
}
