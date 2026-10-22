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
canvas.addEventListener('click', () => {
  if (entered && !controls.locked && !isTouch && controls.enabled) controls.lock();
});

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
// No queued assets in M1 -> ready immediately after first frame.
requestAnimationFrame(() => requestAnimationFrame(markReady));

// Debug handle for screenshots / tinkering in the console.
window.__ap = { scene, camera, controls, renderer, lights, jumpToRoom, ROOMS, ui };
