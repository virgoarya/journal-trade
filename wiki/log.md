# Wiki Log

> Chronological record of all wiki actions. Append-only.
> Format: `## [YYYY-MM-DD] action | subject`
> Actions: ingest, update, query, lint, create, archive, delete
> Rotate to log-YYYY.md when entries exceed 500.

## [2026-09-21] create | Wiki initialized
- Domain: Journal Trade Framework
- Structure: wiki/SCHEMA.md, wiki/index.md, wiki/log.md
- Directories: raw/articles, raw/papers, raw/transcripts, raw/assets, entities, concepts, comparisons, queries

## [2026-09-26] update | Hunter Trades Journal & Architecture Sync
- Updated entities/hunter-trades-journal.md with verified tech stack (Next.js 16.2.1, React 19, Express 5.2.1, Electron 35, 9Router).
- Ingested & created 3 new entity pages:
  - entities/macro-terminal.md (Macro Terminal, 2x2 Matrix, Liquidity ON RRP/TGA, COT Scanner, Geo Risk Radar)
  - entities/agent-consensus-engine.md (Multi-LLM voting, Hawk/Dove/Contrarian personas, 70% threshold)
  - entities/user-agent-memory.md (UserAgentMemory, VectorMemory embeddings, reflection logs)
- Updated SCHEMA.md tag taxonomy (added macro, consensus, ai, memory).
- Updated index.md: 9 total pages indexed.

## [2026-10-19] update | Agent Consensus Engine — ADR-0001 + ADR-0002
- Rewrote entities/agent-consensus-engine.md to reflect Agent Consensus as active consensus path (ADR-0002 full replace).
- Added: weighted voting (Hawk 1.5, Dove 1.0, Contrarian 1.0), ≥60% threshold, memory injection Top-5, PostgreSQL agent_db, pgvector hybrid, rollback path (llm-consensus.service.ts retained).
- Sources: docs/adr/ADR-0001-agent-consensus-engine.md, docs/adr/ADR-0002-agent-consensus-rollout.md.
- Updated index.md summary.

## [2026-10-20] update | Sprint v1.2.1 Consolidation & Full Replace Completion
- Full Replace Konsensus (ADR-0002): Transisi visual hero HUD AI Trading dari 6-node LLM ke Agent Consensus Breakdown (`c2a57f9`), menampilkan Hawk (1.5), Dove (1.0), Contrarian (1.0), Bias Radar, dan Consensus Score.
- Backend Pipeline: Fix dead code flag `agentConsensus.enabled` di Zod schema settings & route (`938d604`), kalkulasi weighted voting (`1682e5c`), dan isolasi memori per-persona serta confidence ranking (`e37bb1b`). Rollback path ke `llm-consensus.service.ts` tetap aman.
- Kualitas & Pengujian: E2E test suite Task 3.4 (`frontend/e2e/agent-consensus.spec.ts`) lulus 10/10 test cases (`43348e6`), suite unit test backend 44/44 pass.
- DevOps & Tooling: Setup ESLint flat config v9 dan konsolidasi coverage e2e (`f8ba0a6`, `e2cde18`, `e7089f7`).
- UX & Guidance: Fix overlay walkthrough onboarding agar mendukung click-outside dismiss (`e9b2bd2`).
- Infrastruktur: Verifikasi koneksi MongoDB Atlas via SRV record (shards `159.143.58.x`) dan fallback lokal port 27017.