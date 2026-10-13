# 03 — Deploy & Publikasi Aplikasi

Dokumen ini membandingkan opsi hosting lalu memandu langkah deploy yang direkomendasikan.
Dibuat untuk operator yang sudah nyaman dengan istilah teknis dasar (repo, push, DNS).

Pastikan [Setup Google Sheet](01-setup-google-sheet.md) dan — bila perlu tulis dari
aplikasi — [Setup Apps Script](02-setup-apps-script.md) sudah selesai sebelum publikasi.

---

## 1. Syarat hosting untuk aplikasi ini

Aplikasi ini **100% statis**: HTML + JavaScript ES modules + CSS + animasi GSAP dari CDN.
Tidak ada backend, tidak ada proses build, tidak ada `package.json` yang wajib.

Konsekuensinya:

1. **Wajib diakses lewat HTTP/HTTPS, bukan `file://`.** ES modules (`import`/`export`)
   diblokir oleh kebijakan CORS browser saat dibuka langsung dari filesystem.
2. **Tidak butuh Node.js/server.** Komunikasi ke Google Sheet memakai JSONP dan
   permintaan CORS langsung dari browser, jadi hosting statis apa pun cukup.
3. **Wajib HTTPS** agar: embed Instagram/TikTok/YouTube tampil, Clipboard API
   (salin caption) bekerja, dan JSONP tidak diblokir mixed-content.
4. **Tidak ada rahasia yang aman di sisi klien.** Semua yang ada di repo bisa dibaca
   pengunjung. Data inti tetap di Google Sheet.

## 2. Perbandingan opsi hosting

| Opsi | Biaya | Kemudahan | HTTPS | Domain kustom | Kelebihan | Kekurangan | Cocok untuk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **GitHub Pages** | Gratis | Sedang (perlu Git/upload repo) | Ya | Ya (CNAME + DNS) | Gratis selamanya, langsung dari repo, tidak perlu build, kontrol versi | Repo publik = kode terlihat; butuh akun GitHub; tanpa fungsi server | **Rekomendasi utama** untuk sekolah dengan 1 operator TI |
| **Netlify** | Gratis (tier hobby) | Sangat mudah (drag-and-drop) | Ya | Ya | Deploy drag-and-drop tanpa Git, preview tiap deploy, redirect mudah | Kuota build/menit terbatas di tier gratis; akun pihak ketiga | Operator non-teknis yang ingin secepat mungkin online |
| **Vercel** | Gratis (hobby) | Mudah | Ya | Ya | DX terbaik, deploy dari Git cepat, CDN bagus | Ditujukan untuk project developer; batas komersial di tier gratis | Tim yang sudah memakai Git dan ingin CI otomatis |
| **Cloudflare Pages** | Gratis | Mudah | Ya | Ya | CDN sangat cepat di Indonesia, kuota bandwidth besar, build dari Git | Perlu akun Cloudflare; UI lebih teknis | Sekolah dengan banyak pengunjung / jaringan lambat |
| **Firebase Hosting** | Gratis (Spark) | Sedang | Ya | Ya | CDN Google, integrasi mudah bila kelak pakai Firebase | Perlu CLI + akun Google Cloud; konsepnya lebih berat | Sekolah yang berencana memakai layanan Google lain |
| **Hosting sekolah / cPanel** | Sudah termasuk | Sedang (upload manual) | Tergantung admin | Ya (domain sekolah) | Satu domain dengan website sekolah, tanpa akun pihak ketiga | Sering tanpa HTTPS otomatis, upload manual tiap perubahan, kadang diblokir kebijakan | Sekolah yang mewajibkan semua aset di server sendiri |
| **Apps Script HTML Service** | Gratis | Sulit | Ya | Tidak (URL panjang) | Satu origin dengan backend Sheet, tanpa CORS sama sekali | Perlu menulis ulang seluruh app jadi `HtmlService`, URL tidak enak dibagikan, batas kuota | Eksperimen; **tidak disarankan** untuk app ini |
| **Lokal `scripts/serve.mjs`** | Gratis | Sangat mudah | Tidak (http://localhost) | Tidak | Tanpa dependensi, langsung jalan, ideal untuk uji coba & pengembangan | Hanya bisa diakses dari komputer itu; bukan untuk publikasi | Uji coba sebelum deploy, pelatihan staf |

> Catatan jujur untuk **Apps Script HTML Service**: karena aplikasi ini sudah memakai
> JSONP/CORS, memindahkannya ke HTML Service memberi keuntungan kecil tetapi
> memaksa penyesuaian besar (file HTML harus di-inline, ES modules dari CDN perlu
> penyesuaian). Tidak sepadan kecuali Anda memang ingin semuanya di dalam Google.

## 3. Rekomendasi utama: GitHub Pages

Alasannya sederhana: gratis, HTTPS otomatis, cukup untuk file statis, dan karena
koneksi data memakai JSONP/CORS dari browser, **tidak ada server yang dibutuhkan sama
sekali**.

### 3.1 Siapkan repositori

1. Buat akun GitHub (kalau belum ada) di <https://github.com>.
2. Klik **New repository**. Nama saran: `content-planner-sekolah`.
3. Pilih **Public** (wajib untuk GitHub Pages di akun gratis).
4. Jangan centang "Add a README" (biar repo kosong), klik **Create repository**.

### 3.2 Unggah isi folder

Lewat terminal, dari folder aplikasi:

```bash
git init
git add .
git commit -m "Content Planner Sekolah Anak Saleh v1"
git branch -M main
git remote add origin https://github.com/<USERNAME>/content-planner-sekolah.git
git push -u origin main
```

Kalau tidak memakai Git, gunakan tombol **Add file → Upload files** di halaman repo,
lalu seret seluruh isi folder (bukan foldernya). Pastikan struktur tetap:
`index.html` harus berada di **akar repo**, bukan di dalam subfolder.

### 3.3 Aktifkan GitHub Pages

1. Buka repo → **Settings** → menu kiri **Pages**.
2. Bagian **Build and deployment**:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main`
   - **Folder**: `/(root)`
3. Klik **Save**.
4. Tunggu 1–3 menit, lalu muat ulang halaman Settings → Pages. URL akan muncul:

```text
https://<username>.github.io/content-planner-sekolah/
```

5. Buka URL tersebut. Bila tampil halaman aplikasi, deploy berhasil.

### 3.4 Tambahkan `.nojekyll`

GitHub Pages menjalankan Jekyll yang mengabaikan file/folder berawalan garis bawah
(mis. `_partials`, `_data`) dan kadang memperlambat proses.

1. Di akar repo, buat file baru bernama `.nojekyll` (tanpa ekstensi, isinya boleh kosong).
2. Commit dan push.

```bash
# membuat file kosong penanda
touch .nojekyll
git add .nojekyll
git commit -m "Nonaktifkan Jekyll"
git push
```

### 3.5 Domain sekolah sendiri (opsional)

Supaya aksesnya `planner.sekolahanaksaleh.sch.id`:

1. Di akar repo, buat file bernama `CNAME` berisi satu baris domain (tanpa `https://`):

```text
planner.sekolahanaksaleh.sch.id
```

2. Di penyedia domain/DNS sekolah, tambahkan record:

| Tipe | Nama | Nilai | TTL |
| --- | --- | --- | --- |
| CNAME | `planner` | `<username>.github.io` | 3600 |

3. Kembali ke **Settings → Pages → Custom domain**, isi domain yang sama, klik **Save**.
4. Tunggu pemeriksaan DNS (bisa 15 menit–24 jam), lalu centang **Enforce HTTPS**
   setelah sertifikat terbit.

> Bila memakai domain apex (`sekolahanaksaleh.sch.id` tanpa subdomain), GitHub
> memerlukan empat record `A` ke `185.199.108.153`, `185.199.109.153`,
> `185.199.110.153`, `185.199.111.153`. Untuk menghindari konflik dengan website
> sekolah yang sudah ada, gunakan subdomain.

### 3.6 Yang perlu diingat tentang repo publik

- **Kode aplikasi terlihat siapa pun.** Itu wajar untuk aplikasi statis.
- **Jangan menyimpan data sensitif di repo**: tidak ada daftar murid, nilai, nomor HP
  wali, atau file Excel internal. Data operasional hanya ada di Google Sheet.
- `SPREADSHEET_ID` memang ikut terlihat. Ini tidak berbahaya selama Sheet hanya
  dibagikan sebagai **Viewer** (tidak bisa diubah orang lain).
- `APPS_SCRIPT_URL` juga terlihat. Ingat risikonya dan terapkan mitigasi di
  [Setup Apps Script](02-setup-apps-script.md) bagian 9.

## 4. Alternatif drag-and-drop: Netlify

1. Buka <https://app.netlify.com/drop>.
2. Seret **folder aplikasi** ke area drop.
3. Netlify memberi URL acak seperti `https://cerah-berlian-12345.netlify.app`.
4. Ganti nama di **Site configuration → Site details → Change site name**.
5. Untuk pembaruan berikutnya: seret ulang foldernya, atau hubungkan ke repo GitHub
   lewat **Site configuration → Build & deploy → Link repository** (build command
   dikosongkan, publish directory = `/`).

## 5. Alternatif ramah Indonesia: Cloudflare Pages

1. Buat akun Cloudflare (gratis) → menu **Workers & Pages** → **Create** → **Pages**.
2. Pilih **Connect to Git**, pilih repo aplikasi.
3. Isi konfigurasi build:
   - **Framework preset**: `None`
   - **Build command**: (kosongkan)
   - **Build output directory**: `/`
4. Klik **Save and Deploy**. URL akan berbentuk `https://<project>.pages.dev`.
5. Domain kustom: **Custom domains → Set up a custom domain** (DNS otomatis bila
   domain sudah memakai Cloudflare).

> Cloudflare Pages menarik untuk sekolah di Indonesia karena CDN-nya punya titik
> presence di Jakarta, sehingga waktu muat lebih konsisten di jaringan seluler.

## 6. Alternatif cPanel sekolah (upload manual)

1. Minta admin hosting membuat subdomain, mis. `planner.sekolahanaksaleh.sch.id`,
   dengan **document root** tersendiri (mis. `public_html/planner`).
2. Buka **File Manager** → masuk ke folder document root tersebut.
3. Unggah semua file aplikasi (bisa berupa ZIP yang di-ekstrak di tempat).
   Pastikan `index.html` berada langsung di document root subdomain.
4. Aktifkan **HTTPS/SSL** (biasanya via AutoSSL/Let's Encrypt di cPanel).
   **Jangan publikasikan bila hanya tersedia HTTP** — embed sosial media dan Clipboard
   API akan gagal.
5. Uji: buka subdomain → pastikan aplikasi termuat dan halaman Pengaturan menampilkan
   indikator `gviz`.

## 7. Menjalankan lokal (untuk uji coba, bukan publikasi)

```bash
node scripts/serve.mjs
# lalu buka http://localhost:8000
```

Skrip ini adalah server Node tanpa dependensi (tanpa `npm install`). Untuk memastikan
parser Sheet dan rumus analitik masih benar setelah ada perubahan:

```bash
node scripts/selftest.mjs
```

Selftest menguji parser gviz/CSV, normalisasi record, dan perhitungan metrik. Jalankan
sebelum setiap deploy agar kesalahan rumus tidak sampai ke pengguna.

> **Jangan pernah** membuka `index.html` dengan klik dua kali (`file://`). ES modules
> akan gagal dimuat dan aplikasi tampil kosong.

## 8. Checklist pra-rilis

**Konfigurasi**
- [ ] `SPREADSHEET_ID`, `SHEET_NAME`, `APPS_SCRIPT_URL`, dan `SCHOOL_PROFILE` sudah benar.
- [ ] Sheet dibagikan **Anyone with the link = Viewer**.
- [ ] Apps Script (bila dipakai) sudah deploy ulang dengan versi terbaru.
- [ ] `node scripts/selftest.mjs` lulus tanpa kegagalan.

**Fungsi**
- [ ] Halaman Pengaturan menampilkan sumber data `gviz` atau `apps-script` — **bukan** `demo`.
- [ ] Mode demo mati: indikator tidak menunjukkan `demo`/`lokal` saat Sheet terisi.
- [ ] Kalender editorial menampilkan konten pada tanggal & jam yang benar.
- [ ] Halaman Analitik menghitung ER, save rate, share rate, click rate, dan skor konten.
- [ ] Heatmap waktu tayang terisi (butuh minimal beberapa konten berstatus `tayang`).
- [ ] Tombol **Ekspor CSV** menghasilkan file yang bisa dibuka di Excel/Sheets.
- [ ] Embed sosial media tampil untuk tautan YouTube & TikTok; Instagram/Facebook
      minimal tampil sebagai kartu tautan (keduanya memblokir CORS, lihat
      [Arsitektur](04-arsitektur.md) bagian batasan).
- [ ] Tombol salin caption/hashtag bekerja (butuh HTTPS).

**Perangkat & tampilan**
- [ ] Diuji dari **HP** (Android & iPhone): tata letak tidak terpotong, tombol mudah ditekan.
- [ ] Diuji di Chrome, Firefox, dan Safari.
- [ ] Favicon muncul di tab browser.
- [ ] Gambar OG (`og:image`) muncul saat tautan dibagikan ke WhatsApp.

**Performa**
- [ ] Ukur dengan Lighthouse (target: Performance & Accessibility ≥ 90).
- [ ] Ukur waktu muat di jaringan 4G lambat; GSAP dari CDN tidak menghambat render awal.
- [ ] Tidak ada error di Console browser saat aplikasi memuat.

**Keamanan & operasional**
- [ ] Tidak ada data pribadi sensitif di repo maupun di Sheet.
- [ ] URL `/exec` tidak dibagikan sembarangan.
- [ ] Satu staf ditunjuk sebagai PIC yang memantau revisi Sheet.

## 9. Catatan penting yang sering terlewat

1. **Jangan pakai `file://`** — ES modules butuh server; aplikasi akan tampak rusak.
2. **Selalu HTTPS** — tanpa itu embed sosial media diblokir dan clipboard tidak bekerja.
3. **Satu tempat saja.** Kalau menguji di dua URL (localhost dan GitHub Pages), pastikan
   keduanya memakai konfigurasi Sheet yang sama agar tidak bingung melihat data berbeda.
4. **Cache browser.** Setelah memperbarui file JS, lakukan hard refresh (Ctrl+F5) atau
   minta staf menutup tab lalu membuka lagi.
5. **Perbarui dengan urutan benar:** ubah kode → uji lokal → push/unggah → hard refresh →
   cek halaman Pengaturan.

Baca [Arsitektur](04-arsitektur.md) untuk memahami alur data, rumus analitik, dan batasan
aplikasi secara teknis.
