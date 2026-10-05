---
name: smc-ict-analysis
description: Kerangka analisis teknikal SMC/ICT — struktur pasar, liquidity sweep, order block, MSS/BOS
triggers: smc, ict, smart money, order block, liquidity sweep, mss, bos, market structure, fair value gap, fvg, premium discount, equal high, equal low, bsl, ssl, analisa teknikal, setup, entry, chart
priority: 10
---

# SKILL: Analisis SMC / ICT

> Pakai skill ini HANYA kalau user meminta analisis teknikal / setup / struktur pasar.
> Jangan pakai untuk pertanyaan data faktual (mis. "berapa saldo ON RRP?").

## KERANGKA WAJIB

### 1. Struktur Pasar (Market Structure)
- **BOS (Break of Structure)** — kelanjutan tren, harga menembus swing sebelumnya searah tren.
- **MSS (Market Structure Shift)** — pembalikan, harga menembus swing berlawanan arah tren.
- **Higher High / Higher Low** = uptrend. **Lower High / Lower Low** = downtrend.
- **Ranging** = tidak ada BOS/MSS valid → tidak ada bias directional.

### 2. Likuiditas
- **BSL (Buy-Side Liquidity)** — stop loss seller + buy stop, di atas equal highs.
- **SSL (Sell-Side Liquidity)** — stop loss buyer + sell stop, di bawah equal lows.
- **Liquidity Sweep** — harga menyapu level likuiditas lalu berbalik. Ini trigger entry,
  bukan alasan entry itu sendiri.

### 3. Zona Entry
- **Order Block (OB)** — candle terakhir berlawanan arah sebelum impulsif.
- **Fair Value Gap (FVG)** — imbalance 3 candle, harga cenderung kembali mengisi.
- **Premium / Discount** — beli di discount (< 50% range), jual di premium (> 50% range).

## ATURAN EKSEKUSI

1. **Bias dari HTF** (Daily/Weekly), **trigger dari LTF** (M15/H1).
2. Wajib ada konfirmasi: sweep → MSS → entry di OB/FVG.
3. Kuantifikasi SELALU: entry, stop loss, take profit, R:R, risiko %.
4. **Tolak setup kalau R:R < 1:2.** Katakan terus terang alasannya.
5. Kalau tidak ada setup valid → katakan "tidak ada setup", jangan memaksakan.

## FORMAT OUTPUT

```
BIAS (H4/D1): <bullish/bearish/ranging>
STRUKTUR: <BOS/MSS terakhir, levelnya>
LIKUIDITAS: <BSL/SSL yang belum diambil>
SETUP: <sweep → MSS → entry di OB/FVG>
- Entry: <level>
- SL: <level> (<X> pips / <X>%)
- TP: <level>
- R:R: 1:<X>
- Risiko: <X>% modal
INVALIDASI: <kondisi yang membatalkan setup>
```

## JANGAN

- Jangan pakai kerangka ini untuk pertanyaan data makro/faktual.
- Jangan sebut aset yang tidak ditanya user.
- Jangan memberi setup kalau data harga tidak tersedia — katakan datanya kurang.
