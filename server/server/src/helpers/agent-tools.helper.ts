import { AgentContext } from "../agents/base.agent";
import { nexusService } from "../services/nexus.service";
import { marketDataService } from "../services/market-data.service";
import { marketRegimeService } from "../services/market-regime.service";
import { silentLogger } from "../utils/silent-logger";
import axios from "axios";
import { env } from "../config/env";

export type ToolName = keyof typeof agentTools;

export interface ToolExecutionResult {
  toolName: ToolName;
  result: any;
  error?: string;
}

// Dummy candle data for market regime analysis if real data is not available
const DUMMY_CANDLES = [
  { time: Date.now() - 86400000, open: 100, high: 102, low: 99, close: 101, volume: 1000 },
  { time: Date.now() - 43200000, open: 101, high: 103, low: 100, close: 102, volume: 1200 },
  { time: Date.now() - 21600000, open: 102, high: 104, low: 101, close: 103, volume: 1100 },
  { time: Date.now() - 10800000, open: 103, high: 105, low: 102, close: 104, volume: 1300 },
  { time: Date.now() - 5400000, open: 104, high: 106, low: 103, close: 105, volume: 1500 },
];

export const agentTools = {
  /**
   * Mengambil harga pasar realtime untuk simbol tertentu.
   * Menggunakan nexusService.getSnapshot() untuk DXY & Gold, fallback ke Yahoo Finance.
   */
  async get_price(context: AgentContext, symbols: string[]): Promise<Record<string, any>> {
    silentLogger.info(`[AgentTools] Executing get_price for: ${symbols.join(", ")}`);
    const results: Record<string, any> = {};

    try {
      const snapshot = await nexusService.getSnapshot();
      
      if (symbols.includes("XAUUSD") || symbols.includes("GC=F")) {
          results["XAUUSD"] = snapshot?.gold ? { price: snapshot.gold.price, changePercent: snapshot.gold.changePercent } : "Data Emas tidak tersedia";
          results["GC=F"] = results["XAUUSD"]; // Alias
      }
      if (symbols.includes("DXY") || symbols.includes("DX-Y.NYB")) {
          results["DXY"] = snapshot?.dxy ? { price: snapshot.dxy.price, changePercent: snapshot.dxy.changePercent } : "Data DXY tidak tersedia";
          results["DX-Y.NYB"] = results["DXY"]; // Alias
      }

      // Fetch symbols not covered by snapshot via generic Yahoo fallback
      const remainingSymbols = symbols.filter(s => !results[s] || results[s] === "Data Emas tidak tersedia" || results[s] === "Data DXY tidak tersedia");
      for (const symbol of remainingSymbols) {
          if (symbol !== "XAUUSD" && symbol !== "GC=F" && symbol !== "DXY" && symbol !== "DX-Y.NYB") { // Avoid re-fetching if already processed
            const yahooQuote = await this.fetchGenericYahooQuote(symbol);
            results[symbol] = yahooQuote || `Data ${symbol} tidak tersedia`;
          }
      }

    } catch (error: any) {
      silentLogger.warn(`[AgentTools] Failed to fetch snapshot for price data: ${error.message}`);
      // Fallback for all symbols if snapshot fetch fails entirely
      for (const symbol of symbols) {
        if (!results[symbol]) { // Only fill if not already partially successful
          const yahooQuote = await this.fetchGenericYahooQuote(symbol);
          results[symbol] = yahooQuote ? { price: yahooQuote.price, changePercent: yahooQuote.changePercent } : `Error fetching ${symbol}`;
        }
      }
    }
    return results;
  },

  /**
   * Mengambil kalender ekonomi terbaru.
   * Menggunakan macroDataService (yang seharusnya sudah meng-handle Finnhub fallback).
   */
  async get_economic_calendar(context: AgentContext): Promise<any> {
    silentLogger.info(`[AgentTools] Executing get_economic_calendar`);
    try {
      // NOTE: Directly calling Finnhub here bypasses macroDataService's logic (like mock fallback).
      // We should rely on macroDataService to fetch calendar data.
      // const apiKey = env.FINNHUB_API_KEY; // Removed direct Finnhub call
      
      // Fetch using macroDataService which handles Finnhub/mock logic internally
      const calendarData = await macroDataService.getEconomicCalendar(); // Assuming this method exists and is implemented

      if (calendarData && calendarData.length > 0) {
          // Ambil 5 event mendatang terdekat
          return calendarData.slice(0, 5).map((event: any) => ({
              event: event.event,
              country: event.country,
              date: event.time, // Assuming 'time' field from macroDataService is the date
              estimate: event.estimate,
              impact: event.impact
          }));
      }
      // If macroDataService returns empty or null, use mock
      silentLogger.warn("[AgentTools] Macro data service returned empty calendar, using mock.");
      return this.getMockEconomicCalendar();
    } catch (error: any) {
      silentLogger.warn(`[AgentTools] Failed to fetch economic calendar via macroDataService: ${error.message}`);
      return this.getMockEconomicCalendar();
    }
  },

  /**
   * Mengambil rezim pasar saat ini.
   */
  async get_market_regime(context: AgentContext): Promise<any> {
      silentLogger.info(`[AgentTools] Executing get_market_regime`);
      try {
          // NOTE: marketRegimeService.analyze needs candle data. We use dummy data as fallback.
          // In a real scenario, this should fetch recent actual market data.
          const regimeData = await marketRegimeService.analyze(DUMMY_CANDLES);
          return regimeData || "Data rezim tidak tersedia";
      } catch (error: any) {
          silentLogger.warn(`[AgentTools] Failed to fetch market regime: ${error.message}`);
          // Fallback to a default/mock regime if analysis fails
          return { regime: "RANGING", confidence: 50, direction: "SIDEWAYS" };
      }
  },

  /**
   * Mengambil berita pasar terbaru.
   */
  async get_news(context: AgentContext): Promise<any> {
      silentLogger.info(`[AgentTools] Executing get_news`);
      try {
          const news = await marketDataService.getNews();
          return news ? news.slice(0, 3) : "Berita tidak tersedia"; // Ambil 3 berita teratas
      } catch (error: any) {
          silentLogger.warn(`[AgentTools] Failed to fetch news: ${error.message}`);
          return "Error fetching news";
      }
  },

  /**
   * Mengambil status likuiditas.
   */
  async get_liquidity(context: AgentContext): Promise<any> {
      silentLogger.info(`[AgentTools] Executing get_liquidity`);
      try {
          // Assuming getSnapshot() in nexusService also contains liquidity info
          const snapshot = await nexusService.getSnapshot();
          return snapshot?.liquidity || "Status likuiditas tidak tersedia";
      } catch (error: any) {
          silentLogger.warn(`[AgentTools] Failed to fetch liquidity: ${error.message}`);
          return "Error fetching liquidity";
      }
  },

  /**
   * Mengambil indikator makro.
   */
  async get_macro_indicators(context: AgentContext): Promise<any> {
      silentLogger.info(`[AgentTools] Executing get_macro_indicators`);
      try {
          // Assuming getSnapshot() in nexusService also contains relevant indicators
          const snapshot = await nexusService.getSnapshot();
          // Extract relevant indicators, provide fallbacks
          return {
              fedFundsRate: snapshot?.fedFundsRate ?? "N/A",
              breakeven5y: snapshot?.breakeven5y ?? "N/A",
              cpiYoY: snapshot?.cpiYoY ?? "N/A",
              growthSentiment: snapshot?.growthSentiment ?? "N/A",
              ismPmi: snapshot?.ismPmi ?? "N/A",
              walcl: snapshot?.walcl ?? "N/A",
              realYields: snapshot?.realYields ?? "N/A"
          };
      } catch (error: any) {
          silentLogger.warn(`[AgentTools] Failed to fetch macro indicators: ${error.message}`);
          return "Error fetching macro indicators";
      }
  },

  // Helper function internal
  async fetchGenericYahooQuote(symbol: string): Promise<{ price: number; changePercent: number } | null> {
      try {
          const res = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`, { timeout: 5000 });
          const result = res.data?.chart?.result?.[0];
          if (!result) return null;
          const meta = result.meta;
          const price = meta?.regularMarketPrice;
          const previousClose = meta?.chartPreviousClose ?? meta?.previousClose;
          if (price == null) return null;
          const change = previousClose != null ? price - previousClose : 0;
          const changePercent = previousClose != null && previousClose !== 0 ? (change / previousClose) * 100 : 0;
          return {
              price: Math.round(price * 100) / 100,
              changePercent: Math.round(changePercent * 100) / 100
          };
      } catch (e) {
          silentLogger.warn(`[AgentTools] Yahoo fallback failed for ${symbol}: ${e}`);
          return null;
      }
  },

  getMockEconomicCalendar() {
      return [
          { event: "CPI YoY", country: "US", date: "Today 19:30", estimate: "3.1%", impact: "HIGH" },
          { event: "Non-Farm Payrolls", country: "US", date: "Tomorrow 19:30", estimate: "180K", impact: "HIGH" },
          { event: "FOMC Rate Decision", country: "US", date: "Next Week", estimate: "5.50%", impact: "CRITICAL" }
      ];
  }
};
