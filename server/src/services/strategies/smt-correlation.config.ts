// ─── Correlation Pairs for SMT Divergence Detection ──────────────────────────
// These are common positively correlated pairs in forex/commodities
// Divergence = One pair makes HH/HL while correlated pair makes LH/LL at key level

const CORRELATED_PAIRS: Record<string, { pair: string; correlation: "POSITIVE" | "NEGATIVE" }[]> = {
  // Forex Majors
  "EURUSD": [{ pair: "GBPUSD", correlation: "POSITIVE" }, { pair: "USDCHF", correlation: "NEGATIVE" }],
  "GBPUSD": [{ pair: "EURUSD", correlation: "POSITIVE" }, { pair: "USDCHF", correlation: "NEGATIVE" }],
  "USDCHF": [{ pair: "EURUSD", correlation: "NEGATIVE" }, { pair: "GBPUSD", correlation: "NEGATIVE" }],
  "USDJPY": [{ pair: "EURJPY", correlation: "POSITIVE" }, { pair: "GBPJPY", correlation: "POSITIVE" }],
  
  // Commodities
  "XAUUSD": [{ pair: "XAGUSD", correlation: "POSITIVE" }, { pair: "DXY", correlation: "NEGATIVE" }],
  "XAGUSD": [{ pair: "XAUUSD", correlation: "POSITIVE" }, { pair: "DXY", correlation: "NEGATIVE" }],
  
  // Indices (S&P vs NASDAQ tend to correlate)
  "US500": [{ pair: "US30", correlation: "POSITIVE" }, { pair: "USTEC", correlation: "POSITIVE" }],
  "US30": [{ pair: "US500", correlation: "POSITIVE" }, { pair: "USTEC", correlation: "POSITIVE" }],
  "USTEC": [{ pair: "US500", correlation: "POSITIVE" }, { pair: "US30", correlation: "POSITIVE" }],
};

/**
 * Get correlated pairs for a given symbol
 */
export function getCorrelatedPairs(symbol: string): { pair: string; correlation: "POSITIVE" | "NEGATIVE" }[] {
  const cleanSym = symbol.toUpperCase().replace(/[^A-Z]/g, "");
  return CORRELATED_PAIRS[cleanSym] || [];
}

/**
 * Check if two symbols are correlated
 */
export function areCorrelated(symbolA: string, symbolB: string): { correlated: boolean; correlation: "POSITIVE" | "NEGATIVE" | "NONE" } {
  const pairs = getCorrelatedPairs(symbolA);
  const found = pairs.find(p => p.pair === symbolB);
  if (found) return { correlated: true, correlation: found.correlation };
  
  // Check reverse
  const pairsB = getCorrelatedPairs(symbolB);
  const foundB = pairsB.find(p => p.pair === symbolA);
  if (foundB) return { correlated: true, correlation: foundB.correlation };
  
  return { correlated: false, correlation: "NONE" };
}
