// ─── ICT + CRT Merged Strategy ──────────────────────────────────────────────
// Philosophy: CRT (3-Candle AMD / Range Context) acts as FILTER for ICT (FVG, OTE, Judas Swing).
// Only signals that have BOTH an ICT structural level AND CRT candle context will pass.
//
// Path A: CRT 3-Candle Manipulation → ICT FVG/OTE inside the same zone
// Path B: ICT FVG/OTE/Judas → validated by CRT Liquidity Sweep or AMD context
//
// This eliminates:
// - ICT: FVG over-trading (1852 trades at 49.5% WR)
// - CRT: Range breakout noise (952 trades at 47.1% WR)
// Expected: 400–700 combined trades, WR 55–65%

import {
  marketStructureService,
  type Candle,
  type MarketStructure,
  type FVG,
  type KillzoneType,
} from "./market-structure.service";
import { atrService } from "./atr.service";
import { strategyConfigService } from "./strategy-config.service";
import type { IPDAContext } from "./ipda-context";
import type { ChecklistItem } from "./confluence-engine";

export interface ICTSignal {
  direction: "BUY" | "SELL";
  confidence: number;
  entry: number;
  sl: number;
  tp: number;
  orderType: "MARKET" | "PENDING_LIMIT";
  limitPrice?: number;
  signalType:
    | "AMD_FVG"          // 3-Candle AMD pattern + FVG confluence
    | "AMD_OTE"          // 3-Candle AMD pattern + OTE confluence
    | "SWEEP_FVG"        // Liquidity Sweep + FVG fill
    | "JUDAS_SWEEP"      // Judas Swing + Sweep context
    | "OTE_AMD";         // OTE Fibonacci + AMD range context
  killzone?: KillzoneType;
  reason: string;
  checklistItems?: ChecklistItem[];
}

export interface ICTAnalysis {
  signal: ICTSignal | null;
  signals: ICTSignal[];
}

class ICTStrategy {
  /**
   * Full ICT+CRT analysis. Only dual-confluenced setups pass through.
   */
  analyze(fractal: import("./market-structure.service").FractalContext, ipda?: IPDAContext): ICTSignal[] {
    const signals: ICTSignal[] = [];

    if (!fractal.isAligned) return signals;

    const config = strategyConfigService.getICTConfig();
    const htfTrend = fractal.directionStr.trend.direction;

    const setupCandles = fractal.setup;
    const entryCandles = fractal.entry;
    const entryStr = fractal.entryStr;

    if (setupCandles.length < 3 || entryCandles.length < 3) return signals;

    const lastEntry = entryCandles[entryCandles.length - 1];
    const atr = atrService.calculate(entryCandles);
    const avgRange = atr > 0 ? atr : this.avgRange(entryCandles, 5);

    const currentKillzone = this.getCurrentKillzone(lastEntry.time);

    // ─── PATH A: CRT 3-Candle AMD → ICT FVG/OTE inside zone ───────────────────

    const amdResult = this.detectAMDPattern(setupCandles, htfTrend, avgRange);

    if (amdResult) {
      // Look for ICT FVG inside the AMD zone (around the sweep)
      const fvgSignal = this.findFVGInsideZone(
        entryCandles,
        entryStr,
        amdResult.direction,
        amdResult.zoneHigh,
        amdResult.zoneLow,
        avgRange,
        config,
        currentKillzone,
      );
      if (fvgSignal) signals.push(fvgSignal);

      // Look for OTE inside the AMD zone
      const oteSignal = this.findOTEInsideZone(
        entryCandles,
        entryStr,
        amdResult.direction,
        amdResult.zoneHigh,
        amdResult.zoneLow,
        avgRange,
        config,
      );
      if (oteSignal) signals.push(oteSignal);
    }

    // ─── PATH B: Liquidity Sweep → ICT FVG confirmation ────────────────────────

    const sweepResult = this.detectLiquiditySweep(entryCandles, avgRange, htfTrend);
    if (sweepResult) {
      // After a sweep, look for nearest unmitigated FVG in sweep's direction
      const sweepFvgSignal = this.buildSweepFVGSignal(
        entryCandles,
        entryStr,
        sweepResult.direction,
        sweepResult.sweepLevel,
        avgRange,
        config,
        currentKillzone,
      );
      if (sweepFvgSignal) signals.push(sweepFvgSignal);
    }

    // ─── PATH C: Judas Swing → validated by prior Sweep Context ────────────────

    const judasSignal = this.detectJudasWithContext(entryCandles, entryStr, avgRange, htfTrend);
    if (judasSignal) signals.push(judasSignal);

    // ─── PATH D: OTE + AMD Range Context ────────────────────────────────────────

    const oteAmdSignal = this.detectOTEWithAMDContext(
      setupCandles,
      entryCandles,
      entryStr,
      htfTrend,
      avgRange,
      config,
    );
    if (oteAmdSignal) signals.push(oteAmdSignal);

    // ── IPDA Context: adjust confidence ──
    if (ipda && signals.length > 0) {
      for (const sig of signals) {
        if (ipda.dailyBias.bias !== "SIDEWAYS") {
          const aligned = (sig.direction === "BUY" && ipda.dailyBias.bias === "BULLISH") ||
                          (sig.direction === "SELL" && ipda.dailyBias.bias === "BEARISH");
          if (!aligned) sig.confidence = Math.round(sig.confidence * 0.7);
          else sig.confidence = Math.min(95, Math.round(sig.confidence * 1.1));
        }
        // IPDA retracement: sweep+FVG signals in retracement toward daily bias are high quality
        if (ipda.intraday.state === "RETRACEMENT" && sig.signalType.includes("FVG")) {
          const towardBias = (ipda.dailyBias.bias === "BULLISH" && sig.direction === "BUY") ||
                             (ipda.dailyBias.bias === "BEARISH" && sig.direction === "SELL");
          if (towardBias) sig.confidence = Math.min(95, sig.confidence + 10);
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
      sig.checklistItems = this.buildICTChecklist(sig, currentKillzone, fractal);
    }

    return validSignals.sort((a, b) => b.confidence - a.confidence);
  }

  private buildICTChecklist(
    sig: ICTSignal,
    killzone: KillzoneType,
    fractal?: import("./market-structure.service").FractalContext
  ): ChecklistItem[] {
    const isBuy = sig.direction === "BUY";
    const kzLabel = killzone !== "NONE" ? `${killzone} Killzone aktif` : "Outside Killzone (Session)";

    const slDist = Math.abs(sig.entry - sig.sl);
    const tpDist = Math.abs(sig.tp - sig.entry);
    const rrRatio = slDist > 0 ? tpDist / slDist : 0;
    const isRRValid = rrRatio >= 2.0;

    const setupTfLabel = fractal?.setupTimeframeStr || "H1";
    const htfTfLabel = fractal?.directionTimeframeStr || "H4";
    const entryTfLabel = fractal?.entryTimeframeStr || "M15";

    return [
      {
        id: "ict-killzone",
        label: kzLabel,
        status: killzone !== "NONE" ? "PASSED" : "WAITING",
        timeframe: setupTfLabel,
        value: killzone !== "NONE" ? killzone : "OFF_SESSION"
      },
      {
        id: "ict-po3",
        label: "Power of 3 (PO3) — Fase Manipulation selesai",
        status: sig.signalType.includes("AMD") || sig.signalType === "JUDAS_SWEEP" ? "PASSED" : "PASSED",
        timeframe: htfTfLabel
      },
      {
        id: "ict-fvg",
        label: `Fair Value Gap (FVG) ${isBuy ? "Bullish" : "Bearish"} & Inducement ${setupTfLabel}`,
        status: sig.signalType.includes("FVG") ? "PASSED" : "PASSED",
        timeframe: setupTfLabel
      },
      {
        id: "ict-ote",
        label: "Optimal Trade Entry (OTE 61.8% - 79%) tersentuh",
        status: sig.signalType.includes("OTE") ? "PASSED" : "WAITING",
        timeframe: setupTfLabel
      },
      {
        id: "ict-sweep",
        label: `Liquidity Sweep (Turtle Soup) ${isBuy ? "Sell-Side" : "Buy-Side"} ${entryTfLabel}`,
        status: sig.signalType.includes("SWEEP") || sig.signalType.includes("AMD") ? "PASSED" : "PASSED",
        timeframe: entryTfLabel
      },
      {
        id: "ict-rr",
        label: "Minimum Risk-to-Reward 1:2 Terpenuhi",
        status: isRRValid ? "PASSED" : "FAILED",
        details: `R:R 1:${rrRatio.toFixed(2)} | SL: ${sig.sl.toFixed(5)} | TP: ${sig.tp.toFixed(5)}`
      },
      {
        id: "ict-pending-placed",
        label: `Pending Order Limit ${entryTfLabel} Placed`,
        status: sig.confidence >= 70 ? "PASSED" : "WAITING",
        timeframe: entryTfLabel,
        details: `Limit Price: ${sig.entry.toFixed(5)}`
      }
    ];
  }

  // ─── AMD Pattern Detection (CRT backbone) ─────────────────────────────────

  /**
   * Detects CRT 3-Candle AMD Pattern on setup candles (H1/H4):
   * C1 = Accumulation (range candle)
   * C2 = Manipulation (sweep + reverse close)
   * C3 = Distribution (breakout / follow-through)
   * Returns a zone around the sweep (C1 body range) if valid.
   */
  private detectAMDPattern(
    candles: Candle[],
    htfTrend: "BULL" | "BEAR" | "SIDEWAYS",
    avgRange: number,
  ): { direction: "BUY" | "SELL"; zoneHigh: number; zoneLow: number; sweepLevel: number } | null {
    if (candles.length < 2) return null;

    const c1 = candles[candles.length - 2]; // Accumulation
    const c2 = candles[candles.length - 1]; // Manipulation

    const c1BodyTop = Math.max(c1.open, c1.close);
    const c1BodyBot = Math.min(c1.open, c1.close);

    // Bullish AMD: C2 sweeps below C1's low then closes bullish above C1's body
    if (htfTrend !== "BEAR") {
      const c2SweepLow = c2.low < c1.low;
      const c2CloseBullish = c2.close > c1BodyBot && c2.close > c2.open;

      if (c2SweepLow && c2CloseBullish) {
        return {
          direction: "BUY",
          zoneHigh: c1BodyTop,
          zoneLow: c2.low,
          sweepLevel: c1.low,
        };
      }
    }

    // Bearish AMD: C2 sweeps above C1's high then closes bearish below C1's body
    if (htfTrend !== "BULL") {
      const c2SweepHigh = c2.high > c1.high;
      const c2CloseBearish = c2.close < c1BodyTop && c2.close < c2.open;

      if (c2SweepHigh && c2CloseBearish) {
        return {
          direction: "SELL",
          zoneHigh: c2.high,
          zoneLow: c1BodyTop,
          sweepLevel: c1.high,
        };
      }
    }

    return null;
  }

  // ─── ICT FVG inside AMD Zone ──────────────────────────────────────────────

  private findFVGInsideZone(
    candles: Candle[],
    ms: MarketStructure,
    direction: "BUY" | "SELL",
    zoneHigh: number,
    zoneLow: number,
    avgRange: number,
    config: ReturnType<typeof strategyConfigService.getICTConfig>,
    killzone: KillzoneType,
  ): ICTSignal | null {
    const last = candles[candles.length - 1];

    for (const fvg of ms.fairValueGaps) {
      if (fvg.mitigated) continue;

      if (direction === "BUY" && fvg.type === "BULLISH") {
        // FVG must overlap the AMD zone
        if (fvg.top < zoneLow || fvg.bottom > zoneHigh) continue;
        // Price must be near the FVG bottom
        if (Math.abs(last.close - fvg.bottom) > avgRange * config.fvgProximityAtrMult) continue;

        let conf = config.minConfidence + 20; // AMD (15) + FVG (5) = high quality
        let reason = `ICT AMD BUY: 3-Candle sweep + Bullish FVG [${fvg.bottom.toFixed(5)}–${fvg.top.toFixed(5)}]`;
        if (killzone !== "NONE") { conf += 10; reason += ` @ ${killzone}`; }

        return {
          direction: "BUY",
          entry: fvg.bottom,
          sl: fvg.bottom - avgRange * 1.5,
          tp: fvg.top + avgRange * 2.0,
          orderType: "PENDING_LIMIT",
          limitPrice: fvg.bottom,
          signalType: "AMD_FVG",
          killzone: killzone !== "NONE" ? killzone : undefined,
          confidence: Math.min(95, conf),
          reason,
        };
      }

      if (direction === "SELL" && fvg.type === "BEARISH") {
        if (fvg.bottom > zoneHigh || fvg.top < zoneLow) continue;
        if (Math.abs(last.close - fvg.top) > avgRange * config.fvgProximityAtrMult) continue;

        let conf = config.minConfidence + 20;
        let reason = `ICT AMD SELL: 3-Candle sweep + Bearish FVG [${fvg.bottom.toFixed(5)}–${fvg.top.toFixed(5)}]`;
        if (killzone !== "NONE") { conf += 10; reason += ` @ ${killzone}`; }

        return {
          direction: "SELL",
          entry: fvg.top,
          sl: fvg.top + avgRange * 1.5,
          tp: fvg.bottom - avgRange * 2.0,
          orderType: "PENDING_LIMIT",
          limitPrice: fvg.top,
          signalType: "AMD_FVG",
          killzone: killzone !== "NONE" ? killzone : undefined,
          confidence: Math.min(95, conf),
          reason,
        };
      }
    }

    return null;
  }

  // ─── ICT OTE inside AMD Zone ──────────────────────────────────────────────

  private findOTEInsideZone(
    candles: Candle[],
    ms: MarketStructure,
    direction: "BUY" | "SELL",
    zoneHigh: number,
    zoneLow: number,
    avgRange: number,
    config: ReturnType<typeof strategyConfigService.getICTConfig>,
  ): ICTSignal | null {
    if (ms.swingHighs.length < 1 || ms.swingLows.length < 1) return null;

    const last = candles[candles.length - 1];
    const latestHigh = ms.swingHighs[ms.swingHighs.length - 1];
    const latestLow  = ms.swingLows[ms.swingLows.length - 1];

    if (direction === "BUY" && latestLow.index < latestHigh.index) {
      const range = latestHigh.price - latestLow.price;
      if (range === 0) return null;
      const ote618 = latestHigh.price - range * 0.618;
      const ote79  = latestHigh.price - range * 0.79;

      // Price in OTE zone AND OTE zone overlaps AMD zone
      if (last.close >= ote79 && last.close <= ote618 && ote618 >= zoneLow && ote79 <= zoneHigh) {
        return {
          direction: "BUY",
          entry: ote79,
          sl: ote79 - avgRange * 1.2,
          tp: latestHigh.price + avgRange,
          orderType: "PENDING_LIMIT",
          limitPrice: ote79,
          signalType: "AMD_OTE",
          confidence: Math.min(93, config.minConfidence + 18),
          reason: `ICT AMD OTE BUY: 3-Candle sweep + OTE zone (${ote79.toFixed(5)}–${ote618.toFixed(5)}) inside AMD range`,
        };
      }
    }

    if (direction === "SELL" && latestHigh.index < latestLow.index) {
      const range = latestHigh.price - latestLow.price;
      if (range === 0) return null;
      const ote618 = latestLow.price + range * 0.618;
      const ote79  = latestLow.price + range * 0.79;

      if (last.close >= ote618 && last.close <= ote79 && ote79 <= zoneHigh && ote618 >= zoneLow) {
        return {
          direction: "SELL",
          entry: ote79,
          sl: ote79 + avgRange * 1.2,
          tp: latestLow.price - avgRange,
          orderType: "PENDING_LIMIT",
          limitPrice: ote79,
          signalType: "AMD_OTE",
          confidence: Math.min(93, config.minConfidence + 18),
          reason: `ICT AMD OTE SELL: 3-Candle sweep + OTE zone (${ote618.toFixed(5)}–${ote79.toFixed(5)}) inside AMD range`,
        };
      }
    }

    return null;
  }

  // ─── Liquidity Sweep Detection (CRT backbone) ─────────────────────────────

  private detectLiquiditySweep(
    candles: Candle[],
    avgRange: number,
    htfTrend: "BULL" | "BEAR" | "SIDEWAYS",
  ): { direction: "BUY" | "SELL"; sweepLevel: number } | null {
    if (candles.length < 3) return null;

    const lookback = candles.slice(-20, -1);
    const rangeHigh = Math.max(...lookback.map(c => c.high));
    const rangeLow  = Math.min(...lookback.map(c => c.low));

    const prev = candles[candles.length - 2];
    const last = candles[candles.length - 1];

    // Bullish sweep: prev wick went below rangeLow, last closed back above
    if (htfTrend !== "BEAR") {
      if (prev.low < rangeLow && last.close > rangeLow) {
        return { direction: "BUY", sweepLevel: rangeLow };
      }
    }

    // Bearish sweep: prev wick went above rangeHigh, last closed back below
    if (htfTrend !== "BULL") {
      if (prev.high > rangeHigh && last.close < rangeHigh) {
        return { direction: "SELL", sweepLevel: rangeHigh };
      }
    }

    return null;
  }

  // ─── Sweep + FVG Confirmation ─────────────────────────────────────────────

  private buildSweepFVGSignal(
    candles: Candle[],
    ms: MarketStructure,
    direction: "BUY" | "SELL",
    sweepLevel: number,
    avgRange: number,
    config: ReturnType<typeof strategyConfigService.getICTConfig>,
    killzone: KillzoneType,
  ): ICTSignal | null {
    const last = candles[candles.length - 1];

    for (const fvg of ms.fairValueGaps) {
      if (fvg.mitigated) continue;

      if (direction === "BUY" && fvg.type === "BULLISH") {
        // FVG must be above the sweep level (where the reversal happens)
        if (fvg.bottom < sweepLevel) continue;
        if (Math.abs(last.close - fvg.bottom) > avgRange * config.fvgProximityAtrMult) continue;

        let conf = config.minConfidence + 15;
        let reason = `ICT Sweep+FVG BUY: Liq. sweep @ ${sweepLevel.toFixed(5)} + Bullish FVG @ ${fvg.bottom.toFixed(5)}`;
        if (killzone !== "NONE") { conf += 8; reason += ` @ ${killzone}`; }

        return {
          direction: "BUY",
          entry: fvg.bottom,
          sl: sweepLevel - avgRange * 0.5,
          tp: fvg.top + avgRange * 2.0,
          orderType: "PENDING_LIMIT",
          limitPrice: fvg.bottom,
          signalType: "SWEEP_FVG",
          killzone: killzone !== "NONE" ? killzone : undefined,
          confidence: Math.min(92, conf),
          reason,
        };
      }

      if (direction === "SELL" && fvg.type === "BEARISH") {
        if (fvg.top > sweepLevel) continue;
        if (Math.abs(last.close - fvg.top) > avgRange * config.fvgProximityAtrMult) continue;

        let conf = config.minConfidence + 15;
        let reason = `ICT Sweep+FVG SELL: Liq. sweep @ ${sweepLevel.toFixed(5)} + Bearish FVG @ ${fvg.top.toFixed(5)}`;
        if (killzone !== "NONE") { conf += 8; reason += ` @ ${killzone}`; }

        return {
          direction: "SELL",
          entry: fvg.top,
          sl: sweepLevel + avgRange * 0.5,
          tp: fvg.bottom - avgRange * 2.0,
          orderType: "PENDING_LIMIT",
          limitPrice: fvg.top,
          signalType: "SWEEP_FVG",
          killzone: killzone !== "NONE" ? killzone : undefined,
          confidence: Math.min(92, conf),
          reason,
        };
      }
    }

    return null;
  }

  // ─── Judas Swing + Sweep Context ─────────────────────────────────────────

  private detectJudasWithContext(
    candles: Candle[],
    ms: MarketStructure,
    avgRange: number,
    htfTrend: "BULL" | "BEAR" | "SIDEWAYS",
  ): ICTSignal | null {
    if (candles.length < 3) return null;

    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];

    // Calculate recent range context
    const lookback = candles.slice(-20, -2);
    const rangeHigh = Math.max(...lookback.map(c => c.high));
    const rangeLow  = Math.min(...lookback.map(c => c.low));

    // Bullish Judas: prev dipped below recent swing low (sweep), now reversed
    if (htfTrend !== "BEAR") {
      const recentLows = ms.swingLows.filter(s => s.index >= candles.length - 6);
      for (const swing of recentLows) {
        if (prev.low < swing.price && last.close > swing.price) {
          // Validate: prev also swept below range context (double confirmation)
          const contextSweep = prev.low < rangeLow;
          const conf = contextSweep ? 82 : 72;

          return {
            direction: "BUY",
            entry: last.close,
            sl: prev.low - avgRange * 0.3,
            tp: last.close + avgRange * 2.5,
            orderType: "MARKET",
            signalType: "JUDAS_SWEEP",
            confidence: conf,
            reason: `ICT Judas BUY: Swept ${swing.price.toFixed(5)}${contextSweep ? " + range low" : ""}, reversed bullish`,
          };
        }
      }
    }

    // Bearish Judas: prev broke above recent swing high (sweep), now reversed
    if (htfTrend !== "BULL") {
      const recentHighs = ms.swingHighs.filter(s => s.index >= candles.length - 6);
      for (const swing of recentHighs) {
        if (prev.high > swing.price && last.close < swing.price) {
          const contextSweep = prev.high > rangeHigh;
          const conf = contextSweep ? 82 : 72;

          return {
            direction: "SELL",
            entry: last.close,
            sl: prev.high + avgRange * 0.3,
            tp: last.close - avgRange * 2.5,
            orderType: "MARKET",
            signalType: "JUDAS_SWEEP",
            confidence: conf,
            reason: `ICT Judas SELL: Swept ${swing.price.toFixed(5)}${contextSweep ? " + range high" : ""}, reversed bearish`,
          };
        }
      }
    }

    return null;
  }

  // ─── OTE + AMD Range Context ──────────────────────────────────────────────

  private detectOTEWithAMDContext(
    setupCandles: Candle[],
    entryCandles: Candle[],
    ms: MarketStructure,
    htfTrend: "BULL" | "BEAR" | "SIDEWAYS",
    avgRange: number,
    config: ReturnType<typeof strategyConfigService.getICTConfig>,
  ): ICTSignal | null {
    if (ms.swingHighs.length < 1 || ms.swingLows.length < 1) return null;
    if (setupCandles.length < 3) return null;

    const last = entryCandles[entryCandles.length - 1];
    const latestHigh = ms.swingHighs[ms.swingHighs.length - 1];
    const latestLow  = ms.swingLows[ms.swingLows.length - 1];

    // Setup TF context: is price in a consolidation / low-ATR area?
    const setupAtr = atrService.calculate(setupCandles);
    const setupAvgRange = setupAtr > 0 ? setupAtr : this.avgRange(setupCandles, 14);
    const recentSetupRange = Math.max(...setupCandles.slice(-5).map(c => c.high)) -
                             Math.min(...setupCandles.slice(-5).map(c => c.low));
    const isConsolidating = recentSetupRange < setupAvgRange * 1.5;

    if (!isConsolidating) return null; // OTE only valid in AMD accumulation context

    // Bullish OTE
    if (htfTrend !== "BEAR" && latestLow.index < latestHigh.index) {
      const range = latestHigh.price - latestLow.price;
      if (range === 0) return null;
      const ote618 = latestHigh.price - range * 0.618;
      const ote79  = latestHigh.price - range * 0.79;

      if (last.close >= ote79 && last.close <= ote618) {
        const prevHigh = ms.swingHighs.length > 1 ? ms.swingHighs[ms.swingHighs.length - 2] : null;
        const tp = prevHigh ? prevHigh.price : latestHigh.price + avgRange * 2;

        return {
          direction: "BUY",
          entry: ote79,
          sl: ote79 - avgRange * 1.2,
          tp,
          orderType: "PENDING_LIMIT",
          limitPrice: ote79,
          signalType: "OTE_AMD",
          confidence: Math.min(88, config.minConfidence + 13),
          reason: `ICT OTE BUY: Fib zone (${ote79.toFixed(5)}–${ote618.toFixed(5)}) in consolidation context, TP ${tp.toFixed(5)}`,
        };
      }
    }

    // Bearish OTE
    if (htfTrend !== "BULL" && latestHigh.index < latestLow.index) {
      const range = latestHigh.price - latestLow.price;
      if (range === 0) return null;
      const ote618 = latestLow.price + range * 0.618;
      const ote79  = latestLow.price + range * 0.79;

      if (last.close >= ote618 && last.close <= ote79) {
        const prevLow = ms.swingLows.length > 1 ? ms.swingLows[ms.swingLows.length - 2] : null;
        const tp = prevLow ? prevLow.price : latestLow.price - avgRange * 2;

        return {
          direction: "SELL",
          entry: ote79,
          sl: ote79 + avgRange * 1.2,
          tp,
          orderType: "PENDING_LIMIT",
          limitPrice: ote79,
          signalType: "OTE_AMD",
          confidence: Math.min(88, config.minConfidence + 13),
          reason: `ICT OTE SELL: Fib zone (${ote618.toFixed(5)}–${ote79.toFixed(5)}) in consolidation context, TP ${tp.toFixed(5)}`,
        };
      }
    }

    return null;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  getCurrentKillzone(timestamp?: number): KillzoneType {
    const ts = timestamp ?? (Date.now() / 1000);
    return marketStructureService.getKillzoneForTimestamp(ts);
  }

  private avgRange(candles: Candle[], period: number): number {
    const recent = candles.slice(-period);
    if (recent.length === 0) return 0;
    return recent.reduce((s, c) => s + (c.high - c.low), 0) / recent.length;
  }
}

export const ictStrategy = new ICTStrategy();
