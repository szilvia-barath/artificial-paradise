import * as THREE from 'three';
import { OBSTACLES, CEILING, PARTITION } from './layout.js';

// Furniture, fixtures and installations. Kept low-poly; repeated parts are instanced.

const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
const cyl = (rt, rb, h, mat, seg = 16) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);

function obstacle(x0, x1, z0, z1) {
  OBSTACLES.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1) });
}

function place(obj, x, y, z, ry = 0) {
  obj.position.set(x, y, z);
  obj.rotation.y = ry;
  return obj;
}

export function buildProps(materials, stairwell) {
  const g = new THREE.Group();
  g.name = 'props';
  const anim = []; // per-frame callbacks (t, dt, audio)

  // ---------------- Room 1 ----------------
  // Stairs along the south wall, rising east into the stairwell.
  {
    const steps = 13;
    const x0 = 5.75; // foot
    const x1 = 10;
    const run = (x1 - x0) / steps;
    const rise = CEILING / (steps - 2.5);
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const inst = new THREE.InstancedMesh(geo, materials.stair, steps);
    const m = new THREE.Matrix4();
    for (let i = 0; i < steps; i++) {
      const h = rise * (i + 1);
      m.compose(
        new THREE.Vector3(x0 + run * (i + 0.5), h / 2, (stairwell.z0 + 0.05 + 7) / 2),
        new THREE.Quaternion(),
        new THREE.Vector3(run + 0.002, h, 7 - stairwell.z0 - 0.05),
      );
      inst.setMatrixAt(i, m);
    }
    g.add(inst);
    // Railing: black steel posts + handrail on the open (north) side
    const railZ = stairwell.z0 + 0.08;
    const len = Math.hypot(x1 - x0, CEILING + 0.6);
    const rail = box(len, 0.04, 0.04, materials.black);
    rail.position.set((x0 + x1) / 2, (CEILING + 0.6) / 2 + 0.95, railZ);
    rail.rotation.z = Math.atan2(CEILING + 0.6, x1 - x0);
    g.add(rail);
    for (let i = 1; i < steps; i += 3) {
      const h = rise * (i + 1);
      const post = box(0.03, 0.95, 0.03, materials.black);
      post.position.set(x0 + run * (i + 0.5), h + 0.47, railZ);
      g.add(post);
    }
    obstacle(x0 - 0.05, 10, stairwell.z0, 7);
    // Stacked chairs on the landing (as in the photos) — simple dark blocks
    for (let i = 0; i < 3; i++) {
      const c = box(0.45, 0.9, 0.45, materials.black);
      c.position.set(9.3 - i * 0.5, rise * 12 + 0.45, 6.4);
      g.add(c);
    }
  }

  // Bench along the north wall (dark grey plinth bench under the prints)
  {
    const b = box(4.6, 0.45, 0.45, materials.bench);
    place(b, 7.7, 0.225, 0.225);
    g.add(b);
    obstacle(5.4, 10, 0, 0.45);
    const b2 = box(0.45, 0.45, 2.0, materials.bench);
    place(b2, 9.775, 0.225, 1.45);
    g.add(b2);
    obstacle(9.55, 10, 0.45, 2.45);
  }

  // Plinths either side of the Room 1 -> Room 2 doorway
  for (const x of [1.95, 4.05]) {
    const p = box(0.32, 1.1, 0.32, materials.white);
    place(p, x, 0.55, 0.3);
    g.add(p);
    obstacle(x - 0.16, x + 0.16, 0.14, 0.46);
  }

  // Radiators
  const radiator = (x, z, ry, w = 1.0) => {
    const r = new THREE.Group();
    const fins = Math.round(w / 0.08);
    const finGeo = new THREE.BoxGeometry(0.05, 0.6, 0.08);
    const inst = new THREE.InstancedMesh(finGeo, materials.white, fins);
    const m = new THREE.Matrix4();
    for (let i = 0; i < fins; i++) {
      m.makeTranslation(-w / 2 + (i + 0.5) * (w / fins), 0, 0);
      inst.setMatrixAt(i, m);
    }
    r.add(inst);
    place(r, x, 0.5, z, ry);
    g.add(r);
  };
  radiator(5.0, 0.1, 0, 0.9);
  radiator(9.9, 3.2, Math.PI / 2, 1.1);
  radiator(9.9, 5.0, Math.PI / 2, 0.9);

  // High basement windows on the east wall (night: dark glass, faint blue glow)
  for (const z of [2.2, 4.4]) {
    const frame = box(0.06, 0.75, 1.2, materials.white);
    place(frame, 9.97, 2.15, z);
    g.add(frame);
    const glass = box(0.02, 0.62, 1.06, materials.windowGlass);
    place(glass, 9.94, 2.15, z);
    g.add(glass);
    for (let k = -1; k <= 1; k++) {
      const bar = box(0.03, 0.62, 0.025, materials.white);
      place(bar, 9.93, 2.15, z + k * 0.27);
      g.add(bar);
    }
  }

  // Hydroponic installation: white pipe with lettuce seedlings under a hanging LED tube,
  // plus a tall plant on a drip, flanked by vertical LED tubes.
  {
    const hydro = new THREE.Group();
    hydro.name = 'hydroponics';
    const pipeLen = 4.6;
    const pipe = cyl(0.075, 0.075, pipeLen, materials.white, 20);
    pipe.rotation.x = Math.PI / 2;
    place(pipe, 9.25, 1.15, 3.1);
    hydro.add(pipe);
    const ledTube = cyl(0.018, 0.018, pipeLen - 0.2, materials.led, 8);
    ledTube.rotation.x = Math.PI / 2;
    place(ledTube, 9.25, 1.42, 3.1);
    hydro.add(ledTube);
    // Chains / hangers
    for (const z of [1.2, 3.1, 5.0]) {
      const wire = cyl(0.004, 0.004, CEILING - 1.15, materials.steel, 4);
      place(wire, 9.25, (CEILING + 1.15) / 2, z);
      hydro.add(wire);
    }
    // Seedlings (instanced little leaf clusters)
    const n = 46;
    const leafGeo = new THREE.SphereGeometry(0.045, 6, 4);
    leafGeo.scale(1, 0.55, 1);
    const leaves = new THREE.InstancedMesh(leafGeo, materials.leaf, n * 2);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    for (let i = 0; i < n * 2; i++) {
      const z = 0.9 + ((i >> 1) / n) * (pipeLen - 0.4);
      q.setFromEuler(new THREE.Euler((Math.random() - 0.5) * 0.8, Math.random() * 6, (Math.random() - 0.5) * 0.8));
      const k = 0.7 + Math.random() * 0.6;
      s.set(k, k, k);
      m.compose(new THREE.Vector3(9.25 + (i % 2 ? 0.03 : -0.03), 1.24 + Math.random() * 0.03, z), q, s);
      leaves.setMatrixAt(i, m);
    }
    hydro.add(leaves);

    // Tall plant in a clear tank with a drip bag
    const tank = box(0.45, 0.35, 0.35, materials.glass);
    place(tank, 8.3, 0.18, 4.9);
    hydro.add(tank);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x5e8f3a, roughness: 0.7 });
    for (let i = 0; i < 5; i++) {
      const h = 0.9 + Math.random() * 0.9;
      const st = cyl(0.025, 0.035, h, stemMat, 6);
      st.position.set(8.3 + (Math.random() - 0.5) * 0.18, 0.3 + h / 2, 4.9 + (Math.random() - 0.5) * 0.15);
      st.rotation.z = (Math.random() - 0.5) * 0.25;
      st.rotation.x = (Math.random() - 0.5) * 0.25;
      hydro.add(st);
    }
    const bag = box(0.12, 0.2, 0.06, materials.glass);
    place(bag, 8.3, 2.25, 4.9);
    hydro.add(bag);
    const drip = cyl(0.004, 0.004, 1.9, materials.glass, 4);
    place(drip, 8.32, 1.25, 4.9);
    hydro.add(drip);
    for (const dx of [-0.42, 0.42]) {
      const tube = cyl(0.018, 0.018, CEILING - 0.05, materials.led, 8);
      place(tube, 8.3 + dx, CEILING / 2, 4.9);
      hydro.add(tube);
    }
    g.add(hydro);
    obstacle(9.1, 9.4, 0.8, 5.4);
    obstacle(7.85, 8.75, 4.7, 5.1);
  }

  // ---------------- Room 2 (bar) ----------------
  {
    // Brick bar counter by the passage to Room 3
    const counter = box(1.9, 1.02, 0.6, materials.warmBrick);
    place(counter, 5.55, 0.51, -1.25);
    g.add(counter);
    const top = box(2.0, 0.05, 0.7, materials.bench);
    place(top, 5.55, 1.045, -1.25);
    g.add(top);
    obstacle(4.55, 6.5, -1.6, -0.3);
    // Shelf with glasses on the wall behind
    const shelf = box(1.6, 0.04, 0.25, materials.wood);
    place(shelf, 5.55, 1.65, -0.45);
    g.add(shelf);
    const glassGeo = new THREE.CylinderGeometry(0.035, 0.03, 0.12, 10);
    const glasses = new THREE.InstancedMesh(glassGeo, materials.glass, 14);
    const m = new THREE.Matrix4();
    for (let i = 0; i < 14; i++) {
      const onShelf = i < 9;
      m.makeTranslation(
        onShelf ? 4.85 + i * 0.17 : 4.9 + (i - 9) * 0.18,
        onShelf ? 1.73 : 1.13,
        onShelf ? -0.45 : -1.35 + (i % 2) * 0.1,
      );
      glasses.setMatrixAt(i, m);
    }
    g.add(glasses);
    // Bottles
    const bottleMat = new THREE.MeshStandardMaterial({ color: 0x1d3b22, roughness: 0.15, metalness: 0.1 });
    for (let i = 0; i < 4; i++) {
      const b = cyl(0.035, 0.035, 0.3, bottleMat, 10);
      place(b, 5.85 + i * 0.1, 1.22, -1.15 - (i % 2) * 0.08);
      g.add(b);
      const neck = cyl(0.012, 0.02, 0.09, bottleMat, 8);
      place(neck, 5.85 + i * 0.1, 1.41, -1.15 - (i % 2) * 0.08);
      g.add(neck);
    }
    // Kettle
    const kettle = cyl(0.08, 0.1, 0.22, materials.white, 16);
    place(kettle, 4.75, 1.18, -1.2);
    g.add(kettle);
    // Bowl of snacks
    const bowl = cyl(0.12, 0.06, 0.07, materials.black, 16);
    place(bowl, 5.3, 1.1, -1.3);
    g.add(bowl);

    // Bistro tables + folding chairs under the screens
    const table = (x, z) => {
      const t = new THREE.Group();
      const topT = cyl(0.33, 0.33, 0.03, materials.black, 24);
      topT.position.y = 0.74;
      t.add(topT);
      const leg = cyl(0.025, 0.025, 0.72, materials.black, 8);
      leg.position.y = 0.37;
      t.add(leg);
      const foot = cyl(0.2, 0.22, 0.02, materials.black, 16);
      foot.position.y = 0.01;
      t.add(foot);
      place(t, x, 0, z);
      g.add(t);
      obstacle(x - 0.33, x + 0.33, z - 0.33, z + 0.33);
    };
    const chair = (x, z, ry) => {
      const c = new THREE.Group();
      const seat = box(0.42, 0.03, 0.42, materials.black);
      seat.position.y = 0.45;
      c.add(seat);
      const back = box(0.42, 0.42, 0.03, materials.black);
      back.position.set(0, 0.68, -0.2);
      c.add(back);
      for (const [lx, lz] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) {
        const l = box(0.02, 0.45, 0.02, materials.black);
        l.position.set(lx, 0.225, lz);
        c.add(l);
      }
      place(c, x, 0, z, ry);
      g.add(c);
      obstacle(x - 0.25, x + 0.25, z - 0.25, z + 0.25);
    };
    table(1.25, -3.9);
    chair(0.6, -4.3, Math.PI * 0.25);
    chair(1.9, -4.45, -0.2);
    table(1.2, -1.6);
    chair(0.55, -1.2, Math.PI * 0.6);

    // Pendant lamps (enamel shades as in the photos)
    for (const [x, z] of [[2.2, -2.2], [3.9, -3.6]]) {
      const lamp = new THREE.Group();
      const cord = cyl(0.005, 0.005, 0.6, materials.black, 4);
      cord.position.y = CEILING - 0.3;
      lamp.add(cord);
      const shade = cyl(0.06, 0.2, 0.16, materials.black, 20);
      shade.position.y = CEILING - 0.68;
      lamp.add(shade);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), materials.warmBulb);
      bulb.position.y = CEILING - 0.77;
      lamp.add(bulb);
      place(lamp, x, 0, z);
      g.add(lamp);
    }
  }

  // ---------------- Room 3 ----------------
  {
    // Exposed pipes along the dark zone's north wall (as in the photos)
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x3a3c42, roughness: 0.6 });
    const p1 = cyl(0.05, 0.05, 10.0, pipeMat, 10);
    p1.rotation.z = Math.PI / 2;
    place(p1, 20.9, 0.42, -4.92);
    g.add(p1);
    const p2 = cyl(0.09, 0.09, 10.0, pipeMat, 12);
    p2.rotation.z = Math.PI / 2;
    place(p2, 20.9, 2.55, -4.88);
    g.add(p2);
    for (const x of [17.2, 21.6, 24.4]) {
      const v = cyl(0.04, 0.04, 2.1, pipeMat, 8);
      place(v, x, 1.48, -4.93);
      g.add(v);
    }

    // Curtain bunched beside the partition doorway
    const curtainGeo = new THREE.PlaneGeometry(0.5, 2.15, 12, 1);
    const pos = curtainGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      pos.setZ(i, Math.sin(x * 40) * 0.05);
    }
    curtainGeo.computeVertexNormals();
    const curtain = new THREE.Mesh(curtainGeo, materials.curtain);
    curtain.rotation.y = Math.PI / 2;
    place(curtain, PARTITION.x1 + 0.08, 1.08, PARTITION.gap.to - 0.25, Math.PI / 2);
    g.add(curtain);

    // Ceiling-mounted projector
    const proj = new THREE.Group();
    const body = box(0.32, 0.12, 0.3, materials.black);
    body.position.y = CEILING - 0.42;
    proj.add(body);
    const mount = cyl(0.015, 0.015, 0.36, materials.steel, 6);
    mount.position.y = CEILING - 0.18;
    proj.add(mount);
    const lens = cyl(0.04, 0.04, 0.04, materials.led, 12);
    lens.rotation.z = Math.PI / 2;
    lens.position.set(0.18, CEILING - 0.42, 0);
    proj.add(lens);
    place(proj, 18.2, 0, -2.8);
    g.add(proj);
  }

  // Track lights (rails + spots with glowing lenses) in Room 1 and Room 3's white zone
  {
    const rails = [
      { x0: 1.0, x1: 9.0, z: 1.6 },
      { x0: 1.0, x1: 9.0, z: 4.6 },
      { x0: 7.6, x1: 15.0, z: -2.8 },
    ];
    const spotGeo = new THREE.CylinderGeometry(0.045, 0.06, 0.16, 12);
    spotGeo.rotateX(Math.PI / 2);
    const count = rails.length * 5;
    const spots = new THREE.InstancedMesh(spotGeo, materials.black, count);
    const lensGeo = new THREE.CircleGeometry(0.04, 12);
    const lenses = new THREE.InstancedMesh(lensGeo, materials.led, count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    let k = 0;
    for (const r of rails) {
      const rail = box(r.x1 - r.x0, 0.03, 0.05, materials.black);
      place(rail, (r.x0 + r.x1) / 2, CEILING - 0.02, r.z);
      g.add(rail);
      for (let i = 0; i < 5; i++) {
        const x = r.x0 + 0.4 + (i / 4) * (r.x1 - r.x0 - 0.8);
        // Aim alternately at the two long walls, tilted down
        const toward = i % 2 ? 1 : -1;
        q.setFromEuler(new THREE.Euler(0.8, toward > 0 ? 0 : Math.PI, 0, 'YXZ'));
        const p = new THREE.Vector3(x, CEILING - 0.14, r.z);
        m.compose(p, q, new THREE.Vector3(1, 1, 1));
        spots.setMatrixAt(k, m);
        const lensPos = new THREE.Vector3(0, 0, 0.081).applyQuaternion(q).add(p);
        m.compose(lensPos, q, new THREE.Vector3(1, 1, 1));
        lenses.setMatrixAt(k, m);
        k++;
      }
    }
    g.add(spots, lenses);
  }

  return { group: g, anim };
}
