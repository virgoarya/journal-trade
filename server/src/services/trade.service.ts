import mongoose from "mongoose";
import { Trade } from "../models/Trade";
import { TradingAccount } from "../models/TradingAccount";
import { Notification } from "../models/Notification";
import { z } from "zod";
import { logTradeSchema, getTradesQuerySchema } from "../validators/trade.validator";
import { calculateRMultiple, calculateRiskAmount } from "../utils/calculations";
import { DailySnapshot } from "../models/DailySnapshot";

export const tradeService = {

  async create(userId: string, data: z.infer<typeof logTradeSchema>) {
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

    let rMult = data.rMultiple;
    let riskPercent: number | undefined;

    // Calculate risk metrics
    const riskPoints = Math.abs(data.entryPrice - data.stopLoss);
    if (riskPoints > 0 && account.currentEquity > 0) {
      // Determine contract size based on pair
      const pair = data.pair.toUpperCase();
      let contractSize = 100000; // default forex standard lot
      if (pair.includes("XAU") || pair.includes("GOLD")) {
        contractSize = 100; // Gold: 1 lot = 100 oz
      } else if (pair.includes("BTC") || pair.includes("ETH")) {
        contractSize = 1; // Crypto: 1 lot = 1 unit
      } else if (pair.includes("US30") || pair.includes("SPX") || pair.includes("NAS") || pair.includes("SP500")) {
        contractSize = 1; // Indices: 1 lot = 1 contract
      }

      const riskAmount = riskPoints * data.lotSize * contractSize;
      riskPercent = (riskAmount / account.currentEquity) * 100;
    }

    if (rMult == null) {
      const pair = data.pair.toUpperCase();
      let contractSize = 100000; // default forex standard lot
      if (pair.includes("XAU") || pair.includes("GOLD")) contractSize = 100;
      else if (pair.includes("BTC") || pair.includes("ETH")) contractSize = 1;
      else if (pair.includes("US30") || pair.includes("SPX") || pair.includes("NAS") || pair.includes("SP500")) contractSize = 1;

      const riskAmtCurrency = riskPoints * data.lotSize * contractSize;
      if (riskAmtCurrency > 0) {
        rMult = parseFloat((data.actualPnl / riskAmtCurrency).toFixed(2));
      } else {
        rMult = 0;
      }
    }

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
      riskPercent: riskPercent ?? null,
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
  },

  async getAll(userId: string, query: z.infer<typeof getTradesQuerySchema> & { includeDeleted?: boolean }) {
    const limit = query.limit || 20;
    const offset = ((query.page || 1) - 1) * limit;

    const filter: any = { userId };
    // Filter by active trading account
    if ((query as any).tradingAccountId) {
      filter.tradingAccountId = (query as any).tradingAccountId;
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
  },

  async getById(id: string, userId: string) {
    return await Trade.findOne({ _id: id, userId, isDeleted: { $ne: true } }).populate("playbookId");
  },

  async getRecent(userId: string, accountId: string, limit: number = 5) {
    return await Trade.find({ userId, tradingAccountId: accountId, isDeleted: { $ne: true } })
      .populate("playbookId", "name")
      .sort({ createdAt: -1 })
      .limit(limit);
  },

  async getSummary(userId: string, accountId: string) {
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
  },

  async update(id: string, userId: string, data: Partial<z.infer<typeof logTradeSchema>>) {
    const updateData: any = { ...data };
    if (updateData.direction) {
      updateData.direction = updateData.direction.toUpperCase();
    }
    if (updateData.result) {
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
  },

  async delete(id: string, userId: string, reason?: string) {
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
  },

  async restore(id: string, userId: string) {
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
  },

  async getDeleted(userId: string, accountId: string, limit = 20, offset = 0) {
    const list = await Trade.find({ userId, tradingAccountId: accountId, isDeleted: true })
      .sort({ deletedAt: -1 })
      .skip(offset)
      .limit(limit);
      
    const count = await Trade.countDocuments({ userId, tradingAccountId: accountId, isDeleted: true });
    
    return { list, count };
  }
};
