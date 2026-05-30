// src/lib/macro/types.ts
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

export type MacroRegime = 'Reflation' | 'Stagflation' | 'Inflation' | 'Deflation' | 'Goldilocks';

export interface MacroRegimeResult {
  regime: MacroRegime;
  /** Short reason that can be shown to LLM as context */
  shortReason: string;
  /** Raw values used for decision (for debugging / unit test) */
  details: {
    growth: number;
    inflation: number;
    growthCategory: 'low' | 'high';
    inflationCategory: 'low' | 'high';
    assetSignals: NonNullable<MacroInputs['assetSignals']> | undefined;
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