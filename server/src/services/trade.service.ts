import mongoose from "mongoose";
import { Trade } from "../models/Trade";
import { TradingAccount } from "../models/TradingAccount";
import { Notification } from "../models/Notification";
import { z } from "zod";
import { logTradeSchema, getTradesQuerySchema } from "../validators/trade.validator";
import { calculateRMultiple, calculateRiskAmount } from "../utils/calculations";
import { DailySnapshot } from "../models/DailySnapshot";

// Helper function to determine contract size based on trading pair
function getContractSize(pair: string): number {
  const normalizedPair = pair.toUpperCase();
  if (normalizedPair.includes("XAU") || normalizedPair.includes("GOLD")) {
    return 100; // Gold: 1 lot = 100 oz
  }
  if (normalizedPair.includes("BTC") || normalizedPair.includes("ETH")) {
    return 1; // Crypto: 1 lot = 1 unit
  }
  if (
    normalizedPair.includes("US30") ||
    normalizedPair.includes("SPX") ||
    normalizedPair.includes("NAS") ||
    normalizedPair.includes("SP500")
  ) {
    return 1; // Indices: 1 lot = 1 contract
  }
  return 100000; // default forex standard lot
}

// Helper function to calculate risk metrics
function calculateRiskMetrics(
  entryPrice: number,
  stopLoss: number,
  lotSize: number,
  pair: string,
  accountEquity: number,
  actualPnl?: number
): { riskPercent?: number; rMultiple?: number } {
  const riskPoints = Math.abs(entryPrice - stopLoss);

  if (riskPoints <= 0 || accountEquity <= 0) {
    return {
      riskPercent: undefined,
      rMultiple: actualPnl !== undefined ? 0 : undefined,
    };
  }

  const contractSize = getContractSize(pair);
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
        data.actualPnl
      );

      const riskPercent = riskMetrics.riskPercent ?? null;
      const rMult = data.rMultiple ?? riskMetrics.rMultiple ?? 0;

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
      const updateData: Record<string, unknown> = { ...data };

      if (updateData.direction && typeof updateData.direction === "string") {
        updateData.direction = updateData.direction.toUpperCase();
      }
      if (updateData.result && typeof updateData.result === "string") {
        updateData.result = updateData.result.toUpperCase();
      }

      // Don't allow updating certain fields if trade has AI review
      if (updateData.entryPrice || updateData.stopLoss || updateData.tradeDate || updateData.pair) {
        const existing = await Trade.findOne({ _id: id, userId });
        // Could check for AI review here and restrict if needed
      }

      const updated = await Trade.findOneAndUpdate(
        { _id: id, userId, isDeleted: { $ne: true } },
        { $set: updateData, $currentDate: { updatedAt: true } },
        { returnDocument: 'after' }
      ).populate("playbookId");

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
