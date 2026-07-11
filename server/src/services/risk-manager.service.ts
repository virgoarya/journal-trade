import { TradingAccount } from "../models/TradingAccount";
import { AITradeLog } from "../models/AITradeLog";
import { type TradingSignal } from "./ai-trading-engine.service";
import { mt5McpService } from "./mt5-mcp.service";

// ─── Types ───────────────────────────────────────────────────────────

export interface RiskCheck {
  allowed: boolean;
  reason?: string;
  warnings: string[];
}

export interface RiskMetrics {
  dailyPnL: number;
  dailyDrawdown: number;
  maxDrawdown: number;
  openRisk: number;
  marginLevel: number;
  marginUsed: number;
  openPositions: number;
}

// ─── Service ─────────────────────────────────────────────────────────

class RiskManagerService {
  /**
   * Pre-trade risk check before executing a signal.
   */
  async checkTradeAllowed(
    userId: string,
    signal: TradingSignal,
    pipelineConfig: {
      maxOpenPositions: number;
      maxDailyRisk: number;
      maxRiskPerTrade: number;
    },
  ): Promise<RiskCheck> {
    const warnings: string[] = [];

    try {
      // ── 1. Get account info ──────────────────────────────────────────
      const accountInfo = await mt5McpService.getAccountInfo();
      const positions = await mt5McpService.getPositions();

      // ── 2. Check margin level ────────────────────────────────────────
      if (accountInfo.marginLevel > 0 && accountInfo.marginLevel < 150) {
        return {
          allowed: false,
          reason: `Margin level too low: ${accountInfo.marginLevel.toFixed(2)}% (minimum 150%)`,
          warnings,
        };
      }

      // ── 3. Check max open positions ──────────────────────────────────
      if (positions.length >= pipelineConfig.maxOpenPositions) {
        return {
          allowed: false,
          reason: `Max open positions reached: ${positions.length}/${pipelineConfig.maxOpenPositions}`,
          warnings,
        };
      }

      // ── 4. Check duplicate symbol ────────────────────────────────────
      const hasDuplicate = positions.some(
        (p) => p.symbol === signal.symbol,
      );
      if (hasDuplicate) {
        warnings.push(
          `Already have an open position on ${signal.symbol}`,
        );
      }

      // ── 5. Check daily PnL and risk limit ────────────────────────────
      const todayMetrics = await this.getDailyMetrics(userId);
      if (todayMetrics) {
        const dailyMaxLoss = accountInfo.balance * (pipelineConfig.maxDailyRisk / 100);
        if (todayMetrics.dailyPnL <= -dailyMaxLoss) {
          return {
            allowed: false,
            reason: `Daily loss limit reached: ${todayMetrics.dailyPnL.toFixed(2)} (max: -${dailyMaxLoss.toFixed(2)})`,
            warnings,
          };
        }

        // Warning if approaching limit
        if (todayMetrics.dailyPnL <= -dailyMaxLoss * 0.8) {
          warnings.push(
            `Approaching daily loss limit: ${todayMetrics.dailyPnL.toFixed(2)} / -${dailyMaxLoss.toFixed(2)}`,
          );
        }
      }

      // ── 6. Check per-trade risk ──────────────────────────────────────
      const tradeRisk = Math.abs(signal.entry - signal.sl);
      const riskPercent = (tradeRisk / accountInfo.balance) * 100;
      if (riskPercent > pipelineConfig.maxRiskPerTrade) {
        return {
          allowed: false,
          reason: `Trade risk ${riskPercent.toFixed(2)}% exceeds max ${pipelineConfig.maxRiskPerTrade}%`,
          warnings,
        };
      }

      return { allowed: true, warnings };
    } catch (error: any) {
      return {
        allowed: false,
        reason: `Risk check error: ${error.message}`,
        warnings,
      };
    }
  }

  /**
   * Correlation Risk Check — ensures no more than max positions per currency group.
   * Prevents over-exposure to a single currency (e.g. 3x short USD via EURUSD + GBPUSD + AUDUSD).
   */
  async checkCorrelationRisk(
    symbol: string,
    maxPositionsPerBase = 2,
    maxPositionsPerQuote = 3,
  ): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const positions = await mt5McpService.getPositions();
      const base = symbol.substring(0, 3);
      const quote = symbol.substring(3, 6);

      let baseCount = 0;
      let quoteCount = 0;

      for (const pos of positions) {
        const posBase = pos.symbol.substring(0, 3);
        const posQuote = pos.symbol.substring(3, 6);
        if (posBase === base || posQuote === base) baseCount++;
        if (posBase === quote || posQuote === quote) quoteCount++;
      }

      if (baseCount >= maxPositionsPerBase) {
        return { allowed: false, reason: `Max ${maxPositionsPerBase} positions per ${base} (currently ${baseCount})` };
      }
      if (quoteCount >= maxPositionsPerQuote) {
        return { allowed: false, reason: `Max ${maxPositionsPerQuote} positions per ${quote} (currently ${quoteCount})` };
      }

      return { allowed: true };
    } catch (error: any) {
      return { allowed: true }; // fail open — correlation is advisory
    }
  }

  /**
   * Calculate current risk metrics from MT5.
   */
  async calculateRiskMetrics(userId: string): Promise<RiskMetrics> {
    const accountInfo = await mt5McpService.getAccountInfo();
    const positions = await mt5McpService.getPositions();

    // Calculate open risk (sum of distance to SL * lot value)
    let openRisk = 0;
    for (const pos of positions) {
      const slDist = Math.abs(pos.priceOpen - (pos.sl || 0));
      openRisk += slDist * pos.volume;
    }

    // Get daily metrics from DB
    const todayMetrics = await this.getDailyMetrics(userId);

    return {
      dailyPnL: todayMetrics?.dailyPnL ?? accountInfo.profit ?? 0,
      dailyDrawdown: todayMetrics?.dailyDrawdown ?? 0,
      maxDrawdown: 0, // TODO: track from DB
      openRisk,
      marginLevel: accountInfo.marginLevel,
      marginUsed: accountInfo.margin,
      openPositions: positions.length,
    };
  }

  /**
   * Calculate daily PnL from MT5 history + trade log.
   */
  async getDailyMetrics(userId: string): Promise<{
    dailyPnL: number;
    dailyDrawdown: number;
  } | null> {
    try {
      // Get today's timestamp
      const now = new Date();
      const todayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      const todayTs = Math.floor(todayStart.getTime() / 1000);

      // Get today's MT5 deals
      const deals = await mt5McpService.getHistory(todayTs);

      // Total profit from today's closed deals
      let dailyPnL = deals.reduce((sum, d) => sum + d.profit, 0);

      // Add current floating PnL from open positions
      const positions = await mt5McpService.getPositions();
      const floatingPnL = positions.reduce(
        (sum, p) => sum + p.profit,
        0,
      );
      dailyPnL += floatingPnL;

      return {
        dailyPnL,
        dailyDrawdown: dailyPnL < 0 ? Math.abs(dailyPnL) : 0,
      };
    } catch {
      return null;
    }
  }
}

export const riskManagerService = new RiskManagerService();
