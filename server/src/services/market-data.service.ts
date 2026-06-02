import { env } from "../config/env";
import axios from "axios";
import { notificationService } from "./notification.service";

// In-memory cache to prevent hitting rate limits
const cache: Record<string, { data: any; timestamp: number }> = {};
const CACHE_TTL_MS = 60000; // 60 seconds

export interface LiquidityData {
  value: number;
  change: number;
  status: "INJECTING" | "DRAINING" | "UNKNOWN";
  date: string;
  trend: ("injecting" | "draining")[];
  history: Array<{ date: string; value: number; status: "INJECTING" | "DRAINING" | "UNKNOWN" }>;
}

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
      const response = await axios.get(`https://finnhub.io/api/v1/news?category=general&token=${key}`, {
        timeout: 5000,
      });

      const data = response.data.slice(0, 10);

      cache[cacheKey] = {
        data,
        timestamp: Date.now(),
      };

      return data;
    } catch (error: any) {
      console.error("Finnhub News API Error:", error.message);
      throw new Error("Failed to fetch live news");
    }
  },

  async getQuotes(symbols: string[]) {
    const key = process.env.FINNHUB_API_KEY;
    if (!key) {
      return symbols.map((symbol) => ({ symbol, data: { dp: null } }));
    }

    if (!symbols.length) {
      return [];
    }

    try {
      const results: { symbol: string; data: any }[] = [];
      for (const symbol of symbols) {
        const cacheKey = `quote_${symbol}`;
        const cached = cache[cacheKey];
        if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
          results.push({ symbol, data: cached.data });
          continue;
        }

        try {
          const response = await axios.get(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${key}`, {
            timeout: 10000,
          });

          cache[cacheKey] = {
            data: response.data,
            timestamp: Date.now(),
          };

          results.push({ symbol, data: response.data });
        } catch (symbolError: any) {
          console.warn(`Finnhub Quotes API Error for ${symbol}:`, symbolError?.message);
          results.push({ symbol, data: { dp: null } });
        }

        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      return results;
    } catch (error: any) {
      console.error("Finnhub Quotes API Error:", error.message);
      return symbols.map((symbol) => ({ symbol, data: { dp: null } }));
    }
  },

  async getLiquidity() {
    const key = env.FRED_API_KEY;
    if (!key) {
      throw new Error("FRED_API_KEY is not configured");
    }

    const cacheKey = "liquidity_onrrp";
    if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < 3600000) {
      return cache[cacheKey].data;
    }

    // ... rest of the code remains unchanged
      try {
        const response = await axios.get(
          `https://api.stlouisfed.org/fred/series/observations?series_id=RRPONTSYD&api_key=${key}&file_type=json&sort_order=desc&limit=7`,
          { timeout: 5000 }
        );
        return response;
      } catch (error: any) {
        console.error(`[FRED Liquidity] Error fetching: ${error.message}`);
        if (error.config) {
          console.error(`[FRED Liquidity] URL: ${error.config.url}`);
        }
        if (error.response?.status === 429 && retryCount < 3) {
          const delay = Math.pow(2, retryCount) * 1000 + Math.random() * 1000;
          console.log(`[FRED Liquidity] Rate limited, retrying in ${delay}ms (attempt ${retryCount + 1}/3)`);
          await new Promise((resolve) => setTimeout(resolve, delay));
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

      const parsed = observations
        .map((obs: any) => ({
          date: obs.date,
          value: parseFloat(obs.value),
        }))
        .filter((item: any) => !Number.isNaN(item.value));

      if (parsed.length < 2) {
        throw new Error("Insufficient numeric liquidity data from FRED");
      }

      const current = parsed[0].value;
      const previous = parsed[1].value;
      const change = current - previous;
      const status = change > 0 ? "DRAINING" : "INJECTING";

      const history = parsed.slice(0, 7).map((item: any, idx: number) => {
        const prev = idx < parsed.length - 1 ? parsed[idx + 1].value : item.value;
        const dailyChange = item.value - prev;
        return {
          date: item.date,
          value: item.value,
          status: dailyChange > 0 ? "DRAINING" : "INJECTING",
        };
      });

      const trend = history.slice(0, 5).map((item: { date: string; value: number; status: "INJECTING" | "DRAINING" | "UNKNOWN" }) => (item.status === "DRAINING" ? "draining" : "injecting"));

      const data: LiquidityData = {
        value: current,
        change,
        status,
        date: observations[0].date,
        trend,
        history,
      };

      try {
        const previousCached = cache[cacheKey];
        const prevValue = previousCached ? parseFloat(previousCached.data?.value) : null;

        if (prevValue !== null && prevValue !== current) {
          const absChange = Math.abs(current - prevValue);
          if (absChange > 0.1) {
            const isDraining = change > 0;
            await notificationService.create({
              userId: "system",
              type: isDraining ? "RISK_WARNING" : "SYSTEM",
              title: isDraining ? "⚠️ Institutional Liquidity Draining" : "🚀 Institutional Liquidity Injecting",
              message: isDraining
                ? `Dana ON RRP meningkat sebesar $${absChange.toFixed(2)}B. Institusi memarkir uang ke Fed, likuiditas pasar berpotensi mengetat.`
                : `Dana ON RRP menurun sebesar $${absChange.toFixed(2)}B. Likuiditas kembali disuntikkan ke pasar bursa!`,
              metadata: {
                currentValue: current,
                previousValue: prevValue,
                change,
                status,
                source: "FRED_ON_RRP",
              },
            });
          }
        }
      } catch (notifyError) {
        console.error("Failed to create liquidity notification:", (notifyError as any)?.message);
      }

      cache[cacheKey] = {
        data,
        timestamp: Date.now(),
      };

      return data;
    } catch (error: any) {
      console.error("FRED API Error:", error.message);
      throw new Error("Failed to fetch ON RRP liquidity data");
    }
  },
};
