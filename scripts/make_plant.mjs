// The artist's 3D model of the Paradise Factory plant rig (Drive file 1bSbu0cJxkFHcQ12a64KeAhvFm4rwUN1c,
// hydroponic_plant_installation_v8_fanned_zz.glb: aluminium frame, two clear storage boxes,
// pump and hoses, the ZZ plant and its roots) made light for the web:
//  - its 463 parts, coloured per part but without materials, get one of four materials by
//    name (plant, hardware, clear plastic, water) and are joined into one mesh per material;
//  - normals are computed (flat for the frame, boxes and hoses, smooth for leaves and roots);
//  - it is matched to the photographed rig: the aluminium uprights stop at the top frame
//    (0.6 m) instead of running on to 1.5 m, the two fittings on the plant box's rim are red,
//    the pump's hose is clear like the others, the water is brownish with the roots in it;
//  - it is turned from Z-up to the glTF Y-up and compressed with meshopt.
//   node scripts/make_plant.mjs <source .glb> [public/models/paradise-factory-plant.glb]
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { flatten, join, meshopt, normals, prune, unweldPrimitive } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';

const [src, out = 'public/models/paradise-factory-plant.glb'] = process.argv.slice(2);
if (!src) throw new Error('usage: node scripts/make_plant.mjs <source .glb> [output .glb]');

const CLASSES = [
  ['water', /water_surface/],
  ['plastic', /samla|hose/],
  ['plant', /^zz_/],
  ['hardware', /./], // frame, feet, bolts, pump, its hose and the bulkheads
];

await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(src);
const root = doc.getRoot();

const mats = {
  plant: doc.createMaterial('plant').setRoughnessFactor(0.45).setMetallicFactor(0).setDoubleSided(true),
  hardware: doc.createMaterial('hardware').setRoughnessFactor(0.35).setMetallicFactor(0.5),
  plastic: doc.createMaterial('plastic').setRoughnessFactor(0.12).setMetallicFactor(0).setDoubleSided(true).setAlphaMode('BLEND'),
  water: doc.createMaterial('water').setRoughnessFactor(0.05).setMetallicFactor(0).setDoubleSided(true).setAlphaMode('BLEND'),
};
// as photographed (the rig's close-up and the documentation video)
const TOP = 0.612; // the top of the frame, metres (model z is up)
const paint = (re, rgba) => {
  for (const mesh of root.listMeshes()) {
    if (!re.test(mesh.getName())) continue;
    for (const prim of mesh.listPrimitives()) {
      const col = prim.getAttribute('COLOR_0');
      for (let i = 0; i < col.getCount(); i++) col.setElement(i, rgba.map((v) => v / 255));
    }
  }
};
for (const mesh of root.listMeshes()) {
  if (!/^aluminium_upright/.test(mesh.getName())) continue;
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    const v = [];
    for (let i = 0; i < pos.getCount(); i++) {
      pos.getElement(i, v);
      if (v[2] > TOP) pos.setElement(i, [v[0], v[1], TOP]);
    }
  }
}
paint(/upper_tank_bulkhead/, [196, 38, 30, 255]); // red fittings on the rim
paint(/pump_to_upper_tank_hose/, [205, 222, 226, 160]); // clear hose
paint(/water_surface/, [150, 128, 92, 150]); // brownish water

const counts = {};
for (const mesh of root.listMeshes()) {
  const kind = CLASSES.find(([, re]) => re.test(mesh.getName()))[0];
  counts[kind] = (counts[kind] || 0) + 1;
  for (const prim of mesh.listPrimitives()) {
    prim.setMaterial(mats[kind]);
    // hard edges on the boxes and the frame; the plant keeps its shared vertices
    if (kind !== 'plant') unweldPrimitive(prim);
  }
}
console.log('parts per material', counts);

// Z-up -> Y-up: a quarter turn about x on the root node (it stays on the nodes, which also
// carry the quantisation scale)
const scene = root.getDefaultScene() || root.listScenes()[0];
for (const node of scene.listChildren()) node.setRotation([-Math.SQRT1_2, 0, 0, Math.SQRT1_2]);

await doc.transform(normals({ overwrite: true }), flatten(), join({ keepNamed: false }), prune(), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
// one mesh per material after join: name each (and its node) after its material
for (const node of root.listNodes()) {
  const mesh = node.getMesh();
  if (mesh) node.setName(mesh.setName(mesh.listPrimitives()[0].getMaterial().getName()).getName());
}
await io.write(out, doc);
const tris = root.listMeshes().flatMap((m) => m.listPrimitives()).reduce((n, p) => n + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0);
console.log(`${out}: ${root.listMeshes().length} meshes, ${Math.round(tris)} triangles`);
