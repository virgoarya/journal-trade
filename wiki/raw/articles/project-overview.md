---
source_url: local://D:/Journal Trade/README.md
ingested: 2026-09-21
sha256: readme-initial
---

# Hunter Trades Journal — Project Overview

Professional AI-Powered Trading Journal & Automated Pipeline System with MetaTrader 5 (MT5) Integration.

## Tech Stack
- Frontend: Next.js 16 (App Router), React 19, Tailwind CSS, Recharts, Framer Motion
- Backend: Node.js, Express 5, TypeScript, Mongoose (MongoDB), Better Auth
- MT5 Bridge / MCP: Python MetaTrader5 library, Model Context Protocol (MCP)
- Desktop App: Electron (cross-platform)
- Containerization: Docker & Docker Compose

## Architecture
Frontend (Next.js) → Backend (Express) → MT5 MCP Server (Python) → MetaTrader 5 Terminal

## Key Directories
- server/src/services/strategies/ — ICT, SMC, MSNR strategy files
- frontend/src/components/ai-review/ — AI Review Tab components
- server/src/services/ — Core backend services (journal-insight, market-structure, etc.)
