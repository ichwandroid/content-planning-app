/**
 * data/seed.js — Data contoh realistis untuk Sekolah Anak Saleh.
 * Dipakai pada Mode Demo (sebelum Google Sheet dikonfigurasi) dan untuk
 * tombol "Isi Data Contoh" di halaman Pengaturan.
 */

import { todayISO, toISODate } from '../core/format.js';
import { uid } from '../core/util.js';

const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return toISODate(d);
};

const IG = 'https://www.instagram.com/p/';
const TT = 'https://www.tiktok.com/@sekolahanaksaleh/video/';
const YT = 'https://www.youtube.com/watch?v=';

/** 24 contoh konten: campuran tayang (punya metrik) & rencana (belum tayang). */
export const SAMPLE_CONTENT = [
  {
    id: uid('ct'), tanggal: day(-46), jam: '19.30', judul: 'Open House PPDB 2026/2027',
    platform: 'instagram', format: 'Reels', pilar: 'ppdb', status: 'tayang',
    caption: 'Bunda, Ayah, yuk lihat langsung kelas Tahfiz dan lab sains kami! Open House Sabtu ini pukul 08.00. Daftar gratis, kuota 60 keluarga.',
    hashtag: '#PPDB2026 #SekolahAnakSaleh #SekolahIslam #OpenHouse',
    cta_jenis: 'kunjungan', cta_teks: 'Daftar kunjungan gratis lewat link di bio ya, Bunda 📅', cta_link: 'https://sekolahanaksaleh.sch.id/ppdb?utm_source=instagram&utm_medium=reels&utm_campaign=openhouse',
    asset_url: 'https://drive.google.com/file/d/dummy-openhouse', post_url: `${IG}openhouse-demo/`,
    views: 18400, likes: 962, comments: 148, shares: 210, saves: 176, followers_gain: 312, klik_link: 486, pendaftar: 34,
    pic: 'Ustadzah Rina', catatan: 'Hook 3 detik pertama pakai wajah siswa, performa terbaik bulan ini.',
  },
  {
    id: uid('ct'), tanggal: day(-40), jam: '12.30', judul: 'Adab Sebelum Ilmu: 5 Kebiasaan Pagi Anak Saleh',
    platform: 'tiktok', format: 'Video', pilar: 'karakter', status: 'tayang',
    caption: '5 kebiasaan pagi yang kami biasakan di sekolah: doa bangun, wudhu, tilawah 1 halaman, sarapan, dan salim ke orang tua.',
    hashtag: '#AdabSebelumIlmu #AnakSaleh #ParentingIslami',
    cta_jenis: 'simpan', cta_teks: 'Simpan video ini lalu praktikkan besok pagi ya 📌', cta_link: '',
    asset_url: '', post_url: `${TT}7300000000000000001`,
    views: 42700, likes: 3180, comments: 226, shares: 742, saves: 1290, followers_gain: 640, klik_link: 0, pendaftar: 0,
    pic: 'Tim Media', catatan: 'Format listicle paling tinggi save rate.',
  },
  {
    id: uid('ct'), tanggal: day(-33), jam: '16.00', judul: 'Wisuda Tahfiz Juz 30 — Highlight',
    platform: 'youtube', format: 'Video Panjang', pilar: 'tahfiz', status: 'tayang',
    caption: 'Momen haru wisuda tahfiz 48 siswa. Rekaman lengkap prosesi dan sambutan kepala sekolah.',
    hashtag: '#Tahfiz #WisudaTahfiz #SekolahIslam',
    cta_jenis: 'follow', cta_teks: 'Subscribe channel kami untuk video wisuda berikutnya 🤍', cta_link: 'https://youtube.com/@sekolahanaksaleh?sub_confirmation=1',
    asset_url: '', post_url: `${YT}demo-wisuda-tahfiz`,
    views: 6420, likes: 421, comments: 88, shares: 54, saves: 61, followers_gain: 96, klik_link: 42, pendaftar: 6,
    pic: 'Pak Hendra', catatan: 'Watch time 4m12s, di atas rata-rata channel.',
  },
  {
    id: uid('ct'), tanggal: day(-27), jam: '13.00', judul: 'Testimoni Wali: Anak Saya Jadi Hafal 2 Juz',
    platform: 'instagram', format: 'Carousel', pilar: 'testimoni', status: 'tayang',
    caption: '"Dulu Raka susah fokus. Sekarang tiap malam minta setor hafalan." — Bunda Rani, wali kelas 4.',
    hashtag: '#TestimoniWali #SekolahAnakSaleh #Hafiz',
    cta_jenis: 'hubungi', cta_teks: 'Chat admin kami untuk info biaya & beasiswa 💬', cta_link: 'https://wa.me/6281234567890?text=Assalamualaikum,%20saya%20ingin%20tanya%20PPDB',
    asset_url: '', post_url: `${IG}testimoni-rani/`,
    views: 9800, likes: 705, comments: 132, shares: 158, saves: 96, followers_gain: 118, klik_link: 372, pendaftar: 28,
    pic: 'Ustadzah Rina', catatan: 'Konten konversi terbaik — 1 klik = 0.075 pendaftar.',
  },
  {
    id: uid('ct'), tanggal: day(-21), jam: '11.00', judul: 'Ekskul Panahan: Latihan Fokus & Sabar',
    platform: 'instagram', format: 'Reels', pilar: 'kesiswaan', status: 'tayang',
    caption: 'Sunah Nabi ﷺ yang kami hidupkan kembali di lapangan sekolah setiap Rabu.',
    hashtag: '#Panahan #EkskulSekolah #Sunnah',
    cta_jenis: 'follow', cta_teks: 'Ikuti akun kami untuk keseruan ekskul lainnya 🏹', cta_link: '',
    asset_url: '', post_url: `${IG}panahan/`,
    views: 15300, likes: 1180, comments: 96, shares: 187, saves: 142, followers_gain: 224, klik_link: 88, pendaftar: 3,
    pic: 'Tim Media', catatan: '',
  },
  {
    id: uid('ct'), tanggal: day(-15), jam: '20.00', judul: 'Kantin Sehat: Menu Gizi Anak Sesuai Sunnah',
    platform: 'tiktok', format: 'Slideshow', pilar: 'edukasi', status: 'tayang',
    caption: 'Menu kantin kami tanpa MSG, tanpa pewarna. Ini daftar 7 menu favorit siswa.',
    hashtag: '#KantinSehat #GiziAnak #ParentingIslami',
    cta_jenis: 'bagikan', cta_teks: 'Bagikan ke grup wali murid biar semua tahu 🤝', cta_link: '',
    asset_url: '', post_url: `${TT}7300000000000000002`,
    views: 27600, likes: 1890, comments: 174, shares: 512, saves: 803, followers_gain: 356, klik_link: 0, pendaftar: 0,
    pic: 'Tim Media', catatan: 'Topik gizi + sunnah = kombinasi paling shareable.',
  },
  {
    id: uid('ct'), tanggal: day(-9), jam: '19.00', judul: 'Tur Fasilitas: Ruang Kelas Ber-AC & Lab Robotik',
    platform: 'instagram', format: 'Reels', pilar: 'sarana', status: 'tayang',
    caption: 'Setiap kelas maksimal 20 siswa, dilengkapi AC, proyektor, dan sudut baca.',
    hashtag: '#FasilitasSekolah #SekolahIslam #PPDB2026',
    cta_jenis: 'daftar', cta_teks: 'Sisa 24 kursi untuk tahun ajaran baru. Daftar sekarang 🎓', cta_link: 'https://sekolahanaksaleh.sch.id/ppdb?utm_source=instagram&utm_medium=reels&utm_campaign=turfasilitas',
    asset_url: '', post_url: `${IG}tur-fasilitas/`,
    views: 11200, likes: 640, comments: 74, shares: 96, saves: 128, followers_gain: 142, klik_link: 298, pendaftar: 19,
    pic: 'Pak Hendra', catatan: 'Perlu voice over yang lebih jelas di 5 detik awal.',
  },
  {
    id: uid('ct'), tanggal: day(-5), jam: '12.30', judul: 'Guru Kami: Ustadzah Nabila, S.Pd. (Juara Guru Inovatif)',
    platform: 'tiktok', format: 'Video', pilar: 'guru', status: 'tayang',
    caption: 'Cara Ustadzah Nabila mengajar matematika pakai permainan pasar. Siswa tidak sadar sedang belajar.',
    hashtag: '#GuruKami #GuruInovatif #SekolahAnakSaleh',
    cta_jenis: 'komentar', cta_teks: 'Tulis nama guru favorit ananda di komentar ✍️', cta_link: '',
    asset_url: '', post_url: `${TT}7300000000000000003`,
    views: 8900, likes: 512, comments: 168, shares: 74, saves: 88, followers_gain: 96, klik_link: 0, pendaftar: 0,
    pic: 'Ustadzah Rina', catatan: 'Komentar tinggi -> bagus untuk algoritma, CTA konversi kurang.',
  },
  {
    id: uid('ct'), tanggal: day(-2), jam: '19.30', judul: 'Mabit & Muhasabah Kelas 6',
    platform: 'instagram', format: 'Story', pilar: 'karakter', status: 'tayang',
    caption: 'Malam bina iman dan takwa: qiyamul lail, muhasabah, dan sarapan bersama.',
    hashtag: '#Mabit #PembinaanKarakter',
    cta_jenis: 'agenda', cta_teks: 'Catat agenda Mabit kelas 5 bulan depan ya 📅', cta_link: '',
    asset_url: '', post_url: '',
    views: 3400, likes: 288, comments: 41, shares: 22, saves: 34, followers_gain: 18, klik_link: 12, pendaftar: 0,
    pic: 'Ustadzah Rina', catatan: 'Story reach memang lebih kecil, tapi reply tinggi.',
  },
  {
    id: uid('ct'), tanggal: day(-1), jam: '20.30', judul: 'Reels: 3 Doa Sebelum Belajar',
    platform: 'facebook', format: 'Reels', pilar: 'tahfiz', status: 'tayang',
    caption: 'Ajarkan 3 doa ini agar belajar ananda lebih berkah.',
    hashtag: '#DoaBelajar #SekolahIslam',
    cta_jenis: 'simpan', cta_teks: 'Simpan untuk dibaca ulang sebelum belajar 📌', cta_link: '',
    asset_url: '', post_url: '',
    views: 5100, likes: 214, comments: 38, shares: 61, saves: 44, followers_gain: 22, klik_link: 9, pendaftar: 1,
    pic: 'Tim Media', catatan: 'Facebook masih kuat di segmen wali murid 35+.',
  },
  /* ------- Rencana (belum tayang) ------- */
  {
    id: uid('ct'), tanggal: todayISO(), jam: '19.30', judul: 'Countdown PPDB Gelombang 2 (H-7)',
    platform: 'instagram', format: 'Reels', pilar: 'ppdb', status: 'siap',
    caption: 'Gelombang 2 dibuka 1 bulan lagi. Kuota gelombang 1 sudah 86% terisi.',
    hashtag: '#PPDB2026 #SekolahAnakSaleh #Gelombang2',
    cta_jenis: 'daftar', cta_teks: 'Amankan kursi ananda sekarang, klik link di bio 🎓', cta_link: 'https://sekolahanaksaleh.sch.id/ppdb',
    asset_url: 'https://drive.google.com/file/d/dummy-countdown', post_url: '',
    pic: 'Ustadzah Rina', catatan: 'Pakai countdown sticker + backsound trending.',
  },
  {
    id: uid('ct'), tanggal: day(1), jam: '12.30', judul: 'Behind The Scene: Latihan Drum Band',
    platform: 'tiktok', format: 'Video', pilar: 'kesiswaan', status: 'review',
    caption: 'Ternyata begini latihan mereka setiap Sabtu pagi.',
    hashtag: '#DrumBand #EkskulSekolah', cta_jenis: 'follow',
    cta_teks: 'Follow untuk part 2 latihan mereka 🥁', cta_link: '', asset_url: '', post_url: '',
    pic: 'Pak Hendra', catatan: 'Tunggu izin wali murid untuk tayang.',
  },
  {
    id: uid('ct'), tanggal: day(3), jam: '16.00', judul: 'Shorts: 1 Menit Hafalan Surah Al-Mulk',
    platform: 'youtube', format: 'Shorts', pilar: 'tahfiz', status: 'draf',
    caption: 'Setoran hafalan ananda Zaki kelas 5.',
    hashtag: '#Shorts #Hafalan #AlMulk', cta_jenis: 'follow',
    cta_teks: 'Subscribe untuk hafalan berikutnya 🤍', cta_link: '', asset_url: '', post_url: '',
    pic: 'Tim Media', catatan: '',
  },
  {
    id: uid('ct'), tanggal: day(5), jam: '11.00', judul: 'Carousel: Checklist Perlengkapan Hari Pertama Sekolah',
    platform: 'instagram', format: 'Carousel', pilar: 'edukasi', status: 'ide',
    caption: '10 barang wajib + 3 hal yang tidak perlu dibeli.',
    hashtag: '#HariPertamaSekolah #ParentingIslami', cta_jenis: 'unduh',
    cta_teks: 'Unduh checklist versi PDF gratis di link bio 📄', cta_link: '', asset_url: '', post_url: '',
    pic: 'Ustadzah Rina', catatan: '',
  },
  {
    id: uid('ct'), tanggal: day(8), jam: '20.00', judul: 'Live Instagram: Tanya Jawab PPDB & Biaya',
    platform: 'instagram', format: 'Story', pilar: 'ppdb', status: 'ide',
    caption: 'Sesi tanya jawab bersama kepala sekolah dan bagian keuangan.',
    hashtag: '#TanyaJawab #PPDB2026', cta_jenis: 'hubungi',
    cta_teks: 'Kirim pertanyaanmu sekarang lewat DM 💬', cta_link: '', asset_url: '', post_url: '',
    pic: 'Ustadzah Rina', catatan: '',
  },
  {
    id: uid('ct'), tanggal: day(-12), jam: '06.30', judul: 'Broadcast WA: Pengingat Pembayaran SPP',
    platform: 'whatsapp', format: 'Broadcast', pilar: 'sarana', status: 'tayang',
    caption: 'Pengingat halus + tautan pembayaran untuk wali murid.',
    hashtag: '', cta_jenis: 'link-bio',
    cta_teks: 'Bayar SPP sekarang lewat tautan ini 🔗', cta_link: 'https://sekolahanaksaleh.sch.id/spp',
    asset_url: '', post_url: '',
    views: 640, likes: 0, comments: 96, shares: 12, saves: 0, followers_gain: 0, klik_link: 318, pendaftar: 0,
    pic: 'Bagian Keuangan', catatan: 'Kanal paling efektif untuk aksi administratif.',
  },
  {
    id: uid('ct'), tanggal: day(-19), jam: '20.30', judul: 'Artikel: Panduan Memilih Sekolah Dasar Islam',
    platform: 'website', format: 'Artikel', pilar: 'edukasi', status: 'tayang',
    caption: '7 pertanyaan yang wajib Bunda tanyakan sebelum mendaftar SD.',
    hashtag: '', cta_jenis: 'daftar',
    cta_teks: 'Isi formulir minat PPDB di halaman ini 🎓', cta_link: 'https://sekolahanaksaleh.sch.id/ppdb',
    asset_url: '', post_url: 'https://sekolahanaksaleh.sch.id/blog/memilih-sd-islam',
    views: 2450, likes: 0, comments: 12, shares: 38, saves: 0, followers_gain: 0, klik_link: 214, pendaftar: 41,
    pic: 'Tim Website', catatan: 'SEO: peringkat 3 untuk kata kunci "SD Islam Jakarta Selatan".',
  },
];

export function demoRows() {
  return SAMPLE_CONTENT.map((r) => ({ ...r }));
}
