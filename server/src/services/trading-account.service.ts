import { TradingAccount } from "../models/TradingAccount";
import { z } from "zod";
import { createTradingAccountSchema, updateRiskRulesSchema, updateTradingAccountSchema } from "../validators/trading-account.validator";

export const tradingAccountService = {
  
  async getActiveAccount(userId: string) {
    const account = await TradingAccount.findOne({ userId, isActive: true });
    return account;
  },

  async create(userId: string, data: z.infer<typeof createTradingAccountSchema>) {
    const existing = await this.getActiveAccount(userId);
    if (existing) {
      throw { status: 400, message: "User sudah memiliki akun trading aktif" };
    }

    const newAccount = await TradingAccount.create({
      userId,
      accountName: data.accountName,
      initialBalance: data.initialBalance,
      currentEquity: data.initialBalance,
      highWaterMark: data.initialBalance,
      currency: data.currency,
      broker: data.broker,
      maxDailyDrawdownPct: data.maxDailyDrawdownPct,
      maxTotalDrawdownPct: data.maxTotalDrawdownPct,
      maxDailyTrades: data.maxDailyTrades,
      onboardingCompleted: true,
      isActive: true,
    });

    return newAccount;
  },

  async updateInfo(accountId: string, userId: string, data: z.infer<typeof updateTradingAccountSchema>) {
    const updated = await TradingAccount.findOneAndUpdate(
      { _id: accountId, userId },
      { $set: data },
      { new: true }
    );
      
    return updated;
  },

  async updateRiskRules(accountId: string, userId: string, data: z.infer<typeof updateRiskRulesSchema>) {
    const updated = await TradingAccount.findOneAndUpdate(
      { _id: accountId, userId },
      { $set: {
        maxDailyDrawdownPct: data.maxDailyDrawdownPct,
        maxTotalDrawdownPct: data.maxTotalDrawdownPct,
        maxDailyTrades: data.maxDailyTrades,
      }},
      { new: true }
    );

    return updated;
  }
};
