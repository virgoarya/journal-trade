import { eq, sql, and } from "drizzle-orm";
import { db } from "../db";
import { trade, tradingAccount } from "../db/schema";
import { calculateProfitFactor, calculateExpectancy } from "../utils/calculations";

export const analyticsService = {
  
  async getOverview(userId: string, accountId: string) {
    const rawTrades = await db.select({
      pnl: trade.actualPnl,
      result: trade.result
    }).from(trade)
    .where(and(eq(trade.tradingAccountId, accountId), eq(trade.userId, userId)));
    
    let winCount = 0;
    let lossCount = 0;
    let grossProfit = 0;
    let grossLoss = 0;

    for (const t of rawTrades) {
      const p = parseFloat(t.pnl);
      if (t.result === "WIN") { winCount++; grossProfit += p; }
      else if (t.result === "LOSS") { lossCount++; grossLoss += Math.abs(p); }
    }

    const total = winCount + lossCount;
    const winRate = total > 0 ? (winCount / total) * 100 : 0;
    const avgWin = winCount > 0 ? grossProfit / winCount : 0;
    const avgLoss = lossCount > 0 ? grossLoss / lossCount : 0;
    const profitFactor = calculateProfitFactor(grossProfit, grossLoss);
    const expectancy = calculateExpectancy(winRate, avgWin, avgLoss);

    return {
      winRate: Number(winRate.toFixed(1)),
      profitFactor,
      avgWin: Number(avgWin.toFixed(2)),
      avgLoss: Number(avgLoss.toFixed(2)),
      totalTrades: rawTrades.length,
      bestWinStreak: 0, // Placeholder
      expectancy,
      sharpeRatio: 0 // Placeholder
    };
  },

  async getEquityCurve(userId: string, accountId: string) {
    // Usually aggregated by day from daily_snapshot. Using a simplified mock
    const points = await db.select({
      date: trade.tradeDate,
      pnl: trade.actualPnl
    }).from(trade)
    .where(and(eq(trade.tradingAccountId, accountId), eq(trade.userId, userId)))
    .orderBy(trade.tradeDate);

    let cumulative = 0;
    const equityCurve = points.map(p => {
      cumulative += parseFloat(p.pnl);
      return { date: p.date, equity: cumulative };
    });

    return {
      points: equityCurve,
      highWaterMark: cumulative > 0 ? cumulative : 0,
      maxDrawdown: { value: 0, date: "" }
    };
  }
};
