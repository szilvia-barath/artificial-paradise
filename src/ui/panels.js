// About / Behind-the-scenes panels and the "jump to room" menu.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function setupPanels(data, { onOpenPanel, onClosePanel, onJumpRoom, onOpenWork }) {
  const panel = document.getElementById('panel');
  const body = document.getElementById('panel-body');
  const roomsMenu = document.getElementById('rooms-menu');
  const m = data.meta;

  const aboutHTML = () => `
    <p class="eyebrow">${esc(m.artist)} · ${esc(m.venue)} · ${esc(m.dates)}</p>
    <h2>${esc(m.title)}</h2>
    ${data.text.map((p) => `<p>${esc(p)}</p>`).join('')}
    <p class="note">${esc(data.textCredit)}</p>
    <h3>Credits</h3>
    <dl class="credits">
      ${data.credits.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}
    </dl>
    <h3>The real exhibition</h3>
    <p>
      <a href="${esc(m.links.exhibition)}" target="_blank" rel="noopener">Artkartell: KristofLab, Artificial Paradise</a><br />
      <a href="${esc(m.links.gallery)}" target="_blank" rel="noopener">MAMŰ Gallery</a><br />
      <a href="${esc(m.links.instagram)}" target="_blank" rel="noopener">Instagram post from the exhibition</a>
    </p>
    <p class="note">All artworks © Kristóf Szabó / KristofLab, reproduced from installation photographs for documentation purposes. The rooms are reconstructed from the same photographs and the gallery's floor plan.</p>
  `;

  const worksHTML = () => `
    <p class="eyebrow">${esc(m.artist)} · ${esc(m.venue)}</p>
    <h2>List of works</h2>
    <ol class="works-list">
      ${data.works.filter((w) => !w.id.endsWith('-screen')).map((w) => `
        <li><button data-work="${esc(w.id)}"><span class="no">${w.no}</span>
          <span><em>${esc(w.title)}</em><small>${esc([w.medium.split(':')[0], w.size, w.year].filter(Boolean).join(', '))} · ${esc(data.rooms[w.room].name)}</small></span>
        </button></li>`).join('')}
    </ol>
    <p class="note">${esc(data.source || '')}</p>
  `;

  const btsHTML = () => `
    <p class="eyebrow">Behind the scenes</p>
    <h2>How it's built</h2>
    <p>${esc(data.behindTheScenes)}</p>
    <div class="stack">
      <span>Three.js</span><span>postprocessing</span><span>Web Audio API</span><span>NumPy photo textures</span>
      <span>Vite</span><span>sharp → WebP</span><span>Pointer Lock</span><span>GitHub Pages</span>
    </div>
    <h3>Controls</h3>
    <p class="note">Desktop: WASD / arrows to walk, mouse to look, Shift to run, click a work to open it, T for the tour, M to mute.<br />
    Touch: left stick to walk, drag to look, tap a work.</p>
  `;

  const open = (html) => {
    body.innerHTML = html;
    panel.hidden = false;
    roomsMenu.hidden = true;
    onOpenPanel();
  };
  const close = () => {
    panel.hidden = true;
    onClosePanel();
  };
  panel.querySelector('[data-close]').addEventListener('click', close);
  body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-work]');
    if (!b || !onOpenWork) return;
    onOpenWork(data.works.find((w) => w.id === b.dataset.work));
  });
  panel.addEventListener('click', (e) => { if (e.target === panel) close(); });

  roomsMenu.innerHTML = Object.entries(data.rooms)
    .map(([id, r]) => `<button data-room="${id}">${esc(r.name)}<small>${esc(r.blurb)}</small></button>`)
    .join('');
  roomsMenu.addEventListener('click', (e) => {
    const b = e.target.closest('[data-room]');
    if (!b) return;
    roomsMenu.hidden = true;
    onJumpRoom(b.dataset.room);
  });

  return {
    about: () => open(aboutHTML()),
    works: () => open(worksHTML()),
    bts: () => open(btsHTML()),
    toggleRooms: () => { roomsMenu.hidden = !roomsMenu.hidden; },
    close,
    isOpen: () => !panel.hidden,
  };
}
