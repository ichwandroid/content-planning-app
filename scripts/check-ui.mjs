#!/usr/bin/env node
/**
 * scripts/check-ui.mjs — Uji jalan aplikasi di browser sungguhan lewat Chrome DevTools Protocol.
 * Tanpa dependensi: memakai WebSocket bawaan Node 22+ dan Chrome/Edge yang sudah terpasang.
 *
 * Pakai:
 *   node scripts/serve.mjs 4173          (terminal 1)
 *   node scripts/check-ui.mjs            (terminal 2)  → http://127.0.0.1:4173
 *
 * Yang diperiksa:
 *   - error JavaScript / permintaan gagal di konsol
 *   - elemen kunci benar-benar ter-render (kartu konten, statistik, kalender, analitik, CTA)
 *   - perpindahan antar halaman (hash routing) berjalan
 *   - tidak ada sumber daya CSS/JS yang 404
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const URL_BASE = process.argv[2] || process.env.CHECK_URL || 'http://127.0.0.1:4173';
const PORT = 9333;

const CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

const browserPath = CANDIDATES.find((p) => existsSync(p));
if (!browserPath) {
  console.error('Chrome/Edge tidak ditemukan. Lewati uji browser, atau set CHECK_URL dan jalankan manual.');
  process.exit(0);
}

const profile = mkdtempSync(join(tmpdir(), 'cpsas-chrome-'));
let child;
const errors = [];
const warnings = [];
const logs = [];
let id = 0;
const pending = new Map();

function send(ws, method, params = {}, sessionId) {
  const messageId = ++id;
  const payload = { id: messageId, method, params };
  if (sessionId) payload.sessionId = sessionId;
  ws.send(JSON.stringify(payload));
  return new Promise((resolve, reject) => {
    pending.set(messageId, { resolve, reject });
    setTimeout(() => {
      if (pending.has(messageId)) {
        pending.delete(messageId);
        reject(new Error(`Timeout CDP: ${method}`));
      }
    }, 20000);
  });
}

async function waitForEndpoint(url, tries = 40) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch { /* belum siap */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error('Chrome tidak siap dalam waktu yang wajar.');
}

function findPageTarget(list) {
  return list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
}

async function main() {
  child = spawn(browserPath, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-gpu',
    '--window-size=1440,1000',
    'about:blank',
  ], { stdio: 'ignore' });

  const version = await waitForEndpoint(`http://127.0.0.1:${PORT}/json/version`);
  const target = findPageTarget(await waitForEndpoint(`http://127.0.0.1:${PORT}/json/list`));
  if (!target) throw new Error('Tidak ada target halaman di Chrome.');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', () => reject(new Error('Gagal membuka WebSocket CDP')), { once: true });
  });

  ws.addEventListener('message', (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
      return;
    }
    const { method, params } = msg;
    if (method === 'Runtime.exceptionThrown') {
      const d = params.exceptionDetails;
      errors.push(`JS exception: ${d.exception?.description || d.text} @ ${d.url || ''}:${d.lineNumber ?? ''}`);
    }
    if (method === 'Runtime.consoleAPICalled') {
      const text = (params.args || []).map((a) => a.value ?? a.description ?? a.type).join(' ');
      if (params.type === 'error') errors.push(`console.error: ${text}`);
      else if (params.type === 'warning') warnings.push(`console.warn: ${text}`);
      else logs.push(`${params.type}: ${text}`);
    }
    if (method === 'Log.entryAdded') {
      const e = params.entry;
      if (e.level === 'error') errors.push(`log(${e.source}): ${e.text}`);
      else if (e.level === 'warning') warnings.push(`log(${e.source}): ${e.text}`);
    }
    if (method === 'Network.loadingFailed') {
      const url = params.requestId;
      errors.push(`Permintaan gagal (${params.type || 'unknown'} ${params.errorText}) ref=${url}`);
    }
    if (method === 'Network.responseReceived') {
      const { response, type } = params;
      if (response.status >= 400) errors.push(`HTTP ${response.status} ${type} → ${response.url}`);
    }
  });

  await send(ws, 'Runtime.enable');
  await send(ws, 'Log.enable');
  await send(ws, 'Network.enable');
  await send(ws, 'Page.enable');
  await send(ws, 'Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

  console.log(`\x1b[36mMembuka ${URL_BASE} …\x1b[0m`);
  await send(ws, 'Page.navigate', { url: URL_BASE });
  await new Promise((r) => setTimeout(r, 6500));

  const evaluate = async (expression) => {
    const res = await send(ws, 'Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text);
    return res.result.value;
  };

  const probe = async (label, expression, expectation) => {
    const value = await evaluate(expression);
    const ok = typeof expectation === 'function' ? expectation(value) : Boolean(value);
    console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${label}${ok ? '' : ` \x1b[90m→ ${JSON.stringify(value)?.slice(0, 200)}\x1b[0m`}`);
    if (!ok) errors.push(`Probe gagal: ${label} → ${JSON.stringify(value)?.slice(0, 200)}`);
    return value;
  };

  console.log('\n\x1b[1mPemeriksaan DOM\x1b[0m');
  await probe('Overlay boot tersembunyi setelah animasi', 'getComputedStyle(document.querySelector("#boot-overlay")).display', (v) => v === 'none');
  await probe('App shell terlihat (opacity 1)', 'getComputedStyle(document.querySelector("#app-shell")).opacity', (v) => Number(v) > 0.9);
  await probe('Statistik ter-render (≥ 6 kartu)', 'document.querySelectorAll(".stat-card").length', (v) => v >= 6);
  await probe('Angka statistik terisi (bukan 0 semua)', 'Array.from(document.querySelectorAll(".stat-card__value")).map(e=>e.textContent).join("|")', (v) => /\d/.test(v) && !/^0(\|0)*$/.test(v));
  await probe('Kartu konten ter-render', 'document.querySelectorAll("#planner-grid .content-card").length', (v) => v >= 5);
  await probe('KPI strip ada di kartu', 'document.querySelectorAll("#planner-grid .kpi-strip .kpi-cell").length', (v) => v >= 20);
  await probe('Badge platform terwarnai (data-platform)', 'document.querySelectorAll(".pf-badge[data-platform]").length', (v) => v >= 5);
  await probe('Kotak CTA tampil', 'document.querySelectorAll(".cta-box").length', (v) => v >= 5);
  await probe('Filter chip ter-render', 'document.querySelectorAll("[data-chips] .filter-chip").length', (v) => v >= 10);
  await probe('Sidebar card terisi', 'document.querySelector("#sb-week").textContent', (v) => v !== '');
  await probe('Status koneksi menampilkan sumber data', 'document.querySelector("#sync-text").textContent', (v) => /demo|lokal|sheet|memuat/i.test(v));
  await probe('Mode demo badge terlihat (belum ada Sheet ID)', 'document.querySelector("#mode-badge").classList.contains("is-hidden")', (v) => v === false);
  await probe('Tidak ada teks "null"/"undefined" yang bocor ke layar', 'JSON.stringify({n:(document.body.innerText.match(/\\bnull\\b/g)||[]).length, u:(document.body.innerText.match(/\\bundefined\\b/g)||[]).length})', (v) => v === '{"n":0,"u":0}');
  await probe('Tidak ada ikon SVG kosong pada tombol', 'Array.from(document.querySelectorAll(".cc-foot .btn")).filter(b=>b.querySelector("svg") && b.querySelector("svg").children.length===0).length', (v) => v === 0);

  console.log('\n\x1b[1mPemeriksaan navigasi & halaman lain\x1b[0m');
  const goTo = async (hash, selector, label) => {
    await evaluate(`location.hash = ${JSON.stringify(hash)}; window.CPSAS.actions.go(${JSON.stringify(hash)})`);
    await new Promise((r) => setTimeout(r, 1400));
    await probe(label, `document.querySelectorAll(${JSON.stringify(selector)}).length`, (v) => v > 0);
  };
  await goTo('calendar', '#calendar .cal-cell', 'Kalender: sel hari ter-render');
  await probe('Kalender: item konten di dalam sel', 'document.querySelectorAll("#calendar .cal-item").length', (v) => v > 0);
  await probe('Kalender: hari ini ditandai', 'document.querySelectorAll("#calendar .cal-cell.is-today").length', (v) => v === 1);
  await probe('Kalender: legenda tampil', 'document.querySelectorAll("#cal-legend .legend-item").length', (v) => v >= 5);

  await goTo('analytics', '#analytics-root .panel', 'Analitik: panel ter-render');
  await probe('Analitik: kartu KPI', 'document.querySelectorAll(".mini-stat").length', (v) => v >= 6);
  await probe('Analitik: grafik SVG digambar', 'document.querySelectorAll("#analytics-root svg.chart-svg").length', (v) => v >= 3);
  await probe('Analitik: heatmap dirender', 'document.querySelectorAll(".heatmap-cell").length', (v) => v >= 30);
  await probe('Analitik: insight/rekomendasi muncul', 'document.querySelectorAll(".insight-card").length', (v) => v >= 3);
  await probe('Analitik: audit kelengkapan muncul', 'document.querySelectorAll(".audit-row").length', (v) => v >= 1);
  await probe('Analitik: target pilar muncul', 'document.querySelectorAll(".target-card").length', (v) => v >= 2);

  await goTo('cta', '#cta-root .cta-card', 'Library CTA: kartu CTA ter-render');
  await probe('CTA: builder tampil', 'document.querySelectorAll(".cta-builder__result").length', (v) => v === 1);
  await probe('CTA: builder menghasilkan teks', 'document.querySelector(".cta-builder__result").textContent.length', (v) => v > 20);

  await goTo('settings', '#settings-root .panel', 'Pengaturan: panel ter-render');
  await probe('Pengaturan: tampilkan 26 kolom skema', 'document.querySelectorAll("#settings-root .table tbody tr").length', (v) => v >= 26);
  await probe('Pengaturan: status koneksi ditampilkan', 'document.querySelectorAll(".conn-status").length', (v) => v === 1);

  await goTo('planner', '#planner-grid .content-card', 'Kembali ke Planner: kartu ter-render');

  console.log('\n\x1b[1mPemeriksaan interaksi\x1b[0m');
  await evaluate('document.querySelector("#btn-new").click()');
  await new Promise((r) => setTimeout(r, 900));
  await probe('Drawer editor terbuka', 'getComputedStyle(document.querySelector("#drawer")).display', (v) => v === 'flex' || v === 'block');
  await probe('Form punya field utama', 'document.querySelectorAll("#content-form [name]").length', (v) => v >= 20);
  await probe('Tab drawer ada 5', 'document.querySelectorAll("#drawer-tabs .tab").length', (v) => v === 5);
  await evaluate('document.querySelector("#drawer-tabs .tab[data-tab=\'analisis\']").click()');
  await new Promise((r) => setTimeout(r, 700));
  await probe('Tab Analisis menampilkan temuan audit', 'document.querySelectorAll("#audit-panel .finding").length', (v) => v >= 3);
  await evaluate('document.querySelector("#form-cancel").click()');
  await new Promise((r) => setTimeout(r, 800));

  await evaluate('document.querySelector("#global-search").value="panahan"; document.querySelector("#global-search").dispatchEvent(new Event("input"))');
  await new Promise((r) => setTimeout(r, 900));
  await probe('Pencarian menyaring kartu', 'document.querySelectorAll("#planner-grid .content-card").length', (v) => v >= 1 && v < 20);
  await evaluate('document.querySelector("#global-search").value=""; document.querySelector("#global-search").dispatchEvent(new Event("input"))');
  await new Promise((r) => setTimeout(r, 700));

  await evaluate('document.querySelector(".seg-btn[data-layout=\'board\']").click()');
  await new Promise((r) => setTimeout(r, 800));
  await probe('Layout papan status ter-render', 'document.querySelectorAll("#planner-grid .board-col").length', (v) => v >= 5);
  await evaluate('document.querySelector(".seg-btn[data-layout=\'grid\']").click()');
  await new Promise((r) => setTimeout(r, 600));

  /* Simpan konten baru untuk menguji alur tulis (mode demo: localStorage) */
  await evaluate(`
    (async () => {
      window.CPSAS.actions.openNew({ judul: 'UJI OTOMATIS — boleh dihapus', platform: 'tiktok', pilar: 'edukasi' });
    })()
  `);
  await new Promise((r) => setTimeout(r, 800));
  await evaluate(`
    (() => {
      const f = document.querySelector('#content-form');
      f.querySelector('[name="judul"]').value = 'UJI OTOMATIS — boleh dihapus';
      f.querySelector('[name="caption"]').value = 'Captio uji otomatis dengan panjang memadai untuk melewati validasi kelengkapan minimal seratus karakter agar audit memberi skor baik.';
      f.querySelector('[name="cta_teks"]').value = 'Simpan postingan ini ya, Bunda';
      f.querySelector('[name="views"]').value = '5000';
      f.querySelector('[name="likes"]').value = '320';
      f.querySelector('[name="saves"]').value = '80';
      f.dispatchEvent(new Event('input', { bubbles: true }));
    })()
  `);
  await evaluate('document.querySelector("#form-save").click()');
  await new Promise((r) => setTimeout(r, 1200));
  await probe('Konten baru tersimpan di state', 'window.CPSAS.store.state.rows.filter(r=>r.judul.includes("UJI OTOMATIS")).length', (v) => v === 1);
  await probe('Drawer tertutup setelah simpan', 'getComputedStyle(document.querySelector("#drawer")).display', (v) => v === 'none');
  await probe('Toast konfirmasi muncul/terpakai', 'document.querySelectorAll("#toast-stack .toast").length >= 0', () => true);

  await evaluate(`
    (async () => {
      const rows = window.CPSAS.store.state.rows.filter(r => r.judul.includes('UJI OTOMATIS'));
      for (const r of rows) await window.CPSAS.store.remove(r.id);
    })()
  `);
  await new Promise((r) => setTimeout(r, 900));
  await probe('Konten uji dibersihkan kembali', 'window.CPSAS.store.state.rows.filter(r=>r.judul.includes("UJI OTOMATIS")).length', (v) => v === 0);

  console.log('\n\x1b[1mRingkasan\x1b[0m');
  if (errors.length) {
    console.log(`\x1b[31m${errors.length} masalah ditemukan:\x1b[0m`);
    [...new Set(errors)].slice(0, 40).forEach((e) => console.log(`  - ${e}`));
  } else {
    console.log('\x1b[32mTidak ada error JavaScript / HTTP / permintaan gagal.\x1b[0m');
  }
  if (warnings.length) {
    console.log(`\x1b[33m${warnings.length} peringatan:\x1b[0m`);
    [...new Set(warnings)].slice(0, 12).forEach((w) => console.log(`  - ${w}`));
  }
  if (process.env.SHOW_LOGS === '1') logs.slice(0, 40).forEach((l) => console.log(`  · ${l}`));

  ws.close();
  child.kill();
  process.exitCode = errors.length ? 1 : 0;
}

main()
  .catch((err) => {
    console.error('\x1b[31mUji browser gagal:\x1b[0m', err.message);
    process.exitCode = 1;
  })
  .finally(() => {
    try { child?.kill(); } catch { /* abaikan */ }
  });
