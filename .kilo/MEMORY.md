# Global Memory: Hunter Trades Journal

## Project Identity
- **Name**: Hunter Trades Journal & AI Trading
- **User**: Bang Vir
- **Tech Stack**:
  - **Desktop App**: Electron (server manager + full UI window + system tray).
  - **Frontend**: Next.js 16 (App Router, standalone output), Tailwind CSS, Lightweight Charts, React.
  - **Backend**: Node.js (Express API + WebSocket server), Mongoose, Better Auth (Discord).
  - **MT5 Integration**: Native MetaTrader 5 MCP Server (`http://127.0.0.1:22346/mcp`) via SSEClientTransport & EventSource polyfill.
- **Design Philosophy**: Terminal Noir (Dark theme dengan Gold accent, premium UI/UX, responsive, micro-animations).
- **Provider LLM**: 9router (`http://localhost:20128/v1`), auto-free-model, custom provider.

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

## Backend Services (server/src/services/) — 30+ layanan aktif
| Service | Fungsi |
|---------|--------|
| mt5-mcp.service.ts | Koneksi langsung ke MT5 MCP Server |
| mt5-scheduler.service.ts | Auto-sync data MT5 periodically |
| ai-trading-engine.service.ts | Pipeline keputusan trading AI (pure AI order, tanpa toggle manual) |
| llm-consensus.service.ts | Konsensus multi-LLM (voting berat, threshold 70%) |
| risk.service.ts | Risk management, daily loss circuit breaker |
| risk-manager.service.ts | Dynamic lot sizing, margin check |
| backtest.service.ts | Backtesting engine |
| auto-backtest.service.ts | Auto-backtest cron |
| trading-pipeline.service.ts | End-to-end pipeline Signal → Analysis → Review → Trade |
| market-data.service.ts | Market data (quotes, VIX) |
| ai-coach.service.ts | AI coaching untuk trader |
| ai-review.service.ts | Review otomatis posisi trading |
| macro-ai.service.ts | Macro analysis (regime, yield curve, geo risk) |
| playbook.service.ts | Trading playbook management |
| nexus.service.ts | Nexus multi-agent orchestration |
| notification.service.ts | Notifikasi ke user |

## Backend Models (server/src/models/) — 18 model Mongoose
- Trade, AITradingSession, AITradeLog, AiReview
- MT5Connection, TradingAccount
- DailySnapshot, GeoRiskSnapshot, MacroIndicator, YieldCurveSnapshot
- Playbook, BacktestExperience, AIBacktestSkill
- TokenBalance, Subscription, Transaction
- UserSettings, Notification, Registration

## Backend Routes (server/src/routes/) — 20+ route files
- auth.routes.ts, trade.routes.ts, mt5.routes.ts
- ai-trading.routes.ts, ai-review.routes.ts, ai-coach.routes.ts
- analytics.routes.ts, backtest.routes.ts, macro-ai.routes.ts
- playbook.routes.ts, settings.routes.ts, notification.routes.ts
- payment.routes.ts, trading-account.routes.ts
- nexus.routes.ts, market-data.routes.ts, geo-risk.routes.ts
- quant.routes.ts, macro-regime.routes.ts, broker-registration-v1.routes.ts

## Frontend Services (frontend/src/services/)
- ai-coach.service.ts, ai-review.service.ts, ai-trading.service.ts
- analytics.service.ts, backtest.service.ts
- mt5.service.ts, trade.service.ts, playbook.service.ts
- settings.service.ts, notification.service.ts
- broker-registration.service.ts, trading-account.service.ts

## Frontend Components (frontend/src/components/)
- DashboardCard.tsx, SignalChart.tsx, JournalEntryForm.tsx
- PaymentModal.tsx, TokenRefillModal.tsx, OtaUpdaterModal.tsx

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
