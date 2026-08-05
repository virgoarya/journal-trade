# Instruksi Perbaikan untuk Kilo Code

Halo **Kilo Code**, berikut adalah daftar tugas (*task*) perbaikan yang harus kamu kerjakan berdasarkan *feedback* dari user pada versi 1.0.8. Harap baca, pahami, dan implementasikan perbaikan berikut dengan cermat.

## 📝 Task 1: Perbaikan Tampilan Versi di UI
**Deskripsi Masalah:**
Saat ini di UI, angka versi tidak muncul di *header* (hanya menampilkan huruf "v" saja di sebelah ikon lonceng notifikasi). Selain itu, di bagian bawah *sidebar* terdapat tampilan versi yang *redundant* (ganda).
**Tujuan Perbaikan:**
- Cek komponen `Header` (kemungkinan di `frontend/src/components/layout/header.tsx`). Pastikan ia meng-import `package.json` yang benar dan mem-parsing *version string* dengan tepat sehingga tampil `v1.0.8`.
- Cek komponen `Sidebar` (`frontend/src/components/layout/sidebar.tsx`). Hapus tampilan versi di bagian bawah sidebar agar tidak ganda. Pastikan versi HANYA tampil di satu tempat (direkomendasikan di Header saja).

## ⚡ Task 2: Optimasi Performa Streaming Backtest (Tersendat-sendat)
**Deskripsi Masalah:**
Proses *streaming* data pada AI Strategy Tester (Backtest) terasa patah-patah atau tersendat-sendat saat simulasi berjalan. Ini kemungkinan disebabkan oleh intensitas *re-render* React yang terlalu tinggi akibat pembaruan *state* yang terlalu cepat dari WebSocket, atau kurangnya *throttling/batching* pada pengiriman data dari *backend*.
**Tujuan Perbaikan:**
- **Backend (`mt5-streamer.ts` / Backtest Engine):** Terapkan mekanisme *batching*. Daripada mengirim pembaruan via WebSocket setiap 1 *candle* (yang bisa memicu ribuan *event* per detik), kumpulkan *update* dalam *buffer* dan kirimkan setiap ~50ms - 100ms.
- **Frontend (React State):** Pastikan komponen grafik (Equity Curve) dan indikator angka tidak di-*render* secara *synchronous* setiap kali data baru masuk. Gunakan *throttle* atau fungsi *debouncing* (contoh: `lodash/throttle`) pada *handler* WebSocket, atau gunakan `requestAnimationFrame` untuk memperbarui grafik agar UI tidak macet.

## 🛡️ Task 3: Implementasi Hard Stop "Max Drawdown (Circuit Breaker)" 
**Deskripsi Masalah:**
Pada UI Backtest, terdapat opsi **Global Max Drawdown (Circuit Breaker) Hard Stop at: 10%** yang sudah dalam posisi ON. Namun, pada hasil simulasi, *Max DD* menembus angka **27.47%**. Ini berarti *backtest engine* mengabaikan parameter risiko perlindungan modal tersebut.
**Tujuan Perbaikan:**
- Telusuri sistem *Backtest Engine* (kemungkinan di *service* backend Python atau Node.js yang menangani perulangan/simulasi historis).
- Ambil nilai dari pengaturan `Global Max Drawdown` (misalnya 10%).
- Pada setiap iterasi *candle*/waktu, hitung *floating Equity* vs *Peak Equity* (Modal Tertinggi).
- **Logika Circuit Breaker:** Jika `((Peak Equity - Current Equity) / Peak Equity) * 100` >= `10%`, maka:
  1. Tutup paksa seluruh posisi (Trade) yang terbuka pada saat itu.
  2. Hentikan (*halt*) total seluruh eksekusi strategi AI untuk hari/periode tersebut sesuai aturan Circuit Breaker.
  3. Pastikan angka metrik hasil akhir *Max DD* tidak akan melebihi angka toleransi 10% (karena simulasi langsung memotong kerugian).

---

**Panduan Eksekusi:**
- Selalu periksa ekstensi dan struktur direktori melalui perintah terminal atau alat baca file sebelum melakukan modifikasi (Gunakan *Grep* / *Find* untuk melokalisasi *bug*).
- Setelah selesai, jalankan kompilasi (*build*) ringan jika diperlukan untuk memverifikasi tidak ada *Syntax Error*.
- Laporkan kembali dengan menyertakan ringkasan perubahan yang dilakukan!
