import { TradingAccount } from "../models/TradingAccount";
import { z } from "zod";
import { createTradingAccountSchema, updateRiskRulesSchema, updateTradingAccountSchema } from "../validators/trading-account.validator";

export const tradingAccountService = {
  
  async getActiveAccount(userId: string) {
    let account = await TradingAccount.findOne({ userId, isActive: true });
    // Jika tidak ada akun aktif tapi ada akun yang terdaftar, jadikan akun pertama aktif
    if (!account) {
      const firstAccount = await TradingAccount.findOne({ userId });
      if (firstAccount) {
        firstAccount.isActive = true;
        await firstAccount.save();
        return firstAccount;
      }
    }
    return account;
  },

  async getAllAccounts(userId: string) {
    return await TradingAccount.find({ userId }).sort({ createdAt: 1 });
  },

  async setActiveAccount(accountId: string, userId: string) {
    // Matikan semua akun
    await TradingAccount.updateMany({ userId }, { $set: { isActive: false } });
    
    // Aktifkan akun target
    const activeAccount = await TradingAccount.findOneAndUpdate(
      { _id: accountId, userId },
      { $set: { isActive: true } },
      { returnDocument: 'after' }
    );
    return activeAccount;
  },

  async create(userId: string, data: z.infer<typeof createTradingAccountSchema>) {
    // Akun pertama otomatis aktif, akun ke-dua dst default-nya pasif (bisa diganti dari switcher)
    const count = await TradingAccount.countDocuments({ userId });
    const isActive = count === 0;

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
      isActive: isActive,
    });

    return newAccount;
  },

  async updateInfo(accountId: string, userId: string, data: z.infer<typeof updateTradingAccountSchema>) {
    const updated = await TradingAccount.findOneAndUpdate(
      { _id: accountId, userId },
      { $set: data },
      { returnDocument: 'after' }
    );
      
    return updated;
  },

  async updateRiskRules(accountId: string, userId: string, data: z.infer<typeof updateRiskRulesSchema>) {
    const updateData: any = {
      maxDailyDrawdownPct: data.maxDailyDrawdownPct,
      maxTotalDrawdownPct: data.maxTotalDrawdownPct,
      maxDailyTrades: data.maxDailyTrades,
    };

    // Only update riskTier if provided
    if (data.riskTier !== undefined) {
      updateData.riskTier = data.riskTier;
    }

    // Only update defaultRiskPercent if provided
    if (data.defaultRiskPercent !== undefined) {
      updateData.defaultRiskPercent = data.defaultRiskPercent;
    }

    const updated = await TradingAccount.findOneAndUpdate(
      { _id: accountId, userId },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    return updated;
  },

  async generateApiKey(accountId: string, userId: string) {
    const crypto = await import("crypto");
    const key = `ht_live_${crypto.randomBytes(24).toString("hex")}`;
    
    const updated = await TradingAccount.findOneAndUpdate(
      { _id: accountId, userId },
      { $set: { apiKey: key } },
      { returnDocument: 'after' }
    );

    return updated;
  }
};
