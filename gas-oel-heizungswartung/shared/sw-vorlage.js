// Service-Worker-Vorlage: gemeinsame Handler (install, activate, fetch, message) für alle Apps.
// Verwendung: In sw.js der App zuerst `const CACHE = '…-vN'` und `const ASSETS = [...]`
// (oder `CORE_ASSETS` / `SUB_APP_ASSETS`) setzen, danach `importScripts('./shared/sw-vorlage.js');`.

const _coreList =
  typeof CORE_ASSETS !== 'undefined' && Array.isArray(CORE_ASSETS)
    ? CORE_ASSETS
    : typeof ASSETS !== 'undefined' && Array.isArray(ASSETS)
      ? ASSETS
      : [];

const _subList =
  typeof SUB_APP_ASSETS !== 'undefined' && Array.isArray(SUB_APP_ASSETS)
    ? SUB_APP_ASSETS
    : [];

// iOS 6-Connection-Schutz: maximal 6 Core-Assets sofort im install-Event laden.
const _installAssets = _coreList.slice(0, 6);
const _deferredAssets = _coreList.slice(6).concat(_subList);
let _deferredScheduled = false;

async function _cacheDeferredSequentially() {
  if (!_deferredAssets.length) return;
  const cache = await caches.open(CACHE);
  for (const asset of _deferredAssets) {
    try {
      const hit = await cache.match(asset);
      if (!hit) await cache.add(asset);
    } catch (_) {
      // Einzelne fehlgeschlagene Hintergrund-Assets überspringen.
    }
  }
}

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(_installAssets)));
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
  if (_deferredAssets.length && !_deferredScheduled) {
    _deferredScheduled = true;
    setTimeout(_cacheDeferredSequentially, 3000);
  }
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
