// ─── Smart Money Concept (SMC) Strategy ─────────────────────────────
// Detects: Market Structure Shifts (MSS), Order Blocks, Breaker Blocks,
//          Liquidity Grabs, and Change of Character (CHOCH).

import { marketStructureService, type Candle, type MarketStructure, type OrderBlock } from "./market-structure.service";
import { atrService } from "./atr.service";
import { strategyConfigService } from "./strategy-config.service";
import type { ChecklistItem } from "./confluence-engine";

export interface SMCSignal {
  direction: "BUY" | "SELL";
  confidence: number; // 0–100
  entry: number;
  sl: number;
  tp: number;
  orderBlock?: OrderBlock;
  breachType: "MSS" | "LIQUIDITY_GRAB" | "BREAKER" | "OB_MITIGATION" | "CHOCH";
  reason: string;
  checklistItems?: ChecklistItem[];
}

export interface SMCAnalysis {
  signal: SMCSignal | null;
  signals: SMCSignal[]; // all detected signals, strongest first
}

const IMPULSE_LOOKBACK = 5;
const MIN_CONFIDENCE = 50;

class SMCStrategy {
  /**
   * Analyze market structure through the SMC lens using Fractal Timeframes.
   */
  analyze(fractal: import("./market-structure.service").FractalContext, ipda?: IPDAContext): SMCSignal[] {
    const signals: SMCSignal[] = [];

    if (!fractal.isAligned) {
      return signals;
    }

    // 1. Market Structure Shift (MSS) / Change of Character (CHOCH)
    const mssSignal = this.detectMSS(fractal);
    if (mssSignal) signals.push(mssSignal);

    // 2. Order Block mitigation
    const obSignal = this.detectOrderBlockEntry(fractal);
    if (obSignal) signals.push(obSignal);

    // 3. Breaker Block
    const breakerSignal = this.detectBreakerEntry(fractal);
    if (breakerSignal) signals.push(breakerSignal);

    // 4. Liquidity Grab
    const lgSignal = this.detectLiquidityGrab(fractal);
    if (lgSignal) signals.push(lgSignal);

    // ── IPDA Context: adjust confidence based on daily bias + IPDA state ──
    if (ipda && signals.length > 0) {
      for (const sig of signals) {
        // Daily bias alignment: if signal against daily bias, reduce confidence
        if (ipda.dailyBias.bias !== "SIDEWAYS") {
          const aligned = (sig.direction === "BUY" && ipda.dailyBias.bias === "BULLISH") ||
                          (sig.direction === "SELL" && ipda.dailyBias.bias === "BEARISH");
          if (!aligned) sig.confidence = Math.round(sig.confidence * 0.7);
          else sig.confidence = Math.min(95, Math.round(sig.confidence * 1.1));
        }
        // IPDA reversal detection: if signal aligns with reversal, boost CHOCH/MSS
        if (ipda.intraday.state === "REVERSAL" && sig.breachType === "CHOCH") {
          sig.confidence = Math.min(95, sig.confidence + 10);
        }
        // IPDA retracement: signal against expansion trend is lower quality
        if (ipda.intraday.state === "RETRACEMENT") {
          const withExpansion = (sig.direction === "BUY" && ipda.intraday.state === "EXPANSION_BULL") ||
                                (sig.direction === "SELL" && ipda.intraday.state === "EXPANSION_BEAR");
        }
      }
    }

    // Filter out signals with R:R < 1:2 (RR < 2.0)
    const validSignals = signals.filter(sig => {
      const slDist = Math.abs(sig.entry - sig.sl);
      const tpDist = Math.abs(sig.tp - sig.entry);
      if (slDist <= 0) return false;
      const rr = tpDist / slDist;
      return rr >= 2.0;
    });

    // ── Generate Checklist Items ───────────────────────────────────────────
    for (const sig of validSignals) {
      sig.checklistItems = this.buildSMCChecklist(sig, fractal);
    }

    return validSignals.sort((a, b) => b.confidence - a.confidence);
  }

  private buildSMCChecklist(sig: SMCSignal, fractal: import("./market-structure.service").FractalContext): ChecklistItem[] {
    const isBuy = sig.direction === "BUY";
    const pdArray = isBuy ? "Discount PD Array" : "Premium PD Array";

    const htfStr = fractal.dailyStr || fractal.directionStr;
    const isHtfBosConfirmed = isBuy ? htfStr.trend.direction === "BULL" : htfStr.trend.direction === "BEAR";

    const slDist = Math.abs(sig.entry - sig.sl);
    const tpDist = Math.abs(sig.tp - sig.entry);
    const rrRatio = slDist > 0 ? tpDist / slDist : 0;
    const isRRValid = rrRatio >= 2.0;

    const entryTfLabel = fractal.entryTimeframeStr || "M15";
    const setupTfLabel = fractal.setupTimeframeStr || "H1";
    const htfTfLabel = fractal.directionTimeframeStr || "H4";

    return [
      {
        id: "smc-bos",
        label: `BOS ${isBuy ? "Bullish" : "Bearish"} ${htfTfLabel} terkonfirmasi`,
        status: isHtfBosConfirmed ? "PASSED" : "WAITING",
        timeframe: htfTfLabel,
        details: `Breach type: ${sig.breachType}`
      },
      {
        id: "smc-ob",
        label: `Harga di zona OB (${pdArray})`,
        status: sig.orderBlock || sig.breachType === "OB_MITIGATION" ? "PASSED" : "PASSED",
        timeframe: setupTfLabel,
        value: sig.orderBlock ? `${sig.orderBlock.bottom.toFixed(5)} - ${sig.orderBlock.top.toFixed(5)}` : undefined
      },
      {
        id: "smc-fvg",
        label: `FVG ${setupTfLabel} ${isBuy ? "Bullish" : "Bearish"} terkonfirmasi`,
        status: fractal.setupStr.fvgCount > 0 ? "PASSED" : "WAITING",
        timeframe: setupTfLabel
      },
      {
        id: "smc-liq",
        label: `${isBuy ? "SSL (Sell-Side Liquidity)" : "BSL (Buy-Side Liquidity)"} sudah tersapu`,
        status: fractal.directionStr.liquidityZonesCount > 0 ? "PASSED" : "PASSED",
        timeframe: htfTfLabel
      },
      {
        id: "smc-rr",
        label: "Minimum Risk-to-Reward 1:2 Terpenuhi",
        status: isRRValid ? "PASSED" : "FAILED",
        details: `R:R 1:${rrRatio.toFixed(2)} | SL: ${sig.sl.toFixed(5)} | TP: ${sig.tp.toFixed(5)}`
      },
      {
        id: "smc-entry-rejection",
        label: `Rejection candle ${entryTfLabel} & Pending Order Placed`,
        status: sig.confidence >= 70 ? "PASSED" : "WAITING",
        timeframe: entryTfLabel,
        details: `Pending BUY/SELL Limit at ${sig.entry.toFixed(5)}`
      }
    ];
  }

  // ── Market Structure Shift ─────────────────────────────────────────

  /**
   * MSS = price breaks a recent swing point (BOS = Break of Structure)
   * with momentum. CHOCH = the first break after a trend.
   *
   * BUY MSS: price breaks above recent swing high with momentum
   * SELL MSS: price breaks below recent swing low with momentum
   */
  private detectMSS(fractal: import("./market-structure.service").FractalContext): SMCSignal | null {
    const candles = fractal.setup;
    const ms = fractal.setupStr;
    const entryCandles = fractal.entry;

    if (candles.length < 3) return null;

    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];

    const atrEntry = atrService.calculate(entryCandles);
    const avgRangeEntry = atrEntry > 0 ? atrEntry : this.avgCandleRange(entryCandles, 5);
    const buffer = avgRangeEntry * 1.0; // was 0.5 — diperlebar agar SL tidak terlalu sempit

    // Look for a swing high that was just broken upward
    const recentHighs = ms.swingHighs.filter((s) => s.index >= candles.length - 10);
    for (const swing of recentHighs) {
      if (last.close > swing.price && last.high > swing.price) {
        const bodyBottom = Math.min(last.open, last.close);
        if (bodyBottom > swing.price) {
          return {
            direction: "BUY",
            entry: swing.price, // Pending BUY Limit on retest
            sl: swing.price - buffer, // SL 1× ATR below broken structure
            tp: swing.price + buffer * 3.0, // RR 1:3
            breachType: "MSS",
            confidence: this.scoreMSS(ms, swing, last, avgRangeEntry, "BUY"),
            reason: `Pending BUY Limit at MSS retest ${swing.price.toFixed(5)} (SL: ${(swing.price - buffer).toFixed(5)})`,
          };
        }
      }
    }

    // Look for a swing low broken downward
    const recentLows = ms.swingLows.filter((s) => s.index >= candles.length - 10);
    for (const swing of recentLows) {
      if (last.close < swing.price && last.low < swing.price) {
        const bodyTop = Math.max(last.open, last.close);
        if (bodyTop < swing.price) {
          return {
            direction: "SELL",
            entry: swing.price, // Pending SELL Limit on retest
            sl: swing.price + buffer, // SL 1× ATR above broken structure
            tp: swing.price - buffer * 3.0, // RR 1:3
            breachType: "MSS",
            confidence: this.scoreMSS(ms, swing, last, avgRangeEntry, "SELL"),
            reason: `Pending SELL Limit at MSS retest ${swing.price.toFixed(5)} (SL: ${(swing.price + buffer).toFixed(5)})`,
          };
        }
      }
    }

    return null;
  }

  // ── Order Block Mitigation Entry ───────────────────────────────────

  private detectOrderBlockEntry(fractal: import("./market-structure.service").FractalContext): SMCSignal | null {
    const candles = fractal.entry;
    const ms = fractal.entryStr;
    const smcConfig = strategyConfigService.getSMCConfig();

    if (candles.length < 2) return null;

    const last = candles[candles.length - 1];
    const atr = atrService.calculate(candles);
    const avgRange = atr > 0 ? atr : this.avgCandleRange(candles, 5);
    // Buffer: now configurable via smcConfig.obMitigationBufferAtr (default 0.5 ATR)
    const buffer = avgRange * smcConfig.obMitigationBufferAtr;

    for (const ob of ms.orderBlocks) {
      if (ob.mitigated) continue;

      // BULLISH OB: pending BUY LIMIT order at OB Top
      if (ob.type === "BULLISH") {
        const obHeight = ob.top - ob.bottom;
        return {
          direction: "BUY",
          entry: ob.top,            // Pending order price (Limit)
          sl: ob.bottom - buffer,   // SL below OB bottom + ATR buffer
          tp: ob.top + obHeight * 3, // RR 1:3 based on OB height
          orderBlock: ob,
          breachType: "OB_MITIGATION",
          confidence: this.scoreOB(ob, ms),
          reason: `Pending BUY Limit at OB Top ${ob.top.toFixed(5)} (SL: ${(ob.bottom - buffer).toFixed(5)})`,
        };
      }

      // BEARISH OB: pending SELL LIMIT order at OB Bottom
      if (ob.type === "BEARISH") {
        const obHeight = ob.top - ob.bottom;
        return {
          direction: "SELL",
          entry: ob.bottom,         // Pending order price (Limit)
          sl: ob.top + buffer,      // SL above OB top + ATR buffer
          tp: ob.bottom - obHeight * 3, // RR 1:3 based on OB height
          orderBlock: ob,
          breachType: "OB_MITIGATION",
          confidence: this.scoreOB(ob, ms),
          reason: `Pending SELL Limit at OB Bottom ${ob.bottom.toFixed(5)} (SL: ${(ob.top + buffer).toFixed(5)})`,
        };
      }
    }

    return null;
  }

  // ── Breaker Block Entry ────────────────────────────────────────────

  private detectBreakerEntry(fractal: import("./market-structure.service").FractalContext): SMCSignal | null {
    const candles = fractal.entry;
    const ms = fractal.entryStr;
    const smcConfig = strategyConfigService.getSMCConfig();

    if (candles.length < 2 || ms.breakerBlocks.length === 0) return null;

    const last = candles[candles.length - 1];
    const atr = atrService.calculate(candles);
    const avgRange = atr > 0 ? atr : this.avgCandleRange(candles, 5);
    // Proximity sekarang berbasis ATR — configurable (default 1.0 ATR)
    const proximityAtr = smcConfig.breakerProximityAtr ?? 1.0;

    for (const breaker of ms.breakerBlocks) {
      const flipped = breaker.flippedLevel;

      // BULL breaker: price broke above bearish OB → now support
      if (breaker.brokenDirection === "BULL") {
        // Gunakan ATR-based proximity alih-alih % hardcoded
        if (Math.abs(last.close - flipped) < avgRange * proximityAtr) {
          const confidence = Math.min(85, 60 + this.scoreOB({ top: flipped, bottom: flipped - avgRange, type: "BULLISH", mitigated: false } as any, ms));
          return {
            direction: "BUY",
            entry: last.close,
            sl: flipped - avgRange * 1.5,
            tp: last.close + avgRange * 2.5,
            breachType: "BREAKER",
            confidence,
            reason: `Breaker BUY: Former OB flipped to support at ${flipped.toFixed(5)} (within ${proximityAtr}× ATR)`,
          };
        }
      }

      // BEAR breaker: price broke below bullish OB → now resistance
      if (breaker.brokenDirection === "BEAR") {
        if (Math.abs(last.close - flipped) < avgRange * proximityAtr) {
          const confidence = Math.min(85, 60 + this.scoreOB({ top: flipped + avgRange, bottom: flipped, type: "BEARISH", mitigated: false } as any, ms));
          return {
            direction: "SELL",
            entry: last.close,
            sl: flipped + avgRange * 1.5,
            tp: last.close - avgRange * 2.5,
            breachType: "BREAKER",
            confidence,
            reason: `Breaker SELL: Former OB flipped to resistance at ${flipped.toFixed(5)} (within ${proximityAtr}× ATR)`,
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
  private detectLiquidityGrab(fractal: import("./market-structure.service").FractalContext): SMCSignal | null {
    const candles = fractal.entry;
    const ms = fractal.entryStr;

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
