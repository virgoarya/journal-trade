import { Trade } from "../models/Trade";
import { Playbook } from "../models/Playbook";
import { TradingAccount } from "../models/TradingAccount";

export const aiCoachService = {
  /**
   * Compiles user-specific trading data into a concise JSON structure
   * designed to serve as the context for the AI personal coach.
   */
  async getUserTradingContext(userId: string) {
    const activeAccount = await TradingAccount.findOne({ userId, isActive: true });

    // Fetch last 50 active trades
    const trades = await Trade.find({ userId, isDeleted: false })
      .sort("-tradeDate")
      .limit(50);

    // Fetch user playbooks
    const playbooks = await Playbook.find({ userId, isArchived: false });

    // Aggregate Trade stats
    const totalTrades = trades.length;
    const wins = trades.filter(t => t.result === "WIN").length;
    const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : "0";
    const totalPnL = trades.reduce((sum, t) => sum + (t.actualPnl || 0), 0);

    const emotionalStates = trades.map(t => t.emotionalState).filter((val): val is number => typeof val === "number");
    const avgEmotion = emotionalStates.length > 0
      ? (emotionalStates.reduce((a, b) => a + b, 0) / emotionalStates.length).toFixed(1)
      : "Tidak dicatat";

    // Build context object
    return {
      account: activeAccount ? {
        name: activeAccount.name,
        balance: activeAccount.balance,
        currency: activeAccount.currency || "USD",
        riskTier: activeAccount.riskTier || "MODERATE",
      } : null,
      performanceSummary: {
        evaluatedTradesCount: totalTrades,
        winRate: `${winRate}%`,
        accumulatedPnL: totalPnL.toFixed(2),
        averageEmotionalRating: avgEmotion, // 1-5 scale
      },
      playbooks: playbooks.map(p => ({
        id: p._id.toString(),
        name: p.name,
        methodology: p.methodology,
        marketCondition: p.marketCondition || "ALL",
        rulesCount: p.rules?.length || 0,
        stats: p.stats ? {
          totalTrades: p.stats.totalTrades,
          winRate: `${p.stats.winRate}%`,
          totalPnL: p.stats.totalPnL,
        } : null
      })),
      recentTrades: trades.map(t => ({
        id: t._id.toString(),
        pair: t.pair,
        direction: t.direction,
        result: t.result,
        pnl: t.actualPnl,
        rMultiple: t.rMultiple || 0,
        session: t.session || "Other",
        emotion: t.emotionalState || "Tidak dicatat",
        notes: t.notes ? t.notes.substring(0, 60) + (t.notes.length > 60 ? "..." : "") : "No notes"
      }))
    };
  }
};
