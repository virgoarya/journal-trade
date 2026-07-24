# Lessons Learned: Hunter Trades Journal

> Ini adalah basis pengetahuan yang terus berkembang.
> Setiap kali agent menemukan bug atau kesalahan baru, WAJIB menambahkan pelajaran baru di sini.
> Baca file ini SEBELUM mengerjakan task apapun yang berkaitan dengan area yang pernah bermasalah.

---

## Format Lesson

```
### [YYYYMMDD] Judul Singkat Masalah
**Area**: [Frontend / Backend / Python Client / WebSocket / Prisma / Deployment]
**Root Cause**: Penjelasan singkat akar masalah yang sebenarnya.
**Solusi**: Apa yang dilakukan untuk memperbaikinya.
**Hindari**: Hal yang TIDAK boleh dilakukan lagi.
```

---

## Lessons Log

### [20260719] TypeError: fetch failed - TLS Handshake SSE Connection Drop
**Area**: Backend / WebSocket / Python Client
**Root Cause**: `SSEClientTransport` dari `@modelcontextprotocol/sdk` menggunakan `undici` untuk fetch yang tidak kompatibel dengan environment Railway (TLS handshake terputus). Bukan masalah firewall, bukan masalah URL, bukan masalah env var.
**Solusi**: Hapus total semua dependency SSE/MCP. Ganti dengan **Two-Way WebSocket RPC murni** menggunakan `websockets` di Python dan `ws` di Node.js.
**Hindari**: Jangan gunakan `SSEClientTransport`, `undici`, atau `@modelcontextprotocol/sdk` di environment ini. Jangan pernah kembali ke arsitektur SSE/Ngrok.

### [20260720] PyInstaller hang saat build (menunggu konfirmasi overwrite)
**Area**: Python Client / Build
**Root Cause**: PyInstaller versi baru meminta konfirmasi interaktif `"Y/N"` sebelum menimpa file spec/dist yang sudah ada. Saat dijalankan dari background task, tidak ada yang menekan Enter sehingga proses stuck.
**Solusi**: Selalu gunakan flag `-y` pada perintah PyInstaller. Contoh: `pyinstaller -y --onefile ...`
**Hindari**: Menjalankan PyInstaller tanpa `-y` jika ada kemungkinan file dist sudah ada sebelumnya.

### [20260720] TypeError: webidl.util.markAsUncloneable is not a function
**Area**: Backend / Node.js
**Root Cause**: Konflik versi antara `undici` yang di-bundle dalam package MCP dengan versi Node.js yang digunakan Railway. Versi undici terlalu baru untuk Node.js yang tersedia.
**Solusi**: Hapus seluruh import `@modelcontextprotocol/sdk` dan `undici`. Ganti logika koneksi dengan implementasi WebSocket RPC langsung.
**Hindari**: Jangan install atau menggunakan `undici` secara langsung dalam project ini.

### [20260723] Pipeline config nyantol pair broker lama saat ganti broker
**Area**: Backend / Database
**Root Cause**: `savedPipelineConfig` disimpan global per user, bukan per broker server. Saat ganti broker (misal Valetax → Exness), TradingPanel masih load config lama yang berisi pair Valetax (`XAUUSD.vx`). Route `/settings/ai-trading` dan `/pipeline/start` fallback ke `savedPipelineConfig` lama kalo broker baru belum punya config.
**Solusi**:
1. Tambah field `savedPipelineConfigs: Map<server, config>` di `UserSettings` model — simpan config per broker.
2. `applyToLivePipeline` di `ai-learning.service.ts` simpan config ke `savedPipelineConfigs[server]` (ambil server dari `MT5Connection`).
3. Route `/settings/ai-trading` dan `/pipeline/start` ambil config dari `savedPipelineConfigs[server]` — **tanpa fallback** ke config lama. Kalo broker baru belum ada config, return `null` → TradingPanel tampil "No Config Found".
4. Frontend `AiTradingContext` re-fetch settings pas `accountInfo.server` berubah (per-broker isolation).
**Hindari**: Jangan simpan config global per user kalau sistem support multiple broker. Jangan fallback ke config lama kalau broker berbeda — itu bikin data leak antar broker.
**Area**: Backend / Frontend / Database
**Root Cause**: Dua masalah sekaligus:
1. **DB index conflict**: Collection `ai_backtest_skills` punya index lama `userId_1` (unique) yang konflik sama compound index baru `userId_1_server_1` (unique). Saat `updateSkill` coba save → `E11000 duplicate key error` → skill ga tersimpan.
2. **Server mismatch**: `updateSkill` auto-detect server dari `MT5Connection`, tapi `SkillDisplay` fetch pake `accountInfo.server` dari MT5 response. Kalo beda (manual input vs actual), skill ga ketemu.
**Solusi**:
1. Auto-drop index lama `userId_1` saat server startup di `db/mongoose.ts` `connectDB()`.
2. Pass `server` dari `MT5Connection` ke `updateSkill(userId, result, server)` di `backtest.service.ts` dan `auto-backtest.service.ts`.
3. Route `/skill` accept query param `server`, pass ke `getSkill(userId, server)`.
4. Frontend pass `accountInfo?.server` ke `SkillDisplay` → `aiTradingService.getSkill(server)`.
**Hindari**: Jangan tambah unique index baru tanpa hapus index lama yang konflik. Jangan auto-detect server di satu layer dan pass manual di layer lain — konsisten di satu sumber.

### [20260724] Validasi Sinyal (Checklist Trading Plan) Multi-Methodology (SMC, ICT, Malaysian SNR)
**Area**: Frontend / Backend / Strategies
**Root Cause**: Sebelumnya Confluence engine hanya mengembalikan score persentase tunggal tanpa struktur data granular kriteria validasi per metodologi.
**Solusi**:
1. Menambahkan interface `ChecklistItem` di Confluence Engine backend.
2. Setiap metodologi (SMC, ICT, Malaysian SNR) memproduksi `checklistItems` spesifik dengan indikator timeframe (`H4`, `H1`, `M15`) dan status (`PASSED`, `WAITING`, `FAILED`).
3. Komponen `MethodologyConfluence.tsx` di frontend dilengkapi dengan tab selector (`NET`, `SMC`, `ICT`, `Malaysian SNR`) untuk berpindah tampilan checklist secara instan.
**Hindari**: Jangan meng-hardcode checklist di UI. Semua status kriteria wajib dihasilkan secara terstruktur dari pipeline engine backend agar selalu sinkron dengan data pasar real-time.
