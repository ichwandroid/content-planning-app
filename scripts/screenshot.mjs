#!/usr/bin/env node
/**
 * scripts/screenshot.mjs — Ambil tangkapan layar setiap halaman aplikasi (full page).
 * Memakai Chrome/Edge lewat DevTools Protocol; tanpa dependensi tambahan.
 *
 * Pakai:
 *   node scripts/serve.mjs 4173      (terminal 1)
 *   node scripts/screenshot.mjs      (terminal 2)
 *
 * Hasil: docs/screenshots/*.png  (planner, calendar, analytics, cta, settings, editor, mobile)
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT_DIR = join(ROOT, 'docs', 'screenshots');
const URL_BASE = process.argv[2] || 'http://127.0.0.1:4173';
const PORT = 9334;

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
  console.error('Chrome/Edge tidak ditemukan — lewati pembuatan tangkapan layar.');
  process.exit(0);
}

const profile = mkdtempSync(join(tmpdir(), 'cpsas-shot-'));
let child;
let msgId = 0;
const pending = new Map();

function send(ws, method, params = {}) {
  const id = ++msgId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    setTimeout(() => {
      if (pending.has(id)) { pending.delete(id); reject(new Error(`Timeout: ${method}`)); }
    }, 30000);
  });
}

async function waitJson(url, tries = 40) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch { /* belum siap */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Tidak bisa menghubungi ${url}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  child = spawn(browserPath, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-gpu', '--hide-scrollbars',
    '--window-size=1440,1200',
    'about:blank',
  ], { stdio: 'ignore' });

  await waitJson(`http://127.0.0.1:${PORT}/json/version`);
  const target = (await waitJson(`http://127.0.0.1:${PORT}/json/list`)).find((t) => t.type === 'page');
  if (!target) throw new Error('Tidak ada target halaman.');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', () => reject(new Error('CDP WebSocket gagal')), { once: true });
  });
  ws.addEventListener('message', (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  });

  await send(ws, 'Page.enable');
  await send(ws, 'Runtime.enable');

  const shoot = async (name, { view, width = 1440, height = 1200, scale = 1, fullPage = true, prep = null, wait = 4200 } = {}) => {
    await send(ws, 'Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor: scale, mobile: width < 700,
    });
    const url = `${URL_BASE}/?view=${view}`;
    await send(ws, 'Page.navigate', { url });
    await sleep(wait);
    if (prep) {
      await send(ws, 'Runtime.evaluate', { expression: prep, awaitPromise: true });
      await sleep(1600);
    }
    const metrics = await send(ws, 'Page.getLayoutMetrics');
    const size = metrics.cssContentSize || metrics.contentSize;
    const clip = fullPage
      ? { x: 0, y: 0, width: Math.min(size.width, 1600), height: Math.min(size.height, 6000), scale: 1 }
      : { x: 0, y: 0, width, height, scale: 1 };
    const shot = await send(ws, 'Page.captureScreenshot', { format: 'png', captureBeyondViewport: fullPage, clip });
    const file = join(OUT_DIR, `${name}.png`);
    writeFileSync(file, Buffer.from(shot.data, 'base64'));
    const kb = Math.round(Buffer.from(shot.data, 'base64').length / 1024);
    console.log(`  \x1b[32m✓\x1b[0m ${name}.png \x1b[90m(${clip.width}×${clip.height}, ${kb} KB)\x1b[0m`);
    return file;
  };

  console.log(`\x1b[36mMenyimpan tangkapan layar ke ${OUT_DIR}\x1b[0m`);

  await shoot('01-planner', { view: 'planner' });
  await shoot('02-kalender', { view: 'calendar' });
  await shoot('03-analitik', { view: 'analytics' });
  await shoot('04-analitik-lanjutan', {
    view: 'analytics',
    prep: 'window.scrollTo(0, document.body.scrollHeight * 0.42)',
    fullPage: false,
    height: 1200,
  });
  await shoot('05-library-cta', { view: 'cta' });
  await shoot('06-pengaturan', { view: 'settings' });
  await shoot('07-editor-konten', {
    view: 'planner',
    fullPage: false,
    height: 1100,
    prep: `(() => {
      const rows = window.CPSAS.store.filteredRows();
      const target = rows.find(r => r.cta_teks) || rows[0];
      window.CPSAS.actions.openEdit(target);
      return true;
    })()`,
  });
  await shoot('08-analisis-konten', {
    view: 'planner',
    fullPage: false,
    height: 1150,
    prep: `(() => {
      const rows = window.CPSAS.store.filteredRows().filter(r => r.status === 'tayang' && Number(r.views) > 0);
      window.CPSAS.actions.openAnalysis(rows[0]);
      return true;
    })()`,
  });
  await shoot('09-ponsel-planner', { view: 'planner', width: 414, height: 900, wait: 4800 });
  await shoot('10-ponsel-analitik', { view: 'analytics', width: 414, height: 900, wait: 4800 });

  console.log('\n\x1b[32mSelesai.\x1b[0m');
  ws.close();
}

main()
  .catch((err) => {
    console.error('\x1b[31mGagal membuat tangkapan layar:\x1b[0m', err.message);
    process.exitCode = 1;
  })
  .finally(() => { try { child?.kill(); } catch { /* abaikan */ } });
