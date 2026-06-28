import type { RawCotResponse, TransformedCotData } from "@/types/cot";

const SENTIMENT_THRESHOLD = 0.1;

export function calculateSentiment(nonCommercialLong: number, nonCommercialShort: number): "BULLISH" | "BEARISH" | "NEUTRAL" {
  const netPosition = nonCommercialLong - nonCommercialShort;
  const totalPosition = nonCommercialLong + nonCommercialShort;
  
  if (totalPosition === 0) return "NEUTRAL";
  
  const ratio = Math.abs(netPosition) / totalPosition;
  
  if (ratio < SENTIMENT_THRESHOLD) {
    return "NEUTRAL";
  }
  
  return netPosition > 0 ? "BULLISH" : "BEARISH";
}

export function transformCotData(rawData: RawCotResponse[]): TransformedCotData[] {
  return rawData.map((item) => {
    const commercialSpread = item.commercial_long - item.commercial_short;
    const nonCommercialSpread = item.non_commercial_long - item.non_commercial_short;
    
    const sentiment = calculateSentiment(
      item.non_commercial_long,
      item.non_commercial_short
    );
    
    return {
      symbol: item.symbol,
      name: item.name,
      type: item.type as "commodity" | "currency" | "index",
      commercialLong: item.commercial_long,
      commercialShort: item.commercial_short,
      nonCommercialLong: item.non_commercial_long,
      nonCommercialShort: item.non_commercial_short,
      commercialSpread,
      nonCommercialSpread,
      sentiment,
      lastUpdate: item.last_update || new Date().toISOString(),
    };
  });
}

export function calculateZScore(currentValue: number, historicalMean: number, historicalStdDev: number): number {
  if (historicalStdDev === 0) return 0;
  return (currentValue - historicalMean) / historicalStdDev;
}

export function getZScoreSignal(zScore: number, threshold: number = 1.0): "OVERSOLD" | "OVERBOUGHT" | "NEUTRAL" {
  if (zScore < -threshold) return "OVERSOLD";
  if (zScore > threshold) return "OVERBOUGHT";
  return "NEUTRAL";
}