# Global Memory: Hunter Trades Journal

## Project Identity
- **Name**: Hunter Trades Journal & AI Trading
- **User**: Bang Vir
- **Tech Stack**:
  - **Desktop App**: Electron (server manager + full UI window + system tray).
  - **Frontend**: Next.js 16 (App Router, standalone output), Tailwind CSS, Lightweight Charts, React.
  - **Backend**: Node.js (Express API + WebSocket server), Mongoose, Better Auth (Discord).
  - **Desktop App**: Electron (server manager + full UI window + system tray).
  - **Frontend**: Next.js 16 (App Router, standalone output), Tailwind CSS, Lightweight Charts, React.
  - **Backend**: Node.js (Express API + WebSocket server), Mongoose, Better Auth (Discord).
  - **MT5 Integration**: Native MetaTrader 5 MCP Server (`http://127.0.0.1:22346/mcp`) via SSEClientTransport & EventSource polyfill.
- **Design Philosophy**: Terminal Noir (Dark theme dengan Gold accent, premium UI/UX, responsive, micro-animations).

## Current Architecture State
- **Desktop App**: Electron wrapper yang menjalankan backend + frontend sebagai child processes.
  - BrowserWindow menampilkan full web UI (`http://localhost:3000`).
  - System tray untuk background operation.
  - Bisa diakses juga dari browser desktop/mobile di jaringan yang sama.
  - Installer .exe via `electron-builder` + NSIS.
- **Backend**: Express server (port 5000) + WebSocket server. MongoDB Atlas (cloud).
- **Frontend**: Next.js standalone (port 3000). API proxy ke backend via rewrites.
- **MT5 Integration**:
  - Backend Node.js langsung terhubung ke Native MCP Server yang berjalan langsung di dalam aplikasi MetaTrader 5 (`http://127.0.0.1:22346/mcp`).
  - Menggunakan API Key untuk otentikasi.
  - Polling real-time data tick / chart / order langsung via Model Context Protocol (MCP) tanpa membutuhkan Python client atau bridge terpisah.
- **Auth**: Better Auth + Discord OAuth (hanya member komunitas Discord yang bisa akses).
- **Payment**: Midtrans (planned untuk versi berbayar).

## User Preferences
- **Bahasa**: Selalu gunakan bahasa Indonesia saat berkomunikasi.
- **Speed**: User benci delay. Data tick MT5 harus real-time tanpa delay.
- **Autonomy**: Agen harus mandiri, cek `LESSONS.md` sebelum memulai tugas, jangan menebak root cause.
- **Deployment**: Desktop installer .exe. User install sekali, klik icon, semuanya jalan.
- **Accessibility**: Web UI harus bisa diakses dari browser + mobile (server desktop harus nyala).

## Recent Refactors
- **Native MT5 MCP Migration**: Mengganti Python bridge (`Hunter Trades AI Trading.exe`) dengan koneksi langsung ke fitur Native MCP Server yang sudah terintegrasi di MetaTrader 5 desktop (`http://127.0.0.1:22346/mcp`). Mengurangi overhead memory, latency, dan kompleksitas packaging.
- **GitHub Releases Auto-Update**: Integrasi `electron-updater` dan `UpdateNotification` UI component di Next.js layout. Aplikasi otomatis memeriksa pembaruan di latar belakang, mengunduh patch, dan menyediakan tombol "Restart & Perbarui" tanpa perlu re-install manual.
- **Electron Desktop App**: Membungkus seluruh stack (backend + frontend) dalam Electron installer .exe via NSIS.

## Project Structure
```
D:\Journal Trade\
├── desktop/           → Electron app (main.js, preload.js, splash, builder config)
├── frontend/          → Next.js 16 App Router (standalone output)
│   ├── src/app/       → Pages dan API routes
│   └── public/        → Static assets
├── server/            → Express backend
│   └── src/           → TypeScript source (mt5-streamer.ts connects to MT5 MCP)
└── .kilo/             → Agent config, memory, skills
```
