import { env } from "../config/env";
import axios from "axios";
import { notificationService } from "./notification.service";

// In-memory cache to prevent hitting rate limits
const cache: Record<string, { data: any; timestamp: number }> = {};
const CACHE_TTL_MS = 60000; // 60 seconds
const lastClose: Record<string, number> = {};

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

    const stooqSymbols = symbols.join(",");
    const url = `https://stooq.com/q/l/?s=${encodeURIComponent(stooqSymbols)}&f=sd2t2ohlcv&h&e=csv`;

    try {
      const response = await axios.get(url, { timeout: 10000 });
      const text = typeof response.data === "string" ? response.data : "";

      if (!text) {
        return symbols.map((symbol) => ({ symbol, data: { dp: null } }));
      }

      const rows = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !/^(symbol|no data|error)/i.test(line));

      if (!rows.length) {
        return symbols.map((symbol) => ({ symbol, data: { dp: null } }));
      }

      const delimiter = text.includes(";") ? ";" : ",";
      const header = rows[0].split(delimiter).map((item) => item.trim().toLowerCase());
      const closeIndex = header.findIndex((item) => item === "close");
      const nameIndex = header.findIndex((item) => ["symbol", "ticker"].includes(item));
      const previousCloseIndex = header.findIndex((item) => ["previous close", "prev close", "close prev"].includes(item));

      const result: { symbol: string; data: { dp: number | null } }[] = [];
      const seen = new Set<string>();

      for (let i = 1; i < rows.length; i++) {
        const cols = rows[i].split(delimiter).map((item) => item.trim());
        const rawSymbol = cols[nameIndex] || "";
        const symbolUpper = rawSymbol.toUpperCase();
        if (!rawSymbol || seen.has(symbolUpper)) continue;
        seen.add(symbolUpper);

        const closeValue = parseFloat(cols[closeIndex]);
        let dp: number | null = null;
        const mapped = symbols.find((s) => s.toUpperCase() === symbolUpper);

        if (!Number.isNaN(closeValue) && previousCloseIndex > -1 && previousCloseIndex < cols.length) {
          const previousCloseValue = parseFloat(cols[previousCloseIndex]);
          if (!Number.isNaN(previousCloseValue) && previousCloseValue !== 0) {
            dp = ((closeValue - previousCloseValue) / previousCloseValue) * 100;
          }
        } else {
          if (!mapped && previousCloseIndex === -1) {
            dp = 0;
          }
        }

        result.push({ symbol: mapped || rawSymbol, data: { dp: dp === null ? null : parseFloat(dp.toFixed(2)) } });
      }

      return symbols.map((symbol) => result.find((item) => item.symbol.toUpperCase() === symbol.toUpperCase()) || { symbol, data: { dp: null } });
    } catch (error: any) {
      console.warn("Stooq Quotes API Error:", error.message);
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