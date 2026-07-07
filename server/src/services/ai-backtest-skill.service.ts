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

      // ── 2b. Update verdicts for active methodologies with zero trades ──
      // If a methodology was in activeMethodologies but had zero trades,
      // still track it so its verdict doesn't stay stale from previous runs.
      const activeMeths = (result.config as any)?.activeMethodologies as string[] | undefined;
      if (activeMeths && activeMeths.length > 0) {
        for (const meth of activeMeths) {
          const alreadyUpdated = (result.methodologyStats || []).some(
            (ms: any) => ms.methodology === meth,
          );
          if (alreadyUpdated) continue;
          let methSkill = skill.methodologyRankings.find((m: any) => m.methodology === meth);
          if (!methSkill) {
            skill.methodologyRankings.push({
              methodology: meth,
              totalTrades: 0,
              totalPnL: 0,
              avgWinRate: 0,
              bestSymbol: result.symbols.join(","),
              verdict: "ADJUST",
            });
          }
          // If it exists but had no trades this run, keep existing state
        }
      }
      // ── 2c. Mark methodologies that were NOT tested as ADJUST ──────────
      // If a methodology has very old data and was excluded from active,
      // nudge it toward ADJUST so user re-evaluates.
      const ALL_METHODOLOGIES = ["smc", "ict", "msnr", "crt", "quarterly", "lit", "rsiEngulf"];
      if (activeMeths) {
        for (const meth of ALL_METHODOLOGIES) {
          if (activeMeths.includes(meth)) continue;
          const methSkill = skill.methodologyRankings.find((m: any) => m.methodology === meth);
          if (methSkill && methSkill.totalTrades > 0 && methSkill.verdict === "KEEP") {
            // Was previously good but excluded this run — flag as ADJUST
            methSkill.verdict = "ADJUST";
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

  /** Get top N best symbols by score */
  async getBestSymbols(userId: string, limit = 5) {
    const skill = await AIBacktestSkill.findOne({ userId });
    if (!skill) return [];
    return skill.symbolRankings
      .filter((s: any) => s.totalBacktests >= 2 && s.score >= 40)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, limit);
  }

  /** Get methodology verdicts for disabling poor performers */
  async getMethodologyVerdicts(userId: string) {
    const skill = await AIBacktestSkill.findOne({ userId });
    if (!skill) return [];
    return skill.methodologyRankings.filter((m: any) => m.totalTrades >= 5);
  }

  /** Get recommended params for a specific symbol */
  async getRecommendedParams(userId: string, symbol: string) {
    const skill = await AIBacktestSkill.findOne({ userId });
    if (!skill) return null;
    const entry = skill.symbolRankings.find((s: any) => s.symbol === symbol);
    return entry?.recommendedParams || null;
  }

  /** Lightweight inline skill update from auto-backtest partial result */
  async updateFromAutoResult(
    userId: string,
    symbol: string,
    pnl: number,
    trades: number,
    winRate: number,
    profitFactor: number,
    recoveryFactor: number,
  ): Promise<void> {
    try {
      let skill = await AIBacktestSkill.findOne({ userId });
      if (!skill) {
        skill = new AIBacktestSkill({ userId, symbolRankings: [], methodologyRankings: [], globalRecoveryFactor: 0, totalBacktests: 0 });
      }

      let symSkill = skill.symbolRankings.find((s: any) => s.symbol === symbol);
      if (!symSkill) {
        skill.symbolRankings.push({
          symbol,
          score: 0,
          totalBacktests: 1,
          avgWinRate: winRate,
          avgProfitFactor: profitFactor,
          avgRecoveryFactor: recoveryFactor,
          totalPnL: pnl,
          totalTrades: trades,
          bestMethodology: "unknown",
          recommendedParams: { rsiOversold: 30, rsiOverbought: 70, atrMultiplierSL: 1.5, atrMultiplierTP: 2.0, signalInterval: 4 },
          lastTested: new Date(),
        });
      } else {
        symSkill.totalBacktests += 1;
        symSkill.avgWinRate = (symSkill.avgWinRate * (symSkill.totalBacktests - 1) + winRate) / symSkill.totalBacktests;
        symSkill.avgProfitFactor = (symSkill.avgProfitFactor * (symSkill.totalBacktests - 1) + profitFactor) / symSkill.totalBacktests;
        const rf = recoveryFactor === Infinity ? 10 : recoveryFactor;
        symSkill.avgRecoveryFactor = (symSkill.avgRecoveryFactor * (symSkill.totalBacktests - 1) + rf) / symSkill.totalBacktests;
        symSkill.totalPnL += pnl;
        symSkill.totalTrades += trades;
        symSkill.lastTested = new Date();
      }

      // Recalculate scores
      const maxPnL = Math.max(...skill.symbolRankings.map((s: any) => Math.abs(s.totalPnL)), 1);
      const maxTrades = Math.max(...skill.symbolRankings.map((s: any) => s.totalTrades), 1);
      for (const s of skill.symbolRankings) {
        s.score = Math.round(
          (s.avgWinRate * 0.25) +
          (Math.min(100, s.avgProfitFactor * 25) * 0.25) +
          (Math.min(100, s.avgRecoveryFactor * 20) * 0.20) +
          (((s.totalPnL + maxPnL) / (2 * maxPnL)) * 100 * 0.15) +
          ((s.totalTrades / maxTrades) * 100 * 0.15)
        );
      }
      skill.symbolRankings.sort((a: any, b: any) => b.score - a.score);
      await skill.save();
    } catch (err: any) {
      silentLogger.error(`[AI-SKILL] updateFromAutoResult error: ${err.message}`);
    }
  }
}

export const aiBacktestSkillService = new AIBacktestSkillService();
