// ─── IPDA Context — Daily Bias, Intraday State, Market Structure ─────
// Pure detection layer for IPDA concepts:
// - Daily Bias (from HTF + previous day/week structure)
// - IPDA State after expansion: retracement / consolidation / reversal
// - Killzone awareness
// - Liquidity sweeps, FVG, Order Block context

import { marketStructureService, type Candle, type MarketStructure, type KillzoneType, type Trend, type FVG, type OrderBlock } from "./market-structure.service";
import { atrService } from "./atr.service";

// ─── Types ───────────────────────────────────────────────────────────

export type DailyBias = "BULLISH" | "BEARISH" | "SIDEWAYS";
export type IPDAState = "EXPANSION_BULL" | "EXPANSION_BEAR" | "RETRACEMENT" | "CONSOLIDATION" | "REVERSAL" | "UNDETERMINED";

export interface DailyBiasAnalysis {
  bias: DailyBias;
  confidence: number;
  previousDay: { high: number; low: number; close: number } | null;
  previousWeek: { high: number; low: number; close: number } | null;
  htfTrend: Trend;
  reason: string;
}

export interface IPDAObservation {
  state: IPDAState;
  confidence: number;
  /** The most recent displacement candle index */
  lastExpansionIndex: number;
  /** The last FVG that confirms the move */
  lastFVG: FVG | null;
  /** The closest Order Block to current price (for retracement entries) */
  closestOB: OrderBlock | null;
  retracementRatio: number; // 0-1 how much of expansion has been retraced
  reason: string;
}

export interface IPDAContext {
  dailyBias: DailyBiasAnalysis;
  intraday: IPDAObservation;
  currentKillzone: KillzoneType;
  marketStructure: MarketStructure;
}

// ─── Service ─────────────────────────────────────────────────────────

class IPDAContextService {
  /** Analyze Daily Bias from HTF candles (H4/D1). */
  analyzeDailyBias(
    htfCandles: Candle[],
    htfStructure: MarketStructure,
  ): DailyBiasAnalysis {
    const last3 = htfCandles.slice(-3);
    if (last3.length < 2) {
      return { bias: "SIDEWAYS", confidence: 0, previousDay: null, previousWeek: null, htfTrend: htfStructure.trend, reason: "Insufficient HTF data" };
    }

    const prevDay = last3[last3.length - 2];
    const current = last3[last3.length - 1];

    const prevDayBody = Math.abs(prevDay.close - prevDay.open);
    const todayBody = Math.abs(current.close - current.open);
    const prevDayRange = prevDay.high - prevDay.low;

    let bullScore = 0;
    let bearScore = 0;

    // 1. Price relative to previous day high/low
    if (current.close > prevDay.high) bullScore += 20;
    if (current.high > prevDay.high) bullScore += 10;
    if (current.close < prevDay.low) bearScore += 20;
    if (current.low < prevDay.low) bearScore += 10;

    // 2. Body comparison
    if (current.close > current.open) bullScore += 15;
    else bearScore += 15;

    // 3. Trend alignment
    if (htfStructure.trend.direction === "BULL") bullScore += 25;
    if (htfStructure.trend.direction === "BEAR") bearScore += 25;

    // 4. Recent swing structure
    const recentHighs = htfStructure.swingHighs.slice(-3);
    const recentLows = htfStructure.swingLows.slice(-3);
    if (recentHighs.length >= 2 && recentHighs[recentHighs.length - 1].price > recentHighs[0].price) bullScore += 15;
    if (recentLows.length >= 2 && recentLows[recentLows.length - 1].price > recentLows[0].price) bullScore += 15;
    if (recentHighs.length >= 2 && recentHighs[recentHighs.length - 1].price < recentHighs[0].price) bearScore += 15;
    if (recentLows.length >= 2 && recentLows[recentLows.length - 1].price < recentLows[0].price) bearScore += 15;

    // 5. Order blocks pointing direction
    const recentOBs = htfStructure.orderBlocks.slice(-5);
    const bullOBs = recentOBs.filter(o => o.type === "BULLISH" && !o.mitigated).length;
    const bearOBs = recentOBs.filter(o => o.type === "BEARISH" && !o.mitigated).length;
    bullScore += bullOBs * 10;
    bearScore += bearOBs * 10;

    const total = bullScore + bearScore;
    const bias: DailyBias = total === 0 ? "SIDEWAYS"
      : bullScore > bearScore * 1.5 ? "BULLISH"
      : bearScore > bullScore * 1.5 ? "BEARISH"
      : "SIDEWAYS";

    const confidence = Math.min(100, Math.round((Math.abs(bullScore - bearScore) / total) * 100));

    const reasons: string[] = [];
    if (bullScore > bearScore) reasons.push(`${bullScore}-${bearScore} bulls`);
    else if (bearScore > bullScore) reasons.push(`${bearScore}-${bullScore} bears`);
    else reasons.push(`balanced ${bullScore}-${bearScore}`);

    if (htfStructure.trend.direction !== "SIDEWAYS") reasons.push(`trend=${htfStructure.trend.direction}`);

    return {
      bias,
      confidence,
      previousDay: { high: prevDay.high, low: prevDay.low, close: prevDay.close },
      previousWeek: null, // would need weekly data
      htfTrend: htfStructure.trend,
      reason: reasons.join(", "),
    };
  }

  /** Classify IPDA intraday state: expansion → (retracement | consolidation | reversal). */
  analyzeIPDAState(
    candles: Candle[],
    structure: MarketStructure,
  ): IPDAObservation {
    const recent = candles.slice(-15);
    if (recent.length < 5) {
      return { state: "UNDETERMINED", confidence: 0, lastExpansionIndex: -1, lastFVG: null, closestOB: null, retracementRatio: 0, reason: "Insufficient data" };
    }

    const last5 = candles.slice(-6, -1);
    const avgRange = atrService.calculate(candles) || 0;
    const last = candles[candles.length - 1];
    const lastRange = last.high - last.low;
    const isDisplacement = avgRange > 0 && lastRange >= avgRange * 1.6;

    // Most recent FVG
    const unfilledFVG = structure.fairValueGaps.slice().reverse().find(f => !f.mitigated);

    // ── Detect the last expansion ───────────────────────────────────
    let expansionIndex = -1;
    let expansionType: "BULL" | "BEAR" | null = null;
    let expansionHigh = 0;
    let expansionLow = 0;

    for (let i = recent.length - 2; i >= 1; i--) {
      const c = recent[i];
      const prevC = recent[i - 1];
      const range = c.high - c.low;
      const avgPrevRange = atrService.calculate(recent.slice(Math.max(0, i - 5), i + 1));
      if (avgPrevRange > 0 && range >= avgPrevRange * 1.6) {
        if (c.close > c.open && c.close > prevC.high) {
          expansionIndex = candles.length - (recent.length - i);
          expansionType = "BULL";
          expansionHigh = c.high;
          expansionLow = Math.min(prevC.low, c.low);
          break;
        }
        if (c.close < c.open && c.close < prevC.low) {
          expansionIndex = candles.length - (recent.length - i);
          expansionType = "BEAR";
          expansionHigh = Math.max(prevC.high, c.high);
          expansionLow = c.low;
          break;
        }
      }
    }

    // ── If no expansion found, just check what's happening ──────────
    if (expansionIndex === -1) {
      if (isDisplacement) {
        return { state: last.close > last.open ? "EXPANSION_BULL" : "EXPANSION_BEAR", confidence: 60, lastExpansionIndex: candles.length - 1, lastFVG: unfilledFVG, closestOB: this.findClosestOB(structure, last.close), retracementRatio: 0, reason: "Curent displacement detected" };
      }
      // Check contraction (decreasing range)
      const ranges = recent.map(c => c.high - c.low);
      const firstAvg = ranges.slice(0, 5).reduce((s, r) => s + r, 0) / 5;
      const lastAvg = ranges.slice(-5).reduce((s, r) => s + r, 0) / 5;
      if (firstAvg > 0 && lastAvg < firstAvg * 0.6) {
        return { state: "CONSOLIDATION", confidence: 55, lastExpansionIndex: -1, lastFVG: unfilledFVG, closestOB: this.findClosestOB(structure, last.close), retracementRatio: 0, reason: "Contracting range (consolidation)" };
      }
      return { state: "UNDETERMINED", confidence: 30, lastExpansionIndex: -1, lastFVG: unfilledFVG, closestOB: this.findClosestOB(structure, last.close), retracementRatio: 0, reason: "No clear IPDA state" };
    }

    // ── Calculate retracement after expansion ──────────────────────
    const postExpansionCandles = candles.slice(expansionIndex + 1);
    const expansionHeight = expansionHigh - expansionLow;

    if (postExpansionCandles.length === 0) {
      return { state: expansionType === "BULL" ? "EXPANSION_BULL" : "EXPANSION_BEAR", confidence: 70, lastExpansionIndex: expansionIndex, lastFVG: unfilledFVG, closestOB: this.findClosestOB(structure, last.close), retracementRatio: 0, reason: `Recent ${expansionType} expansion` };
    }

    // Measure retracement
    let retracement = 0;
    if (expansionType === "BULL") {
      const lowestAfterExpansion = postExpansionCandles.reduce((min, c) => Math.min(min, c.low), Infinity);
      retracement = (expansionHigh - lowestAfterExpansion) / expansionHeight;
    } else {
      const highestAfterExpansion = postExpansionCandles.reduce((max, c) => Math.max(max, c.high), -Infinity);
      retracement = (highestAfterExpansion - expansionLow) / expansionHeight;
    }
    retracement = Math.min(1, Math.max(0, retracement));

    // ── Classify ───────────────────────────────────────────────────
    let state: IPDAState;
    let confidence: number;

    // Check for CHoCH (reversal): price retraced > 80% of expansion
    // OR broke the expansion's starting point
    let chochDetected = false;
    if (expansionType === "BULL") {
      const brokeStart = postExpansionCandles.some(c => c.low < expansionLow);
      if (retracement > 0.8 || brokeStart) chochDetected = true;
    } else {
      const brokeStart = postExpansionCandles.some(c => c.high > expansionHigh);
      if (retracement > 0.8 || brokeStart) chochDetected = true;
    }

    if (chochDetected) {
      // Check if the CHoCH is confirmed by a displacement in the other direction
      const chochConfirmed = postExpansionCandles.slice(-3).some(c => {
        const r = c.high - c.low;
        return r >= avgRange * 1.4 && (
          (expansionType === "BULL" && c.close < c.open) ||
          (expansionType === "BEAR" && c.close > c.open)
        );
      });
      state = "REVERSAL";
      confidence = chochConfirmed ? 75 : 50;
    } else if (retracement >= 0.38 && retracement <= 0.62) {
      // Retracement to optimal zone (38-62%) — likely continuation
      state = "RETRACEMENT";
      confidence = 70;
    } else if (retracement > 0.62 && retracement < 0.8) {
      // Deep retracement — could be reversal or continuation
      // Check for key level/FVG proximity
      const hasNearbyLevel = unfilledFVG && expansionType === "BULL"
        ? last.close >= unfilledFVG.bottom && last.close <= unfilledFVG.top
        : expansionType === "BEAR" && unfilledFVG
          ? last.close <= unfilledFVG.top && last.close >= unfilledFVG.bottom
          : false;
      if (hasNearbyLevel) {
        state = "RETRACEMENT"; // possible continuation from FVG
        confidence = 55;
      } else {
        state = "REVERSAL"; // deep retracement without support
        confidence = 50;
      }
    } else if (retracement < 0.1) {
      // Almost no retracement — still in expansion or consolidation at the top
      // Check if recent candles are small (consolidation)
      const postRanges = postExpansionCandles.map(c => c.high - c.low);
      const avgPost = postRanges.reduce((s, r) => s + r, 0) / postRanges.length;
      if (avgPost < avgRange * 0.6) {
        state = "CONSOLIDATION";
        confidence = 65;
      } else {
        state = "EXPANSION_BULL";
        confidence = 60;
      }
    } else {
      // 10-38% retracement — shallow pullback
      state = "RETRACEMENT";
      confidence = 60;
    }

    // Override: if expansion FVG still unfilled and price at OB, favor retracement
    const closestOB = this.findClosestOB(structure, last.close);
    if (state === "REVERSAL" && unfilledFVG && closestOB) {
      const distanceToFVG = Math.abs(last.close - (unfilledFVG.bottom + unfilledFVG.top) / 2);
      const distanceToOB = Math.abs(last.close - (closestOB.bottom + closestOB.top) / 2);
      if (distanceToFVG < avgRange * 0.5 || distanceToOB < avgRange * 0.3) {
        state = "RETRACEMENT";
        confidence = Math.min(confidence + 15, 70);
      }
    }

    return {
      state,
      confidence,
      lastExpansionIndex: expansionIndex,
      lastFVG: unfilledFVG,
      closestOB,
      retracementRatio: Math.round(retracement * 100) / 100,
      reason: `${state} (${expansionType} expansion, retrace=${(retracement * 100).toFixed(0)}%, conf=${confidence})`,
    };
  }

  /** Build complete IPDA context for strategies. */
  buildContext(
    htfCandles: Candle[],
    htfStructure: MarketStructure,
    entryCandles: Candle[],
    entryStructure: MarketStructure,
    currentTimestamp: number,
  ): IPDAContext {
    const dailyBias = this.analyzeDailyBias(htfCandles, htfStructure);
    const intraday = this.analyzeIPDAState(entryCandles, entryStructure);
    const currentKillzone = marketStructureService.getKillzoneForTimestamp(currentTimestamp);

    return {
      dailyBias,
      intraday,
      currentKillzone,
      marketStructure: entryStructure,
    };
  }

  /** Find the closest unmitigated Order Block to a price level. */
  private findClosestOB(structure: MarketStructure, price: number): OrderBlock | null {
    const active = structure.orderBlocks.filter(o => !o.mitigated);
    if (active.length === 0) return null;

    let closest = active[0];
    let minDist = Infinity;
    for (const ob of active) {
      const mid = (ob.top + ob.bottom) / 2;
      const dist = Math.abs(price - mid);
      if (dist < minDist) {
        minDist = dist;
        closest = ob;
      }
    }
    return closest;
  }
}

export const ipdaContextService = new IPDAContextService();
