// Aktionen: Übertragung (Sync), Prüfpunkt-Wahl und alle data-act-Aktionen.
'use strict';

function pruneSynced() {
  const now = Date.now();
  const maxAge = KEEP_SYNCED_DAYS * 864e5;
  let changed = false;
  protocols.forEach((p) => {
    if (p.status === 'done' && p.synced === true && !p.syncedAt) {
      p.syncedAt = new Date().toISOString();
      changed = true;
    }
  });
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
  if (changed) {
    save();
  }
}
async function syncAll(silent) {
  const list = protocols.filter((p) => p.status === 'done' && !p.synced);
  if (!syncCanStart(list.length > 0, silent)) {
    return;
  }
  let okCount = 0;
  let err = null;
  for (const p of list) {
    try {
      await api('upsert', {
        protocol: {
          id: p.id,
          templateId: TEMPLATE.id,
          values: p.values,
          kundeName: p.kundeName || '',
          completedAt: p.completedAt,
          sig: p.sig,
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
  if (err) {
    toast(`Übertragung fehlgeschlagen: ${err.message}`);
  } else if (okCount) {
    toast(`${okCount} Protokoll(e) in die Datenbank übertragen.`);
  }
  if (view.name === 'home' || view.name === 'report') {
    render();
  } else {
    updateNet();
  }
}

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
      notiz.focus();
    }
  }
  const alleOk = $('#allokBtn');
  if (alleOk) {
    alleOk.hidden = !TEMPLATE.pages[p.page].fields.some(
      (g) => g.type === 'okfail' && aktiv(g, p.values) && !p.values[g.id],
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
  dbmore() {
    view.lim = (view.lim || 100) + 100;
    $('#dblist').innerHTML = dbList();
  },
  sync() {
    syncAll(false);
  },

  new(d) {
    const values = {};
    ALL_FIELDS.forEach((f) => {
      if (f.init == null) {
        values[f.id] = '';
      } else {
        values[f.id] = typeof f.init === 'function' ? f.init() : f.init;
      }
    });
    values.typ = d && d.typ === 'oel' ? 'oel' : 'gas';
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
    let msg = 'Entwurf löschen?';
    if (p.synced) {
      msg = 'Protokoll aus der App entfernen? (Es bleibt in der Datenbank erhalten.)';
    } else if (p.status === 'done') {
      msg =
        'ACHTUNG: Dieses Protokoll ist noch NICHT in der Datenbank. Wirklich endgültig löschen?';
    }
    if (!(await confirmModal('Protokoll löschen', msg, 'Löschen', true))) {
      return;
    }
    protocols = protocols.filter((x) => x.id !== d.id);
    save();
    render();
  },

  set(d) {
    const p = cur();
    const gleich = p.values[d.f] === d.v && !isRequired(FIELD[d.f]);
    p.values[d.f] = gleich ? '' : d.v;
    save();
    const art = FIELD[d.f].type;
    if (art === 'okfail' || art === 'bewertung') {
      wahlMarkieren(FIELD[d.f], p);
    } else {
      render();
    }
  },
  matfree() {
    const feld = $('#matfree');
    const teil = feld ? feld.value.trim() : '';
    if (!teil) {
      toast('Bezeichnung fehlt. Material benennen und erneut hinzufügen.');
      return;
    }
    const liste = materialArray(cur());
    liste.push({ teil, menge: '1' });
    save();
    render();
    materialFeedback(teil, { art: 'neu', i: liste.length - 1, menge: '1' });
  },
  matdel(d) {
    materialArray(cur()).splice(Number(d.i), 1);
    save();
    render();
  },
  allok() {
    const p = cur();
    TEMPLATE.pages[p.page].fields.forEach((f) => {
      if (f.type === 'okfail' && aktiv(f, p.values) && !p.values[f.id]) {
        p.values[f.id] = 'i.O.';
      }
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
      if (first) {
        first.scrollIntoView({ block: 'center' });
      }
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
    if (p.page > 0) {
      wechsleSeite(() => {
        p.page--;
        save();
        view.tried = false;
      });
    }
  },
  jump(d) {
    const p = cur();
    const t = Number(d.i);
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
  sigclear(d) {
    const p = cur();
    delete p.sig[d.sig];
    save();
    render();
  },
  finish() {
    const p = cur();
    const bad = TEMPLATE.pages.findIndex((pg, k) => pageErrors(p, k).length);
    if (bad >= 0) {
      p.page = bad;
      save();
      view.tried = true;
      render();
      window.scrollTo(0, 0);
      toast(`Bitte „${TEMPLATE.pages[bad].title}“ vervollständigen.`);
      return;
    }
    if (PFLICHTFELDER && !p.sig.tech) {
      $('#pageerr').textContent = 'Bitte als Techniker unterschreiben.';
      toast('Bitte als Techniker unterschreiben.');
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
    if (btn && btn.classList.contains('done')) {
      return;
    }
    const r = reportForView();
    if (!r) {
      return;
    }
    const name = pdfName(r.id) + '.pdf';
    const key = viewKey();
    if (pdfBusy) {
      toast(
        pdfBusy !== key
          ? 'Es wird gerade ein anderes PDF erstellt …'
          : 'PDF wird noch erstellt …',
      );
      return;
    }
    const cb = () => $('#bar .pdfb');
    const setP = (v) => {
      pdfProg = v;
      const f = viewKey() === key ? $('#bar .pdfb .fill') : null;
      if (f) {
        f.style.transform = 'scaleX(' + v + ')';
      }
    };
    pdfBusy = key;
    setP(0.05);
    const startKnopf = cb();
    if (startKnopf) {
      startKnopf.classList.add('run');
    }
    pdfTick = setInterval(() => setP(pdfProg + (0.92 - pdfProg) * 0.07), 250);
    try {
      const blob = await reportPdfBlob(reportForView(), PDF_OPTS);
      clearInterval(pdfTick);
      setP(1);
      if (lastPdf) {
        URL.revokeObjectURL(lastPdf.url);
      }
      lastPdf = {
        key,
        file: new File([blob], name, { type: 'application/pdf' }),
        url: URL.createObjectURL(blob),
      };
      pdfBusy = null;
      if (view.name === 'report' && viewKey() === key) {
        const bar = $('#pdfbar');
        if (bar) {
          bar.innerHTML = pdfBarHtml();
        }
        setBar();
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
    if (!lastPdf) {
      return;
    }
    const files = [lastPdf.file];
    if (navigator.canShare && navigator.canShare({ files })) {
      try {
        await navigator.share({ files, title: lastPdf.file.name });
      } catch (e) {
        if (e.name !== 'AbortError') {
          toast('Teilen fehlgeschlagen: ' + e.message);
        }
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
      LS.set(SPEICHER.db, dbCache);
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
      ) {
        return;
      }
      if (
        local &&
        local.status === 'draft' &&
        !(await confirmModal(
          'Version aus Datenbank laden',
          'Dieses Protokoll ist hier schon als Entwurf geöffnet. Durch die Version aus der Datenbank ersetzen?',
          'Ersetzen',
          true,
        ))
      ) {
        return;
      }
      const values = {};
      ALL_FIELDS.forEach((f) => {
        let x = j.values ? j.values[f.id] : f.col && j.cols ? j.cols[f.col] : '';
        if (x == null) {
          x = '';
        }
        if (f.type === 'material') {
          values[f.id] = Array.isArray(x) ? x : [];
          return;
        }
        if (f.type === 'typ') {
          const text = String(x).toLowerCase();
          values[f.id] =
            text === 'gas' || text === 'oel' ? text : /^(öl|oel)/.test(text) ? 'oel' : 'gas';
          return;
        }
        if (typeof x === 'number') {
          x = fmtNum(x);
        }
        if (typeof x === 'boolean') {
          x = x ? 'Ja' : 'Nein';
        }
        values[f.id] = String(x);
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
      const b64 = await blobB64(blob);
      const j = await api('savepdf', { key: view.key, pdf: b64 });
      const e = dbCache.list.find((x) => x.key === view.key);
      if (e) {
        e.pdfUrl = j.url;
        LS.set(SPEICHER.db, dbCache);
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
    settingsSave(SETTINGS_FIELDS, SPEICHER.settings);
    if (d !== 'silent') {
      toast('Gespeichert.');
    }
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
      { app: 'heizung-wartung', exportedAt: new Date().toISOString(), protocols },
      `heizung-wartung-backup-${today()}.json`,
    );
  },
};
