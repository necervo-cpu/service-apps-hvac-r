/* app-bericht.js – PDF-Bericht: Bausteine der Berichtsseiten (Layout in shared/pdf*.js). */
'use strict';
/* ====== PDF ====== */
/* pdfName, isStandalone, layoutReport, reportPdfBlob stehen in shared/pdf.js, die Bausteine in shared/pdf-bausteine.js, das CSS in shared/pdf.css */
function pdfBarHtml() {
  if (!lastPdf || lastPdf.id !== view.id) return '';
  return `<button type="button" class="btn-primary" data-act="sharepdf">Teilen</button>${isStandalone() ? '' : `<a class="btn-secondary" href="${lastPdf.url}" download="${esc(lastPdf.file.name)}" target="_blank" rel="noopener">Öffnen</a>`}`;
}
function uniq(a) {
  return [...new Set(a)];
}
function gasDia(r) {
  const u = r.unit,
    a = r.asg;
  if (!u || !a) return null;
  if (a.red)
    return u.klasse <= 35 || (u.klasse === 42 && u.k42) ? 9.5 : u.klasse <= 60 ? 12.7 : 15.9;
  return a.port.gas_mm;
}
/* Bericht-Daten für das PDF (Auslegung p, gewähltes Außengerät x) – reportParts baut daraus die Seitenteile */
function buildReport(p, x) {
  return { p, x, firma: settings.firma || '', datenstand: dataInfo };
}
function reportParts(r) {
  const { p, x } = r,
    o = x.odu,
    B = pdfBausteine(),
    esc = B.esc;
  const TITEL = 'Daikin Multisplit R32';
  const id = p.nr || '—',
    datum = fmtDate(p.datum) || '';
  const reds = uniq(x.rows.filter((q) => q.asg && q.asg.red).map((q) => q.asg.red));
  const head = B.nKopf({
    firma: r.firma,
    titel: ['Auslegung', TITEL],
    nummern: [
      { label: 'Projekt-Nr.', wert: id },
      { label: 'Datum', wert: datum },
    ],
  });
  const smallHead = B.nKopfKlein({
    firma: r.firma,
    zeile: [p.kunde, TITEL].filter(Boolean).join(', '),
    nummern: [{ label: 'Projekt-Nr.', wert: id }],
  });
  const foot = B.nFuss({ text: 'Auslegung ' + TITEL, stand: datum });
  const blocks = [];
  const spalten = [{ label: 'Außengerät', wert: o.id }];
  if (p.bearbeiter) spalten.push({ label: 'Bearbeiter', wert: p.bearbeiter });
  blocks.push({
    html: B.nHaupt({
      label: 'Ergebnis',
      wert: 'Freigegeben',
      art: 'ok',
      pill: 'Alle geprüften Daikin-Vorgaben eingehalten',
      sub: 'Interne Kalkulation',
      spalten,
    }),
  });
  blocks.push({
    html: B.nAbschnitt(
      '1',
      'Kunde und Objekt',
      B.nZeilen([
        { label: 'Kunde / Objekt', value: p.kunde },
        { label: 'Projektnummer', value: p.nr },
        { label: 'Datum', value: datum },
        { label: 'Bearbeiter', value: p.bearbeiter },
      ]),
    ),
  });
  const raumKopf = [
    { t: 'Nr.' },
    { t: 'Raum', u: 'Fläche · Bedarf' },
    { t: 'Innengerät', u: 'Klasse' },
    { t: 'Einzel / Multi', u: 'kW kühlen / heizen' },
    { t: 'Anschluss', u: 'Port · Gas-Ø' },
    { t: 'Rohr', u: 'Länge · Höhe' },
  ];
  const raumZeilen = x.rows.map((q) => {
    const b = E.bedarfKw(q.room, DB),
      u = q.unit,
      sub = (t) => `<span class="n-room">${esc(t)}</span>`;
    const flBedarf = [q.room.flaeche ? q.room.flaeche + ' m²' : '', b != null ? fmt(b) + ' kW' : '']
      .filter(Boolean)
      .join(' · ');
    const einzel = `${fmt(u.kwK != null ? u.kwK : u.kw)} / ${u.kwH != null ? fmt(u.kwH) : '—'} kW`;
    const multi = q.mk != null ? `${fmt(q.mk, 2)} / ${fmt(q.mh, 2)} kW` : '—';
    const portText = `${q.asg.port.port} (Ø ${fmt(q.asg.port.gas_mm)})${q.asg.red ? ' + Red. ' + q.asg.red : ''}`;
    const rohrText = q.laenge != null ? `${fmt(q.laenge)} m` : '—';
    return [
      esc(String(q.i + 1)),
      `<b>${esc(q.room.name || '—')}</b>${flBedarf ? sub(flBedarf) : ''}`,
      `<b>${esc(u.modell)}</b>${sub('Klasse ' + u.klasse)}`,
      `<span class="n-num">${esc(einzel)}</span>${sub('Multi: ' + multi)}`,
      `${esc(portText)}${sub('Gas-Ø ' + fmt(gasDia(q)) + ' mm')}`,
      `<span class="n-num">${esc(rohrText)}</span>${sub('Höhe ' + (q.hoehe ? fmt(q.hoehe) : '0') + ' m')}`,
    ];
  });
  const multiHinweis = x.multi
    ? `<div class="n-sub">Multi = Leistung je Raum bei gleichzeitigem Betrieb aller Innengeräte (Nennwert). Quelle: ${esc(x.multi.quelle)}.${x.multi.vorl ? ' Werte dieser Kombination laut Daikin vorläufig.' : ''}</div>`
    : '';
  blocks.push({
    html: B.nAbschnitt(
      '2',
      'Räume und Innengeräte',
      B.nListe(raumKopf, raumZeilen) + multiHinweis,
    ),
  });
  blocks.push({
    html: B.nAbschnitt(
      '3',
      'Außengerät ' + o.id,
      B.nZeilen([
        { label: 'Nennleistung kühlen', value: fmt(o.kuehlen_kw) + ' kW' },
        { label: 'Nennleistung heizen', value: fmt(o.heizen_kw) + ' kW' },
        { label: 'Rohr je Raum', value: `${fmt(o.rohr_raum_min_m)}–${fmt(o.rohr_raum_max_m)} m` },
        { label: 'Rohr gesamt max.', value: fmt(o.rohr_gesamt_max_m) + ' m' },
        { label: 'Summe Innengeräte', value: `${fmt(x.sum)} kW (max. ${fmt(x.sumMax)} kW)` },
        { label: 'Anzahl Innengeräte', value: `${x.rows.length} (zulässig ${o.ig_min}–${o.ig_max})` },
        { label: 'Rohrlänge gesamt', value: x.total != null ? fmt(x.total) + ' m' : '' },
        { label: 'Flüssigkeitsleitung', value: 'Ø 6,35 mm je Innengerät' },
        {
          label: 'Zusätzliches R32',
          value:
            x.extra != null
              ? `${fmt(x.extra)} kg (ab ${fmt(o.nachfuell_ab_m)} m, ${fmt(o.nachfuell_kg_je_m * 1000, 0)} g/m)`
              : '',
        },
        {
          label: 'R32 gesamt',
          value:
            x.charge != null
              ? `${fmt(x.charge, 2)} kg (Werk ${fmt(o.werk_kg, 2)} kg)`
              : '',
          calc: true,
        },
        {
          label: 'Höhe Außengerät höher / niedriger',
          value: `${fmt(o.hoehe_ag_oben_m)} m / ${fmt(o.hoehe_ag_unten_m)} m`,
        },
        {
          label: 'Höhe Innengerät–Innengerät',
          value: `${fmt(o.hoehe_ig_ig_m)} m / ${fmt(o.hoehe_ig_ig_unten_m)} m`,
        },
      ]),
    ),
  });
  blocks.push({
    html: B.nAbschnitt(
      '4',
      'Elektrischer Anschluss',
      B.nZeilen([
        { label: 'Stromversorgung', value: '1~ / 50 Hz / 220–240 V' },
        { label: 'Stromaufnahme Außengerät', value: o.strom_a != null ? fmt(o.strom_a) + ' A' : '' },
        {
          label: 'Absicherung (empf. Hauptschalter)',
          value: o.hauptschalter_a != null ? o.hauptschalter_a + ' A' : '',
        },
        { label: 'FI-Schutzschalter', value: 'immer; nach örtlichen Vorschriften' },
        {
          label: 'Netzleitung',
          value: `3-adrig, min. ${fmt(o.netzleitung_min_mm2)} mm² (nach Stromstärke)`,
        },
        {
          label: 'Verbindungsleitung je Raum',
          value: `4-adrig, min. ${fmt(o.verbindungsleitung_min_mm2)} mm² (harmonisiert, doppelt isoliert)`,
        },
      ]),
    ),
  });
  blocks.push({
    html: B.nAbschnitt(
      '5',
      'Montagehinweise',
      B.nZeilen([
        {
          label: 'Reduzierstücke (Daikin-Nr.)',
          value: reds.length
            ? `${reds.join(', ')} (${E.REDUZIERER_INFO})`
            : 'Keine Reduzierstücke erforderlich',
        },
        {
          label: 'Mindest-Rohrlänge und Isolierung',
          value: `Kürzeste Rohrlänge je Raum ${fmt(o.rohr_raum_min_m)} m, Rohre getrennt isolieren, R32-Mindestfläche je Raum beachten`,
        },
        {
          label: 'R32-Mindestfläche je Raum',
          value: x.rows
            .map(
              (q) =>
                `Raum ${q.i + 1}: ${q.amin ? fmt(Math.ceil(q.amin * 10) / 10) + ' m²' : 'keine Anforderung'}`,
            )
            .join(', '),
        },
      ]),
    ),
  });
  if (x.warns.length) {
    blocks.push({
      html: B.nAuff(uniq(x.warns).map((w) => ({ nr: '', text: w }))),
    });
  }
  const bem = String(p.bemerkung || '').trim();
  if (bem) {
    const absaetze = bem.split(/\n{2,}/).filter((t) => t.trim());
    absaetze.forEach((abs, idx) => {
      const htmlText = B.nl(abs.trim());
      blocks.push({
        html:
          idx === 0
            ? B.nAbschnitt('', 'Bemerkungen', `<div class="n-legal"><p>${htmlText}</p></div>`)
            : `<div class="n-sec n-sec--teil"><div class="n-legal"><p>${htmlText}</p></div></div>`,
      });
    });
  }
  blocks.push({
    html: B.nHinweis([
      {
        titel: 'Wichtiger Hinweis.',
        text: 'Dieses Dokument ist das Ergebnis einer Kombinationshilfe zur ersten Prüfung. Die endgültige Kalkulation muss vor Angebot, Bestellung und Ausführung anhand der Daikin-Unterlagen geprüft werden.',
      },
      {
        titel: 'Geprüft nach:',
        text: `${o.quelle}. Datenstand: ${r.datenstand}.`,
      },
      {
        text: 'Die Auslegung ersetzt weder Heizlast-/Kühllastberechnung noch die Installationsanleitung des Herstellers.',
      },
    ]),
  });
  return { blocks, pageClass: 'neu', head, smallHead, foot, id, maxSeiten: 30 };
}
