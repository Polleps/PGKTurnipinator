import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Served by the bot's express app: `/agenda` -> agenda/dist (src/web/Server.ts).
export default defineConfig({
  base: '/agenda/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Vite's default, spelled out: Chrome/Edge 111+, Firefox 114+, Safari 16.4+.
    target: 'baseline-widely-available',
  },
  plugins: [
    VitePWA({
      // Keep our own worker (legacy cache cleanup, runtime caching rules); Workbox injects
      // the precache manifest into it.
      strategies: 'injectManifest',
      srcDir: 'src',
      // Same URL as the old webpack worker, so installed PWAs update in place.
      filename: 'service-worker.js',
      registerType: 'autoUpdate',
      // Registered from src/index.js via virtual:pwa-register.
      injectRegister: false,
      injectManifest: {
        // Everything in dist (the manifest is added by the plugin).
        globPatterns: ['**/*.{js,css,html,png,jpg,webp,svg}'],
      },
      // Already matched by globPatterns; avoids duplicate precache entries.
      includeManifestIcons: false,
      manifest: {
        id: '/agenda/',
        name: 'Tournament Agenda',
        short_name: 'Agenda',
        description: 'A calendar for up and coming Dutch Super Smash Brothers tournaments',
        start_url: '/agenda/',
        scope: '/agenda/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ececec',
        theme_color: '#c32b3e',
        icons: [
          { src: 'icons/agenda_logo_192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/agenda_logo_512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
});
