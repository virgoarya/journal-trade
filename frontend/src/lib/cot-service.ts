import type { CotItem, MarketPhase } from "@/types/cot";

const COT_API_BASE = "https://api.iextrading.com/1/data/CFTC/1";
const API_KEY = process.env.NASDAQ_API_KEY;

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

export async function getCotData(): Promise<CotItem[]> {
  const backendUrl = "http://localhost:5000/api/v1/market-data/cot";
  
  try {
    const response = await fetch(backendUrl, {
      next: { revalidate: 3600 },
      headers: { "Accept": "application/json" },
    });

    if (!response.ok) {
      console.error("[COT SERVICE] Backend API Error:", response.status);
      return getFallbackData();
    }

    const resJson = await response.json();
    const dataArray = Array.isArray(resJson.data) ? resJson.data : 
                      Array.isArray(resJson) ? resJson : 
                      Object.values(resJson).filter((v: any) => v && typeof v === 'object' && 'symbol' in v);

    const transformed: CotItem[] = (dataArray as any[]).map((item: any) => {
      const managedMoneyNet = (item.nonCommercialLong || 0) - (item.nonCommercialShort || 0);
      const commercialsNet = (item.commercialLong || 0) - (item.commercialShort || 0);
      const phase = getMarketPhase(managedMoneyNet, commercialsNet);

      return {
        symbol: item.symbol || "UNKNOWN",
        name: item.name || item.symbol || "UNKNOWN",
        category: item.category || "Other",
        sentiment: item.sentiment || "NEUTRAL",
        commercialLong: item.commercialLong || 0,
        commercialShort: item.commercialShort || 0,
        commercialSpread: item.commercialSpread || 0,
        nonCommercialLong: item.nonCommercialLong || 0,
        nonCommercialShort: item.nonCommercialShort || 0,
        nonCommercialSpread: item.nonCommercialSpread || 0,
        retailLong: item.retailLong || 0,
        retailShort: item.retailShort || 0,
        retailSpread: item.retailSpread || 0,
        lastUpdate: item.lastUpdate || new Date().toISOString(),
        phase,
      };
    });

    console.log("[COT SERVICE] Fetched", transformed.length, "items");
    return transformed.length > 0 ? transformed : getFallbackData();
  } catch (error) {
    console.error("[COT SERVICE] Fetch error:", error);
    return getFallbackData();
  }
}

export async function analyzeCotData(cotItem: CotItem): Promise<{ momentum: string; warnings: string; conclusion: string } | null> {
  try {
    const response = await fetch("http://localhost:5000/api/v1/market-data/cot/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cotItem),
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