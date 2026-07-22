import { backtestService, type BacktestResult } from "./backtest.service";
import { aiBacktestSkillService } from "./ai-backtest-skill.service";
import { MT5Connection } from "../models/MT5Connection";
import { silentLogger } from "../utils/silent-logger";
import type { MethodologyName } from "./strategies/index";

// ─── Types ───────────────────────────────────────────────────────────

export interface AutoBacktestSummary {
  status: "running" | "complete" | "error";
  totalSymbols: number;
  processedSymbols: number;
  qualifiedSymbols: number;
  results: Array<{
    symbol: string;
    totalTrades: number;
    winRate: number;
    totalPnL: number;
    totalPnLPercent: number;
    profitFactor: number;
    recoveryFactor: number;
    score: number;
    qualified: boolean;
    reason?: string;
  }>;
  topPairs: Array<{ symbol: string; score: number; totalPnL: number }>;
  error?: string;
}

const TRADABLE_SYMBOLS = [
  "EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD",
  "NZDUSD", "EURJPY", "GBPJPY", "XAUUSD", "XAGUSD",
  "BTCUSD",
];

const ALL_METHODOLOGIES: MethodologyName[] = [
  "smc", "ict", "msnr",
];

const DEFAULT_BACKTEST_CONFIG = {
  timeframe: "M15" as const,
  fromDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
  toDate: new Date(),
  initialBalance: 10000,
  entrySettings: {
    rsiOversold: 30,
    rsiOverbought: 70,
    atrMultiplierSL: 1.5,
    atrMultiplierTP: 2.0,
  },
  trailingStop: {
    enabled: true,
    activationATR: 1.0,
    trailATR: 0.5,
    breakEven: false,
  },
  maxRiskPerTrade: 0.5, // ← 0.5% risk
  maxOpenPositions: 1,    // ← no overtrade
  leverage: 100,
  signalInterval: 4,
  spreadPips: 2.0,
  activeMethodologies: ALL_METHODOLOGIES,
};

// ─── Service ─────────────────────────────────────────────────────────

class AutoBacktestService {
  /**
   * Run a full auto-scan across all tradable symbols.
   * Each symbol gets an independent backtest with strict 0.5% risk.
   * Results aggregate into AIBacktestSkill for live pipeline consumption.
   */
  async runFullScan(
    userId: string,
    onProgress?: (summary: AutoBacktestSummary) => void,
  ): Promise<AutoBacktestSummary> {
    const summary: AutoBacktestSummary = {
      status: "running",
      totalSymbols: TRADABLE_SYMBOLS.length,
      processedSymbols: 0,
      qualifiedSymbols: 0,
      results: [],
      topPairs: [],
    };

    const emitProgress = () => {
      if (onProgress) onProgress({ ...summary });
    };

    const fullResults = new Map<string, BacktestResult>();

    try {
      for (const symbol of TRADABLE_SYMBOLS) {
        try {
          const config = {
            ...DEFAULT_BACKTEST_CONFIG,
            symbols: [symbol],
          };

          silentLogger.info(`[AUTO-BT] Scanning ${symbol} with 0.5% risk...`);

          const result = await backtestService.runBacktest(userId, config);

          // Qualification criteria
          let qualified = false;
          let reason = "";
          const score = this.calculateQualificationScore(result);

          if (result.totalTrades < 10) {
            reason = `Too few trades (${result.totalTrades})`;
          } else if (result.totalPnLPercent <= 0) {
            reason = `Negative return (${result.totalPnLPercent.toFixed(2)}%)`;
          } else if (result.maxDrawdownPercent > 40) {
            reason = `Excessive drawdown (${result.maxDrawdownPercent.toFixed(1)}%)`;
          } else if (result.winRate < 30) {
            reason = `Low win rate (${result.winRate.toFixed(1)}%)`;
          } else {
            qualified = true;
            reason = `Qualified with score ${score}`;
          }

          summary.results.push({
            symbol,
            totalTrades: result.totalTrades,
            winRate: Math.round(result.winRate * 100) / 100,
            totalPnL: Math.round(result.totalPnL * 100) / 100,
            totalPnLPercent: Math.round(result.totalPnLPercent * 100) / 100,
            profitFactor: result.profitFactor === Infinity ? 999 : result.profitFactor,
            recoveryFactor: result.recoveryFactor === Infinity ? 999 : result.recoveryFactor,
            score,
            qualified,
            reason,
          });

          if (qualified) {
            summary.qualifiedSymbols++;
            fullResults.set(symbol, result);
          }
        } catch (err: any) {
          silentLogger.error(`[AUTO-BT] Error scanning ${symbol}: ${err.message}`);
          summary.results.push({
            symbol,
            totalTrades: 0,
            winRate: 0,
            totalPnL: 0,
            totalPnLPercent: 0,
            profitFactor: 0,
            recoveryFactor: 0,
            score: 0,
            qualified: false,
            reason: `Error: ${err.message}`,
          });
        }

        summary.processedSymbols++;

        // Emit progress after each symbol
        if (summary.processedSymbols % 3 === 0 || summary.processedSymbols === summary.totalSymbols) {
          emitProgress();
        }
      }

      // Sort qualified symbols by score descending for top pairs
      const qualified = summary.results
        .filter((r) => r.qualified)
        .sort((a, b) => b.score - a.score);

      summary.topPairs = qualified.slice(0, 5).map((r) => ({
        symbol: r.symbol,
        score: r.score,
        totalPnL: r.totalPnL,
      }));

      summary.status = "complete";

      // Final skill aggregation with FULL backtest results (includes methodologyStats)
      for (const [symbol, fullResult] of fullResults.entries()) {
        if (fullResult.methodologyStats && fullResult.methodologyStats.length > 0) {
          try {
            const conn = await MT5Connection.findOne({ userId }).lean();
            const server = conn?.server || "unknown";
            await aiBacktestSkillService.updateSkill(userId, fullResult, server);
          } catch (err: any) {
            silentLogger.error(`[AUTO-BT] Skill update error for ${symbol}: ${err.message}`);
          }
        }
      }

      emitProgress();
      silentLogger.info(`[AUTO-BT] Scan complete: ${summary.qualifiedSymbols}/${summary.totalSymbols} symbols qualified`);
    } catch (err: any) {
      summary.status = "error";
      summary.error = err.message;
      emitProgress();
    }

    return summary;
  }

  /**
   * Calculate qualification score (0-100) for a backtest result.
   */
  private calculateQualificationScore(result: BacktestResult): number {
    if (result.totalTrades === 0) return 0;

    const winRateScore = Math.min(40, (result.winRate / 100) * 40);
    const pfScore = Math.min(25, (result.profitFactor || 0) * 10);
    const rfScore = result.recoveryFactor === Infinity
      ? 20
      : Math.min(20, (result.recoveryFactor || 0) * 5);
    const ddPenalty = Math.max(0, 15 - (result.maxDrawdownPercent || 0) * 0.5);
    const tradesBonus = Math.min(10, result.totalTrades * 0.5);

    return Math.round(winRateScore + pfScore + rfScore + ddPenalty + tradesBonus);
  }
}

export const autoBacktestService = new AutoBacktestService();
