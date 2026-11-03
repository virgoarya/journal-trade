import { agentTools } from "../helpers/agent-tools.helper";
import { silentLogger } from "../utils/silent-logger";

export const macroNewsService = {
  /**
   * Mengambil konteks makro dan mengecek apakah trading harus dihindari
   * karena berita high-impact.
   */
  getMacroContext: async (symbol: string) => {
    try {
      // 1. Ambil kalender ekonomi
      const calendar = await agentTools.get_economic_calendar({});

      // 2. Ambil berita
      const news = await agentTools.get_news({});

      // 3. Cek berita high-impact
      const highImpactEvents = Array.isArray(calendar)
        ? calendar.filter((e: any) => e.impact === "HIGH" || e.impact === "CRITICAL")
        : [];

      // Logika sederhana: jika ada event HIGH/CRITICAL dalam 30 menit ke depan, hindari trading
      const now = Date.now();
      const avoidTrading = highImpactEvents.some((e: any) => {
        const eventTime = new Date(e.date).getTime();
        const diffMinutes = (eventTime - now) / 60000;
        return diffMinutes > -30 && diffMinutes < 30;
      });

      return {
        sentiment: typeof news === 'string' ? "Neutral" : "Mixed",
        highImpactEvents,
        avoidTrading,
        summary: avoidTrading ? "High-impact event window detected!" : "Market conditions stable.",
        error: false
      };
    } catch (error: any) {
      silentLogger.error(`[MacroNewsService] Error: ${error.message}`);
      return {
        sentiment: "Neutral",
        highImpactEvents: [],
        avoidTrading: false,
        summary: "Error fetching macro context.",
        error: true
      };
    }
  },

  /**
   * Mengambil skor sentimen berita (-1 sampai +1)
   */
  getSentimentScore: async (symbol: string): Promise<number> => {
    try {
      const news = await agentTools.get_news({});
      if (typeof news === 'string' || !news || news.length === 0) return 0;

      let score = 0;
      let count = 0;
      for (const item of news) {
        if (item.analysis) {
           const sentiment = item.analysis.dampakMarket?.toLowerCase().includes("risk-on") ? 0.5 :
                             item.analysis.dampakMarket?.toLowerCase().includes("risk-off") ? -0.5 : 0;
           score += sentiment;
           count++;
        }
      }
      return count > 0 ? Math.max(-1, Math.min(1, score / count)) : 0;
    } catch {
      return 0;
    }
  }
};
