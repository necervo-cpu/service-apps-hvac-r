// Ansichten: Übersicht, Assistent, Bericht, Datenbank sowie die zugehörigen Bausteine.
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
    <span class="row-icon row-icon--orange"><span class="material-symbols-rounded" aria-hidden="true">thermostat</span></span>
    <span class="row-text"><span class="row-title">Wärmepumpe</span><span class="row-sub">Protokoll angelehnt an die VDMA starten</span></span>
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
${drafts.length ? `<div class="group">${drafts.map(protoCard).join('')}</div>` : '<p class="empty-note">Noch keine offene Wartung. Oben „Wärmepumpe“ wählen.</p>'}
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

function bewertungBadge(text) {
  if (!text) {
    return '';
  }
  const ton = bewertungArt(text) === 'ok' ? 'green' : 'red';
  return `<span class="status-pill status-pill--${ton}">${esc(text)}</span>`;
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
      bewertungBadge(v.erfolg) +
      pill(p.synced ? 'green' : 'orange', p.synced ? 'in der Datenbank' : 'nicht übertragen');
  }
  const meta = [fmtDate(v.datum), v.agModell, v.monteur].filter(Boolean).map(esc).join(', ');
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

const OK3_WERT = ['ok', 'mangel', 'na'];
const OK3_ICON = ['check', 'priority_high', 'remove'];
const OK3_TITEL = ['In Ordnung', 'Mangel', 'Entfällt'];

function wizardHtml(p, i) {
  const pg = TEMPLATE.pages[i];
  const v = p.values;
  const felder = pg.fields.filter((f) => !f.parent && sichtbar(f, v));
  const hatPruefpunkte = felder.some((f) => f.type === 'okfail');
  const offen = felder.some((f) => f.type === 'okfail' && !v[f.id]);
  const gruppen = [];
  felder.forEach((f) => {
    const name = f.group || '';
    const letzte = gruppen[gruppen.length - 1];
    if (letzte && letzte.name === name) {
      letzte.liste.push(f);
    } else {
      gruppen.push({ name, liste: [f] });
    }
  });
  const abschnitte = gruppen
    .map(
      (g) =>
        `${g.name ? `<h2 class="section-title">${esc(g.name)}</h2>` : ''}
        <div class="group group--form">${g.liste.map((f) => fieldHtml(f, p)).join('')}</div>`,
    )
    .join('');
  const alleOk = hatPruefpunkte
    ? `<button type="button" class="btn-secondary allok-btn" id="allokBtn" data-act="allok"${offen ? '' : ' hidden'}><span class="material-symbols-rounded" aria-hidden="true">done_all</span><span>Offene Prüfpunkte auf i.O. setzen</span></button>`
    : '';
  return `${alleOk}${pg.final ? finalHtml(p, abschnitte) : abschnitte}
<div class="page-error" id="pageerr" role="alert"></div>`;
}

function playFx(el, cls) {
  if (!el) {
    return;
  }
  el.classList.add(cls);
  el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
}
function materialFeedback(teil, fx) {
  const input = app.querySelector(`.matrow input[data-i="${fx.i}"]`);
  const zeile = input ? input.closest('.matrow') : null;
  if (!RM()) {
    if (fx.art === 'neu') {
      playFx(zeile, 'fx-in');
    } else {
      playFx(input, 'fx-pulse');
    }
  }
  toast(fx.art === 'plus' ? `${teil} hinzugefügt (×${fx.menge})` : `${teil} hinzugefügt`);
}
function materialHtml(p) {
  const liste = materialArray(p);
  const zeilen = liste
    .map(
      (m, i) => `<div class="meas-row matrow">
  <span class="meas-label">${esc(m.teil)}</span>
  <span class="field-box field-box--menge"><input class="value-input numeric" data-mat="menge" data-i="${i}" inputmode="decimal" maxlength="12" value="${esc(m.menge)}" aria-label="Menge ${esc(m.teil)}" autocomplete="off"></span>
  <button type="button" class="icon-btn" data-act="matdel" data-i="${i}" aria-label="${esc(m.teil)} entfernen"><span class="material-symbols-rounded" aria-hidden="true">delete</span></button>
</div>`,
    )
    .join('');
  return `<div class="matlist">${zeilen || '<p class="empty-note">Noch kein Material eingetragen. Bezeichnung unten eingeben und hinzufügen.</p>'}</div>
<div class="matadd">
  <div class="field-box"><input class="text-input" id="matfree" maxlength="80" aria-label="Bezeichnung des Materials" autocomplete="off"></div>
  <button type="button" class="btn-secondary" data-act="matfree"><span class="material-symbols-rounded" aria-hidden="true">add</span><span>Material hinzufügen</span></button>
</div>`;
}

/* Status zum Messwert: Passt, Prüfen oder nichts, solange kein Wert steht oder kein Sollbereich gilt */
const hatSoll = (f) => f.sMin != null || f.sMax != null;
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
/* Berechneter Wert mit Richtwert-Status (nur Heizwasser nach VDI 2035) */
function calcPillHtml(f, v) {
  const ev = f.id === 'wasser' ? evalField(f, v) : 'none';
  const art = { ok: ['green', 'Passt'], warn: ['orange', 'Prüfen'] }[ev];
  return art
    ? `<span class="status-pill status-pill--${art[0]}" id="cpill-${f.id}">${art[1]}</span>`
    : `<span class="status-pill status-pill--neutral" id="cpill-${f.id}" hidden></span>`;
}
function calcPillAktualisieren(f, v) {
  const el = $('#cpill-' + f.id);
  if (!el) {
    return;
  }
  const ev = evalField(f, v);
  const art = { ok: ['green', 'Passt'], warn: ['orange', 'Prüfen'] }[ev];
  el.hidden = !art;
  el.className = 'status-pill status-pill--' + (art ? art[0] : 'neutral');
  el.textContent = art ? art[1] : '';
}
function mangelNote(f, v, offen) {
  const kind = ALL_FIELDS.find((x) => x.parent === f.id);
  if (!kind) {
    return '';
  }
  return `<div class="check-note"><div><span class="field-box field-box--note"><input class="note-input" type="text" data-f="${kind.id}" value="${esc(v[kind.id] ?? '')}" aria-label="Mangel beschreiben: ${esc(f.label)}" autocomplete="off"${offen ? '' : ' tabindex="-1"'}></span></div></div>`;
}

function fieldHtml(f, p) {
  const v = p.values;
  const x = v[f.id] ?? '';
  const err = view.tried ? fieldError(f, p) : '';
  const req = isRequired(f, p) && f.type !== 'calc' ? ' *' : '';
  const hint = f.hint ? `<small class="field-hint">${esc(f.hint)}</small>` : '';
  const errHtml = err ? `<div class="ferr" role="alert">${esc(err)}</div>` : '';
  const fehler = err ? ' has-error' : '';
  const optionen = (vals, art) =>
    vals
      .map((o) => {
        const an = x === o;
        return art === 'pill'
          ? `<button type="button" class="tab-pill" data-act="set" data-f="${f.id}" data-v="${esc(o)}" aria-selected="${an}">${esc(o)}</button>`
          : `<button type="button" class="segmented-option" data-act="set" data-f="${f.id}" data-v="${esc(o)}" aria-pressed="${an}">${esc(o)}</button>`;
      })
      .join('');
  switch (f.type) {
    case 'material':
      return materialHtml(p);
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
      return `<div class="field check${offen ? ' has-defect' : ''}" data-item="${f.id}">
    <span class="field-label" id="lab-${f.id}">${esc(f.label)}${req}</span>
    <div class="segmented-control" role="group" aria-labelledby="lab-${f.id}">${optionen(BEWERTUNG, 'seg')}</div>
    ${altwertHint(x)}
    ${mangelNote(f, v, offen)}
  </div>`;
    }
    case 'yesno': {
      const ev = evalField(f, v);
      const warn =
        ev === 'warn' || ev === 'bad'
          ? '<span class="status-pill status-pill--orange">Prüfen</span>'
          : '';
      return `<div class="check-main"><span class="check-label">${esc(f.label)}${f.hint ? `<small>${esc(f.hint)}</small>` : ''}${warn}</span><div class="segmented-control segmented-inline" role="group" aria-label="${esc(f.label)}">${optionen(['Ja', 'Nein'], 'seg')}</div></div>`;
    }
    case 'select': {
      const lang = f.opts.length > 3;
      const auswahl = lang
        ? `<div class="tab-strip" role="group" aria-label="${esc(f.label)}">${optionen(f.opts, 'pill')}</div>`
        : `<div class="segmented-control" role="group" aria-label="${esc(f.label)}">${optionen(f.opts, 'seg')}</div>`;
      const ev = evalField(f, v);
      const status =
        ev === 'ok'
          ? '<span class="status-pill status-pill--green">In Ordnung</span>'
          : ev === 'bad'
            ? '<span class="status-pill status-pill--orange">Prüfen</span>'
            : '';
      return `<div class="field${fehler}"><span class="field-label">${esc(f.label)}${req}${hint}</span>${auswahl}${status}${errHtml}</div>`;
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
      return `<div class="calc-row"><span class="calc-label">${esc(f.label)}<small class="field-hint" id="note-${f.id}">${f.note ? esc(f.note(v)) : 'wird berechnet'}</small></span>${calcPillHtml(f, v)}<span class="calc-value numeric" id="calc-${f.id}">${esc(display(f, x) || '–')}</span></div>`;
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
            `<li><button type="button" class="jump-link" data-act="jump" data-i="${k}">${esc(TEMPLATE.pages[k].title)}</button><ul class="notice-sub">${errs.map((e) => `<li>${esc(e[0].label)}</li>`).join('')}</ul></li>`,
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

// Der folgende Block steht wortgleich in google-apps-script/PdfDialog.html (node tools/pdfdialog-bauen.js). Inhalt und Einrückung nur zusammen mit PdfDialog.html ändern.
/* @@quelle:reportParts */
      /* Ausdruck im neuen Papier-Design (Seitenklasse „neu“): Hauptwert, Auftragsdaten, Abschnitte in App-Reihenfolge, Auffälligkeiten, Wartungsabschluss.
   Nimmt die Bericht-Datenstruktur von buildReport() (App) bzw. rowToReport_() (Apps Script) entgegen; fehlt `calc`, wird die Zeile als normale Zeile gezeigt.
   Die HTML-Bausteine kommen aus shared/pdf-bausteine.js (pdfBausteine()), das CSS aus shared/pdf.css. */
      function reportParts(r) {
        const B = pdfBausteine(),
          { esc } = B;
        const CHECKV = ['i.O.', 'Mangel', 'n.i.O.', 'entfällt'];
        // Alte gespeicherte Berichte enthalten noch „Mangel“ → bleibt „nicht in Ordnung“, wird aber als „n.i.O.“ angezeigt
        const shown = (x) => (x === 'Mangel' ? 'n.i.O.' : x);
        const isCheck = (x) => ['ok', 'bad', 'na'].includes(x.eval) || CHECKV.includes(x.value);
        const evalOf = (x) => {
          if (x.eval && x.eval !== 'none') {
            return x.eval;
          }
          if (x.value === 'i.O.') {
            return 'ok';
          }
          if (x.value === 'Mangel' || x.value === 'n.i.O.') {
            return 'bad';
          }
          return x.value === 'entfällt' ? 'na' : '';
        };
        const firma = r.firma || (typeof settings !== 'undefined' ? settings.firma : '') || '';
        // „WARTUNGSPROTOKOLL • WÄRMEPUMPE“ → „Wartungsprotokoll“ und „Wärmepumpe“
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
        const header = r.header || [];
        // erstes Kopffeld, dessen Beschriftung passt (Nummern-Felder wie „Kundennummer“ ausgenommen)
        const hv = (re) =>
          (header.find((x) => re.test(x.label) && !/nummer|nr\.?$/i.test(x.label) && x.value) || {})
            .value || '';
        const datum = hv(/datum/i);
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

        const res = String(r.success || ''),
          good = res === 'Ja' || res === 'i.O.',
          bad = !!res && !good;
        const subs = String(r.subline || (r.betrieb ? 'Betriebszustand: ' + r.betrieb : ''))
          .split(' · ')
          .filter(Boolean);
        const defects = r.defects || [];
        // Datum einheitlich TT.MM.JJJJ (Eingang: „31.8.2026“, „31.08.2026“ oder „2026-08-31“)
        const p2 = (x) => String(x).padStart(2, '0');
        const dm =
          String(stand || '').match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/) ||
          String(stand || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
        const y0 = dm ? +(dm[1].length === 4 ? dm[1] : dm[3]) : 0,
          mo0 = dm ? +dm[2] - 1 : 0,
          d0 = dm ? +(dm[1].length === 4 ? dm[3] : dm[1]) : 0;
        const tileDate = dm ? `${p2(d0)}.${p2(mo0 + 1)}.${y0}` : stand || '';
        // Nächste Wartung: Dichtheitsprüfung vorgeschrieben → Intervall nach CO₂-Äquivalent (ab 5 t [hermetisch 10 t] 12 Monate, ab 50 t 6, ab 500 t 3), sonst Wartungsdatum + 12 Monate
        const nextDue = (() => {
          if (!dm) return { date: '', sub: '' };
          const co2 = parseFloat(String(r.co2 ?? '').replace(',', '.')),
            dp = r.dpv === 'Ja';
          if (dp && !(co2 > 0)) return { date: '', sub: 'CO₂-Äquivalent fehlt' };
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

        // Hauptwert: nächste Wartung (die Gesamtbewertung steht nicht im Bericht), daneben Datum und Monteur
        blocks.push({
          html: B.nHaupt({
            label: 'Nächste Wartung',
            wert: nextDue.date,
            sub: nextDue.sub || '',
            spalten: [
              { label: 'Datum', wert: tileDate },
              { label: 'Monteur / Prüfer', wert: r.techniker },
            ],
          }),
        });

        // Auftragsdaten (Kunden-Nr., Projekt-Nr., Datum und Monteur stehen schon im Kopf und im Hauptwert)
        const kundenNr = (
          header.find((x) => /^kunden[ -]?(nr|nummer)/i.test(x.label) && x.value) || {}
        ).value;
        const doppelt = (x) =>
          (kundenNr && /^kunden[ -]?(nr|nummer)/i.test(x.label)) ||
          (r.id && /^(projekt|protokoll)(-?nr|nummer)/i.test(x.label) && x.value === r.id) ||
          (r.techniker && /^monteur/i.test(x.label) && x.value === r.techniker) ||
          (datum && /^datum/i.test(x.label) && x.value === datum);
        const headerRows = header.filter((x) => !doppelt(x));
        let no = 0;
        if (headerRows.length) {
          blocks.push({
            html: B.nAbschnitt(String(++no), 'Auftragsdaten', B.nZeilen(headerRows)),
          });
        }

        // Abschnitte in App-Reihenfolge: Prüfpunkte mit Nummer, Messwerte und Angaben als Zeilen
        const auff = [];
        (r.sections || []).forEach((s) => {
          const all = (s.checks || []).concat(s.rows || []);
          const ck = all.filter(isCheck),
            fl = all.filter((x) => !isCheck(x));
          const nr = ++no;
          // Titel: „Kältekreislauf & F-Gase-Prüfung (EU 2024/573)“ → Titel plus Zusatz in Klammern
          const tt = String(s.title || '')
              .split(' • ')
              .pop(),
            tm = tt.match(/^(.*?)\s*\((.*)\)$/),
            titel = tm ? tm[1] : tt;
          const items = ck.map((x) => ({
            label: x.label,
            value: shown(x.value),
            eval: evalOf(x),
            mangel: x.mangel,
          }));
          items.forEach((x, i) => {
            if (x.eval === 'bad') {
              auff.push({ nr: `${nr}.${i + 1}`, text: `${titel} – ${x.label}: n.i.O.` });
            }
          });
          let body = '';
          if (items.length) {
            body += B.nPruef(items, nr, 0, true);
          }
          if (fl.length) {
            body += (items.length ? B.nSub('Messwerte und Angaben') : '') + B.nZeilen(fl);
          }
          blocks.push({
            html: B.nAbschnitt(
              String(nr),
              titel,
              body || '<div class="n-sub">Keine Angaben</div>',
              tm ? tm[2] : '',
            ),
          });
        });

        if ((r.material || []).length) {
          blocks.push({
            html: B.nAbschnitt(
              String(++no),
              'Benötigtes Material',
              B.nZeilen(r.material.map((m) => ({ label: m.teil, value: m.menge }))),
            ),
          });
        }

        // Auffälligkeiten: mit Nummer; weicht die Zahl von den Daten der App ab, gelten die Texte der App
        if (defects.length) {
          const liste =
            auff.length === defects.length
              ? auff
              : defects.map((d) => ({ nr: '', text: String(d).replace(/: Mangel$/, ': n.i.O.') }));
          blocks.push({ html: B.nAuff(liste) });
        }
        const betrieb = r.betrieb || subs.join(' · ');
        const abschluss = [
          { label: 'Betriebszustand', value: betrieb },
          { label: r.remarkLabel || 'Bemerkungen / Mängel', value: r.remark },
        ];
        blocks.push({ html: B.nAbschnitt('', 'Wartungsabschluss', B.nZeilen(abschluss)) });
        if (r.hinweis) {
          blocks.push({ html: B.nHinweis([{ titel: 'Betreiberhinweis.', text: r.hinweis }]) });
        }
        const sig = r.sig || {};
        blocks.push({
          html:
            '<div class="n-signs">' +
            B.nUnterschrift({
              bild: sig.tech,
              name: [r.techniker, stand].filter(Boolean).join(', '),
              label: 'Monteur / Prüfer',
            }) +
            '</div>',
        });

        const kunde = r.kundeName || kundenNr || hv(/kunde|betreiber/i),
          anlage = hv(/^(?!zuständigkeit)(.*anlage|.*modell)/i);
        const titelZeilen = [kicker ? nice(kicker) : '', h1].filter(Boolean);
        return {
          blocks,
          pageClass: 'neu',
          head: B.nKopf({
            firma,
            titel: titelZeilen,
            nummern: [
              { label: 'Projekt-Nr.', wert: r.id },
              { label: 'Kunden-Nr.', wert: kundenNr },
              { label: 'Datum', wert: tileDate },
            ],
          }),
          smallHead: B.nKopfKlein({
            firma,
            zeile: [kunde, anlage].filter(Boolean).join(', '),
            nummern: [{ label: 'Projekt-Nr.', wert: r.id }],
          }),
          foot: B.nFuss({ text: titelZeilen.join(' '), stand }),
          id: esc(r.id),
        };
      }
/* @@ende */

/* Bericht samt Unterschrift; PDF_OPTS: vor dem Rendern auf die Unterschrift (Bild) warten */
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
