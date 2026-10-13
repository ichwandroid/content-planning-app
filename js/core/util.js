/** core/util.js — helper DOM, event, storage, async, dan util umum. */

/* ---------------------------------- DOM --------------------------------- */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/**
 * el('div.card', { onclick }, [anak, 'teks'])
 */
export function el(tag, attrs = {}, children = []) {
  let name = 'div';
  const classes = [];
  const idMatch = String(tag).match(/#([\w-]+)/);
  const clsMatches = String(tag).match(/\.([\w-]+)/g) || [];
  const tagMatch = String(tag).match(/^[\w-]+/);
  if (tagMatch) name = tagMatch[0];
  clsMatches.forEach((c) => classes.push(c.slice(1)));
  const node = document.createElement(name);
  if (idMatch) node.id = idMatch[1];
  if (classes.length) node.className = classes.join(' ');

  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = [node.className, v].filter(Boolean).join(' ');
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = isBlank(v) ? '' : String(v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k in node && k !== 'list' && typeof v !== 'object') node[k] = v;
    else node.setAttribute(k, v);
  }
  append(node, children);
  return node;
}

/** Nilai yang tidak boleh muncul sebagai teks di layar. */
function isBlank(value) {
  return value == null || value === false || value === 'null' || value === 'undefined' || (typeof value === 'number' && Number.isNaN(value));
}

export function append(parent, children) {
  if (children == null) return parent;
  const list = Array.isArray(children) ? children : [children];
  for (const c of list) {
    if (isBlank(c)) continue;
    parent.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return parent;
}

export function clear(node) {
  while (node && node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function frag(children) {
  return append(document.createDocumentFragment(), children);
}

export function svgIcon(name, size = 20) {
  const paths = ICONS[name] || ICONS.dot;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" aria-hidden="true">${paths}</svg>`;
}

export const ICONS = {
  dashboard: '<path d="M4 13h6V4H4v9Zm10 7h6v-9h-6v9ZM4 20h6v-4H4v4Zm10-11h6V4h-6v5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="3" stroke="currentColor" stroke-width="1.7"/><path d="M8 3.5V7M16 3.5V7M3.5 10h17" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  chart: '<path d="M4 20V4M4 20h16" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><rect x="7.5" y="12" width="3" height="5" rx="1" stroke="currentColor" stroke-width="1.7"/><rect x="13" y="8" width="3" height="9" rx="1" stroke="currentColor" stroke-width="1.7"/>',
  megaphone: '<path d="M4 10.5v3a1.5 1.5 0 0 0 1.5 1.5H7l4 3.5V7L7 10.5H5.5A1.5 1.5 0 0 0 4 12Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M15 9.5a3.5 3.5 0 0 1 0 5M17.5 7a7 7 0 0 1 0 10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  settings: '<circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7"/><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M18 6l-1.4 1.4M7.4 16.6 6 18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  plus: '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  search: '<circle cx="11" cy="11" r="6" stroke="currentColor" stroke-width="1.8"/><path d="m16 16 4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="3.7" stroke="currentColor" stroke-width="1.7"/><circle cx="17" cy="7" r="1.1" fill="currentColor"/>',
  tiktok: '<path d="M14 4v9.2a3.4 3.4 0 1 1-3.4-3.4M14 5.5c.6 2.2 2.2 3.6 4.5 3.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  youtube: '<rect x="2.8" y="6" width="18.4" height="12" rx="4" stroke="currentColor" stroke-width="1.7"/><path d="m10.5 9.8 4.2 2.5-4.2 2.4V9.8Z" fill="currentColor"/>',
  facebook: '<path d="M14.5 8.5h2V5.8h-2.4c-2.2 0-3.6 1.4-3.6 3.7v1.6H8.2v2.8h2.3V21h3v-7.1h2.3l.4-2.8h-2.7V9.7c0-.8.4-1.2 1-1.2Z" fill="currentColor"/>',
  whatsapp: '<path d="M12 3.8a8 8 0 0 0-6.9 12L4 20.5l4.9-1.1A8 8 0 1 0 12 3.8Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M9.2 9.4c.3-.7 1.4-.6 1.6 0 .2.5.8 1.4.2 1.9-.5.4.5 1.6 1.4 2 .9.4 1-.6 1.6-.9.5-.2 1.5.6 1.6 1.3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  globe: '<circle cx="12" cy="12" r="8.2" stroke="currentColor" stroke-width="1.7"/><path d="M3.8 12h16.4M12 3.8c2.2 2.4 3.2 5.2 3.2 8.2S14.2 17.8 12 20.2c-2.2-2.4-3.2-5.2-3.2-8.2S9.8 6.2 12 3.8Z" stroke="currentColor" stroke-width="1.5"/>',
  spark: '<path d="M12 3.5 13.6 9 19 10.6 13.6 12.2 12 17.7 10.4 12.2 5 10.6 10.4 9 12 3.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  trash: '<path d="M5.5 7h13M9.5 7V5.5h5V7M7 7l.8 12h8.4L17 7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  edit: '<path d="M5 19h3l9-9-3-3-9 9v3Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m15.5 6.5 2 2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  copy: '<rect x="9" y="9" width="10" height="10" rx="2.5" stroke="currentColor" stroke-width="1.7"/><path d="M15 6.5V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h.5" stroke="currentColor" stroke-width="1.7"/>',
  close: '<path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  download: '<path d="M12 4v10m0 0 3.5-3.5M12 14l-3.5-3.5M5 19h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  external: '<path d="M14 4h6v6M20 4l-8 8M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  clock: '<circle cx="12" cy="12" r="8.2" stroke="currentColor" stroke-width="1.7"/><path d="M12 7.5V12l3 2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  eye: '<path d="M2.8 12S6 6.8 12 6.8 21.2 12 21.2 12 18 17.2 12 17.2 2.8 12 2.8 12Z" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="2.6" stroke="currentColor" stroke-width="1.7"/>',
  heart: '<path d="M12 19s-6.5-4-6.5-8.4A3.6 3.6 0 0 1 12 8.2a3.6 3.6 0 0 1 6.5 2.4C18.5 15 12 19 12 19Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
  comment: '<path d="M4.5 6.5A3 3 0 0 1 7.5 3.5h9a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H10l-4 4v-4h-.5a3 3 0 0 1-3-3v-5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  send: '<path d="M4 12 20 4l-6 16-3-6-7-2Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
  bookmark: '<path d="M6.5 4h11v16l-5.5-4-5.5 4V4Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
  bulb: '<path d="M9.5 17h5M10 20h4M12 3.5a5.5 5.5 0 0 1 3.2 9.9c-.5.4-.7.9-.7 1.4H9.5c0-.5-.2-1-.7-1.4A5.5 5.5 0 0 1 12 3.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  alert: '<path d="M12 4.5 21 19.5H3L12 4.5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M12 10v4M12 16.8v.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  link: '<path d="M10 14a4 4 0 0 1 0-5.6l2-2a4 4 0 1 1 5.6 5.6l-1 1M14 10a4 4 0 0 1 0 5.6l-2 2A4 4 0 0 1 6.4 12l1-1" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  users: '<circle cx="9.5" cy="8.5" r="3.2" stroke="currentColor" stroke-width="1.7"/><path d="M3.8 19.5c.6-3 2.9-4.8 5.7-4.8s5.1 1.8 5.7 4.8M16 5.6a3.2 3.2 0 0 1 0 6.3M17.5 19.5c-.2-1.6-.6-2.9-1.3-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="2" stroke="currentColor" stroke-width="1.7"/><rect x="13" y="4" width="7" height="7" rx="2" stroke="currentColor" stroke-width="1.7"/><rect x="4" y="13" width="7" height="7" rx="2" stroke="currentColor" stroke-width="1.7"/><rect x="13" y="13" width="7" height="7" rx="2" stroke="currentColor" stroke-width="1.7"/>',
  list: '<path d="M4 6.5h16M4 12h16M4 17.5h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  dot: '<circle cx="12" cy="12" r="3" fill="currentColor"/>',
  cloud: '<path d="M7 18.5h10a3.5 3.5 0 0 0 .4-7A5 5 0 0 0 7.6 9.7 3.9 3.9 0 0 0 7 18.5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M12 12v6m0 0 2-2m-2 2-2-2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  target: '<circle cx="12" cy="12" r="7.5" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="3.2" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
};

/* -------------------------------- FORMAT -------------------------------- */

export function debounce(fn, wait = 250) {
  let t;
  const wrapped = (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), wait);
  };
  wrapped.cancel = () => clearTimeout(t);
  return wrapped;
}

export function throttle(fn, wait = 200) {
  let last = 0;
  let timer;
  return (...a) => {
    const now = Date.now();
    const remain = wait - (now - last);
    if (remain <= 0) {
      last = now;
      fn(...a);
    } else {
      clearTimeout(timer);
      timer = setTimeout(() => {
        last = Date.now();
        fn(...a);
      }, remain);
    }
  };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function uid(prefix = 'c') {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 7);
  return `${prefix}_${t}${r}`;
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function round(n, digits = 2) {
  const f = 10 ** digits;
  return Math.round((Number(n) + Number.EPSILON) * f) / f;
}

export function toNumber(v, fallback = 0) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (v == null || v === '') return fallback;
  const cleaned = String(v).replace(/[^\d.,-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : fallback;
}

export function slugify(str = '') {
  return String(str)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);
}

/* -------------------------------- STORAGE ------------------------------- */

const APP_PREFIX = 'cpsas.v1';

export const store = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(`${APP_PREFIX}.${key}`);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(`${APP_PREFIX}.${key}`, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  del(key) {
    try {
      localStorage.removeItem(`${APP_PREFIX}.${key}`);
    } catch { /* ignore */ }
  },
};

/* --------------------------------- MISC -------------------------------- */

/** JSONP via <script> — dipakai untuk gviz & Apps Script (bebas CORS). */
export function jsonp(url, { callbackParam = 'callback', timeout = 15000, charset = 'utf-8' } = {}) {
  return new Promise((resolve, reject) => {
    const cbName = `__cpsas_cb_${Math.random().toString(36).slice(2, 10)}`;
    const script = document.createElement('script');
    let done = false;
    const cleanup = () => {
      done = true;
      delete window[cbName];
      script.remove();
    };
    const timer = setTimeout(() => {
      if (done) return;
      cleanup();
      reject(new Error('Waktu koneksi habis (timeout). Periksa koneksi internet / akses Sheet.'));
    }, timeout);

    window[cbName] = (payload) => {
      clearTimeout(timer);
      cleanup();
      resolve(payload);
    };
    script.onerror = () => {
      clearTimeout(timer);
      cleanup();
      reject(new Error('Gagal memuat data (script error). Cek ID Sheet & izin akses publik.'));
    };
    script.charset = charset;
    script.src = url + (url.includes('?') ? '&' : '?') + `${callbackParam}=${cbName}`;
    document.head.append(script);
  });
}

export function download(filename, content, mime = 'text/csv;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const ta = el('textarea', { value: text, style: { position: 'fixed', opacity: '0' } });
  document.body.append(ta);
  ta.select();
  document.execCommand('copy');
  ta.remove();
  return Promise.resolve();
}

export function openExternal(url) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function groupBy(list, keyFn) {
  return list.reduce((acc, item) => {
    const k = keyFn(item);
    (acc[k] ||= []).push(item);
    return acc;
  }, {});
}

export function sortBy(list, keyFn, dir = 'asc') {
  const s = [...list].sort((a, b) => {
    const va = keyFn(a);
    const vb = keyFn(b);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === 'number' && typeof vb === 'number') return va - vb;
    return String(va).localeCompare(String(vb), 'id');
  });
  return dir === 'desc' ? s.reverse() : s;
}

export function uniq(list) {
  return Array.from(new Set(list.filter((v) => v != null && v !== '')));
}

export function sum(list, fn = (x) => x) {
  return list.reduce((a, b) => a + (Number(fn(b)) || 0), 0);
}

export function avg(list, fn = (x) => x) {
  const arr = list.map(fn).filter((n) => Number.isFinite(n));
  return arr.length ? sum(arr) / arr.length : 0;
}

/** Timer kecil untuk ukur performa animasi / request */
export function nowMs() {
  return performance?.now?.() ?? Date.now();
}

export function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
