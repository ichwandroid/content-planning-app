/** core/format.js — format angka, tanggal, waktu, dan label bahasa Indonesia. */

import { APP } from './config.js';

const nf = (opts) => new Intl.NumberFormat(APP.locale, opts);

const compact = nf({ notation: 'compact', maximumFractionDigits: 1 });
const decimal = nf({ maximumFractionDigits: 2 });
const integer = nf({ maximumFractionDigits: 0 });
const percent = nf({ style: 'percent', maximumFractionDigits: 2 });
const currency = nf({ style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

export const fmtNumber = (n) => (Number.isFinite(+n) ? integer.format(+n) : '0');
export const fmtCompact = (n) => (Number.isFinite(+n) ? compact.format(+n) : '0');
export const fmtDecimal = (n) => (Number.isFinite(+n) ? decimal.format(+n) : '0');
export const fmtPercent = (n) => (Number.isFinite(+n) ? percent.format(+n / 100) : '0%');
export const fmtCurrency = (n) => currency.format(+n || 0);

export const HHARI = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export const HBULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
export const HBULAN_SINGKAT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** Terima Date | 'YYYY-MM-DD' | ISO | kosong -> Date | null */
export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const s = String(value).trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const toISODate = (d) => {
  const date = toDate(d);
  if (!date) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export function fmtDate(value, style = 'medium') {
  const d = toDate(value);
  if (!d) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  switch (style) {
    case 'short': return `${dd}/${mm}/${d.getFullYear()}`;
    case 'day': return HHARI[d.getDay()];
    case 'month': return HBULAN[d.getMonth()];
    case 'monthYear': return `${HBULAN[d.getMonth()]} ${d.getFullYear()}`;
    case 'full': return `${HHARI[d.getDay()]}, ${d.getDate()} ${HBULAN[d.getMonth()]} ${d.getFullYear()}`;
    case 'compact': return `${d.getDate()} ${HBULAN_SINGKAT[d.getMonth()]}`;
    case 'long': return `${d.getDate()} ${HBULAN[d.getMonth()]} ${d.getFullYear()}`;
    default: return `${dd} ${HBULAN_SINGKAT[d.getMonth()]} ${d.getFullYear()}`;
  }
}

export function fmtTime(value) {
  if (!value) return '—';
  const s = String(value).trim();
  const m = s.match(/^(\d{1,2})[:.](\d{2})/);
  if (m) return `${String(m[1]).padStart(2, '0')}.${m[2]}`;
  if (s.includes('T')) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`;
  }
  return s;
}

export function fmtDateTime(value) {
  const d = toDate(value);
  if (!d) return '—';
  const isDateOnly = typeof value === 'string' && !/[:T]/.test(value);
  return isDateOnly ? fmtDate(d, 'long') : `${fmtDate(d, 'long')} • ${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`;
}

export function timeAgo(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d?.getTime?.())) return '—';
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'baru saja';
  const units = [['hari', 86400], ['jam', 3600], ['menit', 60]];
  for (const [label, secs] of units) {
    if (diff >= secs) {
      const v = Math.floor(diff / secs);
      return `${v} ${label} lalu`;
    }
  }
  return 'baru saja';
}

export function daysBetween(a, b = new Date()) {
  const d1 = toDate(a);
  const d2 = toDate(b);
  if (!d1 || !d2) return 0;
  return Math.round((d2 - d1) / 86400000);
}

export const todayISO = () => toISODate(new Date());

export function addDays(value, n) {
  const d = toDate(value) || new Date();
  d.setDate(d.getDate() + n);
  return d;
}

export function startOfMonth(value = new Date()) {
  const d = toDate(value) || new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(value = new Date()) {
  const d = toDate(value) || new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

/** Label relatif untuk jadwal: "3 hari lagi", "terlambat 2 hari" */
export function labelJadwal(tanggalISO) {
  const d = toDate(tanggalISO);
  if (!d) return 'Belum dijadwalkan';
  const diff = daysBetween(new Date(), d);
  if (diff === 0) return 'Hari ini';
  if (diff === 1) return 'Besok';
  if (diff === -1) return 'Kemarin';
  if (diff > 1) return `${diff} hari lagi`;
  return `${Math.abs(diff)} hari lalu`;
}

export function fmtDuration(seconds, { short = true } = {}) {
  const s = Math.max(0, Math.round(+seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (short) return h ? `${h}j ${m}m` : m ? `${m}m ${sec}s` : `${sec}s`;
  return [h && `${h} jam`, m && `${m} menit`, sec && `${sec} detik`].filter(Boolean).join(' ');
}

export function truncate(str = '', max = 90) {
  const s = String(str).trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

export function initials(name = '') {
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

/** Ambil hashtag dari caption */
export function extractHashtags(text = '') {
  return (String(text).match(/#[\p{L}\p{N}_]+/gu) || []).map((h) => h.toLowerCase());
}

export function normalizeHashtags(input) {
  const raw = Array.isArray(input) ? input.join(' ') : String(input || '');
  const tags = raw
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => (t.startsWith('#') ? t : `#${t}`))
    .map((t) => t.replace(/[^\p{L}\p{N}_#]/gu, ''));
  return uniqCaseInsensitive(tags);
}

function uniqCaseInsensitive(list) {
  const seen = new Set();
  return list.filter((t) => {
    const k = t.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export const PLATFORM_BADGE = {
  instagram: 'IG',
  tiktok: 'TT',
  youtube: 'YT',
  facebook: 'FB',
  whatsapp: 'WA',
  website: 'WEB',
};
