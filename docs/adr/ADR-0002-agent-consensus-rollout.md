# ADR-0002 — Strategi Rollout: Full Replace LLM Consensus → Agent Consensus

- **Status:** ✅ **Accepted** — 2026-10-19
- **Owner keputusan:** Bang Vir (Vir.Trades)
- **Penulis:** Sage (Docs/DX)
- **Menggantikan sebagian:** klausul rollout di [ADR-0001](ADR-0001-agent-consensus-engine.md)
  (ADR-0001 menetapkan *shadow mode*; ADR ini menetapkan *full replace*)

---

## 1. Konteks

[ADR-0001](ADR-0001-agent-consensus-engine.md) menetapkan migrasi AI Trading dari LLM
Consensus (voting 6 model) ke Agent Consensus (Hawk/Dove/Contrarian + memory), dan
mencatat asumsi rollout: *"LLM Consensus tidak dihapus dulu — berjalan paralel (shadow
mode) sampai Agent Consensus terverifikasi."*

Bang Vir mengklarifikasi arah yang diinginkan: **replace penuh**, bukan shadow mode.

> *"rencana aku ingin replace yg sebelumnya menggunakan LLM biasa untuk consensus 6 model,
> aku ingin modifikasi menjadi AGENT yang mana AGENT lebih pintar daripada sekedar LLM yg
> disuntikkan json prompt tanpa ingatan."* — Bang Vir

**Temuan dari inspeksi KIRA (fakta, bukan asumsi):**
- `llmConsensusService` **belum terintegrasi** ke `TradingPipelineService` — masih standalone.
- Agent Consensus Engine juga **belum terintegrasi** ke pipeline.
- SMC/ICT/MSNR **sudah** terintegrasi lewat `AITradingEngine` + Confluence Engine.

Artinya: titik integrasi belum ada untuk keduanya, jadi "replace" = memasang Agent
Consensus sebagai jalur aktif, bukan mencabut sesuatu yang sudah jalan.

---

## 2. Keputusan (LOCKED — dikonfirmasi Bang Vir)

**Agent Consensus Engine menggantikan LLM Consensus (6 model) sebagai jalur konsensus aktif
di AI Trading.**

- Pipeline memanggil **Agent Consensus** (`runParallelDebate`), bukan `llmConsensusService.evaluate()`.
- Agent menganalisis sinyal hasil confluence **SMC / ICT / MSNR**.
- Output: verdict `GOOD`/`BAD`/`SKIP` + **reasoning** + **confidence** (bukan sekadar vote).
- Memory dipakai: agent belajar dari trade history user.

**Batasan implementasi yang WAJIB dipatuhi:**
1. **Ganti jalur panggil, jangan hapus file.** `llm-consensus.service.ts` tetap ada di
   codebase (tidak dipanggil) sampai Agent Consensus lolos QA + perbandingan hasil.
   Penghapusan fisik = keputusan terpisah, setelah terbukti.
2. **Rollback path harus ada.** Selama masa transisi, harus mungkin mengembalikan jalur
   LLM Consensus tanpa menulis kode baru (mis. flag/config), supaya insiden bisa dipulihkan.
3. **Jangan tandai "aktif" sebelum lolos QA + strict gate.**

---

## 3. Opsi yang dipertimbangkan

- **A — Full Replace langsung:** pipeline langsung pakai Agent Consensus; LLM Consensus tidak dipanggil lagi.
  → ✅ **DIPILIH** (keputusan Bang Vir). Paling cepat sampai tujuan; sesuai visi "agent lebih pintar".
- **B — Shadow mode dulu:** keduanya jalan paralel, bandingkan hasil, baru replace.
  → ❌ Ditolak (asumsi awal ADR-0001). Lebih aman, tapi menunda nilai dan menambah biaya ganda.
- **C — Hybrid berbasis ambang:** Agent Consensus untuk sinyal kuat, LLM Consensus untuk sisanya.
  → ❌ Ditolak. Dua sistem hidup = dua sumber kebenaran; menyulitkan audit & pemeliharaan.

---

## 4. Konsekuensi

**Positif:**
- Satu jalur konsensus yang jelas — lebih mudah diaudit dan dipelajari.
- Agent memberi reasoning + confidence, bukan hanya vote biner.
- Memory membuat keputusan terpersonalisasi per user.

**Risiko & mitigasi:**
- **Kehilangan fallback** bila Agent Consensus bermasalah → *mitigasi:* jangan hapus file LLM
  Consensus; sediakan jalur rollback (batasan #1 & #2 di atas).
- **Kualitas keputusan belum terbukti** → *mitigasi:* QA (Vera) + perbandingan historis sebelum
  dinyatakan aktif; backtesting di Phase 3.
- **Perubahan perilaku pipeline** → *mitigasi:* TDD (RED→GREEN) per task; commit per task dengan bukti.

---

## 5. Task implementasi terkait

| Task | Owner | Isi |
|---|---|---|
| 1.5 | Axis | Integrasi Agent Consensus Engine ke `TradingPipelineService` |
| 1.6 | Axis | Ganti panggilan LLM Consensus → Agent Consensus (ganti jalur, **bukan** hapus file) |
| 1.7 | Nova | UI: agent breakdown (Hawk/Dove/Contrarian) + consensus score + reasoning |
| 1.1–1.4 | Axis | Memory Integration · Weighted Voting · Trade History Link (TDD) |
| 1.3 | KIRA | Specialized prompts per persona |

---

## 6. Referensi
- [ADR-0001](ADR-0001-agent-consensus-engine.md) — keputusan arsitektur (memory, threshold, agent count, pgvector)
- `server/src/services/trading-pipeline.service.ts` — titik integrasi
- `server/src/services/llm-consensus.service.ts` — jalur lama (dipertahankan sementara)
- `server/src/services/agent-consensus.service.ts` — jalur baru
