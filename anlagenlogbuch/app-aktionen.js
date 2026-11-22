// Aktionen: PDF-Erzeugung, Google-Sheet-Schnittstelle, Ereignisse und Bedienung.
'use strict';

/* ---------- PDF-Erzeugung (offline, ohne Druckdialog – iOS druckt in Home-Bildschirm-Apps nicht) ---------- */
let lastPdf = null; // {key, file, url}
const viewKey = () => (view.db ? 'db:' + view.key : 'loc:' + view.id);
function pdfBarHtml() {
  if (!lastPdf || lastPdf.key !== viewKey()) {
    return '';
  }
  // „Öffnen“ nur im normalen Browser – in der Home-Bildschirm-App gäbe es keinen Weg zurück
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
        [e.projekt, e.kunde, e.ort, e.anlage, e.sn, e.last, fmtDate(e.last)]
          .join(' ')
          .toLowerCase()
          .includes(q),
    )
    // „Nach Fälligkeit“: überfällige zuerst, Anlagen ohne Termin ans Ende
    .sort(
      view.sort === 'due'
        ? (a, b) =>
            (/^\d{4}-/.test(a.next) ? a.next : '9999').localeCompare(
              /^\d{4}-/.test(b.next) ? b.next : '9999',
            )
        : (a, b) => String(b.last).localeCompare(String(a.last)),
    );
  if (!list.length) {
    return `<p class="empty-note">${dbCache.list.length ? 'Keine Treffer. Suchbegriff ändern oder leeren.' : 'Keine Daten. „Aus Datenbank laden“ ruft die Logbuchliste ab.'}</p>`;
  }
  const zeilen = list
    .map((e) => {
      const dd = dueState(e.next);
      const unter = esc([e.anlage, e.sn && 'S/N ' + e.sn, e.ort].filter(Boolean).join(', '));
      const pills =
        (e.n ? chip('neutral', e.n + (Number(e.n) === 1 ? ' Eintrag' : ' Einträge')) : '') +
        (e.next ? nextChips({ next: e.next }) : '') +
        (e.erg === 'nicht erfüllt' ? chip('red', 'nicht erfüllt') : '');
      const pdf = e.pdfUrl
        ? `<a class="icon-btn proto-act" href="${esc(e.pdfUrl)}" target="_blank" rel="noopener" aria-label="PDF öffnen"><span class="material-symbols-rounded" aria-hidden="true">picture_as_pdf</span></a>`
        : `<button type="button" class="icon-btn proto-act" data-act="dbreport" data-key="${esc(e.key)}" aria-label="PDF ansehen"><span class="material-symbols-rounded" aria-hidden="true">picture_as_pdf</span></button>`;
      return `
  <div class="row proto-row">
    <button type="button" class="proto-open" data-act="dbopen" data-key="${esc(e.key)}">
      <span class="row-icon row-icon--${dd ? TON[dd.cls] : 'blue'}"><span class="material-symbols-rounded" aria-hidden="true">menu_book</span></span>
      <span class="row-text">
        <span class="row-title">${esc(e.projekt)}</span>
        ${e.kunde ? `<span class="row-sub">${esc(e.kunde)}</span>` : ''}
        ${unter ? `<span class="row-sub">${unter}</span>` : ''}
        ${e.next && dd ? `<span class="row-sub numeric">${esc(nextSub({ next: e.next }))}</span>` : ''}
        ${pills ? `<span class="proto-pills">${pills}</span>` : ''}
      </span>
    </button>
    <button type="button" class="icon-btn proto-act" data-act="dbopen" data-key="${esc(e.key)}" data-then="entry" aria-label="Neuen Eintrag anlegen"><span class="material-symbols-rounded" aria-hidden="true">add</span></button>
    ${pdf}
  </div>`;
    })
    .join('');
  return `<div class="group">${zeilen}</div>`;
}

/* ---------- Google-Sheet-Schnittstelle ---------- */
const plainEntry = (e) => ({ id: e.id, values: e.values, completedAt: e.completedAt || '' });
/* Übertragene Protokolle werden 7 Tage nach der Übertragung aus der App entfernt (bleiben in der Datenbank) */
const KEEP_SYNCED_DAYS = 7;
function pruneSynced() {
  const now = Date.now(),
    maxAge = KEEP_SYNCED_DAYS * 864e5;
  let changed = false;
  books.forEach((p) => {
    if (p.status === 'done' && p.synced === true && !p.syncedAt) {
      p.syncedAt = new Date().toISOString();
      changed = true;
    }
  }); // alte Einträge: Frist startet jetzt
  // nie löschen: Logbuch mit angefangenem/geöffnetem Eintrag oder noch nicht übertragener Unterschrift-Löschung
  const busy = (p) =>
    (p.entries || []).some((e) => e.status !== 'done') || (p.sigDel || []).length > 0;
  const keep = books.filter(
    (p) =>
      !(
        p.status === 'done' &&
        p.synced === true &&
        p.syncedAt &&
        p.id !== view.id &&
        !busy(p) &&
        now - new Date(p.syncedAt).getTime() > maxAge
      ),
  );
  if (keep.length !== books.length) {
    books = keep;
    changed = true;
  }
  if (changed) save();
}
async function syncAll(silent) {
  if (
    !syncCanStart(
      books.some((p) => p.status === 'done' && !p.synced),
      silent,
    )
  )
    return;
  let okCount = 0,
    err = null;
  for (let pass = 0; pass < 2 && !err; pass++) {
    for (const p of books.filter((x) => x.status === 'done' && !x.synced)) {
      try {
        recompute(p, STAMM);
        const es = doneEntries(p);
        es.forEach((e) => recompute(e, EINTRAG, p.values));
        // Unterschriften: nur neue/geänderte Bilder hochladen; „have“ = Bilder, die dieses Gerät schon hat
        const sigs = {},
          have = [];
        [['book', p], ...es.map((e) => [e.id, e])].forEach(([owner, o]) =>
          Object.keys(o.sig || {}).forEach((k) => {
            if (!safeImg(o.sig[k])) return;
            have.push(owner + '.' + k);
            if (!(o.sigF || {})[k]) sigs[owner + '.' + k] = o.sig[k];
          }),
        );
        const j = await api('upsert', {
          protocol: {
            id: p.id,
            templateId: STAMM.id,
            values: p.values,
            entries: es.map(plainEntry),
            deleted: p.deleted || [],
            kundeName: betrText(p.values),
            completedAt: p.completedAt,
            sourceKey: p.sourceKey || '',
            pdf: await pdfBase64(p),
            sigs,
            sigDel: p.sigDel || [],
            sigHave: have,
          },
          cols: buildCols(STAMM, p.values).concat(summaryCols(p)),
          ecols: Object.fromEntries(es.map((e) => [e.id, buildCols(EINTRAG, e.values)])),
        });
        p.synced = true;
        p.syncedAt = new Date().toISOString();
        p.sourceKey = '';
        // Einträge, die inzwischen von einem anderen iPad dazugekommen sind, übernehmen → PDF & Sheet im 2. Durchgang aktualisieren
        const known = new Set(p.entries.map((e) => e.id)),
          del = new Set(j.deleted || []);
        p.deleted = j.deleted || [];
        p.entries = p.entries.filter((e) => e.status === 'draft' || !del.has(e.id));
        const extra = (j.entries || []).filter((e) => !known.has(e.id) && !del.has(e.id));
        if (extra.length) {
          extra.forEach((e) => p.entries.push(Object.assign({ page: 0, status: 'done' }, e)));
          p.synced = false;
        }
        applySigs(p, j.sigFiles, j.sigData);
        p.sigDel = [];
        save();
        okCount++;
      } catch (e) {
        err = e;
        break;
      }
    }
  }
  syncEnd();
  pruneSynced();
  if (err) toast(`Übertragung fehlgeschlagen: ${err.message}`);
  else if (okCount)
    toast('Logbuch in die Datenbank übertragen, PDF in Google Drive abgelegt.');
  if (['home', 'book', 'report'].includes(view.name)) render();
  else updateNet();
}

/* Wert aus einer alten Sheet-Zeile in das Eingabeformat der App bringen */
function fromSheet(f, x) {
  if (x == null) return '';
  if (typeof x === 'boolean') x = x ? 'Ja' : 'Nein';
  if (typeof x === 'number') return fmtNum(x); // Eingabefelder erwarten Text mit Komma
  x = String(x);
  if (f.type === 'date' || f.input === 'date') {
    const m = x.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return x;
}
/* Werte aus Sheet-Spalten übernehmen; abweichende Werte in Auto-Feldern gelten als „von Hand“ */
function valuesFromCols(tpl, cols, L) {
  const v = {};
  tpl.all.forEach((f) => {
    v[f.id] = fromSheet(f, cols[f.col]);
  });
  tpl.all
    .filter((f) => f.type === 'auto')
    .forEach((f) => {
      const auto = f.calc(v, L || v) || '';
      if (v[f.id] !== '' && String(v[f.id]) !== String(auto)) v['_m_' + f.id] = true;
      else v[f.id] = auto;
    });
  return v;
}
function initValues(tpl) {
  const v = {};
  tpl.all.forEach((f) => {
    v[f.id] = f.init != null ? (typeof f.init === 'function' ? f.init() || '' : f.init) : '';
  });
  return v;
}

/* ---------- Aktionen ---------- */
const Actions = {
  home() {
    go('home');
  },
  settings() {
    openSettings();
  },
  db() {
    go('db', { q: view.q, sort: view.sort });
  },
  dbsort(d) {
    view.sort = d.v;
    render();
  },
  sync() {
    syncAll(false);
  },
  openbook(d) {
    go('book', { id: d.id || view.id });
  },
  pause() {
    const p = book();
    go(p && p.status === 'done' ? 'book' : 'home', { id: view.id });
  },

  newbook() {
    const p = {
      id: uid(),
      templateId: STAMM.id,
      values: initValues(STAMM),
      entries: [],
      deleted: [],
      page: 0,
      status: 'draft',
      createdAt: new Date().toISOString(),
      synced: false,
    };
    recompute(p, STAMM);
    vorbelegtErfassen(p);
    books.unshift(p);
    save();
    go('wizard', { id: p.id });
  },
  async newentry(d) {
    const p = book(d.id);
    if (p.status !== 'done') {
      toast('Bitte zuerst die Anlagendaten abschließen.');
      return;
    }
    const draft = p.entries.find((e) => e.status === 'draft');
    if (
      draft &&
      (await confirmModal(
        'Entwurf fortsetzen',
        'Es gibt schon einen angefangenen Eintrag. Diesen fortsetzen?',
        'Fortsetzen',
      ))
    ) {
      go('wizard', { id: p.id, eid: draft.id });
      return;
    }
    const e = {
      id: uid(),
      values: initValues(EINTRAG),
      page: 0,
      status: 'draft',
      createdAt: new Date().toISOString(),
    };
    e.values.km = p.values.km || '';
    recompute(e, EINTRAG, p.values);
    vorbelegtErfassen(e);
    p.entries.push(e);
    save();
    go('wizard', { id: p.id, eid: e.id });
  },
  resume(d) {
    go('wizard', { id: d.id, eid: d.eid });
  },
  report(d) {
    go('report', { id: d.id });
  },
  editstamm(d) {
    const p = book(d.id);
    p.status = 'draft';
    p.synced = false;
    p.page = 0;
    save();
    go('wizard', { id: p.id });
  },
  editentry(d) {
    const e = book(d.id).entries.find((x) => x.id === d.eid);
    e.status = 'draft';
    e.page = 0;
    save();
    go('wizard', { id: d.id, eid: d.eid });
  },
  async delentry(d) {
    const p = book(d.id),
      e = p.entries.find((x) => x.id === d.eid);
    if (
      !(await confirmModal(
        'Eintrag löschen',
        e.status === 'draft' && !e.completedAt
          ? 'Angefangenen Eintrag verwerfen?'
          : 'Diesen Eintrag aus dem Logbuch löschen? Er wird beim Übertragen auch in der Datenbank entfernt.',
        'Löschen',
        true,
      ))
    )
      return;
    p.entries = p.entries.filter((x) => x.id !== d.eid);
    if (e.completedAt) {
      p.deleted = (p.deleted || []).concat(e.id);
      p.synced = false;
    }
    save();
    render();
    if (e.completedAt) syncAll(true);
  },
  async delbook(d) {
    const p = book(d.id);
    const msg = p.synced
      ? 'Logbuch aus der App entfernen? (Es bleibt in der Datenbank erhalten und kann jederzeit wieder geladen werden.)'
      : p.status === 'done'
        ? 'ACHTUNG: Änderungen an diesem Logbuch sind noch NICHT in der Datenbank. Wirklich aus der App entfernen?'
        : 'Angefangenes Logbuch verwerfen?';
    if (!(await confirmModal('Logbuch entfernen', msg, 'Entfernen', true))) return;
    books = books.filter((x) => x.id !== d.id);
    save();
    go('home');
  },

  set(d) {
    const c = ctx();
    c.obj.values[d.f] = c.obj.values[d.f] === d.v ? '' : d.v; // erneutes Tippen wählt wieder ab
    recompute(c.obj, c.tpl, c.L);
    save();
    render();
  },
  sigclear(d) {
    const c = ctx(),
      o = c.obj;
    if (o.sig) delete o.sig[d.sig];
    // schon in Google Drive → dort beim nächsten Übertragen löschen
    if (o.sigF && o.sigF[d.sig]) {
      c.p.sigDel = (c.p.sigDel || []).concat(sigOwner() + '.' + d.sig);
      delete o.sigF[d.sig];
    }
    save();
    render();
  },
  allyes() {
    const c = ctx();
    c.tpl.pages[c.obj.page].fields.forEach((f) => {
      if (f.allYes && !c.obj.values[f.id]) c.obj.values[f.id] = 'Ja';
    });
    save();
    render();
  },
  copybetr() {
    const c = ctx(),
      v = c.obj.values;
    [
      ['aFirma', 'bFirma'],
      ['aName', 'bName'],
      ['aStr', 'bStr'],
      ['aPlz', 'bPlz'],
      ['aOrt', 'bOrt'],
    ].forEach(([a, b]) => {
      v[a] = v[b] || '';
    });
    save();
    render();
  },
  next() {
    const c = ctx();
    if (pageErrors(c, c.obj.page).length) {
      view.tried = true;
      render();
      $('#pageerr').textContent = 'Bitte die markierten Felder prüfen.';
      toast('Bitte die markierten Felder prüfen.');
      const first = document.querySelector('.has-error');
      if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    wechsleSeite(() => {
      c.obj.page++;
      save();
      view.tried = false;
    });
  },
  prev() {
    const c = ctx();
    if (c.obj.page > 0)
      wechsleSeite(() => {
        c.obj.page--;
        save();
        view.tried = false;
      });
  },
  jump(d) {
    const c = ctx(),
      t = Number(d.i);
    if (t === c.obj.page) {
      view.tried = true;
      render();
      window.scrollTo(0, 0);
      return;
    }
    wechsleSeite(() => {
      c.obj.page = t;
      save();
      view.tried = true;
    });
  },
  step(d) {
    const c = ctx();
    const t = Number(d.i);
    if (t === c.obj.page) {
      return;
    }
    wechsleSeite(() => {
      c.obj.page = t;
      save();
      view.tried = false;
    });
  },
  finish() {
    const c = ctx();
    recompute(c.obj, c.tpl, c.L);
    const bad = c.tpl.pages.findIndex((pg, k) => pageErrors(c, k).length);
    if (bad >= 0) {
      c.obj.page = bad;
      save();
      view.tried = true;
      render();
      window.scrollTo(0, 0);
      toast(`Bitte „${c.tpl.pages[bad].title}“ prüfen.`);
      return;
    }
    c.obj.status = 'done';
    c.obj.completedAt = new Date().toISOString();
    if (!view.eid)
      c.p.entries.forEach((e) => {
        if (e.status === 'done') recompute(e, EINTRAG, c.p.values);
      }); // z. B. neues Prüfintervall
    c.p.synced = false;
    save();
    const wasEntry = !!view.eid;
    go('book', { id: c.p.id });
    toast(wasEntry ? 'Eintrag gespeichert.' : 'Logbuch gespeichert.');
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
    const name = pdfName(r.id, 'ohne-Logbuchnummer') + '.pdf',
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
      const blob = await reportPdfBlob(r);
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
      LS.set('alb.db', dbCache);
      toast(`${j.list.length} Logbücher geladen.`);
      render();
    } catch (e) {
      toast('Laden fehlgeschlagen: ' + e.message);
    }
  },
  async dbreport(d) {
    if (!navigator.onLine) {
      toast('Zum Öffnen eines Logbuchs aus der Datenbank wird Internet benötigt.');
      return;
    }
    try {
      toast('Lade Logbuch …');
      const j = await api('get', { key: d.key });
      go('report', { db: true, rep: j.report, key: d.key, q: view.q });
    } catch (e) {
      toast('Laden fehlgeschlagen: ' + e.message);
    }
  },
  /* Logbuch aus dem Sheet aufs iPad holen (von jedem iPad aus), danach optional gleich neuen Eintrag beginnen */
  async dbopen(d) {
    if (!navigator.onLine) {
      toast('Zum Laden aus der Datenbank wird Internet benötigt.');
      return;
    }
    try {
      toast('Lade Logbuch …');
      const j = await api('load', { key: d.key });
      const local = j.appId && book(j.appId);
      if (
        local &&
        !local.synced &&
        !(await confirmModal(
          'Version aus Datenbank laden',
          'In der App gibt es zu diesem Logbuch noch nicht übertragene Änderungen. Durch die Version aus der Datenbank ersetzen?',
          'Ersetzen',
          true,
        ))
      )
        return;
      let p;
      if (j.values) {
        p = {
          id: j.appId,
          templateId: STAMM.id,
          values: j.values,
          deleted: j.deleted || [],
          sourceKey: '',
          entries: (j.entries || []).map((e) =>
            Object.assign({ page: 0, status: 'done' }, e),
          ),
        };
        applySigs(p, j.sigFiles, j.sigData);
      } else {
        // alte / von Hand angelegte Zeile ohne App-Daten
        const values = valuesFromCols(STAMM, j.cols);
        p = {
          id: uid(),
          templateId: STAMM.id,
          values,
          deleted: [],
          sourceKey: d.key,
          entries: (j.ecols || []).map((ec) => ({
            id: uid(),
            values: valuesFromCols(EINTRAG, ec, values),
            page: 0,
            status: 'done',
            completedAt: new Date().toISOString(),
          })),
        };
      }
      // angefangene Einträge dieses iPads behalten
      if (local)
        local.entries.filter((e) => e.status === 'draft').forEach((e) => p.entries.push(e));
      Object.assign(p, {
        page: 0,
        status: 'done',
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        synced: !!j.values,
      });
      books = books.filter((x) => x.id !== p.id);
      books.unshift(p);
      save();
      toast('Logbuch geladen.');
      go('book', { id: p.id });
      if (d.then === 'entry') Actions.newentry({ id: p.id });
    } catch (e) {
      toast('Laden fehlgeschlagen: ' + e.message);
    }
  },
  async drivepdf() {
    try {
      toast('PDF wird in Google Drive erstellt …');
      const b64 = await blobB64(await reportPdfBlob(reportForView()));
      const j = await api('savepdf', { key: view.key, pdf: b64 });
      const e = dbCache.list.find((x) => x.key === view.key);
      if (e) {
        e.pdfUrl = j.url;
        LS.set('alb.db', dbCache);
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
    settingsSave(SETTINGS_FIELDS, 'alb.settings');
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
      { app: 'anlagenlogbuch', exportedAt: new Date().toISOString(), books },
      `anlagenlogbuch-backup-${today()}.json`,
    );
  },
};

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
  if (el.matches && el.matches('.value-input, .glass-input') && el.type !== 'date') {
    setTimeout(() => {
      try {
        el.select();
      } catch (err) {}
    }, 0);
  }
};
app.addEventListener('focusin', markiereWert);
app.addEventListener('click', markiereWert);
app.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.f && view.name === 'wizard') {
    const c = ctx();
    const f = c.tpl.F[el.dataset.f];
    const v = c.obj.values;
    v[f.id] = el.value;
    if (f.type === 'auto') {
      v['_m_' + f.id] = el.value !== '';
    }
    recompute(c.obj, c.tpl, c.L);
    save();
    setHeader(false);
    if (f.type === 'auto') {
      calcTouch(f.id, el.value, el, true);
    }
    // abhängige Auto-Felder dieser Seite live nachführen (nicht das Feld, in dem gerade getippt wird)
    c.tpl.pages[c.obj.page].fields
      .filter((a) => a.type === 'auto')
      .forEach((a) => {
        const ie = $('#in-' + a.id);
        const ne = $('#note-' + a.id);
        if (ie && ie !== el) {
          ie.value = v[a.id] || '';
          calcTouch(a.id, ie.value, ie);
        }
        if (ne) {
          ne.textContent = autoNote(a, c);
          ne.classList.toggle('is-manual', !!v['_m_' + a.id]);
        }
      });
    setSteps();
  } else if (el.id === 'dbsearch') {
    view.q = el.value;
    $('#dblist').innerHTML = dbList();
  }
});
document.addEventListener('change', async (e) => {
  const el = e.target;
  if (el.dataset && el.dataset.f && view.name === 'wizard') {
    const c = ctx();
    const f = c.tpl.F[el.dataset.f];
    if (f.type === 'auto' && el.value === '') {
      el.value = c.obj.values[f.id] || '';
    } // geleert → automatischer Wert erscheint
  } else if (el.id === 's_import' && el.files[0]) {
    backupImport(el.files[0], 'books', books, 'Logbücher', (list) => {
      books = list;
      save();
    });
  }
});
let lastW = window.innerWidth;
window.addEventListener('resize', () => {
  // Drehen des Geräts: Unterschriftsfelder neu aufbauen
  if (window.innerWidth !== lastW && document.querySelector('canvas.sig')) {
    render();
  }
  lastW = window.innerWidth;
});
window.addEventListener('online', () => {
  updateNet();
  syncAll(true);
});
window.addEventListener('offline', updateNet);
