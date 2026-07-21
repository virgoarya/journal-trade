import { TradingAccount } from "../models/TradingAccount";
import { AITradeLog } from "../models/AITradeLog";
import { type TradingSignal } from "./ai-trading-engine.service";
import { mt5McpService } from "./mt5-mcp.service";
import { tradeService } from "./trade.service";

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

    // Get daily metrics from DB
    const todayMetrics = await this.getDailyMetrics(userId);

    return {
      dailyPnL: todayMetrics?.dailyPnL ?? accountInfo.profit ?? 0,
      weeklyPnL: todayMetrics?.weeklyPnL ?? 0,
      monthlyPnL: todayMetrics?.monthlyPnL ?? accountInfo.profit ?? 0,
      dailyDrawdown: todayMetrics?.dailyDrawdown ?? 0,
      maxDrawdown: 0, // TODO: track from DB
      openRisk,
      marginLevel: accountInfo.marginLevel,
      marginUsed: accountInfo.margin,
      openPositions: positions.length,
      winRate: todayMetrics?.winRate ?? 0,
    };
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
      // Get today's timestamp
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayTs = Math.floor(todayStart.getTime() / 1000);

      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthTs = Math.floor(monthStart.getTime() / 1000);

      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
      const weekTs = Math.floor(weekStart.getTime() / 1000);

      // Get ALL-TIME MT5 deals to calculate overall winrate accurately
      const deals = await mt5McpService.getHistory(0);

      // Add current floating PnL from open positions
      const positions = await mt5McpService.getPositions();
      const floatingPnL = positions.reduce((sum, p) => sum + p.profit, 0);

      let dailyPnL = floatingPnL;
      let weeklyPnL = floatingPnL;
      let monthlyPnL = floatingPnL;

      for (const d of deals) {
        if (d.time >= monthTs) monthlyPnL += d.profit;
        if (d.time >= weekTs) weeklyPnL += d.profit;
        if (d.time >= todayTs) dailyPnL += d.profit;
      }

      // Remove the complex Deals winrate loop and use tradeService for Journal accuracy
      let winRate = 0;
      
      const positionPnL: Record<string, { net: number; hasOut: boolean }> = {};
      
      for (const d of deals) {
        if (d.type === "BUY" || d.type === "SELL" || (d as any).type === 0 || (d as any).type === 1) {
          // MT5 Deal objects might have position_id. If missing, we can't reliably group them.
          // BUT wait! "order" is usually the same as position_id for the first entry. 
          // However, MT5 history_deals_get in python returns `position_id`. Let's use it.
          const posId = (d as any).position_id || d.ticket; 
          
          if (!positionPnL[posId]) {
            positionPnL[posId] = { net: 0, hasOut: false };
          }
          
          positionPnL[posId].net += d.profit + (d.commission || 0) + (d.swap || 0);

          if (d.entry === 1 || d.entry === 2 || Math.abs(d.profit) > 0.0001) {
            positionPnL[posId].hasOut = true;
          }
        }
      }

      let winCount = 0;
      let totalClosed = 0;

      for (const posId in positionPnL) {
        const pos = positionPnL[posId];
        if (pos.hasOut) {
          totalClosed++;
          if (pos.net > 0) winCount++;
        }
      }

      winRate = totalClosed > 0 ? (winCount / totalClosed) * 100 : 0;

      // Also try to sync with Trade model if possible
      try {
        const accountInfo = await mt5McpService.getAccountInfo();
        const account = await TradingAccount.findOne({
          userId,
        });
        
        if (account) {
          const summary = await tradeService.getSummary(userId, account._id.toString());
          if (summary.totalTrades > 0) {
            winRate = summary.winRate;
          }
        }
      } catch (err) {
        console.error("Failed to fetch winrate from Journal:", err);
      }

      return {
        dailyPnL,
        weeklyPnL,
        dailyDrawdown: dailyPnL < 0 ? Math.abs(dailyPnL) : 0,
        monthlyPnL,
        winRate,
      };
    } catch {
      return null;
    }
  }
}

export const riskManagerService = new RiskManagerService();
