---
title: Smart Money Concept (SMC) Strategy
created: 2026-09-21
updated: 2026-09-21
type: entity
tags: [strategy, smc, signal, pattern, pipeline]
sources: [raw/articles/smc-strategy-source.md]
confidence: high
---

# Smart Money Concept (SMC) Strategy

Strategi yang mendeteksi pergerakan "smart money" melalui struktur pasar: MSS, Order Block, Breaker Block, Liquidity Grab, dan CHoCH.

## Signal Types (breachType)

    MSS              Market Structure Shift / Break of Structure
    CHOCH            Change of Character (break pertama setelah trend)
    OB_MITIGATION    Entry di Order Block yang dimitigasi
    BREAKER          Breaker Block (OB yang di-flip)
    LIQUIDITY_GRAB   False breakout trap
    M5_CHOCH_OB      Refinement entry M5 (H1 POI → M5 CHoCH + M5 OB)

## Urutan Deteksi (Prioritas)

1. M5 Confirmation Entry (refinement tertinggi, confidence 90)
2. MSS / CHoCH
3. Order Block Mitigation
4. Breaker Block
5. Liquidity Grab

## M5 Refinement Entry

Flow: H1 OB tap → M5 CHoCH → M5 OB (hasSweep = true wajib) → Pending Limit @ M5 OB top/bottom → Target PDH/PDL.

Syarat: price retest H1 OB (lowestM5 dalam 20 candle), M5 OB harus punya hasSweep, confidence 90.

## Aturan Kunci

- hasHTFContext wajib: sweep SSL/BSL ATAU OB mitigation di HTF
- SL swing-protected: swing low/high terdekat di luar OB + buffer ATR
- R:R minimum 1:2
- IPDA: misaligned → ×0.7, aligned → min(95, ×1.1)
- CHoCH pada REVERSAL state → +10 confidence

## Scoring OB

    hasCHOCH        +15
    hasSweep        +15
    displacementFVG +10
    trend aligned   +10
    Base score      60

## Scoring MSS

    swing.strength × 5
    distance/ATR >= 2  → +10
    distance/ATR >= 1.5 → +5
    trend aligned      +10
    Base score         60

## Lihat Juga

- [[ict-strategy]] — ICT + CRT yang digunakan bersamaan
- [[msnr-strategy]] — Malaysian SNR Hybrid
- [[market-structure-concepts]] — OB, MSS, CHoCH, Breaker Block
- [[hunter-trades-journal]] — Aplikasi yang menggunakan strategi ini
