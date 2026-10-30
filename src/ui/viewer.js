import { t } from '../i18n.js';

// Artwork overlay: large image (for the video works, the silent loop, and on request the
// full video with sound from Google Drive), caption, exhibition text, prev/next, "in situ"
// photo, and a "walk to this work" shortcut.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function setupViewer(data, { onOpen, onClose, onGoto }) {
  const el = document.getElementById('viewer');
  const img = document.getElementById('viewer-img');
  const video = document.getElementById('viewer-video');
  const frame = document.getElementById('viewer-frame');
  const videoBtns = document.getElementById('viewer-videos');
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
  let full = -1; // index of the full video shown from Drive, -1 = none

  const renderText = () => {
    text.innerHTML = data.text.map((p) => `<p>${esc(p)}</p>`).join('') + `<p class="mono" style="color:#8a8a88;font-size:11px">${esc(data.textCredit)}</p>`;
  };
  renderText();

  // In-situ toggle (adds a small button under the caption)
  const situBtn = document.createElement('button');
  situBtn.className = 'link mono';
  situBtn.style.marginTop = '0';
  caption.after(situBtn);

  const renderInfo = () => {
    const w = works[index];
    img.alt = `${w.title}, ${w.medium}`;
    room.textContent = `${data.rooms[w.room].name} · ${t('viewer.no', { no: w.no })}`;
    title.textContent = w.title;
    meta.innerHTML = `${esc(data.meta.artist)}<br />${esc([w.medium, w.size, w.year].filter(Boolean).join(', '))}`;
    caption.textContent = w.caption;
    situBtn.textContent = t(situ ? 'viewer.work' : 'viewer.situ');
    const vids = (!situ && w.video && w.video.full) || [];
    videoBtns.innerHTML = vids
      .map((v, i) => `<button class="link mono" data-full="${i}">${esc(t(full === i ? 'viewer.loop' : `viewer.${v.label}`))}</button>`)
      .join('') + (vids.length ? `<p class="note mono">${esc(t('viewer.videoNote'))}</p>` : '');
  };

  // Which medium fills the left side: Drive player, video loop, or the photograph.
  const showMedia = (w) => {
    const vids = w.video && !situ ? w.video : null;
    const drive = vids && full >= 0 ? vids.full[full].drive : null;
    frame.hidden = !drive;
    if (drive) {
      const src = `https://drive.google.com/file/d/${drive}/preview`;
      if (frame.getAttribute('src') !== src) frame.setAttribute('src', src);
    } else frame.removeAttribute('src');
    const loop = vids && !drive;
    video.hidden = !loop;
    if (loop) {
      if (video.getAttribute('src') !== `${base}${vids.loop}`) {
        video.poster = `${base}${w.image}.webp`;
        video.src = `${base}${vids.loop}`;
      }
      video.play().catch(() => {});
    } else {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    img.hidden = !!vids;
    loading.hidden = !!vids;
  };

  const show = () => {
    const w = works[index];
    const src = situ ? `${base}${w.image}-situ.webp` : `${base}${w.image}.webp`;
    img.classList.remove('ready');
    loading.hidden = false;
    img.onload = () => { img.classList.add('ready'); loading.hidden = true; };
    img.src = src;
    showMedia(w);
    renderInfo();
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
    full = -1;
    show();
    el.hidden = false;
    onOpen();
  };
  const close = () => {
    if (el.hidden) return;
    el.hidden = true;
    img.removeAttribute('src');
    full = -1;
    showMedia({});
    onClose();
  };
  const step = (d) => {
    index = (index + d + works.length) % works.length;
    situ = false;
    full = -1;
    show();
  };

  situBtn.addEventListener('click', () => { situ = !situ; full = -1; show(); });
  videoBtns.addEventListener('click', (e) => {
    const b = e.target.closest('[data-full]');
    if (!b) return;
    const i = Number(b.dataset.full);
    full = full === i ? -1 : i;
    showMedia(works[index]);
    renderInfo();
  });
  el.querySelector('[data-close]').addEventListener('click', close);
  document.getElementById('viewer-prev').addEventListener('click', () => step(-1));
  document.getElementById('viewer-next').addEventListener('click', () => step(1));
  document.getElementById('viewer-goto').addEventListener('click', () => {
    const w = works[index];
    close();
    onGoto(w);
  });
  el.querySelector('.viewer-media').addEventListener('click', (e) => { if (e.target === e.currentTarget) close(); });
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

  // After a language switch: re-render the texts without reloading the image.
  const refresh = () => {
    renderText();
    if (!el.hidden) renderInfo();
  };

  return { open, close, refresh, isOpen: () => !el.hidden };
}
