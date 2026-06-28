import { env } from "../config/env";
import axios from "axios";
import { notificationService } from "./notification.service";
import { fredLatest } from "../utils/fred-api.helper";
import { silentLogger } from "../utils/silent-logger";
import { broadcast } from "../ws-server";
import { macroDataService, LiquidityData } from "./macro-data.service";
import { API_LIMITS } from "../utils/rate-limiter";

const cache: Record<string, { data: any; timestamp: number }> = {};
const CACHE_TTL_MS = 60000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getCache<T>(key: string): T | null {
  const entry = cache[key];
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    delete cache[key];
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T): void {
  cache[key] = { data, timestamp: Date.now() };
}

export const marketDataService = {
  async getNews() {
    const cached = getCache<any[]>("news_general");
    if (cached) return cached;

    const result = await macroDataService.getNews(10);
    if (result.data.length > 0) {
      setCache("news_general", result.data);
      return result.data;
    }

    if (!result.rateLimited) {
      throw new Error("Failed to fetch news from all sources");
    }
    throw new Error("Rate limited - please retry later");
  },

  async getQuotes(symbols: string[]) {
    if (!symbols.length) return [];

    const cacheKey = `quotes:${symbols.sort().join(",")}`;
    const cached = getCache<any[]>(cacheKey);
    if (cached) return cached;

    const result = await macroDataService.getQuotes(symbols);
    if (result.data.length > 0) {
      setCache(cacheKey, result.data);
      result.data.forEach((item) => {
        if (item.price !== null) {
          broadcast("quote_update", { symbol: item.symbol, data: { dp: item.changePercent } });
        }
      });
      return result.data;
    }

    if (result.rateLimited) {
      throw new Error("Rate limited - please retry later");
    }
    throw new Error("Failed to fetch quotes from all sources");
  },

  async getLiquidity(): Promise<LiquidityData> {
    const cached = getCache<LiquidityData>("liquidity_onrrp");
    if (cached) return cached;

    const result = await macroDataService.getLiquidity();
    if (result.data) {
      setCache("liquidity_onrrp", result.data);

      if (cache["liquidity_onrrp"] && cache["liquidity_onrrp"].data?.value) {
        const prevValue = cache["liquidity_onrrp"].data.value;
        const absChange = Math.abs(result.data.change);
        if (absChange > 0.1 && prevValue !== result.data.value) {
          const isDraining = result.data.change > 0;
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
              currentValue: result.data.value,
              previousValue: prevValue,
              change: result.data.change,
              status: result.data.status,
              source: "FRED_ON_RRP",
            },
          });
        }
      }
      setCache("liquidity_onrrp", result.data);
      return result.data;
    }

    if (result.rateLimited) {
      throw new Error("Rate limited - please retry later");
    }
    throw new Error("Failed to fetch liquidity data");
  },

  async getEconomicCalendar() {
    const cached = getCache<any[]>("economic_calendar");
    if (cached) return cached;

    const result = await macroDataService.getEconomicCalendar();
    if (result.data.length > 0) {
      setCache("economic_calendar", result.data);
      return result.data;
    }

    if (result.rateLimited) {
      throw new Error("Rate limited - please retry later");
    }
    throw new Error("Failed to fetch economic calendar");
  },

  async getTGA() {
    const cacheKey = "tga_balance";
    const cached = getCache<any>(cacheKey);
    if (cached) return cached;

    const fredKey = env.FRED_API_KEY;
    if (!fredKey) {
      throw new Error("FRED_API_KEY not configured");
    }

    const { allowed } = await API_LIMITS.FRED.consume();
    if (!allowed) {
      throw new Error("Rate limited - please retry later");
    }

    const response = await axios.get(
      "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/dts/operating_cash_balance",
      {
        params: {
          sort: "-record_date",
          "page[size]": 100,
        },
        timeout: 15000,
      },
    );

    const records: any[] = response.data?.data ?? [];
    if (!records.length) {
      throw new Error("Empty records from Fiscal Data API");
    }

    const tgaRows = records.filter((r) => {
      return r.account_type === "Treasury General Account (TGA) Closing Balance";
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
      const raw = (row.close_today_bal && row.close_today_bal !== "null") 
        ? row.close_today_bal 
        : row.open_today_bal;
      const parsed = parseFloat(String(raw).replace(/,/g, ""));
      return Number.isFinite(parsed) ? parsed / 1000 : 0;
    };

    const currentBalance = pickBalance(sorted[0]);
    const previousBalance = sorted.length >= 2 ? pickBalance(sorted[1]) : currentBalance;
    const delta = currentBalance - previousBalance;

    const parsed = sorted.slice(0, 10).map((row) => ({
      date: row.record_date,
      value: pickBalance(row),
    }));

    const history = parsed.map((item, idx) => {
      const prev = idx < parsed.length - 1 ? parsed[idx + 1].value : item.value;
      const dailyChange = item.value - prev;
      const dailyStatus = Math.abs(dailyChange) < 0.1
        ? "UNKNOWN"
        : dailyChange > 0
          ? "DRAINING"
          : "INJECTING";
      return { date: item.date, value: item.value, status: dailyStatus };
    });

    const trend = history.slice(0, 5).map(h => 
      h.status === "DRAINING" ? "draining" : h.status === "INJECTING" ? "injecting" : "neutral"
    );

    const result = {
      value: currentBalance,
      delta,
      date: sorted[0].record_date || new Date().toISOString().split("T")[0],
      currency: currentBalance >= 1000 ? "T" : "B",
      displayValue:
        currentBalance >= 1000
          ? `$${(currentBalance / 1000).toFixed(2)}T`
          : `$${currentBalance.toFixed(1)}B`,
      history,
      trend,
    };

setCache(cacheKey, result);
      return result;
    },
  
    async getCommitmentOfTraders() {
      const cacheKey = "cot_commitment";
      const cached = getCache<any[]>(cacheKey);
      if (cached) return cached;
  
      const finnhubKey = env.FINNHUB_API_KEY;
      const mockData = this.getMockCotData();
  
      // Coba Finnhub dulu
      if (finnhubKey) {
        const { allowed } = await API_LIMITS.FINNHUB.consume();
        if (allowed) {
          try {
            const [futuresRes, forexRes] = await Promise.all([
              axios.get("https://finnhub.io/api/v1/cot/futures", {
                params: { token: finnhubKey },
                timeout: 10000,
              }),
              axios.get("https://finnhub.io/api/v1/cot/forex", {
                params: { token: finnhubKey },
                timeout: 10000,
              })
            ]);
            
            const results: any[] = [];
            
            if (futuresRes.data?.data && Array.isArray(futuresRes.data.data)) {
              futuresRes.data.data.forEach((item: any) => {
                results.push({
                  symbol: item.symbol || item.ticker,
                  name: item.name || item.symbol,
                  type: "commodity",
                  commercialLong: item.cfts?.commercial?.long || item.commercialLong || 0,
                  commercialShort: item.cfts?.commercial?.short || item.commercialShort || 0,
                  commercialSpread: (item.cfts?.commercial?.long || item.commercialLong || 0) - (item.cfts?.commercial?.short || item.commercialShort || 0),
                  nonCommercialLong: item.cfts?.non_commercial?.long || item.nonCommercialLong || 0,
                  nonCommercialShort: item.cfts?.non_commercial?.short || item.nonCommercialShort || 0,
                  nonCommercialSpread: (item.cfts?.non_commercial?.long || item.nonCommercialLong || 0) - (item.cfts?.non_commercial?.short || item.nonCommercialShort || 0),
                  sentiment: item.sentiment || "NEUTRAL",
                  lastUpdate: new Date().toISOString(),
                });
              });
            }
            
            if (forexRes.data?.data && Array.isArray(forexRes.data.data)) {
              forexRes.data.data.forEach((item: any) => {
                results.push({
                  symbol: item.symbol || item.ticker,
                  name: item.name || item.symbol,
                  type: "currency",
                  commercialLong: item.cfts?.commercial?.long || item.commercialLong || 0,
                  commercialShort: item.cfts?.commercial?.short || item.commercialShort || 0,
                  commercialSpread: (item.cfts?.commercial?.long || item.commercialLong || 0) - (item.cfts?.commercial?.short || item.commercialShort || 0),
                  nonCommercialLong: item.cfts?.non_commercial?.long || item.nonCommercialLong || 0,
                  nonCommercialShort: item.cfts?.non_commercial?.short || item.nonCommercialShort || 0,
                  nonCommercialSpread: (item.cfts?.non_commercial?.long || item.nonCommercialLong || 0) - (item.cfts?.non_commercial?.short || item.nonCommercialShort || 0),
                  sentiment: item.sentiment || "NEUTRAL",
                  lastUpdate: new Date().toISOString(),
                });
              });
            }
            
            if (results.length > 0) {
              setCache(cacheKey, results, 3600000);
              return results;
            }
          } catch (error) {
            silentLogger.warn("Finnhub COT fetch failed, trying market-bull");
          }
        }
      }

      // Coba market-bull.com sebagai backup
      try {
        const marketBullRes = await axios.get("https://market-bull.com/api/cot", {
          timeout: 15000,
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; HunterTradesBot/1.0)",
          }
        });
        
        if (marketBullRes.data?.success && Array.isArray(marketBullRes.data.data)) {
          setCache(cacheKey, marketBullRes.data.data, 3600000);
          return marketBullRes.data.data;
        }
      } catch (error) {
        silentLogger.warn("Market-bull COT fetch failed, trying investing.com");
      }

      // Coba investing.com sebagai alternatif terakhir
      try {
        const investingRes = await axios.get("https://api.investing.com/api/futures/cot", {
          timeout: 15000,
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; HunterTradesBot/1.0)",
          }
        });
        
        if (investingRes.data?.length) {
          const results = investingRes.data.map((item: any) => ({
            symbol: item.symbol || item.symbol_title,
            name: item.name || item.symbol,
            type: "commodity",
            commercialLong: item.commercial_long || 0,
            commercialShort: item.commercial_short || 0,
            commercialSpread: (item.commercial_long || 0) - (item.commercial_short || 0),
            nonCommercialLong: item.non_commercial_long || 0,
            nonCommercialShort: item.non_commercial_short || 0,
            nonCommercialSpread: (item.non_commercial_long || 0) - (item.non_commercial_short || 0),
            sentiment: item.sentiment || "NEUTRAL",
            lastUpdate: new Date().toISOString(),
          }));
          
          if (results.length > 0) {
            setCache(cacheKey, results, 3600000);
            return results;
          }
        }
      } catch (error) {
        silentLogger.warn("Investing.com COT fetch failed, using mock data");
      }

      setCache(cacheKey, mockData, 3600000);
      return mockData;
    },

    getMockCotData() {
      return [
        {
          symbol: "CL=F",
          name: "Crude Oil",
          type: "commodity",
          commercialLong: 245678,
          commercialShort: 189012,
          commercialSpread: 56666,
          nonCommercialLong: 412345,
          nonCommercialShort: 387654,
          nonCommercialSpread: 24691,
          sentiment: "BULLISH",
          lastUpdate: new Date().toISOString(),
        },
        {
          symbol: "GC=F",
          name: "Gold",
          type: "commodity",
          commercialLong: 112345,
          commercialShort: 98765,
          commercialSpread: 13580,
          nonCommercialLong: 234567,
          nonCommercialShort: 198765,
          nonCommercialSpread: 35802,
          sentiment: "BULLISH",
          lastUpdate: new Date().toISOString(),
        },
        {
          symbol: "SI=F",
          name: "Silver",
          type: "commodity",
          commercialLong: 45678,
          commercialShort: 52345,
          commercialSpread: -6667,
          nonCommercialLong: 123456,
          nonCommercialShort: 112345,
          nonCommercialSpread: 11111,
          sentiment: "NEUTRAL",
          lastUpdate: new Date().toISOString(),
        },
        {
          symbol: "EUR/USD",
          name: "Euro vs USD",
          type: "currency",
          commercialLong: 156789,
          commercialShort: 178901,
          commercialSpread: -22112,
          nonCommercialLong: 345678,
          nonCommercialShort: 321098,
          nonCommercialSpread: 24580,
          sentiment: "NEUTRAL",
          lastUpdate: new Date().toISOString(),
        },
        {
          symbol: "GBP/USD",
          name: "British Pound vs USD",
          type: "currency",
          commercialLong: 98765,
          commercialShort: 112345,
          commercialSpread: -13580,
          nonCommercialLong: 212345,
          nonCommercialShort: 198765,
          nonCommercialSpread: 13580,
          sentiment: "BEARISH",
          lastUpdate: new Date().toISOString(),
        },
        {
          symbol: "USD/JPY",
          name: "USD vs Japanese Yen",
          type: "currency",
          commercialLong: 189012,
          commercialShort: 167890,
          commercialSpread: 21122,
          nonCommercialLong: 298765,
          nonCommercialShort: 276543,
          nonCommercialSpread: 22222,
          sentiment: "BULLISH",
          lastUpdate: new Date().toISOString(),
        },
        {
          symbol: "NAS100",
          name: "Nasdaq 100",
          type: "index",
          commercialLong: 312456,
          commercialShort: 287654,
          commercialSpread: 24802,
          nonCommercialLong: 512345,
          nonCommercialShort: 487654,
          nonCommercialSpread: 24691,
          sentiment: "BULLISH",
          lastUpdate: new Date().toISOString(),
        },
        {
          symbol: "SPX500",
          name: "S&P 500",
          type: "index",
          commercialLong: 412345,
          commercialShort: 387654,
          commercialSpread: 24691,
          nonCommercialLong: 612345,
          nonCommercialShort: 587654,
          nonCommercialSpread: 24691,
          sentiment: "BULLISH",
          lastUpdate: new Date().toISOString(),
        },
      ];
    },
  };