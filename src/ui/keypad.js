// On-screen keys: walk, turn and zoom (desktop), zoom only on touch. Holding a keycap
// works like holding the real key; the real keys light the keycaps up, so the cluster
// doubles as a legend. The Shift keycap toggles running, since a mouse can't hold two
// keycaps at once.

export function setupKeypad(el, controls) {
  const caps = [...el.querySelectorAll('[data-keys]')].map((cap) => ({ cap, codes: cap.dataset.keys.split(' ') }));

  for (const { cap, codes } of caps) {
    if (cap.hasAttribute('data-toggle')) {
      cap.addEventListener('pointerdown', (e) => e.preventDefault()); // keep focus off the keycap
      cap.addEventListener('click', () => {
        controls.runLock = !controls.runLock;
        cap.setAttribute('aria-pressed', String(controls.runLock));
      });
      continue;
    }
    const code = codes[0];
    cap.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      cap.setPointerCapture(e.pointerId);
      controls.press(code);
    });
    const up = () => controls.release(code);
    cap.addEventListener('pointerup', up);
    cap.addEventListener('pointercancel', up);
    cap.addEventListener('lostpointercapture', up);
  }

  const lit = (code) => {
    if (code === 'ZoomIn') return controls.zoomDir() > 0;
    if (code === 'ZoomOut') return controls.zoomDir() < 0;
    return controls.isDown(code);
  };

  // Called every frame: light the keycaps whose keys are down.
  return () => {
    for (const { cap, codes } of caps) {
      const on = codes.some(lit) || (cap.hasAttribute('data-toggle') && controls.runLock);
      cap.classList.toggle('pressed', on);
    }
  };
}
