import { applyStatic, setLang, setText } from './i18n.js';

// Entry point. Translates the title screen, navbar and footer straight away (this chunk
// is a few kB), then loads the 3D exhibition, which is the heavy part.

applyStatic();

for (const b of document.querySelectorAll('[data-lang]')) {
  b.addEventListener('click', () => setLang(b.dataset.lang));
}

// Phone navbar: the links fold into a small menu.
const nav = document.getElementById('site-nav');
const toggle = nav.querySelector('.nav-toggle');
const closeMenu = () => {
  nav.classList.remove('open');
  toggle.setAttribute('aria-expanded', 'false');
};
toggle.addEventListener('click', () => {
  const open = !nav.classList.contains('open');
  nav.classList.toggle('open', open);
  toggle.setAttribute('aria-expanded', String(open));
});
nav.addEventListener('click', (e) => {
  if (e.target.closest('[data-nav], [data-lang]')) closeMenu();
});
document.addEventListener('pointerdown', (e) => {
  if (!nav.contains(e.target)) closeMenu();
});

// If the scene can't start (no WebGL, very old browser), say so on the title screen
// instead of leaving it on "Preparing the basement…" for ever.
function showFailure() {
  if (document.body.dataset.state === 'ready') return;
  const label = document.getElementById('progress-label');
  setText(label, 'loader.failure');
  label.classList.add('error');
}
window.addEventListener('error', showFailure);
window.addEventListener('unhandledrejection', showFailure);

import('./main.js').catch(showFailure);
