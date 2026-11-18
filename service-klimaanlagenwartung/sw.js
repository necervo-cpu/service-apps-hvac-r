// Service Worker: hält die App offline verfügbar.
// Bei Änderungen an index.html oder shared/ die Versionsnummer erhöhen, damit das iPad die neue Version lädt.
// Die Handler (install, activate, fetch) stehen in shared/sw-vorlage.js; hier nur Cache-Name und Dateiliste.
const CACHE = 'klima-wartung-v222';
const ASSETS = [
  './',
  './index.html',
  './daten-vorlage.js',
  './app-kern.js',
  './app-ansichten.js',
  './app-aktionen.js',
  './app.js',
  './manifest.json',
  './icon-180.png',
  './icon-512.png',
  './shared/core.js',
  './shared/pdf.js',
  './shared/pdf-bausteine.js',
  './shared/pdf.css',
  './shared/sync.js',
  './shared/settings.js',
  './shared/wizard.js',
  './shared/theme.js',
  './shared/global.css',
  './shared/choice-dropdown.js',
  './shared/sw-vorlage.js',
  './shared/lib/jspdf.umd.min.js',
  './shared/lib/html2canvas.min.js',
  './shared/lib/fonts/plus-jakarta-sans-latin.woff2',
  './shared/lib/fonts/plus-jakarta-sans-latin-ext.woff2',
];

importScripts('./shared/sw-vorlage.js');
