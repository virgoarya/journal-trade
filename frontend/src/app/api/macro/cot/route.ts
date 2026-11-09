import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";
const CFTC_URL =
  "https://publicreporting.cftc.gov/resource/6dca-aqww.json";

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

const LOOKBACK_WEEKS = 52;

const EXTREME_THRESHOLD = 1.5;

function getMarketPhase(managedMoneyNet: number, commercialsNet: number, cotIndexLS: number = 50) {
  const smLong = commercialsNet > 0;
  const smShort = commercialsNet < 0;

  if (Math.abs(commercialsNet) < 1000) {
    return { label: "NEUTRAL", color: "gray", isWarning: false };
  }

  // Institutional Desk Logic: Smart Money anchor + Large Specs (LS) COT Index determinant
  if (smLong) {
    if (cotIndexLS <= 25) {
      return { label: "ACCUMULATION", color: "blue", isWarning: true }; // SM long, LS extreme short
    }
    if (cotIndexLS >= 75) {
      return { label: "DISTRIBUTION", color: "yellow", isWarning: true }; // SM long, LS extreme long
    }
    return { label: "MARK UP", color: "green", isWarning: false }; // SM long, LS moderate long
  } else if (smShort) {
    if (cotIndexLS >= 75) {
      return { label: "DISTRIBUTION", color: "yellow", isWarning: true }; // SM short, LS extreme long
    }
    if (cotIndexLS <= 25) {
      return { label: "ACCUMULATION", color: "blue", isWarning: true }; // SM short, LS extreme short
    }
    return { label: "MARK DOWN", color: "red", isWarning: false }; // SM short, LS moderate short
  }

  return { label: "NEUTRAL", color: "gray", isWarning: false };
}

function calcCotIndex(net: number, history: number[]): number {
  const sorted = [...history].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  if (max === min) return 50;
  return Math.round(((net - min) / (max - min)) * 100);
}

function calcDBS(netSM: number, netLS: number, cotSM: number, cotLS: number, wowSM: number): number {
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

  const diverging = Math.sign(netSM) !== Math.sign(netLS);
  let scoreDiv = 0;
  if (diverging) {
    if (netSM > 0) {
      if (cotLS < 15) scoreDiv = 4;
      else if (cotLS < 30) scoreDiv = 3;
      else if (cotLS < 45) scoreDiv = 2;
      else scoreDiv = 1;
    } else {
      if (cotLS > 85) scoreDiv = -4;
      else if (cotLS > 70) scoreDiv = -3;
      else if (cotLS > 55) scoreDiv = -2;
      else scoreDiv = -1;
    }
  }

  let scoreWoW = 0;
  const wowAbs = Math.abs(wowSM);
  if (netSM > 0) scoreWoW = wowSM > 0 ? (wowAbs > 10000 ? 2 : 1) : (wowAbs > 10000 ? -2 : -1);
  else if (netSM < 0) scoreWoW = wowSM < 0 ? (wowAbs > 10000 ? 2 : 1) : (wowAbs > 10000 ? -2 : -1);

  return Math.max(-10, Math.min(10, scoreSM + scoreDiv + scoreWoW));
}

// In-Memory Cache (TTL 1 hour)
let cachedData: any = null;
let cacheTimestamp = 0;
const CACHE_TTL = 3600 * 1000; // 1 hour

export async function GET() {
  try {
    const now = Date.now();
    if (cachedData && now - cacheTimestamp < CACHE_TTL) {
      return NextResponse.json(
        { success: true, data: cachedData },
        {
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
            "X-Cache": "HIT",
          },
        },
      );
    }

    const codes = Object.keys(SYMBOLS_MAP).map(c => `'${c}'`).join(",");
    const url = `${CFTC_URL}?$where=${encodeURIComponent(`cftc_contract_market_code in (${codes})`)}&$limit=500&$order=${encodeURIComponent("report_date_as_yyyy_mm_dd DESC")}`;

    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) {
      console.error("[COT API] CFTC fetch failed:", response.status);
      if (cachedData) {
        return NextResponse.json(
          { success: true, data: cachedData },
          { status: 200, headers: { "X-Cache": "STALE" } }
        );
      }
      return NextResponse.json(
        { success: false, error: `CFTC API error: ${response.status}` },
        { status: 502 },
      );
    }

    const records = await response.json();

    if (!Array.isArray(records) || records.length === 0) {
      if (cachedData) {
        return NextResponse.json({ success: true, data: cachedData }, { status: 200 });
      }
      return NextResponse.json(
        { success: false, error: "No records from CFTC" },
        { status: 404 },
      );
    }

    // Group history by symbol code
    const historyMap: Record<string, any[]> = {};
    for (const r of records) {
      const code = r.cftc_contract_market_code;
      if (!SYMBOLS_MAP[code]) continue;
      if (!historyMap[code]) historyMap[code] = [];
      const commLong = parseInt(r.comm_positions_long_all || "0", 10);
      const commShort = parseInt(r.comm_positions_short_all || "0", 10);
      const nonCL = parseInt(r.noncomm_positions_long_all || "0", 10);
      const nonCS = parseInt(r.noncomm_positions_short_all || "0", 10);
      const retailLong = parseInt(r.nonrept_positions_long_all || "0", 10);
      const retailShort = parseInt(r.nonrept_positions_short_all || "0", 10);
      historyMap[code].push({
        date: r.report_date_as_yyyy_mm_dd || "",
        commNet: commLong - commShort,
        nonCommNet: nonCL - nonCS,
        commLong, commShort, nonCL, nonCS, retailLong, retailShort,
      });
    }

    // Sort ascending for each symbol history
    for (const code of Object.keys(historyMap)) {
      historyMap[code].sort((a, b) => a.date.localeCompare(b.date));
    }

    // Latest records per symbol
    const seen = new Set<string>();
    const latest: any[] = [];
    for (const r of records) {
      const code = r.cftc_contract_market_code;
      if (!seen.has(code) && SYMBOLS_MAP[code]) {
        seen.add(code);
        latest.push(r);
      }
    }

    const results = latest.map((item: any) => {
      const code = item.cftc_contract_market_code;
      const meta = SYMBOLS_MAP[code] || {
        symbol: "UNKNOWN",
        name: item.contract_market_name || "Unknown",
        category: "Other",
      };

      const hist = historyMap[code] || [];
      const commLong = parseInt(item.comm_positions_long_all || "0", 10);
      const commShort = parseInt(item.comm_positions_short_all || "0", 10);
      const nonCommLong = parseInt(item.noncomm_positions_long_all || "0", 10);
      const nonCommShort = parseInt(item.noncomm_positions_short_all || "0", 10);
      const retailLong = parseInt(item.nonrept_positions_long_all || "0", 10);
      const retailShort = parseInt(item.nonrept_positions_short_all || "0", 10);

      const currentSM = commLong - commShort;
      const currentLS = nonCommLong - nonCommShort;

      // COT Index
      const smNets = hist.slice(-LOOKBACK_WEEKS).map(h => h.commNet);
      const lsNets = hist.slice(-LOOKBACK_WEEKS).map(h => h.nonCommNet);
      const cotIndexSM = smNets.length > 1 ? calcCotIndex(currentSM, smNets) : 50;
      const cotIndexLS = lsNets.length > 1 ? calcCotIndex(currentLS, lsNets) : 50;

      // WoW Delta
      let wowDeltaSM = 0;
      if (hist.length >= 2) {
        const prev = hist[hist.length - 2];
        const curr = hist[hist.length - 1];
        wowDeltaSM = curr.commNet - prev.commNet;
      }

      // DBS
      const dbs = calcDBS(currentSM, currentLS, cotIndexSM, cotIndexLS, wowDeltaSM);

      const netPosition = currentLS;
      const totalPosition = nonCommLong + nonCommShort;
      let sentiment = "NEUTRAL";
      if (totalPosition > 0 && Math.abs(netPosition) / totalPosition >= 0.1) {
        sentiment = netPosition > 0 ? "BULLISH" : "BEARISH";
      }

      const phase = getMarketPhase(currentLS, currentSM, cotIndexLS);

      return {
        symbol: meta.symbol,
        name: meta.name,
        category: meta.category,
        commercialLong: commLong,
        commercialShort: commShort,
        commercialSpread: Math.abs(commLong - commShort),
        nonCommercialLong: nonCommLong,
        nonCommercialShort: nonCommShort,
        nonCommercialSpread: Math.abs(nonCommLong - nonCommShort),
        retailLong,
        retailShort,
        retailSpread: Math.abs(retailLong - retailShort),
        sentiment,
        cotIndexSM,
        cotIndexLS,
        wowDeltaSM,
        dbs,
        phase,
        lastUpdate: item.report_date_as_yyyy_mm_dd || new Date().toISOString(),
      };
    });

    cachedData = results;
    cacheTimestamp = now;

    return NextResponse.json(
      { success: true, data: results },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
          "X-Cache": "MISS",
        },
      },
    );
  } catch (error) {
    console.error("[COT API] Error:", error);
    if (cachedData) {
      return NextResponse.json({ success: true, data: cachedData }, { status: 200 });
    }
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, symbol, name, commercialLong, commercialShort, nonCommercialLong, nonCommercialShort } = body;

    if (action === "analyze") {
      try {
        const response = await fetch(`${BACKEND_URL}/api/v1/market-data/cot/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (response.ok) {
          const data = await response.json();
          return NextResponse.json(data);
        }
      } catch (err) {
        console.warn("[COT API POST] Backend AI unreachable, falling back to local heuristic analyzer:", err);
      }

      const commNet = (commercialLong || 0) - (commercialShort || 0);
      const specNet = (nonCommercialLong || 0) - (nonCommercialShort || 0);
      const isSmartMoneyLong = commNet > 0;
      const isSpecLong = specNet > 0;

      let momentum = isSmartMoneyLong
        ? `Smart Money (Commercials) mencatatkan posisi net long sebesar +${commNet.toLocaleString()}, mengindikasikan akumulasi institusional yang kuat pada ${name || symbol}.`
        : `Smart Money (Commercials) mencatatkan posisi net short sebesar ${commNet.toLocaleString()}, mengindikasikan aksi hedging/distribusi institusional.`;

      let warnings = isSmartMoneyLong !== isSpecLong
        ? `Terdeteksi divergence antara Smart Money dan Large Specs. Retail dan Large Specs cenderung ${isSpecLong ? "Bullish" : "Bearish"}, berpotensi memicu squeeze.`
        : `Posisi searah antara Smart Money dan Large Specs. Tren saat ini memiliki konfirmasi likuiditas yang sehat tanpa anomali ekstrem.`;

      let conclusion = isSmartMoneyLong
        ? `Rekomendasi Bias: Cenderung BULLISH. Cari setup Buy pada area diskon (support harian/weekly) seiring akumulasi Smart Money.`
        : `Rekomendasi Bias: Cenderung BEARISH. Fokus pada pencarian setup Sell pada area premium (resistance) mengikuti jejak distribusi institusi.`;

      return NextResponse.json({
        success: true,
        data: {
          momentum,
          warnings,
          conclusion,
        }
      });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("[COT API POST] Error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
