export interface CotItem {
  symbol: string;
  sentiment: string;
  commercial: string;
  nonCommercial: string;
}

export async function getCotData(): Promise<CotItem[]> {
  console.log("[COT SERVICE] getCotData() called on server");
  
  try {
    const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
    
    console.log("[COT SERVICE] Fetching from:", `${BACKEND_URL}/api/v1/market-data/cot`);
    
    const res = await fetch(`${BACKEND_URL}/api/v1/market-data/cot`, {
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      console.error("[COT SERVICE] Fetch failed:", res.status);
      return getDummyData();
    }

    const result = await res.json();
    console.log("[COT SERVICE] Success:", result.data?.length || 0, "items");
    return result.data || getDummyData();
  } catch (error) {
    console.error("[COT SERVICE] Error:", error);
    return getDummyData();
  }
}

function getDummyData(): CotItem[] {
  return [
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
}