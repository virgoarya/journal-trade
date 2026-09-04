import mongoose from "mongoose";
import { Trade } from "../models/Trade";
import { TradingAccount } from "../models/TradingAccount";
import { Notification } from "../models/Notification";
import { AiReview } from "../models/AiReview";
import { z } from "zod";
import { logTradeSchema, getTradesQuerySchema } from "../validators/trade.validator";
import { calculateRMultiple, calculateRiskAmount } from "../utils/calculations";
import { DailySnapshot } from "../models/DailySnapshot";

// Helper function to determine contract size based on trading pair and size type
// Uses CME/COMEX standard multipliers per research (micro = 1/10, mini = 1/2)
function getContractSize(pair: string, sizeType: "standard" | "micro" | "mini" = "standard"): number {
  const normalizedPair = pair.toUpperCase();

  // CME Index Futures (multipliers in USD per index point)
  if (normalizedPair.includes("ES") || normalizedPair.includes("SPX") || normalizedPair.includes("SP500")) {
    // Standard ES = $50, Mini ES = $25 (often E-mini), Micro MES = $5
    if (sizeType === "micro") return 5;
    if (sizeType === "mini") return 25;
    return 50;
  }
  if (normalizedPair.includes("NQ") || normalizedPair.includes("NAS100")) {
    // Standard NQ = $20, Mini = $10, Micro MNQ = $2
    if (sizeType === "micro") return 2;
    if (sizeType === "mini") return 10;
    return 20;
  }
  if (normalizedPair.includes("YM") || normalizedPair.includes("US30") || normalizedPair.includes("DOW")) {
    // Standard YM = $5, Mini = $2.5, Micro MYM = $0.50
    if (sizeType === "micro") return 0.5;
    if (sizeType === "mini") return 2.5;
    return 5;
  }
  if (normalizedPair.includes("RTY") || normalizedPair.includes("RUSSELL")) {
    // Standard RTY = $50, Micro M2K = $5
    if (sizeType === "micro") return 5;
    if (sizeType === "mini") return 25;
    return 50;
  }

  // COMEX Precious Metals
  if (normalizedPair.includes("GC") || normalizedPair.includes("GOLD") || normalizedPair.includes("XAU")) {
    // Standard GC = 100 oz, E-mini QO = 50 oz, Micro MGC = 10 oz
    if (sizeType === "micro") return 10;
    if (sizeType === "mini") return 50;
    return 100;
  }
  if (normalizedPair.includes("SI") || normalizedPair.includes("SILVER") || normalizedPair.includes("XAG")) {
    // Standard SI = 5000 oz, E-mini QI = 2500 oz, Micro SIL = 1000 oz
    if (sizeType === "micro") return 1000;
    if (sizeType === "mini") return 2500;
    return 5000;
  }
  if (normalizedPair.includes("HG") || normalizedPair.includes("COPPER")) {
    // Standard HG = 25000 lbs, Micro MHG = 2500 lbs
    if (sizeType === "micro") return 2500;
    if (sizeType === "mini") return 12500;
    return 25000;
  }

  // NYMEX Energy
  if (normalizedPair.includes("CL") || normalizedPair.includes("WTI") || normalizedPair.includes("CRUDE")) {
    // Standard CL = 1000 bbl, E-mini QM = 500 bbl, Micro MCL = 100 bbl
    if (sizeType === "micro") return 100;
    if (sizeType === "mini") return 500;
    return 1000;
  }

  // Forex CFDs (fallback for non-futures)
  // Standard lot = 100,000 units
  if (sizeType === "micro") return 1000;  // Micro lot = 1,000 units
  if (sizeType === "mini") return 10000;  // Mini lot = 10,000 units
  return 100000;
}

// Helper function to calculate risk metrics
function calculateRiskMetrics(
  entryPrice: number,
  stopLoss: number,
  lotSize: number,
  pair: string,
  accountEquity: number,
  actualPnl?: number,
  sizeType: "standard" | "micro" | "mini" = "standard"
): { riskPercent?: number; rMultiple?: number } {
  const riskPoints = Math.abs(entryPrice - stopLoss);

  if (riskPoints <= 0 || accountEquity <= 0) {
    return {
      riskPercent: undefined,
      rMultiple: actualPnl !== undefined ? 0 : undefined,
    };
  }

  const contractSize = getContractSize(pair, sizeType);
  const riskAmount = riskPoints * lotSize * contractSize;
  const riskPercent = (riskAmount / accountEquity) * 100;

  let rMultiple: number | undefined;
  if (actualPnl !== undefined && riskAmount > 0) {
    rMultiple = parseFloat((actualPnl / riskAmount).toFixed(2));
  }

  return { riskPercent, rMultiple };
}

export const tradeService = {

  async create(userId: string, data: z.infer<typeof logTradeSchema>) {
    try {
      // Resolve trading account: use provided ID, or find/create default
      let account;
      if (data.tradingAccountId) {
        account = await TradingAccount.findOne({ _id: data.tradingAccountId, userId });
      }

      if (!account) {
        // Try to find any active account
        account = await TradingAccount.findOne({ userId, isActive: true }) ||
                  await TradingAccount.findOne({ userId });
        if (!account) {
          // Create a default account for user
          account = await TradingAccount.create({
            userId,
            accountName: "Main Account",
            initialBalance: 0,
            currentEquity: 0,
            highWaterMark: 0,
            isActive: true,
            currency: "USD",
            broker: "Default",
            onboardingCompleted: true
          });
        }
      }

      // Calculate risk metrics using helper function
                        const riskMetrics = calculateRiskMetrics(
                          data.entryPrice,
                          data.stopLoss,
                          data.lotSize,
                          data.pair,
                          account.currentEquity,
                          data.actualPnl,
                          data.sizeType ?? "standard"
                        );

                  // Calculate planned R-multiple if takeProfit is provided
                  let plannedRMultiple: number | undefined;
                  if (data.takeProfit) {
                    const riskPoints = Math.abs(data.entryPrice - data.stopLoss);
                    const rewardPoints = Math.abs(data.takeProfit - data.entryPrice);
                    if (riskPoints > 0) {
                      plannedRMultiple = parseFloat((rewardPoints / riskPoints).toFixed(2));
                    }
                  }

                  const riskPercent = riskMetrics.riskPercent ?? null;
                  // Use calculated rMultiple if not provided manually, otherwise use provided value
                  const rMult = data.rMultiple !== undefined ? data.rMultiple : riskMetrics.rMultiple ?? 0;

      const newTrade = await Trade.create({
        userId,
        tradingAccountId: account._id,
        playbookId: data.playbookId ?? null,
        tradeDate: new Date(data.tradeDate),
        pair: data.pair,
        direction: data.direction.toUpperCase() as "LONG" | "SHORT",
        entryPrice: data.entryPrice,
        stopLoss: data.stopLoss,
        takeProfit: data.takeProfit,
        lotSize: data.lotSize,
        actualPnl: data.actualPnl,
        rMultiple: rMult,
                plannedRMultiple: plannedRMultiple,
                result: data.result.toUpperCase() as "WIN" | "LOSS" | "BREAKEVEN",
        emotionalState: data.emotionalState,
        notes: data.notes,
        chartLink: data.chartLink,
        session: data.session ?? null,
        marketCondition: data.marketCondition ?? null,
        riskPercent: riskPercent,
      });

      const newEquity = account.currentEquity + data.actualPnl;
      const newHwm = Math.max(account.highWaterMark, newEquity);

      account.currentEquity = newEquity;
      account.highWaterMark = newHwm;
      await account.save();

      // Create notification for trade logged
      const resultText = data.result === "WIN" ? "+" : data.result === "LOSS" ? "-" : "BE";
      await Notification.create({
        userId,
        type: "TRADE_LOGGED",
        title: "Trade Logged",
        message: `${data.pair} ${data.direction} - ${resultText}$${data.actualPnl.toFixed(2)}`,
        link: "/analytics", // TODO: link to the trade in list
        metadata: {
          tradeId: newTrade._id,
          pair: data.pair,
          direction: data.direction,
          pnl: data.actualPnl,
          result: data.result
        }
      });

      return newTrade;
    } catch (error) {
      console.error("Error creating trade:", error);
      throw new Error(
        `Failed to create trade: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },

  async getAll(userId: string, query: z.infer<typeof getTradesQuerySchema> & { includeDeleted?: boolean }) {
    try {
      const limit = query.limit || 20;
      const offset = ((query.page || 1) - 1) * limit;

      const filter: Record<string, unknown> = { userId };

      // Filter by active trading account (use optional chaining for type safety)
      if (query.tradingAccountId) {
        filter.tradingAccountId = query.tradingAccountId;
      }

      if (!query.includeDeleted) {
        // Include trades that are explicitly not deleted OR missing isDeleted field (for backward compatibility)
        filter.$or = [{ isDeleted: false }, { isDeleted: { $exists: false } }];
      }

      if (query.playbookId) filter.playbookId = query.playbookId;
      if (query.result) {
        // Convert lowercase frontend result to uppercase DB enum
        filter.result = query.result.toUpperCase();
      }

      const list = await Trade.find(filter)
        .populate("playbookId", "name")
        .sort({ [query.sortBy]: query.sortOrder === "desc" ? -1 : 1 })
        .skip(offset)
        .limit(limit);

      const count = await Trade.countDocuments(filter);

      return { list, count };
    } catch (error) {
      console.error("Error fetching trades:", error);
      throw new Error(
        `Failed to fetch trades: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },

  async getById(id: string, userId: string) {
    try {
      return await Trade.findOne({ _id: id, userId, isDeleted: { $ne: true } })
        .populate("playbookId");
    } catch (error) {
      console.error("Error fetching trade by ID:", error);
      throw new Error(
        `Failed to fetch trade: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },

  async getRecent(userId: string, accountId: string, limit: number = 5) {
    try {
      return await Trade.find({ userId, tradingAccountId: accountId, isDeleted: { $ne: true } })
        .populate("playbookId", "name")
        .sort({ createdAt: -1 })
        .limit(limit);
    } catch (error) {
      console.error("Error fetching recent trades:", error);
      throw new Error(
        `Failed to fetch recent trades: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },

  async getSummary(userId: string, accountId: string) {
    try {
      const trades = await Trade.find({ userId, tradingAccountId: accountId, isDeleted: { $ne: true } });
      const totalPnL = trades.reduce((sum, t) => sum + t.actualPnl, 0);
      const totalTrades = trades.length;
      const wins = trades.filter(t => t.result === "WIN");
      const losses = trades.filter(t => t.result === "LOSS");
      const winRate = totalTrades > 0 ? (wins.length / totalTrades) * 100 : 0;
      const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + t.actualPnl, 0) / wins.length : 0;
      const avgLoss = losses.length > 0 ? losses.reduce((sum, t) => sum + Math.abs(t.actualPnl), 0) / losses.length : 0;
      const grossProfit = wins.reduce((sum, t) => sum + t.actualPnl, 0);
      const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.actualPnl, 0));
      const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;

      return {
        totalPnL,
        totalTrades,
        winRate: Number(winRate.toFixed(1)),
        avgWin,
        avgLoss,
        profitFactor: Number(profitFactor.toFixed(2)),
        bestTrade: wins.length > 0 ? Math.max(...wins.map(t => t.actualPnl)) : 0,
        worstTrade: losses.length > 0 ? Math.min(...losses.map(t => t.actualPnl)) : 0,
      };
    } catch (error) {
      console.error("Error fetching trade summary:", error);
      throw new Error(
        `Failed to fetch trade summary: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },

  async update(id: string, userId: string, data: Partial<z.infer<typeof logTradeSchema>>) {
    try {
      // 1. Fetch existing trade to check ownership and AI review status
      const existing = await Trade.findOne({ _id: id, userId });
      if (!existing) {
        throw new Error("Trade not found or you don't have permission to edit it");
      }

      // 2. Validate direction and result enum values if provided
      const allowedDirections = ["LONG", "SHORT"] as const;
      const allowedResults = ["WIN", "LOSS", "BREAKEVEN"] as const;

      const updateData: Record<string, unknown> = { ...data };

      if (updateData.direction) {
        const dir = typeof updateData.direction === "string"
          ? updateData.direction.toUpperCase()
          : updateData.direction;
        if (!allowedDirections.includes(dir as any)) {
          throw new Error(`Invalid direction: ${updateData.direction}. Must be LONG or SHORT.`);
        }
        updateData.direction = dir;
      }

      if (updateData.result) {
        const res = typeof updateData.result === "string"
          ? updateData.result.toUpperCase()
          : updateData.result;
        if (!allowedResults.includes(res as any)) {
          throw new Error(`Invalid result: ${updateData.result}. Must be WIN, LOSS, or BREAKEVEN.`);
        }
        updateData.result = res;
      }

      // 3. Check for AI review – prevent editing core trade details if AI review exists
            const aiReview = await AiReview.findOne({ tradeId: existing._id });
            const hasAIReview = !!aiReview;

            if (hasAIReview) {
              // List of fields that should NOT be edited if AI review exists
              const restrictedFields = ['entryPrice', 'stopLoss', 'takeProfit', 'tradeDate', 'pair', 'direction', 'lotSize'];
              const hasRestrictedUpdate = restrictedFields.some(field => updateData[field] !== undefined);

              if (hasRestrictedUpdate) {
                throw new Error(
                  "Cannot edit core trade details (entry, stop loss, take profit, date, pair, direction, lot size) because an AI review has been generated. Please delete the AI review first or create a new trade."
                );
              }
            }

            // 4. Recalculate rMultiple if actualPnl or risk-related fields changed
                              // Only if no AI review exists (restricted fields would be blocked above)
                              if (!hasAIReview && (
                                updateData.actualPnl !== undefined ||
                                updateData.entryPrice !== undefined ||
                                updateData.stopLoss !== undefined ||
                                updateData.lotSize !== undefined ||
                                updateData.takeProfit !== undefined ||
                                updateData.sizeType !== undefined
                              )) {
                                const account = await TradingAccount.findById(existing.tradingAccountId);
                                if (account) {
                                  const riskMetrics = calculateRiskMetrics(
                                    updateData.entryPrice ?? existing.entryPrice,
                                    updateData.stopLoss ?? existing.stopLoss,
                                    updateData.lotSize ?? existing.lotSize,
                                    existing.pair,
                                    account.currentEquity,
                                    updateData.actualPnl !== undefined ? updateData.actualPnl : existing.actualPnl,
                                    updateData.sizeType ?? existing.sizeType ?? "standard"
                                  );
                                  if (riskMetrics.rMultiple !== undefined) {
                                    updateData.rMultiple = riskMetrics.rMultiple;
                                  }
                                  if (riskMetrics.riskPercent !== undefined) {
                                    updateData.riskPercent = riskMetrics.riskPercent;
                                  }

                                  // Recalculate planned R-multiple if takeProfit changed
                                  if (updateData.takeProfit !== undefined || updateData.entryPrice !== undefined || updateData.stopLoss !== undefined) {
                                    const entryPrice = updateData.entryPrice ?? existing.entryPrice;
                                    const stopLoss = updateData.stopLoss ?? existing.stopLoss;
                                    const takeProfit = updateData.takeProfit ?? existing.takeProfit;
                                    if (takeProfit) {
                                      const riskPoints = Math.abs(entryPrice - stopLoss);
                                      const rewardPoints = Math.abs(takeProfit - entryPrice);
                                      if (riskPoints > 0) {
                                        updateData.plannedRMultiple = parseFloat((rewardPoints / riskPoints).toFixed(2));
                                      }
                                    }
                                  }
                                }
                              }

            // 5. Protect sensitive fields from being updated
      const protectedFields = ['userId', 'tradingAccountId', 'createdAt', 'isDeleted', 'deletedAt', 'deletionReason'];
      const attemptedProtected = protectedFields.filter(field => updateData[field] !== undefined);
      if (attemptedProtected.length > 0) {
        console.warn(`Attempted to update protected fields: ${attemptedProtected.join(', ')} – ignoring.`);
        // Remove protected fields from updateData
        attemptedProtected.forEach(field => delete updateData[field]);
      }

      // 5. Perform update with atomic $set and auto-update updatedAt
      const updated = await Trade.findOneAndUpdate(
        { _id: id, userId, isDeleted: { $ne: true } },
        { $set: updateData, $currentDate: { updatedAt: true } },
        { returnDocument: 'after' }
      ).populate("playbookId");

      if (!updated) {
        throw new Error("Trade not found or already deleted");
      }

      return updated;
    } catch (error) {
      console.error("Error updating trade:", error);
      throw new Error(
        `Failed to update trade: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },

  async delete(id: string, userId: string, reason?: string) {
    try {
      // Soft delete: mark as deleted with reason
      const result = await Trade.findOneAndUpdate(
        { _id: id, userId, isDeleted: { $ne: true } },
        {
          $set: {
            isDeleted: true,
            deletedAt: new Date(),
            deletionReason: reason || null
          }
        },
        { returnDocument: 'after' }
      );

      return result ? true : false;
    } catch (error) {
      console.error("Error deleting trade:", error);
      throw new Error(
        `Failed to delete trade: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },

  async restore(id: string, userId: string) {
    try {
      // Restore from soft delete
      const result = await Trade.findOneAndUpdate(
        { _id: id, userId, isDeleted: true },
        {
          $set: { isDeleted: false },
          $unset: { deletedAt: "", deletionReason: "" }
        },
        { returnDocument: 'after' }
      );

      return result ? true : false;
    } catch (error) {
      console.error("Error restoring trade:", error);
      throw new Error(
        `Failed to restore trade: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },

  async hardDelete(id: string, userId: string) {
    try {
      // Permanent delete: completely remove from database
      const result = await Trade.findOneAndDelete({ _id: id, userId, isDeleted: true });
      return result ? true : false;
    } catch (error) {
      console.error("Error hard deleting trade:", error);
      throw new Error(
        `Failed to permanently delete trade: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },

  async getDeleted(userId: string, accountId: string, limit = 20, offset = 0) {
    try {
      const list = await Trade.find({ userId, tradingAccountId: accountId, isDeleted: true })
        .sort({ deletedAt: -1 })
        .skip(offset)
        .limit(limit);

      const count = await Trade.countDocuments({ userId, tradingAccountId: accountId, isDeleted: true });

      return { list, count };
    } catch (error) {
      console.error("Error fetching deleted trades:", error);
      throw new Error(
        `Failed to fetch deleted trades: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
};
