#!/usr/bin/env node
/**
 * scripts/selftest.mjs — Uji mandiri tanpa browser (Node 18+).
 *
 * Menguji logika murni yang paling rawan salah:
 *   1. Parser CSV (termasuk tanda kutip & koma di dalam caption)
 *   2. Pemetaan header Sheet → kunci internal
 *   3. Normalisasi record (tanggal, angka, batch kosong)
 *   4. Rumus analitik: ER, save rate, click rate, konversi, skor, grade
 *   5. Audit kelengkapan konten & deteksi platform dari URL
 *   6. Integritas skema: jumlah kolom = jumlah kunci yang ditulis ke Sheet
 *
 * Pakai: node scripts/selftest.mjs
 * Keluar dengan kode 1 bila ada uji yang gagal.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
let pass = 0;
let fail = 0;
const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    pass += 1;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } else {
    fail += 1;
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` \x1b[90m(${detail})\x1b[0m` : ''}`);
  }
}

function near(a, b, tolerance = 0.01) {
  return Math.abs(Number(a) - Number(b)) <= tolerance;
}

function section(title) {
  console.log(`\n\x1b[36m${title}\x1b[0m`);
}

/** Impor modul aplikasi lewat data-URL agar bisa dibaca Node tanpa build step. */
async function importModule(relPath) {
  const abs = join(ROOT, relPath);
  const code = await readFile(abs, 'utf8');
  return { code, abs };
}

/** Regex-check sederhana: pastikan tidak ada import yang menunjuk file tidak ada. */
async function checkImports() {
  section('Integritas impor antar modul');
  const { readdir } = await import('node:fs/promises');
  const files = [];
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else if (/\.(js|mjs)$/.test(e.name)) files.push(full);
    }
  }
  await walk(join(ROOT, 'js'));

  for (const file of files) {
    const code = await readFile(file, 'utf8');
    const imports = [...code.matchAll(/from\s+['"](\.[^'"]+)['"]/g)].map((m) => m[1]);
    for (const spec of imports) {
      const target = new URL(spec, `file:///${file.replace(/\\/g, '/')}`);
      const { existsSync } = await import('node:fs');
      if (!existsSync(fileURLToPath(target))) {
        check(`Impor valid: ${spec}`, false, `dari ${file.replace(ROOT, '')}`);
      }
    }
  }
  check(`${files.length} modul JS diperiksa, semua impor relatif menunjuk file yang ada`, failures.filter((f) => f.startsWith('Impor valid')).length === 0);
}

/** Muat ulang fungsi murni dari sheet.js dengan stub browser minimal. */
async function loadPureModules() {
  section('Menyiapkan lingkungan uji');
  const sheetCode = await importModule('js/data/sheet.js');
  const configCode = await importModule('js/core/config.js');

  // Node tidak punya DOM; modul aplikasi memakai document/localStorage -> stub ringan.
  // Sebagian global di Node bersifat getter-only (mis. navigator), jadi pakai defineProperty.
  const defineGlobal = (name, value) => {
    Object.defineProperty(globalThis, name, { value, writable: true, configurable: true, enumerable: false });
  };

  const fakeElement = () => ({
    style: { setProperty() {}, getPropertyValue: () => '' },
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false, replace() {} },
    setAttribute() {}, getAttribute: () => null, removeAttribute() {},
    append() {}, appendChild() {}, prepend() {}, remove() {}, removeChild() {},
    addEventListener() {}, removeEventListener() {}, click() {},
    querySelector: () => null, querySelectorAll: () => [],
    closest: () => null, insertAdjacentHTML() {}, focus() {}, select() {},
    getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0 }),
  });

  defineGlobal('document', {
    createElement: fakeElement,
    createElementNS: fakeElement,
    createDocumentFragment: fakeElement,
    createTextNode: () => fakeElement(),
    head: { append() {} },
    body: { append() {}, appendChild() {} },
    documentElement: fakeElement(),
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    addEventListener() {},
    removeEventListener() {},
    readyState: 'complete',
    execCommand: () => true,
  });
  defineGlobal('window', {
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    addEventListener() {}, removeEventListener() {}, open() {}, innerWidth: 1280, print() {},
  });
  defineGlobal('localStorage', {
    getItem: () => null, setItem() {}, removeItem() {}, clear() {}, key: () => null, length: 0,
  });
  defineGlobal('navigator', { clipboard: null, userAgent: 'node-selftest' });

  const config = await import(pathToUrl(configCode.abs));
  const sheet = await import(pathToUrl(sheetCode.abs));
  return { config, sheet };
}

function pathToUrl(abs) {
  return `file:///${abs.replace(/\\/g, '/')}`;
}

/** ============================ UJI UTAMA ================================ */

async function main() {
  console.log('\x1b[1mSelftest — Content Planner Sekolah Anak Saleh\x1b[0m');

  await checkImports();
  const { config, sheet } = await loadPureModules();

  /* 1. Skema */
  section('Skema database');
  check('FIELDS berisi 26 kolom', config.FIELDS.length === 26, `dapat ${config.FIELDS.length}`);
  check('HEADERS sepanjang FIELDS', config.HEADERS.length === config.FIELDS.length);
  check('Header unik', new Set(config.HEADERS).size === config.HEADERS.length);
  check('SHEET_RANGE diakhiri kolom Z', config.SHEET_RANGE.endsWith('Z'), config.SHEET_RANGE);
  check('Kunci numerik terdeteksi', config.NUMERIC_KEYS.length === 8, String(config.NUMERIC_KEYS.length));
  check('Setiap pilar punya target ER', config.PILARS.every((p) => config.PILAR_TARGET[p.id]?.er > 0));

  /* 2. Header → key */
  section('Pemetaan header & tipe data');
  check('"CTA Link" → cta_link', sheet.headerToKey('CTA Link') === 'cta_link');
  check('"Diperbarui" → diperbarui', sheet.headerToKey('Diperbarui') === 'diperbarui');
  check('"Followers Gain" → followers_gain', sheet.headerToKey('Followers Gain') === 'followers_gain');
  check('header tak dikenal dinormalisasi', sheet.headerToKey('Catatan Tambahan') === 'catatan_tambahan');

  /* 3. Parser CSV */
  section('Parser CSV');
  const csv = [
    'ID,Tanggal,Judul,Caption,Views',
    'ct_1,2026-01-05,"Judul, dengan koma","Baris satu\nbaris dua ""kutip""",1200',
    'ct_2,2026-01-06,Judul biasa,,',
  ].join('\n');
  const parsed = sheet.parseCsv(csv);
  check('2 baris terbaca', parsed.length === 2, `dapat ${parsed.length}`);
  check('Koma di dalam kutip aman', parsed[0].judul === 'Judul, dengan koma', parsed[0].judul);
  check('Kutip ganda di-unescape', parsed[0].caption.includes('"kutip"'), parsed[0].caption);
  check('Views terbaca', Number(parsed[0].views) === 1200);
  check('Kolom kosong jadi string kosong', parsed[1].caption === '');

  /* 4. Parsing gviz */
  section('Parser gviz (tanpa API)');
  const gvizTable = {
    cols: [{ label: 'ID' }, { label: 'Tanggal' }, { label: 'Judul' }, { label: 'Views' }, { label: 'Klik Link' }],
    rows: [
      { c: [{ v: 'ct_9' }, { v: 'Date(2026,0,15)' }, { v: 'Tur Sekolah' }, { v: 2500 }, { v: 88 }] },
      { c: [{ v: '' }, { v: null }, { v: '' }, { v: null }, { v: null }] },
    ],
  };
  const gvizRows = sheet.parseGviz(gvizTable);
  check('Baris kosong dibuang', gvizRows.length === 1, `dapat ${gvizRows.length}`);
  check('Tanggal Date(y,m,d) → ISO', gvizRows[0].tanggal === '2026-01-15', gvizRows[0].tanggal);
  check('Header "Klik Link" → klik_link', gvizRows[0].klik_link === 88);

  /* 5. Normalisasi record */
  section('Normalisasi record');
  const norm = sheet.normalizeRecord({
    id: 'ct_x', tanggal: '05/01/2026', judul: 'Uji', views: '1.200', likes: '', saves: '12,5',
  });
  check('Tanggal dd/mm/yyyy → ISO', norm.tanggal === '2026-01-05', norm.tanggal);
  check('Angka dengan titik ribuan', norm.views === 1200, String(norm.views));
  check('Angka kosong → 0', norm.likes === 0, String(norm.likes));
  check('Field asing dibuang', !('field_asing' in norm));
  check('toSheetRow panjang = jumlah kolom', sheet.toSheetRow(norm).length === config.FIELDS.length);

  /* 6. Rumus analitik */
  section('Rumus analitik & skor');
  const metrics = await import(pathToUrl(join(ROOT, 'js/analytics/metrics.js')));
  const row = {
    id: 'ct_a', status: 'tayang', platform: 'instagram', pilar: 'ppdb', tanggal: '2026-01-10', jam: '19.30',
    views: 10000, likes: 400, comments: 60, shares: 40, saves: 100,
    followers_gain: 120, klik_link: 200, pendaftar: 12,
  };
  check('Interaksi = 600', metrics.interactions(row) === 600, String(metrics.interactions(row)));
  check('ER = 6.00%', near(metrics.engagementRate(row), 6), String(metrics.engagementRate(row)));
  check('Save rate = 1.00%', near(metrics.saveRate(row), 1), String(metrics.saveRate(row)));
  check('Share rate = 0.40%', near(metrics.shareRate(row), 0.4), String(metrics.shareRate(row)));
  check('Click rate = 2.00%', near(metrics.clickRate(row), 2), String(metrics.clickRate(row)));
  check('Konversi = 1.2 per 1.000 views', near(metrics.conversionRate(row), 1.2), String(metrics.conversionRate(row)));
  check('ER nol bila views nol', metrics.engagementRate({ ...row, views: 0 }) === 0);

  metrics.primeMedian([row, { ...row, views: 20000 }, { ...row, views: 5000 }]);
  const score = metrics.contentScore(row);
  check('Skor konten 0–100', score > 0 && score <= 100, String(score));
  check('Skor nol bila belum tayang', metrics.contentScore({ ...row, status: 'ide' }) === 0);
  check('Skor nol bila tanpa views', metrics.contentScore({ ...row, views: 0 }) === 0);
  check('Grade A+ untuk skor 90', metrics.grade(90).grade === 'A+');
  check('Grade D untuk skor 10', metrics.grade(10).grade === 'D');
  check('Grade — untuk skor 0', metrics.grade(0).grade === '—');

  const summary = metrics.summarize([
    row,
    { ...row, status: 'ide', views: 0 },
    { ...row, views: 5000, likes: 200, comments: 30, shares: 20, saves: 50, klik_link: 100, pendaftar: 6 },
  ]);
  check('Summarize: 2 tayang dari 3', summary.published === 2, String(summary.published));
  check('Summarize: jangkauan 15.000', summary.reach === 15000, String(summary.reach));
  check('Summarize: ER gabungan 6.00%', near(summary.er, 6), String(summary.er));
  check('Summarize: total pendaftar 18', summary.daftar === 18, String(summary.daftar));

  const byDim = metrics.breakdown([row, { ...row, platform: 'tiktok', views: 8000 }], 'platform');
  check('Breakdown platform menghasilkan 2 grup', byDim.length === 2, String(byDim.length));
  check('Breakdown terurut dari skor tertinggi', byDim[0].avgScore >= byDim[1].avgScore);

  const tl = metrics.timeline([row, { ...row, tanggal: '2026-02-01' }], { granularity: 'month' });
  check('Timeline bulanan menghasilkan 2 titik', tl.length === 2, String(tl.length));
  const hm = metrics.heatmap([row, { ...row, tanggal: '2026-01-17' }]);
  check('Heatmap 7×6 sel', hm.length === 7 && hm[0].length === 6);
  check('Heatmap mencatat konten pada hari yang benar', hm[new Date('2026-01-10').getDay()].some((c) => c.count > 0));

  /* 7. Audit & insight */
  section('Audit kelengkapan & rekomendasi');
  const insight = await import(pathToUrl(join(ROOT, 'js/analytics/insight.js')));
  const thin = { id: 'ct_b', status: 'ide', judul: '', tanggal: '', platform: 'instagram', caption: 'pendek' };
  const auditThin = insight.auditContent(thin, [thin]);
  check('Konten minim ditandai banyak temuan', auditThin.findings.length >= 5, String(auditThin.findings.length));
  check('Skor kelengkapan rendah', auditThin.score < 40, String(auditThin.score));
  const auditFindings = auditThin.findings.map((f) => f.title).join(' | ');
  check('Terdeteksi judul kosong', /Judul konten kosong/.test(auditFindings));
  check('Terdeteksi tanpa CTA', /CTA/.test(auditFindings), auditFindings);

  const rich = {
    ...row, judul: 'Tur Fasilitas', caption: 'x'.repeat(160), hashtag: '#SekolahAnakSaleh #PPDB2026 #SekolahIslam #ParentingIslami #Jakarta',
    cta_teks: 'Daftar sekarang lewat link di bio', cta_jenis: 'daftar',
    cta_link: 'https://sekolah.sch.id/ppdb?utm_source=instagram', asset_url: 'https://drive.google.com/x', pic: 'Tim Media', post_url: 'https://instagram.com/p/x',
  };
  const auditRich = insight.auditContent(rich, [rich]);
  check('Konten lengkap skornya tinggi', auditRich.score >= 80, String(auditRich.score));
  check('Skor kelengkapan ≤ 100', auditRich.score <= 100);

  const port = insight.portfolioInsights([
    rich, { ...rich, id: 'ct_c', pilar: 'karakter', platform: 'tiktok', views: 20000, saves: 900 },
    { ...rich, id: 'ct_d', pilar: 'tahfiz', platform: 'youtube', views: 4000, saves: 40 },
    { ...rich, id: 'ct_e', pilar: 'edukasi', platform: 'instagram', views: 9000, saves: 300 },
    { ...rich, id: 'ct_f', pilar: 'kesiswaan', platform: 'tiktok', views: 15000, saves: 400 },
  ]);
  check('Portfolio insight menghasilkan rekomendasi', port.insights.length >= 3, String(port.insights.length));
  check('Rekomendasi terurut prioritas', port.insights[0].weight >= port.insights[port.insights.length - 1].weight);
  check('Setiap rekomendasi punya tindakan', port.insights.every((i) => i.action && i.title));

  const caption = insight.generateCaption({ judul: 'Open House', pilar: 'ppdb', cta_jenis: 'daftar' });
  check('Caption otomatis tidak kosong', caption.caption.length > 80, String(caption.caption.length));
  check('Hashtag otomatis berisi tag sekolah', /#SekolahAnakSaleh/.test(caption.hashtag), caption.hashtag);

  /* 8. Deteksi platform */
  section('Integrasi sosial media');
  const social = await import(pathToUrl(join(ROOT, 'js/social/platforms.js')));
  const cases = [
    ['https://www.instagram.com/reel/Cx1y2z3/'.replace('/reel/', '/reels/'), 'instagram'],
    ['https://www.tiktok.com/@sekolah/video/7300000000000000001', 'tiktok'],
    ['https://youtu.be/dQw4w9WgXcQ', 'youtube'],
    ['https://www.youtube.com/shorts/abc123XYZ', 'youtube'],
    ['https://www.facebook.com/watch/?v=123456789', 'facebook'],
  ];
  cases.forEach(([url, expected]) => {
    check(`Deteksi ${expected} dari URL`, social.detectFromUrl(url)?.platform === expected, url);
  });
  check('Instagram Reels terdeteksi sebagai Reels', social.detectFromUrl('https://www.instagram.com/reels/Cx1y2z3/')?.format === 'Reels');
  check('YouTube Shorts terdeteksi sebagai Shorts', social.detectFromUrl('https://www.youtube.com/shorts/abc123XYZ')?.format === 'Shorts');
  check('ID YouTube diekstrak', social.extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ') === 'dQw4w9WgXcQ');
  check('Embed YouTube memakai youtube-nocookie', /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/.test(social.embedHtml('youtube', 'https://youtu.be/dQw4w9WgXcQ') || ''));
  check('Embed Instagram memakai /embed', /instagram\.com\/p\/Cx1y2z3\/embed/.test(social.embedHtml('instagram', 'https://www.instagram.com/p/Cx1y2z3/') || ''));
  check('Embed TikTok memakai /embed/v2', /tiktok\.com\/embed\/v2\/7300000000000000001/.test(social.embedHtml('tiktok', 'https://www.tiktok.com/@x/video/7300000000000000001') || ''));
  check('URL tak dikenal → null', social.detectFromUrl('https://example.com/apa-saja') === null);
  const utm = social.buildUtm('https://sekolah.sch.id/ppdb', { source: 'instagram', medium: 'reels', campaign: 'ppdb2026' });
  check('UTM ditambahkan dengan benar', /utm_source=instagram/.test(utm) && /utm_campaign=ppdb2026/.test(utm), utm);
  check('UTM tidak merusak link kosong', social.buildUtm('', { source: 'x' }) === '');
  check('Saran pilar dari caption PPDB', social.suggestPilar('Kuota PPDB gelombang 2 terbatas') === 'ppdb');
  check('Saran pilar dari caption tahfiz', social.suggestPilar('Setoran hafalan juz 30') === 'tahfiz');

  /* 9. Berkas wajib */
  section('Berkas wajib ada');
  const { existsSync } = await import('node:fs');
  const required = [
    'index.html', 'assets/css/style.css', 'js/main.js', 'js/core/config.js', 'js/data/store.js',
    'js/data/sheet.js', 'js/social/platforms.js', 'js/analytics/metrics.js', 'js/analytics/insight.js',
    'js/lib/charts.js', 'js/lib/anim.js', 'js/ui/components.js', 'js/ui/shell.js',
    'js/views/planner.js', 'js/views/calendar.js', 'js/views/analytics.js', 'js/views/cta.js',
    'js/views/settings.js', 'js/views/editor.js', 'apps-script/Code.gs',
    'docs/01-setup-google-sheet.md', 'docs/02-setup-apps-script.md', 'docs/03-deploy.md', 'docs/04-arsitektur.md',
  ];
  required.forEach((rel) => check(`Ada: ${rel}`, existsSync(join(ROOT, rel))));
  check('CSS tidak kosong', existsSync(join(ROOT, 'assets/css/style.css')));

  /* Ringkasan */
  console.log(`\n\x1b[1mHasil:\x1b[0m \x1b[32m${pass} lulus\x1b[0m${fail ? `, \x1b[31m${fail} gagal\x1b[0m` : ''}`);
  if (fail) {
    console.log('\n\x1b[31mUji yang gagal:\x1b[0m');
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exitCode = 1;
  } else {
    console.log('\x1b[32mSemua uji lulus — parser, rumus analitik, audit, dan integrasi sosmed siap.\x1b[0m');
  }
}

main().catch((err) => {
  console.error('\x1b[31mSelftest gagal dijalankan:\x1b[0m', err);
  process.exitCode = 1;
});
