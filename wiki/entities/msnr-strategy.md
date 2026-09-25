---
title: Malaysian SNR (MSNR) + ICT Hybrid Strategy
created: 2026-09-21
updated: 2026-09-21
type: entity
tags: [strategy, msnr, signal, pattern, pipeline]
sources: [raw/articles/msnr-strategy-source.md]
confidence: high
---

# Malaysian SNR (MSNR) + ICT Hybrid Strategy

Custom edge: Malaysian Support/Resistance (body-based) dikombinasikan dengan Turtle Soup (liquidity sweep) dan MSS + OB entry.

## Flow Utama

    1. Identifikasi HTF SNR (level berbasis body close→open, bukan wick)
    2. Tap level + sweep likuiditas (Turtle Soup, wick rejection)
    3. LTF MSS reversal dari SNR (displacement body >= minBodyAtr × ATR)
    4. Temukan LTF OB terbentuk sebelum/selama MSS
    5. Entry PENDING_LIMIT di 50% OB body (mean threshold)

## Signal Types

    TURTLE_SOUP_OB    Turtle Soup + OB entry
    TURTLE_SOUP_CISD  Turtle Soup + CISD confirmation
    QML_BULLISH       Quasimodo Level bullish
    QML_BEARISH       Quasimodo Level bearish
    RBS               Resistance Broken as Support
    SBR               Support Broken as Resistance

## Malaysian SNR Levels

Level dibentuk dari transisi body close→open (bukan wick/swing):

    RBS   Resistance di-break ke ATAS (close di atas) → jadi support
    SBR   Support di-break ke BAWAH (close di bawah) → jadi resistance

Tap check buffer: htfAtr × 0.15. Level isFresh = baru, belum dipakai.
Storyline aktif sepanjang hari (lookback 12 HTF candles terakhir).

## QML (Quasimodo Level)

4-titik pola: DR_High (puncak) → BOS_High (break sebelumnya) → DR_Low (koreksi membuat low baru) → Inducement (pullback terakhir).

QML valid jika Head (DR_Low) membuat new low di bawah Left Shoulder.

## Aturan Entry

- OB terpilih: FIRST PRESENTED (closest to price), bukan yang paling discounted
- Entry gap max 6 × ltfAtr
- SL swing-protected dengan minimum 0.5 × ltfAtr buffer
- R:R minimum 1:2.5 (lebih ketat dari ICT/SMC yang 1:2)
- Setup invalidated jika harga sudah menembus SL OB

## IPDA Filter

- Misaligned → confidence × 0.6 (lebih strict dari SMC/ICT yang ×0.7)
- Aligned → min(95, ×1.1)

## Lihat Juga

- [[ict-strategy]] — ICT yang digunakan bersamaan
- [[smc-strategy]] — SMC yang digunakan bersamaan
- [[market-structure-concepts]] — OB, MSS, SNR, Turtle Soup
- [[hunter-trades-journal]] — Aplikasi yang menggunakan strategi ini
