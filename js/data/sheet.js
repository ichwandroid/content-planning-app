/**
 * data/sheet.js — Lapisan akses Google Sheet TANPA API Google (tanpa OAuth, tanpa API key).
 *
 *  BACA  : 3 strategi otomatis, dicoba berurutan
 *           1) gviz JSONP      -> bebas CORS, paling stabil
 *           2) Apps Script doGet JSONP (action=list) -> kalau gviz diblokir jaringan
 *           3) gviz CSV via fetch (butuh header CORS Google)
 *  TULIS : Apps Script Web App POST (Content-Type: text/plain -> tanpa preflight).
 *          Karena respons POST no-cors tidak terbaca, app memverifikasi lewat doGet JSONP.
 *
 *  Kalau Sheet/Apps Script belum dikonfigurasi, semua fungsi ini mengembalikan status
 *  "demo" dan store.js memakai localStorage supaya aplikasi tetap bisa dipakai.
 */

import { DB, DB_READY, FIELDS, NUMERIC_KEYS } from '../core/config.js';
import { jsonp, toNumber, uid } from '../core/util.js';

const GVIZ_BASE = 'https://docs.google.com/spreadsheets/d';
const cache = new Map();

/* ---------------------------- URL BUILDERS ----------------------------- */

export function gvizJsonUrl(sheetName = DB.SHEET_NAME) {
  const id = DB.SPREADSHEET_ID;
  const params = new URLSearchParams({
    tqx: 'out:json',
    sheet: sheetName,
    headers: '1',
    _: String(Date.now()),
  });
  return `${GVIZ_BASE}/${id}/gviz/tq?${params}`;
}

export function gvizCsvUrl(sheetName = DB.SHEET_NAME) {
  const params = new URLSearchParams({ tqx: 'out:csv', sheet: sheetName, headers: '1', _: String(Date.now()) });
  return `${GVIZ_BASE}/${DB.SPREADSHEET_ID}/gviz/tq?${params}`;
}

export function sheetEditUrl() {
  return DB_READY.hasSheet ? `${GVIZ_BASE}/${DB.SPREADSHEET_ID}/edit` : '';
}

export function sheetCsvExportUrl(sheetName = DB.SHEET_NAME) {
  return `${GVIZ_BASE}/${DB.SPREADSHEET_ID}/export?format=csv&sheet=${encodeURIComponent(sheetName)}`;
}

export const isDemo = () => !DB_READY.hasSheet;
export const hasWriteBackend = () => DB_READY.hasScript;

/* ------------------------------ GVIZ PARSER ---------------------------- */

/**
 * Ubah respons gviz (table.cols/rows) menjadi array objek.
 * Header diambil dari label kolom; kalau kosong, dipakai header default FIELDS.
 */
export function parseGviz(table) {
  if (!table) throw new Error('Struktur data Sheet tidak dikenali.');
  const cols = (table.cols || []).map((c, i) => (c.label || c.id || FIELDS[i]?.label || `kolom_${i + 1}`).trim());
  const rows = table.rows || [];
  return rows
    .map((row) => {
      const obj = {};
      (row.c || []).forEach((cell, i) => {
        const key = headerToKey(cols[i]);
        if (!key) return;
        obj[key] = cellValue(cell);
      });
      return obj;
    })
    .filter((o) => o && Object.values(o).some((v) => v !== '' && v != null));
}

function cellValue(cell) {
  if (!cell) return '';
  if (cell.f != null && cell.f !== '') return cell.f;
  if (cell.v == null) return '';
  if (typeof cell.v === 'string' && cell.v.startsWith('Date(')) {
    const m = cell.v.match(/Date\((\d+),(\d+),(\d+)/);
    if (m) return `${m[1]}-${String(+m[2] + 1).padStart(2, '0')}-${String(+m[3]).padStart(2, '0')}`;
  }
  return cell.v;
}

/** Label header manusia -> key internal (judul -> judul, "CTA Link" -> cta_link). */
export function headerToKey(label = '') {
  const norm = String(label).trim().toLowerCase().replace(/[\s-]+/g, '_').replace(/[^\w]/g, '');
  const direct = FIELDS.find((f) => f.key === norm || f.label.toLowerCase().replace(/[\s-]+/g, '_') === norm);
  return direct?.key || norm || '';
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map((h) => headerToKey(h));
  return rows.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, i) => { if (h) obj[h] = (r[i] ?? '').trim(); });
    return obj;
  }).filter((o) => Object.values(o).some((v) => v !== ''));
}

/* -------------------------------- READ --------------------------------- */

async function readViaGvizJsonp(sheetName) {
  const payload = await jsonp(gvizJsonUrl(sheetName), { timeout: DB.TIMEOUT });
  if (payload?.status === 'error') {
    throw new Error(payload.errors?.[0]?.detailed_message || 'Sheet menolak permintaan (status error).');
  }
  return parseGviz(payload?.table);
}

async function readViaAppsScript(sheetName) {
  if (!DB_READY.hasScript) throw new Error('Apps Script belum dikonfigurasi.');
  const url = new URL(DB.APPS_SCRIPT_URL);
  url.searchParams.set('action', 'list');
  url.searchParams.set('sheet', sheetName);
  const payload = await jsonp(url.toString(), { timeout: DB.TIMEOUT });
  if (!payload?.ok) throw new Error(payload?.error || 'Apps Script tidak mengembalikan data.');
  return (payload.rows || []).map(normalizeRecord);
}

async function readViaGvizCsv(sheetName) {
  const res = await fetch(gvizCsvUrl(sheetName), { mode: 'cors', cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status} saat mengambil CSV.`);
  return parseCsv(await res.text());
}

/**
 * Ambil semua baris Sheet dengan fallback berlapis.
 * @returns {Promise<{rows:Array, source:string, error:string|null}>}
 */
export async function readRows({ sheetName = DB.SHEET_NAME, useCache = false } = {}) {
  if (!DB_READY.hasSheet) return { rows: [], source: 'demo', error: null };
  const cacheKey = `rows:${sheetName}`;
  if (useCache && cache.has(cacheKey)) return cache.get(cacheKey);

  const strategies = [
    ['gviz-jsonp', readViaGvizJsonp],
    ['apps-script', readViaAppsScript],
    ['gviz-csv', readViaGvizCsv],
  ];
  const errors = [];
  for (const [source, fn] of strategies) {
    try {
      const raw = await fn(sheetName);
      const rows = raw.map(normalizeRecord).filter((r) => r.judul || r.id);
      const result = { rows, source, error: null };
      cache.set(cacheKey, result);
      return result;
    } catch (err) {
      errors.push(`${source}: ${err.message}`);
    }
  }
  return { rows: [], source: 'none', error: errors.join(' | ') };
}

export async function readCtaLibrary() {
  if (!DB_READY.hasSheet || !DB.CTA_SHEET_NAME) return { rows: [], error: null };
  try {
    const { rows } = await readRows({ sheetName: DB.CTA_SHEET_NAME });
    return { rows, error: null };
  } catch (err) {
    return { rows: [], error: err.message };
  }
}

export function clearCache() {
  cache.clear();
}

/* -------------------------------- WRITE -------------------------------- */

function buildWritePayload({ action, record, id, records }) {
  const payload = { action, sheet: DB.SHEET_NAME };
  if (record) payload.record = record;
  if (id) payload.id = id;
  if (records) payload.records = records;
  return payload;
}

/**
 * Kirim perintah tulis ke Apps Script.
 * Content-Type text/plain => "simple request", tidak memicu preflight OPTIONS.
 */
async function postToScript(payload) {
  if (!DB_READY.hasScript) return { ok: false, offline: true, error: 'Apps Script belum dikonfigurasi — perubahan disimpan lokal.' };
  try {
    const res = await fetch(DB.APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    // mode no-cors: respons opaque, status tidak terbaca -> anggap terkirim.
    return { ok: true, opaque: res.type === 'opaque', queued: true };
  } catch (err) {
    return { ok: false, error: `Gagal mengirim ke Sheet: ${err.message}` };
  }
}

/** Verifikasi tulisan lewat doGet JSONP (opsional, dipakai untuk sinkronisasi cepat). */
export async function verifyWrite(id, { retries = 3, delay = 900 } = {}) {
  if (!DB_READY.hasScript) return { verified: false, reason: 'no-script' };
  for (let i = 0; i < retries; i += 1) {
    try {
      const { rows } = await readRows({ useCache: false });
      if (!id || rows.some((r) => r.id === id)) return { verified: true };
    } catch { /* coba lagi */ }
    await new Promise((r) => setTimeout(r, delay * (i + 1)));
  }
  return { verified: false, reason: 'timeout' };
}

export const api = {
  /** Tambah / perbarui satu baris. */
  async save(record) {
    const clean = normalizeRecord(record);
    if (!clean.id) clean.id = uid('ct');
    return postToScript(buildWritePayload({ action: 'save', record: clean }));
  },
  async remove(id) {
    return postToScript(buildWritePayload({ action: 'delete', id }));
  },
  /** Kirim banyak baris sekaligus (impor / migrasi). */
  async bulk(records, action = 'upsert') {
    return postToScript(buildWritePayload({ action: 'bulk', records: records.map(normalizeRecord) }));
  },
  async ping() {
    if (!DB_READY.hasScript) return { ok: false, error: 'Belum dikonfigurasi' };
    return postToScript({ action: 'ping', sheet: DB.SHEET_NAME });
  },
};

/* ------------------------------ NORMALIZE ------------------------------ */

/** Pastikan record sesuai skema: angka jadi number, tanggal jadi YYYY-MM-DD. */
export function normalizeRecord(input = {}) {
  const out = {};
  for (const f of FIELDS) {
    let v = input[f.key];
    if (f.type === 'number') v = toNumber(v, 0);
    else if (f.type === 'date') v = normalizeDate(v);
    else if (f.type === 'datetime') v = v ? String(v) : new Date().toISOString();
    else v = v == null ? '' : String(v);
    out[f.key] = v;
  }
  // field tambahan yang tidak ada di skema tetap dibuang agar Sheet tidak melebar
  out.__raw = undefined;
  delete out.__raw;
  return out;
}

function normalizeDate(v) {
  if (!v) return '';
  const s = String(v).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${String(+dmy[2]).padStart(2, '0')}-${String(+dmy[1]).padStart(2, '0')}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Hitung total angka penting dari record (dipakai untuk ringkasan cepat). */
export function totalMetrics(row) {
  return NUMERIC_KEYS.reduce((acc, k) => acc + (Number(row[k]) || 0), 0);
}

export function toSheetRow(record) {
  const r = normalizeRecord(record);
  return FIELDS.map((f) => r[f.key]);
}
