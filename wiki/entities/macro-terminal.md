---
title: Macro Terminal
created: 2026-09-26
updated: 2026-09-26
type: entity
tags: [architecture, module, macro, data, ai]
sources: [raw/articles/project-overview.md]
confidence: high
---

# Macro Terminal & Intelligence Hub

Macro Terminal adalah pusat analisis makroekonomi dan sentimen likuiditas global real-time di Hunter Trades Journal, menyediakan quant lab, COT divergence scanner, dan deteksi rezim makro.

## Gambaran Umum

Macro Terminal mengagregasi data fundamental makroekonomi dan likuiditas global untuk menentukan rezim pasar (Stagflation, Reflation, Goldilocks, Deflation) dan menyelaraskan arah trading [[hunter-trades-journal]].

## Fitur & Panel Utama

1. **Macro Regime Panel**:
   - Deteksi otomatis 4 rezim makro melalui indikator pertumbuhan dan inflasi.
   - 2x2 Matrix visualizer dengan glowing indicator.
2. **Liquidity Gauge Panel (ON RRP & TGA)**:
   - Memantau saldo Reverse Repo (ON RRP) dan Treasury General Account (TGA) untuk melihat ekspansi/penarikan likuiditas The Fed.
   - Simetris skeleton loading & safe state preservation.
3. **Yield Curve & Real Yield Panel**:
   - Pelacakan inversi yield 2Y/10Y/30Y Treasury.
   - Real yield calculation (Treasury TIPS spread).
4. **COT Divergence Scanner**:
   - Commitment of Traders (COT) laporan institusional untuk mendeteksi posisi net long/short Commercial vs Non-Commercial.
5. **Geopolitical Risk Radar**:
   - Pemantauan zona konflik global dan penghitungan skor geo-risk per wilayah ([[geo-risk.routes.ts]]).
6. **Quant Lab & Nexus**:
   - Inter-market correlation matrix & multi-model AI macro prediction.

## Backend Services Terkait

- `macro-ai.service.ts` — Analisis AI batch news & prediksi makro
- `macro-regime.service.ts` — Klasifikasi rezim pasar
- `macro-data.service.ts` — Pengambilan data indikator makroekonomi
- `geo-risk.service.ts` — Snapshot risiko geopolitik

## Lihat Juga

- [[hunter-trades-journal]] — Platform utama Hunter Trades
- [[mt5-integration]] — Eksekusi order berdasarkan makrokonfluensi
- [[journal-insight-service]] — Analisis performa berdasarkan kondisi makro
