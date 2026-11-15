/* shared/settings.js – gemeinsamer Teil der Einstellungsseite, Datensicherung & App-Info/Updates
   Enthält: settingsConnectionHtml, settingsGeneralHtml(fields), settingsButtonsHtml, settingsBackupHtml(text),
            settingsVersionHtml(appVersion, buildDate), checkAppUpdate(appVersion), initUpdateBadge(appVersion),
            settingsSave(fields, storageKey), backupDownload(obj, fileName), backupImport(file, listKey, current, label, apply). */

function settingsConnectionHtml() {
  return `
      <h2>Datenbank-Verbindung</h2>
      <div class="card">
        <label>Web-App-URL (aus Apps Script → Bereitstellen)</label>
        <input id="s_url" value="${esc(settings.url)}" placeholder="https://script.google.com/macros/s/…/exec" autocapitalize="off" autocorrect="off">
        <label style="margin-top:14px">Token (muss mit TOKEN im Apps Script übereinstimmen)</label>
        <input id="s_token" value="${esc(settings.token)}" autocapitalize="off" autocorrect="off">
      </div>`;
}

function settingsGeneralHtml(fields) {
  return (
    `
      <h2>Allgemein</h2>
      <div class="card">
        <label>Firmenkopf im PDF (mehrzeilig möglich)</label><textarea id="s_firma" style="min-height:110px" placeholder="z. B. Firmenname&#10;Straße&#10;PLZ Ort · Telefon">${esc(settings.firma)}</textarea>` +
    fields
      .map(
        (f) => `
        <label style="margin-top:14px">${esc(f.label)}</label><input id="${f.id}" value="${esc(settings[f.key])}" placeholder="${esc(f.placeholder)}">`,
      )
      .join('') +
    `
      </div>`
  );
}

function settingsButtonsHtml() {
  return `
      <div class="row"><button class="btn primary" data-act="savesettings">Speichern</button><button class="btn" data-act="ping">Speichern &amp; Verbindung testen</button></div>`;
}

function settingsBackupHtml(text) {
  return `
      <h2>Datensicherung</h2>
      <div class="card">
        <p class="muted" style="margin-top:0">${text}</p>
        <div class="row">
          <button class="btn" data-act="backup">Backup exportieren</button>
          <label class="btn" style="margin:0;font-size:16px">Backup importieren<input type="file" id="s_import" accept=".json,application/json" hidden></label>
        </div>
      </div>`;
}

function settingsVersionHtml(appVersion, buildDate) {
  return `
      <h2>App-Info &amp; Updates</h2>
      <div class="card">
        <div class="row between" style="margin-bottom:12px">
          <div>
            <div style="font-weight:700">Installierte Version</div>
            <div class="muted" style="font-size:13px">Build-Datum: <span class="numeric">${esc(buildDate || '–')}</span></div>
          </div>
          <span class="status-pill" id="app-version-label"><span class="status-dot"></span><span class="numeric">v${esc(appVersion)}</span></span>
        </div>
        <div class="row">
          <button type="button" class="btn update-check-btn" data-act="checkupdate">
            <span class="material-symbols-rounded" aria-hidden="true">sync</span>
            <span>Nach Updates suchen</span>
          </button>
          <button type="button" class="btn" data-act="forcereload">
            <span class="material-symbols-rounded" aria-hidden="true">system_update</span>
            <span>Cache neu laden</span>
          </button>
        </div>
      </div>`;
}

async function clearCachesAndReload() {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.update().catch(() => {});
        if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    }
  } catch (e) {}
  window.location.reload();
}

async function checkAppUpdate(appVersion) {
  try {
    const res = await fetch('./version.json?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('version.json nicht erreichbar');
    const data = await res.json();
    const remote = String(data.version || '').trim();
    if (remote && remote === appVersion) {
      toast('Aktuellste Version v' + appVersion + ' ist installiert.');
      return;
    }
    toast('Update auf v' + (remote || appVersion) + ' wird geladen …');
    setTimeout(clearCachesAndReload, 700);
  } catch (e) {
    toast('Cache wird aktualisiert …');
    setTimeout(clearCachesAndReload, 700);
  }
}

async function initUpdateBadge(appVersion) {
  try {
    if (!navigator.onLine) return;
    const res = await fetch('./version.json?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    const remote = String(data.version || '').trim();
    if (remote && remote !== appVersion) {
      const dot = document.getElementById('app-update-dot');
      if (dot) dot.classList.add('show');
    }
  } catch (e) {}
}

function settingsSave(fields, storageKey) {
  settings.url = $('#s_url').value.trim();
  settings.token = $('#s_token').value.trim();
  settings.firma = $('#s_firma').value.trim();
  fields.forEach((f) => {
    settings[f.key] = $('#' + f.id).value.trim();
  });
  LS.set(storageKey, settings);
}

function backupDownload(obj, fileName) {
  const data = JSON.stringify(obj, null, 1);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function backupImport(file, listKey, current, label, apply) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!Array.isArray(d[listKey])) throw new Error('Keine gültige Backup-Datei');
      const byId = new Map(current.map((p) => [p.id, p]));
      d[listKey].forEach((p) => byId.set(p.id, p));
      apply([...byId.values()]);
      toast(`Backup importiert: ${d[listKey].length} ${label}.`);
    } catch (err) {
      toast('Import fehlgeschlagen: ' + err.message);
    }
  };
  r.readAsText(file);
}
