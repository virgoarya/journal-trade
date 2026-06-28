export interface CotItem {
  symbol: string;
  sentiment: string;
  commercial: string;
  nonCommercial: string;
}

export async function getCotData(): Promise<CotItem[]> {
  console.log("[COT SERVICE] getCotData() called on server");
  
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

    console.log("[COT SERVICE] Returning dummy data:", data.length, "items");
    return data;
  } catch (error) {
    console.error("[COT SERVICE] Error:", error);
    return [];
  }
}