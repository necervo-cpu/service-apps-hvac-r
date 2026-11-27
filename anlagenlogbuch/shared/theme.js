/* shared/theme.js – Dual-Theme Umschalter (ios27-design-system).
   Standard ist 'dark'; gespeichert wird nur 'light' | 'dark' unter localStorage 'ag-theme'.
   Synchronisiert #themeToggleBtn, #themebtn und alle .js-theme-toggle (Sidebar & Drawer).
   Das frühe Skript im <head> der App bleibt inline für FOUC-freien Start.
   Ausschließlich sichere DOM-APIs (createElement, textContent, replaceChildren). */

(function () {
  var KEY = 'ag-theme';
  var COLORS = { dark: '#0B0C0E', light: '#F2F2F7' };
  var SELECTOR = '#themeToggleBtn, #themebtn, .js-theme-toggle';

  function resolveTheme() {
    try {
      var saved = localStorage.getItem(KEY);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch (e) {}
    return 'dark';
  }

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }

  function syncThemeColor(theme) {
    var color = COLORS[theme] || COLORS.dark;
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < metas.length; i++) {
      if (metas[i].getAttribute('content') !== color) {
        metas[i].setAttribute('content', color);
      }
    }
  }

  function wantsLabel(btn) {
    return btn.classList.contains('js-theme-toggle') || btn.classList.contains('ios27-theme-btn');
  }

  function syncButton(btn, isDark) {
    var icon = document.createElement('span');
    icon.className = 'material-symbols-rounded';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = isDark ? 'light_mode' : 'dark_mode';
    var nodes = [icon];
    if (wantsLabel(btn)) {
      var text = document.createElement('span');
      text.className = 'ios27-theme-label';
      text.textContent = isDark ? 'Hellmodus' : 'Dunkelmodus';
      nodes.push(text);
    }
    btn.replaceChildren.apply(btn, nodes);
    var label = isDark ? 'Hellmodus aktivieren' : 'Dunkelmodus aktivieren';
    btn.title = label;
    btn.setAttribute('aria-label', label);
  }

  function syncThemeButtons() {
    var isDark = currentTheme() === 'dark';
    var buttons = document.querySelectorAll(SELECTOR);
    for (var i = 0; i < buttons.length; i++) {
      syncButton(buttons[i], isDark);
    }
  }

  function applyTheme(theme) {
    var next = theme === 'light' ? 'light' : 'dark';
    if (document.documentElement.getAttribute('data-theme') !== next) {
      document.documentElement.setAttribute('data-theme', next);
    }
    syncThemeColor(next);
    syncThemeButtons();
  }

  function toggleTheme() {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(KEY, next);
    } catch (e) {}
    applyTheme(next);
    return next;
  }

  window.agApplyTheme = applyTheme;
  window.agToggleTheme = toggleTheme;
  window.agSyncThemeButtons = syncThemeButtons;

  applyTheme(resolveTheme());
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncThemeButtons);
  }

  document.addEventListener('click', function (e) {
    var target = e.target && e.target.closest ? e.target.closest(SELECTOR) : null;
    if (target) toggleTheme();
  });

  if (window.MutationObserver) {
    new MutationObserver(function () {
      var cur = currentTheme();
      syncThemeColor(cur);
      syncThemeButtons();
    }).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
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
