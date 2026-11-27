// shared/glas.js – Kopfhöhe, Scroll-Fades und iOS-27-Navigation (Sidebar + Drawer, keine Bottom-Nav).
// Gehört zu shared/css/glas.css und shared/css/layout.css. Klassisches Skript mit defer.
// Ausschließlich sichere DOM-APIs (createElement, textContent, setAttribute).
(function () {
  'use strict';

  var kopf = document.querySelector('.app-header');
  var body = document.body;

  /* ===== Kopfhöhe (--kopf-hoehe) ===== */
  if (kopf) {
    var misst = function () {
      document.documentElement.style.setProperty('--kopf-hoehe', kopf.offsetHeight + 'px');
    };
    misst();
    window.addEventListener('resize', misst);
    if ('ResizeObserver' in window) {
      new ResizeObserver(misst).observe(kopf);
    }

    /* ===== Top-Bar-Scroll-Fade ===== */
    var pruefeScroll = function () {
      var y = Math.max(window.scrollY || 0, document.documentElement.scrollTop || 0);
      kopf.classList.toggle('is-scrolled', y > 8);
    };
    pruefeScroll();
    window.addEventListener('scroll', pruefeScroll, { passive: true });
  }

  /* ===== Bottom-Edge-Fade ===== */
  (function bottomFade() {
    var host = document.querySelector('main') || document.querySelector('.app-shell');
    if (!host || document.getElementById('bottom-sentinel')) return;
    var sentinel = document.createElement('div');
    sentinel.id = 'bottom-sentinel';
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.style.cssText = 'height:1px;width:100%;pointer-events:none;';
    host.appendChild(sentinel);
    var fade = document.createElement('div');
    fade.className = 'ios27-bottom-fade';
    fade.setAttribute('aria-hidden', 'true');
    body.appendChild(fade);
    if (!('IntersectionObserver' in window)) return;
    new IntersectionObserver(
      function (eintraege) {
        var sichtbar = eintraege.some(function (e) {
          return e.isIntersecting;
        });
        fade.classList.toggle('is-hidden', sichtbar);
      },
      { threshold: 0 },
    ).observe(sentinel);
  })();

  /* ===== Navigation: Module und Pfadermittlung ===== */
  var HOME = { id: 'home', label: 'Startseite', icon: 'home' };
  var GRUPPEN = [
    { label: 'Übersicht', items: [HOME] },
    {
      label: 'Service & Protokolle',
      items: [
        { id: 'logbuch', label: 'Anlagenlogbuch', icon: 'menu_book', deploy: 'anlagenlogbuch', local: 'apps/anlagenlogbuch/app' },
        { id: 'wp', label: 'Wärmepumpen-Wartung', icon: 'heat_pump', deploy: 'service-waermepumpe', local: 'apps/waermepumpe-wartung/app' },
        { id: 'heizung', label: 'Gas-/Öl-Heizungswartung', icon: 'local_fire_department', deploy: 'gas-oel-heizungswartung', local: 'apps/heizung-wartung/app' },
        { id: 'klima', label: 'Klima-/Kälte-Wartung', icon: 'ac_unit', deploy: 'service-klimaanlagenwartung', local: 'apps/klima-wartung/app' },
        { id: 'rlt', label: 'RLT- & KWL-Wartung', icon: 'air', deploy: 'service-rlt-kwl-anlagen', local: 'apps/rlt-kwl/app' },
        { id: 'ibn', label: 'Split-Klima Inbetriebnahme', icon: 'build_circle', deploy: 'service-inbetriebnahme-split-klimaanlage', local: 'apps/split-klima-ibn/app' },
      ],
    },
    {
      label: 'Kalkulation & Auslegung',
      items: [
        { id: 'kalk-klima', label: 'Kalkulation Klima', icon: 'calculate', deploy: 'kalkulation-service-klimaanlage', local: 'apps/Kalkulation Split Klima/klima/app' },
        { id: 'kalk-wp', label: 'Kalkulation Wärmepumpe', icon: 'payments', deploy: 'kalkulation-service-waermepumpe', local: 'apps/Kalkulation Split Klima/waermepumpe/app' },
        { id: 'daikin', label: 'Daikin Multisplit-Auslegung', icon: 'device_hub', deploy: 'auslegungstool-daikin-split-klimaanlage', local: 'apps/daikin-auslegung' },
        { id: 'rechner', label: 'HVAC-R Rechner', icon: 'hvac', absolut: '/HVAC-rechner-v2/' },
      ],
    },
  ];

  function lesePfad() {
    try {
      return decodeURIComponent(location.pathname);
    } catch (e) {
      return location.pathname;
    }
  }

  // Liefert { hrefs: { id: url }, aktiv: id } für beide Hosting-Strukturen
  // (lokales Repo: /service-apps/{startseite,apps/…}/ bzw. _Upload-Hosting-Root: /<zielordner>/).
  function ermittleZiele() {
    var pfad = lesePfad();
    var items = [];
    GRUPPEN.forEach(function (g) {
      items = items.concat(g.items);
    });
    var hrefs = {};
    var aktiv = 'home';
    var iApps = pfad.indexOf('/apps/');
    var iStart = pfad.indexOf('/startseite');
    var lokal = iApps !== -1 || iStart !== -1;
    var prefix;

    if (lokal) {
      prefix = pfad.slice(0, iApps !== -1 && (iStart === -1 || iApps < iStart) ? iApps : iStart);
      items.forEach(function (m) {
        if (m.local) {
          hrefs[m.id] = encodeURI(prefix + '/' + m.local + '/');
          if (pfad.indexOf('/' + m.local + '/') !== -1) aktiv = m.id;
        }
      });
      hrefs.home = encodeURI(prefix + '/startseite/');
    } else {
      var treffer = null;
      items.forEach(function (m) {
        if (m.deploy && pfad.indexOf('/' + m.deploy + '/') !== -1) treffer = m;
      });
      if (treffer) {
        prefix = pfad.slice(0, pfad.indexOf('/' + treffer.deploy + '/'));
        aktiv = treffer.id;
      } else {
        prefix = pfad.slice(0, pfad.lastIndexOf('/'));
      }
      items.forEach(function (m) {
        if (m.deploy) hrefs[m.id] = encodeURI(prefix + '/' + m.deploy + '/');
      });
      hrefs.home = encodeURI(prefix + '/');
    }
    hrefs.rechner = '/HVAC-rechner-v2/';
    if (pfad.indexOf('/HVAC-rechner-v2/') !== -1) aktiv = 'rechner';
    return { hrefs: hrefs, aktiv: aktiv };
  }

  /* ===== Navigation: DOM-Bausteine ===== */
  function el(tag, klasse, text) {
    var n = document.createElement(tag);
    if (klasse) n.className = klasse;
    if (text) n.textContent = text;
    return n;
  }

  function icon(name) {
    var s = el('span', 'material-symbols-rounded', name);
    s.setAttribute('aria-hidden', 'true');
    return s;
  }

  function titel() {
    var wrap = el('div', 'ios27-sidebar-brand');
    wrap.appendChild(icon('hvac'));
    wrap.appendChild(el('span', 'ios27-brand-text', 'Service Apps · HVAC-R'));
    return wrap;
  }

  function baueNav(ziele, onNavigate) {
    var nav = el('nav', 'ios27-nav');
    nav.setAttribute('aria-label', 'Module');
    GRUPPEN.forEach(function (g) {
      var gruppe = el('div', 'ios27-nav-group');
      gruppe.appendChild(el('div', 'ios27-nav-label', g.label));
      g.items.forEach(function (m) {
        var a = el('a', 'ios27-nav-item');
        a.setAttribute('href', ziele.hrefs[m.id] || '#');
        a.appendChild(icon(m.icon));
        a.appendChild(el('span', 'ios27-nav-text', m.label));
        if (m.id === ziele.aktiv) {
          a.setAttribute('aria-current', 'page');
          a.classList.add('is-active');
        }
        if (onNavigate) a.addEventListener('click', onNavigate);
        gruppe.appendChild(a);
      });
      nav.appendChild(gruppe);
    });
    return nav;
  }

  function themeKnopf() {
    var b = el('button', 'ios27-theme-btn js-theme-toggle');
    b.setAttribute('type', 'button');
    b.setAttribute('aria-label', 'Darstellung wechseln');
    return b;
  }

  /* ===== Navigation: Aufbau ===== */
  function baueShell() {
    if (!body || document.querySelector('.ios27-sidebar')) return;
    var ziele = ermittleZiele();

    // Desktop-Sidebar
    var sidebar = el('aside', 'ios27-sidebar');
    sidebar.setAttribute('aria-label', 'Suite-Navigation');
    sidebar.appendChild(titel());
    sidebar.appendChild(baueNav(ziele, null));
    var fuss = el('div', 'ios27-sidebar-footer');
    fuss.appendChild(themeKnopf());
    sidebar.appendChild(fuss);

    // Mobile-Drawer + Backdrop
    var backdrop = el('div', 'ios27-drawer-backdrop');
    backdrop.setAttribute('aria-hidden', 'true');
    var drawer = el('aside', 'ios27-drawer');
    drawer.setAttribute('aria-label', 'Navigation');
    drawer.setAttribute('aria-hidden', 'true');
    var kopfZeile = el('div', 'ios27-drawer-head');
    kopfZeile.appendChild(titel());
    var zu = el('button', 'ios27-drawer-close');
    zu.setAttribute('type', 'button');
    zu.setAttribute('aria-label', 'Navigation schließen');
    zu.appendChild(icon('close'));
    kopfZeile.appendChild(zu);
    drawer.appendChild(kopfZeile);

    var offen = false;
    var menuBtn = null;
    function setze(auf) {
      offen = auf;
      drawer.classList.toggle('is-open', auf);
      backdrop.classList.toggle('is-open', auf);
      drawer.setAttribute('aria-hidden', String(!auf));
      if ('inert' in drawer) drawer.inert = !auf;
      if (menuBtn) menuBtn.setAttribute('aria-expanded', String(auf));
      body.classList.toggle('ios27-drawer-open', auf);
      if (auf) zu.focus();
      else if (menuBtn) menuBtn.focus();
    }
    drawer.appendChild(baueNav(ziele, function () {
      setze(false);
    }));
    var drawerFuss = el('div', 'ios27-drawer-footer');
    drawerFuss.appendChild(themeKnopf());
    drawer.appendChild(drawerFuss);
    if ('inert' in drawer) drawer.inert = true;

    zu.addEventListener('click', function () {
      setze(false);
    });
    backdrop.addEventListener('click', function () {
      setze(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && offen) setze(false);
    });
    window.addEventListener('resize', function () {
      if (offen && window.innerWidth >= 1024) setze(false);
    });

    // Mobile-Menü-Button am Anfang von .app-header
    if (kopf) {
      menuBtn = el('button', 'ios27-menu-btn');
      menuBtn.setAttribute('type', 'button');
      menuBtn.setAttribute('aria-label', 'Navigation öffnen');
      menuBtn.setAttribute('aria-expanded', 'false');
      menuBtn.appendChild(icon('menu'));
      menuBtn.addEventListener('click', function () {
        setze(true);
      });
      kopf.insertBefore(menuBtn, kopf.firstChild);
    }

    body.insertBefore(sidebar, body.firstChild);
    body.appendChild(backdrop);
    body.appendChild(drawer);
    body.classList.add('ios27-has-nav');
    if (window.agSyncThemeButtons) window.agSyncThemeButtons();
  }

  baueShell();
})();
