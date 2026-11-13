import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

// Served by the bot's express app: `/bot` -> public/dist (src/web/Server.ts).
export default defineConfig({
  base: '/bot/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Vite's default, spelled out: Chrome/Edge 111+, Firefox 114+, Safari 16.4+.
    target: 'baseline-widely-available',
  },
  plugins: [
    // Solid components live in .jsx/.tsx files; the lit-html .js files are left alone.
    solid({ include: /\.[jt]sx$/ }),
  ],
});
