/* shared/pdf-bausteine.js – gemeinsame Bausteine für den Bericht (HTML-Teile für reportParts der Apps)
   Aufruf in der App: const B = pdfBausteine();  (pro Bericht neu aufrufen – die Abschnittsnummern zählen ab 1)
   Inhalt: Hilfen esc, up, nl, icon, pill; Seitenteile kopf, kopfKlein, fuss; Blöcke abschnitt, kv, checkliste, zwischenTitel,
           tabelle (umbrechbar, „(Fortsetzung)“), kacheln, notiz, rechtstext, unterschrift.
   Die Bausteine filtern keine Daten weg (Altfelder-Logik bleibt in buildReport/rowToReport_ bzw. reportParts der App).
   Klassen und Aussehen: shared/pdf.css. Benötigt keine weiteren Funktionen (esc ist eingebaut), nur reportParts der App ruft es auf.
   Änderungen am PDF: hier und in shared/pdf.css; PdfDialog.html wird mit tools/pdfdialog-bauen.js daraus erzeugt (nicht von Hand ändern). */

/* ===== Bausteine (wird in PdfDialog.html eingesetzt) ===== */
const RICON = {
  ok: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="7.2" fill="currentColor"/><path d="M4.8 8.3l2.1 2.1 4.3-4.6" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  bad: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="7.2" fill="currentColor"/><path d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/></svg>',
  na: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M5.3 8h5.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  clock:
    '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 4.6V8l2.3 1.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
};
function pdfBausteine() {
  const esc = (s) =>
    String(s ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  const nl = (s) => esc(s).replace(/\n/g, '<br>');
  // Großbuchstaben im Text statt per CSS: html2canvas stürzt sonst bei „ß“ ab (wird zu „SS“, Text wird länger)
  const up = (s) => esc(String(s ?? '').toUpperCase());
  // Symbole mit fester Farbe und Größe – html2canvas übernimmt „currentColor“ nicht zuverlässig
  const COL = { ok: '#1e7a46', bad: '#b42318', na: '#8a8989', warn: '#8a5a00' };
  // farbe (optional): Farbname aus COL oder Hex-Wert, wenn sie vom Symbol-Namen abweicht
  const icon = (k, px, farbe) =>
    RICON[k]
      .replace('<svg ', `<svg width="${px}" height="${px}" `)
      .replace(/currentColor/g, COL[farbe || k] || farbe || COL[k]);
  // symbol (optional): anderes Symbol als der Farbname, z. B. pill('warn', 'fällig in 5 Tagen', 'clock')
  const pill = (k, text, symbol) =>
    `<span class="pill ${k}">${icon(symbol || k, 10, k)}${esc(text)}</span>`;
  const lines = (f) =>
    (Array.isArray(f) ? f : String(f || '').split('\n'))
      .map((s) => String(s).trim())
      .filter(Boolean);
  let n = 0; // laufende Abschnittsnummer
  const h2 = (title, ref) =>
    `<h2><span class="no">${++n}</span><span class="tt">${esc(title)}</span>${ref ? `<span class="ref">${esc(ref)}</span>` : ''}</h2>`;

  /* Kopf Seite 1. firma: Text mit Zeilenumbrüchen oder Liste (erste Zeile fett; leer = Block entfällt, Nummern bleiben rechts);
     kicker/titel: kleine Zeile über dem Titel + Titel (H1); nrLabel/id: z. B. „Projekt-Nr.“; nummern (optional): [{label, wert}] statt nrLabel/id,
     Einträge ohne Wert entfallen (z. B. Kunden-Nr.); datum: optional (datumLabel: Text davor, Standard „Datum“);
     untertitel: optionale Zeile unter dem Titel (untertitelUnten wird weiter angenommen, Position ist gleich) */
  const idsHtml = (nummern, nrLabel, id, datum, datumLabel) => {
    const rows = (nummern || [{ label: nrLabel, wert: id }]).slice();
    if (datum) rows.push({ label: datumLabel || 'Datum', wert: datum });
    const ok = rows.filter((x) => x && x.wert);
    return ok.length
      ? `<div class="ids">${ok.map((x) => `<span>${esc(x.label)}</span><b>${esc(x.wert)}</b>`).join('')}</div>`
      : '';
  };
  const firmHtml = (f) =>
    f.length
      ? `<div class="firm"><b>${esc(f[0])}</b>${f
          .slice(1)
          .map((t) => `<span>${esc(t)}</span>`)
          .join('')}</div>`
      : '';
  const kopf = ({
    firma,
    kicker,
    titel,
    nrLabel = 'Projekt-Nr.',
    id,
    nummern,
    datum,
    datumLabel,
    untertitel,
  }) =>
    `<div class="head"><div class="head-top">${firmHtml(lines(firma))}${idsHtml(nummern, nrLabel, id, datum, datumLabel)}</div>
      <div class="titelblock">${kicker ? `<div class="kicker">${up(kicker)}</div>` : ''}<h1>${esc(titel)}</h1>${untertitel ? `<div class="law">${esc(untertitel)}</div>` : ''}</div></div>`;
  /* Kopf der Folgeseiten ohne Titel. zeile: zweite Zeile links (z. B. Kunde · Anlage); ohne Firma und ohne Zeile entfällt der linke Block */
  const kopfKlein = ({ firma, zeile, nrLabel = 'Projekt-Nr.', id, nummern }) => {
    const f = lines(firma);
    const z = String(zeile || '').trim();
    const links = f.length
      ? `<div class="firm"><b>${esc(f[0])}</b>${z ? `<span>${esc(z)}</span>` : ''}</div>`
      : z
        ? `<div class="firm"><span>${esc(z)}</span></div>`
        : '';
    return `<div class="head small"><div class="head-top">${links}${idsHtml(nummern, nrLabel, id)}</div></div>`;
  };
  /* Fußzeile (linker Text); „Nr · Seite x von y“ ergänzt layoutReport. text: z. B. Titel, stand: Datum (optional) */
  const fuss = ({ text, stand }) => esc(text) + (stand ? ' · ' + esc(stand) : '');

  /* Abschnitt mit nummerierter Überschrift. inhalt = fertiges HTML; ref = kleiner Text rechts (z. B. Norm) */
  const abschnitt = (titel, inhalt, { ref } = {}) =>
    `<div class="sec">${h2(titel, ref)}${inhalt}</div>`;
  const zwischenTitel = (text) => `<div class="sub-h">${up(text)}</div>`;
  /* Feldliste als Tabellenzeilen (in Karte): Bezeichnung | Wert | Bezeichnung | Wert; wide = eigene Zeile über die volle Breite.
     rows = [{label, value, wide, eval:'warn'}] */
  const kv = (rows) => {
    if (!rows.length) return '';
    const k = (x) => `<td class="k">${esc(x.label)}</td>`;
    const v = (x, span) =>
      `<td class="v${x.value ? '' : ' empty'}${x.eval === 'warn' ? ' warn' : ''}"${span ? ` colspan="${span}"` : ''}>${x.value ? nl(x.value) : '—'}</td>`;
    const out = [];
    let wait = null;
    const flush = () => {
      if (wait) out.push(`<tr>${k(wait)}${v(wait, 3)}</tr>`);
      wait = null;
    };
    rows.forEach((x) => {
      if (x.wide) {
        flush();
        out.push(`<tr>${k(x)}${v(x, 3)}</tr>`);
      } else if (wait) {
        out.push(`<tr>${k(wait)}${v(wait)}${k(x)}${v(x)}</tr>`);
        wait = null;
      } else wait = x;
    });
    flush();
    return `<div class="box"><table class="kv"><colgroup><col style="width:22%"><col style="width:28%"><col style="width:22%"><col style="width:28%"></colgroup><tbody>${out.join('')}</tbody></table></div>`;
  };
  /* Punkt mit fester Farbe (SVG, kein CSS-Kreis – html2canvas) */
  const dot = (farbe, px = 9) =>
    `<svg width="${px}" height="${px}" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="${COL[farbe] || COL.na}"/></svg>`;
  /* Checkliste als Tabelle Nr. | Prüfpunkt | i.O. | n.i.O. | entf.
     items = [{label, value, eval:'ok'|'bad'|'na', mangel (Text), hinweis (Text, optional)}]; Altwert „Mangel“ zählt als n.i.O.
     nrPrefix (optional): Abschnittsnummer für 5.1, 5.2 …; true = Nummer des Abschnitts, der gleich danach folgt
     legende (optional): true = Zeile „i.O. = in Ordnung …“ unter der Tabelle */
  const checkliste = (items, { nrPrefix, legende } = {}) => {
    if (!items.length) return '';
    const pre = nrPrefix === true ? n + 1 : nrPrefix || '';
    const kind = (x) =>
      x.eval === 'ok' || x.eval === 'bad' || x.eval === 'na'
        ? x.eval
        : x.value === 'Mangel'
          ? 'bad'
          : '';
    const rows = items
      .map((x, i) => {
        const k = kind(x);
        const nr = pre ? `${pre}.${i + 1}` : String(i + 1);
        const cell = (col) => `<td class="c">${k === col ? dot(col) : ''}</td>`;
        const extra = (cls, wort, text) =>
          `<tr class="${cls}"><td></td><td colspan="4"><b>${wort}${pre ? ' ' + nr : ''}:</b> ${esc(text)}</td></tr>`;
        return (
          `<tr><td class="nr">${nr}</td><td>${esc(x.label)}${k === '' && x.value && x.value !== '—' ? ' – ' + esc(x.value) : ''}</td>${cell('ok')}${cell('bad')}${cell('na')}</tr>` +
          (x.mangel ? extra('mangel', 'Mangel', x.mangel) : '') +
          (x.hinweis ? extra('hinweis', 'Hinweis', x.hinweis) : '')
        );
      })
      .join('');
    const leg = legende
      ? `<div class="legend"><span>${dot('ok', 7)}i.O. = in Ordnung</span><span>${dot('bad', 7)}n.i.O. = nicht in Ordnung</span><span>${dot('na', 7)}entf. = entfällt</span></div>`
      : '';
    return `<div class="box"><table class="chk"><thead><tr><th class="nr">NR.</th><th>PRÜFPUNKT</th><th class="c">I.O.</th><th class="c">N.I.O.</th><th class="c">ENTF.</th></tr></thead><tbody>${rows}</tbody></table></div>${leg}`;
  };

  /* Umbrechbare Tabelle als Block (layoutReport: split:true, Überschrift hat Klasse „tt“ für „(Fortsetzung)“).
     head: Liste aus Text oder {t, w:'26%', num:true}; rows: Liste aus Zellen-Listen oder {cls:'sum'|'tot', cells:[…]};
     Zelle: Text oder {t, span:Spalten, cls:'k'|'lbl'|'ev ok'|'num'|'date', html:'…' (Rohtext statt t)} */
  const tabelle = ({ titel, ref, head, rows }) => {
    const th = head
      .map((h) => {
        h = typeof h === 'object' ? h : { t: h };
        return `<th${h.num ? ' class="num"' : ''}${h.w ? ` style="width:${h.w}"` : ''}>${up(h.t)}</th>`;
      })
      .join('');
    const td = (c) => {
      c = typeof c === 'object' && c ? c : { t: c };
      return `<td${c.cls ? ` class="${c.cls}"` : ''}${c.span ? ` colspan="${c.span}"` : ''}>${c.html != null ? c.html : esc(c.t)}</td>`;
    };
    const tr = (r) => {
      const o = Array.isArray(r) ? { cells: r } : r;
      return `<tr${o.cls ? ` class="${o.cls}"` : ''}>${o.cells.map(td).join('')}</tr>`;
    };
    return {
      split: true,
      html: `<div class="sec">${titel ? h2(titel, ref) : ''}<div class="box"><table><thead><tr>${th}</tr></thead><tbody>${rows.map(tr).join('')}</tbody></table></div></div>`,
    };
  };

  /* Kacheln (Ergebnis-Leiste, mittig; {links:true} = Text linksbündig). tiles = [{art:'ok'|'bad'|'warn'|'primary'|'', lab, val, sub (Text), subHtml (fertiges HTML)}]
     spalten: CSS für grid-template-columns, wenn nicht 1.25fr 1fr 1fr (Standard bei 3 Kacheln) */
  const kacheln = (tiles, { spalten, links } = {}) =>
    `<div class="status${links ? ' links' : ''}"${spalten ? ` style="grid-template-columns:${spalten}"` : ''}>${tiles
      .map(
        (t) =>
          `<div class="tile ${t.art || ''}"><div class="lab">${up(t.lab)}</div><div class="val">${esc(t.val || '—')}</div><div class="sub">${t.subHtml != null ? t.subHtml : esc(t.sub || '')}</div></div>`,
      )
      .join('')}</div>`;

  /* Hinweiskasten. art:'def' = rot (Auffälligkeiten); liste = Aufzählung, sonst text (leer = „—“) */
  const notiz = ({ titel, text, liste, art }) =>
    `<div class="note${art ? ' ' + art : ''}"><b>${up(titel)}</b>${liste ? `<ul>${liste.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>` : text ? nl(text) : '—'}</div>`;
  /* Rechtstext/Hinweise: absaetze = [{titel:'Betreiberhinweis.', text}] oder Texte */
  const rechtstext = (absaetze) =>
    `<div class="legal">${absaetze.map((a) => (typeof a === 'string' ? `<p>${esc(a)}</p>` : `<p>${a.titel ? `<b>${esc(a.titel)}</b> ` : ''}${esc(a.text)}</p>`)).join('')}</div>`;

  /* Unterschriften: tech/kunde = {bild (data:image/png|jpeg;base64), name (Text unter der Linie)}; labels = {tech, kunde}.
     Die Kundenunterschrift wird immer gedruckt, wenn ein Bild in den Daten ist (auch alte). kompakt: niedrigere Felder (Logbuch) */
  const bildOk = (s) =>
    typeof s === 'string' && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(s);
  const img = (s) => (bildOk(s) ? `<img src="${s}" alt="">` : '');
  const unterschrift = ({
    tech = {},
    kunde = {},
    labels = {},
    kompakt,
  } = {}) => `<div class="sign${kompakt ? ' kompakt' : ''}">
    <div><b>${up(labels.tech || 'Monteur / Prüfer')}</b><span class="space">${img(tech.bild)}</span><span class="cap">${esc(tech.name || 'Name, Datum')}</span></div>${
      bildOk(kunde.bild)
        ? `
    <div><b>${up(labels.kunde || 'Kunde / Betreiber')}</b><span class="space">${img(kunde.bild)}</span><span class="cap">${esc(kunde.name || 'Name')}</span></div>`
        : ''
    }</div>`;

  return {
    esc,
    nl,
    up,
    icon,
    pill,
    dot,
    kopf,
    kopfKlein,
    fuss,
    abschnitt,
    zwischenTitel,
    kv,
    checkliste,
    tabelle,
    kacheln,
    notiz,
    rechtstext,
    unterschrift,
  };
}
/* ===== Ende Bausteine ===== */
