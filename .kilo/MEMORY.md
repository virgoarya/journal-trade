# Global Memory: Hunter Trades Journal

## Project Identity
- **Name**: Hunter Trades Journal & AI Trading
- **User**: Bang Vir
- **Tech Stack**:
  - **Desktop App**: Electron (server manager + full UI window + system tray).
  - **Frontend**: Next.js 16 (App Router, standalone output), Tailwind CSS, Lightweight Charts, React.
  - **Backend**: Node.js (Express API + WebSocket server), Mongoose, Better Auth (Discord).
  - **AI Trading Client**: Python (CustomTkinter GUI, websockets, asyncio, MetaTrader5).
- **Design Philosophy**: Terminal Noir (Dark theme dengan Gold accent, premium UI/UX, responsive, micro-animations).

## Current Architecture State
- **Desktop App**: Electron wrapper yang menjalankan backend + frontend sebagai child processes.
  - BrowserWindow menampilkan full web UI (`http://localhost:3000`).
  - System tray untuk background operation.
  - Bisa diakses juga dari browser desktop/mobile di jaringan yang sama.
  - Installer .exe via `electron-builder` + NSIS.
- **Backend**: Express server (port 5000) + WebSocket server. MongoDB Atlas (cloud).
- **Frontend**: Next.js standalone (port 3000). API proxy ke backend via rewrites.
- **AI Trading Integration**: 
  - Python client (`Hunter Trades AI Trading.exe`) menggunakan **Two-Way WebSocket RPC** ke `ws://localhost:5000/ws/mt5-stream`.
  - Push data real-time `mt5_tick` setiap 1 detik.
  - Bundled dalam installer desktop.
- **Auth**: Better Auth + Discord OAuth (hanya member komunitas Discord yang bisa akses).
- **Payment**: Midtrans (planned untuk versi berbayar).

## User Preferences
- **Bahasa**: Selalu gunakan bahasa Indonesia saat berkomunikasi.
- **Speed**: User benci delay. Data tick MT5 harus real-time tanpa delay.
- **Autonomy**: Agen harus mandiri, cek `LESSONS.md` sebelum memulai tugas, jangan menebak root cause.
- **Deployment**: Desktop installer .exe. User install sekali, klik icon, semuanya jalan.
- **Accessibility**: Web UI harus bisa diakses dari browser + mobile (server desktop harus nyala).

## Recent Refactors
- **GitHub Releases Auto-Update**: Integrasi `electron-updater` dan `UpdateNotification` UI component di Next.js layout. Aplikasi otomatis memeriksa pembaruan di latar belakang, mengunduh patch, dan menyediakan tombol "Restart & Perbarui" tanpa perlu re-install manual.
- **Electron Desktop App**: Membungkus seluruh stack (backend + frontend + MT5 client) dalam Electron installer .exe via NSIS.
- **Railway Removal**: Migrasi dari Railway ke full local setup. Semua WebSocket URL mengarah ke `localhost:5000`.
- **Ngrok Removal**: Menghapus sistem Ngrok karena sering isu jaringan. Beralih ke WebSocket langsung.
- **GUI Update**: Mengubah aplikasi console menjadi Desktop GUI berbasis `CustomTkinter` dengan logo Hunter Trades.

## Project Structure
```
D:\Journal Trade\
├── desktop/           → Electron app (main.js, preload.js, splash, builder config)
├── frontend/          → Next.js 16 App Router (standalone output)
│   ├── src/app/       → Pages dan API routes
│   └── public/        → Static assets
├── server/            → Express backend
│   ├── src/           → TypeScript source
│   ├── .venv-mcp/     → Python MCP binaries
│   └── mcp-mt5-server/ → Python MT5 client
│       └── dist/      → Built .exe
└── .kilo/             → Agent config, memory, skills
```
