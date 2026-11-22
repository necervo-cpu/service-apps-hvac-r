// Start: Service Worker, Aufräumen, erste Darstellung, Synchronisierung und stiller Update-Check.
'use strict';

/* ---------- Start ---------- */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => {});
}
pruneSynced();
syncThemeUi();
render();
syncAll(true);
if (navigator.onLine) {
  pruefeUpdate(false);
}
