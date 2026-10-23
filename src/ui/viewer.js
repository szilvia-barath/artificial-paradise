// Artwork overlay: large image, caption, exhibition text, prev/next, "in situ" photo,
// and a "walk to this work" shortcut.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function setupViewer(data, { onOpen, onClose, onGoto }) {
  const el = document.getElementById('viewer');
  const img = document.getElementById('viewer-img');
  const loading = el.querySelector('.viewer-loading');
  const title = document.getElementById('viewer-title');
  const meta = document.getElementById('viewer-meta');
  const caption = document.getElementById('viewer-caption');
  const room = document.getElementById('viewer-room');
  const text = document.getElementById('viewer-text');
  const count = document.getElementById('viewer-count');
  const base = import.meta.env.BASE_URL;
  const works = data.works;
  let index = -1;
  let situ = false;

  text.innerHTML = data.text.map((p) => `<p>${esc(p)}</p>`).join('') + `<p class="mono" style="color:#8a8a88;font-size:11px">${esc(data.textCredit)}</p>`;

  // In-situ toggle (adds a small button under the caption)
  const situBtn = document.createElement('button');
  situBtn.className = 'link mono';
  situBtn.style.marginTop = '0';
  caption.after(situBtn);

  const show = () => {
    const w = works[index];
    const src = situ ? `${base}${w.image}-situ.webp` : `${base}${w.image}.webp`;
    img.classList.remove('ready');
    loading.hidden = false;
    img.onload = () => { img.classList.add('ready'); loading.hidden = true; };
    img.src = src;
    img.alt = `${w.title}, ${w.medium}`;
    room.textContent = `${data.rooms[w.room].name} · No. ${w.no}`;
    title.textContent = w.title;
    meta.innerHTML = `${esc(data.meta.artist)}<br />${esc([w.medium, w.size, w.year].filter(Boolean).join(', '))}`;
    caption.textContent = w.caption;
    situBtn.textContent = situ ? 'View the work' : 'View in situ (installation photo)';
    count.textContent = `${index + 1} / ${works.length}`;
    // Preload neighbours
    for (const k of [index + 1, index - 1]) {
      const n = works[(k + works.length) % works.length];
      const pre = new Image();
      pre.src = `${base}${n.image}.webp`;
    }
  };

  const open = (work) => {
    index = works.indexOf(work);
    situ = false;
    show();
    el.hidden = false;
    onOpen();
  };
  const close = () => {
    if (el.hidden) return;
    el.hidden = true;
    img.removeAttribute('src');
    onClose();
  };
  const step = (d) => {
    index = (index + d + works.length) % works.length;
    situ = false;
    show();
  };

  situBtn.addEventListener('click', () => { situ = !situ; show(); });
  el.querySelector('[data-close]').addEventListener('click', close);
  document.getElementById('viewer-prev').addEventListener('click', () => step(-1));
  document.getElementById('viewer-next').addEventListener('click', () => step(1));
  document.getElementById('viewer-goto').addEventListener('click', () => {
    const w = works[index];
    close();
    onGoto(w);
  });
  el.querySelector('.viewer-media').addEventListener('click', (e) => { if (e.target !== img) close(); });
  window.addEventListener('keydown', (e) => {
    if (el.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 'ArrowLeft') step(-1);
  });
  // Swipe on touch
  let sx = null;
  img.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
  img.addEventListener('touchend', (e) => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    sx = null;
  });

  return { open, close, isOpen: () => !el.hidden };
}
