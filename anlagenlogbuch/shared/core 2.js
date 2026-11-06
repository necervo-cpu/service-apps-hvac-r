/* shared/core.js – gemeinsame Hilfsfunktionen der Service-Apps.
   Enthält: Speicher (LS), DOM-/Text-Helfer ($, esc, uid, today, fmtDateTime), Zahlen (isN, round, fmtNum),
   Meldung (toast), Bewegung (RM, flash). Klassisches Skript (kein Modul): vor dem App-Skript laden.
   Voraussetzung: Die App definiert num(v) selbst (wird von isN erst beim Aufruf benutzt) und hat ein Element #toast. */
const LS = {
  fullMsg: 'Speichern fehlgeschlagen – Speicher voll?',
  get(k, d){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); return true; }catch(e){ toast(LS.fullMsg); return false; } }
};
const $ = s => document.querySelector(s);
function esc(s){ return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function uid(){ return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10); }
function today(){ const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }
function fmtDateTime(s){ if(!s) return ''; const d = new Date(s); return isNaN(d) ? String(s) : d.toLocaleString('de-DE', {dateStyle:'short', timeStyle:'short'}); }
function isN(v){ return v !== '' && v != null && !isNaN(num(v)); }
function round(n, d){ const f = Math.pow(10, d); return Math.round(n * f) / f; }
function fmtNum(n){ return String(n).replace('.', ','); }
let toastTimer;
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3500); }
/* Bewegung reduzieren (Systemeinstellung) und kurzes Aufleuchten eines geänderten Werts */
const RM = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
function flash(el){ if(!el || RM()) return; el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
