// ─── Position Sizing Service ─────────────────────────────────────────
// Converts confidence-weighted signals into trade size based on account
// risk parameters, volatility, and methodology alignment.

export interface RiskParams {
  accountBalance: number;
  maxRiskPerTrade: number; // % of account, e.g. 0.01 = 1%
  maxDailyRisk: number; // % of account, e.g. 0.03 = 3%
  dailyLoss: number; // accumulated loss today
  atrMultiplier: number; // ATR × this for SL distance
}

export interface PositionSizeResult {
  units: number;
  riskAmount: number;
  riskPercent: number;
  slDistance: number;
  confidenceAdjusted: boolean;
}

const DEFAULT_RISK: RiskParams = {
  accountBalance: 10000,
  maxRiskPerTrade: 0.01,
  maxDailyRisk: 0.03,
  dailyLoss: 0,
  atrMultiplier: 1.5,
};

class PositionSizingService {
  /**
   * Calculate position size from signal confidence, ATR, and risk params.
   * Scales down linearly when confidence < 70, caps at 95.
   */
  calculate(
    confidence: number,
    entryPrice: number,
    stopPrice: number,
    params: Partial<RiskParams> = {},
  ): PositionSizeResult {
    const risk = { ...DEFAULT_RISK, ...params };

    const slDistance = Math.abs(entryPrice - stopPrice);
    if (slDistance <= 0 || entryPrice <= 0) {
      return { units: 0, riskAmount: 0, riskPercent: 0, slDistance: 0, confidenceAdjusted: false };
    }

    // Daily risk check
    const remainingDaily = risk.maxDailyRisk - (risk.dailyLoss / risk.accountBalance);
    if (remainingDaily <= 0) {
      return { units: 0, riskAmount: 0, riskPercent: 0, slDistance: 0, confidenceAdjusted: false };
    }

    // Confidence-based scaling (50-70 = 50% risk, 70-90 = 75%, 90+ = 100%)
    const confidenceScale = Math.min(1, Math.max(0.3, (confidence - 40) / 50));

    // Base risk amount
    let riskAmount = risk.accountBalance * risk.maxRiskPerTrade * confidenceScale;

    // Cap by daily remaining
    riskAmount = Math.min(riskAmount, risk.accountBalance * remainingDaily);

    // Units = riskAmount / slDistance (assume 1:1 unit pricing)
    const units = riskAmount / slDistance;
    const riskPercent = (riskAmount / risk.accountBalance) * 100;

    return {
      units: Math.round(units * 100) / 100,
      riskAmount: Math.round(riskAmount * 100) / 100,
      riskPercent: Math.round(riskPercent * 100) / 100,
      slDistance: Math.round(slDistance * 100000) / 100000,
      confidenceAdjusted: confidenceScale < 1,
    };
  }

  getDefaultParams(): RiskParams {
    return { ...DEFAULT_RISK };
  }
}

export const positionSizingService = new PositionSizingService();
