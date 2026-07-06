import { mcpService } from "./mcp.service";
import { silentLogger } from "../utils/silent-logger";

export interface FundamentalScore {
  pair: string;
  baseCurrency: string;
  quoteCurrency: string;
  interestRateDiff: number;
  trendAlignment: "BULLISH" | "BEARISH" | "NEUTRAL";
  centralBankBias: "HAWKISH" | "DOVISH" | "NEUTRAL";
  compositeScore: number;
  reasoning: string;
}

interface RateRecord {
  currency: string;
  rate: number;
  change: number;
  bias: "HAWKISH" | "DOVISH" | "NEUTRAL";
}

const MAJOR_PAIRS = ["EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "NZDUSD", "EURJPY", "GBPJPY"];
const CURRENCY_PAIRS: Record<string, [string, string]> = {};
MAJOR_PAIRS.forEach(p => {
  CURRENCY_PAIRS[p] = [p.substring(0, 3), p.substring(3, 6)];
});

const DEFAULT_RATES: Record<string, RateRecord> = {
  USD: { currency: "USD", rate: 5.50, change: 0, bias: "NEUTRAL" },
  EUR: { currency: "EUR", rate: 4.25, change: -0.25, bias: "DOVISH" },
  GBP: { currency: "GBP", rate: 5.00, change: 0, bias: "NEUTRAL" },
  JPY: { currency: "JPY", rate: 0.50, change: 0.10, bias: "HAWKISH" },
  AUD: { currency: "AUD", rate: 4.35, change: 0, bias: "NEUTRAL" },
  NZD: { currency: "NZD", rate: 5.50, change: 0, bias: "NEUTRAL" },
  CAD: { currency: "CAD", rate: 4.75, change: -0.25, bias: "DOVISH" },
  CHF: { currency: "CHF", rate: 1.75, change: 0, bias: "NEUTRAL" },
};

class FundamentalResearchService {
  private rateCache: Record<string, RateRecord> = { ...DEFAULT_RATES };
  private lastFetch = 0;
  private readonly CACHE_TTL = 3600000;

  async scorePair(pair: string): Promise<FundamentalScore> {
    const upper = pair.toUpperCase();
    const currencies = CURRENCY_PAIRS[upper];
    if (!currencies) {
      return { pair, baseCurrency: "", quoteCurrency: "", interestRateDiff: 0, trendAlignment: "NEUTRAL", centralBankBias: "NEUTRAL", compositeScore: 0, reasoning: "Unknown pair" };
    }
    const [base, quote] = currencies;
    await this.refreshRates();
    const baseRate = this.rateCache[base] || DEFAULT_RATES[base];
    const quoteRate = this.rateCache[quote] || DEFAULT_RATES[quote];
    if (!baseRate || !quoteRate) {
      return { pair, baseCurrency: base, quoteCurrency: quote, interestRateDiff: 0, trendAlignment: "NEUTRAL", centralBankBias: "NEUTRAL", compositeScore: 0, reasoning: "Rate data unavailable" };
    }

    const rateDiff = baseRate.rate - quoteRate.rate;
    const baseBias = baseRate.bias;
    const quoteBias = quoteRate.bias;

    let alignment: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";
    let score = 0;
    const reasons: string[] = [];

    if (rateDiff > 1.0) { alignment = "BULLISH"; score += 30; reasons.push(`${base} rate ${baseRate.rate}% >> ${quote} rate ${quoteRate.rate}%`); }
    else if (rateDiff < -1.0) { alignment = "BEARISH"; score -= 30; reasons.push(`${quote} rate ${quoteRate.rate}% >> ${base} rate ${baseRate.rate}%`); }
    else { reasons.push(`Rates comparable (${baseRate.rate}% vs ${quoteRate.rate}%)`); }

    if (baseBias === "HAWKISH" && quoteBias === "DOVISH") { score += 25; alignment = "BULLISH"; reasons.push(`${base} hawkish vs ${quote} dovish`); }
    else if (baseBias === "DOVISH" && quoteBias === "HAWKISH") { score -= 25; alignment = "BEARISH"; reasons.push(`${base} dovish vs ${quote} hawkish`); }
    else { reasons.push(`Central bank biases aligned (${baseBias}/${quoteBias})`); }

    const compositeScore = Math.max(-100, Math.min(100, score));
    return {
      pair: upper, baseCurrency: base, quoteCurrency: quote,
      interestRateDiff: Math.round(rateDiff * 100) / 100,
      trendAlignment: alignment, centralBankBias: Math.abs(score) >= 25 ? (score > 0 ? "HAWKISH" : "DOVISH") : "NEUTRAL",
      compositeScore, reasoning: reasons.join("; "),
    };
  }

  async getHighProbabilityPairs(minAbsScore = 30): Promise<string[]> {
    const scored = await Promise.all(MAJOR_PAIRS.map(async p => ({
      pair: p, score: (await this.scorePair(p)).compositeScore,
    })));
    return scored.filter(s => Math.abs(s.score) >= minAbsScore).sort((a, b) => Math.abs(b.score) - Math.abs(a.score)).map(s => s.pair);
  }

  private async refreshRates(): Promise<void> {
    if (Date.now() - this.lastFetch < this.CACHE_TTL) return;
    try {
      const result = await mcpService.executeTool("get_central_bank_rates", { currencies: Object.keys(DEFAULT_RATES) });
      if (result?.content?.[0]?.text) {
        const data = JSON.parse(result.content[0].text);
        if (Array.isArray(data)) {
          for (const item of data) {
            const currency = (item.currency || "").toUpperCase();
            if (this.rateCache[currency]) {
              this.rateCache[currency] = {
                currency, rate: parseFloat(item.rate) || 0,
                change: parseFloat(item.change) || 0,
                bias: (item.bias || "NEUTRAL").toUpperCase() as any,
              };
            }
          }
          this.lastFetch = Date.now();
          silentLogger.info(`[FUNDAMENTAL] Loaded rates for ${data.length} currencies`);
        }
      }
    } catch (err: any) {
      silentLogger.warn(`[FUNDAMENTAL] Rate fetch failed, using defaults: ${err.message}`);
      this.lastFetch = Date.now();
    }
  }
}

export const fundamentalResearchService = new FundamentalResearchService();
