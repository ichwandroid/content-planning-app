#!/usr/bin/env node
/** scripts/probe.mjs — Probe DOM cepat: jalankan ekspresi di halaman aplikasi. */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 9336;
const URL = process.argv[2] || 'http://127.0.0.1:4173/?view=planner';
const EXPR = process.argv[3] || 'document.body.innerText.slice(0, 400)';
const browser = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => existsSync(p));

const profile = mkdtempSync(join(tmpdir(), 'cpsas-probe-'));
const child = spawn(browser, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--disable-gpu', '--window-size=1440,1000',
  '--disable-application-cache', '--disk-cache-size=1', '--media-cache-size=1',
  '--disable-features=BackForwardCache,NetworkServiceInProcess',
  'about:blank'], { stdio: 'ignore' });

let id = 0;
const pending = new Map();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitJson(url, tries = 40) {
  for (let i = 0; i < tries; i += 1) {
    try { const r = await fetch(url); if (r.ok) return r.json(); } catch { /* */ }
    await sleep(400);
  }
  throw new Error('Chrome tidak siap');
}
function send(ws, method, params = {}) {
  const mid = ++id;
  ws.send(JSON.stringify({ id: mid, method, params }));
  return new Promise((res, rej) => { pending.set(mid, { res, rej }); setTimeout(() => pending.has(mid) && (pending.delete(mid), rej(new Error(method))), 25000); });
}

try {
  await waitJson(`http://127.0.0.1:${PORT}/json/version`);
  const t = (await waitJson(`http://127.0.0.1:${PORT}/json/list`)).find((x) => x.type === 'page');
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
  });
  await send(ws, 'Page.enable');
  await send(ws, 'Runtime.enable');
  await send(ws, 'Network.enable');
  await send(ws, 'Network.setCacheDisabled', { cacheDisabled: true });
  await send(ws, 'Page.navigate', { url: URL });
  await sleep(5500);
  const r = await send(ws, 'Runtime.evaluate', { expression: EXPR, returnByValue: true, awaitPromise: true });
  console.log(JSON.stringify(r.result?.value ?? r.exceptionDetails, null, 2));
  ws.close();
} catch (err) {
  console.error('Probe gagal:', err.message);
} finally {
  child.kill();
}
