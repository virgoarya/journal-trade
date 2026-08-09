## 🚀 [v1.0.15] — 2026-08-10 (Versi Terbaru)

### 🎯 Perbaikan Akurasi Level Methodology SMC/ICT/MSNR
- **Fix Bug RBS/SBR Terbalik** (`market-structure.service.ts`):
  - Sebelumnya: Resistance + harga turun → diklasifikasikan RBS (salah), Support + harga naik → SBR (salah).
  - Sekarang: **RBS** = Resistance di-break ke ATAS (candle close di atas) → jadi support. **SBR** = Support di-break ke BAWAH (candle close di bawah) → jadi resistance.
  - Ditambahkan `originalType` & `flipTime` di `MalaysianSNR` untuk deteksi flip yang akurat.
- **Fix Deteksi SNR Flip**: Sekarang cek seluruh candle setelah level terbentuk (bukan hanya 1 candle di index SNR), dengan track `flipTime`.
- **Fix Swing Detection Noise**: Swing valid hanya jika jarak dari swing sebelumnya > 0.5 × ATR — mengurangi swing noise palsu yang mengacaukan level.
- **Fix KeyLevel Clustering**: Level hanya valid jika di-tap minimal 2× (cluster ≥ 2 swing points) — level sekali-sentuh tidak dianggap level kuat.
- **Fix Checklist SMC**: Sweep price diambil dari sumber nyata (liquidity zone / sweepPrice OB), bukan fallback `relLow` yang bisa "N/A".
- **Fix Checklist ICT**: FVG zone menampilkan range top-bottom aktual dari FVG terdekat, bukan hanya entry point.
- **Verifikasi**: Unit test 21/21 lulus (RBS/SBR correctness, swing noise filter, fallback model config).

### 🤖 LLM Voting: Model Baru + Fallback + Reasoning Bahasa Indonesia
- **Model IDs baru + fallback otomatis** (6 provider):
  - DeepSeek: `oc/deepseek-v4-flash-free` → fallback `oc/laguna-s-2.1-free`
  - GPT: `groq/openai/gpt-oss-120b` → fallback `groq/llama-3.3-70b-versatile`
  - Gemini: `gc/gemini-3.1-flash-lite-preview` → fallback `gc/gemini-2.5-pro`
  - Mistral: `mistral/mistral-large-latest` → fallback `mistral/mistral-medium-latest`
  - Nemotron: `oc/nemotron-3-ultra-free` → fallback `nvidia/minimaxai/minimax-m3`
  - Claude Opus: `ag/claude-opus-4-6-thinking` → fallback `kr/claude-sonnet-4.5`
- **Fallback retry**: Jika model utama gagal (network error / HTTP non-2xx / rate-limit), otomatis retry dengan `fallbackModel` + log peringatan.
- **Reasoning DeepSeek Bahasa Indonesia**: Kamus `forceIndonesian` diperluas dengan istilah SMC/ICT/SNR (liquidity sweep, order block, displacement, manipulation, dll) + instruksi keras di SYSTEM_PROMPT untuk model thinking agar reasoning_content dalam Bahasa Indonesia.
- **Config dipisah**: `NINE_ROUTER_MODELS` dipindah ke `src/config/llm-models.config.ts` — mudah di-test & maintain.

### 📦 Build & Release
- Semua package.json di-bump ke **v1.0.15**
- Rebuild server, frontend, desktop app, dan patch OTA

---

## 🚀 [v1.0.14] — 2026-08-09 (Versi Terbaru)

### ✅ Finalisasi Sinkronisasi & Stabilitas AI Trading
- **Fix Pending Order Tidak Tampil**:
  - `mt5-streamer.ts` sekarang memanggil `get_trading_open_positions` dengan `include_orders: true` (parameter native MCP yang tepat) untuk mendapatkan pending orders.
  - `normalizePosition` ditingkatkan untuk membedakan tipe order pending secara spesifik (BUY_LIMIT, SELL_STOP, dll.)
- **Fix Cancel/Modify Order Tidak Bisa**:
  - Implementasi fallback ke **Python MetaTrader5 API (`trade_api.py`)** untuk semua operasi trading (send order, close, modify, cancel) jika native MCP menolak dengan "not permitted".
  - `trade_api.py` diperbarui dengan retry logic untuk inisialisasi MT5, pemilihan filling mode yang sesuai simbol, dan memperbaiki passthrough parameter `price` untuk pending order.
- **Fix LLM Masih Hibernasi**:
  - Mengoreksi `monitor.ts` agar `nineRouterUrl` default ke `http://127.0.0.1:20128`.
  - Mengoreksi memory agar mencerminkan bahwa LLM aktif adalah karena `9router` berjalan, bukan config model ID yang salah.
- **Fix Race Condition & Concurrency**:
  - `trading-pipeline.service.ts`: Fix race condition `currentSymbol` dengan inisialisasi yang tepat dan penanganan `pipeline.running` yang benar.
  - `trading-pipeline.service.ts`: Menambahkan lock `busySymbols` di `managePositions` untuk mencegah race condition.
- **Frontend Stabilitas & UX**:
  - `useMT5Stream`: Implementasi singleton WebSocket untuk memastikan hanya satu koneksi real-time.
  - `PositionsTable.tsx`: Ditambahkan `ErrorBoundary` untuk penanganan error yang graceful.
  - `PositionsTable.tsx`: Menampilkan badge `AI` atau `MANUAL` di kolom komentar untuk source order.
  - `PipelineLogs.tsx`: Menambahkan `useEffect` cleanup untuk `selectedStages`.
- **Build System Robustness**:
  - `buildApp.js`: Memastikan `trade_api.py` disalin dengan benar ke packaged app.
  - `buildApp.js`: Menggunakan `npm install` (bukan `--production`) untuk `resources/server` untuk memastikan semua dependency CLI (misal `9router`) terinstal.
  - `buildApp.js`: Memastikan `node_modules` lengkap disalin untuk `desktop/resources/app`.
  - `main.js`: Fix `9router` spawn path quoting (`"D:\Journal Trade\..."`) dan `shell: true` di Windows.
- **Version**: Semua `package.json` dan patch OTA telah di-update ke **v1.0.14**.
- **Dokumentasi**: Plan pengujian komprehensif (`tasks/plan.md`, `tasks/todo.md`) telah ditambahkan, mencakup 18 task end-to-end dengan verifikasi API dan UI.

---

## 🚀 [v1.0.13] — 2026-08-08 (Release Date)

### 🤖 Perbaikan & Refactoring Total AI Trading Engine
- **Pure AI Execution Mode**:
  - Keputusan *Market Order* vs *Pending Limit Order* 100% otomatis diambil oleh AI engine berdasarkan jarak harga real-time vs entry zone (`minPendingDist`). Tanpa toggle manual.
- **Risk Management & Circuit Breaker**:
  - Default risk per trade disesuaikan ke **0.5%** (dengan hard cap 1.0 lot per order).
  - Circuit Breaker dihentikan murni berdasarkan **Minimum Daily Loss %** (`maxDailyRisk: 1.5%`), menghapus aturan consecutive loss count.
- **Kartu Pending Orders Terpisah**:
  - Tampilan UI `PositionsTable.tsx` memisahkan **Pending Orders ke dalam card tersendiri tepat di bawah Open Positions card**.
- **NET Tab Confluence Filter**:
  - Tab `NET` pada `MethodologyConfluence.tsx` kini **hanya menampilkan checklist dari metodologi prioritas** (confidence tertinggi), bukan gabungan dari semua metodologi.
- **LLM Consensus Cards Per Model**:
  - Log AI Consensus di `PipelineLogs.tsx` merender hasil voting **terpisah per model** (DeepSeek, Gemini, Claude, Mistral, dll) lengkap dengan status badge, latency, dan poin reasoning Bahasa Indonesia.
- **Performa & Caching**:
  - In-memory candle cache (5s) pada `ai-trading-engine.service.ts` untuk menghemat panggilan API MT5 MCP berulang.

---

## 🚀 [v1.0.12] — 2026-08-07

### 🐛 Perbaikan Startup, Dependencies & OTA Fix
- **Fix 9router Startup**: Ganti `npx 9router` ke path langsung `node_modules/.bin/9router.cmd` dengan `shell: true` untuk memastikan spawn berhasil di Windows tanpa error `spawn EINVAL`.
- **Fix Module Dependencies**: Ganti `robocopy node_modules` dengan `npm install` lengkap di build process, memastikan semua module (`dotenv`, `mongoose`, `sax`, `electron-updater`, dll) tersedia di packaged app.
- **Kill Proses Port Zombie**: Menambahkan fungsi `killProcessOnPort` di `main.js` untuk membersihkan port 5000 (backend) & 3000 (frontend) setiap kali aplikasi dibuka.
- **Improved OTA Progress**: Menambahkan progress tracking real-time (percentage) saat mendownload patch OTA di `OtaUpdaterModal.tsx`.
- **Pipeline Trading Fix**: Implementasi polling `getPositions()` setelah placement pending order untuk resolve `ticket=#0` jika MCP tidak langsung mengembalikan ID tiket.

---

## 🚀 [v1.0.11] — 2026-08-06

### 🐛 Perbaikan Proses Zombie & Stabilitas Startup
- **Kill Proses Port Tertinggal Otomatis**:
  - Menambahkan fungsi `killProcessOnPort` di `desktop/main.js` yang mematikan proses zombie di port 5000 (backend) & 3000 (frontend) otomatis setiap kali `Hunter Trades.exe` dibuka.
  - Memperbaiki error *"port masih berjalan di latar belakang"* dan *"port 5000 not available"* setelah aplikasi ditutup paksa.
- **Perpanjang Timeout Startup Server**:
  - Meningkatkan timeout backend & frontend dari **60 detik → 120 detik** (`waitForServer` di `main.js`) untuk menangani sistem yang lambat tanpa false error startup.