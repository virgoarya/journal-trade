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

export interface CotApiResponse {
  success: boolean;
  data: TransformedCotData[];
  fetchedAt: string;
}