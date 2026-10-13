/**
 * main.js — Titik masuk aplikasi.
 * Mengatur: pemuatan data, routing hash, render tiap halaman, animasi GSAP,
 * dan semua event global.
 */

import { APP, DB, DB_READY, PILARS, PLATFORMS, SCHOOL_PROFILE, STATUSES } from './core/config.js';
import { $, $$, debounce, el, prefersReducedMotion, store as ls } from './core/util.js';
import * as anim from './lib/anim.js';

import * as store from './data/store.js';
import { hasWriteBackend } from './data/sheet.js';

import {
  bindShell, iconifyNav, renderConnectionStatus, renderFilterBar, renderSidebarCard, renderStats,
  renderToolbar, setActiveNav,
} from './ui/shell.js';
import {
  confirmDialog, closeDrawerShell, emptyState, icon, openModal, panel, toast, toastError,
  toastSuccess, toastWarn,
} from './ui/components.js';

import { bindPlanner, exportCsv, openIdeasModal, renderPlanner, renderSkeleton } from './views/planner.js';
import { bindCalendar, renderCalendar, setCursor } from './views/calendar.js';
import { bindAnalytics, renderAnalytics } from './views/analytics.js';
import { bindCta, renderCta } from './views/cta.js';
import { bindSettings, renderSettings } from './views/settings.js';
import {
  confirmCloseIfDirty, duplicateContent, openAnalysis, openEdit, openNew, openPreview, save,
} from './views/editor.js';

const VIEWS = ['planner', 'calendar', 'analytics', 'cta', 'settings'];
let currentView = 'planner';
let booted = false;

/* ------------------------------- BOOTSTRAP ----------------------------- */

async function boot() {
  iconifyNav();
  bindShellEvents();
  bindPlanner();
  bindCalendar();
  renderSkeleton();

  const storedView = ls.get('view', 'planner');
  const hash = (location.hash || '').replace('#', '');
  // ?view=analytics memaksa halaman tertentu — berguna untuk tangkapan layar & demo.
  const forced = new URLSearchParams(location.search).get('view');
  currentView = VIEWS.includes(hash) ? hash : VIEWS.includes(forced) ? forced : (VIEWS.includes(storedView) ? storedView : 'planner');
  if (VIEWS.includes(forced)) history.replaceState(null, '', `#${forced}`);

  renderAll();

  window.addEventListener('hashchange', onHashChange);
  window.addEventListener('online', () => toastSuccess('Kembali online — mengirim antrean sinkronisasi.', { title: 'Koneksi pulih' }));
  window.addEventListener('offline', () => toastWarn('Anda offline. Perubahan akan diantrekan dan dikirim saat online kembali.'));

  anim.bootIntro(async () => {
    booted = true;
    setActiveNav(currentView);
    renderCurrentView();
  });

  if (!DB_READY.hasSheet) {
    setTimeout(() => {
      toast('Aplikasi berjalan di Mode Demo dengan 24 contoh konten. Hubungkan Google Sheet di halaman Pengaturan untuk memakai data asli.', {
        title: 'Mode Demo',
        tone: 'warn',
        timeout: 9000,
        action: { label: 'Buka Pengaturan', onClick: () => go('settings') },
      });
    }, 1800);
  }

  await refresh({ silent: false, first: true });
}

/* --------------------------------- DATA -------------------------------- */

async function refresh({ silent = false, first = false } = {}) {
  const before = store.state.rows.length;
  const res = await store.load({ silent });
  renderConnectionStatus();
  renderSidebarCard();
  renderStats();
  renderToolbar();
  renderFilterBar();
  renderCurrentView();

  if (first && booted) return res;
  if (!silent) {
    if (res.ok) {
      const diff = store.state.rows.length - before;
      toastSuccess(`Data tersinkron: ${store.state.rows.length} konten${diff ? ` (${diff > 0 ? '+' : ''}${diff})` : ''} • sumber ${res.source}.`, { title: 'Sinkron selesai' });
    } else {
      toastError(res.error || 'Gagal memuat data dari Google Sheet.', {
        title: 'Gagal sinkron',
        action: { label: 'Buka Pengaturan', onClick: () => go('settings') },
      });
    }
  }
  return res;
}

/* -------------------------------- ROUTING ------------------------------ */

function onHashChange() {
  const view = (location.hash || '').replace('#', '');
  if (VIEWS.includes(view) && view !== currentView) go(view, { push: false });
}

function go(view, { push = true } = {}) {
  if (!VIEWS.includes(view)) return;
  const out = $(`#view-${currentView}`);
  const incoming = $(`#view-${view}`);
  currentView = view;
  store.setView(view);
  if (push) history.replaceState(null, '', `#${view}`);
  setActiveNav(view);
  renderCurrentView();
  anim.viewTransition(out, incoming);
  anim.headerReveal();
  if (view === 'analytics') anim.animateCharts(incoming);
}

export function renderCurrentView() {
  switch (currentView) {
    case 'planner': renderPlanner(); break;
    case 'calendar': renderCalendar(); break;
    case 'analytics': renderAnalytics(); break;
    case 'cta': renderCta(); break;
    case 'settings': renderSettings(); break;
    default: break;
  }
}

function renderAll() {
  renderConnectionStatus();
  renderSidebarCard();
  renderStats();
  renderToolbar();
  renderFilterBar();
  renderCurrentView();
  bindAnalytics({ onReload: () => refresh({ silent: false }) });
  bindCta();
  bindSettings();
}

/* -------------------------------- BINDINGS ----------------------------- */

function bindShellEvents() {
  bindShell({
    onSearch: (q) => {
      store.setQuery(q);
      renderToolbar();
      renderCurrentView();
    },
    onRefresh: async () => {
      const btn = $('#btn-refresh');
      btn?.classList.add('is-spinning');
      await refresh({ silent: false });
      btn?.classList.remove('is-spinning');
    },
    onNew: () => openNew(),
    onLayout: (layout) => {
      store.setLayout(layout);
      renderToolbar();
      renderPlanner();
    },
    onFlush: async () => {
      const { flushQueue } = store;
      const res = await flushQueue();
      renderConnectionStatus();
      if (res.flushed) toastSuccess(`${res.flushed} perubahan terkirim ke Sheet.`);
      else toastWarn(res.remaining ? `${res.remaining} perubahan masih gagal terkirim.` : 'Tidak ada antrean.');
    },
    onView: (view) => go(view),
  });

  /* Drawer */
  $('#drawer-close')?.addEventListener('click', () => confirmCloseIfDirty(closeDrawer));
  $('#drawer-backdrop')?.addEventListener('click', () => confirmCloseIfDirty(closeDrawer));
  $('#form-cancel')?.addEventListener('click', () => confirmCloseIfDirty(closeDrawer));
  $('#form-save')?.addEventListener('click', (e) => {
    e.preventDefault();
    $('#content-form')?.requestSubmit();
  });

  /* Pintasan keyboard */
  document.addEventListener('keydown', (e) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '');
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape' && !$('#drawer')?.hasAttribute('hidden')) confirmCloseIfDirty(closeDrawer);
    if (e.key === 'e') {
      const first = store.filteredRows()[0];
      if (first) openEdit(first);
    }
    if (e.key === 'c') go('calendar');
    if (e.key === 'a') go('analytics');
  });

  /* Store events -> UI*/
  store.subscribe((payload) => {
    renderConnectionStatus();
    renderSidebarCard();
    if (['saved', 'deleted', 'loaded', 'filtered', 'selection'].includes(payload.event)) {
      renderStats();
      renderToolbar();
      renderPlanner();
      if (currentView === 'calendar') renderCalendar();
      if (currentView === 'analytics') renderAnalytics();
      if (currentView === 'cta') renderCta();
    }
    if (payload.event === 'sync-pending') {
      toastWarn(`${payload.count} perubahan menunggu dikirim ke Sheet.`, { title: 'Antrean sinkronisasi' });
    }
  });
}

function closeDrawer() {
  closeDrawerShell();
}

/* ----------------------- EKSPOR UNTUK KONSOL/DEPURASI ------------------ */

window.CPSAS = {
  app: APP,
  db: DB,
  store,
  views: { renderPlanner, renderCalendar, renderAnalytics, renderCta, renderSettings },
  actions: { refresh, go, exportCsv, openIdeasModal, openNew, openEdit, openAnalysis, openPreview, duplicateContent },
  platform: PLATFORMS,
  pilar: PILARS,
  status: STATUSES,
  school: SCHOOL_PROFILE,
  reload: () => location.reload(),
};

/* --------------------------------- START ------------------------------- */

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
