/**
 * Trade Journal Cross-Analysis Engine — Phase 5
 *
 * Compares real trading performance (AITradeLog) against backtest data
 * to detect methodology over/under-performance, regime shifts, and
 * automatically updates AIBacktestSkill rankings with live feedback.
 */
import { AITradeLog } from "../models/AITradeLog";
import { AIBacktestSkill } from "../models/AIBacktestSkill";
import { silentLogger } from "../utils/silent-logger";

export interface JournalInsight {
  methodology: string;
  backtestWinRate: number;
  realWinRate: number;
  performanceDelta: number; // positive = overperforming, negative = underperforming
  signalCount: number;
  recommendation: "INCREASE_WEIGHT" | "MAINTAIN" | "DECREASE_WEIGHT" | "DISABLE";
}

class TradeJournalAnalysisService {
  /**
   * Analyze real trading logs vs backtest expectations.
   * Updates AIBacktestSkill methodology rankings based on live data.
   */
  async analyze(userId: string): Promise<JournalInsight[]> {
    try {
      const skill = await AIBacktestSkill.findOne({ userId });
      if (!skill || skill.methodologyRankings.length === 0) return [];

      const insights: JournalInsight[] = [];

      for (const methRank of skill.methodologyRankings) {
        const realTrades = await AITradeLog.find({
          userId,
          closed: true,
          pnl: { $exists: true },
          "signal.primaryMethodology": methRank.methodology,
        }).lean();

        if (realTrades.length < 5) continue; // insufficient sample

        const wins = realTrades.filter((t) => (t.pnl || 0) > 0).length;
        const realWinRate = (wins / realTrades.length) * 100;
        const delta = realWinRate - methRank.avgWinRate;

        let recommendation: JournalInsight["recommendation"] = "MAINTAIN";
        if (delta > 10 && realTrades.length >= 10) recommendation = "INCREASE_WEIGHT";
        else if (delta < -10 && realTrades.length >= 10) recommendation = "DECREASE_WEIGHT";
        else if (delta < -20 && realTrades.length >= 15) recommendation = "DISABLE";

        insights.push({
          methodology: methRank.methodology,
          backtestWinRate: Math.round(methRank.avgWinRate * 100) / 100,
          realWinRate: Math.round(realWinRate * 100) / 100,
          performanceDelta: Math.round(delta * 100) / 100,
          signalCount: realTrades.length,
          recommendation,
        });

        // Apply live feedback to skill
        if (realTrades.length >= 10) {
          methRank.avgWinRate = Math.round(
            (methRank.avgWinRate * 0.7 + realWinRate * 0.3) * 100
          ) / 100;

          if (recommendation === "DISABLE") methRank.verdict = "DISABLE";
          else if (recommendation === "DECREASE_WEIGHT" && methRank.verdict === "KEEP") {
            methRank.verdict = "ADJUST";
          }
        }
      }

      await skill.save();
      silentLogger.info(`[JOURNAL] Analyzed ${insights.length} methodologies for user ${userId}`);
      return insights;
    } catch (err: any) {
      silentLogger.error(`[JOURNAL] Analysis error: ${err.message}`);
      return [];
    }
  }
}

export const tradeJournalAnalysisService = new TradeJournalAnalysisService();
