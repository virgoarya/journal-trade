---
title: Agent Consensus Engine
created: 2026-09-26
updated: 2026-10-21
type: entity
tags: [architecture, pipeline, consensus, ai, module, agent, memory]
sources: [docs/adr/ADR-0001-agent-consensus-engine.md, docs/adr/ADR-0002-agent-consensus-rollout.md]
confidence: high
---

# Agent Consensus Engine

Konsensus AI Trading yang dijalankan oleh **tiga agent berpersona dengan memory**, menggantikan
voting LLM stateless. Keputusan arsitektur & rollout-nya ada di ADR; halaman ini adalah
**orientasi + keadaan kode yang terverifikasi**, bukan salinan ADR.

> **Perubahan besar:** engine ini **menggantikan** LLM Consensus (voting 6 model) sebagai jalur
> konsensus aktif. Lihat [ADR-0001](../../docs/adr/ADR-0001-agent-consensus-engine.md) (arsitektur:
> memory, threshold, agent count, pgvector) dan
> [ADR-0002](../../docs/adr/ADR-0002-agent-consensus-rollout.md) (rollout: **full replace**).
> Setiap keputusan yang berubah ditulis sebagai ADR baru — halaman ini mengikuti ADR, tidak
> menggantikannya.

## Gambaran Umum

`server/src/services/agent-consensus.service.ts` (485 baris) mengorkestrasikan tiga agent persona
lewat 9Router untuk menilai sinyal trading hasil confluence **SMC / ICT / MSNR**. Output bukan
sekadar vote biner — tapi **verdict + reasoning + confidence**.

**Dua mode debat:**

| Mode | Fungsi | Dipakai oleh |
|---|---|---|
| **Parallel** | `runParallelDebate()` — ketiga agent menjawab bersamaan, tidak saling melihat | **Jalur pipeline** (`trading-pipeline.service.ts`) |
| **Sequential** | `runSequentialDebate()` — rantai Hawk → Dove (merespons Hawk) → Contrarian (menantang keduanya) → sintesis | API `POST /v1/agent-consensus/debate` |

Keduanya diakhiri `synthesize()` — satu panggilan LLM berperan *Head of Institutional Desk* yang
meringkas area konsensus, divergensi, bias akhir, dan conviction. Hasil sequential debate disimpan
ke `AgentInsight` (`insightType: "debate"`); koleksi itu punya **TTL 7 hari** (auto-delete).

## Persona Agent

Didefinisikan di `server/src/agents/specific.agents.ts` (44 baris):

| Persona | Nama kelas | Bobot | Fokus |
|---|---|---|---|
| **Hawk** | `HawkAgent` — *"Quant & Tightening"* | **1.5** | Risiko, inflasi, crash likuiditas, stop-out, tail risk |
| **Dove** | `DoveAgent` — *"Akomodasi & Stimulus"* | 1.0 | Peluang bullish, pelonggaran likuiditas, momentum, risk/reward |
| **Contrarian** | `ContrarianAgent` — *"Devil's Advocate"* | 1.0 | Anomali, kelemahan konsensus pasar, risiko tersembunyi |

Hawk lebih berat (1.5) karena perannya menjaga modal (*capital preservation*) — ADR-0001 Keputusan 3.

## Voting Terbobot

`calculateWeightedConsensus(votes, threshold)` — sinkron, tanpa I/O. Dipanggil oleh
`adaptDebateResult()` supaya threshold ADR benar-benar berlaku di pipeline, bukan hanya di unit test.

```
weights = { hawk: 1.5, dove: 1.0, contrarian: 1.0 }
totalWeight   = Σ bobot SEMUA vote (termasuk yang NEUTRAL)
bullishScore  = Σ(confidence × bobot) / totalWeight   untuk vote BULLISH
bearishScore  = Σ(confidence × bobot) / totalWeight   untuk vote BEARISH

bullishScore ≥ threshold → verdict GOOD  (finalBias BULLISH)
bearishScore ≥ threshold → verdict BAD   (finalBias BEARISH)
selain itu               → verdict SKIP  (finalBias = skor yang lebih besar)
```

- `threshold` default **0.60** (ADR-0001 Keputusan 2: menggantikan simple majority ≥70%).
- Bias & confidence tiap persona **di-parse dari teks bebas** balasan agent: `parseBias()` menghitung
  kata bull/long/buy vs bear/short/sell; `parseConfidence()` memprioritaskan angka `NN%` eksplisit,
  lalu kata hedge (very high/high/moderate/low), fallback **0.5**.
- `adaptDebateResult()` mengubah hasil debat ke bentuk yang dipakai pipeline
  (`verdict` + `consensus` + `goodVotes`/`totalVotes` + `votes[]` per persona). `goodVotes` = jumlah
  vote ber-bias BULLISH.

## Memory Agent

Memory membuat keputusan agent **terpersonalisasi per user**, bukan stateless.

- **Penyimpanan (terverifikasi 2026-10-21): MongoDB** — model Mongoose `UserAgentMemory`
  (`server/src/models/UserAgentMemory.ts`, koleksi `user_agent_memories`), diakses lewat
  `userMemoryService.getOrCreate()` (`server/src/services/user-memory.service.ts`) dengan cache
  in-memory 5 menit.
  > ⚠️ ADR-0001 menyebut memory di PostgreSQL/Prisma (`DATABASE_URL_AGENT` → `agent_db`, model
  > `UserProfile`/`UserMemoryNote`). Jalur yang **benar-benar di-inject ke prompt konsensus** adalah
  > MongoDB. Lihat *Catatan implementasi* di bawah.
- **`buildMemoryContext(userId, personaId)`** — menyusun blok memori **per persona**:
  fakta umum user (`learnedFacts`) + fakta spesifik persona (`agentMemories[].facts`) + instruksi
  fokus sesuai peran. Dua-duanya dipotong **top-5**.
- **`topByConfidence(facts, 5)`** — urut `confidence` desc, **recency sebagai tie-break**. Fakta lama
  tanpa field `confidence` dianggap netral 0.5 (tidak dibuang diam-diam) — sesuai ADR-0001 Keputusan 1.
- **`buildTradeHistoryContext(userId)`** — mengambil 10 `AITradeLog` terakhir dari MongoDB, **hanya
  trade yang sudah settled** (`pnl != null`; posisi terbuka & pending order tidak dihitung agar win
  rate tidak bias), lalu menyuntikkan win rate / total profit / rata-rata profit / simbol teratas
  sebagai *"bukti performa masa lalu"*.
- **Isolasi per persona** — masing-masing agent hanya menerima blok memorinya sendiri
  (`context.personaMemory[persona]`), tidak bocor antar persona (fix `e37bb1b`).

## Integrasi Pipeline

`trading-pipeline.service.ts` memilih jalur konsensus lewat feature flag:

```
if      (pipeline.config.agentConsensus?.enabled) → Agent Consensus (Hawk/Dove/Contrarian + memory)
else if (pipeline.config.llmConsensus?.enabled)   → LLM Consensus  (jalur lama — rollback)
```

- `agentConsensus` default: `{ enabled: false, debateMode: "parallel", memoryEnabled: true,
  toolEnabled: true, threshold: 0.6 }`.
- **Rollback sengaja hidup** (ADR-0002 batasan #1 & #2): `llm-consensus.service.ts` (1.239 baris)
  **tidak dihapus**, dan `ai-trading.routes.ts` **memaksa** `llmConsensus.enabled = true` saat
  `useAppliedConfig` sementara `agentConsensus` **sengaja tidak di-force** — flag inilah tombol
  rollback-nya.
- **Dedup:** sinyal dengan `symbol + direction + entry` yang sama tidak dinilai ulang dalam **1 jam**.
- Memory dijalankan **per-persona** di pipeline: loop `["hawk","dove","contrarian"]` →
  `buildMemoryContext(userId, persona)` → dikirim sebagai `context.personaMemory`.
- Hasil dilog bertahap: `AGENT CONSENSUS RESULT: TRADE APPROVED/REJECTED`, `Agent Votes: N/3 GOOD`,
  lalu satu baris per persona (`hawk: BULLISH — <reasoning 100 char>`), dengan payload
  `{ agentConsensus: adapted }` yang dikonsumsi UI (`AgentBreakdown.tsx`).

## API

`server/src/routes/agent-consensus.routes.ts` (212 baris) — **seluruh router memakai `requireAuth`**
(`router.use(requireAuth)`; pernah hilang, tanpa itu `req.user` selalu `undefined` dan filter
per-user gagal senyap). Router di-mount di **`/api`** (`server/src/index.ts:115`), jadi path penuh =
`/api` + path di tabel:

| Method | Path | Fungsi |
|---|---|---|
| POST | `/v1/agent-consensus` | Debat (body `mode: parallel \| sequential`) |
| POST | `/v1/agent-consensus/debate` | Sequential debate chain (Hawk → Dove → Contrarian → sintesis) |
| POST | `/parallel` · `/sequential` | Varian eksplisit per mode — **tanpa prefix** `/v1/agent-consensus` (lihat divergensi #8) |
| POST | `/v1/agent-consensus/single/:persona` | Satu agent (`hawk`/`dove`/`contrarian`) |
| POST | `/v1/agent-consensus/deep-research` | Siklus critical thinking (`deepResearchService`) |
| GET | `/v1/agent-consensus/insights` | Riwayat `AgentInsight` **milik user yang login** |
| GET | `/v1/agent-consensus/proactive` · `/proactive/latest` | Insight proaktif per-user |
| POST | `/v1/agent-consensus/proactive/run` | Trigger siklus proaktif manual (202, async) |

## Catatan implementasi & divergensi (terverifikasi 2026-10-21)

Dicatat agar tidak dibaca sebagai desain:

1. **Memory store menyimpang dari ADR.** Yang di-inject ke prompt konsensus adalah **MongoDB**
   `UserAgentMemory`; ADR-0001 menyebut PostgreSQL/Prisma + pgvector hybrid. Prisma/PostgreSQL
   (`DATABASE_URL_AGENT` → `agent_db`, `UserProfile`/`UserMemoryNote`) memang ada dan dipakai, tetapi
   oleh jalur lain — `lib/agent/profile-repo.ts`, `memory-extractor.service.ts`, `ai-coach.service.ts` —
   bukan oleh consensus engine. **pgvector belum ada di kedua jalur.**
2. **`confidence` belum pernah ditulis ≠ 0.5.** `learnFact()` / `learnPersonaFact()` menyimpan
   `{ date, fact, category }` tanpa `confidence`, sehingga schema mengisi default 0.5 untuk semua fakta.
   Mekanisme *top-5 by confidence* sudah ada dan benar, tapi karena datanya seragam ia praktis
   menjadi *ranking by recency*. Untuk benar-benar sesuai ADR-0001, penulis fakta harus mengisi skor.
3. **Jalur chat masih recency.** `userMemoryService.getPromptContext()` (chat 1-on-1) memakai
   `.slice(-5)` — belum confidence-ranked. Jalur berbeda dari konsensus; jangan disamakan.
4. **Skor di UI ≠ skor verdict.** `AgentBreakdown.tsx` menampilkan `goodVotes / totalVotes` (rasio
   BULLISH **tanpa bobot**), sedangkan verdict engine dihitung dari skor **terbobot**
   (`calculateWeightedConsensus`). Keduanya bisa tampak berbeda saat vote tidak bulat.
5. **`toolEnabled` belum dibaca.** Ada di Zod schema, default config, dan tipe — tapi tidak ada
   konsumen di jalur konsensus. Field konfigurasi mati; jangan dokumentasikan sebagai fitur aktif.
6. **Status aktivasi.** Flag default **`false`**. Seluruh penulis flag & kontrol UI **sudah committed**
   (per 2026-10-21): Zod schema `settings.routes.ts` (menulis ke `aiTrading.agentConsensus` **dan**
   `savedPipelineConfigs.<server>.agentConsensus`), merge di route start pipeline
   (`ai-trading.routes.ts`), serta kontrol UI `AgentConsensusConfig.tsx` yang di-wire di
   `TradingPanel.tsx` dengan state di `AiTradingContext.tsx` (`223f3d5`). Artinya user **bisa**
   menyalakan jalur ini dari settings — tapi tetap default `false`, dan sesuai ADR-0002 fitur baru
   boleh disebut "aktif" setelah dinyalakan **dan** lolos QA + strict gate.
7. **Kalau kedua flag `false`**, tidak ada tahap konsensus yang jalan sama sekali — pipeline langsung
   ke Stage 3 (risk check & sizing). Ini konsekuensi wajar dari `if/else if`, tapi perlu disadari
   saat membaca log pipeline yang tidak punya baris `[2/4]`.
8. **Rute `/parallel` & `/sequential` tanpa prefix.** Keduanya di-mount langsung di `/api`
   (`/api/parallel`, `/api/sequential`), **bukan** `/api/v1/agent-consensus/parallel` seperti pola
   rute lain di router yang sama. Jangan diasumsikan mengikuti prefix `/v1/agent-consensus`.

## Services Terkait

- `agent-consensus.service.ts` — engine debat + voting terbobot + memory/trade context
- `trading-pipeline.service.ts` — titik integrasi + feature flag + dedup 1 jam
- `llm-consensus.service.ts` — jalur lama (dipertahankan untuk rollback, ADR-0002)
- `user-memory.service.ts` — penyimpanan memory agent (MongoDB)
- `agents/specific.agents.ts` — definisi persona Hawk / Dove / Contrarian
- `models/AgentInsight.ts` — arsip insight & debate (per-user, TTL 7 hari)

## Lihat Juga

- [[hunter-trades-journal]] — Platform utama
- [[user-agent-memory]] — Model memory agent
- [[macro-terminal]] — Sumber data makro
- [[ict-strategy]] · [[smc-strategy]] · [[msnr-strategy]] — Strategi yang divalidasi agent

## Referensi

- [ADR-0001 — Agent Consensus Engine](../../docs/adr/ADR-0001-agent-consensus-engine.md)
- [ADR-0002 — Rollout: Full Replace](../../docs/adr/ADR-0002-agent-consensus-rollout.md)
- Commit terkait: `e37bb1b` (per-persona memory + confidence-ranked facts), `1682e5c` (enforce weighted voting)
