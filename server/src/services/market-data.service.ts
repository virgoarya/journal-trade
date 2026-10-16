import { env } from "../config/env";
import axios from "axios";
import { notificationService } from "./notification.service";
import { fredLatest } from "../utils/fred-api.helper";
import { silentLogger } from "../utils/silent-logger";
import { broadcast } from "../ws-server";
import { macroDataService, LiquidityData } from "./macro-data.service";
import { API_LIMITS } from "../utils/rate-limiter";

import { macroAiService } from "./macro-ai.service";

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
    if (result.data && result.data.length > 0) {
      const newsItems = result.data;
      const unanalyzed = newsItems.filter((item: any) => !item.analysis);
      
      if (unanalyzed.length > 0) {
        try {
          const map = await macroAiService.batchAnalyzeNews(unanalyzed);
          for (const item of newsItems) {
            if (map[item.id]) {
              item.analysis = map[item.id];
            }
          }
        } catch (e) {
          silentLogger.warn("[marketDataService] Batch AI analysis failed", e);
        }
      }
      
      setCache("news_general", newsItems);
      return newsItems;
    }

    // Fallback: return mock news if external sources fail
    silentLogger.warn("[marketDataService] Fetching from all sources failed, using mock news fallback");
    const mockNews = this.getMockNews();
    setCache("news_general", mockNews);
    return mockNews;
  },

  getMockNews() {
    return [
      {
        id: "mock-1",
        datetime: Math.floor(Date.now() / 1000) - 300,
        headline: "Federal Reserve Signals Data-Dependent Path Amid Resilient Economic Growth",
        summary: "Fed officials emphasized patience in policy adjustments while monitoring labor market strength and inflation dynamics.",
        source: "Bloomberg",
        analysis: {
          id: "mock-1",
          topic: "FED",
          assets: "DXY, US10Y, SPY",
          regime: "Goldilocks",
          Fakta: "The Federal Reserve indicated an ongoing data-dependent approach to future rate adjustments.",
          dampakMarket: "Stabilisasi yield Treasury AS dan sentimen risk-on moderat pada ekuitas global.",
          logika: "Kebijakan yang tidak terburu-buru menurunkan premi risiko dan memberi ruang nafas bagi likuiditas pasar.",
          contrarian: "Kenaikan inflasi yang mengejutkan dapat memicu pengetatan moneter lebih agresif.",
          triggerFundamentalNonTeknikal: "Rilis data CPI dan PPI AS berikutnya",
          confidenceScore: "TINGGI"
        }
      },
      {
        id: "mock-2",
        datetime: Math.floor(Date.now() / 1000) - 1200,
        headline: "Crude Oil Consolidates as Geopolitical Tensions Offset Supply Surge Concerns",
        summary: "Oil prices held steady as market participants weighed Middle East tensions against rising non-OPEC production.",
        source: "Reuters",
        analysis: {
          id: "mock-2",
          topic: "ENERGY",
          assets: "CL=F, USO, XLE",
          regime: "Reflation",
          Fakta: "Minyak mentah berkonsolidasi akibat tarik-menarik antara premi risiko geopolitik dan kenaikan pasokan.",
          dampakMarket: "Volatilitas harga energi stabil, menahan kenaikan inflasi berbasis komoditas untuk sementara.",
          logika: "Keseimbangan semu antara pasokan ekstra dan risiko disrupsi jalur maritim global.",
          contrarian: "Eskalasi mendadak di jalur pelayaran utama dapat melipatgandakan premi risiko minyak.",
          triggerFundamentalNonTeknikal: "Laporan inventaris mingguan EIA dan pernyataan OPEC+",
          confidenceScore: "SEDANG"
        }
      },
      {
        id: "mock-3",
        datetime: Math.floor(Date.now() / 1000) - 2400,
        headline: "Tech Rally Drives Broad Index Gains Amid Cloud Computing and Semiconductor Optimism",
        summary: "Major equity benchmarks advanced led by sustained capital allocation toward AI infrastructure and semiconductor leaders.",
        source: "Financial Times",
        analysis: {
          id: "mock-3",
          topic: "TECHNOLOGY",
          assets: "QQQ, NVDA, SMH",
          regime: "Goldilocks",
          Fakta: "Reli sektor teknologi mengangkat indeks bursa saham utama didorong oleh belanja infrastruktur komputasi.",
          dampakMarket: "Ekspansi valuasi pada saham berkapitalisasi mega dan aliran modal spekulatif ke industri chip.",
          logika: "Tingginya capex teknologi menunjukkan prospek produktivitas korporasi jangka panjang yang solid.",
          contrarian: "Revisi penurunan belanja modal hyperscaler dapat memicu koreksi mendalam.",
          triggerFundamentalNonTeknikal: "Laporan kinerja kuartalan (earnings) emiten semikonduktor",
          confidenceScore: "TINGGI"
        }
      }
    ];
  },

  updateNewsAnalysis(headline: string, analysis: any) {
    const cached = getCache<any[]>("news_general");
    if (cached) {
      let updated = false;
      for (const item of cached) {
        if (item.headline === headline) {
          item.analysis = analysis;
          updated = true;
        }
      }
      if (updated) {
        setCache("news_general", cached);
      }
    }
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
      silentLogger.warn("Quotes rate limited");
    }
    return [];
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

    try {
      const symbolsMap: Record<string, any> = {
          '067651': { symbol: 'CL=F', name: 'Crude Oil', type: 'Energy' },
          '088691': { symbol: 'GC=F', name: 'Gold', type: 'Metals' },
          '099741': { symbol: 'EUR/USD', name: 'Euro FX', type: 'Currencies' },
          '13874A': { symbol: 'ES=F', name: 'E-Mini S&P 500', type: 'Indices' },
          '209742': { symbol: 'NQ=F', name: 'Nasdaq 100', type: 'Indices' },
          '084691': { symbol: 'SI=F', name: 'Silver', type: 'Metals' },
          '096742': { symbol: 'GBP/USD', name: 'British Pound', type: 'Currencies' },
          '097741': { symbol: 'JPY/USD', name: 'Japanese Yen', type: 'Currencies' },
          '232741': { symbol: 'AUD/USD', name: 'Australian Dollar', type: 'Currencies' }
        };
        const codes = Object.keys(symbolsMap);

        const url = `https://publicreporting.cftc.gov/resource/6dca-aqww.json?$where=cftc_contract_market_code in ('${codes.join("','")}')&$limit=9&$order=report_date_as_yyyy_mm_dd DESC`;

        const response = await axios.get(url, { timeout: 15000 });
        const records = response.data;

        if (records && Array.isArray(records) && records.length > 0) {
          const results = records.map((item: any) => {
            const meta = symbolsMap[item.cftc_contract_market_code] || { symbol: 'UNKNOWN', name: item.contract_market_name, type: 'unknown' };

            const commLong = parseInt(item.comm_positions_long_all || '0', 10);
            const commShort = parseInt(item.comm_positions_short_all || '0', 10);
            const nonCommLong = parseInt(item.noncomm_positions_long_all || '0', 10);
            const nonCommShort = parseInt(item.noncomm_positions_short_all || '0', 10);
            const retailLong = parseInt(item.nonrept_positions_long_all || '0', 10);
            const retailShort = parseInt(item.nonrept_positions_short_all || '0', 10);

            const netPosition = nonCommLong - nonCommShort;
            const totalPosition = nonCommLong + nonCommShort;
            let sentiment = "NEUTRAL";

            if (totalPosition > 0) {
              const ratio = Math.abs(netPosition) / totalPosition;
              if (ratio >= 0.1) {
                sentiment = netPosition > 0 ? "BULLISH" : "BEARISH";
              }
            }

            return {
              symbol: meta.symbol,
              name: meta.name,
              category: meta.type,
              commercialLong: commLong,
              commercialShort: commShort,
              commercialSpread: Math.abs(commLong - commShort),
              nonCommercialLong: nonCommLong,
              nonCommercialShort: nonCommShort,
              nonCommercialSpread: Math.abs(nonCommLong - nonCommShort),
              retailLong: retailLong,
              retailShort: retailShort,
              retailSpread: Math.abs(retailLong - retailShort),
              sentiment,
              lastUpdate: item.report_date_as_yyyy_mm_dd || new Date().toISOString()
            };
          });

          setCache(cacheKey, results);
          return results;
        }
      } catch (e: any) {
        silentLogger.warn("[COT] CFTC API fetch failed, using mock data", e.message);
      }

      const mockData = this.getMockCotData();
      return mockData;
    },

  /**
   * Get OHLC high/low range for a symbol between two timestamps.
   * Sources (in priority order):
   *  1. MT5 MCP → copy_rates_range (accurate, requires MT5 connection)
   *  2. Trade collection fallback → aggregate high/low from recorded trades
   *     on the same pair within the time window (rough estimate)
   */
  async getOhlcRange(symbol: string, from: string, to: string): Promise<{ high: number; low: number } | null> {
    // ── Source 1: MT5 via MCP ──────────────────────────────────────────────
    try {
      const { mcpService } = await import("./mcp.service");
      const result = await (mcpService as any).callTool?.("copy_rates_range", {
        symbol,
        timeframe: "TIMEFRAME_M1",
        date_from: from,
        date_to: to,
      });
      if (result?.content) {
        const parsed = typeof result.content === "string" ? JSON.parse(result.content) : result.content;
        const rates: Array<{ high: number; low: number }> = Array.isArray(parsed) ? parsed : parsed?.rates ?? [];
        if (rates.length > 0) {
          const high = Math.max(...rates.map((r) => r.high));
          const low  = Math.min(...rates.map((r) => r.low));
          return { high, low };
        }
      }
    } catch (_) {
      // MT5 not available — fall through to trade-collection fallback
    }

    // ── Source 2: Trade collection fallback ───────────────────────────────
    try {
      const { Trade } = await import("../models/Trade");
      const fromDate = new Date(from);
      const toDate   = new Date(to);
      const trades = await Trade.find({
        pair: { $regex: new RegExp(symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
        entryDate: { $gte: fromDate, $lte: toDate },
        entryPrice: { $exists: true, $ne: null },
      })
        .select("entryPrice stopLoss takeProfit")
        .lean();

      if (trades.length > 0) {
        const prices = trades.flatMap((t: any) =>
          [t.entryPrice, t.stopLoss, t.takeProfit].filter((p): p is number => typeof p === "number" && p > 0)
        );
        if (prices.length > 0) {
          return { high: Math.max(...prices), low: Math.min(...prices) };
        }
      }
    } catch (_) {
      // no trades found
    }

    return null;
  },

  getMockCotData() {
    return [
      { symbol: "CL=F", name: "Crude Oil", category: "Energy", commercialLong: 245678, commercialShort: 189012, commercialSpread: 56666, nonCommercialLong: 412345, nonCommercialShort: 387654, nonCommercialSpread: 24691, retailLong: 45000, retailShort: 52000, retailSpread: 7000, sentiment: "BULLISH", lastUpdate: new Date().toISOString() },
      { symbol: "GC=F", name: "Gold", category: "Metals", commercialLong: 112345, commercialShort: 98765, commercialSpread: 13580, nonCommercialLong: 234567, nonCommercialShort: 198765, nonCommercialSpread: 35802, retailLong: 32000, retailShort: 28000, retailSpread: 4000, sentiment: "BULLISH", lastUpdate: new Date().toISOString() },
      { symbol: "SI=F", name: "Silver", category: "Metals", commercialLong: 45678, commercialShort: 52345, commercialSpread: 6667, nonCommercialLong: 123456, nonCommercialShort: 112345, nonCommercialSpread: 11111, retailLong: 18000, retailShort: 15000, retailSpread: 3000, sentiment: "NEUTRAL", lastUpdate: new Date().toISOString() },
      { symbol: "EUR/USD", name: "Euro FX", category: "Currencies", commercialLong: 156789, commercialShort: 178901, commercialSpread: 22112, nonCommercialLong: 345678, nonCommercialShort: 321098, nonCommercialSpread: 24580, retailLong: 41000, retailShort: 38000, retailSpread: 3000, sentiment: "NEUTRAL", lastUpdate: new Date().toISOString() },
      { symbol: "GBP/USD", name: "British Pound", category: "Currencies", commercialLong: 98765, commercialShort: 112345, commercialSpread: 13580, nonCommercialLong: 212345, nonCommercialShort: 198765, nonCommercialSpread: 13580, retailLong: 22000, retailShort: 25000, retailSpread: 3000, sentiment: "BEARISH", lastUpdate: new Date().toISOString() },
      { symbol: "JPY/USD", name: "Japanese Yen", category: "Currencies", commercialLong: 189012, commercialShort: 167890, commercialSpread: 21122, nonCommercialLong: 298765, nonCommercialShort: 276543, nonCommercialSpread: 22222, retailLong: 35000, retailShort: 31000, retailSpread: 4000, sentiment: "BULLISH", lastUpdate: new Date().toISOString() },
      { symbol: "AUD/USD", name: "Australian Dollar", category: "Currencies", commercialLong: 78000, commercialShort: 85000, commercialSpread: 7000, nonCommercialLong: 145000, nonCommercialShort: 132000, nonCommercialSpread: 13000, retailLong: 19000, retailShort: 21000, retailSpread: 2000, sentiment: "NEUTRAL", lastUpdate: new Date().toISOString() },
      { symbol: "NQ=F", name: "Nasdaq 100", category: "Indices", commercialLong: 312456, commercialShort: 287654, commercialSpread: 24802, nonCommercialLong: 512345, nonCommercialShort: 487654, nonCommercialSpread: 24691, retailLong: 58000, retailShort: 62000, retailSpread: 4000, sentiment: "BULLISH", lastUpdate: new Date().toISOString() },
      { symbol: "ES=F", name: "E-Mini S&P 500", category: "Indices", commercialLong: 412345, commercialShort: 387654, commercialSpread: 24691, nonCommercialLong: 612345, nonCommercialShort: 587654, nonCommercialSpread: 24691, retailLong: 72000, retailShort: 68000, retailSpread: 4000, sentiment: "BULLISH", lastUpdate: new Date().toISOString() },
    ];
  },
};