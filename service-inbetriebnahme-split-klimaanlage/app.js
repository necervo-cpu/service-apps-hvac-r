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
      setHeader(false); // Kopf-Unterzeile mitführen (kein Neuzeichnen)
    }
    if (el.dataset.other) {
      auswahlZustand(f, el.value);
    }
    calcAktualisieren(p);
    setSteps();
  } else if (el.id === 'dbsearch') {
    view.q = el.value;
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
$('#app-version-label').textContent = 'v' + APP_VERSION;
$('#appBuildDateLabel').textContent = BUILD_DATE;
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

/* −/+ neben Zahlenfeldern: Schritt addieren, Komma als Dezimaltrennzeichen, input-Event löst Speichern und Berechnung aus */
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-stepf]');
  if (!b) {
    return;
  }
  e.preventDefault();
  const el = document.getElementById('in-' + b.dataset.stepf);
  if (!el) {
    return;
  }
  const schritt = Number(b.dataset.step);
  const dez = (String(schritt).split('.')[1] || '').length;
  const faktor = 10 ** dez;
  const basis = parseFloat(String(el.value).trim().replace(',', '.'));
  const neu = Math.round((Number.isFinite(basis) ? basis * faktor : 0) + Number(b.dataset.dir) * schritt * faktor) / faktor;
  el.value = neu.toFixed(dez).replace('.', ',');
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
