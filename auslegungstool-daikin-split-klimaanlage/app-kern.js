/* app-kern.js – Grundlagen: Konfiguration, Zustand, Modal-Karte, Darstellung, Update-Prüfung, Daten laden.
   Klassisches Skript. Gemeinsame Helfer ($, esc, LS, uid, today, RM, flash) kommen aus shared/core.js. */
'use strict';
/* ====== Konfiguration ====== */
const KEY = { settings: 'dk.settings', projects: 'dk.projects', data: 'dk.data' };

/* ====== Hilfen (fmt, fmtDate, MSR, toast) ====== */
const fmt = (n, d = 1) =>
  n == null
    ? '—'
    : Number(n).toLocaleString('de-DE', {
        minimumFractionDigits: 0,
        maximumFractionDigits: d,
      });
const fmtDate = (s) => {
  if (!s) return '';
  const m = String(s).match(/^(\d{4})-(\d\d)-(\d\d)/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : s;
};
const app = $('#app');
const MSR = (n) => `<span class="material-symbols-rounded" aria-hidden="true">${n}</span>`;
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  if (!t) return;
  $('#toastText').textContent = msg;
  t.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-visible'), 3800);
}
const E = window.Engine;

/* ====== Zustand ====== */
let settings = Object.assign({ firma: '', bearbeiter: '' }, LS.get(KEY.settings, {}));
delete settings.sheetId;
const APP_VERSION = '3.0.5';
const BUILD_DATE = '2026-11-22';

/* Zahlenfelder: beim Antippen alles markieren */
document.addEventListener('focusin', (e) => {
  const el = e.target;
  if (
    el &&
    el.tagName === 'INPUT' &&
    (el.type === 'number' ||
      el.inputMode === 'decimal' ||
      el.inputMode === 'numeric' ||
      el.classList.contains('glass-input'))
  ) {
    try {
      el.select();
    } catch (err) {}
  }
});

/* ====== Rahmen: Modal-Karte, Darstellung, Update ====== */
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
  $('#s_firma').value = settings.firma || '';
  $('#s_bear').value = settings.bearbeiter || '';
  $('#dataInfoLabel').textContent = dataInfo;
  $('#app-version-label').textContent = 'v' + APP_VERSION;
  $('#appBuildDateLabel').textContent = BUILD_DATE;
  syncThemeUi();
  modalOpen('settings');
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
  const dunkel = document.documentElement.getAttribute('data-theme') !== 'light';
  const farbe = dunkel ? '#000000' : '#F8FAFC';
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    if (m.getAttribute('content') !== farbe) m.setAttribute('content', farbe);
  });
  const btn = $('#themeToggleBtn');
  if (btn) {
    btn.innerHTML = MSR(dunkel ? 'light_mode' : 'dark_mode');
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
document
  .querySelectorAll('[data-theme-choice]')
  .forEach((b) => b.addEventListener('click', () => setzeDarstellung(b.dataset.themeChoice)));
$('#themeToggleBtn').addEventListener('click', () => {
  const hell = document.documentElement.getAttribute('data-theme') === 'light';
  setzeDarstellung(hell ? 'dark' : 'light');
});
new MutationObserver(syncThemeUi).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['data-theme'],
});

/* Update-Prüfung über version.json. Offline: nur Meldung, Caches und localStorage bleiben erhalten. */
async function clearCachesAndReload() {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) await reg.update().catch(() => {});
    }
  } catch (e) {}
  window.location.reload();
}
/* Update-Karte in der Übersicht: Version aus dem stillen Start-Check, „Später“ gilt bis zum nächsten Start */
let updateHinweis = null;
let updateSpaeter = false;
async function pruefeUpdate(manuell) {
  const knopf = $('[data-act="checkupdate"]');
  if (manuell && knopf) knopf.disabled = true;
  try {
    const res = await fetch('./version.json?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('version.json nicht erreichbar');
    const data = await res.json();
    const remote = String(data.version || '').trim();
    const neu = !!remote && remote !== APP_VERSION;
    $('#app-update-dot').hidden = !neu;
    $('#updateRow').hidden = !neu;
    $('#updateRemote').textContent = neu ? 'v' + remote : '';
    $('#app-version-label').className =
      'status-pill ' + (neu ? 'status-pill--orange' : 'status-pill--green');
    if (!manuell) {
      updateHinweis = neu ? remote : null;
      // Karte nur in der Übersicht und nie über einer offenen Modal-Karte oder während der Bearbeitung
      if (neu && view.name === 'list' && !modalPanel) render();
    }
    if (manuell) {
      if (neu) {
        toast('Update auf v' + remote + ' wird geladen.');
        setTimeout(clearCachesAndReload, 900);
      } else {
        toast('Aktuellste Version v' + APP_VERSION + ' ist installiert.');
      }
    }
  } catch (e) {
    if (manuell)
      toast('Update-Prüfung nicht möglich. Internetverbindung prüfen und erneut versuchen.');
  } finally {
    if (knopf) knopf.disabled = false;
  }
}
function updateNet() {
  const el = $('#net');
  const on = navigator.onLine;
  el.hidden = on;
  el.innerHTML = on ? '' : '<i class="nd"></i><span>Offline</span>';
}

/* Auswahl-Dropdowns und mittige Zahlenfelder (shared/choice-dropdown.js, Modul unten) */
function nachRender() {
  if (window.agUiInit) window.agUiInit();
}

let projects = LS.get(KEY.projects, []);
let view = { name: 'list' };
let DB = null,
  dataInfo = '';
let lastPdf = null;
let pdfBusy = null,
  pdfProg = 0; // pdfBusy = Id der Auslegung, deren PDF gerade erstellt wird
let prevKpi = null,
  navBusy = false,
  hsubOut = null; // prevKpi: zuletzt angezeigte Werte (für Aufleuchten bei Änderung)

function newRoom() {
  return {
    id: uid(),
    name: '',
    raumtyp: DB.raumtypen[0] ? DB.raumtypen[0].name : '',
    zuschlag: DB.zuschlaege[0] ? DB.zuschlaege[0].name : '',
    flaeche: '',
    bedarf: '',
    typ: 'Wandgerät',
    serie: DB.ig.some((x) => x.serie === 'Perfera' && x.typ === 'Wandgerät') ? 'Perfera' : '',
    modell: '',
    rohr: '',
    hoehe: '',
  };
}
function newProject() {
  return {
    id: uid(),
    nr: '',
    datum: today(),
    kunde: '',
    bearbeiter: settings.bearbeiter || '',
    bemerkung: '',
    odu: '',
    rooms: [newRoom(), newRoom()],
  };
}
const cur = () => projects.find((p) => p.id === view.id);
const saveProjects = () => LS.set(KEY.projects, projects);

/* ====== Daten laden ======
   Alle Daikin-Werte stecken in daten.js (erzeugt aus daten/*.csv). Kein Google Sheet: neue Daikin-Werte kommen per App-Update. */
function loadData() {
  try {
    localStorage.removeItem(KEY.data);
  } catch (e) {} // Zwischenspeicher aus der früheren Google-Sheet-Anbindung
  DB = E.normalize(window.DATEN_SEED);
  dataInfo = DB.ein.datenstand || 'Daikin-Daten in der App';
}
