---
title: Hunter Trades Journal
created: 2026-09-21
updated: 2026-09-26
type: entity
tags: [architecture, module, integration, node, electron, nextjs, mongodb, ai]
sources: [raw/articles/project-overview.md]
confidence: high
---

# Hunter Trades Journal

Platform manajemen trading profesional dan jurnal institusional berbasis AI dengan pipeline eksekusi otonom, analisis makroekonomi terintegrasi, dan integrasi MetaTrader 5.

## Gambaran Umum

Hunter Trades Journal adalah aplikasi desktop (Electron 35) + web (Next.js 16.2.1) yang menggabungkan:
- Monitoring akun MT5 real-time via Native MCP & WebSocket RPC ([[mt5-integration]])
- Analisis pasar berbasis strategi kuantitatif murni ([[ict-strategy]], [[smc-strategy]], [[msnr-strategy]])
- Sistem deliberasi multi-agen AI ([[agent-consensus-engine]])
- Terminal analisis makroekonomi komprehensif ([[macro-terminal]])
- Sistem memori persisten & refleksi trader ([[user-agent-memory]])
- Manajemen risiko otomatis & journal insight AI ([[journal-insight-service]])

## Tech Stack (Verified September 2026)

    Layer           Teknologi
    Frontend        Next.js 16.2.1 (App Router), React 19.2.4, Tailwind CSS v4, Lucide React, Recharts 3.8.1, Framer Motion 12.38.0, Three.js / R3F
    Backend         Node.js, Express 5.2.1, TypeScript 5.7, Mongoose 9.3.3 / MongoDB 7.1.1, Better Auth 1.5.6, Zod, Decimal.js, Pino
    AI & LLM        9router (port 20128, auto-free-model), Vercel AI SDK (ai ^7.0.14), Claude/GPT/Gemini multi-agent consensus
    MT5 Bridge      Native MT5 MCP (@modelcontextprotocol/sdk ^1.29.0) + Python client (mcp-mt5-server/server.py)
    Desktop         Electron ^35.0.0, electron-builder ^26, auto-updater
    Payment         Midtrans Client (Snap)

## Arsitektur

    Frontend (Next.js 16.2.1 - Port 3000)
          ↕ (HTTP REST / WebSocket)
    Backend (Express 5.2.1 - Port 5000)
          ↕ (SSE / WebSocket RPC)
    MT5 Native MCP Server (Port 22346) & Python Bridge (Port 5000/ws)
          ↕
    MetaTrader 5 Terminal

## Direktori Kunci

    frontend/src/app/(dashboard)/      — 20 halaman dashboard Next.js (ai-trading, macro-terminal, ai-review, playbook, dll.)
    frontend/src/components/           — 8 kategori komponen UI (macro-terminal, trade, playbook, layout, dashboard, dll.)
    server/src/services/               — 51 service backend (trading-pipeline, llm-consensus, macro-ai, risk-manager, dll.)
    server/src/services/strategies/   — Modul strategi ICT, SMC, MSNR, ATR, Confluence, IPDA
    server/src/models/                 — 25 Mongoose models (Trade, UserAgentMemory, Playbook, YieldCurveSnapshot, dll.)
    server/src/routes/                 — 25 route API Express 5
    server/mcp-mt5-server/             — Python MCP server & GUI launcher
    desktop/                           — Electron 35 main process & packaging configuration
    wiki/                              — Basis pengetahuan arsitektur dan strategi

## Versi

Versi terkini: v1.1.0 (September 2026)

## Lihat Juga

- [[ict-strategy]] — Strategi ICT + CRT
- [[smc-strategy]] — Strategi Smart Money Concept
- [[msnr-strategy]] — Strategi Malaysian SNR Hybrid
- [[mt5-integration]] — Integrasi MetaTrader 5
- [[journal-insight-service]] — Service AI insight journal
- [[macro-terminal]] — Macro Economic Hub & Leading Indicators
- [[agent-consensus-engine]] — Multi-Agent Consensus & Deliberation Engine
- [[user-agent-memory]] — Persistent User Memory & Vector Search Embeddings
