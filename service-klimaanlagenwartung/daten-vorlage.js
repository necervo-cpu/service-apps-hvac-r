// Daten: Feld-Definition der Wartungsvorlage (Bewertungen, Kältemittel-GWP, Verdampfer-Felder, TEMPLATE).
'use strict';

/* =====================================================================
   Feld-Definition – entspricht dem Blatt "Datenbank_Wartung_VDMA" in "Datenbank_Kältewartung-Service".
   col = exakter Spaltenname im Google Sheet.
   group = Zwischenüberschrift in der App, show = nur anzeigen, wenn …
   Checklisten: i.O. / n.i.O. / entfällt – wie die Auswahllisten im Sheet (alter Wert „Mangel“ wird beim Laden zu „n.i.O.“).
   ===================================================================== */
const OK3 = ['i.O.', 'n.i.O.', 'entfällt'];
const MANGEL_SUFFIX = ' – Mangel';
const BEWERTUNG = ['i.O.', 'n.i.O.'];
const BEWERTUNG_KLASSEN = ['ok', 'bad'];
const BEWERTUNG_ALT = new Map([
  ['Ja', 'ok'],
  ['Nein', 'bad'],
  ['Mangel', 'bad'],
]);
function bewertungArt(x) {
  if (x === 'i.O.') {
    return 'ok';
  }
  if (x === 'n.i.O.') {
    return 'bad';
  }
  return BEWERTUNG_ALT.has(x) ? BEWERTUNG_ALT.get(x) : 'none';
}
const ok = (id, col, label, pdf, hint, extra) =>
  Object.assign({ id, col, label, pdf, hint, type: 'okfail' }, extra || {});
const druck = (id, col, label, pdf, hint) => ({
  id,
  col,
  label,
  pdf,
  hint,
  group: 'Messwerte',
  type: 'number',
  unit: 'bar',
  min: -1,
  max: 150,
});
const temp = (id, col, label, pdf, hint) => ({
  id,
  col,
  label,
  pdf,
  hint,
  group: 'Messwerte',
  type: 'number',
  unit: '°C',
  min: -80,
  max: 180,
});
const kelvin = (id, col, label, pdf, hint) => ({
  id,
  col,
  label,
  pdf,
  hint,
  group: 'Messwerte',
  type: 'number',
  unit: 'K',
  min: -30,
  max: 80,
});
const luft = (id, col, label, pdf) => ({
  id,
  col,
  label,
  pdf,
  group: 'Messwerte',
  type: 'number',
  unit: '°C',
  min: -30,
  max: 70,
});
// Altfeld (nicht mehr in der Eingabe): wird nur angezeigt/übertragen, wenn ein alter Wert vorhanden ist – nichts wird gelöscht
const legacy = (f) => Object.assign({ legacy: true }, f);
const medium = (id, col, pdf) => ({
  id,
  col,
  label: 'Mediumstemperatur Ein- / Austritt (°C)',
  pdf,
  group: 'Messwerte',
  type: 'text',
  ph: '22,4 / 34,6',
});
// GWP-Werte (AR4, wie in der F-Gase-Verordnung) für das CO₂-Äquivalent
const GWP = {
  R32: 675,
  R410A: 2088,
  R407C: 1774,
  R404A: 3922,
  R134A: 1430,
  R449A: 1397,
  R448A: 1387,
  R452A: 2140,
  R454B: 466,
  R454C: 148,
  R513A: 631,
  R1234YF: 4,
  R1234ZE: 7,
  R290: 3,
  R600A: 3,
  R744: 1,
  R717: 0,
  R22: 1810,
};
const gwpOf = (km) =>
  GWP[
    String(km || '')
      .toUpperCase()
      .replace(/[\s\-()]/g, '')
  ];
const HINWEIS =
  'Wartung nach VDMA-Einheitsblatt 24186-3 (Leistungsprogramm für die Wartung von kältetechnischen Geräten und Anlagen). ' +
  'Anlagen mit fluorierten Treibhausgasen ab 5 t CO₂-Äquivalent unterliegen der Pflicht zur regelmäßigen Dichtheitskontrolle nach Verordnung (EU) 2024/573. ' +
  'Eine regelmäßige Wartung sichert Betriebssicherheit, Hygiene und einen effizienten Energieverbrauch.';

/* Verdampfer / Innengeräte: bis zu VA_MAX Geräte. Gerät 1 behält die bisherigen Feld-IDs (vaZust …) und Spaltennamen
   („Verdampfer Zustand & Sauberkeit“ …); Gerät n ≥ 2 heißt va2Zust … bzw. „Verdampfer 2 Zustand & Sauberkeit“ … */
const VA_MAX = 15;
const vaCount = (v) => {
  const n = parseInt(String((v && v.vaAnz) ?? '').trim(), 10);
  return n >= 1 && n <= VA_MAX ? n : 1;
};
function verdFields(n) {
  const id = (s) => 'va' + (n > 1 ? n : '') + s,
    col = (s) => 'Verdampfer ' + (n > 1 ? n + ' ' : '') + s;
  const dev = (f) =>
    Object.assign({ dev: n }, n > 1 ? { show: (v) => vaCount(v) >= n } : {}, f);
  const P = { group: 'Prüfpunkte' };
  return [
    dev({
      id: id('Raum'),
      col: col('Raum'),
      label: 'Raum / Bezeichnung',
      pdf: 'Raum',
      type: 'text',
      ph: 'Büro',
      group: 'Gerät',
      hdr: true,
      inTitle: true,
    }),
    dev({
      id: id('Modell'),
      col: col('Modell'),
      label: 'Modell',
      pdf: 'Modell',
      type: 'text',
      ph: 'FTXM25R',
      group: 'Gerät',
      hdr: true,
      inTitle: true,
    }),
    dev({
      id: id('Sn'),
      col: col('Seriennummer'),
      label: 'Seriennummer',
      pdf: 'Seriennummer',
      type: 'text',
      group: 'Gerät',
      inTitle: true,
    }),
    dev(
      ok(
        id('Zust'),
        col('Zustand & Sauberkeit'),
        'Äußerlich auf Verschmutzung, Beschädigung und Korrosion geprüft',
        'Zustand & Sauberkeit',
        '',
        P,
      ),
    ),
    dev(
      ok(
        id('Rein'),
        col('Reinigung erfolgt'),
        'Funktionserhaltendes Reinigen',
        'Funktionserhaltendes Reinigen',
        '',
        P,
      ),
    ),
    dev(
      ok(
        id('Vent'),
        col('Ventilator'),
        'Ventilator auf Funktion geprüft',
        'Ventilator',
        '',
        P,
      ),
    ),
    dev(
      ok(
        id('Klap'),
        col('Klappenregelung'),
        'Klappenregelung auf Funktion geprüft',
        'Klappenregelung',
        'Nicht vorhanden: „entfällt“ wählen',
        P,
      ),
    ),
    dev(
      ok(
        id('KondF'),
        col('Kondensatablauf Funktion'),
        'Kondensatablauf auf Funktion geprüft',
        'Kondensatablauf Funktion',
        '',
        P,
      ),
    ),
    dev(
      ok(
        id('KondR'),
        col('Kondensatablauf Reinigung'),
        'Kondensatablauf gereinigt',
        'Kondensatablauf gereinigt',
        '',
        P,
      ),
    ),
    dev(
      ok(
        id('Filt'),
        col('Filter gereinigt / getauscht'),
        'Filter gereinigt bzw. getauscht',
        'Filter gereinigt / getauscht',
        '',
        P,
      ),
    ),
    dev(
      ok(
        id('Dicht'),
        col('Dichtheit'),
        'Kältemittelseitig auf Dichtheit geprüft',
        'Dichtheit kältemittelseitig',
        '',
        P,
      ),
    ),
    dev(
      ok(
        id('Hyg'),
        col('Hygienischer Zustand'),
        'Hygienischer Zustand geprüft',
        'Hygienischer Zustand',
        '',
        P,
      ),
    ),
    dev(
      luft(
        id('Te'),
        col('Lufteintrittstemperatur (°C)'),
        'Lufteintrittstemperatur',
        'Lufteintrittstemperatur',
      ),
    ),
    dev(
      luft(
        id('Ta'),
        col('Luftaustrittstemperatur (°C)'),
        'Luftaustrittstemperatur',
        'Luftaustrittstemperatur',
      ),
    ),
    dev({
      id: id('Dt'),
      col: col('Luft-Spreizung (K)'),
      label: 'Luft-Spreizung ΔT',
      pdf: 'Luft-Spreizung ΔT',
      group: 'Messwerte',
      type: 'calc',
      unit: 'K',
      calc: (v) =>
        isN(v[id('Te')]) && isN(v[id('Ta')])
          ? round(num(v[id('Te')]) - num(v[id('Ta')]), 1)
          : '',
      note: () => 'Eintritt − Austritt (Luft wird abgekühlt)',
    }),
    dev(
      legacy(
        druck(
          id('P'),
          col('Verdampfungsdruck (bar)'),
          'Verdampfungsdruck',
          'Verdampfungsdruck',
          '',
        ),
      ),
    ),
    dev(
      legacy(
        temp(
          id('T'),
          col('Verdampfungstemperatur (°C)'),
          'Verdampfungstemperatur am Verdampferaustritt',
          'Verdampfungstemperatur',
          '',
        ),
      ),
    ),
    dev(legacy(kelvin(id('Ueh'), col('Überhitzung (K)'), 'Überhitzung', 'Überhitzung', ''))),
    dev(
      legacy(
        medium(
          id('Med'),
          col('Mediumstemperatur Ein/Aus (°C)'),
          'Mediumstemp. Ein / Aus (°C)',
        ),
      ),
    ),
    dev({
      id: id('Bem'),
      col: col('Bemerkung'),
      label: 'Bemerkung zu diesem Gerät',
      pdf: 'Bemerkung',
      type: 'longtext',
      wide: true,
      group: 'Bemerkung',
      ph: 'Freitext',
    }),
  ];
}

const TEMPLATE = {
  id: 'klima-wartung',
  title: 'WARTUNGSPROTOKOLL • KÄLTETECHNISCHE ANLAGEN',
  pages: [
    {
      title: 'Anlagen- & Auftragsdaten',
      short: 'Stammdaten',
      header: true,
      fields: [
        {
          id: 'projekt',
          col: 'Projektnummer',
          label: 'Projektnummer',
          type: 'text',
          hint: 'Vorschlag kann überschrieben werden – wird auch der PDF-Dateiname',
          init: () =>
            'KLW-' + today().replace(/-/g, '') + '-' + uid().slice(0, 4).toUpperCase(),
        },
        {
          id: 'datum',
          col: 'Datum',
          label: 'Datum',
          type: 'date',
          notFuture: true,
          init: () => today(),
        },
        {
          id: 'monteur',
          col: 'Monteur',
          label: 'Monteur',
          type: 'text',
          init: () => settings.techniker,
        },
        {
          id: 'kunde',
          col: 'Kunde / Betreiber',
          label: 'Kunden Nr.',
          type: 'text',
          ph: '10234',
        },
        {
          id: 'zust',
          col: 'Zuständigkeit',
          label: 'Zuständigkeit der Anlage',
          type: 'text',
          ph: 'Klimaanlage Büro',
        },
        {
          id: 'anlage',
          col: 'Anlagenbezeichnung',
          label: 'Anlagenbezeichnung',
          type: 'text',
          ph: 'Split-Klimaanlage Praxis 2. OG',
        },
        {
          id: 'herst',
          col: 'Hersteller',
          label: 'Hersteller',
          type: 'text',
          ph: 'Daikin',
        },
        { id: 'sn', col: 'Seriennummer (S/N)', label: 'Seriennummer (S/N)', type: 'text' },
        {
          id: 'herstDat',
          col: 'Herstellungsdatum',
          label: 'Herstellungsdatum der Anlage',
          pdf: 'Herstellungsdatum',
          type: 'date',
          notFuture: true,
          init: () => today(),
        },
      ],
    },
    {
      title: 'Verdichter',
      pdfTitle: 'Verdrängungs- und Strömungsmaschinen • Verdichter',
      short: 'Verdichter',
      kind: 'check',
      fields: [
        ok(
          'vdZust',
          'Verdichter Zustand & Sauberkeit',
          'Äußerlich auf Verschmutzung, Beschädigung und Korrosion geprüft',
          'Zustand & Sauberkeit',
          '',
          { group: 'Prüfpunkte' },
        ),
        ok(
          'vdRein',
          'Verdichter Reinigung erfolgt',
          'Funktionserhaltendes Reinigen',
          'Funktionserhaltendes Reinigen',
          '',
          { group: 'Prüfpunkte' },
        ),
        ok(
          'vdBef',
          'Verdichter Befestigung & Laufgeräusche',
          'Auf Befestigung und Laufgeräusche geprüft',
          'Befestigung & Laufgeräusche',
          '',
          { group: 'Prüfpunkte' },
        ),
        ok(
          'vdKwh',
          'Verdichter Kurbelwannenheizung',
          'Kurbelwannenheizung auf Funktion geprüft',
          'Kurbelwannenheizung',
          'Nicht vorhanden: „entfällt“ wählen',
          { group: 'Prüfpunkte' },
        ),
        ok(
          'vdDicht',
          'Verdichter Dichtheit',
          'Kältemittelseitig auf Dichtheit geprüft',
          'Dichtheit kältemittelseitig',
          '',
          { group: 'Prüfpunkte' },
        ),
        ok(
          'vdLauf',
          'Verdichter Laufgeräusche / Schwingungen',
          'Laufgeräusche / Schwingungen',
          'Laufgeräusche / Schwingungen',
          '',
          { group: 'Prüfpunkte' },
        ),
        ok(
          'vdVent',
          'Verdichter Arbeitsventile',
          'Arbeitsventile (Serviceventile) auf Funktion und Dichtheit geprüft',
          'Arbeitsventile',
          'Ventile gängig, Kappen dicht',
          { group: 'Prüfpunkte' },
        ),
        druck('vdPs', 'Verdichter Saugdruck (bar)', 'Saugdruck', 'Saugdruck', ''),
        temp(
          'vdTs',
          'Verdichter Sauggastemperatur (°C)',
          'Sauggastemperatur vor dem Verdichter',
          'Sauggastemperatur',
          '',
        ),
        druck(
          'vdPd',
          'Verdichter Verdichtungsdruck (bar)',
          'Verdichtungsdruck',
          'Verdichtungsdruck',
          '',
        ),
      ],
    },
    {
      title: 'Verflüssiger',
      pdfTitle: 'Wärmetauscher • Verflüssiger (Luft / Kältemittel)',
      short: 'Verflüssiger',
      kind: 'check',
      fields: [
        ok(
          'vfZust',
          'Verflüssiger Zustand & Sauberkeit',
          'Äußerlich auf Verschmutzung, Beschädigung und Korrosion geprüft',
          'Zustand & Sauberkeit',
          '',
          { group: 'Prüfpunkte' },
        ),
        ok(
          'vfRein',
          'Verflüssiger Reinigung erfolgt',
          'Funktionserhaltendes Reinigen',
          'Funktionserhaltendes Reinigen',
          '',
          { group: 'Prüfpunkte' },
        ),
        ok(
          'vfVent',
          'Verflüssiger Ventilator',
          'Ventilator auf Befestigung und Funktion geprüft',
          'Ventilator',
          '',
          { group: 'Prüfpunkte' },
        ),
        ok(
          'vfDicht',
          'Verflüssiger Dichtheit',
          'Kältemittelseitig auf Dichtheit geprüft',
          'Dichtheit kältemittelseitig',
          '',
          { group: 'Prüfpunkte' },
        ),
        ok(
          'vfLam',
          'Verflüssiger Lamellenpaket',
          'Lamellenpaket frei von Verformungen',
          'Lamellenpaket',
          '',
          { group: 'Prüfpunkte' },
        ),
        luft(
          'vfTe',
          'Verflüssiger Lufteintrittstemperatur (°C)',
          'Lufteintrittstemperatur',
          'Lufteintrittstemperatur',
        ),
        luft(
          'vfTa',
          'Verflüssiger Luftaustrittstemperatur (°C)',
          'Luftaustrittstemperatur',
          'Luftaustrittstemperatur',
        ),
        {
          id: 'vfDt',
          col: 'Verflüssiger Luft-Spreizung (K)',
          label: 'Luft-Spreizung ΔT',
          pdf: 'Luft-Spreizung ΔT',
          group: 'Messwerte',
          type: 'calc',
          unit: 'K',
          calc: (v) =>
            isN(v.vfTe) && isN(v.vfTa) ? round(num(v.vfTa) - num(v.vfTe), 1) : '',
          note: () => 'Austritt − Eintritt (Luft wird erwärmt)',
        },
        legacy(
          temp(
            'vfTc',
            'Verflüssiger Verflüssigungstemperatur (°C)',
            'Verflüssigungstemperatur',
            'Verflüssigungstemperatur',
            '',
          ),
        ),
        legacy(
          kelvin(
            'vfUk',
            'Verflüssiger Unterkühlung (K)',
            'Unterkühlung am Verflüssigeraustritt',
            'Unterkühlung',
            '',
          ),
        ),
        legacy(
          medium(
            'vfMed',
            'Verflüssiger Mediumstemperatur Ein/Aus (°C)',
            'Mediumstemp. Ein / Aus (°C)',
          ),
        ),
      ],
    },
    {
      title: 'Verdampfer',
      pdfTitle: 'Wärmetauscher • Verdampfer (Luft / Kältemittel)',
      short: 'Verdampfer',
      kind: 'check',
      evap: true,
      fields: [
        {
          id: 'vaAnz',
          col: 'Anzahl Verdampfer',
          label: 'Anzahl Innengeräte (Verdampfer)',
          pdf: 'Anzahl Verdampfer',
          type: 'count',
          init: () => '1',
          hint: 'Für jedes Innengerät gibt es unten eine eigene Karte (bis zu 15).',
        },
      ].concat(...Array.from({ length: VA_MAX }, (_, k) => verdFields(k + 1))),
    },
    {
      title: 'Anlagenteile & Dokumentation',
      pdfTitle: 'Anlagenteile im Kältekreislauf & Dokumentation',
      short: 'Anlagenteile',
      kind: 'check',
      fields: [
        ok(
          'rohr',
          'Rohrleitungen Zustand, Isolierung & Befestigung',
          'Rohrleitungen: Zustand, Isolierung & Befestigung',
          'Rohrleitungen: Zustand, Isolierung & Befestigung',
          '',
        ),
        ok(
          'arm',
          'Armaturen & Kompensatoren Dichtheit',
          'Armaturen & Kompensatoren auf Dichtheit geprüft',
          'Armaturen & Kompensatoren dicht',
          '',
        ),
        ok(
          'mess',
          'Mess- & Anzeigegeräte Funktion',
          'Mess- und Anzeigegeräte: Zustand & Funktion',
          'Mess- & Anzeigegeräte',
          '',
        ),
        ok(
          'doku',
          'Dokumentation & Typenschilder',
          'Dokumentation & Typenschilder auf Vollständigkeit geprüft',
          'Dokumentation & Typenschilder',
          '',
        ),
      ],
    },
    {
      title: 'Zusatzmessungen & Anlagenbetrieb',
      short: 'Zusatz',
      fields: [
        {
          id: 'km',
          col: 'Kältemitteltyp',
          label: 'Kältemitteltyp',
          type: 'text',
          group: 'Kältemittel',
          ph: 'R32',
        },
        {
          id: 'fm',
          col: 'Kältemittel-Füllmenge (kg)',
          label: 'Gesamtfüllmenge',
          pdf: 'Füllmenge',
          type: 'number',
          unit: 'kg',
          min: 0,
          max: 5000,
          group: 'Kältemittel',
          ph: '2,05',
        },
        {
          id: 'co2',
          col: 'CO₂-Äquivalent (t)',
          label: 'CO₂-Äquivalent',
          type: 'calc',
          unit: 't CO₂e',
          group: 'Kältemittel',
          calc: (v) =>
            isN(v.fm) && gwpOf(v.km) != null
              ? round((num(v.fm) * gwpOf(v.km)) / 1000, 3)
              : '',
          note: (v) =>
            v.km && gwpOf(v.km) == null
              ? 'GWP für dieses Kältemittel unbekannt'
              : isN(v.co2)
                ? v.co2 >= 5
                  ? 'ab 5 t: Dichtheitskontrolle Pflicht'
                  : 'unter 5 t: keine Prüfpflicht'
                : 'Füllmenge × GWP',
        },
        {
          id: 'i1',
          col: 'Stromaufnahme Verdichter L1 (A)',
          label: 'Stromaufnahme L1',
          type: 'number',
          unit: 'A',
          min: 0,
          max: 100,
          group: 'Elektrik',
        },
        {
          id: 'i2',
          col: 'Stromaufnahme Verdichter L2 (A)',
          label: 'Stromaufnahme L2',
          type: 'number',
          unit: 'A',
          min: 0,
          max: 100,
          group: 'Elektrik',
          hint: '0 A oder leer bei 1-phasiger Versorgung',
        },
        {
          id: 'i3',
          col: 'Stromaufnahme Verdichter L3 (A)',
          label: 'Stromaufnahme L3',
          type: 'number',
          unit: 'A',
          min: 0,
          max: 100,
          group: 'Elektrik',
          hint: '0 A oder leer bei 1-phasiger Versorgung',
        },
        legacy({
          id: 'strom',
          col: 'Stromaufnahme Verdichter (A)',
          label: 'Stromaufnahme Verdichter (A)',
          pdf: 'Stromaufnahme Verdichter',
          type: 'text',
          group: 'Elektrik',
        }),
        ok(
          'elek',
          'Elektrische Anschlüsse & Schutzleiter',
          'Elektrische Anschlüsse & Schutzleiter',
          'Elektr. Anschlüsse & Schutzleiter',
          '',
          { group: 'Elektrik' },
        ),
        ok(
          'fuehl',
          'Fühler & Sollwerte plausibel',
          'Fühler und Eingangssignale auf Übereinstimmung mit den Sollwerten geprüft',
          'Fühler & Sollwerte',
          'Anzeige der Regelung mit dem Messgerät verglichen',
          { group: 'Elektrik' },
        ),
        ok(
          'notsch',
          'Not- / Reparaturschalter',
          'Not- bzw. Reparaturschalter auf Funktion geprüft',
          'Not- / Reparaturschalter',
          'Kein Schalter vorhanden: „entfällt“ wählen',
          { group: 'Elektrik' },
        ),
        ok(
          'fgas',
          'Dichtheitsprüfung EU-F-Gase-VO',
          'Dichtheitsprüfung gem. EU-F-Gase-VO',
          'Dichtheitsprüfung F-Gase-VO',
          'Nicht prüfpflichtig: „entfällt“ wählen',
          { group: 'Prüfungen' },
        ),
        ok(
          'vdi',
          'Hygieneinspektion (VDI 6022)',
          'Hygieneinspektion (VDI 6022)',
          'Hygieneinspektion (VDI 6022)',
          '',
          { group: 'Prüfungen' },
        ),
        ok(
          'kpump',
          'Kondensatförderpumpe & Ablauf',
          'Kondensatförderpumpe & Ablauf',
          'Kondensatförderpumpe & Ablauf',
          'Keine Pumpe vorhanden: „entfällt“ wählen',
          { group: 'Prüfungen' },
        ),
      ],
    },
    {
      title: 'Abschlussbeurteilung & Abnahme',
      short: 'Abschluss',
      final: true,
      fields: [
        ok(
          'ftest',
          'Funktionstest Gesamtanlage',
          'Gesamtanlage auf korrekte Funktion im Betriebszyklus geprüft',
          'Funktionstest Gesamtanlage',
          '',
        ),
        {
          id: 'erg',
          col: 'Wartungsstatus Gesamtergebnis',
          label: 'Gesamtbewertung',
          type: 'bewertung',
        },
        {
          id: 'ergM',
          col: 'Wartungsstatus Gesamtergebnis' + MANGEL_SUFFIX,
          label: 'Mangel / Maßnahme',
          type: 'text',
          parent: 'erg',
          ph: 'Was ist festzustellen, was ist zu tun?',
          show: (v) => v.erg === 'n.i.O.',
        },
        {
          id: 'next',
          col: 'Nächste Wartung fällig',
          label: 'Nächste Wartung fällig',
          type: 'text',
          ph: 'Oktober 2027',
        },
        {
          id: 'bem',
          col: 'Festgestellte Mängel & Bemerkungen',
          label: 'Festgestellte Mängel & Bemerkungen',
          type: 'longtext',
          wide: true,
          hint: 'Mängel, Nacharbeiten, ersetzte Teile, Hinweise für den Betreiber',
        },
      ],
    },
  ],
};
/* Gruppen je Seite (nur Darstellung: Überschrift + Karte). Reihenfolge der Felder bleibt, damit PDF und Sheet unverändert sind.
   Seiten mit eigenen group-Angaben (Verdichter, Verflüssiger, Zusatzmessungen) behalten sie; Stammdaten und Verdampfer bleiben ohne Gruppen. */
{
  const G = {
    'Anlagenteile & Dokumentation': [
      ['Kältekreislauf', ['rohr', 'arm']],
      ['Messung & Dokumentation', ['mess', 'doku']],
    ],
    'Abschlussbeurteilung & Abnahme': [
      ['Ergebnis', ['ftest', 'erg', 'ergM']],
      ['Termin & Bemerkungen', ['next', 'bem']],
    ],
  };
  TEMPLATE.pages.forEach((pg) =>
    (G[pg.title] || []).forEach(([name, ids]) =>
      ids.forEach((id) => {
        pg.fields.find((f) => f.id === id).group = name;
      }),
    ),
  );
}
TEMPLATE.pages.forEach((pg) => {
  pg.fields = pg.fields.flatMap((f) => {
    if (f.type !== 'okfail' || f.legacy) {
      return [f];
    }
    const mangel = {
      id: f.id + 'M',
      col: f.col + MANGEL_SUFFIX,
      label: 'Mangel / Maßnahme',
      type: 'text',
      parent: f.id,
      ph: 'Was ist festzustellen, was ist zu tun?',
      show: (v) => v[f.id] === 'n.i.O.' && (!f.show || f.show(v)),
    };
    if (f.group) {
      mangel.group = f.group;
    }
    if (f.dev) {
      mangel.dev = f.dev;
    }
    return [f, mangel];
  });
});
const ALL_FIELDS = TEMPLATE.pages.flatMap((pg) => pg.fields);
const FIELD = Object.fromEntries(ALL_FIELDS.map((f) => [f.id, f]));
// Auffälligkeiten: Bauteil voranstellen (Dichtheit gibt es bei Verdichter, Verflüssiger und Verdampfer)
const CHECK_PAGE = Object.fromEntries(
  TEMPLATE.pages
    .filter((pg) => pg.kind === 'check')
    .flatMap((pg) => pg.fields.map((f) => [f.id, pg.short])),
);
const DEV_FIELDS = {}; // Verdampfer-Felder je Gerätenummer
ALL_FIELDS.forEach((f) => {
  if (f.dev) (DEV_FIELDS[f.dev] = DEV_FIELDS[f.dev] || []).push(f);
});
const devRoom = (v, n) => String(v['va' + (n > 1 ? n : '') + 'Raum'] ?? '').trim();
const devModel = (v, n) => String(v['va' + (n > 1 ? n : '') + 'Modell'] ?? '').trim();
const devSn = (v, n) => String(v['va' + (n > 1 ? n : '') + 'Sn'] ?? '').trim();
