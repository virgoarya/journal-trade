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