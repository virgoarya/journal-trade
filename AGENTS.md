# Hunter Trades Journal — Agent Instructions

> File ini dibaca secara otomatis oleh AI coding agent saat memulai sesi di project ini.
> Ikuti semua instruksi di bawah ini tanpa pengecualian.

---

## 🚀 Startup Checklist (Wajib Dilakukan Setiap Sesi)

Sebelum mengerjakan task apapun, lakukan langkah-langkah ini secara berurutan:

1. **Baca `.kilo/MEMORY.md`** → Pahami arsitektur, tech stack, dan state project saat ini.
2. **Baca `.kilo/LESSONS.md`** → Cek pelajaran dari kesalahan-kesalahan sebelumnya. Jangan ulangi kesalahan yang sama.
3. **Baca `.kilo/RULES.md`** → Pahami semua aturan workflow, standar kode, dan cara berkomunikasi dengan user.

---

## 📚 Skills yang Tersedia

Jika task berkaitan dengan area-area berikut, **WAJIB baca skill yang sesuai** sebelum mulai:

| Area | File Skill |
|------|-----------|
| Membuat / memodifikasi UI komponen React/Next.js | `.kilo/skills/frontend-ui-engineering.md` |
| Koneksi WebSocket RPC antara Python MT5 client dan Node.js | `.kilo/skills/backend-websocket-rpc.md` |
| Debugging error yang tidak jelas root cause-nya | `.kilo/skills/debugging-and-error-recovery.md` |

---

## 🗣️ Aturan Komunikasi

- Gunakan **Bahasa Indonesia** untuk semua komunikasi dengan user.
- Panggil user dengan **"Bang Vir"** atau **"Bang"**.
- Jangan membuat perubahan besar tanpa membuat **rencana (plan)** terlebih dahulu dan meminta persetujuan.

---

## 🎓 Self-Learning (Sangat Penting)

Agent diharapkan bisa **belajar dari pengalaman**:

- Setiap kali berhasil menyelesaikan bug atau menemukan insight penting, **tambahkan lesson baru di `.kilo/LESSONS.md`**.
- Jika ada perubahan arsitektur yang signifikan, **update `.kilo/MEMORY.md`**.
- Tujuannya: setiap sesi berikutnya, agent semakin pintar dan tidak perlu diajarkan hal yang sama dua kali.

---

## 📁 Struktur Project

```
D:\Journal Trade\
├── frontend/          → Next.js 14 App Router
│   ├── src/app/       → Pages dan API routes
│   └── public/        → Static assets (logo.png, dll)
├── server/            → Backend services
│   ├── src/
│   │   ├── services/  → mt5-mcp.service.ts, dll
│   │   └── mt5-streamer.ts  → WebSocket bridge
│   └── mcp-mt5-server/  → Python MT5 client
│       ├── server.py  → Logic utama + WS connection
│       ├── gui.py     → CustomTkinter GUI
│       └── build.bat  → Build script → Hunter Trades AI Trading.exe
└── .kilo/             → Agent config, memory, skills
```