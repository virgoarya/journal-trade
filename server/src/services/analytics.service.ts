import mongoose from "mongoose";
import { Trade } from "../models/Trade";
import { calculateProfitFactor, calculateExpectancy } from "../utils/calculations";

export const analyticsService = {

  async getOverview(userId: string, accountId: string) {
    const rawTrades = await Trade.find({ tradingAccountId: accountId, userId, isDeleted: { $ne: true } })
      .select('actualPnl result tradeDate pair');

    // Calculate basic stats
    let winCount = 0;
    let lossCount = 0;
    let breakevenCount = 0;
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
      else if (t.result === "BREAKEVEN") {
        breakevenCount++;
      }
    }

    const total = winCount + lossCount + breakevenCount;
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

    // Session performance (UTC) - aligned with frontend detection
    // Helper to determine session based on UTC hour (New York trading sessions)
    const getSessionName = (hour: number): string => {
      if (hour >= 21 || hour < 5) return "Sydney";
      if (hour >= 5 && hour < 8) return "Asia";
      if (hour >= 8 && hour < 13) return "London";
      if (hour >= 13 && hour < 21) return "NY";
      return "Other";
    };

    const sessionStats: Record<string, { pnl: number; trades: number }> = {
      Sydney: { pnl: 0, trades: 0 },
      Asia: { pnl: 0, trades: 0 },
      London: { pnl: 0, trades: 0 },
      NY: { pnl: 0, trades: 0 }
    };

    rawTrades.forEach(t => {
      const hour = new Date(t.tradeDate).getUTCHours();
      const sessName = getSessionName(hour);
      if (sessionStats[sessName]) {
        sessionStats[sessName].pnl += t.actualPnl;
        sessionStats[sessName].trades++;
      }
    });

    const sessionOrder = ['Sydney', 'Asia', 'London', 'NY'];
    const sessionPerformance = sessionOrder.map(session => ({
      session,
      pnl: sessionStats[session].pnl,
      trades: sessionStats[session].trades
    }));

    // Streak stats
    let currentStreak: { type: "win" | "loss"; count: number } = { type: "win", count: 0 };
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
    const avgRR = avgLoss > 0 ? avgWin / avgLoss : 0;

    // Trading behaviour (Real-time calculation) Pip.
    const avgPnlPerTrade = total > 0 ? (grossProfit - grossLoss) / total : 0;
    
    // Average Plan Adherence based on emotionalState (1=20%, 5=100%)
    const tradesWithEmotion = rawTrades.filter(t => t.emotionalState);
    const avgPlanAdherence = tradesWithEmotion.length > 0 
      ? (tradesWithEmotion.reduce((sum, t) => sum + (t.emotionalState || 3), 0) / (tradesWithEmotion.length * 5)) * 100
      : 80;

    // Trades per day (active days)
    const uniqueDays = new Set(rawTrades.map(t => new Date(t.tradeDate).toDateString())).size;
    const tradesPerDay = uniqueDays > 0 ? rawTrades.length / uniqueDays : 0;

    // Average Trade Duration calculation Pip.
    const tradesWithDuration = rawTrades.filter(t => t.exitDate && t.tradeDate);
    let avgTradeDuration = "0m";
    if (tradesWithDuration.length > 0) {
      const totalMs = tradesWithDuration.reduce((sum, t) => {
        const duration = new Date(t.exitDate!).getTime() - new Date(t.tradeDate).getTime();
        return sum + (duration > 0 ? duration : 0);
      }, 0);
      const avgMs = totalMs / tradesWithDuration.length;
      const hours = Math.floor(avgMs / (1000 * 60 * 60));
      const mins = Math.floor((avgMs % (1000 * 60 * 60)) / (1000 * 60));
      avgTradeDuration = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    }

    // Heatmap data: Day of Week (Mon-Sun) vs Session (Sydney, Asia, London, NY) Pip.
    const heatmapMatrix = weekdays.map(day => ({
      day,
      sessions: [
        { name: "Sydney", pnl: 0, count: 0 },
        { name: "Asia", pnl: 0, count: 0 },
        { name: "London", pnl: 0, count: 0 },
        { name: "NY", pnl: 0, count: 0 }
      ]
    }));

    rawTrades.forEach(t => {
      const date = new Date(t.tradeDate);
      const dayIdx = (date.getDay() + 6) % 7; // Adjust to Mon-Sun (0=Mon, 6=Sun)
      const hour = date.getUTCHours();
      const sessName = getSessionName(hour);

      const dayData = heatmapMatrix[dayIdx];
      if (dayData) {
        const sess = dayData.sessions.find(s => s.name === sessName);
        if (sess) {
          sess.pnl += t.actualPnl;
          sess.count++;
        }
      }
    });

    return {
      monthlyPnL,
      weeklyStats,
      sessionPerformance: sessions.map(s => ({ session: s.session, pnl: s.pnl, trades: s.trades })),
      heatmap: heatmapMatrix,
      streakStats: { longestWin, longestLoss, currentStreak, avgConsecutiveWins: 0, avgConsecutiveLosses: 0 },
      totalPnL: grossProfit - grossLoss,
      totalTrades: total,
      winRate: Number(winRate.toFixed(1)),
      profitFactor,
      bestPerformingPairs,
      riskMetrics: {
        sharpeRatio,
        maxDrawdown,
        avgRR: avgLoss > 0 ? avgWin / avgLoss : 0,
        expectancy,
        avgWin,
        avgLoss
      },
      tradingBehaviour: { avgTradeDuration, avgPnlPerTrade, tradesPerDay: Number(tradesPerDay.toFixed(1)), planAdherence: avgPlanAdherence },
      assetDistribution: (() => {
        const counts = Array.from(pairMap.entries())
          .map(([asset, data]) => ({ asset, count: data.total }))
          .sort((a,b) => b.count - a.count);
        
        const top5 = counts.slice(0, 5);
        const othersCount = counts.slice(5).reduce((sum, c) => sum + c.count, 0);
        
        const finalDist = [...top5];
        if (othersCount > 0) {
          finalDist.push({ asset: "Others", count: othersCount });
        }
        
        return finalDist.map(d => ({
          ...d,
          percentage: Number(((d.count / (total || 1)) * 100).toFixed(1))
        }));
      })()
    };
  },

  async getEquityCurve(userId: string, accountId: string) {
    const points = await Trade.find({ tradingAccountId: accountId, userId, isDeleted: { $ne: true } })
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
