# ADR-0001 — Agent Consensus Engine untuk AI Trading

- **Status:** ✅ **Accepted** — 2026-10-19
- **⚠️ Sebagian digantikan:** klausul *rollout* (shadow mode) digantikan oleh
  [ADR-0002](ADR-0002-agent-consensus-rollout.md) — rollout jadi **full replace**.
  Keputusan memory/threshold/agent-count/pgvector di ADR ini tetap berlaku.
- **Owner keputusan:** Bang Vir (Vir.Trades)
- **Penulis:** Sage (Docs/DX)
- **Kontributor analisis:** KIRA (orkestrasi), Axis (backend), Forge (infra), Vera (QA)
- **Scope:** hanya AI Trading (satu-satunya konsumen LLM Consensus)

---

## 1. Konteks

AI Trading saat ini memakai **LLM Consensus**: satu sinyal dinilai beberapa model LLM
(via 9Router), lalu di-vote menjadi `GOOD` / `BAD` / `SKIP`.

**Fakta terverifikasi di kode (per 2026-10-19):**

| Komponen | Path | Ukuran |
|---|---|---|
| LLM Consensus | `server/src/services/llm-consensus.service.ts` | 1.239 baris |
| Agent Consensus | `server/src/services/agent-consensus.service.ts` | 208 baris |
| Agent routes | `server/src/routes/agent-consensus.routes.ts` | 212 baris |
| Persona agents | `server/src/agents/specific.agents.ts` | Hawk / Dove / Contrarian |
| Memory (Prisma) | `server/prisma/schema.prisma` | model `UserProfile`, `UserMemoryNote` |
| Memory DB | `DATABASE_URL_AGENT` | `postgresql://***@localhost:5432/agent_db` |

**Masalah dengan LLM Consensus (status quo):**
1. **Stateless** — tiap keputusan berdiri sendiri; tidak belajar dari pengalaman.
2. **Tidak terpersonalisasi** — semua user diperlakukan sama.
3. **Tidak ada akuntabilitas per-spektrum** — tidak jelas "siapa" yang menilai apa.

**Aset yang sudah ada tapi belum tersambung:**
- Persona **Hawk** (risk/inflasi), **Dove** (likuiditas/peluang), **Contrarian** (skeptis/trap).
  `agent-consensus.service.ts` menjalankan mode sekuensial Hawk → Dove → Contrarian → sintesis,
  **tanpa** bobot dan **tanpa** akses memory.
- Skema memory PostgreSQL (`UserProfile`, `UserMemoryNote`) — **belum dipakai** di alur AI Trading.

---

## 2. Keputusan (LOCKED — dikonfirmasi Bang Vir)

### Keputusan 1 — Memory Injection: **Top-5 by confidence**
Memory yang disuntik ke konteks agent = **5 catatan dengan confidence tertinggi**.
Seimbang antara personalisasi dan biaya; deterministik; tidak butuh embedding.

### Keputusan 2 — Consensus Threshold: **≥60% weighted**
Sinyal disetujui bila skor terbobot ≥60%. Menggantikan simple majority.

### Keputusan 3 — Agent Count: **3 agent** — Hawk, Dove, Contrarian
Bobot voting: **Hawk = 1.5**, **Dove = 1.0**, **Contrarian = 1.0**.
Hawk lebih berat karena perannya menjaga modal (capital preservation).

### Keputusan 4 — pgvector: **Hybrid** (keyword sekarang, embedding menyusul)
pgvector belum tersedia di PostgreSQL 18.6 (temuan Forge). Retrieval memory memakai
keyword sekarang; embedding diaktifkan saat infrastruktur siap — tanpa mengubah kontrak API.

---

## 3. Opsi yang dipertimbangkan

### 3.1 Memory Injection
- **A — Semua relevan (embedding similarity):** paling personal, paling mahal, butuh pgvector.
- **B — Top-5 by confidence:** ✅ **DIPILIH** — seimbang, hemat token, deterministik.
- **C — Match symbol/regime:** paling tertarget, tapi recall rendah lintas-simbol.

### 3.2 Consensus Threshold
- **A — ≥70%:** ketat, sinyal sedikit (status quo).
- **B — ≥60%:** ✅ **DIPILIH** — seimbang.
- **C — ≥50%:** permisif, risiko noise.

### 3.3 Agent Count
- **A — 3 agent:** ✅ **DIPILIH** — teruji, murah, latensi rendah.
- **B — 4 agent (+Technical):** lebih lengkap, lebih mahal.
- **C — 3 + 1 dynamic (regime-based):** adaptif, kompleksitas tertinggi.

### 3.4 pgvector
- **A — Install pgvector:** embedding penuh; belum tersedia di PostgreSQL 18.6.
- **B — Keyword-only:** sederhana, tanpa dependency baru.
- **C — Hybrid:** ✅ **DIPILIH** — keyword sekarang, embedding menyusul.

---

## 4. Konsekuensi

**Positif:**
- Agent consensus menjadi *personalized* — keputusan memakai pengalaman user, bukan stateless.
- Bobot per-persona memberi akuntabilitas: jelas peran tiap agent dalam keputusan.
- Hybrid pgvector memungkinkan rilis tanpa menunggu infrastruktur embedding.

**Biaya & risiko:**
- **Latensi & biaya naik** — beberapa agent per sinyal. Perlu monitoring.
- **Memory salah → rekomendasi bias.** Perlu mekanisme koreksi/decay memory.
- **pgvector belum ada** → semantic retrieval ditunda; mitigasi keyword retrieval.

**Aturan yang TIDAK boleh dilanggar:**
- **Jangan hapus LLM Consensus** sebelum Agent Consensus terverifikasi (butuh fallback).
- **Jangan tandai fitur "aktif"** sebelum lolos QA + strict gate.

**Dampak dokumentasi (dikelola Sage):**
- `wiki/entities/agent-consensus-engine.md` — masih menggambarkan arsitektur lama
  (`updated: 2026-09-26`); diperbarui setelah Phase 1 backend stabil.
- `docs/payment-token-system-design.md` — mendeskripsikan token top-up yang dipensiunkan;
  perlu diperbarui setelah pivot monetisasi final.
- `docs/AI_PROVIDER_STRATEGY.md` — belum punya bagian Agent Consensus.

---

## 5. Rencana implementasi (ringkas)

| Phase | Isi | Owner |
|---|---|---|
| 1 — Foundation | 1.1 Memory Integration · 1.2 Weighted Voting · 1.4 Trade History Link · 1.3 Specialized Prompts | Axis · KIRA |
| 2 — Intelligence | 2.1 Memory Auto-Learn · 2.2 Consensus UI · 2.3 Trade History Dashboard · 2.4 Memory Insights UI | Axis · Nova |
| 3 — Scale | 3.1 Backtesting · 3.2 Performance Analytics · 3.3 Multi-User Memory · 3.4 E2E Tests | Axis · Nova · Vera |

---

## 6. Referensi
- `server/src/services/agent-consensus.service.ts`
- `server/src/services/llm-consensus.service.ts`
- `server/src/agents/specific.agents.ts`
- `server/prisma/schema.prisma` (`UserProfile`, `UserMemoryNote`)
- `wiki/entities/agent-consensus-engine.md`
