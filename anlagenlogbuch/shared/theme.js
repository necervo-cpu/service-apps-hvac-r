/* shared/theme.js – Dual-Theme Umschalter (#themeToggleBtn / #themebtn) über localStorage ('ag-theme')
   und prefers-color-scheme: light. Das frühe Skript im <head> der App bleibt inline für FOUC-freien Start. */

(function () {
  var b = document.getElementById('themeToggleBtn') || document.getElementById('themebtn');
  if (!b) return;

  var KEY = 'ag-theme';

  function resolveTheme() {
    try {
      var saved = localStorage.getItem(KEY);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch (e) {}
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    var iconName = theme === 'dark' ? 'light_mode' : 'dark_mode';
    var label = theme === 'dark' ? 'Hellmodus aktivieren' : 'Dunkelmodus aktivieren';
    b.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">' + iconName + '</span>';
    b.title = label;
    b.setAttribute('aria-label', label);
  }

  applyTheme(resolveTheme());

  b.addEventListener('click', function () {
    var current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    var next = current === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(KEY, next);
    } catch (e) {}
    applyTheme(next);
  });

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function (e) {
      try {
        if (localStorage.getItem(KEY)) return;
      } catch (err) {}
      applyTheme(e.matches ? 'light' : 'dark');
    });
  }

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
