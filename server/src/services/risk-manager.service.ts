import { TradingAccount } from "../models/TradingAccount";
import { AITradeLog } from "../models/AITradeLog";
import { type TradingSignal } from "./ai-trading-engine.service";
import { mt5McpService } from "./mt5-mcp.service";
import { tradeService } from "./trade.service";
import { silentLogger } from "../utils/silent-logger";

// ─── Types ───────────────────────────────────────────────────────────

export interface RiskCheck {
  allowed: boolean;
  reason?: string;
  warnings: string[];
}

export interface RiskMetrics {
  dailyPnL: number;
  weeklyPnL: number;
  monthlyPnL: number;
  dailyDrawdown: number;
  maxDrawdown: number;
  openRisk: number;
  marginLevel: number;
  marginUsed: number;
  openPositions: number;
  winRate: number;
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

      // ── 4. Check duplicate symbol (same direction = reject, opposite = allow hedging) ──
      const sameDirectionDuplicate = positions.some(
        (p) => p.symbol === signal.symbol && p.type === signal.direction,
      );
      if (sameDirectionDuplicate) {
        return {
          allowed: false,
          reason: `Already have a ${signal.direction} position on ${signal.symbol} — concentrated risk`,
          warnings,
        };
      }
      const oppositeDirectionExists = positions.some(
        (p) => p.symbol === signal.symbol && p.type !== signal.direction,
      );
      if (oppositeDirectionExists) {
        warnings.push(
          `Hedging: existing opposite position on ${signal.symbol}`,
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
    try {
      const accountInfo = await mt5McpService.getAccountInfo();
      const positions = await mt5McpService.getPositions();

      // Calculate open risk (sum of distance to SL * lot value * contract size)
      let openRisk = 0;
      const symbolCache: Record<string, any> = {};

      for (const pos of positions) {
        if (!pos.sl || pos.sl === 0) continue;

        if (!symbolCache[pos.symbol]) {
          const info = await mt5McpService.getSymbolInfo(pos.symbol);
          if (info) symbolCache[pos.symbol] = info;
        }
        
        const symInfo = symbolCache[pos.symbol];
        // Smart contract size detection with fallbacks
        let contractSize = symInfo?.tradeContractSize;
        
        if (!contractSize) {
          const s = pos.symbol.toUpperCase();
          if (s.includes("XAU") || s.includes("GOLD")) contractSize = 100;
          else if (s.includes("BTC") || s.includes("CRYPTO")) contractSize = 1;
          else if (s.includes("NAS") || s.includes("USA100") || s.includes("US30") || s.includes("DE40")) contractSize = 10;
          else contractSize = 100000; // default forex
        }

        // Check for risk-free positions (Trailing Stop / Break Even)
        const posType = pos.type as string | number;
        if (posType === "BUY" || posType === 0) {
          if (pos.sl >= pos.priceOpen) continue;
        } else if (posType === "SELL" || posType === 1) {
          if (pos.sl <= pos.priceOpen) continue;
        }

        const slDist = Math.abs(pos.priceOpen - pos.sl);
        openRisk += slDist * pos.volume * contractSize;
      }
      silentLogger.debug(`[RISK] calculateRiskMetrics: openRisk=${openRisk.toFixed(2)}, positions=${positions.length}`);

      // Get daily metrics from DB
      const todayMetrics = await this.getDailyMetrics(userId);

      return {
        dailyPnL: todayMetrics?.dailyPnL ?? accountInfo.profit ?? 0,
        weeklyPnL: todayMetrics?.weeklyPnL ?? 0,
        monthlyPnL: todayMetrics?.monthlyPnL ?? accountInfo.profit ?? 0,
        dailyDrawdown: todayMetrics?.dailyDrawdown ?? 0,
        maxDrawdown: 0, // TODO: track from DB
        openRisk: parseFloat(openRisk.toFixed(2)),
        marginLevel: accountInfo.marginLevel,
        marginUsed: accountInfo.margin,
        openPositions: positions.length,
        winRate: todayMetrics?.winRate ?? 0,
      };
    } catch (err: any) {
      silentLogger.error(`[RISK] calculateRiskMetrics failed: ${err.message}`, err);
      throw err; // Re-throw to let route handler catch
    }
  }

  /**
   * Calculate daily PnL from MT5 history + trade log.
   */
  async getDailyMetrics(userId: string): Promise<{
    dailyPnL: number;
    weeklyPnL: number;
    dailyDrawdown: number;
    monthlyPnL: number;
    winRate: number;
  } | null> {
    try {
      // Get date timestamps
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayTs = Math.floor(todayStart.getTime() / 1000);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthTs = Math.floor(monthStart.getTime() / 1000);
      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
      const weekTs = Math.floor(weekStart.getTime() / 1000);

      // Get deals from MT5 (all-time)
      const deals = await mt5McpService.getHistory(0);
      const positions = await mt5McpService.getPositions();
      const floatingPnL = positions.reduce((sum, p) => sum + p.profit, 0);

      // Calculate PnL from deals only (one pass)
      let dailyPnL = 0;
      let weeklyPnL = 0;
      let monthlyPnL = 0;

      for (const d of deals) {
        const profit = d.profit || 0;
        if (d.time >= todayTs) dailyPnL += profit;
        if (d.time >= weekTs) weeklyPnL += profit;
        if (d.time >= monthTs) monthlyPnL += profit;
      }

      // Add current floating PnL so daily/weekly/monthly includes open positions
      // (a position opened intraday contributes its floating PnL to daily total)
      dailyPnL += floatingPnL;
      weeklyPnL += floatingPnL;
      monthlyPnL += floatingPnL;

      silentLogger.debug(`[RISK] getDailyMetrics: deals=${deals.length}, positions=${positions.length}, floatingPnL=${floatingPnL.toFixed(2)}`);
      silentLogger.debug(`[RISK] Daily=${dailyPnL.toFixed(2)}, Weekly=${weeklyPnL.toFixed(2)}, Monthly=${monthlyPnL.toFixed(2)}`);

      // --- Win Rate from AITradeLog (closed trades with PnL) ---
      let winRate = 0;
      try {
        const account = await TradingAccount.findOne({ userId });
        // First try tradeService
        if (account) {
          const summary = await tradeService.getSummary(userId, account._id.toString());
          if (summary.totalTrades > 0) {
            winRate = summary.winRate;
          }
        }
        // Fallback: query AITradeLog directly
        if (winRate === 0) {
          const closedTrades = await AITradeLog.find({
            userId,
            closed: true,
            pnl: { $exists: true },
          }).lean();
          if (closedTrades.length > 0) {
            const wins = closedTrades.filter(t => (t.pnl ?? 0) > 0).length;
            winRate = (wins / closedTrades.length) * 100;
          }
        }
      } catch (err: any) {
        silentLogger.error("[RISK] WinRate calc error:", err.message);
      }
      silentLogger.debug(`[RISK] Final Win Rate: ${winRate.toFixed(2)}%`);

      return {
        dailyPnL: parseFloat(dailyPnL.toFixed(2)),
        weeklyPnL: parseFloat(weeklyPnL.toFixed(2)),
        dailyDrawdown: dailyPnL < 0 ? Math.abs(parseFloat(dailyPnL.toFixed(2))) : 0,
        monthlyPnL: parseFloat(monthlyPnL.toFixed(2)),
        winRate: parseFloat(winRate.toFixed(2)),
      };
    } catch (err: any) {
      silentLogger.error(`[RISK] getDailyMetrics failed: ${err.message}`, err);
      return null;
    }
  }
}

export const riskManagerService = new RiskManagerService();
