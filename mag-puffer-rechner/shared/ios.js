/* shared/ios.js – Apple-Bedienung für alle Apps (klassisches Skript, kein Modul, kein eigenes render()).
   Einbinden: <script src="shared/ios.js"></script> NACH shared/wizard.js (und nach core.js); dazu shared/ios.css
   NACH dem App-<style>. Die Datei legt nur diese globalen Namen an (alles andere steckt in einer Funktion):
   iosGroups, iosSwitch, iosAfterRender, iosCheck, iosSheet, iosSwipe, iosRubber.
   Eigenes esc() im Skript, weil Kalkulation/Daikin kein core.js haben.
   Die App ruft die Funktionen selbst auf; es werden keine App-Funktionen überschrieben oder umhüllt.

   iosGroups(fields, fieldFn, i0) -> HTML-Text
     fields  = Liste der Felder (schon gefiltert, z. B. nach f.show). Jedes Feld darf f.group (Text) haben.
     fieldFn = Funktion f -> HTML eines Feldes (die App-eigene fieldHtml).
     i0      = Start für die Einblend-Reihenfolge (--i), Standard 1.
     Aufeinanderfolgende Felder mit gleichem f.group -> Überschrift (.grphead) + Karte (.card.grp.stag).
     Felder ohne group -> Karte ohne Überschrift. Hat gar kein Feld eine group -> genau eine .card.stag wie bisher.

   iosSwitch(f, x, warn) -> HTML-Text von zwei Knöpfen „Ja“ / „Nein“ in der Segment-Spur (.seg, wie i.O./n.i.O.)
     f = Feld (braucht f.id, optional f.label), x = aktueller Wert ('Ja' / 'Nein' / '' oder fehlend),
     warn = true (oder Liste, die 'Ja' enthält), wenn „Ja“ orange statt grün sein soll (Liste mit 'Nein': Nein orange).
     Gewähltes „Nein“ ist grau (Klasse na), „Ja“ grün. Leer = nichts gewählt, nichts vorbelegt. Antippen sendet data-act="set" data-f data-v; erneutes Tippen
     auf die gewählte Antwort wählt sie in den Apps wieder ab (Actions.set).

   iosAfterRender(viewName)
     Nach jedem render() aufrufen (nach setSteps/setBar). Setzt den großen Titel (#app .pagetitle), der beim
     Scrollen klein in die Kopfleiste wandert,.
     viewName ist nur ein Name (landet in document.body.dataset.iosView).

   iosCheck(text)
     Zeigt kurz das Erfolgs-Häkchen mit Text (Standard „Protokoll abgeschlossen“). Direkt im Erfolgsfall aufrufen.

   iosSheet.open(html, onClose, title) / iosSheet.close() / iosSheet.isOpen()
     Bottom Sheet mit Griff, Wischen nach unten zum Schließen, Escape, Abdunkelung. html = Inhalt (z. B. Einstellungen,
     ohne eigenen Zurück-Knopf). onClose wird nach dem Schließen einmal aufgerufen (z. B. render). title Standard „Einstellungen“.
     Knöpfe im Blatt mit data-act="home" schließen das Blatt. Der Rest läuft über die normale data-act-Verteilung der App.

   iosSwipe.init({back})
     Wischen vom linken Rand (24 px) = zurück. back() wird erst beim Wischen aufgerufen und liefert null (kein Zurück)
     oder {html, go}: html = Inhalt der Vorgängerseite (wie in #app), go() = Zustand zurücksetzen und render() aufrufen
     (ohne stepTo-Animation). Während des Wischens liegt die Vorgängerseite als Unterlage (#under, ohne ids, inert) darunter.
     Braucht in der App: #app, optional .stage, #stepwrap, header; globales navBusy (falls vorhanden) wird beachtet.

   iosRubber
     Gummiband am Seitenende nur für das Mausrad/Trackpad (iOS macht es selbst). iosRubber.calc(über, maß, c) ist die Kurve.
     Aktiviert sich beim Laden selbst. */
(function () {
  'use strict';

  const EASE = 'cubic-bezier(.32,.72,0,1)'; // iOS-Kurve: schneller Start, weiches Auslaufen
  const $ = (s) => document.querySelector(s);
  const RMq = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = (s) =>
    String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  const navBusyNow = () => {
    try {
      return typeof navBusy !== 'undefined' && !!navBusy;
    } catch (e) {
      return false;
    }
  };
  const state = { swiping: false, sheetOpen: false };

  /* ---------- Gruppen je Seite ---------- */
  function iosGroups(fields, fieldFn, i0) {
    let i = i0 == null ? 1 : i0;
    fields = fields || [];
    const one = (f) => fieldFn(f);
    if (!fields.some((f) => f && f.group)) {
      return `<div class="card stag" style="--i:${i}">${fields.map(one).join('')}</div>`;
    }
    const runs = [];
    fields.forEach((f) => {
      const g = (f && f.group) || '',
        last = runs[runs.length - 1];
      if (last && last.g === g) last.list.push(f);
      else runs.push({ g, list: [f] });
    });
    return runs
      .map((r) => {
        const n = i++;
        const head = r.g ? `<div class="grphead stag" style="--i:${n}">${esc(r.g)}</div>` : '';
        return (
          head +
          `<div class="card${r.g ? ' grp' : ''} stag" style="--i:${n}">${r.list.map(one).join('')}</div>`
        );
      })
      .join('');
  }

  /* ---------- Ja/Nein als zwei Knöpfe (Segment-Spur wie i.O./n.i.O.) ---------- */
  function iosSwitch(f, x, warn) {
    const wJa = Array.isArray(warn) ? warn.includes('Ja') : !!warn;
    const wNein = Array.isArray(warn) && warn.includes('Nein');
    const one = (v, cls) =>
      `<button type="button" class="btn ${cls}${x === v ? ' sel' : ''}" aria-pressed="${x === v}" data-act="set" data-f="${esc(f.id)}" data-v="${v}">${v}</button>`;
    return `<div class="seg" role="group" aria-label="${esc(f.label || 'Ja/Nein')}">${one('Ja', wJa ? 'warn' : 'ok')}${one('Nein', wNein ? 'warn' : 'na')}</div>`;
  }

  /* ---------- Großer Titel -> klein in der Kopfleiste ---------- */
  let io = null,
    ht = null;
  function setTitleShown(on) {
    const header = $('header');
    if (ht) ht.classList.toggle('show', on);
    if (header) header.classList.toggle('ht-on', on);
  }
  function largeTitle() {
    const header = $('header');
    if (!header) return;
    if (!ht || !ht.isConnected) {
      ht = document.createElement('div');
      ht.className = 'htitle';
      ht.setAttribute('aria-hidden', 'true');
      (header.querySelector('.tt') || header).appendChild(ht);
    }
    if (io) {
      io.disconnect();
      io = null;
    }
    const t = $('#app .pagetitle');
    ht.textContent = t ? t.textContent.trim() : '';
    setTitleShown(false);
    if (!t || !('IntersectionObserver' in window)) return;
    const h = Math.round(header.getBoundingClientRect().height);
    io = new IntersectionObserver(
      ([e]) => setTitleShown(!e.isIntersecting && e.boundingClientRect.top < h),
      { rootMargin: `-${h}px 0px 0px 0px` },
    );
    io.observe(t);
  }
  function iosAfterRender(viewName) {
    document.body.dataset.iosView = viewName || '';
    largeTitle();
  }

  /* ---------- Erfolgs-Häkchen ---------- */
  function iosCheck(text) {
    const o = document.createElement('div');
    o.className = 'okcheck';
    o.setAttribute('role', 'status');
    document.body.appendChild(o); // Bereich zuerst leer, damit Screenreader den Text beim Einsetzen vorlesen
    requestAnimationFrame(() => {
      o.innerHTML =
        '<div class="okc"><svg viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24"/><path d="M15 27l7 7 15-16"/></svg><b></b></div>';
      o.querySelector('b').textContent = text || 'Protokoll abgeschlossen';
      requestAnimationFrame(() => o.classList.add('in'));
    });
    setTimeout(() => {
      o.classList.remove('in');
      o.classList.add('out');
    }, 1500);
    setTimeout(() => o.remove(), 1900);
  }

  /* ---------- Gummiband (Kurve + Mausrad am Seitenende) ---------- */
  const iosRubber = {
    calc(over, dim, c) {
      c = c || 0.55;
      return (over * dim * c) / (dim + c * Math.abs(over));
    },
  };
  (function () {
    let rb = 0,
      timer = null;
    const appEl = () => $('#app');
    const atEnd = (d) =>
      d > 0
        ? Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight - 1
        : scrollY <= 0;
    function set(px) {
      const a = appEl();
      if (!a) return;
      a.style.transition = 'none';
      a.style.transform = px ? `translateY(${px}px)` : '';
    }
    function release() {
      const a = appEl();
      rb = 0;
      if (!a) return;
      a.style.transition = `transform 500ms ${EASE}`;
      a.style.transform = '';
      setTimeout(() => {
        if (!rb) a.style.transition = '';
      }, 520);
    }
    addEventListener(
      'wheel',
      (e) => {
        if (!e.deltaY || e.ctrlKey || RMq() || state.swiping || state.sheetOpen || !atEnd(e.deltaY))
          return;
        if (e.target.closest && e.target.closest('textarea,select,.sheet')) return;
        rb += -e.deltaY;
        set(iosRubber.calc(rb, innerHeight));
        clearTimeout(timer);
        timer = setTimeout(release, 120);
      },
      { passive: true },
    );
  })();

  /* ---------- Bottom Sheet ---------- */
  const iosSheet = (function () {
    let scrim = null,
      sheet = null,
      bodyEl = null,
      onCloseCb = null,
      opened = false,
      lastFocus = null,
      sd = null;
    const INERT = ['header', '.stage', '#app', '#stepwrap', '#bar'];
    const setInert = (on) =>
      INERT.forEach((s) => {
        const el = $(s);
        if (el) el.inert = on;
      });
    function build() {
      if (sheet && sheet.isConnected) return;
      scrim = document.createElement('div');
      scrim.className = 'sheet-scrim';
      sheet = document.createElement('div');
      sheet.className = 'sheet';
      sheet.tabIndex = -1;
      sheet.setAttribute('role', 'dialog');
      sheet.setAttribute('aria-modal', 'true');
      sheet.setAttribute('aria-label', 'Einstellungen');
      sheet.innerHTML =
        '<div class="sheet-grab"></div><div class="sheet-head"><b class="sheet-title">Einstellungen</b><button type="button" class="sheet-done">Fertig</button></div><div class="sheet-body"></div>';
      document.body.append(scrim, sheet);
      void sheet.offsetHeight; // Reflow, damit das Blatt beim ersten Öffnen hineingleitet
      bodyEl = sheet.querySelector('.sheet-body');
      scrim.addEventListener('click', close);
      // Klicks im Blatt: Fertig / Zurück schließen; alles andere läuft über die normale data-act-Verteilung der App
      sheet.addEventListener('click', (e) => {
        if (e.target.closest('.sheet-done') || e.target.closest('[data-act=home]')) {
          e.stopPropagation();
          e.preventDefault();
          close();
        }
      });
      // Nach unten ziehen zum Schließen (nach oben: Gummiband), mit Schwung
      sheet.addEventListener('pointerdown', (e) => {
        if (!e.target.closest('.sheet-grab,.sheet-head') || e.target.closest('button')) return;
        sd = { y0: e.clientY, y: 0, hist: [[e.timeStamp, e.clientY]] };
        try {
          sheet.setPointerCapture(e.pointerId);
        } catch (err) {}
        sheet.style.transition = 'none';
      });
      sheet.addEventListener('pointermove', (e) => {
        if (!sd) return;
        const dy = e.clientY - sd.y0;
        sd.y = dy > 0 ? dy : -iosRubber.calc(-dy, 200);
        sd.hist.push([e.timeStamp, e.clientY]);
        if (sd.hist.length > 5) sd.hist.shift();
        sheet.style.transform = `translateY(${sd.y}px)`;
      });
      const end = () => {
        if (!sd) return;
        const s = sd;
        sd = null;
        const [t0, y0] = s.hist[0],
          [t1, y1] = s.hist[s.hist.length - 1];
        const v = t1 > t0 ? ((y1 - y0) / (t1 - t0)) * 1000 : 0;
        const projected = s.y + ((v / 1000) * 0.998) / (1 - 0.998);
        sheet.style.transition = '';
        if (projected > sheet.offsetHeight * 0.4) close();
        else sheet.style.transform = '';
      };
      sheet.addEventListener('pointerup', end);
      sheet.addEventListener('pointercancel', end);
    }
    function open(html, onClose, title) {
      build();
      sheet.querySelector('.sheet-title').textContent = title || 'Einstellungen';
      sheet.setAttribute('aria-label', title || 'Einstellungen');
      bodyEl.innerHTML = html || '';
      bodyEl.scrollTop = 0;
      onCloseCb = onClose || null;
      if (!opened) lastFocus = document.activeElement;
      sheet.style.transition = '';
      sheet.style.transform = '';
      opened = true;
      state.sheetOpen = true;
      document.body.classList.add('sheet-open');
      setInert(true);
      setTimeout(() => {
        try {
          sheet.focus({ preventScroll: true });
        } catch (e) {}
      }, 0);
    }
    function close() {
      if (!opened) return;
      opened = false;
      state.sheetOpen = false;
      sheet.style.transition = '';
      sheet.style.transform = '';
      document.body.classList.remove('sheet-open');
      setInert(false);
      const cb = onCloseCb;
      onCloseCb = null;
      let ff =
        lastFocus && lastFocus.isConnected ? lastFocus : $('[data-act="settings"]') || $('#app');
      if (ff && ff.focus) {
        if (ff.id === 'app' && !ff.hasAttribute('tabindex')) ff.tabIndex = -1;
        try {
          ff.focus({ preventScroll: true });
        } catch (e) {}
      }
      lastFocus = null;
      if (cb) {
        try {
          cb();
        } catch (err) {
          console.error(err);
        }
      }
    }
    addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && opened) close();
    });
    return { open, close, isOpen: () => opened };
  })();

  /* ---------- Wischen vom linken Rand = zurück ---------- */
  const iosSwipe = (function () {
    const EDGE = 24;
    let backFn = null,
      inited = false,
      st = null;

    function topOffset() {
      const hd = $('header'),
        sw = $('#stepwrap');
      let t = hd ? hd.getBoundingClientRect().bottom : 0;
      if (sw && !sw.hidden) t = Math.max(t, sw.getBoundingClientRect().bottom);
      return Math.max(0, Math.round(t));
    }
    function buildUnder(html, top) {
      const u = document.createElement('div');
      u.id = 'under';
      u.className = 'under';
      u.setAttribute('inert', '');
      u.setAttribute('aria-hidden', 'true');
      u.style.top = top + 'px';
      const m = document.createElement('main');
      m.innerHTML = html || '';
      m.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id')); // keine doppelten ids (querySelector der App)
      m.querySelectorAll('[for]').forEach((el) => el.removeAttribute('for'));
      m.querySelectorAll('[autofocus]').forEach((el) => el.removeAttribute('autofocus'));
      const dim = document.createElement('i');
      dim.className = 'under-dim';
      u.append(m, dim);
      return u;
    }
    function apply() {
      const p = Math.min(1, st.x / innerWidth);
      st.mover.style.transform = `translateX(${st.x}px)`;
      st.mover.style.setProperty('--sw', p);
      st.under.style.transform = `translateX(${-30 * (1 - p)}%)`;
      st.dim.style.opacity = String(0.3 * (1 - p));
    }
    function down(e) {
      if (
        !backFn ||
        st ||
        state.swiping ||
        state.sheetOpen ||
        (e.pointerType !== 'touch' && e.pointerType !== 'pen') ||
        navBusyNow() ||
        e.clientX > EDGE ||
        e.button ||
        e.isPrimary === false
      )
        return;
      if (e.target.closest && e.target.closest('canvas')) return;
      st = {
        x0: e.clientX,
        y0: e.clientY,
        x: 0,
        hist: [[e.timeStamp, e.clientX]],
        id: e.pointerId,
        active: false,
      };
    }
    function move(e) {
      if (!st || e.pointerId !== st.id) return;
      const dx = e.clientX - st.x0,
        dy = e.clientY - st.y0;
      if (!st.active) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
          st = null;
          return;
        } // senkrecht = scrollen
        if (dx < 10) return;
        let b = null;
        try {
          b = backFn();
        } catch (err) {
          console.error(err);
        }
        if (!b || typeof b.go !== 'function') {
          st = null;
          return;
        } // kein Zurück auf dieser Seite
        const app = $('#app');
        if (!app) {
          st = null;
          return;
        }
        const mover = app.closest('.stage') || app,
          top = topOffset();
        const under = buildUnder(b.html, top);
        mover.parentNode.insertBefore(under, mover);
        st.b = b;
        st.mover = mover;
        st.under = under;
        st.dim = under.querySelector('.under-dim');
        st.active = true;
        state.swiping = true;
        mover.classList.add('ios-mover');
        mover.style.transition = 'none';
        mover.style.minHeight = Math.max(0, innerHeight - top) + 'px';
        under.style.transition = 'none';
        st.dim.style.transition = 'none';
        document.documentElement.classList.add('ios-swiping');
        document.body.classList.add('ios-swiping');
      }
      st.x = Math.max(0, dx);
      st.hist.push([e.timeStamp, e.clientX]);
      if (st.hist.length > 5) st.hist.shift();
      apply();
    }
    function end(e) {
      if (!st) return;
      if (e.pointerId !== st.id) return;
      const s = st;
      st = null;
      if (!s.active) return;
      const [t0, x0] = s.hist[0],
        [t1, x1] = s.hist[s.hist.length - 1];
      const v = t1 > t0 ? ((x1 - x0) / (t1 - t0)) * 1000 : 0; // px/s
      const projected = s.x + ((v / 1000) * 0.998) / (1 - 0.998); // Schwung vorausberechnen
      const commit = e.type !== 'pointercancel' && projected > innerWidth * 0.5;
      const ms = RMq() ? 0 : Math.round(Math.max(180, Math.min(420, 380 - Math.abs(v) / 20)));
      const tr = `transform ${ms}ms ${EASE}`;
      s.mover.style.transition = tr;
      s.under.style.transition = tr;
      s.dim.style.transition = `opacity ${ms}ms ${EASE}`;
      s.mover.style.transform = commit ? `translateX(${innerWidth}px)` : 'translateX(0)';
      s.mover.style.setProperty('--sw', commit ? 1 : 0);
      s.under.style.transform = commit ? 'translateX(0)' : 'translateX(-30%)';
      s.dim.style.opacity = commit ? '0' : '.3';
      const done = () => {
        s.mover.style.transition = 'none';
        s.mover.style.transform = '';
        s.mover.style.minHeight = '';
        s.mover.style.removeProperty('--sw');
        s.mover.classList.remove('ios-mover');
        document.documentElement.classList.remove('ios-swiping');
        document.body.classList.remove('ios-swiping');
        state.swiping = false;
        if (commit) {
          try {
            s.b.go();
          } catch (err) {
            console.error(err);
          }
          const a = $('#app');
          if (a) a.className = a.className.replace(/\b(entering|pg-(in|out)-\w+)\b/g, '').trim(); // Seite steht schon da: nicht nochmal einblenden
          window.scrollTo(0, 0);
        }
        s.under.remove();
        requestAnimationFrame(() => {
          s.mover.style.transition = '';
        });
      };
      if (ms) setTimeout(done, ms);
      else done();
    }
    function init(o) {
      backFn = (o && o.back) || null;
      if (inited) return;
      inited = true;
      const edge = document.createElement('div');
      edge.className = 'iosedge';
      edge.setAttribute('aria-hidden', 'true');
      document.body.appendChild(edge); // Randstreifen (nur Touch): damit der Browser den Wisch nicht als Scrollen übernimmt
      addEventListener('pointerdown', down, { passive: true });
      addEventListener('pointermove', move);
      addEventListener('pointerup', end);
      addEventListener('pointercancel', end);
    }
    return { init };
  })();

  window.iosGroups = iosGroups;
  window.iosSwitch = iosSwitch;
  window.iosAfterRender = iosAfterRender;
  window.iosCheck = iosCheck;
  window.iosSheet = iosSheet;
  window.iosSwipe = iosSwipe;
  window.iosRubber = iosRubber;
})();
