# Implementation Plan: Sinkronisasi Total AI Trading Pipeline

## Overview

Memastikan seluruh fungsi AI trading di **Hunter Trades Desktop (v1.0.14+)** bekerja sinkron di 3 lapisan: **Backend Server** (routes/services/streamer), **Frontend** (React hooks/context/komponen), dan **MCP Server** (native MT5 MCP + Python bridge `trade_api.py`/`server.py`/`fetch_rates.py`). Approach: verifikasi per vertical slice (setiap fungsi dari UI → API → service → MT5 dan balik), dengan tes nyata ke MT5 (akun demo Exness yang sudah connect), bukan sekadar compile.

## Architecture / Alur Data Nyata (hasil scan)

```
MT5 Desktop (native MCP :22346)
   ├─ mt5-streamer.ts (poll 1.5s) ──► broadcast("mt5_tick") ──► WS ──► useMT5Stream ──► hooks ──► UI
   ├─ trade_api.py  (Python fallback utk order/cancel/modify/close) ◄── mt5-mcp.service.ts
   ├─ fetch_rates.py (rates) ──► mt5_copy_rates
   └─ mcp-mt5-server/server.py (bridge lama, masih tersedia)

Backend Routes (ai-trading.routes.ts, mt5.routes.ts):
  /connect /disconnect /status /account /symbols /rates /positions /debug-positions /debug-order
  /open /close /modify /pipeline/* /analyze /analyze-multi /performance /skill /llm-status
  /auto-backtest /news/* /correlation

Frontend (interopd): AiTradingContext ─ seasons hooks ──► components
  useMT5Connection, useAccountInfo, usePositions, usePipeline, useLlmStatus, useMT5Stream
  Komponen: PositionsTable / PendingOrdersTable / AccountOverview / PipelineLogs / LLMConsensusViz / TradingPanel / BacktestTab …

Services: mt5-mcp.service (22 method), mt5-streamer (18 handler MCP), trading-pipeline.service,
  ai-trading-engine.service (analysis/cache 5s), llm-consensus.service (9router 127.0.0.1:20128)
```

## Strategy & Risk (dari pengalaman sesi sebelumnya)

- **Native MCP blokir trading write** ("not permitted") walaupun setting MT5 sudah benar → **semua operasi trading (open/close/cancel/modify) harus lewat Python `trade_api.py` dulu**, fallback native MCP. VERIFIED `order_delete` retcode 10009.
- **Pending order tidak pernah muncul** → tool MCP native perlu `include_orders: true` pada `get_trading_open_positions`; sudah difix + probe. Harus tetap di-verifikasi di build packaged.
- **9Router path**: spawn wajib `shell:true` + path di-quote (`"D:\Journal Trade\...\9router.cmd"`) karena spasi di path "Journal Trade". cwd = folder `.bin`.
- **LLM hibernasi** → `monitor.ts` default `nineRouterUrl=http://127.0.0.1:20128`, tapi 9router harus benar-benar start & listening.
- **Build Windows**: `buildApp.js` pakai `npm install` di `resources/server` + salin `trade_api.py` & `fetch_rates.py`; frontend wajib `npm run build` (standalone) sebelum `buildApp.js`.
- **Jangan commit/push klaim palsu**; selalu `git status` + `git log` verifikasi sebelum lapor selesai.

## Task List (urut, tiap task = satu fungsi utuh + verifikasi)

### Phase 0 — Baseline & Health Check
- [ ] Task 0: Sanity build & base test
   Accept: server `npx tsc` bersih; frontend `npm run build` sukses; test existing `npm test` server pass.
   Verification: tsc/exit 0; `.next/standalone/server.js` ada.
   Scope: S (0 file rusak).

### Phase 1 — Koneksi & Data Live MCP (read-only)
- [ ] Task 1: Connect MT5 (native MCP) end-to-end
   Accept: `POST /api/v1/ai-trading/connect` sukses; `/status` connected; frontend ConnectionPanel masuk.
   Verification: curl POST /connect; GET /status → `{connected:true}`; UI Connection badge.
- [ ] Task 2: Account & Symbols sinkron
   Accept: `/account` return balance/equity/margin; `/symbols` return list; baris di AccountOverview tampil.
   Verification: curl GET /account & /symbols; bandingkan nilai dengan MT5 desktop.
- [ ] Task 3: Positions + Pending Orders (include_orders)
   Accept: `/positions` return `{positions, orders, total}`; POS & pending muncul terpisah di PositionsTable.
   Verification: curl GET /positions; pastikan `orders.length>=0`; cocokkan dengan Trade MT5.
- [ ] Checkpoint Phase 1: stop/resume di posisi — concurrency ben-taruhan koneksi.

### Phase 2 — Trading Write Ops (Python trade_api fallback)
- [ ] Task 4: Open market order (BUY/SELL) — via `trade_api.py order_send`
   Accept: `/open` sukses retcode 10009; posisi baru muncul di `/positions` dalam 2s; tidak ada error "not permitted".
   - Verification: test volume 0.01; posisi setelah 5s.
- [ ] Task 5: Place pending order (BUY_LIMIT/STOP, SELL_LIMIT/STOP)
   Accept: `/open` dengan price jauh dr harga → pending; `/positions.orders` bertambah; error "not permitted" tidak muncul.
- [ ] Task 6: Cancel pending order
   Accept: `/close` (ticket pending) → `order_delete` retcode; order hilang dari list.
- [ ] Task 7: Close open position
   Accept: `/close` (ticket posisi) → `position_close` sukses; ticked len −1.
- [ ] Task 8: Modify SL/TP (posisi & pending)
   Accept: `/modify` untuk open pos & pending → SL/TP berubah di MT5; UI cell warna ikut sesuai getSLTPColor.
- [ ] Checkpoint: semua trade ops tanpa error not permitted.

### Phase 3 — Pipeline Trading & Konfigurasi
- [ ] Task 9: Pipeline start/stop/pause/resume via API
   Accept: `/pipeline/start` berjalan (status running, logs mulai); pause → no new signal; stop → bersih.
- [ ] Task 10: AI Engine analysis (multi-strategi)
   Accept: `/analyze` & `/analyze-multi` return sinyal (confluence, confidence, entry/SL/TP); `MethodologyConfluence` renderNET/priority.
- [ ] Task 11: LLM Consensus & 9router
   Accept: `/llm-status` → model aktif ≥1 (tidak hibernasi); `/pipeline/status-with-logs` tampil votes per model; LLMConsensusViz benar.
- [ ] Checkpoint: pipeline jalan full tanpa crash.

### Phase 4 — Backtest, Skill & History
- [ ] Task 12: Backtest & Auto-backtest
   Accept: `/auto-backtest` sintak & sim jalan; `/performance` metrics tampil; BacktestResult/StreamView update.
- [ ] Task 13: Position history & journal (trade logs)
   Accept: AITradeHistories render riwayat; `/positions`+closing logs sinkron; pnl kalkulasi sesuai lot/contract size.
- [ ] Task 14: Hands-on table: deteksi sumber AI/MANUAL (badge) tetap benar setelah ops.

### Phase 5 — Frontend E2E & Regression
- [ ] Task 15: AI MCP sync test suite (scripted)
   - Bikin `server/scripts/integration-test.mjs`: urutan connect → account → symbols → positions → pending place → pending list → modify pending → cancel pending → open market → close market → status; assert setiap step; keluar exitcode.
   - `server/scripts/ota-health.mjs`: cek `update/version.json` konsisten dengan `desktop/package.json`, patch.zip checksum SHA256.
- [ ] Task 16: Frontend smoke via browser (minimal manual)
   - Panduan checklis manual: buka UI → cek AccountOverview, Positions, Pending, PipelineLogs, LLMConsensus, TradingPanel; screenshot tiap panel.

### Phase 6 — Release Packaged & OTA
- [ ] Task 17: Rebuild penuh & verifikasi packaged
   - tsc; frontend build; buildApp.js; check `resources/server/trade_api.py` & 9router.cmd ada; buildPatch.js; bump version bila perlu.
   - Verification: `node buildPatch.js` → checksum; `curl` raw GitHub patch URL; commit+push; `git status` kosong.

## Risks and Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Round-trip trading masih kena "not permitted" | High | Pastikan `trade_api.py` benar dipakai; tambah log `source:"python"`; test task 4-8 dengan volume 0.01. |
| 9router tidak start (path/multi-instance) | High | Cek listening :20128; spawn flag; log. |
| Frontend compile lama / ENOTDIR | Med | Gunakan timeout besar; jangan rm folder; build saat dist-app tidak running |
| Registry lama japdi path berbeda | Med | Pastikan jarak exe yang diuji = dist-app/win-unpacked/Hunter Trades.exe |

## Open Questions
1. LLM provider API key aktif di 9router? (untuk Phase 3 llm-status)
2. Akun demo Exness `login 413890999` siap dipakai uji trade kecil? (0.01 lot)
3. Apakah perlu test di mesin kedua setelah OTA (produksi absorb) atau cukup local packaged app?

## Deliverables
- `tasks/todo.md` — task check list ini
- `server/scripts/integration-test.mjs` — automated E2E sanity
- Update CHANGELOG (v1.0.14+ / v1.0.15/1.0.16 sesuai fix)
- Patch OTA baru (bila ada fix)