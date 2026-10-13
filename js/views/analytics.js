/**
 * views/analytics.js — Dashboard analitik: KPI, tren, breakdown, heatmap waktu tayang,
 * audit portofolio, dan daftar rekomendasi otomatis.
 */

import { ANALYTICS, PILARS, PLATFORMS, PILAR_TARGET, STATUSES } from '../core/config.js';
import {
  fmtCompact, fmtDate, fmtDecimal, fmtNumber, fmtPercent, fmtTime, toDate,
} from '../core/format.js';
import { $, append, el, escapeHtml, openExternal } from '../core/util.js';
import * as anim from '../lib/anim.js';

import {
  HEATMAP_LABELS, analyzeRow, breakdown, contentScore, engagementRate, heatmap, rank, summarize,
  timeline, topPerformers, underPerformers,
} from '../analytics/metrics.js';
import { auditPortfolio, portfolioInsights } from '../analytics/insight.js';
import * as store from '../data/store.js';
import { barChart, donutChart, emptyChart, gauge, heatmapChart, lineChart, progressBar } from '../lib/charts.js';
import {
  button, emptyState, gaugeCard, insightCard, openModal, panel, platformBadge, scoreRing, statusPill,
  table, toastSuccess,
} from '../ui/components.js';
import { openAnalysis, openEdit } from './editor.js';

let rangeDays = 90;

export function setRange(days) {
  rangeDays = days;
}

function scopedRows() {
  if (rangeDays === 'all' || !Number.isFinite(Number(rangeDays))) return store.state.rows;
  const cutoff = Date.now() - Number(rangeDays) * 86400000;
  return store.state.rows.filter((r) => {
    const t = toDate(r.tanggal)?.getTime();
    return !t || t >= cutoff;
  });
}

/* -------------------------------- RENDER ------------------------------- */

export function renderAnalytics() {
  const host = $('#analytics-root');
  if (!host) return;
  host.innerHTML = '';
  const rows = scopedRows();
  const analysis = portfolioInsights(rows);
  const audit = auditPortfolio(rows);
  const s = analysis.summary;

  /* 1. Baris KPI utama */
  append(host, buildKpiRow(s, rows, audit));

  if (!rows.length) {
    append(host, panel('Belum ada data', emptyState({
      title: 'Tidak ada konten pada periode ini',
      message: 'Ubah periode di kanan atas, atau tambahkan konten baru ke Google Sheet.',
      iconName: 'chart',
    })));
    return;
  }

  /* 2. Insight prioritas */
  const insightWrap = el('div', { class: 'insight-grid' });
  (analysis.insights.length ? analysis.insights : [{ level: 'low', title: 'Belum cukup data', detail: 'Isi metrik lebih banyak untuk mendapatkan rekomendasi.', action: 'Lengkapi kolom metrik di Sheet.' }])
    .slice(0, 8)
    .forEach((i) => append(insightWrap, insightCard(i)));
  append(host, panel('Rekomendasi otomatis', insightWrap, {
    subtitle: 'Dihasilkan dari pola data Anda: pilar, kanal, CTA, waktu tayang, dan tren.',
    cls: 'panel--wide',
  }));

  /* 3. Tren + komposisi */
  const trendPanel = panel('Tren performa', buildTrend(rows, analysis), { subtitle: 'Skor rata-rata & ER per bulan (klik legenda untuk ganti metrik).' });
  const mixPanel = panel('Komposisi konten', buildMix(rows), { subtitle: 'Distribusi pilar & kanal.' });
  append(host, trendPanel, mixPanel);

  /* 4. Performa per dimensi */
  const dims = [
    ['platform', 'Kanal sosial media'],
    ['pilar', 'Pilar konten'],
    ['format', 'Format konten'],
    ['cta', 'Jenis CTA'],
    ['hari', 'Hari tayang'],
    ['jam', 'Jam tayang'],
    ['pic', 'PIC / tim'],
  ];
  const dimGrid = el('div', { class: 'analytics-grid analytics-grid--inner' });
  dims.forEach(([dim, label]) => {
    const data = breakdown(rows, dim).filter((d) => d.count > 0);
    append(dimGrid, panel(label, data.length
      ? barChart(data.slice(0, 8).map((d) => ({ label: d.label, value: d.avgScore, sub: `${d.count} konten` })), { height: 230, format: (v) => fmtDecimal(v) })
      : emptyChart('Belum ada data'), { subtitle: 'Rata-rata skor konten (0–100).', cls: 'panel--compact' }));
  });
  append(host, panel('Performa per dimensi', dimGrid, { cls: 'panel--wide', subtitle: 'Semakin tinggi skor, semakin efektif kombinasi tersebut.' }));

  /* 5. Heatmap waktu tayang */
  append(host, panel('Waktu tayang terbaik', buildHeatmap(rows), {
    subtitle: 'Rata-rata ER per kombinasi hari & jam. Sel berwarna pekat = performa terbaik.',
    cls: 'panel--wide',
  }));

  /* 6. Leaderboard & yang perlu diperbaiki */
  const board = el('div', { class: 'analytics-grid analytics-grid--inner' });
  append(board, panel('Konten terbaik', buildRankList(topPerformers(rows, 6), 'good'), { subtitle: 'Jadikan template produksi.' }));
  append(board, panel('Perlu diperbaiki', buildRankList(underPerformers(rows, 6), 'bad'), { subtitle: 'Konten layak dievaluasi ulang.' }));
  append(host, board);

  /* 7. Matriks kanal x metrik */
  append(host, panel('Matriks kanal', buildMatrix(rows), { cls: 'panel--wide', subtitle: 'Bandingkan kanal berdasarkan ER, skor, klik, dan konversi.' }));

  /* 8. Audit kelengkapan */
  append(host, panel('Audit kelengkapan konten', buildAudit(audit), {
    cls: 'panel--wide',
    subtitle: `Rata-rata kelengkapan ${fmtDecimal(audit.avgCompleteness)}/100 • ${audit.totalFindings} temuan pada ${rows.length} konten.`,
  }));

  /* 9. Target pilar */
  append(host, panel('Pencapaian target per pilar', buildPilarTargets(rows), {
    cls: 'panel--wide',
    subtitle: 'Selisih ER aktual terhadap target internal tiap pilar.',
  }));

  anim.animateCharts(host);
  anim.animateListRows(host, '.rank-row');
}

/* --------------------------------- BAGIAN ------------------------------ */

function buildKpiRow(s, rows, audit) {
  const wrap = el('div', { class: 'analytics-kpi' });

  const gaugeWrap = el('div', { class: 'analytics-kpi__gauge' });
  append(gaugeWrap, gaugeCard(s.avgScore, {
    label: 'Skor rata-rata',
    sub: s.avgScore >= 70 ? 'Konten sehat — pertahankan pola.' : s.avgScore >= 55 ? 'Cukup baik, masih ada ruang naik.' : 'Perlu perbaikan hook, CTA, dan waktu tayang.',
    size: 170,
  }));
  append(wrap, gaugeWrap);

  const grid = el('div', { class: 'analytics-kpi__grid' });
  const bench = ANALYTICS.benchmarkER;
  const cards = [
    ['Total konten', fmtNumber(s.total), `${s.published} tayang • ${s.planned} rencana`, 'grid', 'teal'],
    ['Jangkauan', fmtCompact(s.reach), 'akumulasi views', 'eye', 'blue'],
    ['Interaksi', fmtCompact(s.interactions), `${fmtCompact(s.saves)} simpan • ${fmtCompact(s.shares)} bagikan`, 'heart', 'rose'],
    ['Rata-rata ER', `${fmtDecimal(s.er)}%`, `benchmark ±${fmtDecimal(Object.values(bench).reduce((a, b) => a + b, 0) / Object.keys(bench).length)}%`, 'chart', 'purple'],
    ['Klik link', fmtCompact(s.clicks), `CTR ${fmtDecimal(s.ctr)}%`, 'link', 'cyan'],
    ['Pendaftar', fmtNumber(s.daftar), s.clicks ? `konversi ${fmtPercent((s.daftar / s.clicks) * 100)} dari klik` : 'belum ada klik tercatat', 'users', 'gold'],
    ['Followers baru', fmtCompact(s.growth), 'dari konten tayang', 'users', 'teal'],
    ['Kelengkapan', `${fmtDecimal(audit.avgCompleteness)}/100`, `${audit.byLevel.high} temuan prioritas tinggi`, 'check', s.avgScore >= 60 ? 'teal' : 'gold'],
  ];
  cards.forEach(([label, value, sub, ic, tone]) => {
    const card = el('article', { class: `mini-stat mini-stat--${tone}` });
    const head = el('div', { class: 'mini-stat__head' });
    const iconEl = el('span', { class: 'mini-stat__icon' });
    iconEl.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">${ICON_PATHS[ic] || ''}</svg>`;
    append(head, iconEl, el('span', { class: 'mini-stat__label', text: label }));
    append(card, head, el('strong', { class: 'mini-stat__value', text: value }), el('span', { class: 'mini-stat__sub', text: sub }));
    append(grid, card);
  });
  append(wrap, grid);
  return wrap;
}

const ICON_PATHS = {
  grid: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
  eye: '<path d="M2.8 12S6 6.8 12 6.8 21.2 12 21.2 12 18 17.2 12 17.2 2.8 12 2.8 12Z" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="2.6" stroke="currentColor" stroke-width="1.7"/>',
  heart: '<path d="M12 19s-6.5-4-6.5-8.4A3.6 3.6 0 0 1 12 8.2a3.6 3.6 0 0 1 6.5 2.4C18.5 15 12 19 12 19Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
  chart: '<path d="M4 20V4M4 20h16" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><rect x="7.5" y="12" width="3" height="5" rx="1" stroke="currentColor" stroke-width="1.7"/><rect x="13" y="8" width="3" height="9" rx="1" stroke="currentColor" stroke-width="1.7"/>',
  link: '<path d="M10 14a4 4 0 0 1 0-5.6l2-2a4 4 0 1 1 5.6 5.6l-1 1M14 10a4 4 0 0 1 0 5.6l-2 2A4 4 0 0 1 6.4 12l1-1" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  users: '<circle cx="9.5" cy="8.5" r="3.2" stroke="currentColor" stroke-width="1.7"/><path d="M3.8 19.5c.6-3 2.9-4.8 5.7-4.8s5.1 1.8 5.7 4.8M16 5.6a3.2 3.2 0 0 1 0 6.3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
};

function buildTrend(rows, analysis) {
  const wrap = el('div', { class: 'trend-block' });
  const monthly = timeline(rows, { granularity: 'month' });
  const daily = timeline(rows, { granularity: 'day' });

  if (!monthly.length) return emptyChart('Belum ada data tren');

  const chartHost = el('div', { class: 'trend-chart' });
  append(chartHost, lineChart(monthly.map((m) => ({ label: m.key.slice(5), value: m.score })), {
    width: 680, height: 240, color: '#0F766E', format: (v) => fmtDecimal(v), label: 'Skor rata-rata per bulan',
  }));
  append(wrap, chartHost);

  const toggles = el('div', { class: 'trend-toggles' });
  const options = [
    ['score', 'Skor', '#0F766E'],
    ['er', 'ER %', '#7C3AED'],
    ['reach', 'Jangkauan', '#0EA5E9'],
    ['interactions', 'Interaksi', '#E11D48'],
    ['clicks', 'Klik', '#F59E0B'],
  ];
  options.forEach(([key, label, color], i) => {
    const b = button(label, {
      size: 'sm',
      variant: i === 0 ? 'primary' : 'ghost',
      onClick: () => {
        chartHost.innerHTML = '';
        append(chartHost, lineChart(monthly.map((m) => ({ label: m.key.slice(5), value: m[key] })), {
          width: 680, height: 240, color, format: (v) => (key === 'er' ? `${fmtDecimal(v)}%` : fmtCompact(v)),
        }));
        anim.animateCharts(chartHost);
        toggles.querySelectorAll('.btn').forEach((n) => n.classList.replace('btn--primary', 'btn--ghost'));
        b.classList.replace('btn--ghost', 'btn--primary');
      },
    });
    append(toggles, b);
  });
  append(wrap, toggles);

  const sparkRow = el('div', { class: 'spark-row' });
  const last30 = daily.slice(-30);
  if (last30.length) {
    const card = el('div', { class: 'spark-card' });
    append(card, 
      el('span', { class: 'spark-card__label', text: 'Skor harian (30 hari terakhir)' }),
      el('strong', { class: 'spark-card__value', text: fmtDecimal(last30[last30.length - 1].score) }),
    );
    append(card, lineChart(last30.map((d) => ({ label: d.key.slice(8), value: d.score })), { width: 420, height: 120, color: '#C9A227' }));
    append(sparkRow, card);
  }
  append(wrap, sparkRow);
  return wrap;
}

function buildMix(rows) {
  const wrap = el('div', { class: 'mix-block' });
  const byPilar = breakdown(rows, 'pilar');
  const byPlatform = breakdown(rows, 'platform');
  const donut1 = donutChart(byPilar.map((p) => ({ label: p.label, value: p.count })), { size: 190, centerLabel: 'konten', centerValue: fmtNumber(rows.length) });
  const donut2 = donutChart(byPlatform.map((p) => ({ label: p.label, value: p.count })), { size: 190, centerLabel: 'kanal aktif', centerValue: fmtNumber(byPlatform.length) });
  append(wrap, el('div', { class: 'mix-item' }, [el('h4', { text: 'Berdasarkan pilar' }), donut1]));
  append(wrap, el('div', { class: 'mix-item' }, [el('h4', { text: 'Berdasarkan kanal' }), donut2]));
  return wrap;
}

function buildHeatmap(rows) {
  const grid = heatmap(rows);
  grid.forEach((rowArr, d) => rowArr.forEach((c, h) => { c.hourIndex = h; }));
  const wrap = el('div', { class: 'heatmap-block' });
  append(wrap, heatmapChart(grid, { days: HEATMAP_LABELS.days, hours: HEATMAP_LABELS.hours }));
  let best = null;
  grid.forEach((rowArr, d) => rowArr.forEach((c) => {
    if (c.count >= 2 && c.er > (best?.er ?? 0)) best = { ...c, day: d };
  }));
  if (best) {
    append(wrap, el('p', {
      class: 'heatmap-note',
      html: `<strong>Rekomendasi jadwal:</strong> hari <strong>${HEATMAP_LABELS.days[best.day]}</strong> pada rentang <strong>${HEATMAP_LABELS.hours[best.hourIndex]}</strong> WIB memberi ER rata-rata ${fmtDecimal(best.er)}% dari ${best.count} konten.`,
    }));
  }
  return wrap;
}

function buildRankList(list, tone) {
  const wrap = el('div', { class: 'rank-list' });
  if (!list.length) return emptyChart('Belum ada konten tayang dengan metrik');
  list.forEach((row, i) => {
    const kpi = analyzeRow(row).kpi;
    const item = el('article', { class: `rank-row rank-row--${tone}` });
    append(item, el('span', { class: 'rank-row__no', text: `#${i + 1}` }));
    const main = el('div', { class: 'rank-row__main' });
    append(main, 
      el('strong', { class: 'rank-row__title', text: row.judul || '(tanpa judul)' }),
      el('span', { class: 'rank-row__meta muted small', text: `${PLATFORMS[row.platform]?.label || row.platform} • ${fmtDate(row.tanggal, 'compact')} • ${fmtCompact(row.views || 0)} views • ER ${fmtDecimal(kpi.er)}%` }),
    );
    append(item, main, scoreRing(kpi.score, { size: 46 }));
    const acts = el('div', { class: 'rank-row__actions' });
    append(acts, 
      button('Analisis', { size: 'sm', variant: 'ghost', iconName: 'chart', onClick: () => openAnalysis(row) }),
      row.post_url ? button('', { size: 'sm', variant: 'ghost', iconName: 'external', onClick: () => openExternal(row.post_url) }) : null,
    );
    append(item, acts);
    append(wrap, item);
  });
  return wrap;
}

function buildMatrix(rows) {
  const data = breakdown(rows, 'platform');
  const columns = [
    { key: 'label', label: 'Kanal' },
    { key: 'count', label: 'Konten', align: 'right' },
    { key: 'reach', label: 'Jangkauan', align: 'right' },
    { key: 'avgViews', label: 'Rata-rata views', align: 'right' },
    { key: 'er', label: 'ER', align: 'right' },
    { key: 'avgScore', label: 'Skor', align: 'right' },
    { key: 'clicks', label: 'Klik', align: 'right' },
    { key: 'daftar', label: 'Pendaftar', align: 'right' },
  ];
  return table(columns, data, {
    renderCell: (row, col) => {
      switch (col.key) {
        case 'label': return el('div', { class: 'cell-inline' }, [platformBadge(row.key, { size: 'sm' }), el('span', { text: row.label })]);
        case 'reach': return fmtCompact(row.reach);
        case 'avgViews': return fmtCompact(row.avgViews);
        case 'er': return `${fmtDecimal(row.er)}%`;
        case 'avgScore': return scoreRing(row.avgScore, { size: 40 });
        default: return fmtNumber(row[col.key]);
      }
    },
  });
}

function buildAudit(audit) {
  const wrap = el('div', { class: 'audit-block' });
  const summary = el('div', { class: 'audit-summary' });
  append(summary, 
    el('div', { class: 'audit-badge audit-badge--high' }, [el('strong', { text: fmtNumber(audit.byLevel.high) }), el('span', { text: 'prioritas tinggi' })]),
    el('div', { class: 'audit-badge audit-badge--medium' }, [el('strong', { text: fmtNumber(audit.byLevel.medium) }), el('span', { text: 'perlu diperbaiki' })]),
    el('div', { class: 'audit-badge audit-badge--low' }, [el('strong', { text: fmtNumber(audit.byLevel.low) }), el('span', { text: 'optimasi kecil' })]),
  );
  append(wrap, summary);

  const list = el('div', { class: 'audit-list' });
  audit.weakest.forEach(({ row, score, findings }) => {
    const item = el('article', { class: 'audit-row' });
    const head = el('div', { class: 'audit-row__head' });
    append(head, 
      scoreRing(score, { size: 44 }),
      el('div', {}, [
        el('strong', { text: row.judul || '(tanpa judul)' }),
        el('span', { class: 'muted small', text: `${PLATFORMS[row.platform]?.label || row.platform} • ${STATUSES[row.status]?.label || row.status} • ${fmtDate(row.tanggal, 'compact')}` }),
      ]),
      statusPill(row.status),
    );
    append(item, head);
    const top = findings.filter((f) => f.level !== 'good').slice(0, 3);
    if (top.length) {
      const ul = el('ul', { class: 'audit-row__findings' });
      top.forEach((f) => append(ul, el('li', { html: `<strong>${escapeHtml(f.title)}</strong> — ${escapeHtml(f.fix || f.detail)}` })));
      append(item, ul);
    }
    const acts = el('div', { class: 'audit-row__actions' });
    append(acts, button('Perbaiki sekarang', { size: 'sm', variant: 'primary', iconName: 'edit', onClick: () => openEdit(row) }));
    append(item, acts);
    append(list, item);
  });
  if (!audit.weakest.length) append(list, emptyChart('Belum ada konten untuk diaudit'));
  append(wrap, list);
  return wrap;
}

function buildPilarTargets(rows) {
  const data = breakdown(rows, 'pilar').filter((d) => d.count);
  const wrap = el('div', { class: 'target-grid' });
  if (!data.length) return emptyChart('Belum ada data pilar');
  data.forEach((d) => {
    const target = PILAR_TARGET[d.key]?.er ?? 3;
    const ratio = target ? (d.er / target) * 100 : 0;
    const tone = ratio >= 100 ? 'var(--ok)' : ratio >= 70 ? 'var(--info)' : ratio >= 50 ? 'var(--warn)' : 'var(--danger)';
    const card = el('article', { class: 'target-card' });
    const pilar = PILARS.find((p) => p.id === d.key);
    append(card, 
      el('div', { class: 'target-card__head' }, [
        el('span', { class: 'target-card__emoji', text: pilar?.emoji || '•' }),
        el('div', {}, [el('strong', { text: d.label }), el('span', { class: 'muted small', text: `${d.count} konten • ${fmtCompact(d.reach)} views` })]),
      ]),
      el('div', { class: 'target-card__values' }, [
        el('span', { html: `<small>ER aktual</small><strong>${fmtDecimal(d.er)}%</strong>` }),
        el('span', { html: `<small>Target</small><strong>${fmtDecimal(target)}%</strong>` }),
      ]),
      progressBar(Math.min(150, ratio), { max: 100, tone, label: ratio >= 100 ? `Tercapai (${Math.round(ratio)}%)` : `${Math.round(ratio)}% dari target` }),
    );
    append(wrap, card);
  });
  return wrap;
}

/* ------------------------------- BINDINGS ------------------------------ */

export function bindAnalytics({ onReload } = {}) {
  const sel = $('#an-range');
  if (sel) {
    sel.value = String(rangeDays);
    sel.addEventListener('change', () => {
      rangeDays = sel.value === 'all' ? 'all' : Number(sel.value);
      renderAnalytics();
    });
  }
  $('#btn-recheck')?.addEventListener('click', () => onReload?.());
}
