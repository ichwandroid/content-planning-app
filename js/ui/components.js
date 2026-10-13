/**
 * ui/components.js — Komponen UI dasar (badge, kartu KPI, toast, modal, drawer, tabel).
 * Semua fungsi mengembalikan elemen DOM siap tempel; animasi ditangani lib/anim.js.
 */

import { APP, CTA_GOALS, CTA_TYPES, PILARS, PLATFORMS, SCHOOL_PROFILE, STATUSES } from '../core/config.js';
import { PLATFORM_BADGE, fmtCompact, fmtDate, fmtDecimal, fmtNumber, fmtPercent, fmtTime, labelJadwal, toDate, truncate } from '../core/format.js';
import { $, append, copyText, el, escapeHtml, ICONS, openExternal, svgIcon } from '../core/util.js';
import * as anim from '../lib/anim.js';
import { gauge } from '../lib/charts.js';

/* ------------------------------- LOOKUP -------------------------------- */

export const platform = (id) => PLATFORMS[id] || { label: id || 'Lainnya', color: '#64748B', soft: '#EDF1F5', icon: 'dot', types: [] };
export const status = (id) => STATUSES[id] || { label: id || 'Tanpa status', color: '#94A3B8', soft: '#EEF2F6' };
export const pilar = (id) => PILARS.find((p) => p.id === id) || { label: id || 'Tanpa pilar', emoji: '•', color: '#94A3B8', goal: 'engagement' };
export const ctaType = (id) => CTA_TYPES.find((c) => c.id === id) || null;

/* -------------------------------- ATOM --------------------------------- */

export function icon(name, size = 18, cls = '') {
  const span = el('span', { class: `ic ${cls}`.trim(), 'aria-hidden': 'true' });
  span.innerHTML = svgIcon(name, size);
  return span;
}

export function platformBadge(id, { size = 'md' } = {}) {
  const p = platform(id);
  const node = el('span', {
    class: `pf-badge pf-badge--${size}`,
    dataset: { platform: id || 'lainnya' },
    style: { '--pf': p.color, '--pf-soft': p.soft },
    title: p.label,
  });
  append(node, icon(p.icon, size === 'sm' ? 12 : 14));
  const label = el('span', { class: 'pf-badge__label', text: PLATFORM_BADGE[id] || p.label });
  append(node, label);
  return node;
}

export function statusPill(id) {
  const s = status(id);
  return el('span', {
    class: 'status-pill',
    dataset: { status: id || 'kosong' },
    style: { '--st': s.color, '--st-soft': s.soft },
    text: s.label,
  });
}

export function pilarChip(id) {
  const p = pilar(id);
  return el('span', { class: 'chip chip--pilar', style: { '--cp': p.color }, title: p.label }, [`${p.emoji} ${p.label}`]);
}

export function ctaChip(id) {
  const c = ctaType(id);
  const goal = CTA_GOALS[c?.goal || 'engagement'];
  return el('span', {
    class: 'chip chip--cta',
    style: { '--cp': goal.color },
    title: `CTA: ${c?.label || id || 'belum diisi'} • tujuan ${goal.label}`,
  }, ['🎯 ', c?.label || 'Tanpa CTA']);
}

export function badge(text, tone = 'neutral') {
  return el('span', { class: `badge badge--${tone}`, text });
}

export function avatar(name) {
  const initials = String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  const hue = [...String(name || '?')].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return el('span', { class: 'avatar', style: { background: `hsl(${hue} 55% 92%)`, color: `hsl(${hue} 60% 30%)` }, title: name || 'Belum ada PIC', text: initials || '?' });
}

export function iconButton(name, { title = '', onClick, cls = '', label = '' } = {}) {
  const b = el('button', { class: `icon-btn ${cls}`.trim(), type: 'button', title, 'aria-label': label || title, onclick: onClick });
  append(b, icon(name));
  return b;
}

export function button(label, { variant = 'ghost', iconName, onClick, type = 'button', cls = '', size = '', title = '' } = {}) {
  const hasLabel = label != null && String(label).trim() !== '';
  const b = el('button', {
    class: `btn btn--${variant} ${size ? `btn--${size}` : ''} ${hasLabel ? '' : 'btn--icon-only'} ${cls}`.trim(),
    type,
    onclick: onClick,
  });
  if (iconName) append(b, icon(iconName, 16, 'btn__icon'));
  if (hasLabel) append(b, el('span', { class: 'btn__label', text: label }));
  // Tombol ikon-saja tetap punya nama untuk pembaca layar & tooltip.
  if (title || (!hasLabel && iconName)) {
    const name = title || iconName;
    b.title = name;
    b.setAttribute('aria-label', name);
  }
  return b;
}

export function field({ label, name, type = 'text', value = '', placeholder = '', help = '', required = false, options = null, rows = 3, min, max, step = 'any', attrs = {} }) {
  const wrap = el('label', { class: 'field', dataset: { field: name } });
  const head = el('span', { class: 'field__label' });
  append(head, label);
  if (required) append(head, el('span', { class: 'field__req', text: ' *' }));
  append(wrap, head);

  let input;
  if (options) {
    input = el('select', { class: 'input', name, ...attrs });
    options.forEach((o) => {
      const opt = el('option', { value: o.value, text: o.label });
      if (String(o.value) === String(value)) opt.selected = true;
      append(input, opt);
    });
  } else if (type === 'textarea') {
    input = el('textarea', { class: 'input', name, rows, placeholder, ...attrs });
    input.value = value ?? '';
  } else {
    input = el('input', { class: 'input', name, type, placeholder, ...attrs });
    if (min != null) input.min = min;
    if (max != null) input.max = max;
    if (type === 'number') input.step = step;
    input.value = value ?? '';
  }
  append(wrap, input);
  if (help) append(wrap, el('span', { class: 'field__help', text: help }));
  return wrap;
}

export function kpiCell(iconName, label, value, { tone = 'var(--teal-700)', hint = '' } = {}) {
  const cell = el('div', { class: 'kpi-cell', title: hint || `${label}: ${value}` });
  const ic = el('span', { class: 'kpi-cell__icon', style: { color: tone } });
  ic.innerHTML = svgIcon(iconName, 15);
  append(cell, ic, el('span', { class: 'kpi-cell__label', text: label }), el('strong', { class: 'kpi-cell__value', text: value }));
  return cell;
}

export function scoreRing(score, { size = 62, tone, label = '' } = {}) {
  const s = Number(score) || 0;
  const color = tone || (s >= 70 ? '#10B981' : s >= 55 ? '#0EA5E9' : s >= 40 ? '#F59E0B' : s > 0 ? '#EF4444' : '#CBD5E1');
  const ring = el('div', {
    class: 'score-ring',
    style: { '--p': `${Math.max(0, Math.min(100, s))}%`, '--tone': color, width: `${size}px`, height: `${size}px` },
    title: label || `Skor konten ${fmtDecimal(s)}/100`,
  });
  append(ring, el('span', { class: 'score-ring__value', text: s ? fmtDecimal(s) : '–' }));
  return ring;
}

export function progressBar(value, { max = 100, tone = 'var(--teal-700)', label = '' } = {}) {
  const pct = Math.max(0, Math.min(100, ((Number(value) || 0) / max) * 100));
  const wrap = el('div', { class: 'progress' });
  append(wrap, el('div', { class: 'progress__track' }, [
    el('div', { class: 'progress__fill', style: { '--w': `${pct}%`, background: tone } }),
  ]));
  if (label) append(wrap, el('span', { class: 'progress__label', text: label }));
  return wrap;
}

export function embedFrame(html, { note = '' } = {}) {
  const wrap = el('div', { class: 'embed-frame' });
  if (!html) {
    wrap.classList.add('embed-frame--empty');
    append(wrap, el('div', { class: 'embed-placeholder' }, [
      icon('link', 22),
      el('p', { text: note || 'Tempel URL postingan untuk menampilkan pratinjau asli dari platform.' }),
    ]));
    return wrap;
  }
  wrap.innerHTML = html;
  return wrap;
}

export function emptyState({ title, message, actionLabel, onAction, iconName = 'spark' }) {
  const wrap = el('div', { class: 'empty-state' });
  const ic = el('div', { class: 'empty-state__icon' });
  ic.innerHTML = svgIcon(iconName, 34);
  append(wrap, ic, el('h3', { text: title }), el('p', { text: message }));
  if (actionLabel) append(wrap, button(actionLabel, { variant: 'primary', onClick: onAction }));
  return wrap;
}

export function skeletonCards(count = 6) {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i += 1) {
    const card = el('div', { class: 'content-card skeleton-card' });
    card.innerHTML = `
      <div class="skeleton skeleton--line" style="width:40%"></div>
      <div class="skeleton skeleton--line" style="width:85%;height:18px"></div>
      <div class="skeleton skeleton--line" style="width:70%"></div>
      <div class="skeleton skeleton--block"></div>`;
    append(frag, card);
  }
  return frag;
}

/* -------------------------------- TOAST -------------------------------- */

let toastId = 0;
const MAX_TOASTS = 3;

export function toast(message, { tone = 'info', title = '', timeout = 4200, action = null } = {}) {
  const stack = $('#toast-stack');
  if (!stack) return () => {};
  // Batasi tumpukan agar tidak menutupi konten di layar kecil.
  while (stack.children.length >= MAX_TOASTS) stack.firstElementChild.remove();

  const id = `toast-${++toastId}`;
  const iconName = tone === 'success' ? 'check' : tone === 'error' ? 'alert' : tone === 'warn' ? 'alert' : 'bulb';
  const node = el('div', { class: `toast toast--${tone}`, id, role: 'status' });
  const ic = el('span', { class: 'toast__icon' });
  ic.innerHTML = svgIcon(iconName, 18);
  const body = el('div', { class: 'toast__body' });
  if (title) append(body, el('strong', { text: title }));
  append(body, el('p', { text: message }));
  if (action) append(body, button(action.label, { size: 'sm', variant: 'ghost', onClick: () => { action.onClick?.(); dismiss(); } }));
  append(node, ic, body, iconButton('close', { title: 'Tutup', onClick: () => dismiss() }));
  append(stack, node);
  anim.toastIn(node);

  let timer = timeout ? setTimeout(() => dismiss(), timeout) : null;
  function dismiss() {
    clearTimeout(timer);
    anim.toastOut(node, () => node.remove());
  }
  return dismiss;
}

export const toastSuccess = (msg, opts) => toast(msg, { tone: 'success', ...opts });
export const toastError = (msg, opts) => toast(msg, { tone: 'error', timeout: 6500, ...opts });
export const toastWarn = (msg, opts) => toast(msg, { tone: 'warn', ...opts });

/* -------------------------------- MODAL -------------------------------- */

export function openModal({ title, body, footer = null, wide = false, onClose = null }) {
  const modal = $('#modal');
  const backdrop = $('#modal-backdrop');
  $('#modal-title').textContent = title || '';
  const bodyEl = $('#modal-body');
  bodyEl.innerHTML = '';
  if (typeof body === 'string') bodyEl.innerHTML = body;
  else if (body) append(bodyEl, body);
  const foot = $('#modal-foot');
  foot.innerHTML = '';
  if (footer) {
    if (typeof footer === 'string') foot.innerHTML = footer;
    else append(foot, footer);
    foot.hidden = false;
  } else foot.hidden = true;
  modal.classList.toggle('modal--wide', wide);
  modal.removeAttribute('hidden');
  backdrop.removeAttribute('hidden');
  anim.openModal(modal, backdrop);

  const close = () => {
    anim.closeModal(modal, backdrop);
    modal.setAttribute('hidden', '');
    backdrop.setAttribute('hidden', '');
    onClose?.();
  };
  $('#modal-close').onclick = close;
  backdrop.onclick = close;
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });
  return { close, body: bodyEl, footer: foot };
}

/* -------------------------------- DRAWER ------------------------------- */

export function openDrawerShell(title, subtitle) {
  const drawer = $('#drawer');
  const backdrop = $('#drawer-backdrop');
  $('#drawer-title').textContent = title;
  $('#drawer-sub').textContent = subtitle || '';
  drawer.removeAttribute('hidden');
  backdrop.removeAttribute('hidden');
  anim.openDrawer(drawer, backdrop);
}

export function closeDrawerShell() {
  const drawer = $('#drawer');
  const backdrop = $('#drawer-backdrop');
  anim.closeDrawer(drawer, backdrop);
  setTimeout(() => {
    drawer.setAttribute('hidden', '');
    backdrop.setAttribute('hidden', '');
  }, 420);
}

/* -------------------------------- TABLE -------------------------------- */

export function table(columns, rows, { renderCell, onRowClick, empty = 'Belum ada data.' } = {}) {
  const wrap = el('div', { class: 'table-wrap' });
  const t = el('table', { class: 'table' });
  const thead = el('thead');
  const hr = el('tr');
  columns.forEach((c) => append(hr, el('th', { class: c.align === 'right' ? 'is-right' : '', text: c.label })));
  append(thead, hr);
  const tbody = el('tbody');
  if (!rows.length) {
    const tr = el('tr');
    append(tr, el('td', { class: 'table__empty', colSpan: columns.length, text: empty }));
    append(tbody, tr);
  }
  rows.forEach((row, i) => {
    const tr = el('tr', { dataset: { index: String(i) } });
    if (onRowClick) tr.addEventListener('click', () => onRowClick(row));
    columns.forEach((c) => {
      const td = el('td', { class: c.align === 'right' ? 'is-right' : '' });
      const content = renderCell ? renderCell(row, c) : row[c.key];
      if (content instanceof Node) append(td, content);
      else td.innerHTML = content == null ? '' : String(content);
      append(tr, td);
    });
    append(tbody, tr);
  });
  append(t, thead, tbody);
  append(wrap, t);
  return wrap;
}

/* ---------------------------- CONFIRM DIALOG --------------------------- */

export function confirmDialog({ title, message, confirmLabel = 'Hapus', tone = 'danger', onConfirm }) {
  const body = el('div', { class: 'confirm' }, [el('p', { text: message })]);
  const footer = el('div', { class: 'modal__actions' });
  let api;
  append(footer, 
    button('Batal', { onClick: () => api.close() }),
    button(confirmLabel, { variant: tone, onClick: async () => { await onConfirm?.(); api.close(); } }),
  );
  api = openModal({ title, body, footer });
  return api;
}

/* ------------------------------- HELPERS ------------------------------- */

export function copyButton(text, label = 'Salin') {
  return button(label, {
    size: 'sm',
    iconName: 'copy',
    onClick: async () => {
      await copyText(text);
      toastSuccess('Disalin ke clipboard.');
    },
  });
}

export function externalLink(url, label, { cls = '' } = {}) {
  const a = el('a', { class: `link-external ${cls}`.trim(), href: url, target: '_blank', rel: 'noopener noreferrer', title: url });
  append(a, el('span', { text: label }), icon('external', 14));
  return a;
}

export function dl(label, value, { mono = false } = {}) {
  const wrap = el('div', { class: 'dl' });
  append(wrap, el('dt', { text: label }), el('dd', { class: mono ? 'mono' : '', text: value == null || value === '' ? '—' : String(value) }));
  return wrap;
}

export function definitionList(pairs) {
  const list = el('dl', { class: 'dl-list' });
  pairs.forEach(([label, value, opts]) => append(list, dl(label, value, opts)));
  return list;
}

export function metricRow(label, value, { tone = '', sub = '' } = {}) {
  const row = el('div', { class: `metric-row ${tone ? `metric-row--${tone}` : ''}`.trim() });
  append(row, el('span', { class: 'metric-row__label', text: label }), el('strong', { class: 'metric-row__value', text: value }));
  if (sub) append(row, el('span', { class: 'metric-row__sub', text: sub }));
  return row;
}

/** Blok metrik ringkas untuk kartu konten. */
export function kpiStrip(row, kpi) {
  const strip = el('div', { class: 'kpi-strip' });
  const er = kpi?.er ?? 0;
  append(strip, 
    kpiCell('eye', 'Views', fmtCompact(row.views || 0)),
    kpiCell('heart', 'Likes', fmtCompact(row.likes || 0)),
    kpiCell('comment', 'Komentar', fmtCompact(row.comments || 0)),
    kpiCell('bookmark', 'Simpan', fmtCompact(row.saves || 0)),
    kpiCell('target', 'ER', `${fmtDecimal(er)}%`, { tone: er >= 4 ? 'var(--ok)' : er >= 2 ? 'var(--info)' : 'var(--warn)' }),
  );
  return strip;
}

export function contentCard(row, kpi, handlers = {}) {
  const p = platform(row.platform);
  const card = el('article', {
    class: `content-card content-card--${row.platform || 'lainnya'}`,
    dataset: { id: row.id, platform: row.platform || '', status: row.status || '' },
    style: { '--pf': p.color, '--pf-soft': p.soft },
    draggable: 'true',
  });

  /* HEAD */
  const head = el('header', { class: 'cc-head' });
  const dateBadge = el('div', { class: 'cc-date' }, [
    el('strong', { text: row.tanggal ? fmtDate(row.tanggal, 'compact') : 'Tanpa tanggal' }),
    el('small', { text: `${row.jam ? fmtTime(row.jam) : '—'} • ${labelJadwal(row.tanggal)}` }),
  ]);
  append(head, dateBadge);
  const tags = el('div', { class: 'cc-tags' }, [platformBadge(row.platform), statusPill(row.status)]);
  append(head, tags);
  append(card, head);

  /* TITLE */
  const titleRow = el('div', { class: 'cc-title-row' });
  append(titleRow, el('h3', { class: 'cc-title', text: row.judul || '(tanpa judul)' }));
  if (row.status === 'tayang') append(titleRow, scoreRing(kpi?.score ?? 0, { size: 54, label: kpi?.grade?.label }));
  append(card, titleRow);

  /* META */
  const meta = el('div', { class: 'cc-meta' }, [
    pilarChip(row.pilar),
    row.format ? el('span', { class: 'chip chip--soft', text: row.format }) : null,
    ctaChip(row.cta_jenis),
    row.pic ? el('span', { class: 'cc-pic' }, [avatar(row.pic), el('span', { text: row.pic })]) : el('span', { class: 'cc-pic cc-pic--empty', text: 'PIC belum diisi' }),
  ]);
  append(card, meta);

  /* CAPTION */
  if (row.caption) {
    const cap = el('p', { class: 'cc-caption', html: escapeHtml(truncate(row.caption, 180)) });
    append(card, cap);
  }

  /* CTA BOX */
  if (row.cta_teks || row.cta_link) {
    const ctaBox = el('div', { class: 'cta-box' });
    const ic = el('span', { class: 'cta-box__icon' });
    ic.innerHTML = svgIcon('megaphone', 16);
    append(ctaBox, ic, el('p', { class: 'cta-box__text', text: row.cta_teks || 'CTA belum ditulis' }));
    if (row.cta_link) append(ctaBox, externalLink(row.cta_link, 'Buka', { cls: 'cta-box__link' }));
    append(card, ctaBox);
  } else {
    append(card, el('div', { class: 'cta-box cta-box--empty' }, [el('p', { text: '⚠️ Belum ada CTA — konten tanpa ajakan sulit menghasilkan tindakan.' })]));
  }

  /* KPI */
  append(card, kpiStrip(row, kpi));

  /* FOOT */
  const foot = el('footer', { class: 'cc-foot' });
  append(foot, 
    button('Edit', { size: 'sm', iconName: 'edit', onClick: () => handlers.onEdit?.(row) }),
    button('Analisis', { size: 'sm', iconName: 'chart', variant: 'ghost', onClick: () => handlers.onAnalyze?.(row) }),
    button('Pratinjau', { size: 'sm', iconName: 'eye', variant: 'ghost', onClick: () => handlers.onPreview?.(row) }),
    row.post_url ? button('Buka Post', { size: 'sm', iconName: 'external', variant: 'ghost', onClick: () => openExternal(row.post_url) }) : null,
    button('', { size: 'sm', iconName: 'copy', variant: 'ghost', cls: 'cc-foot__more', onClick: () => handlers.onDuplicate?.(row) }),
    button('', { size: 'sm', iconName: 'trash', variant: 'ghost', cls: 'cc-foot__more is-danger', onClick: () => handlers.onDelete?.(row) }),
  );
  append(card, foot);
  return card;
}

export function insightCard(insight) {
  const meta = insight.level === 'good'
    ? { color: 'var(--ok)', icon: 'check', label: 'Sudah bagus' }
    : insight.level === 'high'
      ? { color: 'var(--danger)', icon: 'alert', label: 'Prioritas tinggi' }
      : insight.level === 'medium'
        ? { color: 'var(--warn)', icon: 'bulb', label: 'Perlu diperbaiki' }
        : { color: 'var(--info)', icon: 'spark', label: 'Optimasi kecil' };
  const card = el('article', { class: `insight-card insight-card--${insight.level}`, style: { '--ic': meta.color } });
  const head = el('header', { class: 'insight-card__head' });
  const ic = el('span', { class: 'insight-card__icon' });
  ic.innerHTML = svgIcon(meta.icon, 17);
  append(head, ic, el('h4', { text: insight.title }), el('span', { class: 'badge', text: meta.label }));
  append(card, head);
  append(card, el('p', { class: 'insight-card__detail', text: insight.detail }));
  if (insight.action) {
    const act = el('div', { class: 'insight-card__action' });
    const b = el('span', { class: 'insight-card__bulb' });
    b.innerHTML = svgIcon('bulb', 15);
    append(act, b, el('p', { text: insight.action }));
    append(card, act);
  }
  return card;
}

export function panel(title, content, { subtitle = '', actions = null, cls = '' } = {}) {
  const p = el('section', { class: `panel ${cls}`.trim() });
  const head = el('header', { class: 'panel__head' });
  const titles = el('div');
  append(titles, el('h3', { text: title }));
  if (subtitle) append(titles, el('p', { class: 'muted small', text: subtitle }));
  append(head, titles);
  if (actions) append(head, el('div', { class: 'panel__actions' }, actions));
  append(p, head);
  const body = el('div', { class: 'panel__body' });
  if (content instanceof Node) append(body, content);
  else if (typeof content === 'string') body.innerHTML = content;
  append(p, body);
  return p;
}

export function gaugeCard(value, { label, sub, size = 160 } = {}) {
  const wrap = el('div', { class: 'gauge-card' });
  append(wrap, gauge(value, { size, label }));
  if (sub) append(wrap, el('p', { class: 'gauge-card__sub', text: sub }));
  return wrap;
}

export function copyRow(text) {
  const row = el('div', { class: 'copy-row' });
  append(row, el('code', { class: 'copy-row__text', text }));
  append(row, iconButton('copy', { title: 'Salin', onClick: async () => { await copyText(text); toastSuccess('Disalin.'); } }));
  return row;
}

export const HELP = {
  configPath: 'js/core/config.js',
  school: SCHOOL_PROFILE,
  app: APP,
  icons: ICONS,
};
