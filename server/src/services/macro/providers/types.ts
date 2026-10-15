/**
 * Shared types & provider interfaces for the macro data layer.
 * Spec: docs/design/macro-data-layer-spec.md §3
 */

// ── Data shapes (kept identical to the public API) ─────────────────────────

export interface MarketQuote {
  symbol: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  timestamp: number;
}

export interface EconomicEvent {
  title: string;
  country: string;
  date: string;
  impact: "High" | "Medium" | "Low";
  forecast: string;
  previous: string;
  actual: string;
  direction: "higher_is_better" | "lower_is_better" | "neutral";
}

export interface NewsItem {
  id: number | string;
  datetime: number;
  headline: string;
  summary?: string;
  source: string;
  analysis?: any;
}

export interface LiquidityData {
  value: number;
  change: number;
  status: "INJECTING" | "DRAINING" | "UNKNOWN";
  date: string;
  trend: ("injecting" | "draining" | "neutral")[];
  history: Array<{
    date: string;
    value: number;
    status: "INJECTING" | "DRAINING" | "UNKNOWN";
  }>;
}

export interface FredObservation {
  date: string;
  value: number;
}

// ── Provider interfaces ─────────────────────────────────────────────────────

export type QuoteProviderName = "yahoo" | "mt5" | "stooq";
export type SeriesProviderName = "fred";
export type CalendarProviderName = "tradingview";
export type NewsProviderName = "finnhub" | "rss";
export type CandleProviderName = "yahoo" | "stooq";

export interface IQuoteProvider {
  readonly name: QuoteProviderName;
  fetchQuotes(symbols: string[]): Promise<MarketQuote[]>;
}

export interface ISeriesProvider {
  readonly name: SeriesProviderName;
  fetchSeries(
    seriesId: string,
    options?: { limit?: number; sortOrder?: "asc" | "desc" }
  ): Promise<FredObservation[]>;
}

export interface ICalendarProvider {
  readonly name: CalendarProviderName;
  fetchCalendar(from: string, to: string, countries: string): Promise<EconomicEvent[]>;
}

export interface INewsProvider {
  readonly name: NewsProviderName;
  fetchNews(limit: number): Promise<NewsItem[]>;
}

export interface ICandleProvider {
  readonly name: CandleProviderName;
  fetchCandles(symbol: string, timeframe: string): Promise<CandleData[]>;
}

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
