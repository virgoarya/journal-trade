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

  // Enhanced COT analysis fields
  cotIndexSM?: number;        // COT Index Smart Money 0–100
  cotIndexLS?: number;        // COT Index Large Specs 0–100
  wowDeltaSM?: number;        // WoW change Smart Money
  wowDeltaLS?: number;        // WoW change Large Specs
  openInterest?: number;      // Total open interest
  dbs?: number;              // Direction Bias Score -10..+10
  directionBias?: string;    // STRONG_BULLISH .. STRONG_BEARISH
  divergence?: boolean;      // true if SM sign ≠ LS sign
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