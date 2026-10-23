import * as THREE from 'three';

// A deliberately small light budget (7 point lights + hemisphere) so the scene stays
// cheap on phones. Art "spotlights" are faked with additive light pools in gallery.js.
// Colours follow the photos: cool white in Rooms 1 and 3, warm pendants in Room 2,
// Room 4 lit only by the projection and the screens.

export function buildLights(scene) {
  const lights = {};
  const hemi = new THREE.HemisphereLight(0xf2f4ff, 0x4a443e, 0.85);
  scene.add(hemi);
  lights.hemi = hemi;

  const point = (color, intensity, x, y, z, distance = 0, decay = 2) => {
    const l = new THREE.PointLight(color, intensity, distance, decay);
    l.position.set(x, y, z);
    l.userData.base = intensity;
    scene.add(l);
    return l;
  };

  // Room 1: track spots + the cold LED bars of Paradise Factory
  lights.r1a = point(0xf6f6ff, 10, 2.3, 2.6, 2.6, 11);
  lights.r1b = point(0xf6f6ff, 10, 2.6, 2.6, 5.2, 11);
  lights.led = point(0xe8f2ff, 1.6, 1.52, 1.7, 3.58, 3.2);
  // Room 2: warm enamel pendants
  lights.r2 = point(0xffd9a6, 8, 7.9, 2.0, 3.5, 9);
  // Room 3: cool gallery white from the track rail
  lights.r3 = point(0xf4f6ff, 11, 12.7, 2.45, 3.85, 11);
  // Room 4: light thrown back off the projection wall (driven by letItFlow.update)
  lights.proj = point(0xd2e4d0, 3.2, 24.6, 1.3, 3.83, 11);
  // Stair shaft: cold light falling from the street entrance
  lights.stair = point(0xbcd2ff, 4, -1.2, 4.6, 1.05, 7);

  return lights;
}
