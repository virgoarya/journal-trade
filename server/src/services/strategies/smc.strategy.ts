// ─── Smart Money Concept (SMC) Strategy ─────────────────────────────
// Detects: Market Structure Shifts (MSS), Order Blocks, Breaker Blocks,
//          Liquidity Grabs, and Change of Character (CHOCH).

import { marketStructureService, type Candle, type MarketStructure, type OrderBlock } from "./market-structure.service";
import { atrService } from "./atr.service";

export interface SMCSignal {
  direction: "BUY" | "SELL";
  confidence: number; // 0–100
  entry: number;
  sl: number;
  tp: number;
  orderBlock?: OrderBlock;
  breachType: "MSS" | "LIQUIDITY_GRAB" | "BREAKER" | "OB_MITIGATION" | "CHOCH";
  reason: string;
}

export interface SMCAnalysis {
  signal: SMCSignal | null;
  signals: SMCSignal[]; // all detected signals, strongest first
}

const IMPULSE_LOOKBACK = 5;
const MIN_CONFIDENCE = 50;

class SMCStrategy {
  /**
   * Analyze market structure through the SMC lens.
   */
  analyze(candles: Candle[], marketStructure: MarketStructure): SMCSignal[] {
    const signals: SMCSignal[] = [];

    // 1. Market Structure Shift (MSS) / Change of Character (CHOCH)
    const mssSignal = this.detectMSS(candles, marketStructure);
    if (mssSignal) signals.push(mssSignal);

    // 2. Order Block mitigation
    const obSignal = this.detectOrderBlockEntry(candles, marketStructure);
    if (obSignal) signals.push(obSignal);

    // 3. Breaker Block
    const breakerSignal = this.detectBreakerEntry(candles, marketStructure);
    if (breakerSignal) signals.push(breakerSignal);

    // 4. Liquidity Grab
    const lgSignal = this.detectLiquidityGrab(candles, marketStructure);
    if (lgSignal) signals.push(lgSignal);

    // Sort by confidence descending
    return signals.sort((a, b) => b.confidence - a.confidence);
  }

  // ── Market Structure Shift ─────────────────────────────────────────

  /**
   * MSS = price breaks a recent swing point (BOS = Break of Structure)
   * with momentum. CHOCH = the first break after a trend.
   *
   * BUY MSS: price breaks above recent swing high with momentum
   * SELL MSS: price breaks below recent swing low with momentum
   */
  private detectMSS(candles: Candle[], ms: MarketStructure): SMCSignal | null {
    if (candles.length < 3) return null;

    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];

    // Look for a swing high that was just broken upward
    const recentHighs = ms.swingHighs.filter((s) => s.index >= candles.length - 10);
    for (const swing of recentHighs) {
      // Price broke above this swing high
      if (last.close > swing.price && last.high > swing.price) {
        // Check if it was a decisive break (body above the level)
        const bodyTop = Math.max(last.open, last.close);
        const bodyBottom = Math.min(last.open, last.close);

        if (bodyBottom > swing.price) {
          // Break of Structure to the upside
          const atr = atrService.calculate(candles);
          const avgRange = atr > 0 ? atr : this.avgCandleRange(candles, 5);

          return {
            direction: "BUY",
            entry: last.close,
            sl: last.close - avgRange * 1.5,
            tp: last.close + avgRange * 2.0,
            breachType: "MSS",
            confidence: this.scoreMSS(ms, swing, last, avgRange, "BUY"),
            reason: `MSS BUY: Price broke above swing high ${swing.price.toFixed(5)} with momentum`,
          };
        }
      }
    }

    // Look for a swing low broken downward
    const recentLows = ms.swingLows.filter((s) => s.index >= candles.length - 10);
    for (const swing of recentLows) {
      if (last.close < swing.price && last.low < swing.price) {
        const bodyTop = Math.max(last.open, last.close);
        const bodyBottom = Math.min(last.open, last.close);

        if (bodyTop < swing.price) {
          const atr = atrService.calculate(candles);
          const avgRange = atr > 0 ? atr : this.avgCandleRange(candles, 5);

          return {
            direction: "SELL",
            entry: last.close,
            sl: last.close + avgRange * 1.5,
            tp: last.close - avgRange * 2.0,
            breachType: "MSS",
            confidence: this.scoreMSS(ms, swing, last, avgRange, "SELL"),
            reason: `MSS SELL: Price broke below swing low ${swing.price.toFixed(5)} with momentum`,
          };
        }
      }
    }

    return null;
  }

  // ── Order Block Mitigation Entry ───────────────────────────────────

  /**
   * Price returning to an Order Block zone = potential entry.
   * The best OBs are those that preceded strong impulse moves.
   */
  private detectOrderBlockEntry(candles: Candle[], ms: MarketStructure): SMCSignal | null {
    if (candles.length < 2) return null;

    const last = candles[candles.length - 1];
    const atr = atrService.calculate(candles);
    const avgRange = atr > 0 ? atr : this.avgCandleRange(candles, 5);

    for (const ob of ms.orderBlocks) {
      // Skip if already mitigated
      if (ob.mitigated) continue;

      // Check if price is currently within the OB zone
      const inZone = last.low <= ob.top && last.high >= ob.bottom;
      if (!inZone) continue;

      // BULLISH OB: price dipped into the zone → BUY
      if (ob.type === "BULLISH") {
        return {
          direction: "BUY",
          entry: last.close,
          sl: ob.bottom - avgRange * 0.5,
          tp: last.close + avgRange * 2.0,
          orderBlock: ob,
          breachType: "OB_MITIGATION",
          confidence: this.scoreOB(ob, ms),
          reason: `OB Mitigation BUY: Price returned to bullish OB [${ob.bottom.toFixed(5)}-${ob.top.toFixed(5)}]`,
        };
      }

      // BEARISH OB: price rose into the zone → SELL
      if (ob.type === "BEARISH") {
        return {
          direction: "SELL",
          entry: last.close,
          sl: ob.top + avgRange * 0.5,
          tp: last.close - avgRange * 2.0,
          orderBlock: ob,
          breachType: "OB_MITIGATION",
          confidence: this.scoreOB(ob, ms),
          reason: `OB Mitigation SELL: Price returned to bearish OB [${ob.bottom.toFixed(5)}-${ob.top.toFixed(5)}]`,
        };
      }
    }

    return null;
  }

  // ── Breaker Block Entry ────────────────────────────────────────────

  private detectBreakerEntry(candles: Candle[], ms: MarketStructure): SMCSignal | null {
    if (candles.length < 2 || ms.breakerBlocks.length === 0) return null;

    const last = candles[candles.length - 1];
    const atr = atrService.calculate(candles);
    const avgRange = atr > 0 ? atr : this.avgCandleRange(candles, 5);

    for (const breaker of ms.breakerBlocks) {
      const flipped = breaker.flippedLevel;

      // BULL breaker: price broke above bearish OB → now support
      if (breaker.brokenDirection === "BULL") {
        if (Math.abs(last.close - flipped) / flipped < 0.003) {
          return {
            direction: "BUY",
            entry: last.close,
            sl: flipped - avgRange * 1.5,
            tp: last.close + avgRange * 2.0,
            breachType: "BREAKER",
            confidence: 65,
            reason: `Breaker BUY: Former OB flipped to support at ${flipped.toFixed(5)}`,
          };
        }
      }

      // BEAR breaker: price broke below bullish OB → now resistance
      if (breaker.brokenDirection === "BEAR") {
        if (Math.abs(last.close - flipped) / flipped < 0.003) {
          return {
            direction: "SELL",
            entry: last.close,
            sl: flipped + avgRange * 1.5,
            tp: last.close - avgRange * 2.0,
            breachType: "BREAKER",
            confidence: 65,
            reason: `Breaker SELL: Former OB flipped to resistance at ${flipped.toFixed(5)}`,
          };
        }
      }
    }

    return null;
  }

  // ── Liquidity Grab ─────────────────────────────────────────────────

  /**
   * A liquidity grab = false breakout. Price briefly exceeds a swing high
   * (or low) then closes back inside, trapping breakout traders.
   */
  private detectLiquidityGrab(candles: Candle[], ms: MarketStructure): SMCSignal | null {
    if (candles.length < 3) return null;

    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    const atr = atrService.calculate(candles);
    const avgRange = atr > 0 ? atr : this.avgCandleRange(candles, 5);

    // Check recent swing highs for fakey breakout above
    const recentHighs = ms.swingHighs.filter((s) => s.index >= candles.length - 8);
    for (const swing of recentHighs) {
      const grabbable = prev.high > swing.price && last.close < swing.price;
      if (grabbable) {
        return {
          direction: "SELL",
          entry: last.close,
          sl: prev.high + avgRange * 0.5,
          tp: last.close - avgRange * 2.0,
          breachType: "LIQUIDITY_GRAB",
          confidence: 70,
          reason: `Liquidity Grab SELL: False breakout above ${swing.price.toFixed(5)}, trapped buyers`,
        };
      }
    }

    // Recent swing lows for fakey breakout below
    const recentLows = ms.swingLows.filter((s) => s.index >= candles.length - 8);
    for (const swing of recentLows) {
      const grabbable = prev.low < swing.price && last.close > swing.price;
      if (grabbable) {
        return {
          direction: "BUY",
          entry: last.close,
          sl: prev.low - avgRange * 0.5,
          tp: last.close + avgRange * 2.0,
          breachType: "LIQUIDITY_GRAB",
          confidence: 70,
          reason: `Liquidity Grab BUY: False breakout below ${swing.price.toFixed(5)}, trapped sellers`,
        };
      }
    }

    return null;
  }

  // ── Scoring ────────────────────────────────────────────────────────

  private scoreMSS(ms: MarketStructure, swing: any, last: Candle, avgRange: number, dir: "BUY" | "SELL"): number {
    let score = 60;

    // Stronger swing = more significant break
    score += swing.strength * 5;

    // Momentum: how far price moved beyond the level
    const distance = dir === "BUY"
      ? Math.abs(last.close - swing.price)
      : Math.abs(swing.price - last.close);
    if (avgRange > 0) {
      const rangeRatio = distance / avgRange;
      if (rangeRatio >= 2) score += 10;
      else if (rangeRatio >= 1.5) score += 5;
    }

    // Trend alignment
    if (ms.trend.direction === (dir === "BUY" ? "BULL" : "BEAR")) {
      score += 10;
    }

    return Math.min(95, Math.max(MIN_CONFIDENCE, score));
  }

  private scoreOB(ob: OrderBlock, ms: MarketStructure): number {
    let score = 60;

    // Older OBs (found earlier) are often more significant
    // OB that formed at a swing point is stronger
    score += 5;

    // Trend alignment
    if (ob.type === "BULLISH" && ms.trend.direction === "BULL") score += 10;
    if (ob.type === "BEARISH" && ms.trend.direction === "BEAR") score += 10;

    return Math.min(90, Math.max(MIN_CONFIDENCE, score));
  }

  private avgCandleRange(candles: Candle[], period: number): number {
    const recent = candles.slice(-period);
    if (recent.length === 0) return 0;
    return recent.reduce((s, c) => s + (c.high - c.low), 0) / recent.length;
  }
}

export const smcStrategy = new SMCStrategy();
