// Feld-Definition der Wartungs-Vorlage (Datenbank-Spalten, Prüfpunkte, Messwerte).

'use strict';

/* =====================================================================
Feld-Definition – entspricht dem Blatt "Datenbank" / "AppSheet_Konfiguration".
col = exakter Spaltenname im Google Sheet.
===================================================================== */
const GWP = { R290: 3, R32: 675, R410A: 2088, R454B: 466, R134a: 1430, R407C: 1774 };
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
const ok = (id, col, label, pdf, hint, req = true) => ({
  id,
  col,
  label,
  pdf,
  hint,
  type: 'okfail',
  req,
});

const TEMPLATE = {
  id: 'wp-wartung',
  title: 'WARTUNGSPROTOKOLL • WÄRMEPUMPE',
  pages: [
    {
      title: 'Stammdaten & Auftrag',
      short: 'Stammdaten',
      header: true,
      fields: [
        {
          id: 'projekt',
          col: 'Projektnummer',
          label: 'Projektnummer',
          pdf: 'Protokoll-Nr.',
          type: 'text',
          req: true,
          hint: 'Vorschlag kann überschrieben werden',
          init: () =>
            'WP-' + today().replace(/-/g, '') + '-' + uid().slice(0, 4).toUpperCase(),
        },
        {
          id: 'kunde',
          col: 'Kundennummer',
          label: 'Kundennummer',
          pdf: 'Kunden-Nr.',
          type: 'text',
          req: true,
          ph: 'KD-98101',
        },
        {
          id: 'datum',
          col: 'Datum',
          label: 'Datum',
          type: 'date',
          req: true,
          notFuture: true,
          init: () => today(),
        },
        {
          id: 'monteur',
          col: 'Monteur',
          label: 'Monteur',
          pdf: 'Monteur / Prüfer',
          type: 'text',
          req: true,
          init: () => settings.techniker,
        },
        {
          id: 'zusatz',
          col: 'Zusatzinformationen',
          label: 'Zusatzinformationen',
          type: 'longtext',
          wide: true,
          hint: 'Allgemeine Angaben, Kundengespräche, Anfahrt',
        },
      ],
    },
    {
      title: 'Anlagendaten (Außen- & Inneneinheit)',
      short: 'Anlage',
      fields: [
        {
          id: 'zust',
          col: 'Zuständigkeit',
          label: 'Zuständigkeit der Anlage',
          type: 'text',
          ph: 'Heizung und Warmwasser Wohnhaus',
        },
        {
          id: 'agModell',
          col: 'Außeneinheit Modell',
          label: 'Außeneinheit Modell',
          pdf: 'AG Modell',
          type: 'text',
          req: true,
          ph: 'Daikin ERGA08DAV3',
        },
        {
          id: 'agSn',
          col: 'Außeneinheit Seriennummer',
          label: 'Außeneinheit Seriennummer',
          pdf: 'AG Seriennummer',
          type: 'text',
          req: true,
        },
        {
          id: 'agDat',
          col: 'Außeneinheit Herstellungsdatum',
          label: 'Außeneinheit Herstellungsdatum',
          pdf: 'AG Herstellungsdatum',
          type: 'date',
          notFuture: true,
          hint: 'Baujahr laut Typenschild',
          init: () => today(),
        },
        {
          id: 'igModell',
          col: 'Inneneinheit Modell',
          label: 'Inneneinheit Modell',
          pdf: 'IG Modell',
          type: 'text',
          req: true,
          ph: 'FTXA35, Vitocal Hydro',
        },
        {
          id: 'igSn',
          col: 'Inneneinheit Seriennummer',
          label: 'Inneneinheit Seriennummer',
          pdf: 'IG Seriennummer',
          type: 'text',
          req: true,
        },
        {
          id: 'igDat',
          col: 'Inneneinheit Herstellungsdatum',
          label: 'Inneneinheit Herstellungsdatum',
          pdf: 'IG Herstellungsdatum',
          type: 'date',
          notFuture: true,
          init: () => today(),
        },
        {
          id: 'zusInfo',
          col: 'Zusätzliche Informationen',
          label: 'Zusätzliche Informationen',
          pdf: 'Zusatzinfo',
          type: 'longtext',
          wide: true,
          hint: 'z. B. Reparaturschalter, Ölabscheider, Schwingungsdämpfer',
        },
      ],
    },
    {
      title: 'Kältekreislauf & F-Gase-Prüfung',
      pdfTitle: 'Kältekreislauf & F-Gase-Prüfung (EU 2024/573)',
      short: 'Kältekreis',
      fields: [
        {
          id: 'km',
          col: 'Kältemitteltyp',
          label: 'Kältemitteltyp',
          type: 'select',
          opts: Object.keys(GWP),
          req: true,
          init: 'R32',
        },
        {
          id: 'std',
          col: 'Standardfüllung (kg)',
          label: 'Standardfüllung',
          type: 'number',
          unit: 'kg',
          req: true,
          min: 0,
          max: 100,
          hint: 'Werksfüllung laut Typenschild',
        },
        {
          id: 'zus',
          col: 'Zusatzfüllung (kg)',
          label: 'Zusatzfüllung',
          type: 'number',
          unit: 'kg',
          req: true,
          min: 0,
          max: 100,
          init: '0',
          hint: 'Nachgefüllt bei verlängerter Leitung',
        },
        {
          id: 'total',
          col: 'Gesamtgewicht Kältemittel (kg)',
          label: 'Gesamtfüllgewicht',
          type: 'calc',
          unit: 'kg',
          calc: (v) =>
            isN(v.std) ? round(num(v.std) + (isN(v.zus) ? num(v.zus) : 0), 3) : '',
        },
        {
          id: 'gwp',
          col: 'Treibhauspotenzial (GWP)',
          label: 'GWP-Wert',
          type: 'calc',
          calc: (v) => GWP[v.km] ?? '',
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
          id: 'herm',
          col: 'Hermetisch geschlossen',
          label: 'Hermetisch geschlossen',
          type: 'yesno',
          req: true,
          init: 'Nein',
        },
        {
          id: 'dpv',
          col: 'Dichtheitsprüfung vorgeschrieben',
          label: 'Dichtheitsprüfung vorgeschrieben',
          type: 'calc',
          calc: (v) =>
            isN(v.co2) ? (num(v.co2) >= (v.herm === 'Ja' ? 10 : 5) ? 'Ja' : 'Nein') : '',
          note: (v) =>
            `Grenzwert ${v.herm === 'Ja' ? 10 : 5} t CO₂-Äq. (${v.herm === 'Ja' ? 'hermetisch' : 'nicht hermetisch'})`,
        },
        {
          id: 'dp',
          col: 'Außeneinheit Dichtheitsprüfung (F-Gase)',
          label: 'Dichtheitsprüfung (F-Gase)',
          type: 'calc',
          calc: (v) => {
            if (v.dpv === '') return '';
            if (v.dpv !== 'Ja') return 'Nicht notwendig';
            const co2 = isN(v.co2) ? num(v.co2) : 0;
            if (co2 >= 500) return 'Alle 3 Monate';
            if (co2 >= 50) return 'Alle 6 Monate';
            return 'Alle 12 Monate';
          },
        },
        {
          id: 'dpErg',
          col: 'Außeneinheit Dichtheitsprüfung Ergebnis',
          label: 'Dichtheitsprüfung Ergebnis',
          pdf: 'Prüfergebnis',
          type: 'select',
          opts: ['erfolgreich', 'nicht erfolgreich', 'entfällt'],
          good: ['erfolgreich'],
          bad: ['nicht erfolgreich'],
          reqIf: (v) => v.dp === 'Jährlich',
          hint: 'Auszufüllen, wenn die Dichtheitsprüfung vorgeschrieben ist',
        },
        {
          id: 'kkInfo',
          col: 'Kältekreislauf Zusatzinformationen',
          label: 'Kältekreislauf Zusatzinformationen',
          pdf: 'Zusatzinfo Kältekreislauf',
          type: 'longtext',
          wide: true,
          hint: 'Lecksuchmethode (Gasspürgerät, Formiergas), Nachdichtungen …',
        },
      ],
    },
    {
      title: 'Elektrik, Schutzorgane & Absicherung',
      pdfTitle: 'Elektrisches System & Sicherheitseinrichtungen',
      short: 'Elektrik',
      fields: [
        {
          id: 'uAg',
          col: 'Netzspannung Außeneinheit (V)',
          label: 'Netzspannung Außeneinheit',
          pdf: 'Netzspannung AG',
          type: 'number',
          unit: 'V',
          req: true,
          min: 195,
          max: 440,
          ph: '230',
        },
        {
          id: 'uAgSt',
          col: 'Netzspannung Außeneinheit Steuerstrom (V)',
          label: 'Netzspannung Außeneinheit Steuerstrom',
          pdf: 'Netzspannung AG Steuerstrom',
          type: 'number',
          unit: 'V',
          min: 0,
          max: 440,
          ph: '230',
          hint: 'EVU-Sperre / Steuerstrom; leer lassen, wenn nicht vorhanden',
        },
        {
          id: 'uIg',
          col: 'Netzspannung Inneneinheit (V)',
          label: 'Netzspannung Inneneinheit',
          pdf: 'Netzspannung IG',
          type: 'number',
          unit: 'V',
          req: true,
          min: 195,
          max: 440,
          ph: '230',
        },
        {
          id: 'uHs',
          col: 'Netzspannung Heizstab (V)',
          label: 'Netzspannung Heizstab',
          type: 'number',
          unit: 'V',
          min: 0,
          max: 440,
          ph: '400',
          hint: '0, falls kein Heizstab verbaut',
        },
        {
          id: 'fAg',
          col: 'Absicherung Außeneinheit (A)',
          label: 'Absicherung Außeneinheit',
          pdf: 'Sicherung AG',
          type: 'text',
          req: true,
          ph: 'B16',
        },
        {
          id: 'fAgSt',
          col: 'Absicherung Außeneinheit Steuerstrom (A)',
          label: 'Absicherung Außeneinheit Steuerstrom',
          pdf: 'Sicherung AG Steuerstrom',
          type: 'text',
          ph: 'B10',
        },
        {
          id: 'fIg',
          col: 'Absicherung Inneneinheit (A)',
          label: 'Absicherung Inneneinheit',
          pdf: 'Sicherung IG',
          type: 'text',
          req: true,
          ph: 'B16',
        },
        {
          id: 'fHs',
          col: 'Absicherung Heizstab (A)',
          label: 'Absicherung Heizstab',
          pdf: 'Sicherung Heizstab',
          type: 'text',
          ph: 'B16',
          hint: 'Leer lassen, wenn kein Heizstab verbaut ist',
        },
        {
          id: 'rcd',
          col: 'RCD-Typ / FI-Schutz',
          label: 'RCD-Typ / FI-Schutz',
          pdf: 'RCD-Schutz',
          type: 'text',
          ph: 'Typ A / 40 A / 30 mA',
          req: true,
        },
        ok(
          'elAnschl',
          'Elektrische Anschlüsse geprüft',
          'Elektrische Anschlüsse geprüft',
          'Kontaktprüfung',
          'Sichtprüfung und Festsitz der Klemmen (VDE 0100)',
        ),
        ok(
          'elFunk',
          'Elektrische Funktionsprüfung',
          'Elektrische Funktionsprüfung',
          'Funktionsprüfung',
          'Gesamtprüfung aller elektrischen Funktionen und Sicherheitsabschaltungen',
        ),
      ],
    },
    {
      title: 'Wartungscheckliste Außeneinheit',
      short: 'Wartung AG',
      kind: 'check',
      fields: [
        ok(
          'agReinig',
          'Außeneinheit Reinigung Verkleidung & Verdampfer',
          'Reinigung Verkleidung & Verdampfer',
          'Außeneinheit reinigen (Verkleidung + Verdampfer)',
          'Lamellen von Pollen, Blättern, Schmutz befreien',
        ),
        ok(
          'agElek',
          'Außeneinheit Sichtkontrolle Elektrik',
          'Sichtkontrolle Elektrik',
          'Sichtkontrolle elektr. Anschlussleitungen (AG)',
          'Marderbiss, Korrosion, Feuchtigkeit, lose Leitungen',
        ),
        ok(
          'agFuehl',
          'Außeneinheit Fühlerposition prüfen',
          'Fühlerposition prüfen',
          'Fühlerposition prüfen (AG)',
          'Fester Sitz von Außen- und Heißgasfühler',
        ),
        ok(
          'agKond',
          'Außeneinheit Kondensatablauf & Bodenplatte',
          'Kondensatablauf & Bodenplatte',
          'Kondensatablauf und Bodenplatte reinigen',
          'Freier Tauwasserablauf, Bodenwannenheizung',
        ),
        ok(
          'agVent',
          'Außeneinheit Ventilatorwelle schmieren',
          'Ventilatorwelle schmieren',
          'Schmieren der Ventilatorwelle (AG)',
          'Bei wartungsfreien EC-Lüftern meist „entfällt“',
        ),
        ok(
          'agPlat',
          'Außeneinheit Platinenraum reinigen',
          'Platinenraum reinigen',
          'Reinigung Platinenanschlussraum (AG)',
          'Staub, Spinnweben, Insekten entfernen',
        ),
        ok(
          'agFilt',
          'Außeneinheit Filter Heizung reinigen',
          'Filter Heizung reinigen',
          'Reinigung heizungsseitiger Filter (AG)',
          'Schmutzfänger / Sieb (v. a. Monoblock)',
        ),
        ok(
          'agAbtau',
          'Außeneinheit Abtauung',
          'Abtauung auf Funktion geprüft',
          'Abtauung und Tauwasserablaufheizung auf Funktion prüfen',
          'Abtauzyklus beobachten oder im Servicemenü auslösen; Sole-WP: „entfällt“',
          false,
        ),
      ],
    },
    {
      title: 'Wartungscheckliste Inneneinheit & Hydraulik',
      short: 'Wartung IG',
      kind: 'check',
      fields: [
        ok(
          'igReinig',
          'Inneneinheit Reinigung',
          'Inneneinheit Reinigung',
          'Inneneinheit reinigen',
          'Gehäuseoberflächen und Innenkomponenten',
        ),
        ok(
          'igElek',
          'Inneneinheit Sichtkontrolle Elektrik',
          'Sichtkontrolle Elektrik',
          'Sichtkontrolle elektr. Anschlussleitungen (IG)',
          'Verkabelung, Steuerplatine, Pumpenstecker',
        ),
        ok(
          'igFuehl',
          'Inneneinheit Fühlerposition prüfen',
          'Fühlerposition prüfen',
          'Fühlerposition prüfen (IG)',
          'Vorlauf-, Rücklauf-, Speicherfühler',
        ),
        ok(
          'hydDicht',
          'Hydraulik Dichtheit',
          'Hydraulik Dichtheit',
          'Sichtkontrolle Hydraulik auf Dichtheit',
          'Rohrverbindungen, Schieber, Pressfittings, Pumpen',
        ),
        ok(
          'sicher',
          'Sicherheitsbauteile prüfen',
          'Sicherheitsbauteile prüfen',
          'Überprüfen der Sicherheitsbauteile',
          'Sicherheitsventil, Schnellentlüfter',
        ),
        ok(
          'igFilt',
          'Inneneinheit Filter Heizung reinigen',
          'Filter Heizung reinigen',
          'Reinigung heizungsseitiger Filter (IG)',
          'Magnetit- / Schlammabscheider im Rücklauf',
        ),
        ok(
          'speicher',
          'Speicher Füllstand prüfen',
          'Speicher Füllstand prüfen',
          'Füllstand prüfen (drucklose Speichersysteme)',
          'Puffer- und Warmwasserspeicher entlüften',
          false,
        ),
        ok(
          'anode',
          'Opferanode prüfen',
          'Opferanode prüfen',
          'Opferanode im Trinkwasserspeicher prüfen',
          'Fremdstromanode / Magnesiumanode',
          false,
        ),
        ok(
          'sichGr',
          'Sicherheitsgruppe Trinkwasser',
          'Sicherheitsgruppe Trinkwasser',
          'Sicherheitsgruppe auf Funktion prüfen (Trinkwasser)',
          'Sicherheitsventil anlüften, Rückflussverhinderer prüfen',
          false,
        ),
        ok(
          'druckMind',
          'Druckminderer Trinkwasser',
          'Druckminderer Trinkwasser',
          'Druckminderer auf Funktion prüfen (Trinkwasser)',
          'Hinterdruck ablesen, ggf. nachstellen; kein Druckminderer: „entfällt“',
          false,
        ),
        ok(
          'ueberstr',
          'Funktion Überströmventil',
          'Funktion Überströmventil',
          'Funktion Überströmventil überprüfen',
          'Freigängigkeit und Einstellung',
          false,
        ),
        ok(
          'aktor',
          'Aktorentest',
          'Aktorentest',
          'Aktorentest (Pumpen & Stellmotoren)',
          'Umwälzpumpe, 3-Wege-Ventil Heizen/Warmwasser',
        ),
      ],
    },
    {
      title: 'Hydraulik, Systemdrücke & Heizwasser (VDI 2035)',
      short: 'Hydraulik',
      fields: [
        {
          id: 'druck',
          col: 'Heizungsdruck (bar)',
          label: 'Heizungs-Fülldruck',
          type: 'number',
          unit: 'bar',
          req: true,
          min: 0.5,
          max: 4,
          sMin: 1.2,
          sMax: 2.0,
          ph: '1,5',
        },
        {
          id: 'mag',
          col: 'Ausdehnungsgefäß Vordruck (bar)',
          label: 'Ausdehnungsgefäß Vordruck',
          type: 'number',
          unit: 'bar',
          req: true,
          min: 0.5,
          max: 3,
          sMin: 1.0,
          sMax: 1.5,
          ph: '1,1',
          hint: 'Stickstoff-Vordruck im wasserseitig drucklosen Zustand',
        },
        {
          id: 'entl',
          col: 'Automatische Entlüfter verbaut (R290)',
          label: 'Automatische Entlüfter verbaut?',
          pdf: 'Automatische Entlüfter verbaut',
          type: 'yesno',
          warn: ['Ja'],
          soll: 'bei R290 prüfen',
          show: (v) => v.km === 'R290',
          hint: 'Nur bei R290 (Propan): automatische Entlüfter im Heizkreis nur mit Bedacht verbauen (Kältemittel-Gefahr)',
        },
        {
          id: 'lf',
          col: 'Heizwasser Leitfähigkeit (µS/cm)',
          label: 'Elektrische Leitfähigkeit',
          type: 'number',
          unit: 'µS/cm',
          req: true,
          min: 0,
          max: 1500,
          sMax: 100,
          ph: '99',
        },
        {
          id: 'ph',
          col: 'Heizwasser pH-Wert',
          label: 'pH-Wert Heizwasser',
          type: 'number',
          unit: 'pH',
          req: true,
          min: 0,
          max: 14,
          sMin: 8.2,
          sMax: 9.0,
          ph: '8,5',
        },
        {
          id: 'wasser',
          label: 'Wasser-Zustand (VDI 2035)',
          type: 'calc',
          calc: (v) =>
            isN(v.ph) && isN(v.lf)
              ? num(v.ph) >= 8.2 && num(v.ph) <= 9.0 && num(v.lf) <= 100
                ? 'im Richtbereich'
                : 'außerhalb Richtbereich'
              : '',
          note: () => 'Richtbereich 8,2 – 9,0 pH | ≤ 100 µS/cm',
        },
      ],
    },
    {
      title: 'Betriebsdaten & Messwerte',
      short: 'Messwerte',
      fields: [
        {
          id: 'tEin',
          col: 'Lufteinlasstemperatur (°C)',
          label: 'Lufteinlasstemperatur',
          type: 'number',
          unit: '°C',
          req: true,
          min: -30,
          max: 50,
          ph: '15',
        },
        {
          id: 'tAus',
          col: 'Luftauslasstemperatur (°C)',
          label: 'Luftauslasstemperatur',
          type: 'number',
          unit: '°C',
          req: true,
          min: -35,
          max: 45,
          ph: '10',
        },
        {
          id: 'dT',
          label: 'Luft-Spreizung ΔT',
          type: 'calc',
          unit: 'K',
          calc: (v) =>
            isN(v.tEin) && isN(v.tAus) ? round(num(v.tEin) - num(v.tAus), 1) : '',
        },
        {
          id: 'tVl',
          col: 'Vorlauftemperatur (°C)',
          label: 'Vorlauftemperatur',
          type: 'number',
          unit: '°C',
          min: 0,
          max: 80,
          ph: '35',
        },
        {
          id: 'tRl',
          col: 'Rücklauftemperatur (°C)',
          label: 'Rücklauftemperatur',
          type: 'number',
          unit: '°C',
          min: 0,
          max: 80,
          ph: '30',
        },
        {
          id: 'dTw',
          col: 'Spreizung VL-RL (K)',
          label: 'Spreizung VL–RL',
          type: 'calc',
          unit: 'K',
          calc: (v) => (isN(v.tVl) && isN(v.tRl) ? round(num(v.tVl) - num(v.tRl), 1) : ''),
        },
        {
          id: 'i1',
          col: 'Betriebsstrom L1 (A)',
          label: 'Stromaufnahme L1',
          type: 'number',
          unit: 'A',
          req: true,
          min: 0,
          max: 32,
          hint: 'Strommesszange, Kompressor unter Volllast',
        },
        {
          id: 'i2',
          col: 'Betriebsstrom L2 (A)',
          label: 'Stromaufnahme L2',
          type: 'number',
          unit: 'A',
          min: 0,
          max: 32,
          hint: '0 A bei 1-phasiger Versorgung',
        },
        {
          id: 'i3',
          col: 'Betriebsstrom L3 (A)',
          label: 'Stromaufnahme L3',
          type: 'number',
          unit: 'A',
          min: 0,
          max: 32,
          hint: '0 A bei 1-phasiger Versorgung',
        },
        {
          id: 'kkP0',
          opt: true, // optional: bleibt leer ohne Zeile im PDF
          col: 'Kältekreis Verdampfungsdruck Überdruck (bar)',
          label: 'Verdampfungsdruck (Überdruck)',
          type: 'number',
          unit: 'bar',
          min: -1,
          max: 60,
          ph: '7,5',
          hint: 'Optional, nur mit Serviceanschluss oder Anzeige im Servicemenü',
        },
        {
          id: 'kkT0',
          opt: true, // optional: bleibt leer ohne Zeile im PDF
          col: 'Kältekreis Verdampfungstemperatur (°C)',
          label: 'Verdampfungstemperatur',
          type: 'number',
          unit: '°C',
          min: -40,
          max: 30,
          ph: '-5',
        },
        {
          id: 'kkTs',
          opt: true, // optional: bleibt leer ohne Zeile im PDF
          col: 'Kältekreis Sauggastemperatur (°C)',
          label: 'Sauggastemperatur',
          type: 'number',
          unit: '°C',
          min: -40,
          max: 40,
          ph: '2',
        },
        {
          id: 'kkUeh',
          opt: true, // optional: bleibt leer ohne Zeile im PDF
          col: 'Kältekreis Überhitzung (K)',
          label: 'Überhitzung',
          type: 'calc',
          unit: 'K',
          calc: (v) => (isN(v.kkTs) && isN(v.kkT0) ? round(num(v.kkTs) - num(v.kkT0), 1) : ''),
        },
        {
          id: 'kkPc',
          opt: true, // optional: bleibt leer ohne Zeile im PDF
          col: 'Kältekreis Verflüssigungsdruck Überdruck (bar)',
          label: 'Verflüssigungsdruck (Überdruck)',
          type: 'number',
          unit: 'bar',
          min: 0,
          max: 60,
          ph: '24',
        },
        {
          id: 'kkTc',
          opt: true, // optional: bleibt leer ohne Zeile im PDF
          col: 'Kältekreis Verflüssigungstemperatur (°C)',
          label: 'Verflüssigungstemperatur',
          type: 'number',
          unit: '°C',
          min: 0,
          max: 80,
          ph: '40',
        },
        {
          id: 'kkTf',
          opt: true, // optional: bleibt leer ohne Zeile im PDF
          col: 'Kältekreis Flüssigkeitstemperatur (°C)',
          label: 'Flüssigkeitstemperatur',
          type: 'number',
          unit: '°C',
          min: -10,
          max: 80,
          ph: '35',
        },
        {
          id: 'kkUk',
          opt: true, // optional: bleibt leer ohne Zeile im PDF
          col: 'Kältekreis Unterkühlung (K)',
          label: 'Unterkühlung',
          type: 'calc',
          unit: 'K',
          calc: (v) => (isN(v.kkTc) && isN(v.kkTf) ? round(num(v.kkTc) - num(v.kkTf), 1) : ''),
        },
      ],
    },
    {
      title: 'Benötigtes Material',
      short: 'Material',
      fields: [
        {
          id: 'material',
          col: 'Material',
          label: 'Benötigtes Material',
          type: 'material',
        },
      ],
    },
    {
      title: 'Wartungsabschluss & Abnahme',
      short: 'Abschluss',
      final: true,
      fields: [
        {
          id: 'betrieb',
          col: 'Betriebszustand',
          label: 'Betriebszustand',
          type: 'select',
          opts: [
            'In Betrieb',
            'Außer Betrieb',
            'Eingeschränkter Betrieb',
            'Wartet auf Ersatzteil',
          ],
          req: true,
          init: 'In Betrieb',
        },
        {
          id: 'erfolg',
          col: 'Wartung erfolgreich',
          label: 'Gesamtbewertung',
          type: 'bewertung',
          req: true,
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
          col: 'Bemerkungen',
          label: 'Bemerkungen / Mängel',
          type: 'longtext',
          wide: true,
          hint: 'Hinweise für den Betreiber, empfohlene Reparaturen',
          reqIf: (v, p) => defects(p).length > 0,
          reqMsg: 'Es gibt Auffälligkeiten – bitte hier Mängel bzw. Maßnahmen beschreiben.',
        },
      ],
    },
  ],
};
/* Gruppen je Seite (nur Darstellung: Überschrift + Karte). Reihenfolge der Felder bleibt, damit PDF und Sheet unverändert sind. */
{
  const G = {
    'Anlagendaten (Außen- & Inneneinheit)': [
      ['Anlage', ['zust']],
      ['Außeneinheit', ['agModell', 'agSn', 'agDat']],
      ['Inneneinheit', ['igModell', 'igSn', 'igDat']],
      ['Weiteres', ['zusInfo']],
    ],
    'Kältekreislauf & F-Gase-Prüfung': [
      ['Kältemittel', ['km', 'std', 'zus', 'total', 'gwp', 'co2']],
      ['Dichtheitsprüfung', ['herm', 'dpv', 'dp', 'dpErg']],
      ['Hinweise', ['kkInfo']],
    ],
    'Elektrik, Schutzorgane & Absicherung': [
      ['Netzspannung', ['uAg', 'uAgSt', 'uIg', 'uHs']],
      ['Absicherung', ['fAg', 'fAgSt', 'fIg', 'fHs', 'rcd']],
      ['Prüfungen', ['elAnschl', 'elFunk']],
    ],
    'Wartungscheckliste Außeneinheit': [
      ['Gehäuse & Elektrik', ['agReinig', 'agElek', 'agFuehl']],
      ['Ablauf & Lüfter', ['agKond', 'agVent']],
      ['Platine & Filter', ['agPlat', 'agFilt']],
      ['Abtauung', ['agAbtau']],
    ],
    'Wartungscheckliste Inneneinheit & Hydraulik': [
      ['Inneneinheit', ['igReinig', 'igElek', 'igFuehl']],
      ['Hydraulik & Sicherheit', ['hydDicht', 'sicher', 'igFilt']],
      ['Speicher & Funktion', ['speicher', 'ueberstr', 'aktor']],
      ['Trinkwasser', ['anode', 'sichGr', 'druckMind']],
    ],
    'Hydraulik, Systemdrücke & Heizwasser (VDI 2035)': [
      ['Systemdrücke', ['druck', 'mag', 'entl']],
      ['Heizwasser', ['lf', 'ph', 'wasser']],
    ],
    'Betriebsdaten & Messwerte': [
      ['Luftseite', ['tEin', 'tAus', 'dT']],
      ['Heizwasser', ['tVl', 'tRl', 'dTw']],
      ['Stromaufnahme', ['i1', 'i2', 'i3']],
      ['Kältekreis (optional)', ['kkP0', 'kkT0', 'kkTs', 'kkUeh', 'kkPc', 'kkTc', 'kkTf', 'kkUk']],
    ],
    'Wartungsabschluss & Abnahme': [
      ['Zustand', ['betrieb', 'erfolg', 'erfolgM']],
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
    if (f.type !== 'okfail') {
      return [f];
    }
    const mangel = {
      id: f.id + 'M',
      col: f.col + MANGEL_SUFFIX,
      label: 'Mangel / Maßnahme',
      type: 'text',
      parent: f.id,
      ph: 'Was ist festzustellen, was ist zu tun?',
      show: (v) => v[f.id] === 'n.i.O.',
    };
    if (f.group) {
      mangel.group = f.group;
    }
    return [f, mangel];
  });
});
const ALL_FIELDS = TEMPLATE.pages.flatMap((pg) => pg.fields);
const FIELD = Object.fromEntries(ALL_FIELDS.map((f) => [f.id, f]));
