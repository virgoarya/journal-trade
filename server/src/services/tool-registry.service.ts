import { silentLogger } from "../utils/silent-logger";
import { AgentContext } from "../agents/base.agent";
import { agentTools } from "../helpers/agent-tools.helper";

export type ToolName = keyof typeof agentTools;

export interface ToolExecutionResult {
  toolName: ToolName;
  result: any;
  error?: string;
}

class ToolRegistryService {
  private availableTools: any = agentTools;

  /**
   * Mendeteksi dan menjalankan tools berdasarkan prompt dan context.
   * Saat ini menggunakan keyword detection sederhana.
   * Di masa depan bisa menggunakan LLM untuk tool routing yang lebih canggih.
   */
  async runToolsForPrompt(
    prompt: string,
    context: AgentContext
  ): Promise<{ enrichedContext: Record<string, any>; toolsUsed: string[] }> {
    const enrichedContext: Record<string, any> = {};
    const toolsUsed: string[] = [];

    // Keyword detection untuk get_price
    const priceSymbols = this.extractSymbolsForPrice(prompt);
    if (priceSymbols.length > 0) {
      silentLogger.info(`[ToolRegistry] Running get_price for symbols: ${priceSymbols.join(", ")}`);
      try {
        const prices = await this.availableTools.get_price(context, priceSymbols);
        enrichedContext.marketPrices = prices;
        toolsUsed.push("get_price");
      } catch (error: any) {
        silentLogger.error(`[ToolRegistry] Error running get_price: ${error.message}`);
        enrichedContext.marketPricesError = error.message;
      }
    }

    // Keyword detection untuk get_economic_calendar
    if (/(economic calendar|kalender ekonomi|event ekonomi)/i.test(prompt)) {
      silentLogger.info(`[ToolRegistry] Running get_economic_calendar`);
      try {
        const calendar = await this.availableTools.get_economic_calendar(context);
        enrichedContext.economicCalendar = calendar;
        toolsUsed.push("get_economic_calendar");
      } catch (error: any) {
        silentLogger.error(`[ToolRegistry] Error running get_economic_calendar: ${error.message}`);
        enrichedContext.economicCalendarError = error.message;
      }
    }

    // Keyword detection untuk get_market_regime
    if (/(market regime|rezim pasar|kondisi pasar)/i.test(prompt)) {
        silentLogger.info(`[ToolRegistry] Running get_market_regime`);
        try {
            const regime = await this.availableTools.get_market_regime(context);
            enrichedContext.marketRegime = regime;
            toolsUsed.push("get_market_regime");
        } catch (error: any) {
            silentLogger.error(`[ToolRegistry] Error running get_market_regime: ${error.message}`);
            enrichedContext.marketRegimeError = error.message;
        }
    }

    // Keyword detection untuk get_news
    if (/(berita terbaru|news|berita makro)/i.test(prompt)) {
        silentLogger.info(`[ToolRegistry] Running get_news`);
        try {
            const news = await this.availableTools.get_news(context);
            enrichedContext.marketNews = news;
            toolsUsed.push("get_news");
        } catch (error: any) {
            silentLogger.error(`[ToolRegistry] Error running get_news: ${error.message}`);
            enrichedContext.marketNewsError = error.message;
        }
    }

    // Keyword detection untuk get_liquidity
    if (/(likuiditas|liquidity)/i.test(prompt)) {
        silentLogger.info(`[ToolRegistry] Running get_liquidity`);
        try {
            const liquidity = await this.availableTools.get_liquidity(context);
            enrichedContext.liquidityStatus = liquidity;
            toolsUsed.push("get_liquidity");
        } catch (error: any) {
            silentLogger.error(`[ToolRegistry] Error running get_liquidity: ${error.message}`);
            enrichedContext.liquidityStatusError = error.message;
        }
    }

    // Keyword detection untuk get_macro_indicators
    if (/(indikator makro|cpi|fed funds|breakeven)/i.test(prompt)) {
        silentLogger.info(`[ToolRegistry] Running get_macro_indicators`);
        try {
            const indicators = await this.availableTools.get_macro_indicators(context);
            enrichedContext.macroIndicators = indicators;
            toolsUsed.push("get_macro_indicators");
        } catch (error: any) {
            silentLogger.error(`[ToolRegistry] Error running get_macro_indicators: ${error.message}`);
            enrichedContext.macroIndicatorsError = error.message;
        }
    }


    return { enrichedContext, toolsUsed };
  }

  // Helper untuk mengekstrak simbol dari prompt (contoh sederhana)
  private extractSymbolsForPrice(prompt: string): string[] {
    const symbols = new Set<string>();
    const keyword = /(harga|price|quote)\s+([A-Z0-9=\-]+)/gi; // "harga XAUUSD", "price DXY", "quote CL=F"
    let match;
    while ((match = keyword.exec(prompt)) !== null) {
      symbols.add(match[2].toUpperCase());
    }
    // Tambahkan simbol default jika prompt secara umum tentang pasar dan belum ada simbol spesifik
    if (symbols.size === 0 && /(pasar|market|gold|dxy)/i.test(prompt)) {
      if (/(gold|xauusd)/i.test(prompt)) symbols.add("XAUUSD");
      if (/(dxy|dollar index)/i.test(prompt)) symbols.add("DXY");
    }
    return Array.from(symbols);
  }
}

export const toolRegistryService = new ToolRegistryService();
