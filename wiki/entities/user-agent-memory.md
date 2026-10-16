---
title: User Agent Memory & Vector Store
created: 2026-09-26
updated: 2026-09-26
type: entity
tags: [architecture, memory, ai, mongodb, node]
sources: [raw/articles/project-overview.md]
confidence: high
---

# User Agent Memory & Vector Search System

Sistem memori persisten dan pencarian vektor kontekstual yang memungkinkan AI Coach dan Review Engine mengingat profil psikologis trader, histori transaksi, dan preferensi individual secara lintas-sesi.

## Gambaran Umum

User Agent Memory dan Vector Store menyimpan jejak interaksi dan data historis trader di [[hunter-trades-journal]]. Sistem ini menyediakan konteks personalisasi tanpa harus meminta ulang preferensi atau memuat ulang histori lengkap setiap kali request dibuat.

## Komponen & Model Data

1. **`UserAgentMemory` Model**:
   - Menyimpan profil persona trader, gaya trading (SMC/ICT/MSNR), profil risiko, serta preferensi komunikasi.
2. **`VectorMemory` Model**:
   - Menyimpan teks embedding jurnal trade, catatan emosional, dan evaluasi pasca-trade untuk pencarian keserupaan semantik (semantic similarity search).
3. **`ReflectionLog` Model**:
   - Log refleksi mandiri agen AI setelah menganalisis pasar atau kesalahan trading user.
4. **`ChatSession` Model**:
   - Riwayat sesi percakapan interaktif antara trader dan AI Trade Coach.

## Layanan Utama (Services)

- `user-memory.service.ts` — Pengelolaan memori profil & entri preferensi user
- `vector-memory.service.ts` — Pencarian vektor dan indexing embedding semantik
- `self-improvement.service.ts` — Pembelajaran mandiri agen dan pembaruan log LESSONS.md

## Lihat Juga

- [[hunter-trades-journal]] — Platform utama
- [[journal-insight-service]] — Insight AI yang diperkaya oleh memori vektor
- [[agent-consensus-engine]] — Konsensus agen yang dipersonalisasi
