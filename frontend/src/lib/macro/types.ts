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
  ema50: number;
  status: "ACCELERATING" | "DECELERATING";
  label: string;
}

export interface RegimeSnapshotData {
  quadrant: string;
  quadNumber: number;
  description: string;
  growth: RegimeMetricData;
  inflation: RegimeMetricData;
  liquidity: RegimeMetricData & { riskState: "HEALTHY" | "STRESSED" };
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

export function useMacroTypedData() {
  const { assets, liquidity, regimeData } = useMacroTerminal();

  return {
    assets,
    liquidity,
    regimeData,
  };
}
