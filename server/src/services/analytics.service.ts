import mongoose from "mongoose";
import { Trade } from "../models/Trade";
import { calculateProfitFactor, calculateExpectancy } from "../utils/calculations";

export const analyticsService = {
  
  async getOverview(userId: string, accountId: string) {
    const rawTrades = await Trade.find({ tradingAccountId: accountId, userId }).select('actualPnl result');
    
    let winCount = 0;
    let lossCount = 0;
    let grossProfit = 0;
    let grossLoss = 0;

    for (const t of rawTrades) {
      const p = t.actualPnl;
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
      bestWinStreak: 0,
      expectancy,
      sharpeRatio: 0
    };
  },

  async getEquityCurve(userId: string, accountId: string) {
    const points = await Trade.find({ tradingAccountId: accountId, userId })
      .select('tradeDate actualPnl')
      .sort('tradeDate');

    let cumulative = 0;
    const equityCurve = points.map(p => {
      cumulative += p.actualPnl;
      return { date: p.tradeDate.toISOString(), equity: cumulative };
    });

    return {
      points: equityCurve,
      highWaterMark: cumulative > 0 ? cumulative : 0,
      maxDrawdown: { value: 0, date: "" }
    };
  }
};
