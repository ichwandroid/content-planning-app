/**
 * views/calendar.js — Kalender editorial bulanan + drag & drop penjadwalan ulang.
 */

import { PLATFORMS, STATUSES } from '../core/config.js';
import {
  HBULAN, HHARI, fmtCompact, fmtDate, fmtDecimal, fmtNumber, fmtTime, labelJadwal, toISODate,
} from '../core/format.js';
import { $, append, el, escapeHtml } from '../core/util.js';
import * as anim from '../lib/anim.js';

import { analyzeRow } from '../analytics/metrics.js';
import * as store from '../data/store.js';
import { button, icon, platformBadge, statusPill, toastSuccess } from '../ui/components.js';
import { openAnalysis, openEdit, openNew } from './editor.js';

let cursor = new Date();

export function setCursor(date) {
  cursor = date;
}

export function renderCalendar() {
  const host = $('#calendar');
  const title = $('#cal-title');
  if (!host) return;

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  title.textContent = `${HBULAN[month]} ${year}`;

  const first = new Date(year, month, 1);
  const startOffset = first.getDay(); // 0 = Ahad
  const gridStart = new Date(year, month, 1 - startOffset);
  const todayISO = toISODate(new Date());
  const rows = store.filteredRows().filter((r) => r.tanggal);

  const byDate = rows.reduce((acc, r) => {
    const key = r.tanggal;
    (acc[key] ||= []).push(r);
    return acc;
  }, {});

  host.innerHTML = '';

  HHARI.forEach((d) => append(host, el('div', { class: 'cal-head', text: d })));

  for (let i = 0; i < 42; i += 1) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    const iso = toISODate(date);
    const items = byDate[iso] || [];
    const cell = el('div', {
      class: `cal-cell ${date.getMonth() !== month ? 'is-other-month' : ''} ${iso === todayISO ? 'is-today' : ''}`.trim(),
      dataset: { date: iso },
    });

    const head = el('div', { class: 'cal-cell__head' });
    const dateNum = el('span', { class: 'cal-date__num', text: String(date.getDate()) });
    const dateBox = el('span', { class: 'cal-date' }, [dateNum]);
    append(head, dateBox);
    if (items.length) append(head, el('span', { class: 'cal-count', text: `${items.length} konten` }));
    append(cell, head);

    const list = el('div', { class: 'cal-cell__items' });
    items
      .sort((a, b) => String(a.jam || '').localeCompare(String(b.jam || '')))
      .forEach((row) => {
        const p = PLATFORMS[row.platform] || { color: '#64748B', label: row.platform };
        const chip = el('button', {
          class: `cal-item cal-item--${row.status || 'ide'}`,
          type: 'button',
          draggable: 'true',
          style: { '--pf': p.color },
          dataset: { id: row.id },
          title: `${row.judul}\n${fmtDate(row.tanggal, 'full')} • ${fmtTime(row.jam)} • ${STATUSES[row.status]?.label || ''}`,
        });
        append(chip, 
          el('span', { class: 'cal-item__dot' }),
          el('span', { class: 'cal-item__time', text: row.jam ? fmtTime(row.jam) : '--.--' }),
          el('span', { class: 'cal-item__title', text: row.judul || '(tanpa judul)' }),
        );
        chip.addEventListener('click', () => openAnalysis(row));
        chip.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', row.id);
          e.dataTransfer.effectAllowed = 'move';
          chip.classList.add('is-dragging');
        });
        chip.addEventListener('dragend', () => chip.classList.remove('is-dragging'));
        append(list, chip);
      });
    append(cell, list);

    cell.addEventListener('dragover', (e) => { e.preventDefault(); cell.classList.add('is-over'); });
    cell.addEventListener('dragleave', () => cell.classList.remove('is-over'));
    cell.addEventListener('drop', async (e) => {
      e.preventDefault();
      cell.classList.remove('is-over');
      const id = e.dataTransfer.getData('text/plain');
      const row = store.getRow(id);
      if (!row || row.tanggal === iso) return;
      await store.upsert({ ...row, tanggal: iso });
      toastSuccess(`"${row.judul || 'Konten'}" dijadwalkan ${fmtDate(iso, 'full')} (${labelJadwal(iso)}).`);
    });

    // klik area kosong = buat konten pada tanggal itu
    cell.addEventListener('dblclick', (e) => {
      if (e.target.closest('.cal-item')) return;
      openNew({ tanggal: iso });
    });

    append(host, cell);
  }

  anim.animateListRows(host, '.cal-item');
  renderLegend();
}

function renderLegend() {
  const host = $('#cal-legend');
  if (!host) return;
  host.innerHTML = '';
  const items = Object.entries(PLATFORMS).map(([id, p]) => el('span', { class: 'legend-item' }, [
    el('span', { class: 'legend-dot', style: { background: p.color } }),
    el('span', { text: p.label }),
  ]));
  const statusLegend = Object.entries(STATUSES).map(([id, s]) => el('span', { class: 'legend-chip', style: { '--st': s.color } }, [
    el('span', { class: 'legend-dot', style: { background: s.color } }),
    el('span', { text: s.label }),
  ]));
  append(host, 
    el('div', { class: 'legend-group' }, [el('strong', { text: 'Warna platform:' }), ...items]),
    el('div', { class: 'legend-group' }, [el('strong', { text: 'Status:' }), ...statusLegend]),
  );
}

export function bindCalendar() {
  $('#cal-prev')?.addEventListener('click', () => {
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
    renderCalendar();
  });
  $('#cal-next')?.addEventListener('click', () => {
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    renderCalendar();
  });
  $('#cal-today')?.addEventListener('click', () => {
    cursor = new Date();
    renderCalendar();
  });
  $('#btn-print')?.addEventListener('click', () => window.print());
}

/** Ringkasan bulan berjalan untuk header kalender. */
export function monthSummary() {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const rows = store.state.rows.filter((r) => {
    const d = new Date(r.tanggal);
    return d.getFullYear() === year && d.getMonth() === month;
  });
  const tayang = rows.filter((r) => r.status === 'tayang');
  const reach = tayang.reduce((a, r) => a + (Number(r.views) || 0), 0);
  return {
    total: rows.length,
    tayang: tayang.length,
    reach,
    avgEr: tayang.length ? tayang.reduce((a, r) => a + analyzeRow(r).kpi.er, 0) / tayang.length : 0,
  };
}
