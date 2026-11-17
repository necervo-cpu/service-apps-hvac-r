// Ereignisse und Start der App.
'use strict';

/* ---------- Events ---------- */
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  const fn = Actions[b.dataset.act];
  if (fn) {
    e.preventDefault();
    fn(b.dataset, b);
  } // während eines Seitenübergangs Tipps ignorieren
});
app.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.f && view.name === 'wizard') {
    const p = cur(),
      id = el.dataset.f;
    p.values[id] = el.value;
    if (id === 'projekt' || id === 'kunde') setHeader(false); // Kopf-Unterzeile mitführen (kein Neuzeichnen)
    if ((POSBY[id] && POSBY[id].auto) || id === 'gwp') p.manual[id] = true;
    if (el.dataset.other)
      document
        .querySelectorAll('[data-act=set][data-f="km"]')
        .forEach((b) => b.setAttribute('aria-selected', String(b.dataset.v === el.value)));
    applyAutos(p);
    save();
    live();
  } else if (el.id === 'dbsearch') {
    view.q = el.value;
    $('#dblist').innerHTML = dbList();
  }
});
document.addEventListener('change', async (e) => {
  const el = e.target;
  if (el.id === 's_import' && el.files[0]) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (!Array.isArray(d.calcs)) throw new Error('Keine gültige Backup-Datei');
        const byId = new Map(calcs.map((p) => [p.id, p]));
        d.calcs.forEach((p) => byId.set(p.id, p));
        calcs = [...byId.values()];
        save();
        toast(`Backup importiert: ${d.calcs.length} Kalkulationen.`);
      } catch (err) {
        toast('Import fehlgeschlagen: ' + err.message);
      }
    };
    r.readAsText(el.files[0]);
  }
});
window.addEventListener('online', () => {
  updateNet();
  loadStamm(true);
  syncAll(true);
});
window.addEventListener('offline', updateNet);

/* ---------- Start ---------- */
if ('serviceWorker' in navigator && location.protocol.startsWith('http'))
  navigator.serviceWorker.register('sw.js').catch(() => {});
if (navigator.storage && navigator.storage.persist)
  navigator.storage.persist().catch(() => {});
render();
loadStamm(true).then((ok) => {
  if (ok && view.name !== 'wizard') render();
});
syncAll(true);
syncThemeUi();
if (navigator.onLine) pruefeUpdate(false);
