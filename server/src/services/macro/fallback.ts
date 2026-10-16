/**
 * Fallback chain orchestrator for the macro data layer.
 * Spec: docs/design/macro-data-layer-spec.md §4
 */
import { silentLogger } from "../../utils/silent-logger";
import { MarketQuote } from "./providers/types";
import { yahooProvider } from "./providers/yahoo.provider";
import { mt5Provider } from "./providers/mt5.provider";
import { stooqProvider } from "./providers/stooq.provider";

export interface QuoteResult {
  data: MarketQuote[];
  source: string;
  status: "live" | "fallback";
}

/**
 * Quotes fallback chain: Yahoo → MT5 → Stooq.
 * Per-symbol: Yahoo first, then MT5 for failures, then Stooq for remaining.
 */
export async function getQuotesWithFallback(symbols: string[]): Promise<QuoteResult> {
  // 1. Yahoo (primary)
  const yahooResults = await yahooProvider.fetchQuotes(symbols);
  const failedSymbols = yahooResults.filter((q) => q.price === null).map((q) => q.symbol);

  if (failedSymbols.length === 0) {
    return { data: yahooResults, source: "yahoo", status: "live" };
  }

  // 2. MT5 fallback (per-symbol)
  const merged = [...yahooResults];
  const mt5Results = await mt5Provider.fetchQuotes(failedSymbols);
  for (const mt5q of mt5Results) {
    const idx = merged.findIndex((q) => q.symbol === mt5q.symbol);
    if (idx !== -1 && mt5q.price !== null) {
      merged[idx] = mt5q;
    }
  }

  const stillFailed = merged.filter((q) => q.price === null).map((q) => q.symbol);
  if (stillFailed.length === 0) {
    const usedMt5 = merged.some((q, i) => q.price !== null && yahooResults[i].price === null);
    return { data: merged, source: usedMt5 ? "mt5" : "yahoo", status: usedMt5 ? "fallback" : "live" };
  }

  // 3. Stooq fallback (remaining symbols)
  const stooqResults = await stooqProvider.fetchQuotes(stillFailed);
  for (const sq of stooqResults) {
    const idx = merged.findIndex((q) => q.symbol === sq.symbol);
    if (idx !== -1 && sq.price !== null) {
      merged[idx] = sq;
    }
  }

  return { data: merged, source: "stooq", status: "fallback" };
}

/**
 * Exponential backoff helper.
 */
export async function withBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      const delay = baseDelayMs * Math.pow(2, attempt);
      silentLogger.warn(`[Backoff] Attempt ${attempt + 1} failed, retrying in ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}
