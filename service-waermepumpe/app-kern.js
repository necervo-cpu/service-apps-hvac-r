// Kern: Speicher, Helfer, Prüfung und Bewertung, Navigation, Rahmen (Meldung, Modal-Karte, Darstellung, Update).
'use strict';

/* ---------- Speicher ---------- */
LS.fullMsg += ' Übertragene Protokolle löschen.';
const SETTINGS_FIELDS = [
  {
    id: 's_tech',
    key: 'techniker',
    label: 'Monteur (Vorbelegung)',
  },
];
let settings = Object.assign(
  { url: '', token: '', firma: '', techniker: '' },
  LS.get('wp2.settings', {}),
);
let protocols = LS.get('wp2.protocols', []);
let dbCache = LS.get('wp2.db', { at: null, list: [] });
const save = () => LS.set('wp2.protocols', protocols);

/* ---------- Helfer ---------- */
const app = $('#app');
function fmtDate(s) {
  if (!s) return '';
  const d = new Date(String(s).length === 10 ? s + 'T12:00:00' : s);
  return isNaN(d) ? String(s) : d.toLocaleDateString('de-DE');
}
function num(v) {
  return typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.'));
}
function safeImg(src) {
  return typeof src === 'string' &&
    /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(src)
    ? src
    : '';
}

function materialListe(v) {
  if (!Array.isArray(v.material)) {
    return [];
  }
  return v.material
    .filter((m) => m && String(m.teil ?? '').trim() !== '')
    .map((m) => ({ teil: String(m.teil).trim(), menge: String(m.menge ?? '').trim() }));
}
function materialText(v) {
  return materialListe(v)
    .map((m) => (m.menge ? `${m.teil} ×${m.menge}` : m.teil))
    .join('; ');
}
const MENGE_VOLL = /^\d+([.,]\d+)?$/;
const MENGE_TIPP = /^\d*[.,]?\d*$/;
function parseMenge(s) {
  const t = String(s ?? '').trim();
  if (!MENGE_VOLL.test(t)) {
    return null;
  }
  return parseFloat(t.replace(',', '.'));
}
function fmtMenge(n) {
  return String(Math.round(n * 1000) / 1000).replace('.', ',');
}
function materialName(s) {
  return String(s ?? '')
    .replace(/;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function materialAusText(text) {
  return String(text ?? '')
    .split(';')
    .map((t) => t.trim())
    .filter((t) => t !== '')
    .map((t) => {
      const m = t.match(/^(.*) ×(\d+(?:[.,]\d+)?)$/);
      return m ? { teil: m[1].trim(), menge: m[2] } : { teil: t, menge: '' };
    })
    .filter((m) => m.teil !== '');
}
function materialArray(p) {
  if (!Array.isArray(p.values.material)) {
    p.values.material = [];
  }
  return p.values.material;
}

/* ---------- Werte, Prüfung, Bewertung ---------- */
function recompute(p) {
  ALL_FIELDS.forEach((f) => {
    if (f.type === 'calc') p.values[f.id] = f.calc(p.values);
  });
}
function display(f, x) {
  if (x === '' || x == null) return '';
  if (f.type === 'date') return fmtDate(x);
  if ((f.type === 'number' || f.type === 'calc') && isN(x))
    return fmtNum(String(x).trim()) + (f.unit ? ' ' + f.unit : '');
  return String(x);
}
function sollText(f) {
  if (f.soll) return f.soll;
  const u = f.unit && f.unit !== 'pH' ? ' ' + f.unit : '';
  if (f.sMin != null && f.sMax != null)
    return `Soll ${fmtNum(f.sMin)} – ${fmtNum(f.sMax)}${u}`;
  if (f.sMax != null) return `Soll ≤ ${fmtNum(f.sMax)}${u}`;
  if (f.sMin != null) return `Soll ≥ ${fmtNum(f.sMin)}${u}`;
  return '';
}
function evalField(f, v) {
  const x = v[f.id];
  if (f.type === 'bewertung') {
    return bewertungArt(x);
  }
  if (f.type === 'okfail')
    return x === 'i.O.' ? 'ok' : x === 'n.i.O.' ? 'bad' : x === 'entfällt' ? 'na' : 'none';
  if (f.bad && f.bad.includes(x)) return 'bad';
  if (f.good && f.good.includes(x)) return 'ok';
  if (f.warn && f.warn.includes(x)) return 'warn';
  if (f.type === 'number' && isN(x) && (f.sMin != null || f.sMax != null)) {
    const n = num(x);
    return (f.sMin != null && n < f.sMin) || (f.sMax != null && n > f.sMax) ? 'warn' : 'ok';
  }
  if (f.id === 'wasser' && x) return x === 'im Richtbereich' ? 'ok' : 'warn';
  return 'none';
}
function defects(p) {
  return ALL_FIELDS.filter(
    (f) =>
      f.type !== 'calc' &&
      f.type !== 'bewertung' &&
      f.type !== 'material' &&
      ['bad', 'warn'].includes(evalField(f, p.values)),
  ).map((f) => {
    let text = `${f.pdf || f.label}: ${display(f, p.values[f.id])}`;
    if (evalField(f, p.values) === 'warn') {
      text += ` (${sollText(f)})`;
    }
    const mangel = String(p.values[f.id + 'M'] ?? '').trim();
    if (f.type === 'okfail' && mangel) {
      text += ` – ${mangel}`;
    }
    return text;
  });
}
const PFLICHTFELDER = false; // true = Pflichtfelder (req/reqIf) und Monteur-Unterschrift werden wieder erzwungen
function isRequired(f, p) {
  return PFLICHTFELDER && (!!f.req || (f.reqIf ? f.reqIf(p.values, p) : false));
}
function fieldError(f, p) {
  if (f.type === 'calc' || f.type === 'material') return '';
  const x = p.values[f.id],
    empty = String(x ?? '').trim() === '';
  if (empty) return isRequired(f, p) ? f.reqMsg || 'Pflichtfeld' : '';
  if (f.type === 'number') {
    if (!isN(x)) return 'Bitte eine gültige Zahl eingeben.';
    const n = num(x);
    if ((f.min != null && n < f.min) || (f.max != null && n > f.max))
      return `Unplausibler Wert (erlaubt ${fmtNum(f.min)} – ${fmtNum(f.max)} ${f.unit || ''})`;
  }
  if (f.type === 'date' && f.notFuture && x > today()) return 'Datum liegt in der Zukunft.';
  return '';
}
function pageErrors(p, i) {
  return TEMPLATE.pages[i].fields.map((f) => [f, fieldError(f, p)]).filter((e) => e[1]);
}
function vorbelegtGleich(p, id) {
  return (
    !!p.vorbelegt &&
    JSON.stringify(p.values[id] ?? '') === JSON.stringify(p.vorbelegt[id] ?? '')
  );
}
function vorbelegtErfassen(p) {
  p.vorbelegt = {};
  Object.keys(p.values).forEach((id) => {
    if (JSON.stringify(p.values[id] ?? '') !== '""') {
      p.vorbelegt[id] = p.values[id];
    }
  });
}
function pageDone(p, i) {
  return (
    TEMPLATE.pages[i].fields.every((f) => f.type === 'calc' || !fieldError(f, p)) &&
    TEMPLATE.pages[i].fields.some(
      (f) =>
        f.type !== 'calc' &&
        !f.parent &&
        !(f.type === 'bewertung' && !BEWERTUNG.includes(p.values[f.id])) &&
        (f.type === 'material' ||
          (p.vorbelegt ? !vorbelegtGleich(p, f.id) : f.init == null)) &&
        (f.type === 'material'
          ? materialListe(p.values).length > 0
          : String(p.values[f.id] ?? '') !== ''),
    )
  );
}

/* Bericht-Datenstruktur – identisch genutzt von App-PDF und Apps-Script-PDF */
function buildReport(p) {
  const v = p.values;
  const rowsOf = (pg) =>
    pg.fields
      .filter(
        (f) =>
          !f.parent &&
          !(f.wide && !v[f.id]) &&
          !(f.show && !f.show(v) && !v[f.id]) &&
          !(f.opt && !String(v[f.id] ?? '').trim()),
      )
      .map((f) => ({
        label: f.pdf || f.label,
        value: display(f, v[f.id]),
        eval: evalField(f, v),
        wide: !!f.wide,
        calc: f.type === 'calc',
        mangel:
          f.type === 'okfail' && v[f.id] === 'n.i.O.'
            ? String(v[f.id + 'M'] ?? '').trim()
            : '',
      }));
  return {
    title: TEMPLATE.title,
    firma: settings.firma || '',
    header: rowsOf(TEMPLATE.pages[0]),
    sections: TEMPLATE.pages
      .filter((pg) => !pg.header && !pg.final && pg.fields[0].type !== 'material')
      .map((pg) => ({
        title: pg.pdfTitle || pg.title,
        kind: pg.kind || 'grid',
        rows: rowsOf(pg),
      })),
    material: materialListe(v),
    defects: defects(p),
    dpv: v.dpv || '',
    co2: isN(v.co2) ? num(v.co2) : '',
    success: v.erfolg || '',
    successMangel: v.erfolg === 'n.i.O.' ? String(v.erfolgM ?? '').trim() : '',
    betrieb: v.betrieb || '',
    remark: v.bem || '',
    techniker: v.monteur || '',
    kundeName: p.kundeName || '',
    id: v.projekt || p.id,
    completedAt: p.completedAt || '',
  };
}
/* Spaltenwerte fürs Google Sheet */
function buildCols(p) {
  return ALL_FIELDS.filter((f) => f.col).map((f) => {
    if (f.type === 'material') {
      return [f.col, materialText(p.values), ''];
    }
    const x = f.parent && p.values[f.parent] !== 'n.i.O.' ? '' : p.values[f.id];
    if (x === '' || x == null) return [f.col, '', ''];
    if (f.type === 'date') return [f.col, x, 'date'];
    if ((f.type === 'number' || f.type === 'calc') && isN(x)) return [f.col, num(x), ''];
    return [f.col, String(x), ''];
  });
}

/* ---------- Navigation ---------- */
let view = { name: 'home' };
let navBusy = false;
let pdfBusy = null;
let pdfProg = 0;
let pdfTick = null;
function go(name, params) {
  view = Object.assign({ name }, params || {});
  render();
  window.scrollTo(0, 0);
}
function cur() {
  return protocols.find((p) => p.id === view.id);
}
function render() {
  app.innerHTML = (Views[view.name] || Views.home)();
  setHeader(true);
  if (view.name === 'report') {
    showReport();
  }
  if (After[view.name]) {
    After[view.name]();
  }
  setSteps();
  setBar();
  updateNet();
  nachRender();
}
/* Kopf: Unterzeile = Projektnummer, Kunde (im Formular und Bericht), sonst Bereichsname */
function hsubText() {
  const p = view.name === 'wizard' || (view.name === 'report' && !view.db) ? cur() : null;
  if (p) {
    return (
      (p.values.projekt || 'ohne Projektnummer') +
      (p.values.kunde ? ', ' + p.values.kunde : '')
    );
  }
  if (view.name === 'report' && view.db && view.rep) {
    return view.rep.id || 'Bericht';
  }
  return view.name === 'db' ? 'Datenbank und PDF' : 'Wartungsprotokolle';
}
const sichtbar = (f, v) => !f.show || !!f.show(v);
/* Fortschritt: Pflicht-Prüfpunkte und Pflicht-Messwerte, Zahl erfasst von gesamt */
function punkteVon(p) {
  const v = p.values;
  const liste = ALL_FIELDS.filter(
    (f) =>
      !f.parent && f.req && (f.type === 'okfail' || f.type === 'number') && sichtbar(f, v),
  );
  return {
    total: liste.length,
    done: liste.filter((f) => String(v[f.id] ?? '').trim() !== '').length,
  };
}
/* Kopf der Formular-Ansicht: Zurück, Fortschritt (.hero), Abschnitte (.tab-strip) */
function setSteps() {
  const w = $('#stepwrap');
  const p = view.name === 'wizard' ? cur() : null;
  if (!p) {
    w.hidden = true;
    w.dataset.pid = '';
    return;
  }
  const i = p.page;
  if (w.dataset.pid !== p.id) {
    w.dataset.pid = p.id;
    w.dataset.seite = '';
    w.innerHTML = `
      <button type="button" class="back-btn" data-act="home"><span class="material-symbols-rounded" aria-hidden="true">chevron_left</span>Übersicht</button>
      <section class="hero" aria-live="polite">
        <div class="hero-line">
          <span class="hero-value hero-value--compact numeric"><span id="progDone">0</span> <span class="metric-unit">von <span id="progTotal">0</span> Punkten</span></span>
          <span class="status-pill status-pill--neutral" id="heroPill"></span>
        </div>
        <div class="progress-bar" id="progBar" role="progressbar" aria-label="Fortschritt" aria-valuemin="0" aria-valuemax="100"><i id="progFill"></i></div>
      </section>
      <nav class="tab-strip" data-choice-keep role="tablist" aria-label="Abschnitte">${TEMPLATE.pages
        .map(
          (pg, k) =>
            `<button type="button" class="tab-pill" role="tab" data-act="step" data-i="${k}"><span class="material-symbols-rounded" aria-hidden="true">check_circle</span>${esc(pg.short)}</button>`,
        )
        .join('')}</nav>`;
  }
  w.hidden = false;
  const pt = punkteVon(p);
  const pct = pt.total ? Math.round((pt.done / pt.total) * 100) : 0;
  $('#progDone').textContent = pt.done;
  $('#progTotal').textContent = pt.total;
  $('#progFill').style.width = pct + '%';
  $('#progBar').setAttribute('aria-valuenow', String(pct));
  const m = defects(p).length;
  const pill = $('#heroPill');
  pill.className = 'status-pill status-pill--' + (m ? 'orange' : 'neutral');
  pill.textContent = m ? (m === 1 ? '1 Mangel' : m + ' Mängel') : 'Keine Mängel';
  w.querySelectorAll('.tab-pill').forEach((b, k) => {
    b.classList.toggle('is-done', k !== i && !TEMPLATE.pages[k].final && pageDone(p, k));
    b.setAttribute('aria-selected', String(k === i));
    if (k === i) {
      b.setAttribute('aria-current', 'step');
    } else {
      b.removeAttribute('aria-current');
    }
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
/* Abschnittswechsel ohne Animation: sofort tauschen und nach oben springen.
   Ist die Tastatur offen, erst schließen und warten, bis sich die Fensterhöhe beruhigt hat.
   Sonst laufen Tastatur-Animation und Seitenwechsel gleichzeitig und die Seiten überlagern sich. */
function wechsleSeite(change) {
  const noch = wizSnapshot();
  const tausche = () => {
    if (!noch()) {
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
/* Feste Leiste unten */
function barHtml() {
  if (view.name === 'wizard') {
    const p = cur();
    if (!p) {
      return '';
    }
    const i = p.page;
    const pg = TEMPLATE.pages[i];
    const weiter = pg.final
      ? '<button type="button" class="btn-primary" data-act="finish">Protokoll abschließen</button>'
      : '<button type="button" class="btn-primary" data-act="next">Weiter</button>';
    return `<div><button type="button" class="btn-secondary" data-act="prev"${i === 0 ? ' disabled' : ''}>Zurück</button>${weiter}</div>`;
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
  barRender(barHtml());
}
function wizSnapshot() {
  const vid = view.id;
  return () => view.name === 'wizard' && view.id === vid;
}
function updateNet() {
  netRender(protocols.filter((p) => p.status === 'done' && !p.synced).length);
}

const APP_VERSION = '3.0.3';
const BUILD_DATE = '2026-11-23';

/* ===== Rahmen: Meldung, Modal-Karte, Darstellung, Update ===== */
let toastTimer2;
function toast(msg) {
  const t = $('#toast');
  if (!t) {
    return;
  }
  $('#toastText').textContent = msg;
  t.classList.add('is-visible');
  clearTimeout(toastTimer2);
  toastTimer2 = setTimeout(() => t.classList.remove('is-visible'), 3500);
}

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
  if (first) {
    first.focus();
  }
}
function modalClose() {
  if (!modalPanel) {
    return;
  }
  const war = modalPanel;
  modalPanel = null;
  $('#modalHost').classList.remove('is-open');
  $('#appShell').inert = false;
  $('#bar').inert = false;
  if (modalFocus && modalFocus.focus) {
    modalFocus.focus();
  }
  if (war === 'confirm' && confirmDone) {
    const fertig = confirmDone;
    confirmDone = null;
    fertig(false);
  }
  if (war === 'settings') {
    render();
  }
}
/* Rückfrage (ersetzt den Browser-Dialog): gleiche Aufrufschnittstelle wie in shared/core.js */
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
  $('#s_url').value = settings.url || '';
  $('#s_token').value = settings.token || '';
  $('#s_firma').value = settings.firma || '';
  $('#settingsFields').innerHTML = SETTINGS_FIELDS.map(
    (f) => `
      <div class="form-group">
        <label class="form-label" for="${f.id}">${esc(f.label)}</label>
        <div class="field-box"><input class="text-input" id="${f.id}" type="text" value="${esc(settings[f.key])}" autocomplete="off"></div>
      </div>`,
  ).join('');
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
    if (modalFocus && modalFocus.focus) {
      modalFocus.focus();
    }
    if (fertig) {
      fertig(true);
    }
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    modalClose();
  }
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
    if (wahl === 'system') {
      localStorage.removeItem('ag-theme');
    } else {
      localStorage.setItem('ag-theme', wahl);
    }
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
new MutationObserver(syncThemeUi).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['data-theme'],
});

/* Update-Prüfung über version.json. Offline: nur Meldung, Caches und localStorage bleiben erhalten. */
/* Update-Karte in der Übersicht: Version aus dem stillen Start-Check, „Später“ gilt bis zum nächsten Start */
let updateHinweis = null;
let updateSpaeter = false;
async function pruefeUpdate(manuell) {
  const knopf = $('[data-act="checkupdate"]');
  if (manuell && knopf) {
    knopf.disabled = true;
  }
  try {
    const res = await fetch('./version.json?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) {
      throw new Error('version.json nicht erreichbar');
    }
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
      // Karte nur zeigen, wenn die Übersicht offen ist und keine Karte darüber liegt
      if (neu && view.name === 'home' && !modalPanel) {
        render();
      }
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
    if (manuell) {
      toast('Update-Prüfung nicht möglich. Internetverbindung prüfen und erneut versuchen.');
    }
  } finally {
    if (knopf) {
      knopf.disabled = false;
    }
  }
}

/* Auswahl-Dropdowns und mittige Zahlenfelder (shared/choice-dropdown.js, Modul unten) */
function nachRender() {
  if (window.agUiInit) {
    window.agUiInit();
  }
}
