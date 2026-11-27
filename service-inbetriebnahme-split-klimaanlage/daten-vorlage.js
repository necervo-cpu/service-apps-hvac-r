// Daten: Feld-Definition und Protokollvorlage (entspricht dem Blatt "Datenbank_Split_IBN").
'use strict';

/* =====================================================================
Feld-Definition – entspricht dem Blatt "Datenbank_Split_IBN".
col = exakter Spaltenname im Google Sheet.
group = Zwischenüberschrift in der App, show = nur anzeigen, wenn …
table = Darstellung als Tabelle im PDF (eine Zeile pro Gerät)
===================================================================== */
const GWP = { R32: 675, R410A: 2088, R290: 3, R134a: 1430, R407C: 1774, R454B: 466 };
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
  return `<div class="fhint">Altwert: ${esc(x)}</div>`;
}
const IGS = [1, 2, 3, 4, 5];
const ok = (id, col, label, pdf, hint, extra) =>
  Object.assign({ id, col, label, pdf, hint, type: 'okfail' }, extra || {});
// Innengerät n nur zeigen, wenn die Anzahl angeschlossener Innengeräte ≥ n ist (leer = alle zeigen)
const igShow = (n) => (v) => !isN(v.anzIg) || num(v.anzIg) >= n;
const dT = (a, b) => (v) =>
  isN(v[a]) && isN(v[b]) ? round(Math.abs(num(v[a]) - num(v[b])), 1) : '';
const HINWEIS =
  'Dichtheitsprüfung gem. EU-F-Gase-VO durchgeführt. Regelmäßige Wartungsintervalle gem. Hersteller und VDMA 24186 einhalten.';

const TEMPLATE = {
  id: 'split-ibn',
  title: 'INBETRIEBNAHMEPROTOKOLL • SPLIT-KLIMA',
  pages: [
    {
      title: 'Stammdaten & Auftrag',
      short: 'Stammdaten',
      header: true,
      fields: [
        {
          id: 'projekt',
          col: 'Protokoll-Nr.',
          label: 'Protokoll-Nr.',
          type: 'text',
          hint: 'Vorschlag kann überschrieben werden – wird auch der PDF-Dateiname',
          init: () =>
            'IBN-' + today().replace(/-/g, '') + '-' + uid().slice(0, 4).toUpperCase(),
        },
        {
          id: 'kunde',
          col: 'Kunden-Nr.',
          label: 'Kunden-Nr.',
          type: 'text',
          ph: 'KD-98101',
        },
        {
          id: 'zust',
          col: 'Zuständigkeit',
          label: 'Zuständigkeit der Anlage',
          type: 'text',
          ph: 'Klimaanlage Büro',
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
          id: 'zusatz',
          col: 'Zusatzinformationen',
          label: 'Zusatzinformationen',
          type: 'longtext',
          wide: true,
          hint: 'Allgemeine Angaben, Aufstellort, Hinweise',
        },
      ],
    },
    {
      title: 'Außengerät & Kältetechnik',
      pdfTitle: 'Anlagendaten Außengerät & Kältetechnik',
      short: 'Außengerät',
      fields: [
        {
          id: 'anzIg',
          col: 'Anzahl angeschlossene Innengeräte',
          label: 'Anzahl angeschlossene Innengeräte',
          pdf: 'Anzahl Innengeräte',
          type: 'select',
          opts: ['1', '2', '3', '4', '5'],
          hint: 'Bestimmt, wie viele Innengeräte in den nächsten Schritten abgefragt werden',
        },
        {
          id: 'agMod',
          col: 'Außengerät Modell',
          label: 'Außengerät Modell',
          pdf: 'AG Modell',
          type: 'text',
          ph: 'Daikin 3MXM52A',
        },
        {
          id: 'agSn',
          col: 'Außengerät Seriennummer',
          label: 'Außengerät Seriennummer',
          pdf: 'AG Seriennummer',
          type: 'text',
        },
        {
          id: 'agDat',
          col: 'Außengerät Herstellungsdatum',
          label: 'Außengerät Herstellungsdatum',
          pdf: 'AG Herstellungsdatum',
          type: 'date',
          notFuture: true,
          hint: 'Laut Typenschild',
          init: () => today(),
        },
        {
          id: 'km',
          col: 'Außengerät Kältemitteltyp',
          label: 'Kältemitteltyp',
          type: 'select',
          opts: Object.keys(GWP),
          other: true,
        },
        {
          id: 'std',
          col: 'Außengerät Standard-Füllgewicht (kg)',
          label: 'Standard-Füllgewicht',
          pdf: 'Standardfüllung',
          type: 'number',
          unit: 'kg',
          min: 0,
          max: 100,
          hint: 'Werksfüllung laut Typenschild',
        },
        {
          id: 'zus',
          col: 'Außengerät Zusatz-Füllgewicht (kg)',
          label: 'Zusatz-Füllgewicht',
          pdf: 'Zusatzfüllung',
          type: 'number',
          unit: 'kg',
          min: 0,
          max: 100,
          hint: 'Nachgefüllt bei verlängerter Leitung',
        },
        {
          id: 'total',
          col: 'Außengerät Gesamt-Füllgewicht (kg)',
          label: 'Gesamt-Füllgewicht',
          pdf: 'Gesamtfüllmenge',
          type: 'calc',
          unit: 'kg',
          calc: (v) =>
            isN(v.std) ? round(num(v.std) + (isN(v.zus) ? num(v.zus) : 0), 3) : '',
        },
        {
          id: 'gwp',
          label: 'GWP-Wert',
          type: 'calc',
          calc: (v) => GWP[v.km] ?? '',
          note: (v) =>
            v.km && GWP[v.km] == null
              ? 'GWP für dieses Kältemittel unbekannt'
              : 'wird berechnet',
        },
        {
          id: 'co2',
          col: 'CO₂-Äquivalent (t)',
          label: 'CO₂-Äquivalent',
          type: 'calc',
          unit: 't CO₂e',
          calc: (v) =>
            isN(v.total) && isN(v.gwp) ? round((num(v.total) * num(v.gwp)) / 1000, 3) : '',
        },
        {
          id: 'pruef',
          col: 'Prüfpflicht',
          label: 'Prüfpflicht (Dichtheitsprüfung)',
          pdf: 'Prüfpflicht F-Gase',
          type: 'calc',
          calc: (v) => (isN(v.co2) ? (num(v.co2) >= 5 ? 'Ja' : 'Nein') : ''),
          note: () => 'ab 5 t CO₂-Äquivalent (EU 2024/573)',
        },
        {
          id: 'rohr',
          col: 'Gesamtrohrlänge (m)',
          label: 'Gesamtrohrlänge',
          type: 'number',
          unit: 'm',
          min: 0,
          max: 500,
        },
        {
          id: 'hoehe',
          col: 'Höhendifferenz AG / IG (m)',
          label: 'Höhendifferenz AG / IG',
          pdf: 'Höhendifferenz AG/IG',
          type: 'number',
          unit: 'm',
          min: -200,
          max: 200,
          hint: 'Bei mehreren Innengeräten: die Kombination mit der größten Höhendifferenz angeben',
        },
        {
          id: 'n2p',
          col: 'Stickstoff Prüfdruck (bar)',
          label: 'Stickstoff-Prüfdruck',
          pdf: 'N₂-Prüfdruck',
          type: 'number',
          unit: 'bar',
          min: 0,
          max: 100,
          ph: '40',
        },
        {
          id: 'n2d',
          col: 'Stickstoff Prüfdauer (h)',
          label: 'Stickstoff-Prüfdauer',
          pdf: 'N₂-Prüfdauer',
          type: 'number',
          unit: 'h',
          min: 0,
          max: 500,
          ph: '24',
        },
      ],
    },
    {
      title: 'Innengeräte (Multisplit 1 bis 5)',
      short: 'Innengeräte',
      table: {
        head: ['Gerät', 'Modell', 'Seriennummer', 'Herstellung', 'Zusatzinformationen'],
        rows: IGS.map((n) => ({
          label: `Innengerät ${n}`,
          show: igShow(n),
          ids: [`ig${n}Mod`, `ig${n}Sn`, `ig${n}Dat`, `ig${n}Info`],
        })),
      },
      fields: IGS.flatMap((n) => [
        {
          id: `ig${n}Mod`,
          col: `Innengerät ${n} Modell`,
          label: 'Modell',
          pdf: `IG ${n} Modell`,
          group: `Innengerät ${n}`,
          show: igShow(n),
          type: 'text',
          ph: 'FTXM25A',
        },
        {
          id: `ig${n}Sn`,
          col: `Innengerät ${n} Seriennummer`,
          label: 'Seriennummer',
          pdf: `IG ${n} Seriennummer`,
          group: `Innengerät ${n}`,
          show: igShow(n),
          type: 'text',
        },
        {
          id: `ig${n}Dat`,
          col: `Innengerät ${n} Herstellungsdatum`,
          label: 'Herstellungsdatum',
          pdf: `IG ${n} Herstellung`,
          group: `Innengerät ${n}`,
          show: igShow(n),
          type: 'date',
          notFuture: true,
          init: () => today(),
        },
        {
          id: `ig${n}Info`,
          col: `Innengerät ${n} Zusatzinformationen`,
          label: 'Zusatzinformationen',
          pdf: `IG ${n} Zusatzinfo`,
          group: `Innengerät ${n}`,
          show: igShow(n),
          type: 'text',
          ph: 'Raum, Leitungslänge, Port',
        },
      ]),
    },
    {
      title: 'Elektrik & Sicherheitseinrichtungen',
      short: 'Elektrik',
      fields: [
        {
          id: 'uNetz',
          col: 'Netzspannung (V)',
          label: 'Netzspannung',
          type: 'number',
          unit: 'V',
          min: 0,
          max: 1000,
          ph: '230',
        },
        {
          id: 'kabAg',
          col: 'Kabelquerschnitt AG (mm²)',
          label: 'Kabelquerschnitt Außengerät',
          pdf: 'Kabel AG',
          type: 'number',
          unit: 'mm²',
          min: 0,
          max: 300,
          ph: '2,5',
        },
        {
          id: 'kabIg',
          col: 'Kabelquerschnitt IG (mm²)',
          label: 'Kabelquerschnitt Innengerät',
          pdf: 'Kabel IG',
          type: 'number',
          unit: 'mm²',
          min: 0,
          max: 300,
          ph: '1,5',
        },
        {
          id: 'rcd',
          col: 'RCD / FI-Schutzschalter Typ',
          label: 'RCD / FI-Schutzschalter Typ',
          pdf: 'RCD / FI-Schutz',
          type: 'text',
          ph: 'Typ A / 40 A / 30 mA',
        },
        {
          id: 'sich',
          col: 'Sicherung Bemessungsstrom (A)',
          label: 'Sicherung Bemessungsstrom',
          pdf: 'Sicherung',
          type: 'text',
          ph: 'B16',
        },
        {
          id: 'rep',
          col: 'Reparaturschalter Typ',
          label: 'Reparaturschalter Typ',
          pdf: 'Reparaturschalter',
          type: 'text',
          ph: '20 A 3+N',
        },
        ok(
          'elAnschl',
          'Elektrische Anschlüsse / Kontakt i.O.',
          'Elektrische Anschlüsse / Kontakt',
          'Anschlüsse / Kontakt',
          'Sichtprüfung und Festsitz der Klemmen',
          { group: 'Prüfpunkte Elektrik' },
        ),
        ok(
          'elHb',
          'Check Elektrosystem nach Handbuch',
          'Elektrosystem nach Handbuch',
          'Elektrosystem nach Handbuch',
          '',
          { group: 'Prüfpunkte Elektrik' },
        ),
        ok(
          'erdung',
          'Check Erdung ordnungsgemäß',
          'Erdung ordnungsgemäß',
          'Erdung ordnungsgemäß',
          'Schutzleiter an AG und IG',
          { group: 'Prüfpunkte Elektrik' },
        ),
        ok(
          'verdr',
          'Check Verdrahtung nach Spezifikation',
          'Verdrahtung nach Spezifikation',
          'Verdrahtung nach Spezifikation',
          '',
          { group: 'Prüfpunkte Elektrik' },
        ),
        ok(
          'sichHb',
          'Check Sicherungen nach Handbuch',
          'Sicherungen nach Handbuch',
          'Sicherungen nach Handbuch',
          '',
          { group: 'Prüfpunkte Elektrik' },
        ),
        ok(
          'steuer',
          'Check Steuerstromverdrahtung fertiggestellt',
          'Steuerstromverdrahtung fertiggestellt',
          'Steuerstromverdrahtung fertig',
          'Kommunikationsleitung AG ↔ IG',
          { group: 'Prüfpunkte Elektrik' },
        ),
        ok(
          'elko',
          'Check Elektronische Komponenten i.O.',
          'Elektronische Komponenten i.O.',
          'Elektronische Komponenten',
          '',
          { group: 'Prüfpunkte Elektrik' },
        ),
      ],
    },
    {
      title: 'Montage- & Umgebungsprüfung',
      pdfTitle: 'Montage-, Umgebungs- & Kältetechnik-Prüfung (Checkliste)',
      short: 'Montage',
      kind: 'check',
      fields: [
        ok(
          'mont',
          'Check Montage AG & IG ordnungsgemäß',
          'Montage AG & IG ordnungsgemäß',
          'Montage AG & IG ordnungsgemäß',
          'Befestigung, Wandhalter, Konsole, Schwingungsdämpfer',
          { group: 'Montage & Umgebung' },
        ),
        ok(
          'schnee',
          'Check AG Schnee- & Frostschutz',
          'Schnee- & Frostschutz (AG)',
          'Schnee- & Frostschutz (AG)',
          '',
          { group: 'Montage & Umgebung' },
        ),
        ok('wind', 'Check AG Windschutz', 'Windschutz (AG)', 'Windschutz (AG)', '', {
          group: 'Montage & Umgebung',
        }),
        ok(
          'see',
          'Check AG Seewindschutz',
          'Seewindschutz (AG)',
          'Seewindschutz (AG)',
          'Nur in Küstennähe, sonst „entfällt“',
          { group: 'Montage & Umgebung' },
        ),
        ok(
          'frei',
          'Check Wartungsfreiraum & Luftzirkulation',
          'Wartungsfreiraum & Luftzirkulation',
          'Wartungsfreiraum & Luftzirkulation',
          'Mindestabstände laut Hersteller',
          { group: 'Montage & Umgebung' },
        ),
        ok(
          'korr',
          'Check Keine Korrosion / Oxidation',
          'Keine Korrosion / Oxidation',
          'Keine Korrosion / Oxidation',
          '',
          { group: 'Montage & Umgebung' },
        ),
        ok(
          'aufk',
          'Check Aufkleber vorhanden & passend',
          'Aufkleber vorhanden & passend',
          'Aufkleber vorhanden & passend',
          '',
          { group: 'Montage & Umgebung' },
        ),
        ok(
          'besch',
          'Check Keine Beschädigung / Quetschung',
          'Keine Beschädigung / Quetschung',
          'Keine Bauteilschäden / Quetschungen',
          'Gehäuse, Leitungen, Isolierung',
          { group: 'Montage & Umgebung' },
        ),
        ok(
          'luefMech',
          'Check Lüfter mechanisch freigängig',
          'Lüfter mechanisch freigängig',
          'Lüfter mechanisch freigängig',
          '',
          { group: 'Montage & Umgebung' },
        ),
        ok(
          'luft',
          'Check Lufteinlass & -auslass frei',
          'Lufteinlass & -auslass frei',
          'Lufteinlass & -auslass frei',
          '',
          { group: 'Montage & Umgebung' },
        ),
        ok(
          'ablauf',
          'Check Wasserablauf reibungslos',
          'Wasserablauf reibungslos',
          'Wasserablauf reibungslos',
          'Kondensatablauf mit Gefälle, Probe mit Wasser',
          { group: 'Montage & Umgebung' },
        ),
        ok(
          'absperr',
          'Check Absperrventile geöffnet',
          'Absperrventile geöffnet',
          'Absperrventile geöffnet',
          'Flüssigkeits- und Sauggasventil ganz offen, Kappen dicht',
          { group: 'Kältetechnik' },
        ),
        ok(
          'iso',
          'Check Rohrisolierung ordnungsgemäß',
          'Rohrisolierung ordnungsgemäß',
          'Rohrisolierung ordnungsgemäß',
          '',
          { group: 'Kältetechnik' },
        ),
        ok(
          'kml',
          'Check Kältemittelleitung nach Handbuch',
          'Kältemittelleitung nach Handbuch',
          'Kältemittelleitung nach Handbuch',
          'Durchmesser, Länge, Bördel / Lötstellen',
          { group: 'Kältetechnik' },
        ),
        ok(
          'fgas',
          'Check F-Gase-Aufkleber ausgefüllt',
          'F-Gase-Aufkleber ausgefüllt',
          'F-Gase-Aufkleber ausgefüllt',
          'Gesamtfüllmenge und CO₂-Äquivalent eingetragen',
          { group: 'Kältetechnik' },
        ),
        ok(
          'sens',
          'Check Sensoren & Thermistoren Position',
          'Sensoren & Thermistoren Position',
          'Sensoren & Thermistoren Position',
          '',
          { group: 'Sensorik & Platine' },
        ),
        ok(
          'haeng',
          'Check Hängestutzen Platine entfernt',
          'Hängestutzen Platine entfernt',
          'Hängestutzen Platine entfernt',
          'Transportsicherung',
          { group: 'Sensorik & Platine', legacy: true },
        ), // entfallen: im Formular ausgeblendet, alte Werte weiter im PDF
      ],
    },
    {
      title: 'Funktionsprüfung Innen- & Außengeräte',
      short: 'Funktion',
      kind: 'check',
      table: {
        head: [
          'Gerät',
          'Lüfter dreht frei',
          'Lamellen & Klappen',
          'WLAN-Adapter',
          'Tauwasserpumpe',
        ],
        rows: IGS.map((n) => ({
          label: `Innengerät ${n}`,
          show: igShow(n),
          ids: [`ig${n}Lf`, `ig${n}Lam`, `ig${n}Wlan`, `ig${n}Pumpe`],
        })),
      },
      fields: [
        ...IGS.flatMap((n) => [
          ok(
            `ig${n}Lf`,
            `Check IG${n} Lüfter dreht frei`,
            'Lüfter dreht frei',
            `IG ${n} Lüfter`,
            '',
            { group: `Innengerät ${n}`, show: igShow(n) },
          ),
          ok(
            `ig${n}Lam`,
            `Check IG${n} Lamellen & Klappen`,
            'Lamellen & Klappen',
            `IG ${n} Lamellen & Klappen`,
            '',
            { group: `Innengerät ${n}`, show: igShow(n) },
          ),
          ok(
            `ig${n}Wlan`,
            `Check IG${n} WLAN-Adapter`,
            'WLAN-Adapter',
            `IG ${n} WLAN-Adapter`,
            '',
            { group: `Innengerät ${n}`, show: igShow(n) },
          ),
          ok(
            `ig${n}Pumpe`,
            `Check IG${n} Tauwasserpumpe`,
            'Tauwasserpumpe',
            `IG ${n} Tauwasserpumpe`,
            '',
            { group: `Innengerät ${n}`, show: igShow(n) },
          ),
        ]),
        ok(
          'agLf',
          'Check AG Lüfter dreht frei',
          'Lüfter Außengerät dreht frei',
          'Lüfter Außengerät dreht frei',
          '',
          { group: 'Außengerät & Allgemein' },
        ),
        ok(
          'geraeusch',
          'Check Keine ungewöhnlichen Geräusche',
          'Keine ungewöhnlichen Geräusche',
          'Keine ungewöhnlichen Geräusche',
          '',
          { group: 'Außengerät & Allgemein' },
        ),
        {
          id: 'fc',
          col: 'Check Fehlercodes vorhanden',
          label: 'Fehlercodes vorhanden',
          type: 'yesno',
          good: ['Nein'],
          bad: ['Ja'],
          group: 'Außengerät & Allgemein',
        },
        {
          id: 'fcNote',
          col: 'Notiz Fehlercodes',
          label: 'Notiz Fehlercodes',
          pdf: 'Fehlercodes / Notiz',
          type: 'longtext',
          wide: true,
          group: 'Außengerät & Allgemein',
          hint: 'Angezeigte Codes und was dagegen getan wurde',
        },
      ],
    },
    {
      title: 'Betriebsmesswerte',
      pdfTitle: 'Betriebsmesswerte & Verdichterdaten',
      short: 'Messwerte',
      table: {
        head: ['Gerät', 'Lufteinlass', 'Luftauslass', 'Temperaturdiff. ΔT'],
        rows: [
          ...IGS.map((n) => ({
            label: `Innengerät ${n}`,
            show: igShow(n),
            ids: [`ig${n}Tin`, `ig${n}Tout`, `ig${n}Dt`],
          })),
          { label: 'Außengerät', ids: ['agTin', 'agTout', 'agDt'] },
        ],
      },
      fields: [
        {
          id: 'modus',
          col: 'Betriebsmodus',
          label: 'Betriebsmodus',
          type: 'select',
          opts: ['Kühlen', 'Heizen', 'Entfeuchten', 'Lüften', 'Auto'],
        },
        {
          id: 'soll',
          col: 'Solltemperatur (°C)',
          label: 'Solltemperatur',
          type: 'number',
          unit: '°C',
          min: 0,
          max: 50,
          ph: '22',
        },
        {
          id: 'strom',
          col: 'Stromaufnahme L1 (A)',
          label: 'Stromaufnahme L1',
          pdf: 'Stromaufnahme',
          type: 'number',
          unit: 'A',
          min: 0,
          max: 100,
          hint: 'Strommesszange, Verdichter unter Last',
        },
        ...IGS.flatMap((n) => [
          {
            id: `ig${n}Tin`,
            col: `IG${n} Lufteinlasstemperatur (°C)`,
            label: 'Lufteinlasstemperatur',
            pdf: `IG ${n} Lufteinlass`,
            group: `Innengerät ${n}`,
            show: igShow(n),
            type: 'number',
            unit: '°C',
            min: -40,
            max: 80,
          },
          {
            id: `ig${n}Tout`,
            col: `IG${n} Luftauslasstemperatur (°C)`,
            label: 'Luftauslasstemperatur',
            pdf: `IG ${n} Luftauslass`,
            group: `Innengerät ${n}`,
            show: igShow(n),
            type: 'number',
            unit: '°C',
            min: -40,
            max: 80,
          },
          {
            id: `ig${n}Dt`,
            label: 'Temperaturdifferenz ΔT',
            group: `Innengerät ${n}`,
            show: igShow(n),
            type: 'calc',
            unit: 'K',
            calc: dT(`ig${n}Tin`, `ig${n}Tout`),
          },
        ]),
        {
          id: 'agTin',
          col: 'AG Lufteinlasstemperatur (°C)',
          label: 'Lufteinlasstemperatur',
          pdf: 'AG Lufteinlass',
          group: 'Außengerät',
          type: 'number',
          unit: '°C',
          min: -40,
          max: 80,
        },
        {
          id: 'agTout',
          col: 'AG Luftauslasstemperatur (°C)',
          label: 'Luftauslasstemperatur',
          pdf: 'AG Luftauslass',
          group: 'Außengerät',
          type: 'number',
          unit: '°C',
          min: -40,
          max: 80,
        },
        {
          id: 'agDt',
          label: 'Temperaturdifferenz ΔT',
          group: 'Außengerät',
          type: 'calc',
          unit: 'K',
          calc: dT('agTin', 'agTout'),
        },
      ],
    },
    {
      title: 'Inbetriebnahme-Abschluss & Abnahme',
      short: 'Abschluss',
      final: true,
      fields: [
        {
          id: 'erfolg',
          col: 'Inbetriebnahme erfolgreich',
          label: 'Gesamtbewertung Inbetriebnahme',
          type: 'bewertung',
        },
        {
          id: 'erfolgM',
          col: 'Inbetriebnahme erfolgreich' + MANGEL_SUFFIX,
          label: 'Mangel / Maßnahme',
          type: 'text',
          parent: 'erfolg',
          ph: 'Was ist festzustellen, was ist zu tun?',
          show: (v) => v.erfolg === 'n.i.O.',
        },
        {
          id: 'einw',
          col: 'Einweisung Betreiber',
          label: 'Einweisung Betreiber erfolgt',
          hint: 'In Funktion & Bedienung',
          type: 'yesno',
        },
        {
          id: 'bem',
          col: 'Bemerkungen zur Abnahme',
          label: 'Bemerkungen zur Abnahme',
          type: 'longtext',
          wide: true,
          hint: 'Mängel, Nacharbeiten, Hinweise für den Betreiber',
        },
      ],
    },
  ],
};
/* Gruppen je Seite (nur Darstellung: Überschrift + Karte). Reihenfolge der Felder bleibt, damit PDF und Sheet unverändert sind.
Seiten mit eigenen group-Angaben (Innengeräte, Montage, Funktion; Elektrik-Prüfpunkte) behalten sie; Stammdaten bleiben ohne Gruppen. */
{
  const G = {
    'Außengerät & Kältetechnik': [
      ['Außengerät', ['anzIg', 'agMod', 'agSn', 'agDat']],
      ['Kältemittel', ['km', 'std', 'zus', 'total', 'gwp', 'co2', 'pruef']],
      ['Leitungen & Dichtheit', ['rohr', 'hoehe', 'n2p', 'n2d']],
    ],
    'Elektrik & Sicherheitseinrichtungen': [
      ['Stromversorgung', ['uNetz', 'kabAg', 'kabIg']],
      ['Absicherung', ['rcd', 'sich', 'rep']],
    ],
    Betriebsmesswerte: [['Betrieb', ['modus', 'soll', 'strom']]],
    'Inbetriebnahme-Abschluss & Abnahme': [
      ['Ergebnis', ['erfolg', 'erfolgM', 'einw']],
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
