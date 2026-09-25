---
source_url: local://D:/Journal Trade/server/src/services/strategies/msnr.strategy.ts
ingested: 2026-09-21
sha256: msnr-strategy-initial
---

# Malaysian SNR (MSNR) + ICT Hybrid Strategy — Source

Custom Edge: SNR Level → Liquidity Inducement Grab (Turtle Soup) → MSS → Entry on OB

## Flow
1. Identify HTF SNR (Malaysian body-based levels)
2. HTF price tap SNR AND swept liquidity pool (Swing High/Low) with wick rejection
3. HTF Turtle Soup valid → scan LTF for MSS reversing away from SNR
4. After MSS → find valid LTF Order Block (OB)
5. Place PENDING_LIMIT entry at OB (50% of OB body = mean threshold)

## Signal Types
- TURTLE_SOUP_OB: Turtle Soup + OB entry
- TURTLE_SOUP_CISD: Turtle Soup + CISD confirmation
- QML_BULLISH / QML_BEARISH: Quasimodo Level
- RBS: Resistance Broken as Support
- SBR: Support Broken as Resistance

## Malaysian SNR Levels
- Body-based (not wick/swing) — transisi close→open
- RBS: Resistance di-break ke ATAS (candle close di atas) → jadi support
- SBR: Support di-break ke BAWAH (candle close di bawah) → jadi resistance
- isFresh: level baru, belum dipakai
- Tap check buffer: htfAtr × 0.15

## Key Rules
- Storyline stays live through the day (lookback 12 HTF candles)
- LTF MSS body >= structureBreakMinBodyAtr × ltfAtr (displacement required)
- OB: first presented OB (closest to price), max 60 candles from MSS
- Entry gap max 6 × ltfAtr (otherwise skip)
- R:R minimum 1:2.5
- IPDA: misaligned → confidence × 0.6, aligned → min(95, × 1.1)
