# 📋 Project Scan — Hunter Trades AI Trading & Journal System

> **Generated:** 2026-09-26  
> **Stack:** Next.js 16.2.1 (App Router) + React 19 + Tailwind v4 + Express 5.2.1 + Mongoose 9.3.3 / MongoDB 7.1.1 + Electron 35 + Native MT5 MCP / Python Bridge + 9Router + LLM Consensus  
> **Total Services:** 51+ | **Backend Models:** 25 | **Backend Routes:** 25 | **Frontend Pages:** 20 | **Frontend Services:** 13

---

## 📁 Project Structure

```
D:\Journal Trade\
├── frontend/                     # Next.js 16.2.1 (App Router, Turbopack/Webpack)
│   └── src/
│       ├── app/(dashboard)/      # 20 Dashboard App Router pages
│       │   ├── ai-trading/       # Pure AI Order Execution & Live Log
│       │   ├── ai-review/        # Post-Trade AI Journal Analysis & Review
│       │   ├── macro-terminal/   # Macro Hub (Overview, Intelligence, COT, Nexus, Quant Lab)
│       │   ├── playbook/         # Strategy Playbook (ICT, MSNR, SMC)
│       │   └── ...               # Analytics, Settings, Log-Trade, Onboarding
│       ├── components/           # UI Components (8 directories: macro-terminal, trade, playbook, etc.)
│       ├── services/             # 13 Frontend API Client Services
│       └── hooks/                # Custom React Hooks
├── server/                       # Node.js + Express 5.2.1 + TypeScript
│   ├── src/
│   │   ├── services/             # Business Logic (51+ service modules)
│   │   │   ├── strategies/       # 14 Strategy modules (ICT, SMC, MSNR, ATR, Confluence, IPDA, etc.)
│   │   │   └── ...               # Core Trading, Risk, Macro, AI & Memory services
│   │   ├── routes/               # Express 5 API Routes (25 route files)
│   │   ├── models/               # Mongoose 9.3.3 Models (25 model files)
│   │   ├── agents/               # Autonomous AI System Agents (base, specific, system-monitor)
│   │   ├── middleware/            # Auth, Zod Validation, Rate Limiting, Error Handler
│   │   └── utils/                # API Response & Helper Utilities
│   └── mcp-mt5-server/           # Python Client for Native MT5 MCP (`server.py`, `gui.py`, `build.bat`)
├── desktop/                      # Electron 35 Main Process App (`main.js`, `preload.js`, splash, builder)
└── .kilo/                        # Agent Memory, Lessons, Rules, & Local Skills
```

---

## 🖼️ Frontend Pages

### 1. AI Trading (`/ai-trading`)

#### Layout & Navigation
| Komponen | Posisi | Fungsi |
|---|---|---|
| **TradingPanel** | Sidebar kanan | Konfigurasi pipeline, symbol, timeframe, risk, metodologi, LLM toggle |
| **SkillDisplay** | Sidebar kanan | AI Backtest Skill — peringkat symbol, verdict metodologi, tombol auto-scan |
| **PipelinePerformance** | Sidebar kanan | Live methodology stats, symbol stats, equity curve chart |
| **MethodologyConfluence** | Sidebar kanan | Breakdown sinyal per metodologi real-time |
| **NewsCalendar** | Sidebar kanan | Economic calendar — upcoming high-impact events, active warnings |
| **AccountOverview** | Konten kiri | Saldo, equity, margin level, leverage |
| **PositionsTable** | Konten kiri | Open positions, SL/TP, PnL |
| **PipelineLogs** | Konten kiri | Real-time log saat pipeline running |
| **ConnectionPanel** | Full page | Form koneksi MT5 (server, login, password, save checkbox) |

**State Management:** 4 custom hooks — `useMT5Connection`, `useAccountInfo`, `usePositions`, `usePipeline`

#### Tab Trading vs Backtest
Navigasi tab di header: **Trading** (default) dan **Backtest**. Backtest tab menampilkan `BacktestTab` yang berisi:

| Komponen | Fungsi |
|---|---|
| **BacktestForm** | Multi-symbol, timeframe, RSI oversold/overbought, SL/TP multiplier, trailing stop, spread pips, speed, signal interval, metodologi selector |
| **BacktestStreamView** | Live streaming via SSE — equity chart, floating PnL, margin level, indicator card, real-time trade log dengan methodology badge, symbol & methodology stats live |
| **BacktestResult** | Metrics grid (PnL, win rate, drawdown, profit factor, recovery factor, Sharpe), equity curve chart, symbol & methodology performance tables, AI analysis dengan methodology recommendations + pair insights |

---

## 🧠 Backend Services

### Core Trading

| Service | Fungsi Utama |
|---|---|
| **ai-trading-engine.service.ts** | Multi-methodology analysis: market structure → 7 strategies → confluence → signal. Incremental RSI/ATR (O(1) per step). Position sizing with ATR floor. |
| **trading-pipeline.service.ts** | Main loop: fetch rates → analyze symbols → skill filter → risk check → **correlation check** → **news check** → **fundamental check** → **HTF confluence** → regime → LLM consensus → execute trade → manage positions (breakeven + partial TP + trailing). |

### Risk & Safety — Phase 1

| Service | Fungsi | Commit |
|---|---|---|
| **risk-manager.service.ts** | `checkTradeAllowed()` — margin level, max positions, duplicate symbol, daily loss limit, per-trade risk. `checkCorrelationRisk()` — mencegah >2 posisi per base currency (EUR, GBP, USD, JPY, AUD, NZD, CAD, CHF), >3 per quote currency. | `714c04f` |
| **trade-exit-strategy.service.ts** | Partial TP Engine: TP1 (30% close at 1:1 R:R, SL ke breakeven), trailing cerdas pada sisa posisi. Dipanggil tiap siklus `managePositions()`. | `186f397` |

### Market Context — Phase 2

| Service | Fungsi | Commit |
|---|---|---|
| **market-regime.service.ts** | Klasifikasi 4 regime: TRENDING_BULL, TRENDING_BEAR, RANGING, HIGH_VOLATILITY via ADX (>25 = trending), Bollinger Band squeeze (<5% bandwidth = ranging), ATR spike (>1.5x average = high vol). Bobot metodologi dinamis per regime. | `ca279a5` |
| **multi-timeframe.service.ts** | Verifikasi sinyal di H1/H4 via EMA20/EMA50 cross. Hierarki: M15 → H1 → H4 → D1. Confidence turun/ skip jika HTF bertentangan. | `ca279a5` |

### Fundamental & News — Phase 2

| Service | Fungsi | Commit |
|---|---|---|
| **news-calendar.service.ts** | Fetch economic calendar via FinanceMCP.get_economic_calendar(). Mapping 13 pair ke currency. Fallback generate jadwal mingguan (NFP, CPI, FOMC, ISM, dll). `isHighImpactWindow(symbol, 30min)` — skip jika dalam jendela berita. | `d00eb85` |
| **fundamental-research.service.ts** | Central bank rate scoring per pair. Interest rate diff + bias (hawkish/dovish) → composite score -100 to +100. Trend alignment: BULLISH/BEARISH/NEUTRAL. Default rates fallback. | `d00eb85` |

### AI Learning — Skill & Optimization

| Service | Fungsi | Commit |
|---|---|---|
| **ai-backtest-skill.service.ts** | Aggregasi hasil backtest ke AIBacktestSkill. Symbol rankings (composite score: WR×0.25 + PF×0.25 + RF×0.20 + PnL×0.15 + trades×0.15). Methodology verdicts (KEEP/ADJUST/DISABLE) EWMA. `getBestSymbols()`, `getMethodologyVerdicts()`, `getRecommendedParams()`. | `3b89127` |
| **auto-backtest.service.ts** | Batch scan 11 major pairs. Masing-masing 0.5% risk, max 1 open position. Kualifikasi: min 10 trades, profit >0, drawdown <40%, WR >30%. Scoring otomatis. | `3b89127` |
| **walk-forward.service.ts** | Rolling window optimization: training 4 bulan → test 2 bulan. 81 kombinasi parameter (RSI oversold 25/30/35, overbought 65/70/75, SL 1.0/1.5/2.0, TP 1.5/2.0/2.5). Scoring: 40% training + 60% test - consistency penalty (anti-overfitting). Update ke `AIBacktestSkill.recommendedParams`. | `a03ab3f` |
| **trade-journal-analysis.service.ts** | Bandingkan AITradeLog real vs backtest. EWMA: 70% historical + 30% live. Deteksi metodologi over/underperform. Auto-disable metodologi dengan performa real < -20% dari backtest. | `4641a7a` |

### Full Autonomous Mode — Phase 6

| Service | Fungsi | Commit |
|---|---|---|
| **autonomous-mode.service.ts** | Integrasi semua filter dalam satu pipeline: (1) Correlation Risk, (2) News Impact, (3) Fundamental Alignment, (4) HTF Confluence, (5) Trade Journal Feedback. `evaluateTrade()` — return allowed/rejected. `periodicMaintenance()` — analisis jadwal rutin. | `4641a7a` |

### Strategi Trading (8 modules)

| Strategy | File | Logic |
|---|---|---|
| **Market Structure** | `strategies/market-structure.service.ts` | Swing highs/lows (left=3, right=2), order blocks, FVG (3-candle gap), DBSCAN key levels, liquidity zones, trend analysis, candle ranges, quarterly pivots |
| **SMC** | `strategies/smc.strategy.ts` | MSS (break of structure), order block mitigation, breaker blocks, liquidity grabs |
| **ICT** | `strategies/ict.strategy.ts` | FVG signals, OTE (61.8-79% Fib), killzone mapping (Asian/London/NY/London Close EST), Judas swing |
| **MSNR** | `strategies/msnr.strategy.ts` | Key level bounce, break & retest, structure break, Fibonacci confluence |
| **CRT** | `strategies/crt.strategy.ts` | Range breakouts, liquidity sweep, displacement (≥2× avg range), MSB |
| **Quarterly Theory** | `strategies/quarterly.strategy.ts` | Quarterly pivot bounce/break/retest |
| **LIT** | `strategies/lit.strategy.ts` | Inducement, stop hunt, liquidity sweep, LIT+OB confluence |
| **Confluence Engine** | `strategies/confluence-engine.ts` | Weighted voting dari 7 metodologi. Dominant signal anchoring untuk entry/SL/TP. Boost: 2 agree +5%, 4 agree +10%, 6 agree +15%. Conflict detection. |

### Infrastructure

| Service | Fungsi |
|---|---|
| **mt5-mcp.service.ts** | MCP stdio bridge ke Python MT5 server. AES-256-CBC encrypted credential storage. Auto-reconnect. |
| **llm-consensus.service.ts** | Parallel multi-model validation: Claude (OpenRouter), Gemini, Groq, DashScope. Timeout 8s/provider. ≥50% threshold to execute. |
| **backtest.service.ts** | Streaming SSE backtest engine. Incremental RSI/ATR O(1). Signal interval (default 4). Spread simulation. Per-symbol margin calculation. 3-phase loop (process → PnL → emit). |
| **mcp.service.ts** | Multi-MCP server registry. FinanceMCP untuk data fundamental. Auto-refresh tools. |
| **mt5-scheduler.service.ts** | Periodic position sync. Auto-start on server boot. |

---

## 📦 Database Models (25 files)

| Model | Collection | Key Fields / Purpose |
|---|---|---|
| **User** | users | name, email, image, role, discordId |
| **Trade** | trades | userId, tradingAccountId, symbol, direction, entry, exit, pnl, plannedR, actualR, tags |
| **TradingAccount** | trading_accounts | userId, name, mt5Config, mt5AutoSyncEnabled, balance, equity |
| **MT5Connection** | mt5_connections | userId, server, login, passwordEncrypted (AES-256-CBC), enabled |
| **AITradeLog** | ai_trade_logs | userId, signal, execution, pnl, closed, llmReasoning |
| **AITradingSession** | ai_trading_sessions | userId, status (RUNNING/STOPPED/PAUSED), pipelineConfig, methodologyWeights |
| **AiReview** | ai_reviews | userId, tradeId, analysis, grade, psychologicalFactors |
| **Playbook** | playbooks | userId, title, methodology (ICT, MSNR, SMC), rules, checklist |
| **BacktestExperience** | backtest_experiences | userId, symbol, timeframe, result, aiLearningSummary, pipelineConfigSnapshot |
| **AIBacktestSkill** | ai_backtest_skills | userId, symbolRankings, methodologyRankings (KEEP/ADJUST/DISABLE), globalRecoveryFactor |
| **UserAgentMemory** | user_agent_memories | userId, persona, tradingStyle, psychologicalProfile, memoryEntries |
| **VectorMemory** | vector_memories | userId, embedding, content, metadata (semantic search for trading journal) |
| **ChatSession** | chat_sessions | userId, agentId, messages, summary, metadata |
| **ReflectionLog** | reflection_logs | agent, prompt, insights, toolsUsed, timestamp |
| **DailySnapshot** | daily_snapshots | userId, date, pnl, trades, winRate, metrics |
| **MacroIndicator** | macro_indicators | symbol, data (CPI, NFP, Fed Funds), timestamp |
| **YieldCurveSnapshot** | yield_curve_snapshots | tenors (2Y, 10Y, 30Y), inversionStatus, spread10Y2Y |
| **GeoRiskSnapshot** | geo_risk_snapshots | region, riskScore, events, impactAssessment |
| **AgentInsight** | agent_insights | agentName, sentiment, confidence, keyDrivers |
| **Notification** | notifications | userId, type, message, read, actionUrl |
| **UserSettings** | user_settings | userId, appearance, notifications, discord |
| **Registration** | registrations | name, email, phone, brokerAccount, status |
| **Subscription** | subscriptions | userId, plan, status, expiresAt |
| **TokenBalance** | token_balances | userId, balance, transactions |
| **Transaction** | transactions | userId, amount, type, status, midtransId |

---

## 🔌 API Routes (25 files)

| Mount Path | File | Key Endpoints |
|---|---|---|
| `/api/v1/trade/*` | `trade.routes.ts` | CRUD trade log, restore, permanent delete, summary, recent |
| `/api/v1/trading-account/*` | `trading-account.routes.ts` | CRUD trading account, active account, sync balance |
| `/api/v1/mt5/*` | `mt5.routes.ts` | Connect, disconnect, symbols, quotes, orders, positions |
| `/api/v1/playbook/*` | `playbook.routes.ts` | CRUD playbook entries, streamlined methodologies (ICT, MSNR, SMC) |
| `/api/v1/ai-trading/*` | `ai-trading.routes.ts` | connect, status, pipeline (start/stop/pause/resume/logs), analyze, skill, auto-backtest |
| `/api/v1/ai-review/*` | `ai-review.routes.ts` | Generate AI review, get review by tradeId, history |
| `/api/v1/ai-coach/*` | `ai-coach.routes.ts` | Interactive AI trading coach chat, psychology advice |
| `/api/v1/agent-consensus/*` | `agent-consensus.routes.ts` | Multi-agent consensus voting, deliberation stream |
| `/api/v1/nexus/*` | `nexus.routes.ts` | Nexus inter-market analysis & macro correlation |
| `/api/v1/macro-ai/*` | `macro-ai.routes.ts` | AI macro prediction, inflation & interest rate analysis |
| `/api/v1/macro-regime/*` | `macro-regime.routes.ts` | Macro regime state (Stagflation, Reflation, Goldilocks, Deflation) |
| `/api/v1/macro-ai-observer/*` | `macro-ai-observer.routes.ts` | Observer agent signals & news sentiment |
| `/api/v1/geo-risk/*` | `geo-risk.routes.ts` | Geopolitical conflict tracking & risk scores |
| `/api/v1/quant/*` | `quant.routes.ts` | Quantitative volatility modeling & risk metrics |
| `/api/v1/analytics/*` | `analytics.routes.ts` | Win rate, profit factor, R-distribution, equity curve |
| `/api/v1/market-data/*` | `market-data.routes.ts` | Real-time prices, VIX, DXY, US yields |
| `/api/v1/backtest/*` | `backtest.routes.ts` | Run backtest, stream SSE, walk-forward, history |
| `/api/v1/auth/*` | `auth.routes.ts` & `auth-v1.routes.ts` | Better-Auth Discord session, login, logout, refresh |
| `/api/v1/settings/*` | `settings.routes.ts` | App preferences, MT5 defaults, notification config |
| `/api/v1/notification/*` | `notification.routes.ts` | List, mark read, unread count |
| `/api/v1/payment/*` | `payment.routes.ts` | Midtrans Snap token create, webhook notification |
| `/api/v1/broker-registration-v1/*` | `broker-registration-v1.routes.ts` | Broker onboarding & verification |
| `/api/v1/dev-test/*` | `dev-test.routes.ts` | Dev environment healthcheck & diagnostic endpoints |

---

## 🔄 Pipeline Flow Diagram

```
[New Candle]
    │
    ▼
┌─────────────────────────────────────────────┐
│ 1. Fetch rates for active symbols           │
│ 2. Check new candle → symbolsToAnalyze      │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│ 3. Market Regime Detection (ADX/BB/ATR)     │
│    → TRENDING_BULL/BEAR/RANGING/HIGH_VOL    │
│    → Adjust methodology weights             │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│ 4. Multi-Methodology Analysis               │
│    → Market Structure → 7 Strategies        │
│    → Confluence Engine → Signal             │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│ 5. AI Backtest Skill Filter                 │
│    → Skip symbol with low score (<40)       │
│    → Skip disabled methodologies            │
└─────────────────────────────────────────────┘
    │ (if signal exists)
    ▼
┌─────────────────────────────────────────────┐
│ 6. Pre-Trade Checks (ordered)               │
│    ├── Risk Check (margin, positions, PnL)  │
│    ├── Correlation Check (currency exposure)│
│    ├── News Check (high-impact window?)     │
│    ├── Fundamental Check (trend alignment)  │
│    └── HTF Confluence (EMA20/50 H1/H4)      │
└─────────────────────────────────────────────┘
    │ (if all passed)
    ▼
┌─────────────────────────────────────────────┐
│ 7. LLM Consensus (optional)                 │
│    → Claude + Gemini + Groq parallel        │
│    → ≥50% threshold to execute              │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│ 8. Execute Trade                            │
│    → Position sizing (ATR-based)            │
│    → Open order on MT5                      │
│    → Log to AITradeLog                      │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│ 9. Position Management (per cycle)          │
│    ├── Breakeven (1x ATR → SL to entry)     │
│    ├── Partial TP (30% at 1:1 R:R)          │
│    └── Trailing Stop (ATR-based)            │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│ 10. Periodic Maintenance (setiap N siklus)  │
│     → Trade Journal Analysis (real vs bt)   │
│     → Walk-Forward Optimization (2 minggu)  │
│     → Update AIBacktestSkill                │
└─────────────────────────────────────────────┘
```

---

## 🔐 Filter Pipeline (Detail)

### Urutan Eksekusi Per Signal

```
1. CHECK: maxOpenPositions, marginLevel ≥ 150%
2. CHECK: duplicate symbol warning
3. CHECK: daily loss limit (maxDailyRisk%)
4. CHECK: per-trade risk (maxRiskPerTrade%)
   ↓ reject if any fail
5. CHECK: correlation — max 2 positions per base currency
   ↓ reject if over-exposed
6. CHECK: news — high-impact event within ±30 minutes?
   ↓ reject if yes
7. CHECK: fundamental — trade direction aligned with central bank trend?
   ↓ reject if opposite with score ≥30
8. CHECK: HTF confluence — does H1/H4 trend match entry?
   ↓ reject if HTF conflict with confidence <50%
9. (optional) LLM — Claude + Gemini + Groq vote
   ↓ reject if BAD or SKIP without consensus
10. EXECUTE trade
```

---

## 🏆 Key Metrics Tracked

| Metric | Di Backtest | Di Live Pipeline | Di AI Skill |
|---|---|---|---|
| Win Rate | ✅ | ✅ | ✅ (EWMA) |
| Profit Factor | ✅ | — | ✅ |
| Recovery Factor | ✅ | — | ✅ |
| Sharpe Ratio | ✅ | — | — |
| Max Drawdown | ✅ | ✅ | — |
| Average Win/Loss | ✅ | — | — |
| Methodology Stats | ✅ | ✅ | ✅ |
| Symbol Stats | ✅ | ✅ | ✅ |
| Equity Curve | ✅ | ✅ | — |
| Margin Level | ✅ | ✅ | — |
| Composite Score | — | — | ✅ |

---

## 🚀 Status Implementasi

| Phase | Fitur | Status |
|---|---|---|
| **Phase 1** | Correlation Risk + ATR Sizing + Breakeven | ✅ `714c04f`, `8edaa5f` |
| **Phase 2** | Market Regime + Multi-Timeframe + News + Fundamental | ✅ `ca279a5`, `d00eb85` |
| **Phase 3** | Partial TP Engine | ✅ `186f397` |
| **Phase 4** | Walk-Forward Optimization | ✅ `a03ab3f` |
| **Phase 5** | Trade Journal Analysis | ✅ `4641a7a` |
| **Phase 6** | Full Autonomous Mode | ✅ `4641a7a` |

---

## 🔜 Potensi Pengembangan

| Area | Ide |
|---|---|
| **Intra-Candle Wick** | Simulasi high/low dalam candle untuk deteksi stop hunt |
| **Correlation Matrix** | Visual heatmap korelasi antar pair di frontend |
| **Risk Dashboard** | Exposure per currency, VaR harian, drawdown distribution |
| **Shared Skill Pool** | Aggregasi AIBacktestSkill antar user untuk sample size lebih besar |
| **Telegram/Discord Alert** | Notifikasi real-time ke external chat |
| **Multi-Broker Support** | Abstraction layer untuk broker selain MT5 |
| **Macro Terminal** | New comprehensive macro-economic terminal with advanced analytics |
