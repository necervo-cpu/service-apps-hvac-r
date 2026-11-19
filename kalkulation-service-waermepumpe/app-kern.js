// Kern: Konfiguration, Felder, Speicher, Helfer, Rechnen (Preis, F-Gase-Prüfung), Bericht und Spaltenwerte.
'use strict';
const C = window.CFG;
document.title = C.appName;
document.getElementById('apptitle').textContent = C.header;

/* =====================================================================
   Felder einer Kalkulation. col = exakter Spaltenname im Blatt "Kalkulationen".
   Geräte und Material kommen aus config.js.
   ===================================================================== */
const POS = C.geraete
  .map((g) => Object.assign({ grp: 'geraet' }, g))
  .concat(C.material.map((m) => Object.assign({ grp: 'material' }, m)));
const POSBY = Object.fromEntries(POS.map((x) => [x.id, x]));
const FIELDS = [
  { id: 'projekt', col: 'Projektnummer' },
  { id: 'datum', col: 'Datum', type: 'date' },
  { id: 'kunde', col: 'Kunde' },
  { id: 'standort', col: 'Objekt / Standort' },
  { id: 'bearbeiter', col: 'Erstellt von' },
  { id: 'anzTech', col: 'Anzahl Servicetechniker', type: 'num' },
  { id: 'anzHelfer', col: 'Anzahl Helfer / Azubis', type: 'num' },
  ...POS.map((x) => ({
    id: x.id,
    col:
      (x.grp === 'geraet' ? 'Anzahl ' : 'Menge ') +
      x.label +
      (x.grp === 'material' ? ` (${x.unit})` : ''),
    type: 'num',
  })),
  { id: 'km', col: 'Kältemittel' },
  { id: 'gwp', col: 'GWP', type: 'num' },
  { id: 'menge', col: 'Füllmenge je Kreis (kg)', type: 'num' },
  { id: 'kreise', col: 'Anzahl Kältekreise', type: 'num' },
  { id: 'herm', col: 'Hermetisch geschlossen' },
  { id: 'leck', col: 'Leckage-Erkennungssystem' },
  { id: 'anfahrt', col: 'Anfahrtspauschale (€)', type: 'num' },
  { id: 'erschwernis', col: 'Steigtechnik / Erschwernis (€)', type: 'num' },
  { id: 'sonderText', col: 'Sonderposition' },
  { id: 'sonderPreis', col: 'Sonderposition (€)', type: 'num' },
  { id: 'pauschal', col: 'Pauschalangebot' },
  { id: 'bem', col: 'Bemerkungen' },
];
const PAGES = [
  { short: 'Projekt', title: 'Projekt & Team' },
  { short: 'Anlage', title: C.geraeteTitle },
  { short: 'Kältemittel', title: 'Kältemittel & F-Gase-Prüfung' },
  { short: 'Material', title: 'Material, Anfahrt & Sonstiges' },
  { short: 'Ergebnis', title: 'Ergebnis & Abschluss' },
];

/* ---------- Speicher ---------- */
LS.fullMsg += ' Übertragene Kalkulationen löschen.';
const K = (name) => C.ls + '.' + name;
let settings = Object.assign(
  { url: '', token: '', firma: '', techniker: '' },
  LS.get(K('settings'), {}),
);
let calcs = LS.get(K('calcs'), []);
let dbCache = LS.get(K('db'), { at: null, list: [] });
let stammCache = LS.get(K('stamm'), { at: null, values: {} });
const save = () => LS.set(K('calcs'), calcs);

/* ---------- Helfer (LS, $, esc, uid, today, fmtDateTime, isN, round, fmtNum, RM, flash: shared/core.js) ---------- */
const app = $('#app');
function fmtDate(s) {
  if (!s) return '';
  const d = new Date(String(s).length === 10 ? s + 'T12:00:00' : s);
  return isNaN(d) ? String(s) : d.toLocaleDateString('de-DE');
}
function num(v) {
  return typeof v === 'number'
    ? v
    : Number(
        String(v ?? '')
          .trim()
          .replace(/\s/g, '')
          .replace(',', '.'),
      );
}
function n0(v) {
  return isN(v) ? num(v) : 0;
}
function de(n, d) {
  return Number(n || 0).toLocaleString('de-DE', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}
function eur(n) {
  return de(n, 2) + ' €';
}
function hrs(min) {
  return de(min / 60, 2) + ' h';
}
function qtyText(n, unit) {
  return fmtNum(round(n, 2)) + (unit ? ' ' + unit : '');
}
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  if (!t) return;
  $('#toastText').textContent = msg;
  t.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-visible'), 3500);
}
let calcSeen = {}; // zuletzt angezeigte Rechenwerte -> Aufleuchten nur bei echter Änderung
function calcTouch(id, text, el) {
  const k = view.id + ':' + id;
  if (k in calcSeen && calcSeen[k] !== text) flash(el);
  calcSeen[k] = text;
}

/* ---------- Stammdaten (zentral im Google Sheet, hier zwischengespeichert) ---------- */
function stammNow() {
  const S = {};
  C.stamm.forEach((s) => {
    const x = stammCache.values[s.key];
    S[s.key] =
      typeof s.def === 'number'
        ? isN(x)
          ? num(x)
          : s.def
        : x != null && String(x).trim() !== ''
          ? String(x)
          : s.def;
  });
  return S;
}
async function loadStamm(silent) {
  if (!settings.url || !navigator.onLine) return false;
  try {
    const j = await api('stamm');
    stammCache = { at: new Date().toISOString(), values: j.values || {} };
    LS.set(K('stamm'), stammCache);
    if (!silent) toast('Stammdaten aus der Datenbank geladen.');
    return true;
  } catch (e) {
    if (!silent) toast('Stammdaten konnten nicht geladen werden: ' + e.message);
    return false;
  }
}

/* ---------- Rechnen ---------- */
function qtys(v) {
  return Object.fromEntries(POS.map((x) => [x.id, n0(v[x.id])]));
}
/* Automatische Vorschläge (Reinigungsmittel, GWP …) – nur solange der Wert nicht von Hand geändert wurde */
function applyAutos(p) {
  const S = p.stamm,
    v = p.values,
    man = p.manual || (p.manual = {});
  POS.filter((x) => x.auto).forEach((x) => {
    if (man[x.id]) return;
    const a = round(Math.max(0, x.auto(qtys(v), S)), 2);
    v[x.id] = a ? fmtNum(a) : '';
  });
  if (!man.gwp) {
    const g = C.kaeltemittel[v.km];
    v.gwp = g != null ? String(g) : '';
  }
  if (C.hermAuto && !man.herm) v.herm = C.hermAuto(qtys(v));
}
/* F-Gase-Verordnung (EU) 2024/573, Art. 5: Prüfpflicht ab 5 t CO₂-Äq. (hermetisch geschlossen ab 10 t);
   Intervalle 12 / 6 / 3 Monate ab 5 / 50 / 500 t – mit Leckage-Erkennungssystem doppelt so lang. */
function pruefung(v, S) {
  const km = String(v.km || '').trim(),
    gwp = n0(v.gwp),
    kreise = Math.max(1, Math.round(n0(v.kreise)) || 1);
  const menge = n0(v.menge),
    co2 = round((menge * gwp) / 1000, 2);
  const herm = v.herm === 'Ja',
    leck = v.leck === 'Ja',
    grenze = herm ? 10 : 5;
  const out = {
    km,
    gwp,
    kreise,
    menge,
    co2,
    herm,
    leck,
    grenze,
    state: 'leer',
    monate: 0,
    min: 0,
    text: 'Kältemittel nicht angegeben',
  };
  if (!km) return out;
  if (/^R ?290/i.test(km) || (isN(v.gwp) && gwp < 150 && /propan|r ?290/i.test(km))) {
    if (C.r290Key) {
      return Object.assign(out, {
        state: 'r290',
        min: S[C.r290Key] * kreise,
        text: 'R290 (Propan, A3): jährliche Sicherheits- und Dichtheitsprüfung (Schutzbereich, Lecksuche mit Ex-geschütztem Gerät)',
      });
    }
    return Object.assign(out, {
      state: 'frei',
      text: 'Natürliches Kältemittel (R290): keine Prüfpflicht nach F-Gase-Verordnung',
    });
  }
  if (!isN(v.gwp))
    return Object.assign(out, {
      state: 'leer',
      text: 'GWP-Wert für dieses Kältemittel eintragen',
    });
  if (!menge)
    return Object.assign(out, { state: 'leer', text: 'Füllmenge je Kältekreis eintragen' });
  const m = co2 >= 500 ? 3 : co2 >= 50 ? 6 : co2 >= grenze ? 12 : 0;
  if (!m)
    return Object.assign(out, {
      state: 'frei',
      text: `Keine Prüfpflicht: ${de(co2, 2)} t CO₂-Äq. je Kreis (Grenze ${grenze} t${herm ? ', hermetisch geschlossen' : ''})`,
    });
  const monate = leck ? m * 2 : m;
  return Object.assign(out, {
    state: 'pflicht',
    monate,
    min: S.t_dicht * kreise,
    text: `Dichtheitsprüfung Pflicht alle ${monate} Monate: ${de(co2, 2)} t CO₂-Äq. je Kreis${leck ? ' (mit Leckage-Erkennungssystem)' : ''}`,
  });
}
function teamText(nT, nH) {
  return (
    `${nT} Servicetechniker` +
    (nH ? ` + ${nH} ${nH === 1 ? 'Helfer / Azubi' : 'Helfer / Azubis'}` : '')
  );
}
/* Richtzeiten = Einsatzdauer vor Ort. Jeder Servicetechniker und jeder Helfer ist den ganzen Einsatz dabei
   und wird für die volle Dauer berechnet (2 Techniker = doppelte Lohnkosten Techniker). */
function calc(p) {
  const v = p.values,
    S = p.stamm,
    q = qtys(v),
    pr = pruefung(v, S);
  const nT = Math.max(1, Math.round(n0(v.anzTech)) || 1),
    nH = Math.max(0, Math.round(n0(v.anzHelfer)));
  const leistung = C.geraete
    .filter((g) => q[g.id] > 0)
    .map((g) => ({
      kat: g.kat,
      label: g.label,
      menge: qtyText(q[g.id], g.unit),
      umfang: g.umfang,
      min: q[g.id] * S[g.t],
    }));
  if (pr.state === 'pflicht')
    leistung.push({
      kat: 'Gesetzliche Prüfung',
      label: 'Dichtheitsprüfung nach F-Gase-Verordnung (EU) 2024/573 inkl. Protokoll',
      menge: pr.kreise === 1 ? '1 Kreis' : pr.kreise + ' Kreise',
      umfang: `Prüfintervall alle ${pr.monate} Monate`,
      min: pr.min,
    });
  if (pr.state === 'r290')
    leistung.push({
      kat: 'Sicherheit (A3)',
      label: 'R290 Dichtheits- & Sicherheitsprüfung inkl. Protokoll',
      menge: pr.kreise === 1 ? '1 Kreis' : pr.kreise + ' Kreise',
      umfang: 'Schutzbereich, Lecksuche mit Ex-geschütztem Gerät, Sicherheitseinrichtungen',
      min: pr.min,
    });
  const material = C.material
    .filter((m) => q[m.id] > 0)
    .map((m) => ({
      label: m.label,
      menge: qtyText(q[m.id], m.unit),
      preis: S[m.price],
      betrag: round(q[m.id] * S[m.price], 2),
    }));
  const pausch = (label, x) => {
    if (n0(x) > 0)
      material.push({ label, menge: '1 Pauschale', preis: n0(x), betrag: round(n0(x), 2) });
  };
  pausch('Anfahrtspauschale (An- und Abfahrt zum Objekt)', v.anfahrt);
  pausch(C.erschwernisLabel, v.erschwernis);
  if (n0(v.sonderPreis) > 0 || String(v.sonderText || '').trim())
    material.push({
      label: String(v.sonderText || '').trim() || 'Sonderposition',
      menge: '1 Pauschale',
      preis: n0(v.sonderPreis),
      betrag: round(n0(v.sonderPreis), 2),
    });
  const minRicht = leistung.reduce((a, x) => a + x.min, 0);
  const dauer = minRicht,
    minTech = minRicht * nT;
  const lohnTech = round((minTech / 60) * S.satz_tech, 2),
    lohnHelfer = round((dauer / 60) * nH * S.satz_helfer, 2);
  const lohn = round(lohnTech + lohnHelfer, 2);
  const mat = round(
    material.reduce((a, x) => a + x.betrag, 0),
    2,
  );
  const netto = round(lohn + mat, 2),
    mwst = round((netto * S.mwst) / 100, 2),
    brutto = round(netto + mwst, 2);
  return {
    S,
    q,
    pr,
    nT,
    nH,
    team: teamText(nT, nH),
    leistung,
    material,
    minRicht,
    minTech,
    dauer,
    lohnTech,
    lohnHelfer,
    lohn,
    mat,
    netto,
    mwst,
    brutto,
  };
}

/* Bericht-Datenstruktur – identisch genutzt von App-PDF und Apps-Script-PDF */
function buildReport(p) {
  const v = p.values,
    k = calc(p),
    S = k.S,
    pa = v.pauschal === 'Ja',
    pr = k.pr;
  const tiles = [
    {
      cls: 'primary',
      lab: 'Gesamtpreis brutto',
      val: eur(k.brutto),
      sub: `Netto ${eur(k.netto)} zzgl. ${fmtNum(S.mwst)} % MwSt.`,
    },
  ];
  tiles.push(
    pa
      ? {
          lab: 'Team vor Ort',
          val: `${k.nT + k.nH} ${k.nT + k.nH === 1 ? 'Person' : 'Personen'}`,
          sub: k.team,
        }
      : {
          lab: 'Arbeitszeit gesamt',
          val: hrs(k.minTech + k.dauer * k.nH),
          sub: `Einsatz vor Ort ca. ${hrs(k.dauer)}, ${k.nT + k.nH} ${k.nT + k.nH === 1 ? 'Person' : 'Personen'}`,
        },
  );
  tiles.push(
    pr.state === 'pflicht'
      ? {
          cls: 'warn',
          lab: 'Dichtheitsprüfung',
          val: `alle ${pr.monate} Monate`,
          sub: `Pflicht: ${de(pr.co2, 2)} t CO₂-Äq. je Kreis`,
        }
      : pr.state === 'r290'
        ? {
            cls: 'warn',
            lab: 'Sicherheitsprüfung',
            val: 'R290 jährlich',
            sub: 'Dichtheits- & Sicherheitsprüfung (A3)',
          }
        : pr.state === 'frei'
          ? {
              cls: 'ok',
              lab: 'Dichtheitsprüfung',
              val: 'keine Pflicht',
              sub:
                pr.km === 'R290' || /290/.test(pr.km)
                  ? 'natürliches Kältemittel'
                  : `${de(pr.co2, 2)} t CO₂-Äq. je Kreis (Grenze ${pr.grenze} t)`,
            }
          : { lab: 'Dichtheitsprüfung', val: '—', sub: pr.text },
  );
  const projekt = [
    { label: 'Kunde', value: v.kunde },
    { label: 'Objekt / Standort', value: v.standort },
    { label: 'Team vor Ort', value: k.team },
    { label: 'Erstellt von', value: v.bearbeiter },
  ];
  const leistung = pa
    ? {
        head: ['Pos.', 'Komponente / Leistung', 'Menge', 'Leistungsumfang'],
        cls: ['', '', 'num', ''],
        widths: ['7%', '41%', '12%', '40%'],
        rows: k.leistung.map((x, i) => ({
          cells: [String(i + 1), x.label, x.menge, x.umfang],
        })),
      }
    : {
        head: ['Pos.', 'Komponente / Leistung', 'Menge', 'Leistungsumfang', 'Zeit'],
        cls: ['', '', 'num', '', 'num'],
        widths: ['6%', '38%', '11%', '35%', '10%'],
        rows: k.leistung.map((x, i) => ({
          cells: [String(i + 1), x.label, x.menge, x.umfang, de(x.min, 0) + ' Min'],
        })),
      };
  const material = pa
    ? {
        head: ['Pos.', 'Material / Nebenleistung', 'Menge', 'Abrechnung'],
        cls: ['', '', 'num', ''],
        widths: ['7%', '51%', '16%', '26%'],
        rows: k.material.map((x, i) => ({
          cells: [String(i + 1), x.label, x.menge, 'im Pauschalpreis enthalten'],
        })),
      }
    : {
        head: ['Pos.', 'Material / Nebenleistung', 'Menge', 'Einzelpreis', 'Betrag netto'],
        cls: ['', '', 'num', 'num', 'num'],
        widths: ['6%', '46%', '16%', '16%', '16%'],
        rows: k.material.map((x, i) => ({
          cells: [String(i + 1), x.label, x.menge, eur(x.preis), eur(x.betrag)],
        })),
      };
  const km = pr.km
    ? [
        {
          label: 'Kältemittel',
          value: pr.km + (isN(v.gwp) ? ` (GWP ${fmtNum(v.gwp)})` : ''),
        },
        {
          label: 'Füllmenge',
          value:
            (isN(v.menge) ? fmtNum(v.menge) + ' kg' : '—') +
            ` × ${pr.kreise} ${pr.kreise === 1 ? 'Kreis' : 'Kreise'}`,
        },
        {
          label: 'CO₂-Äquivalent je Kreis',
          value: isN(v.gwp) && pr.menge ? de(pr.co2, 2) + ' t' : '',
        },
        {
          label: 'Hermetisch / Leckage-Erk.',
          value: `${v.herm || 'Nein'} / ${v.leck || 'Nein'}`,
        },
        { label: 'Prüfpflicht', value: pr.text, wide: true },
      ]
    : [];
  const kosten = {
    head: ['Kostenaufstellung', 'Betrag'],
    cls: ['', 'num'],
    widths: ['75%', '25%'],
    rows: [],
  };
  if (pa)
    kosten.rows.push({
      cells: [
        'Pauschalpreis netto (Arbeitszeit, Material, Anfahrt und Nebenleistungen)',
        eur(k.netto),
      ],
      cls: 'sum',
    });
  else {
    kosten.rows.push({
      cells: [
        `Lohnkosten Servicetechniker (${k.nT > 1 ? k.nT + ' × ' : ''}${hrs(k.dauer)} × ${eur(S.satz_tech)})`,
        eur(k.lohnTech),
      ],
    });
    if (k.nH)
      kosten.rows.push({
        cells: [
          `Lohnkosten Helfer / Azubi (${k.nH} × ${hrs(k.dauer)} × ${eur(S.satz_helfer)})`,
          eur(k.lohnHelfer),
        ],
      });
    kosten.rows.push({ cells: ['Material, Anfahrt & Nebenleistungen', eur(k.mat)] });
    kosten.rows.push({ cells: ['Nettobetrag gesamt', eur(k.netto)], cls: 'sum' });
  }
  kosten.rows.push({ cells: [`zzgl. ${fmtNum(S.mwst)} % MwSt.`, eur(k.mwst)] });
  kosten.rows.push({ cells: ['Gesamtpreis brutto', eur(k.brutto)], cls: 'tot' });
  return {
    kicker: pa ? 'ANGEBOT' : 'KALKULATION',
    title: C.pdfTitle,
    firma: settings.firma || '',
    id: v.projekt || '',
    datum: fmtDate(v.datum),
    kunde: v.kunde || '',
    tiles,
    projekt,
    leistung,
    material,
    km,
    kosten,
    remark: v.bem || '',
    hinweis: pa ? S.text_angebot : S.text_intern,
  };
}
/* Spaltenwerte fürs Google Sheet */
function buildCols(p) {
  const v = p.values,
    k = calc(p);
  const out = [];
  const add = (col, x, kind) => out.push([col, x, kind || '']);
  const f = (id) => FIELDS.find((x) => x.id === id);
  ['projekt', 'datum', 'kunde', 'standort', 'bearbeiter'].forEach((id) => {
    const x = f(id);
    add(x.col, v[id] || '', x.type === 'date' && v[id] ? 'date' : '');
  });
  add('Netto (€)', k.netto);
  add('MwSt (€)', k.mwst);
  add('Brutto (€)', k.brutto);
  add('Arbeitszeit Techniker (h)', round(k.minTech / 60, 2));
  add('Einsatzdauer vor Ort (h)', round(k.dauer / 60, 2));
  add('Lohnkosten netto (€)', k.lohn);
  add('Material & Nebenkosten netto (€)', k.mat);
  add('CO₂-Äquivalent je Kreis (t)', k.pr.km && isN(v.gwp) && k.pr.menge ? k.pr.co2 : '');
  add('Prüfpflicht F-Gase', k.pr.km ? k.pr.text : '');
  FIELDS.slice(5).forEach((x) => {
    const val = v[x.id];
    add(
      x.col,
      val === '' || val == null ? '' : x.type === 'num' && isN(val) ? num(val) : String(val),
    );
  });
  return out;
}

const APP_VERSION = '2.3.2';
const BUILD_DATE = '2026-11-19';

      /* @@quelle:reportParts */
      /* Bericht im neuen Papier-Design (Seitenklasse „neu“): Hauptwert, Projektdaten, Kennwerte, Positionen als Zeilen, Preisaufstellung, Hinweis.
   Nimmt die Bericht-Datenstruktur von buildReport() unverändert entgegen (die App speichert sie auch im Sheet).
   Die HTML-Bausteine kommen aus shared/pdf-bausteine.js (pdfBausteine()), das CSS aus shared/pdf.css. */
      function reportParts(r) {
        const B = pdfBausteine(),
          { esc, nl } = B;
        const firma = r.firma || (typeof settings !== 'undefined' ? settings.firma : '') || '';
        const tiles = r.tiles || [];
        const art = r.kicker === 'ANGEBOT' ? 'Angebot' : 'Kalkulation';
        const id = r.id || '—';
        let no = 0;
        // Tabelle aus buildReport (head, cls, widths, rows [{cells, cls:'sum'|'tot'}]) als Zeilen mit eigener Spaltenaufteilung;
        // lange Tabellen in Stücken zu 14 Zeilen, damit sie auf Folgeseiten weiterlaufen können
        const tabBlocks = (titel, t, ref, zusammen) => {
          const nr = String(++no);
          if (!t || !t.rows || !t.rows.length)
            return [{ html: B.nAbschnitt(nr, titel, '<div class="n-sub">Keine Positionen</div>') }];
          const tpl = 'grid-template-columns:' + t.widths.map((w) => parseFloat(w) + 'fr').join(' ');
          const al = (i) => (t.cls[i] === 'num' ? ' style="text-align:right"' : '');
          const kopf = t.head
            .map((h, i) => `<span${al(i)}>${h === titel ? '' : esc(h)}</span>`)
            .join('');
          const zeile = (row) => {
            const sum = row.cls === 'sum' || row.cls === 'tot';
            return `<div class="n-row${row.cls === 'tot' ? ' calc' : ''}" style="${tpl}${sum ? ';font-weight:600' : ''}">${row.cells
              .map((c, i) => {
                const inh = t.cls[i] === 'num' ? B.nWert(c) : nl(c);
                return `<span${i === 0 && /^\d+$/.test(String(c)) ? ' class="nr"' : ''}${al(i)}>${inh}</span>`;
              })
              .join('')}</div>`;
          };
          const gr = zusammen ? t.rows.length : 14;
          const out = [];
          for (let a = 0; a < t.rows.length; a += gr) {
            const teil = `<div class="n-th" style="${tpl}">${kopf}</div><div class="n-rows">${t.rows
              .slice(a, a + gr)
              .map(zeile)
              .join('')}</div>`;
            out.push({
              html: B.nAbschnitt(a ? '' : nr, a ? titel + ' (Fortsetzung)' : titel, teil, a ? '' : ref),
            });
          }
          return out;
        };
        const blocks = [];
        // Hauptwert: erste Kachel (Gesamtpreis), die beiden weiteren als Spalten daneben
        if (tiles.length) {
          const h = tiles[0];
          blocks.push({
            html: B.nHaupt({
              label: h.lab,
              wert: h.val,
              sub: h.sub,
              spalten: tiles.slice(1, 3).map((t) => ({ label: t.lab, wert: t.val })),
            }),
          });
        }
        // Zusatzzeilen der Kacheln (Untertexte) als Kennwerte
        const kenn = tiles
          .slice(1)
          .filter((t) => t.sub)
          .map((t) => ({ label: t.lab, value: t.sub }));
        if (kenn.length) blocks.push({ html: B.nAbschnitt(String(++no), 'Kennwerte', B.nZeilen(kenn)) });
        blocks.push({ html: B.nAbschnitt(String(++no), 'Projektdaten', B.nZeilen(r.projekt || [])) });
        tabBlocks('Leistungsumfang', r.leistung, '', false).forEach((b) => blocks.push(b));
        tabBlocks('Material & Nebenleistungen', r.material, '', false).forEach((b) => blocks.push(b));
        tabBlocks(r.kicker === 'ANGEBOT' ? 'Preis' : 'Kostenaufstellung', r.kosten, '', true).forEach((b) =>
          blocks.push(b),
        );
        if (r.km && r.km.length) {
          const kz = r.km.map((x) => ({ label: x.label, value: x.value, calc: /CO₂/.test(x.label) }));
          blocks.push({ html: B.nAbschnitt(String(++no), 'Kältemittel & F-Gase-Prüfung', B.nZeilen(kz)) });
        }
        if (r.remark)
          blocks.push({ html: B.nAbschnitt('', 'Bemerkungen', B.nZeilen([{ label: 'Bemerkungen', value: r.remark }])) });
        if (r.hinweis) blocks.push({ html: B.nHinweis([{ titel: 'Hinweis.', text: r.hinweis }]) });
        const titelZeilen = [art, r.title].filter(Boolean);
        return {
          blocks,
          pageClass: 'neu',
          head: B.nKopf({
            firma,
            titel: titelZeilen,
            nummern: [
              { label: 'Projekt-Nr.', wert: id },
              { label: 'Datum', wert: r.datum },
            ],
          }),
          smallHead: B.nKopfKlein({
            firma,
            zeile: r.kunde || '',
            nummern: [{ label: 'Projekt-Nr.', wert: id }],
          }),
          foot: B.nFuss({ text: titelZeilen.join(' '), stand: r.datum }),
          id: esc(id),
        };
      }
      /* @@ende */

function reportForView() {
  if (view.db) return view.rep;
  const p = calcs.find((x) => x.id === view.id);
  return p ? buildReport(p) : null;
}
/* pdfName, isStandalone, pdfBase64, layoutReport, reportPdfBlob stehen in shared/pdf.js */

/* ---------- PDF-Erzeugung (offline, ohne Druckdialog – iOS druckt in Home-Bildschirm-Apps nicht) ---------- */
let lastPdf = null; // {key, file, url}
const viewKey = () => (view.db ? 'db:' + view.key : 'loc:' + view.id);
function pdfBarHtml() {
  if (!lastPdf || lastPdf.key !== viewKey()) return '';
  return `${isStandalone() ? '' : `<a class="btn-secondary" href="${lastPdf.url}" download="${esc(lastPdf.file.name)}" target="_blank" rel="noopener">Öffnen</a>`}`;
}
