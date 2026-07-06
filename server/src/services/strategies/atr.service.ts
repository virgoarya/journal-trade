// ─── ATR (Average True Range) Service ───────────────────────────────
// Shared ATR calculator used by all strategy modules. Extracted to avoid
// duplicate logic across strategies.

import { type Candle } from "./market-structure.service";

export interface ATRInput {
  high: number;
  low: number;
  close: number;
}

class ATRService {
  /**
   * Calculate ATR for the given period (default 14).
   * Returns the ATR value, or 0 if insufficient data.
   */
  calculate(candles: ATRInput[], period = 14): number {
    if (candles.length < period + 1) return 0;

    let trSum = 0;
    const start = candles.length - period - 1;

    for (let i = start + 1; i < candles.length; i++) {
      const high = candles[i].high;
      const low = candles[i].low;
      const prevClose = candles[i - 1].close;

      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose),
      );
      trSum += tr;
    }

    return trSum / period;
  }

  /**
   * Calculate the full range of TR values (useful for volatility assessment).
   */
  calculateTRs(candles: ATRInput[]): number[] {
    if (candles.length < 2) return [];

    const trs: number[] = [];
    for (let i = 1; i < candles.length; i++) {
      const tr = Math.max(
        candles[i].high - candles[i].low,
        Math.abs(candles[i].high - candles[i - 1].close),
        Math.abs(candles[i].low - candles[i - 1].close),
      );
      trs.push(tr);
    }

    return trs;
  }
}

export const atrService = new ATRService();
