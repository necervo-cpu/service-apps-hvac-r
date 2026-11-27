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
  const analytics = $('#suiteAnalytics');
  if (analytics) analytics.hidden = !!query;
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
const THEME_COLORS = { dark: '#0B0C0E', light: '#F2F2F7' };

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
  const color = document.documentElement.getAttribute('data-theme') === 'light' ? THEME_COLORS.light : THEME_COLORS.dark;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', color));
}

function setThemeChoice(choice) {
  try {
    if (choice === 'system') localStorage.removeItem('ag-theme');
    else localStorage.setItem('ag-theme', choice);
  } catch (e) {}
  /* 'system' = Standard der Suite (Dunkel); kein automatisches Umschalten per prefers-color-scheme. */
  const effective = choice === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', effective);
  const btn = $('#themeToggleBtn');
  if (btn) {
    const isDark = effective !== 'light';
    const icon = document.createElement('span');
    icon.className = 'material-symbols-rounded';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = isDark ? 'light_mode' : 'dark_mode';
    btn.replaceChildren(icon);
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

/* ===== Suite-Aktivität & Normen-Abdeckung (interaktives SVG, nur DOM-APIs) ===== */
(function initSuiteAnalytics() {
  const svg = $('#suiteChart');
  if (!svg) return;
  const NS = 'http://www.w3.org/2000/svg';
  /* Richtwerte je Modul (Normen-Abdeckung in %); Reihenfolge wie in der Navigation. */
  const DATA = [
    { label: 'Anlagenlogbuch', short: 'Logbuch', value: 62 },
    { label: 'Wärmepumpen-Wartung', short: 'WP', value: 68 },
    { label: 'Heizungswartung', short: 'Heizung', value: 66 },
    { label: 'Klima-/Kälte-Wartung', short: 'Klima', value: 74 },
    { label: 'RLT- & KWL-Wartung', short: 'RLT', value: 79 },
    { label: 'Split-Klima Inbetriebnahme', short: 'IBN', value: 76 },
    { label: 'Kalkulation Klima', short: 'Kalk. K', value: 84 },
    { label: 'Kalkulation Wärmepumpe', short: 'Kalk. WP', value: 88 },
    { label: 'Daikin-Auslegung', short: 'Daikin', value: 91 },
    { label: 'HVAC-R Rechner', short: 'Rechner', value: 95 },
  ];
  const W = 600;
  const H = 180;
  const PAD = { l: 30, r: 30, t: 12, b: 26 };
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const xAt = (i) => PAD.l + (plotW * i) / (DATA.length - 1);
  const yAt = (v) => PAD.t + plotH * (1 - v / 100);

  const make = (tag, attrs, text) => {
    const n = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach((k) => n.setAttribute(k, attrs[k]));
    if (text != null) n.textContent = text;
    return n;
  };

  /* Hilfslinien + Achsenbeschriftung */
  const grid = $('#suiteGrid');
  [0, 50, 100].forEach((v) => {
    grid.appendChild(make('line', { x1: PAD.l, x2: W - PAD.r, y1: yAt(v), y2: yAt(v), class: 'suite-gridline' }));
    grid.appendChild(make('text', { x: PAD.l - 6, y: yAt(v) + 3, 'text-anchor': 'end', class: 'suite-axis' }, v + ''));
  });
  DATA.forEach((d, i) => {
    grid.appendChild(make('text', { x: xAt(i), y: H - 8, 'text-anchor': 'middle', class: 'suite-axis' }, d.short));
  });

  /* Glatte Bézier-Kurve (horizontale Kontrollpunkte, ohne Überschwingen) */
  let line = 'M' + xAt(0) + ',' + yAt(DATA[0].value);
  for (let i = 1; i < DATA.length; i++) {
    const mx = (xAt(i - 1) + xAt(i)) / 2;
    line += ` C${mx},${yAt(DATA[i - 1].value)} ${mx},${yAt(DATA[i].value)} ${xAt(i)},${yAt(DATA[i].value)}`;
  }
  $('#suiteLine').setAttribute('d', line);
  $('#suiteArea').setAttribute('d', `${line} L${xAt(DATA.length - 1)},${yAt(0)} L${xAt(0)},${yAt(0)} Z`);

  /* Kennzahlen */
  const avg = Math.round(DATA.reduce((s, d) => s + d.value, 0) / DATA.length);
  const kpiAvg = $('#suiteKpiAvg');
  if (kpiAvg) kpiAvg.textContent = avg + ' %';

  /* Cursor, Punkt und Tooltip */
  const cursor = $('#suiteCursor');
  const guide = make('line', { class: 'suite-guide', y1: PAD.t, y2: yAt(0) });
  const dot = make('circle', { class: 'suite-dot', r: 5 });
  cursor.append(guide, dot);
  const tip = $('#suiteTip');
  const wrap = svg.parentElement;
  let active = DATA.length - 1;

  function show(i, withTip) {
    active = Math.max(0, Math.min(DATA.length - 1, i));
    const d = DATA[active];
    guide.setAttribute('x1', xAt(active));
    guide.setAttribute('x2', xAt(active));
    dot.setAttribute('cx', xAt(active));
    dot.setAttribute('cy', yAt(d.value));
    const kpi = $('#suiteKpiActive');
    if (kpi) kpi.textContent = d.value + ' %';
    const kpiLabel = $('#suiteKpiActiveLabel');
    if (kpiLabel) kpiLabel.textContent = d.label;
    svg.setAttribute('aria-valuenow', String(d.value));
    svg.setAttribute('aria-valuetext', d.label + ': ' + d.value + ' Prozent');
    if (!tip) return;
    tip.hidden = !withTip;
    if (!withTip) return;
    $('#suiteTipLabel').textContent = d.label;
    $('#suiteTipValue').textContent = d.value + ' %';
    const scale = wrap.clientWidth / W;
    const half = tip.offsetWidth / 2;
    const left = Math.max(half, Math.min(wrap.clientWidth - half, xAt(active) * scale));
    tip.style.left = left + 'px';
    tip.style.top = Math.max(0, yAt(d.value) * scale - tip.offsetHeight - 12) + 'px';
  }

  function indexAt(clientX) {
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    return Math.round(((x - PAD.l) / plotW) * (DATA.length - 1));
  }

  svg.addEventListener('pointermove', (e) => show(indexAt(e.clientX), true));
  svg.addEventListener('pointerdown', (e) => show(indexAt(e.clientX), true));
  svg.addEventListener('pointerleave', () => show(active, false));
  svg.addEventListener('pointercancel', () => show(active, false));
  svg.addEventListener('blur', () => show(active, false));
  svg.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    show(active + (e.key === 'ArrowRight' ? 1 : -1), true);
  });
  show(active, false);
})();
