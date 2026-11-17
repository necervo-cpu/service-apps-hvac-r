// Daten: Feld-Definitionen für Stammdaten und Einträge (entsprechen den Blättern der Datenbank), GWP-Werte, Intervall-Helfer.
'use strict';

/* =====================================================================
   Feld-Definitionen – entsprechen den Blättern in "Datenbank_Anlagenlogbuch".
   col = exakter Spaltenname im Google Sheet.
   STAMM  → Blatt "Anlagen"  (eine Zeile pro Anlage / Logbuch)
   EINTRAG → Blatt "Einträge" (eine Zeile pro Termin, z. B. jährliche Dichtheitsprüfung)
   group = Zwischenüberschrift, prefix = wird im PDF vor dem Spaltennamen weggelassen.
   Feldtyp "auto": wird berechnet, kann aber überschrieben werden (Feld leeren = wieder automatisch).
   ===================================================================== */
const yn = (id, col, label, extra) =>
  Object.assign({ id, col, label, type: 'yesno' }, extra || {});
// GWP-Werte (AR4, wie in der Klima-Wartungs-App) für das CO₂-Äquivalent
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
/* Prüfintervall nach Art. 5 VO (EU) 2024/573 */
function intervalOf(v) {
  if (!isN(v.co2)) return '';
  const t = num(v.co2),
    lds = v.lds === 'Ja';
  if (v.herm === 'Ja' && t < 10)
    return 'keine Prüfpflicht (hermetisch geschlossen, unter 10 t)';
  if (t < 5) return 'keine Prüfpflicht (unter 5 t CO₂-Äquivalent)';
  if (t < 50) return lds ? '24 Monate' : '12 Monate';
  if (t < 500) return lds ? '12 Monate' : '6 Monate';
  return lds ? '6 Monate' : '3 Monate';
}
const monthsOf = (s) => {
  const m = /(\d+)\s*Monat/.exec(String(s || ''));
  return m ? Number(m[1]) : 0;
};
function addMonths(iso, n) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m || !n) return '';
  const d = new Date(+m[1], +m[2] - 1 + n, 1),
    last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(+m[3], last));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const TITLE = 'Logbuch für Kälteanlagen';
const SUBTITLE =
  'gem. VO (EU) 2024/573 (F-Gase-Verordnung) · VO (EG) 1516/2007 (Dichtheitskontrolle) · DVO (EU) 2015/2067 (Sachkunde) · ' +
  'DIN EN 378 · VO (EU) 2024/590 (ozonschädigende Stoffe) · ChemKlimaschutzV';
const HINWEIS = [
  'Global Warming Potential (GWP): Maßzahl für den Beitrag eines Gases zum Treibhauseffekt im Vergleich zur gleichen Masse CO₂ (GWP = 1), ' +
    'bezogen auf einen Zeithorizont von 100 Jahren. CO₂-Äquivalent (t) = Füllmenge (kg) × GWP ÷ 1000.',
  'Verordnung (EU) 2024/573, Artikel 5 – Dichtheitskontrollen: Betreiber von Einrichtungen, die fluorierte Treibhausgase in einer Menge von ' +
    '5 t CO₂-Äquivalent oder mehr enthalten (nicht in Schäumen), stellen sicher, dass die Einrichtungen auf Undichtigkeiten kontrolliert werden. ' +
    'Hermetisch geschlossene und als solche gekennzeichnete Einrichtungen mit weniger als 10 t CO₂-Äquivalent sind davon ausgenommen. ' +
    'Prüfabstände: 5 bis unter 50 t CO₂-Äquivalent mindestens alle 12 Monate (24 Monate mit Leckage-Erkennungssystem); ' +
    '50 bis unter 500 t alle 6 Monate (12 Monate); ab 500 t alle 3 Monate (6 Monate).',
  'Verantwortung des Betreibers: Die Norm DIN EN 378 „Kälteanlagen und Wärmepumpen – Sicherheitstechnische und umweltrelevante Anforderungen“ wird eingehalten. ' +
    'Der Betreiber der Anlage ist dafür verantwortlich, dass die Anlage entsprechend dem Prüfintervall von einer nach Durchführungsverordnung ' +
    '(EU) 2015/2067 zertifizierten Person auf Dichtheit geprüft wird.',
];

const STAMM = {
  id: 'anlagenlogbuch-stamm',
  pages: [
    {
      title: 'Logbuch anlegen',
      short: 'Logbuch',
      header: true,
      fields: [
        {
          id: 'projekt',
          col: 'Projektnummer',
          label: 'Projektnummer / Logbuch-Nr.',
          type: 'text',
          hint: 'Vorschlag kann überschrieben werden – wird auch der PDF-Dateiname',
          init: () =>
            'LB-' + today().replace(/-/g, '') + '-' + uid().slice(0, 4).toUpperCase(),
        },
        {
          id: 'angelegt',
          col: 'Angelegt am',
          label: 'Angelegt am',
          type: 'date',
          init: () => today(),
        },
        {
          id: 'von',
          col: 'Angelegt von',
          label: 'Angelegt von',
          type: 'text',
          init: () => settings.techniker,
        },
      ],
    },
    {
      title: 'Betreiber',
      pdfTitle: 'Betreiber',
      short: 'Betreiber',
      prefix: 'Betreiber ',
      kind: 'addr',
      fields: [
        { id: 'bFirma', col: 'Betreiber Firma', label: 'Firma', type: 'text' },
        { id: 'bName', col: 'Betreiber Name', label: 'Name', type: 'text' },
        { id: 'bStr', col: 'Betreiber Straße', label: 'Straße', type: 'text' },
        { id: 'bPlz', col: 'Betreiber PLZ', label: 'PLZ', type: 'text' },
        { id: 'bOrt', col: 'Betreiber Ort', label: 'Ort', type: 'text' },
      ],
    },
    {
      title: 'Aufstellort',
      short: 'Aufstellort',
      prefix: 'Aufstellort ',
      kind: 'addr',
      btn: { act: 'copybetr', label: 'Wie Betreiber übernehmen' },
      fields: [
        { id: 'aFirma', col: 'Aufstellort Firma', label: 'Firma', type: 'text' },
        { id: 'aName', col: 'Aufstellort Name', label: 'Name', type: 'text' },
        { id: 'aStr', col: 'Aufstellort Straße', label: 'Straße', type: 'text' },
        { id: 'aPlz', col: 'Aufstellort PLZ', label: 'PLZ', type: 'text' },
        { id: 'aOrt', col: 'Aufstellort Ort', label: 'Ort', type: 'text' },
      ],
    },
    {
      title: 'Anlagendaten',
      short: 'Anlage',
      fields: [
        {
          id: 'typ',
          col: 'Anlagentyp',
          label: 'Anlagentyp',
          type: 'text',
          group: 'Anlagenaufnahme',
          ph: 'Split-Klimaanlage, VRF-System, Kühlzelle',
        },
        {
          id: 'sn',
          col: 'Seriennummer',
          label: 'Seriennummer',
          type: 'text',
          group: 'Anlagenaufnahme',
        },
        {
          id: 'herst',
          col: 'Hersteller',
          label: 'Hersteller',
          type: 'text',
          group: 'Anlagenaufnahme',
          ph: 'Daikin',
        },
        {
          id: 'bj',
          col: 'Baujahr',
          label: 'Baujahr',
          type: 'text',
          group: 'Anlagenaufnahme',
          ph: '2024',
        },
        {
          id: 'ibn',
          col: 'IBN Datum',
          label: 'IBN Datum',
          type: 'date',
          init: () => today(),
          group: 'Anlagenaufnahme',
        },
        {
          id: 'km',
          col: 'Kältemitteltyp',
          label: 'Kältemitteltyp',
          type: 'text',
          group: 'Kältekreis',
          ph: 'R32',
        },
        {
          id: 'fm',
          col: 'Füllgewicht (kg)',
          label: 'Füllgewicht',
          type: 'number',
          unit: 'kg',
          min: 0,
          max: 5000,
          group: 'Kältekreis',
          ph: '2,05',
        },
        {
          id: 'hd',
          col: 'Max. HD (bar)',
          label: 'Max. HD',
          type: 'number',
          unit: 'bar',
          min: -1,
          max: 300,
          group: 'Kältekreis',
        },
        {
          id: 'nd',
          col: 'Max. ND (bar)',
          label: 'Max. ND',
          type: 'number',
          unit: 'bar',
          min: -1,
          max: 300,
          group: 'Kältekreis',
        },
        {
          id: 'rcd',
          col: 'RCD der Anlage',
          label: 'RCD der Anlage',
          type: 'text',
          group: 'Elektrik & Ausstattung',
          ph: '40 A / 30 mA Typ A',
        },
        {
          id: 'absO',
          col: 'Absicherung ODU',
          label: 'Absicherung ODU (Außengerät)',
          type: 'text',
          group: 'Elektrik & Ausstattung',
          ph: 'B16',
        },
        {
          id: 'absI',
          col: 'Absicherung IDU',
          label: 'Absicherung IDU (Innengerät)',
          type: 'text',
          group: 'Elektrik & Ausstattung',
        },
        yn('rep', 'Repschalter vorhanden', 'Repschalter vorhanden', {
          group: 'Elektrik & Ausstattung',
        }),
        yn('oel', 'Ölabscheider vorhanden', 'Ölabscheider vorhanden', {
          group: 'Elektrik & Ausstattung',
        }),
        yn(
          'lds',
          'Leckage-Erkennungssystem vorhanden',
          'Leckage-Erkennungssystem vorhanden',
          { group: 'Prüfpflicht (F-Gase-Verordnung)', hint: 'verlängert das Prüfintervall' },
        ),
        yn(
          'herm',
          'Hermetisch geschlossen',
          'Hermetisch geschlossen (und so gekennzeichnet)',
          { group: 'Prüfpflicht (F-Gase-Verordnung)' },
        ),
        {
          id: 'gwp',
          col: 'GWP',
          label: 'GWP',
          type: 'auto',
          group: 'Prüfpflicht (F-Gase-Verordnung)',
          ph: '675',
          calc: (v) => {
            const g = gwpOf(v.km);
            return g == null ? '' : String(g);
          },
          note: (v) =>
            v.km && gwpOf(v.km) == null
              ? 'GWP für dieses Kältemittel unbekannt – bitte eintragen'
              : 'aus dem Kältemitteltyp',
        },
        {
          id: 'co2',
          col: 'CO₂-Äquivalent (t)',
          label: 'CO₂-Äquivalent',
          type: 'auto',
          unit: 't',
          group: 'Prüfpflicht (F-Gase-Verordnung)',
          calc: (v) =>
            isN(v.fm) && isN(v.gwp) ? fmtNum(round((num(v.fm) * num(v.gwp)) / 1000, 3)) : '',
          note: () => 'Füllgewicht × GWP ÷ 1000',
        },
        {
          id: 'intv',
          col: 'Prüfintervall',
          label: 'Prüfintervall Dichtheitskontrolle',
          type: 'auto',
          group: 'Prüfpflicht (F-Gase-Verordnung)',
          ph: '12 Monate',
          calc: intervalOf,
          note: () =>
            'nach Art. 5 VO (EU) 2024/573 aus CO₂-Äquivalent, Leckage-Erkennung und hermetisch',
        },
      ],
    },
    {
      title: 'Dichtheitsprüfung vor Erstinbetriebnahme',
      pdfTitle: 'Dichtheitsprüfung vor Erstinbetriebnahme',
      short: 'Erst-IBN',
      kind: 'check',
      prefix: 'Erst-IBN ',
      sign: true,
      fields: [
        yn(
          'iAufz',
          'Erst-IBN Aufzeichnungen vollständig',
          'Aufzeichnungen auf Vollständigkeit geprüft',
          { group: 'Aufzeichnungen', allYes: true },
        ),
        yn('iVerb', 'Erst-IBN Verbindungen', 'Verbindungen', {
          group: 'Systematische Prüfung der Einrichtung',
          allYes: true,
        }),
        yn('iVent', 'Erst-IBN Ventile und Leitungen', 'Ventile und Leitungen', {
          group: 'Systematische Prüfung der Einrichtung',
          allYes: true,
        }),
        yn('iVers', 'Erst-IBN Versiegelungen', 'Versiegelungen', {
          group: 'Systematische Prüfung der Einrichtung',
          allYes: true,
        }),
        yn('iVib', 'Erst-IBN Vibrationsfähige Teile', 'Vibrationsfähige Teile', {
          group: 'Systematische Prüfung der Einrichtung',
          allYes: true,
        }),
        yn(
          'iSich',
          'Erst-IBN Verbindungen zu Sicherheits-/Betriebssystemen',
          'Verbindungen zu Sicherheits- oder Betriebssystemen',
          { group: 'Systematische Prüfung der Einrichtung', allYes: true },
        ),
        yn(
          'iLeck',
          'Erst-IBN Weitergehende Prüfung (vermutetes Leck)',
          'Weitergehende Dichtheitsprüfung aufgrund eines vermuteten Lecks',
          { group: 'Systematische Prüfung der Einrichtung' },
        ),
        yn('iDr', 'Erst-IBN Indirekt Druck', 'Druck', {
          group: 'Ausführung – indirekte Messmethode',
        }),
        yn('iTe', 'Erst-IBN Indirekt Temperatur', 'Temperatur', {
          group: 'Ausführung – indirekte Messmethode',
        }),
        yn('iKo', 'Erst-IBN Indirekt Kompressorströmung', 'Kompressorströmung', {
          group: 'Ausführung – indirekte Messmethode',
        }),
        yn('iFl', 'Erst-IBN Indirekt Flüssigkeitsniveau', 'Flüssigkeitsniveau', {
          group: 'Ausführung – indirekte Messmethode',
        }),
        yn('iAu', 'Erst-IBN Indirekt Auffüllmenge', 'Auffüllmenge', {
          group: 'Ausführung – indirekte Messmethode',
        }),
        yn(
          'iGas',
          'Erst-IBN Direkt Gasmeldegerät (mind. 3 g/Jahr)',
          'Gasmeldegerät / Nachweisempfindlichkeit mind. 3 g/Jahr',
          { group: 'Ausführung – direkte Messmethode' },
        ),
        yn('iUv', 'Erst-IBN Direkt UV-Detektor Flüssigkeit', 'UV-Detektor Flüssigkeit', {
          group: 'Ausführung – direkte Messmethode',
        }),
        yn('iFarb', 'Erst-IBN Direkt Färbemittel', 'Geeignetes Färbemittel', {
          group: 'Ausführung – direkte Messmethode',
        }),
        yn('iSchaum', 'Erst-IBN Direkt Spezial-Schaummittel', 'Spezial-Schaummittel', {
          group: 'Ausführung – direkte Messmethode',
        }),
        yn('iSeife', 'Erst-IBN Direkt Seifenlösung', 'Seifenlösung', {
          group: 'Ausführung – direkte Messmethode',
        }),
        {
          id: 'iSonst',
          col: 'Erst-IBN Direkt Sonstiges Messverfahren',
          label: 'Sonstiges Messverfahren',
          type: 'text',
          group: 'Ausführung – direkte Messmethode',
          ph: 'elektronisches Lecksuchgerät',
        },
        yn(
          'iMang',
          'Erst-IBN Mängel festgestellt',
          'Mängel festgestellt (wenn ja, siehe Zusatzbericht)',
          { group: 'Mängel & Prüfer', good: ['Nein'], bad: ['Ja'] },
        ),
        {
          id: 'iDat',
          col: 'Erst-IBN Prüfdatum',
          label: 'Datum der Prüfung',
          type: 'date',
          init: () => today(),
          group: 'Mängel & Prüfer',
        },
        {
          id: 'iSk',
          col: 'Erst-IBN Sachkundiger',
          label: 'Sachkundiger',
          type: 'text',
          group: 'Mängel & Prüfer',
          init: () => settings.techniker,
        },
        {
          id: 'iZert',
          col: 'Erst-IBN Zertifikatsnummer',
          label: 'Zertifikatsnummer',
          type: 'text',
          group: 'Mängel & Prüfer',
          init: () => settings.zert,
        },
        {
          id: 'iBetr',
          col: 'Erst-IBN Name Betreiber',
          label: 'Name Betreiber',
          type: 'text',
          sigName: true,
        },
      ],
    },
    {
      title: 'Abschluss',
      short: 'Abschluss',
      final: true,
      fields: [
        {
          id: 'bem',
          col: 'Bemerkungen',
          label: 'Bemerkungen zur Anlage',
          type: 'longtext',
          wide: true,
          hint: 'z. B. Zugang, Besonderheiten, frühere Papier-Logbücher',
        },
      ],
    },
  ],
};

/* Gruppen je Seite (nur Darstellung: Überschrift + Karte). Feldreihenfolge bleibt, damit PDF und Sheet unverändert sind.
   Seiten „Anlagendaten“ und „Dichtheitsprüfung vor Erstinbetriebnahme“ behalten ihre vorhandenen group-Angaben. */
{
  const G = {
    'Logbuch anlegen': [
      ['Logbuch', ['projekt', 'angelegt']],
      ['Erfasst von', ['von']],
    ],
    Betreiber: [
      ['Name', ['bFirma', 'bName']],
      ['Adresse', ['bStr', 'bPlz', 'bOrt']],
    ],
    Aufstellort: [
      ['Name', ['aFirma', 'aName']],
      ['Adresse', ['aStr', 'aPlz', 'aOrt']],
    ],
    Abschluss: [['Bemerkungen', ['bem']]],
  };
  STAMM.pages.forEach((pg) =>
    (G[pg.title] || []).forEach(([name, ids]) =>
      ids.forEach((id) => {
        pg.fields.find((f) => f.id === id).group = name;
      }),
    ),
  );
}

const EINTRAG = {
  id: 'anlagenlogbuch-eintrag',
  pages: [
    {
      title: 'Termin',
      short: 'Termin',
      header: true,
      fields: [
        {
          id: 'datum',
          col: 'Datum',
          label: 'Datum',
          type: 'date',
          notFuture: true,
          init: () => today(),
          hint: 'Ältere Einträge aus dem Papier-Logbuch einfach mit ihrem Datum nachtragen',
        },
        {
          id: 'sk',
          col: 'Sachkundiger',
          label: 'Sachkundiger',
          type: 'text',
          init: () => settings.techniker,
        },
        {
          id: 'zert',
          col: 'Zertifikatsnummer',
          label: 'Zertifikatsnummer',
          type: 'text',
          init: () => settings.zert,
          hint: 'Sachkunde nach DVO (EU) 2015/2067',
        },
      ],
    },
    {
      title: 'Dichtheitsprüfung',
      short: 'Dichtheit',
      hint: 'Leer lassen, wenn bei diesem Termin keine Dichtheitsprüfung gemacht wurde.',
      fields: [
        {
          id: 'dicht',
          col: 'Dichtheitsanforderung',
          label: 'Dichtheitsanforderung',
          type: 'select',
          opts: ['erfüllt', 'nicht erfüllt'],
          good: ['erfüllt'],
          bad: ['nicht erfüllt'],
        },
        {
          id: 'meth',
          col: 'Prüfmethode',
          label: 'Prüfmethode',
          type: 'text',
          ph: 'direkt, elektronisches Lecksuchgerät',
        },
        {
          id: 'next',
          col: 'Nächste Dichtheitsprüfung fällig',
          label: 'Nächste Dichtheitsprüfung fällig',
          type: 'auto',
          input: 'date',
          calc: (v, L) =>
            !v.dicht || !v.datum
              ? ''
              : addMonths(v.datum, v.dicht === 'nicht erfüllt' ? 1 : monthsOf(L.intv)),
          note: (v, L) =>
            !v.dicht
              ? 'erst nach Auswahl „erfüllt / nicht erfüllt“'
              : v.dicht === 'nicht erfüllt'
                ? 'Datum + 1 Monat (Nachprüfung nach der Reparatur)'
                : monthsOf(L.intv)
                  ? `Datum + ${monthsOf(L.intv)} Monate (Prüfintervall der Anlage)`
                  : 'kein Prüfintervall in den Anlagendaten – bitte von Hand eintragen',
        },
      ],
    },
    {
      title: 'Prüfung / Wartung / Instandhaltung',
      short: 'Wartung',
      fields: [
        {
          id: 'art',
          col: 'Art der Arbeit',
          label: 'Art',
          type: 'text',
          ph: 'Jahreswartung, Reparatur, Instandsetzung',
        },
        {
          id: 'ber',
          col: 'Bericht',
          label: 'Bericht',
          type: 'longtext',
          ph: 'Wartung nach VDMA 24186-3, Protokoll KLW-20271012-A3F2',
        },
      ],
    },
    {
      title: 'Kältemittel',
      short: 'Kältemittel',
      hint: 'Nur ausfüllen, wenn Kältemittel entnommen oder aufgefüllt wurde.',
      fields: [
        { id: 'km', col: 'Kältemittel', label: 'Kältemittel', type: 'text', ph: 'R32' },
        {
          id: 'kz',
          col: 'Kältemittel Zustand',
          label: 'Kältemittel ist …',
          type: 'select',
          opts: ['neu', 'recycelt', 'aufbereitet'],
        },
        {
          id: 'ent',
          col: 'Kältemittel entsorgt (kg)',
          label: 'Entsorgt',
          type: 'number',
          unit: 'kg',
          min: 0,
          max: 5000,
        },
        {
          id: 'auf',
          col: 'Kältemittel aufgefüllt (kg)',
          label: 'Aufgefüllt',
          type: 'number',
          unit: 'kg',
          min: 0,
          max: 5000,
        },
        {
          id: 'grund',
          col: 'Grund (Kältemittel)',
          label: 'Grund',
          type: 'text',
          ph: 'Leckage behoben, Verdichtertausch',
        },
      ],
    },
    {
      title: 'Mängel & Ergänzungen',
      short: 'Mängel',
      fields: [
        {
          id: 'mang',
          col: 'Festgestellter Mangel',
          label: 'Festgestellter Mangel',
          type: 'longtext',
        },
        {
          id: 'mass',
          col: 'Maßnahmen zur Behebung',
          label: 'Maßnahmen zur Behebung',
          type: 'longtext',
        },
        {
          id: 'erg',
          col: 'Zusätzliche Ergänzung',
          label: 'Zusätzliche Ergänzung durch Anlagenprüfer',
          type: 'longtext',
        },
      ],
    },
    {
      title: 'Eintrag speichern',
      short: 'Speichern',
      final: true,
      sign: true,
      fields: [
        {
          id: 'betr',
          col: 'Name Betreiber',
          label: 'Name Betreiber',
          type: 'text',
          sigName: true,
        },
      ],
    },
  ],
};
/* Gruppen je Seite (nur Darstellung), Feldreihenfolge bleibt */
{
  const G = {
    Termin: [
      ['Termin', ['datum']],
      ['Sachkundiger', ['sk', 'zert']],
    ],
    Dichtheitsprüfung: [
      ['Ergebnis', ['dicht', 'meth']],
      ['Nächste Prüfung', ['next']],
    ],
    'Prüfung / Wartung / Instandhaltung': [
      ['Art der Arbeit', ['art']],
      ['Bericht', ['ber']],
    ],
    Kältemittel: [
      ['Kältemittel', ['km', 'kz']],
      ['Mengen & Grund', ['ent', 'auf', 'grund']],
    ],
    'Mängel & Ergänzungen': [
      ['Mangel', ['mang', 'mass']],
      ['Ergänzung', ['erg']],
    ],
  };
  EINTRAG.pages.forEach((pg) =>
    (G[pg.title] || []).forEach(([name, ids]) =>
      ids.forEach((id) => {
        pg.fields.find((f) => f.id === id).group = name;
      }),
    ),
  );
}
[STAMM, EINTRAG].forEach((t) => {
  t.pages.forEach((pg) =>
    pg.fields.forEach((f) => {
      if (!f.pdf)
        f.pdf =
          pg.prefix && f.col.startsWith(pg.prefix) ? f.col.slice(pg.prefix.length) : f.col;
    }),
  );
  t.all = t.pages.flatMap((pg) => pg.fields);
  t.F = Object.fromEntries(t.all.map((f) => [f.id, f]));
});
