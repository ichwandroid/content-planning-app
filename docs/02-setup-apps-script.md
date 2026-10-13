# 02 — Setup Apps Script (Menulis ke Sheet dari Aplikasi)

Panduan ini melengkapi [Setup Google Sheet](01-setup-google-sheet.md). Setelah selesai,
Anda bisa **menambah, mengubah, dan menghapus konten langsung dari aplikasi**, dan
perubahannya tersimpan ke Google Sheet.

Perkiraan waktu: **10–15 menit**. Semua dikerjakan lewat browser.

**Prasyarat:** langkah 1–10 di [Setup Google Sheet](01-setup-google-sheet.md) sudah
selesai (Sheet punya tab `Content`, header 26 kolom, dan sudah dibagikan sebagai Viewer).

> **Boleh dilewati?** Boleh. Tanpa Apps Script, aplikasi tetap bisa membaca Sheet,
> menghitung analitik, dan mengekspor CSV. Yang hilang hanyalah kemampuan menyimpan
> dari dalam aplikasi (tombol Simpan/Hapus).

---

## 1. Kenapa perlu Apps Script?

Google Sheet publik hanya bisa **dibaca** dari browser. Untuk **menulis**, dibutuhkan
"pintu" yang berjalan di server Google. Apps Script Web App adalah pintu itu, dan
gratis dengan kuota harian yang jauh lebih dari cukup untuk kebutuhan satu sekolah.

| Kebutuhan | Tanpa Apps Script | Dengan Apps Script |
| --- | --- | --- |
| Baca data & analitik | ✅ | ✅ |
| Tambah/ubah/hapus dari aplikasi | ❌ (hanya diedit manual di Sheet) | ✅ |
| Ekspor CSV | ✅ | ✅ |
| Mode demo/offline | ✅ | ✅ |

## 2. Buka editor Apps Script

1. Buka Spreadsheet database konten Anda.
2. Menu **Extensions → Apps Script**.
3. Tab baru terbuka dengan file `Code.gs` yang berisi fungsi kosong
   `function myFunction() {}`.
4. Klik nama proyek di kiri atas (bawaan: "Untitled project") → ganti menjadi
   `Content Planner Backend` → **Rename**.

> Apps Script yang dibuka lewat **Extensions** otomatis terikat ke Spreadsheet ini.
> Jangan membuat proyek baru dari <script.google.com> secara terpisah, karena harus
> menempelkan `SPREADSHEET_ID` manual dan lebih mudah salah.

## 3. Tempel isi `apps-script/Code.gs`

1. Buka file `apps-script/Code.gs` dari folder aplikasi dengan Notepad/VS Code.
2. **Pilih seluruh isinya** (Ctrl+A), lalu **Copy** (Ctrl+C).
3. Kembali ke editor Apps Script. Klik di dalam editor `Code.gs`, tekan **Ctrl+A**
   untuk memilih semua kode contoh, lalu **tempel** (Ctrl+V).
4. Tekan **Ctrl+S** (Save). Ikon simpan di toolbar juga bisa dipakai.
5. Pastikan tidak ada tulisan merah di bawah kode. Kalau ada, berarti ada bagian yang
   terpotong saat menyalin — ulangi langkah 1–4.

File `Code.gs` berisi dua pintu masuk yang dipakai aplikasi:

| Fungsi | Dipanggil dengan | Kegunaan |
| --- | --- | --- |
| `doGet(e)` | `?action=list&sheet=Content&callback=...` | Membaca data dalam bentuk JSONP — dipakai sebagai jalur baca cadangan dan untuk memverifikasi tulisan |
| `doPost(e)` | `POST` dengan body JSON | Menerima perintah tulis: `save`, `delete`, `bulk`, dan `ping` |

Contoh perintah yang dikirim aplikasi (body POST berupa teks JSON biasa):

```js
// Content-Type: text/plain;charset=utf-8  -> "simple request", tidak memicu preflight CORS
{ "action": "save",   "sheet": "Content", "record": { "id": "ct-8f3a1", "judul": "Reels prestasi", "views": 12500 } }
{ "action": "delete", "sheet": "Content", "id": "ct-8f3a1" }
{ "action": "bulk",   "sheet": "Content", "records": [ { "id": "ct-1" }, { "id": "ct-2" } ] }
{ "action": "ping",   "sheet": "Content" }
```

## 4. Jalankan `setup()` sekali (opsional tetapi disarankan)

Sebagian versi `Code.gs` menyediakan fungsi `setup()` yang membuat baris header otomatis
dan memastikan tab `Content` tersedia.

1. Di editor Apps Script, buka daftar fungsi di toolbar (dropdown di samping tombol Run).
2. Kalau **`setup`** ada di daftar: pilih `setup` → klik **Run**.
3. Google akan meminta izin pada pemakaian pertama:
   - **Review permissions** → pilih akun sekolah Anda.
   - Muncul peringatan "Google hasn't verified this app" → klik **Advanced** →
     **Go to Content Planner Backend (unsafe)**. Aman, karena kode ini milik Anda
     sendiri dan tidak dibagikan ke pihak lain.
   - Klik **Allow**.
4. Tunggu sampai muncul "Execution completed" di bagian bawah.
5. Buka Spreadsheet → tab `Content` → pastikan baris 1 sudah berisi 26 header.

Kalau **`setup` tidak ada** di daftar fungsi (berarti file Anda tidak menyediakannya),
verifikasi manual saja:

1. Pastikan tab `Content` ada dan baris 1 sudah berisi 26 header sesuai
   [Setup Google Sheet](01-setup-google-sheet.md) langkah 3.
2. Pilih fungsi `doGet` → **Run** untuk memicu dialog izin (hasil eksekusi bisa
   berisi error karena `e` kosong — itu normal dan tidak masalah).
3. Klik **Allow** seperti langkah 3 di atas. Izin inilah yang sebenarnya dibutuhkan.

> Setelah izin diberikan sekali, Anda **tidak perlu** mengulanginya lagi.

## 5. Deploy sebagai Web App

1. Klik tombol biru **Deploy** (kanan atas) → **New deployment**.
2. Klik ikon gerigi di samping "Select type" → pilih **Web app**.
3. Isi kolom:
   - **Description**: `Content Planner Web App v1`
   - **Execute as**: **Me (email sekolah Anda)** — wajib, agar script punya izin
     menulis ke Sheet Anda.
   - **Who has access**: **Anyone** — wajib, agar browser bisa mengirim data tanpa
     login Google.
4. Klik **Deploy**.
5. Salin **Web app URL**. Bentuknya seperti ini dan **harus diakhiri `/exec`**:

```text
https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/exec
```

> Jangan memakai URL yang berakhiran `/dev`. URL `/dev` hanya bisa dibuka oleh pemilik
> script dan akan meminta login Google saat dipakai aplikasi.

## 6. Tempel URL ke `js/core/config.js`

Buka `js/core/config.js`, ganti nilai `APPS_SCRIPT_URL`:

```js
export const DB = Object.freeze({
  SPREADSHEET_ID: '1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890',
  SHEET_NAME: 'Content',
  CTA_SHEET_NAME: 'CTA',
  /** URL Web App Apps Script yang diakhiri /exec */
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycb.../exec',
  TIMEOUT: 15000,
});
```

Simpan file. Aplikasi menganggap URL valid bila berpola
`https://script.google.com/.../exec` (atau `script.googleusercontent.com`). URL yang
salah bentuk akan dianggap belum dikonfigurasi, dan tombol simpan otomatis kembali
menyimpan ke penyimpanan lokal browser.

## 7. Uji dengan "Tes Koneksi Tulis"

1. Buka aplikasi → menu **Pengaturan**.
2. Cari tombol **Tes Koneksi Tulis** (menjalankan perintah `ping`), lalu klik.
3. Buka Google Sheet dan lihat hasilnya:
   - Berhasil: muncul baris/penanda uji (mis. baris dengan Judul `TES KONEKSI` atau
     keterangan ping pada tab/log yang disiapkan `Code.gs`).
   - Gagal: aplikasi menampilkan pesan kesalahan; lanjut ke Troubleshooting.
4. Setelah itu, coba alur nyata: buat satu konten baru di halaman **Perencana**, klik
   **Simpan**, lalu periksa apakah barisnya muncul di Sheet (boleh perlu 1–2 kali
   sinkronisasi, lihat bagian 9).

## 8. Cara kerja teknis (ringkas)

Fungsi `api` di `js/data/sheet.js` mengirim perintah tulis seperti ini:

```js
await fetch(DB.APPS_SCRIPT_URL, {
  method: 'POST',
  mode: 'no-cors',                                   // respons dibaca sebagai "opaque"
  headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // menghindari preflight OPTIONS
  body: JSON.stringify({ action: 'save', sheet: 'Content', record }),
});
```

Konsekuensi yang perlu dipahami:

- `Content-Type: text/plain` membuat permintaan tergolong **simple request**, sehingga
  browser **tidak** mengirim permintaan preflight `OPTIONS`. Ini yang membuat POST ke
  Apps Script berhasil dari halaman statis.
- `mode: 'no-cors'` berarti **isi respons tidak bisa dibaca**. Aplikasi tidak tahu pasti
  apakah penulisan sukses; karena itu ada langkah verifikasi.
- Verifikasi dilakukan dengan membaca ulang lewat `doGet ?action=list` (JSONP) beberapa
  kali dengan jeda. Kalau data belum terlihat, aplikasi menyimpannya lebih dulu di
  browser dan menandainya sebagai perubahan tertunda.

## 9. Keamanan — baca bagian ini

**Siapa pun yang mengetahui URL `/exec` dapat menulis ke Sheet Anda.** Tidak ada
username/password pada Web App bertipe "Anyone". Ini konsekuensi wajar dari pendekatan
tanpa OAuth, dan risikonya perlu dikelola, bukan diabaikan.

Risiko nyata:
- Orang lain bisa menambah, mengubah, atau menghapus baris di tab `Content`.
- URL bisa tersebar lewat repositori GitHub publik, screenshot, atau grup WhatsApp.

Mitigasi yang disarankan (pilih sesuai kebutuhan):

1. **Token rahasia.** Tambahkan kunci acak panjang di `Code.gs`, mis.
   `const TOKEN = 'rahasia-sekolah-2026-xyz';`, dan **wajibkan** setiap `doPost`
   memeriksa `body.token === TOKEN` sebelum memproses. Simpan token yang sama di
   `js/core/config.js` sebagai konstanta terpisah. Sadari batasannya: pada aplikasi
   statis, token tetap bisa dilihat orang yang membuka "View Source" — jadi ini hanya
   menaikkan hambatan, bukan mengunci rapat.
2. **Batasi ke sheet tertentu.** Di `Code.gs`, tolak `action` yang menargetkan nama tab
   di luar daftar putih (mis. hanya `Content` dan `CTA`), dan jangan sediakan operasi
   yang menyentuh seluruh spreadsheet.
3. **Jangan bagikan URL.** Perlakukan URL `/exec` seperti password. Hindari
   menempelkannya di grup publik atau komentar media sosial.
4. **Pantau riwayat revisi.** Di Spreadsheet: **File → Version history → See version
   history**. Periksa berkala; setiap perubahan tercatat lengkap dengan akun pelakunya.
5. **Rotasi URL bila bocor.** Apps Script → **Deploy → Manage deployments** → pilih
   deployment → **Archive**, lalu buat **New deployment** baru dan perbarui
   `APPS_SCRIPT_URL`. URL lama langsung mati.
6. **Jangan simpan data sensitif.** Data pribadi murid/wali tidak boleh ada di Sheet ini,
   karena Sheet dibagikan sebagai Viewer publik.

## 10. Troubleshooting

### "Script function not found: doPost"
- Penyebab: `Code.gs` belum berisi fungsi `doPost(e)`, atau penempelan kode terpotong.
- Solusi: ulangi langkah 3, pastikan seluruh isi file tersalin, simpan (Ctrl+S), lalu
  **deploy ulang** (lihat di bawah). Perubahan kode **tidak** otomatis aktif pada
  deployment yang sudah ada.

### Masih muncul halaman login Google saat aplikasi mengirim data
- Berarti **Who has access** bukan **Anyone**. Ulangi langkah 5 poin 3.
- Pastikan pula **Execute as: Me** — bukan "User accessing the web app", karena mode itu
  mewajibkan setiap pengguna login.
- Kalau URL-nya berakhiran `/dev`, ganti ke URL `/exec`.

### Perubahan kode/Sheet tidak muncul setelah deploy
- Apps Script memakai versi snapshot. Setelah mengubah `Code.gs`:
  **Deploy → Manage deployments → ikon pensil → Version: New version → Deploy**.
- Untuk sekadar mengubah isi Sheet, tidak perlu deploy ulang.
- Cache gviz di sisi Google butuh 1–5 menit. Tunggu, lalu klik **Sinkron**.

### Error CORS / "Failed to fetch" saat menyimpan
- Pastikan URL memakai `https://` dan berakhiran `/exec`.
- Pastikan header permintaan tetap `Content-Type: text/plain`. Kalau aplikasi diubah
  memakai `application/json`, browser akan mengirim preflight `OPTIONS`, dan Apps Script
  Web App tidak menangani `OPTIONS` sehingga permintaan gagal.
- Kegagalan jaringan sesaat adalah hal biasa pada mode `no-cors`; aplikasi menyimpan
  perubahan secara lokal. Klik **Sinkron** lagi setelah koneksi stabil.

### Data terkirim tetapi tidak masuk Sheet
- Periksa apakah `Code.gs` memakai nama tab yang benar (`e.parameter.sheet` atau body
  `sheet`). Nama tab salah → script menulis ke tab yang tidak ada.
- Periksa apakah `action` yang dikirim termasuk yang ditangani (`save`, `delete`,
  `bulk`, `ping`). Action tak dikenal harus ditolak dengan pesan error yang jelas.
- Periksa kuota: **Extensions → Apps Script → Executions** untuk melihat riwayat
  pemanggilan beserta errornya.

### Muncul "Authorization required" saat `doGet` dipanggil
- Jalankan ulang `setup()` (atau fungsi apa pun) dari editor dan setujui izin.
- Pastikan akun yang menjalankan script adalah pemilik Spreadsheet.

## 11. Checklist akhir

- [ ] `Code.gs` berisi seluruh isi file dari repo dan sudah disimpan.
- [ ] Fungsi `setup()` (bila tersedia) sudah dijalankan sekali dan izin disetujui.
- [ ] Deployment: **Execute as: Me**, **Who has access: Anyone**, URL berakhiran `/exec`.
- [ ] `APPS_SCRIPT_URL` di `js/core/config.js` sudah diperbarui.
- [ ] **Tes Koneksi Tulis** berhasil dan buktinya terlihat di Sheet.
- [ ] Tombol Simpan/Hapus di aplikasi benar-benar mengubah isi Sheet.
- [ ] URL `/exec` tidak dipublikasikan; token rahasia dipertimbangkan.
- [ ] Riwayat revisi Sheet dipantau berkala.

Lanjutkan ke [Panduan Deploy](03-deploy.md) untuk mempublikasikan aplikasi, atau baca
[Arsitektur](04-arsitektur.md) bila ingin memahami alur data secara teknis.
