/* app-aktionen.js – Bedienung: Schritt-Wechsel, Aktionen (data-act), Eingabe-Ereignisse. */
'use strict';
/* Wechsel Eingabe und Ergebnis: sofort neu zeichnen, ohne Animation */
function swapStep(step) {
  if (isRes() === (step === 'res')) return;
  view.step = step;
  prevKpi = null;
  render();
  window.scrollTo(0, 0);
}
/* ====== Aktionen ====== */
const Act = {
  new() {
    const p = newProject();
    projects.unshift(p);
    saveProjects();
    go('edit', { id: p.id });
  },
  open(d) {
    go('edit', { id: d.id });
  },
  async del(d) {
    const p = projects.find((x) => x.id === d.id);
    if (
      p &&
      (await confirmModal(
        'Auslegung löschen',
        'Auslegung „' + (p.nr || 'ohne Projektnummer') + '“ löschen?',
        'Löschen',
        true,
      ))
    ) {
      projects = projects.filter((x) => x.id !== d.id);
      saveProjects();
      render();
    }
  },
  back() {
    go('list');
  },
  toresult() {
    swapStep('res');
  },
  toinput() {
    swapStep('in');
  },
  /* Nur Klasse umschalten (kein Neuzeichnen): Eingabefelder behalten den Fokus */
  toggleroom(d, el) {
    const r = cur().rooms[+d.i],
      card = el.closest('.acc');
    if (!r || !card) return;
    const open = !openRooms.has(r.id);
    if (open) openRooms.add(r.id);
    else openRooms.delete(r.id);
    card.classList.toggle('is-open', open);
    el.setAttribute('aria-expanded', open);
  },
  toggleacc(d, el) {
    const card = el.closest('.acc');
    if (!card) return;
    const open = !card.classList.contains('is-open');
    card.classList.toggle('is-open', open);
    el.setAttribute('aria-expanded', open);
    uiOpen[d.k] = open;
  },
  setf(d, el) {
    const p = cur(),
      card = el.closest('[data-room]');
    if (!p || !card) return;
    const r = p.rooms[+card.dataset.room],
      f = d.f;
    r[f] = d.v;
    lastPdf = null;
    if (f === 'typ') {
      const s = [...new Set(DB.ig.filter((x) => x.typ === r.typ).map((x) => x.serie))];
      r.serie = s.includes('Perfera') ? 'Perfera' : s[0] || '';
      r.modell = '';
    }
    if (f === 'serie') r.modell = '';
    saveProjects();
    render();
  },
  addroom() {
    const p = cur();
    if (p.rooms.length < 5) {
      const r = newRoom();
      p.rooms.push(r);
      openRooms.add(r.id);
      saveProjects();
      render();
    }
  },
  sign(d, btn) {
    const inp = btn.parentElement.querySelector('input'),
      card = btn.closest('[data-room]'),
      p = cur();
    if (!inp || !card || !p) return;
    let v = inp.value.trim().replace('−', '-');
    v = v.startsWith('-') ? v.slice(1) : v === '' ? '-' : '-' + v.replace(/^\+/, '');
    inp.value = v;
    p.rooms[+card.dataset.room].hoehe = v;
    lastPdf = null;
    saveProjects();
    refreshResults();
    inp.focus();
  },
  delroom(d) {
    const p = cur();
    p.rooms.splice(+d.i, 1);
    saveProjects();
    render();
  },
  pickodu(d) {
    const p = cur();
    p.odu = p.odu === d.id ? '' : d.id;
    saveProjects();
    lastPdf = null;
    refreshResults();
  },
  async makepdf(d, btn) {
    if (!window.jspdf || !window.html2canvas) {
      toast('PDF-Modul nicht geladen – App einmal online neu starten.');
      return;
    }
    if (pdfBusy) return;
    const p = cur(),
      x = selected();
    if (!x || !x.ok) return;
    if (btn.classList.contains('done')) return;
    const snap = () =>
      JSON.stringify([
        p.rooms,
        p.odu,
        p.nr,
        p.datum,
        p.kunde,
        p.bearbeiter,
        p.bemerkung,
        settings.firma,
      ]);
    const s0 = snap();
    const cb = () => $('#bar .pdfb'); // immer der aktuell im DOM befindliche Knopf (die Leiste wird bei Änderungen neu gebaut)
    const setP = (v) => {
      pdfProg = v;
      const f = $('#bar .pdfb .fill');
      if (f) f.style.transform = 'scaleX(' + v + ')';
    };
    pdfBusy = p.id;
    pdfProg = 0;
    {
      const b = cb();
      if (b) b.classList.add('run');
    }
    setP(0.05);
    try {
      const blob = await reportPdfBlob(buildReport(p, x), { onProgress: setP });
      setP(1);
      if (!projects.includes(p) || snap() !== s0) {
        toast('Daten geändert – PDF bitte neu erstellen');
        return;
      }
      if (lastPdf) URL.revokeObjectURL(lastPdf.url);
      lastPdf = {
        id: p.id,
        file: new File([blob], pdfName(p.nr) + '.pdf', { type: 'application/pdf' }),
        url: URL.createObjectURL(blob),
      };
      pdfBusy = null;
      if (view.name === 'edit' && view.id === p.id) {
        refreshResults(); // baut Leiste neu auf -> neuen Knopf in den Fertig-Zustand setzen
        const nb = cb();
        if (nb) {
          nb.classList.remove('run');
          nb.classList.add('done');
          setTimeout(() => nb.classList.remove('done'), 2600);
        }
        toast(
          'PDF „' + (p.nr || 'ohne Projektnummer') + '“ ist fertig. Jetzt „Teilen“ antippen.',
        );
      } else toast('PDF „' + (p.nr || 'ohne Projektnummer') + '“ ist fertig.');
    } catch (e) {
      toast('PDF konnte nicht erstellt werden: ' + e.message);
    } finally {
      pdfBusy = null;
      pdfProg = 0;
      const b = cb();
      if (b && !b.classList.contains('done')) {
        b.classList.remove('run');
        setP(0);
      }
    }
  },
  async sharepdf() {
    if (!lastPdf) return;
    const files = [lastPdf.file];
    if (navigator.canShare && navigator.canShare({ files })) {
      try {
        await navigator.share({ files, title: lastPdf.file.name });
      } catch (e) {
        if (e.name !== 'AbortError') toast('Teilen fehlgeschlagen: ' + e.message);
      }
    } else if (isStandalone()) window.open(lastPdf.url, '_blank');
    else {
      const a = document.createElement('a');
      a.href = lastPdf.url;
      a.download = lastPdf.file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  },
  checkupdate() {
    pruefeUpdate(true);
  },
  doupdate() {
    toast('Update auf v' + updateHinweis + ' wird geladen.');
    setTimeout(clearCachesAndReload, 900);
  },
  updatespaeter() {
    updateSpaeter = true;
    render();
  },
  /* Plus/Minus an Zahlenfeldern: Schritt aus data-step, untere Grenze aus data-min (leer = auch negativ) */
  step(d, btn) {
    const row = btn.closest('.num-row'),
      inp = row && row.querySelector('input');
    if (!inp) return;
    const st = parseFloat(row.dataset.step) || 1,
      mn = row.dataset.min === '' ? null : parseFloat(row.dataset.min);
    const cur0 = E.num(inp.value);
    let v = Math.round(((cur0 == null ? 0 : cur0) + (+d.dir) * st) * 100) / 100;
    if (mn !== null && v < mn) v = mn;
    inp.value = String(v).replace('.', ',');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  },
  forcereload() {
    clearCachesAndReload();
  },
  saveset() {
    settings.firma = $('#s_firma').value.trim();
    settings.bearbeiter = $('#s_bear').value.trim();
    LS.set(KEY.settings, settings);
    modalClose();
    toast('Gespeichert.');
  },
};
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || !Act[el.dataset.act]) return;
  Act[el.dataset.act](el.dataset, el);
});
$('#btnset').onclick = () => openSettings();

/* Eingaben: Texte und Zahlen aktualisieren nur das Ergebnis, Auswahlfelder zeichnen neu */
document.addEventListener('input', (e) => {
  const t = e.target,
    p = view.name === 'edit' ? cur() : null;
  if (!p) return;
  if (t.dataset.p) {
    p[t.dataset.p] = t.value;
    lastPdf = null;
    saveProjects();
    return;
  }
  const card = t.closest('[data-room]');
  if (!card || !t.dataset.f) return;
  p.rooms[+card.dataset.room][t.dataset.f] = t.value;
  lastPdf = null;
  saveProjects();
  refreshResults();
});
window.addEventListener('online', updateNet);
window.addEventListener('offline', updateNet);
