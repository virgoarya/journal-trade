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

### [20260729] Checklist 0/0 valid and Confidence Mismatch on Backtest
**Area**: Backend / Backtest / Confluence
**Root Cause**: 
1. `backtest.service.ts` did not build or pass `ipdaCtx` to the strategy `analyze` functions, causing confidence scores to lack IPDA daily bias adjustments present in the live pipeline.
2. `backtest.service.ts` passed `smcSignals[0] ?? null` instead of the full array to `calculateConfluence`, preventing `confluenceEngine` from mapping the full checklist structure if the best signal didn't meet confidence thresholds.
**Solusi**:
1. Added `ipdaContextService.buildContext` inside `backtest.service.ts` and passed `ipdaCtx` to `smcStrategy`, `ictStrategy`, `msnrStrategy`.
2. Passed the full arrays (`smcSignals` etc.) to `calculateConfluence` in `backtest.service.ts`, similar to `ai-trading-engine.service.ts`.
**Hindari**: Jangan biarkan backtest logic tertinggal saat memperbarui engine live trading. Keduanya harus disinkronisasikan (seperti saat implementasi IPDA context dan fixing array checklist passing).


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

### [20260724] Dynamic Multi-Timeframe Checklist (D1/H4/H1/M15-M5), HTF TP Max R:R (Min 1:2), Forex/Crypto Lot Cap & Dynamic Risk Capacity
**Area**: Backend / Strategies / Risk Management / Frontend
**Root Cause**:
1. Entry timeframe sebelumnya menggunakan M1 yang sangat tinggi noise-nya di real market.
2. Checklist item di strategy engine sempat bernilai static `PASSED` hardcoded dan belum mengevaluasi data candle OHLC D1/H4/H1/M15-M5 secara berurutan.
3. Kalkulasi lot Forex cross (seperti quote JPY) dan BTCUSD mengalami masalah konversi quote currency atau tidak memiliki hard cap 1.0 lot.
4. Pengecekan jumlah posisi terbuka sebelumnya kaku (fixed open count) sehingga posisi berisiko rendah tidak bisa menambah posisi baru.
**Solusi**:
1. Hapus M1 dari `getFractalTimeframes`. Set timeframe konfirmasi entry terkecil ke M15 atau M5.
2. Unduh rates D1, H4, H1, dan M15/M5 di `ai-trading-engine.service.ts` dan teruskan `daily` context ke strategi.
3. Tentukan Take Profit (TP) di struktur level HTF (D1/H4) sebelum konfirmasi entry LTF untuk memaksimalkan R:R (selalu >= 1:2). Filter out sinyal dengan R:R < 1:2.
4. Terapkan konversi Quote Currency pada `calculatePositionSize` dan tetapkan Hard Cap maksimal 1.0 lot per posisi untuk forex & crypto (BTCUSD).
5. Terapkan Dynamic Risk Capacity pada `risk-manager.service.ts` berbasis persentase total open risk akun, bukan sekadar jumlah posisi kaku.
6. Sertakan status Pending Order Limit placed di M15/M5 pada checklist item SMC, ICT, dan Malaysian SNR.
**Hindari**: Jangan pernah menggunakan M1 untuk entry signal. Jangan hardcode status `PASSED` pada checklist items. Selalu pastikan R:R minimal 1:2 terpenuhi dan lot size dibatasi 1.0 lot max.

### [20260724] Cascading Waterfall Checklist & Pipeline Step Error Swallowing
**Area**: Backend / Strategies / Pipeline
**Root Cause**:
1. **Checklist status tidak logis**: Item checklist strategi (SMC, ICT, MSNR) mengevaluasi setiap kondisi secara independen tanpa memperhatikan urutan ketergantungan. Ini menyebabkan item WAITING (kuning) muncul di antara item PASSED (hijau) — misalnya: BOS=PASSED, OB=PASSED, FVG=WAITING, Liquidity=PASSED. Ini secara visual membingungkan karena jika prerequisite belum terpenuhi, item berikutnya seharusnya tidak bisa PASSED.
2. **Trade APPROVED tapi no MT5 order**: Setelah LLM CONSENSUS APPROVED di step [4/7], jika step 5-7 (getAccountInfo, getSymbolInfo, openOrder) throw exception, error ditangkap oleh generic catch-all handler yang hanya log `Pipeline error: <message>` tanpa menunjukkan di step mana gagalnya.
3. **ICT signalType decomposition**: Signal types ICT (`AMD_FVG`, `SWEEP_FVG`, `OTE_AMD`, `JUDAS_SWEEP`) tidak di-decompose per-konsep individual, sehingga item checklist PO3 (cek `includes("AMD")`) bisa PASSED tapi FVG (cek `includes("FVG")`) bisa WAITING padahal signal type mengandung keduanya.
**Solusi**:
1. Implementasi **Cascading Waterfall Logic** pada ketiga `buildXXXChecklist()`: setiap item checklist dievaluasi kondisinya, tapi status-nya hanya bisa PASSED jika SEMUA prerequisite sebelumnya juga PASSED. Jika prerequisite WAITING, semua item berikutnya otomatis WAITING.
2. Wrap setiap step 5/6/7 dalam individual try-catch dengan log error spesifik per step (`[5/7] MT5 DATA FAILED`, `[6/7] VALIDATION ERROR`, `[7/7] MT5 ORDER EXCEPTION`).
3. Decompose `sig.signalType` ICT ke variabel boolean individual (`hasAMD`, `hasFVG`, `hasOTE`, `hasSweep`) sebelum evaluasi checklist.
4. Tambahkan numbering ①②③④⑤⑥⑦ pada label checklist agar urutan langkah pembentukan sinyal terlihat jelas di UI.
**Hindari**: Jangan evaluasi checklist item secara flat/independen tanpa memperhatikan urutan dependensi. Jangan biarkan exception step 5-7 jatuh ke generic catch-all tanpa log granular per-step.

### [20260728] Backtest Browser Performance Optimization (Equity Curve Downsampling & Table Pagination)
**Area**: Frontend / Backend / Backtest / Performance
**Root Cause**:
1. **Unbounded SVG Points**: `result.equityCurve` menyimpan puluhan ribu data point candle. Mempassing puluhan ribu node ke Recharts `AreaChart` menyebabkan browser UI thread nge-freeze total dan animasi Recharts mencoba merender ribuan elemen SVG sekaligus.
2. **DOM Node Inflation**: `Trade History` merender ribuan elemen `<tr>` secara langsung di DOM tanpa batas/paginasi.
3. **Payload Bloat**: Server menyimpan dan mengirimkan ribuan data point `equityCurve` yang tidak ter-downsample lewat JSON API response.
**Solusi**:
1. Impor `useMemo` di `BacktestResult.tsx` dan filter/downsample `equityCurve` maksimal 300 data point untuk grafik chart.
2. Matikan animasi SVG Recharts dengan `isAnimationActive={false}`.
3. Tambahkan paginasi pada `Trade History` (50 baris per halaman) dengan tombol Navigasi Next/Prev.
4. Downsample `equityCurve` di `BacktestStreamView.tsx` dan di backend `backtest.service.ts` maksimal 300-500 data point sebelum disimpan/dikirim.
**Hindari**: Jangan pernah mempassing raw array `equityCurve` atau list trade ribuan baris langsung ke komponen SVG Recharts atau DOM tanpa downsampling dan paginasi.

### [20260728] Defensive Render Safe-Guards & Float PnL Metric Synchronization
**Area**: Frontend / Backtest / Error Recovery / State Synchronization
**Root Cause**:
1. **Completion Crash ("This page couldn't load")**: Panggilan `.toFixed()` atau `new Date().toLocaleString()` tanpa pemodelan safe fallback pada nilai `undefined`/`null` di `BacktestResult.tsx` memicu `TypeError` tak tertangkap saat rendering React. Hal ini menyebabkan crash pada Error Boundary Next.js.
2. **Confusing Float Metric**: Tampilan `Float` saat tidak ada posisi mengambang menampilkan `+0` kaku tanpa format mata uang `$0.00`, dan timer interval 500ms yang bersaing dengan event SSE `trade_open`/`trade_close` sempat meriset state `liveTrades`.
**Solusi**:
1. Mengubah `BacktestResult.tsx` menggunakan safe helpers (`safeNum`, `safeFixed`, `safeDateStr`) dan membungkusnya dengan `React.ErrorBoundary`.
2. Menyelaraskan event SSE `equity`, `trade_open`, dan `trade_close` secara langsung pada `liveTrades` tanpa race condition interval.
3. Memformat tampilan `Float` dengan mata uang yang jelas (`$0.00` saat 0 posisi, `+$XX.XX` saat profit, dan `-$XX.XX` saat rugi).
**Hindari**: Jangan pernah memanggil `.toFixed()` atau `new Date()` pada properti dinamis tanpa safe fallback. Selalu sertakan ErrorBoundary pada komponen UI utama.

### [20260728] Dynamic Waterfall Checklist Validator & Zero-Hardcode Architecture
**Area**: Backend / Strategies / Refactoring
**Root Cause**: Sebelumnya fungsi pembentuk checklist di setiap strategi (SMC, ICT, MSNR) mengulang-ulang logika helper lokal `s(...)` dan memproduksi ekspresi boolean panjang yang rawan human error (`step1 && step2 && step3...`). Selain itu status item daily sempat statis `"PASSED"`.
**Solusi**:
1. Membuat modul helper terpusat [checklist-validator.ts](file:///d:/Journal%20Trade/server/src/services/strategies/checklist-validator.ts) yang mengevaluasi skenario *cascading waterfall* secara otomatis (`evaluateWaterfall`).
2. Mengubah semua item checklist pada [smc.strategy.ts](file:///d:/Journal%20Trade/server/src/services/strategies/smc.strategy.ts), [ict.strategy.ts](file:///d:/Journal%20Trade/server/src/services/strategies/ict.strategy.ts), dan [msnr.strategy.ts](file:///d:/Journal%20Trade/server/src/services/strategies/msnr.strategy.ts) menjadi 100% terevaluasi secara dinamis tanpa status hardcoded.
3. Menyediakan helper umum `calculateRR`, `checkEntryRetest`, dan `getSwingPrices` untuk konsistensi di seluruh strategi.
**Hindari**: Jangan pernah menuliskan status `"PASSED"`/`"WAITING"` secara hardcoded pada checklist item. Selalu gunakan `evaluateWaterfall()` untuk menjaga logika cascading prerequisite konsisten.

### [20260728] HTF Direction Structure Precedence Misalignment
**Area**: Backend / Strategies / Confluence
**Root Cause**: Sebelumnya ketiga file strategi (`smc.strategy.ts`, `ict.strategy.ts`, `msnr.strategy.ts`) mengambil objek struktur HTF menggunakan `const htfStr = fractal.dailyStr || fractal.directionStr;`. Karena `fractal.dailyStr` (D1) selalu terdefinisi, variabel `htfStr` selalu mengambil D1 sebagai struktur HTF. Saat trend D1 Bearish tetapi trend HTF Direction (H1/H4) Bullish, header kartu di UI menampilkan `HTF Direction: Bullish`, namun label checklist item ① mengevaluasi D1 dan mencetak `H1 Break Of Structure Bearish`.
**Solusi**:
1. Mengubah urutan prioritas struktur HTF di ketiga file strategi menjadi `const htfStr = fractal.directionStr || fractal.dailyStr;`.
2. Dengan begitu, kriteria pembentukan sinyal dan label item ① konsisten menggunakan trend HTF Direction (`directionStr`, misal H1/H4).
**Hindari**: Jangan mendahulukan `dailyStr` untuk variabel `htfStr` jika `directionStr` adalah acuan utama HTF Direction yang dipakai oleh engine konfluensi.

### [20260728] 3-Candle Daily Bias Pattern Recognition (Continuation vs Reversal)
**Area**: Backend / Strategies / Pattern Recognition
**Root Cause**: Sebelumnya item 0 checklist hanya menampilkan `Daily Direction : Bullish / Bearish / Sideways` secara kaku tanpa informasi struktur pola 3 candle Daily (BOS 50% Equilibrium vs Sweep PDL/PDH Rejection).
**Solusi**:
1. Menambahkan fungsi `analyzeDaily3CandleBias(candles)` pada [checklist-validator.ts](file:///d:/Journal%20Trade/server/src/services/strategies/checklist-validator.ts).
2. Mengevaluasi pola 3 candle Daily ke belakang:
   - `Daily Continuation`: Candle 2 BOS + Candle 3 holding 50% Equilibrium Candle 2 ➔ Target PDH / PDL.
   - `Daily Reversal`: Candle 2/3 Sweep PDL/PDH + Candle 3 Bullish/Bearish Close Rejection ➔ Target PDH / PDL.
3. Item 0 checklist di seluruh strategi kini menampilkan label dan detail target PDH/PDL secara dinamis.
**Hindari**: Jangan mengabaikan pergerakan 3 candle Daily saat menentukan bias harian. Selalu perhitungkan level 50% Equilibrium dan Sweep PDL/PDH.

### [20260728] Pure SMC Dogma Terminology & H1 Bullish OB Detection
**Area**: Backend / Strategies / SMC Methodology
**Root Cause**: Penggunaan istilah teknis SMC pada checklist sebelumnya kurang sesuai dengan doktrin/akidah asli SMC (seperti menyatukan BOS/CHOCH tanpa pembeda PD Array Discount/Premium dan SSL/BSL Sweep).
**Solusi**:
1. Mengubah struktur deteksi `detectOrderBlocks` pada [market-structure.service.ts](file:///d:/Journal%20Trade/server/src/services/strategies/market-structure.service.ts) untuk mengidentifikasi candle basis sebelum pergerakan impulsif yang menghasilkan **CHoCH** (penembusan Swing High) dan **SSL Sweep** (wick bawah di bawah Swing Low).
2. Memperbarui penamaan item checklist [smc.strategy.ts](file:///d:/Journal%20Trade/server/src/services/strategies/smc.strategy.ts) sesuai akidah murni SMC:
   - `Sell-Side Liquidity (SSL) Swept`
   - `H1 Bullish Order Block (Discount PD Array : XXXXX - XXXXX) [Displacement + CHoCH]`
   - `H1 CHoCH Confirmation (Breakout above Swing Level XXXXX)`
   - `Retest Discount PD Array Zone (Pending BUY Limit)`
**Hindari**: Jangan menggunakan terminologi generik jika ada terminologi baku baku SMC/ICT (seperti Discount PD Array & SSL/BSL Sweep).

### [20260728] M5 Refinement Entry (H1 POI Retest ➔ M5 CHoCH + M5 OB Limit Entry ➔ Target PDH/PDL)
**Area**: Backend / Strategies / Multi-Timeframe Refinement
**Root Cause**: Sebelumnya entry SMC hanya mendeteksi Order Block di timeframe tunggal tanpa konfirmasi konfluen multi-timeframe (retest H1 POI diikuti M5 CHoCH + M5 OB Limit Entry).
**Solusi**:
1. Menambahkan method `detectM5ConfirmationEntry()` pada [smc.strategy.ts](file:///d:/Journal%20Trade/server/src/services/strategies/smc.strategy.ts).
2. Alur Eksekusi:
   - Tahap 1: Memastikan harga telah menyentuh/retest area H1 Order Block (`h1OrderBlock`).
   - Tahap 2: Beralih ke timeframe M5 (`entryStr`) untuk mengonfirmasi M5 CHoCH dan terbentuknya M5 Order Block (`m5OB`).
   - Tahap 3: Begitu M5 CHoCH terkonfirmasi (Item ④ Passed), Item ⑤ langsung aktif memasang order **Pending Limit Order pada M5 OB Top (untuk BUY)** atau **M5 OB Bottom (untuk SELL)** menargetkan **PDH / PDL**.
**Hindari**: Jangan menunda pemasangan Pending Limit Order M5 setelah M5 CHoCH & M5 OB terbentuk. Langsung aktifkan order begitu Item 4 terkonfirmasi Passed.

### [20260728] Fix H1 OB Retest Detection & HTF Context Lock
**Area**: Backend / Strategies / SMC Methodology
**Root Cause**: Saat harga sedang menyentuh/retest H1 OB, `hasHTFContext()` mengembalikan `false` karena `ob.touchCount > 0` belum ter-update atau `mitigated` bernilai `true`. Akibatnya seluruh detector sinyal mengembalikan `null` dan UI menampilkan "Checklist validasi belum tersedia untuk metodologi ini (0/0 Valid)".
**Solusi**:
1. Memperbarui `hasHTFContext()` untuk mengecek apakah harga saat ini berada di dalam/dekat zone H1 OB `[bottom - 2*ATR, top + 2*ATR]`.
2. Pada `detectM5ConfirmationEntry()`, jika M5 OB sekunder belum terbentuk sempurna tetapi H1 OB sedang ter-retest, sistem tetap membentuk sinyal **Pending BUY Limit pada H1 OB Top** agar checklist menampilkan 6/6 item valid secara lengkap.
**Hindari**: Jangan pernah menyaring `orderBlocks` secara ketat hanya berdasarkan `!ob.mitigated` jika harga saat ini sedang aktif ter-retest.

### [20260728] Fix UI "Checklist validasi belum tersedia" (0/0 Valid) Glitch
**Area**: Backend & Frontend / Confluence & UI State
**Root Cause**: Sebelumnya `ai-trading-engine.service.ts` hanya mengirimkan `smcSignals[0]` ke `confluenceEngine.calculateConfluence()`. Saat sinyal pertama bernilai `null` atau `confidence < 50`, `confluenceEngine` memotong array `checklistByMethodology` sehingga frontend menerima data breakdown kosong (`0/0 Valid`).
**Solusi**:
1. Memperbarui `ai-trading-engine.service.ts` untuk mempassing seluruh array sinyal strategi (`{ smc: smcSignals, ict: ictSignals, msnr: msnrSignals }`).
2. Memperbarui `getActiveChecklist()` pada [MethodologyConfluence.tsx](file:///d:/Journal%20Trade/frontend/src/app/%28dashboard%29/ai-trading/components/MethodologyConfluence.tsx) untuk melakukan fallback otomatis ke `confluence.checklistByMethodology` sehingga tab NET / SMC / ICT / MSNR selalu menampilkan item checklist secara utuh.
**Hindari**: Jangan pernah melepas fallback checklist pada komponen UI konfluensi agar status pemindaian selalu transparan kepada user.

### [20260802] Hardcoded Unix Path di registerAitrados Crash Windows
**Area**: Backend / MCP Service
**Root Cause**: Method `registerAitrados()` di `mcp.service.ts` hardcoded path Unix `/usr/local/bin/finance-trading-ai-agents-mcp`. Di `index.ts`, `mcpBinPath()` sudah resolve path per-OS dengan benar, tapi TIDAK mempassing path tersebut ke method. Selain itu, `child.on("error")` melakukan `throw` di dalam event listener yang menyebabkan uncaught exception crash.
**Solusi**: Tambah parameter `commandPath: string` ke `registerAitrados()`. Fix error handler menggunakan Promise pattern untuk menangkap spawn error secara graceful.
**Hindari**: Jangan hardcode path binary di dalam method yang dipanggil lintas platform. Jangan `throw` di dalam event listener `child.on("error")` — selalu gunakan Promise/callback pattern.

### [20260802] Migrasi Railway ke Full Local Setup
**Area**: Backend / Python Client / Frontend
**Root Cause**: Semua komponen (Python EXE, Node.js backend, frontend) masih hardcode URL Railway (`wss://journal-trade-production.up.railway.app`). Saat tidak ada Railway, Python EXE gagal connect dan backend terus retry.
**Solusi**: Ganti semua URL ke `ws://localhost:5000/ws/mt5-stream` (Python), deteksi otomatis dari `window.location` (frontend), dan hapus referensi "Railway" dari semua log/UI messages.
### [20260803] Electron Desktop App Bundling (Next.js Standalone + Express Server)
**Area**: Desktop / Electron / Next.js / Backend
**Root Cause**: 
1. `next.config.ts` memerlukan `output: 'standalone'` agar Next.js membundel runtime server minimal di `.next/standalone`. Namun, aset statis (`.next/static`) dan folder `public/` TIDAK otomatis disalin ke folder standalone oleh Next.js, sehingga electron-builder harus mengikutsertakan keduanya via `extraResources`.
2. Pada Windows, `spawn("npx", ...)` tanpa `.cmd` atau tanpa shell execution gagal menemukan executable `npx`.
3. Jika backend atau frontend sudah berjalan di terminal developer (port 5000 / 3000), spawning kedua kali akan memicu port collision.
4. Pada packaged Electron app di Windows, `spawn(process.execPath, ...)` dengan `ELECTRON_RUN_AS_NODE: "1"` sering kali diabaikan oleh Electron 35 dan justru meluncurkan instance GUI baru (recursive GUI window).
**Solusi**:
1. Konfigurasikan `extraResources` di `electron-builder.yml` untuk memetakan `frontend/.next/standalone`, `frontend/.next/static`, `frontend/public`, `server/dist`, `server/node_modules`, dan `server/.env`.
2. Pada `desktop/main.js`, tambahkan pengecekan HTTP health check sebelum spawn (`isPortResponding`). Jika port 5000 / 3000 sudah aktif, lewati spawn.
3. Gunakan `utilityProcess.fork(scriptPath, args, options)` di production mode. `utilityProcess` adalah API resmi Electron untuk menjalankan background Node.js child processes tanpa membuka window atau memerlukan Node.js eksternal.
**Hindari**: Jangan gunakan `spawn(process.execPath)` untuk child node script di packaged Electron; selalu gunakan `utilityProcess.fork()`. Hindari membundel virtualenv Python yang berisi puluhan file `.exe` yang memperlambat signtool.




