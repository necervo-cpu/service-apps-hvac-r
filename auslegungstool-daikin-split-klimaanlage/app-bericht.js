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
  const TITEL = 'Daikin Multisplit R32',
    SUB = 'Interne Kalkulation · Daikin R32 Multisplit';
  const id = p.nr || '—',
    datum = fmtDate(p.datum) || '';
  const reds = uniq(x.rows.filter((q) => q.asg && q.asg.red).map((q) => q.asg.red));
  const head = B.kopf({
    firma: r.firma,
    kicker: 'Auslegung',
    titel: TITEL,
    id,
    untertitel: 'Interne Kalkulation',
  });
  const smallHead = B.kopfKlein({
    firma: r.firma,
    zeile: SUB,
    titel: 'Auslegung ' + TITEL,
    id,
  });
  const foot = B.fuss({ text: 'Auslegung ' + TITEL, stand: datum });
  const blocks = [];
  const tiles = [
    {
      art: 'ok',
      lab: 'Ergebnis',
      val: 'Freigegeben',
      sub: 'Kombination freigegeben: Ja – alle geprüften Daikin-Vorgaben eingehalten',
    },
  ];
  if (datum) {
    tiles.push({ lab: 'Datum', val: datum });
  }
  if (p.bearbeiter) {
    tiles.push({ lab: 'Bearbeiter', val: p.bearbeiter });
  }
  blocks.push({
    html: B.kacheln(tiles, {
      links: true,
      spalten: ['1fr', '1.25fr 1fr', '1.25fr 1fr 1fr'][tiles.length - 1],
    }),
  });
  blocks.push({
    html: B.abschnitt(
      'Kunde und Objekt',
      B.kv([
        { label: 'Kunde / Objekt', value: p.kunde },
        { label: 'Projektnummer', value: p.nr },
        { label: 'Datum', value: fmtDate(p.datum) },
        { label: 'Bearbeiter', value: p.bearbeiter },
      ]),
    ),
  });
  const rows = x.rows.map((q) => {
    const b = E.bedarfKw(q.room, DB),
      u = q.unit,
      kl = (t) => `<span class="small">${t}</span>`;
    return [
      `${q.i + 1} · ${q.room.name || '—'}`,
      { html: `<b>${esc(u.modell)}</b>${kl('Klasse ' + esc(u.klasse))}` },
      { t: q.room.flaeche ? q.room.flaeche + ' m²' : '—', cls: 'num' },
      { t: b != null ? fmt(b) + ' kW' : '—', cls: 'num' },
      {
        t: `${fmt(u.kwK != null ? u.kwK : u.kw)} / ${u.kwH != null ? fmt(u.kwH) : '—'} kW`,
        cls: 'num',
      },
      {
        html: `<b>${esc(q.mk != null ? fmt(q.mk, 2) + ' / ' + fmt(q.mh, 2) + ' kW' : '—')}</b>`,
        cls: 'num',
      },
      {
        html: `${esc(q.asg.port.port)} (Ø${esc(fmt(q.asg.port.gas_mm))})${q.asg.red ? ' + Red. ' + esc(q.asg.red) : ''}${kl('Gas-Ø ' + esc(fmt(gasDia(q))) + ' mm')}`,
      },
      {
        html: `${esc(q.laenge != null ? fmt(q.laenge) + ' m' : '—')}${kl('Höhe ' + esc(q.hoehe ? fmt(q.hoehe) : '0') + ' m')}`,
        cls: 'num',
      },
    ];
  });
  blocks.push(
    B.tabelle({
      titel: 'Räume und Innengeräte',
      rows,
      head: [
        'Raum',
        'Innengerät',
        { t: 'Fläche', num: 1, w: '8%' },
        { t: 'Bedarf', num: 1, w: '9%' },
        { t: 'Einzel kühl./heiz.', num: 1, w: '13%' },
        { t: 'Multi kühl./heiz.', num: 1, w: '14%' },
        { t: 'Anschluss', w: '15%' },
        { t: 'Rohr', num: 1, w: '10%' },
      ],
    }),
  );
  if (x.multi)
    blocks.push({
      html: `<div class="none">Multi = Leistung je Raum bei gleichzeitigem Betrieb aller Innengeräte (Nennwert). Quelle: ${esc(x.multi.quelle)}.${x.multi.vorl ? ' Werte dieser Kombination laut Daikin vorläufig.' : ''}</div>`,
    });
  blocks.push({
    html: B.abschnitt(
      'Außengerät ' + o.id,
      B.kv([
        { label: 'Nennleistung kühlen', value: fmt(o.kuehlen_kw) + ' kW' },
        { label: 'Nennleistung heizen', value: fmt(o.heizen_kw) + ' kW' },
        {
          label: 'Rohr je Raum',
          value: `${fmt(o.rohr_raum_min_m)}–${fmt(o.rohr_raum_max_m)} m`,
        },
        { label: 'Rohr gesamt max.', value: fmt(o.rohr_gesamt_max_m) + ' m' },
        { label: 'Summe Innengeräte', value: `${fmt(x.sum)} kW (max. ${fmt(x.sumMax)} kW)` },
        {
          label: 'Anzahl Innengeräte',
          value: `${x.rows.length} (zulässig ${o.ig_min}–${o.ig_max})`,
        },
        { label: 'Rohrlänge gesamt', value: x.total != null ? fmt(x.total) + ' m' : '' },
        { label: 'Flüssigkeitsleitung', value: 'Ø6,35 mm je Innengerät' },
        {
          label: 'Zusätzliches R32',
          value:
            x.extra != null
              ? fmt(x.extra) +
                ' kg (ab ' +
                fmt(o.nachfuell_ab_m) +
                ' m, ' +
                fmt(o.nachfuell_kg_je_m * 1000, 0) +
                ' g/m)'
              : '',
          wide: true,
        },
        {
          label: 'R32 gesamt',
          value:
            x.charge != null
              ? fmt(x.charge, 2) + ' kg (Werk ' + fmt(o.werk_kg, 2) + ' kg)'
              : '',
          wide: true,
        },
        {
          label: 'Höhe AG höher / niedriger',
          value: `${fmt(o.hoehe_ag_oben_m)} m / ${fmt(o.hoehe_ag_unten_m)} m`,
          wide: true,
        },
        {
          label: 'Höhe IG–IG',
          value: `${fmt(o.hoehe_ig_ig_m)} m / ${fmt(o.hoehe_ig_ig_unten_m)} m`,
          wide: true,
        },
      ]),
    ),
  });
  blocks.push({
    html: B.abschnitt(
      'Elektrischer Anschluss',
      B.kv([
        { label: 'Stromversorgung', value: '1~ / 50 Hz / 220–240 V' },
        {
          label: 'Stromaufnahme Außengerät',
          value: o.strom_a != null ? fmt(o.strom_a) + ' A' : '',
        },
        {
          label: 'Absicherung (empf. Hauptschalter)',
          value: o.hauptschalter_a != null ? o.hauptschalter_a + ' A' : '',
        },
        { label: 'FI-Schutzschalter', value: 'immer; nach örtlichen Vorschriften' },
        {
          label: 'Netzleitung',
          value: '3-adrig, min. ' + fmt(o.netzleitung_min_mm2) + ' mm² (nach Stromstärke)',
          wide: true,
        },
        {
          label: 'Verbindungsleitung je Raum',
          value:
            '4-adrig, min. ' +
            fmt(o.verbindungsleitung_min_mm2) +
            ' mm² (harmonisiert, doppelt isoliert)',
          wide: true,
        },
      ]),
    ),
  });
  blocks.push({
    html: B.abschnitt(
      'Montagehinweise',
      `<div>${reds.length ? `<b>Reduzierstücke (Daikin-Nr.):</b> ${reds.map(esc).join(', ')} <span style="color:var(--ink-3)">(${esc(E.REDUZIERER_INFO)})</span><br>` : 'Keine Reduzierstücke erforderlich.<br>'}
    Kürzeste Rohrlänge je Raum ${esc(fmt(o.rohr_raum_min_m))} m · Rohre getrennt isolieren · R32: Mindestfläche je Raum beachten.<br>
    <b>R32-Mindestfläche je Raum:</b> ${x.rows.map((q) => `Raum ${q.i + 1}: ${q.amin ? esc(fmt(Math.ceil(q.amin * 10) / 10)) + ' m²' : 'keine Anforderung'}`).join(' · ')}</div>`,
    ),
  });
  if (x.warns.length)
    blocks.push({
      html: B.notiz({
        titel: 'Auffälligkeiten / Hinweise',
        liste: uniq(x.warns),
        art: 'warn',
      }),
    });
  if (String(p.bemerkung || '').trim())
    blocks.push({ splitText: { titel: 'Bemerkungen', text: String(p.bemerkung) } });
  blocks.push({
    html: B.notiz({
      titel: 'Wichtiger Hinweis',
      text: 'Dieses Dokument ist das Ergebnis einer Kombinationshilfe zur ersten Prüfung. Die endgültige Kalkulation muss vor Angebot, Bestellung und Ausführung anhand der Daikin-Unterlagen geprüft werden.',
    }),
  });
  blocks.push({
    html: B.rechtstext([
      { titel: 'Geprüft nach:', text: `${o.quelle}. Datenstand: ${r.datenstand}.` },
      'Die Auslegung ersetzt weder Heizlast-/Kühllastberechnung noch die Installationsanleitung des Herstellers.',
    ]),
  });
  return { blocks, head, smallHead, foot, id, maxSeiten: 30 };
}
