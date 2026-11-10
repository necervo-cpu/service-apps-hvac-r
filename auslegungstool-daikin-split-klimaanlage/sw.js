// Service Worker: hält die App offline verfügbar.
// Bei Änderungen an index.html/engine.js/daten.js die Versionsnummer erhöhen, damit das iPad die neue Version lädt.
const CACHE = 'daikin-multi-v48';
const ASSETS = [
  './',
  './index.html',
  './engine.js',
  './daten.js',
  './manifest.json',
  './icon-180.png',
  './icon-512.png',
  './shared/pdf.css',
  './shared/ios.css',
  './shared/ios.js',
  './shared/pdf-bausteine.js',
  './shared/pdf.js',
  './shared/lib/jspdf.umd.min.js',
  './shared/lib/html2canvas.min.js',
  './lib/fonts/plus-jakarta-sans-latin.woff2',
  './lib/fonts/plus-jakarta-sans-latin-ext.woff2',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  // Nur eigene alte Caches löschen – die anderen Apps liegen unter derselben Adresse (GitHub Pages).
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE && k.startsWith(CACHE.replace(/\d+$/, '')))
            .map((k) => caches.delete(k)),
        ),
      ),
  );
  self.clients.claim();
});

// Erst aus dem Cache antworten (schnell & offline), im Hintergrund aktualisieren.
// Anfragen an Google (Sheet-Daten) werden nicht angefasst.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
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
