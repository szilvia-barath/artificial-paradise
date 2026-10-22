import * as THREE from 'three';
import { EYE, OBSTACLES } from './world/layout.js';

// First-person controls: pointer-lock mouse look + WASD on desktop, virtual joystick +
// drag-to-look on touch devices. Collision is resolved in 2D against wall segments and
// furniture boxes (circle vs. segment).

const RADIUS = 0.28;
const WALK = 1.9;
const RUN = 3.6;

export class FirstPersonControls {
  constructor(camera, dom, segments) {
    this.camera = camera;
    this.dom = dom;
    this.enabled = false;
    this.yaw = 0;
    this.pitch = 0;
    this.pos = new THREE.Vector2(0, 0); // x, z
    this.vel = new THREE.Vector2(0, 0);
    this.keys = new Set();
    this.joy = new THREE.Vector2(0, 0);
    this.locked = false;
    this.bob = 0;
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.onTap = null; // (clientX, clientY) => void
    this.onLockChange = null;

    this.segments = segments.slice();
    for (const o of OBSTACLES) {
      this.segments.push([[o.x0, o.z0], [o.x1, o.z0]]);
      this.segments.push([[o.x1, o.z0], [o.x1, o.z1]]);
      this.segments.push([[o.x1, o.z1], [o.x0, o.z1]]);
      this.segments.push([[o.x0, o.z1], [o.x0, o.z0]]);
    }

    this._bindDesktop();
    this._bindTouch();
  }

  setPose(x, z, yaw, pitch = 0) {
    this.pos.set(x, z);
    this.vel.set(0, 0);
    this.yaw = yaw;
    this.pitch = pitch;
    this._apply(0);
  }

  lookAt(x, z) {
    this.yaw = Math.atan2(-(x - this.pos.x), -(z - this.pos.y));
  }

  lock() {
    if (!this.isTouch && this.dom.requestPointerLock) {
      try {
        const p = this.dom.requestPointerLock();
        if (p && p.catch) p.catch(() => {});
      } catch (e) { /* ignore */ }
    }
  }

  unlock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  _bindDesktop() {
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
      if (this.onLockChange) this.onLockChange(this.locked);
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked || !this.enabled) return;
      this.yaw -= e.movementX * 0.0022;
      this.pitch -= e.movementY * 0.0022;
      this.pitch = Math.max(-1.25, Math.min(1.25, this.pitch));
    });
    // Unlocked desktop fallback: drag to look
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let moved = 0;
    this.dom.addEventListener('mousedown', (e) => {
      if (this.locked || this.isTouch) return;
      dragging = true;
      moved = 0;
      lastX = e.clientX;
      lastY = e.clientY;
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging || this.locked || !this.enabled) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      moved += Math.abs(dx) + Math.abs(dy);
      this.yaw -= dx * 0.004;
      this.pitch = Math.max(-1.25, Math.min(1.25, this.pitch - dy * 0.004));
      lastX = e.clientX;
      lastY = e.clientY;
    });
    window.addEventListener('mouseup', (e) => {
      if (!dragging) return;
      dragging = false;
      if (moved < 6 && this.enabled && this.onTap) this.onTap(e.clientX, e.clientY, false);
    });
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  _bindTouch() {
    const joyEl = document.getElementById('joystick');
    const knob = document.getElementById('joystick-knob');
    if (!joyEl) return;
    let joyId = null;
    let cx = 0;
    let cy = 0;
    const R = 46;
    joyEl.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      joyId = t.identifier;
      const r = joyEl.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
      e.preventDefault();
    }, { passive: false });
    const moveJoy = (t) => {
      let dx = t.clientX - cx;
      let dy = t.clientY - cy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.joy.set(dx / R, dy / R);
    };
    const endJoy = () => {
      joyId = null;
      knob.style.transform = '';
      this.joy.set(0, 0);
    };

    // Look: any touch that does not start on the joystick or UI
    const looks = new Map();
    this.dom.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        looks.set(t.identifier, { x: t.clientX, y: t.clientY, sx: t.clientX, sy: t.clientY, t0: performance.now() });
      }
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === joyId) { moveJoy(t); continue; }
        const l = looks.get(t.identifier);
        if (!l || !this.enabled) continue;
        this.yaw -= (t.clientX - l.x) * 0.0055;
        this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch - (t.clientY - l.y) * 0.0045));
        l.x = t.clientX;
        l.y = t.clientY;
      }
      if (joyId !== null) e.preventDefault();
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === joyId) { endJoy(); continue; }
        const l = looks.get(t.identifier);
        if (l) {
          const dist = Math.hypot(t.clientX - l.sx, t.clientY - l.sy);
          if (dist < 10 && performance.now() - l.t0 < 350 && this.enabled && this.onTap) {
            this.onTap(t.clientX, t.clientY, true);
          }
          looks.delete(t.identifier);
        }
      }
    };
    window.addEventListener('touchend', end);
    window.addEventListener('touchcancel', end);
  }

  _input() {
    const k = this.keys;
    let f = 0;
    let s = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) f += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) f -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) s += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) s -= 1;
    f -= this.joy.y;
    s += this.joy.x;
    const len = Math.hypot(f, s);
    if (len > 1) { f /= len; s /= len; }
    const run = k.has('ShiftLeft') || k.has('ShiftRight') || Math.hypot(this.joy.x, this.joy.y) > 0.92;
    return { f, s, speed: run ? RUN : WALK };
  }

  _collide() {
    // Iterate a few times so corners resolve cleanly.
    for (let iter = 0; iter < 3; iter++) {
      for (const [[ax, az], [bx, bz]] of this.segments) {
        const px = this.pos.x;
        const pz = this.pos.y;
        const dx = bx - ax;
        const dz = bz - az;
        const l2 = dx * dx + dz * dz;
        let t = l2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
        t = Math.max(0, Math.min(1, t));
        const cx = ax + dx * t;
        const cz = az + dz * t;
        let nx = px - cx;
        let nz = pz - cz;
        const d = Math.hypot(nx, nz);
        if (d < RADIUS) {
          if (d < 1e-6) { nx = -dz; nz = dx; } else { nx /= d; nz /= d; }
          const push = RADIUS - d;
          this.pos.x += nx * push;
          this.pos.y += nz * push;
          // remove velocity into the wall
          const vn = this.vel.x * nx + this.vel.y * nz;
          if (vn < 0) { this.vel.x -= vn * nx; this.vel.y -= vn * nz; }
        }
      }
    }
  }

  update(dt) {
    if (this.enabled) {
      const { f, s, speed } = this._input();
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);
      // forward = (-sin, -cos), right = (cos, -sin)
      const tx = (-sin * f + cos * s) * speed;
      const tz = (-cos * f - sin * s) * speed;
      const a = 1 - Math.exp(-dt * 10);
      this.vel.x += (tx - this.vel.x) * a;
      this.vel.y += (tz - this.vel.y) * a;
      // Substeps keep collision stable at low frame rates
      const steps = Math.max(1, Math.ceil(dt / 0.016));
      for (let i = 0; i < steps; i++) {
        this.pos.x += (this.vel.x * dt) / steps;
        this.pos.y += (this.vel.y * dt) / steps;
        this._collide();
      }
    }
    this._apply(dt);
  }

  _apply(dt) {
    const speed = this.vel.length();
    this.bob += dt * speed * 5.2;
    const bobY = Math.sin(this.bob) * 0.018 * Math.min(1, speed / WALK);
    this.camera.position.set(this.pos.x, EYE + bobY, this.pos.y);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}
