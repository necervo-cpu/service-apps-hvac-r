// Rechenkern MAG & Puffer: reine Funktionen, im Browser (window.MagEngine) und in node (module.exports).
(function (root) {
  'use strict';

  const AUSDEHNUNG = [[10, 0], [20, 0.15], [30, 0.41], [40, 0.75], [50, 1.18], [60, 1.68], [70, 2.24], [80, 2.87], [90, 3.57], [100, 4.31]];
  const HEIZFLAECHEN = { radiator: 13.5, plattenheizkoerper: 8.5, konvektor: 6.5, fussbodenheizung: 20 }; // l/kW
  const ROHRE = { // l/m
    'cu-15x1': 0.133, 'cu-18x1': 0.201, 'cu-22x1': 0.314, 'cu-28x1.5': 0.491, 'cu-35x1.5': 0.804, 'cu-42x1.5': 1.195,
    'stahl-dn20': 0.366, 'stahl-dn25': 0.581, 'stahl-dn32': 1.012,
    'pex-16x2': 0.113, 'pex-17x2': 0.133, 'pex-20x2': 0.201
  };
  const MAG_GROESSEN = [8, 12, 18, 25, 35, 50, 80, 100, 140, 200, 250, 300, 400, 500, 600, 800, 1000];
  const PUFFER_GROESSEN = [50, 80, 100, 120, 150, 200, 300, 400, 500, 600, 800, 1000];
  const P0_MIN_STANDARD = 0.7;
  const L_PRO_KW_STANDARD = 20;
  const L_PRO_KW_FOERDERUNG = 30; // Pellet, Richtwert BEG-Förderung
  const VARIANTEN_JE_ERZEUGER = { wp: ['sperrzeit', 'takt', 'abtauung'], kessel: ['takt'], pellet: ['takt', 'foerderung'], holz: ['bimschv'] };
  const HINWEISE = {
    kessel: 'Bei modulierenden Brennwertkesseln ist meist kein Puffer nötig, wenn der Mindestvolumenstrom gesichert ist (Herstellerangabe).',
    foerderung: 'Richtwert BEG-Förderung für Biomasse, aktuelle Förderbedingungen prüfen.',
    bimschv: 'Nach 1. BImSchV §5: mind. 12 l je Liter Füllraum, mind. 55 l/kW – Herstellerangabe beachten.',
    festbrennstoff: 'Bei Festbrennstoff die höchste mögliche Kesseltemperatur eintragen (z. B. Abschalttemperatur, meist 90–95 °C)'
  };
  const KAPAZITAET = 1.163; // Wh/(kg·K) Wasser

  const zahl = v => (v === null || v === undefined || v === '' || typeof v === 'boolean') ? NaN : Number(v);
  const rund = (v, s) => { const f = Math.pow(10, s); return Math.round(v * f) / f; };

  // Ausdehnung in % bezogen auf 10 °C, linear interpoliert (Bereich 10–100 °C).
  function ausdehnung(tC) {
    const t = zahl(tC);
    if (!isFinite(t)) return NaN;
    if (t < 10 || t > 100) return NaN;
    for (let i = 1; i < AUSDEHNUNG.length; i++) {
      const [t1, n1] = AUSDEHNUNG[i - 1], [t2, n2] = AUSDEHNUNG[i];
      if (t <= t2) return n1 + (n2 - n1) * (t - t1) / (t2 - t1);
    }
    return NaN;
  }

  // eingaben: { direkt, heizflaechen:[{typ,kW}], rohre:[{typ,m}], pufferL, wpInhaltL }
  function anlagenvolumen(e) {
    e = e || {};
    const fehler = [];
    const teile = {};
    let richtwert = false;
    const opt = (wert, name) => { // leer = 0, sonst >= 0
      if (wert === undefined || wert === null || wert === '') return 0;
      const z = zahl(wert);
      if (!isFinite(z) || z < 0) { fehler.push(name + ': Bitte eine Zahl ab 0 eingeben.'); return 0; }
      return z;
    };
    const direkt = opt(e.direkt, 'Anlagenvolumen');
    let basis = 0;
    if (direkt > 0) {
      basis = direkt; teile.direkt = direkt;
    } else {
      let hf = 0, ro = 0;
      (e.heizflaechen || []).forEach((h, i) => {
        const f = HEIZFLAECHEN[h && h.typ];
        if (f === undefined) { fehler.push('Heizfläche ' + (i + 1) + ': unbekannter Typ.'); return; }
        hf += f * opt(h.kW, 'Heizfläche ' + (i + 1) + ' (kW)');
      });
      (e.rohre || []).forEach((r, i) => {
        const f = ROHRE[r && r.typ];
        if (f === undefined) { fehler.push('Rohr ' + (i + 1) + ': unbekannter Typ.'); return; }
        ro += f * opt(r.m, 'Rohr ' + (i + 1) + ' (m)');
      });
      teile.heizflaechen = hf; teile.rohre = ro;
      basis = hf + ro;
      if (hf + ro > 0) richtwert = true;
    }
    const puffer = opt(e.pufferL, 'Puffer (l)');
    const wp = opt(e.wpInhaltL, 'WP-Inhalt (l)');
    teile.puffer = puffer; teile.wp = wp;
    const gesamt = basis + puffer + wp;
    if (fehler.length) return { ok: false, fehler, volumenL: NaN, richtwert, teile };
    if (gesamt <= 0) return { ok: false, fehler: ['Anlagenvolumen: Bitte ein Volumen oder eine Schätzung eingeben.'], volumenL: NaN, richtwert, teile };
    return { ok: true, fehler: [], volumenL: gesamt, richtwert, teile };
  }

  // eingaben: { anlagenvolumenL, temperaturC (max. Anlagentemperatur), hoeheM (statische Höhe), psvBar, p0minBar }
  function mag(e) {
    e = e || {};
    const fehler = [], warnungen = [];
    const VA = zahl(e.anlagenvolumenL), T = zahl(e.temperaturC), H = zahl(e.hoeheM), pSV = zahl(e.psvBar);
    const p0min = (e.p0minBar === undefined || e.p0minBar === null || e.p0minBar === '') ? P0_MIN_STANDARD : zahl(e.p0minBar);
    if (!isFinite(VA) || VA <= 0) fehler.push('Anlagenvolumen: Bitte einen Wert größer 0 eingeben.');
    if (!isFinite(T)) fehler.push('Temperatur: Bitte einen Wert eingeben.');
    else if (T < 10 || T > 100) fehler.push('Temperatur: Bitte einen Wert zwischen 10 und 100 °C eingeben.');
    if (!isFinite(H) || H < 0) fehler.push('Statische Höhe: Bitte einen Wert ab 0 m eingeben.');
    if (!isFinite(pSV) || pSV <= 0) fehler.push('Ansprechdruck Sicherheitsventil: Bitte einen Wert größer 0 bar eingeben.');
    if (!isFinite(p0min) || p0min < 0) fehler.push('Vordruck-Untergrenze: Bitte einen Wert ab 0 bar eingeben.');
    if (fehler.length) return { ok: false, fehler, warnungen };

    const n = ausdehnung(T);
    const Ve = n / 100 * VA;
    const Vv = Math.max(0.005 * VA, 3);
    const p0 = Math.max(H / 10 + 0.3, p0min);
    const ASV = pSV <= 5 ? 0.5 : 0.1 * pSV;
    const pe = pSV - ASV;
    if (pe <= p0 + 0.3) {
      return { ok: false, warnungen, n, Ve, Vv, p0, ASV, pe,
        fehler: ['Der Enddruck (' + rund(pe, 2) + ' bar) liegt zu nah am Vordruck (' + rund(p0, 2) + ' bar). Ein Ausdehnungsgefäß ist so nicht auslegbar: Sicherheitsventil mit höherem Ansprechdruck wählen oder die statische Höhe prüfen.'] };
    }
    const VnMin = (Ve + Vv) * (pe + 1) / (pe - p0);
    const Vn = MAG_GROESSEN.find(g => g >= VnMin) || null;
    const res = { ok: true, fehler: [], warnungen, n, Ve, Vv, p0, ASV, pe, VnMin, Vn, pa: null, paEmpfehlung: null };
    if (Vn === null) {
      warnungen.push('Das benötigte Volumen (' + rund(VnMin, 1) + ' l) liegt über dem größten Standardgefäß (1000 l). Mehrere Gefäße oder ein Sondergefäß einplanen.');
      return res;
    }
    const pa = (pe + 1) / (1 + Ve * (pe + 1) / (Vn * (p0 + 1))) - 1;
    res.pa = pa;
    if (pa < p0 + 0.3) {
      res.paEmpfehlung = p0 + 0.3;
      warnungen.push('Der Fülldruck (Anfangsdruck) wäre mit ' + rund(pa, 2) + ' bar zu niedrig. Empfehlung: Anlage mindestens auf ' + rund(p0 + 0.3, 2) + ' bar (Vordruck + 0,3 bar) füllen.');
    }
    return res;
  }

  // eingaben: { erzeuger:'wp'|'kessel'|'pellet'|'holz' (Standard 'wp'),
  //             sperrzeit:{aktiv,leistungKW,stunden,deltaT}, takt:{aktiv,pminKW,minuten,deltaT},
  //             abtauung:{aktiv,nennleistungKW,lProKW,anrechenbaresVolumenL},
  //             foerderung:{aktiv,nennleistungKW,lProKW} (Pellet), bimschv:{aktiv,nennleistungKW,fuellraumL} (Holz) }
  // Nur die je Erzeuger erlaubten Varianten werden gerechnet, andere werden ignoriert.
  function puffer(e) {
    e = e || {};
    const fehler = [], warnungen = [], hinweise = [], werte = {};
    const erzeuger = VARIANTEN_JE_ERZEUGER[e.erzeuger] ? e.erzeuger : 'wp';
    const erlaubt = VARIANTEN_JE_ERZEUGER[erzeuger];
    const pos = (v, name) => { const z = zahl(v); if (!isFinite(z) || z <= 0) { fehler.push(name + ': Bitte einen Wert größer 0 eingeben.'); return NaN; } return z; };
    const leer = v => v === undefined || v === null || v === '';
    const akt = k => erlaubt.indexOf(k) >= 0 && e[k] && e[k].aktiv;
    const s = e.sperrzeit, t = e.takt, a = e.abtauung;
    if (akt('sperrzeit')) {
      const Q = pos(s.leistungKW, 'Sperrzeit, Heizleistung (kW)'), h = pos(s.stunden, 'Sperrzeit, Dauer (h)'), dT = pos(s.deltaT, 'Sperrzeit, Spreizung ΔT (K)');
      werte.sperrzeit = 1000 * Q * h / (KAPAZITAET * dT);
      warnungen.push('Sperrzeit: Die Gebäudemasse (Estrich, Wände) überbrückt oft einen Teil der Sperrzeit. Der Wert ist eine Obergrenze.');
    }
    if (akt('takt')) {
      const P = pos(t.pminKW, 'Takt, kleinste Leistung (kW)'), m = pos(t.minuten, 'Takt, Mindestlaufzeit (min)'), dT = pos(t.deltaT, 'Takt, Spreizung ΔT (K)');
      werte.takt = 1000 * P * m / (60 * KAPAZITAET * dT);
      if (erzeuger === 'kessel') hinweise.push(HINWEISE.kessel);
    }
    if (akt('abtauung')) {
      const P = pos(a.nennleistungKW, 'Abtauung, Nennleistung (kW)');
      const l = leer(a.lProKW) ? L_PRO_KW_STANDARD : pos(a.lProKW, 'Abtauung, Liter je kW');
      let anr = 0;
      if (!leer(a.anrechenbaresVolumenL)) {
        anr = zahl(a.anrechenbaresVolumenL);
        if (!isFinite(anr) || anr < 0) { fehler.push('Abtauung, anrechenbares Volumen (l): Bitte einen Wert ab 0 eingeben.'); anr = 0; }
      }
      werte.abtauung = Math.max(0, l * P - anr);
    }
    if (akt('foerderung')) {
      const f = e.foerderung;
      const P = pos(f.nennleistungKW, 'Förderung, Nennleistung (kW)');
      const l = leer(f.lProKW) ? L_PRO_KW_FOERDERUNG : pos(f.lProKW, 'Förderung, Liter je kW');
      werte.foerderung = l * P;
      hinweise.push(HINWEISE.foerderung);
    }
    if (akt('bimschv')) {
      const b = e.bimschv;
      const hatP = !leer(b.nennleistungKW), hatF = !leer(b.fuellraumL);
      if (!hatP && !hatF) fehler.push('1. BImSchV: Bitte Nennleistung oder Brennstofffüllraum eingeben.');
      else {
        const P = hatP ? pos(b.nennleistungKW, '1. BImSchV, Nennleistung (kW)') : NaN;
        const F = hatF ? pos(b.fuellraumL, '1. BImSchV, Brennstofffüllraum (l)') : NaN;
        const teile = [];
        if (hatP) teile.push(55 * P);
        if (hatF) teile.push(12 * F);
        if (!fehler.length) werte.bimschv = Math.max.apply(null, teile);
        if (!hatP) warnungen.push('1. BImSchV: Die Nennleistung fehlt, gerechnet wird nur mit dem Brennstofffüllraum (12 l je Liter). Der Wert kann zu niedrig sein.');
        if (!hatF) warnungen.push('1. BImSchV: Der Brennstofffüllraum fehlt, gerechnet wird nur mit der Nennleistung (55 l je kW). Der Wert kann zu niedrig sein.');
      }
      hinweise.push(HINWEISE.bimschv);
    }
    if (fehler.length) return { ok: false, fehler, warnungen: [], hinweise: [], werte: {} };
    const keys = Object.keys(werte);
    if (!keys.length) return { ok: false, fehler: ['Bitte mindestens eine Variante (' + ({ wp: 'Sperrzeit, Takt oder Abtauung', kessel: 'Takt', pellet: 'Takt oder Mindestvolumen Förderung', holz: 'Mindestvolumen 1. BImSchV' })[erzeuger] + ') aktivieren.'], warnungen: [], hinweise: [], werte: {} };
    const max = Math.max.apply(null, keys.map(k => werte[k]));
    let vorschlag = 0, text;
    if (max <= 0) text = 'kein Puffer nötig';
    else {
      vorschlag = PUFFER_GROESSEN.find(g => g >= max) || null;
      if (vorschlag === null) { vorschlag = Math.ceil(max / 100) * 100; warnungen.push('Das benötigte Volumen liegt über 1000 l. Sondergröße oder mehrere Speicher einplanen.'); }
      text = vorschlag + ' l';
    }
    return { ok: true, fehler: [], warnungen, hinweise, erzeuger, werte, maxL: max, vorschlagL: vorschlag, text };
  }

  const api = { ausdehnung, anlagenvolumen, mag, puffer, HEIZFLAECHEN, ROHRE, MAG_GROESSEN, PUFFER_GROESSEN, P0_MIN_STANDARD, L_PRO_KW_STANDARD, L_PRO_KW_FOERDERUNG, VARIANTEN_JE_ERZEUGER, HINWEISE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MagEngine = api;
})(typeof window !== 'undefined' ? window : this);
