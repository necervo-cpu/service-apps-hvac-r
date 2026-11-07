// Service Worker: hält die App offline verfügbar.
// Bei Änderungen an index.html oder shared/ die Versionsnummer erhöhen, damit das iPad die neue Version lädt.
// Die Handler (install, activate, fetch) stehen in shared/sw-vorlage.js; hier nur Cache-Name und Dateiliste.
const CACHE = 'anlagenlogbuch-v39';
const ASSETS = ['./', './index.html', './shared/core.js', './shared/pdf-bausteine.js', './shared/pdf.js', './shared/sync.js', './shared/settings.js', './shared/wizard.js', './shared/theme.js', './shared/base.css', './shared/knoepfe.css', './shared/kacheln.css', './shared/pdf.css', './shared/ios.css', './shared/ios.js', './shared/sw-vorlage.js', './manifest.json', './icon-180.png', './icon-512.png',
                './shared/lib/jspdf.umd.min.js', './shared/lib/html2canvas.min.js',
                './shared/lib/fonts/plus-jakarta-sans-latin.woff2', './shared/lib/fonts/plus-jakarta-sans-latin-ext.woff2'];

importScripts('./shared/sw-vorlage.js');
