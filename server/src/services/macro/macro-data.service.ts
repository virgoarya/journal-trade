/**
 * Macro data service — facade.
 *
 * This is the ONLY public API surface for the macro data layer.
 * All existing consumers import from this module and must NOT change.
 *
 * Spec: docs/design/macro-data-layer-spec.md §11
 *
 * Internal architecture:
 * - providers/yahoo.provider.ts  → primary quotes
 * - providers/mt5.provider.ts    → fallback quotes (via MT5 MCP)
 * - providers/stooq.provider.ts  → fallback quotes (last resort)
 * - providers/fred.provider.ts   → yield curve & ON RRP series
 * - cache.ts                     → SWR cache (TTL + stale window)
 * - fallback.ts                  → orchestrator + backoff
 */
import axios from "axios";
import { env } from "../../config/env";
import { silentLogger } from "../../utils/silent-logger";
import { API_LIMITS } from "../../utils/rate-limiter";
import { MacroIndicator } from "../../models/MacroIndicator";
import { mt5StreamCache } from "../../mt5-streamer";

import {
  getCacheEntry,
  isStale,
  setCache,
} from "./cache";
import { getQuotesWithFallback } from "./fallback";
import { tradingviewCalendarProvider } from "./providers/tradingview.provider";
import { finnhubNewsProvider } from "./providers/finnhub.provider";
import { rssNewsProvider } from "./providers/rss.provider";
import type { MarketQuote, EconomicEvent, NewsItem, LiquidityData } from "./providers/types";

// Re-export types so existing imports from `../macro-data.service` keep working.
export type { MarketQuote, EconomicEvent, NewsItem, LiquidityData } from "./providers/types";

// ── Legacy cache helpers (backward compat for any direct import) ────────────

const cacheStore = new Map<string, { data: any; timestamp: number; ttl: number }>();

function getCache<T>(key: string): T | null {
  const entry = cacheStore.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > entry.ttl) {
    cacheStore.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCacheLegacy<T>(key: string, data: T, ttlMs: number): void {
  cacheStore.set(key, { data, timestamp: Date.now(), ttl: ttlMs });
}

// ── Rate limit helper ──────────────────────────────────────────────────────

async function fetchWithRateLimit<T>(
  limiter: typeof API_LIMITS[keyof typeof API_LIMITS],
  fetchFn: () => Promise<T>
): Promise<{ data: T | null; rateLimited: boolean }> {
  const { allowed, retryAfter } = await limiter.consume();
  if (!allowed) {
    return { data: null, rateLimited: true };
  }
  try {
    return { data: await fetchFn(), rateLimited: false };
  } catch (error) {
    silentLogger.error("API fetch error:", error);
    return { data: null, rateLimited: false };
  }
}

// ── SWR helper ─────────────────────────────────────────────────────────────

async function getWithSWR<T>(
  key: string,
  fetcher: () => Promise<{ data: T; source: string }>,
  ttl: number,
  staleWindow: number
): Promise<{ data: T; status: "live" | "stale"; source: string }> {
  const cached = getCacheEntry<T>(key);

  if (cached && !isStale(cached)) {
    return { data: cached.data, status: "live", source: cached.source };
  }

  if (cached && isStale(cached)) {
    // Stale — return stale data immediately + trigger background revalidation
    (async () => {
      try {
        const result = await fetcher();
        setCache(key, result.data, ttl, staleWindow, result.source);
        // Also update legacy cache for backward compat
        setCacheLegacy(key, result.data, ttl);
      } catch (e) {
        silentLogger.warn(`[SWR] Background revalidation failed for ${key}:`, e);
      }
    })();

    return { data: cached.data, status: "stale", source: cached.source };
  }

  // Cache miss — fetch synchronously
  const result = await fetcher();
  setCache(key, result.data, ttl, staleWindow, result.source);
  setCacheLegacy(key, result.data, ttl);
  return { data: result.data, status: "live", source: result.source };
}

// ── Public API ──────────────────────────────────────────────────────────────

export const macroDataService = {
  /**
   * Get quotes for given symbols.
   * Fallback chain: Yahoo → MT5 → Stooq.
   * TTL: 2 minutes, stale window: 1 minute.
   */
  async getQuotes(symbols: string[]): Promise<{
    data: MarketQuote[];
    fromCache: boolean;
    rateLimited: boolean;
  }> {
    const cacheKey = `quotes:${symbols.sort().join(",")}`;
    const cached = getCache<MarketQuote[]>(cacheKey);
    if (cached) {
      return { data: cached, fromCache: true, rateLimited: false };
    }

    const result = await getQuotesWithFallback(symbols);

    if (result.data.length > 0) {
      setCacheLegacy(cacheKey, result.data, 120_000);
    }
    return { data: result.data, fromCache: false, rateLimited: false };
  },

  /**
   * Get economic calendar events (TradingView).
   * TTL: 5 minutes, stale window: 2 minutes.
   */
  async getEconomicCalendar(): Promise<{
    data: EconomicEvent[];
    fromCache: boolean;
    rateLimited: boolean;
  }> {
    const cacheKey = "economic_calendar";
    const cached = getCache<EconomicEvent[]>(cacheKey);
    if (cached) {
      return { data: cached, fromCache: true, rateLimited: false };
    }

    const fetcher = async (): Promise<{ data: EconomicEvent[]; source: string }> => {
      try {
        const now = new Date();
        const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const to = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const countries = "US,EU,GB,JP,CN,AU,NZ,CA,CH";

        const events = await tradingviewCalendarProvider.fetchCalendar(from, to, countries);

        // Ingest into MongoDB (async, non-blocking)
        if (events.length > 0) {
          try {
            Promise.all(
              events
                .filter((e) => e.actual && e.actual.trim() !== "")
                .map(async (e) => {
                  const parsedActual = parseFloat(e.actual.replace(/[^0-9.-]/g, ""));
                  if (!isNaN(parsedActual)) {
                    await MacroIndicator.findOneAndUpdate(
                      { indicatorName: e.title, country: e.country, releaseDate: { $lte: new Date(e.date) } },
                      {
                        $set: {
                          actualValue: parsedActual,
                          releaseDate: new Date(e.date),
                        },
                      },
                      { upsert: true, returnDocument: "after" }
                    );
                  }
                })
            ).catch((err) => silentLogger.warn("Failed to ingest calendar events: " + err.message));
          } catch (err: any) {
            silentLogger.warn("Error ingesting calendar to DB: " + err.message);
          }
        }

        return { data: events, source: "tradingview" };
      } catch (error: any) {
        silentLogger.warn("TradingView fetch failed: " + error.message);
        return { data: [], source: "tradingview" };
      }
    };

    const swrResult = await getWithSWR<EconomicEvent[]>(
      cacheKey,
      fetcher,
      300_000,  // TTL 5 min
      120_000   // stale window 2 min
    );

    if (swrResult.data.length === 0 && swrResult.status === "live") {
      return { data: [], fromCache: false, rateLimited: true };
    }

    return {
      data: swrResult.data,
      fromCache: swrResult.status === "stale",
      rateLimited: false,
    };
  },

  /**
   * Get news from RSS + Finnhub.
   * TTL: 1 minute, stale window: 30 seconds.
   */
  async getNews(limit: number = 20): Promise<{
    data: NewsItem[];
    fromCache: boolean;
    rateLimited: boolean;
  }> {
    const cacheKey = "news_general";
    const cached = getCache<NewsItem[]>(cacheKey);
    if (cached) {
      return { data: cached, fromCache: true, rateLimited: false };
    }

    let allNews: NewsItem[] = [];
    let isRateLimited = false;

    // Fetch RSS via provider (gratis, fallback utama)
    const rssData = await rssNewsProvider.fetchNews(limit);
    if (rssData.length > 0) {
      allNews = [...allNews, ...rssData];
    }

    // Fetch Finnhub via provider (butuh API key)
    const finnData = await finnhubNewsProvider.fetchNews(limit);
    if (finnData.length > 0) {
      allNews = [...allNews, ...finnData];
      isRateLimited = false; // finnhub provider mengembalikan array kosong bila tidak ada key
    }

    if (allNews.length > 0) {
      allNews.sort((a, b) => b.datetime - a.datetime);
      const uniqueNews = Array.from(new Map(allNews.map((item) => [item.headline, item])).values());
      const slicedNews = uniqueNews.slice(0, limit);

      setCacheLegacy(cacheKey, slicedNews, 60_000);
      return { data: slicedNews, fromCache: false, rateLimited: false };
    }

    return { data: [], fromCache: false, rateLimited: isRateLimited };
  },

  /**
   * Get ON RRP liquidity data from FRED.
   * TTL: 10 minutes, stale window: 5 minutes.
   */
  async getLiquidity(): Promise<{
    data: LiquidityData | null;
    fromCache: boolean;
    rateLimited: boolean;
  }> {
    const cacheKey = "liquidity_onrrp";
    const cached = getCache<LiquidityData>(cacheKey);
    if (cached) {
      return { data: cached, fromCache: true, rateLimited: false };
    }

    const fredKey = env.FRED_API_KEY;
    if (!fredKey) {
      return { data: null, fromCache: false, rateLimited: false };
    }

    const { data, rateLimited } = await fetchWithRateLimit(API_LIMITS.FRED, async () => {
      const resp = await axios.get(
        "https://api.stlouisfed.org/fred/series/observations",
        {
          params: {
            series_id: "RRPONTSYD",
            api_key: fredKey,
            file_type: "json",
            sort_order: "desc",
            limit: 10,
          },
          timeout: 5000,
        }
      );

      const observations = resp.data?.observations ?? [];
      const parsed = observations
        .map((obs: any) => ({
          date: obs.date,
          value: parseFloat(obs.value),
        }))
        .filter((item: any) => !Number.isNaN(item.value));

      if (parsed.length < 2) return null;

      const current = parsed[0].value;
      const previous = parsed[1].value;
      const change = current - previous;
      const status: "INJECTING" | "DRAINING" | "UNKNOWN" =
        Math.abs(change) < 0.1 ? "UNKNOWN" : change > 0 ? "DRAINING" : "INJECTING";

      const history = parsed.slice(0, 7).map((item: any, idx: number) => {
        const prev = idx < parsed.length - 1 ? parsed[idx + 1].value : item.value;
        const dailyChange = item.value - prev;
        const dailyStatus: "INJECTING" | "DRAINING" | "UNKNOWN" =
          Math.abs(dailyChange) < 0.1
            ? "UNKNOWN"
            : dailyChange > 0
              ? "DRAINING"
              : "INJECTING";
        return { date: item.date, value: item.value, status: dailyStatus };
      });

      const result: LiquidityData = {
        value: current,
        change,
        status,
        date: parsed[0].date,
        trend: history.slice(0, 5).map((h: { status: "INJECTING" | "DRAINING" | "UNKNOWN" }) =>
          h.status === "DRAINING" ? "draining" : h.status === "INJECTING" ? "injecting" : "neutral"
        ),
        history,
      };
      return result;
    });

    if (data) {
      setCacheLegacy(cacheKey, data, 10 * 60 * 1000);
      return { data: data!, fromCache: false, rateLimited };
    }

    return { data: null, fromCache: false, rateLimited: true };
  },

  /**
   * Get yield curve spreads from FRED.
   * TTL: 10 minutes, stale window: 5 minutes.
   */
  async getYieldCurve(): Promise<{
    spread10y2y: number | null;
    spread10y3m: number | null;
    spread30y3m: number | null;
    inverted: boolean;
    fetchedAt: string | null;
    rateLimited: boolean;
  }> {
    const cacheKey = "yield_curve";
    const cached = getCache<{
      spread10y2y: number | null;
      spread10y3m: number | null;
      spread30y3m: number | null;
      inverted: boolean;
      fetchedAt: string;
    }>(cacheKey);
    if (cached) {
      return { ...cached, rateLimited: false };
    }

    const fredKey = env.FRED_API_KEY;
    if (!fredKey) {
      return { spread10y2y: null, spread10y3m: null, spread30y3m: null, inverted: false, fetchedAt: null, rateLimited: false };
    }

    const { data, rateLimited } = await fetchWithRateLimit(API_LIMITS.FRED, async () => {
      const [dgs3m, dgs2, dgs5, dgs10, dgs30] = await Promise.all([
        axios.get(`https://api.stlouisfed.org/fred/series/observations?series_id=DGS3MO&api_key=${fredKey}&file_type=json&sort_order=desc&limit=1`),
        axios.get(`https://api.stlouisfed.org/fred/series/observations?series_id=DGS2&api_key=${fredKey}&file_type=json&sort_order=desc&limit=1`),
        axios.get(`https://api.stlouisfed.org/fred/series/observations?series_id=DGS5&api_key=${fredKey}&file_type=json&sort_order=desc&limit=1`),
        axios.get(`https://api.stlouisfed.org/fred/series/observations?series_id=DGS10&api_key=${fredKey}&file_type=json&sort_order=desc&limit=1`),
        axios.get(`https://api.stlouisfed.org/fred/series/observations?series_id=DGS30&api_key=${fredKey}&file_type=json&sort_order=desc&limit=1`),
      ]);

      const parse = (resp: any): number | null => {
        const val = resp.data?.observations?.[0]?.value;
        return val && val !== "." ? parseFloat(val) : null;
      };

      const [y3m, y2, y5, y10, y30] = [
        parse(dgs3m),
        parse(dgs2),
        parse(dgs5),
        parse(dgs10),
        parse(dgs30),
      ];

      const spread10y2y = y10 !== null && y2 !== null ? Math.round((y10 - y2) * 100) : null;
      const spread10y3m = y10 !== null && y3m !== null ? Math.round((y10 - y3m) * 100) : null;
      const spread30y3m = y30 !== null && y3m !== null ? Math.round((y30 - y3m) * 100) : null;
      const inverted = spread10y2y !== null && spread10y2y < 0;

      return {
        spread10y2y,
        spread10y3m,
        spread30y3m,
        inverted,
        fetchedAt: new Date().toISOString(),
      };
    });

    if (data) {
      setCacheLegacy(cacheKey, data, 600_000);
      return { ...data, rateLimited: false };
    }

    return { spread10y2y: null, spread10y3m: null, spread30y3m: null, inverted: false, fetchedAt: null, rateLimited: true };
  },
};
