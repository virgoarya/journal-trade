// ─── Quarterly Theory Strategy ──────────────────────────────────────
// Analyzes quarterly pivot levels (open, high, low, close) for interbank
// positioning detection, quarterly range breaks, and seasonal shifts.

import { type Candle, type MarketStructure, type QuarterlyPivot } from "./market-structure.service";
import { atrService } from "./atr.service";

export interface QuarterlySignal {
  direction: "BUY" | "SELL";
  confidence: number;
  entry: number;
  sl: number;
  tp: number;
  quarterlyLevel: number;
  quarterlyRange: { high: number; low: number };
  signalType: "QUARTERLY_BREAK" | "QUARTERLY_BOUNCE" | "QUARTERLY_RETEST" | "QUARTERLY_RANGE_EXTENSION";
  reason: string;
}

export interface QuarterlyAnalysis {
  signal: QuarterlySignal | null;
  signals: QuarterlySignal[];
}

class QuarterlyTheoryStrategy {
  /**
   * Full quarterly analysis.
   */
  analyze(fractal: import("./market-structure.service").FractalContext): QuarterlySignal[] {
    const signals: QuarterlySignal[] = [];
    
    if (!fractal.isAligned) return signals;

    const candles = fractal.entry;
    const marketStructure = fractal.entryStr;
    if (candles.length < 2) return signals;

    const qp = marketStructure.quarterlyPivots;
    if (!qp) return signals;

    const last = candles[candles.length - 1];
    const atr = atrService.calculate(candles);
    const avgRange = atr > 0 ? atr : this.avgRange(candles, 5);

    // 1. Quarterly Bounce: price at quarterly open/high/low → reaction
    const bounceSignal = this.detectQuarterlyBounce(last, qp, avgRange, marketStructure);
    if (bounceSignal) signals.push(bounceSignal);

    // 2. Quarterly Break: price breaking beyond the quarterly range
    const breakSignal = this.detectQuarterlyBreak(last, qp, avgRange, marketStructure);
    if (breakSignal) signals.push(breakSignal);

    // 3. Quarterly Retest: price returned to a quarterly level
    const retestSignal = this.detectQuarterlyRetest(last, qp, avgRange, marketStructure);
    if (retestSignal) signals.push(retestSignal);

    return signals.sort((a, b) => b.confidence - a.confidence);
  }

  // ── Quarterly Bounce ───────────────────────────────────────────────

  /**
   * Price approaches a quarterly level (high/low/open) and shows
   * rejection — suggests institutional positioning at these levels.
   */
  private detectQuarterlyBounce(
    last: Candle,
    qp: QuarterlyPivot,
    avgRange: number,
    ms: MarketStructure,
  ): QuarterlySignal | null {
    const levels = [
      { price: qp.high, label: "Quarterly High" },
      { price: qp.low, label: "Quarterly Low" },
      { price: qp.open, label: "Quarterly Open" },
    ];

    for (const lvl of levels) {
      const distPct = Math.abs(last.close - lvl.price) / lvl.price;
      if (distPct > avgRange / lvl.price) continue; // too far

      // Bounce from QUARTERLY HIGH → sell (resistance)
      if (last.close <= lvl.price && last.high >= lvl.price) {
        return {
          direction: "SELL",
          entry: last.close,
          sl: qp.high + avgRange * 0.5,
          tp: last.close - avgRange * 2.0,
          quarterlyLevel: lvl.price,
          quarterlyRange: { high: qp.high, low: qp.low },
          signalType: "QUARTERLY_BOUNCE",
          confidence: 65,
          reason: `QT Bounce SELL @ ${lvl.label} ${lvl.price.toFixed(5)} (Q${qp.quarter} ${qp.year})`,
        };
      }

      // Bounce from QUARTERLY LOW → buy (support)
      if (last.close >= lvl.price && last.low <= lvl.price) {
        return {
          direction: "BUY",
          entry: last.close,
          sl: qp.low - avgRange * 0.5,
          tp: last.close + avgRange * 2.0,
          quarterlyLevel: lvl.price,
          quarterlyRange: { high: qp.high, low: qp.low },
          signalType: "QUARTERLY_BOUNCE",
          confidence: 65,
          reason: `QT Bounce BUY @ ${lvl.label} ${lvl.price.toFixed(5)} (Q${qp.quarter} ${qp.year})`,
        };
      }
    }

    return null;
  }

  // ── Quarterly Break ────────────────────────────────────────────────

  /**
   * Price breaking above/below the quarterly range = major signal.
   * A break above Q high = bullish dominance; below Q low = bearish.
   */
  private detectQuarterlyBreak(
    last: Candle,
    qp: QuarterlyPivot,
    avgRange: number,
    ms: MarketStructure,
  ): QuarterlySignal | null {
    const bodyTop = Math.max(last.open, last.close);
    const bodyBottom = Math.min(last.open, last.close);

    // Bullish break above quarterly high
    if (bodyBottom > qp.high) {
      return {
        direction: "BUY",
        entry: last.close,
        sl: qp.high - avgRange * 0.5,
        tp: last.close + avgRange * 2.5,
        quarterlyLevel: qp.high,
        quarterlyRange: { high: qp.high, low: qp.low },
        signalType: "QUARTERLY_BREAK",
        confidence: 72,
        reason: `QT Break BUY: Price above Q${qp.quarter} high ${qp.high.toFixed(5)}`,
      };
    }

    // Bearish break below quarterly low
    if (bodyTop < qp.low) {
      return {
        direction: "SELL",
        entry: last.close,
        sl: qp.low + avgRange * 0.5,
        tp: last.close - avgRange * 2.5,
        quarterlyLevel: qp.low,
        quarterlyRange: { high: qp.high, low: qp.low },
        signalType: "QUARTERLY_BREAK",
        confidence: 72,
        reason: `QT Break SELL: Price below Q${qp.quarter} low ${qp.low.toFixed(5)}`,
      };
    }

    return null;
  }

  // ── Quarterly Retest ───────────────────────────────────────────────

  /**
   * Price broke a quarterly level earlier, returned to retest it.
   */
  private detectQuarterlyRetest(
    last: Candle,
    qp: QuarterlyPivot,
    avgRange: number,
    ms: MarketStructure,
  ): QuarterlySignal | null {
    // Use the quarterly open as a retest level
    const distFromOpen = Math.abs(last.close - qp.open) / qp.open;
    if (distFromOpen > avgRange * 0.5 / qp.open) return null;

    // If previous price is above open and now retesting from above = sell
    // If previous price is below open and now retesting from below = buy
    // Simplified: check which side price is on
    if (last.close >= qp.open) {
      return {
        direction: "SELL",
        entry: last.close,
        sl: qp.open + avgRange * 1.0,
        tp: last.close - avgRange * 1.5,
        quarterlyLevel: qp.open,
        quarterlyRange: { high: qp.high, low: qp.low },
        signalType: "QUARTERLY_RETEST",
        confidence: 55,
        reason: `QT Retest: Price near Q${qp.quarter} open ${qp.open.toFixed(5)}`,
      };
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

export const quarterlyTheoryStrategy = new QuarterlyTheoryStrategy();
