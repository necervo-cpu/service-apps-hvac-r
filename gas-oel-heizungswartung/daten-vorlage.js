// Feld-Definition der Heizungs-Wartung (Datenbank-Spalten, Prüfpunkte, Messwerte, Hilfen für Felder und Material).
'use strict';

const OK3 = ['i.O.', 'n.i.O.', 'entfällt'];
const TYP_NAME = { gas: 'Gasheizung', oel: 'Ölheizung' };
const TYP_KURZ = { gas: 'Gas', oel: 'Öl' };
const BAUART_OPTS = {
  gas: ['Brennwert', 'Heizwert'],
  oel: ['Brennwert', 'Niedertemperatur'],
};
const BRENNER_OPTS = ['Gelbbrenner', 'Blaubrenner'];
const SPRUEHMUSTER = ['S', 'H', 'B', 'W'];
const BEWERTUNG = ['i.O.', 'n.i.O.'];
const BEWERTUNG_KLASSEN = ['ok', 'bad'];
const BEWERTUNG_STUFEN = ['ok', 'warn', 'bad'];
const BEWERTUNG_KURZ = ['i.O.', 'Folgeauftrag nötig', 'n.i.O.'];
const BEWERTUNG_ALT = new Map([
  ['Betriebssicher / ohne Mängel', 0],
  ['Wartungsempfehlung / Folgeauftrag nötig', 1],
  ['Bedenkliche Mängel / gesperrt', 2],
]);
function bewertungStufe(x) {
  if (x === 'i.O.') {
    return 0;
  }
  if (x === 'n.i.O.') {
    return 2;
  }
  return BEWERTUNG_ALT.has(x) ? BEWERTUNG_ALT.get(x) : -1;
}
const MANGEL_SUFFIX = ' – Mangel';
const KEEP_SYNCED_DAYS = 7;
const SPEICHER = {
  settings: 'hz1.settings',
  protocols: 'hz1.protocols',
  db: 'hz1.db',
};
const PFLICHTFELDER = false;

function pruefpunkt(id, label, hint, nurBei) {
  return [
    { id, col: label, label, hint, type: 'okfail', nurBei },
    {
      id: id + 'M',
      col: label + MANGEL_SUFFIX,
      label: 'Mangel / Maßnahme',
      type: 'text',
      parent: id,
      nurBei,
      ph: 'Was ist festzustellen, was ist zu tun?',
    },
  ];
}
function messwert(id, label, extra) {
  const m = MESSWERTE[id];
  return Object.assign(
    {
      id,
      regel: id,
      col: m.unit ? `${label} (${m.unit})` : label,
      label,
      type: 'number',
      unit: m.unit,
    },
    extra,
  );
}

const TEMPLATE = {
  id: 'heizung-wartung',
  title: 'WARTUNGSPROTOKOLL • GAS-/ÖLHEIZUNG',
  pages: [
    {
      title: 'Kopf & Gerät',
      short: 'Gerät',
      header: true,
      fields: [
        {
          id: 'projekt',
          col: 'Protokoll-Nr.',
          label: 'Protokoll-Nr.',
          type: 'text',
          hint: 'Vorschlag kann überschrieben werden',
          init: () =>
            'HZ-' + today().replace(/-/g, '') + '-' + uid().slice(0, 4).toUpperCase(),
        },
        {
          id: 'typ',
          col: 'Typ',
          label: 'Anlagenart',
          type: 'typ',
          anz: TYP_NAME,
        },
        {
          id: 'kunde',
          col: 'Kunde / Objekt',
          label: 'Kundennummer',
          type: 'text',
          ph: '10234',
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
          id: 'techniker',
          col: 'Techniker',
          label: 'Techniker',
          type: 'text',
          init: () => settings.techniker,
        },
        {
          id: 'hersteller',
          col: 'Hersteller',
          label: 'Hersteller',
          type: 'text',
          ph: 'Viessmann, Buderus, Weishaupt',
        },
        {
          id: 'modell',
          col: 'Modell / Typ',
          label: 'Modell / Typ',
          type: 'text',
        },
        {
          id: 'sn',
          col: 'Seriennummer',
          label: 'Seriennummer',
          type: 'text',
        },
        {
          id: 'baujahr',
          col: 'Baujahr',
          label: 'Baujahr',
          type: 'number',
          ganz: true,
          min: 1950,
          max: new Date().getFullYear() + 1,
          ph: '2015',
          hint: 'Laut Typenschild',
        },
        {
          id: 'kw',
          col: 'Nennwärmeleistung (kW)',
          label: 'Nennwärmeleistung',
          type: 'number',
          unit: 'kW',
          min: 1,
          max: 2000,
          ph: '24',
          hint: 'Bestimmt die Abgasverlust-Grenze nach 1. BImSchV',
        },
        {
          id: 'stunden',
          col: 'Betriebsstunden (h)',
          label: 'Betriebsstunden',
          type: 'number',
          unit: 'h',
          min: 0,
          max: 500000,
        },
        {
          id: 'starts',
          col: 'Brennerstarts',
          label: 'Brennerstarts',
          type: 'number',
          ganz: true,
          min: 0,
          max: 50000000,
        },
        {
          id: 'bauart',
          col: 'Bauart',
          label: 'Bauart',
          type: 'select',
          opts: (v) => BAUART_OPTS[v.typ] || BAUART_OPTS.gas,
        },
        {
          id: 'brenner',
          col: 'Brenner',
          label: 'Brenner',
          type: 'select',
          opts: BRENNER_OPTS,
          nurBei: 'oel',
        },
      ],
    },
    {
      title: 'Checkliste Brenner',
      pdfTitle: (v) =>
        v.typ === 'oel' ? 'Brenner & Kessel (Öl)' : 'Brenner & Wärmetauscher (Gas)',
      short: 'Brenner',
      kind: 'check',
      fields: [
        ...pruefpunkt(
          'gDicht',
          'Gasleitung / Armaturen dicht',
          'Sichtprüfung / Gasspürgerät',
          'gas',
        ),
        ...pruefpunkt(
          'gDruck',
          'Gasanschluss-, Fließ- und Düsendruck gemessen',
          'Werte unter „Messwerte“ eintragen',
          'gas',
        ),
        ...pruefpunkt(
          'gRein',
          'Brenner, Brenneroberfläche und Wärmetauscher gereinigt',
          '',
          'gas',
        ),
        ...pruefpunkt('gElek', 'Zünd- und Ionisationselektrode geprüft', '', 'gas'),
        ...pruefpunkt(
          'gSiphon',
          'Kondensatsiphon / -ablauf gereinigt, freier Durchfluss',
          '',
          'gas',
        ),
        ...pruefpunkt(
          'gAbgas',
          'Abgasweg / Ringspaltmessung kontrolliert',
          'Dichtheit der Abgasführung',
          'gas',
        ),
        ...pruefpunkt(
          'oVers',
          'Ölversorgung dicht',
          'Tank, Entnahmegarnitur, Antiheberventil, Ölleitung',
          'oel',
        ),
        ...pruefpunkt(
          'oFilter',
          'Ölfiltereinsatz und O-Ringe Vorfilter gewechselt, Entlüfter geprüft',
          '',
          'oel',
        ),
        ...pruefpunkt(
          'oPumpe',
          'Ölpumpendruck und Vakuum gemessen',
          'Werte unter „Messwerte“ eintragen',
          'oel',
        ),
        ...pruefpunkt('oDuese', 'Öldüse erneuert', 'Düsendaten unten eintragen', 'oel'),
        {
          id: 'duesG',
          col: 'Öldüse Größe (gal/h)',
          label: 'Düsengröße',
          type: 'number',
          unit: 'gal/h',
          min: 0.1,
          max: 20,
          ph: '0,50',
          nurBei: 'oel',
        },
        {
          id: 'duesW',
          col: 'Öldüse Sprühwinkel (°)',
          label: 'Sprühwinkel',
          type: 'number',
          unit: '°',
          min: 20,
          max: 120,
          ph: '80',
          nurBei: 'oel',
        },
        {
          id: 'duesM',
          col: 'Öldüse Sprühmuster',
          label: 'Sprühmuster',
          type: 'select',
          opts: SPRUEHMUSTER,
          seg: true,
          other: true,
          hint: 'Kennbuchstabe laut Düsenaufdruck, z. B. 0,50/80° S',
          nurBei: 'oel',
        },
        ...pruefpunkt(
          'oStau',
          'Stauscheibe, Zündelektroden und Flammenwächter gereinigt / eingestellt',
          'Flammenwächter: Fotowiderstand / UV-Zelle',
          'oel',
        ),
        ...pruefpunkt(
          'oRaum',
          'Brennraum, Kesselzüge und Wärmetauscher gereinigt',
          'ggf. Kondensatwanne',
          'oel',
        ),
      ],
    },
    {
      title: 'Hydraulik & Sicherheit',
      short: 'Hydraulik',
      kind: 'check',
      fields: [
        ...pruefpunkt(
          'hMag',
          'Ausdehnungsgefäß (MAG) abgesperrt / entleert, Vordruck geprüft / angepasst',
          '',
        ),
        ...pruefpunkt(
          'hSv',
          'Sicherheitsventil (SV) und Sicherheitstemperaturbegrenzer (STB): Funktion geprüft',
          '',
        ),
        ...pruefpunkt(
          'hDruck',
          'Anlagendruck geprüft, ggf. nachgefüllt',
          'Heizwasser nach VDI 2035',
        ),
        messwert('lf', 'Leitfähigkeit Heizwasser', { hint: 'Nach VDI 2035', ph: '300' }),
        messwert('ph', 'pH-Wert Heizwasser', {
          hint: 'Sollbereich 8,2–10,0 (VDI 2035)',
          ph: '9,0',
        }),
        ...pruefpunkt(
          'hPumpen',
          'Umwälzpumpen, Mischer, Rückflussverhinderer, Schmutzfänger / Magnetitabscheider geprüft',
          '',
        ),
        ...pruefpunkt(
          'hRegel',
          'Fehlerspeicher ausgelesen, Regelung geprüft',
          'Heizkurve, Zeiten, Außenfühler',
        ),
      ],
    },
    {
      title: 'Messwerte',
      short: 'Messwerte',
      fields: [
        messwert('abgasT', 'Abgastemperatur', { ph: '120' }),
        messwert('luftT', 'Verbrennungsluft-Temperatur', { ph: '20' }),
        messwert('o2', 'Sauerstoff O₂', { ph: '4,5' }),
        messwert('co2', 'Kohlendioxid CO₂', { ph: '9,5' }),
        messwert('co', 'CO unverdünnt', { ph: '15' }),
        messwert('verlust', 'Abgasverlust', { ph: '6,5' }),
        messwert('zug', 'Kaminzug / Differenzdruck', { ph: '20' }),
        messwert('gasFliess', 'Gasfließdruck', { nurBei: 'gas', ph: '20' }),
        messwert('gasRuhe', 'Ruhedruck', { nurBei: 'gas', ph: '22' }),
        messwert('ion', 'Ionisationsstrom', { nurBei: 'gas', ph: '5' }),
        messwert('o2R', 'O₂ im Ringspalt', { nurBei: 'gas', ph: '20,9' }),
        messwert('russ', 'Rußzahl', { nurBei: 'oel', ganz: true, ph: '0' }),
        {
          id: 'oelder',
          regel: 'oelder',
          col: 'Ölderivate',
          label: 'Ölderivate',
          type: 'yesno',
          warn: ['Ja'],
          hint: 'Nachweis auf dem Filterpapier',
          nurBei: 'oel',
        },
        messwert('pumpe', 'Ölpumpendruck', { nurBei: 'oel', ph: '12' }),
        messwert('vak', 'Vakuum Vorfilter', { nurBei: 'oel', ph: '0,2' }),
        messwert('druck', 'Anlagendruck', { ph: '1,5' }),
        messwert('mag', 'Vordruck MAG', { ph: '1,0' }),
      ],
    },
    {
      title: 'Material',
      short: 'Material',
      fields: [
        {
          id: 'material',
          col: 'Material',
          label: 'Verwendetes Material',
          type: 'material',
          init: () => [],
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
          col: 'Festgestellte Mängel / Folgeauftrag',
          label: 'Festgestellte Mängel / Noch auszuführende Arbeiten (Folgeauftrag)',
          type: 'longtext',
          wide: true,
        },
        {
          id: 'abspr',
          col: 'Absprachen & Abweichungen',
          label: 'Absprachen & Abweichungen',
          type: 'longtext',
          wide: true,
        },
        {
          id: 'hinw',
          col: 'Hinweise für den Betreiber',
          label: 'Hinweise für den Betreiber',
          type: 'longtext',
          wide: true,
        },
        {
          id: 'bewertung',
          col: 'Gesamtbewertung',
          label: 'Gesamtbewertung',
          type: 'bewertung',
          opts: BEWERTUNG,
        },
        {
          id: 'bewertungM',
          col: 'Gesamtbewertung' + MANGEL_SUFFIX,
          label: 'Mangel / Maßnahme',
          type: 'text',
          parent: 'bewertung',
          ph: 'Was ist festzustellen, was ist zu tun?',
        },
      ],
    },
  ],
};
{
  const G = {
    'Kopf & Gerät': [
      ['Auftrag', ['projekt', 'typ', 'kunde', 'datum', 'techniker']],
      ['Gerät', ['hersteller', 'modell', 'sn', 'baujahr', 'kw']],
      ['Betrieb', ['stunden', 'starts', 'bauart', 'brenner']],
    ],
    'Checkliste Brenner': [
      ['Gasweg & Druck', ['gDicht', 'gDruck']],
      ['Brenner & Wärmetauscher', ['gRein', 'gElek']],
      ['Kondensat & Abgas', ['gSiphon', 'gAbgas']],
      ['Ölversorgung', ['oVers', 'oFilter', 'oPumpe']],
      ['Öldüse', ['oDuese', 'duesG', 'duesW', 'duesM']],
      ['Brennraum & Brenner', ['oStau', 'oRaum']],
    ],
    'Hydraulik & Sicherheit': [
      ['Ausdehnung & Sicherheit', ['hMag', 'hSv']],
      ['Heizwasser', ['hDruck', 'lf', 'ph']],
      ['Pumpen & Regelung', ['hPumpen', 'hRegel']],
    ],
    Messwerte: [
      ['Abgas & Verbrennung', ['abgasT', 'luftT', 'o2', 'co2', 'co', 'verlust', 'zug']],
      ['Gasseite', ['gasFliess', 'gasRuhe', 'ion', 'o2R']],
      ['Ölseite', ['russ', 'oelder', 'pumpe', 'vak']],
      ['Anlage', ['druck', 'mag']],
    ],
    Material: [['Verwendetes Material', ['material']]],
    Abschluss: [
      ['Bemerkungen', ['bem', 'abspr', 'hinw']],
      ['Bewertung', ['bewertung', 'bewertungM']],
    ],
  };
  TEMPLATE.pages.forEach((pg) => {
    (G[pg.title] || []).forEach(([name, ids]) => {
      ids.forEach((id) => {
        pg.fields.find((f) => f.id === id).group = name;
      });
    });
    pg.fields.forEach((f) => {
      if (f.parent) {
        f.group = pg.fields.find((x) => x.id === f.parent).group;
      }
    });
  });
}
const ALL_FIELDS = TEMPLATE.pages.flatMap((pg) => pg.fields);
const FIELD = Object.fromEntries(ALL_FIELDS.map((f) => [f.id, f]));

function aktivTyp(f, v) {
  return !f.nurBei || f.nurBei === v.typ;
}
function aktiv(f, v) {
  return aktivTyp(f, v) && (!f.parent || v[f.parent] === 'n.i.O.');
}
function optsOf(f, v) {
  return typeof f.opts === 'function' ? f.opts(v) : f.opts;
}
function wert(f, v) {
  const x = v[f.id] ?? '';
  if (typeof f.opts === 'function' && !f.opts(v).includes(x)) {
    return '';
  }
  return x;
}
function kontext(v) {
  return { kw: v.kw, typ: v.typ };
}
function materialListe(v) {
  if (!Array.isArray(v.material)) {
    return [];
  }
  return v.material
    .filter((m) => m && String(m.teil ?? '').trim() !== '')
    .map((m) => ({ teil: String(m.teil).trim(), menge: String(m.menge ?? '').trim() }));
}
function materialText(v) {
  return materialListe(v)
    .map((m) => (m.menge ? `${m.teil} ×${m.menge}` : m.teil))
    .join('; ');
}
function materialArray(p) {
  if (!Array.isArray(p.values.material)) {
    p.values.material = [];
  }
  return p.values.material;
}
