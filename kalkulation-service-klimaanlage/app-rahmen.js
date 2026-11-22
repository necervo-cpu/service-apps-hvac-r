// Rahmen: Modal-Karte, Darstellung, Update-Prüfung, Kopf, Schritte, untere Leiste, Seitenwechsel.
'use strict';

/* ===== Rahmen: Modal-Karte, Darstellung, Update ===== */
/* Mittige Karte (Einstellungen und Rückfragen): Rest der Seite inaktiv, Escape schließt */
let modalFocus = null;
let modalPanel = null;
let confirmDone = null;
function modalOpen(panel) {
  const host = $('#modalHost');
  modalPanel = panel;
  $('#panelSettings').hidden = panel !== 'settings';
  $('#panelConfirm').hidden = panel !== 'confirm';
  host.setAttribute('aria-labelledby', panel === 'settings' ? 'settingsTitle' : 'cfTitle');
  $('#appShell').inert = true;
  $('#bar').inert = true;
  modalFocus = document.activeElement;
  host.classList.add('is-open');
  const first = host.querySelector(
    `#${panel === 'settings' ? 'panelSettings' : 'panelConfirm'} button`,
  );
  if (first) first.focus();
}
function modalClose() {
  if (!modalPanel) return;
  const war = modalPanel;
  modalPanel = null;
  $('#modalHost').classList.remove('is-open');
  $('#appShell').inert = false;
  $('#bar').inert = false;
  if (modalFocus && modalFocus.focus) modalFocus.focus();
  if (war === 'confirm' && confirmDone) {
    const fertig = confirmDone;
    confirmDone = null;
    fertig(false);
  }
  if (war === 'settings') render();
}
/* Rückfrage (ersetzt den Browser-Dialog) */
function confirmModal(title, message, confirmLabel = 'Bestätigen', danger = false) {
  return new Promise((resolve) => {
    $('#cfTitle').textContent = title;
    $('#cfText').textContent = message;
    const ok = $('#cfOk');
    ok.textContent = confirmLabel;
    ok.className = danger ? 'btn-danger' : 'btn-primary';
    confirmDone = resolve;
    modalOpen('confirm');
  });
}
function openSettings() {
  $('#settingsBody').innerHTML = settingsBody();
  syncThemeUi();
  updateUi();
  modalOpen('settings');
  nachRender();
}
document.addEventListener('click', (e) => {
  if (e.target.closest('#modalCloseBtn') || e.target === $('#modalHost')) {
    modalClose();
  } else if (e.target.closest('#cfCancel')) {
    modalClose();
  } else if (e.target.closest('#cfOk')) {
    const fertig = confirmDone;
    confirmDone = null;
    modalPanel = null;
    $('#modalHost').classList.remove('is-open');
    $('#appShell').inert = false;
    $('#bar').inert = false;
    if (modalFocus && modalFocus.focus) modalFocus.focus();
    if (fertig) fertig(true);
  }
  const tc = e.target.closest('[data-theme-choice]');
  if (tc) setzeDarstellung(tc.dataset.themeChoice);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') modalClose();
});

/* Darstellung: Segment in den Einstellungen kennt zusätzlich „System“, der Kopf-Knopf schaltet Hell und Dunkel */
const systemHell = window.matchMedia('(prefers-color-scheme: light)');
function gespeicherteDarstellung() {
  try {
    const v = localStorage.getItem('ag-theme');
    return v === 'light' || v === 'dark' ? v : null;
  } catch (e) {
    return null;
  }
}
function syncThemeUi() {
  const wahl = gespeicherteDarstellung() || 'system';
  document
    .querySelectorAll('[data-theme-choice]')
    .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeChoice === wahl)));
  const btn = $('#themeToggleBtn');
  if (btn) {
    const dunkel = document.documentElement.getAttribute('data-theme') !== 'light';
    btn.innerHTML = `<span class="material-symbols-rounded" aria-hidden="true">${dunkel ? 'light_mode' : 'dark_mode'}</span>`;
    btn.setAttribute(
      'aria-label',
      dunkel ? 'Hellmodus aktivieren' : 'Dunkelmodus aktivieren',
    );
  }
}
function setzeDarstellung(wahl) {
  try {
    if (wahl === 'system') localStorage.removeItem('ag-theme');
    else localStorage.setItem('ag-theme', wahl);
  } catch (e) {}
  document.documentElement.setAttribute(
    'data-theme',
    wahl === 'system' ? (systemHell.matches ? 'light' : 'dark') : wahl,
  );
  syncThemeUi();
}
new MutationObserver(syncThemeUi).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['data-theme'],
});

/* Update-Prüfung über version.json. Offline: nur Meldung, Caches und localStorage bleiben erhalten. */
let neueVersion = '';
/* Update-Karte in der Übersicht: Version aus dem stillen Start-Check, „Später“ gilt bis zum nächsten Start */
let updateHinweis = null;
let updateSpaeter = false;
function updateUi() {
  const dot = $('#app-update-dot');
  if (dot) dot.hidden = !neueVersion;
  const row = $('#updateRow');
  if (row) row.hidden = !neueVersion;
  const rem = $('#updateRemote');
  if (rem) rem.textContent = neueVersion ? 'v' + neueVersion : '';
  const lab = $('#app-version-label');
  if (lab) lab.className = 'status-pill status-pill--' + (neueVersion ? 'orange' : 'green');
}
async function pruefeUpdate(manuell) {
  const knopf = $('[data-act="checkupdate"]');
  if (manuell && knopf) knopf.disabled = true;
  try {
    const res = await fetch('./version.json?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('version.json nicht erreichbar');
    const data = await res.json();
    const remote = String(data.version || '').trim();
    neueVersion = remote && remote !== APP_VERSION ? remote : '';
    updateUi();
    if (!manuell) {
      updateHinweis = neueVersion || null;
      // Karte nur zeigen, wenn die Übersicht offen ist und keine Karte darüber liegt
      if (neueVersion && view.name === 'home' && !modalPanel) {
        render();
      }
    }
    if (manuell) {
      if (neueVersion) {
        toast('Update auf v' + neueVersion + ' wird geladen.');
        setTimeout(clearCachesAndReload, 900);
      } else {
        toast('Aktuellste Version v' + APP_VERSION + ' ist installiert.');
      }
    }
  } catch (e) {
    if (manuell)
      toast('Update-Prüfung nicht möglich. Internetverbindung prüfen und erneut versuchen.');
  } finally {
    const k2 = $('[data-act="checkupdate"]');
    if (k2) k2.disabled = false;
  }
}
/* Auswahl-Dropdowns und mittige Zahlenfelder (shared/choice-dropdown.js, Modul unten) */
function nachRender() {
  if (window.agUiInit) window.agUiInit();
}

/* Kopf: Unterzeile = Projektnummer · Kunde (im Formular / Bericht), sonst Bereichsname */
function hsubText() {
  const p = view.name === 'wizard' || (view.name === 'report' && !view.db) ? cur() : null;
  if (p)
    return (
      (p.values.projekt || 'ohne Projektnummer') +
      (p.values.kunde ? ', ' + p.values.kunde : '')
    );
  if (view.name === 'report' && view.db && view.rep) return view.rep.id || 'Kalkulation';
  return (
    {
      settings: 'Einstellungen',
      db: 'Datenbank / PDF',
      fragen: 'Fragen an den Kunden',
      info: 'Info & Anleitung',
    }[view.name] || 'Kalkulationen'
  );
}
function setHeader(animate) {
  const hs = $('#hsub'),
    t = hsubText();
  if (hsubAnim) {
    hsubAnim.cancel();
    hsubAnim = null;
  }
  const changed = hs.textContent !== t;
  hs.textContent = t;
  if (animate && changed && !RM() && hs.animate)
    hsubAnim = hs.animate(
      [
        { opacity: 0, transform: 'translateY(6px)' },
        { opacity: 0.75, transform: 'none' },
      ],
      { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' },
    );
}
/* Kopf der Formular-Ansicht: Zurück, Gesamtpreis (.hero), Schritte (.tab-strip) */
function setSteps() {
  const w = $('#stepwrap'),
    p = view.name === 'wizard' ? cur() : null;
  if (!p) {
    w.hidden = true;
    w.dataset.pid = '';
    return;
  }
  const n = PAGES.length,
    i = p.page;
  if (w.dataset.pid !== p.id) {
    w.dataset.pid = p.id;
    w.dataset.seite = '';
    w.innerHTML = `
      <button type="button" class="back-btn" data-act="home"><span class="material-symbols-rounded" aria-hidden="true">chevron_left</span>Übersicht</button>
      <section class="hero" aria-live="polite">
        <div class="hero-line">
          <span class="hero-value hero-value--compact numeric" id="heroBrutto">–</span>
          <span class="status-pill status-pill--neutral" id="heroPill"></span>
        </div>
        <div class="hero-caption numeric" id="heroNote"></div>
        <div class="progress-bar" id="progBar" role="progressbar" aria-label="Fortschritt" aria-valuemin="0" aria-valuemax="100"><i id="progFill"></i></div>
      </section>
      <nav class="tab-strip" data-choice-keep role="tablist" aria-label="Schritte">${PAGES.map(
        (x, k) =>
          `<button type="button" class="tab-pill" role="tab" data-act="jump" data-i="${k}"><span class="material-symbols-rounded" aria-hidden="true">check_circle</span>${esc(x.short)}</button>`,
      ).join('')}</nav>`;
  }
  w.hidden = false;
  const pct = Math.round(((i + 1) / n) * 100);
  $('#heroPill').textContent = `Schritt ${i + 1} von ${n}`;
  $('#progFill').style.width = pct + '%';
  $('#progBar').setAttribute('aria-valuenow', String(pct));
  w.querySelectorAll('.tab-pill').forEach((b, k) => {
    b.classList.toggle('is-done', k !== i && pageDone(p, k));
    b.setAttribute('aria-selected', String(k === i));
    if (k === i) b.setAttribute('aria-current', 'step');
    else b.removeAttribute('aria-current');
  });
  if (w.dataset.seite !== String(i)) {
    w.dataset.seite = String(i);
    const aktiv = w.querySelector('.tab-pill[aria-selected="true"]');
    const leiste = w.querySelector('.tab-strip');
    if (aktiv && leiste) {
      const dx = aktiv.getBoundingClientRect().left - leiste.getBoundingClientRect().left;
      leiste.scrollLeft += dx - (leiste.clientWidth - aktiv.offsetWidth) / 2;
    }
  }
}
/* Feste Leiste unten */
function barHtml() {
  if (view.name === 'wizard') {
    const p = cur();
    if (!p) return '';
    const i = p.page,
      last = i === PAGES.length - 1;
    return `<div><button type="button" class="btn-secondary" data-act="prev"${i === 0 ? ' disabled' : ''}>Zurück</button>${last ? '<button type="button" class="btn-primary" data-act="finish">Kalkulation abschließen</button>' : '<button type="button" class="btn-primary" data-act="next">Weiter</button>'}</div>`;
  }
  if (view.name === 'report' && reportForView()) {
    const run = pdfBusy === viewKey();
    const fill = run ? ` style="transform:scaleX(${pdfProg})"` : '';
    const teilen =
      lastPdf && lastPdf.key === viewKey()
        ? '<button type="button" class="btn-secondary" data-act="sharepdf">Teilen</button>'
        : '';
    return `<div><button type="button" class="btn-secondary" data-act="${view.db ? 'db' : 'home'}">Zurück</button><button type="button" class="btn-primary pdfb${run ? ' run' : ''}" data-act="makepdf"><span class="fill"${fill}></span><span class="l1">PDF erstellen</span><span class="lr">PDF wird erstellt …</span><span class="l2"><span class="material-symbols-rounded" aria-hidden="true">check</span>PDF fertig</span></button>${teilen}</div>`;
  }
  return '';
}
function setBar() {
  const b = $('#bar'),
    h = barHtml();
  if (b._lastHtml !== h) {
    b._lastHtml = h;
    b.innerHTML = h;
  }
  b.hidden = !h;
  document.body.classList.toggle('hasbar', !!h);
}
/* Abschnittswechsel ohne Animation: sofort tauschen und nach oben springen.
   Ist die Tastatur offen, erst schließen und warten, bis sich die Fensterhöhe beruhigt hat.
   Sonst laufen Tastatur-Animation und Seitenwechsel gleichzeitig und die Seiten überlagern sich. */
function wechsleSeite(change) {
  const vid = view.id;
  const tausche = () => {
    if (view.name !== 'wizard' || view.id !== vid) {
      return;
    }
    change();
    render();
    window.scrollTo(0, 0);
  };
  const ae = document.activeElement;
  const vv = window.visualViewport;
  const feld = !!(ae && ae.matches && ae.matches('input,textarea,select'));
  const tastaturOffen = feld && !!vv && vv.height < window.innerHeight * 0.85;
  if (feld) {
    ae.blur();
  }
  if (!tastaturOffen) {
    tausche();
    return;
  }
  let timer = null;
  let fertig = false;
  const los = () => {
    if (fertig) {
      return;
    }
    fertig = true;
    vv.removeEventListener('resize', warte);
    clearTimeout(timer);
    clearTimeout(grenze);
    tausche();
  };
  const warte = () => {
    clearTimeout(timer);
    timer = setTimeout(los, 80);
  };
  const grenze = setTimeout(los, 500);
  vv.addEventListener('resize', warte);
}
async function showReport() {
  const host = $('#sheet'),
    r = reportForView();
  if (!host || !r) return;
  await reportFontsReady();
  if (!host.isConnected) return;
  layoutReport(r, host);
  host.style.zoom = Math.min(
    1,
    (host.parentElement.clientWidth - 8) / host.querySelector('.page').offsetWidth,
  );
}
function updateNet() {
  const n = calcs.filter((p) => p.status === 'done' && !p.synced).length;
  const el = $('#net');
  const on = navigator.onLine;
  el.className = 'net' + (on ? '' : ' off');
  el.innerHTML = `<i class="nd"></i><span class="nt">${on ? 'online' : 'offline'}</span>${n ? `<span class="sep">, </span><span class="np">${n}</span><span class="nl">&nbsp;ausstehend</span>` : ''}`;
  el.title = (on ? 'online' : 'offline') + (n ? `, ${n} ausstehend` : '');
}
