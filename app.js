const APP_VERSION = '3.0.8';
const BUILD_DATE = '2026-11-24';
const VERSIONS_KEY = 'ag-suite-versions';

function normText(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  if (!el) return;
  $('#toastText').textContent = msg;
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), 3500);
}

/* ===== Suche ===== */
const qInput = $('#q');
const qClear = $('#qClear');
const sections = [
  { el: $('#secService'), count: $('#countService') },
  { el: $('#secKalk'), count: $('#countKalk') },
];
const emptyState = $('#emptyState');

function applyFilter() {
  const raw = qInput ? qInput.value.trim() : '';
  const query = normText(raw);
  if (qClear) qClear.hidden = !raw;

  let total = 0;
  sections.forEach((sec) => {
    if (!sec.el) return;
    let visible = 0;
    sec.el.querySelectorAll('a.row').forEach((row) => {
      const hay = normText((row.dataset.search || '') + ' ' + row.textContent);
      const hit = !query || hay.includes(query);
      row.hidden = !hit;
      if (hit) visible++;
    });
    if (sec.count) sec.count.textContent = String(visible);
    sec.el.hidden = visible === 0;
    total += visible;
  });
  if (emptyState) emptyState.hidden = total > 0;
}

if (qInput) qInput.addEventListener('input', applyFilter);
if (qClear) {
  qClear.addEventListener('click', () => {
    qInput.value = '';
    applyFilter();
    qInput.focus();
  });
}

/* ===== Darstellung ===== */
const systemLight = window.matchMedia('(prefers-color-scheme: light)');
function getSavedTheme() {
  try {
    const v = localStorage.getItem('ag-theme');
    return v === 'light' || v === 'dark' ? v : null;
  } catch (e) {
    return null;
  }
}

function syncThemeSegment() {
  const choice = getSavedTheme() || 'system';
  document
    .querySelectorAll('[data-theme-choice]')
    .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeChoice === choice)));
  const color = document.documentElement.getAttribute('data-theme') === 'light' ? '#F8FAFC' : '#000000';
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', color));
}

function setThemeChoice(choice) {
  try {
    if (choice === 'system') localStorage.removeItem('ag-theme');
    else localStorage.setItem('ag-theme', choice);
  } catch (e) {}
  const effective = choice === 'system' ? (systemLight.matches ? 'light' : 'dark') : choice;
  document.documentElement.setAttribute('data-theme', effective);
  const btn = $('#themeToggleBtn');
  if (btn) {
    const isDark = effective !== 'light';
    btn.innerHTML = `<span class="material-symbols-rounded" aria-hidden="true">${isDark ? 'light_mode' : 'dark_mode'}</span>`;
    const label = isDark ? 'Hellmodus aktivieren' : 'Dunkelmodus aktivieren';
    btn.title = label;
    btn.setAttribute('aria-label', label);
  }
  syncThemeSegment();
}

document.querySelectorAll('[data-theme-choice]').forEach((b) => {
  b.addEventListener('click', () => setThemeChoice(b.dataset.themeChoice));
});
new MutationObserver(syncThemeSegment).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['data-theme'],
});
syncThemeSegment();

/* ===== Einstellungs-Modal ===== */
const modalHost = $('#modalHost');
let lastFocus = null;

function openModal() {
  if (!modalHost) return;
  lastFocus = document.activeElement;
  syncThemeSegment();
  modalHost.classList.add('is-open');
  const closeBtn = $('#modalCloseBtn');
  if (closeBtn) closeBtn.focus();
}

function closeModal() {
  if (!modalHost) return;
  modalHost.classList.remove('is-open');
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}

const btnSet = $('#btnset');
const btnClose = $('#modalCloseBtn');
if (btnSet) btnSet.addEventListener('click', openModal);
if (btnClose) btnClose.addEventListener('click', closeModal);
if (modalHost) {
  modalHost.addEventListener('click', (e) => {
    if (e.target === modalHost) closeModal();
  });
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalHost && modalHost.classList.contains('is-open')) closeModal();
});

/* ===== Updates & Cache ===== */
function isNewerVersion(remote, local) {
  const a = String(remote || '').split('.').map(Number);
  const b = String(local || '').split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0;
    const y = b[i] || 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

function readSavedVersions() {
  try {
    const raw = localStorage.getItem(VERSIONS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (e) {
    return null;
  }
}

function writeSavedVersions(map) {
  if (!map || typeof map !== 'object') return;
  try {
    localStorage.setItem(VERSIONS_KEY, JSON.stringify(map));
  } catch (e) {}
}

function renderTileVersions(map) {
  if (!map || typeof map !== 'object') return;
  document.querySelectorAll('[data-app-version]').forEach((el) => {
    const path = el.dataset.appVersion;
    const ver = map[path];
    el.textContent = ver ? 'v' + ver : '';
  });
}

let pendingVersionsMap = null;
let lastRemoteVersionsMap = null;
let updateInFlight = false;

async function updateAllApps() {
  if (updateInFlight) return;
  if (navigator.onLine === false) {
    toast('Offline – Aktualisierung nicht möglich.');
    return;
  }
  updateInFlight = true;
  const btn = $('#btnBannerReload');
  const btnLabel = $('#btnBannerReloadLabel');
  const btnForce = $('#btnForceReload');
  const bannerTxt = $('#updateBannerText');
  const bannerSub = $('#updateBannerSub');
  if (btn) btn.disabled = true;
  if (btnForce) btnForce.disabled = true;
  if (btnLabel) btnLabel.textContent = 'Aktualisiere…';
  if (bannerTxt) bannerTxt.textContent = 'Aktualisiere Apps…';
  if (bannerSub) bannerSub.textContent = 'Service Worker und Caches werden aktualisiert…';

  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker.getRegistrations) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        regs.map(async (reg) => {
          try {
            await reg.update();
          } catch (e) {}
          if (reg.waiting) {
            try {
              reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            } catch (e) {}
          }
        }),
      );
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    if (pendingVersionsMap) {
      writeSavedVersions(pendingVersionsMap);
    } else if (lastRemoteVersionsMap) {
      writeSavedVersions(lastRemoteVersionsMap);
    }
  } catch (e) {}
  window.location.reload();
}

async function checkSuiteUpdates(manual) {
  if (updateInFlight) return;
  const btn = $('#btnCheckUpdate');
  if (manual && btn) btn.disabled = true;
  try {
    const res = await fetch('./versions.json?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const list = Array.isArray(data.apps) ? data.apps : [];
    const remoteMap = {};
    list.forEach((item) => {
      if (item && item.path && item.version) {
        remoteMap[String(item.path)] = String(item.version).trim();
      }
    });
    lastRemoteVersionsMap = remoteMap;
    renderTileVersions(remoteMap);

    let saved = readSavedVersions();
    const firstVisit = saved === null;
    if (firstVisit) {
      writeSavedVersions(remoteMap);
      saved = remoteMap;
    }

    const changed = list.filter((item) => {
      if (!item || !item.path || !item.version) return false;
      const ver = String(item.version).trim();
      if (item.path === './' && isNewerVersion(ver, APP_VERSION)) return true;
      if (firstVisit) return false;
      return !saved[item.path] || saved[item.path] !== ver;
    });

    const dot = $('#app-update-dot');
    const row = $('#updateRow');
    const remEl = $('#updateRemote');
    const banner = $('#updateBanner');
    const bannerTxt = $('#updateBannerText');
    const bannerSub = $('#updateBannerSub');
    const btnLabel = $('#btnBannerReloadLabel');

    if (changed.length > 0) {
      pendingVersionsMap = remoteMap;
      const preview = changed
        .slice(0, 3)
        .map((a) => `${a.name} v${a.version}`)
        .join(', ');
      const suffix = changed.length > 3 ? ` … und ${changed.length - 3} weitere` : '';
      if (dot) dot.hidden = false;
      if (row) row.hidden = false;
      if (remEl) {
        remEl.textContent =
          remoteMap['./'] && isNewerVersion(remoteMap['./'], APP_VERSION)
            ? 'v' + remoteMap['./']
            : `${changed.length} ${changed.length === 1 ? 'App' : 'Apps'}`;
      }
      if (bannerTxt) bannerTxt.textContent = `Updates verfügbar (${preview}${suffix})`;
      if (bannerSub) {
        bannerSub.textContent = 'Mit einem Klick werden alle Apps auf den neuesten Stand gebracht.';
      }
      if (btnLabel) btnLabel.textContent = 'Alle aktualisieren';
      if (banner) banner.hidden = false;
      if (manual) toast(`Updates verfügbar (${changed.length} Apps).`);
    } else {
      pendingVersionsMap = null;
      if (dot) dot.hidden = true;
      if (row) row.hidden = true;
      if (banner) banner.hidden = true;
      if (manual) toast('Alle Apps sind auf dem neuesten Stand.');
    }
  } catch (e) {
    if (manual) toast('Update-Prüfung fehlgeschlagen (offline?).');
  } finally {
    if (manual && btn) btn.disabled = false;
  }
}

const btnCheckUpdate = $('#btnCheckUpdate');
const btnForceReload = $('#btnForceReload');
const btnBannerReload = $('#btnBannerReload');
if (btnCheckUpdate) btnCheckUpdate.addEventListener('click', () => checkSuiteUpdates(true));
if (btnForceReload) btnForceReload.addEventListener('click', updateAllApps);
if (btnBannerReload) btnBannerReload.addEventListener('click', updateAllApps);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
renderTileVersions(readSavedVersions());
checkSuiteUpdates(false);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') checkSuiteUpdates(false);
});
window.addEventListener('online', () => checkSuiteUpdates(false));
