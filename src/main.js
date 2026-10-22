import * as THREE from 'three';
import './style.css';
import data from './data/exhibition.json';
import { ROOMS, roomAt, roomById } from './world/layout.js';
import { createMaterials } from './world/materials.js';
import { buildArchitecture } from './world/architecture.js';
import { buildProps } from './world/props.js';
import { buildLights } from './world/lights.js';
import { FirstPersonControls } from './controls.js';
import { setupPanels } from './ui/panels.js';
import { buildGallery } from './world/gallery.js';
import { setupViewer } from './ui/viewer.js';
import { EYE } from './world/layout.js';

const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
document.body.classList.toggle('touch', isTouch);

// ---------------------------------------------------------------- renderer
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  powerPreference: 'high-performance',
  stencil: false,
});
const MAX_DPR = isTouch ? 1.5 : 1.75;
let dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
renderer.setPixelRatio(dpr);
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050506);
scene.fog = new THREE.Fog(0x050506, 14, 30);

const camera = new THREE.PerspectiveCamera(isTouch ? 72 : 66, window.innerWidth / window.innerHeight, 0.05, 60);

// ---------------------------------------------------------------- loading
const manager = new THREE.LoadingManager();
const progressBar = document.getElementById('progress-bar');
const progressLabel = document.getElementById('progress-label');
const enterBtn = document.getElementById('enter');
let worldReady = false;
manager.onProgress = (_url, loaded, total) => {
  const p = total ? loaded / total : 1;
  progressBar.style.width = `${Math.round(p * 100)}%`;
  progressLabel.textContent = `Hanging the works… ${loaded}/${total}`;
};

// ---------------------------------------------------------------- world
const materials = createMaterials(renderer);
const arch = buildArchitecture(materials);
scene.add(arch.group);
const props = buildProps(materials, arch.stairwell);
scene.add(props.group);
const lights = buildLights(scene);

const gallery = buildGallery(data, materials, manager, renderer);
scene.add(gallery.group);

const controls = new FirstPersonControls(camera, canvas, arch.segments);
const r1 = roomById('r1');
controls.setPose(r1.spawn.x, r1.spawn.z, 0);
controls.lookAt(r1.spawn.look.x, r1.spawn.look.z);

// ---------------------------------------------------------------- UI
const ui = setupPanels(data, {
  onOpenPanel: () => {
    controls.enabled = false;
    controls.unlock();
  },
  onClosePanel: () => {
    controls.enabled = entered;
  },
  onJumpRoom: (id) => jumpToRoom(id),
});

const viewer = setupViewer(data, {
  onOpen: () => {
    controls.enabled = false;
    controls.unlock();
  },
  onClose: () => {
    controls.enabled = entered;
  },
  onGoto: (w) => gotoWork(w),
});

function gotoWork(w) {
  const f = w._focus;
  if (!f) return;
  controls.setPose(f.x, f.z, 0);
  controls.lookAt(f.look[0], f.look[2]);
  const d = Math.hypot(f.look[0] - f.x, f.look[2] - f.z);
  controls.pitch = Math.atan2(f.look[1] - EYE, d) * 0.8;
}

// ---------------------------------------------------------------- picking
const raycaster = new THREE.Raycaster();
raycaster.far = 7.5;
const ndc = new THREE.Vector2();
const prompt = document.getElementById('prompt');
const crosshair = document.getElementById('crosshair');
let hovered = null;
let mouseInside = false;
canvas.addEventListener('mousemove', (e) => {
  mouseInside = true;
  if (!controls.locked) ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
});
canvas.addEventListener('mouseleave', () => { mouseInside = false; });

function pick(x, y) {
  raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
  const hit = raycaster.intersectObjects(gallery.hitMeshes, false)[0];
  return hit ? hit.object.userData : null;
}
function updateHover() {
  let ud = null;
  if (entered && controls.enabled && !isTouch) {
    if (controls.locked) ud = pick(0, 0);
    else if (mouseInside) ud = pick(ndc.x, ndc.y);
  }
  const target = ud && (ud.work || (ud.text ? 'text' : null));
  if (target !== hovered) {
    hovered = target;
    crosshair.classList.toggle('active', !!hovered);
    prompt.classList.toggle('show', !!hovered);
    canvas.style.cursor = hovered && !controls.locked ? 'pointer' : '';
    if (hovered === 'text') prompt.textContent = 'Click to read the exhibition text';
    else if (hovered) prompt.textContent = `Click to view · ${hovered.title}`;
  }
}
function activate(ud) {
  if (!ud) return false;
  if (ud.work) { viewer.open(ud.work); return true; }
  if (ud.text) { ui.about(); return true; }
  return false;
}
controls.onTap = (x, y, touch) => {
  const ud = pick((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
  if (activate(ud)) return;
  if (!touch && !controls.locked) controls.lock();
};
canvas.addEventListener('click', () => {
  if (controls.locked && controls.enabled) activate(pick(0, 0));
});
window.addEventListener('keydown', (e) => {
  if (!entered || viewer.isOpen() || ui.isOpen()) return;
  if (e.code === 'KeyE' || e.code === 'Enter') activate(pick(0, 0));
});

document.getElementById('toolbar').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-action]');
  if (!b) return;
  const a = b.dataset.action;
  if (a === 'about') ui.about();
  else if (a === 'bts') ui.bts();
  else if (a === 'rooms') ui.toggleRooms();
  else if (toolbarActions[a]) toolbarActions[a](b);
});
const toolbarActions = {};

const roomName = document.querySelector('#room-label .room-name');
const roomSub = document.querySelector('#room-label .room-sub');
let currentRoom = null;
function updateRoom() {
  const r = roomAt(controls.pos.x, controls.pos.y);
  const key = r ? r.id + (r.zone || '') : null;
  if (key && key !== currentRoom) {
    const first = currentRoom === null;
    currentRoom = key;
    roomName.textContent = r.name;
    roomSub.textContent = r.zone === 'dark' ? 'Projection room' : r.subtitle;
    if (!first) onRoomChange(r);
  }
  return r;
}
function onRoomChange(_r) {
  // Hooked by FX (glitch pulse) and audio in later milestones.
}

function jumpToRoom(id) {
  const r = roomById(id);
  controls.setPose(r.spawn.x, r.spawn.z, 0);
  controls.lookAt(r.spawn.look.x, r.spawn.look.z);
}

// ---------------------------------------------------------------- enter
let entered = false;
enterBtn.addEventListener('click', () => {
  entered = true;
  document.getElementById('loader').classList.add('gone');
  document.getElementById('hud').hidden = false;
  controls.enabled = true;
  if (!isTouch) controls.lock();
});
controls.onLockChange = (locked) => document.body.classList.toggle('locked', locked);

// ---------------------------------------------------------------- resize
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
window.addEventListener('resize', resize);

// ---------------------------------------------------------------- loop
const timer = new THREE.Timer();
timer.connect(document);
function frame() {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.1);
  const t = timer.getElapsed();
  controls.update(dt);
  updateRoom();
  for (const fn of props.anim) fn(t, dt);
  gallery.update(t, dt, camera.position, 0);
  updateHover();
  renderer.render(scene, camera);
}

// Compile shaders up-front so the first steps don't stutter, then reveal Enter.
renderer.compile(scene, camera);
renderer.setAnimationLoop(frame);
function markReady() {
  if (worldReady) return;
  worldReady = true;
  progressBar.style.width = '100%';
  progressLabel.textContent = 'Ready';
  enterBtn.disabled = false;
  enterBtn.focus({ preventScroll: true });
}
manager.onLoad = markReady;
// Safety net: never block the Enter button for more than 12 s on a slow network.
setTimeout(markReady, 12000);

// Debug handle for screenshots / tinkering in the console.
window.__ap = { scene, camera, controls, renderer, lights, jumpToRoom, ROOMS, ui, viewer, gotoWork, data };
