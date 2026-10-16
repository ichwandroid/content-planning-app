/**
 * ui/shell.js — Kerangka aplikasi: navigasi, topbar, statistik, status sinkronisasi.
 * Modul ini "mendengarkan" store dan memperbarui bagian global; isi halaman
 * ditangani masing-masing file di js/views/.
 */

import { ANALYTICS, APP, DB, DB_READY, PILARS, PLATFORMS, STATUSES } from '../core/config.js';
import { fmtCompact, fmtDateTime, fmtDecimal, fmtNumber, fmtPercent } from '../core/format.js';
import { $, $$, append, el, svgIcon } from '../core/util.js';
import * as anim from '../lib/anim.js';
import { sparkline } from '../lib/charts.js';
import { timeline } from '../analytics/metrics.js';

import * as store from '../data/store.js';
import { icon, toastError, toastSuccess, toastWarn } from './components.js';

const NAV_ICONS = {
  planner: 'grid',
  calendar: 'calendar',
  analytics: 'chart',
  cta: 'megaphone',
  settings: 'settings',
};

/* ------------------------------- SIDEBAR ------------------------------- */

export function iconifyNav() {
  $$('.nav__icon').forEach((node) => {
    node.innerHTML = svgIcon(NAV_ICONS[node.closest('[data-view]')?.dataset.view] || 'dot', 19);
  });
  $('#btn-refresh')?.append(icon('refresh'));
  $('#btn-new')?.prepend(icon('plus', 17, 'btn__icon'));
  $('#btn-sidebar')?.append(icon('list'));
  $('#drawer-close')?.append(icon('close'));
  $('#modal-close')?.append(icon('close'));
  $$('.seg-btn').forEach((b) => {
    const map = { grid: 'grid', list: 'list', board: 'filter' };
    append(b, icon(map[b.dataset.layout] || 'grid', 16));
  });
  $('.search__icon')?.append(icon('search', 17));
  $('#app-version').textContent = APP.version;
}

export function setActiveNav(view) {
  $$('.nav__item').forEach((a) => a.classList.toggle('is-active', a.dataset.view === view));
  $$('.view').forEach((v) => v.classList.toggle('is-hidden', v.id !== `view-${view}`));
  if (window.innerWidth <= 820) $('#sidebar')?.classList.remove('is-open');
}

/* ------------------------------ MODE BADGE ----------------------------- */

export function renderConnectionStatus() {
  const badge = $('#mode-badge');
  const dot = $('#sync-dot');
  const text = $('#sync-text');
  const src = $('#sb-source');
  const pending = $('#sb-pending');
  const demo = !DB_READY.hasSheet;

  badge?.classList.toggle('is-hidden', !demo);
  if (badge && demo) badge.title = 'Data disimpan di browser (localStorage). Isi SPREADSHEET_ID di js/core/config.js untuk memakai Google Sheet.';

  const sourceLabels = {
    'gviz-jsonp': 'Google Sheet (gviz)',
    'apps-script': 'Google Sheet (Apps Script)',
    'gviz-csv': 'Google Sheet (CSV)',
    demo: 'Mode Demo — data contoh',
    lokal: 'Data lokal browser',
    'cache-lokal': 'Cache lokal (offline)',
    none: 'Tidak terhubung',
    manual: 'Impor manual',
  };

  const state = store.state;
  const label = sourceLabels[state.source] || state.source;
  const ok = ['gviz-jsonp', 'apps-script', 'gviz-csv'].includes(state.source);
  dot?.classList.remove('is-ok', 'is-warn', 'is-error');
  dot?.classList.add(state.status === 'error' ? 'is-error' : ok ? 'is-ok' : 'is-warn');

  if (text) {
    text.textContent = state.status === 'loading'
      ? 'Memuat…'
      : state.status === 'error'
        ? 'Gagal memuat'
        : `${label}${state.rows.length ? ` • ${fmtNumber(state.rows.length)} baris` : ''}`;
  }
  if (src) src.innerHTML = `<strong>${label}</strong><br><span class="muted">${state.lastSync ? fmtDateTime(state.lastSync) : 'belum pernah'}</span>`;
  const pend = store.pendingCount();
  if (pending) {
    pending.innerHTML = pend
      ? `<span class="warn-text">${pend} perubahan menunggu dikirim</span>`
      : '<span class="ok-text">Semua perubahan terkirim ✓</span>';
  }
  $('#btn-flush').disabled = !pend;
  return { label, ok };
}

/* ------------------------------ STATISTIK ------------------------------ */

const TONE_ICON_MOD = {
  teal: '',          // default — no modifier
  gold: '--gold',
  blue: '--info',
  purple: '--violet',
  cyan: '--info',
  rose: '--danger',
};

// Warna sparkline per tone
const TONE_SPARK_COLOR = {
  teal: '#0F766E', gold: '#D97706', blue: '#0284C7',
  purple: '#7C3AED', cyan: '#0891B2', rose: '#E11D48',
};

export function renderStats() {
  const grid = $('#stats-grid');
  if (!grid) return;
  const s = store.stats();
  const allRows = store.state.rows;
  const bench = Math.round((Object.values(ANALYTICS.benchmarkER).reduce((a, b) => a + b, 0) / Object.keys(ANALYTICS.benchmarkER).length) * 10) / 10;
  const erTone = s.avgER >= bench ? 'var(--ok)' : 'var(--warn)';

  // Data sparkline: jumlah konten per tanggal (7 titik terakhir dari semua konten)
  const sparkData = (() => {
    try {
      const tl = timeline(allRows, { granularity: 'day', metric: 'reach' });
      return tl.slice(-7).map((d) => d.count);
    } catch { return []; }
  })();

  const cards = [
    { label: 'Total Konten',   value: s.total,      icon: 'grid',  tone: 'teal',   sub: `${s.tayang} tayang • ${s.upcoming} terjadwal`, countup: true },
    { label: 'Terjadwal/Siap', value: s.upcoming,   icon: 'clock', tone: 'gold',   sub: `${s.ide} masih ide/draf`,  countup: true },
    { label: 'Total Jangkauan',value: s.totalReach,  icon: 'eye',   tone: 'blue',   sub: 'akumulasi views', countup: true, compact: true },
    { label: 'Rata-rata ER',   value: s.avgER,       icon: 'chart', tone: 'purple', sub: `benchmark ±${fmtPercent(bench)}`, decimals: 2, suffix: '%', toneText: erTone },
    { label: 'Klik Link',      value: s.klik,        icon: 'link',  tone: 'cyan',   sub: `${fmtCompact(s.totalEngage)} interaksi`, countup: true, compact: true },
    { label: 'Pendaftar',      value: s.pendaftar,   icon: 'users', tone: 'rose',   sub: 'dari konten PPDB', countup: true },
  ];

  grid.innerHTML = '';
  cards.forEach((c) => {
    const card = el('article', { class: `stat-card stat-card--${c.tone}` });

    // — Baris atas: ikon + label
    const head = el('div', { class: 'stat-card__head' });
    const ic = el('span', { class: `stat-card__icon${TONE_ICON_MOD[c.tone] ? ` stat-card__icon${TONE_ICON_MOD[c.tone]}` : ''}` });
    ic.innerHTML = svgIcon(c.icon, 18);
    append(head, ic, el('span', { class: 'stat-card__label', text: c.label }));

    // — Nilai utama
    const val = el('strong', { class: 'stat-card__value' });
    if (c.countup) {
      val.dataset.countup = String(c.value);
      val.dataset.compact = c.compact ? 'true' : 'false';
      val.textContent = '0';
    } else {
      val.textContent = `${fmtDecimal(c.value)}${c.suffix || ''}`;
    }
    if (c.toneText) val.style.color = c.toneText;

    // — Baris bawah: sub-teks + sparkline
    const foot = el('div', { class: 'stat-card__foot' });
    append(foot, el('span', { class: 'stat-card__sub', text: c.sub }));
    if (sparkData.length >= 2) {
      const sparkWrap = el('span', { class: 'stat-card__spark' });
      sparkWrap.append(sparkline(sparkData, { width: 72, height: 28, color: TONE_SPARK_COLOR[c.tone] || '#0F766E' }));
      foot.append(sparkWrap);
    }

    append(card, head, val, foot);
    append(grid, card);
  });

  anim.countUpAll(grid);
}

/* ------------------------------- TOOLBAR ------------------------------- */

export function renderToolbar() {
  const grid = $('#planner-grid');
  if (grid) grid.dataset.layout = store.state.layout;
  $$('.seg-btn').forEach((b) => b.classList.toggle('is-active', b.dataset.layout === store.state.layout));
  const count = $('#result-count');
  if (count) {
    const n = store.filteredRows().length;
    count.textContent = `${fmtNumber(n)} konten ditampilkan`;
  }
  const sel = store.state.selected.length;
  const bar = $('#bulk-bar');
  bar?.classList.toggle('is-hidden', sel === 0);
  if (sel) $('#bulk-count').textContent = `${sel} konten dipilih`;
}

export function renderFilterBar() {
  const specs = {
    platform: Object.entries(PLATFORMS).map(([id, p]) => ({ value: id, label: p.label })),
    status: Object.entries(STATUSES).map(([id, p]) => ({ value: id, label: p.label })),
    pilar: PILARS.map((p) => ({ value: p.id, label: `${p.emoji} ${p.label}` })),
    pic: store.pics().map((p) => ({ value: p, label: p })),
  };
  Object.entries(specs).forEach(([key, options]) => {
    const host = $(`[data-chips="${key}"]`);
    if (!host) return;
    host.innerHTML = '';
    const active = store.state.filters[key] || [];
    options.forEach((o) => {
      const chip = el('button', {
        class: `filter-chip ${active.includes(o.value) ? 'is-active' : ''}`,
        type: 'button',
        onclick: () => { store.toggleFilterValue(key, o.value); },
      }, [o.label]);
      append(host, chip);
    });
    if (!options.length) append(host, el('span', { class: 'muted small', text: '—' }));
  });
}

/* ------------------------- RITME PRODUKSI (SIDEBAR) -------------------- */

export function renderSidebarCard() {
  const rows = store.state.rows;
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  const week = rows.filter((r) => {
    const d = new Date(r.tanggal);
    return d >= start && d < end;
  });
  const target = 3;
  $('#sb-week').textContent = String(week.length);
  const pct = Math.min(100, (week.length / target) * 100);
  const fill = $('#sb-progress');
  if (fill) {
    fill.style.setProperty('--w', `${pct}%`);
    fill.style.background = pct >= 100 ? 'linear-gradient(90deg,#10B981,#0F766E)' : 'linear-gradient(90deg,#E0B944,#C9A227)';
  }
  $('#sb-target').textContent = week.length >= target
    ? `Target tercapai 🎉 (${week.length}/${target})`
    : `Target: ${target} konten / minggu — kurang ${target - week.length}`;
}

/* -------------------------- WIRING EVENT GLOBAL ------------------------ */

export function bindShell({ onSearch, onRefresh, onNew, onLayout, onFlush, onView }) {
  $$('.nav__item').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const view = a.dataset.view;
      location.hash = view;
      onView?.(view);
    });
  });

  const search = $('#global-search');
  let t;
  search?.addEventListener('input', (e) => {
    clearTimeout(t);
    const value = e.target.value;
    t = setTimeout(() => onSearch?.(value), 220);
  });

  document.addEventListener('keydown', (e) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '');
    if (e.key === '/' && !typing) {
      e.preventDefault();
      search?.focus();
    }
    if (e.key === 'n' && !typing && !e.ctrlKey && !e.metaKey) onNew?.();
    if (e.key === 'Escape') $('#sidebar')?.classList.remove('is-open');
  });

  $('#btn-refresh')?.addEventListener('click', () => onRefresh?.());
  $('#btn-new')?.addEventListener('click', () => onNew?.());
  $('#btn-sidebar')?.addEventListener('click', () => {
    const sb = $('#sidebar');
    const open = sb.classList.toggle('is-open');
    $('#btn-sidebar').setAttribute('aria-expanded', String(open));
  });
  $('#btn-filters')?.addEventListener('click', () => {
    const bar = $('#filter-bar');
    const hidden = bar.hasAttribute('hidden');
    if (hidden) bar.removeAttribute('hidden');
    bar.classList.toggle('is-collapsed', !hidden);
    $('#btn-filters').setAttribute('aria-expanded', String(hidden));
    if (hidden) anim.animateListRows(bar, '.filter-chip');
  });
  $('#btn-reset-filter')?.addEventListener('click', () => {
    store.resetFilters();
    $('#global-search').value = '';
  });
  $$('.seg-btn').forEach((b) => b.addEventListener('click', () => onLayout?.(b.dataset.layout)));
  $('#btn-flush')?.addEventListener('click', () => onFlush?.());
  $('#filter-sort')?.addEventListener('change', (e) => store.setSort(e.target.value));
  $('#filter-range')?.addEventListener('change', (e) => store.setFilter('range', e.target.value));

  $$('[data-bulk-status]').forEach((b) => b.addEventListener('click', async () => {
    const ids = [...store.state.selected];
    if (!ids.length) return;
    await store.bulkStatus(ids, b.dataset.bulkStatus);
    store.clearSelection();
    toastSuccess(`${ids.length} konten diperbarui.`);
  }));

  $('#btn-clear-selection')?.addEventListener('click', () => store.clearSelection());
  $('#btn-bulk-delete')?.addEventListener('click', async () => {
    const ids = [...store.state.selected];
    if (!ids.length) return;
    await store.bulkRemove(ids);
    store.clearSelection();
    toastSuccess(`${ids.length} konten dihapus.`);
  });
}
