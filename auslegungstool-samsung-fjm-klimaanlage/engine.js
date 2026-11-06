/* Samsung FJM Auslegung - Rechenkern (kein DOM, node-testbar).
   Alle Samsung-Werte kommen aus der Datenbank (daten.js / CSV) bzw. cfg (Einstellungen).
   Im Code stehen nur Rechenregeln und die Konstanten der allgemeinen Norm-Formel (2,5 / 1,25 / 4 x LFL).
   Meldungen: {stufe:'rot'|'orange'|'info', code, text, raum?}
   Geprueft wird in check(): errs = rot, warns = orange, infos = grau. */
(function (root) {
  'use strict';

  var ODU_NUM = ['kuehlen_kw', 'kuehlen_min_kw', 'kuehlen_max_kw', 'heizen_kw', 'heizen_min_kw', 'heizen_max_kw',
    'ig_min', 'ig_max', 'anschl_k_min', 'anschl_k_max', 'anschl_h_min', 'anschl_h_max', 'ports_38', 'ports_12',
    'leitung_ig_max_m', 'leitung_gesamt_max_m', 'hoehe_ag_max_m', 'hoehe_ig_ig_max_m', 'werk_kg', 'werk_bis_m',
    'nachfuell_g_m', 'absicherung_a', 'gewicht_kg'];
  var IG_NUM = ['kuehlen_kw', 'heizen_kw'];
  var CFG_NUM = ['gwp', 'lfl', 'fgas_schwelle_t', 'h0_wand', 'h0_boden', 'h0_decke', 'leitung_raum_min_m', 'nachfuell_rundung_kg'];

  /* Zahl aus Text: Komma oder Punkt, tolerant gegen Text drumherum ("0,98 kg"). Leer/kein Wert -> null */
  function num(v) {
    if (v == null) return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var m = String(v).replace(/\s/g, '').match(/-?\d+(?:[.,]\d+)?/);
    return m ? parseFloat(m[0].replace(',', '.')) : null;
  }
  function r2(x) { return Math.round(x * 100 + 1e-9) / 100; }
  function r1(x) { return Math.round(x * 10 + 1e-9) / 10; }
  function r3(x) { return Math.round(x * 1000 + 1e-9) / 1000; }
  /* Aufrunden auf Vielfache von step ohne Gleitkomma-Fehler (0,2 bleibt 0,2) */
  function ceilTo(x, step) {
    if (!(step > 0)) return x;
    return Math.ceil(Math.round(x / step * 1e6) / 1e6 - 1e-9) * step;
  }
  function msg(stufe, code, text, raum) {
    var o = { stufe: stufe, code: code, text: text };
    if (raum) o.raum = raum;
    return o;
  }
  function fmt(x, d) { return Number(x).toFixed(d == null ? 2 : d).replace('.', ','); }

  /* ---------- normalize ---------- */
  function normalize(D) {
    var odu = (D.Aussengeraete || []).map(function (r) {
      var o = {}; Object.keys(r).forEach(function (k) { o[k] = ODU_NUM.indexOf(k) >= 0 ? num(r[k]) : r[k]; });
      return o;
    }).sort(function (a, b) { return a.kuehlen_kw - b.kuehlen_kw; });
    var ig = (D.Innengeraete || []).map(function (r) {
      var o = {}; Object.keys(r).forEach(function (k) { o[k] = IG_NUM.indexOf(k) >= 0 ? num(r[k]) : r[k]; });
      return o;
    });
    var igMap = {}; ig.forEach(function (u) { igMap[u.modell] = u; });
    var frei = {};
    (D.Freigaben || []).forEach(function (r) {
      var s = new Set();
      Object.keys(r).forEach(function (k) { if (k !== 'modell' && String(r[k]).trim() !== '') s.add(k); });
      frei[r.modell] = s;
    });
    var cfg = {};
    (D.Einstellungen || []).forEach(function (r) {
      cfg[r.schluessel] = CFG_NUM.indexOf(r.schluessel) >= 0 ? num(r.wert) : r.wert;
    });
    return { odu: odu, ig: ig, igMap: igMap, frei: frei, cfg: cfg };
  }

  /* ---------- Anschluesse ---------- */
  function ports(odu) { return { p38: odu.ports_38 || 0, p12: odu.ports_12 || 0 }; }

  /* units: Array mit {sauggas:'3/8'|'1/2'}. Rueckgabe: Array je Unit {port:'3/8'|'1/2'|null, reduz:null|'1/2→3/8'|'3/8→1/2'}
     1/2 auf 1/2, 3/8 auf 3/8; uebrige 3/8 auf freie 1/2 (Reduzierstueck), uebrige 1/2 auf freie 3/8 (Erweiterung).
     port null = kein Anschluss mehr frei (zu viele Innengeraete). */
  function assignPorts(units, odu) {
    var p = ports(odu), free = { '3/8': p.p38, '1/2': p.p12 };
    var out = units.map(function () { return { port: null, reduz: null }; });
    units.forEach(function (u, i) {
      if (free[u.sauggas] > 0) { free[u.sauggas]--; out[i].port = u.sauggas; }
    });
    units.forEach(function (u, i) {
      if (out[i].port) return;
      var other = u.sauggas === '3/8' ? '1/2' : '3/8';
      if (free[other] > 0) {
        free[other]--; out[i].port = other;
        out[i].reduz = u.sauggas === '3/8' ? '1/2→3/8' : '3/8→1/2';
      }
    });
    return out;
  }

  /* ---------- R32-Mindestraumflaeche (allgemeine Norm-Formel) ---------- */
  /* Rueckgabe {amin, h0, kanal}. amin = 0, wenn m <= 4 x LFL. montage: 'Wand'|'Boden'|'Decke'; typ optional ('Kanal') */
  function minFlaeche(m_kg, montage, cfg, typ) {
    var h0 = cfg['h0_' + String(montage || '').toLowerCase()];
    var kanal = typ === 'Kanal';
    if (!(h0 > 0)) return { amin: null, h0: null, kanal: kanal };
    if (kanal) h0 = cfg.h0_decke;
    if (m_kg <= 4 * cfg.lfl + 1e-9) return { amin: 0, h0: h0, kanal: kanal };
    var a = Math.pow(m_kg / (2.5 * Math.pow(cfg.lfl, 1.25) * h0), 2);
    return { amin: r1(ceilTo(a, 0.1)), h0: h0, kanal: kanal };
  }

  /* ---------- Nachfuellung ---------- */
  /* Rueckgabe {extra_kg, g, hinweis}. Ohne nachfuell_g_m (leer) keine Nachfuellung. */
  function nachfuellung(odu, L, cfg) {
    var perM = odu.nachfuell_g_m, bis = odu.werk_bis_m;
    if (!(perM > 0) || bis == null) return { extra_kg: 0, g: 0, hinweis: null };
    var g = Math.max(0, L - bis) * perM;
    var step = (cfg && cfg.nachfuell_rundung_kg > 0) ? cfg.nachfuell_rundung_kg * 1000 : 0;
    var extra = r3((step ? ceilTo(g, step) : g) / 1000);
    var hinweis = null;
    if (extra > 0 && String(odu.nachfuell_pruefen || '').trim() !== '') {
      hinweis = msg('orange', 'nachfuell_pruefen', odu.id + ': Nachfüllmenge ' + fmt(perM, 0) + ' g/m bitte bei Samsung/MTF bestätigen lassen (sieht nach Druckfehler aus).');
    }
    return { extra_kg: extra, g: g, hinweis: hinweis };
  }

  /* ---------- Pruefung einer Anlage mit einem Aussengeraet ---------- */
  /* raeume: [{id,name,modell,laenge,flaeche,hoehe}] (nur Raeume mit Modell) */
  function check(odu, raeume, DB) {
    var cfg = DB.cfg, errs = [], warns = [], infos = [];
    var E = function (c, t, r) { errs.push(msg('rot', c, t, r)); };
    var W = function (c, t, r) { warns.push(msg('orange', c, t, r)); };
    var I = function (c, t, r) { infos.push(msg('info', c, t, r)); };

    var items = (raeume || []).map(function (r, i) {
      if (!r || !r.modell) return null;
      var hRaw = r.hoehe, hLeer = hRaw == null || String(hRaw).trim() === '', H = hLeer ? 0 : num(hRaw);
      var L = num(r.laenge);
      return { r: r, name: r.name || ('Raum ' + (i + 1)), u: DB.igMap[r.modell], L: L > 0 ? L : null, A: num(r.flaeche),
        H: H == null ? 0 : H, hUngueltig: !hLeer && H == null };
    }).filter(Boolean);
    var n = items.length;

    /* Anzahl */
    if (n < odu.ig_min || n > odu.ig_max) {
      E('anzahl', odu.id + ' braucht ' + (odu.ig_min === odu.ig_max ? odu.ig_min : odu.ig_min + ' bis ' + odu.ig_max) + ' Innengeräte, gewählt sind ' + n + '.');
    }
    /* Unbekannte Modelle / Freigabe */
    items.forEach(function (it) {
      if (!it.u) { E('modell_unbekannt', 'Innengerät "' + it.r.modell + '" ist nicht in der Datenbank.', it.name); return; }
      var f = DB.frei[it.u.modell];
      if (!f || !f.has(odu.id)) E('freigabe', it.u.modell + ' ist mit ' + odu.id + ' nicht freigegeben.', it.name);
    });

    var known = items.filter(function (it) { return it.u; });
    var sumK = r2(known.reduce(function (s, it) { return s + it.u.kuehlen_kw; }, 0));
    var sumH = r2(known.reduce(function (s, it) { return s + it.u.heizen_kw; }, 0));
    if (n > 0) {
      if (sumK < odu.anschl_k_min - 1e-9 || sumK > odu.anschl_k_max + 1e-9)
        E('summe_k', 'Summe Kühlen ' + fmt(sumK, 1) + ' kW liegt außerhalb ' + fmt(odu.anschl_k_min, 1) + ' bis ' + fmt(odu.anschl_k_max, 1) + ' kW.');
      if (sumH < odu.anschl_h_min - 1e-9 || sumH > odu.anschl_h_max + 1e-9)
        E('summe_h', 'Summe Heizen ' + fmt(sumH, 1) + ' kW liegt außerhalb ' + fmt(odu.anschl_h_min, 1) + ' bis ' + fmt(odu.anschl_h_max, 1) + ' kW.');
    }
    var belegung = odu.kuehlen_kw > 0 ? Math.round(sumK / odu.kuehlen_kw * 100) : 0; /* ganze Prozent */

    /* Leitungen */
    var gesamtL = r2(items.reduce(function (s, it) { return s + (it.L || 0); }, 0));
    if (gesamtL > odu.leitung_gesamt_max_m + 1e-9)
      E('laenge_gesamt', 'Gesamtlänge ' + fmt(gesamtL, 1) + ' m ist größer als erlaubt (max. ' + odu.leitung_gesamt_max_m + ' m).');
    items.forEach(function (it) {
      if (!(it.L > 0)) { W('laenge_fehlt', 'Leitungslänge fehlt.', it.name); return; }
      if (it.L > odu.leitung_ig_max_m + 1e-9)
        W('laenge_ig', 'Leitung ' + fmt(it.L, 1) + ' m ist länger als ' + odu.leitung_ig_max_m + ' m je Innengerät (bei Samsung/MTF klären).', it.name);
      if (cfg.leitung_raum_min_m > 0 && it.L < cfg.leitung_raum_min_m - 1e-9)
        W('laenge_kurz', 'Leitung ' + fmt(it.L, 1) + ' m ist kürzer als ' + cfg.leitung_raum_min_m + ' m. Wert bei Samsung prüfen.', it.name);
    });

    /* Hoehe */
    items.forEach(function (it) { if (it.hUngueltig) W('hoehe_ungueltig', 'Höhe ungültig, 0 m angenommen.', it.name); });
    var hs = items.map(function (it) { return it.H; });
    items.forEach(function (it) {
      if (Math.abs(it.H) > odu.hoehe_ag_max_m + 1e-9)
        E('hoehe_ag', 'Höhenunterschied ' + fmt(it.H, 1) + ' m zum Außengerät ist größer als erlaubt (max. ' + odu.hoehe_ag_max_m + ' m).', it.name);
    });
    if (hs.length > 1) {
      var spanne = r2(Math.max.apply(null, hs) - Math.min.apply(null, hs));
      if (spanne > odu.hoehe_ig_ig_max_m + 1e-9)
        E('hoehe_ig', 'Höhenunterschied zwischen den Innengeräten ' + fmt(spanne, 1) + ' m ist größer als erlaubt (max. ' + odu.hoehe_ig_ig_max_m + ' m).');
    }
    if (hs.some(function (h) { return h !== 0; }))
      I('hoehe_info', 'Im Prospekt ist die Höhengrenze nach oben und unten nicht getrennt angegeben.');

    /* Anschluesse */
    var asg = assignPorts(known.map(function (it) { return it.u; }), odu);
    var rows = items.map(function (it) {
      var k = known.indexOf(it), a = k >= 0 ? asg[k] : { port: null, reduz: null };
      return { raum: it.name, unit: it.u || null, port: a.port, reduz: a.reduz, amin: null, laenge: it.L, flaeche: it.A, hoehe: it.H };
    });
    var reduzRaeume = rows.filter(function (r) { return r.reduz; }).map(function (r) { return r.raum; });
    if (reduzRaeume.length)
      W('reduzierstueck', 'Reduzier-/Erweiterungsstück bei Samsung/MTF klären. Betroffene Räume: ' + reduzRaeume.join(', ') + '.');

    /* Kaeltemittel */
    var nf = nachfuellung(odu, gesamtL, cfg);
    var extra_kg = r3(nf.extra_kg), fuell_kg = r3((odu.werk_kg || 0) + extra_kg);
    if (nf.hinweis) warns.push(nf.hinweis);
    var co2_t = r2(fuell_kg * cfg.gwp / 1000);

    /* Mindestflaeche je Raum (Gesamtfuellung der Anlage ist maßgeblich) */
    rows.forEach(function (row, i) {
      if (!row.unit) return;
      var f = minFlaeche(fuell_kg, row.unit.montage, cfg, row.unit.typ);
      if (f.amin == null) { W('montage_unbekannt', 'Montageart "' + (row.unit.montage || '') + '" unbekannt, Mindestfläche kann nicht berechnet werden.', row.raum); return; }
      row.amin = r1(f.amin);
      if (!(f.amin > 0)) return;
      if (f.kanal) W('kanal_hoehe', 'Kanalgerät: Ausblashöhe ≥ ' + fmt(f.h0, 1) + ' m angenommen.', row.raum);
      var A = items[i].A;
      if (!(A > 0)) W('flaeche_fehlt', 'Fläche fehlt, Mindestfläche ' + fmt(f.amin, 1) + ' m² kann nicht geprüft werden.', row.raum);
      else if (A < f.amin - 1e-9) E('flaeche', 'Raumfläche ' + fmt(A, 1) + ' m² ist kleiner als die Mindestfläche ' + fmt(f.amin, 1) + ' m² (R32, Gesamtfüllung ' + fmt(fuell_kg, 2) + ' kg).', row.raum);
    });

    /* Infos */
    var seen = {};
    known.forEach(function (it) {
      var h = (it.u.hinweis || '').trim();
      if (h && !seen[it.u.modell]) { seen[it.u.modell] = 1; I('geraet_hinweis', it.u.modell + ': ' + h); }
    });
    if (odu.hinweis) I('ag_hinweis', odu.id + ': ' + odu.hinweis);
    I('fuellmenge', 'Eine maximale Gesamtfüllmenge ist im Prospekt nicht angegeben.');
    var fgas = cfg.fgas_schwelle_t;
    if (co2_t < fgas) I('fgas', 'Unter ' + fgas + ' t CO₂e: keine Prüfpflicht nach F-Gas-Verordnung.');
    else W('fgas', 'Ab ' + fgas + ' t CO₂e gilt eine Prüfpflicht nach F-Gas-Verordnung.');

    return {
      odu: odu, ok: errs.length === 0, errs: errs, warns: warns, infos: infos,
      sumK: sumK, sumH: sumH, belegung: belegung, gesamtL: gesamtL,
      extra_kg: extra_kg, fuell_kg: fuell_kg, co2_t: co2_t, rows: rows,
      elektrik: { absicherung_a: odu.absicherung_a, zuleitung: odu.zuleitung, ig_kabel: cfg.elektrik_ig, bus: cfg.elektrik_bus, anzahl: n }
    };
  }

  /* ---------- Anlage: alle Aussengeraete bewerten ---------- */
  /* raeume: Raumliste (Raeume ohne Modell werden ignoriert). agWahl: optional AG-id.
     Rueckgabe {alle[check-Ergebnis je AG, nach Leistung sortiert], empfohlen:id|null, alternative:id|null,
                gewaehlt:id|null, res:check-Ergebnis des gewaehlten AG|null, why:[Text]} */
  function evaluateAnlage(raeume, DB, agWahl) {
    var rs = (raeume || []).filter(function (r) { return r && r.modell; });
    var alle = DB.odu.map(function (o) { return check(o, rs, DB); });
    var emp = alle.filter(function (c) { return c.ok; })[0] || null;
    var alt = alle.filter(function (c) { return c.ok && c.warns.length === 0; })[0] || null;
    if (alt && emp && alt.odu.id === emp.odu.id) alt = null;
    var wahl = agWahl ? alle.filter(function (c) { return c.odu.id === agWahl; })[0] || null : null;
    var gew = wahl || emp;
    var why = [];
    if (!rs.length) why.push('Noch keine Räume mit Innengerät.');
    else if (!emp) why.push('Kein Außengerät passt zu dieser Auswahl. Siehe Gründe je Außengerät.');
    else {
      why.push(emp.odu.id + ' ist das kleinste Außengerät ohne Ausschluss (Belegung ' + emp.belegung + ' %).');
      if (emp.warns.length) why.push('Es gibt ' + emp.warns.length + ' Hinweis(e) zu beachten.');
      if (alt) why.push(alt.odu.id + ' kommt ohne Hinweise aus (Belegung ' + alt.belegung + ' %).');
    }
    if (wahl && emp && wahl.odu.id !== emp.odu.id) why.push('Gewählt ist ' + wahl.odu.id + ' statt der Empfehlung ' + emp.odu.id + '.');
    if (wahl && !wahl.ok) why.push('Das gewählte ' + wahl.odu.id + ' ist nicht zulässig.');
    return {
      alle: alle, empfohlen: emp ? emp.odu.id : null, alternative: alt ? alt.odu.id : null,
      gewaehlt: gew ? gew.odu.id : null, res: gew, why: why
    };
  }

  /* p: {anlagen:[{id,name,ag,raeume}]}. co2_gesamt_t: Summe der Fuellmengen der gewaehlten AG x GWP, 2 Stellen */
  function evaluateProjekt(p, DB) {
    var kg = 0;
    var anlagen = (p.anlagen || []).map(function (a) {
      var ev = evaluateAnlage(a.raeume, DB, a.ag);
      ev.anlage = a;
      if (ev.res && (a.raeume || []).some(function (r) { return r && r.modell; })) kg += ev.res.fuell_kg;
      return ev;
    });
    return { anlagen: anlagen, co2_gesamt_t: r2(kg * DB.cfg.gwp / 1000) };
  }

  root.Engine = { normalize: normalize, ports: ports, assignPorts: assignPorts, minFlaeche: minFlaeche,
    nachfuellung: nachfuellung, check: check, evaluateAnlage: evaluateAnlage, evaluateProjekt: evaluateProjekt, num: num };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Engine;
})(typeof window !== 'undefined' ? window : this);
