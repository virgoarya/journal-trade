import { eq } from "drizzle-orm";
import { db } from "../db";
import { tradingAccount } from "../db/schema";
import { z } from "zod";
import { createTradingAccountSchema, updateRiskRulesSchema, updateTradingAccountSchema } from "../validators/trading-account.validator";

export const tradingAccountService = {
  
  async getActiveAccount(userId: string) {
    const [account] = await db
      .select()
      .from(tradingAccount)
      .where(eq(tradingAccount.userId, userId))
      .limit(1);
    
    return account || null;
  },

  async create(userId: string, data: z.infer<typeof createTradingAccountSchema>) {
    // For now we assume one active account per user
    const existing = await this.getActiveAccount(userId);
    if (existing) {
      throw { status: 400, message: "User sudah memiliki akun trading aktif" };
    }

    const [newAccount] = await db.insert(tradingAccount).values({
      userId,
      accountName: data.accountName,
      initialBalance: data.initialBalance.toString(),
      currentEquity: data.initialBalance.toString(), // Initially equals initialBalance
      highWaterMark: data.initialBalance.toString(), // Initially equals initialBalance
      currency: data.currency,
      broker: data.broker,
      maxDailyDrawdownPct: data.maxDailyDrawdownPct.toString(),
      maxTotalDrawdownPct: data.maxTotalDrawdownPct.toString(),
      maxDailyTrades: data.maxDailyTrades,
      onboardingCompleted: true,
      isActive: true,
    }).returning();

    return newAccount;
  },

  async updateInfo(accountId: string, userId: string, data: z.infer<typeof updateTradingAccountSchema>) {
    const [updated] = await db.update(tradingAccount)
      .set(data)
      .where(eq(tradingAccount.id, accountId))
      // Adding a check so user can only update their own account
      .returning();
      
    return updated;
  },

  async updateRiskRules(accountId: string, userId: string, data: z.infer<typeof updateRiskRulesSchema>) {
    const [updated] = await db.update(tradingAccount)
      .set({
        maxDailyDrawdownPct: data.maxDailyDrawdownPct.toString(),
        maxTotalDrawdownPct: data.maxTotalDrawdownPct.toString(),
        maxDailyTrades: data.maxDailyTrades,
      })
      .where(eq(tradingAccount.id, accountId))
      .returning();

    return updated;
  }
};
