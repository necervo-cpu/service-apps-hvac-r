'use strict';

(function (global) {
  const MIN_LEISTUNG_KW = 4;
  const ABGASVERLUST_STUFEN = [
    { bisKw: 25, grenze: 11 },
    { bisKw: 50, grenze: 10 },
    { bisKw: Infinity, grenze: 9 },
  ];
  const CO_GRENZE_PPM = 1000;
  const RUSSZAHL_GRENZE = 1;
  const CO2_MAXIMUM = { gas: 11.9, oel: 15.4 };
  const CO2_TOLERANZ = 0.3;

  const MESSWERTE = {
    abgasT: { unit: '°C', min: 0, max: 600 },
    luftT: { unit: '°C', min: -30, max: 60 },
    o2: { unit: '%', min: 0, max: 21 },
    co2: { unit: '%', min: 0, max: 20 },
    co: { unit: 'ppm', min: 0, max: 20000 },
    verlust: { unit: '%', min: 0, max: 50 },
    zug: { unit: 'Pa', min: -500, max: 500 },
    druck: { unit: 'bar', min: 0, max: 6, sMin: 1.0, sMax: 2.5 },
    mag: { unit: 'bar', min: 0, max: 4 },
    lf: { unit: 'µS/cm', min: 0, max: 5000 },
    ph: { unit: '', min: 0, max: 14, sMin: 8.2, sMax: 10.0 },
    gasFliess: { unit: 'mbar', min: 0, max: 100, sMin: 17, sMax: 25 },
    gasRuhe: { unit: 'mbar', min: 0, max: 100 },
    ion: { unit: 'µA', min: 0, max: 100 },
    o2R: { unit: '%', min: 0, max: 21 },
    russ: { unit: '', min: 0, max: 9, ganz: true },
    pumpe: { unit: 'bar', min: 0, max: 30 },
    vak: { unit: 'bar', min: -1, max: 1 },
  };

  function parseZahl(wert) {
    if (typeof wert === 'number') {
      return Number.isFinite(wert) ? wert : NaN;
    }
    if (typeof wert !== 'string') {
      return NaN;
    }
    const text = wert.trim().replace(',', '.');
    if (text === '') {
      return NaN;
    }
    return Number(text);
  }

  function formatZahl(zahl) {
    return String(zahl).replace('.', ',');
  }

  function abgasverlustGrenze(kw) {
    const leistung = parseZahl(kw);
    if (!Number.isFinite(leistung) || leistung < MIN_LEISTUNG_KW) {
      return null;
    }
    const stufe = ABGASVERLUST_STUFEN.find((s) => leistung <= s.bisKw);
    return stufe ? stufe.grenze : null;
  }

  function pruefeAbgasverlust(wert, kw) {
    const n = parseZahl(wert);
    const grenze = abgasverlustGrenze(kw);
    if (!Number.isFinite(n) || grenze === null) {
      return 'none';
    }
    return n > grenze ? 'warn' : 'ok';
  }

  function pruefeCO(ppm) {
    const n = parseZahl(ppm);
    if (!Number.isFinite(n)) {
      return 'none';
    }
    return n > CO_GRENZE_PPM ? 'warn' : 'ok';
  }

  function istRusszahl(wert) {
    const n = parseZahl(wert);
    return Number.isInteger(n) && n >= 0 && n <= 9;
  }

  function pruefeRusszahl(wert) {
    if (!istRusszahl(wert)) {
      return 'none';
    }
    return parseZahl(wert) > RUSSZAHL_GRENZE ? 'warn' : 'ok';
  }

  function pruefeOelderivate(wert) {
    if (wert === 'Ja') {
      return 'warn';
    }
    return wert === 'Nein' ? 'ok' : 'none';
  }

  function co2Maximum(typ) {
    return CO2_MAXIMUM[typ] || null;
  }

  function pruefeCO2(wert, typ) {
    const n = parseZahl(wert);
    const maximum = co2Maximum(typ);
    if (!Number.isFinite(n) || maximum === null) {
      return 'none';
    }
    return n > maximum + CO2_TOLERANZ ? 'warn' : 'ok';
  }

  function pruefeBereich(id, wert) {
    const def = MESSWERTE[id];
    const n = parseZahl(wert);
    if (!def || !Number.isFinite(n) || (def.sMin == null && def.sMax == null)) {
      return 'none';
    }
    if (def.sMin != null && n < def.sMin) {
      return 'warn';
    }
    if (def.sMax != null && n > def.sMax) {
      return 'warn';
    }
    return 'ok';
  }

  function bewerteMesswert(id, wert, kontext) {
    const ctx = kontext || {};
    switch (id) {
      case 'oelder':
        return pruefeOelderivate(wert);
      case 'co':
        return pruefeCO(wert);
      case 'russ':
        return pruefeRusszahl(wert);
      case 'verlust':
        return pruefeAbgasverlust(wert, ctx.kw);
      case 'co2':
        return pruefeCO2(wert, ctx.typ);
      default:
        return pruefeBereich(id, wert);
    }
  }

  function sollBereichText(def) {
    const einheit = def.unit ? ' ' + def.unit : '';
    if (def.sMin != null && def.sMax != null) {
      return `Soll ${formatZahl(def.sMin)} – ${formatZahl(def.sMax)}${einheit}`;
    }
    if (def.sMax != null) {
      return `Soll ≤ ${formatZahl(def.sMax)}${einheit}`;
    }
    if (def.sMin != null) {
      return `Soll ≥ ${formatZahl(def.sMin)}${einheit}`;
    }
    return '';
  }

  function sollMesswert(id, kontext) {
    const ctx = kontext || {};
    switch (id) {
      case 'oelder':
        return 'Soll Nein';
      case 'co':
        return `Soll ≤ ${CO_GRENZE_PPM} ppm`;
      case 'russ':
        return `Soll ≤ ${RUSSZAHL_GRENZE}`;
      case 'verlust': {
        const grenze = abgasverlustGrenze(ctx.kw);
        if (grenze !== null) {
          return `Grenze ${formatZahl(grenze)} % nach 1. BImSchV`;
        }
        const kw = parseZahl(ctx.kw);
        if (Number.isFinite(kw) && kw < MIN_LEISTUNG_KW) {
          return `Keine Grenze unter ${MIN_LEISTUNG_KW} kW`;
        }
        return 'Grenze nach Nennwärmeleistung (BImSchV)';
      }
      case 'co2': {
        const maximum = co2Maximum(ctx.typ);
        return maximum === null
          ? ''
          : `Technisch max. ${formatZahl(maximum)} % bei ${ctx.typ === 'oel' ? 'Heizöl' : 'Erdgas'}`;
      }
      default:
        return MESSWERTE[id] ? sollBereichText(MESSWERTE[id]) : '';
    }
  }

  function plausibilitaetFehler(id, wert) {
    const def = MESSWERTE[id];
    if (!def || wert == null || String(wert).trim() === '') {
      return '';
    }
    const n = parseZahl(wert);
    if (!Number.isFinite(n)) {
      return 'Bitte eine gültige Zahl eingeben.';
    }
    if (def.ganz && !Number.isInteger(n)) {
      return 'Bitte eine ganze Zahl eingeben.';
    }
    if (n < def.min || n > def.max) {
      const einheit = def.unit ? ' ' + def.unit : '';
      return `Unplausibler Wert (erlaubt ${formatZahl(def.min)} – ${formatZahl(def.max)}${einheit})`;
    }
    return '';
  }

  const REGELN = {
    MESSWERTE,
    parseZahl,
    abgasverlustGrenze,
    pruefeAbgasverlust,
    pruefeCO,
    istRusszahl,
    pruefeRusszahl,
    pruefeOelderivate,
    co2Maximum,
    pruefeCO2,
    pruefeBereich,
    bewerteMesswert,
    sollMesswert,
    plausibilitaetFehler,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = REGELN;
  } else {
    Object.assign(global, REGELN);
  }
})(typeof window !== 'undefined' ? window : globalThis);
