import { NextRequest, NextResponse } from "next/server";

let cache: { data: any; timestamp: number } | null = null;
const CACHE_TTL_MS = 15 * 60 * 1000;

interface EconomicEvent {
  time?: string;
  country?: string;
  title?: string;
  impact: "High" | "Medium" | "Low";
  forecast: string;
  previous: string;
  actual: string;
  direction?: "higher_is_better" | "lower_is_better" | "neutral";
}

async function fetchFromFinnhub() {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return null;

  try {
    const resp = await fetch(
      `https://finnhub.io/api/v1/calendar/economic?token=${apiKey}`
    );
    
    if (resp.ok) {
      const json = await resp.json();
      return (json.economicCalendar || []).map((item: any) => ({
        time: item.time,
        country: (item.country || "US").toUpperCase(),
        title: item.event || item.title,
        impact: item.impact === 1 ? "High" : item.impact === 2 ? "Medium" : "Low",
        forecast: item.forecast || "",
        previous: item.previous || "",
        actual: item.actual || "",
        direction: "neutral" as const,
      }));
    }
  } catch {}
  return null;
}

async function fetchFromTradingView() {
  try {
    const now = new Date();
    const startOfWeek = new Date(now);
    const start = startOfWeek.toISOString();
    const end = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const resp = await fetch(
      `https://economic-calendar.tradingview.com/events?from=${start}&to=${end}&countries=US,GB,EU,JP,AU,CA,NZ`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );

    if (resp.ok) {
      const json = await resp.json();
      return (json.result || []).map((item: any) => ({
        time: item.date,
        country: (item.currency || "US").toUpperCase(),
        title: item.title,
        impact: ["High", "Medium", "Low"][item.importance] || "Medium",
        forecast: item.forecast || "",
        previous: item.previous || "",
        actual: item.actual || "",
        direction: "neutral" as const,
      }));
    }
  } catch {}
  return null;
}

export async function GET(request: NextRequest) {
  const now = Date.now();
  
  if (cache && now - cache.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({ success: true, data: cache.data, fromCache: true });
  }

  let events: EconomicEvent[] | null = null;
  let rateLimited = false;

  // Try Finnhub first
  events = await fetchFromFinnhub();
  
  // Fallback to TradingView
  if (!events || events.length === 0) {
    events = await fetchFromTradingView();
  }

  if (events && events.length > 0) {
    cache = { data: events, timestamp: now };
    return NextResponse.json({ success: true, data: events, rateLimited });
  }

  return NextResponse.json(
    { success: false, message: "Rate limit reached, no data available", rateLimited: true },
    { status: 503 }
  );
}

export const dynamic = "force-dynamic";
export const revalidate = 0;