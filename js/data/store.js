/**
 * data/store.js — State terpusat + CRUD dengan strategi "Sheet-first, lokal-fallback".
 *
 * Alur simpan:
 *   1. Optimistic update ke state & localStorage (UI langsung responsif)
 *   2. Kirim ke Google Sheet via Apps Script (kalau dikonfigurasi)
 *   3. Tandai record sebagai "pending sync" bila pengiriman gagal, dan sediakan retry.
 */

import { NUMERIC_KEYS } from '../core/config.js';
import { store as ls, uid, uniq, sortBy } from '../core/util.js';
import { api, clearCache, isDemo, normalizeRecord, readRows, hasWriteBackend } from './sheet.js';
import { demoRows } from './seed.js';

const LS_ROWS = 'rows';
const LS_QUEUE = 'sync-queue';
const LS_META = 'meta';

/* ------------------------------- STATE -------------------------------- */

export const state = {
  rows: [],
  ctaLibrary: [],
  status: 'idle', // idle | loading | ready | error
  source: 'demo',
  error: null,
  lastSync: null,
  query: '',
  filters: { platform: [], status: [], pilar: [], pic: [], range: 'all' },
  sort: { key: 'tanggal', dir: 'desc' },
  view: 'planner', // planner | calendar | analytics | cta | settings
  layout: ls.get('layout', 'grid'),
  selected: [],
  editing: null,
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emit(event = 'change', detail = {}) {
  const payload = { event, ...detail };
  listeners.forEach((fn) => {
    try {
      fn(payload, state);
    } catch (err) {
      console.error('[store] listener error', err);
    }
  });
}

/* ------------------------------ LOAD / SYNC ---------------------------- */

export async function load({ silent = false } = {}) {
  if (!silent) {
    state.status = 'loading';
    emit('loading');
  }
  clearCache();

  if (isDemo()) {
    const local = ls.get(LS_ROWS);
    state.rows = (local?.length ? local : demoRows()).map(normalizeRecord);
    state.source = local?.length ? 'lokal' : 'demo';
    state.error = null;
    state.status = 'ready';
    state.lastSync = new Date().toISOString();
    persistLocal();
    emit('loaded', { source: state.source });
    return { ok: true, source: state.source, count: state.rows.length };
  }

  try {
    const { rows, source, error } = await readRows({ useCache: false });
    if (error && !rows.length) throw new Error(error);
    state.rows = rows.map(normalizeRecord);
    state.source = source;
    state.error = null;
    state.status = 'ready';
    state.lastSync = new Date().toISOString();
    persistLocal();
    emit('loaded', { source, count: rows.length });
    flushQueue();
    return { ok: true, source, count: rows.length };
  } catch (err) {
    const local = ls.get(LS_ROWS, []);
    state.rows = local.map(normalizeRecord);
    state.status = local.length ? 'ready' : 'error';
    state.source = local.length ? 'cache-lokal' : 'none';
    state.error = err.message;
    emit('error', { message: err.message });
    return { ok: false, error: err.message, source: state.source, count: state.rows.length };
  }
}

function persistLocal() {
  ls.set(LS_ROWS, state.rows);
  ls.set(LS_META, { lastSync: state.lastSync, source: state.source });
}

/* --------------------------------- CRUD -------------------------------- */

/** Simpan (tambah/ubah) satu konten. */
export async function upsert(patch) {
  const record = normalizeRecord({ ...patch });
  if (!record.id) record.id = uid('ct');
  record.diperbarui = new Date().toISOString();

  const idx = state.rows.findIndex((r) => r.id === record.id);
  if (idx >= 0) state.rows[idx] = { ...state.rows[idx], ...record };
  else state.rows.unshift(record);
  persistLocal();
  emit('saved', { record });

  const res = await pushToSheet('save', record);
  return { record, sync: res };
}

export async function remove(id) {
  const idx = state.rows.findIndex((r) => r.id === id);
  if (idx < 0) return { ok: false, error: 'Data tidak ditemukan.' };
  const [removed] = state.rows.splice(idx, 1);
  persistLocal();
  emit('deleted', { id, record: removed });
  const res = await pushToSheet('delete', { id });
  return { ok: true, sync: res };
}

export async function duplicate(id) {
  const src = state.rows.find((r) => r.id === id);
  if (!src) return { ok: false };
  const copy = {
    ...src,
    id: uid('ct'),
    judul: `${src.judul} (salinan)`,
    status: 'ide',
    post_url: '',
    ...Object.fromEntries(NUMERIC_KEYS.map((k) => [k, 0])),
  };
  return upsert(copy);
}

export async function bulkRemove(ids) {
  const set = new Set(ids);
  const removed = state.rows.filter((r) => set.has(r.id));
  state.rows = state.rows.filter((r) => !set.has(r.id));
  persistLocal();
  emit('deleted', { ids });
  if (hasWriteBackend()) {
    for (const r of removed) await pushToSheet('delete', { id: r.id });
  }
  return { ok: true, count: removed.length };
}

export async function bulkStatus(ids, status) {
  const set = new Set(ids);
  const updated = [];
  state.rows = state.rows.map((r) => {
    if (!set.has(r.id)) return r;
    const next = { ...r, status, diperbarui: new Date().toISOString() };
    updated.push(next);
    return next;
  });
  persistLocal();
  emit('saved', { records: updated });
  for (const r of updated) await pushToSheet('save', r);
  return { ok: true, count: updated.length };
}

export async function importRows(rows) {
  const normalized = rows.map((r) => normalizeRecord({ ...r, id: r.id || uid('ct') }));
  const byId = new Map(state.rows.map((r) => [r.id, r]));
  normalized.forEach((r) => byId.set(r.id, r));
  state.rows = Array.from(byId.values());
  persistLocal();
  emit('loaded', { source: state.source });
  await api.bulk(normalized);
  return { ok: true, count: normalized.length };
}

export function replaceAll(rows) {
  state.rows = rows.map(normalizeRecord);
  persistLocal();
  emit('loaded', { source: 'manual' });
}

/* ------------------------------ SYNC QUEUE ----------------------------- */

function readQueue() {
  return ls.get(LS_QUEUE, []);
}

function writeQueue(queue) {
  ls.set(LS_QUEUE, queue);
  emit('queue', { count: queue.length });
}

async function pushToSheet(action, payload) {
  if (!hasWriteBackend()) {
    return { ok: false, offline: true, pending: false, error: 'Mode lokal/demo — Apps Script belum diisi.' };
  }
  const res = action === 'save' ? await api.save(payload) : await api.remove(payload.id);
  if (res?.ok) {
    emit('synced', { action, payload });
    return { ok: true, queued: true };
  }
  const queue = readQueue();
  queue.push({ action, payload, at: new Date().toISOString(), error: res?.error });
  writeQueue(queue);
  emit('sync-pending', { count: queue.length, error: res?.error });
  return { ok: false, pending: true, error: res?.error };
}

export async function flushQueue() {
  const queue = readQueue();
  if (!queue.length || !hasWriteBackend()) return { ok: true, flushed: 0 };
  const remaining = [];
  let flushed = 0;
  for (const item of queue) {
    const res = item.action === 'save' ? await api.save(item.payload) : await api.remove(item.payload.id);
    if (res?.ok) flushed += 1;
    else remaining.push(item);
  }
  writeQueue(remaining);
  if (flushed) emit('synced', { flushed });
  return { ok: true, flushed, remaining: remaining.length };
}

export const pendingCount = () => readQueue().length;
export const getMeta = () => ls.get(LS_META, {});

/* --------------------------- SELECTORS / VIEW -------------------------- */

export function setQuery(q) {
  state.query = q;
  emit('filtered');
}

export function setFilter(key, value) {
  state.filters[key] = value;
  emit('filtered');
}

export function toggleFilterValue(key, value) {
  const arr = state.filters[key];
  const i = arr.indexOf(value);
  if (i >= 0) arr.splice(i, 1);
  else arr.push(value);
  emit('filtered');
}

export function resetFilters() {
  state.filters = { platform: [], status: [], pilar: [], pic: [], range: 'all' };
  state.query = '';
  emit('filtered');
}

export function setSort(key) {
  if (state.sort.key === key) state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
  else state.sort = { key, dir: 'desc' };
  emit('filtered');
}

export function filteredRows() {
  const q = state.query.trim().toLowerCase();
  const { platform, status, pilar, pic, range } = state.filters;
  const now = Date.now();
  const rangeMs = { '7': 7, '30': 30, '90': 90 }[range] * 86400000;

  let rows = state.rows.filter((r) => {
    if (platform.length && !platform.includes(r.platform)) return false;
    if (status.length && !status.includes(r.status)) return false;
    if (pilar.length && !pilar.includes(r.pilar)) return false;
    if (pic.length && !pic.includes(r.pic)) return false;
    if (rangeMs && r.tanggal) {
      const t = new Date(r.tanggal).getTime();
      if (Number.isFinite(t) && now - t > rangeMs) return false;
    }
    if (q) {
      const hay = [r.judul, r.caption, r.hashtag, r.cta_teks, r.pic, r.catatan, r.platform, r.pilar, r.status]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  rows = sortBy(rows, (r) => (state.sort.key === 'tanggal' ? new Date(r.tanggal || 0).getTime() : r[state.sort.key]), state.sort.dir);
  return rows;
}

export function getRow(id) {
  return state.rows.find((r) => r.id === id) || null;
}

export function pics() {
  return uniq(state.rows.map((r) => r.pic));
}

export function setView(view) {
  state.view = view;
  ls.set('view', view);
  emit('view', { view });
}

export function setLayout(layout) {
  state.layout = layout;
  ls.set('layout', layout);
  emit('layout', { layout });
}

export function toggleSelected(id) {
  const i = state.selected.indexOf(id);
  if (i >= 0) state.selected.splice(i, 1);
  else state.selected.push(id);
  emit('selection', { count: state.selected.length });
}

export function clearSelection() {
  state.selected = [];
  emit('selection', { count: 0 });
}

export function stats() {
  const rows = state.rows;
  const tayang = rows.filter((r) => r.status === 'tayang');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = rows.filter((r) => r.status !== 'tayang' && r.tanggal && new Date(r.tanggal) >= today);
  const totalReach = tayang.reduce((a, r) => a + (Number(r.views) || 0), 0);
  const totalEngage = tayang.reduce(
    (a, r) => a + (Number(r.likes) || 0) + (Number(r.comments) || 0) + (Number(r.shares) || 0) + (Number(r.saves) || 0),
    0,
  );
  return {
    total: rows.length,
    tayang: tayang.length,
    upcoming: upcoming.length,
    ide: rows.filter((r) => r.status === 'ide' || r.status === 'draf').length,
    totalReach,
    totalEngage,
    avgER: totalReach ? (totalEngage / totalReach) * 100 : 0,
    pendaftar: rows.reduce((a, r) => a + (Number(r.pendaftar) || 0), 0),
    klik: rows.reduce((a, r) => a + (Number(r.klik_link) || 0), 0),
  };
}

export const isDemoMode = isDemo;
export { NUMERIC_KEYS };
