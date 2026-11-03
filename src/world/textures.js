import * as THREE from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';

// Photo textures (public/tex) as KTX2 / Basis (scripts/make_ktx2.mjs): transcoded to the
// GPU's own compressed format, they take about a sixth of the memory of a decoded image
// and upload without a stall. If the transcoder can't run, the .webp is loaded instead.

const BASE = import.meta.env.BASE_URL;
let ktx2 = null;
let webp = null;

export function initTextures(renderer, manager) {
  ktx2 = new KTX2Loader(manager).setTranscoderPath(`${BASE}basis/`).detectSupport(renderer);
  webp = new THREE.TextureLoader(manager);
}

// One texture for any number of material slots, filled in when it arrives (the material
// recompiles once with the map). setup(texture) sets wrapping, repeat and filtering.
export function photoTexture(name, setup) {
  const slots = [];
  let tex = null;
  const done = (t) => {
    setup(t);
    tex = t;
    for (const [m, key] of slots) {
      m[key] = t;
      m.needsUpdate = true;
    }
  };
  ktx2.load(`${BASE}tex/${name}.ktx2`, done, undefined, () => webp.load(`${BASE}tex/${name}.webp`, done));
  return {
    into(material, key) {
      if (tex) material[key] = tex;
      else slots.push([material, key]);
      return material;
    },
  };
}
