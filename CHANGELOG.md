# 📜 Hunter Trades — Changelog & Catatan Rilis

Semua catatan perubahan, pembaruan fitur, perbaikan bug, dan rilis versi aplikasi desktop **Hunter Trades** dicatat di dokumen ini.

## 🚀 [v1.0.11] — 2026-08-06 (Versi Terbaru)

### 🐛 Perbaikan Proses Zombie & Stabilitas Startup
- **Kill Proses Port Tertinggal Otomatis**:
  - Menambahkan fungsi `killProcessOnPort` di `desktop/main.js` yang membunuh proses zombie di port 5000 (backend) & 3000 (frontend) setiap kali aplikasi `Hunter Trades.exe` diluncurkan.
  - Mengatasi error *"port masih berjalan di latar belakang"* yang menyebabkan aplikasi gagal digunakan setelah ditutup paksa.

### 🐛 Perbaikan Pipeline Trading & Null Safety
- **Fallback Ticket Pending Order**:
  - Jika native MCP mengembalikan `ticket=#0` saat placement pending order, pipeline sekarang melakukan polling `getPositions()` setelah 1 detik untuk mencari ticket asli berdasarkan simbol, volume, dan comment.
- **Null Safety di Trading Pipeline**:
  - Menambahkan guard untuk `tickData`, `analysis.confluence.finalSignal`, dan `methodologyStr` agar tidak crash saat data tidak tersedia.
  - Menambahkan tipe log `"WARN"` ke dalam union type log pipeline.

---

## 🚀 [v1.0.11] — 2026-08-06 (Versi Terbaru)

### 🐛 Perbaikan Proses Zombie & Stabilitas Startup
- **Kill Proses Port Tertinggal Otomatis**:
  - Menambahkan fungsi `killProcessOnPort` di `desktop/main.js` yang mematikan proses zombie di port 5000 (backend) & 3000 (frontend) otomatis setiap kali `Hunter Trades.exe` dibuka.
  - Memperbaiki error *"port masih berjalan di latar belakang"* dan *"port 5000 not available"* setelah aplikasi ditutup paksa.
- **Perpanjang Timeout Startup Server**:
  - Meningkatkan timeout backend & frontend dari **60 detik → 120 detik** (`waitForServer` di `main.js`) untuk menangani sistem yang lambat tanpa false error startup.

---

## 🚀 [v1.0.10] — 2026-08-06

### 🐛 Perbaikan Sinkronisasi Native MT5 MCP (Lanjutan)
- **Full Native MCP Tool Mapping**:
  - Memastikan seluruh fungsi AI trading pipeline memanggil native MT5 MCP tool dengan nama yang benar (`get_trading_account_info`, `get_trading_open_positions`, `get_marketwatch_symbols`, dll).
- **Deteksi Error Response**:
  - Memperbaiki bug di mana response string error dari MCP (misal *"trading is not permitted"*) dilaporkan sebagai eksekusi SUCCESS karena `res?.error` undefined pada string.
  - Kini response string non-JSON dideteksi sebagai error dan direport dengan benar.
- **Logging Response Order**:
  - Menambahkan logging raw response dari `trade_send_market_order` & `trade_send_pending_order` untuk mempermudah debugging.

---

## 🚀 [v1.0.9] — 2026-08-05

### 🐛 Perbaikan Integrasi Native MT5 MCP & Kalkulasi Profit
- **Fix Mapping Field Posisi Native MCP**:
  - Memperbaiki `normalizePosition()` di `mt5-streamer.ts` untuk membaca field native MCP: `position_id` (ticket), `price_last` (harga terkini), `stop_loss`/`take_profit` (SL/TP), `action` (buy/sell), `create_time`/`update_time` (waktu).
- **Fix Kalkulasi Contract Size**:
  - Memperbaiki `mt5_symbol_info` agar menggunakan tool native `get_marketwatch_symbols` (sebelumnya memanggil tool lama yang tidak ada, menyebabkan `contractSize` selalu fallback ke `100000`).
  - **Efek**: Profit/volume kini akurat untuk semua simbol (XAUUSD contract size 100, EURUSD 100000, dll). Sebelumnya lot 0.01 XAUUSD bisa terhitung puluhan ribu dollar.
- **Fix Floating P&L di UI**:
  - `AccountOverview` kini menghitung Floating P&L dari jumlah profit posisi terbuka (`positions.reduce`), bukan dari `accountInfo.profit` (profit kumulatif akun) sehingga tampil akurat.
- **Fix Tool `mt5_symbol_tick` & `mt5_symbol_info`**:
  - Keduanya kini memanggil `get_marketwatch_symbols` native dan difilter berdasarkan simbol yang diminta.

---

## 🚀 [v1.0.8] — 2026-08-05

### 🐛 Perbaikan Sistem MT5 MCP & OTA Fix
- **Native MT5 MCP Python Server Rebuild**: 
  - Memperbaiki bug "hibernasi" massal pada model AI akibat kegagalan sinkronisasi metode MCP (`tool not found`).
  - Pembaruan nama-nama *tool* (seperti `mt5_positions_get` dan `mt5_account_info`) kini sudah dikompilasi ulang secara benar ke dalam executable Python (`Hunter Trades AI Trading.exe`) sehingga dapat dibaca dengan baik oleh *Node backend*.
- **9Router Auto-Start (Tray Mode)**:
  - 9Router kini berjalan secara *silent* di latar belakang (tanpa interupsi UI terminal) bersamaan dengan peluncuran Hunter Trades berkat integrasi parameter `--tray`.

---

## 🚀 [v1.0.6] — 2026-08-05
### 🛡️ Sistem Pembaruan OTA (Over-The-Air) & Keamanan Lanjut
- **Auto-Patch Update Tanpa Installer**: 
  - Mengganti `electron-updater` dengan custom OTA Updater. Kini pengguna akan menerima pembaruan patch (bug fixes/fitur baru) secara instan tanpa perlu men-download ulang seluruh file installer `.exe`.
  - Sistem hanya akan men-download file patch ringan (`patch.zip`), mengekstrak ke dalam sistem, dan merestart aplikasi secara otomatis.
  - Ditambahkan script `npm run build:patch` untuk memudahkan developer membungkus update baru.
- **OTA Safety Layer & Auto-Rollback**:
  - **Integritas File (SHA-256)**: Sistem memverifikasi hash setiap file patch yang didownload agar terhindar dari file *corrupt*.
  - **Auto-Backup**: Folder instalasi otomatis dicadangkan sebelum diekstrak dengan file patch baru.
  - **Auto-Rollback (Anti-Brick)**: Jika aplikasi terdeteksi gagal menyala atau terjadi error pada server setelah patch baru dipasang, sistem akan melakukan *rollback* instan ke versi sebelumnya secara otomatis, mengamankan pengguna dari *crash loop*.
- **UI Update Interaktif**: 
  - Menambahkan Modal UI `OtaUpdaterModal` di layar utama yang memunculkan notifikasi "Update Patch Available" setiap kali ada rilis baru.

### 🐛 Perbaikan AI Strategy Tester (Backtest)
- **Fix Missing Historical Data pada Native MCP**:
  - Memperbaiki kegagalan backtest (error `-32602: tool not found`) karena *Native MT5 MCP* tidak menyediakan akses untuk mengambil data candle history (`copy_rates_range`).
  - Menambahkan script Python ringan mandiri (`fetch_rates.py`) yang berinteraksi langsung via memori terminal sebagai *fallback* ketika AI Strategy Tester meminta data OHLCV historis tanpa membebani sistem utama.

---

## 🚀 [v1.0.5] — 2026-08-04
### 🔌 Arsitektur Native MT5 MCP & Per-User API Key
- **Native MT5 MCP Integration**:
  - Menggantikan Python bridge dengan koneksi langsung ke **Native MCP Server** internal MetaTrader 5 (`http://127.0.0.1:22346/mcp`).
  - Tidak memerlukan aplikasi Python bridge atau proses latar belakang terpisah lagi.
- **Otentikasi Per-User API Key**:
  - Setiap pengguna cukup menyalin **API Key** unik dari terminal MetaTrader 5 (*Tools ➜ Options ➜ Tab MCP*).
  - Tidak perlu memasukkan password akun broker ke dalam form aplikasi Hunter Trades (100% aman & privat).
  - API Key disimpan secara terenkripsi AES-256-CBC di database untuk auto-reconnect saat server restart.
- **User Guide Interaktif**:
  - Menambahkan modal panduan langkah demi langkah bergambar di panel koneksi AI Trading dan Settings.
  - Menambahkan dokumentasi resmi di `docs/USER_GUIDE_MT5.md`.

---

## 🚀 [v1.0.4] — 2026-08-04

### 🤖 Integrasi Otomatis Jembatan MT5 Streamer & Penghapusan Railway
- **Auto-Start MT5 Bridge**:
  - Aplikasi desktop Hunter Trades kini secara otomatis menjalankan background service jembatan MetaTrader 5 (`Hunter Trades AI Trading.exe --headless`) saat aplikasi dibuka.
  - Pengguna tidak perlu lagi menjalankan program `.exe` jembatan secara manual di luar aplikasi.
  - Logging proses bridge diarahkan ke file log khusus `%APPDATA%/hunter-trades-desktop/logs/mt5-bridge.log`.
- **Koneksi 100% Server Lokal**:
  - Menghapus total sisa endpoint Railway dari Python MT5 bridge.
  - Jembatan MT5 langsung tersambung secara otomatis ke WebSocket lokal `ws://localhost:5000/ws/mt5-stream` dengan fitur auto-detect sesi aktif terminal MT5.
- **UX Reconnect Overlay**:
  - Menambahkan tombol *"Batalkan & Ganti Akun"* dan *"Kembali ke Menu"* pada overlay loading AI Trading agar pengguna tidak terkunci jika terminal MT5 belum dibuka.

### 📦 Distribusi & Installer
- Installer Windows NSIS: `Hunter Trades Setup 1.0.4.exe`
- Auto-updater metadata: `latest.yml` terintegrasi dengan GitHub Releases.

---

## 🚀 [v1.0.3] — 2026-08-03

### 🐛 Perbaikan Discord OAuth Login & Process Spawning
- **Fix Discord OAuth Login No-Response**:
  - Mengizinkan navigasi URL eksternal ke `discord.com` & `discordapp.com` di `desktop/main.js` via `will-navigate` & `setWindowOpenHandler` agar alur OAuth Discord dapat terbuka dan meredirect kembali ke aplikasi.
  - Menambahkan override `FRONTEND_URL=http://localhost:3000` dan `BETTER_AUTH_URL=http://localhost:5000` secara eksplisit saat mengemas backend desktop agar tidak mencoba redirect ke URL Vercel.
  - Memperbarui `trustedOrigins` di Better Auth (`server/src/auth/index.ts`) dan mengaktifkan bypass CSRF khusus koneksi localhost/desktop.
- **Perbaikan Backend Spawning & Port Binding**:
  - Mengganti spawning backend dari `utilityProcess.fork` ke `child_process.fork` dengan flag `ELECTRON_RUN_AS_NODE=1` agar backend Node.js berjalan tanpa hambatan sandbox Electron.
  - Mengikat `server.listen(5000, "0.0.0.0")` dan memperbarui seluruh health check polling ke `http://127.0.0.1:5000` untuk menghindari latency DNS resolver Windows.
  - Menambahkan fallback pencarian file `.env` di berbagai candidate path internal paket app.

### 📦 Distribusi & Installer
- Installer Windows NSIS: `Hunter Trades Setup 1.0.3.exe`
- Auto-updater metadata: `latest.yml` terintegrasi dengan GitHub Releases.

---

## 🚀 [v1.0.2] — 2026-08-03

### 🐛 Perbaikan Bug & Stabilitas (Bug Fixes)
- **Fix MongoDB Connection Hang & DNS Override**:
  - Menghapus paksaan DNS `dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"])` di `server/src/index.ts`.
  - Mengembalikan sistem resolusi nama domain ke DNS native/default sistem operasi sehingga tidak lagi terblokir atau *hang* pada ISP Indonesia (IndiHome, Telkomsel, FirstMedia, dll).
  - Menyelesaikan kendala dialog pesan error: *"Startup Error: Failed to start internal servers. Please check that ports 5000 and 3000 are available"*.
- **Optimalisasi Startup Desktop**:
  - Memastikan *utilityProcess* backend dan frontend Next.js dapat melakukan *handshake* `/health` port 5000 dan port 3000 secara instan tanpa *timeout*.

### 📦 Distribusi & Installer
- Installer Windows NSIS: `Hunter Trades Setup 1.0.2.exe`
- Auto-updater metadata: `latest.yml` terintegrasi dengan GitHub Releases.

---

## ⚡ [v1.0.1] — 2026-08-03

### 🎨 Tampilan & Ikon Shortcut (Desktop & Branding)
- **Resolusi Ikon Windows**:
  - Konversi aset `logo.png` menjadi `icon.ico` multi-resolusi (16x16, 24x24, 32x32, 48x48, 64x64, 128x128, 256x256) menggunakan format standar Windows Icon.
  - Memperbaiki shortcut desktop yang sebelumnya menampilkan ikon default kertas/blank menjadi ikon resmi Hunter Trades.
- **Konfigurasi NSIS Installer**:
  - Menambahkan konfigurasi `installerIcon` dan `uninstallerIcon` mengarah ke `build/icon.ico`.
  - Integrasi blok update otomatis (`autoUpdater.checkForUpdatesAndNotify()`) di `desktop/main.js`.

---

## 🌟 [v1.0.0] — 2026-08-03 (Initial Desktop Release)

### ✨ Fitur Utama (Core Features)
- **Arsitektur All-in-One Desktop Standalone**:
  - Menggabungkan Electron runtime, Next.js 14 Standalone Frontend, Express.js Backend API, dan Python MT5 Bridge dalam satu paket installer `.exe`.
  - Manajemen port otomatis internal (Port 3000 untuk frontend, Port 5000 untuk backend API & WebSocket).
- **Integrasi MT5 & AI Consensus**:
  - Koneksi dua arah WebSocket RPC antara MetaTrader 5 dan backend trading.
  - LLM Consensus Analysis engine (Gemini, Qwen DashScope, Groq, Claude).
  - Terminal Macro & Liquidity Flow visualizer.
  - Manajemen akun trading, history deal, dan eksekusi order otomatis dengan Circuit Breaker.
- **Sistem Auto-Update**:
  - Integrasi `electron-updater` yang tersambung langsung ke repository GitHub `virgoarya/journal-trade` untuk rilis otomatis di masa mendatang.
