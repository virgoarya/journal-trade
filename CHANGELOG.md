## 🚀 [v1.2.1] — 2026-10-20 (Versi Terbaru)

> Versi konsolidasi rilis **1.2.1** — mencakup transisi penuh arsitektur Agent Consensus (ADR-0001 & ADR-0002),
> perbaikan end-to-end pipeline & settings, integrasi In-App Guidance, pembaruan tooling ESLint v9,
> serta verifikasi pengujian Playwright E2E.

### 🧠 Agent Consensus Engine (ADR-0001 & ADR-0002 — Full Replace)
- **Full Replace Hero Konsensus:** Menggantikan visual lama 6-node LLM di halaman AI Trading dengan **Agent Consensus Breakdown** (`c2a57f9`), menampilkan 3 Persona:
  - **Hawk (Bobot 1.5):** Evaluasi risiko, capital preservation, sensitivitas likuiditas, dan mitigasi stop-out.
  - **Dove (Bobot 1.0):** Identifikasi momentum, konfirmasi tren, dan peluang risk/reward menguntungkan.
  - **Contrarian (Bobot 1.0):** Skeptisisme pasar, mitigasi consensus failure, dan deteksi jebakan likuiditas.
  - Ditambah visualisasi **Consensus Score** (threshold ≥ 60%), **Agent Bias Radar**, dan **Vote Distribution**.
- **Perhitungan Voting Terbobot:** Implementasi `calculateWeightedConsensus()` (`1682e5c`) yang menghitung skor terbobot riil dari vote agen (bukan sekadar vote mayoritas atau keyword matching).
- **Isolasi Memori Per-Persona:** Mengaktifkan injeksi memori spesifik per persona (`buildMemoryContext`) dan ranking fakta terpelajari berdasarkan `confidence` descending (`e37bb1b`) di `server/src/services/agent-consensus.service.ts`.
- **Rollback Path Terjaga:** `llm-consensus.service.ts` tetap dipertahankan di backend sebagai fallback `else if` jika `agentConsensus.enabled` dimatikan.

### ⚙️ Pipeline & Settings Integration
- **Fix Dead Code Flag `agentConsensus`:** Menambahkan properti `agentConsensus` ke dalam Zod schema validasi settings (`settings.routes.ts`) dan pipeline start route (`ai-trading.routes.ts`) (`938d604`). Sebelumnya flag selalu bernilai `false` di runtime karena tidak dapat ditulis oleh API settings.
- **Trade History Enrichment:** Menghubungkan riwayat trading pengguna dari database MongoDB (`buildTradeHistoryContext`) untuk disuntikkan ke dalam prompt agen sebagai bukti performa historis.

### 🧪 Pengujian & Kualitas (Quality Assurance)
- **Suite E2E Task 3.4 Lulus 10/10:** Vera menyelesaikan suite pengujian Playwright end-to-end (`frontend/e2e/agent-consensus.spec.ts`) dengan **10/10 test cases lulus** (`43348e6`), mencakup rendering kartu konsensus, error boundary, navigasi tab, dan penanganan status pipeline.
- **Suite Unit Test Backend 44/44 Pass:** Verifikasi menyeluruh mencakup memory context, weighted voting, adapter layer, trade history link, pipeline routing, dan isolasi memori multi-user.
- **Setup ESLint Flat Config v9:** Konfigurasi ESLint modern di server dan frontend (`f8ba0a6`, `e2cde18`, `e7089f7`), memastikan aturan Next.js (`core-web-vitals`) aktif kembali dan direktori `e2e/**` terlindungi linting.

### 🎓 In-App Guidance & UX
- **Onboarding Walkthrough Overlay:** Menambahkan dukungan click-outside dismiss (`onClick={onSkip}`) pada `Walkthrough.tsx` (`e9b2bd2`) agar overlay tidak mengunci interaksi pengguna di layar.
- **Komponen panduan interaktif modular** (`frontend/src/components/guidance/`): tooltips kontekstual, dynamic step manifest, dan progress state persistence (`storageKey: hunter-trades-guidance:v2`).
- **Integrasi Onboarding:** `GuidanceProvider` dipasang di `app/(dashboard)/layout.tsx` dengan auto-start first-run tour `onboarding` diselaraskan ke route nyata (`/log-trade`, `/dashboard`, `/macro-terminal`, `/ai-trading`, `/playbook`).

### 🗄️ Infrastruktur & Database
- **Verifikasi Koneksi MongoDB:** Memastikan ketersediaan koneksi database riwayat trading melalui MongoDB Atlas SRV record (cluster shards `159.143.58.x`) dan service lokal MongoDB port 27017.
- **PostgreSQL Agent Memory:** Tabel `UserProfile` dan `UserMemoryNote` berjalan di PostgreSQL port 5432 untuk persistensi ingatan agen.

### 🔄 OTA Update — Hosting di GitHub Raw CDN
- **Remote OTA Hosting:** `version.json` dan `patch.zip` dipindah dari local server ke branch `main` GitHub raw (`https://raw.githubusercontent.com/virgoarya/journal-trade/main/update/`).
- **Fix `.gitignore` OTA Leak/Block:** folder `update/` diizinkan masuk repo agar patch dan metadata versi tersinkronisasi sempurna.
- **Semver-aware Gate:** logika perbandingan versi pada updater diperbaiki untuk mencegah downgrade atau silent failure.

---

## 🚧 [v1.2.0] — Unreleased

### ✨ First-Run Setup Wizard
- **Jendela Setup Configuration** (`desktop/setup.html` + `desktop/preload-setup.js`) muncul
  otomatis saat `%APPDATA%\hunter-trades-desktop\server.env` belum ada. User mengisi
  kredensial lewat GUI, lalu konfigurasi ditulis ke file itu.
- `desktop/main.js` memuat `server.env` dari userData **lebih dulu**, baru fallback ke
  `server/.env` (berguna saat menjalankan Electron di mode dev).
- Field wajib divalidasi sebelum simpan: `DATABASE_URL`, `BETTER_AUTH_SECRET`,
  `ENCRYPTION_KEY`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_GUILD_ID`,
  `MIDTRANS_SERVER_KEY`, `MIDTRANS_ENV`. `NINE_ROUTER_URL` / `NINE_ROUTER_API_KEY` opsional.
- **Ini yang membuat installer bisa benar-benar "install → klik icon → jalan"** tanpa user
  menyentuh file `.env` secara manual. Installer tetap tidak membawa kredensial apa pun.

### 🔒 Keamanan & Rilis
- **Hapus `update/patch.zip` dari git tracking** + tambah scan gitleaks di CI (`b915065`).
  Patch OTA pernah membawa 33 kredensial produksi ke repo publik — `buildPatch.js` sekarang
  punya assertion yang menggagalkan build kalau `.env`, `logs/`, `*.log`, `node_modules/`
  ikut masuk arsip.
- **Release tooling baru** (`64b7fe6`): `scripts/preflight-release.mjs` sebagai gate release
  keras — verifikasi artefak build, deteksi `dist` yang stale terhadap `src`, pemindaian
  kebocoran nilai kredensial ke seluruh output build, dan pengecekan pin dependency desktop.
  Ditambah `scripts/check-desktop-pins.mjs` dan perintah root `preflight`, `preflight:bundle`,
  `check:pins`, `release`.
- **Installer tidak lagi membawa `.env`.** `buildApp.js` menyalin `server/.env.example`
  sebagai template, bukan `.env` developer, dan menolak build kalau ada `.env` asli di bundle.
  Build juga menolak lanjut tanpa `server/package-lock.json` (build reproducible via `npm ci`).

### 🎯 Akurasi Metodologi (SMC/ICT/MSNR)
- **SNR flip direction & wick-inclusive Order Block** (`065a75c`): arah flip RBS/SBR
  dikoreksi, dan deteksi OB kini menyertakan wick — bukan hanya body candle.
- **ATR noise filter untuk swing detection** (`f085457`): swing hanya valid kalau jaraknya
  dari swing sebelumnya melebihi ambang ATR, mengurangi level palsu. Ditambah 5 test case
  (TC-01…TC-05) di `server/src/services/strategies/__tests__/snr-flip.test.ts`.

### 🔌 Stabilitas MT5 & Shutdown
- **MT5 status snapshot otoritatif** dikirim saat WebSocket connect, dan **graceful shutdown**
  diperbaiki (`065a75c`). Ini menutup rangkaian bug dari post-mortem 2026-10-05: flag
  `mt5McpService.connected` tidak pernah disinkronkan dengan hasil auto-reconnect di
  `mt5-streamer.ts`, sehingga pipeline menahan `waitingReconnect` selamanya.

### 📝 Dokumentasi
- **`docs/DAILY_BRIEFING_PROTOCOL.md`** (`9771119`): protokol briefing harian Tim Dev 2 —
  struktur 5 blok, pre-build checklist, dan aturan delegasi.
- **`README.md` ditulis ulang**: Quick Start untuk user (install EXE) dan developer, tabel
  tech stack terverifikasi, prerequisites, workflow monorepo, contributing guidelines,
  diagram arsitektur + topologi runtime, tabel port, alur pipeline 4 stage, dan troubleshooting.
- **`docs/USER_GUIDE_MT5.md`**: ditambah bagian install EXE production.

### 🧹 Housekeeping
- Bersihkan script debug sekali pakai dari root `server/` (`64b7fe6`) — 57 file, termasuk
  `server/dev/null` berukuran 258 ribu baris yang ikut ter-track.

> **Blocker terbuka:** rotasi 9Router API key (lihat `docs/post-mortem-2026-10-05-mt5-9router.md`
> → Action Item #1). Nilai lama masih ada di git history; rotasi wajib sebelum release production.

---

## 🚀 [v1.1.0] — 2026-08-11 (Versi Terbaru)

### ✨ Fitur Baru: Reset AI Trading Performance
- **Tombol "Reset AI Trading Performance"** di Settings → Data & Privacy → Danger Zone (`frontend/src/app/(dashboard)/settings/page.tsx`).
- Menghapus seluruh AI Trade Histories, statistik P&L, dan performance pipeline untuk user yang sedang login (isolasi per-user via `req.user.id`).
- Memanfaatkan endpoint `POST /api/v1/ai-trading/reset-performance` yang sudah ada (`ai-trading.routes.ts`), didukung method baru `resetPerformance()` di `frontend/src/services/ai-trading.service.ts`.
- Dilengkapi dialog konfirmasi (`confirm`) dan feedback jumlah trade logs yang dihapus. Pipeline AI tetap berjalan normal — hanya history/statistik yang dihapus.
- **Verifikasi**: `tsc --noEmit` lolos; reset 205 trade logs berhasil via API.
- Semua `package.json` dan patch OTA di-bump ke **v1.1.0**.

---

## 🚀 [v1.0.15] — 2026-08-10

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