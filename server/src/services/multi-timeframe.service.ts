import { mt5McpService } from "./mt5-mcp.service";
import type { Candle } from "./ai-trading-engine.service";

/**
 * Timeframe hierarchy for confluence verification.
 * Higher timeframes define the trend context for lower timeframe entries.
 */
const TIMEFRAME_HIERARCHY: Record<string, string[]> = {
  M5: ["M15", "H1", "H4"],
  M15: ["H1", "H4"],
  H1: ["H4", "D1"],
  H4: ["D1"],
  D1: [],
};

export interface HTFConfluenceResult {
  isAligned: boolean;       // true if HTF trend matches entry direction
  confidence: number;       // 0-100 based on number of aligned HTFs
  htfTrend: "BULL" | "BEAR" | "SIDEWAYS";  // majority trend across HTFs
  details: string;          // human-readable explanation
}

class MultiTimeframeService {
  /**
   * Check if a trading signal on `timeframe` is aligned with higher timeframe trends.
   * @param preloadedRates Optional pre-fetched rate data to avoid duplicate MT5 API calls
   */
  async checkConfluence(
    symbol: string,
    timeframe: string,
    direction: "BUY" | "SELL",
    preloadedRates?: Map<string, Candle[]>,
  ): Promise<HTFConfluenceResult> {
    const higherTfs = TIMEFRAME_HIERARCHY[timeframe] || [];
    if (higherTfs.length === 0) {
      return { isAligned: true, confidence: 100, htfTrend: "SIDEWAYS", details: "No higher timeframe available" };
    }

    let alignedCount = 0;
    let totalChecked = 0;
    let bullTf = 0;
    let bearTf = 0;

    const entryDirection = direction === "BUY" ? "BULL" : "BEAR";

    for (const htf of higherTfs) {
      try {
        // Use preloaded data if available, otherwise fetch from MT5
        let candles: Candle[];
        const cacheKey = `${symbol}_${htf}`;
        if (preloadedRates?.has(cacheKey)) {
          candles = preloadedRates.get(cacheKey)!;
        } else {
          const rates = await mt5McpService.getRates(symbol, htf as any, 60);
          if (!rates || rates.length < 30) continue;
          candles = rates.map((r: any) => ({
            time: r.time, open: r.open, high: r.high, low: r.low, close: r.close,
          }));
        }

        if (candles.length < 30) continue;
        const closes = candles.map(c => c.close);

        // EMA cross trend detection
        const ema20 = this.calculateEMA(closes, 20);
        const ema50 = this.calculateEMA(closes, 50);

        const currentTrend = ema20 > ema50 ? "BULL" : "BEAR";

        if (currentTrend === "BULL") bullTf++;
        else bearTf++;

        // Check if entry direction aligns with HTF trend
        if (entryDirection === currentTrend) {
          alignedCount++;
        }
        totalChecked++;
      } catch {
        continue;
      }
    }

    const htfTrend: "BULL" | "BEAR" | "SIDEWAYS" = bullTf > bearTf ? "BULL" : bearTf > bullTf ? "BEAR" : "SIDEWAYS";
    const alignmentPct = totalChecked > 0 ? (alignedCount / totalChecked) * 100 : 100;
    const isAligned = alignmentPct >= 50;
    const confidence = Math.round(alignmentPct);

    return {
      isAligned,
      confidence,
      htfTrend,
      details: isAligned
        ? `${confidence}% HTF confluence (${alignedCount}/${totalChecked} timeframes aligned)`
        : `HTF conflict: entry ${direction} but ${htfTrend} trend on higher timeframes`,
    };
  }

  private calculateEMA(closes: number[], period: number): number {
    if (closes.length < period) return closes[closes.length - 1] || 0;
    const multiplier = 2 / (period + 1);
    let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < closes.length; i++) {
      ema = (closes[i] - ema) * multiplier + ema;
    }
    return ema;
  }
}

export const multiTimeframeService = new MultiTimeframeService();
