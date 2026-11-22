// Aktionen: PDF-Erzeugung, Unterschrift, Google-Sheet-Schnittstelle, Auswahl- und Protokoll-Aktionen.
'use strict';

/* ---------- PDF-Erzeugung (offline, ohne Druckdialog – iOS druckt in Home-Bildschirm-Apps nicht) ---------- */
let lastPdf = null; // {key, file, url}
const viewKey = () => (view.db ? 'db:' + view.key : 'loc:' + view.id);
function pdfBarHtml() {
  if (!lastPdf || lastPdf.key !== viewKey()) {
    return '';
  }
  if (isStandalone()) {
    return '';
  }
  return `<a class="btn-secondary" href="${lastPdf.url}" download="${esc(lastPdf.file.name)}" target="_blank" rel="noopener">PDF öffnen</a>`;
}
function dbList() {
  const q = (view.q || '').toLowerCase().trim();
  const list = dbCache.list
    .filter(
      (e) =>
        !q ||
        [e.projekt, e.kunde, e.monteur, e.modell, e.datum, fmtDate(e.datum)]
          .join(' ')
          .toLowerCase()
          .includes(q),
    )
    .sort((a, b) => String(b.datum).localeCompare(String(a.datum)));
  if (!list.length) {
    return `<p class="empty-note">${dbCache.list.length ? 'Keine Treffer. Suchbegriff ändern oder leeren.' : 'Keine Daten. „Aus Datenbank laden“ ruft die Protokollliste ab.'}</p>`;
  }
  const lim = view.lim || 100;
  const shown = list.slice(0, lim);
  const zeilen = shown
    .map((e) => {
      const unter = [e.modell, e.monteur].filter(Boolean).map(esc).join(', ');
      const pdf = e.pdfUrl
        ? `<a class="proto-open" href="${esc(e.pdfUrl)}" target="_blank" rel="noopener">`
        : `<button type="button" class="proto-open" data-act="dbreport" data-key="${esc(e.key)}">`;
      const pdfEnde = e.pdfUrl ? '</a>' : '</button>';
      return `
  <div class="row proto-row">
    ${pdf}
      <span class="row-icon row-icon--blue"><span class="material-symbols-rounded" aria-hidden="true">description</span></span>
      <span class="row-text">
        <span class="row-title">${esc(e.projekt)}${e.kunde ? ', ' + esc(e.kunde) : ''}</span>
        <span class="row-sub numeric">${esc(fmtDate(e.datum))}</span>
        ${unter ? `<span class="row-sub">${unter}</span>` : ''}
        ${e.erfolg ? `<span class="proto-pills">${bewertungBadge(e.erfolg)}</span>` : ''}
      </span>
      <span class="material-symbols-rounded row-chevron" aria-hidden="true">chevron_right</span>
    ${pdfEnde}
    <button type="button" class="icon-btn proto-act" data-act="dbedit" data-key="${esc(e.key)}" aria-label="Protokoll bearbeiten"><span class="material-symbols-rounded" aria-hidden="true">edit</span></button>
  </div>`;
    })
    .join('');
  return `<div class="group">${zeilen}</div>
    ${list.length > lim ? `<button type="button" class="btn-secondary" data-act="dbmore">Weitere anzeigen (${lim} von ${list.length})</button>` : ''}`;
}

/* ---------- Unterschrift ---------- */
function initSig(canvas, p) {
  const key = canvas.dataset.sig;
  const r = canvas.getBoundingClientRect(),
    dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = ctx.fillStyle = '#0b1f3a';
  const src = safeImg(p.sig[key]);
  if (src) {
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, r.width, r.height);
    img.src = src;
  }
  let drawing = false,
    last = null;
  const pt = (e) => {
    const b = canvas.getBoundingClientRect();
    return [e.clientX - b.left, e.clientY - b.top];
  };
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    drawing = true;
    last = pt(e);
    canvas.setPointerCapture(e.pointerId);
    ctx.beginPath();
    ctx.arc(last[0], last[1], 1.1, 0, Math.PI * 2);
    ctx.fill();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    const q = pt(e);
    ctx.beginPath();
    ctx.moveTo(last[0], last[1]);
    ctx.lineTo(q[0], q[1]);
    ctx.stroke();
    last = q;
  });
  const end = () => {
    if (!drawing) return;
    drawing = false;
    const out = document.createElement('canvas');
    out.width = Math.round(r.width);
    out.height = Math.round(r.height);
    out.getContext('2d').drawImage(canvas, 0, 0, out.width, out.height);
    p.sig[key] = out.toDataURL('image/png');
    save();
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
}
const After = {
  wizard() {
    const p = cur();
    if (p && TEMPLATE.pages[p.page].final) {
      document.querySelectorAll('canvas.sig').forEach((c) => initSig(c, p));
    }
  },
};

/* ---------- Google-Sheet-Schnittstelle ---------- */
/* api, syncing, syncCanStart, syncEnd, netRender stehen in shared/sync.js */
/* Übertragene Protokolle werden 7 Tage nach der Übertragung aus der App entfernt (bleiben in der Datenbank) */
const KEEP_SYNCED_DAYS = 7;
function pruneSynced() {
  const now = Date.now(),
    maxAge = KEEP_SYNCED_DAYS * 864e5;
  let changed = false;
  protocols.forEach((p) => {
    if (p.status === 'done' && p.synced === true && !p.syncedAt) {
      p.syncedAt = new Date().toISOString();
      changed = true;
    }
  }); // alte Einträge: Frist startet jetzt
  const keep = protocols.filter(
    (p) =>
      !(
        p.status === 'done' &&
        p.synced === true &&
        p.syncedAt &&
        p.id !== view.id &&
        now - new Date(p.syncedAt).getTime() > maxAge
      ),
  );
  if (keep.length !== protocols.length) {
    protocols = keep;
    changed = true;
  }
  if (changed) save();
}
async function syncAll(silent) {
  const list = protocols.filter((p) => p.status === 'done' && !p.synced);
  if (!syncCanStart(list.length > 0, silent)) return;
  let okCount = 0,
    err = null;
  for (const p of list) {
    try {
      recompute(p);
      await api('upsert', {
        protocol: {
          id: p.id,
          templateId: TEMPLATE.id,
          values: p.values,
          kundeName: p.kundeName || '',
          completedAt: p.completedAt,
          sourceKey: p.sourceKey || '',
          summary: { report: buildReport(p) },
          pdf: await pdfBase64(p, reportOf(p), PDF_OPTS),
        },
        cols: buildCols(p),
      });
      p.synced = true;
      p.syncedAt = new Date().toISOString();
      save();
      okCount++;
    } catch (e) {
      err = e;
      break;
    }
  }
  syncEnd();
  pruneSynced();
  if (err) toast(`Übertragung fehlgeschlagen: ${err.message}`);
  else if (okCount) toast(`${okCount} Protokoll(e) in die Datenbank übertragen.`);
  if (view.name === 'home' || view.name === 'report') render();
  else updateNet();
}

/* Wert aus einer alten Sheet-Zeile in das Eingabeformat der App bringen */
function fromSheet(f, x) {
  if (x == null) return '';
  if (typeof x === 'boolean') x = x ? 'Ja' : 'Nein';
  if (typeof x === 'number' && f.type !== 'calc') return fmtNum(x); // Eingabefelder erwarten Text mit Komma
  x = String(x);
  if (f.type === 'date') {
    const m = x.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  if (f.type === 'okfail') return x === 'Ja' ? 'i.O.' : x === 'Nein' ? 'n.i.O.' : x; // ältere Zeilen: Ja/Nein
  return x;
}

/* ---------- Aktionen ---------- */
/* Prüfpunkt oder Gesamtbewertung: Wahl, Mangel-Feld und Fortschritt an Ort ändern */
function wahlMarkieren(f, p) {
  const zeile = app.querySelector(`[data-item="${f.id}"]`);
  if (!zeile) {
    render();
    return;
  }
  const x = p.values[f.id];
  zeile
    .querySelectorAll('[data-act="set"]')
    .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === x)));
  const offen = x === 'n.i.O.';
  zeile.classList.toggle('has-defect', offen);
  const hinweis = zeile.querySelector('.altwert');
  if (hinweis) {
    hinweis.remove();
  }
  const notiz = zeile.querySelector('.note-input');
  if (notiz) {
    notiz.tabIndex = offen ? 0 : -1;
    if (offen && !notiz.value) {
      setTimeout(() => notiz.focus(), 250);
    }
  }
  const alleOk = $('#allokBtn');
  if (alleOk) {
    alleOk.hidden = !TEMPLATE.pages[p.page].fields.some(
      (g) => g.type === 'okfail' && isVis(g, p.values) && !p.values[g.id],
    );
  }
  setSteps();
}
const Actions = {
  home() {
    go('home');
  },
  settings() {
    openSettings();
  },
  db() {
    go('db', { q: view.q });
  },
  sync() {
    syncAll(false);
  },

  new() {
    const values = {};
    ALL_FIELDS.forEach((f) => {
      values[f.id] = f.init != null ? (typeof f.init === 'function' ? f.init() : f.init) : '';
    });
    const p = {
      id: uid(),
      templateId: TEMPLATE.id,
      values,
      sig: {},
      kundeName: '',
      page: 0,
      status: 'draft',
      createdAt: new Date().toISOString(),
      synced: false,
    };
    recompute(p);
    vorbelegtErfassen(p);
    protocols.unshift(p);
    save();
    go('wizard', { id: p.id });
  },
  resume(d) {
    go('wizard', { id: d.id });
  },
  report(d) {
    go('report', { id: d.id });
  },
  async reopen(d) {
    const p = protocols.find((x) => x.id === d.id);
    const frage =
      'Protokoll wieder öffnen und bearbeiten? Nach erneutem Abschließen wird der Eintrag in der Datenbank aktualisiert.';
    if (!(await confirmModal('Protokoll bearbeiten', frage, 'Bearbeiten', false))) {
      return;
    }
    p.status = 'draft';
    p.synced = false;
    p.page = TEMPLATE.pages.length - 1;
    save();
    go('wizard', { id: p.id });
  },
  async del(d) {
    const p = protocols.find((x) => x.id === d.id);
    const msg = p.synced
      ? 'Protokoll aus der App entfernen? (Es bleibt in der Datenbank erhalten.)'
      : p.status === 'done'
        ? 'ACHTUNG: Dieses Protokoll ist noch NICHT in der Datenbank. Wirklich endgültig löschen?'
        : 'Entwurf löschen?';
    if (!(await confirmModal('Protokoll löschen', msg, 'Löschen', true))) {
      return;
    }
    protocols = protocols.filter((x) => x.id !== d.id);
    save();
    render();
  },

  set(d) {
    const p = cur();
    const gleich = p.values[d.f] === d.v && !isRequired(FIELD[d.f], p);
    p.values[d.f] = gleich ? '' : d.v;
    recompute(p);
    save();
    const art = FIELD[d.f].type;
    if (art === 'okfail' || art === 'bewertung') {
      wahlMarkieren(FIELD[d.f], p);
    } else {
      render();
    }
  },
  allok() {
    const p = cur();
    TEMPLATE.pages[p.page].fields.forEach((f) => {
      if (f.type === 'okfail' && isVis(f, p.values) && !p.values[f.id])
        p.values[f.id] = 'i.O.';
    });
    save();
    render();
  },
  next() {
    const p = cur();
    if (pageErrors(p, p.page).length) {
      view.tried = true;
      render();
      $('#pageerr').textContent = 'Bitte die markierten Felder prüfen.';
      toast('Bitte die markierten Felder prüfen.');
      const first = document.querySelector('.has-error');
      if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    wechsleSeite(() => {
      p.page++;
      save();
      view.tried = false;
    });
  },
  prev() {
    const p = cur();
    if (p.page > 0)
      wechsleSeite(() => {
        p.page--;
        save();
        view.tried = false;
      });
  },
  jump(d) {
    const p = cur(),
      t = Number(d.i);
    if (t === p.page) {
      view.tried = true;
      render();
      window.scrollTo(0, 0);
      return;
    }
    wechsleSeite(() => {
      p.page = t;
      save();
      view.tried = true;
    });
  },
  step(d) {
    const p = cur();
    const t = Number(d.i);
    if (t === p.page) {
      return;
    }
    wechsleSeite(() => {
      p.page = t;
      save();
      view.tried = false;
    });
  },
  dbmore() {
    view.lim = (view.lim || 100) + 100;
    $('#dblist').innerHTML = dbList();
  },
  sigclear(d) {
    const p = cur();
    delete p.sig[d.sig];
    save();
    render();
  },
  finish() {
    const p = cur();
    recompute(p);
    const bad = TEMPLATE.pages.findIndex((pg, k) => pageErrors(p, k).length);
    if (bad >= 0) {
      p.page = bad;
      save();
      view.tried = true;
      render();
      window.scrollTo(0, 0);
      toast(`Bitte „${TEMPLATE.pages[bad].title}“ prüfen.`);
      return;
    }
    if (PFLICHTFELDER && !p.sig.tech) {
      $('#pageerr').textContent = 'Bitte als Monteur unterschreiben.';
      toast('Bitte als Monteur unterschreiben.');
      return;
    }
    p.status = 'done';
    p.completedAt = new Date().toISOString();
    p.synced = false;
    save();
    toast('Protokoll abgeschlossen.');
    go('report', { id: p.id });
    syncAll(true);
  },

  async makepdf(d, btn) {
    if (!window.jspdf || !window.html2canvas) {
      toast('PDF-Modul nicht geladen – App einmal online neu starten.');
      return;
    }
    if (btn && btn.classList.contains('done')) return; // Doppelstart verhindern
    const r = reportForView();
    if (!r) return;
    const name = pdfName(r.id, 'ohne-Protokollnummer') + '.pdf',
      key = viewKey();
    if (pdfBusy) {
      toast(
        pdfBusy !== key
          ? 'Es wird gerade ein anderes PDF erstellt …'
          : 'PDF wird noch erstellt …',
      );
      return;
    } // gleicher Bericht: Doppelstart still verhindern
    const cb = () => $('#bar .pdfb'); // immer der aktuell im DOM befindliche Knopf (die Leiste wird bei Neuzeichnen neu gebaut)
    const setP = (v) => {
      pdfProg = v;
      const f = viewKey() === key ? $('#bar .pdfb .fill') : null;
      if (f) f.style.transform = 'scaleX(' + v + ')';
    };
    pdfBusy = key;
    setP(0.05);
    {
      const b = cb();
      if (b) b.classList.add('run');
    }
    // Fortschritt ist geschätzt (der gemeinsame PDF-Code meldet keinen): nähert sich 92 %, springt bei Fertigstellung auf 100 %
    pdfTick = setInterval(() => setP(pdfProg + (0.92 - pdfProg) * 0.07), 250);
    try {
      const blob = await reportPdfBlob(reportForView(), PDF_OPTS);
      clearInterval(pdfTick);
      setP(1);
      await new Promise((res) => setTimeout(res, RM() ? 0 : 240));
      if (lastPdf) URL.revokeObjectURL(lastPdf.url);
      lastPdf = {
        key,
        file: new File([blob], name, { type: 'application/pdf' }),
        url: URL.createObjectURL(blob),
      };
      pdfBusy = null;
      if (view.name === 'report' && viewKey() === key) {
        const bar = $('#pdfbar');
        if (bar) bar.innerHTML = pdfBarHtml();
        setBar(); // baut Leiste neu auf (mit Teilen-Knopf) -> neuen Knopf in den Fertig-Zustand setzen
        const nb = cb();
        if (nb) {
          nb.classList.remove('run');
          nb.classList.add('done');
          setTimeout(() => nb.classList.remove('done'), 2600);
        }
      }
      toast('PDF fertig – jetzt „Teilen“ antippen.');
    } catch (e) {
      toast('PDF konnte nicht erstellt werden: ' + e.message);
    } finally {
      clearInterval(pdfTick);
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
    } else {
      window.open(lastPdf.url, '_blank');
    }
  },

  async dbload() {
    if (!navigator.onLine) {
      toast('Offline – zeige gespeicherten Stand.');
      return;
    }
    try {
      toast('Lade Daten …');
      const j = await api('list');
      dbCache = { at: new Date().toISOString(), list: j.list };
      LS.set('rlt.db', dbCache);
      toast(`${j.list.length} Einträge geladen.`);
      render();
    } catch (e) {
      toast('Laden fehlgeschlagen: ' + e.message);
    }
  },
  async dbreport(d) {
    if (!navigator.onLine) {
      toast('Zum Öffnen eines Protokolls aus der Datenbank wird Internet benötigt.');
      return;
    }
    try {
      toast('Lade Protokoll …');
      const j = await api('get', { key: d.key });
      go('report', { db: true, rep: j.report, key: d.key, q: view.q });
    } catch (e) {
      toast('Laden fehlgeschlagen: ' + e.message);
    }
  },
  async dbedit(d) {
    if (!navigator.onLine) {
      toast('Zum Laden aus der Datenbank wird Internet benötigt.');
      return;
    }
    try {
      toast('Lade Protokoll …');
      const j = await api('load', { key: d.key });
      const local = j.appId && protocols.find((x) => x.id === j.appId);
      if (
        local &&
        local.status === 'done' &&
        !local.synced &&
        !(await confirmModal(
          'Version aus Datenbank laden',
          'In der App gibt es zu diesem Protokoll noch nicht übertragene Änderungen. Durch die Version aus der Datenbank ersetzen?',
          'Ersetzen',
          true,
        ))
      )
        return;
      if (
        local &&
        local.status === 'draft' &&
        !(await confirmModal(
          'Version aus Datenbank laden',
          'Dieses Protokoll ist hier schon als Entwurf geöffnet. Durch die Version aus der Datenbank ersetzen?',
          'Ersetzen',
          true,
        ))
      )
        return;
      const values = {};
      ALL_FIELDS.forEach((f) => {
        const x = j.values ? j.values[f.id] : f.col ? j.cols[f.col] : '';
        values[f.id] = j.values ? (x == null ? '' : x) : fromSheet(f, x);
      });
      const p = {
        id: j.appId || uid(),
        templateId: TEMPLATE.id,
        values,
        sig: {},
        kundeName: j.kundeName || '',
        sourceKey: d.key,
        page: 0,
        status: 'draft',
        createdAt: new Date().toISOString(),
        synced: false,
      };
      recompute(p);
      protocols = protocols.filter((x) => x.id !== p.id);
      protocols.unshift(p);
      save();
      toast('Geladen – nach dem Bearbeiten neu unterschreiben und abschließen.');
      go('wizard', { id: p.id });
    } catch (e) {
      toast('Laden fehlgeschlagen: ' + e.message);
    }
  },
  async drivepdf() {
    try {
      toast('PDF wird in Google Drive erstellt …');
      const blob = await reportPdfBlob(reportForView(), PDF_OPTS);
      const b64 = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result).split(',')[1]);
        fr.onerror = rej;
        fr.readAsDataURL(blob);
      });
      const j = await api('savepdf', { key: view.key, pdf: b64 });
      const e = dbCache.list.find((x) => x.key === view.key);
      if (e) {
        e.pdfUrl = j.url;
        LS.set('rlt.db', dbCache);
      }
      toast('PDF in Google Drive gespeichert.');
      window.open(j.url, '_blank');
    } catch (e) {
      toast('Fehler: ' + e.message);
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
  forcereload() {
    clearCachesAndReload();
  },

  savesettings(d) {
    settingsSave(SETTINGS_FIELDS, 'rlt.settings');
    if (d !== 'silent') toast('Gespeichert.');
  },
  async ping() {
    Actions.savesettings('silent');
    try {
      await api('ping');
      toast('Verbindung zur Datenbank funktioniert.');
      syncAll(true);
    } catch (e) {
      toast('Verbindung fehlgeschlagen: ' + e.message);
    }
  },
  backup() {
    backupDownload(
      { app: 'rlt-kwl', exportedAt: new Date().toISOString(), protocols },
      `rlt-kwl-backup-${today()}.json`,
    );
  },
};
