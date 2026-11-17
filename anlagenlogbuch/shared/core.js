/* shared/core.js – gemeinsame Hilfsfunktionen der Service-Apps.
   Enthält: Speicher (LS), DOM-/Text-Helfer ($, esc, uid, today, fmtDateTime), Zahlen (isN, round, fmtNum),
   Eingabe-Ergonomie (.select() auf Zahlenfeldern), Zoom-Sperre (gesture*-Ereignisse),
   Bewegung (RM, flash). Klassisches Skript (kein Modul): vor dem App-Skript laden. */
const LS = {
  fullMsg: 'Speichern fehlgeschlagen – Speicher voll?',
  get(k, d) {
    try {
      const v = localStorage.getItem(k);
      return v ? JSON.parse(v) : d;
    } catch (e) {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
      return true;
    } catch (e) {
      toast(LS.fullMsg);
      return false;
    }
  },
};
const $ = (s) => document.querySelector(s);
function esc(s) {
  return String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}
function uid() {
  return window.crypto && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}
function today() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}
function fmtDateTime(s) {
  if (!s) return '';
  const d = new Date(s);
  return isNaN(d)
    ? String(s)
    : d.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
}
function isN(v) {
  return v !== '' && v != null && !isNaN(num(v));
}
function round(n, d) {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}
function fmtNum(n) {
  return String(n).replace('.', ',');
}
/* Eingabe-Ergonomie: Numerische Felder beim Fokus/Klick komplett markieren */
document.addEventListener('focusin', (e) => {
  const el = e.target;
  if (
    el &&
    el.tagName === 'INPUT' &&
    (el.type === 'number' || el.inputMode === 'decimal' || el.inputMode === 'numeric')
  ) {
    requestAnimationFrame(() => {
      try {
        el.select();
      } catch (err) {}
    });
  }
});
/* Zoomen sperren: iOS ignoriert user-scalable=no, deshalb Pinch-Gesten abfangen */
['gesturestart', 'gesturechange', 'gestureend'].forEach((name) => {
  document.addEventListener(name, (e) => e.preventDefault(), { passive: false });
});
/* Bewegung reduzieren (Systemeinstellung) und kurzes Aufleuchten eines geänderten Werts */
const RM = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
function flash(el) {
  if (!el || RM()) return;
  el.classList.remove('flash');
  void el.offsetWidth;
  el.classList.add('flash');
}
