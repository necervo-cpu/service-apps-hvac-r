/* shared/settings.js – gemeinsame Hilfen für Einstellungen und Datensicherung
   Enthält: clearCachesAndReload(), settingsSave(fields, storageKey), backupDownload(obj, fileName),
            backupImport(file, listKey, current, label, apply). Die Oberfläche (Einstellungs-Karte, Update-Prüfung) liegt in der jeweiligen App. */

async function clearCachesAndReload(cachePrefix) {
  try {
    if ('caches' in window) {
      const prefix =
        typeof cachePrefix === 'string' && cachePrefix
          ? cachePrefix
          : typeof window.CACHE_PREFIX === 'string' && window.CACHE_PREFIX
            ? window.CACHE_PREFIX
            : '';
      if (prefix) {
        const keys = await caches.keys();
        const targets = prefix === '*' ? keys : keys.filter((k) => k.startsWith(prefix));
        await Promise.all(targets.map((k) => caches.delete(k)));
      }
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
  const u = $('#s_url');
  const t = $('#s_token');
  const fm = $('#s_firma');
  if (u) settings.url = u.value.trim();
  if (t) settings.token = t.value.trim();
  if (fm) settings.firma = fm.value.trim();
  (fields || []).forEach((f) => {
    const el = $('#' + f.id);
    if (el) settings[f.key] = el.value.trim();
  });
  LS.set(storageKey, settings);
}

function backupDownload(obj, fileName) {
  const data = JSON.stringify(obj, null, 1);
  const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function _stripUnsafeKeys(val) {
  if (Array.isArray(val)) return val.map(_stripUnsafeKeys);
  if (!val || typeof val !== 'object') return val;
  const out = {};
  Object.keys(val).forEach((k) => {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') return;
    out[k] = _stripUnsafeKeys(val[k]);
  });
  return out;
}

function backupImport(file, listKey, current, label, apply) {
  if (!file) return;
  const r = new FileReader();
  r.onerror = () => toast('Import fehlgeschlagen: Datei konnte nicht gelesen werden.');
  r.onload = () => {
    try {
      const d = _stripUnsafeKeys(JSON.parse(r.result));
      if (!d || typeof d !== 'object' || !Array.isArray(d[listKey])) {
        throw new Error('Keine gültige Backup-Datei');
      }
      const valid = d[listKey].filter(
        (p) => p && typeof p === 'object' && !Array.isArray(p) && typeof p.id === 'string' && p.id.trim() !== '',
      );
      if (valid.length !== d[listKey].length) {
        throw new Error('Backup enthält ungültige Einträge ohne gültige ID');
      }
      const byId = new Map(current.map((p) => [p.id, p]));
      valid.forEach((p) => byId.set(p.id, p));
      apply([...byId.values()]);
      toast(`Backup importiert: ${valid.length} ${label}.`);
    } catch (err) {
      toast('Import fehlgeschlagen: ' + err.message);
    }
  };
  r.readAsText(file);
}
