/**
 * Macro data layer — barrel export.
 * Facade: public API lives in ./macro-data.service.ts and is re-exported here.
 * Spec: docs/design/macro-data-layer-spec.md §2, §13
 */

// Types
export type {
  MarketQuote,
  EconomicEvent,
  NewsItem,
  LiquidityData,
  FredObservation,
  CandleData,
  IQuoteProvider,
  ISeriesProvider,
  ICalendarProvider,
  INewsProvider,
  ICandleProvider,
  QuoteProviderName,
  SeriesProviderName,
  CalendarProviderName,
  NewsProviderName,
  CandleProviderName,
} from "./providers/types";

// Providers
export { yahooProvider } from "./providers/yahoo.provider";
export { mt5Provider } from "./providers/mt5.provider";
export { stooqProvider } from "./providers/stooq.provider";
export { fredProvider } from "./providers/fred.provider";
export { tradingviewCalendarProvider } from "./providers/tradingview.provider";
export { finnhubNewsProvider } from "./providers/finnhub.provider";
export { rssNewsProvider } from "./providers/rss.provider";

// Cache
export {
  CacheEntry,
  getCacheEntry,
  isStale,
  setCache,
  invalidateCache,
  clearCache,
} from "./cache";
// Note: getCache as _legacyGetCache removed — not a cache.ts export

// Fallback
export { getQuotesWithFallback, withBackoff, QuoteResult } from "./fallback";

// Facade (public API — signature unchanged)
export { macroDataService } from "./macro-data.service";
