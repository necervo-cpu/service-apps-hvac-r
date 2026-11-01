/* Rechenkern: prüft Multisplit-Kombinationen gegen die Daikin-Regeln aus der Datenbank (Google Sheet).
   Alle Grenzwerte stehen im Sheet – hier steht keine Daikin-Zahl fest im Code
   (Ausnahme: physikalische Konstanten für die R32-Mindestfläche). */
(function (root) {
  const num = v => { const n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isNaN(n) ? null : n; };
  const list = s => String(s == null ? '' : s).split(/[\s;]+/).filter(Boolean);
  const r1 = x => Math.round(x * 10) / 10;
  const de = x => String(x).replace('.', ',');
  const up1 = x => Math.ceil(x * 10 - 1e-9) / 10;     // aufrunden auf 0,1 kg (konservativ)

  // R32: untere Zündgrenze 0,307 kg/m³; Montagehöhe h0 nach EN 378 / IEC 60335-2-40 (wie Daikin „Tabelle A“)
  const LFL = 0.307, H0 = { Boden: 0.6, Wand: 1.8, Decke: 2.2 };
  const REDUZIERER_INFO = '1/3: Ø15,9→Ø12,7 · 2/4: Ø12,7→Ø9,5 · 5/6: Ø15,9→Ø9,5 (bei 2MXM50: 1+2 = Ø12,7→Ø9,5)';

  function normalize(D) {
    const odu = (D.Aussengeraete || []).map(r => {
      const o = { id: String(r.id).trim(), serie: r.serie, quelle: r.quelle };
      ['kuehlen_kw', 'heizen_kw', 'ig_min', 'ig_max', 'summe_max_kw', 'summe_max_kw_r_serie', 'rohr_raum_min_m', 'rohr_raum_max_m',
        'rohr_gesamt_max_m', 'hoehe_ag_oben_m', 'hoehe_ig_ig_m', 'hoehe_ag_unten_m', 'hoehe_ig_ig_unten_m', 'nachfuell_ab_m',
        'nachfuell_kg_je_m', 'werk_kg', 'fuell_max_kg', 'rohr_gesamt_max_cvxm_m', 'strom_a', 'hauptschalter_a',
        'msia_datenblatt_a', 'netzleitung_min_mm2', 'verbindungsleitung_min_mm2'].forEach(k => o[k] = num(r[k]));
      return o;
    }).filter(o => o.id);
    const ports = {};
    (D.Anschluesse || []).forEach(r => {
      const id = String(r.aussengeraet).trim();
      (ports[id] = ports[id] || []).push({ port: r.port, gas_mm: num(r.gas_mm), direkt: list(r.klassen_direkt),
        reduz: list(r.klassen_reduzierer), reduzierer: String(r.reduzierer || ''), hinweis: r.hinweis || '' });
    });
    const odus = odu.map(o => o.id);
    const ig = [], komb = {};
    (D.Innengeraete || []).forEach(r => {
      const m = String(r.modell).trim(); if (!m) return;
      ig.push({ modell: m, typ: r.typ, serie: r.serie, klasse: num(r.klasse), kw: num(r.kuehlen_kw), kwK: num(r.kuehlen_nenn_kw), kwH: num(r.heizen_nenn_kw),
        kwKmax: num(r.kuehlen_max_kw), kwHmax: num(r.heizen_max_kw), montage: r.montage || 'Wand',
        k42: String(r.klasse42_kleiner_port) === '1', cv: String(r.nicht_an_3MXM_ueber_30m) === '1', hinweis: r.hinweis || '' });
    });
    (D.Kombination || []).forEach(r => {
      const m = String(r.modell).trim();
      komb[m] = new Set(odus.filter(o => String(r[o] || '').trim().toLowerCase() === 'x'));
    });
    const ein = {}; (D.Einstellungen || []).forEach(r => ein[r.schluessel] = r.wert);
    return {
      odu, ports, ig, komb, ein,
      raumtypen: (D.Raumtypen || []).map(r => ({ name: r.raumtyp, w: num(r.kuehllast_w_je_m2) })),
      zuschlaege: (D.Zuschlaege || []).map(r => ({ name: r.bezeichnung, f: num(r.faktor) }))
    };
  }

  const modelOf = (DB, m) => DB.ig.find(x => x.modell === m);

  /* Bedarf in kW: manuell eingegeben oder aus Fläche × Richtwert × Zuschlag */
  function bedarfKw(room, DB) {
    const man = num(room.bedarf);
    if (man != null) return man;
    const f = num(room.flaeche); if (f == null) return null;
    const rt = DB.raumtypen.find(x => x.name === room.raumtyp) || DB.raumtypen[0];
    const zu = DB.zuschlaege.find(x => x.name === room.zuschlag);
    if (!rt || rt.w == null) return null;
    return r1(f * rt.w * (zu && zu.f != null ? zu.f : 1) / 1000);
  }

  /* Gerät je Raum: fest gewählt oder automatisch (kleinste Klasse, die den Bedarf deckt) */
  function pickUnit(room, DB) {
    if (room.modell) return modelOf(DB, room.modell) || null;
    const need = bedarfKw(room, DB);
    const cand = DB.ig.filter(x => (!room.typ || x.typ === room.typ) && (!room.serie || x.serie === room.serie))
      .sort((a, b) => a.klasse - b.klasse);
    if (!cand.length) return null;
    if (need == null) return null;
    const tol = num(DB.ein.auswahl_toleranz_kw) || 0;
    return cand.find(x => (x.kwK != null ? x.kwK : x.kw) + tol + 1e-9 >= need) || cand[cand.length - 1];
  }

  function portFit(port, u) {
    const c = String(u.klasse);
    const t = arr => arr.includes(c) || (arr.includes(c + '*') && u.k42);
    if (t(port.direkt)) return { ok: true, red: '' };
    if (t(port.reduz)) {
      let red = port.reduzierer;
      if (red.includes('/')) { const p = red.split('/').map(s => s.trim()); red = (u.klasse <= 35 || (u.klasse === 42 && u.k42)) ? p[0] : p[1]; }
      return { ok: true, red: red.replace(/\s*\(.*?\)/, '') };
    }
    return { ok: false };
  }

  /* Ordnet jedem Innengerät einen eigenen Anschluss (Port) am Außengerät zu (Rückverfolgung, max. 5 Geräte). */
  function assign(units, ports) {
    const n = units.length, used = new Array(ports.length).fill(false), res = new Array(n);
    const order = units.map((u, i) => i).sort((a, b) => units[b].klasse - units[a].klasse);
    function rec(k) {
      if (k === n) return true;
      const i = order[k];
      for (let p = 0; p < ports.length; p++) {
        if (used[p]) continue;
        const fit = portFit(ports[p], units[i]);
        if (!fit.ok) continue;
        used[p] = true; res[i] = { port: ports[p], red: fit.red };
        if (rec(k + 1)) return true;
        used[p] = false; res[i] = null;
      }
      return false;
    }
    return rec(0) ? res : null;
  }

  function minFlaeche(m, montage) {
    const h = H0[montage] || H0.Wand;
    return m <= 4 * LFL ? 0 : Math.pow(m / (2.5 * Math.pow(LFL, 1.25) * h), 2);
  }

  /* Prüft ein Außengerät mit den Räumen. Rückgabe: ok = nur wenn KEIN Fehler. */
  function check(odu, rooms, DB) {
    const errs = [], warns = [], out = { odu, errs, warns, rows: [] };
    const act = rooms.map(r => ({ room: r, unit: pickUnit(r, DB) }));
    act.forEach((a, i) => { if (!a.unit) errs.push(`Raum ${i + 1}${a.room.name ? ' (' + a.room.name + ')' : ''}: Kein Gerät – Fläche/Bedarf oder Gerät fehlt.`); });
    const units = act.filter(a => a.unit).map(a => a.unit);
    const n = act.length;
    if (n < odu.ig_min) errs.push(`Mindestens ${odu.ig_min} Innengeräte nötig (Daikin: ein einzelnes Innengerät ist nicht zulässig).`);
    if (n > odu.ig_max) errs.push(`Nur ${odu.ig_max} Innengeräte anschließbar (geplant: ${n}).`);

    // 1) Freigabe laut Daikin-Kombinationstabelle
    units.forEach(u => { const s = DB.komb[u.modell]; if (!s || !s.has(odu.id)) errs.push(`${u.modell} ist an ${odu.id} nicht freigegeben (Kombinationstabelle).`); });

    // 2) Summe der Innengeräte-Leistung
    const sum = r1(units.reduce((s, u) => s + u.kw, 0));
    const rOnly = units.length > 0 && units.every(u => /^(CTXM|FTXM)\d+R$/.test(u.modell));
    const lim = rOnly && odu.summe_max_kw_r_serie ? odu.summe_max_kw_r_serie : odu.summe_max_kw;
    out.sum = sum; out.sumMax = lim;
    if (sum > lim + 1e-9) errs.push(`Summe Innengeräte ${sum} kW > zulässig ${lim} kW.` + (odu.summe_max_kw_r_serie && !rOnly ? ` (${odu.summe_max_kw_r_serie} kW gelten nur, wenn alle Geräte CTXM-R/FTXM-R sind.)` : ''));

    // 3) Anschlüsse / Reduzierstücke
    let asg = null;
    if (units.length && units.length === n) {
      asg = assign(units, DB.ports[odu.id] || []);
      if (!asg) errs.push('Die Geräteklassen passen nicht auf die Anschlüsse (Ports) des Außengeräts – z. B. zu viele große Geräte (≥42) für die 12,7-/15,9-mm-Anschlüsse.');
    }

    // 4) Rohrleitung
    const L = act.map(a => num(a.room.rohr)), H = act.map(a => num(a.room.hoehe) || 0);
    const known = L.every(x => x != null);
    let total = null;
    if (!known) warns.push('Rohrlänge nicht bei allen Räumen eingetragen – Leitungsgrenzen und Kältemittel nicht vollständig geprüft.');
    L.forEach((l, i) => {
      if (l == null) return;
      if (l < odu.rohr_raum_min_m) errs.push(`Raum ${i + 1}: Rohrlänge ${l} m < Minimum ${odu.rohr_raum_min_m} m.`);
      if (l > odu.rohr_raum_max_m) errs.push(`Raum ${i + 1}: Rohrlänge ${l} m > max. ${odu.rohr_raum_max_m} m je Raum.`);
    });
    if (known && L.length) {
      total = r1(L.reduce((s, x) => s + x, 0));
      if (total > odu.rohr_gesamt_max_m) errs.push(`Gesamt-Rohrlänge ${total} m > max. ${odu.rohr_gesamt_max_m} m.`);
      if (odu.rohr_gesamt_max_cvxm_m != null && units.some(u => u.cv) && total > odu.rohr_gesamt_max_cvxm_m)
        errs.push(`${odu.id} mit CVXM-A/FVXM-A: Gesamt-Rohrlänge max. ${odu.rohr_gesamt_max_cvxm_m} m, keine Nachfüllung.`);
    }
    // Höhen: positiv = Innengerät höher als Außengerät
    if (H.length) {
      const hmax = Math.max(...H), hmin = Math.min(...H), spread = hmax - hmin;
      const agHoeher = hmax <= 0;
      const limAG = agHoeher ? odu.hoehe_ag_oben_m : odu.hoehe_ag_unten_m;
      const limII = agHoeher ? odu.hoehe_ig_ig_m : odu.hoehe_ig_ig_unten_m;
      const dAG = Math.max(Math.abs(hmax), Math.abs(hmin));
      if (dAG > limAG) errs.push(`Höhenunterschied Außen-/Innengerät ${r1(dAG)} m > max. ${limAG} m (${agHoeher ? 'Außengerät höher' : 'Außengerät niedriger als mind. 1 Innengerät'}).`);
      if (spread > limII) errs.push(`Höhenunterschied Innengeräte untereinander ${r1(spread)} m > max. ${limII} m.`);
    }

    // 5) Kältemittel
    let extra = null, charge = null;
    if (total != null) {
      extra = total > odu.nachfuell_ab_m ? up1((total - odu.nachfuell_ab_m) * odu.nachfuell_kg_je_m) : 0;
      charge = Math.round((odu.werk_kg + extra) * 100) / 100;
      if (odu.fuell_max_kg != null && charge > odu.fuell_max_kg + 1e-9) errs.push(`Gesamtfüllmenge ${charge} kg > max. ${odu.fuell_max_kg} kg.`);
    }
    out.total = total; out.extra = extra; out.charge = charge;

    // 6) R32-Mindestfläche je Raum (Innengeräte ohne Leckagesensor)
    const mA = charge != null ? charge : odu.werk_kg;
    act.forEach((a, i) => {
      const amin = a.unit ? minFlaeche(mA, a.unit.montage) : null;
      const f = num(a.room.flaeche);
      out.rows.push({ i, room: a.room, unit: a.unit, asg: asg ? asg[units.indexOf(a.unit)] : null, amin, laenge: L[i], hoehe: H[i] });
      if (a.unit && amin && f != null && f < amin - 1e-9)
        errs.push(`Raum ${i + 1}${a.room.name ? ' (' + a.room.name + ')' : ''}: Fläche ${f} m² < R32-Mindestfläche ${Math.ceil(amin * 10) / 10} m² (${a.unit.montage}gerät, Füllmenge ${r1(mA)} kg).`);
      else if (a.unit && amin && f == null) warns.push(`Raum ${i + 1}: Fläche fehlt – R32-Mindestfläche ${Math.ceil(amin * 10) / 10} m² nicht geprüft.`);
    });
    units.forEach(u => { if (u.hinweis && u.cv === false) warns.push(`${u.modell}: ${u.hinweis}`); });
    out.ok = errs.length === 0;
    return out;
  }

  // Ganz leere Räume (nichts eingetragen) werden ignoriert
  const blank = r => !['name', 'flaeche', 'bedarf', 'modell', 'rohr', 'hoehe'].some(k => String(r[k] || '').trim() !== '');

  /* Empfehlung (eigene Bewertung, KEINE Daikin-Regel): unter allen freigegebenen Außengeräten das kleinste,
     das den Summenbedarf der Räume deckt; bei Gleichstand weniger Kältemittel. Dazu optional eine
     Variante mit freiem Anschluss und Leistungsreserve für einen späteren Raum. */
  function evaluateAll(rooms, DB) {
    rooms = rooms.filter(r => !blank(r));
    const res = DB.odu.map(o => check(o, rooms, DB));
    const okList = res.filter(r => r.ok);
    const bedarfe = rooms.map(r => bedarfKw(r, DB));
    const bedarf = bedarfe.length && bedarfe.every(b => b != null) ? r1(bedarfe.reduce((s, b) => s + b, 0)) : null;
    const byCost = (a, b) => a.odu.kuehlen_kw - b.odu.kuehlen_kw || (a.charge || 0) - (b.charge || 0) || a.odu.id.localeCompare(b.odu.id);
    okList.forEach(x => {
      x.bedarf = bedarf;
      x.deckung = bedarf ? x.odu.kuehlen_kw / bedarf : null;
      x.verhaeltnis = x.sum / x.odu.kuehlen_kw;
    });
    let best = null, why = [];
    if (okList.length) {
      const cover = bedarf == null ? okList : okList.filter(x => x.odu.kuehlen_kw + 1e-9 >= bedarf);
      const pool = cover.length ? cover : okList.slice().sort((a, b) => b.odu.kuehlen_kw - a.odu.kuehlen_kw).slice(0, 1);
      best = pool.slice().sort(byCost)[0];
      why.push(bedarf == null ? 'kleinstes freigegebenes Außengerät (Fläche/Bedarf fehlt – Deckung nicht bewertet)'
        : cover.length ? `kleinstes freigegebenes Außengerät, das den Gesamtbedarf von ${de(r1(bedarf))} kW deckt (${Math.round(best.deckung * 100)} %)`
          : `größtes freigegebenes Außengerät – deckt den Gesamtbedarf von ${de(r1(bedarf))} kW nur zu ${Math.round(best.deckung * 100)} %`);
      why.push(`Innengeräte-Summe ${de(best.sum)} kW = ${Math.round(best.verhaeltnis * 100)} % der Außengeräte-Nennleistung`);
      if (best.charge != null) why.push(`R32 gesamt ${de(best.charge)} kg`);
    }
    let alt = null;
    if (best) {
      const spare = okList.filter(x => x.odu.id !== best.odu.id && x.odu.ig_max > rooms.length && x.odu.kuehlen_kw >= best.odu.kuehlen_kw
        && x.odu.summe_max_kw - x.sum >= 1.5 && (bedarf == null || x.odu.kuehlen_kw + 1e-9 >= bedarf)).sort(byCost)[0];
      if (spare && !(best.odu.ig_max > rooms.length && best.odu.summe_max_kw - best.sum >= 1.5))
        alt = { x: spare, why: `hat noch ${spare.odu.ig_max - rooms.length} freien Anschluss und ${de(r1(spare.odu.summe_max_kw - spare.sum))} kW Reserve für einen späteren Raum` };
    }
    best && (best.empfohlen = true);
    return { all: res, best, why, alt, bedarf };
  }

  root.Engine = { normalize, bedarfKw, pickUnit, check, evaluateAll, minFlaeche, num, REDUZIERER_INFO };
  if (typeof module !== 'undefined') module.exports = root.Engine;
})(typeof window !== 'undefined' ? window : globalThis);
