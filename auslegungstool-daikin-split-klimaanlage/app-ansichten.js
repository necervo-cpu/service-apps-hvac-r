/* app-ansichten.js – Ansichten: Übersicht, Eingabe, Ergebnis (nur Darstellung, keine Berechnung). */
'use strict';
/* ====== Ansicht ====== */
let openRooms = new Set(),
  uiOpen = {};
const roomEmpty = (r) => !r.name && !r.flaeche && !r.bedarf && !r.modell && !r.rohr;
function go(name, extra) {
  view = Object.assign({ name }, extra);
  if (name === 'edit') {
    const p = cur();
    openRooms = new Set(p ? p.rooms.filter(roomEmpty).map((r) => r.id) : []);
    uiOpen = {};
  }
  prevKpi = null;
  render();
  window.scrollTo(0, 0);
}
const isRes = () => view.name === 'edit' && view.step === 'res';
function setHeader() {
  const p = isRes() ? cur() : null;
  const hs = $('#hsub');
  const t = p
    ? (p.nr || 'ohne Projektnummer') + (p.kunde ? ', ' + p.kunde : '')
    : 'Split / Multisplit R32';
  hs.textContent = t;
  hs.title = t;
}
function barHtml() {
  if (view.name !== 'edit') return '';
  const p = cur();
  if (!isRes())
    return `<div><button type="button" class="btn-secondary bar-side" data-act="addroom" aria-label="Raum hinzufügen"${p.rooms.length >= 5 ? ' disabled' : ''}>${MSR('add')}<span>Raum</span></button><button type="button" class="btn-primary bar-main" data-act="toresult">Ergebnis ansehen</button></div>`;
  const sel = EV ? selected() : null;
  const fertig = lastPdf && lastPdf.id === p.id && sel && sel.ok;
  return `<div><button type="button" class="btn-secondary bar-side" data-act="toinput">Ändern</button><button type="button" class="btn-primary bar-main pdfb${pdfBusy === p.id ? ' run' : ''}" data-act="makepdf"${sel && sel.ok ? '' : ' disabled'}><span class="fill"${pdfBusy === p.id ? ` style="transform:scaleX(${pdfProg})"` : ''}></span><span class="l1">${MSR('download')}PDF erstellen</span><span class="lr">PDF wird erstellt</span><span class="l2">${MSR('check')}PDF fertig</span></button>${fertig ? '<button type="button" class="btn-secondary bar-side" data-act="sharepdf">Teilen</button>' : ''}</div>`;
}
function setBar() {
  const b = $('#bar'),
    h = barHtml();
  if (b._lastHtml !== h) {
    b._lastHtml = h;
    b.innerHTML = h;
  }
  b.hidden = !h;
  document.body.classList.toggle('hasbar', !!h);
}
function render() {
  const y = window.scrollY;
  if (view.name === 'edit' && !cur()) {
    view = { name: 'list' };
  }
  setHeader();
  app.innerHTML = view.name === 'list' ? vList() : vEdit();
  if (view.name === 'edit') refreshResults();
  else setBar();
  updateNet();
  nachRender();
  window.scrollTo(0, y);
}
const HINWEIS =
  'Kombinationshilfe zur ersten Prüfung. Endgültige Kalkulation vor Angebot prüfen.';
function vList() {
  return `${
    updateHinweis && !updateSpaeter
      ? `<div class="notice notice--update"><div class="notice-text"><strong>Neue Version ${esc(updateHinweis)}</strong><span>Aktuell installiert: ${esc(APP_VERSION)}</span></div><div class="btn-row"><button type="button" class="btn-primary" data-act="doupdate">Aktualisieren</button><button type="button" class="btn-secondary" data-act="updatespaeter">Später</button></div></div>`
      : ''
  }<p class="lead-note">Multisplit-Kombinationen (R32) prüfen. Als „freigegeben“ erscheinen nur Kombinationen, die Daikin freigibt.</p>
  <button type="button" class="btn-primary btn-wide" data-act="new">${MSR('add')}<span>Neue Auslegung</span></button>
  <h2 class="section-title">Gespeichert auf diesem Gerät <span class="section-count">${projects.length}</span></h2>
  ${
    projects.length
? `<div class="group">${projects
    .map(
      (p) => `<div class="row proto-row">
    <button type="button" class="proto-open" data-act="open" data-id="${p.id}"><span class="row-icon row-icon--blue">${MSR('description')}</span><span class="row-text"><span class="row-title">${esc(p.nr || 'ohne Projektnummer')}</span>${p.kunde ? `<span class="row-sub">${esc(p.kunde)}</span>` : ''}<span class="row-sub">${esc(fmtDate(p.datum))}, ${p.rooms.length} ${p.rooms.length === 1 ? 'Raum' : 'Räume'}</span></span><span class="material-symbols-rounded row-chevron" aria-hidden="true">chevron_right</span></button>
    <button type="button" class="icon-btn proto-act is-danger" data-act="del" data-id="${p.id}" aria-label="Auslegung ${esc(p.nr || 'ohne Projektnummer')} löschen">${MSR('delete')}</button></div>`,
    )
    .join('')}</div>`
: '<p class="empty-note">Noch keine Auslegung. Mit „Neue Auslegung“ startest du die erste.</p>'
  }
  <p class="hint">${HINWEIS}</p>
  <p class="hint">Datenstand: ${esc(dataInfo)}</p>`;
}

/* ====== Eingabe ====== */
function roomSummary(r) {
  let u = null;
  try {
    u = E.pickUnit(r, DB);
  } catch (e) {}
  const a = [];
  if (E.num(r.flaeche) != null) a.push(fmt(E.num(r.flaeche)) + ' m²');
  if (u) a.push(u.modell);
  if (E.num(r.rohr) != null) a.push(fmt(E.num(r.rohr)) + ' m Rohr');
  return a.length ? a.join(', ') : 'Raum bearbeiten';
}
const CHEV = MSR('expand_more').replace(
  'material-symbols-rounded',
  'material-symbols-rounded acc-chevron',
);
/* Feldbausteine: Beschriftung oben, Eingabe darunter */
function fText(label, attr, value, ph, mode) {
  return `<label class="field"><span class="field-label">${esc(label)}</span><span class="field-box"><input class="text-input" ${attr} value="${esc(value)}" autocomplete="off"${mode ? ` inputmode="${mode}"` : ''}></span></label>`;
}
/* Zahlenfeld mit „−“ und „+“ (.stepper); step = Schritt, min = untere Grenze (null = auch negativ) */
function stepBtn(dir, label) {
  return `<button type="button" class="stepper" data-act="step" data-dir="${dir}" aria-label="${esc(label)} ${dir < 0 ? 'verringern' : 'erhöhen'}">${MSR(dir < 0 ? 'remove' : 'add')}</button>`;
}
function fNum(label, attr, value, ph, unit, hint, hintId, step, min) {
  const st = step || 1;
  const mn = min === undefined ? 0 : min;
  return `<div class="field"><span class="field-label">${esc(label)}</span><span class="control-slide num-row" data-step="${st}" data-min="${mn === null ? '' : mn}">${stepBtn(-1, label)}<span class="field-box input-wrapper"><input class="glass-input" ${attr} inputmode="decimal" value="${esc(value)}" aria-label="${esc(label)}" autocomplete="off"><span class="input-unit-addon">${esc(unit)}</span></span>${stepBtn(1, label)}</span>${hint || hintId ? `<span class="field-hint"${hintId ? ` id="${hintId}"` : ''}>${esc(hint || '')}</span>` : ''}</div>`;
}
/* Auswahl: Pills, ab mehr als 3 Optionen macht initChoiceDropdowns() ein Dropdown daraus */
function fSel(label, f, opts, current) {
  return `<div class="field" role="group" aria-label="${esc(label)}"><span class="field-label">${esc(label)}</span><div class="tab-strip" aria-label="${esc(label)}">${opts
    .map(
      (o) =>
        `<button type="button" class="tab-pill" data-act="setf" data-f="${f}" data-v="${esc(o.v)}" aria-selected="${String(current) === String(o.v)}">${esc(o.l)}</button>`,
    )
    .join('')}</div></div>`;
}
function roomCard(r, i) {
  const typen = [...new Set(DB.ig.map((x) => x.typ))];
  const serien = [...new Set(DB.ig.filter((x) => x.typ === r.typ).map((x) => x.serie))];
  const modelle = DB.ig
    .filter((x) => x.typ === r.typ && (!r.serie || x.serie === r.serie))
    .sort((a, b) => a.klasse - b.klasse);
  const p = cur(),
    open = openRooms.has(r.id);
  const head = `<button type="button" class="acc-head" data-act="toggleroom" data-i="${i}" aria-expanded="${open}"><span class="acc-badge">${i + 1}</span><span class="acc-name"><span class="row-title" id="rt${i}">${esc(r.name || 'Raum ' + (i + 1))}</span><span class="row-sub" id="sum${i}">${esc(roomSummary(r))}</span></span>${CHEV}</button>`;
  return `<div class="acc${open ? ' is-open' : ''}" data-room="${i}">${head}<div class="acc-body"><div><div class="acc-inner">
    ${fText('Raumname', 'data-f="name"', r.name, 'Wohnzimmer')}
    ${fSel(
'Raumtyp',
'raumtyp',
DB.raumtypen.map((x) => ({ v: x.name, l: x.name })),
r.raumtyp,
    )}
    ${fSel(
'Lage / Zuschlag',
'zuschlag',
DB.zuschlaege.map((x) => ({ v: x.name, l: x.name })),
r.zuschlag,
    )}
    ${fNum('Fläche', 'data-f="flaeche"', r.flaeche, '25', 'm²', '', '', 1)}
    ${fNum('Kühlbedarf', 'data-f="bedarf"', r.bedarf, 'automatisch', 'kW', '', 'bh' + i, 0.5)}
    ${fSel(
'Gerätetyp',
'typ',
typen.map((x) => ({ v: x, l: x })),
r.typ,
    )}
    ${fSel('Serie', 'serie', [{ v: '', l: 'beliebig' }].concat(serien.map((x) => ({ v: x, l: x }))), r.serie)}
    ${fSel('Modell', 'modell', [{ v: '', l: 'Automatisch (passend zum Bedarf)' }].concat(modelle.map((x) => ({ v: x.modell, l: `${x.modell}, ${fmt(x.kw)} kW` }))), r.modell)}
    ${fNum('Rohrlänge zum Außengerät', 'data-f="rohr"', r.rohr, 'einfache Länge', 'm', '', '', 1)}
    <div class="field"><label class="field-label" for="hoehe${i}">Höhe Innengerät zum Außengerät</label><div class="control-slide num-row" data-step="1" data-min="">${stepBtn(-1, 'Höhe')}<span class="field-box input-wrapper"><input class="glass-input" id="hoehe${i}" data-f="hoehe" inputmode="text" value="${esc(r.hoehe)}" autocomplete="off"><span class="input-unit-addon">m</span></span>${stepBtn(1, 'Höhe')}</div><button type="button" class="btn-tonal sign-btn" data-act="sign" aria-label="Vorzeichen wechseln">+ / −</button><span class="field-hint">+ = Innengerät höher, − = tiefer als Außengerät</span></div>
    <div class="pick-line" id="pick${i}"></div>
    ${p.rooms.length > 1 ? `<button type="button" class="btn-danger" data-act="delroom" data-i="${i}">Raum ${i + 1} entfernen</button>` : ''}
  </div></div></div></div>`;
}
function vEdit() {
  const p = cur();
  const steps = `<div class="segmented-control steps" role="group" aria-label="Schritt"><button type="button" class="segmented-option" data-act="toinput" aria-pressed="${!isRes()}">Eingabe</button><button type="button" class="segmented-option" data-act="toresult" aria-pressed="${isRes()}">Ergebnis</button></div>`;
  if (isRes()) return steps + `<div id="results"></div>`;
  return `${steps}
  <button type="button" class="back-btn" data-act="back">${MSR('chevron_left')}Übersicht</button>
  <h2 class="section-title">Projekt</h2>
  <div class="group group--form">
    ${fText('Projektnummer', 'data-p="nr"', p.nr, '2026-0123')}
    <label class="field"><span class="field-label">Datum</span><span class="field-box"><input class="text-input" type="date" data-p="datum" value="${esc(p.datum)}"></span></label>
    ${fText('Kunde / Objekt', 'data-p="kunde"', p.kunde)}
    ${fText('Bearbeiter', 'data-p="bearbeiter"', p.bearbeiter)}
  </div>
  <h2 class="section-title">Räume und Innengeräte <span class="section-count">${p.rooms.length}</span></h2>
  <div class="group">${p.rooms.map(roomCard).join('')}</div>
  <h2 class="section-title">Bemerkungen</h2>
  <div class="group"><div class="field"><label class="field-label" for="bemerkung">Kommen ins PDF</label><div class="field-box"><textarea class="text-input" id="bemerkung" data-p="bemerkung">${esc(p.bemerkung)}</textarea></div></div></div>
  <p class="hint">${HINWEIS}</p>`;
}

/* ====== Ergebnis ====== */
let EV = null;
function evaluate() {
  const p = cur();
  EV = E.evaluateAll(p.rooms, DB);
  return EV;
}
function selected() {
  const p = cur();
  if (!EV) evaluate();
  return (p.odu && EV.all.find((x) => x.odu.id === p.odu)) || EV.best || null;
}
function refreshHints() {
  const p = cur();
  p.rooms.forEach((r, i) => {
    const rt = $('#rt' + i);
    if (rt) rt.textContent = r.name || 'Raum ' + (i + 1);
    const sm = $('#sum' + i);
    if (sm) {
      const t = roomSummary(r);
      if (sm.textContent !== t) {
        sm.textContent = t;
        flash(sm);
      }
    }
    const b = E.bedarfKw(r, DB),
      bh = $('#bh' + i);
    if (bh)
      bh.textContent =
        b == null
          ? 'Fläche eintragen oder Bedarf selbst angeben'
          : E.num(r.bedarf) != null
            ? 'manuell'
            : `berechnet aus Fläche, ${fmt(b)} kW`;
    const u = E.pickUnit(r, DB),
      pk = $('#pick' + i);
    if (pk)
      pk.innerHTML = u
        ? `Gewählt: <b>${esc(u.modell)}</b>, Klasse ${u.klasse}, ${fmt(u.kwK != null ? u.kwK : u.kw)} kW kühlen${u.kwH != null ? ' / ' + fmt(u.kwH) + ' kW heizen' : ''} (Nenn)${b != null && (u.kwK != null ? u.kwK : u.kw) + 1e-9 < b ? `<br><span class="status-pill status-pill--orange">kleiner als Bedarf ${fmt(b)} kW</span>` : ''}`
        : 'Noch kein Gerät. Fläche oder Bedarf eintragen, oder ein Modell wählen.';
  });
}
function refreshResults() {
  const p = cur();
  if (!p) return;
  evaluate();
  refreshHints();
  if (!isRes()) {
    setBar();
    return;
  }
  const sel = selected(),
    box = $('#results');
  if (!box) return;
  box.innerHTML = resultHtml(sel);
  const kr = box.querySelector('[data-kv="rohr"] .v'),
    kc = box.querySelector('[data-kv="r32"] .v');
  if (kr && kc) {
    if (prevKpi && prevKpi.id === p.id) {
      if (prevKpi.rohr !== kr.textContent) flash(kr.closest('.info-row'));
      if (prevKpi.r32 !== kc.textContent) flash(kc.closest('.info-row'));
    }
    prevKpi = { id: p.id, rohr: kr.textContent, r32: kc.textContent };
  }
  setBar();
  nachRender();
}
function pickRow(x) {
  const o = x.odu;
  const tags = [];
  if (x.empfohlen) tags.push('<span class="status-pill status-pill--blue">Empfehlung</span>');
  else if (EV.alt && EV.alt.x.odu.id === x.odu.id)
    tags.push('<span class="status-pill status-pill--orange">Alternative</span>');
  tags.push(
    x.ok
      ? '<span class="status-pill status-pill--green">freigegeben</span>'
      : '<span class="status-pill status-pill--red">nicht freigegeben</span>',
  );
  return `<button type="button" class="pick-row" data-act="pickodu" data-id="${esc(o.id)}"><span class="row-text"><span class="row-title">${esc(o.id)}</span><span class="row-sub">${fmt(o.kuehlen_kw)} / ${fmt(o.heizen_kw)} kW, max. ${o.ig_max} Räume, bis ${fmt(o.summe_max_kw)} kW Summe</span>${x.ok ? '' : `<span class="row-sub why-bad">${esc(x.errs[0])}${x.errs.length > 1 ? ` (+${x.errs.length - 1} weitere)` : ''}</span>`}</span><span class="pick-pills">${tags.join('')}</span></button>`;
}
function accHtml(key, title, count, inner) {
  const open = !!uiOpen[key];
  return `<div class="acc${open ? ' is-open' : ''}" data-k="${key}"><button type="button" class="acc-head" data-act="toggleacc" data-k="${key}" aria-expanded="${open}"><span class="acc-name"><span class="row-title">${title}</span></span>${count != null ? `<span class="section-count">${count}</span>` : ''}${CHEV}</button><div class="acc-body"><div><div class="acc-inner">${inner}</div></div></div></div>`;
}
function noteBox(kind, title, items) {
  return `<div class="note-box${kind === 'orange' ? ' note-box--orange' : ''}"><strong>${title}</strong><ul>${items.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>`;
}
function infoRow(label, sub, value, kv) {
  return `<div class="info-row"${kv ? ` data-kv="${kv}"` : ''}><span class="info-row-label"><span class="row-text"><span>${label}</span>${sub ? `<span class="row-sub">${sub}</span>` : ''}</span></span><span class="info-row-value numeric v">${value}</span></div>`;
}
function resultHtml(sel) {
  const p = cur();
  if (!sel && uiOpen.badl === undefined) uiOpen.badl = true; // ohne freigegebene Kombination: Gründe standardmäßig sichtbar
  let h = '';
  if (!sel) {
    h += `<div class="hero"><div class="hero-caption">Ergebnis</div><div class="hero-value hero-value--compact">Keine freigegebene Kombination gefunden</div><div class="pill-row"><span class="status-pill status-pill--red">${MSR('error')}Fehler</span></div><p class="hero-note why">Gründe stehen unten bei „Nicht freigegeben“. Außengerät antippen, um alle Details zu sehen.</p></div>`;
    h += `<p class="hint">PDF gibt es nur für eine freigegebene Kombination.</p>`;
  } else {
    const o = sel.odu;
    h += `<div class="hero">
<div class="hero-caption">${sel.empfohlen ? 'Empfehlung' : 'Manuell gewählt'}</div>
<div class="hero-value">${esc(o.id)}</div>
<div class="pill-row"><span class="status-pill status-pill--${sel.ok ? 'green' : 'red'}">${MSR(sel.ok ? 'check_circle' : 'error')}${sel.ok ? 'Freigegeben' : 'Fehler'}</span>${sel.ok && sel.warns.length ? '<span class="status-pill status-pill--orange">Hinweis</span>' : ''}</div>
<p class="hero-note why">${fmt(o.kuehlen_kw)} kW kühlen / ${fmt(o.heizen_kw)} kW heizen</p>
${sel.empfohlen ? `<ul class="why-list">${EV.why.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : `<p class="hero-note why">Manuell gewählt${EV.best ? ' – Empfehlung der App: ' + esc(EV.best.odu.id) : ''}. Anderes Gerät in der Liste unten antippen, um zu wechseln.</p>${EV.best ? `<p class="hero-note why">App-Empfehlung: <b>${esc(EV.best.odu.id)}</b> (${EV.why.map(esc).join('; ')})${EV.alt ? `; Alternative: <b>${esc(EV.alt.x.odu.id)}</b> – ${esc(EV.alt.why)}` : ''}.</p>` : ''}`}
${sel.empfohlen && EV.alt ? `<p class="hero-note why"><b>Alternative: ${esc(EV.alt.x.odu.id)}</b> – ${esc(EV.alt.why)}.</p>` : ''}
    </div>
    <div class="info-list results-block">
${infoRow('Summe Innengeräte', 'max. ' + fmt(sel.sumMax) + ' kW', fmt(sel.sum) + ' <span class="metric-unit">kW</span>')}
${infoRow('Rohrlänge gesamt', 'max. ' + fmt(o.rohr_gesamt_max_m) + ' m', sel.total != null ? fmt(sel.total) + ' <span class="metric-unit">m</span>' : '—', 'rohr')}
${infoRow('R32 gesamt', sel.extra != null && sel.extra > 0 ? fmt(sel.extra) + ' kg nachfüllen' : 'keine Nachfüllung', sel.charge != null ? fmt(sel.charge, 2) + ' <span class="metric-unit">kg</span>' : '—', 'r32')}
    </div>
${sel.errs.length ? noteBox('red', 'Nicht freigegeben:', sel.errs) : '<p class="why results-block">Alle geprüften Daikin-Vorgaben sind eingehalten.</p>'}
${sel.warns.length ? noteBox('orange', 'Hinweise:', uniq(sel.warns)) : ''}
${EV.best ? '<p class="hint results-block">Die Empfehlung ist eine Bewertung dieser App (Deckung des Bedarfs, geringe Größe, wenig Kältemittel). Freigegeben sind alle als „freigegeben“ markierten Geräte.</p>' : ''}`;
    if (!sel.ok)
      h += `<p class="hint">PDF gibt es nur für eine freigegebene Kombination.</p>`;
    if (lastPdf && lastPdf.id === p.id && sel.ok)
      h += `<div class="btn-row">${pdfBarHtml()}</div>`;
    h += `<h2 class="section-title">Leistung je Raum</h2><div class="group">${sel.rows
      .map((r) => {
        const u = r.unit,
          a = r.asg;
        const l1 = [
          a
            ? `Anschluss ${esc(a.port.port)}, Ø${fmt(a.port.gas_mm)}${a.red ? ' (Red. ' + esc(a.red) + ')' : ''}`
            : 'Anschluss —',
          r.laenge != null ? 'Rohr ' + fmt(r.laenge) + ' m' : 'Rohr — m',
        ].join(', ');
        const l2 = [
          u
            ? 'Einzel ' +
              fmt(u.kwK != null ? u.kwK : u.kw) +
              ' / ' +
              (u.kwH != null ? fmt(u.kwH) : '—') +
              ' kW'
            : '',
          'Höhe ' + (r.hoehe ? fmt(r.hoehe) + ' m' : '0 m'),
          'Min.-Fläche ' + (r.amin ? fmt(Math.ceil(r.amin * 10) / 10) + ' m²' : 'keine'),
          r.mh != null ? 'Multi heizen ' + fmt(r.mh, 2) + ' kW' : '',
        ]
          .filter(Boolean)
          .join(', ');
        return `<div class="rr"><div class="rr-main"><b>${esc(r.room.name || 'Raum ' + (r.i + 1))}, ${u ? esc(u.modell) : '—'}</b><span class="row-sub">${l1}</span><span class="row-sub">${esc(l2)}</span></div><div class="rr-val numeric"><b>${r.mk != null ? fmt(r.mk, 2) + ' kW' : '—'}</b><span>Multi kühlen</span></div></div>`;
      })
      .join('')}</div>
<p class="hint results-block">${sel.multi ? `Multi = Leistung je Raum, wenn alle Innengeräte gleichzeitig laufen (Nennwert). Quelle: ${esc(sel.multi.quelle)}.${sel.multi.vorl ? ' <b>Werte dieser Kombination laut Daikin vorläufig.</b>' : ''}` : 'Keine Multi-Leistung für diese Kombination in der Daikin-Tabelle.'}</p>`;
  }
  const others = EV.all.filter((x) => !sel || x.odu.id !== sel.odu.id);
  const okl = others.filter((x) => x.ok),
    badl = others.filter((x) => !x.ok);
  const liste = (l) =>
    l.length ? l.map(pickRow).join('') : '<p class="empty-line">Keine.</p>';
  h += `<div class="group">${sel ? accHtml('tech', 'Technische Daten ' + esc(sel.odu.id), null, detailHtml(sel)) : ''}${accHtml('okl', 'Weitere freigegebene Geräte', okl.length, liste(okl))}${accHtml('badl', 'Nicht freigegeben', badl.length, liste(badl))}</div>`;
  return h;
}
function detailHtml(x) {
  const o = x.odu;
  const z = (label, value) =>
    `<div class="info-row info-row--stack"><span class="info-row-label">${label}</span><span class="info-row-value">${value}</span></div>`;
  return `<div class="info-list">
    ${z('Summe Innengeräte', `<b>${fmt(x.sum)} kW</b> (max. ${fmt(x.sumMax)} kW)`)}
    ${z('Rohrlänge gesamt', `<b>${x.total != null ? fmt(x.total) + ' m' : '—'}</b> (max. ${fmt(o.rohr_gesamt_max_m)} m, je Raum ${fmt(o.rohr_raum_min_m)}–${fmt(o.rohr_raum_max_m)} m)`)}
    ${z('Zusätzliches Kältemittel', `<b>${x.extra != null ? fmt(x.extra) + ' kg' : '—'}</b> (ab ${fmt(o.nachfuell_ab_m)} m Flüssigkeitsleitung, ${fmt(o.nachfuell_kg_je_m * 1000, 0)} g/m)`)}
    ${z('Kältemittel gesamt (R32)', `<b>${x.charge != null ? fmt(x.charge, 2) + ' kg' : '—'}</b> (Werk ${fmt(o.werk_kg, 2)} kg${o.fuell_max_kg != null ? ', max. ' + fmt(o.fuell_max_kg) + ' kg' : ''})`)}
    ${z('Stromaufnahme (Außengerät)', `<b>${o.strom_a != null ? fmt(o.strom_a) + ' A' : '—'}</b> (1~ 50 Hz 220–240 V)`)}
    ${z('Absicherung (empf. Hauptschalter)', `<b>${o.hauptschalter_a != null ? o.hauptschalter_a + ' A' : '—'}</b>, Netzleitung 3-adrig min. ${fmt(o.netzleitung_min_mm2)} mm², Verbindungsleitung 4-adrig min. ${fmt(o.verbindungsleitung_min_mm2)} mm²`)}
  </div>`;
}
