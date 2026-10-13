# 04 — Arsitektur & Referensi Teknis

Dokumen ini menjelaskan cara kerja internal **Content Planner Sekolah Anak Saleh**:
alur data, tanggung jawab tiap modul, skema database, rumus analitik, cara menambah
platform/pilar/CTA baru, serta batasan yang harus disadari.

Pembaca yang dituju: pengembang atau operator TI sekolah. Untuk langkah pemasangan,
lihat [Setup Google Sheet](01-setup-google-sheet.md),
[Setup Apps Script](02-setup-apps-script.md), dan [Panduan Deploy](03-deploy.md).

---

## 1. Prinsip desain

1. **Statis sepenuhnya.** Tidak ada backend, tidak ada build step, tidak ada
   `node_modules`. Semua file bisa diunggah apa adanya ke hosting statis.
2. **Tanpa Google API resmi.** Tidak ada OAuth, tidak ada API key, tidak ada
   service account. Pembacaan memakai endpoint publik `gviz`, penulisan memakai
   Apps Script Web App.
3. **Data di luar aplikasi.** Google Sheet adalah sumber kebenaran; browser hanya
   menyimpan salinan sementara untuk mode offline/demo.
4. **Berlapis dengan fallback.** Setiap jalur jaringan punya cadangan, dan aplikasi
   tidak pernah "mati total" — paling buruk jatuh ke Mode Demo.

## 2. Diagram alur data

```text
                        ┌──────────────────────────────────────────┐
                        │            BROWSER (pengguna)            │
                        │  index.html + ES modules + GSAP 3 (CDN)  │
                        └───────────────┬──────────────────────────┘
                                        │
                        ┌───────────────▼──────────────────────────┐
                        │  js/views/*  (planner, calendar,         │
                        │  analytics, cta, settings)               │
                        └───────────────┬──────────────────────────┘
                                        │ state + aksi
                        ┌───────────────▼──────────────────────────┐
                        │  js/data/store.js                        │
                        │  • optimistic update (UI langsung update)│
                        │  • localStorage: cache + antrean tulis   │
                        │  • state.source = gviz|apps-script|csv|  │
                        │    demo|lokal|cache-lokal|none           │
                        └───────┬───────────────────────┬──────────┘
                                │ BACA                  │ TULIS
                                ▼                       ▼
        ┌───────────────────────────────┐   ┌──────────────────────────────┐
        │      js/data/sheet.js         │   │      js/data/sheet.js        │
        │  fallback berurutan:          │   │  POST ke Apps Script Web App │
        │  1. gviz JSONP                │   │  Content-Type: text/plain    │
        │  2. Apps Script doGet JSONP   │   │  mode: no-cors (opaque)      │
        │  3. gviz CSV via fetch        │   │  action: save|delete|bulk|ping│
        └───────┬───────────────┬───────┘   └──────────────┬───────────────┘
                │               │                          │
                │ JSONP         │ JSONP?callback=          │ HTTPS POST
                ▼               ▼                          ▼
   ┌────────────────────┐  ┌──────────────────┐  ┌────────────────────────┐
   │  docs.google.com   │  │ script.google.   │  │ Apps Script Web App    │
   │  /gviz/tq          │  │ com  /exec       │  │ apps-script/Code.gs    │
   │  (publik, Viewer)  │  │ doGet action=list│  │ doPost → tulis baris   │
   └─────────┬──────────┘  └────────┬─────────┘  └───────────┬────────────┘
             │                      │                        │
             └──────────┬───────────┴────────────────────────┘
                        ▼
             ┌──────────────────────────────────────────┐
             │        GOOGLE SHEET (tab "Content")      │
             │        26 kolom A–Z, baris 1 = header    │
             │        tab opsional "CTA"                │
             └──────────────────────────────────────────┘

   FALLBACK LOKAL (bila Sheet belum diisi / jaringan gagal)
             ┌──────────────────────────────────────────┐
             │  localStorage (prefix "cpsas.v1")        │
             │  • Mode Demo  : data contoh dari seed.js │
             │  • Mode Lokal : hasil edit belum tersinkron│
             └──────────────────────────────────────────┘
```

**Urutan yang benar-benar dicoba saat membaca data** (`readRows` di `js/data/sheet.js`):

| Urutan | Strategi | Nilai `source` | Catatan |
| --- | --- | --- | --- |
| 1 | gviz JSONP (`tqx=out:json`) | `gviz-jsonp` | Paling stabil, bebas CORS |
| 2 | Apps Script `doGet?action=list` JSONP | `apps-script` | Dipakai bila gviz diblokir jaringan/filter sekolah |
| 3 | gviz CSV via `fetch` | `gviz-csv` | Butuh header CORS dari Google |
| — | Gagal semua | `none` | Aplikasi memakai cache lokal atau data demo |
| — | `SPREADSHEET_ID` masih placeholder | `demo` | Data contoh dari `js/data/seed.js` |

## 3. Tanggung jawab tiap modul

| File | Tanggung jawab |
| --- | --- |
| `index.html` | Kerangka dokumen, meta tag (OG/favicon), pemuatan GSAP 3 dari CDN, `<script type="module" src="js/main.js">`, wadah tiap halaman. |
| `assets/css/style.css` | Seluruh tampilan: variabel warna, tata letak responsif, komponen kartu/tabel/badge, animasi pendukung. |
| `js/main.js` | Titik masuk. Menyusun shell, mendaftarkan rute/halaman, memuat data awal, memasang event global, menangani error tingkat aplikasi. |
| `js/core/config.js` | **Satu-satunya tempat konfigurasi.** `APP`, `DB` (SPREADSHEET_ID/SHEET_NAME/CTA_SHEET_NAME/APPS_SCRIPT_URL/TIMEOUT), `FIELDS`+`HEADERS` (skema 26 kolom), `PLATFORMS`, `STATUSES`, `PILARS`, `PILAR_TARGET`, `CTA_TYPES`, `CTA_GOALS`, `SCHOOL_PROFILE`, `ANALYTICS` (bobot + benchmark), `FEATURES`. |
| `js/core/util.js` | Utilitas umum: selektor `$`/`$$`, pembuat elemen `el`, `jsonp()` (inti koneksi tanpa CORS), `download()` (ekspor CSV), `copyText()`, `debounce`, `throttle`, `groupBy`, `sum`, `avg`, `round`, `uid`, `escapeHtml`, ikon SVG, `prefersReducedMotion`. |
| `js/core/format.js` | Format tampilan: `toDate` (parsing tanggal Sheet yang toleran), format tanggal/jam lokal `id-ID`, pemformatan angka ringkas (12,5rb), persentase, label status/pilar. |
| `js/data/sheet.js` | Lapisan akses Sheet: pembangun URL gviz (JSON/CSV), `parseGviz`, `parseCsv`, `headerToKey`, tiga strategi baca + fallback, `normalizeRecord`, `toSheetRow`, API tulis (`save`, `remove`, `bulk`, `ping`), `verifyWrite`, cache in-memory. |
| `js/data/store.js` | State aplikasi + orkestrasi: memuat baris, optimistis update, menyimpan cache/antrean di localStorage (prefix `cpsas.v1`), memancarkan event (`loaded`, perubahan), memutuskan Mode Demo vs Mode Sheet, menyimpan metadata sinkronisasi terakhir. |
| `js/data/seed.js` | Data contoh realistis untuk Mode Demo (berbagai platform, pilar, status, beserta metrik) supaya analitik & heatmap bisa langsung dilihat tanpa Sheet. |
| `js/social/platforms.js` | Integrasi sosial media: `detectFromUrl` (tebakan platform & format dari tautan), `extractPostId`, `embedHtml` (iframe resmi IG/TikTok/YouTube/Facebook), `thumbnailUrl` (i.ytimg.com), `fetchMeta` via oEmbed, `actions` (profil/DM/share/subscribe), `buildUtm`, `suggestPilar`. |
| `js/analytics/metrics.js` | Mesin KPI: `interactions`, `engagementRate`, `saveRate`, `shareRate`, `commentRate`, `clickRate`, `followerRate`, `conversionRate`, `scoreComponents`, `contentScore`, `grade`, `analyzeRow`, `summarize`, `breakdown`, `timeline`, `heatmap`, `rank`, `topPerformers`, `underPerformers`. |
| `js/analytics/insight.js` | Lapisan naratif: mengubah angka menjadi rekomendasi otomatis (konten mana yang layak diulang, pilar yang lemah, jam tayang terbaik, saran perbaikan judul/CTA/hashtag). |
| `js/lib/charts.js` | Grafik SVG buatan sendiri (tanpa library chart): garis tren, batang perbandingan, donat komposisi, heatmap hari × jam. |
| `js/lib/anim.js` | Animasi GSAP 3: transisi halaman, kemunculan kartu bertahap, angka berjalan (count-up), micro-interaction tombol, dengan penghormatan `prefers-reduced-motion`. |
| `js/ui/components.js` | Komponen UI yang dipakai ulang: kartu konten, badge status/platform, modal, toast, tabel, keadaan kosong, skeleton loading, form field. |
| `js/ui/shell.js` | Kerangka aplikasi: sidebar/nav, header, penanda halaman aktif, area konten, indikator sumber data & status sinkronisasi. |
| `js/views/planner.js` | Halaman Perencana: daftar & filter konten, form tambah/edit, generator ide/caption/hashtag, pemilih CTA, pratinjau embed. |
| `js/views/calendar.js` | Kalender editorial bulanan/mingguan, penempatan konten per tanggal & jam, deteksi bentrok jadwal. |
| `js/views/analytics.js` | Halaman Analitik: ringkasan KPI, skor konten, grafik tren, breakdown platform/pilar/format/CTA/PIC, heatmap waktu tayang, daftar rekomendasi. |
| `js/views/cta.js` | Library CTA: 12 jenis bawaan + CTA kustom, pencarian/filter per goal, penyalinan teks, penyisipan ke konten. |
| `js/views/settings.js` | Halaman Pengaturan: status konfigurasi, indikator sumber data, tombol Sinkron, **Tes Koneksi Tulis**, ekspor CSV, info mode demo, ringkasan profil sekolah. |
| `apps-script/Code.gs` | Backend tulis: `doGet` (JSONP `action=list` untuk baca-verifikasi), `doPost` (menerima `save`/`delete`/`bulk`/`ping`), pemetaan header→kolom, opsional `setup()` untuk menyiapkan header. |
| `scripts/serve.mjs` | Server statis lokal memakai modul `http` bawaan Node (tanpa dependensi) untuk pengembangan. |
| `scripts/selftest.mjs` | Uji mandiri: parser gviz & CSV, `headerToKey`, `normalizeRecord`, dan rumus analitik (ER, rate, skor) terhadap nilai yang diharapkan. |
| `tests/` | Wadah berkas pendukung pengujian saat pengembangan (fixture data contoh, catatan hasil uji manual). Boleh kosong; pengujian otomatis utama dijalankan oleh `scripts/selftest.mjs`. |

## 4. Skema data — 26 kolom tab `Content`

Urutan kolom ditentukan oleh array `FIELDS` di `js/core/config.js`; urutan A–Z pada
Sheet **harus** sama. Tipe `number` otomatis dikonversi (nilai tak valid → 0),
tipe `date` dinormalisasi ke `YYYY-MM-DD`.

| # | Kol | Header | Key internal | Tipe | Satuan / format | Dipakai untuk |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | A | ID | `id` | string | `ct-xxxxx` | Kunci unik; dibuat otomatis bila kosong |
| 2 | B | Tanggal | `tanggal` | date | `YYYY-MM-DD` | Kalender, tren, heatmap |
| 3 | C | Jam | `jam` | time | `HH.MM` (24 jam) | Heatmap & jam tayang terbaik |
| 4 | D | Judul | `judul` | string | teks, wajib | Identitas konten; baris tanpa Judul & ID diabaikan |
| 5 | E | Platform | `platform` | string | lihat `PLATFORMS` | Benchmark, breakdown, warna |
| 6 | F | Format | `format` | string | bebas (`Reels`, `Shorts`, …) | Breakdown format |
| 7 | G | Pilar | `pilar` | string | lihat `PILARS` | Target KPI per pilar |
| 8 | H | Status | `status` | string | lihat `STATUSES` | Hanya `tayang` dihitung analitik |
| 9 | I | Caption | `caption` | string | teks panjang | Generator & penyalinan caption |
| 10 | J | Hashtag | `hashtag` | string | dipisah spasi | Analisis & saran hashtag |
| 11 | K | CTA Jenis | `cta_jenis` | string | lihat `CTA_TYPES` | Breakdown CTA & skor click |
| 12 | L | CTA Teks | `cta_teks` | string | teks | Penyalinan CTA |
| 13 | M | CTA Link | `cta_link` | string | URL | Bisa ditambah UTM oleh `buildUtm` |
| 14 | N | Asset URL | `asset_url` | string | URL | Tautan aset desain/video |
| 15 | O | Post URL | `post_url` | string | URL | Deteksi platform, embed, oEmbed |
| 16 | P | Views | `views` | number | tayangan | Penyebut semua rate, komponen reach |
| 17 | Q | Likes | `likes` | number | jumlah | Pembilang ER |
| 18 | R | Comments | `comments` | number | jumlah | Pembilang ER, comment rate |
| 19 | S | Shares | `shares` | number | jumlah | Pembilang ER, share rate |
| 20 | T | Saves | `saves` | number | jumlah | Pembilang ER, save rate |
| 21 | U | Followers Gain | `followers_gain` | number | penambahan follower | Komponen growth |
| 22 | V | Klik Link | `klik_link` | number | jumlah klik | Click rate, CTR, komponen click |
| 23 | W | Pendaftar | `pendaftar` | number | jumlah pendaftar | Konversi PPDB |
| 24 | X | PIC | `pic` | string | nama | Breakdown per penanggung jawab |
| 25 | Y | Catatan | `catatan` | string | teks | Catatan editorial |
| 26 | Z | Diperbarui | `diperbarui` | datetime | ISO 8601 | Jejak perubahan terakhir |

Catatan penting:

- Kolom di luar A–Z **diabaikan** aplikasi (`normalizeRecord` hanya mengeluarkan 26 key).
- Header dicocokkan secara toleran oleh `headerToKey`: huruf besar/kecil, spasi, dan
  tanda hubung dinormalisasi, sehingga "CTA Link" → `cta_link`. Meski begitu, tetap
  disarankan menulis header persis seperti tabel di atas.
- Tanggal dibaca dari nilai tampilan sel (`f`) lebih dulu, lalu nilai mentah (`v`),
  lalu pola `Date(tahun,bulan,hari)` dari gviz.

## 5. Rumus analitik

Semua rate memakai **Views** sebagai penyebut. Bila `views = 0`, hasilnya `0`
(bukan error). Pembulatan 2 desimal.

```text
interaksi       = likes + comments + shares + saves
ER (%)          = (likes + comments + shares + saves) / views × 100
save rate (%)   = saves / views × 100
share rate (%)  = shares / views × 100
comment rate(%) = comments / views × 100
click rate (%)  = klik_link / views × 100
follower rate(%)= followers_gain / views × 100
konversi        = pendaftar / views × 1000        → pendaftar per 1.000 views
```

### 5.1 Benchmark per platform (ER %)

Nilai acuan industri pendidikan yang tersimpan di `ANALYTICS.benchmarkER`:

| Platform | Benchmark ER (%) | Arti praktis |
| --- | --- | --- |
| `instagram` | 3.8 | ER 3,8% = normal/baik |
| `tiktok` | 5.5 | TikTok wajar lebih tinggi |
| `youtube` | 3.2 | Views besar, interaksi relatif kecil |
| `facebook` | 2.4 | Audiens wali murid, interaksi lebih pasif |
| `whatsapp` | 12 | Status/broadcast dinilai sangat tinggi |
| `website` | 1.5 | Trafik PPDB, interaksi rendah tapi konversi tinggi |
| *(platform tak dikenal)* | 3 | Nilai cadangan |

Selain ER, tiap pilar punya target sendiri di `PILAR_TARGET`
(`er`, `saveRate`, `clickRate`). Contoh: `ppdb` menargetkan `clickRate` 2,5%
(klik jauh lebih penting daripada like), sedangkan `edukasi` menargetkan
`saveRate` 2,0% (konten layak disimpan).

### 5.2 Skor konten 0–100

Skor dihitung dari enam komponen. Setiap komponen dinormalisasi dengan rumus:

```text
skorKomponen = min(150, nilai / target × 100)
```

**Skor komponen 100 berarti performa konten tepat berada di benchmark/target.**
Nilai 150 adalah batas atas agar satu komponen yang sangat menonjol tidak menutupi
kelemahan komponen lain.

| Komponen | Bobot | Nilai yang diukur | Target |
| --- | --- | --- | --- |
| `engagement` | 0.34 | ER (%) | `benchmarkER[platform]` |
| `reach` | 0.20 | Views | `max(1000, median views platform yang sama)` |
| `save` | 0.14 | Save rate (%) | `benchmarkER × 0.35` |
| `share` | 0.12 | Share rate (%) | `benchmarkER × 0.30` |
| `click` | 0.12 | Click rate (%) | `PILAR_TARGET[pilar].clickRate` |
| `growth` | 0.08 | Follower rate (%) | `benchmarkER × 0.12` |

Perhitungan akhir:

```text
raw = engagement × 0.34
    + min(reach, 130) × 0.20     ← komponen reach dibatasi 130 sebelum dikalikan
    + save    × 0.14
    + share   × 0.12
    + click   × 0.12
    + growth  × 0.08

skor = min(100, raw)             ← 0 bila status ≠ "tayang" atau views = 0
```

Dua catatan yang sering menimbulkan pertanyaan:

1. **Komponen `reach` bersifat relatif.** Targetnya adalah median views platform yang
   sama pada data yang sedang dianalisis. Jadi konten dengan views "kecil" tetap bisa
   mendapat komponen reach tinggi bila seluruh konten platform itu juga kecil. Bila
   belum ada data pembanding, target minimumnya 1.000 views.
2. **Skor 0 bukan berarti gagal.** Konten berstatus `ide`/`draf`/`review`/`siap`/`arsip`
   atau yang belum punya angka views memang tidak diberi skor.

### 5.3 Kategori nilai (grade)

| Rentang skor | Grade | Label |
| --- | --- | --- |
| ≥ 85 | A+ | Luar Biasa |
| 70 – 84.9 | A | Sangat Baik |
| 55 – 69.9 | B | Baik |
| 40 – 54.9 | C | Cukup |
| > 0 – 39.9 | D | Perlu Diperbaiki |
| 0 | — | Belum ada data |

### 5.4 Contoh perhitungan

**Kasus A — Instagram Reels, pilar `akademik`.** Views 12.500 · likes 830 ·
comments 42 · shares 71 · saves 95 · followers gain 18 · klik 64 · median views
platform 5.000.

```text
interaksi = 830 + 42 + 71 + 95 = 1.038
ER        = 1.038 / 12.500 × 100 = 8,30 %   → 8,30 / 3,8 × 100 = 218 → dibatasi 150
reach     = 12.500 / 5.000 × 100 = 250      → dibatasi 150, lalu min(150,130) = 130
save      = 0,76 %  vs target 1,33 %   → 57,1
share     = 0,57 %  vs target 1,14 %   → 49,8
click     = 0,51 %  vs target 0,60 %   → 85,3
growth    = 0,14 %  vs target 0,46 %   → 31,6

raw = 150×0,34 + 130×0,20 + 57,1×0,14 + 49,8×0,12 + 85,3×0,12 + 31,6×0,08
    = 51,0 + 26,0 + 8,0 + 6,0 + 10,2 + 2,5 = 103,7  →  skor = 100,0  (A+)
```

**Kasus B — TikTok, pilar `kesiswaan`.** Views 3.000 · likes 150 · comments 10 ·
shares 8 · saves 22 · followers gain 3 · klik 12 · median views platform 6.000.

```text
ER     = 190 / 3.000 × 100 = 6,33 %  → 6,33 / 5,5 × 100 = 115,1
reach  = 3.000 / 6.000 × 100 = 50,0
save   = 0,73 %  vs 1,93 %  → 38,1
share  = 0,27 %  vs 1,65 %  → 16,4
click  = 0,40 %  vs 0,50 %  → 80,0
growth = 0,10 %  vs 0,66 %  → 15,2

raw = 115,1×0,34 + 50×0,20 + 38,1×0,14 + 16,4×0,12 + 80×0,12 + 15,2×0,08
    = 39,1 + 10,0 + 5,3 + 2,0 + 9,6 + 1,2 = 67,2  →  skor ≈ 67  (B, "Baik")
```

Perbedaan pembulatan di tiap langkah dapat menggeser hasil akhir sekitar ±0,2 poin.

### 5.5 Heatmap waktu tayang

Heatmap adalah matriks **7 hari × 6 slot jam** (Ahad–Sabtu × `<09`, `09–12`, `12–15`,
`15–18`, `18–21`, `>21`). Setiap sel menyimpan jumlah konten, total views, dan rata-rata
ER pada sel itu. Hanya konten berstatus `tayang` yang bertanggal yang dihitung; konten
tanpa jam valid dimasukkan ke slot `18–21` sebagai pendekatan. Minimal 5 konten tayang
(`ANALYTICS.minSample`) disarankan sebelum menyimpulkan "jam terbaik", karena sampel
kecil mudah menyesatkan.

## 6. Cara menambah platform, pilar, atau jenis CTA

### 6.1 Menambah platform baru

Misal menambah `threads` dan `linkedin`:

1. **`js/core/config.js`** → tambahkan entri di `PLATFORMS`:

```js
export const PLATFORMS = Object.freeze({
  // ...platform yang sudah ada...
  threads: { label: 'Threads', icon: 'threads', color: '#000000', soft: '#EDEDED',
             types: ['Feed', 'Carousel'], bestTime: '20.00' },
  linkedin: { label: 'LinkedIn', icon: 'linkedin', color: '#0A66C2', soft: '#E7F0FA',
             types: ['Post', 'Artikel'], bestTime: '08.00' },
});
```

2. **`js/core/config.js`** → tambahkan benchmark ER di `ANALYTICS.benchmarkER`:

```js
benchmarkER: { instagram: 3.8, tiktok: 5.5, youtube: 3.2, facebook: 2.4,
               whatsapp: 12, website: 1.5, threads: 3.0, linkedin: 2.0 },
```

3. **`js/social/platforms.js`** → bila platform punya pola URL khas, tambahkan di
   `MATCHERS` beserta ekstraktor ID di `extractPostId`, dan (bila ada) iframe di
   `embedHtml` serta endpoint di `OEMBED_ENDPOINTS`.
4. **`js/analytics/metrics.js`** → biasanya **tidak perlu diubah**: `breakdown('platform')`
   dan label sudah membaca dari `PLATFORMS`. Ubah hanya bila Anda menambah dimensi
   analitik baru (mis. pengelompokan khusus per platform).
5. **`js/lib/charts.js`** → tidak perlu diubah; warna diambil dari `PLATFORMS[p].color`.
6. **Google Sheet** → nilai platform ditulis huruf kecil (`threads`).
7. Jalankan `node scripts/selftest.mjs`, lalu uji mode demo untuk memastikan ikon dan
   warna tampil wajar.

### 6.2 Menambah pilar baru

1. **`js/core/config.js`** → tambahkan objek di `PILARS`
   (`id`, `label`, `emoji`, `goal`, `color`).
2. **`js/core/config.js`** → tambahkan target di `PILAR_TARGET`
   (`er`, `saveRate`, `clickRate`). Bila lupa, skor komponen `click` memakai target
   cadangan 1%.
3. **`js/social/platforms.js`** → tambahkan aturan kata kunci di `suggestPilar` agar
   pilar ini bisa disarankan otomatis dari caption.
4. **`js/analytics/metrics.js`** → tidak perlu diubah; `breakdown('pilar')` sudah
   membaca `PILARS`.

```js
{ id: 'alumni', label: 'Alumni & Jejak Lulusan', emoji: '🎓', goal: 'trust', color: '#9333EA' },
// PILAR_TARGET:
alumni: { er: 3.5, saveRate: 0.8, clickRate: 0.5 },
```

### 6.3 Menambah jenis CTA baru

1. **`js/core/config.js`** → tambahkan entri di `CTA_TYPES` dengan `id`, `label`,
   `goal`, dan `template`. Gunakan placeholder `{akun}` untuk nama akun sekolah.

```js
{ id: 'polling', label: 'Ikut Polling', goal: 'engagement',
  template: 'Pilih pendapat Bunda/Ayah di polling ini ya 🗳️' },
```

2. Bila perlu kategori tujuan baru, tambahkan di `CTA_GOALS`.
3. **`js/views/cta.js`** → tidak perlu diubah (daftar dirender dari `CTA_TYPES`).
4. Library kustom dari tab `CTA` di Sheet akan tampil **melengkapi** daftar bawaan;
   pastikan kolom `Jenis` memakai id yang sama agar filter berjalan.
5. Nilai `cta_jenis` di Sheet memakai id huruf kecil (`polling`).

## 7. Batasan yang harus disadari

1. **Metrik tidak ditarik otomatis.** Tanpa token API resmi (Meta Graph API, TikTok
   Display API, YouTube Data API), aplikasi **tidak bisa** mengambil likes, views,
   komentar, atau followers secara otomatis. Semua angka diisi manual ke Sheet — atau
   dengan bantuan AI yang membaca tangkapan layar. Aplikasi hanya *memvalidasi metadata
   publik* dan *menghitung* dari angka yang Anda isi.
2. **oEmbed tidak merata.** YouTube dan TikTok ramah CORS sehingga judul/penulis/
   thumbnail bisa diambil. Instagram dan Facebook memblokir permintaan lintas origin,
   jadi keduanya **hanya bisa di-embed** (pratinjau), tanpa pengambilan metadata —
   isi metriknya manual.
3. **Data Sheet bersifat publik-baca.** Siapa pun yang memiliki ID Spreadsheet dapat
   membaca isinya. Karena itu Sheet tidak boleh memuat data pribadi sensitif.
4. **Apps Script bukan sistem aman.** URL `/exec` yang bocor dapat disalahgunakan untuk
   menulis. Lihat mitigasi di [Setup Apps Script](02-setup-apps-script.md) bagian 9.
5. **Penulisan bersifat "fire and forget".** Karena `mode: 'no-cors'`, keberhasilan
   penulisan tidak bisa dipastikan langsung; aplikasi memverifikasi lewat pembacaan
   ulang dan menyimpan antrean lokal bila belum terkonfirmasi.
6. **Cache gviz 1–5 menit.** Data yang baru diubah di Sheet bisa tertunda muncul.
7. **Kuota Apps Script.** Kuota harian akun gratis cukup untuk satu sekolah, tetapi
   bukan untuk ribuan pengguna bersamaan.
8. **Tidak ada autentikasi pengguna.** Aplikasi tidak membedakan peran admin/guru/staf;
   siapa pun yang membuka URL dapat melihat dan (bila Apps Script aktif) mengubah data.
9. **Data analitik bergantung kualitas input.** Angka yang diisi asal-asalan menghasilkan
   rekomendasi yang menyesatkan; disiplin pengisian lebih menentukan daripada rumusnya.

## 8. Roadmap yang masuk akal

| Prioritas | Rencana | Catatan kelayakan |
| --- | --- | --- |
| Tinggi | Impor massal dari CSV/Excel ke Sheet | Sebagian sudah ada (`api.bulk`), tinggal UI impor |
| Tinggi | Token rahasia + validasi di `Code.gs` | Murah, menaikkan hambatan penyalahgunaan |
| Sedang | Integrasi Meta Graph API / YouTube Data API untuk metrik otomatis | Butuh app review, token server, dan kepatuhan kebijakan platform — tidak bisa murni statis |
| Sedang | Penjadwalan otomatis (auto-post / pengingat) | Butuh server + izin platform; tidak mungkin dari halaman statis |
| Sedang | Notifikasi WhatsApp ke PIC saat konten jatuh tempo | Butuh penyedia pihak ketiga (mis. WhatsApp Business API) atau tautan `wa.me` manual |
| Rendah | Multi-sekolah (satu aplikasi, banyak Sheet) | Perlu pemilih profil sekolah + konfigurasi per sekolah |
| Rendah | Autentikasi & peran pengguna | Memerlukan backend; bertentangan dengan prinsip statis |
| Rendah | Ekspor PDF laporan bulanan | Bisa dilakukan di sisi klien, tanpa server |

Semua rencana di atas adalah **usulan**, bukan fitur yang sudah ada. Selama belum
diimplementasikan, anggap aplikasi beroperasi dengan batasan pada bagian 7.

---

Dokumen terkait: [Setup Google Sheet](01-setup-google-sheet.md) ·
[Setup Apps Script](02-setup-apps-script.md) · [Panduan Deploy](03-deploy.md)
