# AI Trading Rebuild Implementation Plan

**Date:** 2026-10-28
**Orchestrator:** KIRA
**Owner:** Bang Vir
**Status:** 🔄 Planning — Phase 0 (Audit complete, dispatching)

---

## Goal

Perbaiki halaman AI Trading Journal Trade: logika backend, frontend, dan MCP server.
Rebuild terstruktur dengan pembagian tugas tim sesuai SOP v1.8.

---

## Audit Temuan (Arsitektur & Masalah Kritis)

### MCP Server
- **Dualitas implementasi:** Python Stdio Bridge (`server/mcp-mt5-server/server.py`) dan Native HTTP MCP (`http://127.0.0.1:22346/mcp`).
- **Mismatch tool naming:** Skrip backend dan validator mencampur tool name Python (`mt5_account_info`, `mt5_positions_get`, `mt5_order_send`) dengan Native MCP (`get_trading_account_info`, `get_trading_open_positions`, `trade_send_market_order`).
- **Auth & Circuit Breaker:** Port 22346 kerap timeout/401 akibat desinkronisasi `apiKey` terminal MT5 dan env backend; circuit breaker `mt5McpService` mengunci state saat reconnect tanpa auto-reset tervalidasi.

### Backend Logic (`server/src`)
- **Desinkronisasi state koneksi:** `mt5McpService.isConnected` vs `mt5StreamCache.isConnected()`.
- **Consensus & Risk Gate:** Flag `agentConsensus` diperbaiki di level schema, namun sinkronisasi bobot metodologi dan fallback LLM saat token habis perlu fallback teruji.
- **Rate limiting & polling:** Endpoint `/rates` dan `/positions` berpotensi flooding saat tick aktif.

### Frontend Logic (`frontend/src/app/(dashboard)/ai-trading`)
- **Komponen monolitik** di `page.tsx` dan `TradingPanel.tsx` memicu re-render berat pada update tick.
- **State lokal** belum sepenuhnya tersinkronisasi dua arah dengan MongoDB saat reload.
- **Payment gate** (`usePaymentGate.ts`, `PaymentStatusBanner.tsx`) dalam uncommitted state, perlu distabilkan agar tidak memblokir UI state.

---

## Rebuild Plan — 4 Fase

### Fase 1: Unifikasi MCP Server & Connection Layer
- Standarisasi adapter tool names: translation layer tunggal di `mt5-mcp.service.ts` kompatibel Native MCP maupun Python bridge.
- Perbaikan auth & reconnect: validasi `apiKey` otomatis saat handshake, auto-heal circuit breaker saat socket pulih.

### Fase 2: Backend Logic, Risk Engine & Consensus
- Refactor `trading-pipeline.service.ts` memisahkan stream data tick dari eksekusi order.
- Enforce Zod validation di `ai-trading.validator.ts` untuk payload order dan config metodologi.
- Cache market regime, kurangi overhead kalkulasi confluence per tick.

### Fase 3: Frontend UI, State Synchronization & Payment Gate
- Optimasi state reactive (Zustand/Context terpisah) untuk tick data vs config pipeline.
- Finalisasi `usePaymentGate` dan `PaymentStatusBanner` tanpa regresi panel trading.
- Feedback visual eksplisit saat circuit breaker terbuka / koneksi MT5 terputus.

### Fase 4: Testing, QC & Build Verification
- Unit & integration test vitest untuk pipeline dan mock MT5 adapter.
- E2E Playwright alur koneksi, toggle AI trading, emergency close all.
- Verifikasi build artifact production (Electron pack).

---

## Penugasan Tim (Team SOP)

Template report wajib: `<@ID> — [AGENT] — [STATUS] — [EVIDENCE]`

| Agent | ID | Tugas | Evidence yang Diminta |
|-------|----|-------|----------------------|
| **Volco** | `<@1561522867559202927>` | Audit & unifikasi layer MCP MT5. Sinkronisasi auth `apiKey` port 22346, validasi setting Algo Trading MT5 terminal, rapikan bridge `server/mcp-mt5-server`. | Log handshake MCP 200 OK via probe, zero 401 errors. |
| **Axis** | `<@1560156569960845392>` | Standarisasi tool mapping di `mt5-mcp.service.ts` & `trading-pipeline.service.ts`. Circuit breaker auto-reset saat connection state pulih. | File diff, unit test exit 0 untuk `mt5-connection-state.test.ts`. |
| **Nova** | `<@1560158094007345212>` | Review uncommitted changes `frontend/src/app/(dashboard)/ai-trading`, perbaiki state management tab/trading panel, integrasikan banner status koneksi MT5. | `npm run typecheck --prefix frontend` exit 0, commit hash. |
| **Lyra** | `<@1560158267882086471>` | Evaluasi layout AI Trading tab, kemudahan monitoring open positions, hierarki alert payment gate vs trading action. | UX audit review di `docs/` atau checklist rekomendasi. |
| **Vera** | `<@1560158997187666003>` | Susun test case integrasi trading pipeline dan Playwright E2E spec alur AI Trading connection & consensus toggle. | Output laporan Vitest/Playwright dengan pass count + trace. |
| **Riku** | `<@1560158446937047100>` | Verifikasi sanity check fungsional: koneksi broker, load symbols, open/close manual & AI trigger, behavior saat MT5 disconnect. | QC checklist status per feature matrix + evidence log. |
| **Forge** | `<@1560158627761885206>` | Monitor port 22346, lifecycle proses MT5, persiapkan staging build setelah perbaikan backend/frontend tervalidasi. | Output process check port 22346 + hash build staging final. |
| **Sage** | `<@1560159134123294802>` | Perbarui `AI_TRADING_PLAN.md` dan dokumentasi arsitektur MCP di `docs/` sesuai struktur implementasi baru. | Update diff pada dokumentasi terkait. |

---

## Dependency & Urutan Eksekusi

```
Fase 1 (Volco + Axis) ──> Fase 2 (Axis) ──> Fase 3 (Nova + Lyra) ──> Fase 4 (Vera + Riku + Forge)
                                                              ▲
                                              Sage dokumentasi paralel sepanjang fase
```

**P0 Immediate:** Volco dan Axis menuntaskan layer koneksi MCP MT5 dan unifikasi tool mapping sebelum Nova merefaktor UI state binding.

---

## Status

- ✅ Audit arsitektur (backend/frontend/MCP) selesai dipetakan
- ✅ Rebuild plan 4 fase disusun
- ✅ Penugasan tim sesuai SOP (Updated v1.9: Anti-Kill 9router)
- 🔄 Fase 1-3 progress: Volco jalankan background clean-ci install (PID 9608), Nova build ulang (PID baru/background), Axis/Volco validasi MT5 MCP port 22346. Sage sinkronisasi dokumen realtime.
- ⚠️ Notice: PID 7824 tidak lagi terdeteksi (kemungkinan selesai atau preempted), artifact `.exe` masih versi Oct 15. Menunggu Nova memicu build final yang bersih.
