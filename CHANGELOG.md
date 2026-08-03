# 📜 Hunter Trades — Changelog & Catatan Rilis

Semua catatan perubahan, pembaruan fitur, perbaikan bug, dan rilis versi aplikasi desktop **Hunter Trades** dicatat di dokumen ini.

---

## 🚀 [v1.0.2] — 2026-08-03 (Versi Terbaru)

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
