"use client";

import { useMacroTerminal } from "@/components/macro-terminal/MacroTerminalContext";

export interface QuoteApiResponse {
  success: boolean;
  data: {
    symbol: string;
    data: {
      dp?: number | null;
    };
  }[];
}

export interface NewsApiItem {
  id: number | string;
  datetime: number;
  headline: string;
  summary?: string;
}

export interface NewsApiResponse {
  success: boolean;
  data: NewsApiItem[];
}

export interface RegimeMetricData {
  current: number;
  ema10: number;
  ema50: number;
  roc5d: number;
  status: "ACCELERATING" | "DECELERATING" | "TURNING" | "NEUTRAL";
  pressure?: "HOT" | "NORMAL" | "COLD";
  label: string;
  subScores?: Record<string, { ratio?: number; value?: number | null; status: string }>;
}

export interface RegimeConfidenceData {
  score: number;
  conviction: number;
  agreement: number;
  persistence: number;
  label: "LOW" | "MODERATE" | "HIGH" | "VERY HIGH";
}

export interface RegimeSnapshotData {
  quadrant: string;
  quadNumber: number;
  description: string;
  growth: RegimeMetricData;
  inflation: RegimeMetricData;
  liquidity: RegimeMetricData & { riskState: "HEALTHY" | "STRESSED" };
  confidence: RegimeConfidenceData;
  position: { x: number; y: number };
  history: Array<{
    date: string;
    growthRatio: number;
    growthEma: number;
    inflationRatio: number;
    inflationEma: number;
    liquidityRatio: number;
    liquidityEma: number;
    quadrant: string;
  }>;
  fetchedAt: string;
  // Source fidelity & momentum indicators
  source?: string; // "YAHOO" | "CACHE"
  inflationSource?: string; // "FRED_CPI" | "TIP_IEF" | "UNKNOWN"
  cpiYoY?: number | null;
  momentum?: {
    growthStatus: "ACCELERATING" | "DECELERATING" | "TURNING" | "NEUTRAL";
    inflationStatus: "ACCELERATING" | "DECELERATING" | "TURNING" | "NEUTRAL";
  };
}


export interface MacroRawInputs {
  ismPmi: number[];
  joblessClaims: number[];
  unemployment: number[];
  nfp: number[];
  realGdp: number[];
  corePce: number[];
  supercore: number[];
  cpiYoY: number[];
  breakeven5y: number[];
  breakeven10y: number[];
}

// Legacy types for classifiers.ts compatibility
export type MacroInputs = {
  growth: number;
  inflation: number;
  assetSignals?: {
    gldUp?: boolean;
    vixUp?: boolean;
    iefDown?: boolean;
    fxyUp?: boolean;
  };
};

export type MacroRegime = 'Goldilocks' | 'Reflation' | 'Stagflation' | 'Deflation' | 'Transition';

export type MacroRegimeResult = {
  regime: MacroRegime;
  shortReason: string;
  details: {
    growth: number;
    inflation: number;
    growthCategory: 'low' | 'high' | 'medium';
    inflationCategory: 'low' | 'high' | 'medium';
    assetSignals?: MacroInputs['assetSignals'];
    confidence: number;
  };
};

export type OnRrpInputs = {
  deltaDaily: number;
  currentBalance: number;
};

export type OnRrpStatus = 'Neutral' | 'Draining' | 'Refilling';

export type OnRrpResult = {
  status: OnRrpStatus;
  shortReason: string;
  details: {
    currentBalance: number;
    deltaDaily: number;
    thresholdUsed: number;
  };
};

export type RegimeTransitionAlert = {
  type: 'MACRO_REGIME_SHIFT';
  from: MacroRegime | null;
  to: MacroRegime;
  timestamp: string;
};

export type MarketSentiment = 'RISK-ON' | 'RISK-OFF' | 'NEUTRAL';

export function useMacroTypedData() {
  const { assets, liquidity, regimeData } = useMacroTerminal();

  return {
    assets,
    liquidity,
    regimeData,
  };
}
