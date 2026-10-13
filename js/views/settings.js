/**
 * views/settings.js — Halaman pengaturan: status koneksi database, panduan setup
 * Google Sheet (tanpa API), uji tulis, impor/ekspor, dan identitas sekolah.
 */

import { APP, DB, DB_READY, FIELDS, SCHOOL_PROFILE } from '../core/config.js';
import { fmtDateTime, fmtNumber } from '../core/format.js';
import { $, append, copyText, download, el, openExternal, store as ls } from '../core/util.js';
import * as anim from '../lib/anim.js';

import * as store from '../data/store.js';
import { api, clearCache, gvizJsonUrl, isDemo, readRows, sheetEditUrl, toSheetRow, verifyWrite } from '../data/sheet.js';
import { demoRows } from '../data/seed.js';
import {
  button, confirmDialog, copyRow, emptyState, field, icon, openModal, panel, table, toast,
  toastError, toastSuccess, toastWarn,
} from '../ui/components.js';

/* -------------------------------- RENDER ------------------------------- */

export function renderSettings() {
  const host = $('#settings-root');
  if (!host) return;
  host.innerHTML = '';

  append(host, connectionPanel());
  append(host, setupPanel());
  append(host, schemaPanel());
  append(host, profilePanel());
  append(host, dataPanel());
  append(host, aboutPanel());

  anim.animateListRows(host, '.step-item');
  anim.animateListRows(host, '.config-block');
}

/* ----------------------------- KONEKSI -------------------------------- */

function connectionPanel() {
  const state = store.state;
  const demo = isDemo();
  const labels = {
    'gviz-jsonp': ['Terhubung ke Google Sheet', 'ok', 'Data dibaca langsung dari endpoint publik gviz (JSONP) — bebas CORS.'],
    'apps-script': ['Terhubung lewat Apps Script', 'ok', 'Data dibaca dari Web App Apps Script (doGet JSONP).'],
    'gviz-csv': ['Terhubung (mode CSV)', 'warn', 'JSONP diblokir jaringan Anda, aplikasi beralih ke ekspor CSV.'],
    demo: ['Mode Demo', 'warn', 'Belum ada SPREADSHEET_ID. Data contoh disimpan di browser ini saja.'],
    lokal: ['Data lokal browser', 'warn', 'Menggunakan data yang tersimpan di perangkat ini.'],
    'cache-lokal': ['Cache lokal (offline)', 'error', 'Sheet tidak bisa diakses; menampilkan data terakhir yang tersimpan.'],
    none: ['Tidak terhubung', 'error', state.error || 'Periksa ID Sheet dan izin akses publik.'],
    manual: ['Impor manual', 'warn', 'Data berasal dari berkas CSV yang Anda impor.'],
  };
  const [title, tone, detail] = labels[state.source] || ['Tidak diketahui', 'warn', ''];

  const body = el('div', { class: 'settings-block' });
  append(body, el('div', { class: `conn-status conn-status--${tone}` }, [
    el('span', { class: 'conn-status__dot' }),
    el('div', {}, [
      el('strong', { text: title }),
      el('p', { class: 'muted small', text: detail }),
      el('p', { class: 'muted small', text: `Sumber: ${state.source} • ${fmtNumber(state.rows?.length || 0)} baris • diperbarui ${state.lastSync ? fmtDateTime(state.lastSync) : 'belum pernah'}` }),
    ]),
  ]));

  const grid = el('div', { class: 'settings-kv' });
  const items = [
    ['Spreadsheet ID', DB_READY.hasSheet ? DB.SPREADSHEET_ID : 'Belum diisi', DB_READY.hasSheet],
    ['Nama tab', DB.SHEET_NAME, true],
    ['URL Apps Script', DB_READY.hasScript ? DB.APPS_SCRIPT_URL : 'Belum diisi', DB_READY.hasScript],
    ['Antrean sinkronisasi', `${store.pendingCount()} perubahan`, store.pendingCount() === 0],
  ];
  items.forEach(([label, value, ok]) => {
    const row = el('div', { class: 'settings-kv__row' });
    append(row, 
      el('span', { class: 'settings-kv__label', text: label }),
      el('code', { class: `settings-kv__value ${ok ? '' : 'is-bad'}`, text: String(value) }),
    );
    append(grid, row);
  });
  append(body, grid);

  const actions = el('div', { class: 'settings-actions' });
  append(actions, 
    button('Tes koneksi baca', {
      iconName: 'refresh', variant: 'primary',
      onClick: async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        toast('Menguji koneksi ke Google Sheet…', { tone: 'info', timeout: 2000 });
        const res = await store.load();
        btn.disabled = false;
        if (res.ok) toastSuccess(`Berhasil membaca ${fmtNumber(res.count)} baris (${res.source}).`);
        else toastError(res.error || 'Gagal membaca Sheet.');
      },
    }),
    button('Tes koneksi tulis', {
      iconName: 'cloud',
      onClick: async () => {
        if (!DB_READY.hasScript) return toastWarn('Isi APPS_SCRIPT_URL dulu di js/core/config.js.');
        const id = `tes_${Date.now().toString(36)}`;
        const res = await store.upsert({
          id, judul: '[UJI KONEKSI] baris ini boleh dihapus', platform: 'website', status: 'ide',
          tanggal: new Date().toISOString().slice(0, 10), catatan: `Dibuat oleh aplikasi pada ${new Date().toLocaleString('id-ID')}`,
        });
        if (res.sync?.ok) {
          toastSuccess('Perintah tulis terkirim. Cek Sheet: baris uji harus muncul beberapa detik lagi.', { timeout: 8000 });
          const v = await verifyWrite(id);
          if (v.verified) toastSuccess('Terverifikasi: baris uji ditemukan di Sheet ✓');
          else toastWarn('Belum terverifikasi otomatis — buka Sheet untuk memastikan (mungkin perlu refresh).', { timeout: 8000 });
        } else {
          toastError(res.sync?.error || 'Gagal mengirim perintah tulis. Periksa URL /exec & akses "Anyone".');
        }
      },
    }),
    button('Bersihkan cache lokal', {
      iconName: 'trash',
      onClick: () => {
        confirmDialog({
          title: 'Bersihkan cache?',
          message: 'Data yang tersimpan di browser (cache baris & antrean sinkronisasi) akan dihapus. Data di Google Sheet tidak terpengaruh.',
          confirmLabel: 'Bersihkan',
          onConfirm: () => {
            clearCache();
            ls.del('rows');
            ls.del('sync-queue');
            ls.del('meta');
            toastSuccess('Cache lokal dibersihkan. Muat ulang data untuk mengambil dari Sheet.');
            store.load();
          },
        });
      },
    }),
    DB_READY.hasSheet ? button('Buka Google Sheet', { iconName: 'external', onClick: () => openExternal(sheetEditUrl()) }) : null,
    DB_READY.hasSheet ? button('Salin URL gviz', {
      iconName: 'copy',
      onClick: async () => { await copyText(gvizJsonUrl()); toastSuccess('URL gviz (pembacaan publik) disalin.'); },
    }) : null,
  );
  append(body, actions);

  return panel('Status Koneksi Database', body, {
    subtitle: 'Database: Google Sheet tanpa Google API — baca via gviz (JSONP), tulis via Apps Script Web App.',
    cls: 'panel--wide',
  });
}

/* -------------------------------- SETUP -------------------------------- */

function setupPanel() {
  const steps = [
    {
      title: '1. Buat Google Sheet baru',
      detail: 'Buka sheets.new, beri nama misalnya "Database Content Planner Sekolah Anak Saleh".',
    },
    {
      title: '2. Beri nama tab "Content"',
      detail: 'Klik kanan nama tab di bawah → Rename → tulis Content (harus sama persis dengan DB.SHEET_NAME).',
    },
    {
      title: '3. Tempel 26 header kolom',
      detail: 'Salin baris header di bawah, tempel ke sel A1 (satu baris, dipisah Tab agar otomatis terbagi ke kolom).',
      action: 'Salin header',
      payload: () => FIELDS.map((f) => f.label).join('\t'),
    },
    {
      title: '4. Bagikan Sheet ke publik (hanya baca)',
      detail: 'Klik Share → General access → "Anyone with the link" → Viewer → Done. Tanpa langkah ini pembacaan akan gagal.',
    },
    {
      title: '5. Salin SPREADSHEET_ID',
      detail: 'Ambil dari URL: docs.google.com/spreadsheets/d/[ID_INI]/edit — tempel ke DB.SPREADSHEET_ID di js/core/config.js.',
      action: 'Salin contoh baris config',
      payload: () => `SPREADSHEET_ID: '${DB_READY.hasSheet ? DB.SPREADSHEET_ID : '1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890'}'`,
    },
    {
      title: '6. Aktifkan penulisan (opsional tapi disarankan)',
      detail: 'Extensions → Apps Script → tempel isi apps-script/Code.gs → Deploy → New deployment → Web app → Execute as: Me, Who has access: Anyone → salin URL /exec ke DB.APPS_SCRIPT_URL.',
      action: 'Lihat panduan lengkap',
      payload: 'docs/02-setup-apps-script.md',
    },
    {
      title: '7. Muat ulang aplikasi',
      detail: 'Setelah config diisi, klik "Tes koneksi baca" di atas. Indikator kanan atas akan berubah dari "Mode Demo" menjadi nama Sheet.',
    },
  ];

  const list = el('div', { class: 'step-list' });
  steps.forEach((s) => {
    const item = el('article', { class: 'step-item' });
    append(item, el('h4', { text: s.title }), el('p', { text: s.detail }));
    if (s.action) {
      append(item, button(s.action, {
        size: 'sm', iconName: 'copy',
        onClick: async () => {
          const payload = s.payload();
          if (payload.startsWith('docs/')) {
            openExternal(payload.replace('docs/', './docs/'));
            return;
          }
          await copyText(payload);
          toastSuccess(`${s.action} — tersalin ke clipboard.`);
        },
      }));
    }
    append(list, item);
  });

  const configBlock = el('div', { class: 'config-block' });
  append(configBlock, 
    el('div', { class: 'config-block__head' }, [
      el('strong', { text: 'js/core/config.js' }),
      button('Salin blok', { size: 'sm', iconName: 'copy', onClick: async () => { await copyText(CONFIG_SNIPPET); toastSuccess('Blok config disalin.'); } }),
    ]),
    el('pre', { class: 'config-block__code', text: CONFIG_SNIPPET }),
  );

  const wrap = el('div', { class: 'settings-block' });
  append(wrap, el('div', { class: 'warn-box' }, [
    '<strong>Tidak perlu Google API, OAuth, atau API key.</strong> Pembacaan memakai endpoint publik gviz milik Google Sheets (JSONP). Penulisan memakai Apps Script Web App yang Anda deploy sendiri. Konsekuensinya: siapa pun yang memiliki URL /exec dapat menulis ke Sheet tersebut — simpan URL itu secara internal dan jangan dibagikan ke publik.',
  ].join(' ')));
  append(wrap, list, configBlock);
  return panel('Panduan Menghubungkan Google Sheet', wrap, {
    subtitle: 'Ikuti berurutan. Total waktu ±5 menit.',
    cls: 'panel--wide',
  });
}

const CONFIG_SNIPPET = `// js/core/config.js
export const DB = Object.freeze({
  SPREADSHEET_ID: '1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890', // dari URL Sheet
  SHEET_NAME: 'Content',                                   // nama tab
  CTA_SHEET_NAME: 'CTA',                                   // opsional
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycb.../exec',
  TIMEOUT: 15000,
});`;

/* ------------------------------- SKEMA --------------------------------- */

function schemaPanel() {
  const columns = [
    { key: 'label', label: 'Kolom (header)' },
    { key: 'key', label: 'Kunci internal' },
    { key: 'type', label: 'Tipe' },
    { key: 'desc', label: 'Keterangan' },
  ];
  const desc = {
    id: 'ID unik otomatis (ct_xxx) — jangan diubah manual.',
    tanggal: 'Format YYYY-MM-DD. Dipakai kalender & heatmap.',
    jam: 'Format HH.MM (24 jam) waktu WIB.',
    judul: 'Judul internal konten (wajib).',
    platform: 'instagram | tiktok | youtube | facebook | whatsapp | website',
    format: 'Reels, Carousel, Video, Shorts, Story, Artikel, dll.',
    pilar: 'akademik | karakter | tahfiz | kesiswaan | ppdb | sarana | guru | testimoni | edukasi | event',
    status: 'ide | draf | review | siap | tayang | arsip',
    caption: 'Teks caption lengkap yang akan/telah diunggah.',
    hashtag: 'Daftar hashtag dipisah spasi.',
    cta_jenis: 'follow | simpan | komentar | bagikan | daftar | hubungi | kunjungan | unduh | link-bio | donasi | agenda | lainnya',
    cta_teks: 'Kalimat ajakan yang tampil di caption.',
    cta_link: 'URL tujuan CTA (sebaiknya memakai UTM).',
    asset_url: 'Tautan Drive/Canva berisi materi mentah.',
    post_url: 'URL postingan setelah tayang (untuk embed & oEmbed).',
    views: 'Jumlah tayangan/impresi.',
    likes: 'Jumlah suka.',
    comments: 'Jumlah komentar.',
    shares: 'Jumlah bagikan.',
    saves: 'Jumlah simpan/bookmark.',
    followers_gain: 'Pertambahan follower dari konten ini.',
    klik_link: 'Klik pada tautan CTA (dari link shortener/UTM).',
    pendaftar: 'Jumlah pendaftar/leads dari konten ini.',
    pic: 'Penanggung jawab produksi.',
    catatan: 'Catatan brief/evaluasi.',
    diperbarui: 'Stempel waktu pembaruan terakhir (otomatis).',
  };
  const rows = FIELDS.map((f) => ({ ...f, desc: desc[f.key] || '' }));
  const t = table(columns, rows, {
    renderCell: (row, col) => {
      if (col.key === 'label') return el('code', { text: row.label });
      if (col.key === 'key') return el('code', { class: 'muted', text: row.key });
      if (col.key === 'type') return row.type;
      return el('span', { class: 'small', text: row.desc });
    },
  });
  const wrap = el('div', { class: 'settings-block' });
  append(wrap, el('p', { class: 'muted small', html: `Total <strong>${FIELDS.length} kolom</strong> (A–${String.fromCharCode(64 + FIELDS.length)}). Urutan kolom di Sheet harus sama; header tidak boleh digeser atau diganti nama.` }));
  append(wrap, t);
  append(wrap, el('div', { class: 'info-box', text: 'Tip: baris kosong diabaikan otomatis. Kolom angka boleh dikosongkan — akan dihitung sebagai 0.' }));
  return panel('Skema Kolom Google Sheet', wrap, {
    subtitle: 'Skema ini harus cocok dengan tab "Content".',
    cls: 'panel--wide',
  });
}

/* ------------------------------ PROFIL -------------------------------- */

function profilePanel() {
  const wrap = el('div', { class: 'settings-block' });
  append(wrap, el('p', { class: 'muted small', html: 'Ubah identitas sekolah di <code>js/core/config.js</code> pada objek <code>SCHOOL_PROFILE</code>. Nilai ini dipakai untuk generator CTA, tautan cepat, dan hashtag.' }));
  const grid = el('div', { class: 'settings-kv' });
  Object.entries(SCHOOL_PROFILE).forEach(([k, v]) => {
    const row = el('div', { class: 'settings-kv__row' });
    append(row, el('span', { class: 'settings-kv__label', text: k }), el('code', { class: 'settings-kv__value', text: String(v) }));
    append(grid, row);
  });
  append(wrap, grid);
  return panel('Identitas Sekolah', wrap, { cls: 'panel--wide' });
}

/* -------------------------------- DATA -------------------------------- */

function dataPanel() {
  const wrap = el('div', { class: 'settings-block' });

  const importArea = el('div', { class: 'dropzone', id: 'csv-dropzone' });
  append(importArea, 
    el('p', { html: '<strong>Impor CSV</strong> — tarik berkas CSV ke sini atau pilih berkas. Header kolom harus sama dengan skema di atas.' }),
    (() => {
      const input = el('input', { type: 'file', accept: '.csv,text/csv', id: 'csv-input', class: 'sr-only' });
      input.addEventListener('change', () => handleCsvFile(input.files?.[0]));
      return input;
    })(),
    button('Pilih berkas CSV', { size: 'sm', iconName: 'download', onClick: () => $('#csv-input').click() }),
  );
  importArea.addEventListener('dragover', (e) => { e.preventDefault(); importArea.classList.add('is-over'); });
  importArea.addEventListener('dragleave', () => importArea.classList.remove('is-over'));
  importArea.addEventListener('drop', (e) => {
    e.preventDefault();
    importArea.classList.remove('is-over');
    handleCsvFile(e.dataTransfer.files?.[0]);
  });

  const actions = el('div', { class: 'settings-actions' });
  append(actions, 
    button('Isi data contoh (24 konten)', {
      iconName: 'spark', variant: 'gold',
      onClick: () => {
        confirmDialog({
          title: 'Isi data contoh?',
          message: 'Data contoh akan dimuat ke aplikasi. Di Mode Demo data disimpan di browser; jika Sheet sudah terhubung, gunakan "Kirim ke Sheet" setelahnya.',
          confirmLabel: 'Isi data contoh',
          tone: 'primary',
          onConfirm: async () => {
            store.replaceAll(demoRows());
            toastSuccess('24 konten contoh dimuat. Buka Planner untuk melihatnya.');
          },
        });
      },
    }),
    button('Kirim semua data ke Sheet', {
      iconName: 'cloud',
      onClick: async () => {
        if (!DB_READY.hasScript) return toastWarn('Apps Script belum dikonfigurasi.');
        const res = await api.bulk(store.state.rows);
        if (res.ok) toastSuccess(`${store.state.rows.length} baris dikirim ke Sheet (mode bulk upsert).`, { timeout: 6000 });
        else toastError(res.error || 'Gagal mengirim data.');
      },
    }),
    button('Unduh cadangan CSV', {
      iconName: 'download',
      onClick: () => {
        const headers = FIELDS.map((f) => f.label);
        const lines = [headers.join(',')];
        store.state.rows.forEach((r) => lines.push(toSheetRow(r).map((v) => {
          const s = v == null ? '' : String(v);
          return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        }).join(',')));
        download(`cadangan-content-planner-${new Date().toISOString().slice(0, 10)}.csv`, `\uFEFF${lines.join('\r\n')}`);
        toastSuccess('Cadangan CSV diunduh (kompatibel dengan Google Sheets).');
      },
    }),
    button('Hapus semua data lokal', {
      iconName: 'trash', variant: 'danger',
      onClick: () => confirmDialog({
        title: 'Hapus semua data lokal?',
        message: 'Seluruh baris yang tersimpan di browser akan dihapus. Data di Google Sheet tidak terpengaruh.',
        confirmLabel: 'Hapus semua',
        onConfirm: () => {
          ls.del('rows');
          store.replaceAll([]);
          toastSuccess('Data lokal dikosongkan.');
        },
      }),
    }),
  );

  append(wrap, importArea, actions);
  return panel('Impor & Ekspor Data', wrap, {
    subtitle: 'Migrasi cepat, cadangan berkala, atau mengisi data contoh untuk pelatihan tim.',
    cls: 'panel--wide',
  });
}

async function handleCsvFile(file) {
  if (!file) return;
  const text = await file.text();
  const { parseCsv } = await import('../data/sheet.js');
  const rows = parseCsv(text);
  if (!rows.length) return toastError('Berkas tidak berisi baris data yang bisa dibaca.');
  const { importRows } = store;
  await importRows(rows);
  toastSuccess(`${rows.length} baris diimpor. Buka Planner untuk memeriksa hasilnya.`);
}

/* -------------------------------- ABOUT -------------------------------- */

function aboutPanel() {
  const wrap = el('div', { class: 'settings-block' });
  const grid = el('div', { class: 'settings-kv' });
  [
    ['Nama aplikasi', APP.name],
    ['Versi', APP.version],
    ['Zona waktu', APP.timezone],
    ['Penyimpanan lokal', `${APP.storagePrefix}.* (localStorage)`],
    ['Mode saat ini', isDemo() ? 'Demo (localStorage)' : 'Terhubung Google Sheet'],
  ].forEach(([k, v]) => {
    const row = el('div', { class: 'settings-kv__row' });
    append(row, el('span', { class: 'settings-kv__label', text: k }), el('code', { class: 'settings-kv__value', text: v }));
    append(grid, row);
  });
  append(wrap, grid);

  const help = el('div', { class: 'settings-help' });
  help.innerHTML = `
    <h4>Butuh bantuan?</h4>
    <ul>
      <li><strong>Data tidak muncul:</strong> pastikan Sheet dibagikan "Anyone with the link → Viewer", lalu klik Tes koneksi baca.</li>
      <li><strong>Perubahan tidak masuk Sheet:</strong> periksa URL /exec dan setelan deploy (Execute as: Me, Who has access: Anyone).</li>
      <li><strong>Kolom bergeser:</strong> header harus sama persis urutannya seperti skema di atas.</li>
      <li><strong>Embed tidak tampil:</strong> sebagian platform membatasi tampilan embed; gunakan tombol "Buka postingan".</li>
      <li><strong>Metrik tidak otomatis:</strong> tanpa token API resmi, isi metrik manual dari insight platform (atau minta bantuan AI membaca tangkapan layar).</li>
    </ul>`;
  append(wrap, help);

  const docs = el('div', { class: 'settings-actions' });
  [['01-setup-google-sheet.md', 'Panduan Google Sheet'], ['02-setup-apps-script.md', 'Panduan Apps Script'], ['03-deploy.md', 'Panduan Deploy'], ['04-arsitektur.md', 'Arsitektur & Rumus']]
    .forEach(([file, label]) => append(docs, button(label, { size: 'sm', iconName: 'external', onClick: () => openExternal(`docs/${file}`) })));
  append(wrap, docs);

  return panel('Tentang & Bantuan', wrap, { cls: 'panel--wide' });
}

export function bindSettings() {
  /* tombol di dalam panel dibuat saat render, jadi tidak perlu binding tambahan */
}
