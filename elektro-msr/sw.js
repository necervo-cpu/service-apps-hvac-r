// Service Worker: hält die App offline verfügbar.
// Bei Änderungen an index.html oder shared/ die Versionsnummer erhöhen, damit das iPad die neue Version lädt.
const CACHE = 'elektro-msr-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-180.png',
  './icon-512.png',
  './shared/core.js',
  './shared/theme.js',
  './shared/base.css',
  './shared/knoepfe.css',
  './shared/ios.css',
  './shared/sw-vorlage.js',
  './shared/lib/fonts/plus-jakarta-sans-latin.woff2',
  './shared/lib/fonts/plus-jakarta-sans-latin-ext.woff2',
];

importScripts('./shared/sw-vorlage.js');
