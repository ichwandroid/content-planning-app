#!/usr/bin/env node
/**
 * scripts/serve.mjs — Server statis tanpa dependensi untuk pengembangan lokal.
 *
 * Pakai:
 *   node scripts/serve.mjs            → http://localhost:4173
 *   node scripts/serve.mjs 8080       → port kustom
 *   node scripts/serve.mjs 8080 --host 0.0.0.0   → bisa diakses dari HP di WiFi yang sama
 *
 * Catatan: aplikasi memakai ES modules, jadi WAJIB dijalankan lewat HTTP
 * (membuka index.html langsung dengan file:// akan gagal karena CORS modul).
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
const portArg = args.find((a) => /^\d+$/.test(a));
const hostFlag = args.indexOf('--host');
const HOST = hostFlag >= 0 ? (args[hostFlag + 1] || '0.0.0.0') : '127.0.0.1';
const PORT = Number(portArg || process.env.PORT || 4173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.gs': 'text/javascript; charset=utf-8',
};

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const rel = normalize(decoded).replace(/^([/\\])+/, '');
  const abs = resolve(join(ROOT, rel));
  return abs.startsWith(ROOT) ? abs : null;
}

const server = createServer(async (req, res) => {
  const started = Date.now();
  try {
    let target = safePath(req.url === '/' ? '/index.html' : req.url);
    if (!target) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    let info = await stat(target).catch(() => null);
    if (info?.isDirectory()) {
      target = join(target, 'index.html');
      info = await stat(target).catch(() => null);
    }
    if (!info) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<h1>404</h1><p>${req.url} tidak ditemukan.</p><p><a href="/">Kembali ke aplikasi</a></p>`);
      log(req, 404, started);
      return;
    }
    const body = await readFile(target);
    res.writeHead(200, {
      'Content-Type': MIME[extname(target).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(body);
    log(req, 200, started);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`500 — ${err.message}`);
    log(req, 500, started);
  }
});

function log(req, status, started) {
  const ms = Date.now() - started;
  const tone = status >= 400 ? '\x1b[31m' : '\x1b[32m';
  console.log(`${tone}${status}\x1b[0m ${req.method} ${req.url} \x1b[90m${ms}ms\x1b[0m`);
}

server.listen(PORT, HOST, () => {
  const shown = HOST === '0.0.0.0' ? 'localhost' : HOST;
  console.log('\n\x1b[36mContent Planner Sekolah Anak Saleh\x1b[0m');
  console.log(`  Lokal   : http://${shown}:${PORT}/`);
  if (HOST === '0.0.0.0') console.log(`  Jaringan: http://<IP-komputer-anda>:${PORT}/  (buka dari HP)`);
  console.log(`  Root    : ${ROOT}`);
  console.log('  Hentikan: Ctrl+C\n');
});
