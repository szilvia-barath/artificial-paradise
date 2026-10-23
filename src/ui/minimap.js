import { ROOMS } from '../world/layout.js';

// Corner minimap: walls (from the collision segments), works, current room highlight
// and the visitor as a view cone. Click a room on the map to jump there.

export function setupMinimap(canvas, segments, works, onJump) {
  const ctx = canvas.getContext('2d');
  const bounds = { x0: -0.6, x1: 26.2, z0: -0.6, z1: 7.9 };
  let W = 0;
  let H = 0;
  let s = 1;
  let ox = 0;
  let oy = 0;
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = r.width;
    H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const pad = 8;
    s = Math.max(0, Math.min((W - pad * 2) / (bounds.x1 - bounds.x0), (H - pad * 2) / (bounds.z1 - bounds.z0)));
    ox = (W - (bounds.x1 - bounds.x0) * s) / 2 - bounds.x0 * s;
    oy = (H - (bounds.z1 - bounds.z0) * s) / 2 - bounds.z0 * s;
  };
  resize();
  window.addEventListener('resize', resize);
  const X = (x) => ox + x * s;
  const Y = (z) => oy + z * s;

  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left - ox) / s;
    const z = (e.clientY - r.top - oy) / s;
    const room = ROOMS.find((rm) => x >= rm.x0 && x <= rm.x1 && z >= rm.z0 && z <= rm.z1);
    if (room) onJump(room.id);
  });

  return (px, pz, yaw, roomId, t) => {
    // The HUD starts hidden, so measure lazily once it is on screen.
    if (W < 10 || canvas.getBoundingClientRect().width !== W) resize();
    if (W < 10 || s <= 0) return;
    ctx.clearRect(0, 0, W, H);
    for (const r of ROOMS) {
      ctx.fillStyle = r.id === roomId ? 'rgba(157,255,106,0.12)' : 'rgba(255,255,255,0.04)';
      ctx.fillRect(X(r.x0), Y(r.z0), (r.x1 - r.x0) * s, (r.z1 - r.z0) * s);
      ctx.fillStyle = r.id === roomId ? 'rgba(157,255,106,0.9)' : 'rgba(255,255,255,0.4)';
      ctx.font = '9px ui-monospace, Menlo, monospace';
      ctx.fillText(r.id.replace('r', ''), X(r.x0) + 3, Y(r.z0) + 10);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const [[ax, az], [bx, bz]] of segments) {
      ctx.moveTo(X(ax), Y(az));
      ctx.lineTo(X(bx), Y(bz));
    }
    ctx.stroke();
    // works
    for (const w of works) {
      const f = w._pin;
      if (!f) continue;
      ctx.fillStyle = w.type === 'video' || w.type === 'projection' ? '#5fe7ff' : '#ff4fa3';
      ctx.fillRect(X(f.x) - 1.5, Y(f.z) - 1.5, 3, 3);
    }
    // visitor view cone
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const spread = 0.55;
    const len = 2.6;
    const lx = fx * Math.cos(spread) - fz * Math.sin(spread);
    const lz = fx * Math.sin(spread) + fz * Math.cos(spread);
    const rx = fx * Math.cos(-spread) - fz * Math.sin(-spread);
    const rz = fx * Math.sin(-spread) + fz * Math.cos(-spread);
    const g = ctx.createRadialGradient(X(px), Y(pz), 0, X(px), Y(pz), len * s);
    g.addColorStop(0, 'rgba(157,255,106,0.55)');
    g.addColorStop(1, 'rgba(157,255,106,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(X(px), Y(pz));
    ctx.lineTo(X(px + lx * len), Y(pz + lz * len));
    ctx.lineTo(X(px + rx * len), Y(pz + rz * len));
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#9dff6a';
    ctx.beginPath();
    ctx.arc(X(px), Y(pz), 2.6 + Math.sin(t * 4) * 0.4, 0, Math.PI * 2);
    ctx.fill();
  };
}
