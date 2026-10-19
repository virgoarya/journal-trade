---
title: Agent Consensus Engine
created: 2026-09-26
updated: 2026-10-19
type: entity
tags: [architecture, pipeline, consensus, ai, module, agent, memory]
sources: [docs/adr/ADR-0001-agent-consensus-engine.md, docs/adr/ADR-0002-agent-consensus-rollout.md]
confidence: high
---

# Agent Consensus Engine

Konsensus AI Trading yang dijalankan oleh **tiga agent berpersona dengan memory**, menggantikan
voting LLM stateless. Keputusan tercatat di [[hunter-trades-journal]].

> **Perubahan besar (2026-10-19):** engine ini **menggantikan** LLM Consensus (voting 6 model)
> sebagai jalur aktif. Lihat [ADR-0001](../../docs/adr/ADR-0001-agent-consensus-engine.md) (arsitektur)
> dan [ADR-0002](../../docs/adr/ADR-0002-agent-consensus-rollout.md) (rollout: full replace).

## Gambaran Umum

`agent-consensus.service.ts` mengorkestrasikan tiga agent persona melalui 9Router untuk menilai
sinyal trading hasil confluence **SMC / ICT / MSNR**. Output bukan sekadar vote biner — tapi
**verdict + reasoning + confidence**.

**Dua mode debat:**
- `runParallelDebate()` — ketiga agent menjawab bersamaan tanpa saling melihat (jalur pipeline)
- `runSequentialDebate()` — rantai Hawk → Dove (merespons Hawk) → Contrarian (menantang keduanya)
  → sintesis; hasil debat disimpan ke `AgentInsight`

## Persona Agent

| Persona | Peran | Bobot | Fokus |
|---|---|---|---|
| **Hawk** | Risk / capital preservation | **1.5** | Stop-out, sensitivitas likuiditas, tail risk |
| **Dove** | Opportunity / momentum | 1.0 | Peluang bullish, trend continuation, risk/reward |
| **Contrarian** | Skeptis / devil's advocate | 1.0 | Anomali, kegagalan konsensus, risiko tersembunyi |

Hawk lebih berat (1.5) karena perannya menjaga modal.

## Voting Terbobot

`calculateWeightedConsensus(votes, threshold)` menghitung skor terbobot:

```
skor_bullish = Σ(confidence × bobot) / Σ(bobot)   untuk vote BULLISH
skor_bearish = Σ(confidence × bobot) / Σ(bobot)   untuk vote BEARISH

threshold ≥ 0.60 → verdict GOOD (bullish) / BAD (bearish)
di bawah threshold → SKIP
```

`adaptDebateResult()` mengubah hasil debat menjadi bentuk yang dipakai pipeline
(verdict + consensus + votes per persona).

## Memory (PostgreSQL)

Memory membuat agent belajar dari pengalaman user, bukan stateless.

- **Penyimpanan:** PostgreSQL via Prisma — `DATABASE_URL_AGENT` → `agent_db`
  (model `UserProfile`, `UserMemoryNote`, `UserAgentMemory`).
- **`buildMemoryContext(userId, personaId)`** — menyusun konteks memori per persona:
  fakta umum + fakta spesifik persona + instruksi fokus sesuai peran.
  Setiap fakta punya field `confidence` (0–1) untuk peringkat injeksi ke prompt (ADR-0001).
- **`topByConfidence(facts, limit)`** — mengurutkan fakta by confidence (desc), recency
  sebagai tie-break. Fakta lama tanpa field `confidence` dianggap netral 0.5 (tidak dibuang diam-diam).
- **`buildTradeHistoryContext(userId)`** — mengambil 10 `AITradeLog` terakhir, menghitung
  win rate / total profit / rata-rata profit / simbol teratas, dan menyuntikkannya sebagai
  *"bukti performa masa lalu"*.

## Integrasi Pipeline

`trading-pipeline.service.ts` memilih jalur konsensus lewat feature flag:

```
if (pipeline.config.agentConsensus?.enabled)      → Agent Consensus (Hawk/Dove/Contrarian + memory)
else if (pipeline.config.llmConsensus?.enabled)   → LLM Consensus (jalur lama, rollback)
```

- Flag `agentConsensus.enabled` **default `false`** — sengaja, sebagai jalur rollback (ADR-0002).
- `llm-consensus.service.ts` **sengaja tidak dihapus** sampai Agent Consensus lolos QA.
- Memory dikirim **per-persona** lewat `context.personaMemory` — masing-masing agent hanya menerima
  bloknya sendiri, tidak bocor antar persona.
- Dedup: sinyal dengan symbol+direction+entry yang sama tidak dinilai ulang dalam 1 jam.

## ⚠️ Gap yang diketahui (sedang diperbaiki)

Didokumentasikan agar tidak dianggap desain:

1. **Memory per-persona belum penuh** — pipeline masih membangun konteks memory untuk persona
   `"hawk"` saja dan memakainya untuk ketiga agent, sehingga Dove & Contrarian belum menerima
   memory spesifik personanya (`trading-pipeline.service.ts`).
2. **Peringkat memory belum by confidence** — `buildMemoryContext` masih mengambil 5 fakta
   terakhir (recency), padahal ADR-0001 menetapkan *top-5 by confidence*. Field `confidence`
   sudah ada di schema; pengurutan belum.

## Services Terkait

- `agent-consensus.service.ts` — engine debat + voting terbobot + memory/trade context
- `trading-pipeline.service.ts` — titik integrasi + feature flag
- `llm-consensus.service.ts` — jalur lama (dipertahankan untuk rollback)
- `user-memory.service.ts` — penyimpanan memory user (PostgreSQL)
- `agents/specific.agents.ts` — definisi persona Hawk / Dove / Contrarian

## Lihat Juga

- [[hunter-trades-journal]] — Platform utama
- [[user-agent-memory]] — Model memory agent
- [[macro-terminal]] — Sumber data makro
- [[ict-strategy]] · [[smc-strategy]] · [[msnr-strategy]] — Strategi yang divalidasi agent
