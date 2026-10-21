# AXIS-1 — Verifikasi Routing `agentConsensus.enabled=true`

**Task:** `t_1550d5a5` · **Assignee:** axis · **Tanggal:** 2026-10-21
**Repo:** `D:\Journal Trade` · **HEAD saat verifikasi:** `877513c`
**Status:** ✅ Routing TERBUKTI BENAR (4/4 klaim). ⚠️ 1 bug baru ditemukan di branch Agent (dilaporkan, **tidak** diperbaiki — menunggu arahan KIRA).

---

## Ringkasan Eksekutif

Pertanyaan Nova: *apakah `agentConsensus.enabled=true` benar-benar memilih Agent path
(Hawk/Dove/Contrarian), bukan LLM path?*

**Jawaban: YA.** Flag tersebut live sampai ke `trading-pipeline.service.ts:1250`, dan di
situ branch Agent dijalankan **eksklusif** — `llmConsensusService.evaluate()` **tidak pernah
dipanggil** saat flag `true`. Rollback ADR-0002 juga utuh: `enabled=false` mengembalikan jalur
LLM tanpa menulis kode baru.

Semua klaim diverifikasi dengan **test yang menjalankan router HTTP asli + service asli**
(`server/src/__tests__/agent-consensus-routing-e2e.test.ts`), bukan test yang
meng-implementasi ulang predicate (yang tidak bisa gagal saat kode berubah).

---

## Bukti per Klaim

### (1) `trading-pipeline.service.ts:1250` → Agent path ✅

```
server/src/services/trading-pipeline.service.ts:1250
  if (pipeline.config.agentConsensus?.enabled) {
```

- Commit pengubah baris: **`f685ac05`** (`feat(pipeline): integrate Agent Consensus Engine
  with feature flag (Task 1.6)`) — ancestor of HEAD `877513c`.
- Isi branch Agent (1250–1324): dedup 1 jam (1253), build memory **per-persona** hawk/dove/
  contrarian (1270–1276), trade history (1277–1279), `runParallelDebate` (1296),
  `adaptDebateResult` (1306), logging verdict + votes (1312–1323).
- **Eksklusivitas:** branch ditutup `} else if (pipeline.config.llmConsensus?.enabled) {`
  di **baris 1325** — `if`/`else if`, jadi LLM path **tidak mungkin** jalan bersama Agent.

**Evidence runtime:** test `AXIS-1b` — `enabled=true` → `runParallelDebate` dipanggil,
`llmConsensusService.evaluate` **0 panggilan**.

### (2) `settings.routes.ts:138-140` → ditulis ke BOTH stores ✅

```
server/src/routes/settings.routes.ts:138-141
    if (agentConsensus) {
      update["aiTrading.agentConsensus"] = agentConsensus;
      update[`savedPipelineConfigs.${brokerServer}.agentConsensus`] = agentConsensus;
    }
```

- Commit pengubah: **`938d6048`** — ancestor of HEAD.
- Zod schema menerima flag: `settings.routes.ts:41-47` (`enabled`, `debateMode`,
  `memoryEnabled`, `toolEnabled`, `threshold`) — inilah perbaikan "dead code flag".
- Default: `settings.routes.ts:50-56` (`enabled: false`, `threshold: 0.6`).
- GET membaca `settings.routes.ts:106` dan `:153` → `aiTrading.agentConsensus || DEFAULT`.

**Kenapa BOTH stores wajib (terbukti, bukan asumsi):** `ai-trading.routes.ts:545-548`
merges dengan urutan *generic dulu, per-broker kemudian* — jadi **per-broker menang**.
Test `AXIS-1d`:
- `aiTrading=false` + `savedPipelineConfigs[server]=true` → live config `enabled=true` ✅
- `aiTrading=true` + `savedPipelineConfigs[server]=false` → live config `enabled=false` ✅
  (store per-broker yang *stale* akan men-shadow enable generik — inilah alasan write
  tunggal ke `aiTrading.*` tidak cukup.)

### (3) `ai-trading.routes.ts:545-547` → merge store ke execution config ✅

```
server/src/routes/ai-trading.routes.ts:541-549
            // Agent Consensus is deliberately NOT force-enabled ... ADR-0002 rollback flag
            agentConsensus: {
              ...(settings.aiTrading?.agentConsensus || {}),
              ...(configToUse.agentConsensus || {}),
            },
```

- Commit pengubah: **`938d6048`** — ancestor of HEAD.
- Berada di dalam `if (req.body.useAppliedConfig)` (baris 523); `configToUse` =
  `savedPipelineConfigs[server]` (baris 530-531).
- **Penting:** `llmConsensus` di baris 536-540 di-**FORCE** `enabled: true` (jalur rollback
  selalu hidup), sedangkan `agentConsensus` **sengaja tidak di-force** — flag inilah tombol
  rollback ADR-0002.

**Evidence runtime:** test `AXIS-1` (pertama) — POST `/api/ai-trading/pipeline/start` dengan
`useAppliedConfig:true` → `pipelineConfig.agentConsensus.enabled === true` di object yang
**persis** dibaca baris 1250. Frontend selalu mengirim `useAppliedConfig:true`
(`frontend/src/app/(dashboard)/ai-trading/components/TradingPanel.tsx:96`).

### (4) Rollback flag ADR-0002 tetap ada ✅

- `docs/adr/ADR-0002-agent-consensus-rollout.md` — batasan #2: *"Rollback path harus ada…
  tanpa menulis kode baru (mis. flag/config)"*.
- Implementasi: `enabled=false` → branch Agent dilewati → `else if` LLM path aktif
  (`trading-pipeline.service.ts:1325-1404`).
- `llm-consensus.service.ts` **tidak dihapus** (sesuai batasan #1).
- `CHANGELOG.md:15` mencatat: *"Rollback Path Terjaga: `llm-consensus.service.ts` tetap
  dipertahankan di backend sebagai fallback `else if` jika `agentConsensus.enabled`
  dimatikan."*

**Evidence runtime:** test `AXIS-1b` (kedua) — `enabled=false` → `llmConsensusService.evaluate`
dipanggil, `runParallelDebate` **0 panggilan**. Test `AXIS-1` (kedua) — `enabled:false`
bertahan di live config.

---

## ⚠️ TEMUAN BARU (BUG) — branch Agent tidak punya verdict gate

**Severity: TINGGI (perilaku trading). Status: BELUM DIPERBAIKI — menunggu arahan KIRA.**

`isTrade` dihitung di `trading-pipeline.service.ts:1310` tapi **hanya dipakai untuk log**
(baris 1313). Tidak ada `if (!isTrade) continue;` di branch Agent (1250–1324).
Branch LLM **punya** gate itu di baris **1400**.

Akibatnya: verdict Agent `BAD` / `SKIP` **tidak memblokir order** — pipeline lanjut ke
STAGE 3/4 dan tetap membuka posisi. Padahal log menulis `"TRADE REJECTED"`.

**Evidence runtime (probe, `AXIS-1c`):**

| Skenario | Order dibuka? |
|---|---|
| Agent `enabled=true` + verdict `BAD` | **YA** ❌ (tidak ada gate) |
| LLM `enabled=false→LLM path` + verdict `BAD` | **TIDAK** ✅ (gate baris 1400) |

Perbaikan yang benar: tambahkan `if (!isTrade) { continue; }` di ujung branch Agent
(meniru pola baris 1400-1402), lalu tulis test TDD. **Tidak saya kerjakan** karena body task
melarang mengubah behaviour tanpa lapor KIRA — sudah dilaporkan via komentar task ini dan
dibuatkan child task.

---

## Catatan Sekunder (latent, non-blocker)

`pipelineConfigSchema` (`server/src/validators/ai-trading.validator.ts:83-99`) **tidak** memiliki
key `agentConsensus`, jadi Zod me-strip key itu dari request body. Jalur `useAppliedConfig:false`
dengan body berisi `agentConsensus` oleh karena itu selalu jatuh ke default `enabled:false`.
UI saat ini tidak terpengaruh (selalu kirim `useAppliedConfig:true`,
`TradingPanel.tsx:96`), jadi ini **latent** — relevan hanya jika ada client lain yang POST
langsung. Test `AXIS-1` (ketiga) mendokumentasikan GAP ini.

---

## Cara Reproduksi

```bash
cd D:/Journal Trade/server
npx vitest run src/__tests__/agent-consensus-routing-e2e.test.ts \
  --pool=forks --max-workers=1 --reporter=verbose
# Hasil: 10 passed (10)
```

Test terkait yang juga dijalankan (tidak ada regresi):
```bash
npx vitest run src/__tests__/settings-agent-consensus-flag.test.ts \
  src/__tests__/agent-consensus-pipeline-integration.test.ts \
  --pool=forks --max-workers=1
# Hasil: 15 passed (15)
```

## File Evidence

| File | Baris | Commit |
|---|---|---|
| `server/src/services/trading-pipeline.service.ts` | 1250 (predicate), 1310 (`isTrade`), 1325 (`else if` LLM), 1400 (gate LLM) | `f685ac05` |
| `server/src/routes/settings.routes.ts` | 41-47 (zod), 50-56 (default), 106 & 153 (GET), 138-141 (write both stores) | `938d6048` |
| `server/src/routes/ai-trading.routes.ts` | 536-540 (force LLM), 541-549 (merge agentConsensus) | `938d6048` |
| `server/src/validators/ai-trading.validator.ts` | 83-99 (`pipelineConfigSchema` — tanpa `agentConsensus`) | — |
| `frontend/src/app/(dashboard)/ai-trading/components/TradingPanel.tsx` | 96 (`useAppliedConfig: true`) | — |
| `docs/adr/ADR-0002-agent-consensus-rollout.md` | 44-51 (batasan rollback) | — |
| `server/src/__tests__/agent-consensus-routing-e2e.test.ts` | 399 baris — bukti eksekusi | commit AXIS-1 |
