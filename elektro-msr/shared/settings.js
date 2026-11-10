/* shared/settings.js – gemeinsamer Teil der Einstellungsseite und der Datensicherung
   Inhalt: settingsConnectionHtml, settingsGeneralHtml(fields), settingsButtonsHtml, settingsBackupHtml(text),
           settingsSave(fields, storageKey), backupDownload(obj, fileName), backupImport(file, listKey, current, label, apply).
   Benötigt aus der App: globale `settings`; esc, toast, $, LS aus core.js; Beschriftungen/Zusatzfelder kommen als Daten
   aus der App (SETTINGS_FIELDS: Array von {id, key, label, placeholder}).
   Laden: vor dem App-Skript, nach core.js und sync.js (klassisches Skript, kein Modul). */

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
          <label class="btn" style="margin:0;font-size:17px">Backup importieren<input type="file" id="s_import" accept=".json,application/json" hidden></label>
        </div>
      </div>`;
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
