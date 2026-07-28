// ─── Smart Money Concept (SMC) Strategy ─────────────────────────────
// Detects: Market Structure Shifts (MSS), Order Blocks, Breaker Blocks,
//          Liquidity Grabs, and Change of Character (CHOCH).

import { marketStructureService, type Candle, type MarketStructure, type OrderBlock } from "./market-structure.service";
import { atrService } from "./atr.service";
import { strategyConfigService } from "./strategy-config.service";
import type { ChecklistItem } from "./confluence-engine";
import type { IPDAContext } from "./ipda-context";
import { evaluateWaterfall, calculateRR, checkEntryRetest, getSwingPrices, analyzeDaily3CandleBias } from "./checklist-validator";

export interface SMCSignal {
  direction: "BUY" | "SELL";
  entry: number;
  sl: number;
  tp: number;
  orderBlock?: OrderBlock;
  h1OrderBlock?: OrderBlock;
  breachType: "MSS" | "CHOCH" | "OB_MITIGATION" | "BREAKER" | "LIQUIDITY_GRAB" | "M5_CHOCH_OB";
  confidence: number;
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

    // 0. M5 Confirmation Entry after Retest H1 OB (highest priority refinement entry)
    const m5ConfirmSignal = this.detectM5ConfirmationEntry(fractal);
    if (m5ConfirmSignal) signals.push(m5ConfirmSignal);

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
      }
    }

    // Filter out signals with R:R < 1:2 (RR < 2.0)
    // Recalculate dynamic TP based on HTF structure to maximize R:R
    const htfStr = fractal.directionStr || fractal.dailyStr;
    const validSignals = signals.filter(sig => {
      // Find dynamic target
      sig.tp = marketStructureService.findDynamicTarget(sig.direction, sig.entry, sig.sl, htfStr, 2.0);
      
      const slDist = Math.abs(sig.entry - sig.sl);
      const tpDist = Math.abs(sig.tp - sig.entry);
      if (slDist <= 0) return false;
      const rr = tpDist / slDist;
      return rr >= 2.0;
    });

    // ── Generate Checklist Items ───────────────────────────────────────────
    for (let i = validSignals.length - 1; i >= 0; i--) {
      const sig = validSignals[i];
      const validation = this.buildSMCChecklist(sig, fractal);
      sig.checklistItems = validation.items;
      
      // Strict Validation: Drop signal if any core step failed
      if (sig.confidence > 0 && !validation.passed) {
        validSignals.splice(i, 1);
      }
    }

    if (validSignals.length === 0) {
      const dummyDir = htfStr.trend.direction === "BULL" ? "BUY" : "SELL";
      const dummySig: SMCSignal = {
        direction: dummyDir,
        confidence: 0,
        entry: 0,
        sl: 0,
        tp: 0,
        breachType: "MSS",
        reason: "Scanning for setups...",
        checklistItems: []
      };
      const validation = this.buildSMCChecklist(dummySig, fractal);
      dummySig.checklistItems = validation.items;
      validSignals.push(dummySig);
    }

    return validSignals.sort((a, b) => b.confidence - a.confidence);
  }

  private buildSMCChecklist(sig: SMCSignal, fractal: import("./market-structure.service").FractalContext): { items: ChecklistItem[], passed: boolean } {
    const isBuy = sig.direction === "BUY";
    const htfStr = fractal.directionStr || fractal.dailyStr;
    const isHtfBosConfirmed = isBuy ? htfStr.trend.direction === "BULL" : htfStr.trend.direction === "BEAR";
    const dailyBias = analyzeDaily3CandleBias(fractal.daily || fractal.direction);

    const { rrRatio, isRRValid } = calculateRR(sig.entry, sig.sl, sig.tp);
    const entryTfLabel = fractal.entryTimeframeStr || "M15";
    const setupTfLabel = fractal.setupTimeframeStr || "H1";
    const htfTfLabel = fractal.directionTimeframeStr || "H4";

    const { relHigh, relLow } = getSwingPrices(fractal);

    const lastCandle = fractal.entry && fractal.entry.length > 0 ? fractal.entry[fractal.entry.length - 1] : null;
    const currentPrice = lastCandle ? lastCandle.close : 0;
    const isEntryRetested = checkEntryRetest(currentPrice, sig.entry, isBuy);

    const obTop = sig.orderBlock ? sig.orderBlock.top.toFixed(5) : "N/A";
    const obBottom = sig.orderBlock ? sig.orderBlock.bottom.toFixed(5) : "N/A";

    const isDailyAligned = isBuy ? dailyBias.direction === "BULL" : dailyBias.direction === "BEAR";

    const obSweepPrice = sig.orderBlock?.sweepPrice ? sig.orderBlock.sweepPrice.toFixed(5) : relLow;
    const obChochPrice = sig.orderBlock?.chochPrice ? sig.orderBlock.chochPrice.toFixed(5) : relHigh;
    const pdArrayType = isBuy ? "Discount PD Array" : "Premium PD Array";

    return evaluateWaterfall([
      {
        id: "smc-daily",
        label: () => dailyBias.label,
        timeframe: "D1",
        condition: isDailyAligned || dailyBias.direction === "SIDEWAYS",
        isIndependent: true,
        details: () => dailyBias.details,
      },
      {
        id: "smc-bos",
        label: () => `① ${htfTfLabel} Market Structure : ${isHtfBosConfirmed ? (isBuy ? "Bullish CHoCH/BOS" : "Bearish CHoCH/BOS") : "Unconfirmed"} (High ${relHigh}, Low ${relLow})`,
        timeframe: htfTfLabel,
        condition: isHtfBosConfirmed,
        isFailable: true,
      },
      {
        id: "smc-liq",
        label: () => `② ${isBuy ? "Sell-Side Liquidity (SSL)" : "Buy-Side Liquidity (BSL)"} Swept @ ${obSweepPrice}`,
        timeframe: setupTfLabel,
        condition: (fractal.directionStr.liquidityZones?.length ?? 0) > 0 || (sig.orderBlock?.hasSweep ?? false),
        details: () => `Liquidity sweep confirmed at ${obSweepPrice}`,
      },
      {
        id: "smc-ob",
        label: (status) => {
          if (sig.h1OrderBlock) {
            return `③ Retest H1 ${sig.direction === "BUY" ? "Bullish" : "Bearish"} Order Block (H1 POI : ${sig.h1OrderBlock.bottom.toFixed(5)} - ${sig.h1OrderBlock.top.toFixed(5)})`;
          }
          return status === "PASSED" && sig.orderBlock
            ? `③ ${htfTfLabel} ${isBuy ? "Bullish" : "Bearish"} Order Block (${pdArrayType} : ${obBottom} - ${obTop}) [Displacement + CHoCH]`
            : `③ ${htfTfLabel} ${isBuy ? "Bullish" : "Bearish"} Order Block (${pdArrayType} detection zone)`;
        },
        timeframe: htfTfLabel,
        condition: !!(sig.orderBlock || sig.h1OrderBlock || sig.breachType === "OB_MITIGATION"),
        value: (status) => status === "PASSED" && sig.h1OrderBlock ? `${sig.h1OrderBlock.bottom.toFixed(5)} - ${sig.h1OrderBlock.top.toFixed(5)}` : (status === "PASSED" && sig.orderBlock ? `${obBottom} - ${obTop}` : undefined),
        details: (status) => status === "PASSED" && sig.orderBlock?.hasCHOCH ? `Displacement candle created CHoCH at ${obChochPrice}` : undefined,
      },
      {
        id: "smc-mss",
        label: (status) => {
          if (sig.breachType === "M5_CHOCH_OB" && sig.orderBlock) {
            return `④ ${entryTfLabel} CHoCH Confirmation & M5 OB Zone (Refinement : ${sig.orderBlock.bottom.toFixed(5)} - ${sig.orderBlock.top.toFixed(5)})`;
          }
          return status === "PASSED"
            ? `④ ${entryTfLabel} CHoCH Confirmation (Breakout above Swing Level ${obChochPrice})`
            : `④ ${entryTfLabel} CHoCH Confirmation after PD Array mitigation`;
        },
        timeframe: entryTfLabel,
        condition: sig.breachType === "MSS" || sig.breachType === "CHOCH" || sig.breachType === "M5_CHOCH_OB" || (sig.orderBlock?.hasCHOCH ?? false),
      },
      {
        id: "smc-entry-rejection",
        label: () => sig.breachType === "M5_CHOCH_OB"
          ? `⑤ Pending ${sig.direction} Limit Order @ M5 OB ${sig.direction === "BUY" ? "Top" : "Bottom"} (${sig.entry.toFixed(5)}) — Target ${sig.direction === "BUY" ? "PDH" : "PDL"} (${sig.tp.toFixed(5)})`
          : `⑤ Retest ${pdArrayType} Zone (Pending ${sig.direction} Limit Order @ ${sig.entry.toFixed(5)})`,
        timeframe: entryTfLabel,
        condition: sig.breachType === "M5_CHOCH_OB" ? true : isEntryRetested,
        details: (status) => `Pending ${sig.direction} Limit Order at ${sig.entry.toFixed(5)} (Target: ${sig.tp.toFixed(5)})`,
      },
      {
        id: "smc-rr",
        label: (status) => `⑥ Minimum Risk-to-Reward 1:2 ${status === "PASSED" ? "terpenuhi" : "belum terpenuhi"}`,
        condition: isRRValid,
        isFailable: true,
        details: (status) => status === "PASSED" ? `R:R 1:${rrRatio.toFixed(2)} | SL: ${sig.sl.toFixed(5)} | TP: ${sig.tp.toFixed(5)}` : `Menunggu titik entry tervalidasi`,
      },
    ]);
  }


  // ── M5 Confirmation Entry after Retest H1 OB ───────────────────────

  /**
   * M5 Refinement Entry (H1 POI -> Retest -> M5 CHoCH + M5 OB Limit Entry -> Target PDH/PDL)
   */
  private detectM5ConfirmationEntry(fractal: import("./market-structure.service").FractalContext): SMCSignal | null {
    const htfStr = fractal.directionStr || fractal.dailyStr; // H1 structure
    const m5Str = fractal.entryStr;                          // M5 structure
    const m5Candles = fractal.entry;
    if (!htfStr || !m5Str || m5Candles.length < 3) return null;

    const atrM5 = atrService.calculate(m5Candles);
    const avgRange = atrM5 > 0 ? atrM5 : this.avgCandleRange(m5Candles, 5);
    const dailyBias = analyzeDaily3CandleBias(fractal.daily || fractal.direction);

    // Scan H1 Order Blocks
    const h1Blocks = htfStr.orderBlocks || [];
    if (h1Blocks.length === 0) return null;

    const recentM5 = m5Candles.slice(-20);
    const lowestM5 = Math.min(...recentM5.map((c) => c.low));
    const highestM5 = Math.max(...recentM5.map((c) => c.high));

    for (const h1OB of h1Blocks) {
      // ── BULLISH M5 CONFIRMATION ENTRY ──
      if (h1OB.type === "BULLISH") {
        // Price must have retested H1 OB zone
        const retestedH1OB = lowestM5 <= h1OB.top + avgRange * 1.5 && lowestM5 >= h1OB.bottom - avgRange * 2.0;
        if (!retestedH1OB) continue;

        // Find active M5 Bullish Order Blocks formed in recent M5 candles
        let m5OB = m5Str.orderBlocks.find((ob) => ob.type === "BULLISH" && (ob.hasCHOCH || ob.isImpulsive));
        if (!m5OB && m5Str.orderBlocks.length > 0) {
          m5OB = m5Str.orderBlocks.filter((ob) => ob.type === "BULLISH").pop();
        }

        const entry = m5OB ? m5OB.top : h1OB.top;
        const sl = m5OB ? m5OB.bottom - avgRange * 0.5 : h1OB.bottom - avgRange * 0.5;
        const targetPDH = dailyBias.pdh > entry ? dailyBias.pdh : entry + (entry - sl) * 3;

        return {
          direction: "BUY",
          entry,
          sl,
          tp: targetPDH,
          orderBlock: m5OB || h1OB,
          h1OrderBlock: h1OB,
          breachType: "M5_CHOCH_OB",
          confidence: 90, // High confidence refinement entry
          reason: `Retest H1 OB (${h1OB.bottom.toFixed(5)}-${h1OB.top.toFixed(5)}) + M5 Confirmation -> Pending BUY Limit @ ${entry.toFixed(5)} [Target PDH: ${targetPDH.toFixed(5)}]`,
        };
      }

      // ── BEARISH M5 CONFIRMATION ENTRY ──
      if (h1OB.type === "BEARISH") {
        const retestedH1OB = highestM5 >= h1OB.bottom - avgRange * 1.5 && highestM5 <= h1OB.top + avgRange * 2.0;
        if (!retestedH1OB) continue;

        let m5OB = m5Str.orderBlocks.find((ob) => ob.type === "BEARISH" && (ob.hasCHOCH || ob.isImpulsive));
        if (!m5OB && m5Str.orderBlocks.length > 0) {
          m5OB = m5Str.orderBlocks.filter((ob) => ob.type === "BEARISH").pop();
        }

        const entry = m5OB ? m5OB.bottom : h1OB.bottom;
        const sl = m5OB ? m5OB.top + avgRange * 0.5 : h1OB.top + avgRange * 0.5;
        const targetPDL = dailyBias.pdl < entry ? dailyBias.pdl : entry - (sl - entry) * 3;

        return {
          direction: "SELL",
          entry,
          sl,
          tp: targetPDL,
          orderBlock: m5OB || h1OB,
          h1OrderBlock: h1OB,
          breachType: "M5_CHOCH_OB",
          confidence: 90, // High confidence refinement entry
          reason: `Retest H1 OB (${h1OB.bottom.toFixed(5)}-${h1OB.top.toFixed(5)}) + M5 Confirmation -> Pending SELL Limit @ ${entry.toFixed(5)} [Target PDL: ${targetPDL.toFixed(5)}]`,
        };
      }
    }

    return null;
  }

  // ── Market Structure Shift ─────────────────────────────────────────

  /**
   * MSS = price breaks a recent swing point (BOS = Break of Structure)
   * with momentum. CHOCH = the first break after a trend.
   *
   * BUY MSS: price breaks above recent swing high with momentum
   * SELL MSS: price breaks below recent swing low with momentum
   */
  // Helper to check HTF context (Liquidity Sweep or OB Mitigation)
  private hasHTFContext(fractal: import("./market-structure.service").FractalContext, dir: "BUY" | "SELL"): boolean {
    const htf = fractal.directionStr || fractal.dailyStr;
    if (!htf) return true;
    const lzType = dir === "BUY" ? "SELL_SIDE" : "BUY_SIDE";
    const obType = dir === "BUY" ? "BULLISH" : "BEARISH";

    const lastCandle = fractal.entry && fractal.entry.length > 0 ? fractal.entry[fractal.entry.length - 1] : null;
    const currentPrice = lastCandle ? lastCandle.close : 0;
    const atr = this.avgCandleRange(fractal.entry || [], 5);
    
    const hasSweep = htf.liquidityZones.some(lz => lz.type === lzType && lz.swept);
    const hasOBMitigation = htf.orderBlocks.some(ob => 
      ob.type === obType && (
        ob.touchCount > 0 || 
        (currentPrice > 0 && currentPrice >= ob.bottom - atr * 2.0 && currentPrice <= ob.top + atr * 2.0)
      )
    );
    
    const hasAnyHTFPOI = (htf.orderBlocks?.length ?? 0) > 0 || (htf.liquidityZones?.length ?? 0) > 0;
    if (!hasAnyHTFPOI) return true;

    return hasSweep || hasOBMitigation;
  }

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
        if (bodyBottom > swing.price && this.hasHTFContext(fractal, "BUY")) {
          const sl = swing.price - buffer;
          const tp = swing.price + buffer * 3.0;
          if (marketStructureService.isTargetTakenBeforeEntry(entryCandles, swing.index, "BUY", tp, fractal)) continue;

          return {
            direction: "BUY",
            entry: swing.price, // Pending BUY Limit on retest
            sl, // SL 1× ATR below broken structure
            tp, // RR 1:3 (Temporary, dynamic TP is calculated later)
            breachType: "MSS",
            confidence: this.scoreMSS(ms, swing, last, avgRangeEntry, "BUY") + 15, // Boost for HTF context
            reason: `HTF Context + Pending BUY Limit at MSS retest ${swing.price.toFixed(5)} (SL: ${sl.toFixed(5)})`,
          };
        }
      }
    }

    // Look for a swing low broken downward
    const recentLows = ms.swingLows.filter((s) => s.index >= candles.length - 10);
    for (const swing of recentLows) {
      if (last.close < swing.price && last.low < swing.price) {
        const bodyTop = Math.max(last.open, last.close);
        if (bodyTop < swing.price && this.hasHTFContext(fractal, "SELL")) {
          const sl = swing.price + buffer;
          const tp = swing.price - buffer * 3.0;
          if (marketStructureService.isTargetTakenBeforeEntry(entryCandles, swing.index, "SELL", tp, fractal)) continue;

          return {
            direction: "SELL",
            entry: swing.price, // Pending SELL Limit on retest
            sl, // SL 1× ATR above broken structure
            tp, // RR 1:3 (Temporary, dynamic TP is calculated later)
            breachType: "MSS",
            confidence: this.scoreMSS(ms, swing, last, avgRangeEntry, "SELL") + 15,
            reason: `HTF Context + Pending SELL Limit at MSS retest ${swing.price.toFixed(5)} (SL: ${sl.toFixed(5)})`,
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
        if (!this.hasHTFContext(fractal, "BUY")) continue;

        const obHeight = ob.top - ob.bottom;
        const tp = ob.top + obHeight * 3;
        const sl = ob.bottom - buffer;
        if (marketStructureService.isTargetTakenBeforeEntry(candles, ob.index, "BUY", tp, fractal)) continue;

        return {
          direction: "BUY",
          entry: ob.top,            // Pending order price (Limit)
          sl,   // SL below OB bottom + ATR buffer
          tp, // RR 1:3 based on OB height
          orderBlock: ob,
          breachType: "OB_MITIGATION",
          confidence: this.scoreOB(ob, ms),
          reason: `Pending BUY Limit at OB Top ${ob.top.toFixed(5)} (SL: ${sl.toFixed(5)})`,
        };
      }

      // BEARISH OB: pending SELL LIMIT order at OB Bottom
      if (ob.type === "BEARISH") {
        if (!this.hasHTFContext(fractal, "SELL")) continue;

        const obHeight = ob.top - ob.bottom;
        const tp = ob.bottom - obHeight * 3;
        const sl = ob.top + buffer;
        if (marketStructureService.isTargetTakenBeforeEntry(candles, ob.index, "SELL", tp, fractal)) continue;

        return {
          direction: "SELL",
          entry: ob.bottom,         // Pending order price (Limit)
          sl,      // SL above OB top + ATR buffer
          tp, // RR 1:3 based on OB height
          orderBlock: ob,
          breachType: "OB_MITIGATION",
          confidence: this.scoreOB(ob, ms),
          reason: `Pending SELL Limit at OB Bottom ${ob.bottom.toFixed(5)} (SL: ${sl.toFixed(5)})`,
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
        if (!this.hasHTFContext(fractal, "BUY")) continue;

        // Gunakan ATR-based proximity alih-alih % hardcoded
        if (Math.abs(last.close - flipped) < avgRange * proximityAtr) {
          const confidence = Math.min(85, 60 + this.scoreOB({ top: flipped, bottom: flipped - avgRange, type: "BULLISH", mitigated: false } as any, ms));
          const sl = flipped - avgRange * 1.5;
          const tp = last.close + avgRange * 2.5;
          if (marketStructureService.isTargetTakenBeforeEntry(candles, breaker.orderBlock.index, "BUY", tp, fractal)) continue;

          return {
            direction: "BUY",
            entry: last.close,
            sl,
            tp,
            breachType: "BREAKER",
            confidence,
            reason: `Breaker BUY: Former OB flipped to support at ${flipped.toFixed(5)} (within ${proximityAtr}× ATR)`,
          };
        }
      }

      // BEAR breaker: price broke below bullish OB → now resistance
      if (breaker.brokenDirection === "BEAR") {
        if (!this.hasHTFContext(fractal, "SELL")) continue;

        if (Math.abs(last.close - flipped) < avgRange * proximityAtr) {
          const confidence = Math.min(85, 60 + this.scoreOB({ top: flipped + avgRange, bottom: flipped, type: "BEARISH", mitigated: false } as any, ms));
          const sl = flipped + avgRange * 1.5;
          const tp = last.close - avgRange * 2.5;
          if (marketStructureService.isTargetTakenBeforeEntry(candles, breaker.orderBlock.index, "SELL", tp, fractal)) continue;

          return {
            direction: "SELL",
            entry: last.close,
            sl,
            tp,
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
        const sl = prev.high + avgRange * 0.5;
        const tp = last.close - avgRange * 2.0;
        if (marketStructureService.isTargetTakenBeforeEntry(candles, swing.index, "SELL", tp, fractal)) continue;

        return {
          direction: "SELL",
          entry: last.close,
          sl,
          tp,
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
        const sl = prev.low - avgRange * 0.5;
        const tp = last.close + avgRange * 2.0;
        if (marketStructureService.isTargetTakenBeforeEntry(candles, swing.index, "BUY", tp, fractal)) continue;

        return {
          direction: "BUY",
          entry: last.close,
          sl,
          tp,
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

    if (ob.hasCHOCH) score += 15; // Pure SMC Reversal CHoCH created by displacement
    if (ob.hasSweep) score += 15; // SSL/BSL Liquidity Sweep
    if (ob.displacementFVG) score += 10; // Displacement Fair Value Gap

    // Trend alignment
    if (ob.type === "BULLISH" && ms.trend.direction === "BULL") score += 10;
    if (ob.type === "BEARISH" && ms.trend.direction === "BEAR") score += 10;

    return Math.min(95, Math.max(MIN_CONFIDENCE, score));
  }

  private avgCandleRange(candles: Candle[], period: number): number {
    const recent = candles.slice(-period);
    if (recent.length === 0) return 0;
    return recent.reduce((s, c) => s + (c.high - c.low), 0) / recent.length;
  }
}

export const smcStrategy = new SMCStrategy();
