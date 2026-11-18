// Kern: Speicher, Werte und Prüfung, Bericht-Datenstruktur, Navigation, Rahmen (Meldung, Modal-Karte, Darstellung, Update).
'use strict';

/* ---------- Speicher ---------- */
LS.fullMsg += ' Übertragene Protokolle löschen.';
const SETTINGS_FIELDS = [
  {
    id: 's_tech',
    key: 'techniker',
    label: 'Monteur (Vorbelegung)',
    placeholder: 'C.Geuther',
  },
];
let settings = Object.assign(
  { url: '', token: '', firma: '', techniker: '' },
  LS.get('ibn.settings', {}),
);
let protocols = LS.get('ibn.protocols', []);
let dbCache = LS.get('ibn.db', { at: null, list: [] });
const save = () => LS.set('ibn.protocols', protocols);

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
const isVis = (f, v) => !f.show || f.show(v);
const isEditable = (f, v) => !f.legacy && isVis(f, v); // legacy = entfallenes Feld: nicht bearbeitbar

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
  const u = f.unit ? ' ' + f.unit : '';
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
  if (f.type === 'number' && isN(x) && (f.sMin != null || f.sMax != null)) {
    const n = num(x);
    return (f.sMin != null && n < f.sMin) || (f.sMax != null && n > f.sMax) ? 'warn' : 'ok';
  }
  return 'none';
}
function defects(p) {
  return ALL_FIELDS.filter(
    (f) =>
      f.type !== 'calc' &&
      f.type !== 'bewertung' &&
      isVis(f, p.values) &&
      ['bad', 'warn'].includes(evalField(f, p.values)),
  ).map((f) => {
    const mangel = String(p.values[f.id + 'M'] ?? '').trim();
    return (
      `${f.pdf || f.label}: ${display(f, p.values[f.id])}` +
      (evalField(f, p.values) === 'warn' ? ` (${sollText(f)})` : '') +
      (f.type === 'okfail' && mangel ? ` – ${mangel}` : '')
    );
  });
}
const PFLICHTFELDER = false; // true = Pflichtfelder (req/reqIf) und Monteur-Unterschrift werden wieder erzwungen
function isRequired(f, p) {
  return PFLICHTFELDER && (!!f.req || (f.reqIf ? f.reqIf(p.values, p) : false));
}
function fieldError(f, p) {
  if (f.type === 'calc' || !isVis(f, p.values)) return '';
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
  const fs = TEMPLATE.pages[i].fields.filter(
    (f) => f.type !== 'calc' && isEditable(f, p.values),
  );
  return (
    fs.every((f) => !fieldError(f, p)) &&
    fs.some(
      (f) =>
        !f.parent &&
        !(f.type === 'bewertung' && !BEWERTUNG.includes(p.values[f.id])) &&
        !vorbelegtGleich(p, f.id) &&
        String(p.values[f.id] ?? '') !== '',
    )
  );
}

/* Bericht-Datenstruktur – identisch genutzt von App-PDF und Apps-Script-PDF */
function buildReport(p) {
  const v = p.values;
  const row = (f) => ({
    label: f.pdf || f.label,
    value: display(f, v[f.id]),
    eval: evalField(f, v),
    wide: !!f.wide,
    mangel:
      f.type === 'okfail' && v[f.id] === 'n.i.O.' ? String(v[f.id + 'M'] ?? '').trim() : '',
  });
  const rowsOf = (fs) =>
    fs
      .filter(
        (f) => !f.parent && isVis(f, v) && !(f.wide && !v[f.id]) && !(f.legacy && !v[f.id]),
      )
      .map(row);
  const section = (pg) => {
    const inTab = new Set(pg.table ? pg.table.rows.flatMap((r) => r.ids) : []);
    const rest = pg.fields.filter((f) => !inTab.has(f.id));
    const body = pg.table
      ? pg.table.rows
          .filter(
            (r) =>
              (!r.show || r.show(v)) &&
              r.ids.some((id) => String(v[id] ?? '') !== '' && !vorbelegtGleich(p, id)),
          )
          .map((r) => ({
            label: r.label,
            cells: r.ids.map((id) => ({
              value: display(FIELD[id], v[id]),
              eval: evalField(FIELD[id], v),
            })),
          }))
      : [];
    return {
      title: pg.pdfTitle || pg.title,
      kind: pg.kind || 'grid',
      table: body.length ? { head: pg.table.head, body } : null,
      rows: rowsOf(rest.filter((f) => f.type !== 'okfail')),
      checks: rowsOf(rest.filter((f) => f.type === 'okfail')),
    };
  };
  return {
    title: TEMPLATE.title,
    firma: settings.firma || '',
    header: rowsOf(TEMPLATE.pages[0].fields),
    sections: TEMPLATE.pages.filter((pg) => !pg.header && !pg.final).map(section),
    defects: defects(p),
    resultLabel: 'Gesamtbewertung Inbetriebnahme',
    success: v.erfolg || '',
    successMangel: v.erfolg === 'n.i.O.' ? String(v.erfolgM ?? '').trim() : '',
    subline: v.einw ? 'Einweisung Betreiber: ' + v.einw : '',
    hinweis: HINWEIS,
    remark: v.bem || '',
    techniker: v.monteur || '',
    kundeName: p.kundeName || '',
    id: v.projekt || p.id,
    completedAt: p.completedAt || '',
  };
}
/* Spaltenwerte fürs Google Sheet (ausgeblendete Innengeräte werden geleert) */
function buildCols(p) {
  return ALL_FIELDS.filter((f) => f.col).map((f) => {
    const x = isVis(f, p.values) ? p.values[f.id] : '';
    if (x === '' || x == null) return [f.col, '', ''];
    if (f.type === 'date') return [f.col, x, 'date'];
    if ((f.type === 'number' || f.type === 'calc') && isN(x)) return [f.col, num(x), ''];
    return [f.col, String(x), ''];
  });
}

/* ---------- Navigation ---------- */
let view = { name: 'home' };
let enterNext = false;
let enterT = null;
let navBusy = false;
let pdfBusy = null;
let pdfProg = 0;
let pdfTick = null;
let hsubAnim = null;
/* Überblenden beim Wechsel der Ansicht: alte Fläche 90 ms aus, neue 220 ms ein */
let fadenNr = 0;
function fadeThrough(change) {
  if (RM() || !app.animate) {
    change();
    return;
  }
  const nr = ++fadenNr;
  /* Laufende Animationen beenden, sonst bleibt eine alte Ausblendung (fill: forwards) stehen */
  app.getAnimations().forEach((a) => a.cancel());
  /* Aus: bleibt bis zum Tausch auf 0 (fill: forwards), damit die alte Seite nicht kurz wieder aufblitzt */
  const aus = app.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: 90,
    easing: 'ease-out',
    fill: 'forwards',
  });
  aus.finished
    .then(() => {
      if (nr !== fadenNr) {
        return;
      }
      change();
      aus.cancel();
      app.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' });
    })
    .catch(() => {});
}
function go(name, params) {
  view = Object.assign({ name }, params || {});
  enterNext = name === 'wizard';
  if (name === 'wizard') {
    render();
    window.scrollTo(0, 0);
    return;
  }
  fadeThrough(() => {
    render();
    window.scrollTo(0, 0);
  });
}
function cur() {
  return protocols.find((p) => p.id === view.id);
}
function render() {
  const enter = enterNext;
  enterNext = false;
  app.innerHTML = (Views[view.name] || Views.home)();
  if (!navBusy) {
    app.className = enter && !RM() ? 'entering' : '';
    clearTimeout(enterT);
    if (enter) {
      enterT = setTimeout(() => {
        if (!navBusy) {
          app.classList.remove('entering');
        }
      }, 900);
    }
  }
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
/* Kopf: Unterzeile = Projektnummer, Kunde (im Formular / Bericht), sonst Bereichsname */
function hsubText() {
  const p = view.name === 'wizard' || (view.name === 'report' && !view.db) ? cur() : null;
  if (p) {
    return (
      (p.values.projekt || 'ohne Protokoll-Nr.') +
      (p.values.kunde ? ', ' + p.values.kunde : '')
    );
  }
  if (view.name === 'report' && view.db && view.rep) {
    return view.rep.id || 'Bericht';
  }
  return view.name === 'db' ? 'Datenbank / PDF' : 'Split-Klimaanlagen';
}
/* Fortschritt: Prüfpunkte und Messwerte der sichtbaren Geräte, Zahl erledigt von gesamt */
function punkteVon(p) {
  const v = p.values;
  const liste = ALL_FIELDS.filter(
    (f) => !f.parent && isEditable(f, v) && (f.type === 'okfail' || f.type === 'number'),
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

/* Inhalt einer Formularseite: gruppierte Zeilen auf dem Canvas */
function gruppenHtml(liste, p, kopf) {
  const gruppen = [];
  liste.forEach((f) => {
    const name = f.group || '';
    const letzte = gruppen[gruppen.length - 1];
    if (letzte && letzte.name === name) {
      letzte.liste.push(f);
    } else {
      gruppen.push({ name, liste: [f] });
    }
  });
  return gruppen
    .map(
      (g) =>
        `${g.name ? `<${kopf} class="section-title">${esc(g.name)}</${kopf}>` : ''}
        <div class="group group--form">${g.liste.map((f) => fieldHtml(f, p)).join('')}</div>`,
    )
    .join('');
}
const sichtbareFelder = (liste, v) => liste.filter((f) => !f.parent && isEditable(f, v));
function alleOkHtml(liste, v, id, attrs) {
  const hat = liste.some((f) => f.type === 'okfail');
  if (!hat) {
    return '';
  }
  const offen = liste.some((f) => f.type === 'okfail' && !v[f.id]);
  return `<button type="button" class="btn-secondary allok-btn" id="${id}" ${attrs}${offen ? '' : ' hidden'}><span class="material-symbols-rounded" aria-hidden="true">done_all</span><span>Offene Prüfpunkte auf i.O. setzen</span></button>`;
}
function wizardHtml(p, i) {
  const pg = TEMPLATE.pages[i];
  const sichtbar = sichtbareFelder(pg.fields, p.values);
  const abschnitte = gruppenHtml(sichtbar, p, 'h2');
  const alleOk = alleOkHtml(sichtbar, p.values, 'allokBtn', 'data-act="allok"');
  return `${alleOk}${pg.final ? finalHtml(p, abschnitte) : abschnitte}
<div class="page-error" id="pageerr" role="alert"></div>`;
}

const APP_VERSION = '2.2.2';
const BUILD_DATE = '2026-11-18';

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
        <div class="liquid-surface-inner field-box"><input class="text-input" id="${f.id}" type="text" value="${esc(settings[f.key])}" placeholder="${esc(f.placeholder)}" autocomplete="off"></div>
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
