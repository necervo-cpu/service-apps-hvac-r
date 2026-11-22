/* shared/settings.js – gemeinsame Hilfen für Einstellungen und Datensicherung
   Enthält: clearCachesAndReload(), settingsSave(fields, storageKey), backupDownload(obj, fileName),
            backupImport(file, listKey, current, label, apply). Die Oberfläche (Einstellungs-Karte, Update-Prüfung) liegt in der jeweiligen App. */

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
