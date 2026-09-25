---
title: Market Structure Concepts
created: 2026-09-21
updated: 2026-09-21
type: concept
tags: [pattern, signal, ict, smc, msnr, candle]
sources: [raw/articles/ict-strategy-source.md, raw/articles/smc-strategy-source.md, raw/articles/msnr-strategy-source.md]
confidence: high
---

# Market Structure Concepts

Kumpulan konsep struktur pasar yang digunakan oleh tiga strategi utama ([[ict-strategy]], [[smc-strategy]], [[msnr-strategy]]).

## Fair Value Gap (FVG)

Gap harga antara tiga candle berturut-turut: C1 high dan C3 low tidak overlap (bullish FVG) atau C1 low dan C3 high tidak overlap (bearish FVG). Sisa ketidakseimbangan supply/demand yang belum terisi.

    Bullish FVG: C3.low > C1.high  → zona support
    Bearish FVG: C3.high < C1.low  → zona resistance
    Inverted FVG (IFVG): FVG yang sudah dimitigasi lalu di-flip (support ↔ resistance)

## Order Block (OB)

Candle terakhir sebelum displacement besar (candle impulsif). Zona di mana institusi menempatkan order besar.

    Bullish OB: candle bearish terakhir sebelum impulse naik
    Bearish OB: candle bullish terakhir sebelum impulse turun
    hasSweep: OB dengan liquidity sweep → kualitas lebih tinggi
    hasCHOCH: OB yang menyebabkan CHoCH → kualitas tertinggi

## Market Structure Shift (MSS) / Break of Structure (BOS)

Harga menembus swing point terakhir dengan momentum (body close beyond, bukan hanya wick).

    BOS: break yang searah trend (konfirmasi kelanjutan)
    CHoCH: break pertama melawan trend (sinyal pembalikan)
    CISD: Change in State of Delivery (versi lebih luas dari CHoCH)

## AMD Pattern (3-Candle CRT)

    C1 = Accumulation: candle ranging/konsolidasi
    C2 = Manipulation: sweep swing struktural + close reversal kembali ke C1 body
    C3 = Distribution: breakout / follow-through searah

C2 harus sweep swing struktural (bukan random noise). Bullish AMD: C2 sweep di bawah C1 low + close bullish di atas C1 body.

## OTE (Optimal Trade Entry)

Fibonacci retracement 62-79% dari displacement (sweep wick → impulse high/low). Entry di 70.5% (sweet spot).

    ote618 = impulse_high - range × 0.618
    ote705 = impulse_high - range × 0.705  ← entry point
    ote79  = impulse_high - range × 0.79

## Liquidity Concepts

    BSL (Buy-Side Liquidity)   — Kumpulan stop loss di atas swing high
    SSL (Sell-Side Liquidity)  — Kumpulan stop loss di bawah swing low
    Turtle Soup                — Sweep liquidity + immediate reversal
    Judas Swing                — Sweep ke arah palsu lalu reversal ke arah asli
    Inducement                 — Level kecil yang "menggoda" retail sebelum sweep

## Malaysian SNR Levels

Level berbasis body close→open (bukan wick). Jauh lebih sering muncul dari QML.

    RBS: Resistance Broken as Support — level resistance yang di-break ke atas, kini support
    SBR: Support Broken as Resistance — level support yang di-break ke bawah, kini resistance

## Killzone (Waktu Optimal ICT)

    London Killzone:   07:00-10:00 GMT
    New York Killzone: 12:00-15:00 GMT
    Asian:             20:00-00:00 GMT (konsolidasi, bukan eksekusi ICT)

## SMR Composite (Smart Money Reversal)

4 pilar:
1. TS (Turtle Soup) — wajib
2. CISD — wajib
3. PDA Inverse (level flip) — boost +8 confidence
4. SMT Divergence — boost +7 confidence

## Detrades Models

    C2 Closure: C1 impulse kuat + C2 lanjutan menutup di luar C1 + gap = entry zone
    C2 DNT: C1 bulky masuk key level + C2 langsung reverse expansion (market order)
    DCM: HTF reversal → MTF expansion → retrace ke FVG → LTF CISD → entry

## Lihat Juga

- [[ict-strategy]] — Penggunaan FVG, OTE, AMD, Judas, IFVG, C2, DCM, SMR, SMT
- [[smc-strategy]] — Penggunaan OB, MSS, CHoCH, Breaker, Liquidity Grab
- [[msnr-strategy]] — Penggunaan Malaysian SNR, QML, RBS/SBR, Turtle Soup
