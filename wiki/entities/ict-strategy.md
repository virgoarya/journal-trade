---
title: ICT + CRT Merged Strategy
created: 2026-09-21
updated: 2026-09-21
type: entity
tags: [strategy, ict, signal, pattern, pipeline]
sources: [raw/articles/ict-strategy-source.md]
confidence: high
---

# ICT + CRT Merged Strategy

Strategi trading yang menggabungkan Inner Circle Trader (ICT) dengan CRT (3-Candle AMD). CRT bertindak sebagai FILTER — hanya setup yang memiliki kedua konfluens yang lolos.

## Filosofi

ICT murni menghasilkan terlalu banyak trade (1852 trade, WR 49.5%). CRT murni terlalu banyak noise (952 trade, WR 47.1%). Gabungan keduanya menargetkan 400-700 trade dengan WR 55-65%.

## Signal Types

    AMD_FVG          3-Candle AMD + FVG confluence
    AMD_OTE          3-Candle AMD + OTE confluence
    SWEEP_FVG        Liquidity Sweep + FVG fill
    JUDAS_SWEEP      Judas Swing + Sweep context
    OTE_AMD          OTE Fibonacci + AMD range context
    IFVG_RETEST      Retest of Inverted FVG
    C2_CLOSURE       Detrades Continuation Model
    C2_DNT           Detrades Reversal into Expansion
    DCM_CONTINUATION MTF Imbalance Retrace
    SMR_REVERSAL     TS + CISD + PDA Inverse + SMT
    SMT_DIVERGENCE   Cross-pair divergence

## 9 Paths Deteksi

Path A — CRT 3-Candle AMD: C1 (Accumulation) → C2 (Manipulation/sweep) → C3 (Distribution). C2 harus sweep swing struktural dan close reversal.

Path B — Liquidity Sweep → FVG: Sweep pierces structural swing low/high, close back inside range, FVG terbentuk di atas/bawah sweep level.

Path C — Judas Swing: Sweep swing lalu reversal. Confidence 82 jika sweep juga menembus range context, 72 jika tidak.

Path D — OTE + AMD: Fibonacci 62-79% dalam konteks konsolidasi (range < 1.5 × ATR). Entry di 70.5% (sweet spot). Harus di dalam HTF POI (OB atau FVG).

Path E — IFVG Retest: FVG yang sudah di-invert (support ↔ resistance flip), pending limit di level inversi.

Path F — C2 Closure: C1 impulse kuat (body > 50% range) + C2 continuation menutup di atas C1 high + gap antara C1 high dan C2 low = entry zone.

Path G — SMT Divergence: Structural state dikumpulkan per symbol, perbandingan lintas pair dilakukan di ai-trading-engine.

Path H — DCM Continuation: HTF reversal → MTF expansion → retrace ke FVG imbalance → LTF CISD confirmation.

Path I — SMR Composite: 4 pilar — TS (Turtle Soup) + CISD + PDA Inverse + SMT. TS + CISD wajib, PDA + SMT boost confidence.

## Filter & Validasi

- HTF trend SIDEWAYS → tidak ada signal
- R:R minimum 1:2 (tpDist / slDist >= 2.0)
- IPDA aligned → confidence +10%, misaligned → -30%
- TP sudah tercapai sebelum entry → signal di-drop (invalidation)
- Checklist waterfall: gagal di step wajib → signal di-drop

## IPDA Adjustment

- Daily bias BULLISH + signal BUY → confidence × 1.1 (max 95)
- Daily bias BEARISH + signal SELL → confidence × 1.1 (max 95)
- Misaligned → confidence × 0.7
- Intraday RETRACEMENT + FVG signal toward bias → +10 confidence

## Lihat Juga

- [[smc-strategy]] — Pendekatan SMC yang digunakan bersamaan
- [[msnr-strategy]] — Hybrid Malaysian SNR
- [[market-structure-concepts]] — FVG, OB, Swing, AMD, IPDA
- [[hunter-trades-journal]] — Aplikasi yang menggunakan strategi ini
