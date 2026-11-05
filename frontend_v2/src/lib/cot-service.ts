import type { CotItem, MarketPhase } from "@/types/cot";
import { env } from "@/lib/env";

const COT_API = "https://publicreporting.cftc.gov/resource/6dca-aqww.json";
const EXTREME_THRESHOLD = 1.5;
const LOOKBACK_WEEKS = 52;

function getMarketPhase(managedMoneyNet: number, commercialsNet: number): MarketPhase {
  const mmPositive = managedMoneyNet > 0;
  const commNetShort = commercialsNet < 0;
  const commNetLong = commercialsNet > 0;
  const commAbs = Math.abs(commercialsNet);
  const mmAbs = Math.abs(managedMoneyNet);

  if (mmPositive && !commNetShort) return { label: "MARK UP", color: "green", isWarning: false };
  if (mmPositive && commNetShort && commAbs > managedMoneyNet * EXTREME_THRESHOLD) return { label: "DISTRIBUTION", color: "yellow", isWarning: true };
  if (!mmPositive && !commNetLong) return { label: "MARK DOWN", color: "red", isWarning: false };
  if (!mmPositive && commNetLong && commercialsNet > mmAbs * EXTREME_THRESHOLD) return { label: "ACCUMULATION", color: "blue", isWarning: true };
  return { label: "NEUTRAL", color: "gray", isWarning: false };
}

// ── COT Index (normalized 0–100 over LOOKBACK_WEEKS) ──
function calcCotIndex(net: number, history: number[]): number {
  const sorted = [...history].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  if (max === min) return 50;
  return ((net - min) / (max - min)) * 100;
}

// ── Direction Bias Score (−10 .. +10) ──
function calcDBS(netSM: number, netLS: number, cotSM: number, cotLS: number, wowSM: number): number {
  // Component 1: Smart Money alignment (0–4)
  let scoreSM = 0;
  if (netSM > 0) {
    if (cotSM >= 75) scoreSM = 4;
    else if (cotSM >= 50) scoreSM = 2;
    else scoreSM = 1;
  } else if (netSM < 0) {
    if (cotSM <= 25) scoreSM = -4;
    else if (cotSM <= 50) scoreSM = -2;
    else scoreSM = -1;
  }

  // Component 2: Divergence (0–4)
  const diverging = Math.sign(netSM) !== Math.sign(netLS);
  let scoreDiv = 0;
  if (diverging) {
    if (netSM > 0) { // SM long, LS short
      if (cotLS < 15) scoreDiv = 4;
      else if (cotLS < 30) scoreDiv = 3;
      else if (cotLS < 45) scoreDiv = 2;
      else scoreDiv = 1;
    } else { // SM short, LS long
      if (cotLS > 85) scoreDiv = -4;
      else if (cotLS > 70) scoreDiv = -3;
      else if (cotLS > 55) scoreDiv = -2;
      else scoreDiv = -1;
    }
  }

  // Component 3: WoW momentum (0–2)
  let scoreWoW = 0;
  const wowAbs = Math.abs(wowSM);
  if (netSM > 0) scoreWoW = wowSM > 0 ? (wowAbs > 10000 ? 2 : 1) : (wowAbs > 10000 ? -2 : -1);
  else if (netSM < 0) scoreWoW = wowSM < 0 ? (wowAbs > 10000 ? 2 : 1) : (wowAbs > 10000 ? -2 : -1);

  return Math.max(-10, Math.min(10, scoreSM + scoreDiv + scoreWoW));
}

function dbLabel(dbs: number): string {
  if (dbs >= 7) return "STRONG_BULLISH";
  if (dbs >= 4) return "BULLISH";
  if (dbs >= 1) return "MILD_BULLISH";
  if (dbs >= -1) return "NEUTRAL";
  if (dbs >= -3) return "MILD_BEARISH";
  if (dbs >= -6) return "BEARISH";
  return "STRONG_BEARISH";
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

type GroupedHistory = Record<string, Array<{
  date: string;
  commNet: number;
  nonCommNet: number;
  retailNet: number;
  commLong: number;
  commShort: number;
  nonCL: number;
  nonCS: number;
  retailLong: number;
  retailShort: number;
}>>;

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

function groupBySymbol(records: any[]): GroupedHistory {
  const grouped: GroupedHistory = {};
  for (const r of records) {
    const code = r.cftc_contract_market_code;
    if (!SYMBOLS_MAP[code]) continue;
    if (!grouped[code]) grouped[code] = [];
    const commLong = parseInt(r.comm_positions_long_all || "0", 10);
    const commShort = parseInt(r.comm_positions_short_all || "0", 10);
    const nonCL = parseInt(r.noncomm_positions_long_all || "0", 10);
    const nonCS = parseInt(r.noncomm_positions_short_all || "0", 10);
    const retailLong = parseInt(r.nonrept_positions_long_all || "0", 10);
    const retailShort = parseInt(r.nonrept_positions_short_all || "0", 10);
    grouped[code].push({
      date: r.report_date_as_yyyy_mm_dd || "",
      commNet: commLong - commShort,
      nonCommNet: nonCL - nonCS,
      retailNet: retailLong - retailShort,
      commLong, commShort, nonCL, nonCS, retailLong, retailShort,
    });
  }
  // Sort each group by date ascending (oldest first) for WoW
  for (const code of Object.keys(grouped)) {
    grouped[code].sort((a, b) => a.date.localeCompare(b.date));
  }
  return grouped;
}

export async function getCotData(): Promise<CotItem[]> {
  try {
    const isServer = typeof window === "undefined";
    const codes = Object.keys(SYMBOLS_MAP).map(c => `'${c}'`).join(",");
    const url = isServer
      ? `${COT_API}?$where=${encodeURIComponent(`cftc_contract_market_code in (${codes})`)}&$limit=500&$order=${encodeURIComponent("report_date_as_yyyy_mm_dd DESC")}`
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

    if (!Array.isArray(records) || records.length === 0) return getFallbackData();

    // 1. Map latest records for display
    // CFTC returns sorted DESC → latest first. Group latest per symbol.
    const seen = new Set<string>();
    const latest: any[] = [];
    for (const r of records) {
      const code = r.cftc_contract_market_code;
      if (!seen.has(code) && SYMBOLS_MAP[code]) {
        seen.add(code);
        latest.push(r);
      }
    }

    // 2. Build history for COT Index & WoW
    const history = groupBySymbol(records);

    // 3. Enhance each latest with analytics
    const enhanced: CotItem[] = latest.map(r => {
      const item = mapRecord(r);
      const code = r.cftc_contract_market_code;
      const hist = history[code] || [];

      // COT Index for SM & LS
      const smNets = hist.slice(-LOOKBACK_WEEKS).map(h => h.commNet);
      const lsNets = hist.slice(-LOOKBACK_WEEKS).map(h => h.nonCommNet);
      const currentSM = hist.length > 0 ? hist[hist.length - 1].commNet : 0;
      const currentLS = hist.length > 0 ? hist[hist.length - 1].nonCommNet : 0;
      const cotSM = smNets.length > 1 ? calcCotIndex(currentSM, smNets) : 50;
      const cotLS = lsNets.length > 1 ? calcCotIndex(currentLS, lsNets) : 50;

      // WoW Δ
      let wowSM = 0, wowLS = 0;
      if (hist.length >= 2) {
        const prev = hist[hist.length - 2];
        const curr = hist[hist.length - 1];
        wowSM = curr.commNet - prev.commNet;
        wowLS = curr.nonCommNet - prev.nonCommNet;
      }

      // Open Interest
      const oi = hist.length > 0
        ? hist[hist.length - 1].commLong + hist[hist.length - 1].commShort
            + hist[hist.length - 1].nonCL + hist[hist.length - 1].nonCS
            + hist[hist.length - 1].retailLong + hist[hist.length - 1].retailShort
        : 0;

      // Direction Bias Score
      const dbs = calcDBS(currentSM, currentLS, cotSM, cotLS, wowSM);

      // Enhanced sentiment with COT Index
      const divergence = Math.sign(currentSM) !== Math.sign(currentLS);
      let enhancedPhase = item.phase;
      if (divergence && cotSM <= 15 && cotLS >= 75) {
        enhancedPhase = { label: wowSM > 0 ? "ACCUMULATION" : "DISTRIBUTION", color: wowSM > 0 ? "blue" : "yellow", isWarning: true };
      } else if (divergence && cotSM >= 85 && cotLS <= 25) {
        enhancedPhase = { label: wowSM < 0 ? "DISTRIBUTION" : "MARK UP", color: wowSM < 0 ? "yellow" : "green", isWarning: wowSM < 0 };
      }

      return {
        ...item,
        phase: enhancedPhase,
        cotIndexSM: Math.round(cotSM),
        cotIndexLS: Math.round(cotLS),
        wowDeltaSM: wowSM,
        wowDeltaLS: wowLS,
        openInterest: oi,
        dbs,
        directionBias: dbLabel(dbs),
        divergence,
      };
    });

    return enhanced.length > 0 ? enhanced : getFallbackData();
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
