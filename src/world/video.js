import * as THREE from 'three';

// Video textures that only decode while the visitor is near: one looping <video> per
// screen or projection, started when wanted and paused otherwise. Until its first frame
// has arrived, `ready` is false and the caller keeps showing the photographed still.
// Videos with a sound track (`sound`) stay muted until enableVideoSound(): from then on
// audio/ambience.js plays their sound from `pos`, their place in the rooms, at full level
// within `near` metres (a wall-sized projection fills more of the room than a screen);
// `work` is the id of the artwork they belong to.

const BASE = import.meta.env.BASE_URL;

// Every in-world video, for the sound mix.
export const VIDEOS = [];
let soundOn = false;

function play(v) {
  v.el.muted = !(v.sound && soundOn);
  v.el.play().catch(() => {
    // The browser wants a fresh click before playing sound: play muted until then.
    if (!v.el.muted) {
      v.el.muted = true;
      v.el.play().catch(() => {});
    }
  });
}

// The video elements sit in the page, invisible: phone browsers (iOS Safari above all)
// may not decode a video that is not in the document, and the screen stays black.
let shelf = null;
function shelve(el) {
  if (!shelf) {
    shelf = document.createElement('div');
    shelf.setAttribute('aria-hidden', 'true');
    shelf.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;overflow:hidden;opacity:0.01;pointer-events:none;z-index:-1';
    document.body.appendChild(shelf);
  }
  el.style.cssText = 'width:2px;height:2px';
  shelf.appendChild(el);
}

export function createVideo(src, { pos = null, sound = false, near = 1.2, work = null } = {}) {
  const el = document.createElement('video');
  el.muted = true;
  el.loop = true;
  el.playsInline = true;
  el.preload = 'none';
  el.setAttribute('muted', '');
  el.setAttribute('playsinline', '');
  shelve(el);
  const tex = new THREE.VideoTexture(el);
  tex.colorSpace = THREE.SRGBColorSpace;
  const v = { el, tex, pos, sound, near, work, ready: false, wanted: false };
  el.addEventListener('loadeddata', () => { v.ready = true; });
  v.want = (on) => {
    if (on === v.wanted) return;
    v.wanted = on;
    if (on) {
      if (!el.src) el.src = `${BASE}${src}`;
      play(v);
    } else {
      el.pause();
    }
  };
  VIDEOS.push(v);
  return v;
}

// Called (from the Enter click) once Web Audio has taken over the videos' output.
export function enableVideoSound() {
  soundOn = true;
  for (const v of VIDEOS) if (v.sound && v.wanted) v.el.muted = false;
}

// A video the browser kept muted gets its sound back on the visitor's next click or key.
const unmute = () => {
  if (!soundOn) return;
  for (const v of VIDEOS) if (v.sound && v.wanted && v.el.muted) v.el.muted = false;
};
window.addEventListener('pointerdown', unmute, true);
window.addEventListener('keydown', unmute, true);

// Plays the `budget` nearest videos within `range` metres and pauses the rest.
// items: [{ video, pos: Vector3 }]
export function scheduleVideos(items, camPos, budget, range) {
  const near = items
    .map((it) => ({ it, d: it.pos.distanceTo(camPos) }))
    .filter((e) => e.d < range)
    .sort((a, b) => a.d - b.d)
    .slice(0, budget);
  for (const it of items) it.video.want(near.some((e) => e.it === it));
}
