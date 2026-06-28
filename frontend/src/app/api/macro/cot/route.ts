import { NextResponse } from "next/server";

interface CotItem {
  symbol: string;
  sentiment: string;
  commercial: string;
  nonCommercial: string;
}

export async function GET() {
  try {
    const data: CotItem[] = [
      {
        symbol: "CL=F",
        sentiment: "BULLISH",
        commercial: "245678 / 189012",
        nonCommercial: "412345 / 387654",
      },
      {
        symbol: "GC=F",
        sentiment: "BULLISH",
        commercial: "112345 / 98765",
        nonCommercial: "234567 / 198765",
      },
      {
        symbol: "EUR/USD",
        sentiment: "NEUTRAL",
        commercial: "156789 / 178901",
        nonCommercial: "345678 / 321098",
      },
    ];

    return NextResponse.json(data, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("COT API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}