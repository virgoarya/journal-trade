import { env } from "../config/env";
import axios from "axios";
import { notificationService } from "./notification.service";
import yahooFinance from "yahoo-finance2";

// In-memory cache to prevent hitting rate limits
const cache: Record<string, { data: any; timestamp: number }> = {};
const CACHE_TTL_MS = 60000; // 60 seconds
const lastClose: Record<string, number> = {};
const lastCloseTimestamp: Record<string, number> = {};
const LAST_CLOSE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const INVALID_PRICE_THRESHOLD = 0.01; // Reject prices below this as invalid

export const marketDataService = {
  async getNews() {
    const key = process.env.FINNHUB_API_KEY;
    if (!key) {
      throw new Error("FINNHUB_API_KEY is not configured");
    }

    const cacheKey = "news_general";
    if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_TTL_MS) {
      return cache[cacheKey].data;
    }

    try {
      // Fetch general market news
      const response = await axios.get(`https://finnhub.io/api/v1/news?category=general&token=${key}`, {
        timeout: 5000
      });
      
      const data = response.data.slice(0, 10); // Take top 10 news
      
      // Update cache
      cache[cacheKey] = {
        data: data,
        timestamp: Date.now(),
      };
      
      return data;
    } catch (error: any) {
      console.error("Finnhub News API Error:", error.message);
      throw new Error("Failed to fetch live news");
    }
  },

  async getQuotes(symbols: string[]) {
    if (!symbols || symbols.length === 0) {
      return [];
    }

    try {
      const quoteData: { symbol: string; data: { dp: number | null } }[] = [];

      for (const symbol of symbols) {
        try {
          const yahooSymbol = symbol === "VIXY" ? "^VIX" : symbol;
          const quote: any = await yahooFinance.quote(yahooSymbol);

          const rawChangePercent = quote.regularMarketChangePercent;
          let dp: number | null = null;

          if (typeof rawChangePercent === "number" && Number.isFinite(rawChangePercent)) {
            dp = parseFloat(rawChangePercent.toFixed(2));
          }

          quoteData.push({ symbol, data: { dp } });
        } catch (symbolError) {
          console.warn(`Yahoo Finance Quotes API Error for ${symbol}:`, (symbolError as any)?.message);
          quoteData.push({ symbol, data: { dp: null } });
        }
      }

      return quoteData;
    } catch (error: any) {
      console.error("Yahoo Finance Quotes API Error:", error.message);
      return symbols.map((symbol) => ({ symbol, data: { dp: null } }));
    }
  },

  async getLiquidity() {
    const key = env.FRED_API_KEY;
    if (!key) {
      // If no FRED API key is configured, return dummy data for development
      const cacheKey = "liquidity_onrrp";
      // Cache for 1 hour to avoid generating dummy data too frequently
      if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < 3600000) {
        return cache[cacheKey].data;
      }

      const dummyData = {
        value: 2000, // Represents $2.0 trillion (since panel divides by 1000 to show trillions)
        change: 0,
        status: "UNKNOWN" as const,
        date: new Date().toISOString().split('T')[0]
      };

      // Update cache
      cache[cacheKey] = {
        data: dummyData,
        timestamp: Date.now(),
      };
      
      return dummyData;
    }

    const cacheKey = "liquidity_onrrp";
    // Cache for 1 hour since FRED updates daily
    if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < 3600000) {
      return cache[cacheKey].data;
    }

    // Function to fetch with exponential backoff retry
    const fetchLiquidityWithRetry = async (retryCount: number = 0): Promise<any> => {
      try {
        const response = await axios.get(`https://api.stlouisfed.org/fred/series/observations?series_id=RRPONTSYD&api_key=${key}&file_type=json&sort_order=desc&limit=2`, {
          timeout: 5000
        });
        return response;
      } catch (error: any) {
        console.error(`[FRED Liquidity] Error fetching: ${error.message}`);
        if (error.config) {
          console.error(`[FRED Liquidity] URL: ${error.config.url}`);
        }
        if (error.response?.status === 429 && retryCount < 3) {
          const delay = Math.pow(2, retryCount) * 1000 + Math.random() * 1000;
          console.log(`[FRED Liquidity] Rate limited, retrying in ${delay}ms (attempt ${retryCount + 1}/3)`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return fetchLiquidityWithRetry(retryCount + 1);
        }
        throw error;
      }
    };

    try {
      const response = await fetchLiquidityWithRetry();
      
      const observations = response.data.observations;
      if (!observations || observations.length < 2) {
        throw new Error("Insufficient data from FRED");
      }

      const current = parseFloat(observations[0].value);
      const previous = parseFloat(observations[1].value);
      const change = current - previous;
      // If ON RRP value increases, money is flowing TO Fed overnight (DRAINING market liquidity)
      // If ON RRP value decreases, money is flowing FROM Fed overnight (INJECTING market liquidity)
      const status = change > 0 ? "DRAINING" : "INJECTING";
      
      const data = {
        value: current,
        change: change,
        status: status,
        date: observations[0].date
      };

      // Check if this is a significant change and create notification
      try {
        const previousCached = cache[cacheKey];
        const prevValue = previousCached ? parseFloat(previousCached.data?.value) : null;
        
        // Only create notification if there's a change (first time or new change)
        if (prevValue !== null && prevValue !== current) {
          const absChange = Math.abs(current - prevValue);
          // Only notify if change is significant (> $0.1B)
          if (absChange > 0.1) {
            const isDraining = change > 0;
            await notificationService.create({
              userId: "system",
              type: isDraining ? "RISK_WARNING" : "SYSTEM",
              title: isDraining 
                ? "⚠️ Institutional Liquidity Draining" 
                : "🚀 Institutional Liquidity Injecting",
              message: isDraining
                ? `Dana ON RRP meningkat sebesar $${absChange.toFixed(2)}B. Institusi memarkir uang ke Fed, likuiditas pasar berpotensi mengetat.`
                : `Dana ON RRP menurun sebesar $${absChange.toFixed(2)}B. Likuiditas kembali disuntikkan ke pasar bursa!`,
              metadata: {
                currentValue: current,
                previousValue: prevValue,
                change: change,
                status: status,
                source: "FRED_ON_RRP"
              }
            });
          }
        }
      } catch (notifyError) {
        console.error("Failed to create liquidity notification:", (notifyError as any)?.message);
      }

      // Update cache
      cache[cacheKey] = {
        data: data,
        timestamp: Date.now(),
      };
      
      return data;
    } catch (error: any) {
      console.error("FRED API Error:", error.message);
      throw new Error("Failed to fetch ON RRP liquidity data");
    }
  }
};