// Service Worker: hält die App offline verfügbar.
// Bei Änderungen an index.html, engine.js oder shared/ die Versionsnummer erhöhen, damit das iPad die neue Version lädt.
// Die Handler (install, activate, fetch) stehen in shared/sw-vorlage.js; hier nur Cache-Name und Dateiliste.
const CACHE = 'mag-puffer-v9';
const ASSETS = ['./', './index.html', './engine.js', './manifest.json', './icon-180.png', './icon-512.png',
                './shared/core.js', './shared/theme.js', './shared/base.css', './shared/knoepfe.css', './shared/sw-vorlage.js',
                './shared/lib/fonts/plus-jakarta-sans-latin.woff2', './shared/lib/fonts/plus-jakarta-sans-latin-ext.woff2'];

importScripts('./shared/sw-vorlage.js');
