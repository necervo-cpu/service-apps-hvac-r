// Ansichten: Übersicht, Assistent, Bericht (reportParts), PDF-Leiste und Datenbank.
'use strict';

/* Auswahl-Dropdowns und mittige Zahlenfelder (shared/choice-dropdown.js, Modul unten) */
function nachRender() {
  if (window.agUiInit) {
    window.agUiInit();
  }
}
const Views = {
  home() {
    const drafts = protocols.filter((p) => p.status === 'draft');
    const done = protocols
      .filter((p) => p.status === 'done')
      .sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)));
    const pending = done.filter((p) => !p.synced).length;
    const chev =
      '<span class="material-symbols-rounded row-chevron" aria-hidden="true">chevron_right</span>';
    const neu = (typ, icon, titel) => `
  <button type="button" class="row" data-act="new" data-typ="${typ}">
    <span class="row-icon row-icon--heizung"><span class="material-symbols-rounded" aria-hidden="true">${icon}</span></span>
    <span class="row-text"><span class="row-title">${titel}</span><span class="row-sub">Neue Wartung starten</span></span>
    ${chev}
  </button>`;
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
<div class="group">${neu('gas', 'local_fire_department', 'Gasheizung')}${neu('oel', 'oil_barrel', 'Ölheizung')}
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
${drafts.length ? `<div class="group">${drafts.map(protoCard).join('')}</div>` : '<p class="empty-note">Noch keine offene Wartung. Oben Gas- oder Ölheizung wählen.</p>'}
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
  const k = bewertungStufe(text);
  if (k < 0) {
    return '';
  }
  const ton = ['green', 'orange', 'red'][k];
  return `<span class="status-pill status-pill--${ton}">${esc(BEWERTUNG_KURZ[k])}</span>`;
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
      bewertungBadge(v.bewertung) +
      pill(p.synced ? 'green' : 'orange', p.synced ? 'in der Datenbank' : 'nicht übertragen');
  }
  const typBadge = TYP_KURZ[v.typ] ? pill('neutral', TYP_KURZ[v.typ]) : '';
  const meta = [
    fmtDate(v.datum),
    [v.hersteller, v.modell].filter(Boolean).join(' '),
    v.techniker,
  ]
    .filter(Boolean)
    .map(esc)
    .join(', ');
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
        <span class="row-title">${esc(v.projekt || 'Ohne Protokoll-Nr.')}</span>
        ${v.kunde ? `<span class="row-sub">${esc(v.kunde)}</span>` : ''}
        ${meta ? `<span class="row-sub">${meta}</span>` : ''}
        <span class="proto-pills">${typBadge}${badges}</span>
      </span>
      <span class="material-symbols-rounded row-chevron" aria-hidden="true">chevron_right</span>
    </button>
    ${edit}
    <button type="button" class="icon-btn proto-act is-danger" data-act="del" data-id="${p.id}" aria-label="Protokoll löschen"><span class="material-symbols-rounded" aria-hidden="true">delete</span></button>
  </div>`;
}

const KOPF_IDS = new Set(TEMPLATE.pages[0].fields.map((f) => f.id));
const OK3_WERT = ['ok', 'mangel', 'na'];
const OK3_ICON = ['check', 'priority_high', 'remove'];
const OK3_TITEL = ['In Ordnung', 'Mangel', 'Entfällt'];
const OK3_LABEL = ['i.O.', 'Mangel', 'entfällt'];

function wizardHtml(p, i) {
  const pg = TEMPLATE.pages[i];
  const v = p.values;
  const sichtbar = pg.fields.filter((f) => !f.parent && aktiv(f, v));
  const hatPruefpunkte = sichtbar.some((f) => f.type === 'okfail');
  const offen = sichtbar.some((f) => f.type === 'okfail' && !v[f.id]);
  const gruppen = [];
  sichtbar.forEach((f) => {
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

function materialFeedback(teil, fx) {
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
  <div class="field-box"><input class="text-input" id="matfree" aria-label="Bezeichnung des Materials" autocomplete="off"></div>
  <button type="button" class="btn-secondary" data-act="matfree"><span class="material-symbols-rounded" aria-hidden="true">add</span><span>Material hinzufügen</span></button>
</div>`;
}

function altwertHint(x) {
  if (!x || BEWERTUNG.includes(x) || bewertungStufe(x) < 0) {
    return '';
  }
  return `<div class="field-hint altwert">Altwert: ${esc(x)}</div>`;
}
/* Status zum Messwert: Passt, Prüfen oder nichts, solange kein Wert steht */
function messPill(f, v) {
  const ev = f.regel ? evalField(f, v) : 'none';
  const art = { ok: ['green', 'Passt'], warn: ['orange', 'Prüfen'], bad: ['red', 'Prüfen'] }[
    ev
  ];
  return art
    ? `<span class="status-pill status-pill--${art[0]}" id="pill-${f.id}">${art[1]}</span>`
    : `<span class="status-pill status-pill--neutral" id="pill-${f.id}" hidden></span>`;
}
function messPillAktualisieren(f, v) {
  const el = $('#pill-' + f.id);
  if (!el) {
    return;
  }
  const ev = evalField(f, v);
  const art = { ok: ['green', 'Passt'], warn: ['orange', 'Prüfen'], bad: ['red', 'Prüfen'] }[
    ev
  ];
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

/* Zahlenfelder: − und + links und rechts vom Feld, Schritt je Einheit (KOMPONENTEN.md, Regel 1.4) */
const SCHRITT_JE_EINHEIT = { '°C': 0.5, K: 0.5, bar: 0.1, 'µS/cm': 10, pH: 0.1, Pa: 10, hPa: 5, V: 1, A: 0.5, kg: 0.1, l: 0.1, '%': 1, mm: 1 };
function stepBtn(f, richtung) {
  const schritt = f.step ?? SCHRITT_JE_EINHEIT[f.unit] ?? 1;
  const bezeichnung = richtung < 0 ? 'Verringern' : 'Erhöhen';
  return `<button type="button" class="step-btn" data-stepf="${f.id}" data-dir="${richtung}" data-step="${schritt}" tabindex="-1" aria-label="${bezeichnung}: ${esc(f.label)}">${richtung < 0 ? '−' : '+'}</button>`;
}
function fieldHtml(f, p) {
  const v = p.values;
  const x = wert(f, v);
  const err = view.tried ? fieldError(f, p) : '';
  const req = isRequired(f) ? ' *' : '';
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
    case 'okfail': {
      const offen = x === 'n.i.O.';
      const tri = OK3.map(
        (o, k) =>
          `<button type="button" data-act="set" data-f="${f.id}" data-v="${esc(o)}" data-value="${OK3_WERT[k]}" aria-pressed="${x === o}" aria-label="${OK3_TITEL[k]}"><span class="material-symbols-rounded" aria-hidden="true">${OK3_ICON[k]}</span><span class="tri-label">${OK3_LABEL[k]}</span></button>`,
      ).join('');
      return `<div class="check${offen ? ' has-defect' : ''}" data-item="${f.id}">
    <div class="check-main"><span class="check-label">${esc(f.label)}${f.hint ? `<small>${esc(f.hint)}</small>` : ''}</span><div class="tri" role="group" aria-label="Bewertung: ${esc(f.label)}">${tri}</div></div>
    ${mangelNote(f, v, offen)}
  </div>`;
    }
    case 'typ':
      return `<div class="check-main"><span class="check-label">${esc(f.label)}</span><span class="typinfo">${esc(TYP_NAME[x] || '')}</span></div>`;
    case 'yesno': {
      const ev = evalField(f, v);
      const warn =
        ev === 'warn' || ev === 'bad'
          ? '<span class="status-pill status-pill--orange">Prüfen</span>'
          : '';
      return `<div class="check-main"><span class="check-label">${esc(f.label)}${f.hint ? `<small>${esc(f.hint)}</small>` : ''}${warn}</span><div class="segmented-control segmented-inline" role="group" aria-label="${esc(f.label)}">${optionen(['Ja', 'Nein'], 'seg')}</div></div>`;
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
    case 'material':
      return materialHtml(p);
    case 'select': {
      const opts = optsOf(f, v);
      const lang = opts.length > 3;
      const schnell = f.other ? ' data-choice-action="Kennbuchstabe wählen"' : '';
      const auswahl = lang
        ? `<div class="tab-strip" role="group" aria-label="${esc(f.label)}"${schnell}>${optionen(opts, 'pill')}</div>`
        : `<div class="segmented-control" role="group" aria-label="${esc(f.label)}"${schnell}>${optionen(opts, 'seg')}</div>`;
      const eingabe = f.other
        ? `<div class="field-box"><input class="text-input" id="in-${f.id}-o" aria-label="${esc(f.label)}" data-f="${f.id}" data-other="1" value="${esc(x)}" autocomplete="off"></div>`
        : '';
      return `<div class="field"><span class="field-label">${esc(f.label)}${req}${hint}</span>${eingabe}${auswahl}</div>`;
    }
    case 'number': {
      const m = f.regel ? MESSWERTE[f.regel] : null;
      const modus = m && m.min < 0 ? 'text' : (m && m.ganz) || f.ganz ? 'numeric' : 'decimal';
      const ph = esc(f.ph || '');
      if (KOPF_IDS.has(f.id)) {
        return `<div class="field${fehler}"><label class="field-label" for="in-${f.id}">${esc(f.label)}${req}${hint}</label>
    <div class="field-box input-wrapper"><input class="glass-input numeric" id="in-${f.id}" data-f="${f.id}" inputmode="${modus}" autocomplete="off" value="${esc(x)}">${f.unit ? `<span class="input-unit-addon">${esc(f.unit)}</span>` : ''}</div>${errHtml}</div>`;
      }
      const soll = f.regel ? sollText(f, v) : '';
      const notizen = [f.hint, soll]
        .filter(Boolean)
        .map((t) => `<div>${esc(t)}</div>`)
        .join('');
      const negativ = m != null && m.min < 0; // Messwerte mit negativem Bereich (z. B. Unterdruck, Zug) bekommen den ±-Umschalter
      return `<div class="meas-wrap${fehler}">
    <label class="meas-row" for="in-${f.id}"><span class="meas-label">${esc(f.label)}</span>${f.regel ? messPill(f, v) : ''}${stepBtn(f, -1)}<span class="vwrap">${negativ ? `<button type="button" class="sign-btn" data-sign="${f.id}" tabindex="-1" aria-label="Vorzeichen wechseln: ${esc(f.label)}">±</button>` : ''}<input class="value-input numeric" id="in-${f.id}" data-f="${f.id}" inputmode="${modus}" autocomplete="off" value="${esc(x)}"><span class="input-unit-addon">${esc(f.unit || '')}</span></span>${stepBtn(f, 1)}</label>
    ${notizen ? `<div class="meas-notes">${notizen}</div>` : ''}${errHtml}
  </div>`;
    }
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
            `<li><button type="button" class="jump-link" data-act="jump" data-i="${k}">${esc(TEMPLATE.pages[k].title)}</button>: ${errs.map((e) => esc(e[0].label)).join(', ')}</li>`,
        )
        .join('')}</ul></div>`
    : '';
  const maengel = `<h2 class="section-title">Mängel und auffällige Messwerte <span class="section-count">${d.length}</span></h2>${
    d.length
      ? `<div class="group group--form">${d.map((x) => `<div class="defect">${esc(x)}</div>`).join('')}</div>`
      : '<p class="empty-note">Keine Mängel erfasst.</p>'
  }`;
  const name = p.values.techniker ? esc(p.values.techniker) : '';
  const unterschrift = `<h2 class="section-title">Unterschrift Techniker${PFLICHTFELDER ? ' *' : ''}${name ? ` <span class="section-count">${name}</span>` : ''}</h2>
<div class="sigwrap"><canvas class="sig" data-sig="tech" aria-label="Unterschrift Techniker"></canvas></div>
<button type="button" class="btn-secondary" data-act="sigclear" data-sig="tech"><span class="material-symbols-rounded" aria-hidden="true">ink_eraser</span><span>Unterschrift löschen</span></button>`;
  return `${unvollstaendig}${maengel}${felder}${unterschrift}`;
}

/* @@quelle:reportParts */
      function reportParts(r) {
        const B = pdfBausteine();
        const { esc } = B;
        const TYP_H1 = { gas: 'Gasheizung', oel: 'Ölheizung' };
        const firma = r.firma || '';
        const kopfzeile = String(r.title || 'WARTUNGSPROTOKOLL').split(' • ')[0];
        const nice = (s) => s.charAt(0) + s.slice(1).toLowerCase();
        const h1 = TYP_H1[r.typ] || 'Gas-/Ölheizung';
        const header = r.header || [];
        const hv = (re) => {
          const treffer = header.find(
            (x) => re.test(x.label) && !/nummer|nr\.?$/i.test(x.label) && x.value,
          );
          return treffer ? treffer.value : '';
        };
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

        const p2 = (x) => String(x).padStart(2, '0');
        const dm =
          String(stand || '').match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/) ||
          String(stand || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
        const y0 = dm ? +(dm[1].length === 4 ? dm[1] : dm[3]) : 0;
        const mo0 = dm ? +dm[2] - 1 : 0;
        const d0 = dm ? +(dm[1].length === 4 ? dm[3] : dm[1]) : 0;
        const tileDate = dm ? `${p2(d0)}.${p2(mo0 + 1)}.${y0}` : stand || '';
        const naechste = (() => {
          if (!dm) {
            return '';
          }
          const t = mo0 + 12;
          const y = y0 + Math.floor(t / 12);
          const mo = t % 12;
          const d = Math.min(d0, new Date(y, mo + 1, 0).getDate());
          return `${p2(d)}.${p2(mo + 1)}.${y}`;
        })();

        // Hauptwert: nächste Wartung (die Gesamtbewertung steht nicht im Bericht), daneben Datum und Techniker
        blocks.push({
          html: B.nHaupt({
            label: 'Nächste Wartung',
            wert: naechste,
            sub: naechste ? 'jährliche Wartung' : '',
            spalten: [
              { label: 'Datum', wert: tileDate },
              { label: 'Techniker', wert: r.techniker },
            ],
          }),
        });

        // Auftrags- und Anlagendaten (Protokoll-Nr., Kunden-Nr., Datum und Techniker stehen schon im Kopf bzw. Hauptwert)
        const kundenRe = /^(kunden-?(nr\.?|nummer)|kunde \/ objekt)/i;
        const kundenNr = (header.find((x) => kundenRe.test(x.label) && x.value) || {}).value;
        const doppelt = (x) =>
          (kundenNr && kundenRe.test(x.label)) ||
          (r.id && /^(projekt|protokoll)(-?nr|nummer)/i.test(x.label) && x.value === r.id) ||
          (r.techniker && /^(techniker|monteur)/i.test(x.label) && x.value === r.techniker) ||
          (datum && /^datum/i.test(x.label) && x.value === datum);
        const headerRows = header.filter((x) => !doppelt(x));
        let no = 0;
        if (headerRows.length) {
          const hg = [];
          headerRows.forEach((x) => {
            const g = x.group || '';
            let e = hg.find((q) => q.g === g);
            if (!e) {
              e = { g, rows: [] };
              hg.push(e);
            }
            e.rows.push(x);
          });
          const body = hg
            .map((e) => (hg.length > 1 && e.g ? B.nSub(e.g) : '') + B.nZeilen(e.rows))
            .join('');
          blocks.push({ html: B.nAbschnitt(String(++no), 'Auftrags- und Anlagendaten', body) });
        }

        // Abschnitte in App-Reihenfolge, Prüfpunkte mit Nummer, Auffälligkeiten als Index
        const auff = [];
        const evalOf = (x) => (['ok', 'bad', 'na'].includes(x.eval) ? x.eval : '');
        (r.sections || []).forEach((s) => {
          const items = (s.checks || []).map((x) => ({
            label: x.label,
            mangel: x.mangel,
            value: x.value,
            eval: evalOf(x),
            group: x.group || '',
            chk: true,
          }));
          const rows = (s.rows || []).map((x) => Object.assign({ chk: false }, x));
          const nr = ++no;
          const groups = [];
          items.concat(rows).forEach((x) => {
            const g = x.group || '';
            let e = groups.find((q) => q.g === g);
            if (!e) {
              e = { g, rows: [], chk: [] };
              groups.push(e);
            }
            (x.chk ? e.chk : e.rows).push(x);
          });
          let body = '';
          let count = 0;
          let kopfZeigen = true;
          groups.forEach((e) => {
            e.chk.forEach((x, i) => {
              if (x.eval === 'bad') {
                auff.push({ nr: `${nr}.${count + i + 1}`, text: `${s.title} – ${x.label}: n.i.O.` });
              }
            });
            const kopf = groups.length > 1 && e.g ? B.nSub(e.g) : '';
            const pruef = e.chk.length ? B.nPruef(e.chk, nr, count, kopfZeigen) : '';
            const zeilen = e.rows.length ? B.nZeilen(e.rows) : '';
            count += e.chk.length;
            if (e.chk.length) {
              kopfZeigen = false;
            }
            body += kopf + pruef + zeilen;
          });
          blocks.push({
            html: B.nAbschnitt(String(nr), s.title, body || '<div class="n-subh">Keine Angaben</div>'),
          });
        });

        const material = r.material || [];
        if (material.length) {
          blocks.push({
            html: B.nAbschnitt(
              String(++no),
              'Verwendetes Material',
              B.nZeilen(material.map((m) => ({ label: m.teil, value: m.menge || '' }))),
              `${material.length}`,
            ),
          });
        }

        // Auffälligkeiten: mit Nummer; weicht die Zahl von den Daten der App ab, gelten die Texte der App
        const defects = r.defects || [];
        if (defects.length) {
          const liste =
            auff.length === defects.length
              ? auff
              : defects.map((d) => ({ nr: '', text: String(d).replace(/: Mangel$/, ': n.i.O.') }));
          blocks.push({ html: B.nAuff(liste) });
        }
        const abschluss = [
          {
            label: 'Festgestellte Mängel / Noch auszuführende Arbeiten (Folgeauftrag)',
            value: r.remark,
          },
        ];
        if (r.absprachen) {
          abschluss.push({ label: 'Absprachen & Abweichungen', value: r.absprachen });
        }
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
              label: 'Techniker',
            }) +
            '</div>',
        });

        const kunde = hv(/kunde|objekt/i);
        const anlage = hv(/^modell/i);
        const titelZeilen = [nice(kopfzeile), h1];
        return {
          blocks,
          pageClass: 'neu',
          head: B.nKopf({
            firma,
            titel: titelZeilen,
            nummern: [
              { label: 'Protokoll-Nr.', wert: r.id },
              { label: 'Kunden-Nr.', wert: kundenNr },
              { label: 'Datum', wert: tileDate },
            ],
          }),
          smallHead: B.nKopfKlein({
            firma,
            zeile: [kunde, anlage].filter(Boolean).join(', '),
            nummern: [{ label: 'Protokoll-Nr.', wert: r.id }],
          }),
          foot: B.nFuss({ text: titelZeilen.join(' '), stand }),
          id: esc(r.id),
        };
      }
/* @@ende */

const PDF_OPTS = { waitImages: true };
function reportOf(p) {
  const r = buildReport(p);
  r.sig = p.sig;
  return r;
}
function reportForView() {
  if (view.db) {
    return view.rep;
  }
  const p = protocols.find((x) => x.id === view.id);
  return p ? reportOf(p) : null;
}

let lastPdf = null;
const viewKey = () => (view.db ? 'db:' + view.key : 'loc:' + view.id);
function pdfBarHtml() {
  if (!lastPdf || lastPdf.key !== viewKey()) {
    return '';
  }
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
        [e.projekt, e.kunde, e.techniker, e.modell, e.typ, e.datum, fmtDate(e.datum)]
          .join(' ')
          .toLowerCase()
          .includes(q),
    )
    .sort((a, b) => String(b.datum).localeCompare(String(a.datum)));
  if (!list.length) {
    return `<p class="empty-note">${dbCache.list.length ? 'Keine Treffer. Suchbegriff ändern oder leeren.' : 'Keine Daten. „Aus Datenbank laden“ ruft die Protokollliste ab.'}</p>`;
  }
  const lim = view.lim || 100;
  const shown = list.slice(0, lim);
  const zeilen = shown
    .map((e) => {
      const unter = [e.typ, e.modell, e.techniker].filter(Boolean).map(esc).join(', ');
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
        ${e.bewertung ? `<span class="proto-pills">${bewertungBadge(e.bewertung)}</span>` : ''}
      </span>
      <span class="material-symbols-rounded row-chevron" aria-hidden="true">chevron_right</span>
    ${pdfEnde}
    <button type="button" class="icon-btn proto-act" data-act="dbedit" data-key="${esc(e.key)}" aria-label="Protokoll bearbeiten"><span class="material-symbols-rounded" aria-hidden="true">edit</span></button>
  </div>`;
    })
    .join('');
  return `<div class="group">${zeilen}</div>
    ${list.length > lim ? `<button type="button" class="btn-secondary" data-act="dbmore">Weitere anzeigen (${lim} von ${list.length})</button>` : ''}`;
}

function initSig(canvas, p) {
  const key = canvas.dataset.sig;
  const r = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
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
  let drawing = false;
  let last = null;
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
    if (!drawing) {
      return;
    }
    const q = pt(e);
    ctx.beginPath();
    ctx.moveTo(last[0], last[1]);
    ctx.lineTo(q[0], q[1]);
    ctx.stroke();
    last = q;
  });
  const end = () => {
    if (!drawing) {
      return;
    }
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
const After = {
  wizard() {
    const p = cur();
    if (p && TEMPLATE.pages[p.page].final) {
      document.querySelectorAll('canvas.sig').forEach((c) => initSig(c, p));
    }
  },
};
