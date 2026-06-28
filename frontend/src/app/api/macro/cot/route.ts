import { NextResponse } from "next/server";
import type { RawCotResponse, TransformedCotData, CotApiResponse } from "@/types/cot";
import { transformCotData } from "@/lib/cot-logic";

export async function GET(): Promise<NextResponse> {
  try {
    const res = await fetch("https://api.example-cot.com/data", {
      next: { revalidate: 86400 },
    });

    if (!res.ok) {
      return NextResponse.json<CotApiResponse>(
        { success: false, data: [], fetchedAt: new Date().toISOString() },
        { status: res.status }
      );
    }

    const rawData: RawCotResponse[] = await res.json();

    const transformedData: TransformedCotData[] = transformCotData(rawData);

    const response: CotApiResponse = {
      success: true,
      data: transformedData,
      fetchedAt: new Date().toISOString(),
    };

    return NextResponse.json<CotApiResponse>(response, { status: 200 });
  } catch (error) {
    console.error("COT API Error:", error);
    
    return NextResponse.json<CotApiResponse>(
      { success: false, data: [], fetchedAt: new Date().toISOString() },
      { status: 500 }
    );
  }
}