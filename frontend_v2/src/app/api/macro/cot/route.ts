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

export async function GET() {
  try {
    const codes = Object.keys(SYMBOLS_MAP).map(c => `'${c}'`).join(",");
    const url = `${CFTC_URL}?$where=${encodeURIComponent(`cftc_contract_market_code in (${codes})`)}&$limit=500&$order=${encodeURIComponent("report_date_as_yyyy_mm_dd DESC")}`;
    
    const response = await fetch(url, { next: { revalidate: 3600 } });

    if (!response.ok) {
      console.error("[COT API] CFTC fetch failed:", response.status);
      return NextResponse.json(
        { success: false, error: `CFTC API error: ${response.status}` },
        { status: 502 },
      );
    }

    const records = await response.json();

    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json(
        { success: false, error: "No records from CFTC" },
        { status: 404 },
      );
    }

    const results = records.map((item: any) => {
      const meta = SYMBOLS_MAP[item.cftc_contract_market_code] || {
        symbol: "UNKNOWN",
        name: item.contract_market_name || "Unknown",
        category: "Other",
      };

      const commLong = parseInt(item.comm_positions_long_all || "0", 10);
      const commShort = parseInt(item.comm_positions_short_all || "0", 10);
      const nonCommLong = parseInt(item.noncomm_positions_long_all || "0", 10);
      const nonCommShort = parseInt(item.noncomm_positions_short_all || "0", 10);
      const retailLong = parseInt(item.nonrept_positions_long_all || "0", 10);
      const retailShort = parseInt(item.nonrept_positions_short_all || "0", 10);

      const netPosition = nonCommLong - nonCommShort;
      const totalPosition = nonCommLong + nonCommShort;
      let sentiment = "NEUTRAL";

      if (totalPosition > 0) {
        const ratio = Math.abs(netPosition) / totalPosition;
        if (ratio >= 0.1) {
          sentiment = netPosition > 0 ? "BULLISH" : "BEARISH";
        }
      }

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
        lastUpdate: item.report_date_as_yyyy_mm_dd || new Date().toISOString(),
      };
    });

    return NextResponse.json(
      { success: true, data: results },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("[COT API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "analyze") {
      // Proxy COT analysis to backend
      const response = await fetch(`${BACKEND_URL}/api/v1/market-data/cot/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        return NextResponse.json({ success: false, error: `Backend error: ${response.status}` }, { status: 502 });
      }
      const data = await response.json();
      return NextResponse.json(data);
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("[COT API POST] Error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
