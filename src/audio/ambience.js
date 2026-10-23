// Generative ambience, synthesised live with the Web Audio API (no samples, no music):
//  - a slow, detuned drone whose chord drifts every ~20 s
//  - filtered room tone (air handling / basement hum)
//  - a bar murmur near Room 2: formant-filtered noise "voices" + glass clinks
//  - the projector's fan in Room 4
// An AnalyserNode on the master bus exposes bass/mid/high/level for the visuals.
// None of it is part of the artworks: the videos' own soundtracks are not reproduced.

const BAR = { x: 8.6, z: 4.6 };
const PROJ = { x: 17.4, z: 3.83 };

function noiseBuffer(ctx, seconds = 4, pink = true) {
  const len = ctx.sampleRate * seconds;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (pink) {
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18;
    } else d[i] = w;
  }
  return buf;
}

export class Ambience {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.bands = { bass: 0, mid: 0, high: 0, level: 0, glitch: 0 };
    this._glitch = 0;
  }

  start() {
    if (this.ctx) {
      this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    const now = ctx.currentTime;

    this.master = ctx.createGain();
    this.master.gain.setValueAtTime(0, now);
    this.master.gain.linearRampToValueAtTime(0.9, now + 4);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    this.master.connect(comp).connect(ctx.destination);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.75;
    comp.connect(this.analyser);
    this.freq = new Uint8Array(this.analyser.frequencyBinCount);

    // Reverb-ish space: a short feedback delay network for "basement" tail
    this.space = ctx.createGain();
    this.space.gain.value = 0.35;
    const d1 = ctx.createDelay(1);
    const d2 = ctx.createDelay(1);
    d1.delayTime.value = 0.113;
    d2.delayTime.value = 0.171;
    const fb = ctx.createGain();
    fb.gain.value = 0.55;
    const damp = ctx.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 2200;
    this.space.connect(d1);
    d1.connect(d2).connect(damp).connect(fb).connect(d1);
    damp.connect(this.master);

    this._drone();
    this._roomTone();
    this._bar();
    this._projection();
  }

  _drone() {
    const ctx = this.ctx;
    const bus = ctx.createGain();
    bus.gain.value = 0.11;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    lp.Q.value = 2;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.045;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 220;
    lfo.connect(lfoGain).connect(lp.frequency);
    lfo.start();
    lp.connect(bus);
    bus.connect(this.master);
    bus.connect(this.space);
    this.droneOsc = [];
    const base = [55, 82.41, 110.0, 164.81];
    base.forEach((f, i) => {
      for (const det of [-6, 5]) {
        const o = ctx.createOscillator();
        o.type = i === 0 ? 'sine' : 'sawtooth';
        o.frequency.value = f;
        o.detune.value = det + (Math.random() - 0.5) * 4;
        const g = ctx.createGain();
        g.gain.value = i === 0 ? 0.6 : 0.16 / (i + 0.5);
        o.connect(g).connect(lp);
        o.start();
        this.droneOsc.push(o);
      }
    });
    // chord drift: A -> F -> C -> G (as ratios on the upper voices)
    const chords = [
      [55, 82.41, 110.0, 164.81],
      [43.65, 87.31, 130.81, 174.61],
      [65.41, 98.0, 130.81, 196.0],
      [49.0, 73.42, 123.47, 146.83],
    ];
    let ci = 0;
    const next = () => {
      ci = (ci + 1) % chords.length;
      const t = ctx.currentTime;
      this.droneOsc.forEach((o, k) => {
        o.frequency.cancelScheduledValues(t);
        o.frequency.setValueAtTime(o.frequency.value, t);
        o.frequency.exponentialRampToValueAtTime(chords[ci][k >> 1], t + 6);
      });
    };
    this._chordTimer = setInterval(next, 21000);
  }

  _roomTone() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, 6, true);
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 320;
    bp.Q.value = 0.7;
    const hum = ctx.createOscillator();
    hum.frequency.value = 50; // mains hum
    const humG = ctx.createGain();
    humG.gain.value = 0.012;
    hum.connect(humG).connect(this.master);
    hum.start();
    const g = ctx.createGain();
    g.gain.value = 0.16;
    src.connect(bp).connect(g).connect(this.master);
    src.start();
    this.roomGain = g;
  }

  _bar() {
    const ctx = this.ctx;
    this.barGain = ctx.createGain();
    this.barGain.gain.value = 0;
    this.barPan = ctx.createStereoPanner();
    this.barGain.connect(this.barPan).connect(this.master);
    this.barPan.connect(this.space);
    // A handful of "voices": noise through moving formant filters, gated like syllables
    const buf = noiseBuffer(ctx, 5, true);
    for (let v = 0; v < 5; v++) {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.loopStart = Math.random() * 3;
      const f1 = ctx.createBiquadFilter();
      f1.type = 'bandpass';
      f1.Q.value = 6;
      f1.frequency.value = 500;
      const f2 = ctx.createBiquadFilter();
      f2.type = 'bandpass';
      f2.Q.value = 9;
      f2.frequency.value = 1400;
      const gate = ctx.createGain();
      gate.gain.value = 0;
      const sum = ctx.createGain();
      sum.gain.value = 1.4;
      src.connect(f1).connect(gate);
      src.connect(f2).connect(gate);
      gate.connect(sum).connect(this.barGain);
      src.start(0, Math.random() * 3);
      const pitch = 0.75 + Math.random() * 0.6;
      const speak = () => {
        const t = ctx.currentTime;
        // a phrase of syllables, then a pause
        const n = 3 + Math.floor(Math.random() * 9);
        let tt = t + 0.05;
        for (let i = 0; i < n; i++) {
          const dur = 0.08 + Math.random() * 0.16;
          const amp = 0.25 + Math.random() * 0.45;
          gate.gain.setTargetAtTime(amp, tt, 0.02);
          gate.gain.setTargetAtTime(0.0, tt + dur, 0.03);
          f1.frequency.setTargetAtTime((350 + Math.random() * 500) * pitch, tt, 0.03);
          f2.frequency.setTargetAtTime((1000 + Math.random() * 1400) * pitch, tt, 0.03);
          tt += dur + 0.03 + Math.random() * 0.06;
        }
        setTimeout(speak, (tt - t) * 1000 + 300 + Math.random() * 2500);
      };
      setTimeout(speak, Math.random() * 3000);
    }
    // glass clinks
    const clink = () => {
      if (this.barGain.gain.value > 0.05) {
        const t = ctx.currentTime;
        const f = 2400 + Math.random() * 2600;
        for (const k of [1, 2.76]) {
          const o = ctx.createOscillator();
          o.frequency.value = f * k;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.05 / k, t + 0.004);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5 + Math.random() * 0.4);
          o.connect(g).connect(this.barGain);
          o.start(t);
          o.stop(t + 1);
        }
      }
      setTimeout(clink, 1500 + Math.random() * 5000);
    };
    setTimeout(clink, 2000);
  }

  _projection() {
    const ctx = this.ctx;
    this.projGain = ctx.createGain();
    this.projGain.gain.value = 0;
    this.projGain.connect(this.master);
    this.projGain.connect(this.space);
    // projector fan
    const fan = ctx.createBufferSource();
    fan.buffer = noiseBuffer(ctx, 3, false);
    fan.loop = true;
    const fbp = ctx.createBiquadFilter();
    fbp.type = 'bandpass';
    fbp.frequency.value = 2400;
    fbp.Q.value = 0.8;
    const fg = ctx.createGain();
    fg.gain.value = 0.012;
    fan.connect(fbp).connect(fg).connect(this.projGain);
    fan.start();
  }

  // Short digital burst used when crossing between rooms.
  glitchBurst() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, 0.3, false);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    for (let i = 0; i < 4; i++) {
      g.gain.setValueAtTime(0.09 * Math.random(), t + i * 0.045);
      g.gain.setValueAtTime(0, t + i * 0.045 + 0.02);
    }
    src.connect(bp).connect(g).connect(this.master);
    src.start(t);
  }

  setMuted(m) {
    this.muted = m;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(m ? 0 : 0.9, t, 0.25);
  }

  // Called every frame with the listener position (x, z) and yaw.
  update(x, z, yaw, dt, t) {
    this._glitch = Math.max(0, this._glitch - dt * 2.5);
    if (!this.ctx) {
      // Silent fallback so the visuals still breathe without audio
      const b = 0.5 + 0.5 * Math.sin(t * 3.8);
      this.bands.bass = Math.pow(b, 6) * 0.6;
      this.bands.mid = 0.3 + 0.2 * Math.sin(t * 0.7);
      this.bands.high = 0.2 + 0.2 * Math.sin(t * 2.3);
      this.bands.level = 0.35;
      this.bands.glitch = Math.random() < 0.004 ? 1 : this.bands.glitch * 0.9;
      return this.bands;
    }
    const ct = this.ctx.currentTime;
    // distance-based mixes
    const dBar = Math.hypot(x - BAR.x, z - BAR.z);
    const barLevel = Math.max(0, 1 - dBar / 9) ** 1.6;
    this.barGain.gain.setTargetAtTime(barLevel * 0.55, ct, 0.3);
    const ang = Math.atan2(-(BAR.x - x), -(BAR.z - z)) - yaw;
    this.barPan.pan.setTargetAtTime(Math.max(-0.8, Math.min(0.8, -Math.sin(ang))), ct, 0.2);
    const dProj = Math.hypot(x - PROJ.x, z - PROJ.z);
    const projLevel = Math.max(0, 1 - dProj / 7);
    this.projGain.gain.setTargetAtTime(projLevel * 0.9, ct, 0.4);
    this.roomGain.gain.setTargetAtTime(x > 15.6 ? 0.1 : 0.16, ct, 0.5);

    // spectrum -> bands
    this.analyser.getByteFrequencyData(this.freq);
    const hz = this.ctx.sampleRate / this.analyser.fftSize;
    const avg = (lo, hi) => {
      let s = 0;
      let n = 0;
      for (let i = Math.floor(lo / hz); i <= Math.min(this.freq.length - 1, Math.ceil(hi / hz)); i++) { s += this.freq[i]; n++; }
      return n ? s / n / 255 : 0;
    };
    const k = Math.min(1, dt * 12);
    this.bands.bass += (Math.min(1, avg(30, 120) * 1.3) - this.bands.bass) * k;
    this.bands.mid += (Math.min(1, avg(250, 2000) * 2.2) - this.bands.mid) * k;
    this.bands.high += (Math.min(1, avg(2500, 9000) * 4) - this.bands.high) * k;
    this.bands.level += (Math.min(1, avg(30, 9000) * 2.2) - this.bands.level) * k;
    this.bands.glitch = this._glitch;
    return this.bands;
  }
}
