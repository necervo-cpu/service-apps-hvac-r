const APP_VERSION = '3.0.0';
const BUILD_DATE = '2026-11-22';

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

async function clearCachesAndReload() {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith('startseite-') || k.startsWith('workbox-'))
          .map((k) => caches.delete(k)),
      );
    }
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) await reg.update().catch(() => {});
    }
  } catch (e) {}
  window.location.reload();
}

async function checkUpdate(manual) {
  const btn = $('#btnCheckUpdate');
  if (manual && btn) btn.disabled = true;
  try {
    const res = await fetch('./version.json?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const remote = String(data.version || '').trim();
    const newer = isNewerVersion(remote, APP_VERSION);
    const dot = $('#app-update-dot');
    const row = $('#updateRow');
    const remEl = $('#updateRemote');
    const banner = $('#updateBanner');
    const bannerTxt = $('#updateBannerText');
    if (newer) {
      if (dot) dot.hidden = false;
      if (row) row.hidden = false;
      if (remEl) remEl.textContent = 'v' + remote;
      if (bannerTxt) bannerTxt.textContent = `Neue Startseiten-Version v${remote} verfügbar`;
      if (banner) banner.hidden = false;
      if (manual) toast(`Neue Version v${remote} verfügbar.`);
    } else if (manual) {
      toast('Startseite ist auf dem neuesten Stand.');
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
if (btnCheckUpdate) btnCheckUpdate.addEventListener('click', () => checkUpdate(true));
if (btnForceReload) btnForceReload.addEventListener('click', clearCachesAndReload);
if (btnBannerReload) btnBannerReload.addEventListener('click', clearCachesAndReload);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
checkUpdate(false);
