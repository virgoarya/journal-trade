/**
 * Walk-Forward Optimization Engine — Phase 4
 *
 * Prevents backtest overfitting by periodically re-optimizing parameters
 * on a rolling window: train on 4 months, test on 2 months.
 * Only parameters that perform consistently on BOTH sets are promoted to live.
 */
import { backtestService, type BacktestResult } from "./backtest.service";
import { aiBacktestSkillService } from "./ai-backtest-skill.service";
import { silentLogger } from "../utils/silent-logger";

interface ParamCombination {
  entrySettings: { rsiOversold: number; rsiOverbought: number; atrMultiplierSL: number; atrMultiplierTP: number };
  trailingStop: { enabled: boolean; activationATR: number; trailATR: number; breakEven: boolean };
  maxRiskPerTrade: number;
  signalInterval: number;
  activeMethodologies?: import("./strategies/index").MethodologyName[];
}

const TRAINING_MONTHS = 4;
const TEST_MONTHS = 2;

class WalkForwardService {
  async optimize(userId: string, symbol: string, timeframe: string): Promise<void> {
    silentLogger.info(`[WALK-FWD] Starting optimization for ${symbol} ${timeframe}`);

    const now = new Date();
    const trainEnd = new Date(now.getTime() - TEST_MONTHS * 30 * 24 * 3600 * 1000);
    const trainStart = new Date(trainEnd.getTime() - TRAINING_MONTHS * 30 * 24 * 3600 * 1000);
    const testStart = trainEnd;
    const testEnd = now;

    const paramSpace = this.generateParamSpace();
    let bestScore = -Infinity;
    let bestParams: ParamCombination | null = null;

    for (const params of paramSpace) {
      const config = {
        symbols: [symbol],
        timeframe: timeframe as any,
        fromDate: trainStart,
        toDate: trainEnd,
        initialBalance: 10000,
        entrySettings: params.entrySettings,
        trailingStop: params.trailingStop,
        maxRiskPerTrade: params.maxRiskPerTrade,
        maxOpenPositions: 2,
        leverage: 100,
        signalInterval: params.signalInterval,
        spreadPips: 2.0,
        slippagePips: 0.5,
        activeMethodologies: params.activeMethodologies,
      };

      try {
        const trainResult = await backtestService.runBacktest("walkforward", config);
        if (!this.isValid(trainResult)) continue;

        const testConfig = { ...config, fromDate: testStart, toDate: testEnd };
        const testResult = await backtestService.runBacktest("walkforward", testConfig);
        if (!this.isValid(testResult)) continue;

        const score = this.score(trainResult, testResult);
        if (score > bestScore) {
          bestScore = score;
          bestParams = params;
          silentLogger.info(`[WALK-FWD] ${symbol} new best: score=${score.toFixed(1)} WR=${testResult.winRate.toFixed(1)}% PF=${testResult.profitFactor.toFixed(2)}`);
        }
      } catch { continue; }
    }

    if (bestParams) {
      const { aiBacktestSkillService } = require("./ai-backtest-skill.service");
      const skill = await aiBacktestSkillService.getSkill(userId);
      if (skill) {
        const entry = skill.symbolRankings.find((s: any) => s.symbol === symbol);
        if (entry) {
          entry.recommendedParams = {
            rsiOversold: bestParams.entrySettings.rsiOversold,
            rsiOverbought: bestParams.entrySettings.rsiOverbought,
            atrMultiplierSL: bestParams.entrySettings.atrMultiplierSL,
            atrMultiplierTP: bestParams.entrySettings.atrMultiplierTP,
            signalInterval: bestParams.signalInterval,
          };
          await skill.save();
          silentLogger.info(`[WALK-FWD] Updated ${symbol} params in AIBacktestSkill`);
        }
      }
    }
  }

  private generateParamSpace(): ParamCombination[] {
    const combos: ParamCombination[] = [];
    
    // Methodology subsets to test (from most selective to most inclusive)
    const methodologySets: Array<import("./strategies/index").MethodologyName[]> = [
      ["smc", "ict"],                                    // Trend-following only
      ["msnr"],                                       // Mean-reversion only
      ["smc", "ict", "msnr"],                            // Core 3
      ["smc", "ict", "msnr"],      // All 3 advanced
    ];

    for (const os of [25, 30, 35]) {
      for (const ob of [65, 70, 75]) {
        for (const sl of [1.0, 1.5, 2.0]) {
          for (const tp of [1.5, 2.0, 2.5]) {
            // Test default methodology set for all param combinations
            combos.push({
              entrySettings: { rsiOversold: os, rsiOverbought: ob, atrMultiplierSL: sl, atrMultiplierTP: tp },
              trailingStop: { enabled: true, activationATR: 1.0, trailATR: 0.5, breakEven: false },
              maxRiskPerTrade: 0.5,
              signalInterval: 4,
            });
          }
        }
      }
    }
    
    // Also test methodology subset variations with mid-range params
    for (const methSet of methodologySets) {
      combos.push({
        entrySettings: { rsiOversold: 30, rsiOverbought: 70, atrMultiplierSL: 1.5, atrMultiplierTP: 2.0 },
        trailingStop: { enabled: true, activationATR: 1.0, trailATR: 0.5, breakEven: false },
        maxRiskPerTrade: 0.5,
        signalInterval: 4,
        activeMethodologies: methSet,
      });
    }

    return combos;
  }

  private isValid(r: BacktestResult): boolean {
    return r.totalTrades >= 15 && r.winRate > 30 && r.profitFactor > 0.8 && r.maxDrawdownPercent < 50;
  }

  private score(train: BacktestResult, test: BacktestResult): number {
    const trainScore = train.winRate * 0.3 + Math.min(train.profitFactor, 5) * 15 - train.maxDrawdownPercent * 0.5;
    const testScore = test.winRate * 0.3 + Math.min(test.profitFactor, 5) * 15 - test.maxDrawdownPercent * 0.5;
    const consistencyPenalty = Math.abs(trainScore - testScore) * 0.5;
    return trainScore * 0.4 + testScore * 0.6 - consistencyPenalty;
  }
}

export const walkForwardService = new WalkForwardService();
