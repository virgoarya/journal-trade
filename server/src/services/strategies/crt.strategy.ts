// ─── Candle Range Theory (CRT) Strategy ─────────────────────────────
// Detects: Range breakouts, liquidity sweeps, displacement candles,
//          Market Structure Breaks (MSB), candle body/wick analysis.

import { type Candle, type MarketStructure, type CandleRangeAnalysis } from "./market-structure.service";
import { atrService } from "./atr.service";
import { strategyConfigService } from "./strategy-config.service";

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

class CRTStrategy {
  /**
   * Full CRT analysis.
   */
  analyze(fractal: import("./market-structure.service").FractalContext): CRTSignal[] {
    const signals: CRTSignal[] = [];

    if (!fractal.isAligned) return signals;

    const candles = fractal.entry;
    const marketStructure = fractal.entryStr;
    const crtConfig = strategyConfigService.getCRTConfig();
    // HTF trend direction untuk filter Range Breakout
    const htfTrend = fractal.directionStr.trend.direction;

    if (candles.length < crtConfig.rangeLookback) return signals;

    const ranges = marketStructure.candleRanges;

    // 0. CRT 3-Candle Pattern (highest quality setup)
    const threeCandleSignal = this.detect3CandlePattern(fractal, crtConfig);
    if (threeCandleSignal) signals.push(threeCandleSignal);

    // 1. Range Breakout (pending limit di retest, dengan HTF trend filter)
    const breakoutSignal = this.detectRangeBreakout(candles, ranges, marketStructure, crtConfig, htfTrend);
    if (breakoutSignal) signals.push(breakoutSignal);

    // 2. Liquidity Sweep (reversal setelah stop hunt)
    const sweepSignal = this.detectLiquiditySweep(candles, ranges, marketStructure, crtConfig);
    if (sweepSignal) signals.push(sweepSignal);

    // 3. Displacement — DIHAPUS dari backtest (noisy, lebih cocok untuk live manual trading)
    // const displacementSignal = this.detectDisplacement(...);

    // 4. Market Structure Break (MSB) — tetap aktif
    const msbSignal = this.detectMSB(candles, ranges, marketStructure, crtConfig, fractal.directionStr);
    if (msbSignal) signals.push(msbSignal);

    return signals.sort((a, b) => b.confidence - a.confidence);
  }

  // ── Range Breakout ─────────────────────────────────────────────────

  /**
   * Range Breakout dengan HTF trend filter.
   * Hanya ambil BUY breakout jika HTF bullish (atau sideways),
   * hanya ambil SELL breakout jika HTF bearish (atau sideways).
   * Ini mengurangi counter-trend false signals.
   */
  private detectRangeBreakout(
    candles: Candle[],
    ranges: CandleRangeAnalysis,
    ms: MarketStructure,
    crtConfig: import("./strategy-config.service").StrategyConfig['crt'],
    htfTrend: "BULL" | "BEAR" | "SIDEWAYS" = "SIDEWAYS",
  ): CRTSignal | null {
    if (candles.length < 2) return null;

    const last = candles[candles.length - 1];

    // Calculate range from the last N candles (excluding the last one)
    const recent = candles.slice(-crtConfig.rangeLookback - 1, -1);
    const rangeHigh = Math.max(...recent.map((c) => c.high));
    const rangeLow = Math.min(...recent.map((c) => c.low));
    const rangeWidth = rangeHigh - rangeLow;

    if (rangeWidth === 0) return null;

    const atr = atrService.calculate(candles);
    const avgRange = atr > 0 ? atr : this.avgRange(candles, 5);
    const bodyTop = Math.max(last.open, last.close);
    const bodyBottom = Math.min(last.open, last.close);
    const body = bodyTop - bodyBottom;

    // Bullish breakout: body entirely above range — hanya jika HTF TIDAK bearish
    if (bodyBottom > rangeHigh && body > rangeWidth * crtConfig.breakoutThresholdPct) {
      if (htfTrend === "BEAR") return null;
      // Entry: pending BUY LIMIT di rangeHigh (retest level yang ditembus)
      // Jauh lebih reliable daripada market entry di close breakout candle
      return {
        direction: "BUY",
        entry: rangeHigh,           // Pending limit di rangeHigh
        sl: rangeHigh - avgRange * 1.0,  // SL 1× ATR di bawah rangeHigh
        tp: rangeHigh + avgRange * 2.5,  // TP 2.5× ATR dari entry
        range: { high: rangeHigh, low: rangeLow, width: rangeWidth },
        signalType: "RANGE_BREAKOUT",
        confidence: crtConfig.minConfidence + 20,  // confidence lebih tinggi karena entry lebih selektif
        reason: `CRT Breakout BUY: Pending limit @ retest rangeHigh ${rangeHigh.toFixed(5)} (HTF: ${htfTrend}, RR 1:2.5)`,
      };
    }

    // Bearish breakout: body entirely below range — hanya jika HTF TIDAK bullish
    if (bodyTop < rangeLow && body > rangeWidth * crtConfig.breakoutThresholdPct) {
      if (htfTrend === "BULL") return null;
      return {
        direction: "SELL",
        entry: rangeLow,            // Pending limit di rangeLow
        sl: rangeLow + avgRange * 1.0,
        tp: rangeLow - avgRange * 2.5,
        range: { high: rangeHigh, low: rangeLow, width: rangeWidth },
        signalType: "RANGE_BREAKOUT",
        confidence: crtConfig.minConfidence + 20,
        reason: `CRT Breakout SELL: Pending limit @ retest rangeLow ${rangeLow.toFixed(5)} (HTF: ${htfTrend}, RR 1:2.5)`,
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
    crtConfig: import("./strategy-config.service").StrategyConfig['crt'],
  ): CRTSignal | null {
    if (candles.length < 2) return null;

    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    const recent = candles.slice(-crtConfig.rangeLookback - 1, -1);
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
        tp: rangeHigh, // TP mengincar sisi berlawanan range (lebih logis dari fixed ATR)
        range: { high: rangeHigh, low: rangeLow, width: rangeWidth },
        signalType: "LIQUIDITY_SWEEP",
        confidence: crtConfig.minConfidence + 22,
        reason: `CRT Sweep BUY: Wick below range ${rangeLow.toFixed(5)} swept stops, TP @ range high ${rangeHigh.toFixed(5)}`,
      };
    }

    // Bearish sweep: previous candle broke above range, now closed back in
    if (prev.high > rangeHigh && last.close < rangeHigh) {
      return {
        direction: "SELL",
        entry: last.close,
        sl: rangeHigh + avgRange * 0.5,
        tp: rangeLow, // TP mengincar sisi berlawanan range
        range: { high: rangeHigh, low: rangeLow, width: rangeWidth },
        signalType: "LIQUIDITY_SWEEP",
        confidence: crtConfig.minConfidence + 22,
        reason: `CRT Sweep SELL: Wick above range ${rangeHigh.toFixed(5)} swept stops, TP @ range low ${rangeLow.toFixed(5)}`,
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
    crtConfig: import("./strategy-config.service").StrategyConfig['crt'],
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
        // Market entry di close candle (backtest-compatible)
        // Note: idealnya pending limit di 50% body untuk live trading
        entry: last.close,
        sl: last.low - avgRange * 0.5,
        tp: last.close + avgRange * 2.5,
        range: { high: last.high, low: last.low, width: last.high - last.low },
        signalType: "DISPLACEMENT",
        displacementCandle: last,
        confidence: crtConfig.minConfidence + 20,
        reason: `CRT Displacement BUY: Market entry @ close ${last.close.toFixed(5)}, candle range ${(last.high - last.low).toFixed(5)} (${((last.high - last.low) / avgRange).toFixed(1)}× avg)`,
      };
    }

    if (isBearish) {
      return {
        direction: "SELL",
        entry: last.close,
        sl: last.high + avgRange * 0.5,
        tp: last.close - avgRange * 2.5,
        range: { high: last.high, low: last.low, width: last.high - last.low },
        signalType: "DISPLACEMENT",
        displacementCandle: last,
        confidence: crtConfig.minConfidence + 20,
        reason: `CRT Displacement SELL: Market entry @ close ${last.close.toFixed(5)}, candle range ${(last.high - last.low).toFixed(5)} (${((last.high - last.low) / avgRange).toFixed(1)}× avg)`,
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
    crtConfig: import("./strategy-config.service").StrategyConfig['crt'],
    fractalDirection: import("./market-structure.service").FractalContext['directionStr'],
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
        let confidence = crtConfig.minConfidence + 28;
        if (fractalDirection.trend.direction === "BULL") confidence += 5;

        return {
          direction: "BUY",
          entry: last.close,
          sl: swing.price - avgRange * 0.5,
          tp: last.close + avgRange * 2.5,
          range: { high: ranges.high, low: ranges.low, width: ranges.width },
          signalType: "MSB",
          displacementCandle: last,
          confidence: Math.min(98, confidence),
          reason: `CRT MSB BUY: Displacement broke swing high ${swing.price.toFixed(5)}`,
        };
      }
    }

    const recentLows = ms.swingLows.filter((s) => s.index >= candles.length - 6);
    for (const swing of recentLows) {
      if (last.close < swing.price && last.high < swing.price) {
        let confidence = crtConfig.minConfidence + 28;
        if (fractalDirection.trend.direction === "BEAR") confidence += 5;

        return {
          direction: "SELL",
          entry: last.close,
          sl: swing.price + avgRange * 0.5,
          tp: last.close - avgRange * 2.5,
          range: { high: ranges.high, low: ranges.low, width: ranges.width },
          signalType: "MSB",
          displacementCandle: last,
          confidence: Math.min(98, confidence),
          reason: `CRT MSB SELL: Displacement broke swing low ${swing.price.toFixed(5)}`,
        };
      }
    }

    return null;
  }

  // ─── 3-Candle Pattern (Accumulation, Manipulation, Distribution) ──

  private detect3CandlePattern(
    fractal: import("./market-structure.service").FractalContext,
    crtConfig: import("./strategy-config.service").StrategyConfig['crt'],
  ): CRTSignal | null {
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
          sl: c2.low - atr * 0.5, // was 0.2 — diperlebar agar tidak kena noise
          tp: c1.high, // draw on liquidity at C1 high
          range: { high: c1.high, low: c2.low, width: c1.high - c2.low },
          signalType: "3_CANDLE_PATTERN",
          confidence: crtConfig.minConfidence + 35,
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
          sl: c2.high + atr * 0.5, // was 0.2 — diperlebar agar tidak kena noise
          tp: c1.low, // draw on liquidity at C1 low
          range: { high: c2.high, low: c1.low, width: c2.high - c1.low },
          signalType: "3_CANDLE_PATTERN",
          confidence: crtConfig.minConfidence + 35,
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
