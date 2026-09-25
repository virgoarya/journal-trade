---
source_url: local://D:/Journal Trade/server/src/services/strategies/ict.strategy.ts
ingested: 2026-09-21
sha256: ict-strategy-initial
---

# ICT + CRT Merged Strategy — Source

Philosophy: CRT (3-Candle AMD / Range Context) sebagai FILTER untuk ICT (FVG, OTE, Judas Swing).
Hanya signal yang memiliki KEDUANYA (level struktural ICT + konteks candle CRT) yang lolos.

## Signal Types
- AMD_FVG: 3-Candle AMD + FVG confluence
- AMD_OTE: 3-Candle AMD + OTE confluence
- SWEEP_FVG: Liquidity Sweep + FVG fill
- JUDAS_SWEEP: Judas Swing + Sweep context
- OTE_AMD: OTE Fibonacci + AMD range context
- IFVG_RETEST: Retest of inverted FVG
- C2_CLOSURE: C2 Closure (Detrades continuation model)
- C2_DNT: C2 DNT (Detrades Reversal into Expansion)
- DCM_CONTINUATION: Detrades Continuation Model (MTF Imbalance Retrace)
- SMR_REVERSAL: SMR Composite (TS + CISD + PDA Inverse + SMT)
- SMT_DIVERGENCE: SMT Divergence confirmation

## Paths
- Path A: CRT 3-Candle AMD → ICT FVG/OTE inside zone
- Path B: Liquidity Sweep → ICT FVG confirmation
- Path C: Judas Swing → validated by prior Sweep Context
- Path D: OTE + AMD Range Context
- Path E: IFVG Retest
- Path F: C2 Closure & C2 DNT
- Path G: SMT Structural State
- Path H: DCM Continuation
- Path I: SMR Composite

## Filters
- HTF trend must not be SIDEWAYS
- R:R minimum 1:2 (rr >= 2.0)
- IPDA context adjusts confidence (+10% aligned, -30% misaligned)
- Invalidation: TP hit before entry is removed
