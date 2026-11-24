// Start: Service Worker, Aufräumen, erste Darstellung, Synchronisierung und stiller Update-Check.
'use strict';

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
