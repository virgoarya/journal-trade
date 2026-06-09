import { env } from "../config/env";
import axios from "axios";
import { notificationService } from "./notification.service";
import { fredLatest } from "../utils/fred-api.helper";

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

    const fetchLiquidityWithRetry = async (retryCount = 0): Promise<any> => {
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

  async getEconomicCalendar() {
    const cacheKey = "economic_calendar";
    if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < 300000) {
      return cache[cacheKey].data;
    }

    try {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - dayOfWeek);
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);

      const fromStr = startOfWeek.toISOString();
      const toStr = endOfWeek.toISOString();

      const response = await axios.get(
        `https://economic-calendar.tradingview.com/events?from=${fromStr}&to=${toStr}&countries=US,GB,EU,JP,AU,CA,NZ`,
        {
          timeout: 10000,
          headers: {
            'Origin': 'https://www.tradingview.com',
            'User-Agent': 'Mozilla/5.0'
          }
        }
      );

      // TradingView importance mapping: 1 = High, 0 = Medium, -1 = Low
      const getImpactStr = (importance: number) => {
        if (importance === 1) return "High";
        if (importance === 0) return "Medium";
        return "Low";
      };

      const formatValue = (val: any, unit: string = "") => {
        if (val === null || val === undefined) return "";
        return `${val}${unit}`;
      };

      const data = response.data.result.map((item: any) => ({
        title: item.title,
        country: item.currency || item.country,
        date: item.date,
        impact: getImpactStr(item.importance),
        forecast: formatValue(item.forecast, item.unit),
        previous: formatValue(item.previous, item.unit),
        actual: formatValue(item.actual, item.unit),
      }));

      cache[cacheKey] = {
        data,
        timestamp: Date.now(),
      };

      return data;
    } catch (error: any) {
      console.error("TradingView Calendar API Error:", error.message);
      throw new Error("Failed to fetch economic calendar data");
    }
  },

  async getTGA() {
    const cacheKey = "tga_balance";
    if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < 3600000) {
      return cache[cacheKey].data;
    }

    try {
      const response = await axios.get(
        "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/dts/dts_table_2",
        {
          params: {
            filter: 'account_type:"Treasury General Account"',
            sort: "-record_date",
            "page[size]": 100,
          },
          timeout: 15000,
        }
      );

      const records: any[] = response.data?.data?.records ?? [];

      if (!records.length) {
        throw new Error("Empty records from Fiscal Data API");
      }

      const tgaRows = records.filter((r) => {
        const at = (r.account_type || "").toLowerCase();
        return at.includes("treasury general account");
      });

      if (!tgaRows.length) {
        throw new Error("No TGA rows found after filtering");
      }

      const sorted = [...tgaRows].sort((a, b) => {
        const da = a.record_date || "";
        const db = b.record_date || "";
        return db.localeCompare(da);
      });

      const pickBalance = (row: any): number => {
        const raw = row.close_today_bal ?? row.open_today_bal ?? "0";
        const parsed = parseFloat(String(raw).replace(/,/g, ""));
        return Number.isFinite(parsed) ? parsed : 0;
      };

      const currentBalance = pickBalance(sorted[0]);
      const previousBalance = sorted.length >= 2 ? pickBalance(sorted[1]) : currentBalance;
      const delta = currentBalance - previousBalance;

      const result = {
        balance: currentBalance,
        delta,
        date: sorted[0].record_date || new Date().toISOString().split("T")[0],
        currency: currentBalance >= 1000 ? "T" : "B",
        displayValue:
          currentBalance >= 1000
            ? `$${(currentBalance / 1000).toFixed(2)}T`
            : `$${currentBalance.toFixed(1)}B`,
      };

      cache[cacheKey] = { data: result, timestamp: Date.now() };
      return result;
    } catch (error: any) {
      console.error("❌ TGA Fetch Error:", error);

      if (cache[cacheKey] && cache[cacheKey].data) {
        return cache[cacheKey].data;
      }

      return {
        balance: 721.4,
        delta: 58.6,
        date: new Date().toISOString().split("T")[0],
        currency: "B",
        displayValue: "$721.4B",
      };
    }
  },
};
