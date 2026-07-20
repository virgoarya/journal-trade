# Global Memory: Hunter Trades Journal

## Project Identity
- **Name**: Hunter Trades Journal & AI Trading
- **User**: Bang Vir
- **Tech Stack**:
  - **Frontend**: Next.js 14 (App Router), Tailwind CSS, Lightweight Charts, React.
  - **Backend**: Node.js (Next.js API Routes), Prisma, NextAuth (Discord).
  - **AI Trading Client**: Python (CustomTkinter GUI, websockets, asyncio, MetaTrader5).
- **Design Philosophy**: Terminal Noir (Dark theme dengan Gold accent, premium UI/UX, responsive, micro-animations).

## Current Architecture State
- **Web App**: Deployed on Railway. Menggunakan Prisma untuk database. NextAuth Discord untuk login.
- **AI Trading Integration**: 
  - Tidak menggunakan Ngrok/FastAPI/MCP lagi.
  - Python client (`Hunter Trades AI Trading.exe`) menggunakan **Two-Way WebSocket RPC** langsung ke `wss://journal-trade-production.up.railway.app/ws/mt5-stream`.
  - Push data real-time `mt5_tick` (posisi, info akun) setiap 1 detik tanpa delay.
  - Next.js server menggunakan `mt5-streamer.ts` sebagai bridge RPC ke Python client via WebSocket.

## User Preferences
- **Bahasa**: Selalu gunakan bahasa Indonesia saat berkomunikasi.
- **Speed**: User benci delay. Data tick MT5 harus real-time tanpa delay.
- **Autonomy**: Agen harus mandiri, cek `LESSONS.md` sebelum memulai tugas, jangan menebak root cause.

## Recent Refactors
- **Ngrok Removal**: Menghapus sistem Ngrok karena sering isu jaringan. Beralih ke WebSocket langsung.
- **GUI Update**: Mengubah aplikasi console menjadi Desktop GUI berbasis `CustomTkinter` dengan logo Hunter Trades.
