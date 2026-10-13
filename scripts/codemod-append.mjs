#!/usr/bin/env node
/**
 * scripts/codemod-append.mjs — Perbaikan sekali jalan (one-off codemod).
 *
 * MASALAH: `node.append(null, undefined)` pada DOM API menghasilkan TEXT NODE
 * berisi string "null"/"undefined" — bukan diabaikan seperti asumsi umum.
 * Akibatnya teks "null" muncul di kartu konten.
 *
 * SOLUSI: ganti seluruh pemanggilan `.append(...)` pada elemen buatan aplikasi
 * dengan helper `append(parent, children)` dari js/core/util.js yang menyaring
 * nilai kosong lebih dulu.
 *
 * Skrip ini aman dijalankan ulang (idempoten) dan melewati berkas yang sudah
 * memakai helper tersebut.
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Berkas yang diproses (lib/charts.js dilewati: hanya memakai SVG + Node asli). */
const TARGETS = [
  'js/ui/components.js',
  'js/ui/shell.js',
  'js/views/analytics.js',
  'js/views/calendar.js',
  'js/views/cta.js',
  'js/views/editor.js',
  'js/views/planner.js',
  'js/views/settings.js',
];

/** Variabel yang TIDAK boleh diganti: objek bukan-elemen aplikasi. */
const SKIP_VARS = new Set(['document', 'window', 'svg', 'parent', '$']);

/** Pola pemanggilan: nama.append( — nama bukan properti (tidak diawali titik).
 *  `$$` dikecualikan karena `$$(...)` adalah querySelectorAll, bukan elemen. */
const CALL_RE = /(?<![.\w$])(?!\$\$)([A-Za-z_$][\w$]*)\.append\(/g;

function depthOfFile(relPath) {
  return relPath.split('/').length - 1;
}

async function processFile(relPath) {
  const abs = join(ROOT, relPath);
  const original = await readFile(abs, 'utf8');
  let code = original;
  let replaced = 0;

  // Perbaiki sisa kerusakan dari versi codemod sebelumnya (append($( → $$( ).
  const repaired = (code.match(/append\(\$\(/g) || []).length;
  if (repaired) code = code.replace(/append\(\$\(/g, '$$(');

  code = code.replace(CALL_RE, (match, varName) => {
    if (SKIP_VARS.has(varName)) return match;
    replaced += 1;
    return `append(${varName}, `;
  });

  // Buang duplikat nama pada daftar import bila ada.
  const importRe = /^import\s+\{([^}]+)\}\s+from\s+'([^']*core\/util\.js)';$/m;
  const importMatch = code.match(importRe);
  if (importMatch) {
    const unique = [...new Set(importMatch[1].split(',').map((s) => s.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    code = code.replace(importRe, `import { ${unique.join(', ')} } from '${importMatch[2]}';`);
  }

  if (!replaced && !repaired) {
    return { relPath, replaced: 0, skipped: true };
  }

  /* Pastikan helper `append` diimpor dari core/util.js */
  const depth = depthOfFile(relPath);
  const utilPath = `${'../'.repeat(depth)}core/util.js`;
  const importLine = [...code.matchAll(/^import\s+\{([^}]+)\}\s+from\s+'([^']+)';$/gm)]
    .find((m) => m[2].endsWith('core/util.js'));

  if (!importLine) {
    return { relPath, replaced, error: `Tidak menemukan import dari core/util.js` };
  }
  const names = importLine[1].split(',').map((s) => s.trim()).filter(Boolean);
  if (!names.includes('append')) {
    names.push('append');
    names.sort((a, b) => a.localeCompare(b));
    code = code.replace(importLine[0], `import { ${names.join(', ')} } from '${importLine[2]}';`);
  }

  /* Jika ada kurung yang tidak seimbang, batalkan perubahan berkas ini. */
  const open = (code.match(/\(/g) || []).length;
  const close = (code.match(/\)/g) || []).length;
  if (open !== close) {
    return { relPath, replaced, error: `Kurung tidak seimbang setelah perubahan (${open} vs ${close})` };
  }

  await writeFile(abs, code, 'utf8');
  return { relPath, replaced };
}

async function main() {
  console.log('\x1b[1mCodemod: .append() → append() aman\x1b[0m');
  let total = 0;
  let failed = 0;
  for (const rel of TARGETS) {
    const res = await processFile(rel);
    if (res.error) {
      failed += 1;
      console.log(`  \x1b[31m✗\x1b[0m ${rel} — ${res.error}`);
      continue;
    }
    total += res.replaced;
    console.log(`  \x1b[32m✓\x1b[0m ${rel} — ${res.replaced} pemanggilan diperbaiki`);
  }
  console.log(`\nTotal: ${total} pemanggilan${failed ? `, ${failed} berkas gagal` : ''}.`);
  if (failed) process.exitCode = 1;
}

main().catch((err) => {
  console.error('Codemod gagal:', err);
  process.exitCode = 1;
});
