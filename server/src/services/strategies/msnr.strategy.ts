// ─── Malaysian Support & Resistance (MSNR) Strategy ─────────────────
// Detects: Key level clustering, level strength scoring, structure maps,
//          channel / trend‑line identification, Fibonacci confluence.

import { type Candle, type KeyLevel, type MarketStructure } from "./market-structure.service";
import { atrService } from "./atr.service";

export interface MSNRSignal {
  direction: "BUY" | "SELL";
  confidence: number;
  entry: number;
  sl: number;
  tp: number;
  keyLevel: KeyLevel;
  levelStrength: number; // 1–5
  signalType: "BOUNCE" | "BREAK_RETEST" | "STRUCTURE_BREAK";
  fibLevel?: number;
  reason: string;
}

export interface MSNRAnalysis {
  signal: MSNRSignal | null;
  signals: MSNRSignal[];
}

// Fibonacci levels used for confluence
const FIB_LEVELS = [0.382, 0.5, 0.618, 0.786];

class MSNRStrategy {
  /**
   * Full MSNR analysis.
   */
  analyze(candles: Candle[], marketStructure: MarketStructure): MSNRSignal[] {
    const signals: MSNRSignal[] = [];

    // 1. Key level bounce
    const bounceSignals = this.detectLevelBounce(candles, marketStructure);
    signals.push(...bounceSignals);

    // 2. Break + retest
    const retestSignals = this.detectBreakRetest(candles, marketStructure);
    signals.push(...retestSignals);

    // 3. Structure break (level violation with conviction)
    const breakSignals = this.detectStructureBreak(candles, marketStructure);
    signals.push(...breakSignals);

    return signals.sort((a, b) => b.confidence - a.confidence);
  }

  // ── Level Bounce ───────────────────────────────────────────────────

  /**
   * Price approaches a key S/R level and shows rejection (long wick / engulfing).
   * = classic level bounce trade.
   */
  private detectLevelBounce(candles: Candle[], ms: MarketStructure): MSNRSignal[] {
    const signals: MSNRSignal[] = [];
    if (candles.length < 2 || ms.keyLevels.length === 0) return signals;

    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    const atr = atrService.calculate(candles);
    const avgRange = atr > 0 ? atr : this.avgRange(candles, 5);

    // Check each key level
    for (const level of ms.keyLevels) {
      if (level.strength < 2) continue; // weak levels don't count

      const levelDistPct = Math.abs(last.close - level.price) / level.price;
      const levelDist = Math.abs(last.close - level.price);

      // Price must be within 1 ATR of the level
      if (levelDist > avgRange * 1.2) continue;

      // RESISTANCE bounce (price below resistance → rejection = sell)
      if (level.type === "RESISTANCE" && last.close <= level.price) {
        // Rejection signal: long upper wick or bearish engulfing
        const upperWick = last.high - Math.max(last.open, last.close);
        const body = Math.abs(last.close - last.open);

        if (upperWick > body * 0.5 && last.close < last.open) {
          const fib = this.nearestFibLevel(level.price, last.close, prev.high);

          signals.push({
            direction: "SELL",
            entry: last.close,
            sl: level.price + avgRange * 0.5,
            tp: last.close - avgRange * 1.8,
            keyLevel: level,
            levelStrength: level.strength,
            signalType: "BOUNCE",
            fibLevel: fib ?? undefined,
            confidence: this.scoreBounce(level, ms),
            reason: `MSNR Bounce SELL @ resistance ${level.price.toFixed(5)} (strength ${level.strength}/5)`,
          });
        }
      }

      // SUPPORT bounce (price above support → rejection = buy)
      if (level.type === "SUPPORT" && last.close >= level.price) {
        const lowerWick = Math.min(last.open, last.close) - last.low;
        const body = Math.abs(last.close - last.open);

        if (lowerWick > body * 0.5 && last.close > last.open) {
          const fib = this.nearestFibLevel(level.price, last.close, prev.low);

          signals.push({
            direction: "BUY",
            entry: last.close,
            sl: level.price - avgRange * 0.5,
            tp: last.close + avgRange * 1.8,
            keyLevel: level,
            levelStrength: level.strength,
            signalType: "BOUNCE",
            fibLevel: fib ?? undefined,
            confidence: this.scoreBounce(level, ms),
            reason: `MSNR Bounce BUY @ support ${level.price.toFixed(5)} (strength ${level.strength}/5)`,
          });
        }
      }
    }

    return signals;
  }

  // ── Break + Retest ─────────────────────────────────────────────────

  /**
   * Price breaks a key level, then returns to retest it as the opposite role.
   */
  private detectBreakRetest(candles: Candle[], ms: MarketStructure): MSNRSignal[] {
    const signals: MSNRSignal[] = [];
    if (candles.length < 3 || ms.keyLevels.length === 0) return signals;

    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    const preprev = candles[candles.length - 3];
    const atr = atrService.calculate(candles);
    const avgRange = atr > 0 ? atr : this.avgRange(candles, 5);

    for (const level of ms.keyLevels) {
      if (level.strength < 2) continue;

      // RESISTANCE break + retest: price broke above resistance, now retesting
      if (level.type === "RESISTANCE") {
        const brokeAbove = preprev.close > level.price || preprev.high > level.price;
        const retesting = Math.abs(last.close - level.price) / level.price < 0.002;

        if (brokeAbove && retesting) {
          signals.push({
            direction: "BUY",
            entry: last.close,
            sl: level.price - avgRange * 1.2,
            tp: last.close + avgRange * 2.0,
            keyLevel: level,
            levelStrength: level.strength,
            signalType: "BREAK_RETEST",
            confidence: Math.min(85, 65 + level.strength * 4),
            reason: `MSNR Break+Retest BUY: Resistance ${level.price.toFixed(5)} → flipped to support`,
          });
        }
      }

      // SUPPORT break + retest: price broke below support, now retesting
      if (level.type === "SUPPORT") {
        const brokeBelow = preprev.close < level.price || preprev.low < level.price;
        const retesting = Math.abs(last.close - level.price) / level.price < 0.002;

        if (brokeBelow && retesting) {
          signals.push({
            direction: "SELL",
            entry: last.close,
            sl: level.price + avgRange * 1.2,
            tp: last.close - avgRange * 2.0,
            keyLevel: level,
            levelStrength: level.strength,
            signalType: "BREAK_RETEST",
            confidence: Math.min(85, 65 + level.strength * 4),
            reason: `MSNR Break+Retest SELL: Support ${level.price.toFixed(5)} → flipped to resistance`,
          });
        }
      }
    }

    return signals;
  }

  // ── Structure Break ────────────────────────────────────────────────

  /**
   * Decisive violation of a key level with strong momentum — the level
   * is "conquered" and price is expected to continue in that direction.
   */
  private detectStructureBreak(candles: Candle[], ms: MarketStructure): MSNRSignal[] {
    const signals: MSNRSignal[] = [];
    if (candles.length < 2 || ms.keyLevels.length === 0) return signals;

    const last = candles[candles.length - 1];
    const atr = atrService.calculate(candles);
    const avgRange = atr > 0 ? atr : this.avgRange(candles, 5);

    for (const level of ms.keyLevels) {
      if (level.strength < 3) continue; // only strong levels

      const bodyTop = Math.max(last.open, last.close);
      const bodyBottom = Math.min(last.open, last.close);

      // Bullish structure break: body entirely above resistance
      if (level.type === "RESISTANCE" && bodyBottom > level.price) {
        const breakDistance = (last.close - level.price) / avgRange;
        if (breakDistance >= 1.5) {
          signals.push({
            direction: "BUY",
            entry: last.close,
            sl: level.price - avgRange * 1.0,
            tp: last.close + avgRange * 2.0,
            keyLevel: level,
            levelStrength: level.strength,
            signalType: "STRUCTURE_BREAK",
            confidence: Math.min(90, 70 + level.strength * 4),
            reason: `MSNR Structure Break BUY: Resistance ${level.price.toFixed(5)} broken decisively`,
          });
        }
      }

      // Bearish structure break: body entirely below support
      if (level.type === "SUPPORT" && bodyTop < level.price) {
        const breakDistance = (level.price - last.close) / avgRange;
        if (breakDistance >= 1.5) {
          signals.push({
            direction: "SELL",
            entry: last.close,
            sl: level.price + avgRange * 1.0,
            tp: last.close - avgRange * 2.0,
            keyLevel: level,
            levelStrength: level.strength,
            signalType: "STRUCTURE_BREAK",
            confidence: Math.min(90, 70 + level.strength * 4),
            reason: `MSNR Structure Break SELL: Support ${level.price.toFixed(5)} broken decisively`,
          });
        }
      }
    }

    return signals;
  }

  // ── Fibonacci Confluence ───────────────────────────────────────────

  /**
   * Find the nearest Fibonacci level to a price point.
   * Used to add fib confluence context to signals.
   */
  nearestFibLevel(levelPrice: number, currentPrice: number, extremePrice: number): number | null {
    const range = Math.abs(levelPrice - currentPrice);
    if (range === 0) return null;

    for (const fib of FIB_LEVELS) {
      const fibPrice = currentPrice > levelPrice
        ? levelPrice + range * fib
        : levelPrice - range * fib;

      const proximity = Math.abs(currentPrice - fibPrice) / currentPrice;
      if (proximity < 0.001) return fib; // within 0.1%
    }

    return null;
  }

  // ── Scoring ────────────────────────────────────────────────────────

  private scoreBounce(level: KeyLevel, ms: MarketStructure): number {
    let score = 55;
    score += level.strength * 5; // stronger level = better bounce
    if (ms.trend.direction !== "SIDEWAYS") score += 5; // trending = better levels
    return Math.min(90, score);
  }

  private avgRange(candles: Candle[], period: number): number {
    const recent = candles.slice(-period);
    if (recent.length === 0) return 0;
    return recent.reduce((s, c) => s + (c.high - c.low), 0) / recent.length;
  }
}

export const msnrStrategy = new MSNRStrategy();
