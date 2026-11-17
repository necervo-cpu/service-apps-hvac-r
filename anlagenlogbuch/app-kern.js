// Kern: Speicher, Helfer, Prüfung und Bewertung, Navigation, Rahmen (Meldung, Modal-Karte, Darstellung, Update).
'use strict';

LS.fullMsg += ' Übertragene Logbücher aus der App entfernen.';

/* ---------- Speicher ---------- */
let settings = Object.assign(
  { url: '', token: '', firma: '', techniker: '', zert: '' },
  LS.get('alb.settings', {}),
);
const SETTINGS_FIELDS = [
  {
    id: 's_tech',
    key: 'techniker',
    label: 'Sachkundiger (Vorbelegung)',
    placeholder: 'C.Geuther',
  },
  {
    id: 's_zert',
    key: 'zert',
    label: 'Zertifikatsnummer des Sachkundigen (Vorbelegung)',
    placeholder: 'Nummer des Sachkunde-Zertifikats',
  },
];
let books = LS.get('alb.books', []);
let dbCache = LS.get('alb.db', { at: null, list: [] });
const save = () => LS.set('alb.books', books);

/* ---------- Helfer ---------- */
const app = $('#app');
function fmtDate(s) {
  if (!s) return '';
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(s))) return String(s);
  const d = new Date(String(s).slice(0, 10) + 'T12:00:00');
  return isNaN(d)
    ? String(s)
    : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function num(v) {
  return typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.'));
}
const isVis = (f, v) => !f.show || f.show(v);
let calcSeen = {}; // zuletzt angezeigte Rechenwerte -> Aufleuchten nur bei echter Änderung
function calcTouch(id, text, el, quiet) {
  const k = view.id + ':' + (view.eid || '') + ':' + id;
  if (!quiet && k in calcSeen && calcSeen[k] !== text) flash(el);
  calcSeen[k] = text;
}
const doneEntries = (p) =>
  p.entries
    .filter((e) => e.status === 'done')
    .sort((a, b) => String(a.values.datum).localeCompare(String(b.values.datum)));

/* ---------- Bearbeitungs-Kontext: Stammdaten oder ein Eintrag eines Logbuchs ---------- */
function book(id) {
  return books.find((p) => p.id === (id || view.id));
}
function ctx() {
  const p = book();
  if (!p) return null;
  if (view.eid) {
    const e = p.entries.find((x) => x.id === view.eid);
    return e ? { p, obj: e, tpl: EINTRAG, L: p.values } : null;
  }
  return { p, obj: p, tpl: STAMM, L: p.values };
}

/* ---------- Werte, Prüfung, Bewertung ---------- */
function recompute(obj, tpl, L) {
  const v = obj.values;
  tpl.all.forEach((f) => {
    if (f.type === 'auto' && !v['_m_' + f.id]) v[f.id] = f.calc(v, L || v) || '';
  });
}
function display(f, x) {
  if (x === '' || x == null) return '';
  if (f.type === 'date' || f.input === 'date') return fmtDate(x);
  if ((f.type === 'number' || f.type === 'auto') && f.unit && isN(x))
    return fmtNum(String(x).trim()) + ' ' + f.unit;
  if (f.type === 'number' && isN(x)) return fmtNum(String(x).trim());
  return String(x);
}
function evalField(f, v) {
  const x = v[f.id];
  if (f.bad && f.bad.includes(x)) return 'bad';
  if (f.good && f.good.includes(x)) return 'ok';
  return 'none';
}
const PFLICHTFELDER = false; // true = Pflichtfelder (req) werden wieder erzwungen
function fieldError(f, obj) {
  if (!isVis(f, obj.values)) return '';
  const x = obj.values[f.id],
    empty = String(x ?? '').trim() === '';
  if (empty) return PFLICHTFELDER && f.req ? 'Pflichtfeld' : '';
  if (f.type === 'number') {
    if (!isN(x)) return 'Bitte eine gültige Zahl eingeben.';
    const n = num(x);
    if ((f.min != null && n < f.min) || (f.max != null && n > f.max))
      return `Unplausibler Wert (erlaubt ${fmtNum(f.min)} – ${fmtNum(f.max)} ${f.unit || ''})`;
  }
  if (f.type === 'date' && f.notFuture && x > today()) return 'Datum liegt in der Zukunft.';
  return '';
}
function pageErrors(c, i) {
  return c.tpl.pages[i].fields.map((f) => [f, fieldError(f, c.obj)]).filter((e) => e[1]);
}
function vorbelegtGleich(o, id) {
  return (
    !!o.vorbelegt &&
    JSON.stringify(o.values[id] ?? '') === JSON.stringify(o.vorbelegt[id] ?? '')
  );
}
function vorbelegtErfassen(o) {
  o.vorbelegt = {};
  Object.keys(o.values).forEach((id) => {
    if (JSON.stringify(o.values[id] ?? '') !== '""') {
      o.vorbelegt[id] = o.values[id];
    }
  });
}
function pageDone(c, i) {
  const fs = c.tpl.pages[i].fields.filter((f) => f.type !== 'auto' && isVis(f, c.obj.values));
  return (
    fs.every((f) => !fieldError(f, c.obj)) &&
    fs.some((f) => !vorbelegtGleich(c.obj, f.id) && String(c.obj.values[f.id] ?? '') !== '')
  );
}

/* Stand des Logbuchs: letzte Prüfung, nächste Fälligkeit */
function summary(p) {
  const es = doneEntries(p),
    d = es.filter((e) => e.values.dicht),
    ld = d[d.length - 1];
  const nopf = /keine/i.test(p.values.intv || '');
  return {
    n: es.length,
    last: es.length ? es[es.length - 1].values.datum : '',
    lastDicht: ld ? ld.values.datum : '',
    lastErg: ld ? ld.values.dicht : '',
    next: nopf ? 'keine Prüfpflicht' : ld ? ld.values.next || '' : '',
  };
}
/* Bericht-Datenstruktur – dieselbe Form liefert das Apps Script für alte Zeilen */
function entryCols(e) {
  const out = { _iso: e.values.datum || '' };
  EINTRAG.all.forEach((f) => {
    const x = e.values[f.id];
    out[f.col] =
      x === '' || x == null
        ? ''
        : f.type === 'date' || f.input === 'date'
          ? fmtDate(x)
          : f.type === 'number' && isN(x)
            ? fmtNum(String(x).trim())
            : String(x);
  });
  return out;
}
const sigsOf = (o) => ({ sk: safeImg((o.sig || {}).sk), betr: safeImg((o.sig || {}).betr) });
function buildReport(p) {
  const v = p.values,
    s = summary(p);
  // Zahlen ohne Einheit – die Einheit steht schon in der Beschriftung, z. B. „Füllgewicht (kg)“
  const row = (f) => ({
    label: f.pdf,
    value:
      ['number', 'auto'].includes(f.type) && f.input !== 'date' && isN(v[f.id])
        ? fmtNum(String(v[f.id]).trim())
        : display(f, v[f.id]),
    eval: evalField(f, v),
    wide: !!f.wide,
  });
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s.next);
  return {
    title: TITLE,
    subtitle: SUBTITLE,
    firma: settings.firma || '',
    status: {
      next: iso ? fmtDate(s.next) : s.next,
      nextIso: iso ? s.next : '',
      lastDicht: fmtDate(s.lastDicht),
      lastErg: s.lastErg,
      co2: isN(v.co2) ? fmtNum(v.co2) : '',
      intv: v.intv || '',
      km: v.km || '',
      fm: isN(v.fm) ? fmtNum(v.fm) + ' kg' : '',
    },
    short: {
      betreiber: betrText(v),
      anlage: [v.typ, v.herst, v.sn && 'S/N ' + v.sn].filter(Boolean).join(' · '),
    },
    sections: STAMM.pages
      .filter((pg) => !pg.header && !pg.final)
      .map((pg) => ({
        title: pg.pdfTitle || pg.title,
        kind: pg.kind || 'grid',
        rows: pg.fields.filter((f) => !(pg.kind === 'check' && f.type === 'yesno')).map(row),
        checks:
          pg.kind === 'check' ? pg.fields.filter((f) => f.type === 'yesno').map(row) : [],
        sign: pg.sign ? sigsOf(p) : null,
      })),
    entries: doneEntries(p).map((e) => Object.assign(entryCols(e), { _sig: sigsOf(e) })),
    fg: v.fm || '',
    remark: v.bem || '',
    hinweis: HINWEIS,
    id: v.projekt || p.id,
    stand: new Date().toISOString(),
  };
}
/* Spaltenwerte fürs Google Sheet */
function buildCols(tpl, v) {
  return tpl.all
    .filter((f) => f.col)
    .map((f) => {
      const x = isVis(f, v) ? v[f.id] : '';
      if (x === '' || x == null) return [f.col, '', ''];
      if (f.type === 'date' || (f.input === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(x)))
        return [f.col, x, 'date'];
      if ((f.type === 'number' || f.type === 'auto') && isN(x)) return [f.col, num(x), ''];
      return [f.col, String(x), ''];
    });
}
function summaryCols(p) {
  const s = summary(p),
    d = (x) => (/^\d{4}-\d{2}-\d{2}$/.test(String(x)) ? 'date' : '');
  return [
    ['Anzahl Einträge', s.n, ''],
    ['Letzter Eintrag', s.last, d(s.last)],
    ['Letzte Dichtheitsprüfung', s.lastDicht, d(s.lastDicht)],
    ['Ergebnis letzte Dichtheitsprüfung', s.lastErg, ''],
    ['Nächste Dichtheitsprüfung fällig', s.next, d(s.next)],
  ];
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
  const was = view.name;
  view = Object.assign({ name }, params || {});
  if (name === 'wizard' && was !== 'wizard') {
    calcSeen = {};
  }
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
  initSigs();
  touchAutos();
  setSteps();
  setBar();
  updateNet();
  nachRender();
}
/* Auto-Felder der aktuellen Seite: Werte merken (Aufleuchten erst bei späterer Änderung) */
function touchAutos() {
  const c = view.name === 'wizard' && ctx();
  if (!c) {
    return;
  }
  c.tpl.pages[c.obj.page].fields
    .filter((f) => f.type === 'auto')
    .forEach((f) => {
      const el = $('#in-' + f.id);
      if (el) {
        calcTouch(f.id, el.value, el);
      }
    });
}
/* Kopf: Unterzeile = Logbuch-Nr. und Betreiber (im Formular, Logbuch und Bericht), sonst Bereichsname */
function hsubText() {
  const p =
    ['wizard', 'book'].includes(view.name) || (view.name === 'report' && !view.db)
      ? book()
      : null;
  if (p) {
    const eP =
      view.name === 'wizard' && view.eid ? p.entries.find((x) => x.id === view.eid) : null;
    return (
      (p.values.projekt || 'ohne Logbuch-Nr.') +
      (betrText(p.values) ? ', ' + betrText(p.values) : '') +
      (eP ? ', Eintrag ' + (fmtDate(eP.values.datum) || 'neu') : '')
    );
  }
  if (view.name === 'report' && view.db && view.rep) {
    return view.rep.id || 'Logbuch';
  }
  return view.name === 'db' ? 'Datenbank und alle Logbücher' : 'Logbücher';
}
/* Fortschritt der Formular-Ansicht: erledigte Abschnitte und offene Eingabefehler */
function fortschritt(c) {
  const n = c.tpl.pages.length - 1;
  let done = 0;
  let fehler = 0;
  for (let k = 0; k < n; k++) {
    if (pageDone(c, k)) {
      done++;
    }
    fehler += pageErrors(c, k).length;
  }
  return { total: n, done, fehler };
}
/* Kopf der Formular-Ansicht: Zurück, Fortschritt (.hero), Abschnitte (.tab-strip) */
function setSteps() {
  const w = $('#stepwrap');
  const c = view.name === 'wizard' ? ctx() : null;
  if (!c) {
    w.hidden = true;
    w.dataset.pid = '';
    return;
  }
  const i = c.obj.page;
  const key = view.id + ':' + (view.eid || '');
  if (w.dataset.pid !== key) {
    w.dataset.pid = key;
    w.dataset.seite = '';
    const zurueck = view.eid || c.p.completedAt ? 'Logbuch' : 'Übersicht';
    w.innerHTML = `
      <button type="button" class="back-btn" data-act="pause"><span class="material-symbols-rounded" aria-hidden="true">chevron_left</span>${zurueck}</button>
      <section class="hero" aria-live="polite">
        <div class="hero-line">
          <span class="hero-value hero-value--compact numeric"><span id="progDone">0</span> <span class="metric-unit">von <span id="progTotal">0</span> Abschnitten</span></span>
          <span class="status-pill status-pill--neutral" id="heroPill"></span>
        </div>
        <div class="progress-bar" id="progBar" role="progressbar" aria-label="Fortschritt" aria-valuemin="0" aria-valuemax="100"><i id="progFill"></i></div>
      </section>
      <nav class="tab-strip" data-choice-keep role="tablist" aria-label="Abschnitte">${c.tpl.pages
        .map(
          (pg, k) =>
            `<button type="button" class="tab-pill" role="tab" data-act="step" data-i="${k}"><span class="material-symbols-rounded" aria-hidden="true">check_circle</span>${esc(pg.short)}</button>`,
        )
        .join('')}</nav>`;
  }
  w.hidden = false;
  const pt = fortschritt(c);
  const pct = pt.total ? Math.round((pt.done / pt.total) * 100) : 0;
  $('#progDone').textContent = pt.done;
  $('#progTotal').textContent = pt.total;
  $('#progFill').style.width = pct + '%';
  $('#progBar').setAttribute('aria-valuenow', String(pct));
  const pill = $('#heroPill');
  pill.className = 'status-pill status-pill--' + (pt.fehler ? 'orange' : 'neutral');
  pill.textContent = pt.fehler
    ? pt.fehler === 1
      ? '1 Eingabe prüfen'
      : pt.fehler + ' Eingaben prüfen'
    : 'Keine Hinweise';
  w.querySelectorAll('.tab-pill').forEach((b, k) => {
    b.classList.toggle('is-done', k !== i && !c.tpl.pages[k].final && pageDone(c, k));
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
    const c = ctx();
    if (!c) {
      return '';
    }
    const i = c.obj.page;
    const pg = c.tpl.pages[i];
    const weiter = pg.final
      ? `<button type="button" class="btn-primary" data-act="finish">${view.eid ? 'Eintrag speichern' : 'Logbuch speichern'}</button>`
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
    return `<div><button type="button" class="btn-secondary" data-act="${view.db ? 'db' : 'openbook'}" data-id="${view.id || ''}">Zurück</button><button type="button" class="btn-primary pdfb${run ? ' run' : ''}" data-act="makepdf"><span class="fill"${fill}></span><span class="l1">PDF erstellen</span><span class="lr">PDF wird erstellt …</span><span class="l2"><span class="material-symbols-rounded" aria-hidden="true">check</span>PDF fertig</span></button>${teilen}</div>`;
  }
  return '';
}
function setBar() {
  barRender(barHtml());
}
function wizSnapshot() {
  const vid = view.id;
  const veid = view.eid;
  return () => view.name === 'wizard' && view.id === vid && view.eid === veid;
}
function updateNet() {
  netRender(books.filter((p) => p.status === 'done' && !p.synced).length);
}
const anlageText = (v) => [v.typ, v.sn && 'S/N ' + v.sn].filter(Boolean).join(', ');
const betrText = (v) => v.bFirma || v.bName || '';
const chip = (ton, text) =>
  `<span class="status-pill status-pill--${ton}">${esc(text)}</span>`;
const TON = { ok: 'green', warn: 'orange', bad: 'red' };
/* grün = noch Zeit, orange = in höchstens 60 Tagen fällig, rot = überfällig */
function nextChips(s) {
  if (!s.next) {
    return '';
  }
  const d = dueState(s.next);
  return d ? chip(TON[d.cls], d.text) : chip('neutral', s.next);
}
/* Kurzzeile unter dem Titel: nächste Prüfung als Datum */
function nextSub(s) {
  return s.next && dueState(s.next) ? 'Nächste Prüfung ' + fmtDate(s.next) : '';
}

const APP_VERSION = '2.2.0';
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
