import * as THREE from 'three';

// Video textures that only decode while the visitor is near: one muted, looping <video>
// per screen or projection, started when wanted and paused otherwise. Until its first
// frame has arrived, `ready` is false and the caller keeps showing the photographed still.

const BASE = import.meta.env.BASE_URL;

export function createVideo(src) {
  const el = document.createElement('video');
  el.muted = true;
  el.loop = true;
  el.playsInline = true;
  el.preload = 'none';
  el.setAttribute('muted', '');
  el.setAttribute('playsinline', '');
  const tex = new THREE.VideoTexture(el);
  tex.colorSpace = THREE.SRGBColorSpace;
  const v = { el, tex, ready: false, wanted: false };
  el.addEventListener('loadeddata', () => { v.ready = true; });
  v.want = (on) => {
    if (on === v.wanted) return;
    v.wanted = on;
    if (on) {
      if (!el.src) el.src = `${BASE}${src}`;
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  };
  return v;
}

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
