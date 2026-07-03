export interface CotItem {
  symbol: string;
  name: string;
  category: string;
  sentiment: string;
  commercialLong: number;
  commercialShort: number;
  commercialSpread: number;
  nonCommercialLong: number;
  nonCommercialShort: number;
  nonCommercialSpread: number;
  retailLong: number;
  retailShort: number;
  retailSpread: number;
  lastUpdate: string;
  phase?: MarketPhase;
}

export interface CotAnalysis {
  momentum: string;
  warnings: string;
  conclusion: string;
}

export interface MarketPhase {
  label: "MARK UP" | "DISTRIBUTION" | "MARK DOWN" | "ACCUMULATION" | "NEUTRAL";
  color: "green" | "yellow" | "red" | "blue" | "gray";
  isWarning: boolean;
}

/** Raw shape returned by the CFTC/backend COT API */
export interface RawCotResponse {
  symbol: string;
  name: string;
  type: string;
  commercial_long: number;
  commercial_short: number;
  non_commercial_long: number;
  non_commercial_short: number;
  last_update?: string;
}

/** Processed/transformed COT data for display */
export interface TransformedCotData {
  symbol: string;
  name: string;
  type: "commodity" | "currency" | "index";
  commercialLong: number;
  commercialShort: number;
  nonCommercialLong: number;
  nonCommercialShort: number;
  commercialSpread: number;
  nonCommercialSpread: number;
  sentiment: "BULLISH" | "BEARISH" | "NEUTRAL";
  lastUpdate: string;
}