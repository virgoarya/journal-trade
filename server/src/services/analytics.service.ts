import mongoose from "mongoose";
import { Trade } from "../models/Trade";
import { calculateProfitFactor, calculateExpectancy } from "../utils/calculations";

export const analyticsService = {

  async getOverview(userId: string, accountId: string) {
    const rawTrades = await Trade.find({ tradingAccountId: accountId, userId })
      .select('actualPnl result tradeDate pair');

    // Calculate basic stats
    let winCount = 0;
    let lossCount = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    const wins: number[] = [];
    const losses: number[] = [];

    for (const t of rawTrades) {
      const p = t.actualPnl;
      if (t.result === "WIN") {
        winCount++;
        grossProfit += p;
        wins.push(p);
      }
      else if (t.result === "LOSS") {
        lossCount++;
        grossLoss += Math.abs(p);
        losses.push(p);
      }
    }

    const total = winCount + lossCount;
    const winRate = total > 0 ? (winCount / total) * 100 : 0;
    const avgWin = winCount > 0 ? grossProfit / winCount : 0;
    const avgLoss = lossCount > 0 ? grossLoss / lossCount : 0;
    const profitFactor = calculateProfitFactor(grossProfit, grossLoss);
    const expectancy = calculateExpectancy(winRate, avgWin, avgLoss);

    // Monthly P&L (last 6 months)
    const monthlyMap = new Map<string, { pnl: number, wins: number, losses: number }>();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getMonth()+1}/${d.getFullYear()}`;
      monthlyMap.set(key, { pnl: 0, wins: 0, losses: 0 });
    }

    rawTrades.forEach(t => {
      const d = new Date(t.tradeDate);
      const key = `${d.getMonth()+1}/${d.getFullYear()}`;
      if (monthlyMap.has(key)) {
        const entry = monthlyMap.get(key)!;
        entry.pnl += t.actualPnl;
        if (t.result === "WIN") entry.wins++;
        else if (t.result === "LOSS") entry.losses++;
      }
    });
    const monthlyPnL = Array.from(monthlyMap.entries()).map(([month, data]) => ({
      month: months[parseInt(month.split('/')[0])-1],
      pnl: data.pnl,
      wins: data.wins,
      losses: data.losses
    }));

    // Weekly pattern
    const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const weeklyStats = weekdays.map(day => ({ day, avgPnl: 0, trades: 0 }));
    rawTrades.forEach(t => {
      const day = weekdays[new Date(t.tradeDate).getDay()];
      const w = weeklyStats.find(w => w.day === day);
      if (w) { w.avgPnl += t.actualPnl; w.trades++; }
    });
    weeklyStats.forEach(w => { if (w.trades > 0) w.avgPnl = w.avgPnl / w.trades; });

    // Session performance (simplified: by hour)
    const sessions = [
      { session: "Sydney", start: 0, end: 8, pnl: 0, trades: 0 },
      { session: "Tokyo", start: 8, end: 16, pnl: 0, trades: 0 },
      { session: "London", start: 16, end: 24, pnl: 0, trades: 0 },
    ];
    rawTrades.forEach(t => {
      const hour = new Date(t.tradeDate).getUTCHours();
      const sess = sessions.find(s => hour >= s.start && hour < s.end);
      if (sess) { sess.pnl += t.actualPnl; sess.trades++; }
    });

    // Streak stats
    let currentStreak = { type: "win" as const, count: 0 };
    let longestWin = 0, longestLoss = 0, currentWin = 0, currentLoss = 0;
    for (const t of rawTrades.sort((a,b) => new Date(a.tradeDate).getTime() - new Date(b.tradeDate).getTime())) {
      if (t.result === "WIN") {
        currentWin++;
        currentLoss = 0;
        longestWin = Math.max(longestWin, currentWin);
      } else if (t.result === "LOSS") {
        currentLoss++;
        currentWin = 0;
        longestLoss = Math.max(longestLoss, currentLoss);
      }
    }
    // Current streak
    if (currentWin > 0) currentStreak = { type: "win", count: currentWin };
    else if (currentLoss > 0) currentStreak = { type: "loss", count: currentLoss };

    // Best performing pairs
    const pairMap = new Map<string, { pnl: number, wins: number, total: number }>();
    rawTrades.forEach(t => {
      if (!pairMap.has(t.pair)) pairMap.set(t.pair, { pnl: 0, wins: 0, total: 0 });
      const p = pairMap.get(t.pair)!;
      p.pnl += t.actualPnl;
      p.total++;
      if (t.result === "WIN") p.wins++;
    });
    const bestPerformingPairs = Array.from(pairMap.entries())
      .map(([pair, data]) => ({ pair, pnl: data.pnl, winRate: (data.wins/data.total)*100 }))
      .sort((a,b) => b.pnl - a.pnl)
      .slice(0, 3);

    // Risk metrics
    const returns = rawTrades.map(t => t.actualPnl);
    const avgReturn = returns.length > 0 ? returns.reduce((a,b)=>a+b,0)/returns.length : 0;
    const variance = returns.length > 0 ? returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length : 0;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;
    const maxDrawdown = 0; // Placeholder

    // Trading behaviour
    const avgPnlPerTrade = total > 0 ? (grossProfit - grossLoss) / total : 0;
    const avgTradeDuration = "2h 15m"; // Placeholder
    const tradesPerDay = rawTrades.length / Math.max(1, Math.ceil(rawTrades.length / 30));
    const planAdherence = 87; // Placeholder

    return {
      monthlyPnL,
      weeklyStats,
      sessionPerformance: sessions.map(s => ({ session: s.session, pnl: s.pnl, trades: s.trades })),
      streakStats: { longestWin, longestLoss, currentStreak, avgConsecutiveWins: 0, avgConsecutiveLosses: 0 },
      totalPnL: grossProfit - grossLoss,
      totalTrades: total,
      winRate: Number(winRate.toFixed(1)),
      profitFactor,
      bestPerformingPairs,
      riskMetrics: { sharpeRatio, maxDrawdown, avgRR: avgWin / avgLoss || 0, expectancy },
      tradingBehaviour: { avgTradeDuration, avgPnlPerTrade, tradesPerDay: Number(tradesPerDay.toFixed(1)), planAdherence }
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
