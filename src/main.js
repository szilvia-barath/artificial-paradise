import * as THREE from 'three';
import data from './data/exhibition.json';
import { ROOMS, EYE, roomAt, roomById } from './world/layout.js';
import { createMaterials } from './world/materials.js';
import { buildArchitecture } from './world/architecture.js';
import { buildProps } from './world/props.js';
import { buildLights } from './world/lights.js';
import { buildGallery } from './world/gallery.js';
import { buildParadiseFactory } from './world/paradiseFactory.js';
import { buildLetItFlow } from './world/letItFlow.js';
import { createPost } from './fx/post.js';
import { Ambience } from './audio/ambience.js';
import { FirstPersonControls } from './controls.js';
import { Tour } from './tour.js';
import { setupPanels } from './ui/panels.js';
import { setupViewer } from './ui/viewer.js';
import { setupMinimap } from './ui/minimap.js';
import { setupKeypad } from './ui/keypad.js';
import { localize, onLangChange, setText } from './i18n.js';

localize(data);

const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const lowPower = isTouch || (navigator.hardwareConcurrency || 8) <= 4;
document.body.classList.toggle('touch', isTouch);

// ---------------------------------------------------------------- renderer
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false, // MSAA happens in the composer (desktop) — cheaper than a full AA backbuffer
  powerPreference: 'high-performance',
  stencil: false,
  depth: false,
});
const MAX_DPR = isTouch ? 1.5 : 1.75;
let dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
renderer.setPixelRatio(dpr);
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050506);
scene.fog = new THREE.Fog(0x050506, 18, 40);

const camera = new THREE.PerspectiveCamera(isTouch ? 72 : 66, window.innerWidth / window.innerHeight, 0.05, 60);

// ---------------------------------------------------------------- loading
const manager = new THREE.LoadingManager();
const progressBar = document.getElementById('progress-bar');
const progressLabel = document.getElementById('progress-label');
const enterBtn = document.getElementById('enter');
let worldReady = false;
manager.onProgress = (_url, loaded, total) => {
  const p = total ? loaded / total : 1;
  // Late files after the 12 s safety net must not overwrite "Ready".
  if (worldReady) return;
  progressBar.style.width = `${Math.round(p * 100)}%`;
  setText(progressLabel, 'loader.loading', { loaded, total });
};

// ---------------------------------------------------------------- world
const materials = createMaterials(renderer, manager);
const arch = buildArchitecture(materials);
scene.add(arch.group);
const props = buildProps(materials);
scene.add(props.group);
scene.add(buildParadiseFactory(materials));
const lights = buildLights(scene);
const gallery = buildGallery(data, materials, manager, renderer);
scene.add(gallery.group);
const letItFlow = buildLetItFlow(manager);
scene.add(letItFlow.group);

const controls = new FirstPersonControls(camera, canvas, arch.segments);
const r1 = roomById('r1');
controls.setPose(r1.spawn.x, r1.spawn.z, 0);
controls.lookAt(r1.spawn.look.x, r1.spawn.look.z);

const post = createPost(renderer, scene, camera, { lowPower });
const audio = new Ambience();

// ---------------------------------------------------------------- UI
let entered = false;
const blockers = { panel: false, viewer: false };
const syncEnabled = () => {
  controls.enabled = entered && !blockers.panel && !blockers.viewer && !tour.active;
  document.body.classList.toggle('overlay', blockers.panel || blockers.viewer);
};

const ui = setupPanels(data, {
  onOpenWork: (w) => { ui.close(); viewer.open(w); },
  onOpenPanel: () => { blockers.panel = true; controls.unlock(); syncEnabled(); },
  onClosePanel: () => { blockers.panel = false; syncEnabled(); },
  onJumpRoom: (id) => jumpToRoom(id),
});

const viewer = setupViewer(data, {
  onOpen: () => { blockers.viewer = true; if (tour.active) tour.stop(); controls.unlock(); syncEnabled(); },
  onClose: () => { blockers.viewer = false; syncEnabled(); },
  onGoto: (w) => gotoWork(w),
});

// Guided tour: the works in catalogue order, routed through the doorways.
const DOORS = {
  'r1>r2': [[4.95, 4.12], [6.35, 4.12]],
  'r2>r3': [[9.25, 3.4], [10.5, 3.4]],
  'r3>r4': [[15.05, 3.9], [16.15, 3.9]],
};
function buildTourStops() {
  const r1 = roomById('r1');
  const stops = [{ x: r1.spawn.x, z: r1.spawn.z, look: [r1.spawn.look.x, 1.5, r1.spawn.look.z], intro: true, dwell: 4 }];
  let room = 'r1';
  for (const w of data.works) {
    if (!w._focus) continue;
    if (w.room !== room) {
      for (const [x, z] of DOORS[`${room}>${w.room}`] || []) stops.push({ x, z, look: null, dwell: 0 });
      room = w.room;
    }
    stops.push({ x: w._focus.x, z: w._focus.z, look: w._focus.look, work: w.id, dwell: 5 });
  }
  return stops;
}
data.tour = buildTourStops();
const tour = new Tour(data, controls, document.getElementById('tour-caption'));
const tourBtn = document.querySelector('[data-action="tour"]');
const syncTourBtn = () => {
  tourBtn.classList.toggle('on', tour.active);
  setText(tourBtn.querySelector('.lbl'), tour.active ? 'hud.stop' : 'hud.tour');
  tourBtn.querySelector('.ico').textContent = tour.active ? '■' : '▶';
};
syncTourBtn();
tour.onEnd = () => {
  document.body.classList.remove('touring');
  syncTourBtn();
  syncEnabled();
};
function toggleTour() {
  if (tour.active) { tour.stop(); return; }
  viewer.close();
  ui.close();
  controls.unlock();
  document.body.classList.add('touring');
  tour.start();
  syncTourBtn();
  syncEnabled();
}

const soundBtn = document.querySelector('[data-action="sound"]');
function toggleSound() {
  audio.setMuted(!audio.muted);
  soundBtn.classList.toggle('muted', audio.muted);
}

function teleport(x, z, lookX, lookZ, pitch = 0) {
  if (tour.active) tour.stop();
  controls.setPose(x, z, 0);
  controls.lookAt(lookX, lookZ);
  controls.pitch = pitch;
  post.trigger(0.9);
  audio.glitchBurst();
}
function jumpToRoom(id) {
  const r = roomById(id);
  teleport(r.spawn.x, r.spawn.z, r.spawn.look.x, r.spawn.look.z);
}
function gotoWork(w) {
  const f = w._focus;
  if (!f) return;
  if (!entered && worldReady) enter();
  const d = Math.hypot(f.look[0] - f.x, f.look[2] - f.z);
  teleport(f.x, f.z, f.look[0], f.look[2], Math.atan2(f.look[1] - EYE, d) * 0.8);
}

document.getElementById('toolbar').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-action]');
  if (!b) return;
  const a = b.dataset.action;
  if (a === 'rooms') ui.toggleRooms();
  else if (a === 'tour') toggleTour();
  else if (a === 'sound') toggleSound();
});
// Navbar sections open as panels, on the title screen as well as in the exhibition.
document.getElementById('site-nav').addEventListener('click', (e) => {
  const b = e.target.closest('[data-nav]');
  if (b) ui.show(b.dataset.nav);
});
window.addEventListener('keydown', (e) => {
  if (!entered || viewer.isOpen() || ui.isOpen()) return;
  if (e.code === 'KeyT') toggleTour();
  else if (e.code === 'KeyM') toggleSound();
  else if (tour.active && ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Escape'].includes(e.code)) tour.stop();
});
// Touching the joystick ends the tour on mobile; the wheel or an on-screen key on desktop
document.getElementById('joystick').addEventListener('touchstart', () => tour.stop(), { passive: true });
controls.onManualMove = () => tour.stop();
const updateKeypad = setupKeypad(document.getElementById('keypad'), controls);

const minimap = setupMinimap(document.getElementById('minimap'), arch.segments, data.works, (id) => jumpToRoom(id));

// ---------------------------------------------------------------- picking
const raycaster = new THREE.Raycaster();
raycaster.far = 7.5;
const ndc = new THREE.Vector2();
const tmpV2 = new THREE.Vector2();
const promptEl = document.getElementById('prompt');
const crosshair = document.getElementById('crosshair');
let hovered = null;
let mouseInside = false;
canvas.addEventListener('mousemove', (e) => {
  mouseInside = true;
  if (!controls.locked) ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
});
canvas.addEventListener('mouseleave', () => { mouseInside = false; });

function pick(x, y) {
  raycaster.setFromCamera(tmpV2.set(x, y), camera);
  const hit = raycaster.intersectObjects(gallery.hitMeshes, false)[0];
  return hit ? hit.object.userData : null;
}
function updateHover() {
  let ud = null;
  if (controls.enabled && !isTouch) {
    if (controls.locked) ud = pick(0, 0);
    else if (mouseInside) ud = pick(ndc.x, ndc.y);
  }
  const target = ud && (ud.work || ud.text || null);
  if (target !== hovered) {
    hovered = target;
    crosshair.classList.toggle('active', !!hovered);
    promptEl.classList.toggle('show', !!hovered);
    canvas.style.cursor = hovered && !controls.locked ? 'pointer' : '';
    if (hovered === 'text') setText(promptEl, 'hud.promptText');
    else if (hovered === 'roomsheet') setText(promptEl, 'hud.promptSheet');
    else if (hovered) setText(promptEl, 'hud.promptWork', { no: hovered.no, title: hovered.title });
  }
}
function activate(ud) {
  if (!ud) return false;
  if (ud.work) { viewer.open(ud.work); return true; }
  if (ud.text === 'roomsheet') { ui.works(); return true; }
  if (ud.text) { ui.about(); return true; }
  return false;
}
controls.onTap = (x, y, touch) => {
  if (activate(pick((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1))) return;
  if (!touch && !controls.locked) controls.lock();
};
canvas.addEventListener('click', () => {
  if (controls.locked && controls.enabled) activate(pick(0, 0));
});
window.addEventListener('keydown', (e) => {
  if (!entered || viewer.isOpen() || ui.isOpen()) return;
  if (e.code === 'KeyE' || e.code === 'Enter') activate(pick(0, 0));
});
// During the tour (controls disabled) a click / tap opens the work in view
canvas.addEventListener('pointerup', () => {
  if (!tour.active) return;
  const ud = pick(0, 0);
  if (ud && ud.work) viewer.open(ud.work);
});

// ---------------------------------------------------------------- rooms
const roomName = document.querySelector('#room-label .room-name');
const roomSub = document.querySelector('#room-label .room-sub');
let currentRoom = null;
let currentRoomId = 'r1';
function updateRoom() {
  const r = roomAt(controls.pos.x, controls.pos.y);
  const key = r ? r.id : null;
  if (key && key !== currentRoom) {
    const first = currentRoom === null;
    currentRoom = key;
    currentRoomId = r.id;
    setText(roomName, `rooms.${r.id}.name`);
    setText(roomSub, `rooms.${r.id}.subtitle`);
    if (!first) {
      post.trigger(0.75);
      audio.glitchBurst();
    }
  }
}

// ---------------------------------------------------------------- enter
function enter() {
  entered = true;
  document.body.classList.add('entered');
  document.getElementById('loader').classList.add('gone');
  document.getElementById('hud').hidden = false;
  audio.start();
  syncEnabled();
  if (!isTouch) controls.lock();
  post.trigger(1);
}
enterBtn.addEventListener('click', enter);
controls.onLockChange = (locked) => document.body.classList.toggle('locked', locked);

// ---------------------------------------------------------------- resize
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.fov = w < h ? 78 : isTouch ? 72 : 66;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  post.setSize(w, h);
}
window.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- adaptive resolution
// Drop the pixel ratio if frames are slow for a while; raise it again when there's headroom.
let perfAcc = 0;
let perfFrames = 0;
function adapt(dt) {
  perfAcc += dt;
  perfFrames++;
  if (perfAcc < 2) return;
  const avg = perfAcc / perfFrames;
  perfAcc = 0;
  perfFrames = 0;
  const max = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  let next = dpr;
  if (avg > 1 / 45 && dpr > 0.75) next = Math.max(0.75, dpr - 0.25);
  else if (avg < 1 / 58 && dpr < max) next = Math.min(max, dpr + 0.125);
  if (next !== dpr) {
    dpr = next;
    renderer.setPixelRatio(dpr);
    resize();
  }
}

// ---------------------------------------------------------------- loop
const timer = new THREE.Timer();
timer.connect(document);
function frame() {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.1);
  const t = timer.getElapsed();
  if (tour.active) tour.update(dt);
  controls.update(dt);
  updateRoom();
  const bands = audio.update(controls.pos.x, controls.pos.y, controls.yaw, dt, t);
  for (const fn of props.anim) fn(t, dt);
  gallery.update(t, dt, camera.position);
  letItFlow.update(t, lights.proj);
  updateHover();
  if (entered) {
    minimap(controls.pos.x, controls.pos.y, controls.yaw, currentRoomId, t);
    updateKeypad();
  }
  post.update(dt, bands);
  post.render(dt);
  if (entered && !window.__apNoAdapt) adapt(dt);
}

// Compile shaders up-front so the first steps don't stutter, then reveal Enter.
renderer.compile(scene, camera);
renderer.setAnimationLoop(frame);
function markReady() {
  if (worldReady) return;
  worldReady = true;
  document.body.dataset.state = 'ready';
  progressLabel.classList.remove('error');
  progressBar.style.width = '100%';
  setText(progressLabel, 'loader.ready');
  enterBtn.disabled = false;
  enterBtn.focus({ preventScroll: true });
}
manager.onLoad = markReady;
// Safety net: never block the Enter button for more than 12 s on a slow network.
setTimeout(markReady, 12000);

// ---------------------------------------------------------------- language
// Static markup is re-translated by i18n.js; here everything built from the data.
onLangChange(() => {
  localize(data);
  ui.refresh();
  viewer.refresh();
  tour.refresh();
  gallery.relabel();
  hovered = null;
});

// Debug handle for screenshots / tinkering in the console.
window.__ap = { scene, camera, controls, renderer, lights, jumpToRoom, gotoWork, ROOMS, ui, viewer, tour, post, audio, data };
