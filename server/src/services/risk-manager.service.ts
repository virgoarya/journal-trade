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
  circuitBreaker?: boolean;
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
      smartRisk?: any;
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

      // ── 3. Check total open risk capacity (Dynamic Risk Capacity) ──────
      let totalOpenRiskPercent = 0;
      for (const pos of positions) {
        if (pos.sl && pos.sl > 0 && pos.priceOpen > 0) {
          const slPriceDiff = Math.abs(pos.priceOpen - pos.sl);
          // Estimate risk in currency
          const posRiskUsd = slPriceDiff * pos.volume * 100000;
          const posRiskPct = accountInfo.balance > 0 ? (posRiskUsd / accountInfo.balance) * 100 : 0.5;
          totalOpenRiskPercent += Math.min(posRiskPct, pipelineConfig.maxRiskPerTrade);
        } else {
          totalOpenRiskPercent += pipelineConfig.maxRiskPerTrade;
        }
      }

      const totalRiskCapacity = Math.max(pipelineConfig.maxDailyRisk, pipelineConfig.maxOpenPositions * pipelineConfig.maxRiskPerTrade);
      if (totalOpenRiskPercent + pipelineConfig.maxRiskPerTrade > totalRiskCapacity && positions.length >= pipelineConfig.maxOpenPositions) {
        return {
          allowed: false,
          reason: `Max risk capacity reached: Total open risk ${totalOpenRiskPercent.toFixed(2)}% + new trade ${pipelineConfig.maxRiskPerTrade}% exceeds limit ${totalRiskCapacity.toFixed(2)}%`,
          warnings,
        };
      }

      // ── 4. Check duplicate symbol (strictly ONE position per symbol) ──
      const symbolDuplicate = positions.some(
        (p) => p.symbol === signal.symbol,
      );
      if (symbolDuplicate) {
        return {
          allowed: false,
          reason: `Already have an open position on ${signal.symbol}. Strict 1 trade per symbol policy prevents hedging or overexposure.`,
          warnings,
        };
      }

      // ── 5. Check daily PnL and risk limit ────────────────────────────
      const todayMetrics = await this.getDailyMetrics(userId);
      if (todayMetrics) {
        const dailyMaxLoss = accountInfo.balance * (pipelineConfig.maxDailyRisk / 100);
        if (todayMetrics.dailyPnL <= -dailyMaxLoss) {
          // ── Trade Attribution: who caused the loss? ──────────────────
          const attribution = await this.getDailyPnLAttribution(userId);
          const aiLoss = attribution.aiPnL < 0 ? attribution.aiPnL.toFixed(2) : `+${attribution.aiPnL.toFixed(2)}`;
          const manualLoss = attribution.manualPnL < 0 ? attribution.manualPnL.toFixed(2) : `+${attribution.manualPnL.toFixed(2)}`;
          const reason = `Daily loss limit reached: ${todayMetrics.dailyPnL.toFixed(2)} / -${dailyMaxLoss.toFixed(2)} | AI: $${aiLoss} | Manual Trade: $${manualLoss}`;
          return {
            allowed: false,
            reason,
            warnings,
            circuitBreaker: true,
          };
        }

        // Warning if approaching limit
        if (todayMetrics.dailyPnL <= -dailyMaxLoss * 0.8) {
          warnings.push(
            `Approaching daily loss limit: ${todayMetrics.dailyPnL.toFixed(2)} / -${dailyMaxLoss.toFixed(2)}`,
          );
        }
      }

      // ── 6. Check Global Max Drawdown Limit ───────────────────────────
      const globalDrawdownPct = accountInfo.balance > 0 
        ? ((accountInfo.balance - accountInfo.equity) / accountInfo.balance) * 100 
        : 0;
      
      const smartRisk: any = (pipelineConfig as any).smartRisk; // Cast to access smartRisk
      if (smartRisk?.globalDrawdownLimit?.enabled && smartRisk.globalDrawdownLimit.maxDrawdownPct > 0) {
        if (globalDrawdownPct >= smartRisk.globalDrawdownLimit.maxDrawdownPct) {
          return {
            allowed: false,
            reason: `Global Max Drawdown limit reached: ${globalDrawdownPct.toFixed(2)}% (Limit: ${smartRisk.globalDrawdownLimit.maxDrawdownPct}%)`,
            warnings,
            circuitBreaker: true,
          };
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

      // AI-only PnL: filter by comment prefix "ai-" so manual trades don't inflate AI circuit breaker
      const isAiComment = (c?: string) => { const s = (c || "").toLowerCase(); return s.startsWith("ai-"); };
      let floatingPnL = 0;
      for (const pos of positions) {
        if (isAiComment(pos.comment)) floatingPnL += pos.profit;
      }

      // Calculate PnL from AI deals only (one pass)
      let dailyPnL = 0;
      let weeklyPnL = 0;
      let monthlyPnL = 0;

      for (const d of deals) {
        // Skip balance operations (deposits, withdrawals, etc)
        if (d.type !== "BUY" && d.type !== "SELL") continue;

        // AI-only attribution: skip manual deals so AI circuit breaker only trips on AI losses
        if (!isAiComment(d.comment)) continue;

        // Also add swap and commission to profit to get accurate net PnL for the deal
        const netProfit = (d.profit || 0) + (d.swap || 0) + (d.commission || 0);

        if (d.time >= todayTs) dailyPnL += netProfit;
        if (d.time >= weekTs) weeklyPnL += netProfit;
        if (d.time >= monthTs) monthlyPnL += netProfit;
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
  /**
   * Attribute daily PnL to AI trades vs manual trades.
   * AI trades have a comment starting with "AI-" in MT5.
   * Uses position_id to attribute closed deals: if ANY deal with the same
   * position_id is AI (comment "ai-"), all PnL for that position counts as AI.
   */
  async getDailyPnLAttribution(userId: string): Promise<{ aiPnL: number; manualPnL: number }> {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayTs = Math.floor(todayStart.getTime() / 1000);

      const deals = await mt5McpService.getHistory(0);
      const positions = await mt5McpService.getPositions();

      const isAiComment = (c?: string) => (c || "").toLowerCase().startsWith("ai-");

      // Build set of AI position_ids from deals (entry deals have comment)
      const aiPositionIds = new Set<number>();
      for (const d of deals) {
        if (isAiComment(d.comment) && d.position_id) {
          aiPositionIds.add(d.position_id);
        }
      }
      // Also add current open positions comment
      const openAiPositionIds = new Set<number>();
      for (const pos of positions) {
        if (isAiComment(pos.comment)) {
          openAiPositionIds.add(pos.ticket ?? pos.position_id ?? 0);
        }
      }

      let aiPnL = 0;
      let manualPnL = 0;

      // Deal PnL: attribute by position_id
      for (const d of deals) {
        if (d.type !== "BUY" && d.type !== "SELL") continue;
        if (d.time < todayTs) continue;

        const netProfit = (d.profit || 0) + (d.swap || 0) + (d.commission || 0);
        const isAi = isAiComment(d.comment) || aiPositionIds.has(d.position_id || 0);
        if (isAi) {
          aiPnL += netProfit;
        } else {
          manualPnL += netProfit;
        }
      }

      // Floating PnL: attribute by position comment
      for (const pos of positions) {
        const isAi = isAiComment(pos.comment) || openAiPositionIds.has(pos.ticket ?? pos.position_id ?? 0);
        if (isAi) {
          aiPnL += pos.profit;
        } else {
          manualPnL += pos.profit;
        }
      }

      return {
        aiPnL: parseFloat(aiPnL.toFixed(2)),
        manualPnL: parseFloat(manualPnL.toFixed(2)),
      };
    } catch {
      return { aiPnL: 0, manualPnL: 0 };
    }
  }
}

export const riskManagerService = new RiskManagerService();
