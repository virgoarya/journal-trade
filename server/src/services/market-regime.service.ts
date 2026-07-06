import type { Candle } from "./ai-trading-engine.service";

export type MarketRegime = "TRENDING_BULL" | "TRENDING_BEAR" | "RANGING" | "HIGH_VOLATILITY";

export interface RegimeResult {
  regime: MarketRegime;
  adx: number;
  volatility: number;        // ATR / Close × 100 (volatility %)
  isSqueeze: boolean;         // Bollinger Band squeeze
  direction: "BULL" | "BEAR" | "SIDEWAYS";
  confidence: number;         // 0-100
}

class MarketRegimeService {
  private readonly ADX_PERIOD = 14;
  private readonly BB_PERIOD = 20;
  private readonly BB_STDDEV = 2;
  private readonly ATR_PERIOD = 14;

  /**
   * Analyze market regime from recent candles.
   * Returns TRENDING_BULL/BEAR/RANGING/HIGH_VOLATILITY with confidence score.
   */
  analyze(candles: Candle[]): RegimeResult {
    if (candles.length < Math.max(this.ADX_PERIOD * 2, this.BB_PERIOD + this.ATR_PERIOD)) {
      return { regime: "RANGING", adx: 0, volatility: 0, isSqueeze: false, direction: "SIDEWAYS", confidence: 0 };
    }

    const closes = candles.map(c => c.close);
    const adx = this.calculateADX(candles);
    const { upper, lower, middle } = this.calculateBollingerBands(closes);
    const latestClose = closes[closes.length - 1];
    const atr = this.calculateATR(candles);
    const volatility = latestClose > 0 ? (atr / latestClose) * 100 : 0;

    // Bollinger squeeze: bandwidth < threshold
    const bandwidth = (upper - lower) / middle;
    const isSqueeze = bandwidth < 0.05; // Less than 5% bandwidth = squeeze

    // ATR spike: current ATR is 1.5× average of last 10 periods
    const recentATRs = this.calculateRecentATRs(candles);
    const avgATR = recentATRs.reduce((a, b) => a + b, 0) / recentATRs.length;
    const isHighVol = avgATR > 0 && atr > avgATR * 1.5;

    // Direction: compare EMA cross or linear regression slope
    const ema10 = this.calculateEMA(closes, 10);
    const ema30 = this.calculateEMA(closes, 30);
    const direction = ema10 > ema30 ? "BULL" : ema10 < ema30 ? "BEAR" : "SIDEWAYS";

    // Determine regime
    let regime: MarketRegime;
    let confidence = 0;

    if (isHighVol && adx > 25) {
      // Trending with high volatility
      regime = direction === "BULL" ? "TRENDING_BULL" : "TRENDING_BEAR";
      confidence = Math.min(100, Math.round(adx * 1.5));
    } else if (isSqueeze && adx < 25) {
      regime = "RANGING";
      confidence = Math.min(100, Math.round((1 - bandwidth / 0.05) * 80));
    } else if (adx >= 25) {
      // Trending but normal volatility
      regime = direction === "BULL" ? "TRENDING_BULL" : "TRENDING_BEAR";
      confidence = Math.min(100, Math.round(adx * 1.2));
    } else if (isHighVol) {
      regime = "HIGH_VOLATILITY";
      confidence = Math.min(100, Math.round((atr / avgATR) * 60));
    } else {
      regime = "RANGING";
      confidence = Math.min(100, Math.round((25 - adx) * 2));
    }

    return { regime, adx: Math.round(adx * 100) / 100, volatility: Math.round(volatility * 100) / 100, isSqueeze, direction, confidence };
  }

  /**
   * Get methodology weight multipliers for current regime.
   * Trending: boost SMC/ICT/LIT, reduce CRT/MSNR
   * Ranging: boost CRT/MSNR, reduce SMC/ICT
   * High Vol: reduce all weights (reduce trade frequency)
   */
  getRegimeMultipliers(regime: MarketRegime): Record<string, number> {
    const multipliers: Record<string, number> = {
      smc: 1.0, ict: 1.0, msnr: 1.0, crt: 1.0, quarterly: 1.0, lit: 1.0, rsiEngulf: 1.0,
    };

    switch (regime) {
      case "TRENDING_BULL":
      case "TRENDING_BEAR":
        multipliers.smc = 1.3;
        multipliers.ict = 1.2;
        multipliers.lit = 1.2;
        multipliers.crt = 0.6;
        multipliers.msnr = 0.7;
        break;
      case "RANGING":
        multipliers.crt = 1.3;
        multipliers.msnr = 1.2;
        multipliers.smc = 0.7;
        multipliers.ict = 0.8;
        break;
      case "HIGH_VOLATILITY":
        multipliers.smc = 0.5;
        multipliers.ict = 0.5;
        multipliers.crt = 0.5;
        multipliers.msnr = 0.5;
        multipliers.lit = 0.5;
        multipliers.rsiEngulf = 0.3;
        break;
    }

    return multipliers;
  }

  // ── Private helpers ────────────────────────────────────────────────

  private calculateADX(candles: Candle[]): number {
    const period = this.ADX_PERIOD;
    if (candles.length < period * 2) return 25;

    const tr: number[] = [];
    const plusDM: number[] = [];
    const minusDM: number[] = [];

    for (let i = 1; i < candles.length; i++) {
      const high = candles[i].high;
      const low = candles[i].low;
      const prevClose = candles[i - 1].close;
      const prevHigh = candles[i - 1].high;
      const prevLow = candles[i - 1].low;

      tr.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
      plusDM.push(high - prevHigh > prevLow - low ? Math.max(high - prevHigh, 0) : 0);
      minusDM.push(prevLow - low > high - prevHigh ? Math.max(prevLow - low, 0) : 0);
    }

    const atr = tr.slice(-period).reduce((a, b) => a + b, 0) / period;
    const avgPlusDM = plusDM.slice(-period).reduce((a, b) => a + b, 0) / period;
    const avgMinusDM = minusDM.slice(-period).reduce((a, b) => a + b, 0) / period;

    const plusDI = atr > 0 ? (avgPlusDM / atr) * 100 : 0;
    const minusDI = atr > 0 ? (avgMinusDM / atr) * 100 : 0;
    const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI || 1) * 100;

    return dx;
  }

  private calculateBollingerBands(closes: number[]): { upper: number; lower: number; middle: number } {
    const period = this.BB_PERIOD;
    const recent = closes.slice(-period);
    const middle = recent.reduce((a, b) => a + b, 0) / recent.length;
    const variance = recent.reduce((sum, v) => sum + (v - middle) ** 2, 0) / recent.length;
    const stdDev = Math.sqrt(variance);

    return {
      upper: middle + stdDev * this.BB_STDDEV,
      lower: middle - stdDev * this.BB_STDDEV,
      middle,
    };
  }

  private calculateATR(candles: Candle[]): number {
    const period = this.ATR_PERIOD;
    let trSum = 0;
    const start = Math.max(1, candles.length - period - 1);
    for (let i = start + 1; i < candles.length; i++) {
      const high = candles[i].high;
      const low = candles[i].low;
      const prevClose = candles[i - 1].close;
      trSum += Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    }
    const count = Math.min(period, candles.length - 1);
    return count > 0 ? trSum / count : 0;
  }

  private calculateRecentATRs(candles: Candle[]): number[] {
    const atrs: number[] = [];
    for (let start = Math.max(1, candles.length - 30); start < candles.length - this.ATR_PERIOD; start++) {
      let sum = 0;
      for (let i = start; i < start + this.ATR_PERIOD; i++) {
        const high = candles[i].high;
        const low = candles[i].low;
        const prevClose = candles[i - 1].close;
        sum += Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
      }
      atrs.push(sum / this.ATR_PERIOD);
    }
    return atrs;
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

export const marketRegimeService = new MarketRegimeService();
