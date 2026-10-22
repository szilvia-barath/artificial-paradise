import * as THREE from 'three';
import { EYE } from './world/layout.js';

// Guided tour: flies the camera along the stops in exhibition.json ("tour"), easing
// between positions and turning to face each work while its caption fades in.

const SPEED = 1.15; // m/s

export class Tour {
  constructor(data, controls, captionEl) {
    this.data = data;
    this.controls = controls;
    this.caption = captionEl;
    this.active = false;
    this.onEnd = null;
    this.byId = Object.fromEntries(data.works.map((w) => [w.id, w]));
  }

  start() {
    this.active = true;
    this.i = -1;
    this._next();
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    this.caption.classList.remove('show');
    if (this.onEnd) this.onEnd();
  }

  _next() {
    this.i++;
    const stops = this.data.tour;
    if (this.i >= stops.length) {
      this.stop();
      return;
    }
    const s = stops[this.i];
    this.from = new THREE.Vector2(this.controls.pos.x, this.controls.pos.y);
    this.to = new THREE.Vector2(s.x, s.z);
    this.look = new THREE.Vector3(...s.look);
    this.travel = Math.max(0.8, this.from.distanceTo(this.to) / SPEED);
    this.dwell = s.dwell ?? 4;
    this.t = 0;
    this.shown = false;
    this.caption.classList.remove('show');
    const w = s.work ? this.byId[s.work] : null;
    this.text = w
      ? `<span class="t">${w.title} · ${w.medium.split(':')[0]}</span>${w.caption}`
      : s.text
        ? `<span class="t">Artificial Paradise</span>${s.text}`
        : '';
  }

  update(dt) {
    if (!this.active) return;
    const c = this.controls;
    this.t += dt;
    const k = Math.min(1, this.t / this.travel);
    const e = k * k * (3 - 2 * k);
    c.pos.set(this.from.x + (this.to.x - this.from.x) * e, this.from.y + (this.to.y - this.from.y) * e);
    c.vel.set(0, 0);
    // Turn smoothly toward the stop's focus point
    const dx = this.look.x - c.pos.x;
    const dz = this.look.z - c.pos.y;
    const targetYaw = Math.atan2(-dx, -dz);
    let dy = targetYaw - c.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    c.yaw += dy * Math.min(1, dt * 2.2);
    const targetPitch = Math.atan2(this.look.y - EYE, Math.hypot(dx, dz)) * 0.85;
    c.pitch += (targetPitch - c.pitch) * Math.min(1, dt * 2);
    if (k >= 1 && !this.shown && this.text) {
      this.caption.innerHTML = this.text;
      this.caption.classList.add('show');
      this.shown = true;
    }
    if (this.t >= this.travel + this.dwell) this._next();
  }
}
