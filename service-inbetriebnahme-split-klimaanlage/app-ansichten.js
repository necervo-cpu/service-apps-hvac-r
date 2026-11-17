// Ansichten: Übersicht, Formular, Bericht, Datenbank sowie die zugehörigen Bausteine.
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
<h2 class="section-title">Neues Protokoll</h2>
<div class="group">
  <button type="button" class="row" data-act="new">
    <span class="row-icon row-icon--orange"><span class="material-symbols-rounded" aria-hidden="true">ac_unit</span></span>
    <span class="row-text"><span class="row-title">Split-Klimaanlage</span><span class="row-sub">Inbetriebnahmeprotokoll starten</span></span>
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
<h2 class="section-title">Offene Inbetriebnahmen <span class="section-count">${drafts.length}</span></h2>
${drafts.length ? `<div class="group">${drafts.map(protoCard).join('')}</div>` : '<p class="empty-note">Noch keine offene Inbetriebnahme. Oben „Split-Klimaanlage“ wählen.</p>'}
<h2 class="section-title">Abgeschlossen <span class="section-count">${done.length}</span></h2>
${done.length ? `<div class="group">${done.map(protoCard).join('')}</div>` : '<p class="empty-note">Noch keine abgeschlossene Inbetriebnahme. Sie erscheint hier nach dem Abschließen.</p>'}`;
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
  <input id="dbsearch" type="search" placeholder="Protokoll-Nr., Kunden-Nr., Monteur, Modell, Datum" aria-label="Datenbank durchsuchen" autocomplete="off" value="${esc(view.q || '')}">
</label>
<div id="dblist">${dbList()}</div>`;
  },
};

function bewertungPill(text) {
  const art = bewertungArt(text);
  if (art === 'none') {
    return '';
  }
  return `<span class="status-pill status-pill--${art === 'ok' ? 'green' : 'red'}">${esc(text)}</span>`;
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
      bewertungPill(v.erfolg) +
      pill(p.synced ? 'green' : 'orange', p.synced ? 'in der Datenbank' : 'nicht übertragen');
  }
  const meta = [fmtDate(v.datum), v.agMod, v.monteur].filter(Boolean).map(esc).join(', ');
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
        <span class="proto-pills">${badges}</span>
      </span>
      <span class="material-symbols-rounded row-chevron" aria-hidden="true">chevron_right</span>
    </button>
    ${edit}
    <button type="button" class="icon-btn proto-act is-danger" data-act="del" data-id="${p.id}" aria-label="Protokoll löschen"><span class="material-symbols-rounded" aria-hidden="true">delete</span></button>
  </div>`;
}

function altwertHint(x) {
  if (!x || BEWERTUNG.includes(x) || bewertungArt(x) === 'none') {
    return '';
  }
  return `<div class="field-hint altwert">Altwert: ${esc(x)}</div>`;
}
function mangelNote(f, v, offen) {
  const kind = FIELD[f.id + 'M'];
  if (!kind) {
    return '';
  }
  return `<div class="check-note"><div><span class="field-box field-box--note"><input class="note-input" type="text" data-f="${kind.id}" value="${esc(v[kind.id] ?? '')}" placeholder="${esc(kind.ph || '')}" aria-label="Mangel beschreiben: ${esc(f.label)}" autocomplete="off"${offen ? '' : ' tabindex="-1"'}></span></div></div>`;
}

/* Auswahlfelder: Die leere Option „Nicht gewählt“ steht für „noch nichts gewählt“ (und bei Feldern mit eigenem Wert für „Anderer Wert“) */
const istAnderer = (f, x) => !!f.other && x !== '' && !f.opts.includes(x);
const leerText = (f, x) => (istAnderer(f, x) ? 'Anderer Wert' : 'Nicht gewählt');
const optGewaehlt = (f, o, x) => (o === '' ? x === '' || istAnderer(f, x) : x === o);
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
      const warn = evalField(f, v) === 'bad';
      return `<div class="check-main"><span class="check-label">${esc(f.label)}${f.hint ? `<small>${esc(f.hint)}</small>` : ''}<span class="status-pill status-pill--orange" id="warn-${f.id}"${warn ? '' : ' hidden'}>Prüfen</span></span><div class="segmented-control segmented-inline" role="group" aria-label="${esc(f.label)}">${optionen(['Ja', 'Nein'], 'seg')}</div></div>`;
    }
    case 'select': {
      const custom = f.other && x && !f.opts.includes(x);
      const leer = `<button type="button" class="tab-pill" data-act="set" data-f="${f.id}" data-v="" data-leer="1" aria-selected="${optGewaehlt(f, '', x)}">${leerText(f, x)}</button>`;
      const auswahl = `<div class="tab-strip" role="group" aria-label="${esc(f.label)}">${leer}${optionen(f.opts, 'pill')}</div>`;
      const eingabe = f.other
        ? `<span class="field-box"><input class="text-input" id="in-${f.id}-o" aria-label="${esc(f.label)}: anderer Wert" data-f="${f.id}" data-other="1" placeholder="Anderen Wert eintragen" value="${custom ? esc(x) : ''}" autocomplete="off"></span>`
        : '';
      return `<div class="field${fehler}"><span class="field-label">${esc(f.label)}${req}${hint}</span>${auswahl}${eingabe}${errHtml}</div>`;
    }
    case 'number': {
      const modus = f.min != null && f.min < 0 ? 'text' : 'decimal';
      const notizen = [f.hint, sollText(f)]
        .filter(Boolean)
        .map((t) => `<div>${esc(t)}</div>`)
        .join('');
      return `<div class="meas-wrap${fehler}">
    <label class="meas-row" for="in-${f.id}"><span class="meas-label">${esc(f.label)}</span><span class="vwrap"><input class="value-input numeric" id="in-${f.id}" data-f="${f.id}" inputmode="${modus}" autocomplete="off" value="${esc(x)}" placeholder="${esc(f.ph || '')}"><span class="input-unit-addon">${esc(f.unit || '')}</span></span></label>
    ${notizen ? `<div class="meas-notes">${notizen}</div>` : ''}${errHtml}
  </div>`;
    }
    case 'calc':
      return `<div class="calc-row"><span class="calc-label">${esc(f.label)}<small class="field-hint" id="note-${f.id}">${f.note ? esc(f.note(v)) : 'wird berechnet'}</small></span><span class="calc-value numeric" id="calc-${f.id}">${esc(display(f, x) || '–')}</span></div>`;
    case 'date':
      return `<label class="field${fehler}"><span class="field-label">${esc(f.label)}${req}${hint}</span><span class="field-box"><input class="text-input" id="in-${f.id}" type="date" data-f="${f.id}" value="${esc(x)}"></span>${errHtml}</label>`;
    case 'longtext':
      return `<label class="field"><span class="field-label">${esc(f.label)}${req}${hint}</span><span class="field-box"><textarea class="text-input" id="in-${f.id}" data-f="${f.id}" placeholder="${esc(f.ph || '')}">${esc(x)}</textarea></span></label>`;
    default:
      return `<label class="field${fehler}"><span class="field-label">${esc(f.label)}${req}${hint}</span><span class="field-box"><input class="text-input" id="in-${f.id}" data-f="${f.id}" value="${esc(x)}" placeholder="${esc(f.ph || '')}" autocomplete="off"></span>${errHtml}</label>`;
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
            `<li><button type="button" class="jump-link" data-act="jump" data-i="${k}">${esc(TEMPLATE.pages[k].title)}</button><ul class="notice-sub">${errs.map((e) => `<li>${esc(e[0].pdf || e[0].label)}</li>`).join('')}</ul></li>`,
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

// Der folgende Block steht wortgleich in google-apps-script/PdfDialog.html (node tools/pdfdialog-bauen.js)
/* @@quelle:reportParts */
      /* Ausdruck im Muther-Design: A4-Seiten mit Kacheln, Checklisten, Seitenumbruch („Fortsetzung“) und Fußzeile „Seite x von y“.
   Nimmt die Bericht-Datenstruktur von buildReport() (App) bzw. rowToReport_() (Apps Script) unverändert entgegen.
   Die HTML-Bausteine kommen aus shared/pdf-bausteine.js (pdfBausteine()), das CSS aus shared/pdf.css. */
      function reportParts(r) {
        const B = pdfBausteine(),
          { esc, nl, up, pill } = B;
        const CHECKV = ['i.O.', 'Mangel', 'n.i.O.', 'entfällt'];
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
        blocks.push({
          html: B.kacheln(
            [
              {
                art: good ? 'ok' : bad ? 'bad' : '',
                lab: r.resultLabel || 'Wartung erfolgreich',
                val: res,
                subHtml: `${good ? pill('ok', 'in Ordnung') : bad ? pill('bad', 'nicht in Ordnung') : ''}${r.successMangel ? `<div>${esc(r.successMangel)}</div>` : ''}${other.length ? `<div>${esc(other.join(' · '))}</div>` : ''}`,
              },
              { lab: 'Datum', val: datum || stand },
              { lab: 'Monteur / Prüfer', val: r.techniker },
            ],
            { links: true },
          ),
        });

        // Auftrags- und Anlagendaten (Kunden-Nr. steht schon im Kopf)
        const kundenNr = (
          header.find((x) => /^kunden[ -]?(nr|nummer)/i.test(x.label) && x.value) || {}
        ).value;
        const headerRows = header.filter(
          (x) => !(kundenNr && /^kunden[ -]?(nr|nummer)/i.test(x.label)),
        );
        if (headerRows.length)
          blocks.push({ html: B.abschnitt('Auftrags- & Anlagendaten', B.kv(headerRows)) });

        // Abschnitte: Prüfpunkte als Checkliste, Messwerte als Feldliste, Tabellen umbrechbar
        const lastCheck = (r.sections || []).reduce(
          (m, s, i) => ((s.checks || []).concat(s.rows || []).some(isCheck) ? i : m),
          -1,
        );
        (r.sections || []).forEach((s, si) => {
          const all = (s.checks || []).concat(s.rows || []);
          const ck = all.filter(isCheck),
            fl = all.filter((x) => !isCheck(x));
          const ckHtml = B.checkliste(
            ck.map((x) => ({
              label: x.label,
              mangel: x.mangel,
              value: x.value,
              eval: evalOf(x),
            })),
            { nrPrefix: true, legende: si === lastCheck },
          );
          const flHtml = fl.length
            ? (ck.length ? B.zwischenTitel('Messwerte & Angaben') : '') + B.kv(fl)
            : '';
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
          blocks.push({ html: B.notiz({ titel: 'Auffälligkeiten', liste: defects, art: 'def' }) });
        const abschluss = [];
        if (next) {
          abschluss.push({
            label: 'Nächste Wartung',
            value: next.replace(/^Nächste Wartung:\s*/, ''),
          });
        }
        abschluss.push({
          label: r.remarkLabel || 'Bemerkungen / Mängel',
          value: r.remark,
          wide: true,
        });
        blocks.push({ html: B.abschnitt('Abschluss', B.kv(abschluss)) });
        if (r.hinweis)
          blocks.push({ html: B.rechtstext([{ titel: 'Betreiberhinweis.', text: r.hinweis }]) });
        const sig = r.sig || {};
        blocks.push({
          html: B.unterschrift({
            tech: { bild: sig.tech, name: [r.techniker, stand].filter(Boolean).join(' · ') },
            kunde: { bild: sig.kunde, name: r.kundeName },
            labels: { tech: 'Monteur / Prüfer', kunde: 'Kunde / Betreiber' },
          }),
        });

        const kunde = hv(/kunde|betreiber/i),
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
const After = {
  wizard() {
    const p = cur();
    if (p && TEMPLATE.pages[p.page].final) {
      document.querySelectorAll('canvas.sig').forEach((c) => initSig(c, p));
    }
  },
};
