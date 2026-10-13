/**
 * ============================================================================
 *  Content Planner Sekolah Anak Saleh — Backend Google Apps Script
 * ============================================================================
 *  TEMPEL SELURUH ISI FILE INI KE: Google Sheet → Extensions → Apps Script
 *
 *  TUGAS FILE INI
 *   1. doGet  → membaca data (JSON / JSONP) supaya aplikasi bisa sinkron 2 arah
 *               tanpa Google API, tanpa OAuth, tanpa API key.
 *   2. doPost → menulis data (save / delete / bulk) dari aplikasi web statis.
 *      Permintaan dikirim dengan Content-Type: text/plain agar tidak memicu
 *      preflight CORS — inilah trik "tanpa API" yang dipakai aplikasi.
 *
 *  CARA PAKAI (ringkas)
 *   1. Simpan file ini (Ctrl+S).
 *   2. Jalankan fungsi  setup()  satu kali, izinkan akses saat diminta.
 *   3. Deploy → New deployment → Web app
 *        Description    : content-planner
 *        Execute as     : Me
 *        Who has access : Anyone        ← WAJIB, kalau tidak, POST akan diredirect ke login
 *   4. Salin URL yang berakhiran /exec  → tempel ke js/core/config.js (APPS_SCRIPT_URL)
 *   5. Di aplikasi: Pengaturan → "Tes koneksi tulis".
 *
 *  KEAMANAN
 *   Siapa pun yang memiliki URL /exec dapat menulis ke Sheet ini. Untuk sekolah,
 *   isi SECRET_TOKEN di bawah DAN di js/core/config.js agar hanya aplikasi Anda
 *   yang bisa menulis. Jika URL bocor: Deploy → Manage deployments → Archive,
 *   lalu buat deployment baru (URL berubah).
 * ============================================================================
 */

/** ======================== KONFIGURASI ==================================== */

/** Nama tab yang dipakai aplikasi (harus sama dengan DB.SHEET_NAME). */
var SHEET_NAME = 'Content';

/** Tab opsional untuk library CTA kustom. Kosongkan ('') bila tidak dipakai. */
var CTA_SHEET_NAME = 'CTA';

/**
 * Isi token acak (contoh: 'sas-2026-rahasia-9f3a') lalu isi nilai yang SAMA
 * pada js/core/config.js → DB.APP_SCRIPT_TOKEN. Biarkan '' bila ingin terbuka.
 */
var SECRET_TOKEN = '';

/** true = hanya boleh menulis, tidak boleh menghapus baris. */
var READ_ONLY = false;

/** Kirim notifikasi email setiap ada konten baru? Kosongkan bila tidak perlu. */
var NOTIFY_EMAIL = '';

/** Header kolom PERSIS seperti di aplikasi (urutan wajib sama). */
var HEADERS = [
  'ID', 'Tanggal', 'Jam', 'Judul', 'Platform', 'Format', 'Pilar', 'Status',
  'Caption', 'Hashtag', 'CTA Jenis', 'CTA Teks', 'CTA Link', 'Asset URL', 'Post URL',
  'Views', 'Likes', 'Comments', 'Shares', 'Saves', 'Followers Gain', 'Klik Link',
  'Pendaftar', 'PIC', 'Catatan', 'Diperbarui'
];

var NUMERIC_HEADERS = ['Views', 'Likes', 'Comments', 'Shares', 'Saves', 'Followers Gain', 'Klik Link', 'Pendaftar'];
var LAST_COL = columnLetter(HEADERS.length); // 'Z'

/** ========================== ENTRY POINT ================================== */

/**
 * GET — dipakai aplikasi untuk membaca & verifikasi.
 * Contoh: .../exec?action=list&callback=cb123
 */
function doGet(e) {
  var params = (e && e.parameter) || {};
  var callback = params.callback || '';
  var action = (params.action || 'list').toLowerCase();

  try {
    if (action === 'ping') return respond({ ok: true, action: 'ping', sheet: SHEET_NAME, now: new Date().toISOString() }, callback);
    if (action === 'setup') return respond(setup(), callback);

    var sheetName = params.sheet || SHEET_NAME;
    var rows = readSheet(sheetName);
    return respond({ ok: true, action: 'list', sheet: sheetName, count: rows.length, rows: rows, updatedAt: new Date().toISOString() }, callback);
  } catch (err) {
    return respond({ ok: false, error: String(err && err.message ? err.message : err) }, callback);
  }
}

/**
 * POST — dipakai aplikasi untuk menulis.
 * Body: JSON { action, sheet, record | id | records, token }
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var payload = parseBody(e);

    if (SECRET_TOKEN && payload.token !== SECRET_TOKEN) {
      return respond({ ok: false, error: 'Token tidak sesuai. Periksa DB.APP_SCRIPT_TOKEN.' });
    }

    var sheetName = payload.sheet || SHEET_NAME;
    var action = String(payload.action || '').toLowerCase();
    var result;

    switch (action) {
      case 'save':
      case 'upsert':
        result = upsertRecord(sheetName, payload.record || {});
        break;
      case 'delete':
        result = deleteRecord(sheetName, payload.id || payload.record && payload.record.id);
        break;
      case 'bulk':
        result = bulkUpsert(sheetName, payload.records || []);
        break;
      case 'ping':
        result = { ok: true, action: 'ping', sheet: sheetName, writeBackend: true };
        break;
      case 'setup':
        result = setup();
        break;
      default:
        result = { ok: false, error: 'Aksi tidak dikenal: ' + action };
    }

    if (NOTIFY_EMAIL && action === 'save' && result && result.created) {
      try {
        MailApp.sendEmail(NOTIFY_EMAIL, '[Content Planner] Konten baru: ' + (payload.record.judul || '(tanpa judul)'),
          'Platform: ' + payload.record.platform + '\nTanggal: ' + payload.record.tanggal + '\nOleh: ' + payload.record.pic);
      } catch (mailErr) { /* notifikasi opsional, jangan gagalkan simpan */ }
    }

    return respond(result);
  } catch (err) {
    return respond({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

/** ============================ BACA ======================================= */

function readSheet(sheetName) {
  var sheet = getSheet(sheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var raw = values[i];
    var obj = {};
    var empty = true;
    for (var c = 0; c < HEADERS.length; c++) {
      var value = formatCell(raw[c], HEADERS[c]);
      obj[keyOf(HEADERS[c])] = value;
      if (value !== '' && value !== 0) empty = false;
    }
    if (!empty) out.push(obj);
  }
  return out;
}

function formatCell(value, header) {
  if (value === null || value === undefined || value === '') {
    return NUMERIC_HEADERS.indexOf(header) >= 0 ? 0 : '';
  }
  if (value instanceof Date) {
    if (header === 'Tanggal') return Utilities.formatDate(value, timezone(), 'yyyy-MM-dd');
    if (header === 'Jam') return Utilities.formatDate(value, timezone(), 'HH:mm');
    return Utilities.formatDate(value, timezone(), "yyyy-MM-dd'T'HH:mm:ss");
  }
  return value;
}

/** ============================ TULIS ====================================== */

function upsertRecord(sheetName, record) {
  if (READ_ONLY) return { ok: false, error: 'Backend dalam mode baca saja (READ_ONLY = true).' };
  var sheet = getSheet(sheetName);
  var id = String(record.id || '').trim();
  if (!id) {
    id = 'ct_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    record.id = id;
  }
  record.diperbarui = new Date().toISOString();

  var rowIndex = findRowById(sheet, id);
  var values = toRowArray(record);

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, HEADERS.length).setValues([values]);
    return { ok: true, action: 'save', updated: true, id: id, row: rowIndex };
  }
  sheet.appendRow(values);
  return { ok: true, action: 'save', created: true, id: id, row: sheet.getLastRow() };
}

function bulkUpsert(sheetName, records) {
  if (READ_ONLY) return { ok: false, error: 'Backend dalam mode baca saja (READ_ONLY = true).' };
  if (!records || !records.length) return { ok: false, error: 'Tidak ada data untuk disimpan.' };
  var sheet = getSheet(sheetName);
  var index = buildIdIndex(sheet);
  var updated = 0;
  var created = 0;

  for (var i = 0; i < records.length; i++) {
    var record = records[i] || {};
    var id = String(record.id || '').trim();
    if (!id) {
      id = 'ct_' + Date.now().toString(36) + i;
      record.id = id;
    }
    record.diperbarui = new Date().toISOString();
    var values = toRowArray(record);
    var at = index[id];
    if (at) {
      sheet.getRange(at, 1, 1, HEADERS.length).setValues([values]);
      updated++;
    } else {
      sheet.appendRow(values);
      index[id] = sheet.getLastRow();
      created++;
    }
  }
  SpreadsheetApp.flush();
  return { ok: true, action: 'bulk', created: created, updated: updated, total: records.length };
}

function deleteRecord(sheetName, id) {
  if (READ_ONLY) return { ok: false, error: 'Backend dalam mode baca saja (READ_ONLY = true).' };
  id = String(id || '').trim();
  if (!id) return { ok: false, error: 'ID kosong.' };
  var sheet = getSheet(sheetName);
  var rowIndex = findRowById(sheet, id);
  if (rowIndex < 1) return { ok: false, error: 'Baris dengan ID ' + id + ' tidak ditemukan.' };
  sheet.deleteRow(rowIndex);
  return { ok: true, action: 'delete', id: id, row: rowIndex };
}

function findRowById(sheet, id) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === id) return i + 2;
  }
  return -1;
}

function buildIdIndex(sheet) {
  var index = {};
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return index;
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    var id = String(ids[i][0]).trim();
    if (id) index[id] = i + 2;
  }
  return index;
}

function toRowArray(record) {
  var out = [];
  for (var i = 0; i < HEADERS.length; i++) {
    var header = HEADERS[i];
    var value = record[keyOf(header)];
    if (NUMERIC_HEADERS.indexOf(header) >= 0) {
      value = Number(value);
      if (isNaN(value)) value = 0;
    } else {
      value = value === null || value === undefined ? '' : String(value);
    }
    out.push(value);
  }
  return out;
}

/** ============================ SETUP ====================================== */

/**
 * Jalankan SEKALI dari editor Apps Script:
 *  - membuat tab "Content" (dan "CTA") bila belum ada
 *  - menulis baris header
 *  - memformat kolom tanggal/jam serta membekukan baris pertama
 *  - menambahkan 2 baris contoh agar mudah diperiksa
 */
function setup() {
  var created = [];
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    created.push(SHEET_NAME);
  }

  var headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
  var current = headerRange.getValues()[0];
  var isDifferent = current.join('|') !== HEADERS.join('|');
  if (isDifferent) {
    headerRange.setValues([HEADERS]);
  }
  headerRange.setFontWeight('bold')
    .setBackground('#0F766E')
    .setFontColor('#FFFFFF')
    .setVerticalAlignment('middle');
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 160);   // ID
  sheet.setColumnWidth(4, 260);   // Judul
  sheet.setColumnWidth(9, 360);   // Caption

  // format kolom Tanggal & Jam agar tidak berubah menjadi angka
  sheet.getRange(2, 2, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat('yyyy-mm-dd');
  sheet.getRange(2, 3, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat('@STRING@');

  if (sheet.getLastRow() < 2) {
    sheet.appendRow(toRowArray({
      id: 'ct_contoh_1', tanggal: Utilities.formatDate(new Date(), timezone(), 'yyyy-MM-dd'), jam: '19.30',
      judul: 'Contoh: Tur Fasilitas Kelas Tahfiz', platform: 'instagram', format: 'Reels', pilar: 'sarana',
      status: 'ide', caption: 'Bunda, yuk lihat langsung kelas Tahfiz kami…', hashtag: '#SekolahAnakSaleh #PPDB2026',
      cta_jenis: 'kunjungan', cta_teks: 'Daftar kunjungan gratis lewat link di bio ya 📅',
      cta_link: 'https://sekolahanaksaleh.sch.id/ppdb', pic: 'Tim Media', catatan: 'Baris contoh, boleh dihapus.'
    }));
    sheet.appendRow(toRowArray({
      id: 'ct_contoh_2', tanggal: Utilities.formatDate(new Date(), timezone(), 'yyyy-MM-dd'), jam: '12.30',
      judul: 'Contoh: 5 Adab Pagi Anak Saleh', platform: 'tiktok', format: 'Video', pilar: 'karakter',
      status: 'tayang', caption: '5 kebiasaan pagi yang kami biasakan di sekolah…', hashtag: '#AdabSebelumIlmu',
      cta_jenis: 'simpan', cta_teks: 'Simpan video ini lalu praktikkan besok pagi ya 📌',
      views: 12000, likes: 860, comments: 74, shares: 210, saves: 380, followers_gain: 120,
      klik_link: 0, pendaftar: 0, pic: 'Tim Media', catatan: 'Isi metrik manual setelah tayang.'
    }));
  }

  if (CTA_SHEET_NAME) {
    var ctaSheet = ss.getSheetByName(CTA_SHEET_NAME);
    if (!ctaSheet) {
      ctaSheet = ss.insertSheet(CTA_SHEET_NAME);
      created.push(CTA_SHEET_NAME);
      ctaSheet.getRange(1, 1, 1, 4).setValues([['Jenis', 'Teks CTA', 'Tujuan', 'Catatan']])
        .setFontWeight('bold').setBackground('#C9A227').setFontColor('#FFFFFF');
      ctaSheet.setFrozenRows(1);
    }
  }

  return {
    ok: true,
    action: 'setup',
    spreadsheet: ss.getName(),
    sheetId: ss.getId(),
    sheet: SHEET_NAME,
    createdTabs: created,
    headersWritten: isDifferent,
    headerRow: HEADERS,
    note: 'Setup selesai. Lanjutkan: Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone).'
  };
}

/** Utility: isi Sheet dengan data contoh dari aplikasi? Gunakan bulk lewat aplikasi. */
function isiDataContohDariAplikasi() {
  return 'Buka aplikasi → Pengaturan → "Isi data contoh (24 konten)" → "Kirim semua data ke Sheet".';
}

/** ============================ UTIL ======================================= */

function getSheet(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName || SHEET_NAME);
  if (!sheet) {
    throw new Error('Tab "' + (sheetName || SHEET_NAME) + '" tidak ditemukan. Jalankan fungsi setup() lebih dulu.');
  }
  return sheet;
}

function keyOf(header) {
  return String(header).trim().toLowerCase().replace(/[\s-]+/g, '_').replace(/[^\w]/g, '');
}

function timezone() {
  try { return SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone() || 'Asia/Jakarta'; }
  catch (e) { return 'Asia/Jakarta'; }
}

function parseBody(e) {
  if (!e) return {};
  if (e.postData && e.postData.contents) {
    try { return JSON.parse(e.postData.contents); }
    catch (err) { throw new Error('Body bukan JSON yang valid.'); }
  }
  return e.parameter || {};
}

/**
 * Balas JSON, atau JSONP bila ada callback (aplikasi memakai JSONP untuk GET
 * supaya bebas CORS di GitHub Pages / hosting statis).
 */
function respond(payload, callback) {
  var json = JSON.stringify(payload);
  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function columnLetter(n) {
  var s = '';
  while (n > 0) {
    var r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** ====================== UJI CEPAT DI EDITOR ============================== */

/** Jalankan untuk menguji pembacaan tanpa deploy. */
function ujiBaca() {
  var rows = readSheet(SHEET_NAME);
  Logger.log('Jumlah baris: ' + rows.length);
  Logger.log(JSON.stringify(rows.slice(0, 2), null, 2));
  return rows.length;
}

/** Jalankan untuk menguji penulisan tanpa deploy. */
function ujiTulis() {
  var res = upsertRecord(SHEET_NAME, {
    id: 'uji_' + Date.now().toString(36),
    tanggal: Utilities.formatDate(new Date(), timezone(), 'yyyy-MM-dd'),
    jam: '19.30',
    judul: '[UJI] baris ini boleh dihapus',
    platform: 'website',
    status: 'ide',
    catatan: 'Dibuat oleh fungsi ujiTulis()'
  });
  Logger.log(JSON.stringify(res, null, 2));
  return res;
}
