/**
 * MAE / MFE Calculation Service
 * ────────────────────────────────────────────────────────────────
 * Supports two calculation modes:
 *  1. MANUAL INPUT  – caller provides worstPriceReached / bestPriceReached
 *     directly (no MT5 needed, works offline).
 *  2. AUTO CANDLE   – if entryDate + exitDate + pair are given and MT5 is
 *     reachable, we fetch the OHLC range and infer worst/best automatically.
 *
 * Result is always expressed in **R-multiples** so it is comparable across
 * pairs, lot sizes, and account currencies.
 *
 * MAE-R: how far the trade went against you (relative to 1R of risk).
 *        A LONG with entry=2000, SL=1990, worst=1985 → MAE-R = 1.5 R
 *        (went 1.5× the original risk distance against you)
 *
 * MFE-R: how far the trade went in your favour before you closed it.
 *        A LONG with entry=2000, SL=1990, best=2030 → MFE-R = 3.0 R
 *
 * Decision insight:
 *  - MFE-R >> actualR  →  you left money on the table (exit too early).
 *  - MAE-R >> 1.0      →  your SL was hit or you endured unnecessary drawdown.
 */

import axios from "axios";
import { silentLogger } from "../utils/silent-logger";

export interface MaeMfeInput {
  direction: "LONG" | "SHORT";
  entryPrice: number;
  stopLoss: number;
  // Manual path
  worstPriceReached?: number;
  bestPriceReached?: number;
  // Auto candle path
  pair?: string;
  entryDate?: Date | string;
  exitDate?: Date | string;
}

export interface MaeMfeResult {
  maeR: number | null;  // null when data unavailable
  mfeR: number | null;
  worstPriceReached: number | null;
  bestPriceReached: number | null;
  source: "manual" | "candle" | "unavailable";
}

class MaeMfeService {
  /**
   * Main entry point. Tries manual first, then falls back to candle fetch.
   */
  async calculate(input: MaeMfeInput): Promise<MaeMfeResult> {
    const riskDistance = Math.abs(input.entryPrice - input.stopLoss);
    if (riskDistance === 0) {
      return { maeR: null, mfeR: null, worstPriceReached: null, bestPriceReached: null, source: "unavailable" };
    }

    // ── Path 1: Manual input (worst / best price supplied by the user) ──
    if (input.worstPriceReached !== undefined && input.bestPriceReached !== undefined) {
      return this._computeFromPrices(
        input as MaeMfeInput & { worstPriceReached: number; bestPriceReached: number },
        riskDistance,
        "manual"
      );
    }

    // ── Path 2: Auto candle via MT5 streamer ──
    if (input.pair && input.entryDate && input.exitDate) {
      try {
        const range = await this._fetchCandleRange(input.pair, input.entryDate, input.exitDate);
        if (range) {
          const worst = input.direction === "LONG" ? range.low  : range.high;
          const best  = input.direction === "LONG" ? range.high : range.low;
          return this._computeFromPrices(
            { ...input, worstPriceReached: worst, bestPriceReached: best } as MaeMfeInput & { worstPriceReached: number; bestPriceReached: number },
            riskDistance,
            "candle"
          );
        }
      } catch (err) {
        silentLogger.warn("[MaeMfeService] candle fetch failed, skipping auto calc:", err);
      }
    }

    return { maeR: null, mfeR: null, worstPriceReached: null, bestPriceReached: null, source: "unavailable" };
  }

  private _computeFromPrices(
    input: MaeMfeInput & { worstPriceReached: number; bestPriceReached: number },
    riskDistance: number,
    source: "manual" | "candle"
  ): MaeMfeResult {
    let maeR: number;
    let mfeR: number;

    if (input.direction === "LONG") {
      // For LONG: MAE = how far below entry price went, MFE = how far above entry price went
      maeR = parseFloat(((input.entryPrice - input.worstPriceReached) / riskDistance).toFixed(3));
      mfeR = parseFloat(((input.bestPriceReached - input.entryPrice) / riskDistance).toFixed(3));
    } else {
      // For SHORT: MAE = how far above entry price went, MFE = how far below entry price went
      maeR = parseFloat(((input.worstPriceReached - input.entryPrice) / riskDistance).toFixed(3));
      mfeR = parseFloat(((input.entryPrice - input.bestPriceReached) / riskDistance).toFixed(3));
    }

    // Clamp negatives to 0 (price never moved against / in favour at all)
    return {
      maeR: Math.max(0, maeR),
      mfeR: Math.max(0, mfeR),
      worstPriceReached: input.worstPriceReached,
      bestPriceReached: input.bestPriceReached,
      source,
    };
  }

  /**
   * Fetches OHLC range from internal backend streamer.
   * Returns { high, low } spanning the entire trade duration.
   */
  private async _fetchCandleRange(
    pair: string,
    entryDate: Date | string,
    exitDate: Date | string
  ): Promise<{ high: number; low: number } | null> {
    const from = new Date(entryDate).toISOString();
    const to   = new Date(exitDate).toISOString();

    // Try local market-data endpoint first (always available, no MT5 needed)
    const res = await axios.get("http://localhost:5000/api/v1/market-data/ohlc-range", {
      params: { symbol: pair, from, to },
      timeout: 4000,
    });

    if (res.data?.success && res.data?.data?.high !== undefined) {
      return { high: res.data.data.high, low: res.data.data.low };
    }
    return null;
  }
}

export const maeMfeService = new MaeMfeService();
