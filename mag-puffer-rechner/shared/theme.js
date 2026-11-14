/* shared/theme.js – Hell/Dunkel-Umschalter (Knopf #themebtn). Das frühe Skript im <head> der App bleibt inline,
   damit beim Laden nichts aufblitzt. Am Seitenende laden (klassisches Skript, kein Modul). */

(function () {
  var b = document.getElementById('themebtn');
  if (!b) return;
  var L = { auto: ['contrast', 'Auto'], hell: ['light_mode', 'Hell'], dunkel: ['dark_mode', 'Dunkel'] };
  function g() {
    try {
      return localStorage.getItem('muther-theme') || 'auto';
    } catch (e) {
      return 'auto';
    }
  }
  function ap(t) {
    var r = document.documentElement;
    if (t === 'hell') r.setAttribute('data-theme', 'light');
    else if (t === 'dunkel') r.setAttribute('data-theme', 'dark');
    else r.removeAttribute('data-theme');
    b.innerHTML = '<span class="ag-icon ag-icon--sm" aria-hidden="true">' + L[t][0] + '</span>';
    b.title = 'Darstellung: ' + L[t][1];
    b.setAttribute('aria-label', 'Darstellung: ' + L[t][1] + ' (tippen zum Wechseln)');
  }
  ap(g());
  b.addEventListener('click', function () {
    var n = { auto: 'hell', hell: 'dunkel', dunkel: 'auto' }[g()];
    try {
      localStorage.setItem('muther-theme', n);
    } catch (e) {}
    ap(n);
  });

  /* iOS PWA Viewport / Chin-Gap Reflow */
  var isIos =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIos) {
    var fixViewport = function () {
      requestAnimationFrame(function () {
        var root = document.documentElement;
        var prev = root.style.transform;
        root.style.transform = 'translateZ(0)';
        void root.offsetHeight;
        root.style.transform = prev;
        window.scrollTo(0, 0);
      });
    };
    if (document.readyState === 'loading') {
      window.addEventListener('DOMContentLoaded', fixViewport);
    } else {
      fixViewport();
    }
    window.addEventListener('load', fixViewport);
    window.addEventListener('pageshow', fixViewport);
  }
})();
