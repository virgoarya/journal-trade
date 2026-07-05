# Hunter Trades API Reference Documentation

Seluruh endpoint API backend Hunter Trades memiliki base URL `/api/v1/` kecuali untuk routes autentikasi `/api/auth/`. 
Semua endpoint berlabel **[Auth Required]** membutuhkan session cookie valid dari Better Auth (Discord OAuth).

---

## 🔑 1. Autentikasi (Better Auth & Guild Verification)
Mengurus sesi login user dan memverifikasi keanggotaan di server Discord Hunter Trades.

- `POST /api/auth/*`
  - Endpoint internal Better Auth (login, callback, session, logout).
- `GET /api/v1/auth/verify-guild` **[Auth Required]**
  - Memverifikasi apakah user yang login memiliki keanggotaan aktif di Discord Guild Hunter Trades (berdasarkan `DISCORD_GUILD_ID`).

---

## 🏦 2. Trading Accounts (`/api/v1/trading-accounts`)
Mengelola akun-akun trading MetaTrader atau broker manual yang didaftarkan user.

- `GET /` **[Auth Required]**
  - Mengambil daftar semua akun trading milik user.
- `GET /active` **[Auth Required]**
  - Mengambil detail akun trading yang saat ini diset sebagai aktif.
- `POST /` **[Auth Required]**
  - Mendaftarkan akun trading baru.
- `PATCH /:id` **[Auth Required]**
  - Memperbarui detail akun trading (nama, tipe, saldo).
- `PATCH /:id/set-active` **[Auth Required]**
  - Menetapkan akun tertentu sebagai akun utama/aktif.
- `PATCH /:id/risk-rules` **[Auth Required]**
  - Memperbarui aturan manajemen risiko akun (max drawdown, daily loss limit, max leverage).
- `POST /:id/generate-api-key` **[Auth Required]**
  - Membuat API key baru untuk koneksi eksternal broker.
- `DELETE /:id` **[Auth Required]**
  - Menghapus akun trading dari sistem.

---

## 📊 3. Trades Ledger (`/api/v1/trades`)
Pencatatan journal trade secara manual atau hasil sinkronisasi otomatis.

- `GET /` **[Auth Required]**
  - Mengambil daftar semua trade dengan filter (tanggal, status, pair, playbook).
- `GET /recent` **[Auth Required]**
  - Mengambil daftar trade terbaru (biasanya 5-10 trade terakhir).
- `GET /summary` **[Auth Required]**
  - Mengambil ringkasan statistik (Win Rate, Profit Factor, R-Multiple, Expectancy).
- `GET /deleted` **[Auth Required]**
  - Tempat Sampah / Recycle Bin untuk melihat trade yang di-soft delete.
- `GET /:id` **[Auth Required]**
  - Mengambil detail lengkap satu trade tertentu.
- `POST /` **[Auth Required]**
  - Mencatat trade baru secara manual.
- `PATCH /:id` **[Auth Required]**
  - Memperbarui informasi trade (catatan, screenshot, emotional state, setup).
- `PATCH /:id/restore` **[Auth Required]**
  - Memulihkan trade yang sebelumnya di-soft delete.
- `DELETE /:id` **[Auth Required]**
  - Memindahkan trade ke Recycle Bin (Soft Delete).
- `DELETE /:id/permanent` **[Auth Required]**
  - Menghapus trade secara permanen dari database.

---

## ⚙️ 4. User Settings (`/api/v1/settings`)
Konfigurasi preferensi user dan operasi data destruktif.

- `GET /` **[Auth Required]**
  - Mengambil konfigurasi user (tema, notifikasi, dll). Otomatis membuat setelan default jika belum ada.
- `PATCH /` **[Auth Required]** **[Validated via Zod]**
  - Memperbarui preferensi tampilan (`appearance`) atau notifikasi (`notifications`).
- `GET /profile` **[Auth Required]**
  - Mengambil data profil user Discord yang sedang login.
- `GET /export/csv` **[Auth Required]**
  - Mendownload seluruh riwayat trade user dalam format file CSV.
- `POST /reset-data` **[Auth Required]**
  - **[DESTRUKTIF]** Menghapus seluruh data trade, akun, playbook, dan review AI milik user untuk mereset akun.

---

## 📈 5. Analytics Dashboard (`/api/v1/analytics`)
Data agregasi performa trading untuk divisualisasikan dalam chart dan grafik.

- `GET /overview` **[Auth Required]**
  - Data statistik ringkas performa trading akun aktif.
- `GET /monthly-pnl` **[Auth Required]**
  - Akumulasi profit/loss bulanan.
- `GET /weekly` **[Auth Required]**
  - Akumulasi profit/loss mingguan.
- `GET /sessions` **[Auth Required]**
  - Analisis performa berdasarkan sesi trading pasar (Asia, London, New York).
- `GET /heatmap` **[Auth Required]**
  - Heatmap performa trading berdasarkan Hari vs Jam.
- `GET /equity-curve` **[Auth Required]**
  - Kumpulan titik koordinat saldo akun historis untuk menggambar kurva ekuitas.
- `GET /risk-status` **[Auth Required]**
  - Status pematuhan terhadap batasan risiko akun (apakah melanggar daily loss limit, dll).

---

## 🌍 6. Macro Regime (`/api/v1/macro-regime`)
Klasifikasi kondisi pasar makroekonomi global saat ini.

- `GET /snapshot`
  - Mendapatkan status klasifikasi regime makroekonomi saat ini (Goldilocks, Reflation, Stagflation, Deflation, atau Transition) menggunakan rasio ETF dan tren EMA-50.
- `GET /historical`
  - Mengambil riwayat perubahan regime makro dari waktu ke waktu.

---

## 🕸️ 7. Nexus Core (`/api/v1/nexus`)
Skoring kesehatan kondisi finansial global berdasarkan pembobotan multi-dimensi.

- `GET /snapshot`
  - Mengambil skor Nexus saat ini (Financial Conditions Index agregat).
- `POST /refresh`
  - Memaksa server memproses ulang perhitungan skor Nexus terbaru.

---

## 🧪 8. Quant Lab (`/api/v1/quant`)
Data analisis kuantitatif suku bunga, likuiditas, dan struktur volatilitas.

- `GET /snapshot`
  - Mengambil data Yield Curve (10Y-2Y spread), ON RRP (Overnight Reverse Repurchase) balance, dan Fed Net Liquidity.
- `POST /refresh` **[Auth Required]**
  - Memaksa penarikan data baru dari FRED API.
- `GET /vix`
  - Data struktur volatilitas VIX untuk analisis momentum ketakutan pasar.

---

## 🧠 9. Macro AI (`/api/v1/macro-ai`)
Interaksi kecerdasan buatan berbasis konteks pasar real-time.

- `POST /chat` **[Auth Required]**
  - Mengirim prompt ke asisten AI Makro Hunter Trades yang dilengkapi data terkini dari Nexus, Quant Lab, dan Geo Risk.
- `POST /analyze-regime` **[Auth Required]**
  - Meminta analisis AI mendalam tentang transisi regime makro saat ini.
- `POST /analyze-macro-feed` **[Auth Required]**
  - Menganalisis feed berita ekonomi global terbaru secara massal menggunakan AI.
- `POST /analyze-nexus` **[Auth Required]**
  - Menginstruksikan AI menyusun laporan narasi ringkas mengenai kondisi finansial (Nexus).

---

## 🔌 10. MetaTrader 5 Gateway (`/api/v1/mt5`)
Integrasi dengan program MetaTrader 5 lokal/VPS untuk auto-sync trade.

- `GET /status` **[Auth Required]**
  - Cek apakah gateway MT5 sedang terhubung dan melihat detail lisensi/koneksi terminal.
- `GET /positions` **[Auth Required]**
  - Mengambil posisi trading aktif saat ini yang sedang berjalan di terminal MT5.
- `POST /connect` **[Auth Required]**
  - Memulai jabat tangan (handshake) dan mengaktifkan koneksi ke MT5.
- `POST /disconnect` **[Auth Required]**
  - Memutuskan koneksi secara aman dari MT5 gateway.
- `PATCH /settings` **[Auth Required]**
  - Mengubah opsi sinkronisasi otomatis (apakah sync on close, sync on open, filter instrumen).
- `POST /sync` **[Auth Required]**
  - Memicu penarikan data transaksi historis dari MT5 untuk diimpor ke jurnal.

---

## 🧐 11. AI Trade Reviews (`/api/v1/ai-reviews`)
Review psikologi trading berbasis kecerdasan buatan (seperti psikolog trading pribadi).

- `GET /` **[Auth Required]**
  - Melihat semua riwayat review AI yang telah digenerate.
- `GET /:id` **[Auth Required]**
  - Mengambil detail satu review AI tertentu.
- `GET /trade/:tradeId` **[Auth Required]**
  - Mengambil review AI yang dikaitkan ke ID trade tertentu.
- `POST /generate/:id` **[Auth Required]**
  - Menghasilkan review psikologi baru untuk trade dengan ID tertentu (AI menganalisis emosi, waktu masuk sesi, kepatuhan aturan, dan pnl).
- `DELETE /:id` **[Auth Required]**
  - Menghapus satu review AI.
- `DELETE /clear-all` **[Auth Required]**
  - Menghapus seluruh riwayat review AI milik user.

---

## 📔 12. Strategy Playbooks (`/api/v1/playbooks`)
Pengelolaan aturan strategi trading/playbook milik user.

- `GET /` **[Auth Required]**
  - Mengambil semua strategi/playbook trading milik user.
- `GET /:id` **[Auth Required]**
  - Mengambil detail satu playbook (deskripsi, parameter, checklist aturan).
- `POST /` **[Auth Required]**
  - Membuat playbook strategi baru.
- `PATCH /:id` **[Auth Required]**
  - Mengubah aturan, checklist, atau parameter dalam playbook.
- `DELETE /:id` **[Auth Required]**
  - Menghapus playbook.
- `POST /:id/duplicate` **[Auth Required]**
  - Menggandakan (clone) playbook yang ada untuk variasi strategi.
- `POST /:id/assign-trade` **[Auth Required]**
  - Menghubungkan trade tertentu ke playbook ini untuk evaluasi kepatuhan.

---

## 📰 13. Market Data (`/api/v1/market-data`)
Endpoint penyedia feed berita, kalender, dan sentimen pasar global.

- `GET /news`
  - RSS feed berita ekonomi makro terbaru (Bloomberg, Reuters, Zerohedge).
- `GET /tga`
  - Mengambil data Treasury General Account (kas pemerintah AS) historis.
- `GET /quotes`
  - Mengambil kuotasi harga real-time 28 instrumen yang terkonfigurasi.
- `GET /liquidity`
  - Perkiraan Net Liquidity Federal Reserve saat ini.
- `GET /economic-calendar`
  - Kalender rilis data ekonomi krusial (CPI, NFP, FOMC) minggu ini.
- `GET /cot`
  - Mengambil data Commitment of Traders (posisi institusi/spekulan komoditas/valas).
- `POST /cot/analyze`
  - Meminta AI menganalisis data CFTC COT untuk komoditas tertentu.
- `POST /liquidity/mock-trigger` **[Auth Required]**
  - Endpoint pengujian untuk menyimulasikan injeksi likuiditas federal secara lokal.

---

## 🔔 14. User Notifications (`/api/v1/notifications`)
Pengiriman dan pelacakan notifikasi real-time di antarmuka web.

- `GET /` **[Auth Required]**
  - Mendapatkan semua riwayat notifikasi user.
- `GET /unread-count` **[Auth Required]**
  - Menghitung jumlah notifikasi yang belum dibaca.
- `POST /` **[Auth Required]**
  - Membuat/mengirim notifikasi custom (untuk integrasi internal).
- `PUT /read-all` **[Auth Required]**
  - Menandai semua notifikasi milik user sebagai sudah dibaca.
- `PUT /:id/read` **[Auth Required]**
  - Menandai satu notifikasi sebagai sudah dibaca.
- `DELETE /:id` **[Auth Required]**
  - Menghapus notifikasi.

---

## 🔭 15. Macro AI Observer (`/api/v1/macro-ai-observer`)
Agen pemantau berkala yang mengamati sinyal trading.

- `POST /`
  - Memicu siklus observasi playbook terhadap parameter pasar makro secara berkala.
- `POST /clear-cache`
  - Mengosongkan data cache pemantau makro.

---

## 🌋 16. Geo Risk (`/api/v1/geo-risk`)
Dashboard indeks ketegangan geopolitik global.

- `GET /`
  - Mengambil skor risiko geopolitik global terkini (misal perang dagang, ketegangan teritorial, sanksi).
- `POST /refresh` **[Auth Required]**
  - Memaksa penarikan berita terbaru dan mengkalkulasi ulang skor geopolitik.
