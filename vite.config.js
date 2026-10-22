import { defineConfig } from 'vite';

// Relative base so the build works on GitHub Pages (/artificial-paradise/),
// Netlify, Cloudflare Pages or any static host without changes.
export default defineConfig({
  base: './',
  // Only serve/build the app; the original DSC_*.JPG photos stay out of the bundle.
  publicDir: 'public',
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1200,
  },
  server: { host: true },
});
