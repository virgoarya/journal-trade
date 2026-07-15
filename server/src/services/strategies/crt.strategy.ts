// ─── Candle Range Theory (CRT) Strategy ─────────────────────────────
// Detects: Range breakouts, liquidity sweeps, displacement candles,
//          Market Structure Breaks (MSB), candle body/wick analysis.

import { type Candle, type MarketStructure, type CandleRangeAnalysis } from "./market-structure.service";
import { atrService } from "./atr.service";

export interface CRTSignal {
  direction: "BUY" | "SELL";
  confidence: number;
  entry: number;
  sl: number;
  tp: number;
  range: { high: number; low: number; width: number };
  signalType: "RANGE_BREAKOUT" | "LIQUIDITY_SWEEP" | "DISPLACEMENT" | "MSB" | "3_CANDLE_PATTERN";
  displacementCandle?: Candle;
  reason: string;
}

export interface CRTAnalysis {
  signal: CRTSignal | null;
  signals: CRTSignal[];
}

// Candles to look back for range calculation
const RANGE_LOOKBACK = 20;
const BREAKOUT_THRESHOLD = 0.6; // % of range to confirm breakout
const DISPLACEMENT_MULTIPLIER = 2.0; // × avg range for displacement

class CRTStrategy {
  /**
   * Full CRT analysis.
   */
  analyze(fractal: import("./market-structure.service").FractalContext): CRTSignal[] {
    const signals: CRTSignal[] = [];

    if (!fractal.isAligned) return signals;

    const candles = fractal.entry;
    const marketStructure = fractal.entryStr;

    if (candles.length < RANGE_LOOKBACK) return signals;

    const ranges = marketStructure.candleRanges;

    // 0. CRT 3-Candle Pattern (Specific Setup)
    const threeCandleSignal = this.detect3CandlePattern(fractal);
    if (threeCandleSignal) signals.push(threeCandleSignal);

    // 1. Range Breakout
    const breakoutSignal = this.detectRangeBreakout(candles, ranges, marketStructure);
    if (breakoutSignal) signals.push(breakoutSignal);

    // 2. Liquidity Sweep
    const sweepSignal = this.detectLiquiditySweep(candles, ranges, marketStructure);
    if (sweepSignal) signals.push(sweepSignal);

    // 3. Displacement
    const displacementSignal = this.detectDisplacement(candles, ranges, marketStructure);
    if (displacementSignal) signals.push(displacementSignal);

    // 4. Market Structure Break (MSB)
    const msbSignal = this.detectMSB(candles, ranges, marketStructure);
    if (msbSignal) signals.push(msbSignal);

    return signals.sort((a, b) => b.confidence - a.confidence);
  }

  // ── Range Breakout ─────────────────────────────────────────────────

  /**
   * Price closes outside the established range of the last N candles.
   * The more convincing the close (body entirely out), the stronger.
   */
  private detectRangeBreakout(
    candles: Candle[],
    ranges: CandleRangeAnalysis,
    ms: MarketStructure,
  ): CRTSignal | null {
    if (candles.length < 2) return null;

    const last = candles[candles.length - 1];

    // Calculate range from the last 20 candles (excluding the last one)
    const recent = candles.slice(-RANGE_LOOKBACK - 1, -1);
    const rangeHigh = Math.max(...recent.map((c) => c.high));
    const rangeLow = Math.min(...recent.map((c) => c.low));
    const rangeWidth = rangeHigh - rangeLow;

    if (rangeWidth === 0) return null;

    const atr = atrService.calculate(candles);
    const avgRange = atr > 0 ? atr : this.avgRange(candles, 5);
    const bodyTop = Math.max(last.open, last.close);
    const bodyBottom = Math.min(last.open, last.close);
    const body = bodyTop - bodyBottom;

    // Bullish breakout: body entirely above range
    if (bodyBottom > rangeHigh && body > rangeWidth * BREAKOUT_THRESHOLD) {
      return {
        direction: "BUY",
        entry: last.close,
        sl: rangeHigh - avgRange * 0.3,
        tp: last.close + avgRange * 2.0,
        range: { high: rangeHigh, low: rangeLow, width: rangeWidth },
        signalType: "RANGE_BREAKOUT",
        confidence: 65,
        reason: `CRT Breakout BUY: Price broke above ${RANGE_LOOKBACK}c range high ${rangeHigh.toFixed(5)}`,
      };
    }

    // Bearish breakout: body entirely below range
    if (bodyTop < rangeLow && body > rangeWidth * BREAKOUT_THRESHOLD) {
      return {
        direction: "SELL",
        entry: last.close,
        sl: rangeLow + avgRange * 0.3,
        tp: last.close - avgRange * 2.0,
        range: { high: rangeHigh, low: rangeLow, width: rangeWidth },
        signalType: "RANGE_BREAKOUT",
        confidence: 65,
        reason: `CRT Breakout SELL: Price broke below ${RANGE_LOOKBACK}c range low ${rangeLow.toFixed(5)}`,
      };
    }

    return null;
  }

  // ── Liquidity Sweep ────────────────────────────────────────────────

  /**
   * Price wicks beyond the established range but closes back inside.
   * This sweeps stop losses without real conviction = reversal signal.
   */
  private detectLiquiditySweep(
    candles: Candle[],
    ranges: CandleRangeAnalysis,
    ms: MarketStructure,
  ): CRTSignal | null {
    if (candles.length < 2) return null;

    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    const recent = candles.slice(-RANGE_LOOKBACK - 1, -1);
    const rangeHigh = Math.max(...recent.map((c) => c.high));
    const rangeLow = Math.min(...recent.map((c) => c.low));
    const rangeWidth = rangeHigh - rangeLow;

    if (rangeWidth === 0) return null;

    const atr = atrService.calculate(candles);
    const avgRange = atr > 0 ? atr : this.avgRange(candles, 5);

    // Bullish sweep: previous candle broke below range, now closed back in
    if (prev.low < rangeLow && last.close > rangeLow) {
      return {
        direction: "BUY",
        entry: last.close,
        sl: rangeLow - avgRange * 0.5,
        tp: last.close + avgRange * 2.0,
        range: { high: rangeHigh, low: rangeLow, width: rangeWidth },
        signalType: "LIQUIDITY_SWEEP",
        confidence: 72,
        reason: `CRT Sweep BUY: Wick below range ${rangeLow.toFixed(5)} swept stops, now reversing`,
      };
    }

    // Bearish sweep: previous candle broke above range, now closed back in
    if (prev.high > rangeHigh && last.close < rangeHigh) {
      return {
        direction: "SELL",
        entry: last.close,
        sl: rangeHigh + avgRange * 0.5,
        tp: last.close - avgRange * 2.0,
        range: { high: rangeHigh, low: rangeLow, width: rangeWidth },
        signalType: "LIQUIDITY_SWEEP",
        confidence: 72,
        reason: `CRT Sweep SELL: Wick above range ${rangeHigh.toFixed(5)} swept stops, now reversing`,
      };
    }

    return null;
  }

  // ── Displacement ───────────────────────────────────────────────────

  /**
   * A single candle with range ≥ 2× the average of the preceding candles.
   * Displacement shows strong institutional interest.
   */
  private detectDisplacement(
    candles: Candle[],
    ranges: CandleRangeAnalysis,
    ms: MarketStructure,
  ): CRTSignal | null {
    if (candles.length < 6) return null;

    if (!ranges.recentDisplacement) return null;

    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    const atr = atrService.calculate(candles);
    const avgRange = atr > 0 ? atr : this.avgRange(candles, 5);

    const isBullish = last.close > last.open && last.close > prev.high;
    const isBearish = last.close < last.open && last.close < prev.low;

    if (isBullish) {
      return {
        direction: "BUY",
        entry: last.close,
        sl: last.low - avgRange * 0.3,
        tp: last.close + avgRange * 2.0,
        range: { high: last.high, low: last.low, width: last.high - last.low },
        signalType: "DISPLACEMENT",
        displacementCandle: last,
        confidence: 70,
        reason: `CRT Displacement BUY: Last candle range ${(last.high - last.low).toFixed(5)} (${((last.high - last.low) / avgRange).toFixed(1)}× avg)`,
      };
    }

    if (isBearish) {
      return {
        direction: "SELL",
        entry: last.close,
        sl: last.high + avgRange * 0.3,
        tp: last.close - avgRange * 2.0,
        range: { high: last.high, low: last.low, width: last.high - last.low },
        signalType: "DISPLACEMENT",
        displacementCandle: last,
        confidence: 70,
        reason: `CRT Displacement SELL: Last candle range ${(last.high - last.low).toFixed(5)} (${((last.high - last.low) / avgRange).toFixed(1)}× avg)`,
      };
    }

    return null;
  }

  // ── Market Structure Break (MSB) ───────────────────────────────────

  /**
   * MSB = price displaced and broke a recent swing point.
   * Combination of displacement + swing break = high probability.
   */
  private detectMSB(
    candles: Candle[],
    ranges: CandleRangeAnalysis,
    ms: MarketStructure,
  ): CRTSignal | null {
    if (!ranges.recentDisplacement) return null;
    if (candles.length < 3) return null;

    const last = candles[candles.length - 1];
    const atr = atrService.calculate(candles);
    const avgRange = atr > 0 ? atr : this.avgRange(candles, 5);

    // Check if displacement broke a swing point
    const recentHighs = ms.swingHighs.filter((s) => s.index >= candles.length - 6);
    for (const swing of recentHighs) {
      if (last.close > swing.price && last.low > swing.price) {
        return {
          direction: "BUY",
          entry: last.close,
          sl: swing.price - avgRange * 0.5,
          tp: last.close + avgRange * 2.5,
          range: { high: ranges.high, low: ranges.low, width: ranges.width },
          signalType: "MSB",
          displacementCandle: last,
          confidence: 78,
          reason: `CRT MSB BUY: Displacement broke swing high ${swing.price.toFixed(5)}`,
        };
      }
    }

    const recentLows = ms.swingLows.filter((s) => s.index >= candles.length - 6);
    for (const swing of recentLows) {
      if (last.close < swing.price && last.high < swing.price) {
        return {
          direction: "SELL",
          entry: last.close,
          sl: swing.price + avgRange * 0.5,
          tp: last.close - avgRange * 2.5,
          range: { high: ranges.high, low: ranges.low, width: ranges.width },
          signalType: "MSB",
          displacementCandle: last,
          confidence: 78,
          reason: `CRT MSB SELL: Displacement broke swing low ${swing.price.toFixed(5)}`,
        };
      }
    }

    return null;
  }

  // ── 3-Candle Pattern (Accumulation, Manipulation, Distribution) ──

  private detect3CandlePattern(fractal: import("./market-structure.service").FractalContext): CRTSignal | null {
    const setupCandles = fractal.setup;
    if (setupCandles.length < 3) return null;

    // C1: Accumulation (Range)
    // C2: Manipulation (Sweep + Close inside/reverse)
    // C3: Distribution (Current Open)
    const c1 = setupCandles[setupCandles.length - 2];
    const c2 = setupCandles[setupCandles.length - 1];

    // Check HTF Direction
    const htfTrend = fractal.directionStr.trend.direction;

    const atr = atrService.calculate(setupCandles);
    const c1Range = c1.high - c1.low;
    const isLowAtr = atr > 0 && atr < this.avgRange(setupCandles, 14) * 0.8; // Example threshold for low ATR

    // Bullish Scenario
    // H4 is Bullish (or SIDEWAYS allowing for local continuation)
    if (htfTrend !== "BEAR") {
      const c1Bearish = c1.close < c1.open;
      const c2SweepLow = c2.low < c1.low;
      const c2CloseBullish = c2.close > c2.open && c2.close > c1.low;

      if (c1Bearish && c2SweepLow && c2CloseBullish) {
        // Find entry: if low ATR, look for OB in M5 (entry timeframe)
        let entryPrice = c2.close;
        let reason = `CRT 3-Candle BUY: C2 swept C1 low (${c1.low.toFixed(5)}) and closed bullish.`;

        if (isLowAtr) {
          const ltfBullishOBs = fractal.entryStr.orderBlocks.filter(ob => ob.type === "BULLISH" && !ob.mitigated);
          if (ltfBullishOBs.length > 0) {
            // Find the OB closest to current price but below it
            const closestOB = ltfBullishOBs.sort((a, b) => b.top - a.top)[0];
            if (closestOB.top < c2.close && closestOB.top > c2.low) {
              entryPrice = closestOB.top;
              reason += ` Low ATR detected: Pending limit at LTF OB (${entryPrice.toFixed(5)}).`;
            }
          }
        }

        return {
          direction: "BUY",
          entry: entryPrice,
          sl: c2.low - atr * 0.2, // slightly below C2 low
          tp: c1.high, // draw on liquidity at C1 high
          range: { high: c1.high, low: c2.low, width: c1.high - c2.low },
          signalType: "3_CANDLE_PATTERN",
          confidence: 85,
          reason,
        };
      }
    }

    // Bearish Scenario
    if (htfTrend !== "BULL") {
      const c1Bullish = c1.close > c1.open;
      const c2SweepHigh = c2.high > c1.high;
      const c2CloseBearish = c2.close < c2.open && c2.close < c1.high;

      if (c1Bullish && c2SweepHigh && c2CloseBearish) {
        let entryPrice = c2.close;
        let reason = `CRT 3-Candle SELL: C2 swept C1 high (${c1.high.toFixed(5)}) and closed bearish.`;

        if (isLowAtr) {
          const ltfBearishOBs = fractal.entryStr.orderBlocks.filter(ob => ob.type === "BEARISH" && !ob.mitigated);
          if (ltfBearishOBs.length > 0) {
            const closestOB = ltfBearishOBs.sort((a, b) => a.bottom - b.bottom)[0];
            if (closestOB.bottom > c2.close && closestOB.bottom < c2.high) {
              entryPrice = closestOB.bottom;
              reason += ` Low ATR detected: Pending limit at LTF OB (${entryPrice.toFixed(5)}).`;
            }
          }
        }

        return {
          direction: "SELL",
          entry: entryPrice,
          sl: c2.high + atr * 0.2, // slightly above C2 high
          tp: c1.low, // draw on liquidity at C1 low
          range: { high: c2.high, low: c1.low, width: c2.high - c1.low },
          signalType: "3_CANDLE_PATTERN",
          confidence: 85,
          reason,
        };
      }
    }

    return null;
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private avgRange(candles: Candle[], period: number): number {
    const recent = candles.slice(-period);
    if (recent.length === 0) return 0;
    return recent.reduce((s, c) => s + (c.high - c.low), 0) / recent.length;
  }
}

export const crtStrategy = new CRTStrategy();
