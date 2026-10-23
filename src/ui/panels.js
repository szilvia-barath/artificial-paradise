import { t } from '../i18n.js';

// About / Works / Behind-the-scenes panels and the "jump to room" menu.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function setupPanels(data, { onOpenPanel, onClosePanel, onJumpRoom, onOpenWork }) {
  const panel = document.getElementById('panel');
  const body = document.getElementById('panel-body');
  const roomsMenu = document.getElementById('rooms-menu');
  const navButtons = document.querySelectorAll('#site-nav [data-nav]');
  let current = null;

  const aboutHTML = () => {
    const m = data.meta;
    return `
    <p class="eyebrow">${esc(m.artist)} · ${esc(m.venue)} · ${esc(m.dates)}</p>
    <h2>${esc(m.title)}</h2>
    ${data.text.map((p) => `<p>${esc(p)}</p>`).join('')}
    <p class="note">${esc(data.textCredit)}</p>
    <h3>${esc(t('panels.credits'))}</h3>
    <dl class="credits">
      ${data.credits.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}
    </dl>
    <h3>${esc(t('panels.real'))}</h3>
    <p>${esc(t('panels.address', { venue: t('panels.linkGallery'), address: m.address }))} ·
      <a href="${esc(m.links.map)}" target="_blank" rel="noopener">${esc(t('panels.map'))}</a></p>
    <p>
      <a href="${esc(m.links.exhibition)}" target="_blank" rel="noopener">${esc(t('panels.linkExhibition'))}</a><br />
      <a href="${esc(m.links.gallery)}" target="_blank" rel="noopener">${esc(t('panels.linkGallery'))}</a><br />
      <a href="${esc(m.links.instagram)}" target="_blank" rel="noopener">${esc(t('panels.linkInstagram'))}</a>
    </p>
    <p class="note">${esc(t('panels.rights'))}</p>
  `;
  };

  const worksHTML = () => `
    <p class="eyebrow">${esc(data.meta.artist)} · ${esc(data.meta.venue)}</p>
    <h2>${esc(t('panels.worksTitle'))}</h2>
    <ol class="works-list">
      ${data.works.filter((w) => !w.id.endsWith('-screen')).map((w) => `
        <li><button data-work="${esc(w.id)}"><span class="no">${w.no}</span>
          <span><em>${esc(w.title)}</em><small>${esc([w.medium.split(':')[0], w.size, w.year].filter(Boolean).join(', '))} · ${esc(data.rooms[w.room].name)}</small></span>
        </button></li>`).join('')}
    </ol>
    <p class="note">${esc(data.source || '')}</p>
  `;

  const btsHTML = () => `
    <p class="eyebrow">${esc(t('panels.btsEyebrow'))}</p>
    <h2>${esc(t('panels.btsTitle'))}</h2>
    <p>${esc(data.behindTheScenes)}</p>
    <div class="stack">
      <span>Three.js</span><span>postprocessing</span><span>Web Audio API</span><span>NumPy photo textures</span>
      <span>Vite</span><span>sharp → WebP</span><span>Pointer Lock</span><span>GitHub Pages</span>
    </div>
    <h3>${esc(t('panels.controls'))}</h3>
    <p class="note">${esc(t('panels.controlsDesk'))}<br />${esc(t('panels.controlsTouch'))}</p>
  `;

  const PAGES = { about: aboutHTML, works: worksHTML, bts: btsHTML };

  const markNav = () => {
    for (const b of navButtons) b.setAttribute('aria-current', String(b.dataset.nav === current));
  };
  const show = (name) => {
    const wasOpen = !panel.hidden;
    current = name;
    body.innerHTML = PAGES[name]();
    panel.hidden = false;
    roomsMenu.hidden = true;
    markNav();
    if (!wasOpen) {
      panel.scrollTop = 0;
      onOpenPanel();
    }
  };
  const close = () => {
    if (panel.hidden) return;
    panel.hidden = true;
    current = null;
    markNav();
    onClosePanel();
  };
  panel.querySelector('[data-close]').addEventListener('click', close);
  body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-work]');
    if (!b || !onOpenWork) return;
    onOpenWork(data.works.find((w) => w.id === b.dataset.work));
  });
  panel.addEventListener('click', (e) => { if (e.target === panel) close(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  const buildRoomsMenu = () => {
    roomsMenu.innerHTML = Object.entries(data.rooms)
      .map(([id, r]) => `<button data-room="${id}">${esc(r.name)}<small>${esc(r.blurb)}</small></button>`)
      .join('');
  };
  buildRoomsMenu();
  roomsMenu.addEventListener('click', (e) => {
    const b = e.target.closest('[data-room]');
    if (!b) return;
    roomsMenu.hidden = true;
    onJumpRoom(b.dataset.room);
  });

  return {
    show,
    about: () => show('about'),
    works: () => show('works'),
    bts: () => show('bts'),
    toggleRooms: () => { roomsMenu.hidden = !roomsMenu.hidden; },
    // After a language switch: rebuild what is on screen.
    refresh: () => {
      buildRoomsMenu();
      if (current) body.innerHTML = PAGES[current]();
    },
    close,
    isOpen: () => !panel.hidden,
  };
}
