// Service Worker für die Startseite (Root).
// Handhabt ausschließlich Dateien auf Root-Ebene und ./shared/* – alle 9 Unter-App-Ordner werden direkt durchgereicht.
const CACHE = 'startseite-v304';
const ASSETS = [
  './',
  './index.html',
  './app.css',
  './app.js',
  './manifest.json',
  './shared/core.js',
  './shared/theme.js',
  './shared/global.css',
  './shared/css/tokens.css',
  './shared/css/base.css',
  './shared/css/components.css',
  './shared/css/forms.css',
  './shared/css/glas.css',
  './shared/glas.js',
  './shared/lib/fonts/material-symbols-rounded.woff2',
];

const ROOT_FILES = new Set([
  '',
  'index.html',
  'app.css',
  'app.js',
  'manifest.json',
]);

async function cacheDeferred() {
  const rest = ASSETS.slice(6);
  if (!rest.length) return;
  const cache = await caches.open(CACHE);
  for (const asset of rest) {
    try {
      const hit = await cache.match(asset);
      if (!hit) await cache.add(asset);
    } catch (_) {}
  }
}

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.slice(0, 6))));
  self.skipWaiting();
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => (k !== CACHE && k.startsWith('startseite-')) || k.startsWith('workbox-'))
          .map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
  e.waitUntil(cacheDeferred());
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  const scopePath = new URL('./', self.registration.scope).pathname;
  if (!url.pathname.startsWith(scopePath)) return;
  const rel = url.pathname.slice(scopePath.length);
  if (!ROOT_FILES.has(rel) && !rel.startsWith('shared/')) return;

  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(e.request, { ignoreSearch: true });
      const network = fetch(e.request)
        .then((res) => {
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        })
        .catch(() => null);
      if (cached) {
        e.waitUntil(network);
        return cached;
      }
      return (await network) || (await cache.match('./index.html')) || Response.error();
    }),
  );
});
