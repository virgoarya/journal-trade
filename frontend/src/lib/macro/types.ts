// src/lib/macro/types.ts

// Raw inputs for macro score aggregation (exported for API use)
export interface MacroRawInputs {
  // Growth indicators (higher = better for growth)
  ismPmi: number[];
  joblessClaims: number[];
  nfp: number[];
  unemployment: number[];
  realGdp: number[];

  // Inflation indicators (higher = higher inflation)
  corePce: number[];
  supercore: number[];
  cpiYoY: number[];
  breakeven5y: number[];
  breakeven10y: number[];
}

export interface MacroInputs {
  /** Growth proxy (e.g., combined equity trend + PMI). Raw value can be adjusted. */
  growth: number; // >0 = expansion, <0 = contraction (e.g., monthly percent change)
  /** Inflation proxy (e.g., CPI YoY or breakeven inflation). */
  inflation: number; // in percent, e.g 3.2 = 3.2%
  /** Optional: as confirmation filter (does not alter core decision). */
  assetSignals?: {
    /** GLD up + UUP down supports Reflation */
    gldUp?: boolean;
    /** VIX up reinforces Stagflation/Deflation */
    vixUp?: boolean;
    /** IEF down (yield up) supports Reflation */
    iefDown?: boolean;
    /** FXY up (yen strength) can support Deflation */
    fxyUp?: boolean;
  };
}

export type MacroRegime = 'Reflation' | 'Stagflation' | 'Inflation' | 'Deflation' | 'Goldilocks' | 'Slowdown' | 'Neutral Transition';

export interface MacroRegimeResult {
  regime: MacroRegime;
  /** Short reason that can be shown to LLM as context */
  shortReason: string;
  /** Raw values used for decision (for debugging / unit test) */
  details: {
    growth: number;
    inflation: number;
    growthCategory: 'low' | 'high' | 'medium';
    inflationCategory: 'low' | 'high' | 'medium';
    assetSignals: NonNullable<MacroInputs['assetSignals']> | undefined;
    /** Confidence score between 0 and 1 */
    confidence: number;
  };
}

/* ---------- ON RRP ---------- */
export interface OnRrpInputs {
  /** Current ON RRP balance in trillions (e.g 2.1 = $2.1T). */
  currentBalance: number;
  /** Daily change in billions (e.g +0.15 = +$150M, -0.08 = -$80M). */
  deltaDaily: number; // in billions USD
}

export type OnRrpStatus = 'Draining' | 'Neutral' | 'Refilling';

export interface OnRrpResult {
  status: OnRrpStatus;
  shortReason: string;
  details: {
    currentBalance: number;
    deltaDaily: number;
    /** Threshold used (in billions) */
    thresholdUsed: number;
  };
}

/* ---------- Transition Alert ---------- */
export interface RegimeTransitionAlert {
  type: 'MACRO_REGIME_SHIFT';
  from: MacroRegime | null; // null when first time (no previous regime)
  to: MacroRegime;
  timestamp: string; // ISO 8601
}

/* ---------- Sentiment Mapping ---------- */
export type MarketSentiment = 'RISK-ON' | 'RISK-OFF' | 'NEUTRAL';