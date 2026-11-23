// Misst die Höhe des fixierten Kopfs und legt sie als --kopf-hoehe fest, damit der Inhalt darunter beginnt.
// Gehört zu shared/css/glas.css. Wird als klassisches Skript mit defer eingebunden.
(function () {
  var kopf = document.querySelector('.app-header');
  if (!kopf) {
    return;
  }
  var misst = function () {
    document.documentElement.style.setProperty('--kopf-hoehe', kopf.offsetHeight + 'px');
  };
  misst();
  window.addEventListener('resize', misst);
  if ('ResizeObserver' in window) {
    new ResizeObserver(misst).observe(kopf);
  }
})();
