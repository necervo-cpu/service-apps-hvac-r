// Ereignisse und Start der App.
'use strict';

/* ---------- Events ---------- */
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) {
    return;
  }
  const fn = Actions[b.dataset.act];
  if (fn) {
    e.preventDefault();
    if (navBusy) {
      return;
    }
    fn(b.dataset, b);
  }
});
/* ±-Umschalter: führendes Minus setzen oder entfernen; Input-Event löst Speichern und Berechnung aus */
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-sign]');
  if (!b) {
    return;
  }
  e.preventDefault();
  const el = document.getElementById('in-' + b.dataset.sign);
  const wert = el ? el.value.trim() : '';
  if (!el || wert === '') {
    return; // leeres Feld: nichts vorzeichnen
  }
  el.value = wert.startsWith('-') ? wert.slice(1) : '-' + wert;
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
/* Zahlenfelder: beim Antippen ganzen Wert markieren, damit er sich direkt überschreiben lässt */
const markiereWert = (e) => {
  const el = e.target;
  if (el.matches && el.matches('.value-input, .glass-input')) {
    setTimeout(() => el.select(), 0);
  }
};
app.addEventListener('focusin', markiereWert);
app.addEventListener('click', markiereWert);
app.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.f && view.name === 'wizard') {
    const p = cur();
    const f = FIELD[el.dataset.f];
    p.values[f.id] = el.value;
    if (f.id === 'next' && el.value === '') {
      p.nextAuto = null; // Nutzer leert das Feld bewusst: nicht wieder vorbelegen
    }
    recompute(p);
    if (f.id !== 'next') {
      autoNext(p);
    }
    save();
    if (f.id === 'projekt' || f.id === 'kunde') {
      setHeader(false); // Kopf-Unterzeile mitführen (kein Neuzeichnen)
    }
    if (f.hdr) {
      const t = document.getElementById('vt-' + f.dev);
      if (t) {
        t.textContent = vTitle(p.values, f.dev);
      }
    }
    if (f.type === 'number') {
      messPillAktualisieren(f, p.values);
    }
    const seite = TEMPLATE.pages[p.page];
    const felder = seite.evap ? (f.dev ? DEV_FIELDS[f.dev] : []) : seite.fields;
    felder
      .filter((c) => c.type === 'calc')
      .forEach((c) => {
        const ce = $('#calc-' + c.id);
        const ne = $('#note-' + c.id);
        if (ce) {
          ce.textContent = display(c, p.values[c.id]) || '–';
        }
        if (ne && c.note) {
          ne.textContent = c.note(p.values);
        }
      });
    setSteps();
  } else if (el.id === 'dbsearch') {
    view.q = el.value;
    $('#dblist').innerHTML = dbList();
  }
});
document.addEventListener('change', async (e) => {
  const el = e.target;
  if (el.id === 's_import' && el.files[0]) {
    // Altwert „Mangel“ → „n.i.O.“ auch für importierte Protokolle
    backupImport(el.files[0], 'protocols', protocols, 'Protokolle', (list) => {
      list.forEach((p) => {
        if (p && p.values) {
          normVals(p.values);
        }
      });
      protocols = list;
      save();
    });
  }
});
window.addEventListener('online', () => {
  updateNet();
  syncAll(true);
});
window.addEventListener('offline', updateNet);
let lastW = window.innerWidth;
window.addEventListener('resize', () => {
  // Drehen des iPads: Unterschriftsfelder neu aufbauen
  if (
    window.innerWidth !== lastW &&
    view.name === 'wizard' &&
    cur() &&
    TEMPLATE.pages[cur().page].final
  ) {
    render();
  }
  lastW = window.innerWidth;
});

/* ---------- Start ---------- */
// Gespeicherte Protokolle (auch ältere): „Mangel“ → „n.i.O.“, fehlende Anzahl Verdampfer ergänzen – sonst bleibt alles unverändert
{
  let ch = false;
  protocols.forEach((p) => {
    if (p && p.values && normVals(p.values)) {
      ch = true;
    }
  });
  if (ch) {
    save();
  }
}
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => {});
}
pruneSynced();
syncThemeUi();
render();
syncAll(true);
if (navigator.onLine) {
  pruefeUpdate(false);
}
