// Service worker for the agenda PWA, built by vite-plugin-pwa (injectManifest).
// It is served at /agenda/service-worker.js with scope /agenda/, the same URL and scope as the
// old webpack/Workbox 4 worker, so installed PWAs pick it up as an update of that worker.
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// Runtime caches of the old worker. The stale-while-revalidate ones would keep serving old
// HTML/JS, and the image cache was for a host start.gg no longer uses.
const LEGACY_CACHES = ['app-cache', 'css-cache', 'js-cache', 'html-cache', 'smashgg-images'];

// Activate as soon as installed (the app is read-only, so there is no state to lose).
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  const activation = (async () => {
    // Pages controlled by the previous worker run the previous bundle (the old webpack app
    // never reloads itself). A first install has no controlled pages.
    const outdated = await self.clients.matchAll({ type: 'window' });
    await Promise.all(LEGACY_CACHES.map((name) => caches.delete(name)));
    await self.clients.claim();
    return outdated;
  })();
  event.waitUntil(activation);
  // Reload them once into this version. Not inside waitUntil: a reload's navigation request
  // waits for activation to finish, so awaiting it there would deadlock.
  void activation.then((outdated) => {
    for (const client of outdated) client.navigate(client.url).catch(() => undefined);
  });
});

// The precache keeps Workbox's `workbox-precache-v2-<scope>` cache name, so the old worker's
// entries are dropped when this one activates; this removes caches of even older formats.
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// App shell: any navigation inside the scope gets the precached index.html (works offline).
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

// Tournament data: fresh when online, the last copy when offline or slow.
// Same cache name as before, so data cached by the old worker stays available offline.
registerRoute(
  ({ url, sameOrigin }) =>
    sameOrigin && (url.pathname === '/tournaments' || url.pathname.startsWith('/api/tournaments')),
  new NetworkFirst({
    cacheName: 'data-cache',
    networkTimeoutSeconds: 3,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 14 * 24 * 60 * 60 }),
    ],
  }),
);

registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 }),
    ],
  }),
);

registerRoute(
  ({ url }) => url.origin === 'https://images.start.gg' && url.pathname.startsWith('/images/tournament/'),
  new CacheFirst({
    cacheName: 'startgg-images',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  }),
);
