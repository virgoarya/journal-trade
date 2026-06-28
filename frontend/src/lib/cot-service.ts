import type { CotItem } from "@/types/cot";
import { env } from "@/lib/env";

export async function getCotData(): Promise<CotItem[]> {
  console.log("[COT SERVICE] getCotData() called on server");
  console.log("[COT SERVICE] Target URL:", `${env.backendUrl}/api/v1/market-data/cot`);
  
  if (!env.backendUrl) {
    console.error("[COT SERVICE] BACKEND_URL not configured");
    return getDummyData();
  }

  try {
    const res = await fetch(`${env.backendUrl}/api/v1/market-data/cot`, {
      next: { revalidate: 3600 },
      headers: {
        "Content-Type": "application/json",
      },
    });

    console.log("[COT SERVICE] Response status:", res.status);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const result = await res.json();
    console.log("[COT SERVICE] Success:", result.data?.length || 0, "items");
    return result.data || getDummyData();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[COT SERVICE] Fetch failed:", errorMessage);
    console.error("[COT SERVICE] Attempted URL:", `${env.backendUrl}/api/v1/market-data/cot`);
    return getDummyData();
  }
}

export async function getCotDataWithInternalFallback(): Promise<CotItem[]> {
  const backendResult = await getCotData();
  if (backendResult.length > 0) return backendResult;

  console.log("[COT SERVICE] Trying internal API route as fallback");
  try {
    const siteUrl = env.siteUrl || "http://localhost:3000";
    const res = await fetch(`${siteUrl}/api/macro/cot`, {
      next: { revalidate: 3600 },
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      console.log("[COT SERVICE] Internal API success:", data.length, "items");
      return data;
    }
  } catch (error) {
    console.error("[COT SERVICE] Internal API also failed:", error);
  }

  return getDummyData();
}

function getDummyData(): CotItem[] {
  console.log("[COT SERVICE] Returning dummy data");
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