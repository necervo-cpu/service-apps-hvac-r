// Service Worker: hält die App offline verfügbar.
// Bei Änderungen an index.html die Versionsnummer erhöhen, damit das iPad die neue Version lädt.
const CACHE = 'anlagenlogbuch-v6';
const ASSETS = ['./', './index.html', './manifest.json', './icon-180.png', './icon-512.png',
                './lib/jspdf.umd.min.js', './lib/html2canvas.min.js',
                './lib/fonts/plus-jakarta-sans-latin.woff2', './lib/fonts/plus-jakarta-sans-latin-ext.woff2'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

// Erst aus dem Cache antworten (schnell & offline), im Hintergrund aktualisieren.
// Anfragen an Google (Apps Script) werden nicht angefasst.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(e.request, { ignoreSearch: true });
      const network = fetch(e.request)
        .then(res => { if (res.ok) cache.put(e.request, res.clone()); return res; })
        .catch(() => null);
      if (cached) { e.waitUntil(network); return cached; }
      return (await network) || (await cache.match('./index.html')) || Response.error();
    })
  );
});
