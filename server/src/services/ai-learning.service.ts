import { BacktestExperience } from "../models/BacktestExperience";
import { tradingPipelineService, type PipelineConfig } from "./trading-pipeline.service";
import { backtestService } from "./backtest.service";
import { silentLogger } from "../utils/silent-logger";

// ─── Types ───────────────────────────────────────────────────────────

export interface BacktestAnalysis {
  summary: string;
  lessonsLearned: string[];
  strengths: string[];
  weaknesses: string[];
  recommendedParamChanges: Record<string, any>;
  overallGrade: "A" | "B" | "C" | "D" | "F";
  confidenceToApply: number; // 0-100
  methodologyRecommendations?: Array<{
    methodology: string;
    verdict: "KEEP" | "ADJUST" | "DISABLE";
    reason: string;
  }>;
  symbolInsights?: Array<{
    symbol: string;
    verdict: "PROFITABLE" | "UNPROFITABLE" | "MIXED";
    totalTrades: number;
    totalPnL: number;
    suggestion: string;
  }>;
  recoveryFactorAnalysis?: string;
}

export interface SymbolInsights {
  symbol: string;
  timeframe: string;
  bestWinRate: number;
  bestProfitFactor: number;
  averageReturn: number;
  totalBacktests: number;
  recommendations: string[];
  recommendedParams: Record<string, any>;
}

// ─── Optimization Types ──────────────────────────────────────────────

export interface OptimizationConfig {
  symbol: string;
  timeframe: string;
  fromDate: string;
  toDate: string;
  initialBalance: number;
  optimizationMetric: "profitFactor" | "winRate" | "sharpeRatio" | "totalPnLPercent";
  maxCombinations: number;
}

export interface OptimizationResult {
  config: OptimizationConfig;
  totalCombinationsTested: number;
  bestParams: {
    entrySettings: {
      rsiOversold: number;
      rsiOverbought: number;
      atrMultiplierSL: number;
      atrMultiplierTP: number;
    };
    trailingStop: {
      enabled: boolean;
      activationATR: number;
      trailATR: number;
    };
    maxRiskPerTrade: number;
    maxOpenPositions: number;
  };
  bestResult: {
    totalTrades: number;
    winRate: number;
    totalPnLPercent: number;
    profitFactor: number;
    maxDrawdownPercent: number;
    sharpeRatio: number;
  };
  allResults: Array<{
    params: Record<string, any>;
    metrics: Record<string, number>;
    grade: string;
  }>;
}

// ─── Service ─────────────────────────────────────────────────────────

// ─── Parameter Search Space ─────────────────────────────────────────

interface ParamRange {
  name: string;
  path: string; // dot notation for nested object path
  values: number[];
}

function buildParamCombinations(ranges: ParamRange[]): Record<string, any>[] {
  if (ranges.length === 0) return [{}];

  // Start with base case: single range
  function combine(
    index: number,
    current: Record<string, any>,
  ): Record<string, any>[] {
    if (index >= ranges.length) return [{ ...current }];

    const range = ranges[index];
    const results: Record<string, any>[] = [];

    for (const val of range.values) {
      const copy = { ...current };
      // Set nested path e.g. "entrySettings.rsiOversold"
      const keys = range.path.split(".");
      let obj = copy;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!obj[keys[i]]) obj[keys[i]] = {};
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = val;
      results.push(...combine(index + 1, copy));
    }

    return results;
  }

  return combine(0, {});
}

class AILearningService {
  /**
   * Analyze a completed backtest using rule-based logic and generate
   * insights, lessons, and parameter recommendations.
   */
  async analyzeBacktest(
    backtestId: string,
    userId: string,
  ): Promise<BacktestAnalysis> {
    const experience = await BacktestExperience.findOne({
      _id: backtestId,
      userId,
    });

    if (!experience) {
      throw new Error("Backtest experience not found");
    }

    const result = experience.result;
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const lessons: string[] = [];
    const recommendedChanges: Record<string, any> = {};

    // ── Analyze win rate ──────────────────────────────────────────
    if (result.winRate >= 60) {
      strengths.push(
        `Strong win rate of ${result.winRate}% — strategy effectively identifies high-probability setups`,
      );
    } else if (result.winRate >= 45) {
      lessons.push(
        `Win rate of ${result.winRate}% is moderate. Consider tightening RSI thresholds to filter out lower-quality signals`,
      );
    } else {
      weaknesses.push(
        `Low win rate of ${result.winRate}%. Strategy may be taking too many low-probability trades`,
      );
      // Recommend tighter RSI
      recommendedChanges.entrySettings = {
        ...((experience.pipelineConfigSnapshot as any)?.entrySettings || {}),
        rsiOversold: 25,
        rsiOverbought: 75,
      };
    }

    // ── Analyze profit factor ─────────────────────────────────────
    if (result.profitFactor >= 2.0) {
      strengths.push(
        `Excellent profit factor of ${result.profitFactor} — winners significantly outweigh losers`,
      );
    } else if (result.profitFactor >= 1.5) {
      strengths.push(
        `Good profit factor of ${result.profitFactor} — strategy has positive expectancy`,
      );
    } else if (result.profitFactor >= 1.0) {
      lessons.push(
        `Profit factor of ${result.profitFactor} is marginal. Consider increasing R:R ratio by widening TP`,
      );
    } else {
      weaknesses.push(
        `Profit factor below 1.0 (${result.profitFactor}) — strategy is not profitable`,
      );
      recommendedChanges.entrySettings = {
        ...((experience.pipelineConfigSnapshot as any)?.entrySettings || {}),
        atrMultiplierTP: 2.0,
        atrMultiplierSL: 1.5,
      };
    }

    // ── Analyze drawdown ──────────────────────────────────────────
    if (result.maxDrawdownPercent <= 5) {
      strengths.push(
        `Low maximum drawdown of ${result.maxDrawdownPercent}% — good risk management`,
      );
    } else if (result.maxDrawdownPercent <= 15) {
      lessons.push(
        `Maximum drawdown of ${result.maxDrawdownPercent}% is acceptable. Monitor during volatile periods`,
      );
    } else {
      weaknesses.push(
        `High maximum drawdown of ${result.maxDrawdownPercent}% — consider reducing position size or tightening SL`,
      );
      recommendedChanges.maxRiskPerTrade = Math.max(
        0.5,
        (experience.pipelineConfigSnapshot as any)?.maxRiskPerTrade - 0.25 || 1.0,
      );
    }

    // ── Analyze Sharpe ────────────────────────────────────────────
    if (result.sharpeRatio >= 1.5) {
      strengths.push(
        `Strong Sharpe ratio of ${result.sharpeRatio} — excellent risk-adjusted returns`,
      );
    } else if (result.sharpeRatio < 0.5) {
      weaknesses.push(
        `Low Sharpe ratio of ${result.sharpeRatio} — risk-adjusted returns need improvement`,
      );
    }

    // ── Analyze trade frequency ───────────────────────────────────
    if (result.totalTrades < 10) {
      lessons.push(
        `Only ${result.totalTrades} trades in the period — consider adding more symbols or lowering RSI thresholds for more signals`,
      );
    } else if (result.totalTrades > 100) {
      lessons.push(
        `${result.totalTrades} trades suggests strategy may be over-trading. Consider higher timeframe for confirmation`,
      );
    }

    // ── Analyze average win vs loss ───────────────────────────────
    if (result.averageWin > 0 && result.averageLoss > 0) {
      const winLossRatio = result.averageWin / result.averageLoss;
      if (winLossRatio >= 2) {
        strengths.push(
          `Excellent win/loss ratio of ${winLossRatio.toFixed(2)} — winners are much larger than losers`,
        );
      } else if (winLossRatio < 1) {
        weaknesses.push(
          `Win/loss ratio of ${winLossRatio.toFixed(2)} — winners smaller than losers. Increase TP or reduce SL`,
        );
        recommendedChanges.entrySettings = {
          ...((experience.pipelineConfigSnapshot as any)?.entrySettings || {}),
          atrMultiplierTP: 2.0,
        };
      }
    }

    // ── Overall grade ─────────────────────────────────────────────
    let grade = "C";
    let score = 0;
    if (result.winRate >= 60) score += 2;
    else if (result.winRate >= 45) score += 1;
    if (result.profitFactor >= 2) score += 2;
    else if (result.profitFactor >= 1.5) score += 1;
    if (result.maxDrawdownPercent <= 5) score += 2;
    else if (result.maxDrawdownPercent <= 15) score += 1;
    if (result.sharpeRatio >= 1.5) score += 2;
    else if (result.sharpeRatio >= 0.5) score += 1;
    if (result.totalTrades >= 20) score += 1;

    if (score >= 8) grade = "A";
    else if (score >= 6) grade = "B";
    else if (score >= 4) grade = "C";
    else if (score >= 2) grade = "D";
    else grade = "F";

    // ── Recovery Factor Analysis ──────────────────────────────────
    let recoveryFactorAnalysis: string | undefined;
    if (result.recoveryFactor !== undefined) {
      if (result.recoveryFactor === Infinity) {
        recoveryFactorAnalysis = "Perfect recovery factor — no drawdown period, strategy never went underwater.";
        strengths.push("Perfect recovery factor (∞) — zero drawdown periods");
      } else if (result.recoveryFactor >= 3) {
        recoveryFactorAnalysis = `Excellent recovery factor of ${result.recoveryFactor} — strategy recovers quickly from drawdowns.`;
        strengths.push(`Outstanding recovery factor of ${result.recoveryFactor} — excels at recovering after losses`);
      } else if (result.recoveryFactor >= 1.5) {
        recoveryFactorAnalysis = `Good recovery factor of ${result.recoveryFactor} — strategy recovers reasonably from drawdowns.`;
      } else {
        recoveryFactorAnalysis = `Low recovery factor of ${result.recoveryFactor} — strategy struggles to recover from drawdowns. Consider reducing risk per trade.`;
        weaknesses.push(`Low recovery factor of ${result.recoveryFactor} — strategy has difficulty recovering from drawdowns`);
        if (!recommendedChanges.maxRiskPerTrade || recommendedChanges.maxRiskPerTrade > 0.5) {
          recommendedChanges.maxRiskPerTrade = 0.5;
        }
      }
    }

    // ── Methodology Performance Analysis ──────────────────────────
    const methodologyRecommendations: NonNullable<BacktestAnalysis["methodologyRecommendations"]> = [];
    if ((result as any).methodologyStats && (result as any).methodologyStats.length > 0) {
      const methStats: Array<{ methodology: string; totalTrades: number; totalPnL: number; winRate: number }> = (result as any).methodologyStats;
      methStats.forEach((m) => {
        let verdict: "KEEP" | "ADJUST" | "DISABLE" = "KEEP";
        const reasons: string[] = [];
        if (m.totalTrades >= 5) {
          if (m.winRate >= 55 && m.totalPnL > 0) {
            verdict = "KEEP";
            reasons.push(`Strong ${m.winRate}% win rate with +$${m.totalPnL.toFixed(2)} profit`);
          } else if (m.winRate >= 40 && m.totalPnL > 0) {
            verdict = "ADJUST";
            reasons.push(`Moderate performance (${m.winRate}%, $${m.totalPnL.toFixed(2)}). Consider tuning parameters`);
          } else if (m.totalPnL < 0) {
            verdict = "DISABLE";
            reasons.push(`Negative PnL of $${m.totalPnL.toFixed(2)} at ${m.winRate}% win rate`);
          } else {
            verdict = "ADJUST";
            reasons.push(`Neutral performance — ${m.totalTrades} trades, ${m.winRate}% WR`);
          }
        } else {
          reasons.push(`Only ${m.totalTrades} trades — insufficient data for reliable assessment`);
          if (m.totalPnL > 0) {
            verdict = "ADJUST";
            reasons.push("Positive but low sample size, needs more testing");
          }
        }
        methodologyRecommendations.push({
          methodology: m.methodology,
          verdict,
          reason: reasons.join(". "),
        });
      });

      // Best methodology
      const bestMeth = methStats.filter(m => m.totalTrades >= 3).sort((a, b) => b.totalPnL - a.totalPnL)[0];
      if (bestMeth) {
        strengths.push(`Methodology "${bestMeth.methodology}" performed best: +$${bestMeth.totalPnL.toFixed(2)}, ${bestMeth.winRate}% win rate`);
      }
      const worstMeth = methStats.filter(m => m.totalTrades >= 3).sort((a, b) => a.totalPnL - b.totalPnL)[0];
      if (worstMeth && worstMeth.totalPnL < 0) {
        weaknesses.push(`Methodology "${worstMeth.methodology}" underperformed: ${worstMeth.totalPnL.toFixed(2)}, consider disabling`);
      }
    }

    // ── Symbol Performance Analysis ───────────────────────────────
    const symbolInsights: NonNullable<BacktestAnalysis["symbolInsights"]> = [];
    if ((result as any).symbolStats && (result as any).symbolStats.length > 0) {
      const symStats: Array<{ symbol: string; totalTrades: number; totalPnL: number; winRate: number }> = (result as any).symbolStats;
      symStats.forEach((s) => {
        let verdict: "PROFITABLE" | "UNPROFITABLE" | "MIXED";
        let suggestion = "";
        if (s.totalPnL > 0 && s.winRate >= 50) {
          verdict = "PROFITABLE";
          suggestion = `Strong performance on ${s.symbol}. Consider prioritizing this pair in live trading.`;
        } else if (s.totalPnL < 0) {
          verdict = "UNPROFITABLE";
          suggestion = `Avoid ${s.symbol} with current settings. Try different timeframe or methodology weights.`;
        } else {
          verdict = "MIXED";
          suggestion = `${s.symbol} shows mixed results. Review individual trades for pattern.`;
        }
        symbolInsights.push({
          symbol: s.symbol,
          verdict,
          totalTrades: s.totalTrades,
          totalPnL: s.totalPnL,
          suggestion,
        });
      });

      const bestSym = symStats.sort((a, b) => b.totalPnL - a.totalPnL)[0];
      if (bestSym && bestSym.totalPnL > 0) {
        strengths.push(`Best performing pair: ${bestSym.symbol} with +$${bestSym.totalPnL.toFixed(2)} (${bestSym.winRate}% WR)`);
      }
      const worstSym = symStats.sort((a, b) => a.totalPnL - b.totalPnL)[0];
      if (worstSym && worstSym.totalPnL < 0) {
        weaknesses.push(`Worst performing pair: ${worstSym.symbol} at ${worstSym.totalPnL.toFixed(2)} — consider removing from strategy`);
      }
    }

    // ── Generate summary ──────────────────────────────────────────
    const summary = this.generateSummary(result, grade);

    // ── Confidence to auto-apply ──────────────────────────────────
    let confidenceToApply = 50;
    if (result.totalTrades >= 30) confidenceToApply += 15;
    if (result.winRate >= 55) confidenceToApply += 15;
    if (result.profitFactor >= 1.5) confidenceToApply += 10;
    if (result.maxDrawdownPercent <= 10) confidenceToApply += 10;
    if (grade === "A" || grade === "B") confidenceToApply += 10;
    confidenceToApply = Math.min(100, Math.max(0, confidenceToApply));

    // ── Save analysis to DB ───────────────────────────────────────
    const analysis = {
      summary,
      lessonsLearned: lessons,
      strengths,
      weaknesses,
      recommendedParamChanges: recommendedChanges,
      overallGrade: grade as BacktestAnalysis["overallGrade"],
      confidenceToApply,
      methodologyRecommendations:
        methodologyRecommendations.length > 0 ? methodologyRecommendations : undefined,
      symbolInsights: symbolInsights.length > 0 ? symbolInsights : undefined,
      recoveryFactorAnalysis,
    };

    await BacktestExperience.findByIdAndUpdate(backtestId, {
      aiLearningSummary: {
        strengths,
        weaknesses,
        marketConditions: [],
        recommendedAdjustments: recommendedChanges,
      },
    });

    return analysis;
  }

  /**
   * Apply backtest learnings to the live trading pipeline.
   */
  async applyToLivePipeline(
    userId: string,
    backtestId: string,
  ): Promise<{ applied: boolean; changes: Record<string, any> }> {
    const experience = await BacktestExperience.findOne({
      _id: backtestId,
      userId,
    });

    if (!experience) {
      throw new Error("Backtest experience not found");
    }

    // Get the analysis
    if (!experience.aiLearningSummary) {
      // Run analysis first
      await this.analyzeBacktest(backtestId, userId);
    }

    const snapshot = experience.pipelineConfigSnapshot as any;
    const changes: Record<string, any> = {};

    // Build updated config for pipeline
    const updatedConfig: Partial<PipelineConfig> = {};

    // Copy symbols and timeframe from backtest
    if (snapshot?.symbols) {
      updatedConfig.symbols = snapshot.symbols;
    }
    updatedConfig.timeframe = experience.timeframe as any;

    // Copy entry settings
    if (snapshot?.entrySettings) {
      updatedConfig.entrySettings = {
        ...snapshot.entrySettings,
      };
    }

    // Copy active methodologies and weights
    if (snapshot?.activeMethodologies) {
      updatedConfig.activeMethodologies = snapshot.activeMethodologies;
      changes.activeMethodologies = snapshot.activeMethodologies;
    }
    if (snapshot?.methodologyWeights) {
      updatedConfig.methodologyWeights = snapshot.methodologyWeights;
      changes.methodologyWeights = snapshot.methodologyWeights;
    }

    // Copy risk settings
    if (snapshot?.maxRiskPerTrade) {
      updatedConfig.maxRiskPerTrade = snapshot.maxRiskPerTrade;
      changes.maxRiskPerTrade = snapshot.maxRiskPerTrade;
    }
    if (snapshot?.maxOpenPositions) {
      updatedConfig.maxOpenPositions = snapshot.maxOpenPositions;
    }

    // Apply AI recommended changes
    if (experience.aiLearningSummary?.recommendedAdjustments) {
      const adj = experience.aiLearningSummary.recommendedAdjustments;

      if (adj.entrySettings) {
        updatedConfig.entrySettings = {
          ...updatedConfig.entrySettings,
          ...adj.entrySettings,
        };
        changes.entrySettings = adj.entrySettings;
      }

      if (adj.maxRiskPerTrade) {
        updatedConfig.maxRiskPerTrade = adj.maxRiskPerTrade;
        changes.maxRiskPerTrade = adj.maxRiskPerTrade;
      }
    }

    // Copy trailing stop config
    if (snapshot?.trailingStop) {
      updatedConfig.trailingStop = { ...snapshot.trailingStop };
    }

    // Apply to pipeline
    await tradingPipelineService.updateConfig(userId, updatedConfig);

    silentLogger.info(
      `[AI-LEARN] Applied backtest ${backtestId} to pipeline for user ${userId}: ${JSON.stringify(changes)}`,
    );

    return {
      applied: true,
      changes,
    };
  }

  /**
   * Get aggregated insights for a symbol across all backtests.
   */
  async getSymbolInsights(
    userId: string,
    symbol: string,
    timeframe?: string,
  ): Promise<SymbolInsights | null> {
    const filter: any = { userId, symbol };
    if (timeframe) filter.timeframe = timeframe;

    const experiences = await BacktestExperience.find(filter).sort({
      createdAt: -1,
    });

    if (experiences.length === 0) return null;

    // Find best results
    let bestWinRate = 0;
    let bestProfitFactor = 0;
    let totalReturn = 0;

    for (const exp of experiences) {
      if (exp.result.winRate > bestWinRate) bestWinRate = exp.result.winRate;
      if (exp.result.profitFactor > bestProfitFactor)
        bestProfitFactor = exp.result.profitFactor;
      totalReturn += exp.result.totalPnLPercent;
    }

    const averageReturn =
      experiences.length > 0
        ? Math.round((totalReturn / experiences.length) * 100) / 100
        : 0;

    // Collect all recommendations
    const recommendations: string[] = [];
    const paramVotes: Record<string, any[]> = {};

    for (const exp of experiences) {
      if (exp.aiLearningSummary?.recommendedAdjustments) {
        const adj = exp.aiLearningSummary.recommendedAdjustments;
        for (const [key, value] of Object.entries(adj)) {
          if (!paramVotes[key]) paramVotes[key] = [];
          paramVotes[key].push(value);
        }
      }
      if (exp.aiLearningSummary?.weaknesses) {
        recommendations.push(...exp.aiLearningSummary.weaknesses);
      }
    }

    // Most common recommendations (top 3)
    const topRecommendations = [...new Set(recommendations)].slice(0, 3);

    return {
      symbol,
      timeframe: timeframe || "all",
      bestWinRate,
      bestProfitFactor,
      averageReturn,
      totalBacktests: experiences.length,
      recommendations: topRecommendations,
      recommendedParams: {},
    };
  }

  /**
   * Run parameter optimization — test many parameter combinations
   * automatically and return the best set.
   *
   * This is the "AI determines preset" function: given a symbol &
   * date range, it tries dozens of strategy variants and presents
   * the best one as an Expert-Advisor-style preset.
   */
  async optimize(
    userId: string,
    config: OptimizationConfig,
  ): Promise<OptimizationResult> {
    silentLogger.info(
      `[OPTIMIZE] Starting optimization for ${config.symbol} ${config.timeframe} (metric=${config.optimizationMetric}, max=${config.maxCombinations})`,
    );

    // ── 1. Define parameter search space ────────────────────────────
    const ranges: ParamRange[] = [
      // RSI thresholds
      {
        name: "RSI Oversold",
        path: "entrySettings.rsiOversold",
        values: [20, 25, 30, 35, 40],
      },
      {
        name: "RSI Overbought",
        path: "entrySettings.rsiOverbought",
        values: [60, 65, 70, 75, 80],
      },
      // ATR multipliers
      {
        name: "SL Multiplier (ATR)",
        path: "entrySettings.atrMultiplierSL",
        values: [1.0, 1.5, 2.0, 2.5],
      },
      {
        name: "TP Multiplier (ATR)",
        path: "entrySettings.atrMultiplierTP",
        values: [1.0, 1.5, 2.0, 3.0],
      },
      // Trailing stop
      {
        name: "Trailing Activation (ATR)",
        path: "trailingStop.activationATR",
        values: [0.5, 1.0, 1.5],
      },
      {
        name: "Trail Distance (ATR)",
        path: "trailingStop.trailATR",
        values: [0.3, 0.5, 1.0],
      },
      // Risk
      {
        name: "Risk per trade",
        path: "maxRiskPerTrade",
        values: [0.5, 1.0, 1.5, 2.0],
      },
      {
        name: "Max Symbol Positions",
        path: "maxOpenPositions",
        values: [1, 2, 3],
      },
    ];

    // ── 2. Build all parameter combos, then sample randomly ──────
    let allCombos = buildParamCombinations(ranges);
    silentLogger.info(`[OPTIMIZE] Total possible combos: ${allCombos.length}`);

    // Shuffle and take maxCombinations
    const shuffled = [...allCombos].sort(() => Math.random() - 0.5);
    const combos = shuffled.slice(0, config.maxCombinations);

    // ── 3. Run backtest for each combo ─────────────────────────────
    const results: Array<{
      params: Record<string, any>;
      metrics: Record<string, number>;
      grade: string;
    }> = [];

    for (let i = 0; i < combos.length; i++) {
      const params = combos[i];
      try {
        const btResult = await backtestService.runBacktest(userId, {
          symbols: [config.symbol],
          timeframe: config.timeframe as any,
          fromDate: new Date(config.fromDate),
          toDate: new Date(config.toDate),
          initialBalance: config.initialBalance,
          entrySettings: {
            rsiOversold: params.entrySettings?.rsiOversold ?? 30,
            rsiOverbought: params.entrySettings?.rsiOverbought ?? 70,
            atrMultiplierSL: params.entrySettings?.atrMultiplierSL ?? 1.5,
            atrMultiplierTP: params.entrySettings?.atrMultiplierTP ?? 1.5,
          },
          trailingStop: {
            enabled: true,
            activationATR: params.trailingStop?.activationATR ?? 1.0,
            trailATR: params.trailingStop?.trailATR ?? 0.5,
            breakEven: false,
          },
          maxRiskPerTrade: params.maxRiskPerTrade ?? 1.0,
          maxOpenPositions: params.maxOpenPositions ?? 3,
        });

        const grade = this.calcGrade(btResult);
        results.push({
          params,
          metrics: {
            totalTrades: btResult.totalTrades,
            winRate: btResult.winRate,
            totalPnLPercent: btResult.totalPnLPercent,
            profitFactor:
              btResult.profitFactor === Infinity
                ? 99
                : btResult.profitFactor,
            maxDrawdownPercent: btResult.maxDrawdownPercent,
            sharpeRatio: btResult.sharpeRatio,
          },
          grade,
        });

        silentLogger.info(
          `[OPTIMIZE] ${i + 1}/${combos.length}: ` +
            `RSI=${params.entrySettings?.rsiOversold ?? 30}/${params.entrySettings?.rsiOverbought ?? 70} ` +
            `→ ${btResult.totalTrades} trades, ${btResult.winRate}% WR, ${btResult.totalPnLPercent}% R`,
        );
      } catch (error: any) {
        silentLogger.warn(
          `[OPTIMIZE] Combo ${i + 1} failed: ${error.message}`,
        );
      }
    }

    // ── 4. Score and rank results ────────────────────────────────
    const scored = results.map((r) => {
      let score = 0;
      const m = r.metrics;

      // Normalize each metric to 0-100 and weight
      const metricScores: Record<string, number> = {
        totalTrades: Math.min(m.totalTrades / 50, 1) * 10,
        winRate: (m.winRate / 100) * 25,
        totalPnLPercent:
          Math.max(0, Math.min(m.totalPnLPercent / 100, 1)) * 20,
        profitFactor: Math.min(m.profitFactor / 3, 1) * 25,
        maxDrawdownPenalty:
          Math.max(0, 1 - m.maxDrawdownPercent / 30) * 10,
        sharpeRatio: Math.min(m.sharpeRatio / 2, 1) * 10,
      };

      score = Object.values(metricScores).reduce((a, b) => a + b, 0);

      return { ...r, score };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // ── 5. Extract best result ──────────────────────────────────
    const best = scored[0];
    if (!best) {
      throw new Error("No valid optimization results — try a wider date range");
    }

    // Also grade the best explicitly
    const bestGrade = this.calcGradeFromMetrics(best.metrics);

    silentLogger.info(
      `[OPTIMIZE] Best result: score=${best.score.toFixed(1)}, ` +
        `${best.metrics.totalTrades} trades, ${best.metrics.winRate}% WR, ` +
        `${best.metrics.totalPnLPercent}% return, PF=${best.metrics.profitFactor}`,
    );

    return {
      config,
      totalCombinationsTested: results.length,
      bestParams: {
        entrySettings: {
          rsiOversold: best.params.entrySettings?.rsiOversold ?? 30,
          rsiOverbought: best.params.entrySettings?.rsiOverbought ?? 70,
          atrMultiplierSL: best.params.entrySettings?.atrMultiplierSL ?? 1.5,
          atrMultiplierTP: best.params.entrySettings?.atrMultiplierTP ?? 1.5,
        },
        trailingStop: {
          enabled: true,
          activationATR: best.params.trailingStop?.activationATR ?? 1.0,
          trailATR: best.params.trailingStop?.trailATR ?? 0.5,
        },
        maxRiskPerTrade: best.params.maxRiskPerTrade ?? 1.0,
        maxOpenPositions: best.params.maxOpenPositions ?? 3,
      },
      bestResult: {
        totalTrades: best.metrics.totalTrades,
        winRate: Math.round(best.metrics.winRate * 100) / 100,
        totalPnLPercent: Math.round(best.metrics.totalPnLPercent * 100) / 100,
        profitFactor: Math.round(best.metrics.profitFactor * 100) / 100,
        maxDrawdownPercent:
          Math.round(best.metrics.maxDrawdownPercent * 100) / 100,
        sharpeRatio: Math.round(best.metrics.sharpeRatio * 100) / 100,
      },
      allResults: scored.slice(0, 20).map((r) => ({
        params: r.params,
        metrics: r.metrics,
        grade: r.grade,
      })),
    };
  }

  // ─── Private ─────────────────────────────────────────────────────

  private calcGrade(result: any): string {
    let score = 0;
    if (result.winRate >= 60) score += 2;
    else if (result.winRate >= 45) score += 1;
    if (result.profitFactor >= 2) score += 2;
    else if (result.profitFactor >= 1.5) score += 1;
    if (result.maxDrawdownPercent <= 5) score += 2;
    else if (result.maxDrawdownPercent <= 15) score += 1;
    if (result.sharpeRatio >= 1.5) score += 2;
    else if (result.sharpeRatio >= 0.5) score += 1;
    if (result.totalTrades >= 20) score += 1;
    if (score >= 8) return "A";
    if (score >= 6) return "B";
    if (score >= 4) return "C";
    if (score >= 2) return "D";
    return "F";
  }

  private calcGradeFromMetrics(m: Record<string, number>): string {
    let score = 0;
    if (m.winRate >= 60) score += 2;
    else if (m.winRate >= 45) score += 1;
    if (m.profitFactor >= 2) score += 2;
    else if (m.profitFactor >= 1.5) score += 1;
    if (m.maxDrawdownPercent <= 5) score += 2;
    else if (m.maxDrawdownPercent <= 15) score += 1;
    if (m.sharpeRatio >= 1.5) score += 2;
    else if (m.sharpeRatio >= 0.5) score += 1;
    if (m.totalTrades >= 20) score += 1;
    if (score >= 8) return "A";
    if (score >= 6) return "B";
    if (score >= 4) return "C";
    if (score >= 2) return "D";
    return "F";
  }

  private generateSummary(
    result: any,
    grade: string,
  ): string {
    const gradeDescriptions: Record<string, string> = {
      A: "Excellent strategy performance",
      B: "Good strategy with some room for improvement",
      C: "Average performance — consider parameter optimization",
      D: "Below average — significant parameter adjustments recommended",
      F: "Poor performance — strategy needs fundamental review",
    };

    return (
      `Grade ${grade}: ${gradeDescriptions[grade]}. ` +
      `${result.totalTrades} trades with ${result.winRate}% win rate, ` +
      `${result.profitFactor} profit factor, ${result.maxDrawdownPercent}% max drawdown, ` +
      `and ${result.totalPnLPercent}% total return over the test period.`
    );
  }
}

export const aiLearningService = new AILearningService();
