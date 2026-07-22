import type { CotItem, MarketPhase } from "@/types/cot";
import { env } from "@/lib/env";

const COT_API = "https://publicreporting.cftc.gov/resource/6dca-aqww.json";

const EXTREME_THRESHOLD = 1.5;

function getMarketPhase(
  managedMoneyNet: number,
  commercialsNet: number
): MarketPhase {
  const mmPositive = managedMoneyNet > 0;
  const commNetShort = commercialsNet < 0;
  const commNetLong = commercialsNet > 0;
  const commAbs = Math.abs(commercialsNet);
  const mmAbs = Math.abs(managedMoneyNet);

  if (mmPositive && !commNetShort) {
    return { label: "MARK UP", color: "green", isWarning: false };
  }

  if (mmPositive && commNetShort && commAbs > managedMoneyNet * EXTREME_THRESHOLD) {
    return { label: "DISTRIBUTION", color: "yellow", isWarning: true };
  }

  if (!mmPositive && !commNetLong) {
    return { label: "MARK DOWN", color: "red", isWarning: false };
  }

  if (!mmPositive && commNetLong && commercialsNet > mmAbs * EXTREME_THRESHOLD) {
    return { label: "ACCUMULATION", color: "blue", isWarning: true };
  }

  return { label: "NEUTRAL", color: "gray", isWarning: false };
}

function calculateSentiment(nonCommercialLong: number, nonCommercialShort: number): "BULLISH" | "BEARISH" | "NEUTRAL" {
  const netPosition = nonCommercialLong - nonCommercialShort;
  const totalPosition = nonCommercialLong + nonCommercialShort;
  
  if (totalPosition === 0) return "NEUTRAL";
  
  const ratio = Math.abs(netPosition) / totalPosition;
  
  if (ratio < 0.1) return "NEUTRAL";
  
  return netPosition > 0 ? "BULLISH" : "BEARISH";
}

function formatPosition(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return "0";
  return Math.round(value).toLocaleString();
}

const SYMBOLS_MAP: Record<string, { symbol: string; name: string; category: string }> = {
  "067651": { symbol: "CL=F", name: "Crude Oil", category: "Energy" },
  "088691": { symbol: "GC=F", name: "Gold", category: "Metals" },
  "099741": { symbol: "EUR/USD", name: "Euro FX", category: "Currencies" },
  "13874A": { symbol: "ES=F", name: "E-Mini S&P 500", category: "Indices" },
  "209742": { symbol: "NQ=F", name: "Nasdaq 100", category: "Indices" },
  "084691": { symbol: "SI=F", name: "Silver", category: "Metals" },
  "096742": { symbol: "GBP/USD", name: "British Pound", category: "Currencies" },
  "097741": { symbol: "JPY/USD", name: "Japanese Yen", category: "Currencies" },
  "232741": { symbol: "AUD/USD", name: "Australian Dollar", category: "Currencies" },
};

function mapRecord(item: any) {
  const meta = SYMBOLS_MAP[item.cftc_contract_market_code] || {
    symbol: "UNKNOWN", name: item.contract_market_name || "Unknown", category: "Other"
  };
  const nonCL = parseInt(item.noncomm_positions_long_all || "0", 10);
  const nonCS = parseInt(item.noncomm_positions_short_all || "0", 10);
  const commLong = parseInt(item.comm_positions_long_all || "0", 10);
  const commShort = parseInt(item.comm_positions_short_all || "0", 10);
  const retailLong = parseInt(item.nonrept_positions_long_all || "0", 10);
  const retailShort = parseInt(item.nonrept_positions_short_all || "0", 10);
  const net = nonCL - nonCS;
  const total = nonCL + nonCS;
  let sentiment = "NEUTRAL";
  if (total > 0 && Math.abs(net) / total >= 0.1) sentiment = net > 0 ? "BULLISH" : "BEARISH";

  const managedMoneyNet = nonCL - nonCS;
  const commercialsNet = commLong - commShort;
  const phase = getMarketPhase(managedMoneyNet, commercialsNet);

  return {
    symbol: meta.symbol, name: meta.name, category: meta.category,
    commercialLong: commLong, commercialShort: commShort,
    commercialSpread: Math.abs(commLong - commShort),
    nonCommercialLong: nonCL, nonCommercialShort: nonCS,
    nonCommercialSpread: Math.abs(nonCL - nonCS),
    retailLong, retailShort, retailSpread: Math.abs(retailLong - retailShort),
    sentiment, phase,
    lastUpdate: item.report_date_as_yyyy_mm_dd || new Date().toISOString(),
  };
}

export async function getCotData(): Promise<CotItem[]> {
  try {
    // Server-side: fetch CFTC directly (no CORS)
    // Client-side: proxy via Next.js API route
    const isServer = typeof window === "undefined";
    const codes = Object.keys(SYMBOLS_MAP).map(c => `'${c}'`).join(",");
    const url = isServer
      ? `${COT_API}?$where=${encodeURIComponent(`cftc_contract_market_code in (${codes})`)}&$limit=9&$order=${encodeURIComponent("report_date_as_yyyy_mm_dd DESC")}`
      : `/api/macro/cot`;

    const res = await fetch(url, isServer ? { next: { revalidate: 3600 } } : {});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    let records: any[];
    if (isServer) {
      records = await res.json();
    } else {
      const json = await res.json();
      records = Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];
    }

    if (Array.isArray(records) && records.length > 0) {
      const items = records.map(mapRecord) as CotItem[];
      if (items.length > 0) return items;
    }
  } catch (e) {
    console.error("[COT] fetch failed:", e);
  }

  return getFallbackData();
}

export async function analyzeCotData(cotItem: CotItem): Promise<{ momentum: string; warnings: string; conclusion: string } | null> {
  try {
    const url = typeof window !== "undefined"
      ? `/api/macro/cot`
      : `${env.backendUrl}/api/v1/market-data/cot/analyze`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "analyze", ...cotItem }),
    });
    if (!response.ok) return null;
    const json = await response.json();
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}


function getFallbackData(): CotItem[] {
  const d = new Date().toISOString();
  const makeItem = (item: Omit<CotItem, "phase" | "lastUpdate">): CotItem => {
    const managedMoneyNet = item.nonCommercialLong - item.nonCommercialShort;
    const commercialsNet = item.commercialLong - item.commercialShort;
    return { ...item, lastUpdate: d, phase: getMarketPhase(managedMoneyNet, commercialsNet) };
  };
  return [
    makeItem({ symbol: "CL=F", name: "Crude Oil", category: "Energy", sentiment: "BULLISH", commercialLong: 245678, commercialShort: 189012, commercialSpread: 56666, nonCommercialLong: 412345, nonCommercialShort: 387654, nonCommercialSpread: 24691, retailLong: 45000, retailShort: 52000, retailSpread: 7000 }),
    makeItem({ symbol: "GC=F", name: "Gold", category: "Metals", sentiment: "BULLISH", commercialLong: 112345, commercialShort: 98765, commercialSpread: 13580, nonCommercialLong: 234567, nonCommercialShort: 198765, nonCommercialSpread: 35802, retailLong: 32000, retailShort: 28000, retailSpread: 4000 }),
    makeItem({ symbol: "SI=F", name: "Silver", category: "Metals", sentiment: "NEUTRAL", commercialLong: 45678, commercialShort: 52345, commercialSpread: 6667, nonCommercialLong: 123456, nonCommercialShort: 112345, nonCommercialSpread: 11111, retailLong: 18000, retailShort: 15000, retailSpread: 3000 }),
    makeItem({ symbol: "EUR/USD", name: "Euro FX", category: "Currencies", sentiment: "NEUTRAL", commercialLong: 156789, commercialShort: 178901, commercialSpread: 22112, nonCommercialLong: 345678, nonCommercialShort: 321098, nonCommercialSpread: 24580, retailLong: 41000, retailShort: 38000, retailSpread: 3000 }),
    makeItem({ symbol: "GBP/USD", name: "British Pound", category: "Currencies", sentiment: "BEARISH", commercialLong: 98765, commercialShort: 112345, commercialSpread: 13580, nonCommercialLong: 212345, nonCommercialShort: 198765, nonCommercialSpread: 13580, retailLong: 22000, retailShort: 25000, retailSpread: 3000 }),
    makeItem({ symbol: "JPY/USD", name: "Japanese Yen", category: "Currencies", sentiment: "BULLISH", commercialLong: 189012, commercialShort: 167890, commercialSpread: 21122, nonCommercialLong: 298765, nonCommercialShort: 276543, nonCommercialSpread: 22222, retailLong: 35000, retailShort: 31000, retailSpread: 4000 }),
    makeItem({ symbol: "AUD/USD", name: "Australian Dollar", category: "Currencies", sentiment: "NEUTRAL", commercialLong: 78000, commercialShort: 85000, commercialSpread: 7000, nonCommercialLong: 145000, nonCommercialShort: 132000, nonCommercialSpread: 13000, retailLong: 19000, retailShort: 21000, retailSpread: 2000 }),
    makeItem({ symbol: "NQ=F", name: "Nasdaq 100", category: "Indices", sentiment: "BULLISH", commercialLong: 312456, commercialShort: 287654, commercialSpread: 24802, nonCommercialLong: 512345, nonCommercialShort: 487654, nonCommercialSpread: 24691, retailLong: 58000, retailShort: 62000, retailSpread: 4000 }),
    makeItem({ symbol: "ES=F", name: "E-Mini S&P 500", category: "Indices", sentiment: "BULLISH", commercialLong: 412345, commercialShort: 387654, commercialSpread: 24691, nonCommercialLong: 612345, nonCommercialShort: 587654, nonCommercialSpread: 24691, retailLong: 72000, retailShort: 68000, retailSpread: 4000 }),
  ];
}