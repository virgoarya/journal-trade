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
  signalType: "BOUNCE" | "BREAK_RETEST" | "STRUCTURE_BREAK" | "SBR" | "RBS" | "QML" | "STORYLINE_QM" | "STORYLINE_SBR" | "STORYLINE_RBS";
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
  analyze(fractal: import("./market-structure.service").FractalContext): MSNRSignal[] {
    const rawSignals: MSNRSignal[] = [];

    if (!fractal.isAligned) return rawSignals;

    // ─── TAHAP 1: Cari Setup / Penolakan di Timeframe SETUP (M15) ───
    const setupCandles = fractal.setup;
    const setupStructure = fractal.setupStr;

    // 1. Key level bounce
    const bounceSignals = this.detectLevelBounce(setupCandles, setupStructure);
    rawSignals.push(...bounceSignals);

    // 2. SBR / RBS
    const sbrRbsSignals = this.detectSBR_RBS(setupCandles, setupStructure, fractal.directionStr);
    rawSignals.push(...sbrRbsSignals);

    // 2b. Quasimodo Level (QML)
    const qmlSignals = this.detectQML(setupCandles, setupStructure, fractal.directionStr);
    rawSignals.push(...qmlSignals);

    // 3. Structure break
    const breakSignals = this.detectStructureBreak(setupCandles, setupStructure);
    rawSignals.push(...breakSignals);

    // ─── TAHAP 2: Konfirmasi Pola Engulfing di Timeframe ENTRY (M5) ───
    const confirmedSignals = this.confirmWithEntryTF(rawSignals, fractal.entry);

    return confirmedSignals.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Filter sinyal potensial M15 dengan memastikan ada Engulfing/Reversal Candle di M5
   */
  private confirmWithEntryTF(signals: MSNRSignal[], entryCandles: Candle[]): MSNRSignal[] {
    if (entryCandles.length < 2) return [];
    const confirmed: MSNRSignal[] = [];
    const last = entryCandles[entryCandles.length - 1];
    const prev = entryCandles[entryCandles.length - 2];

    const isBullishEngulfing =
      prev.close < prev.open && // prev bearish
      last.close > last.open && // last bullish
      last.close > prev.open && // body engulf
      last.open <= prev.close;

    const isBearishEngulfing =
      prev.close > prev.open && // prev bullish
      last.close < last.open && // last bearish
      last.close < prev.open && // body engulf
      last.open >= prev.close;

    const atr = atrService.calculate(entryCandles);
    const m5Atr = atr > 0 ? atr : this.avgRange(entryCandles, 5);

    for (const sig of signals) {
      if (sig.direction === "BUY" && isBullishEngulfing) {
        const confirmedEntry = last.close;
        const engulfingLow = Math.min(last.low, prev.low);
        const newSl = engulfingLow - m5Atr * 0.5;

        confirmed.push({
          ...sig,
          entry: confirmedEntry,
          sl: newSl,
          reason: sig.reason + ` [CONFIRMED by M5 Bullish Engulfing]`,
          confidence: Math.min(95, sig.confidence + 15),
        });
      }

      if (sig.direction === "SELL" && isBearishEngulfing) {
        const confirmedEntry = last.close;
        const engulfingHigh = Math.max(last.high, prev.high);
        const newSl = engulfingHigh + m5Atr * 0.5;

        confirmed.push({
          ...sig,
          entry: confirmedEntry,
          sl: newSl,
          reason: sig.reason + ` [CONFIRMED by M5 Bearish Engulfing]`,
          confidence: Math.min(95, sig.confidence + 15),
        });
      }
    }

    return confirmed;
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

  // ── SBR / RBS (Support Become Resistance / Resistance Become Support) ──

  private detectSBR_RBS(candles: Candle[], ms: MarketStructure, htfMs: MarketStructure): MSNRSignal[] {
    const signals: MSNRSignal[] = [];
    if (candles.length < 3 || ms.keyLevels.length === 0) return signals;

    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    const preprev = candles[candles.length - 3];
    const atr = atrService.calculate(candles);
    const avgRange = atr > 0 ? atr : this.avgRange(candles, 5);

    for (const level of ms.keyLevels) {
      if (level.strength < 2) continue;

      // RESISTANCE break + retest (RBS - Resistance Become Support)
      if (level.type === "RESISTANCE") {
        const brokeAbove = preprev.close > level.price; 
        const retesting = Math.abs(last.close - level.price) / level.price < 0.002;

        if (brokeAbove && retesting) {
          // STORYLINE CHECK: Did the move that broke the resistance originate from an HTF Support?
          const recentSwings = ms.swingLows.filter(s => s.time < last.time);
          const originLow = recentSwings.length > 0 ? recentSwings[recentSwings.length - 1].price : null;
          const isStoryline = originLow !== null && htfMs.keyLevels.some(htf => htf.type === "SUPPORT" && Math.abs(originLow - htf.price) / htf.price < 0.005);
          
          signals.push({
            direction: "BUY",
            entry: last.close,
            sl: level.price - avgRange * 1.5,
            tp: last.close + avgRange * 3.0,
            keyLevel: level,
            levelStrength: level.strength,
            signalType: isStoryline ? "STORYLINE_RBS" : "RBS",
            confidence: isStoryline ? 95 : Math.min(80, 60 + level.strength * 4),
            reason: isStoryline ? `Storyline RBS BUY: HTF Support rejected, broke resistance ${level.price.toFixed(5)}, now retesting` : `RBS BUY: Resistance ${level.price.toFixed(5)} broken and retested as support`,
          });
        }
      }

      // SUPPORT break + retest (SBR - Support Become Resistance)
      if (level.type === "SUPPORT") {
        const brokeBelow = preprev.close < level.price;
        const retesting = Math.abs(last.close - level.price) / level.price < 0.002;

        if (brokeBelow && retesting) {
          // STORYLINE CHECK: Did the move that broke the support originate from an HTF Resistance?
          const recentSwings = ms.swingHighs.filter(s => s.time < last.time);
          const originHigh = recentSwings.length > 0 ? recentSwings[recentSwings.length - 1].price : null;
          const isStoryline = originHigh !== null && htfMs.keyLevels.some(htf => htf.type === "RESISTANCE" && Math.abs(originHigh - htf.price) / htf.price < 0.005);

          signals.push({
            direction: "SELL",
            entry: last.close,
            sl: level.price + avgRange * 1.5,
            tp: last.close - avgRange * 3.0,
            keyLevel: level,
            levelStrength: level.strength,
            signalType: isStoryline ? "STORYLINE_SBR" : "SBR",
            confidence: isStoryline ? 95 : Math.min(80, 60 + level.strength * 4),
            reason: isStoryline ? `Storyline SBR SELL: HTF Resistance rejected, broke support ${level.price.toFixed(5)}, now retesting` : `SBR SELL: Support ${level.price.toFixed(5)} broken and retested as resistance`,
          });
        }
      }
    }

    return signals;
  }

  // ── QML (Quasimodo Level) ──────────────────────────────────────────

  private detectQML(candles: Candle[], ms: MarketStructure, htfMs: MarketStructure): MSNRSignal[] {
    const signals: MSNRSignal[] = [];
    if (candles.length < 10) return signals;
    if (ms.swingHighs.length < 2 || ms.swingLows.length < 2) return signals;

    const last = candles[candles.length - 1];
    const atr = atrService.calculate(candles);
    const avgRange = atr > 0 ? atr : this.avgRange(candles, 5);

    const swings = [
      ...ms.swingHighs.map(s => ({ ...s, type: 'HIGH' })),
      ...ms.swingLows.map(s => ({ ...s, type: 'LOW' }))
    ].sort((a, b) => a.index - b.index);

    if (swings.length < 4) return signals;
    const [s1, s2, s3, s4] = swings.slice(-4);

    // BULLISH QML (Inverted H&S / Low - High - Lower Low - Higher High)
    if (s1.type === "LOW" && s2.type === "HIGH" && s3.type === "LOW" && s4.type === "HIGH") {
      const isHeadLower = s3.price < s1.price; 
      const isQmBroken = s4.price > s2.price; 
      const isRetestingLeftShoulder = Math.abs(last.close - s1.price) / s1.price < 0.0025; 
      const notViolated = last.close > s3.price; 

      if (isHeadLower && isQmBroken && isRetestingLeftShoulder && notViolated) {
        // STORYLINE CHECK: Did the Head (S3) reject off an HTF Support?
        const isStoryline = htfMs.keyLevels.some(htf => htf.type === "SUPPORT" && Math.abs(s3.price - htf.price) / htf.price < 0.005);
        
        signals.push({
          direction: "BUY",
          entry: last.close,
          sl: s3.price - avgRange * 0.5,
          tp: s4.price + avgRange * 3.0,
          keyLevel: { price: s1.price, strength: 4, type: "SUPPORT", lastTested: last.time },
          levelStrength: 4,
          signalType: isStoryline ? "STORYLINE_QM" : "QML",
          confidence: isStoryline ? 98 : 75,
          reason: isStoryline ? `Storyline QM BUY: HTF Support rejected at Head, MSS formed, retesting QM ${s1.price.toFixed(5)}` : `Bullish QML BUY: Left Shoulder retest at ${s1.price.toFixed(5)} after LL & HH`,
        });
      }
    }

    // BEARISH QML (H&S / High - Low - Higher High - Lower Low)
    if (s1.type === "HIGH" && s2.type === "LOW" && s3.type === "HIGH" && s4.type === "LOW") {
      const isHeadHigher = s3.price > s1.price; 
      const isQmBroken = s4.price < s2.price; 
      const isRetestingLeftShoulder = Math.abs(last.close - s1.price) / s1.price < 0.0025; 
      const notViolated = last.close < s3.price;

      if (isHeadHigher && isQmBroken && isRetestingLeftShoulder && notViolated) {
        // STORYLINE CHECK: Did the Head (S3) reject off an HTF Resistance?
        const isStoryline = htfMs.keyLevels.some(htf => htf.type === "RESISTANCE" && Math.abs(s3.price - htf.price) / htf.price < 0.005);

        signals.push({
          direction: "SELL",
          entry: last.close,
          sl: s3.price + avgRange * 0.5,
          tp: s4.price - avgRange * 3.0,
          keyLevel: { price: s1.price, strength: 4, type: "RESISTANCE", lastTested: last.time },
          levelStrength: 4,
          signalType: isStoryline ? "STORYLINE_QM" : "QML",
          confidence: isStoryline ? 98 : 75,
          reason: isStoryline ? `Storyline QM SELL: HTF Resistance rejected at Head, MSS formed, retesting QM ${s1.price.toFixed(5)}` : `Bearish QML SELL: Left Shoulder retest at ${s1.price.toFixed(5)} after HH & LL`,
        });
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
