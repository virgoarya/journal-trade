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

### [20260806] Floating PnL not displaying in AccountOverview
**Area**: Frontend / MT5 Integration
**Root Cause**: `AccountOverview` component was using `accountInfo.profit` for "Floating P&L". In native MT5 MCP, `accountInfo.profit` represents the cumulative profit/loss from *closed* trades (or total account profit), not the floating PnL of *open* positions. The actual floating PnL needs to be calculated by summing the `profit` field from all active `positions`.
**Solusi**:
1. Modified `AccountOverview.tsx` to accept a `positions` prop.
2. Calculated `floatingPnL` by `positions.reduce((sum, pos) => sum + (pos.profit ?? 0), 0)`.
3. Passed the `positions` prop from `page.tsx` to `AccountOverview.tsx`.
**Hindari**: Selalu pastikan metric di UI sesuai dengan definisi bisnisnya. "Floating P&L" secara spesifik merujuk pada profit/loss posisi yang masih terbuka.

### [20260805] MT5 Native MCP Field Name Normalization for Positions
**Area**: Backend / MT5 Integration / Native MCP
**Root Cause**: Native MT5 MCP `get_trading_open_positions` returns positions with different field names than the legacy Python bridge:
- `position_id` (not `ticket`/`id`)
- `price_last` (not `price_current`)
- `stop_loss` / `take_profit` (not `sl` / `tp`)
- `create_time`/`update_time` as datetime string (not unix timestamp)
- `action` with values "buy"/"sell" (lowercase)
- No `swap`, `commission`, `magic` fields in response
**Solusi**: Updated `normalizePosition()` in `mt5-streamer.ts` to map native field names to internal format. Position profit and contract size are correctly transmitted in native MCP response.
**Hindari**: Jangan mengasumsikan field names sama di semua MCP tool. Selalu verifikasi struktur response lewat `client.callTool()`.

### [20260805] MT5 MCP Python Server Tools Update Requirements
**Area**: Python Client / MCP Server
**Root Cause**: Node.js backend (MT5-MCP service) kept getting `MCP error -32602: tool not found` and caused LLMs to hibernate because the Python MCP server tools (e.g. `get_trading_open_positions` -> `mt5_positions_get`) were updated in `server.py`, but the Python executable was not rebuilt. The `MT5-MCP` service spawns the packaged executable `Hunter Trades AI Trading.exe`, not the raw Python script.
**Solusi**: Ran `server/mcp-mt5-server/build.bat` to re-compile `Hunter Trades AI Trading.exe` with the new tool names so the Node backend can discover them.
**Hindari**: JANGAN PERNAH lupa menjalankan `build.bat` setelah mengubah kode apapun di dalam `server/mcp-mt5-server` (termasuk mengganti nama tool MCP) karena perubahan tidak akan termuat di *production build* sampai executable-nya dikompilasi ulang.

### [20260805] MT5 Native MCP Missing Historical Data (copy_rates_range)
**Area**: Backend / MT5 Integration / Backtest
**Root Cause**: Native MT5 MCP (`http://127.0.0.1:22346/mcp`) tidak memiliki tool untuk mengambil data historis OHLCV (seperti `copy_rates_range` atau `copy_rates_from`). Ketika backtest meminta data candle, MCP merespon dengan `MCP error -32602: tool not found`.
**Solusi**:
1. Buat script python lightweight (`server/fetch_rates.py`) yang menggunakan library `MetaTrader5` via direct memory (bukan via MCP) untuk mengambil data `copy_rates_range` dan `copy_rates_from_pos`.
2. Pada `executeMt5Command` di `mt5-streamer.ts`, override case `mt5_copy_rates` dan `mt5_copy_rates_range` dengan melakukan spawn `execFileAsync` ke script python tersebut dan me-return datanya (bukan meneruskannya ke MCP Client).
**Hindari**: Jangan mengasumsikan Native MCP support seluruh method yang ada di library python `MetaTrader5`. Untuk data historis, MT5 Python bridge (atau eksekusi CLI script) masih wajib digunakan.

### [20260804] Per-User Native MT5 MCP API Key Architecture & User Onboarding
**Area**: Frontend / Backend / Documentation / MT5 Integration
**Root Cause**: 
Dalam arsitektur multi-user, setiap trader/user menjalankan terminal MetaTrader 5 sendiri dengan API Key unik yang digenerate oleh internal MT5 (*Tools ➜ Options ➜ Tab MCP*). Jika sistem meminta password broker, user ragu karena masalah privasi dan risiko credential exposure.
**Solusi**:
1. Modifikasi model `MT5Connection` untuk menyimpan `apiKeyEncrypted` dan `mcpUrl` terenkripsi AES-256-CBC.
2. Sederhanakan UI `ConnectionPanel.tsx` dan halaman Settings: Input utama adalah **MT5 MCP API Key** (dengan tombol *Paste Clipboard* dan petunjuk visual).
3. Bangun modal User Guide interaktif di dalam UI dan dokumentasi lengkap di `docs/USER_GUIDE_MT5.md` untuk memandu user cara mengaktifkan internal server di MT5 dan menyalin API Key tanpa perlu memasukkan password broker.
4. Dukung auto-reconnect saat backend restart menggunakan token API Key tersimpan.
**Hindari**: Jangan pernah memaksa user menginput password master broker jika koneksi native MCP token-based sudah tersedia.

### [20260804] Native MT5 MCP Tool Names & Response Normalization
**Area**: Backend / MT5 Integration / Native MCP
**Root Cause**: Native MT5 MCP Server (`http://127.0.0.1:22346/mcp`) memiliki skema nama tool spesifik bawaan MetaQuotes:
- `get_trading_account_info` (bukan `get_account_info` atau `mt5_account_info`)
- `get_trading_open_positions` (bukan `get_positions` atau `mt5_positions_get`)
- `get_marketwatch_symbols` (bukan `get_symbols` atau `mt5_symbols_get`)
- `trade_send_market_order` / `trade_send_pending_order` (bukan `mt5_order_send`)
- `trade_close_single_position` (bukan `mt5_position_close`)
- `trade_modify_sl_tp` (bukan `mt5_position_modify`)
Memanggil nama generic/lama memicu `MCP error -32602: tool not found`.
**Solusi**:
1. Buat mapping router di `executeMt5Command` dan `startPolling` di `server/src/mt5-streamer.ts` yang menerjemahkan action internal ke nama tool native MT5 MCP resmi.
2. Normalisasi field payload (seperti `account.margin_free` -> `freeMargin`, `marginLevel`, safe floating spread).
**Hindari**: Jangan mengasumsikan nama tool MCP standar — selalu inspect langsung via `client.listTools()`.


### [20260804] Native MT5 MCP Migration & Client Capabilities Config
**Area**: Backend / MT5 Integration / MCP
**Root Cause**: 
1. MT5 Desktop terbaru memiliki fitur Native MCP Server internal (`http://127.0.0.1:22346/mcp`), sehingga Python client bridge (`Hunter Trades AI Trading.exe`) menjadi usang/redundant.
2. Inisialisasi `@modelcontextprotocol/sdk` `Client` hanya boleh mendeklarasikan *client capabilities* (seperti `roots`, `sampling`), bukan tool/resource capabilities server (yang menyebabkan TypeScript compilation error `TS2353`).
**Solusi**:
1. Gunakan `eventsource` polyfill bersama `SSEClientTransport` untuk koneksi lokal direct loopback ke port 22346 dengan API Key.
2. Set capabilities client ke `{}`.
3. Hapus dependency spawning binary Python dari `desktop/main.js` dan `electron-builder.yml`.
**Hindari**: Jangan mendefinisikan tools/resources di opsi Client MCP SDK karena tools disediakan oleh Server, bukan Client.


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
### [20260803] Windows Node.js c-ares querySrv ECONNREFUSED & Non-blocking HTTP Server Startup
**Area**: Backend / Network / MongoDB Atlas / Electron Desktop
**Root Cause**: 
1. Pada Windows, default Node.js c-ares DNS resolver yang mengandalkan local loopback/router DNS sering mengembalikan `querySrv ECONNREFUSED` saat melakukan lookup SRV record MongoDB Atlas (`_mongodb._tcp...`).
2. Express `server.listen(PORT)` yang diletakkan di dalam promise `connectDB().then(...)` membuat port 5000 tidak pernah terbuka jika MongoDB gagal/tertunda terhubung, sehingga Electron `waitForServer(5000)` mengalami timeout 60 detik.
**Solusi**: 
1. Gunakan DNS fallback terpercaya (`1.1.1.1`, `8.8.8.8`) via `dns.setServers(["1.1.1.1", "8.8.8.8", "1.0.0.1", "8.8.4.4"])` yang mendukung query SRV secara cepat dan stabil di Windows.
2. Selalu jalankan `server.listen(PORT)` seketika di awal script Express, sehingga endpoint `/health` langsung merespons `200 OK` dalam hitungan milidetik, sementara koneksi Database MongoDB dan background workers berjalan asinkron tanpa memblokir startup window aplikasi.
**Hindari**: Jangan menunda pembukaan HTTP listener di belakang koneksi database eksternal yang rentan terhadap latensi jaringan.

### [20260803] Electron-Builder node_modules Pruning & utilityProcess Bad Option Crash
**Area**: Desktop / Electron Builder / Backend Packaging
**Root Cause**: 
1. `electron-builder` secara otomatis melakukan pruning (menghapus) dependencies `node_modules` backend di folder `resources/server/node_modules` jika root package.json tidak mendefinisikannya, yang mengakibatkan error fatal `Cannot find module 'express'`.
2. Jika `utilityProcess.fork()` dijalankan dengan environment variable `ELECTRON_RUN_AS_NODE: "1"`, Chromium IPC flags internal (seperti `--type=utility`, `--user-data-dir`, `--service-sandbox-type`) akan diperlakukan sebagai Node CLI flags, sehingga Node.js melempar error `bad option: --type=utility` dan langsung terminate seketika.
**Solusi**:
1. Buat build hook `desktop/buildHooks/afterPack.js` yang dijalankan di konfigurasi `afterPack` `electron-builder.yml` untuk menyalin folder `server/node_modules` langsung ke folder output `release/win-unpacked/resources/server/node_modules` setelah proses packaging electron-builder selesai.
2. Gunakan `utilityProcess.fork(serverScript, [], { stdio: 'pipe' })` **tanpa** menyertakan `ELECTRON_RUN_AS_NODE` dan `ELECTRON_NO_ASAR`. `utilityProcess` sudah secara native berjalan di lingkungan Node tanpa flag tersebut.
**Hindari**: Jangan mengandalkan `extraResources` semata untuk direktori `node_modules` yang besar tanpa afterPack hook jika ada mekanisme dependency pruning dari electron-builder. Jangan pernah menyetel `ELECTRON_RUN_AS_NODE: "1"` saat memanggil `utilityProcess.fork()`.
### [20260808] AI Trading Pure AI Order Execution, Confluence Priority & UI Pending Orders Card
**Area**: Frontend / Backend / Risk Management / LLM Consensus
**Root Cause**: 
1. Penentuan order type (Market vs Pending) sebelumnya membutuhkan toggle UI manual yang membingungkan alih-alih diserahkan sepenuhnya ke keputusan algoritma AI.
2. Tab NET Confluence sempat menggabungkan checklist dari semua metodologi sehingga checklist dari metodologi non-prioritas bisa membingungkan user.
3. Posisi pending orders sebelumnya belum terpisah dari open market positions pada tampilan UI `PositionsTable`.
**Solusi**:
1. Hapus toggle manual; biarkan engine menentukan `BUY_LIMIT`/`SELL_LIMIT` vs `BUY`/`SELL` otomatis berdasarkan `minPendingDist` terhadap `currentPrice`.
2. Sediakan property `priorityChecklist` di `confluenceEngine` yang hanya memuat checklist dari metodologi ber-confidence tertinggi untuk tab NET.
3. Pisahkan tampilan Pending Orders ke dalam card khusus di bawah Open Positions card pada `PositionsTable.tsx`.
4. Render hasil LLM Consensus dalam card/embed terpisah per model di `PipelineLogs.tsx`.
**Hindari**: Jangan mencampur checklist antar metodologi di tab NET. Selalu utamakan prioritas dari primary methodology.


### [20260810] Next.js Standalone: Static Assets Harus di .next/static
**Area**: Frontend / Build / Electron Packaging
**Root Cause**: `buildApp.js` menyalin static ke `resources/frontend/_next/static`, tapi Next.js standalone `server.js` membaca aset dari `.next/static` (relatif ke lokasi server.js). Akibatnya CSS/JS 404 → halaman tanpa styling.
**Solusi**: Ubah `runRobocopy(frontend/.next/static, targetFrontend/.next/static)` — path `.next/static` bukan `_next/static`.
**Hindari**: Selalu verifikasi `resources/frontend/.next/static/css` ada setelah buildApp.js. Jangan pakai `postinstall` npm di root yang memanggil install subdirectory (timeout berantai).

### [20260810] ignoreBuildErrors:true Menyembunyikan Bug Runtime
**Area**: Frontend / TypeScript
**Root Cause**: `next.config.ts` pakai `typescript.ignoreBuildErrors: true` → build sukses meski ada 18 error TS, termasuk `useEffect` dipakai tanpa import di PipelineLogs.tsx → ReferenceError → halaman AI trading crash "This page couldn't load".
**Solusi**: Aktifkan type checking (`ignoreBuildErrors: false`) dan jalankan `npx tsc --noEmit` sebelum build. Fix semua error: PipelineStatus.circuitBreakerReason, PipelineConfig.smartRisk.globalDrawdownLimit, BacktestConfig.maxDailyRisk, BacktestStreamView sessionStats type, OtaUpdaterModal setUpdateInfo.
**Hindari**: JANGAN pernah matikan type checking di produksi. Error TS yang lolos = bug runtime.

### [20260810] Debug "This page couldn't load" di Halaman Spesifik
**Area**: Frontend / Debugging
**Root Cause**: Dashboard OK tapi 1 halaman crash = error JS spesifik di komponen halaman itu (bukan aset).
**Solusi**: (1) Scan import React hooks hilang (useEffect/useMemo/useCallback tanpa import). (2) `npx tsc --noEmit` untuk error tersembunyi. (3) Scan module-scope browser API (window/localStorage) yang crash SSR. (4) Verifikasi via frontend standalone + browser biasa (Electron DevTools Ctrl+Shift+I sering nonaktif di packaged).
**Hindari**: Jangan tebak error — selalu scan kode dulu.

### [20260810] npm Reinstall Mengubah Versi Library → Type Error Baru
**Area**: Backend / Dependencies
**Root Cause**: `rm -rf node_modules` + install ulang mengubah versi (mongoose, mongodb, better-auth, ai SDK, @modelcontextprotocol) → type error baru.
**Solusi**: `noImplicitAny: false` di tsconfig, cast constructor (`const ObjectIdCtor: any = mongoose.Types.ObjectId`), `as any` untuk opsi baru, tipe eksplisit untuk array kosong (hindari `never[]`).
**Hindari**: Setelah reinstall besar, selalu jalankan `npx tsc` dan fix error sebelum build. npm install Windows butuh timeout 900000.


### [20260810] Skeleton Stuck di PositionsTable — Infinite Loop useEffect
**Area**: Frontend / React Hooks
**Root Cause**: `usePositions.ts` menaruh `positions.length` & `orders.length` di dependency `useEffect`. Setiap WebSocket kirim update posisi → length berubah → useEffect re-run → `setIsLoading(true)` → tapi karena data sudah ada, `fetchPositions()` tidak dipanggil → `setIsLoading(false)` tidak pernah jalan → skeleton stuck selamanya.
**Solusi**: (1) `isInitialLoadingRef` — hanya set loading saat mount pertama. (2) WebSocket onTick set `setIsLoading(false)` saat data real-time sampai. (3) Fetch hanya jika data kosong.
**Hindari**: Jangan gabungkan data.length di useEffect dependency dengan flag isLoading yang dikontrol terpisah. WebSocket = sumber data utama; fetch HTTP hanya fallback awal.

### [20260811] Reset Data via API: Better-Auth Signed Cookie + Dua Database Berbeda
**Area**: Backend / Auth / MongoDB
**Root Cause**: Panggil `POST /api/v1/ai-trading/reset-performance` secara manual selalu gagal `UNAUTHORIZED` karena format sesi better-auth v1.5.6 salah:
1. Token sesi di DB disimpan **mentah** (base64url 32 char), BUKAN sha256 — route dev `dev-test.routes.ts` yang pakai sha256 sudah usang/broken.
2. Cookie `better-auth.session_token` adalah **signed cookie**: `value.signature` dengan signature = HMAC-SHA256(key=`BETTER_AUTH_SECRET`, msg=token) di-encode **base64 standar 44 char berakhiran `=`** (bukan base64url) — lihat `better-call/dist/crypto.mjs` `makeSignature`.
3. Mongo adapter mapping `id↔_id`: field `userId` di collection `session` bertipe **ObjectId** (bukan string), dan join user via `$lookup` gagal jika tipe tidak sama.
4. Ada **dua database**: data bisnis (`journal_trade_dev` — dari path di `DATABASE_URL`), auth (`journal_trade_dev_local` — dari `DATABASE_NAME`). Script harus tahu bedanya.
**Solusi**: Buat sesi via insert manual: `user` dengan `_id: new ObjectId(userId)` (upsert jika belum ada), `session` dengan `token` mentah + `userId: new ObjectId(userId)`, lalu kirim cookie signed. Cek dulu lokasi data (collection `ai_trade_logs` untuk AI trades, bukan `aitradelogs`).
**Hindari**: Jangan menebak format sesi — baca source `node_modules/better-auth/dist` dan `@better-auth/mongo-adapter/dist` dulu. Jangan pernah simpan token yang tercetak di chat; hapus sesi buatan setelah selesai.

### [20260811] Bump Versi ≠ Build Exe/OTA — Workflow Release Lengkap
**Area**: Build / Release / Desktop
**Root Cause**: Bump versi di package.json saja TIDAK menghasilkan `Hunter Trades.exe` maupun patch OTA — keduanya langkah build terpisah yang tidak jalan otomatis.
**Solusi** (urutan benar): (1) Bump versi di 5 file: `package.json`, `server/package.json`, `frontend/package.json`, `desktop/package.json`, `update/version.json` + entri CHANGELOG. (2) `npm run build` di `frontend` (5-10 menit, timeout 900000). (3) `npx tsc` di `server`. (4) `node buildHooks/buildApp.js` di `desktop` → `dist-app/win-unpacked/Hunter Trades.exe`. (5) `node buildHooks/buildPatch.js` → `update/patch.zip` + `update/version.json` (patchUrl = raw GitHub `main/update/patch.zip`). (6) Commit + push `update/` agar URL patch aktif (verifikasi HTTP 200).
**Hindari**: Jangan klaim release selesai tanpa build exe + patch. Jika `copyFileSync` exe error `EBUSY` → aplikasi sedang berjalan, `taskkill /F /IM "Hunter Trades.exe"` dulu. Timestamp exe hasil copy = timestamp `electron.exe` sumber (copyFileSync mempertahankan LastWriteTime) — verifikasi pakai hash, bukan tanggal.

### [20260811] Next.js Standalone Nested di .next/standalone/frontend
**Area**: Frontend / Build
**Root Cause**: Build Next.js 16 menghasilkan standalone bersarang: `.next/standalone/frontend/server.js` (prefix nama folder), bukan `.next/standalone/server.js` — mudah salah copy.
**Solusi**: `buildApp.js` sudah mendeteksi nested dir (`standalone/frontend` dengan `server.js`) sebelum robocopy ke `resources/frontend`. Static tetap wajib disalin ke `.next/static` relatif server.js.
**Hindari**: Jangan hardcode path standalone satu level. Verifikasi `resources/frontend/server.js` + `.next/static/css` setelah build.

### [20260811] Endpoint Backend Ada Tapi Belum Terpanggil UI
**Area**: Frontend / Backend / Feature
**Root Cause**: Route `POST /api/v1/ai-trading/reset-performance` sudah ada di backend (auth per-user via `req.user.id`) tapi tidak pernah dipanggil frontend → user tidak bisa reset dari UI → data lama tampil terus.
**Solusi**: (1) Tambah method service `resetPerformance()` di `frontend/src/services/ai-trading.service.ts`. (2) Tombol di Settings → Data & Privacy → Danger Zone dengan `confirm()` + feedback jumlah deleted. (3) Pola sama dengan "Delete All Data" yang sudah ada.
**Hindari**: Saat fitur backend sudah ada, cek dulu apakah UI memanggilnya sebelum menulis endpoint baru. Per-user reset sudah aman otomatis karena `requireAuth` + `req.user.id`.

### [20260811] Close Position gagal: "trading not permitted" padahal Algo Trading aktif
**Area**: Python Client / MT5 Integration
**Root Cause**: `trade_api.py` `position_close` hardcode `ORDER_FILLING_IOC`. XAUUSD di Exness-MT5Trial6 hanya mendukung FOK/RETURN ? retcode 10030 "Unsupported filling mode" ? fallback native MCP menampilkan pesan menyesatkan "trading not permitted".
**Solusi**: Pilih filling mode dari `symbol_info(pos.symbol).filling_mode` (FOK ? IOC ? RETURN), sama seperti `order_send`. Juga: `mt5_streamer.ts` jangan anggap response string dari native MCP sebagai sukses; retcode Python 10016/10014 langsung tampil tanpa fallback.
**Hindari**: Jangan hardcode `type_filling` di order MT5 � selalu baca `filling_mode` per symbol. Debug retcode MT5 dengan python langsung (`python trade_api.py position_close '{"ticket": X}'`) sebelum menyalahkan permission/broker.

### [20260811] Scan Arsitektur Menyeluruh � 30+ bug diperbaiki (3 batch)
**Area**: Backend / Frontend / Python Client / Desktop
**Root Cause**: Akumulasi bug lintas lapisan: (1) WS tanpa auth (isAuthenticated=true bypass), (2) kunci enkripsi hardcoded publik, (3) password broker plaintext di TradingAccount, (4) backdoor dev karena NODE_ENV default development, (5) OTA tanpa version gate + rollback merusak install, (6) satu koneksi MT5 global lintas user, (7) spawn trade_api.py paralel (MT5 hanya 1 koneksi Python), (8) backtest memutasi config live via singleton, (9) busySymbols lock bocor di pipeline, (10) settings frontend ter-wipe saat mount, (11) useMT5Stream isConnecting stuck ? WS mati permanen, (12) interval poll bocor tanpa guard.
**Solusi**: 3 batch berturut: security (WS auth real + Origin check, ENCRYPTION_KEY fail-fast prod, password encrypt AES, NODE_ENV default production, OTA version gate + rollback rename-safe, triggerStart ownership), reliability (pythonQueue serialisasi spawn Python, busySymbols unlock per-tick, AsyncLocalStorage scoped config backtest, deviation/rounding/None-guard di trade_api.py, re-entrancy guard sync, reconnect fix frontend), kebersihan (index compound, execSync import, single-instance lock, restart cap, check-now nyata, upsert backtest + dateRange, error-handler 5xx generic, mcp kill on shutdown, trust proxy false).
**Hindari**: Jangan pernah bypass auth dengan komentar "temporary"; jangan hardcode secret fallback; jangan default NODE_ENV development; jangan spawn proses yang compete atas resource tunggal tanpa mutex; jangan mutate global singleton dari task paralel (pakai AsyncLocalStorage/scope).

### [20260811] EXE crash "ENCRYPTION_KEY wajib di-set" + ELECTRON_RUN_AS_NODE trap
**Area**: Desktop / Deployment
**Root Cause**: (1) ENCRYPTION_KEY ditambahkan ke `server/.env` source, tapi EXE membaca `resources\server\.env` (salinan build) yang belum punya key ? backend crash di production. buildApp.js:79 memang menyalin .env, tapi build berjalan SEBELUM key ditambahkan. (2) Debug jadi kacau karena env sesi tooling punya `ELECTRON_RUN_AS_NODE=1` ? `electron.exe` jalan sebagai Node biasa: require('electron') resolve ke stub path string, main process crash diam-diam tanpa dialog, exit code 0.
**Solusi**: Tambahkan ENCRYPTION_KEY (48 char, sama dengan source .env) langsung ke `dist-app\win-unpacked\resources\server\.env`; verifikasi dengan curl health :5000. Untuk debug: `Remove-Item Env:ELECTRON_RUN_AS_NODE` sebelum Start-Process EXE.
**Hindari**: Saat menambah env baru, selalu cek resources build (bukan hanya source). Jangan percaya exit code 0 dari Electron saat ELECTRON_RUN_AS_NODE aktif � selalu verifikasi via /health atau main.log. Tambah log rotasi untuk main.log/backend.log yang tumbuh 180MB+ per hari.
