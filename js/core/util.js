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

export function faIcon(name, size = 20) {
  const iconClass = ICONS[name] || ICONS.dot || 'fa-solid fa-circle';
  const sizeStyle = size ? `font-size:${size}px;` : '';
  return `<i class="${iconClass}" style="${sizeStyle}" aria-hidden="true"></i>`;
}

export const svgIcon = faIcon;

export const ICONS = {
  dashboard: 'fa-solid fa-gauge-high',
  calendar: 'fa-solid fa-calendar-days',
  chart: 'fa-solid fa-chart-column',
  megaphone: 'fa-solid fa-bullhorn',
  settings: 'fa-solid fa-gear',
  plus: 'fa-solid fa-plus',
  search: 'fa-solid fa-magnifying-glass',
  refresh: 'fa-solid fa-arrows-rotate',
  instagram: 'fa-brands fa-instagram',
  tiktok: 'fa-brands fa-tiktok',
  youtube: 'fa-brands fa-youtube',
  facebook: 'fa-brands fa-facebook',
  whatsapp: 'fa-brands fa-whatsapp',
  globe: 'fa-solid fa-globe',
  spark: 'fa-solid fa-wand-magic-sparkles',
  trash: 'fa-solid fa-trash-can',
  edit: 'fa-solid fa-pen-to-square',
  copy: 'fa-solid fa-copy',
  close: 'fa-solid fa-xmark',
  download: 'fa-solid fa-download',
  external: 'fa-solid fa-arrow-up-right-from-square',
  clock: 'fa-solid fa-clock',
  eye: 'fa-solid fa-eye',
  heart: 'fa-solid fa-heart',
  comment: 'fa-solid fa-comment',
  send: 'fa-solid fa-paper-plane',
  bookmark: 'fa-solid fa-bookmark',
  bulb: 'fa-solid fa-lightbulb',
  check: 'fa-solid fa-check',
  alert: 'fa-solid fa-triangle-exclamation',
  link: 'fa-solid fa-link',
  users: 'fa-solid fa-users',
  filter: 'fa-solid fa-filter',
  grid: 'fa-solid fa-table-cells',
  list: 'fa-solid fa-list',
  dot: 'fa-solid fa-circle',
  cloud: 'fa-solid fa-cloud-arrow-up',
  target: 'fa-solid fa-bullseye',
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
