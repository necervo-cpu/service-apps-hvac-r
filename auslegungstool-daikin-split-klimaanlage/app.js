/* app.js – Start: Service Worker, Daten laden, erste Ansicht, stiller Update-Check. */
'use strict';
if ('serviceWorker' in navigator && location.protocol.startsWith('http'))
  navigator.serviceWorker.register('sw.js').catch(() => {});
loadData();
syncThemeUi();
render();
if (navigator.onLine) pruefeUpdate(false);
