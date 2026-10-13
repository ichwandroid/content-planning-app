/**
 * Content Planner Sekolah Anak Saleh
 * core/config.js — Konfigurasi aplikasi & skema database Google Sheet.
 *
 * PENTING (cara koneksi TANPA API Google):
 *  - BACA  : endpoint gviz  -> https://docs.google.com/spreadsheets/d/<ID>/gviz/tq?tqx=out:json&sheet=<NAMA>
 *            (JSONP, jadi bebas CORS. Sheet harus "Anyone with the link = Viewer".)
 *  - TULIS : Google Apps Script Web App (doGet JSONP + doPost text/plain) -> lihat /apps-script/Code.gs
 *  - Kalau APPS_SCRIPT_URL masih placeholder, app otomatis jalan di Mode Demo
 *    (data disimpan di localStorage) supaya bisa langsung dicoba.
 */

export const APP = Object.freeze({
  name: 'Content Planner Sekolah Anak Saleh',
  shortName: 'CPSAS',
  tagline: 'Rencanakan, publikasikan, ukur, lalu perbaiki.',
  version: '1.0.0',
  locale: 'id-ID',
  timezone: 'Asia/Jakarta',
  storagePrefix: 'cpsas.v1',
});

/* ------------------------------------------------------------------ *
 * DATABASE
 * ------------------------------------------------------------------ */

export const DB = Object.freeze({
  /** Ganti dengan ID Spreadsheet. Contoh URL:
   *  https://docs.google.com/spreadsheets/d/1AbC...XyZ/edit  ->  ID = 1AbC...XyZ  */
  SPREADSHEET_ID: '1sucKoVseSKb_IzjSw4YhdXytQ1-i99Ij6-DHn2NHSsc',

  /** Nama tab (default: "Content") */
  SHEET_NAME: 'Content',

  /** Tab opsional untuk library CTA. Kosongkan ('') untuk pakai library bawaan app. */
  CTA_SHEET_NAME: 'CTA',

  /** URL Web App Apps Script yang diakhiri /exec (untuk tulis + sinkron 2 arah). */
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbxQtOGsgwGV4vK2AjTrjMMn5huvkzTV5PNJVhu88E-CmBbxJTV4gaNoblW2p8SMxeQ0Xw/exec',

  /** Timeout request (ms) */
  TIMEOUT: 15000,
});

/** Penanda placeholder — selama masih ada teks ini, app berjalan di Mode Demo. */
const PLACEHOLDER_RE = /GANTI|ISI_|CONTOH|XXX|SPREADSHEET_ID_ANDA|URL_APPS_SCRIPT_ANDA/i;

export const DB_READY = Object.freeze({
  get hasSheet() {
    const id = DB.SPREADSHEET_ID;
    if (!id || PLACEHOLDER_RE.test(id)) return false;
    return /^[a-zA-Z0-9-_]{20,}$/.test(id);
  },
  get hasScript() {
    const url = DB.APPS_SCRIPT_URL;
    if (!url || PLACEHOLDER_RE.test(url)) return false;
    return /^https:\/\/script\.google(usercontent)?\.com\/.*\/(exec|dev)$/.test(url);
  },
});

/** Header kolom Sheet + tipe field. Urutan array = urutan kolom di Sheet. */
export const FIELDS = Object.freeze([
  { key: 'id', label: 'ID', type: 'string' },
  { key: 'tanggal', label: 'Tanggal', type: 'date' },
  { key: 'jam', label: 'Jam', type: 'time' },
  { key: 'judul', label: 'Judul', type: 'string', required: true },
  { key: 'platform', label: 'Platform', type: 'string' },
  { key: 'format', label: 'Format', type: 'string' },
  { key: 'pilar', label: 'Pilar', type: 'string' },
  { key: 'status', label: 'Status', type: 'string' },
  { key: 'caption', label: 'Caption', type: 'string' },
  { key: 'hashtag', label: 'Hashtag', type: 'string' },
  { key: 'cta_jenis', label: 'CTA Jenis', type: 'string' },
  { key: 'cta_teks', label: 'CTA Teks', type: 'string' },
  { key: 'cta_link', label: 'CTA Link', type: 'string' },
  { key: 'asset_url', label: 'Asset URL', type: 'string' },
  { key: 'post_url', label: 'Post URL', type: 'string' },
  { key: 'views', label: 'Views', type: 'number' },
  { key: 'likes', label: 'Likes', type: 'number' },
  { key: 'comments', label: 'Comments', type: 'number' },
  { key: 'shares', label: 'Shares', type: 'number' },
  { key: 'saves', label: 'Saves', type: 'number' },
  { key: 'followers_gain', label: 'Followers Gain', type: 'number' },
  { key: 'klik_link', label: 'Klik Link', type: 'number' },
  { key: 'pendaftar', label: 'Pendaftar', type: 'number' },
  { key: 'pic', label: 'PIC', type: 'string' },
  { key: 'catatan', label: 'Catatan', type: 'string' },
  { key: 'diperbarui', label: 'Diperbarui', type: 'datetime' },
]);

export const HEADERS = Object.freeze(FIELDS.map((f) => f.label));
export const NUMERIC_KEYS = Object.freeze(
  FIELDS.filter((f) => f.type === 'number').map((f) => f.key),
);

/** Kolom A1:Z1 untuk range Apps Script */
export const SHEET_RANGE = `A1:${columnLetter(FIELDS.length)}`;

function columnLetter(n) {
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/* ------------------------------------------------------------------ *
 * MASTER DATA
 * ------------------------------------------------------------------ */

export const PLATFORMS = Object.freeze({
  instagram: { label: 'Instagram', icon: 'instagram', color: '#E1306C', soft: '#FDE7F0', types: ['Reels', 'Carousel', 'Feed', 'Story'], bestTime: '11.00 / 19.30' },
  tiktok: { label: 'TikTok', icon: 'tiktok', color: '#111827', soft: '#E7E9EE', types: ['Video', 'Duet', 'Slideshow'], bestTime: '12.30 / 20.00' },
  youtube: { label: 'YouTube', icon: 'youtube', color: '#FF0000', soft: '#FFE8E8', types: ['Shorts', 'Video Panjang', 'Live'], bestTime: '16.00 / 20.00' },
  facebook: { label: 'Facebook', icon: 'facebook', color: '#1877F2', soft: '#E7F0FE', types: ['Feed', 'Reels', 'Album'], bestTime: '13.00 / 20.30' },
  whatsapp: { label: 'WhatsApp', icon: 'whatsapp', color: '#25D366', soft: '#E6F7EC', types: ['Status', 'Broadcast', 'Grup Wali'], bestTime: '06.30 / 19.00' },
  website: { label: 'Website/PPDB', icon: 'globe', color: '#0F766E', soft: '#E6F4F2', types: ['Artikel', 'Landing PPDB', 'Pengumuman'], bestTime: 'kapan saja' },
});

export const STATUSES = Object.freeze({
  ide: { label: 'Ide', color: '#94A3B8', soft: '#EEF2F6' },
  draf: { label: 'Draf', color: '#8B5CF6', soft: '#F1EBFE' },
  review: { label: 'Review', color: '#F59E0B', soft: '#FEF3D7' },
  siap: { label: 'Siap Tayang', color: '#0EA5E9', soft: '#E0F2FE' },
  tayang: { label: 'Tayang', color: '#10B981', soft: '#D9F7EC' },
  arsip: { label: 'Arsip', color: '#64748B', soft: '#EDF1F5' },
});

export const PILARS = Object.freeze([
  { id: 'akademik', label: 'Akademik & Prestasi', emoji: '📚', goal: 'awareness', color: '#2563EB' },
  { id: 'karakter', label: 'Akhlak & Karakter', emoji: '🕌', goal: 'trust', color: '#0F766E' },
  { id: 'tahfiz', label: 'Tahfiz & Al-Qur\'an', emoji: '📖', goal: 'trust', color: '#7C3AED' },
  { id: 'kesiswaan', label: 'Kegiatan & Ekstrakurikuler', emoji: '⚽', goal: 'engagement', color: '#F97316' },
  { id: 'ppdb', label: 'PPDB & Penerimaan', emoji: '🎓', goal: 'conversion', color: '#E11D48' },
  { id: 'sarana', label: 'Sarana & Fasilitas', emoji: '🏫', goal: 'consideration', color: '#0891B2' },
  { id: 'guru', label: 'Guru & Staf', emoji: '👩‍🏫', goal: 'trust', color: '#65A30D' },
  { id: 'testimoni', label: 'Testimoni Wali Murid', emoji: '💬', goal: 'conversion', color: '#DB2777' },
  { id: 'edukasi', label: 'Edukasi Parenting', emoji: '💡', goal: 'engagement', color: '#CA8A04' },
  { id: 'event', label: 'Event & Agenda Sekolah', emoji: '📅', goal: 'engagement', color: '#4F46E5' },
]);

/** Target KPI per pilar -> dipakai analitik untuk menilai apakah konten "berhasil". */
export const PILAR_TARGET = Object.freeze({
  akademik: { er: 3.0, saveRate: 1.0, clickRate: 0.6 },
  karakter: { er: 4.0, saveRate: 1.2, clickRate: 0.4 },
  tahfiz: { er: 4.0, saveRate: 1.5, clickRate: 0.5 },
  kesiswaan: { er: 5.0, saveRate: 1.0, clickRate: 0.5 },
  ppdb: { er: 3.5, saveRate: 0.8, clickRate: 2.5 },
  sarana: { er: 3.0, saveRate: 0.8, clickRate: 1.0 },
  guru: { er: 3.0, saveRate: 0.6, clickRate: 0.3 },
  testimoni: { er: 4.5, saveRate: 1.0, clickRate: 2.0 },
  edukasi: { er: 4.0, saveRate: 2.0, clickRate: 0.8 },
  event: { er: 4.0, saveRate: 1.0, clickRate: 1.0 },
});

export const CTA_TYPES = Object.freeze([
  { id: 'follow', label: 'Follow / Ikuti', goal: 'awareness', template: 'Ikuti @{akun} biar tidak ketinggalan info kegiatan ananda 🤍' },
  { id: 'simpan', label: 'Simpan / Bookmark', goal: 'engagement', template: 'Simpan postingan ini, nanti bisa dibuka lagi saat butuh 📌' },
  { id: 'komentar', label: 'Komentar', goal: 'engagement', template: 'Tulis di kolom komentar: satu kata untuk ananda hari ini ✍️' },
  { id: 'bagikan', label: 'Bagikan ke Wali Lain', goal: 'awareness', template: 'Bagikan ke grup wali murid, semoga bermanfaat 🤝' },
  { id: 'daftar', label: 'Daftar PPDB', goal: 'conversion', template: 'Kuota terbatas! Daftar PPDB sekarang lewat link di bio 🎓' },
  { id: 'hubungi', label: 'Hubungi Admin (WA)', goal: 'conversion', template: 'Tanya biaya & jadwal? Chat admin kami di WhatsApp sekarang 💬' },
  { id: 'kunjungan', label: 'Jadwalkan Kunjungan', goal: 'consideration', template: 'Ingin lihat kelas & fasilitas langsung? Jadwalkan kunjungan sekolah 📅' },
  { id: 'unduh', label: 'Unduh Brosur/Formulir', goal: 'conversion', template: 'Unduh brosur & formulir pendaftaran gratis di link ini 📄' },
  { id: 'link-bio', label: 'Klik Link di Bio', goal: 'conversion', template: 'Semua info lengkap ada di link bio ya, Bunda/Ayah 🔗' },
  { id: 'donasi', label: 'Donasi / Wakaf', goal: 'conversion', template: 'Salurkan wakaf terbaik untuk sarana belajar ananda 🤲' },
  { id: 'agenda', label: 'Catat Agenda', goal: 'consideration', template: 'Catat tanggalnya! Agenda sekolah bisa dilihat di kalender kami 📅' },
  { id: 'lainnya', label: 'CTA Kustom', goal: 'engagement', template: '' },
]);

export const CTA_GOALS = Object.freeze({
  awareness: { label: 'Awareness', color: '#0EA5E9' },
  engagement: { label: 'Engagement', color: '#8B5CF6' },
  consideration: { label: 'Consideration', color: '#F59E0B' },
  conversion: { label: 'Conversion', color: '#E11D48' },
  trust: { label: 'Trust', color: '#0F766E' },
});

export const SCHOOL_PROFILE = Object.freeze({
  nama: 'Sekolah Anak Saleh',
  akun: 'sekolahanaksaleh',
  website: 'https://sekolahanaksaleh.sch.id',
  whatsapp: '6281234567890',
  ppdbLink: 'https://sekolahanaksaleh.sch.id/ppdb',
  tahunAjaran: '2026/2027',
});

/* ------------------------------------------------------------------ *
 * PREFERENSI ANALITIK
 * ------------------------------------------------------------------ */

export const ANALYTICS = Object.freeze({
  /** Bobot skor konten (total 1.0) */
  weights: { engagement: 0.34, reach: 0.2, save: 0.14, share: 0.12, click: 0.12, growth: 0.08 },
  /** Benchmark industri pendidikan (ER %) */
  benchmarkER: { instagram: 3.8, tiktok: 5.5, youtube: 3.2, facebook: 2.4, whatsapp: 12, website: 1.5 },
  /** Minimal data supaya analitik dianggap valid */
  minSample: 5,
  /** Rentang hari default untuk filter analitik */
  defaultRangeDays: 90,
});

export const FEATURES = Object.freeze({
  embedPreview: true,
  oEmbed: true,
  exportCSV: true,
  calendar: true,
  gamifiedScore: true,
});
