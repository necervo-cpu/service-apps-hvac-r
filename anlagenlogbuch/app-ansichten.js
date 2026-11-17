// Ansichten: Übersicht, Formular, Abschlussseite, Unterschriften und Berichtsteile (der Block reportParts steht wortgleich in PdfDialog.html).
'use strict';

/* ---------- Ansichten ---------- */
const CHEV =
  '<span class="material-symbols-rounded row-chevron" aria-hidden="true">chevron_right</span>';
const Views = {
  home() {
    const drafts = books.filter((p) => p.status === 'draft');
    const done = books
      .filter((p) => p.status === 'done')
      .sort((a, b) =>
        String(summary(b).last || b.completedAt).localeCompare(
          String(summary(a).last || a.completedAt),
        ),
      );
    const pending = done.filter((p) => !p.synced).length;
    const pendHtml = pending ? chip('orange', pending + ' offen') : '';
    return `
${
  updateHinweis && !updateSpaeter
    ? `<div class="notice notice--update"><div class="notice-text"><strong>Neue Version ${esc(updateHinweis)}</strong><span>Aktuell installiert: ${esc(APP_VERSION)}</span></div><div class="btn-row"><button type="button" class="btn-primary" data-act="doupdate">Aktualisieren</button><button type="button" class="btn-secondary" data-act="updatespaeter">Später</button></div></div>`
    : ''
}
${
  !settings.url
    ? '<div class="notice"><span>Noch keine Verbindung zur Datenbank eingerichtet. Logbücher bleiben lokal gespeichert, bis die Web-App-URL in den Einstellungen steht.</span><button type="button" class="btn-secondary" data-act="settings">Einstellungen öffnen</button></div>'
    : ''
}
<h2 class="section-title">Neues Logbuch</h2>
<div class="group">
  <button type="button" class="row" data-act="newbook">
    <span class="row-icon row-icon--orange"><span class="material-symbols-rounded" aria-hidden="true">add_circle</span></span>
    <span class="row-text"><span class="row-title">Neues Logbuch</span><span class="row-sub">Logbuch für eine neue Anlage anlegen</span></span>
    ${CHEV}
  </button>
</div>
<h2 class="section-title">Datenbank</h2>
<div class="group">
  <button type="button" class="row" data-act="db">
    <span class="row-icon row-icon--blue"><span class="material-symbols-rounded" aria-hidden="true">database</span></span>
    <span class="row-text"><span class="row-title">Datenbank und PDF</span><span class="row-sub">Alle Logbücher suchen und öffnen</span></span>
    ${CHEV}
  </button>
  <button type="button" class="row" data-act="sync">
    <span class="row-icon row-icon--green"><span class="material-symbols-rounded" aria-hidden="true">sync</span></span>
    <span class="row-text"><span class="row-title">Synchronisieren</span><span class="row-sub">${pending ? 'Logbücher warten auf die Übertragung' : 'Alles ist übertragen'}</span></span>
    ${pendHtml}
    ${CHEV}
  </button>
</div>
<p class="lead-note">Jährliche Prüfung einer vorhandenen Anlage: unter „Datenbank und PDF“ die Anlage suchen und einen neuen Eintrag anlegen.</p>
${drafts.length ? `<h2 class="section-title">Logbuch in Arbeit <span class="section-count">${drafts.length}</span></h2><div class="group">${drafts.map(bookRow).join('')}</div>` : ''}
<h2 class="section-title">Logbücher <span class="section-count">${done.length}</span></h2>
${done.length ? `<div class="group">${done.map(bookRow).join('')}</div>` : '<p class="empty-note">Noch keine Logbücher. Oben ein neues Logbuch anlegen oder vorhandene aus der Datenbank laden.</p>'}`;
  },

  book() {
    const p = book();
    if (!p) {
      return '<p class="empty-note">Logbuch nicht gefunden. Zurück zur Übersicht wechseln.</p>';
    }
    const v = p.values;
    const s = summary(p);
    const draftE = p.entries.filter((e) => e.status === 'draft');
    const es = doneEntries(p).reverse();
    const kv = (k, x) =>
      `<div class="kv-item"><span class="kv-label">${esc(k)}</span><span class="kv-value">${esc(x || '–')}</span></div>`;
    const dd = s.next ? dueState(s.next) : null;
    let hero;
    if (dd) {
      const tage = Math.abs(dd.days);
      hero = `<div class="hero-caption">${dd.days < 0 ? 'Dichtheitsprüfung überfällig seit' : 'Bis zur nächsten Dichtheitsprüfung'}</div>
      <div class="hero-line"><span class="hero-value numeric">${tage} <span class="metric-unit">${tage === 1 ? 'Tag' : 'Tage'}</span></span>${chip(TON[dd.cls], fmtDate(s.next))}</div>`;
    } else {
      hero = `<div class="hero-caption">Nächste Dichtheitsprüfung</div>
      <div class="hero-line"><span class="hero-value hero-value--compact">${esc(s.next || '–')}</span>${s.next ? '' : chip('neutral', 'Noch keine Prüfung eingetragen')}</div>`;
    }
    const eintrag = (e, entwurf) => {
      const x = e.values;
      const was = [(isN(x.auf) || isN(x.ent)) && 'Kältemittel', x.art, x.erg && 'Ergänzung']
        .filter(Boolean)
        .map(esc)
        .join(', ');
      const pills = entwurf
        ? chip('orange', 'In Arbeit')
        : (x.dicht
            ? chip(x.dicht === 'erfüllt' ? 'green' : 'red', 'Dichtheit ' + x.dicht)
            : '') + (x.mang ? chip('red', 'Mangel') : '');
      const sub = [x.sk, x.zert].filter(Boolean).map(esc).join(', ');
      return `
  <div class="row proto-row">
    <button type="button" class="proto-open" data-act="${entwurf ? 'resume' : 'editentry'}" data-id="${p.id}" data-eid="${e.id}">
      <span class="row-icon row-icon--${entwurf ? 'orange' : 'blue'}"><span class="material-symbols-rounded" aria-hidden="true">${entwurf ? 'edit_note' : 'event_note'}</span></span>
      <span class="row-text">
        <span class="row-title numeric">${esc(fmtDate(x.datum) || 'Ohne Datum')}</span>
        ${sub ? `<span class="row-sub">${sub}</span>` : ''}
        ${was ? `<span class="row-sub">${was}</span>` : ''}
        ${pills ? `<span class="proto-pills">${pills}</span>` : ''}
      </span>
      ${CHEV}
    </button>
    <button type="button" class="icon-btn proto-act is-danger" data-act="delentry" data-id="${p.id}" data-eid="${e.id}" aria-label="Eintrag löschen"><span class="material-symbols-rounded" aria-hidden="true">delete</span></button>
  </div>`;
    };
    return `
<button type="button" class="back-btn" data-act="home"><span class="material-symbols-rounded" aria-hidden="true">chevron_left</span>Übersicht</button>
<section class="hero">${hero}</section>
<div class="btn-row">
  <button type="button" class="btn-primary" data-act="newentry" data-id="${p.id}"><span class="material-symbols-rounded" aria-hidden="true">add</span><span>Neuer Eintrag</span></button>
  <button type="button" class="btn-secondary" data-act="report" data-id="${p.id}"><span class="material-symbols-rounded" aria-hidden="true">picture_as_pdf</span><span>Logbuch als PDF</span></button>
</div>
<button type="button" class="btn-secondary btn-wide" data-act="editstamm" data-id="${p.id}"><span class="material-symbols-rounded" aria-hidden="true">edit</span><span>Anlagendaten bearbeiten</span></button>
<div class="count-pills">${chip(p.synced ? 'green' : 'orange', p.synced ? 'in der Datenbank' : 'nicht übertragen')}</div>
<h2 class="section-title">Anlage</h2>
<div class="kv-list">
  ${kv('Betreiber', [v.bFirma, v.bName].filter(Boolean).join(', '))}
  ${kv('Aufstellort', [v.aFirma || v.aName, v.aStr, [v.aPlz, v.aOrt].filter(Boolean).join(' ')].filter(Boolean).join(', '))}
  ${kv('Anlage', [v.herst, anlageText(v)].filter(Boolean).join(', '))}
  ${kv('Kältemittel', [v.km, isN(v.fm) && fmtNum(v.fm) + ' kg', isN(v.co2) && fmtNum(v.co2) + ' t CO₂-Äquivalent'].filter(Boolean).join(', '))}
  ${kv('Prüfintervall', v.intv)}
  ${kv('Letzte Dichtheitsprüfung', s.lastDicht ? fmtDate(s.lastDicht) + ', ' + s.lastErg : '')}
</div>
${draftE.length ? `<h2 class="section-title">Eintrag in Arbeit <span class="section-count">${draftE.length}</span></h2><div class="group">${draftE.map((e) => eintrag(e, true)).join('')}</div>` : ''}
<h2 class="section-title">Einträge <span class="section-count">${es.length}</span></h2>
${es.length ? `<div class="group">${es.map((e) => eintrag(e, false)).join('')}</div>` : '<p class="empty-note">Noch keine Einträge. Mit „Neuer Eintrag“ die erste Prüfung oder Wartung eintragen.</p>'}`;
  },

  wizard() {
    const c = ctx();
    if (!c) {
      return '<p class="empty-note">Nicht gefunden. Zurück zur Übersicht wechseln.</p>';
    }
    return wizardHtml(c, c.obj.page);
  },

  report() {
    const r = reportForView();
    if (!r) {
      return '<p class="empty-note">Logbuch nicht gefunden. Zurück zur Übersicht wechseln.</p>';
    }
    const p = !view.db && book();
    return `
<div class="btn-row">
  <span id="pdfbar" class="btn-row">${pdfBarHtml()}</span>
  ${view.db && settings.url ? `<button type="button" class="btn-secondary" data-act="drivepdf">PDF in Google Drive ablegen</button>` : ''}
</div>
${p && !p.synced ? '<p class="lead-note">' + chip('orange', 'nicht in der Datenbank') + '</p>' : ''}
<p class="lead-note">„PDF erstellen“ und „Teilen“ speichern den Bericht in Dateien oder senden ihn per Mail oder AirDrop. Das geht auch offline.</p>
<div class="sheetwrap"><div id="sheet" class="report"></div></div>`;
  },

  db() {
    const due = dbCache.list.map((e) => dueState(e.next)).filter(Boolean);
    const over = due.filter((d) => d.cls === 'bad').length;
    const soon = due.filter((d) => d.cls === 'warn').length;
    const zaehler =
      (over ? chip('red', over + ' überfällig') : '') +
      (soon ? chip('orange', soon + ' in den nächsten 60 Tagen fällig') : '');
    return `
<button type="button" class="back-btn" data-act="home"><span class="material-symbols-rounded" aria-hidden="true">chevron_left</span>Übersicht</button>
<button type="button" class="btn-primary btn-wide" data-act="dbload"><span class="material-symbols-rounded" aria-hidden="true">cloud_download</span><span>Aus Datenbank laden</span></button>
<p class="lead-note">${dbCache.at ? `Stand ${fmtDateTime(dbCache.at)}, ${dbCache.list.length} Logbücher. Zum Öffnen wird Internet benötigt.` : 'Noch nicht geladen. „Aus Datenbank laden“ ruft die Logbuchliste ab.'}</p>
<div class="segmented-control seg-block" role="group" aria-label="Sortierung">
  <button type="button" class="segmented-option" data-act="dbsort" data-v="last" aria-pressed="${view.sort !== 'due'}">Zuletzt geprüft</button>
  <button type="button" class="segmented-option" data-act="dbsort" data-v="due" aria-pressed="${view.sort === 'due'}">Nach Fälligkeit</button>
</div>
${zaehler ? `<div class="count-pills">${zaehler}</div>` : ''}
<label class="search">
  <span class="material-symbols-rounded" aria-hidden="true">search</span>
  <input id="dbsearch" type="search" placeholder="Logbuch-Nr., Betreiber, Ort, Anlage" aria-label="Datenbank durchsuchen" autocomplete="off" value="${esc(view.q || '')}">
</label>
<div id="dblist">${dbList()}</div>`;
  },
};

function bookRow(p) {
  const v = p.values;
  const s = summary(p);
  const draft = p.status === 'draft';
  const draftE = p.entries.some((e) => e.status === 'draft');
  const pills = draft
    ? chip('orange', `Schritt ${p.page + 1} von ${STAMM.pages.length}`)
    : chip('neutral', s.n === 1 ? '1 Eintrag' : s.n + ' Einträge') +
      nextChips(s) +
      (draftE ? chip('orange', 'Eintrag in Arbeit') : '') +
      chip(p.synced ? 'green' : 'orange', p.synced ? 'in der Datenbank' : 'nicht übertragen');
  const meta = esc([anlageText(v), v.aOrt || v.bOrt].filter(Boolean).join(', '));
  const sub = nextSub(s);
  const add = draft
    ? ''
    : `<button type="button" class="icon-btn proto-act" data-act="newentry" data-id="${p.id}" aria-label="Neuen Eintrag anlegen"><span class="material-symbols-rounded" aria-hidden="true">add</span></button>`;
  return `
  <div class="row proto-row">
    <button type="button" class="proto-open" data-act="${draft ? 'resume' : 'openbook'}" data-id="${p.id}">
      <span class="row-icon row-icon--${draft ? 'orange' : 'green'}"><span class="material-symbols-rounded" aria-hidden="true">${draft ? 'edit_note' : 'menu_book'}</span></span>
      <span class="row-text">
        <span class="row-title">${esc(v.projekt || 'Ohne Logbuch-Nr.')}</span>
        ${betrText(v) ? `<span class="row-sub">${esc(betrText(v))}</span>` : ''}
        ${meta ? `<span class="row-sub">${meta}</span>` : ''}
        ${!draft && sub ? `<span class="row-sub numeric">${esc(sub)}</span>` : ''}
        <span class="proto-pills">${pills}</span>
      </span>
      ${CHEV}
    </button>
    ${add}
    <button type="button" class="icon-btn proto-act is-danger" data-act="delbook" data-id="${p.id}" aria-label="Logbuch aus der App entfernen"><span class="material-symbols-rounded" aria-hidden="true">delete</span></button>
  </div>`;
}

/* Inhalt einer Formularseite */
function wizardHtml(c, i) {
  const pg = c.tpl.pages[i];
  const v = c.obj.values;
  const sichtbar = pg.fields.filter((f) => isVis(f, v) && !f.sigName);
  const allYes = pg.fields.some((f) => f.allYes && !v[f.id]);
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
        <div class="group group--form">${g.liste.map((f) => fieldHtml(f, c)).join('')}</div>`,
    )
    .join('');
  const kopf = `${pg.hint ? `<p class="lead-note">${esc(pg.hint)}</p>` : ''}${
    pg.btn
      ? `<button type="button" class="btn-secondary allok-btn" data-act="${pg.btn.act}"><span class="material-symbols-rounded" aria-hidden="true">content_copy</span><span>${esc(pg.btn.label)}</span></button>`
      : ''
  }${
    allYes
      ? '<button type="button" class="btn-secondary allok-btn" data-act="allyes"><span class="material-symbols-rounded" aria-hidden="true">done_all</span><span>Offene Prüfpunkte auf Ja setzen</span></button>'
      : ''
  }`;
  return `${pg.final ? finalWarn(c) : ''}${kopf}${abschnitte}${pg.final ? finalInfo(c) : ''}${pg.sign ? sigHtml(c) : ''}
    <div class="page-error" id="pageerr" role="alert"></div>`;
}

function fieldHtml(f, c) {
  const v = c.obj.values;
  const x = v[f.id] ?? '';
  const err = view.tried ? fieldError(f, c.obj) : '';
  const fehler = err ? ' has-error' : '';
  const hint = f.hint ? `<small class="field-hint">${esc(f.hint)}</small>` : '';
  const errHtml = err ? `<div class="ferr" role="alert">${esc(err)}</div>` : '';
  const optionen = (vals) =>
    vals
      .map(
        (o) =>
          `<button type="button" class="segmented-option" data-act="set" data-f="${f.id}" data-v="${esc(o)}" aria-pressed="${x === o}">${esc(o)}</button>`,
      )
      .join('');
  switch (f.type) {
    case 'yesno': {
      const ev = evalField(f, v);
      const warn = ev === 'bad' ? chip('orange', 'Prüfen') : '';
      return `<div class="check-main"><span class="check-label">${esc(f.label)}${hint}${warn}</span><div class="segmented-control segmented-inline" role="group" aria-label="${esc(f.label)}">${optionen(['Ja', 'Nein'])}</div></div>`;
    }
    case 'select':
      return `<div class="field"><span class="field-label" id="lab-${f.id}">${esc(f.label)}${hint}</span><div class="segmented-control" role="group" aria-labelledby="lab-${f.id}">${optionen(f.opts)}</div></div>`;
    case 'number': {
      const neg = f.min != null && f.min < 0;
      return `<div class="field${fehler}"><label class="field-label" for="in-${f.id}">${esc(f.label)}${hint}</label>
    <div class="liquid-surface-inner input-wrapper"><input class="glass-input numeric" id="in-${f.id}" data-f="${f.id}" inputmode="${neg ? 'text' : 'decimal'}" autocomplete="off" value="${esc(x)}" placeholder="${esc(f.ph || '')}">${f.unit ? `<span class="input-unit-addon">${esc(f.unit)}</span>` : ''}</div>${errHtml}</div>`;
    }
    case 'auto': {
      const datum = f.input === 'date';
      const modus = f.unit || f.id === 'gwp' ? 'decimal' : 'text';
      return `<div class="field${fehler}"><label class="field-label" for="in-${f.id}">${esc(f.label)}</label>
    <div class="liquid-surface-inner input-wrapper"><input class="glass-input numeric" id="in-${f.id}" data-f="${f.id}" ${datum ? 'type="date"' : `inputmode="${modus}" autocomplete="off"`} value="${esc(x)}" placeholder="${esc(f.ph || '')}">${f.unit ? `<span class="input-unit-addon">${esc(f.unit)}</span>` : ''}</div>
    <small class="field-hint${v['_m_' + f.id] ? ' is-manual' : ''}" id="note-${f.id}">${esc(autoNote(f, c))}</small>${errHtml}</div>`;
    }
    case 'date':
      return `<label class="field${fehler}"><span class="field-label">${esc(f.label)}${hint}</span><input class="text-input" id="in-${f.id}" type="date" data-f="${f.id}" value="${esc(x)}">${errHtml}</label>`;
    case 'longtext':
      return `<label class="field"><span class="field-label">${esc(f.label)}${hint}</span><textarea class="text-input" id="in-${f.id}" data-f="${f.id}" placeholder="${esc(f.ph || '')}">${esc(x)}</textarea></label>`;
    default:
      return `<label class="field${fehler}"><span class="field-label">${esc(f.label)}${hint}</span><input class="text-input" id="in-${f.id}" data-f="${f.id}" value="${esc(x)}" placeholder="${esc(f.ph || '')}" autocomplete="off">${errHtml}</label>`;
  }
}
function autoNote(f, c) {
  return c.obj.values['_m_' + f.id]
    ? 'Von Hand eingetragen. Feld leeren, um wieder automatisch zu berechnen.'
    : 'Automatisch: ' + (f.note ? f.note(c.obj.values, c.L) : '');
}

/* ---------- Unterschriften (Erstprüfung und jeder Eintrag): obj.sig = Bilder, obj.sigF = Datei-IDs in Google Drive ---------- */
function safeImg(src) {
  return typeof src === 'string' &&
    /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(src)
    ? src
    : '';
}
const sigOwner = () => view.eid || 'book';
function sigHtml(c) {
  const v = c.obj.values;
  const sk = view.eid ? v.sk : v.iSk;
  return `<h2 class="section-title">Unterschrift Sachkundiger${sk ? ` <span class="section-count">${esc(sk)}</span>` : ''}</h2>
<div class="sigwrap"><canvas class="sig" data-sig="sk" aria-label="Unterschrift Sachkundiger"></canvas></div>
<button type="button" class="btn-secondary" data-act="sigclear" data-sig="sk"><span class="material-symbols-rounded" aria-hidden="true">ink_eraser</span><span>Unterschrift löschen</span></button>`;
}

function initSig(canvas, obj) {
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
  const src = safeImg((obj.sig || {})[key]);
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
    obj.sig = obj.sig || {};
    obj.sig[key] = out.toDataURL('image/png');
    if (obj.sigF) delete obj.sigF[key]; // geändert → beim Übertragen neu hochladen
    save();
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
}
function initSigs() {
  const c = view.name === 'wizard' && ctx();
  if (c && c.tpl.pages[c.obj.page].sign)
    document.querySelectorAll('canvas.sig').forEach((cv) => initSig(cv, c.obj));
}
/* Antwort vom Sheet: Datei-IDs merken, Bilder von anderen Geräten übernehmen (angefangene Einträge bleiben unberührt) */
function applySigs(p, files, data) {
  const objs = { book: p };
  p.entries
    .filter((e) => e.status !== 'draft')
    .forEach((e) => {
      objs[e.id] = e;
    });
  Object.values(objs).forEach((o) => {
    o.sigF = {};
  });
  Object.keys(files || {}).forEach((key) => {
    const [owner, k] = key.split('.'),
      o = objs[owner];
    if (!o) return;
    o.sigF[k] = files[key];
    if (safeImg((data || {})[key])) {
      o.sig = o.sig || {};
      o.sig[k] = data[key];
    }
  });
}

/* Abschlussseite: Hinweis auf unvollständige Abschnitte (oben) und Übersicht des Eintrags (unten) */
function finalWarn(c) {
  const fehlend = c.tpl.pages
    .slice(0, -1)
    .map((pg, k) => [k, pageErrors(c, k)])
    .filter((x) => x[1].length);
  return fehlend.length
    ? `<div class="notice" role="status"><b>Noch unvollständig</b><ul class="notice-list">${fehlend
        .map(
          ([k, errs]) =>
            `<li><button type="button" class="jump-link" data-act="jump" data-i="${k}">${esc(c.tpl.pages[k].title)}</button>: ${errs.map((e) => esc(e[0].label)).join(', ')}</li>`,
        )
        .join('')}</ul></div>`
    : '';
}
function finalInfo(c) {
  if (!view.eid) {
    return '';
  }
  const ec = entryCols(c.obj);
  const tabs = LISTS.filter((l) => l.need.some((k) => ec[k])).map((l) => l.title);
  const mangel =
    c.obj.values.dicht === 'nicht erfüllt'
      ? '<div class="notice" role="status"><span>Dichtheitsanforderung nicht erfüllt. Undichtigkeit beheben und die Reparatur mit einer erneuten Dichtheitsprüfung, in der Regel innerhalb eines Monats, als eigenen Eintrag dokumentieren.</span></div>'
      : '';
  return `<h2 class="section-title">Dieser Eintrag erscheint im Logbuch unter <span class="section-count">${tabs.length}</span></h2>
${tabs.length ? `<div class="group group--form">${tabs.map((t) => `<div class="defect">${esc(t)}</div>`).join('')}</div>` : '<p class="empty-note">Noch nichts ausgefüllt. Mindestens Dichtheitsprüfung, Wartung, Kältemittel, Mangel oder Ergänzung eintragen.</p>'}
${mangel}`;
}

      /* @@quelle:reportParts */
      /* Tabellen des Logbuchs aus dem Blatt "Einträge": [Spalte, Überschrift, Optionen] */
      const LISTS = [
        {
          title: 'Dichtheitsprüfungen',
          ref: 'VO (EU) 2024/573',
          need: ['Dichtheitsanforderung'],
          cols: [
            ['Datum', 'Datum', { w: 14, date: 1 }],
            ['Dichtheitsanforderung', 'Ergebnis', { w: 17, pill: 1 }],
            ['Prüfmethode', 'Prüfmethode'],
            ['Sachkundiger', 'Sachkundiger / Zert.-Nr.', { w: 23, sub: 'Zertifikatsnummer' }],
            ['Nächste Dichtheitsprüfung fällig', 'Nächste fällig', { w: 14 }],
          ],
        },
        {
          title: 'Prüfung, Wartung und Instandhaltung',
          ref: 'DIN EN 378',
          need: ['Art der Arbeit', 'Bericht'],
          cols: [
            ['Datum', 'Datum', { w: 14, date: 1 }],
            ['Art der Arbeit', 'Art', { w: 20 }],
            ['Bericht', 'Bericht'],
            ['Sachkundiger', 'Sachkundiger', { w: 16 }],
          ],
        },
        {
          title: 'Kältemittel',
          need: [
            'Kältemittel Zustand',
            'Kältemittel entsorgt (kg)',
            'Kältemittel aufgefüllt (kg)',
            'Grund (Kältemittel)',
          ],
          leak: true,
          cols: [
            ['Datum', 'Datum', { w: 14, date: 1 }],
            ['Kältemittel', 'Kältemittel', { w: 12 }],
            ['Kältemittel Zustand', 'Zustand', { w: 12 }],
            ['Kältemittel entsorgt (kg)', 'Entsorgt (kg)', { w: 11, num: 1 }],
            ['Kältemittel aufgefüllt (kg)', 'Aufgefüllt (kg)', { w: 12, num: 1 }],
            ['Grund (Kältemittel)', 'Grund'],
            ['Sachkundiger', 'Sachkundiger', { w: 15 }],
          ],
        },
        {
          title: 'Festgestellte Mängel',
          need: ['Festgestellter Mangel', 'Maßnahmen zur Behebung'],
          cols: [
            ['Datum', 'Datum', { w: 14, date: 1 }],
            ['Festgestellter Mangel', 'Mangel'],
            ['Maßnahmen zur Behebung', 'Maßnahme zur Behebung'],
            ['Sachkundiger', 'Sachkundiger', { w: 16 }],
          ],
        },
        {
          title: 'Ergänzungen durch den Anlagenprüfer',
          need: ['Zusätzliche Ergänzung'],
          cols: [
            ['Datum', 'Datum', { w: 14, date: 1 }],
            ['Zusätzliche Ergänzung', 'Text'],
            ['Sachkundiger', 'Sachkundiger', { w: 16 }],
          ],
        },
      ];
      /* Fälligkeit: grün = noch Zeit, gelb = in höchstens 60 Tagen, rot = überfällig */
      function dueState(iso) {
        const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!m) return null;
        const t = new Date();
        t.setHours(12, 0, 0, 0);
        const days = Math.round((new Date(+m[1], +m[2] - 1, +m[3], 12) - t) / 864e5),
          tg = (n) => (n === 1 ? 'Tag' : 'Tagen');
        if (days < 0) return { cls: 'bad', days, text: `überfällig seit ${-days} ${tg(-days)}` };
        if (days === 0) return { cls: 'warn', days, text: 'heute fällig' };
        return { cls: days <= 60 ? 'warn' : 'ok', days, text: `fällig in ${days} ${tg(days)}` };
      }
      /* Bausteine des Berichts: Kopf, Fußzeile und Blöcke (Tabellen-Blöcke dürfen über Seiten umbrechen).
   Die HTML-Bausteine kommen aus shared/pdf-bausteine.js (pdfBausteine()), das CSS aus shared/pdf.css. */
      function reportParts(r) {
        const B = pdfBausteine(),
          { esc, nl, up, icon, pill } = B;
        const deNum = (s) =>
          Number(
            String(s ?? '')
              .trim()
              .replace(',', '.'),
          );
        const fmt = (n) => String(Math.round(n * 1000) / 1000).replace('.', ',');
        const img = (s) =>
          typeof s === 'string' && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(s)
            ? `<img src="${s}" alt="">`
            : '';
        const st = r.status || {},
          sh = r.short || {};
        const stand = r.stand
          ? new Date(r.stand).toLocaleDateString('de-DE', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })
          : '';
        const blocks = [];

        // Status-Kacheln
        const due = dueState(st.nextIso);
        const lastOk = st.lastErg === 'erfüllt',
          lastBad = st.lastErg === 'nicht erfüllt';
        blocks.push({
          html: B.kacheln(
            [
              {
                art: 'primary',
                lab: 'Nächste Dichtheitsprüfung',
                val: st.next,
                subHtml: due
                  ? pill(due.cls, due.text, due.cls === 'bad' ? 'bad' : 'clock')
                  : st.next
                    ? ''
                    : 'noch keine Dichtheitsprüfung eingetragen',
              },
              {
                lab: 'Letzte Dichtheitsprüfung',
                val: st.lastDicht,
                subHtml: lastOk
                  ? pill('ok', 'Dichtheit erfüllt')
                  : lastBad
                    ? pill('bad', 'nicht erfüllt')
                    : '',
              },
              {
                lab: 'Prüfpflicht',
                val: st.co2 ? st.co2 + ' t CO₂e' : '',
                sub: [st.intv && 'Intervall ' + st.intv, [st.km, st.fm].filter(Boolean).join(', ')]
                  .filter(Boolean)
                  .join(' · '),
              },
            ],
            { links: true },
          ),
        });

        // Stammdaten-Abschnitte
        const secs = r.sections || [];
        const val = (s, label) => {
          const x = (s.rows || []).find((z) => z.label === label);
          return x ? x.value : '';
        };
        for (let i = 0; i < secs.length; i++) {
          const s = secs[i];
          if (s.kind === 'addr') {
            const group = [s];
            while (secs[i + 1] && secs[i + 1].kind === 'addr') group.push(secs[++i]);
            const card = (a) => {
              const lines = [
                val(a, 'Firma') && `<b>${esc(val(a, 'Firma'))}</b>`,
                esc(val(a, 'Name')),
                esc(val(a, 'Straße')),
                esc([val(a, 'PLZ'), val(a, 'Ort')].filter(Boolean).join(' ')),
              ].filter(Boolean);
              return `<div class="card"><h3>${up(a.title)}</h3><div class="addr">${lines.join('<br>') || '<span style="color:#9a9999">—</span>'}</div></div>`;
            };
            blocks.push({
              html: B.abschnitt(
                group.map((a) => a.title).join(' und '),
                `<div class="cols2">${group.map(card).join('')}</div>`,
              ),
            });
          } else if (s.kind === 'check') {
            const groups = [
              ['Systematische Prüfung', ''],
              ['Indirekte Messmethode', 'Indirekt '],
              ['Direkte Messmethode', 'Direkt '],
            ];
            const groupOf = (l) =>
              l.startsWith('Indirekt ') ? 1 : l.startsWith('Direkt ') ? 2 : 0;
            const items = groups.map(() => []);
            const noIcon = () => icon('na', 12, '#9a9999');
            (s.checks || []).forEach((x) => {
              const g = groupOf(x.label),
                label = x.label.slice(groups[g][1].length);
              const k =
                x.value === 'Ja'
                  ? x.eval === 'bad'
                    ? 'bad'
                    : 'ok'
                  : x.value === 'Nein' && x.eval === 'ok'
                    ? 'ok'
                    : 'no';
              items[g].push(
                `<div class="citem">${k === 'no' ? noIcon() : icon(k, 12)}<span class="t">${esc(label)}</span><span class="a">${esc(x.value || '—')}</span></div>`,
              );
            });
            const sign = [];
            (s.rows || []).forEach((x) => {
              if (x.label.startsWith('Direkt ')) {
                if (x.value)
                  items[2].push(
                    `<div class="citem">${noIcon()}<span class="t">${esc(x.label.slice(7))}: ${esc(x.value)}</span></div>`,
                  );
              } else if (x.label !== 'Name Betreiber')
                sign.push(`<span>${esc(x.label)} <b>${esc(x.value || '—')}</b></span>`);
            });
            // gezeichnete Unterschriften der Erstprüfung (eigene kompakte Darstellung .sigbox, Aussehen bleibt wie bisher)
            const sg = s.sign || {},
              cap = (who, name) =>
                `<div class="cap">${esc(who)}${name ? ' · ' + esc(name) : ''}</div>`;
            // Betreiber-Unterschrift wird in der App nicht mehr erfasst, aber bei älteren Einträgen weiter angezeigt
            const sigBox =
              img(sg.sk) || img(sg.betr)
                ? `<div class="sigbox">
        <div><div class="img">${img(sg.sk)}</div>${cap('Unterschrift Sachkundiger', val(s, 'Sachkundiger'))}</div>
        ${img(sg.betr) ? `<div><div class="img">${img(sg.betr)}</div>${cap('Unterschrift Betreiber', val(s, 'Name Betreiber'))}</div>` : ''}</div>`
                : '';
            blocks.push({
              html: B.abschnitt(
                s.title,
                `<div class="checks">${groups.map((g, k) => `<div class="cgroup"><h4>${up(g[0])}</h4>${items[k].join('') || '<div class="none">—</div>'}</div>`).join('')}</div>
        ${sign.length ? `<div class="signoff">${sign.join('')}</div>` : ''}${sigBox}`,
              ),
            });
          } else {
            blocks.push({ html: B.abschnitt(s.title, B.kv(s.rows || [])) });
          }
        }

        // Tabellen der Einträge (umbrechbar, Kopf wird auf jeder Seite wiederholt)
        const es = (r.entries || [])
          .slice()
          .sort((a, b) => String(a._iso).localeCompare(String(b._iso)));
        LISTS.forEach((l) => {
          const rows = es.filter((e) => l.need.some((k) => String(e[k] ?? '').trim() !== ''));
          if (!rows.length) {
            blocks.push({
              html: B.abschnitt(l.title, '<div class="none">Keine Einträge</div>', { ref: l.ref }),
            });
            return;
          }
          const cell = (e, c) => {
            const o = c[2] || {},
              x = e[c[0]] || '';
            if (o.pill && x)
              return {
                html:
                  x === 'erfüllt' ? pill('ok', x) : x === 'nicht erfüllt' ? pill('bad', x) : esc(x),
              };
            return {
              html: `${x ? nl(x) : '—'}${o.sub && e[o.sub] ? `<span class="small">${esc(e[o.sub])}</span>` : ''}`,
              cls: o.date ? 'date' : o.num ? 'num' : '',
            };
          };
          blocks.push(
            B.tabelle({
              titel: l.title,
              ref: l.ref,
              head: l.cols.map((c) => ({
                t: c[1],
                w: c[2] && c[2].w ? c[2].w + '%' : '',
                num: c[2] && c[2].num,
              })),
              rows: rows.map((e) => l.cols.map((c) => cell(e, c))),
            }),
          );
          if (l.leak) {
            const fg = deNum(r.fg),
              years = {};
            es.forEach((e) => {
              const a = deNum(e['Kältemittel aufgefüllt (kg)']),
                y = String(e._iso || '').slice(0, 4);
              if (a > 0 && y) years[y] = (years[y] || 0) + a;
            });
            const ys = Object.keys(years).sort();
            if (ys.length)
              blocks.push({
                html: `<div class="leak"><b>Leckrate je Jahr</b><span>(ChemKlimaschutzV § 3, aufgefüllte Menge ÷ Füllgewicht${fg > 0 ? ' ' + fmt(fg) + ' kg' : ''}):</span>${ys
                  .map(
                    (y) =>
                      `<span>${y}: ${fmt(years[y])} kg ${fg > 0 ? `<span class="pill warn">${String(Math.round((years[y] / fg) * 1000) / 10).replace('.', ',')} %</span>` : ''}</span>`,
                  )
                  .join('')}</div>`,
              });
          }
        });

        // Unterschriften zu den Einträgen (nur unterschriebene Termine)
        const signed = es.filter((e) => e._sig && (img(e._sig.sk) || img(e._sig.betr)));
        const withBetr = signed.some((e) => img(e._sig.betr)); // Spalte „Betreiber“ nur, wenn ein älterer Eintrag eine Betreiber-Unterschrift hat
        if (signed.length)
          blocks.push(
            B.tabelle({
              titel: 'Unterschriften zu den Einträgen',
              head: [{ t: 'Datum', w: '14%' }, 'Sachkundiger'].concat(
                withBetr ? ['Betreiber'] : [],
              ),
              rows: signed.map((e) =>
                [
                  { t: e['Datum'] || '—', cls: 'date' },
                  {
                    html: `${img(e._sig.sk)}<span class="small">${esc(e['Sachkundiger'] || '')}</span>`,
                    cls: 'sigc',
                  },
                ].concat(
                  withBetr
                    ? [
                        {
                          html: `${img(e._sig.betr)}<span class="small">${img(e._sig.betr) ? esc(e['Name Betreiber'] || '') : ''}</span>`,
                          cls: 'sigc',
                        },
                      ]
                    : [],
                ),
              ),
            }),
          );

        if (r.remark)
          blocks.push({ html: B.notiz({ titel: 'Bemerkungen zur Anlage', text: r.remark }) });
        if (r.hinweis && r.hinweis.length)
          blocks.push({
            html: B.rechtstext(
              r.hinweis.map((t) => {
                const k = t.indexOf(': ');
                return k > 0 && k < 80 ? { titel: t.slice(0, k) + '.', text: t.slice(k + 2) } : t;
              }),
            ),
          });

        return {
          blocks,
          head: B.kopf({
            firma: r.firma,
            kicker: 'Anlagenlogbuch',
            titel: r.title,
            nrLabel: 'Logbuch-Nr.',
            id: r.id,
            datum: stand,
            datumLabel: 'Stand',
            untertitel: r.subtitle,
            untertitelUnten: true,
          }),
          smallHead: B.kopfKlein({
            firma: r.firma,
            zeile: [sh.betreiber, sh.anlage].filter(Boolean).join(' · '),
            titel: r.title,
            nrLabel: 'Logbuch-Nr.',
            id: r.id,
          }),
          foot: B.fuss({ text: r.title, stand: stand ? 'Stand ' + stand : '' }),
          id: esc(r.id),
        };
      }
      /* @@ende */

function reportForView() {
  if (view.db) return view.rep;
  const p = book();
  return p ? buildReport(p) : null;
}
