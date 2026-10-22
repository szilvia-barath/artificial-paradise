import * as THREE from 'three';
import { CEILING } from './layout.js';

// A deliberately small light budget (6 point lights + hemisphere) so the scene stays
// cheap on phones. Art "spotlights" are faked with additive light pools in gallery.js.

export function buildLights(scene) {
  const lights = {};
  const hemi = new THREE.HemisphereLight(0xdfe6ff, 0x2a2622, 0.55);
  scene.add(hemi);
  lights.hemi = hemi;

  const point = (color, intensity, x, y, z, distance = 0, decay = 2) => {
    const l = new THREE.PointLight(color, intensity, distance, decay);
    l.position.set(x, y, z);
    scene.add(l);
    return l;
  };

  // Room 1: cool gallery white from the track rails
  lights.r1a = point(0xf3f4ff, 7, 2.8, 1.95, 3.0, 12);
  lights.r1b = point(0xf3f4ff, 7, 7.4, 1.95, 3.0, 12);
  // Room 2: warm pendant lamps
  lights.r2 = point(0xffc88a, 7, 3.0, CEILING - 0.85, -2.9, 9);
  // Room 3 white zone
  lights.r3 = point(0xf4f6ff, 7, 11.2, 1.95, -2.8, 11);
  // Room 3 dark zone: light spilling from the projection (colour driven per frame)
  lights.proj = point(0x6fa8ff, 4, 24.2, 1.5, -2.8, 12);
  // Stairwell: cold light falling down from the street entrance
  lights.stair = point(0xbcd2ff, 5, 8.6, CEILING + 1.4, 6.4, 7);

  return lights;
}
