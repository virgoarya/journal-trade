# Skill: Debugging & Error Recovery

> Panduan sistematis untuk menemukan root cause sebelum menulis satu baris pun kode perbaikan.
> WAJIB dibaca setiap kali ada error yang tidak langsung jelas penyebabnya.

---

## Aturan Utama: JANGAN Menebak

> "Debugging yang baik adalah menyelidiki, bukan menebak."

Sebelum mengubah kode apapun, **kamu HARUS bisa menjawab**: *"Kenapa baris ini error, dan bukan baris lain?"*

---

## Langkah Sistematis Debugging

### Step 1: Baca error dengan teliti
- Baca pesan error SELURUHNYA, bukan hanya baris pertama.
- Identifikasi: file, baris, tipe error.
- Cek stack trace untuk menemukan titik awal masalah (bukan hanya tempat crash).

### Step 2: Cek LESSONS.md
```
Apakah error atau area ini pernah bermasalah sebelumnya?
Baca file `.kilo/LESSONS.md` untuk referensi.
```

### Step 3: Reproduksi masalah
- Apakah error ini terjadi konsisten atau hanya kadang-kadang?
- Kondisi apa yang memicunya?
- Apakah error ini baru muncul setelah ada perubahan kode tertentu?

### Step 4: Isolasi
- Buat hipotesis root cause berdasarkan bukti yang ada.
- Sempitkan lingkup: apakah masalahnya di Frontend, Backend, Python Client, atau koneksi antar-service?
- Cek log server Railway, bukan hanya log di local.

### Step 5: Perbaiki dengan bukti
- Setelah root cause teridentifikasi, buat perbaikan minimal yang menarget masalah tersebut.
- Jangan melakukan "big bang" — ganti satu hal sekaligus lalu verifikasi.

### Step 6: Verifikasi & Dokumentasi
- Pastikan fix benar-benar menyelesaikan masalah.
- **WAJIB**: Tambahkan lesson baru di `LESSONS.md`.
- Jika fix mempengaruhi arsitektur, update `MEMORY.md`.

---

## Cheat Sheet Error Umum di Project Ini

| Error | Area | Cek Ini Dulu |
|-------|------|--------------|
| `TypeError: fetch failed` | WebSocket/Network | TLS? Ngrok? Pakai SSE? → Baca lesson 20260719 |
| `webidl.util.markAsUncloneable` | Node.js | Versi `undici`? → Hapus undici, baca lesson 20260720 |
| Build PyInstaller stuck | Python Build | Flag `-y` ada? → Baca lesson 20260720 |
| `MT5 connection failed` | Python/MT5 | MT5 terminal terbuka? Login benar? |
| `PrismaClientKnownRequestError` | Database | Migration up to date? `npx prisma migrate dev`? |
| `NextAuth session undefined` | Auth | Cookie domain? `NEXTAUTH_URL` env var set? |

---

## Template Menambah Lesson Baru

Setelah menyelesaikan bug, tambahkan ke `LESSONS.md`:

```markdown
### [YYYYMMDD] Judul Singkat Masalah
**Area**: [Frontend / Backend / Python Client / WebSocket / Prisma / Deployment]
**Root Cause**: Penjelasan singkat akar masalah yang sebenarnya.
**Solusi**: Apa yang dilakukan untuk memperbaikinya.
**Hindari**: Hal yang TIDAK boleh dilakukan lagi.
```
