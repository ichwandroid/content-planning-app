/**
 * analytics/metrics.js — Perhitungan KPI konten.
 * Semua metrik turunan dihitung dari metrik mentah di Google Sheet:
 * views, likes, comments, shares, saves, followers_gain, klik_link, pendaftar.
 */

import { ANALYTICS, PILARS, PLATFORMS, PILAR_TARGET, STATUSES } from '../core/config.js';
import { avg, groupBy, round, sum } from '../core/util.js';
import { toDate } from '../core/format.js';

export const n = (v) => (Number.isFinite(+v) ? +v : 0);

/** Total interaksi = likes + komentar + share + simpan */
export function interactions(row) {
  return n(row.likes) + n(row.comments) + n(row.shares) + n(row.saves);
}

export function engagementRate(row) {
  const reach = n(row.views);
  if (!reach) return 0;
  return round((interactions(row) / reach) * 100, 2);
}

export const saveRate = (row) => (n(row.views) ? round((n(row.saves) / n(row.views)) * 100, 2) : 0);
export const shareRate = (row) => (n(row.views) ? round((n(row.shares) / n(row.views)) * 100, 2) : 0);
export const commentRate = (row) => (n(row.views) ? round((n(row.comments) / n(row.views)) * 100, 2) : 0);
export const clickRate = (row) => (n(row.views) ? round((n(row.klik_link) / n(row.views)) * 100, 2) : 0);
export const followerRate = (row) => (n(row.views) ? round((n(row.followers_gain) / n(row.views)) * 100, 2) : 0);

/** Konversi ujung: pendaftar per 1.000 views */
export const conversionRate = (row) => (n(row.views) ? round((n(row.pendaftar) / n(row.views)) * 1000, 2) : 0);

export function benchmarkER(platform) {
  return ANALYTICS.benchmarkER[platform] ?? 3;
}

/** Skor per komponen 0-100 (100 = tepat di benchmark). */
export function scoreComponents(row) {
  const p = row.platform;
  const erBench = benchmarkER(p);
  const er = engagementRate(row);
  const reach = n(row.views);
  const reachBench = reach > 0 ? Math.max(1000, medianViewsFor(p)) : 1000;

  const comp = {
    engagement: ratioScore(er, erBench),
    reach: ratioScore(reach, reachBench),
    save: ratioScore(saveRate(row), erBench * 0.35),
    share: ratioScore(shareRate(row), erBench * 0.3),
    click: ratioScore(clickRate(row), (PILAR_TARGET[row.pilar]?.clickRate ?? 1) * 1),
    growth: ratioScore(followerRate(row), erBench * 0.12),
  };
  return comp;
}

let medianCache = new Map();
export function primeMedian(rows) {
  medianCache = new Map();
  const byPlatform = groupBy(rows, (r) => r.platform);
  for (const [p, list] of Object.entries(byPlatform)) {
    const values = list.map((r) => n(r.views)).filter((v) => v > 0).sort((a, b) => a - b);
    medianCache.set(p, values.length ? values[Math.floor(values.length / 2)] : 0);
  }
}
function medianViewsFor(platform) {
  return medianCache.get(platform) ?? 5000;
}

function ratioScore(value, target) {
  if (!target || target <= 0) return 0;
  return round(Math.min(150, (value / target) * 100), 1);
}

/** Skor konten 0-100 dengan bobot dari config. */
export function contentScore(row) {
  if (row.status !== 'tayang' || !n(row.views)) return 0;
  const comp = scoreComponents(row);
  const w = ANALYTICS.weights;
  const raw =
    (comp.engagement * w.engagement) +
    (Math.min(comp.reach, 130) * w.reach) +
    (comp.save * w.save) +
    (comp.share * w.share) +
    (comp.click * w.click) +
    (comp.growth * w.growth);
  return round(Math.min(100, raw), 1);
}

export function grade(score) {
  if (score >= 85) return { label: 'Luar Biasa', grade: 'A+', color: '#059669' };
  if (score >= 70) return { label: 'Sangat Baik', grade: 'A', color: '#10B981' };
  if (score >= 55) return { label: 'Baik', grade: 'B', color: '#0EA5E9' };
  if (score >= 40) return { label: 'Cukup', grade: 'C', color: '#F59E0B' };
  if (score > 0) return { label: 'Perlu Diperbaiki', grade: 'D', color: '#EF4444' };
  return { label: 'Belum ada data', grade: '—', color: '#94A3B8' };
}

/** Ringkasan satu konten: semua KPI turunan siap tampil. */
export function analyzeRow(row) {
  const score = contentScore(row);
  const comp = scoreComponents(row);
  const t = PILAR_TARGET[row.pilar] || {};
  const er = engagementRate(row);
  return {
    ...row,
    kpi: {
      interactions: interactions(row),
      er,
      saveRate: saveRate(row),
      shareRate: shareRate(row),
      commentRate: commentRate(row),
      clickRate: clickRate(row),
      followerRate: followerRate(row),
      conversionRate: conversionRate(row),
      score,
      grade: grade(score),
      components: comp,
      vsBenchmark: round(er - benchmarkER(row.platform), 2),
      meetsPilarTarget: t.er ? er >= t.er : er >= benchmarkER(row.platform),
    },
  };
}

/* --------------------------- AGREGASI / RINGKASAN ---------------------- */

export function summarize(rows) {
  const published = rows.filter((r) => r.status === 'tayang');
  const reach = sum(published, (r) => n(r.views));
  const eng = sum(published, interactions);
  const scores = published.map(contentScore).filter((s) => s > 0);
  const clicks = sum(published, (r) => n(r.klik_link));
  const daftar = sum(published, (r) => n(r.pendaftar));
  const growth = sum(published, (r) => n(r.followers_gain));

  return {
    total: rows.length,
    published: published.length,
    planned: rows.length - published.length,
    reach,
    interactions: eng,
    er: reach ? round((eng / reach) * 100, 2) : 0,
    avgScore: scores.length ? round(avg(scores), 1) : 0,
    medianScore: scores.length ? round(median(scores), 1) : 0,
    bestScore: scores.length ? Math.max(...scores) : 0,
    clicks,
    daftar,
    growth,
    ctr: reach ? round((clicks / reach) * 100, 2) : 0,
    costPerDaftar: daftar ? 0 : null,
    saves: sum(published, (r) => n(r.saves)),
    shares: sum(published, (r) => n(r.shares)),
    comments: sum(published, (r) => n(r.comments)),
    likes: sum(published, (r) => n(r.likes)),
  };
}

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Kelompokkan performa berdasarkan dimensi: platform, pilar, format, CTA, hari, jam. */
export function breakdown(rows, dimension) {
  const published = rows.filter((r) => r.status === 'tayang');
  let keyFn;
  switch (dimension) {
    case 'platform': keyFn = (r) => r.platform || 'lainnya'; break;
    case 'pilar': keyFn = (r) => r.pilar || 'lainnya'; break;
    case 'format': keyFn = (r) => r.format || 'lainnya'; break;
    case 'cta': keyFn = (r) => r.cta_jenis || 'tanpa-cta'; break;
    case 'hari': keyFn = (r) => String(toDate(r.tanggal)?.getDay() ?? ''); break;
    case 'jam': keyFn = (r) => jamBucket(r.jam); break;
    case 'pic': keyFn = (r) => r.pic || 'Belum ada PIC'; break;
    case 'status': keyFn = (r) => r.status; break;
    default: keyFn = () => 'semua';
  }
  const groups = groupBy(published, keyFn);
  return Object.entries(groups)
    .map(([key, list]) => {
      const reach = sum(list, (r) => n(r.views));
      const eng = sum(list, interactions);
      const scores = list.map(contentScore).filter((s) => s > 0);
      return {
        key,
        label: labelFor(dimension, key),
        count: list.length,
        reach,
        interactions: eng,
        er: reach ? round((eng / reach) * 100, 2) : 0,
        avgScore: scores.length ? round(avg(scores), 1) : 0,
        clicks: sum(list, (r) => n(r.klik_link)),
        daftar: sum(list, (r) => n(r.pendaftar)),
        saves: sum(list, (r) => n(r.saves)),
        shares: sum(list, (r) => n(r.shares)),
        avgViews: list.length ? Math.round(reach / list.length) : 0,
        items: list,
      };
    })
    .sort((a, b) => b.avgScore - a.avgScore);
}

function jamBucket(jam) {
  const h = Number.parseInt(String(jam || '').slice(0, 2), 10);
  if (!Number.isFinite(h)) return 'tanpa jam';
  if (h < 9) return '06.00–08.59';
  if (h < 12) return '09.00–11.59';
  if (h < 15) return '12.00–14.59';
  if (h < 18) return '15.00–17.59';
  if (h < 21) return '18.00–20.59';
  return '21.00–23.59';
}

function labelFor(dimension, key) {
  if (dimension === 'platform') return PLATFORMS[key]?.label || key;
  if (dimension === 'pilar') return PILARS.find((p) => p.id === key)?.label || key;
  if (dimension === 'status') return STATUSES[key]?.label || key;
  if (dimension === 'hari') {
    return ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][Number(key)] || 'Tanpa tanggal';
  }
  if (dimension === 'cta' && key === 'tanpa-cta') return 'Tanpa CTA';
  if (dimension === 'cta') return key.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return key;
}

/** Tren harian/bulanan untuk grafik garis. */
export function timeline(rows, { granularity = 'day', metric = 'score' } = {}) {
  const published = rows.filter((r) => r.status === 'tayang' && r.tanggal);
  const buckets = new Map();
  for (const r of published) {
    const d = toDate(r.tanggal);
    if (!d) continue;
    const key = granularity === 'month'
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(r);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, list]) => {
      const reach = sum(list, (r) => n(r.views));
      const eng = sum(list, interactions);
      const scores = list.map(contentScore).filter((s) => s > 0);
      return {
        key,
        count: list.length,
        reach,
        interactions: eng,
        er: reach ? round((eng / reach) * 100, 2) : 0,
        score: scores.length ? round(avg(scores), 1) : 0,
        clicks: sum(list, (r) => n(r.klik_link)),
        daftar: sum(list, (r) => n(r.pendaftar)),
        value: metric === 'reach' ? reach : metric === 'interactions' ? eng : metric === 'clicks' ? sum(list, (r) => n(r.klik_link)) : scores.length ? round(avg(scores), 1) : 0,
      };
    });
}

/** Matriks hari x jam: kapan audiens paling responsif. */
export function heatmap(rows) {
  const published = rows.filter((r) => r.status === 'tayang' && r.tanggal);
  const grid = Array.from({ length: 7 }, () => Array(6).fill(null).map(() => ({ count: 0, er: 0, reach: 0 })));
  const bucketIndex = (jam) => {
    const h = Number.parseInt(String(jam || '').slice(0, 2), 10);
    if (!Number.isFinite(h)) return 4;
    if (h < 9) return 0;
    if (h < 12) return 1;
    if (h < 15) return 2;
    if (h < 18) return 3;
    if (h < 21) return 4;
    return 5;
  };
  for (const r of published) {
    const d = toDate(r.tanggal);
    if (!d) continue;
    const cell = grid[d.getDay()][bucketIndex(r.jam)];
    cell.count += 1;
    cell.reach += n(r.views);
    cell.erSum = (cell.erSum || 0) + engagementRate(r);
  }
  grid.forEach((rowArr) => rowArr.forEach((c) => { c.er = c.count ? round(c.erSum / c.count, 2) : 0; }));
  return grid;
}

export const HEATMAP_LABELS = {
  days: ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'],
  hours: ['<09', '09–12', '12–15', '15–18', '18–21', '>21'],
};

/** Cari konten yang performanya di atas/rata-rata (untuk insight). */
export function rank(rows) {
  const published = rows.filter((r) => r.status === 'tayang');
  return [...published]
    .map((r) => ({ ...r, score: contentScore(r) }))
    .sort((a, b) => b.score - a.score);
}

export const topPerformers = (rows, limit = 5) => rank(rows).slice(0, limit);
export const underPerformers = (rows, limit = 5) => rank(rows).filter((r) => r.score > 0).slice(-limit).reverse();
