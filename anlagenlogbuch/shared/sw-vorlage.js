// Service-Worker-Vorlage: gemeinsame Handler (install, activate, fetch, message) für alle Apps.
// Verwendung: In sw.js der App zuerst `const CACHE = '…-vN'` und `const ASSETS = [...]` setzen,
// danach `importScripts('./shared/sw-vorlage.js');`.

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Nur eigene alte Versionen löschen – andere Apps unter derselben Adresse behalten ihren Offline-Speicher.
self.addEventListener('activate', (e) => {
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
// Cacht eigene Assets sowie Google Fonts (.woff2 / CSS) für 100 % Offline-Funktion auf der Baustelle.
// Anfragen an Google Apps Script werden nicht angefasst.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const isOwn = url.origin === location.origin;
  const isFont =
    url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!isOwn && !isFont) return;
  if (isOwn && url.pathname.endsWith('/version.json')) return;

  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(e.request, { ignoreSearch: isOwn });
      const network = fetch(e.request)
        .then((res) => {
          if (res.ok || res.type === 'opaque') cache.put(e.request, res.clone());
          return res;
        })
        .catch(() => null);
      if (cached) {
        e.waitUntil(network);
        return cached;
      }
      return (await network) || (isOwn && (await cache.match('./index.html'))) || Response.error();
    }),
  );
});
