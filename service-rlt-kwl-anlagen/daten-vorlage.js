// Feld-Definition der RLT/KWL-Vorlage (Datenbank-Spalten, Prüfpunkte, Messwerte).
'use strict';

/* =====================================================================
   Feld-Definition – entspricht dem Blatt "Datenbank" in "Datenbank_RLT-KWL-Service".
   col = exakter Spaltenname im Google Sheet.
   group = Zwischenüberschrift in der App, show = nur anzeigen, wenn …
   table = Darstellung als Tabelle im PDF
   Die leeren Spalten "Bereich: …" im Sheet sind nur Trenner und werden nicht abgefragt.
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
function altwertHint(x) {
  if (!x || BEWERTUNG.includes(x) || bewertungArt(x) === 'none') {
    return '';
  }
  return `<div class="field-hint altwert">Altwert: ${esc(x)}</div>`;
}
const ok = (id, col, label, pdf, hint, extra) =>
  Object.assign({ id, col, label, pdf, hint, type: 'okfail' }, extra || {});
const ANLAGENTYP = [
  'RLT mit WRG',
  'RLT ohne WRG',
  'KWL mit WRG',
  'KWL ohne WRG',
  'Teilklimaanlage',
  'Vollklimaanlage',
];
const WRG_TYP = ['Rotations-WT', 'Kreuzstrom-WT', 'Platten-WT', 'KV-System', 'entfällt'];
const FILTER = [
  'ePM1 70% (F7)',
  'ePM1 50% (F7)',
  'ePM2,5 50% (M6)',
  'ePM10 50% (M5)',
  'Coarse 70% (G4)',
  'Coarse 90% (G4)',
];
const wrgShow = (v) => v.wrgTyp !== 'entfällt';
const hwShow = (v) => v.hwChk !== 'Nein';
const glyShow = (v) => v.glyChk !== 'Nein';
const temp = (id, col, label, hint) => ({
  id,
  col,
  label,
  pdf: label,
  hint,
  group: 'Temperaturen',
  type: 'number',
  unit: '°C',
  min: -50,
  max: 80,
});
// Temperaturverhältnis Zuluftseite: η = (Zuluft − Außenluft) / (Abluft − Außenluft)
const eta = (v) =>
  isN(v.tAu) && isN(v.tZu) && isN(v.tAb) && num(v.tAb) !== num(v.tAu)
    ? round(((num(v.tZu) - num(v.tAu)) / (num(v.tAb) - num(v.tAu))) * 100, 0)
    : '';
const HINWEIS =
  'Die regelmäßige Wartung der Lüftungsanlage ist aus hygienischen sowie energetischen Gründen erforderlich (VDMA 24186-1). ' +
  'Eine fachgerechte und fristgerechte Durchführung sichert Betriebssicherheit, hohe Luftqualität und einen effizienten Energieverbrauch. ' +
  'Empfohlene Intervalle: Filterprüfung / Filterwechsel halbjährlich, Gesamtwartung nach VDMA-Checkliste jährlich.';

const TEMPLATE = {
  id: 'rlt-kwl',
  title: 'WARTUNGSPROTOKOLL • KWL & RLT',
  pages: [
    {
      title: 'Stammdaten & Auftrag',
      short: 'Stammdaten',
      header: true,
      fields: [
        {
          id: 'projekt',
          col: 'Projekt-Nr.',
          label: 'Projekt-Nr.',
          type: 'text',
          hint: 'Vorschlag kann überschrieben werden – wird auch der PDF-Dateiname',
          init: () =>
            'KWL-' + today().replace(/-/g, '') + '-' + uid().slice(0, 4).toUpperCase(),
        },
        {
          id: 'kunde',
          col: 'Kunden-Nr.',
          label: 'Kunden-Nr.',
          type: 'text',
          ph: 'KD-98101',
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
          pdf: 'Monteur / Prüfer',
          type: 'text',
          init: () => settings.techniker,
        },
        {
          id: 'standort',
          col: 'Standort / Zusatzangaben',
          label: 'Standort / Zusatzangaben',
          type: 'longtext',
          wide: true,
          hint: 'Aufstellort, Zugang, Hinweise …',
          ph: 'Technikzentrale OG 1',
        },
      ],
    },
    {
      title: 'Anlagendaten',
      pdfTitle: 'Anlagendaten (Lüftungs- & Klimaanlage)',
      short: 'Anlage',
      fields: [
        {
          id: 'anlage',
          col: 'Anlagenbezeichnung',
          label: 'Anlagenbezeichnung',
          type: 'text',
          ph: 'Lüftungsanlage RLT-01 Büro',
        },
        {
          id: 'herst',
          col: 'Hersteller',
          label: 'Hersteller',
          type: 'text',
          ph: 'Systemair',
        },
        {
          id: 'modell',
          col: 'Modell',
          label: 'Modell',
          type: 'text',
          ph: 'Topvex FR06',
        },
        { id: 'sn', col: 'Seriennummer', label: 'Seriennummer', type: 'text' },
        { id: 'baujahr', col: 'Baujahr', label: 'Baujahr', type: 'text', ph: '2023' },
        {
          id: 'typ',
          col: 'Anlagentyp',
          label: 'Anlagentyp',
          type: 'select',
          opts: ANLAGENTYP,
          other: true,
        },
        {
          id: 'wart',
          col: 'Wartungsart / Hinweise',
          label: 'Wartungsart / Hinweise',
          type: 'longtext',
          wide: true,
          ph: 'Jährliche Hauptwartung nach VDMA 24186-1',
        },
      ],
    },
    {
      title: 'Luftfördereinrichtung',
      pdfTitle: 'Luftfördereinrichtung / Ventilator (VDMA 24186-1)',
      short: 'Ventilator',
      kind: 'check',
      fields: [
        ok(
          'lfeVer',
          'LFE: Verschmutzung & Befestigung',
          'Verschmutzung, Beschädigung & Befestigung',
          'Verschmutzung, Beschädigung & Befestigung',
          '',
        ),
        ok(
          'lfeRein',
          'LFE: Reinigung',
          'Funktionserhaltendes Reinigen',
          'Funktionserhaltendes Reinigen',
          '',
        ),
        ok(
          'lfeLauf',
          'LFE: Laufrad & Drehrichtung',
          'Laufrad: Unwucht & Drehrichtung',
          'Laufrad: Unwucht & Drehrichtung',
          '',
        ),
        ok(
          'lfeSchau',
          'LFE: Schaufelverstelleinrichtung',
          'Schaufelverstelleinrichtung',
          'Schaufelverstelleinrichtung',
          '',
        ),
        ok(
          'lfeLagG',
          'LFE: Lagergeräusch',
          'Lager auf Geräusch geprüft',
          'Lagergeräusch',
          '',
        ),
        ok(
          'lfeLagS',
          'LFE: Lagerschmierung',
          'Lager mit Nachschmiereinrichtung gefettet',
          'Lagerschmierung',
          'Bei wartungsfreien Lagern „entfällt“',
        ),
        ok(
          'lfeFlex',
          'LFE: Flexible Verbindungen',
          'Flexible Verbindungen dicht',
          'Flexible Verbindungen dicht',
          '',
        ),
        ok(
          'lfeSchw',
          'LFE: Schwingungsdämpfer',
          'Schwingungsdämpfer funktionsfähig',
          'Schwingungsdämpfer',
          '',
        ),
        ok(
          'lfeSchutz',
          'LFE: Schutzeinrichtungen',
          'Schutzeinrichtungen',
          'Schutzeinrichtungen',
          'Berührungsschutz, Schutzgitter',
        ),
        ok('lfeDrall', 'LFE: Drallregler', 'Drallregler', 'Drallregler', ''),
        ok(
          'lfeKond',
          'LFE: Entwässerung / Kondensat',
          'Entwässerung / Kondensatwanne',
          'Entwässerung / Kondensatwanne',
          '',
        ),
        ok(
          'lfeHyg',
          'LFE: Hygienischer Zustand',
          'Hygienischer Zustand des Ventilators',
          'Hygienischer Zustand Ventilator',
          '',
        ),
        {
          id: 'vol',
          legacy: true,
          col: 'LFE: Volumenstrom [m³/h]',
          label: 'Volumenstrom',
          type: 'number',
          unit: 'm³/h',
          min: 0,
          max: 1000000,
          ph: '450',
        },
      ],
    },
    {
      title: 'Wärmeübertrager',
      pdfTitle: 'Wärmeübertrager (Lufterhitzer & Luftkühler)',
      short: 'Wärmetauscher',
      kind: 'check',
      fields: [
        ok(
          'wtZust',
          'WT: Lufterhitzer Zustand',
          'Lufterhitzer: Zustand & Dichtheit',
          'Lufterhitzer: Zustand & Dichtheit',
          '',
          { group: 'Lufterhitzer' },
        ),
        ok(
          'wtRein',
          'WT: Lufterhitzer Reinigung',
          'Lufterhitzer: funktionserhaltende Reinigung',
          'Lufterhitzer: Reinigung',
          '',
          { group: 'Lufterhitzer' },
        ),
        ok(
          'wtVent',
          'WT: Vor-/Rücklauf Ventile',
          'Vor- und Rücklauf / Ventile auf Funktion',
          'Vor-/Rücklauf & Ventile',
          '',
          { group: 'Lufterhitzer' },
        ),
        ok(
          'wtFrost',
          'WT: Frostschutzmittel',
          'Frostschutzmittel kontrolliert',
          'Frostschutzmittel',
          '',
          { group: 'Lufterhitzer' },
        ),
        ok('wtEntl', 'WT: Entlüftung', 'Entlüftung Wärmeübertrager', 'Entlüftung', '', {
          group: 'Lufterhitzer',
        }),
        ok(
          'wtEl',
          'WT: Elektro-Erhitzer',
          'Elektro-Lufterhitzer (Zunder / Sicherheit)',
          'Elektro-Lufterhitzer',
          'Nicht vorhanden: „entfällt“ wählen',
          { group: 'Lufterhitzer' },
        ),
        ok(
          'wtKuehl',
          'WT: Luftkühler / Entfeuchter',
          'Luftkühler / Entfeuchter geprüft & gereinigt',
          'Luftkühler / Entfeuchter',
          '',
          { group: 'Luftkühler' },
        ),
        ok(
          'wtSiph',
          'WT: Kondensatablauf & Siphon',
          'Wasserablauf & Geruchverschluss (Siphon)',
          'Kondensatablauf & Siphon',
          '',
          { group: 'Luftkühler' },
        ),
        ok('wtTropf', 'WT: Tropfenabscheider', 'Tropfenabscheider', 'Tropfenabscheider', '', {
          group: 'Luftkühler',
        }),
      ],
    },
    {
      title: 'Wärmerückgewinnung',
      pdfTitle: 'Wärmerückgewinnung (WRG)',
      short: 'WRG',
      fields: [
        {
          id: 'wrgTyp',
          col: 'WRG: Bauart / Typ',
          label: 'Bauart / Typ',
          pdf: 'WRG Bauart / Typ',
          type: 'select',
          opts: WRG_TYP,
          other: true,
          hint: '„entfällt“ blendet die weiteren WRG-Punkte aus',
        },
        ok(
          'wrgZust',
          'WRG: Zustand & Reinigung',
          'Zustand & Reinigung',
          'WRG: Zustand & Reinigung',
          '',
          { show: wrgShow },
        ),
        ok(
          'wrgRot',
          'WRG: Rotor, Unwucht & Lager',
          'Rotor, Unwucht & Lager',
          'WRG: Rotor, Unwucht & Lager',
          'Nur bei Rotations-WT, sonst „entfällt“',
          { show: wrgShow },
        ),
        ok(
          'wrgDicht',
          'WRG: Dichtelemente & Leckrate',
          'Dichtelemente & Leckrate',
          'WRG: Dichtelemente & Leckrate',
          '',
          { show: wrgShow },
        ),
      ],
    },
    {
      title: 'Filtersystem',
      pdfTitle: 'Filtersystem',
      short: 'Filter',
      table: {
        head: ['Filter', 'Zustand / Wartung', 'Filterklasse / Typ', 'Differenzdruck'],
        rows: [
          { label: 'Zuluftfilter', ids: ['fzZust', 'fzKl', 'fzDp'] },
          { label: 'Abluftfilter', ids: ['faZust', 'faKl', 'faDp'] },
        ],
      },
      fields: [
        ok(
          'fzZust',
          'Filter Zuluft: Zustand',
          'Zustand / Wartung',
          'Zuluftfilter Zustand',
          '',
          { group: 'Zuluftfilter' },
        ),
        {
          id: 'fzKl',
          col: 'Filter Zuluft: Filterklasse / Typ',
          label: 'Filterklasse / Typ',
          pdf: 'Zuluftfilter Klasse',
          group: 'Zuluftfilter',
          type: 'select',
          opts: FILTER,
          other: true,
        },
        {
          id: 'fzDp',
          col: 'Filter Zuluft: Differenzdruck [Pa]',
          label: 'Differenzdruck',
          pdf: 'Zuluftfilter Differenzdruck',
          group: 'Zuluftfilter',
          type: 'number',
          unit: 'Pa',
          min: 0,
          max: 5000,
          hint: 'Bei laufender Anlage gemessen',
        },
        ok(
          'faZust',
          'Filter Abluft: Zustand',
          'Zustand / Wartung',
          'Abluftfilter Zustand',
          '',
          { group: 'Abluftfilter' },
        ),
        {
          id: 'faKl',
          col: 'Filter Abluft: Filterklasse / Typ',
          label: 'Filterklasse / Typ',
          pdf: 'Abluftfilter Klasse',
          group: 'Abluftfilter',
          type: 'select',
          opts: FILTER,
          other: true,
        },
        {
          id: 'faDp',
          col: 'Filter Abluft: Differenzdruck [Pa]',
          label: 'Differenzdruck',
          pdf: 'Abluftfilter Differenzdruck',
          group: 'Abluftfilter',
          type: 'number',
          unit: 'Pa',
          min: 0,
          max: 5000,
          hint: 'Bei laufender Anlage gemessen',
        },
      ],
    },
    {
      title: 'Gehäuse, Klappen & Kammern',
      pdfTitle: 'Gerätekammern, Klappen & Luftverteilung',
      short: 'Gehäuse',
      kind: 'check',
      fields: [
        ok(
          'wsg',
          'Wetterschutzgitter: Zustand & Reinigung',
          'Wetterschutzgitter: Zustand & Reinigung',
          'Wetterschutzgitter',
          '',
        ),
        ok(
          'jal',
          'Jalousieklappen: Mechanik & Schmierung',
          'Jalousieklappen: Mechanik & Schmierung',
          'Jalousieklappen',
          '',
        ),
        ok(
          'msr',
          'Stellantriebe & MSR-Funktion',
          'Stellantriebe & MSR-Funktion',
          'Stellantriebe & MSR',
          '',
        ),
        ok(
          'kamZ',
          'Kammergehäuse: Zustand & Sauberkeit',
          'Kammergehäuse: Zustand & Sauberkeit',
          'Kammergehäuse: Zustand & Sauberkeit',
          '',
        ),
        ok(
          'tuer',
          'Türen, Verschlüsse & Dichtungen',
          'Türen, Verschlüsse & Dichtungen',
          'Türen, Verschlüsse & Dichtungen',
          '',
        ),
        ok(
          'daemm',
          'Kammern: Wärmedämmung',
          'Kammern: Wärmedämmung',
          'Kammern: Wärmedämmung',
          '',
        ),
      ],
    },
    {
      title: 'Elektrik & Betriebsmesswerte',
      short: 'Messwerte',
      fields: [
        {
          id: 'elAn',
          col: 'Elektrische Anschlüsse geprüft',
          label: 'Elektrische Anschlüsse geprüft',
          pdf: 'Elektr. Anschlüsse geprüft',
          type: 'yesno',
          group: 'Elektrik',
          hint: 'Sichtprüfung, Klemmen auf Festsitz',
        },
        {
          id: 'uNetz',
          col: 'Netzspannung [V]',
          label: 'Netzspannung',
          type: 'number',
          unit: 'V',
          min: 0,
          max: 1000,
          sRanges: [
            [207, 253],
            [360, 440],
          ],
          group: 'Elektrik',
          ph: '400',
        },
        {
          id: 'iL1',
          col: 'Stromaufnahme L1 [A]',
          label: 'Stromaufnahme L1',
          type: 'number',
          unit: 'A',
          min: 0,
          max: 1000,
          group: 'Elektrik',
        },
        {
          id: 'iL2',
          col: 'Stromaufnahme L2 [A]',
          label: 'Stromaufnahme L2',
          type: 'number',
          unit: 'A',
          min: 0,
          max: 1000,
          group: 'Elektrik',
        },
        {
          id: 'iL3',
          col: 'Stromaufnahme L3 [A]',
          label: 'Stromaufnahme L3',
          type: 'number',
          unit: 'A',
          min: 0,
          max: 1000,
          group: 'Elektrik',
        },
        temp('tAu', 'Außenlufttemperatur [°C]', 'Außenlufttemperatur', ''),
        temp(
          'tZu',
          'Zulufttemperatur [°C]',
          'Zulufttemperatur',
          'Für den WRG-Wirkungsgrad hinter der WRG bzw. vor dem Nacherhitzer messen',
        ),
        temp('tAb', 'Ablufttemperatur [°C]', 'Ablufttemperatur', ''),
        temp('tFo', 'Fortlufttemperatur [°C]', 'Fortlufttemperatur', ''),
        {
          id: 'eta',
          col: 'WRG-Wirkungsgrad [%]',
          label: 'WRG-Wirkungsgrad η',
          type: 'calc',
          unit: '%',
          group: 'Temperaturen',
          calc: eta,
          note: (v) =>
            isN(v.eta) && (v.eta < 0 || v.eta > 100)
              ? 'unplausibel – Zuluft nach dem Nacherhitzer gemessen?'
              : '(Zuluft − Außenluft) / (Abluft − Außenluft)',
        },
      ],
    },
    {
      title: 'Heizwasser & Frostschutz',
      pdfTitle: 'Heizwasseranalyse (VDI 2035) & Glykol-Frostschutz',
      short: 'Heizwasser',
      fields: [
        {
          id: 'hwChk',
          col: 'Heizwasser VDI 2035 geprüft',
          label: 'Heizwasser nach VDI 2035 geprüft',
          pdf: 'Heizwasser geprüft',
          type: 'yesno',
          group: 'Heizwasser (VDI 2035)',
          hint: '„Nein“ blendet die Heizwasser-Messwerte aus',
        },
        {
          id: 'leit',
          col: 'Heizwasser: Leitwert [µS/cm]',
          label: 'Elektrische Leitfähigkeit',
          pdf: 'Elektr. Leitfähigkeit',
          type: 'number',
          unit: 'µS/cm',
          min: 0,
          max: 20000,
          sMax: 100,
          group: 'Heizwasser (VDI 2035)',
          show: hwShow,
          hint: 'Salzarme Fahrweise',
        },
        {
          id: 'ph',
          col: 'Heizwasser: pH-Wert',
          label: 'pH-Wert',
          pdf: 'pH-Wert Heizwasser',
          type: 'number',
          min: 0,
          max: 14,
          sMin: 8.2,
          sMax: 9.0,
          group: 'Heizwasser (VDI 2035)',
          show: hwShow,
        },
        ok(
          'wasser',
          'Wasser-Zustand (VDI 2035)',
          'Wasser-Zustand (VDI 2035)',
          'Wasser-Zustand (VDI 2035)',
          'Farbe, Trübung, Schwebstoffe',
          { group: 'Heizwasser (VDI 2035)', show: hwShow },
        ),
        {
          id: 'glyChk',
          col: 'Frostschutz Glykol geprüft',
          label: 'Frostschutz (Glykol) geprüft',
          pdf: 'Frostschutz geprüft',
          type: 'yesno',
          group: 'Frostschutz (Glykol)',
          hint: '„Nein“ blendet die Frostschutz-Messwerte aus',
        },
        {
          id: 'frost',
          col: 'Frostschutz-Messwert [°C]',
          label: 'Frostschutz-Messwert',
          type: 'number',
          unit: '°C',
          min: -70,
          max: 20,
          group: 'Frostschutz (Glykol)',
          show: glyShow,
          ph: '-25',
        },
        {
          id: 'gly',
          col: 'Frostschutz: Glykolanteil [%]',
          label: 'Glykolanteil',
          type: 'number',
          unit: '%',
          min: 0,
          max: 100,
          group: 'Frostschutz (Glykol)',
          show: glyShow,
        },
      ],
    },
    {
      title: 'Wartungsabschluss & Abnahme',
      short: 'Abschluss',
      final: true,
      fields: [
        {
          id: 'unterl',
          col: 'Unterlagen & Typenschild geprüft',
          label: 'Unterlagen & Typenschild geprüft',
          type: 'yesno',
        },
        {
          id: 'ftest',
          col: 'Funktionstest Gesamtanlage',
          label: 'Funktionstest Gesamtanlage',
          pdf: 'Funktionstest',
          type: 'select',
          opts: ['erfolgreich', 'nicht erfolgreich'],
          good: ['erfolgreich'],
          bad: ['nicht erfolgreich'],
        },
        {
          id: 'erfolg',
          col: 'Wartung erfolgreich',
          label: 'Gesamtbewertung',
          type: 'bewertung',
        },
        {
          id: 'erfolgM',
          col: 'Wartung erfolgreich' + MANGEL_SUFFIX,
          label: 'Mangel / Maßnahme',
          type: 'text',
          parent: 'erfolg',
          ph: 'Was ist festzustellen, was ist zu tun?',
          show: (v) => v.erfolg === 'n.i.O.',
        },
        {
          id: 'bem',
          col: 'Bemerkungen / Mängel',
          label: 'Bemerkungen / Mängel',
          type: 'longtext',
          wide: true,
          hint: 'Mängel, Nacharbeiten, ersetzte Teile, Hinweise für den Betreiber',
        },
      ],
    },
  ],
};
/* Gruppen je Seite (nur Darstellung: Überschrift + Karte). Reihenfolge der Felder bleibt, damit PDF und Sheet unverändert sind.
   Seiten mit eigenen group-Angaben (Wärmeübertrager, Filter, Elektrik, Heizwasser) behalten sie; Stammdaten bleiben ohne Gruppen. */
{
  const G = {
    Anlagendaten: [
      ['Anlage', ['anlage', 'herst', 'modell', 'sn', 'baujahr']],
      ['Typ & Wartung', ['typ', 'wart']],
    ],
    Luftfördereinrichtung: [
      ['Laufrad & Antrieb', ['lfeVer', 'lfeRein', 'lfeLauf', 'lfeSchau']],
      ['Lager', ['lfeLagG', 'lfeLagS']],
      [
        'Anschluss & Sicherheit',
        ['lfeFlex', 'lfeSchw', 'lfeSchutz', 'lfeDrall', 'lfeKond', 'lfeHyg'],
      ],
    ],
    Wärmerückgewinnung: [
      ['Bauart', ['wrgTyp']],
      ['Prüfpunkte', ['wrgZust', 'wrgRot', 'wrgDicht']],
    ],
    'Gehäuse, Klappen & Kammern': [
      ['Außen & Mechanik', ['wsg', 'jal', 'msr']],
      ['Kammern', ['kamZ', 'tuer', 'daemm']],
    ],
    'Wartungsabschluss & Abnahme': [
      ['Ergebnis', ['unterl', 'ftest', 'erfolg', 'erfolgM']],
      ['Bemerkungen', ['bem']],
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
    return [f, mangel];
  });
});
const ALL_FIELDS = TEMPLATE.pages.flatMap((pg) => pg.fields);
const FIELD = Object.fromEntries(ALL_FIELDS.map((f) => [f.id, f]));
