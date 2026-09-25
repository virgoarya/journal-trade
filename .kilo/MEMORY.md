# Global Memory: Hunter Trades Journal

## Project Identity
- **Name**: Hunter Trades Journal & AI Trading
- **User**: Bang Vir
- **Tech Stack** (versi terverifikasi dari `package.json` — Sept 2026):
  - **Desktop App**: Electron `^35.0.0` + `electron-builder ^26` (server orchestrator, multi-process manager, system tray, splash window, `electron-updater ^6.8.9`, patch distribution via `dist-patch/patch.zip`).
  - **Frontend**: Next.js `16.2.1` (App Router, standalone output, build via `--webpack`), React `19.2.4`, Tailwind CSS v4, `lucide-react`, `recharts ^3.8.1`, `framer-motion ^12.38.0`, Three.js `^0.185.1` + `@react-three/fiber` (visualizer 3D), `react-markdown` + `remark-gfm`, `sonner` (toast).
  - **Backend**: Node.js + Express `5.2.1` (REST API + WebSocket via `ws ^8.21.0`), Mongoose `9.3.3` / MongoDB `7.1.1`, Better Auth `1.5.6` + `@better-auth/mongo-adapter`, Zod `4.3.6` (validasi), `decimal.js` (akuransi R-multiple), `pino` (logging), `node-cron`, `express-rate-limit`, `puppeteer`, `yahoo-finance2`.
  - **AI/LLM**: 9router (`http://localhost:20128/v1`, auto-free-model via provider `custom`) + Vercel AI SDK `ai ^7.0.14` dengan `@ai-sdk/openai`, `@ai-sdk/google`, `@ai-sdk/groq`, `@anthropic-ai/sdk`, `@google/generative-ai`. LLM Consensus = voting multi-model dengan threshold 70%.
  - **Payment**: `midtrans-client` (Midtrans Snap).
  - **MT5 Integration**: Native MetaTrader 5 MCP Server (`http://127.0.0.1:22346/mcp`) via `@modelcontextprotocol/sdk ^1.29.0` / `SSEClientTransport` + EventSource polyfill, DAN Python bridge (`server/mcp-mt5-server/server.py`, `gui.py`, build via `build.bat` → `Hunter Trades AI Trading.exe`).
- **Design Philosophy**: Terminal Noir (Dark theme dengan Gold accent, premium UI/UX, responsive, micro-animations).
- **Testing**: Vitest `^4.1.9` di kedua workspace (server pakai `--pool=forks --max-workers=1` karena native MT5 binding).

## Current Architecture State
- **Desktop App**: Electron wrapper yang menjalankan backend + frontend sebagai child processes.
  - BrowserWindow menampilkan full web UI (`http://localhost:3000`).
  - System tray untuk background operation.
  - Bisa diakses dari browser desktop/mobile di jaringan yang sama.
  - Installer .exe via `electron-builder` + NSIS.
- **Backend**: Express server (port 5000) + WebSocket server. MongoDB Atlas (cloud).
- **Frontend**: Next.js standalone (port 3000). API proxy ke backend via rewrites.
- **MT5 Integration**:
  - Backend Node.js langsung terhubung ke Native MCP Server (`http://127.0.0.1:22346/mcp`).
  - Menggunakan API Key untuk otentikasi.
  - Polling real-time data tick / chart / order langsung via MCP tanpa Python bridge.
- **Auth**: Better Auth + Discord OAuth (hanya member komunitas Discord yang bisa akses).
- **Payment**: Midtrans (planned untuk versi berbayar).

## Backend Services (server/src/services/) — 51+ layanan aktif
| Service | Fungsi Utama |
|---------|--------------|
| `mt5-mcp.service.ts` | SSE/WebSocket RPC Client ke MT5 MCP Server |
| `mt5-scheduler.service.ts` | Auto-sync data tick & chart MT5 secara berkala |
| `ai-trading-engine.service.ts` | Pipeline eksekusi order trading murni AI (BUY/SELL) |
| `llm-consensus.service.ts` | Multi-LLM Consensus Voting (threshold 70%) |
| `agent-consensus.service.ts` | Agent consensus pipeline orchestration |
| `risk-manager.service.ts` | Dynamic lot sizing, margin check, circuit breaker |
| `backtest.service.ts` & `auto-backtest.service.ts` | Backtesting engine & automated cron backtesting |
| `trading-pipeline.service.ts` | End-to-end signal processing, analysis, & execution |
| `macro-ai.service.ts` & `macro-regime.service.ts` | Deteksi rezim makro, yield curve, & kuantifikasi geo-risk |
| `nexus.service.ts` | Multi-agent AI orchestration |
| `ai-coach.service.ts` & `ai-review.service.ts` | Post-trade AI review & coaching psikologi trader |
| `user-memory.service.ts` & `vector-memory.service.ts` | Persistent User Agent Memory & Vector store |
| `proactive-alert.service.ts` & `proactive-watcher.service.ts` | Real-time market proactive alert monitor |
| `playbook.service.ts` | Management Playbook Strategi (ICT, MSNR, SMC) |
| `self-improvement.service.ts` | Agent self-learning loop (update LESSONS.md) |
| `strategies/` | Strategy validation modules (ATR, SMC, ICT, MSNR, SMT correlation, IPDA, Context) |

## Backend Models (server/src/models/) — 25 Model Mongoose
- **Trading Core**: `Trade`, `AITradingSession`, `AITradeLog`, `AiReview`, `TradingAccount`, `MT5Connection`
- **Analytics & Snapshots**: `DailySnapshot`, `GeoRiskSnapshot`, `MacroIndicator`, `YieldCurveSnapshot`, `AgentInsight`
- **Playbook & Knowledge**: `Playbook`, `BacktestExperience`, `AIBacktestSkill`
- **Memory & Agent State**: `ChatSession`, `ReflectionLog`, `UserAgentMemory`, `UserSettings`, `VectorMemory`
- **System & Billing**: `Notification`, `Registration`, `Subscription`, `TokenBalance`, `Transaction`

## Backend Routes (server/src/routes/) — 25 Route Files
- Core Trading: `trade.routes.ts`, `trading-account.routes.ts`, `mt5.routes.ts`, `playbook.routes.ts`
- AI & Agents: `ai-trading.routes.ts`, `ai-review.routes.ts`, `ai-coach.routes.ts`, `agent-consensus.routes.ts`, `nexus.routes.ts`
- Macro & Analytics: `macro-ai.routes.ts`, `macro-regime.routes.ts`, `macro-ai-observer.routes.ts`, `geo-risk.routes.ts`, `quant.routes.ts`, `analytics.routes.ts`, `market-data.routes.ts`
- User & System: `auth.routes.ts`, `auth-v1.routes.ts`, `settings.routes.ts`, `notification.routes.ts`, `payment.routes.ts`, `backtest.routes.ts`, `broker-registration-v1.routes.ts`, `dev-test.routes.ts`

## Frontend Structure (frontend/src/)
- **Pages (20 Routes)**:
  - `(dashboard)/dashboard`: Dashboard utama trading terminal
  - `(dashboard)/ai-trading`: Dashboard AI Trading & Execution stream
  - `(dashboard)/ai-review`: Post-trade AI Review & performance insights
  - `(dashboard)/macro-terminal`: Macro Hub (Overview, Intelligence, COT, Nexus, Quant Lab)
  - `(dashboard)/playbook` & `playbook-form`: Strategi & Checklist Management (streamlined ke ICT, MSNR, SMC)
  - `(dashboard)/analytics`, `(dashboard)/log-trade`, `(dashboard)/settings`, `(dashboard)/onboarding`
- **Components Categories (8 Dir)**:
  - `macro-terminal`, `trade`, `playbook`, `ai-review`, `analytics`, `dashboard`, `layout`, `root`
- **Services (13 Files)**:
  - `ai-coach.service.ts`, `ai-review.service.ts`, `ai-trading.service.ts`, `analytics.service.ts`, `backtest.service.ts`, `broker-registration.service.ts`, `journal.service.ts`, `mt5.service.ts`, `notification.service.ts`, `playbook.service.ts`, `settings.service.ts`, `trade.service.ts`, `trading-account.service.ts`

## Key Features Already Working
1. **Pure AI Order Decision** — AI memutuskan BUY/SELL tanpa toggle manual user
2. **Confluence Filtering** — Priority methodology SMC/ICT + multi-timeframe alignment
3. **LLM Reasoning Cards** — Setiap model AI menampilkan reasoning terpisah
4. **Default Risk 0.5%** — Dynamic lot sizing + daily loss % circuit breaker
5. **Pending Orders** — Tampilan terpisah di bawah Open Positions
6. **AI Trade Coach** — Analisis psikologi trading via 9router
7. **Auto-backtest** — Cron-based backtest berkelanjutan
8. **Macro Regime Detection** — VIX, yield curve, geo risk monitoring
9. **Playbook System** — Dokumentasi strategi trading pribadi
10. **GitHub Releases Auto-Update** — electron-updater

## Development Constraints
- User benci delay → semua harus real-time
- User tidak suka complex process managers (PM2, Task Scheduler)
- User prefer simple, reliable solutions
- Agent harus mandiri — cek LESSONS.md sebelum mulai
- Bahasa komunikasi: Bahasa Indonesia

## Recent Sprint (September 2026)
- 8 agent team dibentuk: LYRA (design), AXIS (backend), NOVA (frontend), RIKU (mobile), KIRA (orchestration), FORGE (devops), VERA (QA), SAGE (docs)
- Dokumentasi baru: infrastructure.md, workflow.md, test-plan.md, README.md
- Mockup visual: overview, signal detail, jurnal (HTML, Terminal Noir theme)
- Storybook stories untuk 3 komponen React
- **PENTING**: Backend `server/` SUDAH LENGKAP. Jangan buat folder `backend/` baru.

## User Preferences
- **Bahasa**: Selalu gunakan bahasa Indonesia saat berkomunikasi.
- **Speed**: User benci delay. Data tick MT5 harus real-time tanpa delay.
- **Autonomy**: Agen harus mandiri, cek LESSONS.md sebelum memulai tugas, jangan menebak root cause.
- **Deployment**: Desktop installer .exe. User install sekali, klik icon, semuanya jalan.
- **Accessibility**: Web UI harus bisa diakses dari browser + mobile (server desktop harus nyala).
