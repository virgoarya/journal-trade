import axios from "axios";
import { env } from "../config/env";
import { silentLogger } from "../utils/silent-logger";
import { API_LIMITS } from "../utils/rate-limiter";

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

function setCache<T>(key: string, data: T, ttlMs: number): void {
  cacheStore.set(key, { data, timestamp: Date.now(), ttl: ttlMs });
}

async function fetchWithRateLimit<T>(
  limiter: typeof API_LIMITS[keyof typeof API_LIMITS],
  fetchFn: () => Promise<T>,
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

export const macroDataService = {
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

    const finnhubKey = env.FINNHUB_API_KEY;
    const twelveDataKey = env.TWELVE_DATA_API_KEY;

    const fetchYahoo = async (syms: string[]) => {
      const results: MarketQuote[] = [];
      for (const symbol of syms) {
        try {
          const res = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`, { timeout: 5000 });
          const result = res.data?.chart?.result?.[0];
          const price = result?.meta?.regularMarketPrice;
          const prevClose = result?.meta?.chartPreviousClose ?? result?.meta?.previousClose;
          if (price != null) {
            const change = prevClose != null ? price - prevClose : 0;
            const changePercent = prevClose != null && prevClose !== 0 ? (change / prevClose) * 100 : 0;
            results.push({ symbol, price, change, changePercent, timestamp: Date.now() });
          } else {
            results.push({ symbol, price: null, change: null, changePercent: null, timestamp: 0 });
          }
        } catch {
          results.push({ symbol, price: null, change: null, changePercent: null, timestamp: 0 });
        }
      }
      return results;
    };

    if (!finnhubKey && !twelveDataKey) {
      const data = await fetchYahoo(symbols);
      if (data.length > 0) {
        setCache(cacheKey, data, 60000);
      }
      return { data, fromCache: false, rateLimited: false };
    }

    if (finnhubKey) {
      const { data, rateLimited } = await fetchWithRateLimit(API_LIMITS.FINNHUB, async () => {
        const results: MarketQuote[] = [];
        const yahooNeeded: string[] = [];
        
        for (const symbol of symbols) {
          if (symbol === "CL=F" || symbol === "GC=F" || symbol.includes("=F")) {
            yahooNeeded.push(symbol);
            continue;
          }
          try {
            const resp = await axios.get(
              `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${finnhubKey}`,
              { timeout: 5000 }
            );
            results.push({
              symbol,
              price: resp.data.c,
              change: resp.data.d,
              changePercent: resp.data.dp,
              timestamp: resp.data.t * 1000,
            });
          } catch {
            results.push({ symbol, price: null, change: null, changePercent: null, timestamp: 0 });
          }
        }

        if (yahooNeeded.length > 0) {
          const yahooRes = await fetchYahoo(yahooNeeded);
          results.push(...yahooRes);
        }

        return results;
      });
      if (data) {
        setCache(cacheKey, { data, rateLimited }, 60000);
        return { data: data!, fromCache: false, rateLimited };
      }
    }

    if (twelveDataKey) {
      const { data, rateLimited } = await fetchWithRateLimit(API_LIMITS.TWELVE_DATA, async () => {
        const results: MarketQuote[] = [];
        for (const symbol of symbols) {
          try {
            const resp = await axios.get(
              `https://api.twelvedata.com/price?symbol=${symbol}&apikey=${twelveDataKey}`,
              { timeout: 5000 }
            );
            results.push({
              symbol,
              price: parseFloat(resp.data.price),
              change: null,
              changePercent: null,
              timestamp: Date.now(),
            });
          } catch {
            results.push({ symbol, price: null, change: null, changePercent: null, timestamp: 0 });
          }
        }
        return results;
      });
      if (data) {
        setCache(cacheKey, data, 60000);
        return { data: data!, fromCache: false, rateLimited };
      }
    }

    return { data: [], fromCache: false, rateLimited: true };
  },

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

    try {
      const now = new Date();
      const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const to = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const countries = "US,EU,GB,JP,CN,AU,NZ,CA,CH";
      
      const url = `https://economic-calendar.tradingview.com/events?from=${from}&to=${to}&countries=${countries}`;
      
      const resp = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Origin": "https://www.tradingview.com"
        },
        timeout: 10000
      });

      const events: EconomicEvent[] = [];
      const seenIds = new Set<string>();

      if (resp.data && Array.isArray(resp.data.result)) {
        for (const item of resp.data.result) {
          if (item.importance < 0) continue; // skip non-economic/holidays
          
          let impact: "High" | "Medium" | "Low" = "Low";
          if (item.importance === 1) impact = "High";
          else if (item.importance === 0) impact = "Medium";

          const isoDate = item.date || item.referenceDate || new Date().toISOString();
          const eventId = `${item.title}-${item.country}-${isoDate}`;

          if (!seenIds.has(eventId)) {
            seenIds.add(eventId);
            
            const formatVal = (v: any) => {
              if (v == null) return "";
              if (item.unit === "%") return `${v}%`;
              if (item.unit) return `${v} ${item.unit}`;
              return `${v}`;
            };
            
            events.push({
              title: item.title,
              country: item.country,
              date: isoDate,
              impact,
              forecast: formatVal(item.forecast),
              previous: formatVal(item.previous),
              actual: formatVal(item.actual),
              direction: "neutral",
            });
          }
        }
      }

      if (events.length > 0) {
        setCache(cacheKey, events, 300000);
        return { data: events, fromCache: false, rateLimited: false };
      }
    } catch (error: any) {
      silentLogger.warn("TradingView fetch failed: " + error.message);
    }

    return { data: [], fromCache: false, rateLimited: true };
  },

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

    const finnhubKey = env.FINNHUB_API_KEY;
    const kobeissiRSS = "https://api.rss2json.com/v1/api.json?rss_url=https://nitter.net/KobeissiLetter/rss";
    const reutersRSS = "https://api.rss2json.com/v1/api.json?rss_url=https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best";
    
    let allNews: NewsItem[] = [];
    let isRateLimited = false;

    // Fetch RSS feeds
    try {
      const fetchRss = async (url: string, sourceName: string) => {
        try {
          const resp = await axios.get(url, { timeout: 10000 });
          return resp.data?.items?.map((item: any) => ({
            id: item.guid || item.link || Math.random().toString(),
            datetime: Math.floor(new Date(item.pubDate).getTime() / 1000),
            headline: item.title || item.content?.substring(0, 100),
            summary: item.content,
            source: sourceName,
          })) ?? [];
        } catch {
          return [];
        }
      };

      const { data: rssData } = await fetchWithRateLimit(API_LIMITS.RSS_BRIDGE, async () => {
        const [kobeissi, reuters] = await Promise.all([
          fetchRss(kobeissiRSS, "KobeissiLetter"),
          fetchRss(reutersRSS, "Reuters"),
        ]);
        return [...kobeissi, ...reuters];
      });

      if (rssData && rssData.length > 0) {
        allNews = [...allNews, ...rssData];
      }
    } catch (e) {
      silentLogger.warn("RSS feeds fetch failed");
    }

    // Fetch Finnhub
    if (finnhubKey) {
      const { data: finnData, rateLimited } = await fetchWithRateLimit(API_LIMITS.FINNHUB, async () => {
        const resp = await axios.get(
          `https://finnhub.io/api/v1/news?category=general&token=${finnhubKey}`,
          { timeout: 5000 }
        );
        return resp.data.slice(0, limit).map((item: any) => ({
          id: item.id,
          datetime: item.datetime,
          headline: item.headline,
          summary: item.summary,
          source: "Finnhub",
        }));
      });

      if (finnData && finnData.length > 0) {
        allNews = [...allNews, ...finnData];
      }
      isRateLimited = isRateLimited || rateLimited;
    }

    if (allNews.length > 0) {
      // Sort by datetime descending
      allNews.sort((a, b) => b.datetime - a.datetime);
      const uniqueNews = Array.from(new Map(allNews.map(item => [item.headline, item])).values());
      const slicedNews = uniqueNews.slice(0, limit);
      
      setCache(cacheKey, slicedNews, 60000);
      return { data: slicedNews, fromCache: false, rateLimited: false };
    }

    return { data: [], fromCache: false, rateLimited: isRateLimited };
  },

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
      const status: "INJECTING" | "DRAINING" | "UNKNOWN" = Math.abs(change) < 0.1 ? "UNKNOWN" : change > 0 ? "DRAINING" : "INJECTING";

      const history = parsed.slice(0, 7).map((item: any, idx: number) => {
        const prev = idx < parsed.length - 1 ? parsed[idx + 1].value : item.value;
        const dailyChange = item.value - prev;
        const dailyStatus: "INJECTING" | "DRAINING" | "UNKNOWN" = Math.abs(dailyChange) < 0.1
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
      setCache(cacheKey, data, 3600000);
      return { data: data!, fromCache: false, rateLimited };
    }

    return { data: null, fromCache: false, rateLimited: true };
  },

  async getYieldCurve(): Promise<{
    spread10y2y: number | null;
    spread10y3m: number | null;
    spread30y3m: number | null;
    inverted: boolean;
    fetchedAt: string | null;
    rateLimited: boolean;
  }> {
    const cacheKey = "yield_curve";
    const cached = getCache<{ spread10y2y: number | null; spread10y3m: number | null; spread30y3m: number | null; inverted: boolean; fetchedAt: string }>(cacheKey);
    if (cached) {
      return { ...cached, rateLimited: false };
    }

    const fredKey = env.FRED_API_KEY;
    if (!fredKey) {
      return { spread10y2y: null, spread10y3m: null, spread30y3m: null, inverted: false, fetchedAt: null, rateLimited: false };
    }

    const { data, rateLimited } = await fetchWithRateLimit(API_LIMITS.FRED, async () => {
      const [dgs2, dgs5, dgs10, dgs30] = await Promise.all([
        axios.get(`https://api.stlouisfed.org/fred/series/observations?series_id=DGS2&api_key=${fredKey}&file_type=json&sort_order=desc&limit=1`),
        axios.get(`https://api.stlouisfed.org/fred/series/observations?series_id=DGS5&api_key=${fredKey}&file_type=json&sort_order=desc&limit=1`),
        axios.get(`https://api.stlouisfed.org/fred/series/observations?series_id=DGS10&api_key=${fredKey}&file_type=json&sort_order=desc&limit=1`),
        axios.get(`https://api.stlouisfed.org/fred/series/observations?series_id=DGS30&api_key=${fredKey}&file_type=json&sort_order=desc&limit=1`),
      ]);

      const parse = (resp: any): number | null => {
        const val = resp.data?.observations?.[0]?.value;
        return val && val !== "." ? parseFloat(val) : null;
      };

      const [y2, y5, y10, y30] = [parse(dgs2), parse(dgs5), parse(dgs10), parse(dgs30)];

      const spread10y2y = y10 !== null && y2 !== null ? Math.round((y10 - y2) * 100) : null;
      const spread10y3m = y10 !== null ? Math.round((y10 - 3.5) * 100) : null;
      const spread30y3m = y30 !== null ? Math.round((y30 - 3.5) * 100) : null;
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
      setCache(cacheKey, data, 600000);
      return { ...data, rateLimited: false };
    }

    return { spread10y2y: null, spread10y3m: null, spread30y3m: null, inverted: false, fetchedAt: null, rateLimited: true };
  },
};