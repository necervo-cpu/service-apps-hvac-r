// Ansichten: Navigation, Übersicht, Einstellungen, Formularseiten, Ergebnis.
'use strict';

/* ---------- Navigation ---------- */
let view = { name: 'home' };
let pdfBusy = null,
  pdfProg = 0,
  pdfTick = null,
  hsubAnim = null,
  lastPk = '';
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
  if (name === 'wizard' && was !== 'wizard') calcSeen = {};
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
  return calcs.find((p) => p.id === view.id);
}
function render() {
  app.innerHTML = (Views[view.name] || Views.home)();
  const wiz = view.name === 'wizard' && cur();
  if (wiz) {
    const pk = view.id + ':' + wiz.page;
    if (pk !== lastPk) {
      lastPk = pk;
      Object.keys(calcSeen).forEach((k) => {
        if (k.indexOf(':res') > 0) delete calcSeen[k];
      });
    }
  }
  document.body.classList.toggle('in-wizard', view.name === 'wizard');
  setHeader(true);
  setSteps();
  setBar();
  if (wiz) live();
  if (view.name === 'report') showReport();
  updateNet();
  nachRender();
}

/* Gesamtpreis im Kopf, F-Gase-Status und Automatik-Werte aktualisieren, ohne das Eingabefeld neu aufzubauen */
function live() {
  const p = cur();
  if (!p) return;
  const k = calc(p);
  const hb = $('#heroBrutto');
  if (hb) {
    const bt = de(k.brutto, 2);
    if (hb.dataset.t !== bt) {
      hb.dataset.t = bt;
      hb.innerHTML = `${bt} <span class="metric-unit">€ brutto</span>`;
    }
    calcTouch('sumb', bt, hb);
    const hn = $('#heroNote');
    if (hn)
      hn.textContent = `Netto ${eur(k.netto)}, Arbeitszeit ${hrs(k.minTech + k.dauer * k.nH)}`;
  }
  document.querySelectorAll('input[data-f]').forEach((el) => {
    if (el === document.activeElement || el.dataset.other) return;
    const x = p.values[el.dataset.f] ?? '';
    if (el.value !== x) el.value = x;
  });
  document.querySelectorAll('.auto[data-hint]').forEach((el) => {
    const h = autoLine(p, el.id.slice(5), el.dataset.hint);
    if (el.innerHTML !== h) el.innerHTML = h;
  });
  const fb = $('#fgasbox');
  if (fb) fb.outerHTML = fgasHtml(k.pr);
  const rs = $('#result');
  if (rs) {
    rs.innerHTML = resultHtml(p, k);
    rs.querySelectorAll('.info-row-value').forEach((el, i) =>
      calcTouch('res' + i, el.textContent, el),
    );
  }
}

/* Inhalt einer Formularseite */
function wizardHtml(p, i) {
  return Pages[i](p);
}

/* ---------- Ansichten ---------- */
const Views = {
  home() {
    const drafts = calcs.filter((p) => p.status === 'draft');
    const done = calcs
      .filter((p) => p.status === 'done')
      .sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)));
    const pending = done.filter((p) => !p.synced).length;
    const chev =
      '<span class="material-symbols-rounded row-chevron" aria-hidden="true">chevron_right</span>';
    const zeile = (act, icon, farbe, titel, sub, extra) => `
  <button type="button" class="row" data-act="${act}">
    <span class="row-icon row-icon--${farbe}"><span class="material-symbols-rounded" aria-hidden="true">${icon}</span></span>
    <span class="row-text"><span class="row-title">${titel}</span><span class="row-sub">${sub}</span></span>
    ${extra || ''}${chev}
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
    ? '<div class="notice"><span>Noch keine Verbindung zur Datenbank eingerichtet. Kalkulationen bleiben lokal gespeichert, gerechnet wird mit den Standard-Stammdaten, bis die Web-App-URL in den Einstellungen steht.</span><button type="button" class="btn-secondary" data-act="settings">Einstellungen öffnen</button></div>'
    : ''
}
<h2 class="section-title">Kalkulation</h2>
<div class="group">${zeile('new', 'add_circle', 'blue', 'Neue Kalkulation', 'Angaben erfassen und Preis berechnen')}
</div>
<h2 class="section-title">Datenbank</h2>
<div class="group">
  ${zeile('db', 'database', 'blue', 'Datenbank und PDF', 'Gespeicherte Kalkulationen')}
  ${zeile('sync', 'sync', 'green', 'Synchronisieren', pending ? 'Kalkulationen warten auf die Übertragung' : 'Alles ist übertragen', pendHtml)}
</div>
<h2 class="section-title">Hilfe</h2>
<div class="group">
  ${zeile('fragen', 'help', 'cyan', 'Fragen an den Kunden', 'Vor dem Termin klären')}
  ${zeile('info', 'info', 'cyan', 'Info', 'Anleitung und Rechenregeln')}
</div>
<h2 class="section-title">Offene Kalkulationen <span class="section-count">${drafts.length}</span></h2>
${drafts.length ? `<div class="group">${drafts.map(calcCard).join('')}</div>` : '<p class="empty-note">Keine offene Kalkulation. Oben eine neue Kalkulation anlegen.</p>'}
<h2 class="section-title">Abgeschlossen <span class="section-count">${done.length}</span></h2>
${done.length ? `<div class="group">${done.map(calcCard).join('')}</div>` : '<p class="empty-note">Noch keine abgeschlossene Kalkulation. Sie erscheint hier nach dem Abschließen.</p>'}`;
  },

  wizard() {
    const p = cur();
    if (!p)
      return '<p class="empty-note">Kalkulation nicht gefunden. Zurück zur Übersicht wechseln.</p>';
    return wizardHtml(p, p.page);
  },

  report() {
    const r = reportForView();
    if (!r)
      return '<p class="empty-note">Kalkulation nicht gefunden. Zurück zur Übersicht wechseln.</p>';
    const p = !view.db && calcs.find((x) => x.id === view.id);
    const knoepfe = [
      `<span id="pdfbar" class="pdfbar">${pdfBarHtml()}</span>`,
      view.db && settings.url
        ? '<button type="button" class="btn-secondary" data-act="drivepdf">PDF in Google Drive ablegen</button>'
        : '',
      p
        ? `<button type="button" class="btn-secondary" data-act="reopen" data-id="${p.id}">Bearbeiten</button>`
        : '',
    ].join('');
    return `
<div class="btn-row">${knoepfe}</div>
${p && !p.synced ? '<p class="lead-note"><span class="status-pill status-pill--orange">nicht in der Datenbank</span></p>' : ''}
<p class="lead-note">„PDF erstellen“ und „Teilen“ speichern den Bericht in Dateien oder senden ihn per Mail oder AirDrop. Das geht auch offline.</p>
<div class="sheetwrap"><div id="sheet" class="report"></div></div>`;
  },

  db() {
    return `
<button type="button" class="back-btn" data-act="home"><span class="material-symbols-rounded" aria-hidden="true">chevron_left</span>Übersicht</button>
<button type="button" class="btn-primary btn-wide" data-act="dbload"><span class="material-symbols-rounded" aria-hidden="true">cloud_download</span><span>Aus Datenbank laden</span></button>
<p class="lead-note">${dbCache.at ? `Stand ${fmtDateTime(dbCache.at)}, ${dbCache.list.length} Einträge. Zum Öffnen einer Kalkulation wird Internet benötigt.` : 'Noch nicht geladen. „Aus Datenbank laden“ ruft die Kalkulationsliste ab.'}</p>
<label class="search">
  <span class="material-symbols-rounded" aria-hidden="true">search</span>
  <input id="dbsearch" type="search" placeholder="Projekt-Nr., Kunde, Standort, Datum" aria-label="Datenbank durchsuchen" autocomplete="off" value="${esc(view.q || '')}">
</label>
<div id="dblist">${dbList()}</div>`;
  },

  fragen() {
    return `
<button type="button" class="back-btn" data-act="home"><span class="material-symbols-rounded" aria-hidden="true">chevron_left</span>Übersicht</button>
<p class="lead-note">Gesprächsleitfaden für Telefon oder Mail, damit alle Angaben für eine genaue Kalkulation vorliegen.</p>
${C.fragen.map((g) => `<h2 class="section-title">${esc(g.h)}</h2><ul class="prose-list">${g.items.map((x) => `<li>${x}</li>`).join('')}</ul>`).join('')}`;
  },

  info() {
    const S = stammNow();
    return `
<button type="button" class="back-btn" data-act="home"><span class="material-symbols-rounded" aria-hidden="true">chevron_left</span>Übersicht</button>
<h2 class="section-title">Zweck</h2>
<p class="prose">${esc(C.zweck)}</p>
<h2 class="section-title">So wird gerechnet</h2>
<ul class="prose-list">
  <li><b>Arbeitszeit:</b> Anzahl × Richtzeit je Gerät (Stammdaten), plus Dichtheitsprüfung je Kältekreis, wenn sie Pflicht ist.</li>
  <li><b>Team:</b> Die Richtzeiten ergeben die Einsatzdauer vor Ort. Jeder Servicetechniker und jeder Helfer / Azubi ist den ganzen Einsatz dabei und wird für die volle Einsatzdauer berechnet – 2 Techniker kosten also doppelt so viel Lohn wie einer.</li>
  <li><b>Material:</b> Reinigungsmittel usw. werden aus den Gerätezahlen vorgeschlagen. Sobald du einen Wert selbst änderst, bleibt er stehen („von Hand“), bis du „wieder automatisch“ antippst.</li>
  <li><b>F-Gase (EU 2024/573):</b> Prüfpflicht ab 5 t CO₂-Äquivalent je Kreis, bei hermetisch geschlossenen Anlagen ab 10 t. Intervall 12 / 6 / 3 Monate ab 5 / 50 / 500 t, mit Leckage-Erkennungssystem doppelt so lang.</li>
  <li><b>Preis:</b> Lohn + Material + Anfahrt + Erschwernis + Sonderposition = netto, zzgl. ${fmtNum(S.mwst)} % MwSt.</li>
</ul>
<h2 class="section-title">Stammdaten</h2>
<p class="prose">Stundensätze, Richtzeiten und Preise stehen in der Datenbank unter <b>„Stammdaten“</b> und gelten für alle Geräte. Ändern lassen sie sich dort oder in der App unter Einstellungen im Bereich Stammdaten über <b>In Datenbank speichern</b>. Jede Kalkulation merkt sich die Werte, mit denen sie begonnen wurde. Ändern sich die Stammdaten später, zeigt die Seite „Ergebnis“ einen Knopf zum Übernehmen.</p>
<h2 class="section-title">PDF</h2>
<p class="prose">Auf der Seite „Ergebnis“ lässt sich <b>Pauschalangebot</b> einschalten: Dann blendet das PDF Arbeitszeiten und Einzelpreise aus und heißt „Angebot“. Ohne Schalter entsteht die interne Kalkulation mit allen Zeiten und Preisen.</p>
<p class="lead-note">Entwickelt für die Praxis, © C. Geuther</p>`;
  },
};

/* Nach Stammdaten laden/speichern: App neu zeichnen und, falls die Einstellungen offen sind, deren Inhalt auffrischen (Bildlauf bleibt) */
function renderSettings() {
  render();
  if (modalPanel === 'settings') {
    const card = $('#modalHost .modal-card');
    const y = card ? card.scrollTop : 0;
    $('#settingsBody').innerHTML = settingsBody();
    syncThemeUi();
    updateUi();
    nachRender();
    if (card) card.scrollTop = y;
  }
}

function settingsBody() {
  const S = stammNow();
  const feld = (id, label, wert, ph, extra) => `
    <div class="form-group">
      <label class="form-label" for="${id}">${esc(label)}</label>
      <div class="field-box"><input class="text-input" id="${id}" type="text" value="${esc(wert)}" placeholder="${esc(ph || '')}" ${extra || ''} autocomplete="off"></div>
    </div>`;
  return `
<div class="form-group">
  <div class="card-title">Darstellung</div>
  <div class="segmented-control" id="themeSegment" role="group" aria-label="Darstellung">
    <button type="button" class="segmented-option" data-theme-choice="light" aria-pressed="false">Hell</button>
    <button type="button" class="segmented-option" data-theme-choice="dark" aria-pressed="false">Dunkel</button>
    <button type="button" class="segmented-option" data-theme-choice="system" aria-pressed="false">System</button>
  </div>
</div>

<div class="form-group">
  <div class="card-title">Datenbank-Verbindung</div>
  ${feld('s_url', 'Web-App-URL aus Apps Script', settings.url, 'https://script.google.com/macros/s/…/exec', 'autocapitalize="off" autocorrect="off"')}
  ${feld('s_token', 'Token (wie TOKEN im Apps Script)', settings.token, '', 'autocapitalize="off" autocorrect="off"')}
</div>

<div class="form-group">
  <div class="card-title">Allgemein</div>
  <label class="form-label" for="s_firma">Firmenkopf im PDF (mehrzeilig möglich)</label>
  <div class="field-box"><textarea class="text-input" id="s_firma" rows="3" placeholder="Firmenname, Straße, PLZ Ort, Telefon">${esc(settings.firma)}</textarea></div>
  ${feld('s_tech', 'Erstellt von (Vorbelegung)', settings.techniker, 'C. Geuther')}
</div>

<div class="modal-actions">
  <button type="button" class="btn-primary" data-act="savesettings">
    <span class="material-symbols-rounded" aria-hidden="true">check_circle</span>
    <span>Einstellungen speichern</span>
  </button>
  <button type="button" class="btn-secondary" data-act="ping">
    <span class="material-symbols-rounded" aria-hidden="true">cloud_sync</span>
    <span>Speichern und Verbindung testen</span>
  </button>
</div>

<div class="form-group">
  <div class="card-title">Stammdaten</div>
  <p class="modal-text">${stammCache.at ? `Aus der Datenbank, Stand ${fmtDateTime(stammCache.at)}.` : 'Noch nicht aus der Datenbank geladen, es gelten die Standardwerte.'} Änderungen hier gelten nach „In Datenbank speichern“ für alle Geräte (Internet nötig). Angefangene Kalkulationen behalten ihre Werte, bis man sie auf der Seite „Ergebnis“ übernimmt.</p>
  <div class="group group--form">
  ${C.stamm
    .map((s) =>
      typeof s.def === 'number'
        ? `<label class="meas-row" for="st-${s.key}"><span class="meas-label">${esc(s.label)}</span><span class="vwrap"><input class="value-input numeric" id="st-${s.key}" data-stamm="${s.key}" inputmode="decimal" autocomplete="off" value="${esc(fmtNum(S[s.key]))}"><span class="input-unit-addon">${esc(s.unit)}</span></span></label>`
        : `<div class="field"><label class="field-label" for="st-${s.key}">${esc(s.label)}</label><div class="field-box"><textarea class="text-input" id="st-${s.key}" data-stamm="${s.key}">${esc(S[s.key])}</textarea></div></div>`,
    )
    .join('')}
  </div>
  <div class="ferr" id="stammerr" role="alert"></div>
  <div class="modal-actions">
    <button type="button" class="btn-secondary" data-act="stammsave">In Datenbank speichern</button>
    <button type="button" class="btn-secondary" data-act="stammload">Stammdaten aus Datenbank laden</button>
  </div>
</div>

<div class="form-group">
  <div class="card-title">Datensicherung</div>
  <p class="modal-text">Sichert alle Kalkulationen der App als JSON-Datei.</p>
  <div class="modal-actions">
    <button type="button" class="btn-secondary" data-act="backup">
      <span class="material-symbols-rounded" aria-hidden="true">download</span>
      <span>Backup exportieren</span>
    </button>
    <label class="btn-secondary" for="s_import">
      <span class="material-symbols-rounded" aria-hidden="true">upload</span>
      <span>Backup importieren</span>
    </label>
    <input type="file" id="s_import" accept=".json,application/json" hidden />
  </div>
</div>

<div>
  <div class="card-title">App-Info und Updates</div>
  <div class="info-list">
    <div class="info-row">
      <span class="info-row-label">Installierte Version</span>
      <span class="info-row-value numeric"><span class="status-pill status-pill--green" id="app-version-label">v${esc(APP_VERSION)}</span></span>
    </div>
    <div class="info-row">
      <span class="info-row-label">Build-Datum</span>
      <span class="info-row-value numeric">${esc(BUILD_DATE)}</span>
    </div>
    <div class="info-row" id="updateRow" hidden>
      <span class="info-row-label">Neue Version</span>
      <span class="info-row-value numeric" id="updateRemote"></span>
    </div>
  </div>
</div>

<div class="modal-actions">
  <button type="button" class="btn-primary" data-act="checkupdate">
    <span class="material-symbols-rounded" aria-hidden="true">sync</span>
    <span>Nach Updates suchen</span>
  </button>
  <button type="button" class="btn-secondary" data-act="forcereload">
    <span class="material-symbols-rounded" aria-hidden="true">cleaning_services</span>
    <span>Cache leeren und neu laden</span>
  </button>
</div>`;
}

function calcCard(p) {
  const v = p.values,
    k = calc(p);
  const pill = (ton, text) =>
    `<span class="status-pill status-pill--${ton}">${esc(text)}</span>`;
  const badges =
    p.status === 'draft'
      ? pill('orange', `Schritt ${p.page + 1} von ${PAGES.length}`)
      : `${v.pauschal === 'Ja' ? pill('neutral', 'Angebot') : ''}${pill(p.synced ? 'green' : 'orange', p.synced ? 'in der Datenbank' : 'nicht übertragen')}`;
  const meta = [fmtDate(v.datum), v.standort, 'brutto ' + eur(k.brutto)]
    .filter(Boolean)
    .map(esc)
    .join(', ');
  const open =
    p.status === 'draft'
      ? `data-act="resume" data-id="${p.id}"`
      : `data-act="report" data-id="${p.id}"`;
  const icon = p.status === 'draft' ? 'edit_note' : 'task_alt';
  const farbe = p.status === 'draft' ? 'orange' : 'green';
  const aktion = (act, sym, label, cls) =>
    `<button type="button" class="icon-btn proto-act${cls ? ' ' + cls : ''}" data-act="${act}" data-id="${p.id}" aria-label="${label}"><span class="material-symbols-rounded" aria-hidden="true">${sym}</span></button>`;
  return `
  <div class="row proto-row">
    <button type="button" class="proto-open" ${open}>
      <span class="row-icon row-icon--${farbe}"><span class="material-symbols-rounded" aria-hidden="true">${icon}</span></span>
      <span class="row-text">
        <span class="row-title">${esc(v.projekt || 'Ohne Projektnummer')}</span>
        ${v.kunde ? `<span class="row-sub">${esc(v.kunde)}</span>` : ''}
        ${meta ? `<span class="row-sub numeric">${meta}</span>` : ''}
        <span class="proto-pills">${badges}</span>
      </span>
    </button>
    ${p.status === 'draft' ? '' : aktion('reopen', 'edit', 'Kalkulation bearbeiten')}
    ${aktion('copy', 'content_copy', 'Kalkulation kopieren')}
    ${aktion('del', 'delete', 'Kalkulation löschen', 'is-danger')}
  </div>`;
}

function dbList() {
  const q = (view.q || '').toLowerCase().trim();
  const list = dbCache.list
    .filter(
      (e) =>
        !q ||
        [e.projekt, e.kunde, e.standort, e.bearbeiter, e.datum, fmtDate(e.datum)]
          .join(' ')
          .toLowerCase()
          .includes(q),
    )
    .sort((a, b) => String(b.datum).localeCompare(String(a.datum)));
  if (!list.length)
    return `<p class="empty-note">${dbCache.list.length ? 'Keine Treffer. Suchbegriff ändern oder leeren.' : 'Keine Daten. „Aus Datenbank laden“ ruft die Kalkulationsliste ab.'}</p>`;
  const zeilen = list
    .map((e) => {
      const unter = [e.standort, e.bearbeiter].filter(Boolean).map(esc).join(', ');
      const pdf = e.pdfUrl
        ? `<a class="proto-open" href="${esc(e.pdfUrl)}" target="_blank" rel="noopener">`
        : `<button type="button" class="proto-open" data-act="dbreport" data-key="${esc(e.key)}">`;
      const pdfEnde = e.pdfUrl ? '</a>' : '</button>';
      return `
  <div class="row proto-row">
    ${pdf}
      <span class="row-icon row-icon--blue"><span class="material-symbols-rounded" aria-hidden="true">description</span></span>
      <span class="row-text">
        <span class="row-title">${esc(e.projekt || '–')}${e.kunde ? ', ' + esc(e.kunde) : ''}</span>
        <span class="row-sub numeric">${esc([fmtDate(e.datum), isN(e.brutto) ? eur(num(e.brutto)) : ''].filter(Boolean).join(', '))}</span>
        ${unter ? `<span class="row-sub">${unter}</span>` : ''}
        ${e.pauschal === 'Ja' ? '<span class="proto-pills"><span class="status-pill status-pill--neutral">Angebot</span></span>' : ''}
      </span>
      <span class="material-symbols-rounded row-chevron" aria-hidden="true">chevron_right</span>
    ${pdfEnde}
    <button type="button" class="icon-btn proto-act" data-act="dbedit" data-key="${esc(e.key)}" aria-label="Kalkulation bearbeiten"><span class="material-symbols-rounded" aria-hidden="true">edit</span></button>
  </div>`;
    })
    .join('');
  return `<div class="group">${zeilen}</div>`;
}

/* ---------- Eingabefelder ---------- */
function textField(p, id, label, ph, hint) {
  return `<label class="field"><span class="field-label">${esc(label)}${hint ? `<small class="field-hint">${esc(hint)}</small>` : ''}</span>
    <span class="field-box"><input class="text-input" id="in-${id}" data-f="${id}" value="${esc(p.values[id] ?? '')}" placeholder="${esc(ph || '')}" autocomplete="off"></span></label>`;
}
function stepField(p, id, label, unit, opt) {
  opt = opt || {};
  const autoTxt = opt.autoHint
    ? `<div class="meas-notes auto" id="auto-${id}" data-hint="${esc(opt.autoHint)}">${autoLine(p, id, opt.autoHint)}</div>`
    : '';
  // Schritt je Plus/Minus: Stückzahlen 1, Liter 0,25, Kilogramm 0,5, Euro 5 (config.js kann pro Position `step` setzen)
  const pos = POSBY[id];
  const schritt =
    opt.step ?? (pos && pos.step) ?? (unit === 'L' ? 0.25 : unit === 'kg' ? 0.5 : /^€/.test(unit || '') ? 5 : 1);
  const knopf = (richtung, symbol, text) =>
    opt.noStep
      ? ''
      : `<button type="button" class="stepper" data-act="step" data-f="${id}" data-dir="${richtung}" data-step="${schritt}" data-base="${esc(opt.ph ?? '0')}" aria-label="${esc(label)} ${text}"><span class="material-symbols-rounded" aria-hidden="true">${symbol}</span></button>`;
  return `<div class="meas-wrap num-field"><label class="meas-label" for="in-${id}">${esc(label)}${opt.hint ? `<small>${esc(opt.hint)}</small>` : ''}</label><div class="control-slide num-row">${knopf(-1, 'remove', 'verringern')}<span class="vwrap"><input class="value-input numeric" id="in-${id}" data-f="${id}" inputmode="decimal" autocomplete="off" value="${esc(p.values[id] ?? '')}" placeholder="${esc(opt.ph ?? '0')}"><span class="input-unit-addon">${esc(unit || '')}</span></span>${knopf(1, 'add', 'erhöhen')}</div>${autoTxt}</div>`;
}
function autoLine(p, id, hint) {
  return p.manual && p.manual[id]
    ? `<span class="man">von Hand geändert</span>, Vorschlag: ${esc(hint)}. <button type="button" class="jump-link" data-act="unauto" data-f="${id}">Wieder automatisch</button>`
    : `<b>automatisch</b>, ${esc(hint)}`;
}
function segField(p, id, label, hint, opts) {
  const x = p.values[id] || '';
  return `<div class="check-main"><span class="check-label">${esc(label)}${hint ? `<small>${esc(hint)}</small>` : ''}</span><div class="segmented-control segmented-inline" role="group" aria-label="${esc(label)}">${(opts || ['Ja', 'Nein']).map((o) => `<button type="button" class="segmented-option" data-act="set" data-f="${id}" data-v="${esc(o)}" aria-pressed="${x === o}">${esc(o)}</button>`).join('')}</div></div>`;
}
function fgasHtml(pr) {
  const cls =
    pr.state === 'pflicht' || pr.state === 'r290' ? 'warn' : pr.state === 'frei' ? 'ok' : '';
  const head =
    pr.state === 'pflicht'
      ? `Dichtheitsprüfung Pflicht, alle ${pr.monate} Monate`
      : pr.state === 'r290'
        ? 'R290-Sicherheitsprüfung wird eingerechnet'
        : pr.state === 'frei'
          ? 'Keine Prüfpflicht'
          : 'Noch nicht berechenbar';
  const co2 =
    pr.km && pr.menge && pr.gwp
      ? `CO₂-Äquivalent je Kreis: <b style="display:inline;font-size:inherit">${de(pr.co2, 2)} t</b>. `
      : '';
  return `<div class="fgas ${cls}" id="fgasbox"><b>${esc(head)}</b>${co2}${esc(pr.text)}${pr.min ? `, ${de(pr.min, 0)} Min eingerechnet` : ''}</div>`;
}
const Pages = [
  (p) => `<div class="group group--form">
${textField(p, 'projekt', 'Projektnummer', '2026-0815', 'Eure Auftrags- bzw. Projektnummer, wird zum Dateinamen des PDFs')}
<label class="field"><span class="field-label">Datum</span><span class="field-box"><input class="text-input" id="in-datum" type="date" data-f="datum" value="${esc(p.values.datum || '')}"></span></label>
${textField(p, 'kunde', 'Kunde / Projekt', 'Kundenname')}
${textField(p, 'standort', 'Objekt / Standort', 'Straße, PLZ Ort')}
${textField(p, 'bearbeiter', 'Erstellt von', 'Name')}
    </div>
    <h2 class="section-title">Team vor Ort</h2>
    <div class="group group--form">
${stepField(p, 'anzTech', 'Anzahl Servicetechniker', 'Pers.', { ph: '1', hint: `Stundensatz ${eur(p.stamm.satz_tech)}, leer = 1 Techniker` })}
${stepField(p, 'anzHelfer', 'Anzahl Helfer / Azubis', 'Pers.', { hint: `Stundensatz ${eur(p.stamm.satz_helfer)}` })}
    </div>`,
  (p) =>
    `<div class="group group--form">${C.geraete
      .map((g) =>
        stepField(p, g.id, g.label, g.unit, {
          hint: `Richtzeit ${fmtNum(p.stamm[g.t])} Min je ${g.unit === 'Pauschale' ? 'Pauschale' : 'Stück'}`,
          autoHint: g.auto ? g.autoHint(p.stamm) : '',
        }),
      )
      .join('')}</div>`,
  (p) => {
    const km = p.values.km || '',
      list = Object.keys(C.kaeltemittel),
      custom = km && !list.includes(km);
    return `<div class="group group--form">
<div class="field"><span class="field-label">Kältemittel</span>
  <div class="field-box"><input class="text-input" id="in-km" data-f="km" data-other="1" aria-label="Anderes Kältemittel" placeholder="oder anderes Kältemittel eintippen …" value="${custom ? esc(km) : ''}" autocomplete="off"></div>
  <div class="tab-strip" role="group" aria-label="Kältemittel">${list.map((o) => `<button type="button" class="tab-pill" data-act="set" data-f="km" data-v="${esc(o)}" aria-selected="${km === o}">${esc(o)}</button>`).join('')}</div></div>
${stepField(p, 'gwp', 'GWP-Wert', '', { hint: 'Treibhauspotenzial', autoHint: 'aus der Kältemittel-Liste', ph: '', noStep: true })}
${stepField(p, 'menge', 'Füllmenge je Kältekreis', 'kg', { hint: 'Typenschild Außengerät / Anlagenbuch' })}
${stepField(p, 'kreise', 'Anzahl Kältekreise mit dieser Füllmenge', 'Kreise', { ph: '1', hint: `Richtzeit Dichtheitsprüfung ${fmtNum(p.stamm.t_dicht)} Min je Kreis${C.r290Key ? `, R290-Prüfung ${fmtNum(p.stamm[C.r290Key])} Min je Kreis` : ''}` })}
${segField(p, 'herm', 'Hermetisch geschlossen', C.hermAuto ? 'Vorschlag: Ja bei reinen Monoblock-Geräten' : 'Herstellerangabe, Prüfgrenze dann 10 t statt 5 t')}
${segField(p, 'leck', 'Leckage-Erkennungssystem vorhanden', 'Prüfintervall verdoppelt sich')}
    </div>
    ${fgasHtml(calc(p).pr)}`;
  },
  (p) => `<h2 class="section-title">Material &amp; Reinigungsmittel</h2>
    <div class="group group--form">${C.material
.map((m) =>
  stepField(p, m.id, m.label, m.unit, {
    hint: `${eur(p.stamm[m.price])} je ${m.unit}`,
    autoHint: m.auto ? m.autoHint(p.stamm) : '',
  }),
)
.join('')}</div>
    <h2 class="section-title">Anfahrt &amp; Erschwernis</h2>
    <div class="group group--form">
${stepField(p, 'anfahrt', 'Anfahrtspauschale', '€ netto', { hint: 'Fixbetrag' })}
${stepField(p, 'erschwernis', C.erschwernisLabel, '€ netto', { hint: 'Miete / Mehraufwand' })}
    </div>
    <h2 class="section-title">Sonderposition</h2>
    <div class="group group--form">
${textField(p, 'sonderText', 'Bezeichnung', C.sonderPh)}
${stepField(p, 'sonderPreis', 'Betrag', '€ netto')}
    </div>`,
  (p) => {
    const stale = JSON.stringify(p.stamm) !== JSON.stringify(stammNow());
    return `
    ${stale ? `<div class="notice"><span>Die Stammdaten (Stundensätze, Richtzeiten, Preise) wurden geändert, seit diese Kalkulation begonnen wurde.</span><button type="button" class="btn-secondary" data-act="stammapply">Neue Stammdaten übernehmen</button></div>` : ''}
    <h2 class="section-title">Kostenaufstellung</h2>
    <div class="group"><div class="info-list" id="result">${resultHtml(p, calc(p))}</div></div>
    <div class="group group--form">
${segField(p, 'pauschal', 'Pauschalangebot für den Kunden', 'Ja = PDF als „Angebot“ ohne Arbeitszeiten und Einzelpreise. Nein = interne Kalkulation.')}
<label class="field"><span class="field-label">Bemerkungen (erscheinen im PDF)</span><span class="field-box"><textarea class="text-input" id="in-bem" data-f="bem" placeholder="Hinweise zum Zugang, Termin, Ausführung">${esc(p.values.bem || '')}</textarea></span></label>
    </div>
    <div class="notice"><span><b>Wichtig:</b> Die Kalkulation ist eine Orientierungshilfe und kann Berechnungs- oder Eingabefehler enthalten. Vor Weitergabe oder Angebotslegung auf Plausibilität, Richtigkeit und Vollständigkeit prüfen.</span></div>`;
  },
];
function resultHtml(p, k) {
  const z = (label, wert, cls) =>
    `<div class="info-row${cls ? ' ' + cls : ''}"><span class="info-row-label">${label}</span><span class="info-row-value numeric">${wert}</span></div>`;
  return (
    z(
      `Arbeitszeit Techniker${k.nT > 1 ? ` (${k.nT} × ${hrs(k.dauer)})` : ''}`,
      `${de(k.minTech, 0)} Min (${hrs(k.minTech)})`,
    ) +
    z(`Einsatzdauer vor Ort, ${esc(k.team)}`, hrs(k.dauer)) +
    z('Lohnkosten netto', eur(k.lohn)) +
    z('Material, Anfahrt &amp; Nebenleistungen netto', eur(k.mat)) +
    z('Nettobetrag gesamt', eur(k.netto), 'info-row--sum') +
    z(`zzgl. ${fmtNum(k.S.mwst)} % MwSt.`, eur(k.mwst)) +
    z('Gesamtpreis brutto', eur(k.brutto), 'info-row--total')
  );
}
function pageDone(p, i) {
  const v = p.values;
  if (i === 0) return !!(v.projekt || v.kunde);
  if (i === 1) return C.geraete.some((g) => n0(v[g.id]) > 0);
  if (i === 2) return !!v.km;
  if (i === 3) return C.material.some((m) => n0(v[m.id]) > 0) || n0(v.anfahrt) > 0;
  return false;
}
