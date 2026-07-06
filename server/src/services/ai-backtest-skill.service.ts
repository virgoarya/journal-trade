import { AIBacktestSkill } from "../models/AIBacktestSkill";
import type { BacktestResult } from "./backtest.service";
import { silentLogger } from "../utils/silent-logger";

class AIBacktestSkillService {
  /**
   * Aggregate a new backtest result into the user's AI Skill dataset.
   * Updates rankings, veridic judgments, and parameters.
   */
  async updateSkill(userId: string, result: BacktestResult): Promise<void> {
    try {
      let skill = await AIBacktestSkill.findOne({ userId });
      if (!skill) {
        skill = new AIBacktestSkill({
          userId,
          symbolRankings: [],
          methodologyRankings: [],
          globalRecoveryFactor: 0,
          totalBacktests: 0,
        });
      }

      skill.totalBacktests += 1;

      // ── 1. Update Symbol Stats & Rankings ───────────────────────────
      for (const symStat of result.symbolStats || []) {
        let symSkill = skill.symbolRankings.find((s: any) => s.symbol === symStat.symbol);

        // Find best methodology for this symbol in this test
        const symbolTrades = result.trades.filter((t) => t.symbol === symStat.symbol);
        const methWinRates = new Map<string, { wins: number; total: number }>();
        for (const t of symbolTrades) {
          const m = t.primaryMethodology || "unknown";
          if (!methWinRates.has(m)) methWinRates.set(m, { wins: 0, total: 0 });
          const wr = methWinRates.get(m)!;
          wr.total++;
          if (t.pnl > 0) wr.wins++;
        }
        let bestMeth = "rsiEngulf";
        let bestWrRatio = 0;
        for (const [meth, wr] of methWinRates.entries()) {
          const ratio = wr.wins / wr.total;
          if (ratio > bestWrRatio) {
            bestWrRatio = ratio;
            bestMeth = meth;
          }
        }

        if (!symSkill) {
          skill.symbolRankings.push({
            symbol: symStat.symbol,
            score: 0,
            totalBacktests: 1,
            avgWinRate: symStat.winRate,
            avgProfitFactor: result.profitFactor,
            avgRecoveryFactor: result.recoveryFactor || 0,
            totalPnL: symStat.totalPnL,
            totalTrades: symStat.totalTrades,
            bestMethodology: bestMeth,
            recommendedParams: {
              rsiOversold: result.config.entrySettings.rsiOversold,
              rsiOverbought: result.config.entrySettings.rsiOverbought,
              atrMultiplierSL: result.config.entrySettings.atrMultiplierSL,
              atrMultiplierTP: result.config.entrySettings.atrMultiplierTP,
              signalInterval: result.config.signalInterval,
            },
            lastTested: new Date(),
          });
        } else {
          symSkill.totalBacktests += 1;
          symSkill.avgWinRate = (symSkill.avgWinRate * (symSkill.totalBacktests - 1) + symStat.winRate) / symSkill.totalBacktests;
          symSkill.avgProfitFactor = (symSkill.avgProfitFactor * (symSkill.totalBacktests - 1) + result.profitFactor) / symSkill.totalBacktests;
          const currentRF = result.recoveryFactor === Infinity ? 10 : (result.recoveryFactor || 0);
          symSkill.avgRecoveryFactor = (symSkill.avgRecoveryFactor * (symSkill.totalBacktests - 1) + currentRF) / symSkill.totalBacktests;
          symSkill.totalPnL += symStat.totalPnL;
          symSkill.totalTrades += symStat.totalTrades;
          symSkill.bestMethodology = bestMeth;
          symSkill.lastTested = new Date();

          // Adaptive reinforcement learning for parameters
          if (result.totalPnLPercent > 5 && result.winRate >= 50) {
            symSkill.recommendedParams = {
              rsiOversold: result.config.entrySettings.rsiOversold,
              rsiOverbought: result.config.entrySettings.rsiOverbought,
              atrMultiplierSL: result.config.entrySettings.atrMultiplierSL,
              atrMultiplierTP: result.config.entrySettings.atrMultiplierTP,
              signalInterval: result.config.signalInterval,
            };
          }
        }
      }

      // Calculate composite score for rankings
      const maxPnL = Math.max(...skill.symbolRankings.map((s: any) => Math.abs(s.totalPnL)), 1);
      const maxTrades = Math.max(...skill.symbolRankings.map((s: any) => s.totalTrades), 1);

      for (const s of skill.symbolRankings) {
        const winRateScore = s.avgWinRate;
        const pfScore = Math.min(100, s.avgProfitFactor * 25);
        const rfScore = Math.min(100, s.avgRecoveryFactor * 20);
        const pnlScore = ((s.totalPnL + maxPnL) / (2 * maxPnL)) * 100;
        const tradesScore = (s.totalTrades / maxTrades) * 100;

        s.score = Math.round(
          winRateScore * 0.25 +
          pfScore * 0.25 +
          rfScore * 0.20 +
          pnlScore * 0.15 +
          tradesScore * 0.15
        );
      }

      // Sort symbolRankings by score desc
      skill.symbolRankings.sort((a: any, b: any) => b.score - a.score);

      // ── 2. Update Methodology Stats & Verdicts ────────────────────
      for (const methStat of result.methodologyStats || []) {
        let methSkill = skill.methodologyRankings.find((m: any) => m.methodology === methStat.methodology);
        if (!methSkill) {
          skill.methodologyRankings.push({
            methodology: methStat.methodology,
            totalTrades: methStat.totalTrades,
            totalPnL: methStat.totalPnL,
            avgWinRate: methStat.winRate,
            bestSymbol: result.symbols.join(","),
            verdict: methStat.totalPnL < 0 ? "DISABLE" : methStat.winRate < 45 ? "ADJUST" : "KEEP",
          });
        } else {
          methSkill.totalTrades += methStat.totalTrades;
          methSkill.totalPnL += methStat.totalPnL;
          methSkill.avgWinRate = (methSkill.avgWinRate * 0.7) + (methStat.winRate * 0.3); // Exponential weighted moving average

          if (methSkill.totalPnL < -200) {
            methSkill.verdict = "DISABLE";
          } else if (methSkill.avgWinRate < 45 || methSkill.totalPnL < 0) {
            methSkill.verdict = "ADJUST";
          } else {
            methSkill.verdict = "KEEP";
          }
        }
      }

      // ── 3. Update global recovery factor ────────────────────────────
      const totalRF = result.recoveryFactor === Infinity ? 10 : (result.recoveryFactor || 0);
      skill.globalRecoveryFactor = (skill.globalRecoveryFactor * (skill.totalBacktests - 1) + totalRF) / skill.totalBacktests;

      await skill.save();
      silentLogger.info(`[AI-SKILL] Aggregated backtest results into AI skill database for user ${userId}`);
    } catch (err: any) {
      silentLogger.error(`[AI-SKILL] Error updating skill metrics: ${err.message}`);
    }
  }

  /** Retrieve the current skill metrics for a user */
  async getSkill(userId: string) {
    return AIBacktestSkill.findOne({ userId });
  }
}

export const aiBacktestSkillService = new AIBacktestSkillService();
