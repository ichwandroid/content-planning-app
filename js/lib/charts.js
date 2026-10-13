/**
 * lib/charts.js — Grafik SVG ringan tanpa dependensi.
 * Semua elemen animasi diberi atribut [data-anim] supaya GSAP bisa
 * menganimasikannya dari anim.js (draw-in untuk garis, scale-y untuk batang).
 */

import { fmtCompact, fmtDecimal, fmtNumber, fmtPercent } from '../core/format.js';

const NS = 'http://www.w3.org/2000/svg';
const PALETTE = ['#0F766E', '#F59E0B', '#7C3AED', '#E11D48', '#0EA5E9', '#65A30D', '#DB2777', '#0891B2', '#4F46E5', '#CA8A04'];

function svgEl(name, attrs = {}) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    node.setAttribute(k, String(v));
  }
  return node;
}

function tooltip(text) {
  const t = svgEl('title');
  t.textContent = text;
  return t;
}

const color = (i) => PALETTE[i % PALETTE.length];

/* ------------------------------- LINE ---------------------------------- */

/**
 * Grafik garis dengan area.
 * @param {Array<{label:string, value:number}>} data
 */
export function lineChart(data, { width = 640, height = 220, color: stroke = '#0F766E', format = fmtCompact, area = true, label = '' } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'chart chart-line';
  if (!data?.length) return emptyChart('Belum ada data tren', width, height);

  const pad = { t: 18, r: 14, b: 26, l: 44 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const values = data.map((d) => Number(d.value) || 0);
  const max = Math.max(...values, 1) * 1.15;

  const x = (i) => pad.l + (data.length === 1 ? w / 2 : (i / (data.length - 1)) * w);
  const y = (v) => pad.t + h - (v / max) * h;

  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, class: 'chart-svg', role: 'img', 'aria-label': label || 'Grafik tren' });

  // grid + label sumbu Y
  const steps = 4;
  for (let i = 0; i <= steps; i += 1) {
    const v = (max / steps) * i;
    const gy = y(v);
    svg.append(svgEl('line', { x1: pad.l, x2: pad.l + w, y1: gy, y2: gy, class: 'chart-grid' }));
    const t = svgEl('text', { x: pad.l - 8, y: gy + 4, class: 'chart-axis', 'text-anchor': 'end' });
    t.textContent = format(v);
    svg.append(t);
  }

  const linePath = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(values[i]).toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${x(data.length - 1).toFixed(1)},${pad.t + h} L${x(0).toFixed(1)},${pad.t + h} Z`;

  const defs = svgEl('defs');
  const grad = svgEl('linearGradient', { id: `grad-${Math.random().toString(36).slice(2, 7)}`, x1: 0, y1: 0, x2: 0, y2: 1 });
  grad.append(svgEl('stop', { offset: '0%', 'stop-color': stroke, 'stop-opacity': 0.32 }));
  grad.append(svgEl('stop', { offset: '100%', 'stop-color': stroke, 'stop-opacity': 0.02 }));
  defs.append(grad);
  svg.append(defs);

  if (area) svg.append(svgEl('path', { d: areaPath, fill: `url(#${grad.id})`, class: 'chart-area', 'data-anim': 'fade' }));

  const path = svgEl('path', { d: linePath, fill: 'none', stroke, 'stroke-width': 2.6, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', class: 'chart-line-path', 'data-anim': 'draw' });
  svg.append(path);

  data.forEach((d, i) => {
    const dot = svgEl('circle', { cx: x(i), cy: y(values[i]), r: 4, fill: '#fff', stroke, 'stroke-width': 2.4, class: 'chart-dot', 'data-anim': 'pop' });
    dot.append(tooltip(`${d.label}: ${format(values[i])}`));
    svg.append(dot);
  });

  // label sumbu X (maks 6 label agar tidak bertumpuk)
  const step = Math.ceil(data.length / 6);
  data.forEach((d, i) => {
    if (i % step !== 0 && i !== data.length - 1) return;
    const t = svgEl('text', { x: x(i), y: height - 6, class: 'chart-axis', 'text-anchor': 'middle' });
    t.textContent = d.label;
    svg.append(t);
  });

  wrap.append(svg);
  return wrap;
}

/* -------------------------------- BAR ---------------------------------- */

export function barChart(data, { width = 640, height = 240, format = fmtCompact, horizontal = false, colorByIndex = true, label = '' } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'chart chart-bar';
  if (!data?.length) return emptyChart('Belum ada data perbandingan', width, height);

  const pad = horizontal ? { t: 10, r: 60, b: 10, l: 120 } : { t: 18, r: 14, b: 46, l: 46 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const max = Math.max(...data.map((d) => Number(d.value) || 0), 1);
  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, class: 'chart-svg', role: 'img', 'aria-label': label || 'Grafik batang' });

  if (horizontal) {
    const band = h / data.length;
    const barH = Math.min(26, band * 0.62);
    data.forEach((d, i) => {
      const val = Number(d.value) || 0;
      const len = (val / max) * w;
      const yy = pad.t + band * i + (band - barH) / 2;
      const rect = svgEl('rect', { x: pad.l, y: yy, width: Math.max(2, len), height: barH, rx: 6, fill: d.color || color(i), class: 'bar-rect', 'data-anim': 'grow-x' });
      rect.append(tooltip(`${d.label}: ${format(val)}`));
      svg.append(rect);
      const lt = svgEl('text', { x: pad.l - 10, y: yy + barH / 2 + 4, class: 'chart-axis', 'text-anchor': 'end' });
      lt.textContent = d.label;
      svg.append(lt);
      const vt = svgEl('text', { x: pad.l + len + 8, y: yy + barH / 2 + 4, class: 'chart-value' });
      vt.textContent = format(val);
      svg.append(vt);
    });
    wrap.append(svg);
    return wrap;
  }

  const band = w / data.length;
  const barW = Math.min(52, band * 0.6);
  data.forEach((d, i) => {
    const val = Number(d.value) || 0;
    const bh = (val / max) * h;
    const xx = pad.l + band * i + (band - barW) / 2;
    const rect = svgEl('rect', { x: xx, y: pad.t + h - bh, width: barW, height: Math.max(2, bh), rx: 7, fill: colorByIndex ? color(i) : '#0F766E', class: 'bar-rect', 'data-anim': 'grow-y', style: `transform-origin:${xx + barW / 2}px ${pad.t + h}px` });
    rect.append(tooltip(`${d.label}: ${format(val)}`));
    svg.append(rect);
    const vt = svgEl('text', { x: xx + barW / 2, y: pad.t + h - bh - 7, class: 'chart-value', 'text-anchor': 'middle' });
    vt.textContent = format(val);
    svg.append(vt);
    const lt = svgEl('text', { x: xx + barW / 2, y: height - 24, class: 'chart-axis', 'text-anchor': 'middle' });
    lt.textContent = d.label.length > 12 ? `${d.label.slice(0, 11)}…` : d.label;
    svg.append(lt);
    if (d.sub) {
      const st = svgEl('text', { x: xx + barW / 2, y: height - 10, class: 'chart-axis chart-axis--sub', 'text-anchor': 'middle' });
      st.textContent = d.sub;
      svg.append(st);
    }
  });
  wrap.append(svg);
  return wrap;
}

/* ------------------------------- DONUT --------------------------------- */

export function donutChart(data, { size = 220, thickness = 26, centerLabel = '', centerValue = '', format = fmtNumber } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'chart chart-donut';
  const total = data.reduce((a, d) => a + (Number(d.value) || 0), 0);
  if (!total) return emptyChart('Belum ada data', size, size);

  const svg = svgEl('svg', { viewBox: `0 0 ${size} ${size}`, class: 'chart-svg', role: 'img', 'aria-label': 'Grafik donat' });
  const r = size / 2 - thickness / 2 - 4;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  svg.append(svgEl('circle', { cx, cy, r, fill: 'none', stroke: '#EEF2F6', 'stroke-width': thickness }));

  data.forEach((d, i) => {
    const val = Number(d.value) || 0;
    const frac = val / total;
    const len = frac * circ;
    const arc = svgEl('circle', {
      cx, cy, r, fill: 'none',
      stroke: d.color || color(i),
      'stroke-width': thickness,
      'stroke-dasharray': `${len} ${circ - len}`,
      'stroke-dashoffset': -offset,
      transform: `rotate(-90 ${cx} ${cy})`,
      'stroke-linecap': 'butt',
      class: 'donut-arc',
      'data-anim': 'donut',
      style: `--dash:${len};--gap:${circ - len};--offset:${-offset};--circ:${circ}`,
    });
    arc.append(tooltip(`${d.label}: ${format(val)} (${fmtPercent(frac * 100)})`));
    svg.append(arc);
    offset += len;
  });

  const vT = svgEl('text', { x: cx, y: cy + 2, class: 'donut-value', 'text-anchor': 'middle' });
  vT.textContent = centerValue || format(total);
  const lT = svgEl('text', { x: cx, y: cy + 22, class: 'donut-label', 'text-anchor': 'middle' });
  lT.textContent = centerLabel;
  svg.append(vT, lT);
  wrap.append(svg);

  const legend = document.createElement('ul');
  legend.className = 'chart-legend';
  data.forEach((d, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="dot" style="background:${d.color || color(i)}"></span><span class="lbl">${d.label}</span><span class="val">${format(Number(d.value) || 0)}</span>`;
    legend.append(li);
  });
  wrap.append(legend);
  return wrap;
}

/* -------------------------------- GAUGE -------------------------------- */

export function gauge(value, { max = 100, size = 150, label = '', sub = '', thresholds = [[40, '#EF4444'], [55, '#F59E0B'], [70, '#0EA5E9'], [101, '#10B981']] } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'chart chart-gauge';
  const v = Math.max(0, Math.min(max, Number(value) || 0));
  const r = size / 2 - 12;
  const cx = size / 2;
  const cy = size / 2 + 8;
  const circumference = Math.PI * r;
  const tone = thresholds.find(([limit]) => v < limit)?.[1] || thresholds[thresholds.length - 1][1];

  const svg = svgEl('svg', { viewBox: `0 0 ${size} ${size * 0.68}`, class: 'chart-svg' });
  const arcPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  svg.append(svgEl('path', { d: arcPath, fill: 'none', stroke: '#EEF2F6', 'stroke-width': 13, 'stroke-linecap': 'round' }));
  const prog = svgEl('path', {
    d: arcPath, fill: 'none', stroke: tone, 'stroke-width': 13, 'stroke-linecap': 'round',
    'stroke-dasharray': `${circumference} ${circumference}`,
    'stroke-dashoffset': circumference - (v / max) * circumference,
    class: 'gauge-progress', 'data-anim': 'gauge',
    style: `--dash:${(v / max) * circumference};--circ:${circumference}`,
  });
  svg.append(prog);
  const vT = svgEl('text', { x: cx, y: cy - 12, class: 'gauge-value', 'text-anchor': 'middle' });
  vT.textContent = fmtDecimal(v);
  const lT = svgEl('text', { x: cx, y: cy + 6, class: 'gauge-label', 'text-anchor': 'middle' });
  lT.textContent = label;
  svg.append(vT, lT);
  wrap.append(svg);
  if (sub) {
    const s = document.createElement('p');
    s.className = 'gauge-sub';
    s.textContent = sub;
    wrap.append(s);
  }
  return wrap;
}

/* ------------------------------ SPARKLINE ------------------------------ */

export function sparkline(values, { width = 120, height = 34, color: stroke = '#0F766E' } = {}) {
  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, class: 'sparkline chart-svg' });
  const nums = values.map((v) => Number(v) || 0);
  const max = Math.max(...nums, 1);
  const min = Math.min(...nums, 0);
  const span = max - min || 1;
  const pts = nums.map((v, i) => [ (i / Math.max(1, nums.length - 1)) * (width - 4) + 2, height - 3 - ((v - min) / span) * (height - 8) ]);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  svg.append(svgEl('path', { d, fill: 'none', stroke, 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'data-anim': 'draw' }));
  const last = pts[pts.length - 1];
  if (last) svg.append(svgEl('circle', { cx: last[0], cy: last[1], r: 2.6, fill: stroke }));
  return svg;
}

/* ------------------------------- HEATMAP ------------------------------- */

export function heatmapChart(grid, { days = [], hours = [], format = fmtPercent } = {}) {
  const table = document.createElement('table');
  table.className = 'heatmap';
  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  hr.append(document.createElement('th'));
  hours.forEach((h) => {
    const th = document.createElement('th');
    th.textContent = h;
    hr.append(th);
  });
  thead.append(hr);
  table.append(thead);

  const tbody = document.createElement('tbody');
  const values = grid.flat().map((c) => c.er);
  const max = Math.max(...values, 0.01);
  grid.forEach((rowArr, d) => {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = days[d] || d;
    tr.append(th);
    rowArr.forEach((cell) => {
      const td = document.createElement('td');
      const intensity = cell.count ? Math.max(0.12, cell.er / max) : 0;
      td.className = 'heatmap-cell';
      td.style.setProperty('--i', intensity.toFixed(3));
      td.dataset.count = cell.count;
      td.innerHTML = cell.count ? `<span class="heat-er">${fmtDecimal(cell.er)}%</span><span class="heat-count">${cell.count} konten</span>` : '<span class="heat-empty">–</span>';
      td.title = `${days[d]} ${hours[cell.hourIndex] ?? ''} • ${cell.count} konten • ER rata-rata ${fmtDecimal(cell.er)}%`;
      tr.append(td);
    });
    tbody.append(tr);
  });
  table.append(tbody);
  const wrap = document.createElement('div');
  wrap.className = 'chart chart-heatmap';
  wrap.append(table);
  return wrap;
}

/* -------------------------------- UTIL --------------------------------- */

export function emptyChart(message, width = 400, height = 160) {
  const div = document.createElement('div');
  div.className = 'chart chart-empty';
  div.style.minHeight = `${Math.min(height, 200)}px`;
  div.innerHTML = `<div class="chart-empty__inner"><span class="chart-empty__icon">📊</span><p>${message}</p></div>`;
  return div;
}

export function progressBar(value, { max = 100, tone = '#0F766E', label = '' } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'progress';
  const pct = Math.max(0, Math.min(100, ((Number(value) || 0) / max) * 100));
  wrap.innerHTML = `<div class="progress__track"><div class="progress__fill" style="--w:${pct}%;background:${tone}" data-anim="grow-x"></div></div>${label ? `<span class="progress__label">${label}</span>` : ''}`;
  return wrap;
}

export { PALETTE, color };
