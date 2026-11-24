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
    recompute(p);
    save();
    if (f.id === 'projekt' || f.id === 'kunde') {
      setHeader(false);
    }
    if (el.dataset.other) {
      document.querySelectorAll(`[data-act=set][data-f="${f.id}"]`).forEach((b) => {
        const an = String(b.dataset.v === el.value);
        b.setAttribute(
          b.hasAttribute('aria-selected') ? 'aria-selected' : 'aria-pressed',
          an,
        );
      });
    }
    if (f.type === 'number') {
      messPillAktualisieren(f, p.values);
    }
    TEMPLATE.pages[p.page].fields
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
    view.lim = 100;
    $('#dblist').innerHTML = dbList();
  }
});
document.addEventListener('change', async (e) => {
  const el = e.target;
  if (el.id === 's_import' && el.files[0]) {
    backupImport(el.files[0], 'protocols', protocols, 'Protokolle', (list) => {
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
