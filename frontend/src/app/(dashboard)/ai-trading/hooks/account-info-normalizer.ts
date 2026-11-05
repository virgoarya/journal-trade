import type { ACCOUNTInfo } from "@/services/ai-trading.service";

const numericFields = [
  "balance", "equity", "profit", "margin", "marginLevel",
  "dailyPnL", "weeklyPnL", "openRisk", "winRate", "profitFactor",
] as const;

export const normalizeAccountInfo = (value: Partial<ACCOUNTInfo>): Partial<ACCOUNTInfo> => {
  const normalized = { ...value } as Record<string, unknown>;
  for (const field of numericFields) {
    if (field in normalized && (typeof normalized[field] !== "number" || !Number.isFinite(normalized[field]))) {
      normalized[field] = 0;
    }
  }
  return normalized as Partial<ACCOUNTInfo>;
};
