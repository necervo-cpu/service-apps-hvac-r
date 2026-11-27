// Aktionen: Google-Sheet-Schnittstelle, Übertragung, alle data-act-Aktionen.
'use strict';

/* ---------- Google-Sheet-Schnittstelle ---------- */
async function api(action, data) {
  if (!settings.url) throw new Error('Keine Web-App-URL in den Einstellungen.');
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 30000) : null;
  let res;
  try {
    res = await fetch(settings.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // "simple request" → kein CORS-Preflight
      body: JSON.stringify(Object.assign({ token: settings.token, action }, data || {})),
      signal: ctrl ? ctrl.signal : undefined,
    });
  } catch (e) {
    if (e && e.name === 'AbortError') {
      throw new Error('Zeitüberschreitung beim Übertragen (30 s) – bitte Verbindung prüfen.');
    }
    throw e;
  } finally {
    if (timer) clearTimeout(timer);
  }
  let j;
  try {
    j = await res.json();
  } catch (e) {
    throw new Error('Unerwartete Antwort – ist die Web-App für „Jeder“ freigegeben?');
  }
  if (!j.ok) throw new Error(j.error || 'Unbekannter Fehler');
  return j;
}
let syncing = false;
async function syncAll(silent) {
  if (syncing) return;
  const list = calcs.filter((p) => p.status === 'done' && !p.synced);
  if (!list.length) {
    if (!silent) toast('Alles ist bereits in der Datenbank.');
    return;
  }
  if (!settings.url) {
    if (!silent) toast('Bitte zuerst die Web-App-URL in den Einstellungen eintragen.');
    return;
  }
  if (!navigator.onLine) {
    if (!silent) toast('Offline – wird automatisch übertragen, sobald Internet da ist.');
    return;
  }
  syncing = true;
  let okCount = 0;
  const failed = [];
  let netErr = null;
  try {
    for (const p of list) {
      try {
        const pdf = await pdfBase64(p);
        if (window.jspdf && window.html2canvas && !pdf) {
          throw new Error('PDF konnte nicht erzeugt werden');
        }
        await api('upsert', {
          protocol: {
            id: p.id,
            templateId: C.id,
            values: p.values,
            manual: p.manual || {},
            stamm: p.stamm,
            completedAt: p.completedAt,
            sourceKey: p.sourceKey || '',
            summary: { report: buildReport(p) },
            pdf,
          },
          cols: buildCols(p),
        });
        p.synced = true;
        p.syncedAt = new Date().toISOString();
        if (save()) okCount++;
      } catch (e) {
        const msg = (e && e.message) || 'Unbekannter Fehler';
        failed.push(msg);
        if (!navigator.onLine || (e && (e.name === 'TypeError' || /Zeitüberschreitung/.test(msg)))) {
          netErr = e;
          break;
        }
      }
    }
  } finally {
    syncing = false;
  }
  if (netErr) toast(`Übertragung unterbrochen (${okCount} übertragen): ${netErr.message}`);
  else if (failed.length) toast(`${okCount} übertragen, ${failed.length} fehlgeschlagen: ${failed[0]}`);
  else if (okCount) toast(`${okCount} Kalkulation(en) in die Datenbank übertragen.`);
  if (view.name === 'home' || view.name === 'report') render();
  else updateNet();
}

/* ---------- Aktionen ---------- */
function newCalc(values, stamm) {
  const p = {
    id: uid(),
    templateId: C.id,
    values,
    manual: {},
    stamm: stamm || stammNow(),
    page: 0,
    status: 'draft',
    createdAt: new Date().toISOString(),
    synced: false,
  };
  applyAutos(p);
  calcs.unshift(p);
  save();
  return p;
}
const Actions = {
  home() {
    go('home');
  },
  settings() {
    openSettings();
  },
  fragen() {
    go('fragen');
  },
  info() {
    go('info');
  },
  db() {
    go('db', { q: view.q });
  },
  sync() {
    syncAll(false);
  },

  new() {
    const values = Object.fromEntries(FIELDS.map((f) => [f.id, '']));
    values.datum = today();
    values.bearbeiter = settings.techniker || '';
    values.pauschal = 'Nein';
    go('wizard', { id: newCalc(values).id });
  },
  copy(d) {
    const src = calcs.find((x) => x.id === d.id);
    const values = Object.assign({}, src.values, {
      projekt: '',
      datum: today(),
      bearbeiter: settings.techniker || src.values.bearbeiter || '',
    });
    const p = newCalc(values);
    p.manual = Object.assign({}, src.manual || {});
    save();
    toast('Kopie angelegt – bitte Projektnummer und Kunde anpassen.');
    go('wizard', { id: p.id });
  },
  resume(d) {
    go('wizard', { id: d.id });
  },
  report(d) {
    go('report', { id: d.id });
  },
  async reopen(d) {
    const p = calcs.find((x) => x.id === d.id);
    if (
      p.synced &&
      !(await confirmModal(
        'Bestätigen',
        'Kalkulation wieder öffnen und bearbeiten? Nach erneutem Abschließen wird der Eintrag in der Datenbank aktualisiert.',
        'Fortsetzen',
        true,
      ))
    )
      return;
    p.status = 'draft';
    p.synced = false;
    p.page = PAGES.length - 1;
    save();
    go('wizard', { id: p.id });
  },
  async del(d) {
    const p = calcs.find((x) => x.id === d.id);
    const msg = p.synced
      ? 'Kalkulation aus der App entfernen? (Sie bleibt in der Datenbank erhalten.)'
      : p.status === 'done'
        ? 'ACHTUNG: Diese Kalkulation ist noch NICHT in der Datenbank. Wirklich endgültig löschen?'
        : 'Entwurf löschen?';
    if (!(await confirmModal('Bestätigen', msg, 'Fortsetzen', true))) return;
    calcs = calcs.filter((x) => x.id !== d.id);
    save();
    render();
  },

  set(d) {
    const p = cur();
    p.values[d.f] = p.values[d.f] === d.v ? '' : d.v; // erneutes Tippen wählt ab
    if (d.f === 'herm') p.manual.herm = true;
    if (d.f === 'pauschal' && !p.values.pauschal) p.values.pauschal = 'Nein';
    applyAutos(p);
    save();
    render();
  },
  step(d) {
    const p = cur();
    if (!p) return;
    const id = d.f;
    const basis = isN(p.values[id]) ? num(p.values[id]) : n0(d.base);
    const neu = Math.max(0, round(basis + Number(d.dir) * Number(d.step), 2));
    p.values[id] = neu > 0 ? fmtNum(neu) : '';
    if ((POSBY[id] && POSBY[id].auto) || id === 'gwp') p.manual[id] = true;
    applyAutos(p);
    save();
    const feld = $('#in-' + id);
    if (feld) feld.value = p.values[id];
    live();
  },
  unauto(d) {
    const p = cur();
    delete p.manual[d.f];
    applyAutos(p);
    save();
    render();
  },
  stammapply() {
    const p = cur();
    p.stamm = stammNow();
    applyAutos(p);
    save();
    render();
    toast('Aktuelle Stammdaten übernommen.');
  },
  next() {
    const p = cur();
    if (p.page < PAGES.length - 1)
      wechsleSeite(() => {
        p.page++;
        save();
      });
  },
  prev() {
    const p = cur();
    if (p.page > 0)
      wechsleSeite(() => {
        p.page--;
        save();
      });
  },
  jump(d) {
    const p = cur(),
      t = Number(d.i);
    if (t === p.page) {
      render();
      window.scrollTo(0, 0);
      return;
    }
    wechsleSeite(() => {
      p.page = t;
      save();
    });
  },
  finish() {
    const p = cur();
    applyAutos(p);
    p.status = 'done';
    p.completedAt = new Date().toISOString();
    p.synced = false;
    save();
    toast('Kalkulation abgeschlossen.');
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
    const name = pdfName(r.id) + '.pdf',
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
      LS.set(K('db'), dbCache);
      toast(`${j.list.length} Einträge geladen.`);
      render();
    } catch (e) {
      toast('Laden fehlgeschlagen: ' + e.message);
    }
  },
  async dbreport(d) {
    if (!navigator.onLine) {
      toast('Zum Öffnen einer Kalkulation aus der Datenbank wird Internet benötigt.');
      return;
    }
    try {
      toast('Lade Kalkulation …');
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
      toast('Lade Kalkulation …');
      const j = await api('load', { key: d.key });
      const local = j.appId && calcs.find((x) => x.id === j.appId);
      if (
        local &&
        local.status === 'done' &&
        !local.synced &&
        !(await confirmModal(
          'Bestätigen',
          'In der App gibt es zu dieser Kalkulation noch nicht übertragene Änderungen. Durch die Version aus der Datenbank ersetzen?',
          'Fortsetzen',
          true,
        ))
      )
        return;
      if (
        local &&
        local.status === 'draft' &&
        !(await confirmModal(
          'Bestätigen',
          'Diese Kalkulation ist hier schon als Entwurf geöffnet. Durch die Version aus der Datenbank ersetzen?',
          'Fortsetzen',
          true,
        ))
      )
        return;
      const values = {};
      FIELDS.forEach((f) => {
        let x = j.values ? j.values[f.id] : j.cols[f.col];
        if (x == null) x = '';
        if (typeof x === 'number') x = fmtNum(x);
        values[f.id] = String(x);
      });
      if (j.values)
        POS.forEach((x) => {
          if (j.values[x.id] != null) values[x.id] = String(j.values[x.id]);
        });
      const p = {
        id: j.appId || uid(),
        templateId: C.id,
        values,
        manual:
          j.manual || Object.fromEntries(POS.filter((x) => x.auto).map((x) => [x.id, true])),
        stamm: Object.assign(stammNow(), j.stamm || {}),
        sourceKey: d.key,
        page: 0,
        status: 'draft',
        createdAt: new Date().toISOString(),
        synced: false,
      };
      if (!j.values) p.manual.gwp = true;
      calcs = calcs.filter((x) => x.id !== p.id);
      calcs.unshift(p);
      save();
      toast('Geladen – nach dem Bearbeiten erneut abschließen.');
      go('wizard', { id: p.id });
    } catch (e) {
      toast('Laden fehlgeschlagen: ' + e.message);
    }
  },
  async drivepdf() {
    try {
      toast('PDF wird in Google Drive erstellt …');
      const blob = await reportPdfBlob(reportForView());
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
        LS.set(K('db'), dbCache);
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
    settings.url = $('#s_url').value.trim();
    settings.token = $('#s_token').value.trim();
    settings.firma = $('#s_firma').value.trim();
    settings.techniker = $('#s_tech').value.trim();
    LS.set(K('settings'), settings);
    if (d !== 'silent') toast('Gespeichert.');
  },
  async ping() {
    Actions.savesettings('silent');
    try {
      await api('ping');
      toast('Verbindung zur Datenbank funktioniert.');
      await loadStamm(true);
      renderSettings();
      syncAll(true);
    } catch (e) {
      toast('Verbindung fehlgeschlagen: ' + e.message);
    }
  },
  async stammload() {
    if (await loadStamm(false)) renderSettings();
  },
  async stammsave(d, btn) {
    const err = $('#stammerr'),
      values = {},
      bad = [];
    document.querySelectorAll('[data-stamm]').forEach((el) => {
      const s = C.stamm.find((x) => x.key === el.dataset.stamm),
        raw = el.value.trim();
      const rahmen = el.closest('.vwrap, .field-box') || el;
      rahmen.style.borderColor = '';
      if (typeof s.def === 'number') {
        if (!isN(raw) || num(raw) < 0) {
          bad.push(s.label);
          rahmen.style.borderColor = 'var(--color-destructive)';
          return;
        }
        values[s.key] = { value: num(raw), label: s.label, unit: s.unit };
      } else if (raw) values[s.key] = { value: raw, label: s.label, unit: s.unit };
    });
    if (bad.length) {
      err.textContent = 'Bitte eine gültige Zahl eintragen: ' + bad.join(', ');
      return;
    }
    err.textContent = '';
    if (!settings.url) {
      toast('Bitte zuerst die Web-App-URL eintragen und speichern.');
      return;
    }
    if (!navigator.onLine) {
      toast('Offline – Stammdaten können nur mit Internet gespeichert werden.');
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Wird gespeichert …';
    try {
      const j = await api('setstamm', { values });
      stammCache = { at: new Date().toISOString(), values: j.values || {} };
      LS.set(K('stamm'), stammCache);
      toast('Stammdaten in der Datenbank gespeichert.');
      renderSettings();
    } catch (e) {
      toast('Speichern fehlgeschlagen: ' + e.message);
      btn.disabled = false;
      btn.textContent = 'In Datenbank speichern';
    }
  },
  backup() {
    const data = JSON.stringify(
      { app: C.id, exportedAt: new Date().toISOString(), calcs },
      null,
      1,
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    a.download = `${C.id}-backup-${today()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  },
};
