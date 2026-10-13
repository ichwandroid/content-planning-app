/**
 * views/planner.js — Halaman Planner: daftar konten (grid/list/board), ekspor CSV,
 * generator ide konten, dan aksi cepat per kartu.
 */

import { PILARS, PLATFORMS, STATUSES } from '../core/config.js';
import { PLATFORM_BADGE, fmtCompact, fmtDate, fmtDecimal, fmtNumber, fmtTime, todayISO, toISODate } from '../core/format.js';
import { $, $$, append, download, el, escapeHtml, openExternal } from '../core/util.js';
import * as anim from '../lib/anim.js';

import { analyzeRow, engagementRate } from '../analytics/metrics.js';
import { auditContent, generateIdeas, suggestPilar } from '../analytics/insight.js';
import * as store from '../data/store.js';
import { toSheetRow } from '../data/sheet.js';
import {
  avatar, button, confirmDialog, contentCard, ctaChip, emptyState, icon, kpiCell, openModal, panel,
  pilarChip, platformBadge, scoreRing, skeletonCards, statusPill, table, toast, toastError,
  toastSuccess, toastWarn,
} from '../ui/components.js';
import { duplicateContent, openAnalysis, openEdit, openPreview } from './editor.js';

const handlers = {
  onEdit: (row) => openEdit(row),
  onAnalyze: (row) => openAnalysis(row),
  onPreview: (row) => openPreview(row),
  onDuplicate: (row) => duplicateContent(row),
  onDelete: (row) => confirmDelete(row),
};

let root = null;

/* -------------------------------- RENDER ------------------------------- */

export function renderPlanner() {
  root = $('#planner-grid');
  if (!root) return;
  const rows = store.filteredRows();
  const layout = store.state.layout;
  root.dataset.layout = layout;
  root.innerHTML = '';

  if (!rows.length) {
    append(root, emptyState({
      title: 'Belum ada konten yang cocok',
      message: store.state.rows.length
        ? 'Coba ubah kata kunci pencarian atau reset filter.'
        : 'Mulai dengan menambahkan konten pertama, atau isi data contoh dari halaman Pengaturan.',
      actionLabel: 'Tambah konten pertama',
      onAction: () => openEdit({ tanggal: todayISO(), platform: 'instagram', pilar: 'edukasi' }),
    }));
    return;
  }

  if (layout === 'board') renderBoard(rows);
  else if (layout === 'list') renderList(rows);
  else renderGrid(rows);

  anim.animateCards(root, '.content-card');
  anim.animateListRows(root, '.list-row');
  anim.attachCardTilt(root);
}

function renderGrid(rows) {
  const frag = document.createDocumentFragment();
  rows.forEach((row) => append(frag, contentCard(row, analyzeRow(row).kpi, handlers)));
  append(root, frag);
}

function renderList(rows) {
  const columns = [
    { key: 'judul', label: 'Konten' },
    { key: 'tanggal', label: 'Jadwal' },
    { key: 'platform', label: 'Platform' },
    { key: 'pilar', label: 'Pilar' },
    { key: 'status', label: 'Status' },
    { key: 'views', label: 'Views', align: 'right' },
    { key: 'er', label: 'ER', align: 'right' },
    { key: 'score', label: 'Skor', align: 'right' },
    { key: 'aksi', label: '' },
  ];
  const t = table(columns, rows, {
    renderCell: (row, col) => {
      const kpi = analyzeRow(row).kpi;
      switch (col.key) {
        case 'judul': {
          const wrap = el('div', { class: 'cell-title' });
          append(wrap, el('strong', { text: row.judul || '(tanpa judul)' }));
          if (row.caption) append(wrap, el('small', { class: 'muted', text: `${row.caption.slice(0, 70)}${row.caption.length > 70 ? '…' : ''}` }));
          return wrap;
        }
        case 'tanggal': return `${fmtDate(row.tanggal, 'compact')} • ${fmtTime(row.jam)}`;
        case 'platform': return platformBadge(row.platform, { size: 'sm' });
        case 'pilar': return pilarChip(row.pilar);
        case 'status': return statusPill(row.status);
        case 'views': return fmtCompact(row.views || 0);
        case 'er': return `${fmtDecimal(kpi.er)}%`;
        case 'score': return row.status === 'tayang' ? scoreRing(kpi.score, { size: 40 }) : '—';
        case 'aksi': {
          const wrap = el('div', { class: 'row-actions' });
          append(wrap, 
            button('Analisis', { size: 'sm', iconName: 'chart', onClick: (e) => { e.stopPropagation(); openAnalysis(row); } }),
            button('Edit', { size: 'sm', iconName: 'edit', variant: 'ghost', onClick: (e) => { e.stopPropagation(); openEdit(row); } }),
          );
          return wrap;
        }
        default: return '';
      }
    },
    onRowClick: (row) => openAnalysis(row),
  });
  t.classList.add('table-wrap--list');
  append(root, t);
}

function renderBoard(rows) {
  const order = ['ide', 'draf', 'review', 'siap', 'tayang', 'arsip'];
  const board = el('div', { class: 'board' });
  order.forEach((statusId) => {
    const items = rows.filter((r) => (r.status || 'ide') === statusId);
    const col = el('section', { class: 'board-col', dataset: { status: statusId } });
    const head = el('header', { class: 'board-col__head', style: { '--st': STATUSES[statusId]?.color || '#94A3B8' } });
    append(head, el('h4', { text: STATUSES[statusId]?.label || statusId }), el('span', { class: 'badge', text: String(items.length) }));
    append(col, head);
    const bodyEl = el('div', { class: 'board-col__body' });
    items.forEach((row) => {
      const analyze = analyzeRow(row);
      const mini = el('article', {
        class: 'board-card',
        draggable: 'true',
        dataset: { id: row.id },
        style: { '--pf': PLATFORMS[row.platform]?.color || '#64748B' },
      });
      append(mini, 
        el('div', { class: 'board-card__top' }, [platformBadge(row.platform, { size: 'sm' }), el('span', { class: 'small muted', text: fmtDate(row.tanggal, 'compact') })]),
        el('h5', { text: row.judul || '(tanpa judul)' }),
        el('div', { class: 'board-card__meta' }, [
          pilarChip(row.pilar),
          row.status === 'tayang' ? el('span', { class: 'small', text: `${fmtCompact(row.views || 0)} views • ${fmtDecimal(analyze.kpi.er)}%` }) : ctaChip(row.cta_jenis),
        ]),
      );
      const acts = el('div', { class: 'board-card__actions' });
      append(acts, 
        button('', { size: 'sm', iconName: 'edit', variant: 'ghost', onClick: () => openEdit(row) }),
        button('', { size: 'sm', iconName: 'chart', variant: 'ghost', onClick: () => openAnalysis(row) }),
      );
      append(mini, acts);
      mini.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', row.id);
        e.dataTransfer.effectAllowed = 'move';
        mini.classList.add('is-dragging');
      });
      mini.addEventListener('dragend', () => mini.classList.remove('is-dragging'));
      mini.addEventListener('click', () => openAnalysis(row));
      append(bodyEl, mini);
    });
    if (!items.length) append(bodyEl, el('p', { class: 'board-col__empty muted small', text: 'Kosong' }));
    append(col, bodyEl);

    col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('is-over'); });
    col.addEventListener('dragleave', () => col.classList.remove('is-over'));
    col.addEventListener('drop', async (e) => {
      e.preventDefault();
      col.classList.remove('is-over');
      const id = e.dataTransfer.getData('text/plain');
      const row = store.getRow(id);
      if (!row || row.status === statusId) return;
      await store.upsert({ ...row, status: statusId });
      toastSuccess(`"${row.judul || 'Konten'}" dipindah ke ${STATUSES[statusId]?.label}.`);
    });
    append(board, col);
  });
  append(root, board);
}

/* ------------------------------- ACTIONS ------------------------------- */

function confirmDelete(row) {
  confirmDialog({
    title: 'Hapus konten?',
    message: `"${row.judul || 'Konten tanpa judul'}" akan dihapus dari Sheet. Tindakan ini tidak bisa dibatalkan.`,
    confirmLabel: 'Hapus permanen',
    onConfirm: async () => {
      await store.remove(row.id);
      const sync = store.pendingCount();
      toastSuccess(sync ? 'Konten dihapus lokal — antrean sinkronisasi menunggu.' : 'Konten dihapus dari Google Sheet.');
    },
  });
}

/* ------------------------------- EXPORT -------------------------------- */

export function exportCsv() {
  const rows = store.filteredRows();
  if (!rows.length) return toastWarn('Tidak ada data untuk diekspor.');
  const headers = ['ID', 'Tanggal', 'Jam', 'Judul', 'Platform', 'Format', 'Pilar', 'Status', 'Caption', 'Hashtag',
    'CTA Jenis', 'CTA Teks', 'CTA Link', 'PIC', 'Views', 'Likes', 'Comments', 'Shares', 'Saves', 'Followers Gain',
    'Klik Link', 'Pendaftar', 'ER (%)', 'Skor', 'Skor Kelengkapan', 'Post URL'];
  const lines = [headers.join(',')];
  rows.forEach((r) => {
    const kpi = analyzeRow(r).kpi;
    const audit = auditContent(r, rows);
    const values = [
      r.id, r.tanggal, r.jam, r.judul, PLATFORMS[r.platform]?.label || r.platform, r.format,
      PILARS.find((p) => p.id === r.pilar)?.label || r.pilar, STATUSES[r.status]?.label || r.status,
      r.caption, r.hashtag, r.cta_jenis, r.cta_teks, r.cta_link, r.pic,
      r.views, r.likes, r.comments, r.shares, r.saves, r.followers_gain, r.klik_link, r.pendaftar,
      kpi.er, kpi.score, audit.score, r.post_url,
    ];
    lines.push(values.map(csvCell).join(','));
  });
  download(`content-plan-${toISODate(new Date())}.csv`, `\uFEFF${lines.join('\r\n')}`);
  toastSuccess(`${rows.length} baris diekspor ke CSV (bisa dibuka di Excel/Sheets).`);
}

function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/* --------------------------- GENERATOR IDE ----------------------------- */

export function openIdeasModal() {
  const body = el('div', { class: 'ideas-modal' });
  const controls = el('div', { class: 'field-row' });
  const pilarSelect = el('select', { class: 'input', id: 'ideas-pilar' });
  append(pilarSelect, el('option', { value: '', text: 'Semua pilar' }));
  PILARS.forEach((p) => append(pilarSelect, el('option', { value: p.id, text: `${p.emoji} ${p.label}` })));
  const platformSelect = el('select', { class: 'input', id: 'ideas-platform' });
  Object.entries(PLATFORMS).forEach(([id, p]) => append(platformSelect, el('option', { value: id, text: p.label })));
  append(controls, 
    el('label', { class: 'field' }, [el('span', { class: 'field__label', text: 'Pilar' }), pilarSelect]),
    el('label', { class: 'field' }, [el('span', { class: 'field__label', text: 'Platform' }), platformSelect]),
  );
  append(body, controls);

  const list = el('div', { class: 'ideas-list', id: 'ideas-list' });
  append(body, list);

  const renderIdeas = () => {
    list.innerHTML = '';
    const pilar = pilarSelect.value;
    const platform = platformSelect.value;
    generateIdeas({ pilar: pilar || 'edukasi', platform, count: 6 }).forEach((idea) => {
      const row = el('article', { class: 'idea-row' });
      append(row, 
        el('div', { class: 'idea-row__text' }, [
          el('strong', { text: idea }),
          el('small', { class: 'muted', text: `Pilar: ${PILARS.find((p) => p.id === pilar)?.label || 'otomatis'} • Platform: ${PLATFORMS[platform]?.label}` }),
        ]),
      );
      const acts = el('div', { class: 'idea-row__actions' });
      append(acts, 
        button('Tambah ke Planner', {
          size: 'sm', variant: 'primary', iconName: 'plus',
          onClick: async () => {
            const suggested = pilar || suggestPilar(idea) || 'edukasi';
            await store.upsert({
              judul: idea,
              platform,
              pilar: suggested,
              status: 'ide',
              tanggal: todayISO(),
              jam: PLATFORMS[platform]?.bestTime?.split('/')[0]?.trim()?.replace('.', ':') || '19:30',
              format: PLATFORMS[platform]?.types?.[0] || '',
              cta_jenis: suggested === 'ppdb' || suggested === 'testimoni' ? 'daftar' : 'simpan',
            });
            toastSuccess('Ide ditambahkan ke Planner sebagai status "Ide".');
          },
        }),
        button('', { size: 'sm', iconName: 'edit', variant: 'ghost', onClick: () => openEdit({ judul: idea, platform, pilar: pilar || suggestPilar(idea) || 'edukasi', tanggal: todayISO() }) }),
      );
      append(row, acts);
      append(list, row);
    });
    anim.animateListRows(list, '.idea-row');
  };

  pilarSelect.onchange = renderIdeas;
  platformSelect.onchange = renderIdeas;
  renderIdeas();

  const footer = el('div', { class: 'modal__actions' });
  let api;
  append(footer, 
    button('Acak ulang', { iconName: 'refresh', onClick: renderIdeas }),
    button('Tutup', { onClick: () => api.close() }),
  );
  api = openModal({ title: 'Generator Ide Konten', body, footer, wide: true });
}

/* ------------------------------- BINDINGS ------------------------------ */

export function bindPlanner() {
  $('#btn-export-csv')?.addEventListener('click', exportCsv);
  $('#btn-ideas')?.addEventListener('click', openIdeasModal);
}

export function renderSkeleton() {
  const grid = $('#planner-grid');
  if (!grid) return;
  grid.innerHTML = '';
  append(grid, skeletonCards(6));
}
