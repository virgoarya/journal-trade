// ─── Liquidity Inducement Theorem (LIT) Strategy ────────────────────
// Detects: Liquidity pool clustering, inducement patterns, stop hunts,
//          LIT + Order Block confluence, trap identification.

import { type Candle, type LiquidityZone, type MarketStructure } from "./market-structure.service";
import { atrService } from "./atr.service";

export interface LITSignal {
  direction: "BUY" | "SELL";
  confidence: number;
  entry: number;
  sl: number;
  tp: number;
  liquidityZone: LiquidityZone;
  signalType: "INDUCEMENT" | "STOP_HUNT" | "LIQUIDITY_SWEEP" | "LIT_OB_CONFLUENCE";
  inducementStage?: "APPROACH" | "PULLBACK" | "SWEEP";
  reason: string;
}

export interface LITAnalysis {
  signal: LITSignal | null;
  signals: LITSignal[];
}

// Tolerance for considering price "at" a liquidity zone
const LIQUIDITY_PROXIMITY_PCT = 0.003; // 0.3%

class LITStrategy {
  /**
   * Full LIT analysis.
   */
  analyze(fractal: import("./market-structure.service").FractalContext): LITSignal[] {
    const signals: LITSignal[] = [];

    if (!fractal.isAligned) return signals;

    const candles = fractal.entry;
    const marketStructure = fractal.entryStr;

    // 1. Inducement Pattern
    const inducementSignal = this.detectInducement(candles, marketStructure);
    if (inducementSignal) signals.push(inducementSignal);

    // 2. Stop Hunt
    const stopHuntSignal = this.detectStopHunt(candles, marketStructure);
    if (stopHuntSignal) signals.push(stopHuntSignal);

    // 3. Liquidity Sweep — similar to CRT but from LIT perspective
    const sweepSignal = this.detectLiquiditySweep(candles, marketStructure);
    if (sweepSignal) signals.push(sweepSignal);

    // 4. LIT + OB Confluence — sweep that lands on an order block
    const obSignal = this.detectLITOBConfluence(candles, marketStructure);
    if (obSignal) signals.push(obSignal);

    return signals.sort((a, b) => b.confidence - a.confidence);
  }

  // ── Inducement Pattern ─────────────────────────────────────────────

  /**
   * Inducement = price moves TOWARD a liquidity zone, pauses / pulls back
   * (inducing traders to fade), then sweeps through it.
   *
   * We detect this in 3 stages:
   *   APPROACH: price moving toward a known liquidity zone
   *   PULLBACK: price reversed from the zone
   *   SWEEP: price swept through the zone and reversed
   *
   * For live detection, we check if the last 2 candles show an approach
   + pullback pattern near a liquidity zone.
   */
  private detectInducement(candles: Candle[], ms: MarketStructure): LITSignal | null {
    if (candles.length < 3 || ms.liquidityZones.length === 0) return null;

    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    const preprev = candles[candles.length - 3];
    const atr = atrService.calculate(candles);
    const avgRange = atr > 0 ? atr : this.avgRange(candles, 5);

    for (const zone of ms.liquidityZones) {
      if (zone.swept) continue; // already swept

      // BUY-SIDE zone (stops above swing highs)
      if (zone.type === "BUY_SIDE") {
        // Approach + pullback: candle1 moved toward zone, candle2 pulled back
        const approached = prev.high >= zone.price * (1 - LIQUIDITY_PROXIMITY_PCT);
        const pulledBack = last.close < prev.close && last.close < zone.price;
        const notTooFar = Math.abs(last.close - zone.price) / zone.price < avgRange * 2 / zone.price;

        if (approached && pulledBack && notTooFar) {
          return {
            direction: "SELL",
            entry: last.close,
            sl: zone.price + avgRange * 0.5,
            tp: last.close - avgRange * 2.0,
            liquidityZone: zone,
            signalType: "INDUCEMENT",
            inducementStage: "PULLBACK",
            confidence: 68,
            reason: `LIT Inducement SELL: Price approached buy-side liquidity @ ${zone.price.toFixed(5)} (density ${zone.density}), now pulling back`,
          };
        }
      }

      // SELL-SIDE zone (stops below swing lows)
      if (zone.type === "SELL_SIDE") {
        const approached = prev.low <= zone.price * (1 + LIQUIDITY_PROXIMITY_PCT);
        const pulledBack = last.close > prev.close && last.close > zone.price;
        const notTooFar = Math.abs(last.close - zone.price) / zone.price < avgRange * 2 / zone.price;

        if (approached && pulledBack && notTooFar) {
          return {
            direction: "BUY",
            entry: last.close,
            sl: zone.price - avgRange * 0.5,
            tp: last.close + avgRange * 2.0,
            liquidityZone: zone,
            signalType: "INDUCEMENT",
            inducementStage: "PULLBACK",
            confidence: 68,
            reason: `LIT Inducement BUY: Price approached sell-side liquidity @ ${zone.price.toFixed(5)} (density ${zone.density}), now pulling back`,
          };
        }
      }
    }

    return null;
  }

  // ── Stop Hunt ──────────────────────────────────────────────────────

  /**
   * A sharp wick through a liquidity zone with immediate reversal.
   * Price breaches the zone (taking out stops), then reverses within
   * 1–2 candles. This is a "done" inducement.
   */
  private detectStopHunt(candles: Candle[], ms: MarketStructure): LITSignal | null {
    if (candles.length < 2 || ms.liquidityZones.length === 0) return null;

    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    const atr = atrService.calculate(candles);
    const avgRange = atr > 0 ? atr : this.avgRange(candles, 5);

    for (const zone of ms.liquidityZones) {
      if (zone.swept) continue;

      // BUY-SIDE zone stop hunt: wick above zone, close back below
      if (zone.type === "BUY_SIDE") {
        if (prev.high > zone.price && last.close < zone.price) {
          return {
            direction: "SELL",
            entry: last.close,
            sl: zone.price + avgRange * 0.5,
            tp: last.close - avgRange * 2.5,
            liquidityZone: { ...zone, swept: true },
            signalType: "STOP_HUNT",
            confidence: 78,
            reason: `LIT Stop Hunt SELL: Price swept buy-side liquidity @ ${zone.price.toFixed(5)}, now reversing`,
          };
        }
      }

      // SELL-SIDE zone stop hunt: wick below zone, close back above
      if (zone.type === "SELL_SIDE") {
        if (prev.low < zone.price && last.close > zone.price) {
          return {
            direction: "BUY",
            entry: last.close,
            sl: zone.price - avgRange * 0.5,
            tp: last.close + avgRange * 2.5,
            liquidityZone: { ...zone, swept: true },
            signalType: "STOP_HUNT",
            confidence: 78,
            reason: `LIT Stop Hunt BUY: Price swept sell-side liquidity @ ${zone.price.toFixed(5)}, now reversing`,
          };
        }
      }
    }

    return null;
  }

  // ── Liquidity Sweep ────────────────────────────────────────────────

  /**
   * Price moves through a liquidity zone with momentum but the move
   * fails to sustain — the liquidity was "taken" but price didn't
   * continue.
   */
  private detectLiquiditySweep(candles: Candle[], ms: MarketStructure): LITSignal | null {
    if (candles.length < 2 || ms.liquidityZones.length === 0) return null;

    const last = candles[candles.length - 1];
    const atr = atrService.calculate(candles);
    const avgRange = atr > 0 ? atr : this.avgRange(candles, 5);

    for (const zone of ms.liquidityZones) {
      if (zone.swept) continue;

      if (zone.type === "BUY_SIDE") {
        // Wick above the zone — liquidity taken
        if (last.high > zone.price && last.close < zone.price) {
          return {
            direction: "SELL",
            entry: last.close,
            sl: zone.price + avgRange * 0.3,
            tp: last.close - avgRange * 2.0,
            liquidityZone: { ...zone, swept: true },
            signalType: "LIQUIDITY_SWEEP",
            confidence: 70,
            reason: `LIT Sweep SELL: Buy-side liquidity swept @ ${zone.price.toFixed(5)}, rejection`,
          };
        }
      }

      if (zone.type === "SELL_SIDE") {
        if (last.low < zone.price && last.close > zone.price) {
          return {
            direction: "BUY",
            entry: last.close,
            sl: zone.price - avgRange * 0.3,
            tp: last.close + avgRange * 2.0,
            liquidityZone: { ...zone, swept: true },
            signalType: "LIQUIDITY_SWEEP",
            confidence: 70,
            reason: `LIT Sweep BUY: Sell-side liquidity swept @ ${zone.price.toFixed(5)}, rejection`,
          };
        }
      }
    }

    return null;
  }

  // ── LIT + OB Confluence ────────────────────────────────────────────

  /**
   * The strongest LIT setup: a liquidity sweep that lands directly on
   * an Order Block for the reversal.
   */
  private detectLITOBConfluence(candles: Candle[], ms: MarketStructure): LITSignal | null {
    if (candles.length < 2 || ms.liquidityZones.length === 0) return null;

    const last = candles[candles.length - 1];

    for (const zone of ms.liquidityZones) {
      if (zone.swept) continue;

      // BUY-SIDE liquidity taken + price lands on a bullish OB below
      if (zone.type === "BUY_SIDE") {
        if (last.high > zone.price && last.close < zone.price) {
          // Check if there's a bullish OB near current price
          const nearbyOB = ms.orderBlocks.find(
            (ob) =>
              ob.type === "BULLISH" &&
              last.close >= ob.bottom &&
              last.close <= ob.top,
          );

          if (nearbyOB) {
            return {
              direction: "BUY",
              entry: last.close,
              sl: nearbyOB.bottom - (nearbyOB.top - nearbyOB.bottom) * 0.5,
              tp: last.close + (zone.price - last.close) * 2,
              liquidityZone: zone,
              signalType: "LIT_OB_CONFLUENCE",
              confidence: 85,
              reason: `LIT+OB Confluence BUY: Liquidity swept @ ${zone.price.toFixed(5)} on bullish OB [${nearbyOB.bottom.toFixed(5)}-${nearbyOB.top.toFixed(5)}]`,
            };
          }
        }
      }

      // SELL-SIDE liquidity taken + price lands on bearish OB above
      if (zone.type === "SELL_SIDE") {
        if (last.low < zone.price && last.close > zone.price) {
          const nearbyOB = ms.orderBlocks.find(
            (ob) =>
              ob.type === "BEARISH" &&
              last.close >= ob.bottom &&
              last.close <= ob.top,
          );

          if (nearbyOB) {
            return {
              direction: "SELL",
              entry: last.close,
              sl: nearbyOB.top + (nearbyOB.top - nearbyOB.bottom) * 0.5,
              tp: last.close - (last.close - zone.price) * 2,
              liquidityZone: zone,
              signalType: "LIT_OB_CONFLUENCE",
              confidence: 85,
              reason: `LIT+OB Confluence SELL: Liquidity swept @ ${zone.price.toFixed(5)} on bearish OB [${nearbyOB.bottom.toFixed(5)}-${nearbyOB.top.toFixed(5)}]`,
            };
          }
        }
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

export const litStrategy = new LITStrategy();
