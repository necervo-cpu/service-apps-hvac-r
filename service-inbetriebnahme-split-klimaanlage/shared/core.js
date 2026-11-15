/* shared/core.js – gemeinsame Hilfsfunktionen der Service-Apps.
   Enthält: Speicher (LS), DOM-/Text-Helfer ($, esc, uid, today, fmtDateTime), Zahlen (isN, round, fmtNum),
   Meldung (toast), Liquid-Glass-Dialog (confirmModal), Eingabe-Ergonomie (.select() auf Zahlenfeldern),
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
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}
/* Nicht-blockierender Liquid-Glass-Bestätigungsdialog (ersetzt natives confirm()) */
function confirmModal(title, message, confirmLabel = 'Bestätigen', danger = false) {
  return new Promise((resolve) => {
    const bd = document.createElement('div');
    bd.className = 'ag-modal-backdrop';
    bd.setAttribute('role', 'dialog');
    bd.setAttribute('aria-modal', 'true');
    bd.innerHTML = `<div class="ag-modal liquid-glass">
      <h3>${esc(title)}</h3>
      <p>${esc(message)}</p>
      <div class="ag-modal-actions">
        <button type="button" class="btn" data-m="cancel">Abbrechen</button>
        <button type="button" class="btn ${danger ? 'danger' : 'primary'}" data-m="ok">${esc(confirmLabel)}</button>
      </div>
    </div>`;
    const close = (val) => {
      bd.remove();
      resolve(val);
    };
    bd.addEventListener('click', (e) => {
      if (e.target === bd || e.target.closest('[data-m="cancel"]')) close(false);
      else if (e.target.closest('[data-m="ok"]')) close(true);
    });
    document.body.appendChild(bd);
    const okBtn = bd.querySelector('[data-m="ok"]');
    if (okBtn) okBtn.focus();
  });
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
/* Bewegung reduzieren (Systemeinstellung) und kurzes Aufleuchten eines geänderten Werts */
const RM = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
function flash(el) {
  if (!el || RM()) return;
  el.classList.remove('flash');
  void el.offsetWidth;
  el.classList.add('flash');
}
