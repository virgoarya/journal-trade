import mongoose from "mongoose";
import { Trade } from "../models/Trade";
import { TradingAccount } from "../models/TradingAccount";
import { z } from "zod";
import { logTradeSchema, getTradesQuerySchema } from "../validators/trade.validator";
import { calculateRMultiple, calculateRiskAmount } from "../utils/calculations";
import { DailySnapshot } from "../models/DailySnapshot";

export const tradeService = {
  
  async create(userId: string, data: z.infer<typeof logTradeSchema>) {
    // If running a replica set, we can use sessions: const session = await mongoose.startSession();
    // For simplicity locally, we do non-transactional inserts, but Mongoose supports sessions.
    
    const account = await TradingAccount.findOne({ _id: data.tradingAccountId, userId });
    if (!account) throw { status: 404, message: "Akun tidak valid" };

    let rMult = data.rMultiple;
    if (rMult == null) {
      const riskAmount = calculateRiskAmount(data.entryPrice, data.stopLoss, data.lotSize);
      rMult = calculateRMultiple(data.actualPnl, riskAmount);
    }

    const newTrade = await Trade.create({
      userId,
      tradingAccountId: data.tradingAccountId,
      playbookId: data.playbookId ?? null,
      tradeDate: new Date(data.tradeDate),
      pair: data.pair,
      direction: data.direction,
      entryPrice: data.entryPrice,
      stopLoss: data.stopLoss,
      takeProfit: data.takeProfit,
      lotSize: data.lotSize,
      actualPnl: data.actualPnl,
      rMultiple: rMult,
      result: data.result,
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
    if (query.result) filter.result = query.result;
    
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
  }
};
