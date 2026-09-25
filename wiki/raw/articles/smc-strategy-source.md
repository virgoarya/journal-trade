---
source_url: local://D:/Journal Trade/server/src/services/strategies/smc.strategy.ts
ingested: 2026-09-21
sha256: smc-strategy-initial
---

# Smart Money Concept (SMC) Strategy — Source

Detects: Market Structure Shifts (MSS), Order Blocks, Breaker Blocks, Liquidity Grabs, CHoCH.

## Signal Types (breachType)
- MSS: Market Structure Shift / Break of Structure
- CHOCH: Change of Character (first break after trend)
- OB_MITIGATION: Order Block mitigation entry
- BREAKER: Breaker Block (flipped OB)
- LIQUIDITY_GRAB: False breakout trap
- M5_CHOCH_OB: M5 refinement entry (H1 POI → M5 CHoCH + M5 OB)

## Detection Order (priority)
1. M5 Confirmation Entry (highest priority — refinement)
2. MSS / CHoCH
3. Order Block Mitigation
4. Breaker Block
5. Liquidity Grab

## Key Rules
- HTF context required (hasHTFContext): liquidity sweep or OB mitigation on HTF
- R:R minimum 1:2
- SL swing-protected: nearest swing low/high beyond OB
- IPDA: daily bias misaligned → confidence -30%, aligned → +10%
- M5 OB must have hasSweep = true

## Scoring
- scoreOB: hasCHOCH +15, hasSweep +15, displacementFVG +10, trend aligned +10
- scoreMSS: swing.strength × 5, distance ratio bonus, trend aligned +10
