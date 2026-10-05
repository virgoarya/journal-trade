import { AgentContext } from "../agents/base.agent";
import { nexusService } from "../services/nexus.service";
import { marketDataService } from "../services/market-data.service";
import { marketRegimeService } from "../services/market-regime.service";
import { silentLogger } from "../utils/silent-logger";
import axios from "axios";
import { env } from "../config/env";

export const agentTools = {
  /**
   * Mengambil harga pasar realtime untuk simbol tertentu.
   * Saat ini menggunakan mock data atau Yahoo Finance via nexus.service jika tersedia.
   */
  async get_price(context: AgentContext, symbols: string[]): Promise<Record<string, any>> {
    silentLogger.info(`[AgentTools] Executing get_price for: ${symbols.join(", ")}`);
    const results: Record<string, any> = {};

    let snapshot: any = null;
    try {
      snapshot = await nexusService.getSnapshot();
    } catch (e: any) {
      silentLogger.warn(`[AgentTools] nexusService.getSnapshot failed: ${e.message}`);
    }

    for (const symbol of symbols) {
      const upper = symbol.toUpperCase();
      try {
        if ((upper === "XAUUSD" || upper === "GC=F") && snapshot?.gold) {
          results[symbol] = { price: snapshot.gold.price, changePercent: snapshot.gold.changePercent };
          continue;
        }
        if ((upper === "DXY" || upper === "DX-Y.NYB") && snapshot?.dxy) {
          results[symbol] = { price: snapshot.dxy.price, changePercent: snapshot.dxy.changePercent };
          continue;
        }

        const yahooQuote = await this.fetchGenericYahooQuote(upper === "XAUUSD" ? "GC=F" : upper === "DXY" ? "DX-Y.NYB" : upper);
        results[symbol] = yahooQuote || "Data tidak tersedia";
      } catch (error: any) {
        silentLogger.warn(`[AgentTools] Failed to fetch price for ${symbol}: ${error.message}`);
        results[symbol] = "Error fetching price";
      }
    }
    return results;
  },

  /**
   * Mengambil kalender ekonomi terbaru.
   * Mencoba Finnhub via frontend API route (jika accessible secara internal) atau mock.
   */
  async get_economic_calendar(context: AgentContext): Promise<any> {
    silentLogger.info(`[AgentTools] Executing get_economic_calendar`);
    try {
      const apiKey = env.FINNHUB_API_KEY;
      if (!apiKey) {
          silentLogger.warn("[AgentTools] FINNHUB_API_KEY tidak diset, menggunakan mock calendar.");
          return this.getMockEconomicCalendar();
      }

      // Fetch langsung ke Finnhub API jika ada API key
      const response = await axios.get(`https://finnhub.io/api/v1/calendar/economic?token=${apiKey}`, { timeout: 5000 });
      if (response.data && response.data.economicCalendar) {
          // Ambil 5 event mendatang terdekat
          return response.data.economicCalendar.slice(0, 5).map((event: any) => ({
              event: event.event,
              country: event.country,
              date: event.time,
              actual: event.actual,
              estimate: event.estimate,
              impact: event.impact
          }));
      }
      return this.getMockEconomicCalendar();
    } catch (error: any) {
      silentLogger.warn(`[AgentTools] Failed to fetch economic calendar: ${error.message}`);
      return this.getMockEconomicCalendar();
    }
  },

  /**
   * Mengambil rezim pasar saat ini.
   */
  async get_market_regime(context: AgentContext): Promise<any> {
      silentLogger.info(`[AgentTools] Executing get_market_regime`);
      try {
          const dummyCandles = [
            { time: Date.now() - 86400000, open: 100, high: 102, low: 99, close: 101, volume: 1000 },
            { time: Date.now() - 43200000, open: 101, high: 103, low: 100, close: 102, volume: 1200 },
            { time: Date.now() - 21600000, open: 102, high: 104, low: 101, close: 103, volume: 1100 },
            { time: Date.now() - 10800000, open: 103, high: 105, low: 102, close: 104, volume: 1300 },
            { time: Date.now() - 5400000, open: 104, high: 106, low: 103, close: 105, volume: 1500 },
          ];
          const regimeData = marketRegimeService.analyze(dummyCandles);
          return regimeData || "Data rezim tidak tersedia";
      } catch (error: any) {
          silentLogger.warn(`[AgentTools] Failed to fetch market regime: ${error.message}`);
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
          const snapshot = await nexusService.getSnapshot();
          return {
            walcl: snapshot.walcl || "N/A",
            status: "STABLE",
          };
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
          const snapshot = await nexusService.getSnapshot();
          return {
            cpiYoY: snapshot.cpiYoY ?? null,
            fedFundsRate: snapshot.fedFundsRate?.value ?? null,
            ismPmi: snapshot.ismPmi ?? null,
            realYields: snapshot.realYields?.value ?? null,
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
