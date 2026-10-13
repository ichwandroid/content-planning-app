/**
 * analytics/insight.js — Mesin rekomendasi.
 * Mengubah angka menjadi daftar tindakan konkret berbahasa Indonesia,
 * plus generator caption & CTA otomatis.
 */

import { ANALYTICS, CTA_TYPES, PILARS, PLATFORMS, PILAR_TARGET, SCHOOL_PROFILE } from '../core/config.js';
import { extractHashtags, fmtCompact, fmtDecimal, fmtPercent, toDate } from '../core/format.js';
import { avg, round, sum, uniq } from '../core/util.js';
import { actions, buildUtm, suggestPilar } from '../social/platforms.js';
import { breakdown, contentScore, engagementRate, heatmap, interactions, n, summarize, timeline } from './metrics.js';

export const SEVERITY = { high: 3, medium: 2, low: 1 };

const SEV_META = {
  high: { label: 'Prioritas tinggi', color: '#E11D48', icon: 'alert' },
  medium: { label: 'Perlu diperbaiki', color: '#F59E0B', icon: 'bulb' },
  low: { label: 'Optimasi kecil', color: '#0EA5E9', icon: 'spark' },
  good: { label: 'Sudah bagus', color: '#059669', icon: 'check' },
};

export const severityMeta = (sev) => SEV_META[sev] || SEV_META.low;

/* --------------------------- INSIGHT PER KONTEN ------------------------ */

/**
 * Audit satu konten -> daftar temuan + skor kelengkapan.
 * @returns {{score:number, grade:string, findings:Array<{level:string,title:string,detail:string,fix:string}>}}
 */
export function auditContent(row, allRows = []) {
  const findings = [];
  const push = (level, title, detail, fix) => findings.push({ level, title, detail, fix, weight: SEVERITY[level] ?? 1 });

  const caption = String(row.caption || '');
  const hashtags = extractHashtags(`${caption} ${row.hashtag || ''}`);
  const pilar = row.pilar;
  const target = PILAR_TARGET[pilar] || {};

  /* Kelengkapan dasar */
  if (!row.judul) push('high', 'Judul konten kosong', 'Judul dipakai untuk pencarian & pelaporan, bukan untuk tayang.', 'Isi kolom Judul di Sheet.');
  if (!row.tanggal) push('high', 'Belum ada tanggal tayang', 'Konten tanpa tanggal tidak bisa masuk kalender & pengingat.', 'Tetapkan tanggal tayang.');
  if (!row.jam) push('low', 'Jam tayang belum diisi', 'Jam membantu analisis waktu terbaik audiens.', `Isi jam di kisaran ${PLATFORMS[row.platform]?.bestTime || '19.00–20.00'}.`);
  if (!row.asset_url) push('medium', 'Aset media belum ditautkan', 'Tim produksi tidak tahu file mana yang harus diunggah.', 'Tempel link Google Drive / Canva di kolom Aset.');
  if (!row.pic) push('medium', 'Belum ada PIC', 'Konten tanpa penanggung jawab rawan mangkrak.', 'Tentukan PIC produksi.');

  /* Caption & hashtag */
  if (caption.length < 60) push('medium', 'Caption terlalu pendek', `Panjang caption ${caption.length} karakter.`, 'Tambahkan konteks: siapa, kapan, di mana, dan manfaat untuk wali murid (min. 120 karakter).');
  else if (caption.length > 2200) push('low', 'Caption melebihi batas Instagram', `Panjang ${caption.length} karakter (batas ±2.200).`, 'Pindahkan detail ke carousel atau artikel.');
  if (!hashtags.length) push('medium', 'Belum ada hashtag', 'Hashtag membantu jangkauan lokal & komunitas parenting.', 'Tambahkan 5–10 hashtag campuran: sekolah, kota, tema, dan PPDB.');
  const generic = hashtags.filter((h) => /^#(fyp|foryou|viral|explore|like4like)$/i.test(h));
  if (generic.length) push('low', 'Hashtag terlalu generik', `Terdeteksi: ${generic.join(', ')}.`, 'Ganti dengan hashtag niche lokal, mis. #SekolahIslamJakartaSelatan.');

  /* CTA */
  if (!row.cta_teks) {
    push('high', 'Belum ada CTA', 'Konten tanpa ajakan membuat audiens bingung harus berbuat apa.', 'Pilih salah satu CTA dari Library CTA, lalu tempel ke baris caption terakhir.');
  } else if (caption && !caption.toLowerCase().includes(String(row.cta_teks).slice(0, 18).toLowerCase())) {
    push('medium', 'CTA ada di Sheet tapi tidak ada di caption', 'Insight: CTA harus terlihat audiens, bukan hanya tercatat.', 'Tempel CTA di akhir caption atau di overlay video.');
  }
  if (['conversion', 'consideration'].includes(CTA_TYPES.find((c) => c.id === row.cta_jenis)?.goal) && !row.cta_link) {
    push('high', 'CTA konversi tanpa link', 'Ajakan "daftar/hubungi" tanpa tautan menurunkan konversi drastis.', 'Tambahkan link PPDB/WhatsApp dengan UTM.');
  }
  if (row.cta_link && !/utm_/i.test(row.cta_link)) {
    push('low', 'Link CTA tanpa UTM', 'Tanpa UTM, Anda tidak bisa memastikan konten mana yang mendatangkan pendaftar.', 'Pakai tombol "Buat UTM" pada form konten.');
  }

  /* Pembagian pilar & tujuan */
  if (pilar && target.er) {
    const er = engagementRate(row);
    if (row.status === 'tayang' && er > 0) {
      if (er < target.er) push('high', `ER di bawah target pilar ${labelPilar(pilar)}`, `ER ${fmtPercent(er)} vs target ${fmtPercent(target.er)}.`, 'Perbaiki 3 detik pertama (hook), pakai teks besar, dan ganti audio yang sedang tren.');
      else push('good', `ER melampaui target pilar ${labelPilar(pilar)}`, `ER ${fmtPercent(er)} vs target ${fmtPercent(target.er)}.`, 'Jadikan pola ini template untuk konten berikutnya.');
    }
  }

  /* Analisis metrik lanjutan */
  if (row.status === 'tayang') {
    const saves = n(row.saves);
    const clicks = n(row.klik_link);
    const views = n(row.views);
    if (views >= 3000 && saves / Math.max(views, 1) * 100 < 0.5) {
      push('medium', 'Rasio simpan rendah', 'Konten dianggap tidak cukup bermanfaat untuk disimpan.', 'Tambahkan elemen edukatif: checklist, tips bernomor, atau doa harian.');
    }
    if (views >= 3000 && clicks > 0 && (clicks / views) * 100 < 0.4) {
      push('medium', 'Klik link rendah', 'Banyak yang menonton tapi sedikit yang lanjut ke tautan.', 'Perjelas CTA di caption + gunakan tautan bio dengan nama yang spesifik.');
    }
    if (n(row.followers_gain) === 0 && views >= 5000) {
      push('low', 'Belum menambah follower', 'Jangkauan bagus tapi tidak ada penambahan pengikut.', 'Sisipkan ajakan follow di pertengahan video, bukan hanya di akhir.');
    }
    if (n(row.comments) >= 0.8 && views && (n(row.comments) / views) * 100 > 1) {
      push('good', 'Percakapan audiens tinggi', 'Rasio komentar di atas 1% — sinyal bagus untuk algoritma.', 'Balas 10 komentar pertama dalam 1 jam tayang untuk mendorong jangkauan.');
    }
    if (n(row.pendaftar) > 0) {
      push('good', 'Menghasilkan pendaftar', `${n(row.pendaftar)} pendaftar dari konten ini.`, 'Buat variasi serupa dan jalankan sebagai iklan berbayar kecil.');
    }
  }

  /* Konflik jadwal */
  if (row.tanggal && allRows.length) {
    const same = allRows.filter((r) => r.tanggal === row.tanggal && r.id !== row.id);
    if (same.length >= 3) {
      push('low', 'Jadwal menumpuk', `Ada ${same.length} konten lain di tanggal yang sama.`, 'Geser ke hari lain agar tiap konten dapat jatah jangkauan.');
    }
  }

  /* Skor kelengkapan */
  const completeness = completenessScore(row, hashtags);
  return { score: completeness, grade: completeness >= 85 ? 'A' : completeness >= 70 ? 'B' : completeness >= 55 ? 'C' : 'D', findings };
}

function completenessScore(row, hashtags) {
  let score = 0;
  const checks = [
    [row.judul, 8],
    [row.tanggal, 8],
    [row.jam, 4],
    [row.platform, 4],
    [row.format, 4],
    [row.pilar, 6],
    [String(row.caption || '').length > 80, 12],
    [hashtags.length >= 5, 8],
    [row.cta_teks, 12],
    [row.cta_jenis, 6],
    [row.cta_link || row.cta_jenis === 'komentar' || row.cta_jenis === 'simpan' || row.cta_jenis === 'follow', 8],
    [row.asset_url, 6],
    [row.pic, 6],
    [row.post_url, 4],
    [row.status, 4],
  ];
  checks.forEach(([cond, w]) => { if (cond) score += w; });
  return round(Math.min(100, score), 0);
}

/* -------------------------- INSIGHT PORTFOLIO -------------------------- */

/**
 * Analisis menyeluruh seluruh data -> insight untuk dashboard.
 */
export function portfolioInsights(rows) {
  const published = rows.filter((r) => r.status === 'tayang');
  const insights = [];
  const add = (level, title, detail, action, meta = {}) => insights.push({ level, title, detail, action, ...meta, weight: SEVERITY[level] ?? 1 });

  const summary = summarize(rows);
  const byPilar = breakdown(rows, 'pilar');
  const byPlatform = breakdown(rows, 'platform');
  const byFormat = breakdown(rows, 'format');
  const byCta = breakdown(rows, 'cta');
  const byHari = breakdown(rows, 'hari');
  const byJam = breakdown(rows, 'jam');
  const trend = timeline(rows, { granularity: 'month' });
  const grid = heatmap(rows);

  if (published.length < ANALYTICS.minSample) {
    add('low', 'Data masih sedikit', `Baru ${published.length} konten tayang. Analitik butuh minimal ${ANALYTICS.minSample} konten untuk pola yang valid.`, 'Isi metrik konten lama ke Sheet agar rekomendasi lebih tajam.');
    return { insights, summary, byPilar, byPlatform, byFormat, byCta, byHari, byJam, trend, grid, ready: false };
  }

  /* 1. Pilar paling & paling kurang perform */
  const pilarSorted = byPilar.filter((p) => p.count >= 2);
  if (pilarSorted.length >= 2) {
    const best = pilarSorted[0];
    const worst = pilarSorted[pilarSorted.length - 1];
    add('good', `Pilar terkuat: ${best.label}`, `Rata-rata skor ${fmtDecimal(best.avgScore)} dari ${best.count} konten.`, 'Perbanyak pilar ini dan jadikan template produksi.');
    if (worst.avgScore < 55) {
      add('medium', `Pilar terlemah: ${worst.label}`, `Rata-rata skor ${fmtDecimal(worst.avgScore)} dari ${worst.count} konten.`, `Ubah pendekatan pilar ${worst.label}: ganti format, perbaiki hook, atau gabungkan dengan pilar ${best.label}.`);
    }
  }

  /* 2. Distribusi pilar tidak seimbang */
  const total = sum(pilarSorted, (p) => p.count);
  const topShare = total ? (pilarSorted[0]?.count || 0) / total : 0;
  if (topShare > 0.45) {
    add('medium', 'Distribusi pilar terlalu berat sebelah', `${Math.round(topShare * 100)}% konten bertema ${pilarSorted[0].label}.`, 'Audiens bisa bosan. Targetkan komposisi: 40% nilai/edukasi, 25% kegiatan, 20% konversi, 15% komunitas.');
  }
  const hasConversion = byPilar.some((p) => ['ppdb', 'testimoni'].includes(p.key) && p.count > 0);
  if (!hasConversion) {
    add('high', 'Belum ada konten konversi (PPDB/testimoni)', 'Tanpa konten konversi, jangkauan tidak berubah jadi pendaftar.', 'Jadwalkan minimal 2 konten PPDB + 1 testimoni wali murid setiap bulan.');
  }

  /* 3. Kanal & format terbaik */
  if (byPlatform.length >= 2) {
    const bestP = [...byPlatform].sort((a, b) => b.avgScore - a.avgScore)[0];
    const weakP = [...byPlatform].filter((p) => p.count >= 2).sort((a, b) => a.avgScore - b.avgScore)[0];
    add('good', `Kanal paling efektif: ${bestP.label}`, `Skor rata-rata ${fmtDecimal(bestP.avgScore)} dengan ER ${fmtPercent(bestP.er)}.`, `Naikkan porsi produksi untuk ${bestP.label}.`);
    if (weakP && weakP.key !== bestP.key && weakP.avgScore < bestP.avgScore * 0.7) {
      add('medium', `Kanal ${weakP.label} tertinggal`, `Skor ${fmtDecimal(weakP.avgScore)} vs ${fmtDecimal(bestP.avgScore)} pada ${bestP.label}.`, `Kurangi frekuensi atau ganti pendekatan di ${weakP.label}; alihkan energi ke ${bestP.label}.`);
    }
  }
  if (byFormat.filter((f) => f.count >= 2).length >= 2) {
    const bestF = [...byFormat].filter((f) => f.count >= 2).sort((a, b) => b.avgScore - a.avgScore)[0];
    add('low', `Format juara: ${bestF.label}`, `Skor ${fmtDecimal(bestF.avgScore)}, ER ${fmtPercent(bestF.er)} dari ${bestF.count} konten.`, `Buat minimal 2 konten ${bestF.label} per minggu.`);
  }

  /* 4. CTA paling menggerakkan */
  const ctaSorted = byCta.filter((c) => c.count >= 2).sort((a, b) => (b.clicks + b.daftar * 10) - (a.clicks + a.daftar * 10));
  if (ctaSorted.length) {
    const bestC = ctaSorted[0];
    add('good', `CTA paling menggerakkan: ${bestC.label}`, `${bestC.clicks} klik & ${bestC.daftar} pendaftar dari ${bestC.count} konten.`, 'Standarkan CTA ini untuk semua konten konversi.');
    const noCta = byCta.find((c) => c.key === 'tanpa-cta');
    if (noCta) {
      add('high', `${noCta.count} konten tanpa CTA`, 'Konten tanpa ajakan hanya menghasilkan jangkauan, bukan tindakan.', 'Lengkapi CTA pada konten tersebut lewat filter "Tanpa CTA" di Planner.');
    }
  }

  /* 5. Waktu tayang terbaik */
  const hariTerbaik = byHari.filter((h) => h.count >= 2).sort((a, b) => b.er - a.er)[0];
  const jamTerbaik = byJam.filter((h) => h.count >= 2).sort((a, b) => b.er - a.er)[0];
  if (hariTerbaik) add('low', `Hari terbaik: ${hariTerbaik.label}`, `ER ${fmtPercent(hariTerbaik.er)} dari ${hariTerbaik.count} konten.`, `Jadwalkan konten utama (PPDB/testimoni) pada hari ${hariTerbaik.label}.`);
  if (jamTerbaik) add('low', `Jam terbaik: ${jamTerbaik.label}`, `ER ${fmtPercent(jamTerbaik.er)} dari ${jamTerbaik.count} konten.`, `Geser jadwal unggahan utama ke rentang ${jamTerbaik.label} WIB.`);

  /* 6. Tren bulanan */
  if (trend.length >= 3) {
    const last = trend[trend.length - 1];
    const prev = trend[trend.length - 2];
    const deltaER = round(last.er - prev.er, 2);
    if (deltaER < -0.5) {
      add('high', 'Tren ER menurun', `ER bulan terakhir ${fmtPercent(last.er)} (turun ${fmtPercent(Math.abs(deltaER))} dari bulan sebelumnya).`, 'Lakukan riset ulang: cek audio tren, durasi video, dan 3 detik pertama.');
    } else if (deltaER > 0.5) {
      add('good', 'Tren ER meningkat', `ER naik ${fmtPercent(deltaER)} menjadi ${fmtPercent(last.er)}.`, 'Pertahankan pola konten bulan ini.');
    }
  }

  /* 7. Konsistensi produksi */
  const publishedDates = published.map((r) => toDate(r.tanggal)).filter(Boolean).sort((a, b) => a - b);
  if (publishedDates.length >= 4) {
    const spanDays = (publishedDates[publishedDates.length - 1] - publishedDates[0]) / 86400000;
    const freq = spanDays > 0 ? (publishedDates.length / spanDays) * 7 : publishedDates.length;
    if (freq < 2) {
      add('medium', 'Frekuensi unggah rendah', `Rata-rata ${fmtDecimal(freq)} konten per minggu.`, 'Targetkan minimal 3 konten/minggu: 1 edukasi, 1 kegiatan, 1 konversi.');
    } else {
      add('good', 'Konsistensi unggah baik', `${fmtDecimal(freq)} konten per minggu.`, 'Konsistensi adalah faktor terbesar pertumbuhan organik — pertahankan.');
    }
  }

  /* 8. Efisiensi konversi */
  if (summary.clicks > 0 && summary.daftar > 0) {
    const conv = (summary.daftar / summary.clicks) * 100;
    if (conv < 3) {
      add('medium', 'Konversi klik → pendaftar rendah', `${fmtPercent(conv)} dari ${fmtCompact(summary.clicks)} klik menjadi pendaftar.`, 'Periksa halaman PPDB: kecepatan muat, kejelasan biaya, dan formulir yang pendek.');
    } else {
      add('good', 'Konversi sehat', `${fmtPercent(conv)} klik berujung pendaftaran.`, 'Gandakan anggaran/waktu pada kanal penyumbang terbesar.');
    }
  }

  /* 9. Sel jadwal terbaik dari heatmap */
  let bestCell = { count: 0, er: 0, day: 0, hour: 0 };
  grid.forEach((rowArr, d) => rowArr.forEach((c, h) => {
    if (c.count >= 2 && c.er > bestCell.er) bestCell = { ...c, day: d, hour: h };
  }));

  return { insights: insights.sort((a, b) => b.weight - a.weight), summary, byPilar, byPlatform, byFormat, byCta, byHari, byJam, trend, grid, bestCell, ready: true };
}

export function prioritizeFindings(findings) {
  return [...findings].sort((a, b) => (SEVERITY[b.level] ?? 0) - (SEVERITY[a.level] ?? 0));
}

export function auditPortfolio(rows) {
  const audits = rows.map((r) => ({ row: r, ...auditContent(r, rows) }));
  const weakest = [...audits].sort((a, b) => a.score - b.score);
  const avgCompleteness = audits.length ? round(avg(audits, (a) => a.score), 1) : 0;
  return {
    audits,
    weakest: weakest.slice(0, 8),
    avgCompleteness,
    totalFindings: sum(audits, (a) => a.findings.length),
    byLevel: {
      high: sum(audits, (a) => a.findings.filter((f) => f.level === 'high').length),
      medium: sum(audits, (a) => a.findings.filter((f) => f.level === 'medium').length),
      low: sum(audits, (a) => a.findings.filter((f) => f.level === 'low').length),
    },
  };
}

/* -------------------------- GENERATOR OTOMATIS ------------------------- */

const HOOKS = [
  'Bunda, ini yang jarang dibahas…',
  'Ternyata selama ini kita salah paham soal…',
  '3 hal yang kami lakukan sebelum anak masuk kelas:',
  'Kalau ananda susah fokus, coba cara ini:',
  'Jujur, ini alasan kami membiasakan hal kecil ini setiap pagi.',
  'Kata wali murid: "Kenapa baru sekarang saya tahu?"',
];

const HASHTAG_BASE = ['#SekolahAnakSaleh', '#SekolahIslam', '#ParentingIslami', '#PendidikanAnak', '#AnakSaleh'];

/** Buat caption siap pakai berdasarkan judul + pilar + CTA. */
export function generateCaption({ judul = '', pilar = '', platform = 'instagram', cta_jenis = 'simpan', city = 'Jakarta' } = {}) {
  const pilarData = PILARS.find((p) => p.id === pilar);
  const cta = CTA_TYPES.find((c) => c.id === cta_jenis);
  const hook = HOOKS[Math.floor(Math.random() * HOOKS.length)];
  const body = [
    `${hook}`,
    '',
    `${judul || `Kegiatan hari ini di ${SCHOOL_PROFILE.nama}.`}`,
    '',
    `Di ${SCHOOL_PROFILE.nama}, kami percaya ${pilarData ? pilarData.label.toLowerCase() : 'pendidikan karakter'} dibangun lewat kebiasaan kecil setiap hari — bukan hanya saat ujian.`,
    '',
    `📍 ${SCHOOL_PROFILE.nama}`,
    `🎓 PPDB ${SCHOOL_PROFILE.tahunAjaran} sudah dibuka`,
    '',
    cta ? cta.template.replace('{akun}', SCHOOL_PROFILE.akun) : 'Simpan postingan ini ya, Bunda 📌',
  ].join('\n');

  const tags = uniq([
    ...HASHTAG_BASE,
    `#${city.replace(/\s+/g, '')}`,
    pilarData ? `#${pilarData.label.replace(/[^\p{L}\p{N}]/gu, '')}` : '',
    platform === 'tiktok' ? '#TikTokParenting' : platform === 'youtube' ? '#Shorts' : '#Reels',
    '#PPDB2026',
  ]).filter(Boolean);

  return { caption: body, hashtag: tags.join(' '), hook };
}

export function generateIdeas({ pilar, platform = 'instagram', count = 5 } = {}) {
  const templates = {
    akademik: ['Prestasi {n} siswa di lomba {topik}', 'Metode belajar {topik} ala kelas {kelas}', 'Rapor karakter: apa yang kami nilai selain angka'],
    karakter: ['5 adab pagi yang kami biasakan', 'Cara mengajarkan sabar tanpa marah', 'Kisah anak yang berubah karena satu kebiasaan kecil'],
    tahfiz: ['Target hafalan 1 tahun: realistis atau tidak?', 'Metode murojaah 10 menit setiap hari', 'Doa sebelum belajar + artinya'],
    kesiswaan: ['Behind the scene ekskul {topik}', 'Satu hari bersama tim {topik}', 'Turnamen antar kelas: highlight terbaik'],
    ppdb: ['Rincian biaya PPDB {tahun} (transparan)', 'Alur pendaftaran 5 langkah', 'Tanya jawab PPDB paling sering ditanyakan'],
    sarana: ['Tur 60 detik: ruang {topik}', 'Kenapa kelas maksimal 20 siswa', 'Fasilitas yang jarang dimiliki sekolah lain'],
    guru: ['Guru kami: {nama} & cara mengajarnya', 'Rekrutmen guru: kualifikasi yang kami cari', 'Sehari jadi guru tahfiz'],
    testimoni: ['Testimoni wali murid kelas {kelas}', 'Sebelum & sesudah 1 semester', 'Alasan wali murid pindah sekolah'],
    edukasi: ['Checklist perlengkapan hari pertama', '{n} tanda anak butuh pendampingan belajar', 'Cara membatasi gawai tanpa drama'],
    event: ['Agenda {bulan} di sekolah kami', 'Countdown acara {topik}', 'Rundown acara & apa yang perlu dibawa'],
  };
  const list = templates[pilar] || templates.edukasi;
  const bulan = new Date().toLocaleDateString('id-ID', { month: 'long' });
  return Array.from({ length: count }, (_, i) => {
    const t = list[i % list.length];
    return t
      .replace('{n}', String(3 + Math.floor(Math.random() * 5)))
      .replace('{topik}', pick(['sains', 'panahan', 'tahfiz', 'matematika', 'robotik', 'bahasa Arab']))
      .replace('{kelas}', String(1 + Math.floor(Math.random() * 6)))
      .replace('{nama}', pick(['Ustadzah Nabila', 'Ustadz Ahmad', 'Ustadzah Salma']))
      .replace('{tahun}', SCHOOL_PROFILE.tahunAjaran)
      .replace('{bulan}', bulan);
  });
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function suggestHashtags(row, city = 'Jakarta') {
  const pilar = row.pilar || suggestPilar(`${row.judul} ${row.caption}`);
  const base = [...HASHTAG_BASE, `#${city.replace(/\s+/g, '')}`];
  const byPilar = {
    ppdb: ['#PPDB2026', '#PenerimaanSiswaBaru', '#SekolahSwastaIslam'],
    tahfiz: ['#Tahfiz', '#HafizQuran', '#RumahQuran'],
    karakter: ['#AdabSebelumIlmu', '#PendidikanKarakter'],
    akademik: ['#PrestasiSiswa', '#OlimpiadeSains'],
    kesiswaan: ['#Ekstrakurikuler', '#KegiatanSiswa'],
    sarana: ['#FasilitasSekolah', '#TurSekolah'],
    guru: ['#GuruInspiratif', '#TenagaPendidik'],
    testimoni: ['#TestimoniWali', '#UlasanSekolah'],
    edukasi: ['#TipsParenting', '#EdukasiAnak'],
    event: ['#AgendaSekolah', '#AcaraSekolah'],
  };
  const platformTag = row.platform === 'tiktok' ? ['#TikTokParenting', '#FypIndonesia'] : row.platform === 'youtube' ? ['#Shorts', '#VideoSekolah'] : ['#ReelsIndonesia', '#InstagramSekolah'];
  return uniq([...(byPilar[pilar] || []), ...platformTag, ...base]).slice(0, 12).join(' ');
}

export { actions, buildUtm, suggestPilar };

function labelPilar(id) {
  return PILARS.find((p) => p.id === id)?.label || id;
}

/** Ringkas: 1 baris kesimpulan performa untuk header kartu. */
export function headline(row) {
  if (row.status !== 'tayang') return 'Belum tayang — fokus pada kelengkapan materi.';
  const score = contentScore(row);
  const er = engagementRate(row);
  if (score >= 70) return `Performa tinggi — ER ${fmtPercent(er)} dari ${fmtCompact(n(row.views))} views.`;
  if (score >= 45) return `Performa rata-rata — ER ${fmtPercent(er)}. Perbaiki hook & CTA.`;
  return `Performa rendah — ER ${fmtPercent(er)} dari ${fmtCompact(n(row.views))} views.`;
}

export { interactions };
