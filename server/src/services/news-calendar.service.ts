import { mcpService } from "./mcp.service";
import { silentLogger } from "../utils/silent-logger";

export type Currency = "USD" | "EUR" | "GBP" | "JPY" | "AUD" | "NZD" | "CAD" | "CHF";
export type Impact = "HIGH" | "MEDIUM" | "LOW";

export interface EconomicEvent {
  time: Date;
  currency: Currency;
  impact: Impact;
  event: string;
  description?: string;
  forecast?: string;
  previous?: string;
}

export interface NewsWarning {
  symbol: string;
  event: string;
  currency: string;
  minutesUntil: number;
  impact: "HIGH";
}

const CURRENCY_MAP: Record<string, Currency[]> = {
  EURUSD: ["EUR", "USD"], GBPUSD: ["GBP", "USD"], USDJPY: ["USD", "JPY"],
  AUDUSD: ["AUD", "USD"], USDCAD: ["USD", "CAD"], NZDUSD: ["NZD", "USD"],
  EURJPY: ["EUR", "JPY"], GBPJPY: ["GBP", "JPY"],
  XAUUSD: ["USD"], XAGUSD: ["USD"], BTCUSD: ["USD"],
  ETHUSD: ["USD"], USDCHF: ["USD", "CHF"], EURGBP: ["EUR", "GBP"],
};

const HIGH_IMPACT_EVENTS = [
  "Non-Farm Payrolls", "CPI", "Interest Rate Decision", "GDP",
  "Retail Sales", "Unemployment Rate", "FOMC", "PPI",
  "ISM Manufacturing", "ISM Services", "Consumer Confidence",
  "Trade Balance", "Industrial Production", "Central Bank",
  "NFP", "Consumer Price Index", "Gross Domestic Product",
];

class NewsCalendarService {
  private cache: EconomicEvent[] = [];
  private lastFetch = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000;

  async getUpcomingEvents(hoursAhead = 48): Promise<EconomicEvent[]> {
    await this.refreshCache();
    const now = Date.now();
    const cutoff = now + hoursAhead * 60 * 60 * 1000;
    return this.cache
      .filter(e => e.time.getTime() >= now && e.time.getTime() <= cutoff)
      .sort((a, b) => a.time.getTime() - b.time.getTime());
  }

  async getHighImpactEvents(hoursAhead = 24): Promise<EconomicEvent[]> {
    const events = await this.getUpcomingEvents(hoursAhead);
    return events.filter(e => e.impact === "HIGH");
  }

  async isHighImpactWindow(symbol: string, minutesBuffer = 30): Promise<boolean> {
    const currencies = CURRENCY_MAP[symbol.toUpperCase()];
    if (!currencies?.length) return false;

    const now = Date.now();
    const windowMs = minutesBuffer * 60 * 1000;
    const events = await this.getHighImpactEvents(2);

    for (const event of events) {
      if (!currencies.includes(event.currency)) continue;
      const eventTime = event.time.getTime();
      if (Math.abs(eventTime - now) <= windowMs) return true;
    }
    return false;
  }

  async getActiveWarnings(symbols: string[]): Promise<NewsWarning[]> {
    const warnings: NewsWarning[] = [];
    const events = await this.getHighImpactEvents(2);
    const now = Date.now();

    for (const sym of symbols) {
      const currencies = CURRENCY_MAP[sym.toUpperCase()];
      if (!currencies) continue;
      for (const ev of events) {
        if (!currencies.includes(ev.currency)) continue;
        const diffMs = ev.time.getTime() - now;
        const minutesUntil = Math.round(diffMs / 60000);
        if (Math.abs(minutesUntil) <= 120) {
          warnings.push({
            symbol: sym, event: ev.event, currency: ev.currency,
            minutesUntil, impact: "HIGH",
          });
        }
      }
    }

    return warnings.sort((a, b) => a.minutesUntil - b.minutesUntil);
  }

  private async refreshCache(): Promise<void> {
    if (Date.now() - this.lastFetch < this.CACHE_TTL) return;
    try {
      const result = await mcpService.executeTool("get_economic_calendar", { days_ahead: 7 });

      if (result?.content?.[0]?.text) {
        const raw = JSON.parse(result.content[0].text);
        if (Array.isArray(raw)) {
          this.cache = raw
            .map((e: any) => ({
              time: new Date(e.time || e.date || e.datetime),
              currency: (e.currency || "USD").toUpperCase() as Currency,
              impact: ((e.impact || "LOW").toUpperCase()) as Impact,
              event: e.event || e.name || "Unknown",
              description: e.description,
              forecast: e.forecast,
              previous: e.previous,
            }))
            .filter((e: EconomicEvent) =>
              (e.impact === "HIGH" || e.impact === "MEDIUM") &&
              !isNaN(e.time.getTime())
            );
          this.lastFetch = Date.now();
          silentLogger.info(`[NEWS] Loaded ${this.cache.length} economic events`);
        }
      }
    } catch (err: any) {
      // Fallback: generate known high-impact events for the week
      this.cache = this.generateFallbackEvents();
      this.lastFetch = Date.now();
      silentLogger.warn(`[NEWS] Calendar fetch failed, using fallback: ${err.message}`);
    }
  }

  private generateFallbackEvents(): EconomicEvent[] {
    const now = new Date();
    const events: EconomicEvent[] = [];
    const day = now.getDay();
    const hour = now.getUTCHours() - 5; // EST

    // Known weekly schedule (approximate)
    const weeklySchedule: Array<{ day: number; hourEST: number; event: string; currency: Currency }> = [
      { day: 1, hourEST: 8, event: "ISM Manufacturing PMI", currency: "USD" },
      { day: 2, hourEST: 8, event: "JOLTS Job Openings", currency: "USD" },
      { day: 3, hourEST: 8, event: "ADP Non-Farm Employment", currency: "USD" },
      { day: 3, hourEST: 10, event: "ISM Services PMI", currency: "USD" },
      { day: 4, hourEST: 8, event: "Initial Jobless Claims", currency: "USD" },
      { day: 5, hourEST: 8, event: "Non-Farm Payrolls", currency: "USD" },
      { day: 5, hourEST: 8, event: "Unemployment Rate", currency: "USD" },
      { day: 2, hourEST: 3, event: "Manufacturing PMI", currency: "GBP" },
      { day: 3, hourEST: 3, event: "Services PMI", currency: "GBP" },
      { day: 4, hourEST: 7, event: "BoE Interest Rate Decision", currency: "GBP" },
      { day: 2, hourEST: 4, event: "CPI", currency: "EUR" },
      { day: 4, hourEST: 7, event: "ECB Interest Rate Decision", currency: "EUR" },
      { day: 1, hourEST: 19, event: "CPI", currency: "JPY" },
      { day: 4, hourEST: 19, event: "Tokyo CPI", currency: "JPY" },
    ];

    for (const sched of weeklySchedule) {
      const eventDate = new Date(now);
      const daysUntil = (sched.day - day + 7) % 7 || 7;
      eventDate.setDate(eventDate.getDate() + daysUntil);
      eventDate.setUTCHours(sched.hourEST + 5, 0, 0, 0);

      if (eventDate.getTime() > now.getTime() && eventDate.getTime() < now.getTime() + 7 * 86400000) {
        events.push({
          time: eventDate,
          currency: sched.currency,
          impact: "HIGH",
          event: sched.event,
        });
      }
    }

    return events;
  }
}

export const newsCalendarService = new NewsCalendarService();
