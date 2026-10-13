# 01 — Menyiapkan Google Sheet sebagai Database

Panduan ini ditulis untuk **guru / staf TU yang tidak terbiasa teknis**. Ikuti langkahnya
berurutan. Perkiraan waktu: **15–25 menit**. Tidak perlu install apa pun, cukup browser
(Chrome/Edge/Firefox) dan akun Google sekolah.

Aplikasi **Content Planner Sekolah Anak Saleh** menyimpan seluruh data konten di satu
Google Sheet milik Anda. Tidak ada server, tidak ada langganan, dan **tidak ada API key
maupun login OAuth** yang perlu dibuat. Aplikasi membaca Sheet lewat tautan publik
(read-only) dan — kalau Anda mau bisa mengedit dari dalam aplikasi — menulis lewat
Google Apps Script (dibahas di [Setup Apps Script](02-setup-apps-script.md)).

> **Yang perlu dipahami sejak awal:** karena tidak memakai API resmi Google, koneksi
> bergantung pada izin "siapa saja yang punya link boleh melihat". Artinya **isi Sheet
> tidak boleh berisi data rahasia** (NIK, nilai rapor, nomor HP wali murid, dsb.).
> Simpan hanya data perencanaan konten dan angka statistik sosial media.

---

## 1. Buat Spreadsheet baru

1. Buka <https://sheets.google.com> dan pastikan Anda login dengan **akun Google sekolah**.
2. Klik **Blank spreadsheet** (Spreadsheet kosong).
3. Klik nama "Untitled spreadsheet" di kiri atas, ganti menjadi:
   `Database Konten Sekolah Anak Saleh`
4. Biarkan file ini di dalam Google Drive sekolah (atau Drive pribadi Anda). Tidak perlu
   dipindah ke folder khusus.

## 2. Siapkan tab bernama `Content`

1. Lihat bagian bawah jendela. Ada tab bernama **Sheet1**.
2. Klik kanan tab tersebut → **Rename** → ketik persis: `Content`
   (huruf **C** besar, tanpa spasi di depan/belakang).
3. Tekan Enter.

> Nama tab ini harus sama dengan nilai `SHEET_NAME` di `js/core/config.js`
> (bawaan: `Content`). Kalau Anda memakai nama lain seperti `Data Konten`, ubah juga
> nilai `SHEET_NAME` di langkah 9.

## 3. Tempel baris header (26 kolom)

Header harus berada **di baris 1**, **berurutan**, dan **ejaannya sama persis**.
Cara tercepat: salin blok di bawah, klik sel **A1**, lalu tempel (Ctrl+V).

```text
ID	Tanggal	Jam	Judul	Platform	Format	Pilar	Status	Caption	Hashtag	CTA Jenis	CTA Teks	CTA Link	Asset URL	Post URL	Views	Likes	Comments	Shares	Saves	Followers Gain	Klik Link	Pendaftar	PIC	Catatan	Diperbarui
```

Blok di atas memakai pemisah **Tab** (bukan koma). Kalau hasil tempel menumpuk di satu
sel, berarti pemisahnya berubah menjadi spasi — pakai cara manual berikut:

Ketik satu per satu di sel A1 sampai Z1:

| Sel | Header | Sel | Header |
| --- | --- | --- | --- |
| A1 | ID | N1 | Asset URL |
| B1 | Tanggal | O1 | Post URL |
| C1 | Jam | P1 | Views |
| D1 | Judul | Q1 | Likes |
| E1 | Platform | R1 | Comments |
| F1 | Format | S1 | Shares |
| G1 | Pilar | T1 | Saves |
| H1 | Status | U1 | Followers Gain |
| I1 | Caption | V1 | Klik Link |
| J1 | Hashtag | W1 | Pendaftar |
| K1 | CTA Jenis | X1 | PIC |
| L1 | CTA Teks | Y1 | Catatan |
| M1 | CTA Link | Z1 | Diperbarui |

### Arti setiap kolom

| # | Kolom | Isi apa | Contoh |
| --- | --- | --- | --- |
| 1 | ID | Kode unik baris. Boleh dikosongkan — aplikasi mengisi otomatis (mis. `ct-8f3a1`). Jangan diubah setelah ada. | `ct-8f3a1` |
| 2 | Tanggal | Tanggal tayang/rencana tayang | `2026-01-15` |
| 3 | Jam | Jam tayang, format 24 jam | `19.30` |
| 4 | Judul | Nama/judul konten. **Wajib diisi** — baris tanpa Judul dan tanpa ID akan diabaikan aplikasi. | `Reels prestasi olimpiade` |
| 5 | Platform | Kanal publikasi (lihat tabel nilai valid) | `instagram` |
| 6 | Format | Bentuk konten, teks bebas | `Reels`, `Carousel`, `Shorts` |
| 7 | Pilar | Tema konten sesuai pilar sekolah | `akademik` |
| 8 | Status | Tahap pengerjaan konten | `tayang` |
| 9 | Caption | Naskah caption yang dipakai | `Alhamdulillah, ananda...` |
| 10 | Hashtag | Kumpulan hashtag, pisahkan spasi | `#sekolahanaksaleh #ppdb` |
| 11 | CTA Jenis | Jenis ajakan (lihat tabel nilai valid) | `daftar` |
| 12 | CTA Teks | Kalimat ajakan yang tampil di konten | `Daftar PPDB lewat link di bio` |
| 13 | CTA Link | Tautan tujuan CTA (boleh ditambah UTM otomatis oleh app) | `https://.../ppdb` |
| 14 | Asset URL | Tautan file desain/video (Drive, Canva, dsb.) | `https://drive.google.com/...` |
| 15 | Post URL | Tautan postingan yang sudah tayang — dipakai untuk embed & cek metadata | `https://www.instagram.com/reel/...` |
| 16 | Views | Jumlah tayangan/impresi | `12500` |
| 17 | Likes | Jumlah suka | `830` |
| 18 | Comments | Jumlah komentar | `42` |
| 19 | Shares | Jumlah dibagikan | `71` |
| 20 | Saves | Jumlah disimpan (Instagram) / ditambahkan ke favorit | `95` |
| 21 | Followers Gain | Perkiraan penambahan pengikut dari konten ini | `18` |
| 22 | Klik Link | Jumlah klik tautan (link bio, brosur, dsb.) | `64` |
| 23 | Pendaftar | Jumlah pendaftar PPDB yang berasal dari konten ini | `3` |
| 24 | PIC | Penanggung jawab konten | `Ustadzah Rina` |
| 25 | Catatan | Catatan bebas (kendala, revisi, ide lanjutan) | `Ganti thumbnail` |
| 26 | Diperbarui | Waktu perubahan terakhir (diisi otomatis oleh aplikasi) | `2026-01-15T19:40:00Z` |

Kolom **1–15** adalah data perencanaan; kolom **16–23** adalah angka metrik; kolom
**24–26** adalah administrasi. Analitik hanya menghitung baris yang kolom Status-nya
`tayang` dan kolom Views-nya berisi angka lebih dari 0.

## 4. (Opsional) Isi satu baris contoh

Mengetik satu baris contoh membantu Anda memastikan kolom tidak bergeser:

```text
ct-contoh	2026-01-15	19.30	Reels prestasi olimpiade	instagram	Reels	akademik	tayang	Alhamdulillah ananda meraih juara	#sekolahanaksaleh #prestasi	bagikan	Bagikan ke grup wali murid	https://sekolahanaksaleh.sch.id/ppdb			https://www.instagram.com/reel/xxxx	12500	830	42	71	95	18	64	3	Ustadzah Rina	Contoh baris — boleh dihapus
```

Setelah aplikasi bisa membaca, baris contoh ini boleh dihapus.

## 5. Nilai yang valid (agar filter & analitik bekerja)

Tulis dengan **huruf kecil semua** dan tanpa spasi. Aplikasi tetap bisa menampilkan
nilai asing, tetapi nilai itu tidak akan masuk ke kelompok filter/analitik.

### Platform

| Nilai | Arti |
| --- | --- |
| `instagram` | Instagram (Reels, Carousel, Feed, Story) |
| `tiktok` | TikTok |
| `youtube` | YouTube (Shorts, video panjang, Live) |
| `facebook` | Facebook (Feed, Reels, Album) |
| `whatsapp` | WhatsApp (Status, Broadcast, Grup Wali) |
| `website` | Website sekolah / halaman PPDB |

### Status

| Nilai | Arti |
| --- | --- |
| `ide` | Baru berupa gagasan, belum dikerjakan |
| `draf` | Sedang disusun (caption/desain) |
| `review` | Menunggu persetujuan pimpinan/wakil kepala |
| `siap` | Sudah final, menunggu jadwal tayang |
| `tayang` | Sudah dipublikasikan — **hanya status ini yang dihitung analitik** |
| `arsip` | Konten lama, disimpan sebagai referensi |

### Pilar

| Nilai | Arti |
| --- | --- |
| `akademik` | Akademik & prestasi |
| `karakter` | Akhlak & karakter |
| `tahfiz` | Tahfiz & Al-Qur'an |
| `kesiswaan` | Kegiatan & ekstrakurikuler |
| `ppdb` | PPDB & penerimaan murid |
| `sarana` | Sarana & fasilitas |
| `guru` | Guru & staf |
| `testimoni` | Testimoni wali murid |
| `edukasi` | Edukasi parenting |
| `event` | Event & agenda sekolah |

### CTA Jenis (call-to-action)

| Nilai | Arti |
| --- | --- |
| `follow` | Ajak mengikuti akun |
| `simpan` | Ajak menyimpan postingan |
| `komentar` | Ajak berkomentar |
| `bagikan` | Ajak membagikan ke wali lain |
| `daftar` | Ajak mendaftar PPDB |
| `hubungi` | Ajak menghubungi admin (WhatsApp) |
| `kunjungan` | Ajak menjadwalkan kunjungan sekolah |
| `unduh` | Ajak mengunduh brosur/formulir |
| `link-bio` | Ajak klik tautan di bio |
| `donasi` | Ajak donasi/wakaf |
| `agenda` | Ajak mencatat agenda sekolah |
| `lainnya` | CTA kustom (tulis bebas di CTA Teks) |

## 6. Format tanggal dan jam yang disarankan

Kalender editorial dan heatmap waktu tayang **sangat bergantung** pada dua kolom ini.

1. Pilih seluruh kolom **B (Tanggal)** → menu **Format → Number → Custom date and time**
   → pilih pola `2026-01-15` (YYYY-MM-DD). Hindari pola `15/01/2026` karena bisa
   tertukar antara tanggal dan bulan.
2. Pilih seluruh kolom **C (Jam)** → **Format → Number → Plain text**, lalu isi dengan
   pola `HH.MM` 24 jam: `06.30`, `12.00`, `19.30`.
3. Jangan menulis jam sebagai `7 malam` atau `19:30` — titik dua (`:`) masih terbaca,
   tetapi `19.30` adalah pola yang dipakai tampilan aplikasi.
4. Kolom **Z (Diperbarui)** boleh dibiarkan apa adanya; aplikasi mengisinya sendiri.

> **Mengapa penting?** Aplikasi membaca nilai tampilan sel (teks yang Anda lihat) lebih
> dulu, baru nilai mentahnya. Kalau sel Tanggal ditampilkan sebagai angka `46037`,
> aplikasi tidak bisa mengelompokkan konten per hari, sehingga kalender dan heatmap
> menjadi kosong.

## 7. Bagikan Sheet agar bisa dibaca aplikasi

1. Klik tombol **Share** (kanan atas).
2. Klik **General access** / **Change to anyone with the link**.
3. Pilih izin **Viewer** — **jangan** pilih Editor, karena aplikasi hanya butuh membaca.
4. Klik **Done**.
5. Untuk memastikan: buka tautan Sheet di jendela **Incognito** (Ctrl+Shift+N). Kalau
   isinya terlihat tanpa login, berarti pengaturan sudah benar.

> Kalau langkah ini terlewat, aplikasi akan menampilkan pesan izin akses dan otomatis
> jatuh ke **Mode Demo** (data contoh di browser) — aplikasi tetap jalan, tetapi tidak
> memakai Sheet Anda.

## 8. Ambil `SPREADSHEET_ID` dari URL

Lihat address bar browser. Formatnya:

```text
https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890/edit#gid=0
                                        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                        inilah SPREADSHEET_ID
```

ID adalah teks **di antara `/d/` dan `/edit`**. Pada contoh di atas ID-nya:
`1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890`.

Salin dengan hati-hati: **tanpa** tanda `/`, **tanpa** `edit`, **tanpa** spasi.

> Catatan teknis: aplikasi menganggap ID valid bila panjangnya **minimal 20 karakter**
> dan hanya berisi huruf, angka, tanda hubung, atau garis bawah. ID yang salah ketik
> akan membuat aplikasi tetap berada di Mode Demo.

## 9. Tempelkan ID ke `js/core/config.js`

Buka file `js/core/config.js` dengan Notepad/VS Code, cari blok `DB`, lalu ganti dua
baris berikut:

```js
export const DB = Object.freeze({
  /** Ganti dengan ID Spreadsheet. */
  SPREADSHEET_ID: '1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890',

  /** Nama tab (default: "Content") */
  SHEET_NAME: 'Content',

  /** Tab opsional untuk library CTA. Kosongkan ('') untuk pakai library bawaan app. */
  CTA_SHEET_NAME: 'CTA',

  /** URL Web App Apps Script yang diakhiri /exec (untuk tulis + sinkron 2 arah). */
  APPS_SCRIPT_URL: 'GANTI_DENGAN_URL_APPS_SCRIPT_ANDA',

  /** Timeout request (ms) */
  TIMEOUT: 15000,
});
```

Simpan file. Sekaligus, sesuaikan profil sekolah supaya CTA otomatis dan tautan
WhatsApp benar:

```js
export const SCHOOL_PROFILE = Object.freeze({
  nama: 'Sekolah Anak Saleh',
  akun: 'sekolahanaksaleh',                       // tanpa tanda @
  website: 'https://sekolahanaksaleh.sch.id',
  whatsapp: '6281234567890',                      // awali 62, tanpa tanda + dan spasi
  ppdbLink: 'https://sekolahanaksaleh.sch.id/ppdb',
  tahunAjaran: '2026/2027',
});
```

## 10. Cek koneksi di halaman Pengaturan aplikasi

1. Buka aplikasi (lihat [Panduan Deploy](03-deploy.md) atau jalankan lokal dengan
   `node scripts/serve.mjs`).
2. Buka menu **Pengaturan**.
3. Perhatikan **indikator sumber data**. Artinya:

| Indikator | Arti | Tindakan |
| --- | --- | --- |
| `gviz` | Berhasil baca dari Google Sheet lewat endpoint publik. **Ini yang diharapkan.** | Tidak ada — sudah benar |
| `apps-script` | gviz tidak terjangkau, data diambil lewat Apps Script | Cek `APPS_SCRIPT_URL`; koneksi tetap sah |
| `csv` | Dua jalur JSONP gagal, data diambil sebagai CSV | Cek jaringan/sekolah memblokir; fungsi tetap jalan |
| `demo` | Sheet belum dikonfigurasi (ID masih placeholder) | Ulangi langkah 8–9 |
| `lokal` / `cache-lokal` | Data tersimpan di browser (offline atau gagal muat) | Klik **Sinkron / Muat Ulang** saat online |
| `none` | Semua cara gagal | Buka Troubleshooting di bawah |

4. Klik tombol **Sinkron** (atau **Muat Ulang Data**) dan pastikan jumlah baris di
   aplikasi sama dengan jumlah baris data di Sheet.

## 11. Troubleshooting

### Sheet kosong / aplikasi tampil Mode Demo
- Pastikan `SPREADSHEET_ID` sudah diganti (bukan `GANTI_DENGAN_SPREADSHEET_ID_ANDA`).
- Pastikan nama tab persis `Content` (bukan `content`, `Content `, atau `Sheet1`).
- Pastikan baris 1 berisi header, bukan judul gabungan hasil **Format → Merge cells**.
  Sel gabungan membuat gviz kehilangan nama kolom.
- Pastikan minimal ada satu baris yang kolom Judul atau ID-nya terisi.

### Muncul pesan "izin akses" / gagal memuat
- Ulangi **langkah 7**: General access harus **Anyone with the link = Viewer**.
- Kalau Sheet berada di Shared Drive sekolah yang membatasi tautan publik, pindahkan
  atau minta admin mengizinkan tautan publik.
- Coba buka URL gviz berikut di tab baru (ganti ID-nya). Kalau muncul pesan error atau
  halaman login, masalahnya ada di izin Sheet, bukan di aplikasi:

```text
https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/gviz/tq?tqx=out:json&sheet=Content
```

### Data tidak muncul setelah Sheet diedit
- Google menyimpan cache respons gviz sekitar **1–5 menit**. Aplikasi sudah menambahkan
  penanda waktu (`_=`) untuk menembus cache, tetapi cache di sisi Google tetap berlaku.
- Tunggu 1–5 menit, lalu klik **Sinkron**. Jangan mengedit file konfigurasi berkali-kali
  hanya karena data belum muncul.
- Kalau memakai mode `no-cors` untuk menyimpan (lihat
  [Setup Apps Script](02-setup-apps-script.md)), perubahan baru terlihat setelah
  sinkronisasi berikutnya.

### Kolom bergeser / nilai masuk ke kolom salah
- Header di baris 1 harus **sama persis** dengan daftar 26 kolom di langkah 3, termasuk
  huruf besar-kecil dan tanda hubung pada `CTA Jenis`, `CTA Teks`, `CTA Link`,
  `Asset URL`, `Post URL`.
- Jangan menyisipkan kolom baru di tengah. Kalau perlu kolom tambahan, taruh **setelah**
  kolom Z (mis. AA) — aplikasi mengabaikan kolom di luar skema.
- Jangan menghapus kolom di tengah; menggeser kolom membuat metrik terbaca sebagai judul.
- Cara memperbaiki: hapus baris header, tempel ulang header dari langkah 3, lalu
  sinkronkan ulang.

### Format tanggal berubah menjadi angka
- Gejala: kolom Tanggal tampil `46037` atau `15/01/2026`, kalender dan heatmap kosong.
- Solusi: pilih kolom B → **Format → Number → Custom date and time** → pola
  `2026-01-15`, atau **Format → Number → Plain text** lalu tulis ulang tanggalnya.
- Aplikasi juga menerima pola `15/01/2026` dan mengubahnya menjadi `2026-01-15`
  otomatis, tetapi pola hari/bulan yang tertukar tidak bisa dideteksi.

### Angka metrik terbaca 0
- Pastikan kolom Views–Pendaftar berisi angka murni, bukan `12,5rb` atau `1.250 views`.
- Pemisah ribuan berupa titik (`1.250`) akan dibaca sebagai `1.25`. Tulis `1250`.
- Baris dengan Status bukan `tayang` tidak akan masuk ke analitik meski angkanya besar.

## 12. Opsional — tab `CTA` untuk library CTA kustom

Kalau sekolah punya kalimat ajakan baku yang sering dipakai, buat tab kedua:

1. Klik tanda **+** di kiri bawah untuk menambah sheet baru.
2. Beri nama `CTA`.
3. Isi baris 1 dengan header sederhana berikut (boleh hanya sebagian):

```text
Jenis	Teks	Link	Pilar	Sasaran
daftar	Daftar PPDB gelombang 2, kuota terbatas!	https://sekolahanaksaleh.sch.id/ppdb	ppdb	Wali murid TK B
hubungi	Tanya biaya dan jadwal? Chat admin kami.	https://wa.me/6281234567890	ppdb	Umum
simpan	Simpan postingan ini untuk dibaca ulang nanti		edukasi	Wali murid
```

4. Pastikan nilai `CTA_SHEET_NAME` di `js/core/config.js` tetap `'CTA'`. Kalau Anda tidak
   ingin memakai library kustom, isi dengan string kosong: `CTA_SHEET_NAME: ''`.
5. Tab ini bersifat tambahan. Kalau tab tidak ada atau gagal dibaca, aplikasi tetap
   memakai library CTA bawaan (12 jenis CTA: follow, simpan, komentar, bagikan, daftar,
   hubungi, kunjungan, unduh, link-bio, donasi, agenda, lainnya).

## 13. Checklist akhir

- [ ] Spreadsheet dibuat dengan nama jelas dan tab bernama `Content`.
- [ ] Baris 1 berisi 26 header persis sesuai urutan, tanpa sel gabungan.
- [ ] Kolom Tanggal berformat `YYYY-MM-DD`, kolom Jam berformat `HH.MM`.
- [ ] Sheet dibagikan **Anyone with the link = Viewer** (diuji di jendela Incognito).
- [ ] `SPREADSHEET_ID`, `SHEET_NAME`, dan `SCHOOL_PROFILE` sudah diperbarui di
      `js/core/config.js`.
- [ ] Halaman **Pengaturan** menampilkan indikator sumber data `gviz`.
- [ ] Tidak ada data pribadi sensitif di dalam Sheet.

Lanjutkan ke [Setup Apps Script](02-setup-apps-script.md) bila Anda ingin bisa
menambah/mengubah konten langsung dari aplikasi. Kalau tidak, aplikasi tetap berfungsi
penuh untuk membaca dan menganalisis data yang Anda isi manual di Sheet.
