# Multi-Agent Workflow Specification: Hunter Trades AI Trading Engine
**Project**: Hunter Trades Journal & AI Trading  
**Version**: 1.0.0  
**Author**: KIRA (AI/Agent Orchestration Lead)  
**Date**: March 2026  

---

##  EXECUTIVE SUMMARY & ARCHITECTURAL OBJECTIVE

Dokumen ini mendefinisikan rancangan arsitektur kognisi dan alur kerja **Multi-Agent Trading Pipeline (Signal → Analysis → Review → Trade)** untuk Hunter Trades.

Tujuan utama dari arsitektur multi-agent ini adalah memisahkan tanggung jawab (*Separation of Concerns*), mencegah bias tunggal dari model LLM, memastikan mitigasi risiko yang ketat (*Risk Management Guardrails*), serta menyediakan *auditability* dan *transparency* lengkap pada setiap keputusan trading yang dieksekusi ke platform MetaTrader 5 (MT5).

---

## 🛠️ AGENT ROSTER & CORE RESPONSIBILITIES

| Agent Handle | Agent Role | Primary Responsibilities | Core Logic / Service Mapping |
| :--- | :--- | :--- | :--- |
| `@kira` | **AI/Orchestrator Lead** | Mengatur alur pipeline, melempar tugas antar agent, mengelola status session, serta memicu fallback & circuit breaker jika terjadi kegagalan. | `trading-pipeline.service.ts` |
| `@analyst-trading` | **Market & Signal Generator** | Pemindaian struktur pasar (SMC, ICT, MSNR), deteksi Liquidity Sweep, Order Block, FVG, QML, serta penyusunan kandidat sinyal trading awal. | `ai-trading-engine.service.ts`, `strategies/*` |
| `@qa-trading` / `@volco` | **Signal & Risk Reviewer** | Validasi teknis sinyal, pengecekan korelasi, pembatasan Drawdown harian, ketersediaan margin, dan verifikasi skor konsensus LLM Voting. | `risk-manager.service.ts`, `llm-consensus.service.ts` |
| `@ceo-trading` / `@axis` | **Trade Execution Engine** | Menghitung *position sizing* presisi (lot size), menentukan tipe order (Market vs Pending Limit), dan mengeksekusi order via MT5 MCP / Python API. | `mt5-mcp.service.ts`, `trade_api.py` |

---

## 🔄 PIPELINE STAGES (SIGNAL → ANALYSIS → REVIEW → TRADE)

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                             STAGE 1: SIGNAL GENERATION                            │
│  Agent: @analyst-trading                                                          │
│  - Scan M1, M5, M15, H1, H4, D1 multi-timeframe rates                            │
│  - Calculate SMC (OB/Liq Sweep), ICT (FVG/OTE), MSNR (RBS/SBR/QML)                │
│  - Produce raw TradingSignal (symbol, direction, entry, sl, tp)                   │
└─────────────────────────────────────────┬─────────────────────────────────────────┘
                                          │
                                          ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                             STAGE 2: MULTI-METHODOLOGY ANALYSIS                   │
│  Agent: @analyst-trading                                                          │
│  - Compute Confluence Score via ConfluenceEngine                                  │
│  - Weigh SMC, ICT, MSNR strategy outputs with weighted bias                       │
│  - Check multi-timeframe alignment (min 2 of 3 TF aligned)                        │
└─────────────────────────────────────────┬─────────────────────────────────────────┘
                                          │
                                          ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                             STAGE 3: RISK & CONSENSUS REVIEW                      │
│  Agent: @qa-trading / @volco                                                      │
│  - Check Account Margin Level (> 150%) & Open Position Capacity                  │
│  - Check Daily Loss Limit & Global Drawdown Circuit Breaker                       │
│  - Verify Symbol Uniqueness (Strict 1 position per symbol)                        │
│  - Check Currency Correlation Risk (Base/Quote cap)                               │
│  - Trigger Multi-LLM Consensus Voting (>= threshold, e.g. 70%)                   │
└─────────────────────────────────────────┬─────────────────────────────────────────┘
                                          │
                                          ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                             STAGE 4: PRECISION TRADE EXECUTION                    │
│  Agent: @ceo-trading / @axis                                                      │
│  - Dynamic Position Sizing based on 0.5% account risk & SL distance               │
│  - Order Routing: Market Order vs Pending Limit Order (minPendingDist)            │
│  - Execute order via Native MT5 MCP (/mcp) or Fallback Python Trade API            │
│  - Log execution details & initialize Trailing Stop Monitor                       │
└───────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 DETAILED STAGE SPECIFICATIONS

### STAGE 1: SIGNAL GENERATION (`@analyst-trading`)
* **Trigger**: Periodic pipeline timer (tiap candle close / 2-5 detik polling) atau request manual.
* **Input**: Historical rates/candles dari MT5 MCP (`getCachedRates`).
* **Logic**:
  1. Ambil data harga multi-timeframe: D1 (bias), H1/H4 (direction & setup), M5/M15 (entry).
  2. Identifikasi *Market Structure*: Swing High/Low, Trend (Bullish/Bearish/Sideways), Character Change (ChoCH/MSS).
  3. Deteksi setup spesifik per strategi:
     * **SMC**: Order Block (OB), Liquidity Sweep, Displacement.
     * **ICT**: Fair Value Gap (FVG), Optimal Trade Entry (OTE 61.8%-79%).
     * **MSNR**: Resistance Become Support (RBS), Support Become Resistance (SBR), Quasimodo Level (QML).
* **Output**: Kandidat sinyal mentah `TradingSignal` dengan level harga Entry, Stop Loss (SL), dan Take Profit (TP).

### STAGE 2: MULTI-METHODOLOGY ANALYSIS (`@analyst-trading`)
* **Trigger**: Penerimaan kandidat sinyal dari Stage 1.
* **Logic**:
  1. Menjalankan `ConfluenceEngine.calculateConfluence()`.
  2. Menggabungkan sinyal dari ketiga metodologi dengan pembobotan dinamis (`methodologyWeights`).
  3. Menghitung *Confluence Score* (skor kepastian 0 - 100%).
  4. Memvalidasi *Spread & Point Size* real-time dari broker untuk memastikan Risk/Reward Ratio (RRR) minimal 1:1.5 tetap terpenuhi setelah memperhitungkan biaya spread.
* **Output**: `MultiStrategySymbolAnalysis` lengkap dengan *Confluence Score* dan perincian metodologi.

### STAGE 3: RISK & CONSENSUS REVIEW (`@qa-trading` / `@volco`)
* **Trigger**: Sinyal memenuhi skor konfluensi minimal (misal: ≥ 65%).
* **Logic & Guardrails**:
  1. **Margin Check**: Pastikan `marginLevel >= 150%`.
  2. **Capacity Check**: Pastikan jumlah posisi terbuka tidak melebihi `maxOpenPositions` (default 3) dan total risiko terbuka tidak melebihi `maxDailyRisk`.
  3. **Symbol Isolation**: Memastikan **TIDAK ADA** posisi aktif di simbol yang sama (*Strict 1 position per symbol*).
  4. **Daily Loss & Drawdown Breaker**: Menghentikan trade jika PnL harian menyentuh batas kekalahan harian (`maxDailyRisk`) atau *Global Max Drawdown*.
  5. **Correlation Risk**: Memastikan maksimal 2 posisi per *Base Currency* dan 3 posisi per *Quote Currency*.
  6. **LLM Consensus Voting**:
     * Mengirimkan data setup ke 3-4 LLM Provider secara paralel (DeepSeek, GPT, Gemini, Mistral, Nemotron, Claude).
     * Jika terjadi rate-limit atau timeout pada provider utama, fallback model diaktifkan secara otomatis.
     * Konsensus harus mencapai ambang persetujuan (contoh: ≥ 70% vote "GOOD").
* **Output**: Keputusan `RiskCheck` (`allowed: true/false`, `reason`, `warnings`).

### STAGE 4: PRECISION TRADE EXECUTION (`@ceo-trading` / `@axis`)
* **Trigger**: Sinyal lolos verifikasi Stage 3 dengan hasil `RiskCheck.allowed = true`.
* **Logic**:
  1. **Position Sizing**: Hitung ukuran Lot berdasarkan persentase risiko akun (misal 0.5%) dan jarak SL dalam Pips.
     $$\text{Lot Size} = \frac{\text{Account Balance} \times \text{Risk \%}}{\text{SL Distance (Pips)} \times \text{Pip Value}}$$
  2. **Execution Type Determination**:
     * Jika harga saat ini berjarak < `minPendingDist` dari entry zone → **Market Order**.
     * Jika harga saat ini berjarak >= `minPendingDist` → **Pending Order (Limit/Stop)**.
  3. **Order Dispatching**:
     * Panggil `mt5McpService.openPosition()` via Native MCP HTTP SSE.
     * Jika Native MCP menolak / `not permitted`, jalankan **Fallback Mechanism** via Python MetaTrader5 API (`trade_api.py`).
  4. **Post-Execution Logging & Trailing**:
     * Simpan record ke database `AITradeLog` dengan attribution lengkap.
     * Aktifkan modul `tradeExitStrategyService` untuk mengawasi Trailing Stop & Break-Even secara real-time.
* **Output**: `MT5OrderResult` (Ticket ID, Status, Execution Price, Timestamp).

---

## 🛡️ FALLBACK, RESILIENCE & CIRCUIT BREAKER RULES

1. **LLM Provider Fallback**: Setiap provider pada `llm-models.config.ts` dilengkapi `fallbackModel`. Jika model utama gagal/HTTP 429/timeout, retry instan dilakukan ke fallback model.
2. **Execution Fallback**: Jika Native MT5 MCP gagal memproses order, sistem mengalihkan eksekusi ke `trade_api.py` (MetaTrader5 Python Library).
3. **Daily Loss Circuit Breaker**: Jika PnL harian menyentuh limit loss (contoh: -1.5%), status pipeline otomatis berubah ke `PAUSED` dan tidak ada trade baru yang diizinkan hingga harinya berganti.
4. **Re-entrancy Protection**: Setiap async interval cycle di dalam `trading-pipeline.service.ts` dilindungi oleh lock per-user & lock per-symbol (`busySymbols`) untuk mencegah eksekusi ganda pada candle/tick yang sama.

---

## 📊 AUDITABILITY & LOGGING SPECIFICATION

Setiap langkah dalam workflow ini dicatat secara rinci dalam bentuk `PipelineLog` dan disimpan ke database MongoDB (`AITradeLog` / `AITradingSession`):

* `[INFO]` Audit pergerakan harga & status pipeline.
* `[SIGNAL]` Kandidat sinyal yang terdeteksi oleh `@analyst-trading`.
* `[CONFLUENCE]` Hasil perhitungan konfluensi SMC/ICT/MSNR.
* `[CANDIDATE]` Sinyal yang masuk ke tahap review.
* `[WARN]` Peringatan mendekati batas risiko / model fallback.
* `[TRADE]` Detil order execution (Ticket, Volume, Price, SL, TP).
* `[ERROR]` Kegagalan jaringan, timeout, atau penolakan broker.

---
*Hunter Trades AI — Specification maintained by KIRA*
