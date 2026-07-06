// ─── Inner Circle Trader (ICT) Strategy ─────────────────────────────
// Detects: Fair Value Gaps (FVG), Killzone confluences, Optimal Trade
//          Entry (OTE / 61.8-79% Fib), Judas Swings, Time-based signals.

import { marketStructureService, type Candle, type MarketStructure, type FVG } from "./market-structure.service";
import { atrService } from "./atr.service";

export type KillzoneType = "ASIAN" | "LONDON" | "NEW_YORK" | "LONDON_CLOSE" | "NONE";

export interface ICTSignal {
  direction: "BUY" | "SELL";
  confidence: number;
  entry: number;
  sl: number;
  tp: number;
  killzone?: KillzoneType;
  fvg?: FVG;
  ote?: { level618: number; level79: number };
  signalType: "FVG" | "KILLZONE" | "OTE" | "JUDAS_SWING" | "TIME_CONFLUENCE";
  reason: string;
}

export interface ICTAnalysis {
  signal: ICTSignal | null;
  signals: ICTSignal[];
  currentKillzone: KillzoneType;
}

// ─── Killzone Hours (EST) ────────────────────────────────────────────
// Times are in minutes since midnight EST

const EST_OFFSET = 5; // UTC → EST = UTC – 5h (standard time)
const KILLZONES = {
  ASIAN: { start: 19 * 60 + 0, end: 2 * 60 + 0 },    // 19:00 – 02:00 EST
  LONDON: { start: 2 * 60 + 0, end: 5 * 60 + 0 },     // 02:00 – 05:00 EST
  NEW_YORK: { start: 7 * 60 + 0, end: 10 * 60 + 0 },  // 07:00 – 10:00 EST
  LONDON_CLOSE: { start: 10 * 60 + 0, end: 12 * 60 + 0 }, // 10:00 – 12:00 EST
};

class ICTStrategy {
  /**
   * Full ICT analysis for a given symbol.
   */
  analyze(candles: Candle[], marketStructure: MarketStructure): ICTSignal[] {
    const signals: ICTSignal[] = [];
    const currentKillzone = this.getCurrentKillzone();

    // 1. FVG detection + mitigation status
    const fvgSignals = this.detectFVGSignals(candles, marketStructure);
    signals.push(...fvgSignals);

    // 2. OTE (Fibonacci retracement zone 61.8–79%)
    const oteSignal = this.detectOTE(candles, marketStructure);
    if (oteSignal) signals.push(oteSignal);

    // 3. Judas Swing — false breakout with quick reversal
    const judasSignal = this.detectJudasSwing(candles, marketStructure);
    if (judasSignal) signals.push(judasSignal);

    // 4. Time‑price confluence: FVG in killzone
    if (currentKillzone !== "NONE") {
      const timeSignal = this.checkTimeConfluence(candles, signals, currentKillzone);
      if (timeSignal) signals.push(timeSignal);
    }

    return signals.sort((a, b) => b.confidence - a.confidence);
  }

  getCurrentKillzone(): KillzoneType {
    const now = new Date();
    const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const estMinutes = (utcMinutes - EST_OFFSET * 60 + 1440) % 1440;

    // Overnight Asian: check wrap-around
    if (estMinutes >= KILLZONES.ASIAN.start || estMinutes < KILLZONES.ASIAN.end) {
      return "ASIAN";
    }
    if (estMinutes >= KILLZONES.LONDON.start && estMinutes < KILLZONES.LONDON.end) {
      return "LONDON";
    }
    if (estMinutes >= KILLZONES.NEW_YORK.start && estMinutes < KILLZONES.NEW_YORK.end) {
      return "NEW_YORK";
    }
    if (estMinutes >= KILLZONES.LONDON_CLOSE.start && estMinutes < KILLZONES.LONDON_CLOSE.end) {
      return "LONDON_CLOSE";
    }

    return "NONE";
  }

  /** Get killzone for a given timestamp (used in backtesting). */
  getKillzoneForTimestamp(timestamp: number): KillzoneType {
    const d = new Date(timestamp * 1000);
    const utcMinutes = d.getUTCHours() * 60 + d.getUTCMinutes();
    const estMinutes = (utcMinutes - EST_OFFSET * 60 + 1440) % 1440;

    if (estMinutes >= KILLZONES.ASIAN.start || estMinutes < KILLZONES.ASIAN.end) return "ASIAN";
    if (estMinutes >= KILLZONES.LONDON.start && estMinutes < KILLZONES.LONDON.end) return "LONDON";
    if (estMinutes >= KILLZONES.NEW_YORK.start && estMinutes < KILLZONES.NEW_YORK.end) return "NEW_YORK";
    if (estMinutes >= KILLZONES.LONDON_CLOSE.start && estMinutes < KILLZONES.LONDON_CLOSE.end) return "LONDON_CLOSE";
    return "NONE";
  }

  // ── FVG Signals ────────────────────────────────────────────────────

  private detectFVGSignals(candles: Candle[], ms: MarketStructure): ICTSignal[] {
    const signals: ICTSignal[] = [];
    if (candles.length < 3) return signals;

    const last = candles[candles.length - 1];
    const atr = atrService.calculate(candles);
    const avgRange = atr > 0 ? atr : this.avgRange(candles, 5);
    const currentKillzone = this.getCurrentKillzone();

    for (const fvg of ms.fairValueGaps) {
      // Skip fully mitigated FVGs (already filled)
      if (fvg.mitigated) continue;

      // Unmitigated bullish FVG: gap still exists above → look for BUY
      if (fvg.type === "BULLISH") {
        // Price near the gap bottom (within 1 ATR)
        const nearGap = Math.abs(last.close - fvg.bottom) / fvg.bottom < (avgRange * 1.5) / last.close;
        if (!nearGap) continue;

        let confidence = 65;
        let reason = `FVG BUY: Unmitigated bullish gap [${fvg.bottom.toFixed(5)}–${fvg.top.toFixed(5)}]`;

        // Bonus for killzone confluence
        if (currentKillzone !== "NONE") {
          confidence += 10;
          reason += ` during ${currentKillzone}`;
        }

        signals.push({
          direction: "BUY",
          entry: fvg.bottom,
          sl: fvg.bottom - avgRange * 1.5,
          tp: fvg.top + avgRange * 2.0,
          fvg,
          killzone: currentKillzone !== "NONE" ? currentKillzone : undefined,
          signalType: "FVG",
          confidence: Math.min(95, confidence),
          reason,
        });
      }

      // Unmitigated bearish FVG
      if (fvg.type === "BEARISH") {
        const nearGap = Math.abs(last.close - fvg.top) / fvg.top < (avgRange * 1.5) / last.close;
        if (!nearGap) continue;

        let confidence = 65;
        let reason = `FVG SELL: Unmitigated bearish gap [${fvg.bottom.toFixed(5)}–${fvg.top.toFixed(5)}]`;

        if (currentKillzone !== "NONE") {
          confidence += 10;
          reason += ` during ${currentKillzone}`;
        }

        signals.push({
          direction: "SELL",
          entry: fvg.top,
          sl: fvg.top + avgRange * 1.5,
          tp: fvg.bottom - avgRange * 2.0,
          fvg,
          killzone: currentKillzone !== "NONE" ? currentKillzone : undefined,
          signalType: "FVG",
          confidence: Math.min(95, confidence),
          reason,
        });
      }
    }

    return signals;
  }

  // ── OTE (Optimal Trade Entry) ──────────────────────────────────────

  /**
   * OTE = Fibonacci retracement zone 61.8% – 79% of the most recent
   * significant impulse move.
   *
   * For BULL: measure swing low → swing high, look for retrace to 61.8–79%
   * For SELL: measure swing high → swing low, look for retrace to 61.8–79%
   */
  private detectOTE(candles: Candle[], ms: MarketStructure): ICTSignal | null {
    if (candles.length < 3) return null;
    if (ms.swingHighs.length < 1 || ms.swingLows.length < 1) return null;

    const last = candles[candles.length - 1];
    const atr = atrService.calculate(candles);
    const avgRange = atr > 0 ? atr : this.avgRange(candles, 5);

    // Latest swing high & swing low
    const latestHigh = ms.swingHighs[ms.swingHighs.length - 1];
    const latestLow = ms.swingLows[ms.swingLows.length - 1];
    const prevHigh = ms.swingHighs.length > 1 ? ms.swingHighs[ms.swingHighs.length - 2] : null;
    const prevLow = ms.swingLows.length > 1 ? ms.swingLows[ms.swingLows.length - 2] : null;

    // BULLISH OTE: use latest swing low → swing high
    if (latestLow.index < latestHigh.index) {
      const range = latestHigh.price - latestLow.price;
      const level618 = latestHigh.price - range * 0.618;
      const level79 = latestHigh.price - range * 0.79;

      if (last.close >= level79 && last.close <= level618) {
        return {
          direction: "BUY",
          entry: last.close,
          sl: level79 - avgRange * 0.5,
          tp: latestHigh.price + avgRange * 1.0,
          ote: { level618, level79 },
          signalType: "OTE",
          confidence: 70,
          reason: `OTE BUY: Retrace to ${((latestHigh.price - last.close) / range * 100).toFixed(1)}% Fib (zone ${level79.toFixed(5)}–${level618.toFixed(5)})`,
        };
      }
    }

    // BEARISH OTE: use latest swing high → swing low
    if (prevHigh && latestLow.index > prevHigh.index) {
      const range = prevHigh.price - latestLow.price;
      const level618 = latestLow.price + range * 0.618;
      const level79 = latestLow.price + range * 0.79;

      if (last.close >= level618 && last.close <= level79) {
        return {
          direction: "SELL",
          entry: last.close,
          sl: level79 + avgRange * 0.5,
          tp: latestLow.price - avgRange * 1.0,
          ote: { level618, level79 },
          signalType: "OTE",
          confidence: 70,
          reason: `OTE SELL: Retrace to ${((last.close - latestLow.price) / range * 100).toFixed(1)}% Fib (zone ${level618.toFixed(5)}–${level79.toFixed(5)})`,
        };
      }
    }

    return null;
  }

  // ── Judas Swing ────────────────────────────────────────────────────

  /**
   * Judas Swing = a sharp, sudden move beyond a key level that
   * immediately reverses within 1–2 candles. It traps traders into
   * late entries before the real move.
   */
  private detectJudasSwing(candles: Candle[], ms: MarketStructure): ICTSignal | null {
    if (candles.length < 3) return null;

    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    const atr = atrService.calculate(candles);
    const avgRange = atr > 0 ? atr : this.avgRange(candles, 5);

    // Bullish Judas: previous candle dipped below recent lows, now recovered
    const recentLows = ms.swingLows.filter((s) => s.index >= candles.length - 6);
    for (const swing of recentLows) {
      if (prev.low < swing.price && last.close > swing.price) {
        return {
          direction: "BUY",
          entry: last.close,
          sl: prev.low - avgRange * 0.3,
          tp: last.close + avgRange * 2.5,
          signalType: "JUDAS_SWING",
          confidence: 75,
          reason: `Judas Swing BUY: Break below ${swing.price.toFixed(5)} trapped sellers, now reversing`,
        };
      }
    }

    // Bearish Judas: previous candle broke above recent highs, now reversed
    const recentHighs = ms.swingHighs.filter((s) => s.index >= candles.length - 6);
    for (const swing of recentHighs) {
      if (prev.high > swing.price && last.close < swing.price) {
        return {
          direction: "SELL",
          entry: last.close,
          sl: prev.high + avgRange * 0.3,
          tp: last.close - avgRange * 2.5,
          signalType: "JUDAS_SWING",
          confidence: 75,
          reason: `Judas Swing SELL: Break above ${swing.price.toFixed(5)} trapped buyers, now reversing`,
        };
      }
    }

    return null;
  }

  // ── Time Confluence ────────────────────────────────────────────────

  /**
   * Boost confidence of existing FVG/OTE signals if we're in a killzone.
   */
  private checkTimeConfluence(candles: Candle[], existing: ICTSignal[], killzone: KillzoneType): ICTSignal | null {
    // Find the highest‑confidence signal that doesn't already have a killzone
    const best = existing
      .filter((s) => !s.killzone)
      .sort((a, b) => b.confidence - a.confidence)[0];

    if (!best) return null;

    return {
      ...best,
      killzone,
      confidence: Math.min(95, best.confidence + 15),
      signalType: "TIME_CONFLUENCE",
      reason: `${best.reason} — boosted by ${killzone} killzone confluence`,
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private avgRange(candles: Candle[], period: number): number {
    const recent = candles.slice(-period);
    if (recent.length === 0) return 0;
    return recent.reduce((s, c) => s + (c.high - c.low), 0) / recent.length;
  }
}

export const ictStrategy = new ICTStrategy();
