import mongoose from "mongoose";
import { Trade } from "../models/Trade";
import { TradingAccount } from "../models/TradingAccount";
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
          name: "Main Account",
          currentEquity: 0,
          highWaterMark: 0,
          isActive: true,
          currency: "USD",
          broker: "Default"
        });
      }
    }

    let rMult = data.rMultiple;
    if (rMult == null) {
      const riskAmount = calculateRiskAmount(data.entryPrice, data.stopLoss, data.lotSize);
      rMult = calculateRMultiple(data.actualPnl, riskAmount);
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
    });

    const newEquity = account.currentEquity + data.actualPnl;
    const newHwm = Math.max(account.highWaterMark, newEquity);

    account.currentEquity = newEquity;
    account.highWaterMark = newHwm;
    await account.save();

    return newTrade;
  },

  async getAll(userId: string, query: z.infer<typeof getTradesQuerySchema>) {
    const limit = query.limit || 20;
    const offset = ((query.page || 1) - 1) * limit;

    const filter: any = { userId };
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
    return await Trade.findOne({ _id: id, userId }).populate("playbookId");
  },

  async getRecent(userId: string, limit: number = 5) {
    return await Trade.find({ userId })
      .populate("playbookId", "name")
      .sort({ createdAt: -1 })
      .limit(limit);
  },

  async getSummary(userId: string) {
    const trades = await Trade.find({ userId });
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

    const updated = await Trade.findOneAndUpdate(
      { _id: id, userId },
      updateData,
      { new: true }
    ).populate("playbookId");

    return updated;
  },

  async delete(id: string, userId: string) {
    // Soft delete: actually we'd mark as archived or just remove from playbook
    // For now, actually delete (hard delete) - consider adding isArchived field
    const result = await Trade.deleteOne({ _id: id, userId });
    return result.deletedCount > 0;
  }
};
