/**
 * Calculates the Risk Amount in Account Currency
 * Currently assumes standard contract sizes for simple forex/metals.
 * For a real app, you'd need the instrument's contract size / pip value.
 * We'll use a simplified model for the prototype: Risk = |Entry - SL| * LotSize * PipMultiplier
 */
export const calculateRiskAmount = (
    entryPrice: number, 
    stopLoss: number, 
    lotSize: number, 
    pipMultiplier: number = 100 // Example multiplier, ideally derived from Asset Pair
): number => {
    return Math.abs(entryPrice - stopLoss) * lotSize * pipMultiplier;
};

/**
 * Calculates R-Multiple based on Actual PnL and initial Risk Amount
 */
export const calculateRMultiple = (actualPnl: number, riskAmount: number): number => {
    if (riskAmount === 0 || isNaN(riskAmount)) return 0;
    return Number((actualPnl / riskAmount).toFixed(2));
};

/**
 * Calculates Profit Factor: (Gross Profit) / (Gross Loss)
 */
export const calculateProfitFactor = (grossProfit: number, grossLoss: number): number => {
    if (grossLoss === 0) return grossProfit > 0 ? 99.99 : 0; // Prevent Infinity
    return Number(Math.abs(grossProfit / grossLoss).toFixed(2));
};

/**
 * Calculate Expectancy: (WinRate * AvgWin) - (LossRate * AvgLoss)
 */
export const calculateExpectancy = (winRatePct: number, avgWin: number, avgLoss: number): number => {
    const wr = winRatePct / 100;
    const lr = 1 - wr;
    return Number(((wr * avgWin) - (lr * Math.abs(avgLoss))).toFixed(2));
};
