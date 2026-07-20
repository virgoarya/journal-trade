# Rules & Workflow: Hunter Trades Journal

> File ini adalah **hukum yang wajib dipatuhi** oleh Agent Kilo Code saat bekerja di project ini.
> Baca file ini DAN `MEMORY.md` DAN `LESSONS.md` sebelum mengerjakan task apapun.

---

## 🌐 Bahasa & Komunikasi

- **WAJIB** berkomunikasi dengan user menggunakan **Bahasa Indonesia**.
- Gunakan terminologi teknis dalam Bahasa Inggris (misal: "websocket", "bug", "deploy") namun kalimat utama harus Bahasa Indonesia.
- Panggil user dengan "Bang Vir" atau "Bang".

---

## 📋 Planning Mode (Sebelum Mengerjakan Tugas Kompleks)

Sebelum menulis kode untuk tugas yang kompleks atau menyentuh lebih dari 1 file:

1. **Baca `MEMORY.md`** — Pahami arsitektur saat ini.
2. **Baca `LESSONS.md`** — Cek apakah area yang akan diubah pernah bermasalah sebelumnya.
3. **Buat rencana kerja** (Plan) dan tunjukkan ke user sebelum eksekusi.
4. **Tunggu persetujuan** dari user sebelum mulai menulis kode.
5. Jika menemukan *root cause* yang tidak terduga saat eksekusi, **update rencana** dan minta persetujuan ulang.

Tugas yang tergolong kompleks:
- Perubahan arsitektur (mengubah cara komunikasi antar-service)
- Mengubah schema Prisma
- Menambah endpoint API baru
- Perubahan yang menyentuh lebih dari 3 file
- Mengubah cara autentikasi

---

## 🎓 Self-Learning & Continuous Improvement

**Agent WAJIB belajar dari setiap kesalahan:**

1. Ketika menemukan bug atau error yang tidak terduga, **jangan langsung patch** tanpa memahami root cause.
2. Setelah berhasil memperbaiki masalah, **WAJIB menulis lesson baru** di `LESSONS.md` dengan format yang sudah ada.
3. Sebelum mengerjakan area yang pernah bermasalah, **baca lesson terkait** untuk memastikan kesalahan yang sama tidak terulang.
4. Jika pola masalah yang sama muncul dua kali, ini tanda ada **desain yang perlu diperbaiki** — eskalasikan ke user dan buat rencana perbaikan arsitektur.

---

## 🔧 Standar Kode

- **Pertahankan komentar yang ada**: Jangan hapus komentar atau docstring yang tidak berkaitan dengan perubahan yang sedang dilakukan.
- **Jangan duplikasi**: Selalu cek apakah fungsi atau komponen serupa sudah ada sebelum membuat yang baru.
- **TypeScript strict**: Semua kode TypeScript harus memiliki type yang eksplisit. Hindari `any` kecuali benar-benar tidak ada pilihan lain.
- **Error handling**: Setiap fungsi async HARUS memiliki try/catch atau error propagation yang jelas.

---

## 🎨 Standar UI/UX (Design System: Terminal Noir)

- **Tema**: Dark background (`#121212`, `#1E1E1E`), Gold accent (`#D4AF37`).
- **Font**: Gunakan Google Fonts (Inter, Roboto, atau Outfit). Jangan gunakan font browser default.
- **Animasi**: Tambahkan micro-animation pada hover effects untuk membuat UI terasa premium dan responsif.
- **Referensi Skill**: Baca file `skills/frontend-ui-engineering.md` untuk panduan lebih detail.

---

## 🐍 Standar Python Client

- Python client menggunakan `asyncio` dan `websockets`.
- Selalu jalankan asyncio loop di **background thread** agar GUI tidak freeze.
- Gunakan `sys.stdout = PrintRedirector(...)` agar semua print terredirect ke GUI log.
- Saat melakukan build EXE, **SELALU** gunakan flag `-y` pada PyInstaller.
- Referensi Skill: Baca file `skills/backend-websocket-rpc.md` untuk panduan koneksi.

---

## ✅ Checklist Sebelum Selesai

Sebelum menyatakan task selesai, cek hal-hal berikut:

- [ ] Kode sudah tidak ada TypeScript/Python error?
- [ ] Tidak ada `console.log` atau `print` debug yang tertinggal?
- [ ] Apakah ada lesson baru yang perlu ditambahkan di `LESSONS.md`?
- [ ] Apakah MEMORY.md perlu diupdate dengan perubahan arsitektur terbaru?
