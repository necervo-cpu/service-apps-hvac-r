// Ansichten: Übersicht, Assistent, Bericht, Datenbank, Bausteine, Berichts-Block und Unterschriftenfelder.
'use strict';

/* ---------- Ansichten ---------- */
const Views = {
  home() {
    const drafts = protocols.filter((p) => p.status === 'draft');
    const done = protocols
      .filter((p) => p.status === 'done')
      .sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)));
    const pending = done.filter((p) => !p.synced).length;
    const chev =
      '<span class="material-symbols-rounded row-chevron" aria-hidden="true">chevron_right</span>';
    const pendHtml = pending
      ? `<span class="status-pill status-pill--orange">${pending} offen</span>`
      : '';
    return `
${
  updateHinweis && !updateSpaeter
    ? `<div class="notice notice--update"><div class="notice-text"><strong>Neue Version ${esc(updateHinweis)}</strong><span>Aktuell installiert: ${esc(APP_VERSION)}</span></div><div class="btn-row"><button type="button" class="btn-primary" data-act="doupdate">Aktualisieren</button><button type="button" class="btn-secondary" data-act="updatespaeter">Später</button></div></div>`
    : ''
}
${
  !settings.url
    ? '<div class="notice"><span>Noch keine Verbindung zur Datenbank eingerichtet. Protokolle bleiben lokal gespeichert, bis die Web-App-URL in den Einstellungen steht.</span><button type="button" class="btn-secondary" data-act="settings">Einstellungen öffnen</button></div>'
    : ''
}
<h2 class="section-title">Neue Wartung</h2>
<div class="group">
  <button type="button" class="row" data-act="new">
    <span class="row-icon row-icon--orange"><span class="material-symbols-rounded" aria-hidden="true">ac_unit</span></span>
    <span class="row-text"><span class="row-title">Klimaanlage</span><span class="row-sub">Protokoll angelehnt an die VDMA 24186-3 starten</span></span>
    ${chev}
  </button>
</div>
<h2 class="section-title">Datenbank</h2>
<div class="group">
  <button type="button" class="row" data-act="db">
    <span class="row-icon row-icon--blue"><span class="material-symbols-rounded" aria-hidden="true">description</span></span>
    <span class="row-text"><span class="row-title">Datenbank und PDF</span><span class="row-sub">Protokolle suchen und öffnen</span></span>
    ${chev}
  </button>
  <button type="button" class="row" data-act="sync">
    <span class="row-icon row-icon--green"><span class="material-symbols-rounded" aria-hidden="true">sync</span></span>
    <span class="row-text"><span class="row-title">Synchronisieren</span><span class="row-sub">${pending ? 'Protokolle warten auf die Übertragung' : 'Alles ist übertragen'}</span></span>
    ${pendHtml}
    ${chev}
  </button>
</div>
<h2 class="section-title">Offene Wartungen <span class="section-count">${drafts.length}</span></h2>
${drafts.length ? `<div class="group">${drafts.map(protoCard).join('')}</div>` : '<p class="empty-note">Noch keine offene Wartung. Oben „Klimaanlage“ wählen.</p>'}
<h2 class="section-title">Abgeschlossen <span class="section-count">${done.length}</span></h2>
${done.length ? `<div class="group">${done.map(protoCard).join('')}</div>` : '<p class="empty-note">Noch keine abgeschlossene Wartung. Sie erscheint hier nach dem Abschließen.</p>'}`;
  },

  wizard() {
    const p = cur();
    if (!p) {
      return '<p class="empty-note">Protokoll nicht gefunden. Zurück zur Übersicht wechseln.</p>';
    }
    return wizardHtml(p, p.page);
  },

  report() {
    const r = reportForView();
    if (!r) {
      return '<p class="empty-note">Protokoll nicht gefunden. Zurück zur Übersicht wechseln.</p>';
    }
    const p = !view.db && protocols.find((x) => x.id === view.id);
    return `
<div class="btn-row">
  <span id="pdfbar" class="btn-row">${pdfBarHtml()}</span>
  ${view.db && settings.url ? `<button type="button" class="btn-secondary" data-act="drivepdf">PDF in Google Drive ablegen</button>` : ''}
</div>
${p && !p.synced ? '<p class="lead-note"><span class="status-pill status-pill--orange">nicht in der Datenbank</span></p>' : ''}
<p class="lead-note">„PDF erstellen“ und „Teilen“ speichern den Bericht in Dateien oder senden ihn per Mail oder AirDrop. Das geht auch offline.</p>
<div class="sheetwrap"><div id="sheet" class="report"></div></div>`;
  },

  db() {
    return `
<button type="button" class="back-btn" data-act="home"><span class="material-symbols-rounded" aria-hidden="true">chevron_left</span>Übersicht</button>
<button type="button" class="btn-primary btn-wide" data-act="dbload"><span class="material-symbols-rounded" aria-hidden="true">cloud_download</span><span>Aus Datenbank laden</span></button>
<p class="lead-note">${dbCache.at ? `Stand ${fmtDateTime(dbCache.at)}, ${dbCache.list.length} Einträge. Zum Öffnen eines Protokolls wird Internet benötigt.` : 'Noch nicht geladen. „Aus Datenbank laden“ ruft die Protokollliste ab.'}</p>
<label class="search">
  <span class="material-symbols-rounded" aria-hidden="true">search</span>
  <input id="dbsearch" type="search" aria-label="Datenbank durchsuchen" autocomplete="off" value="${esc(view.q || '')}">
</label>
<div id="dblist">${dbList()}</div>`;
  },
};

function bewertungPill(text) {
  const art = bewertungArt(text);
  if (art === 'none') {
    return '';
  }
  return `<span class="status-pill status-pill--${art === 'ok' ? 'green' : 'red'}">${esc(nio(text))}</span>`;
}
function protoCard(p) {
  const v = p.values;
  const pill = (ton, text) =>
    `<span class="status-pill status-pill--${ton}">${esc(text)}</span>`;
  let badges;
  if (p.status === 'draft') {
    badges = pill('orange', `Schritt ${p.page + 1} von ${TEMPLATE.pages.length}`);
  } else {
    badges =
      bewertungPill(v.erg) +
      pill(p.synced ? 'green' : 'orange', p.synced ? 'in der Datenbank' : 'nicht übertragen');
  }
  const meta = [fmtDate(v.datum), v.anlage, v.monteur].filter(Boolean).map(esc).join(', ');
  const open =
    p.status === 'draft'
      ? `data-act="resume" data-id="${p.id}"`
      : `data-act="report" data-id="${p.id}"`;
  const icon = p.status === 'draft' ? 'edit_note' : 'task_alt';
  const farbe = p.status === 'draft' ? 'orange' : 'green';
  const edit =
    p.status === 'draft'
      ? ''
      : `<button type="button" class="icon-btn proto-act" data-act="reopen" data-id="${p.id}" aria-label="Protokoll bearbeiten"><span class="material-symbols-rounded" aria-hidden="true">edit</span></button>`;
  return `
  <div class="row proto-row">
    <button type="button" class="proto-open" ${open}>
      <span class="row-icon row-icon--${farbe}"><span class="material-symbols-rounded" aria-hidden="true">${icon}</span></span>
      <span class="row-text">
        <span class="row-title">${esc(v.projekt || 'Ohne Projektnummer')}</span>
        ${v.kunde ? `<span class="row-sub">${esc(v.kunde)}</span>` : ''}
        ${meta ? `<span class="row-sub">${meta}</span>` : ''}
        <span class="proto-pills">${badges}</span>
      </span>
      <span class="material-symbols-rounded row-chevron" aria-hidden="true">chevron_right</span>
    </button>
    ${edit}
    <button type="button" class="icon-btn proto-act is-danger" data-act="del" data-id="${p.id}" aria-label="Protokoll löschen"><span class="material-symbols-rounded" aria-hidden="true">delete</span></button>
  </div>`;
}

/* ----- Innengeräte (Verdampfer): Akkordeon-Zeilen ----- */
const openSet = () => view.open || (view.open = new Set([1])); // erste Zeile offen, weitere zu (nur Ansicht, nicht gespeichert)
function vStat(p, n) {
  const fs = DEV_FIELDS[n].filter((f) => f.type === 'okfail');
  if (fs.some((f) => evalField(f, p.values) === 'bad')) return ['bad', 'n.i.O. vorhanden'];
  if (fs.every((f) => p.values[f.id])) return ['ok', 'alles i.O.'];
  return ['warn', 'offen'];
}
const vTitle = (v, n) =>
  ['Verdampfer ' + n, devRoom(v, n), devModel(v, n)].filter(Boolean).join(', ');
const vStatHtml = (p, n) => {
  const s = vStat(p, n);
  const ton = { ok: 'green', warn: 'orange', bad: 'red' }[s[0]];
  return `<span class="status-pill status-pill--${ton}">${s[1]}</span>`;
};
const vFelder = (p, n) => sichtbareFelder(DEV_FIELDS[n], p.values);
function vFieldsHtml(p, n) {
  return gruppenHtml(vFelder(p, n), p, 'h3');
}
function vcardHtml(p, n, open) {
  const v = p.values;
  const alleOk = alleOkHtml(vFelder(p, n), v, 'vk-' + n, `data-act="allokv" data-n="${n}"`);
  return `<div class="acc${open ? ' is-open' : ''}" id="vc-${n}" data-n="${n}">
    <button type="button" class="acc-head" data-act="togglev" data-n="${n}" aria-expanded="${open}" aria-controls="vb-${n}">
<span class="acc-badge">${n}</span>
<span class="acc-name"><span class="row-title" id="vt-${n}">${esc(vTitle(v, n))}</span><span id="vs-${n}">${vStatHtml(p, n)}</span></span>
<span class="material-symbols-rounded acc-chevron" aria-hidden="true">expand_more</span>
    </button>
    <div class="acc-body" id="vb-${n}"><div><div class="acc-inner">
${alleOk}
<div id="vf-${n}">${vFieldsHtml(p, n)}</div>
    </div></div></div>
  </div>`;
}
function evapHtml(pg, p) {
  const cnt = vaCount(p.values);
  const s = openSet();
  if (view.tried) {
    for (let n = 1; n <= cnt; n++) {
      if (DEV_FIELDS[n].some((f) => fieldError(f, p))) {
        s.add(n); // Zeilen mit Fehlern aufklappen
      }
    }
  }
  const f = FIELD.vaAnz;
  const zahlen = Array.from(
    { length: VA_MAX },
    (_, k) =>
      `<button type="button" class="tab-pill" data-act="vacount" data-v="${k + 1}" aria-selected="${k + 1 === cnt}">${k + 1}</button>`,
  ).join('');
  const karten = Array.from({ length: cnt }, (_, k) =>
    vcardHtml(p, k + 1, s.has(k + 1)),
  ).join('');
  return `<div class="group group--form count-field">
  <div class="field"><span class="field-label">${esc(f.label)}<small class="field-hint">${esc(f.hint)}</small></span><div class="tab-strip" role="group" aria-label="${esc(f.label)}">${zahlen}</div></div>
</div>
<h2 class="section-title">Innengeräte <span class="section-count">${cnt}</span></h2>
<div class="group">${karten}</div>`;
}
/* Nur die geänderten Teile einer Zeile aktualisieren (kein Neuzeichnen: Scrollposition und Fokus bleiben) */
function vSync(p, n) {
  const card = document.getElementById('vc-' + n);
  if (!card) {
    return;
  }
  document.getElementById('vf-' + n).innerHTML = vFieldsHtml(p, n);
  vStatusAktualisieren(p, n);
}
function vStatusAktualisieren(p, n) {
  document.getElementById('vs-' + n).innerHTML = vStatHtml(p, n);
  const alleOk = document.getElementById('vk-' + n);
  if (alleOk) {
    alleOk.hidden = !vFelder(p, n).some((f) => f.type === 'okfail' && !p.values[f.id]);
  }
  setSteps();
}

function altwertHint(x) {
  if (!x || BEWERTUNG.includes(x) || bewertungArt(x) === 'none') {
    return '';
  }
  return `<div class="field-hint altwert">Altwert: ${esc(x)}</div>`;
}
const hatSoll = (f) => f.sRanges || f.sMin != null || f.sMax != null;
/* Status zum Messwert: Passt, Prüfen oder nichts, solange kein Wert steht oder kein Sollbereich gilt */
function messPillArt(f, v) {
  const ev = hatSoll(f) ? evalField(f, v) : 'none';
  return { ok: ['green', 'Passt'], warn: ['orange', 'Prüfen'] }[ev];
}
function messPill(f, v) {
  const art = messPillArt(f, v);
  return art
    ? `<span class="status-pill status-pill--${art[0]}" id="pill-${f.id}">${art[1]}</span>`
    : `<span class="status-pill status-pill--neutral" id="pill-${f.id}" hidden></span>`;
}
function messPillAktualisieren(f, v) {
  const el = $('#pill-' + f.id);
  if (!el) {
    return;
  }
  const art = messPillArt(f, v);
  el.hidden = !art;
  el.className = 'status-pill status-pill--' + (art ? art[0] : 'neutral');
  el.textContent = art ? art[1] : '';
}
function mangelNote(f, v, offen) {
  const kind = FIELD[f.id + 'M'];
  if (!kind) {
    return '';
  }
  return `<div class="check-note"><div><span class="field-box field-box--note"><input class="note-input" type="text" data-f="${kind.id}" value="${esc(v[kind.id] ?? '')}" aria-label="Mangel beschreiben: ${esc(f.label)}" autocomplete="off"${offen ? '' : ' tabindex="-1"'}></span></div></div>`;
}

const OK3_WERT = ['ok', 'mangel', 'na'];
const OK3_ICON = ['check', 'priority_high', 'remove'];
const OK3_TITEL = ['In Ordnung', 'Mangel', 'Entfällt'];
function fieldHtml(f, p) {
  const v = p.values;
  const x = v[f.id] ?? '';
  const err = view.tried ? fieldError(f, p) : '';
  const req = isRequired(f, p) ? ' *' : '';
  const hint = f.hint ? `<small class="field-hint">${esc(f.hint)}</small>` : '';
  const errHtml = err ? `<div class="ferr" role="alert">${esc(err)}</div>` : '';
  const fehler = err ? ' has-error' : '';
  switch (f.type) {
    case 'okfail': {
      const offen = x === 'n.i.O.';
      const tri = OK3.map(
        (o, k) =>
          `<button type="button" data-act="set" data-f="${f.id}" data-v="${esc(o)}" data-value="${OK3_WERT[k]}" aria-pressed="${x === o}" aria-label="${OK3_TITEL[k]}"><span class="material-symbols-rounded" aria-hidden="true">${OK3_ICON[k]}</span></button>`,
      ).join('');
      return `<div class="check${offen ? ' has-defect' : ''}" data-item="${f.id}">
    <div class="check-main"><span class="check-label">${esc(f.label)}${f.hint ? `<small>${esc(f.hint)}</small>` : ''}</span><div class="tri" role="group" aria-label="Bewertung: ${esc(f.label)}">${tri}</div></div>
    ${mangelNote(f, v, offen)}
  </div>`;
    }
    case 'bewertung': {
      const offen = x === 'n.i.O.';
      const optionen = BEWERTUNG.map(
        (o) =>
          `<button type="button" class="segmented-option" data-act="set" data-f="${f.id}" data-v="${esc(o)}" aria-pressed="${x === o}">${esc(o)}</button>`,
      ).join('');
      return `<div class="field check${offen ? ' has-defect' : ''}" data-item="${f.id}">
    <span class="field-label" id="lab-${f.id}">${esc(f.label)}${req}</span>
    <div class="segmented-control" role="group" aria-labelledby="lab-${f.id}">${optionen}</div>
    ${altwertHint(x)}
    ${mangelNote(f, v, offen)}
  </div>`;
    }
    case 'number': {
      const modus = f.min != null && f.min < 0 ? 'text' : 'decimal';
      const soll = sollText(f);
      const notizen = [f.hint, soll]
        .filter(Boolean)
        .map((t) => `<div>${esc(t)}</div>`)
        .join('');
      return `<div class="meas-wrap${fehler}">
    <label class="meas-row" for="in-${f.id}"><span class="meas-label">${esc(f.label)}</span>${messPill(f, v)}<span class="vwrap"><input class="value-input numeric" id="in-${f.id}" data-f="${f.id}" inputmode="${modus}" autocomplete="off" value="${esc(x)}"><span class="input-unit-addon">${esc(f.unit || '')}</span></span></label>
    ${notizen ? `<div class="meas-notes">${notizen}</div>` : ''}${errHtml}
  </div>`;
    }
    case 'calc':
      return `<div class="calc-row"><span class="calc-label">${esc(f.label)}<small class="field-hint" id="note-${f.id}">${f.note ? esc(f.note(v)) : 'wird berechnet'}</small></span><span class="calc-value numeric" id="calc-${f.id}">${esc(display(f, x) || '–')}</span></div>`;
    case 'date':
      return `<label class="field${fehler}"><span class="field-label">${esc(f.label)}${req}${hint}</span><span class="field-box"><input class="text-input" id="in-${f.id}" type="date" data-f="${f.id}" value="${esc(x)}"></span>${errHtml}</label>`;
    case 'longtext':
      return `<label class="field"><span class="field-label">${esc(f.label)}${req}${hint}</span><span class="field-box"><textarea class="text-input" id="in-${f.id}" data-f="${f.id}">${esc(x)}</textarea></span></label>`;
    default:
      return `<label class="field${fehler}"><span class="field-label">${esc(f.label)}${req}${hint}</span><span class="field-box"><input class="text-input" id="in-${f.id}" data-f="${f.id}" value="${esc(x)}" autocomplete="off"></span>${errHtml}</label>`;
  }
}
function finalHtml(p, felder) {
  const d = defects(p);
  const fehlend = TEMPLATE.pages
    .slice(0, -1)
    .map((pg, k) => [k, pageErrors(p, k)])
    .filter((x) => x[1].length);
  const unvollstaendig = fehlend.length
    ? `<div class="notice" role="status"><b>Noch unvollständig</b><ul class="notice-list">${fehlend
        .map(
          ([k, errs]) =>
            `<li><button type="button" class="jump-link" data-act="jump" data-i="${k}">${esc(TEMPLATE.pages[k].title)}</button>: ${errs.map((e) => esc((e[0].dev ? 'Verdampfer ' + e[0].dev + ' ' : '') + (e[0].pdf || e[0].label))).join(', ')}</li>`,
        )
        .join('')}</ul></div>`
    : '';
  const maengel = `<h2 class="section-title">Mängel und auffällige Messwerte <span class="section-count">${d.length}</span></h2>${
    d.length
      ? `<div class="group group--form">${d.map((x) => `<div class="defect">${esc(x)}</div>`).join('')}</div>`
      : '<p class="empty-note">Keine Mängel erfasst.</p>'
  }`;
  const name = p.values.monteur ? esc(p.values.monteur) : '';
  const unterschrift = `<h2 class="section-title">Unterschrift Monteur${PFLICHTFELDER ? ' *' : ''}${name ? ` <span class="section-count">${name}</span>` : ''}</h2>
<div class="sigwrap"><canvas class="sig" data-sig="tech" aria-label="Unterschrift Monteur"></canvas></div>
<button type="button" class="btn-secondary" data-act="sigclear" data-sig="tech"><span class="material-symbols-rounded" aria-hidden="true">ink_eraser</span><span>Unterschrift löschen</span></button>`;
  return `${unvollstaendig}${maengel}${felder}${unterschrift}`;
}

/* @@quelle:reportParts */
      /* Ausdruck im Muther-Design: A4-Seiten mit Kacheln, Checklisten, Seitenumbruch („Fortsetzung“) und Fußzeile „Seite x von y“.
   Nimmt die Bericht-Datenstruktur von buildReport() (App) bzw. rowToReport_() (Apps Script) unverändert entgegen.
   Die HTML-Bausteine kommen aus shared/pdf-bausteine.js (pdfBausteine()), das CSS aus shared/pdf.css. */
      function reportParts(r) {
        const B = pdfBausteine(),
          { esc, nl, up, pill } = B;
        const CHECKV = ['i.O.', 'Mangel', 'n.i.O.', 'entfällt'];
        // Alte gespeicherte Berichte enthalten noch „Mangel“ → bleibt „nicht in Ordnung“, wird aber als „n.i.O.“ angezeigt
        const shown = (x) => (x === 'Mangel' ? 'n.i.O.' : x),
          dshown = (d) => String(d).replace(/: Mangel$/, ': n.i.O.');
        const isCheck = (x) => ['ok', 'bad', 'na'].includes(x.eval) || CHECKV.includes(x.value);
        const evalOf = (x) =>
          x.eval && x.eval !== 'none'
            ? x.eval
            : x.value === 'i.O.'
              ? 'ok'
              : x.value === 'Mangel' || x.value === 'n.i.O.'
                ? 'bad'
                : x.value === 'entfällt'
                  ? 'na'
                  : '';
        const firma = r.firma || (typeof settings !== 'undefined' ? settings.firma : '') || '';
        // „WARTUNGSPROTOKOLL • KÄLTETECHNISCHE ANLAGEN“ → Kopfzeile „WARTUNGSPROTOKOLL“, Titel „Kältetechnische Anlagen“
        const tp = String(r.title || '').split(' • ');
        const nice = (s) =>
          s
            .split(' ')
            .map((w) =>
              w
                .split('-')
                .map((x) =>
                  x.length >= 5 && x === x.toUpperCase() ? x[0] + x.slice(1).toLowerCase() : x,
                )
                .join('-'),
            )
            .join(' ');
        const kicker = tp.length > 1 ? tp[0] : '',
          h1 = nice(tp.length > 1 ? tp.slice(1).join(' • ') : tp[0]);
        // Sheet-Spalte heißt weiter „Kunde / Betreiber“ (Code.gs) – im PDF „Kunden Nr.“; in der App wirkungslos
        const header = (r.header || []).map((x) =>
          x.label === 'Kunde / Betreiber' ? Object.assign({}, x, { label: 'Kunden Nr.' }) : x,
        );
        // erstes Kopffeld, dessen Beschriftung passt (Nummern-Felder wie „Kundennummer“ ausgenommen)
        const hv = (re) =>
          (header.find((x) => re.test(x.label) && !/nummer|nr\.?$/i.test(x.label) && x.value) || {})
            .value || '';
        const datum = hv(/^datum/i);
        const stand =
          datum ||
          (r.completedAt
            ? new Date(r.completedAt).toLocaleDateString('de-DE', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })
            : '');
        const blocks = [];

        // Kacheln: Ergebnis · Datum · Monteur
        const res = String(r.success || ''),
          good = res === 'Ja' || res === 'i.O.',
          bad = !!res && !good;
        const subs = String(r.subline || (r.betrieb ? 'Betriebszustand: ' + r.betrieb : ''))
          .split(' · ')
          .filter(Boolean);
        const next = subs.find((s) => /^Nächste Wartung:/.test(s)),
          other = subs.filter((s) => s !== next);
        const defects = r.defects || [];
        // Kachel-Datum einheitlich TT.MM.JJJJ (Eingaben wie 31.8.2026 oder ISO); Fußzeile/Unterschrift nutzen weiter `stand`
        const p2 = (x) => String(x).padStart(2, '0');
        const dateOf = (x) => {
          const q = String(x || '').trim(),
            m = q.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/) || q.match(/^(\d{4})-(\d{2})-(\d{2})/);
          return m
            ? m[1].length === 4
              ? `${p2(m[3])}.${p2(m[2])}.${m[1]}`
              : `${p2(m[1])}.${p2(m[2])}.${m[3]}`
            : q;
        };
        const tileDate = dateOf(stand);
        // Nächste Wartung: ausgefülltes Feld „Nächste Wartung fällig“, sonst berechnet. Dichtheitsprüfung ab 5 t CO₂-Äquivalent → Intervall 12 Monate (ab 50 t 6, ab 500 t 3), sonst Wartungsdatum + 12 Monate
        const nextDue = (() => {
          const set = next ? next.replace(/^Nächste Wartung:\s*/, '').trim() : '';
          const co2 = parseFloat(String(r.co2 ?? '').replace(',', '.')),
            dp = co2 >= 5;
          if (set)
            return {
              date: dateOf(set),
              sub: dp ? 'Dichtheitsprüfung vorgeschrieben (ab 5 t)' : '',
            };
          if (!(co2 >= 0) && /^(n\.i\.O\.|i\.O\.)$/.test(String(r.fgas || '').trim()))
            return { date: '', sub: 'CO₂-Äquivalent fehlt' }; // Dichtheitsprüfung durchgeführt (= vorgeschrieben), Intervall aber nicht bestimmbar
          const m =
            String(stand || '').match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/) ||
            String(stand || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (!m) return { date: '', sub: '' };
          const iso = m[1].length === 4,
            y0 = +(iso ? m[1] : m[3]),
            mo0 = +m[2] - 1,
            d0 = +(iso ? m[3] : m[1]);
          const months = dp ? (co2 >= 500 ? 3 : co2 >= 50 ? 6 : 12) : 12;
          const t = mo0 + months,
            y = y0 + Math.floor(t / 12),
            mo = t % 12;
          const d = Math.min(d0, new Date(y, mo + 1, 0).getDate());
          return {
            date: `${p2(d)}.${p2(mo + 1)}.${y}`,
            sub: dp ? `Dichtheitsprüfung alle ${months} Monate` : 'jährliche Wartung',
          };
        })();
        blocks.push({
          html: B.kacheln(
            [
              {
                art: good ? 'ok' : bad ? 'bad' : '',
                lab: r.resultLabel || 'Wartung erfolgreich',
                val: shown(res),
                subHtml: `${good ? pill('ok', 'in Ordnung') : bad ? pill('bad', 'nicht in Ordnung') : ''}${r.successMangel ? `<div>${esc(r.successMangel)}</div>` : ''}${other.length ? `<div>${esc(other.join(' · '))}</div>` : ''}`,
              },
              { lab: 'Datum', val: tileDate },
              { lab: 'Monteur / Prüfer', val: r.techniker },
            ],
            { links: true },
          ),
        });

        // Auftrags- und Anlagendaten (Kunden Nr. steht schon im Kopf)
        const kundenNr = (
          header.find((x) => /^kunden[ -]?(nr|nummer)/i.test(x.label) && x.value) || {}
        ).value;
        const doppelt = (x) =>
          (kundenNr && /^kunden[ -]?(nr|nummer)/i.test(x.label)) ||
          (r.id && /^projekt(-?nr|nummer)/i.test(x.label) && x.value === r.id) ||
          (r.techniker && /^monteur/i.test(x.label) && x.value === r.techniker) ||
          (datum && /^datum/i.test(x.label) && x.value === datum);
        const headerRows = header.filter((x) => !doppelt(x));
        if (headerRows.length)
          blocks.push({ html: B.abschnitt('Auftrags- & Anlagendaten', B.kv(headerRows)) });

        // Abschnitte: Prüfpunkte als Checkliste, Messwerte als Feldliste, Tabellen umbrechbar
        const lastCheck = (r.sections || []).reduce(
          (m, s, i) => ((s.checks || []).concat(s.rows || []).some(isCheck) ? i : m),
          -1,
        );
        (r.sections || []).forEach((s, si) => {
          const all = (s.checks || []).concat(s.rows || []);
          // Messwerte-Block komplett leer → ganz weglassen (Prüfpunkte bleiben wie bisher)
          const meas = new Set((s.rows || []).filter((x) => !isCheck(x))),
            measEmpty = [...meas].every((x) => !String(x.value ?? '').trim());
          const ck = all.filter(isCheck),
            fl = all.filter((x) => !isCheck(x) && !(measEmpty && meas.has(x)));
          const ckHtml = B.checkliste(
            ck.map((x) => ({
              label: x.label,
              mangel: x.mangel,
              value: shown(x.value),
              eval: evalOf(x),
            })),
            { nrPrefix: true, legende: si === lastCheck },
          );
          const flHtml = fl.length ? '' + B.kv(fl) : '';
          const body = ckHtml + flHtml;
          if (s.table && s.table.body && s.table.body.length) {
            const t = s.table;
            blocks.push(
              B.tabelle({
                titel: s.title,
                head: t.head.map((h, i) => (i ? h : { t: h, w: '26%' })),
                rows: t.body.map((b) =>
                  [{ t: b.label, cls: 'lbl' }].concat(
                    b.cells.map((c) => ({
                      t: c.value || '—',
                      cls: 'ev ' + (c.eval && c.eval !== 'none' ? c.eval : ''),
                    })),
                  ),
                ),
              }),
            );
            if (body) blocks.push({ html: `<div class="sec-more">${body}</div>` });
          } else if (ckHtml) {
            blocks.push({ split: true, html: B.abschnitt(s.title, ckHtml) });
            if (flHtml) blocks.push({ html: `<div class="sec-more">${flHtml}</div>` });
          } else {
            blocks.push({
              html: B.abschnitt(s.title, body || '<div class="none">Keine Angaben</div>'),
            });
          }
        });

        if (defects.length)
          blocks.push({
            html: B.notiz({
              titel: 'Auffälligkeiten',
              text: defects.map(dshown).join(' · '),
              art: 'def',
            }),
          });
        const abschluss = [
          {
            label: 'Nächste Wartung',
            value: [nextDue.date, nextDue.sub].filter(Boolean).join(' · '),
          },
          { label: r.remarkLabel || 'Bemerkungen / Mängel', value: r.remark, wide: true },
        ];
        blocks.push({ html: B.abschnitt('Wartungsabschluss', B.kv(abschluss)) });
        if (r.hinweis)
          blocks.push({ html: B.rechtstext([{ titel: 'Betreiberhinweis.', text: r.hinweis }]) });
        const sig = r.sig || {};
        blocks.push({
          html: B.unterschrift({
            tech: { bild: sig.tech, name: [r.techniker, stand].filter(Boolean).join(' · ') },
            kunde: { bild: sig.kunde, name: r.kundeName },
            labels: { tech: 'Monteur / Prüfer', kunde: 'Kunde / Betreiber' },
            kompakt: true,
          }),
        });

        const kunde =
            (header.find((x) => /^kunden nr/i.test(x.label) && x.value) || {}).value ||
            hv(/kunde|betreiber/i),
          anlage = hv(/anlage|modell/i);
        return {
          blocks,
          head: B.kopf({
            firma,
            kicker,
            titel: h1,
            nummern: [
              { label: 'Projekt-Nr.', wert: r.id },
              { label: 'Kunden-Nr.', wert: kundenNr },
            ],
          }),
          smallHead: B.kopfKlein({
            firma,
            zeile: [kunde, anlage].filter(Boolean).join(' · '),
            titel: kicker ? nice(kicker) : h1,
            nrLabel: 'Projekt-Nr.',
            id: r.id,
          }),
          foot: B.fuss({ text: (kicker ? nice(kicker) + ' ' : '') + h1, stand }),
          id: esc(r.id),
        };
      }
/* @@ende */

/* Bericht samt Unterschrift; PDF_OPTS: vor dem Rendern auf die Unterschrift (Bild) warten. layoutReport, reportPdfBlob, pdfName, isStandalone, pdfBase64 stehen in shared/pdf.js */
const PDF_OPTS = { waitImages: true };
function reportOf(p) {
  const r = buildReport(p);
  r.sig = p.sig;
  return r;
}
function reportForView() {
  if (view.db) return view.rep;
  const p = protocols.find((x) => x.id === view.id);
  if (!p) return null;
  return reportOf(p);
}

/* ---------- PDF-Erzeugung (offline, ohne Druckdialog – iOS druckt in Home-Bildschirm-Apps nicht) ---------- */
let lastPdf = null; // {key, file, url}
const viewKey = () => (view.db ? 'db:' + view.key : 'loc:' + view.id);
function pdfBarHtml() {
  if (!lastPdf || lastPdf.key !== viewKey()) {
    return '';
  }
  // „PDF öffnen“ nur im normalen Browser – in der Home-Bildschirm-App gäbe es keinen Weg zurück
  if (isStandalone()) {
    return '';
  }
  return `<a class="btn-secondary" href="${lastPdf.url}" download="${esc(lastPdf.file.name)}" target="_blank" rel="noopener">PDF öffnen</a>`;
}
function dbList() {
  const q = (view.q || '').toLowerCase().trim();
  const list = dbCache.list
    .filter(
      (e) =>
        !q ||
        [e.projekt, e.kunde, e.monteur, e.modell, e.datum, fmtDate(e.datum)]
          .join(' ')
          .toLowerCase()
          .includes(q),
    )
    .sort((a, b) => String(b.datum).localeCompare(String(a.datum)));
  if (!list.length) {
    return `<p class="empty-note">${dbCache.list.length ? 'Keine Treffer. Suchbegriff ändern oder leeren.' : 'Keine Daten. „Aus Datenbank laden“ ruft die Protokollliste ab.'}</p>`;
  }
  const zeilen = list
    .map((e) => {
      const unter = [e.modell, e.monteur].filter(Boolean).map(esc).join(', ');
      const pdf = e.pdfUrl
        ? `<a class="proto-open" href="${esc(e.pdfUrl)}" target="_blank" rel="noopener">`
        : `<button type="button" class="proto-open" data-act="dbreport" data-key="${esc(e.key)}">`;
      const pdfEnde = e.pdfUrl ? '</a>' : '</button>';
      return `
  <div class="row proto-row">
    ${pdf}
      <span class="row-icon row-icon--blue"><span class="material-symbols-rounded" aria-hidden="true">description</span></span>
      <span class="row-text">
        <span class="row-title">${esc(e.projekt)}${e.kunde ? ', ' + esc(e.kunde) : ''}</span>
        <span class="row-sub numeric">${esc(fmtDate(e.datum))}</span>
        ${unter ? `<span class="row-sub">${unter}</span>` : ''}
        ${e.erfolg ? `<span class="proto-pills">${bewertungPill(e.erfolg)}</span>` : ''}
      </span>
      <span class="material-symbols-rounded row-chevron" aria-hidden="true">chevron_right</span>
    ${pdfEnde}
    <button type="button" class="icon-btn proto-act" data-act="dbedit" data-key="${esc(e.key)}" aria-label="Protokoll bearbeiten"><span class="material-symbols-rounded" aria-hidden="true">edit</span></button>
  </div>`;
    })
    .join('');
  return `<div class="group">${zeilen}</div>`;
}

/* ---------- Unterschrift ---------- */
function initSig(canvas, p) {
  const key = canvas.dataset.sig;
  const r = canvas.getBoundingClientRect(),
    dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = ctx.fillStyle = '#0b1f3a';
  const src = safeImg(p.sig[key]);
  if (src) {
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, r.width, r.height);
    img.src = src;
  }
  let drawing = false,
    last = null;
  const pt = (e) => {
    const b = canvas.getBoundingClientRect();
    return [e.clientX - b.left, e.clientY - b.top];
  };
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    drawing = true;
    last = pt(e);
    canvas.setPointerCapture(e.pointerId);
    ctx.beginPath();
    ctx.arc(last[0], last[1], 1.1, 0, Math.PI * 2);
    ctx.fill();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    const q = pt(e);
    ctx.beginPath();
    ctx.moveTo(last[0], last[1]);
    ctx.lineTo(q[0], q[1]);
    ctx.stroke();
    last = q;
  });
  const end = () => {
    if (!drawing) return;
    drawing = false;
    const out = document.createElement('canvas');
    out.width = Math.round(r.width);
    out.height = Math.round(r.height);
    out.getContext('2d').drawImage(canvas, 0, 0, out.width, out.height);
    p.sig[key] = out.toDataURL('image/png');
    save();
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
}
