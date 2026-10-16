---
title: Agent Consensus Engine
created: 2026-09-26
updated: 2026-09-26
type: entity
tags: [architecture, pipeline, consensus, ai, module]
sources: [raw/articles/project-overview.md]
confidence: high
---

# Agent Consensus & LLM Deliberation Engine

Sistem voting multi-agen otonom untuk memvalidasi sinyal trading dan memandu arah kebijakan makroekonomi melalui konsensus terdistribusi.

## Gambaran Umum

Agent Consensus Engine mengorkestrasikan beberapa model AI (Claude, Gemini, Groq via [[hunter-trades-journal]] 9router) untuk menganalisis kondisi pasar secara paralel. Keputusan akhir eksekusi memerlukan ambang batas konsensus minimal 70% atau voting mayoritas positif.

## Persona Agen Spesifik

1. **Hawk (The Monetary Tightener)**:
   - Fokus pada risiko inflasi, penarikan likuiditas, dan suku bunga tinggi.
2. **Dove (The Liquidity Expansionist)**:
   - Fokus pada pelonggaran moneter, injeksi likuiditas, dan pertumbuhan aset risiko.
3. **Contrarian (The Market Skeptic)**:
   - Fokus pada jebakan likuiditas (trap), overbought/oversold ekstrem, dan pembalikan tren (reversal).

## Alur Deliberasi & Voting

1. Sinyal trading atau snapshot makro diterima oleh orchestrator (`agent-consensus.service.ts` / `llm-consensus.service.ts`).
2. Prompt dikirim paralel ke model-model 9router dengan timeout 8-45 detik.
3. Setiap agen memberikan skor keyakinan (confidence score), sentimen (BULLISH/BEARISH/NEUTRAL), dan alasan taktis (reasoning).
4. Engine menghitung agregat bobot suara. Jika threshold tercapai (≥70%), sinyal dinyatakan **APPROVED**; jika tidak, **REJECTED** atau **SKIPPED**.

## Backend Services Terkait

- `llm-consensus.service.ts` — Engine voting paralel multi-model
- `agent-consensus.service.ts` — Manajemen pipeline konsensus agen
- `nexus.service.ts` — Orkestrasi multi-agen makroekonomi

## Lihat Juga

- [[hunter-trades-journal]] — Platform utama
- [[macro-terminal]] — Sumber data makro untuk deliberasi agen
- [[ict-strategy]] — Konfluensi strategi teknikal yang divalidasi agen
