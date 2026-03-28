import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { tradingAccount, trade } from "../db/schema";
import { calculateRiskAmount } from "../utils/calculations";

export const riskService = {
  
  async getRiskStatus(accountId: string, userId: string) {
    const [account] = await db.select()
      .from(tradingAccount)
      .where(and(eq(tradingAccount.id, accountId), eq(tradingAccount.userId, userId)));
      
    if (!account) throw { status: 404, message: "Akun tidak ditemukan" };

    // simplified daily PnL calculation - normally queried from daily_snapshot or sum of today's trades
    // For now we'll simulate calculating from opening balance of the day
    // This is a placeholder for actual complex risk computation
    const currentEquityNum = parseFloat(account.currentEquity);
    const highWaterMarkNum = parseFloat(account.highWaterMark);
    
    // Total DD
    const totalDrawdownNum = highWaterMarkNum > 0 ? ((highWaterMarkNum - currentEquityNum) / highWaterMarkNum) * 100 : 0;
    
    // Daily DD (Placeholder logic: assuming `initialBalance` is start of day for demo)
    const openingEquityNum = parseFloat(account.initialBalance);
    const dailyDrawdownNum = openingEquityNum > 0 && openingEquityNum > currentEquityNum ? ((openingEquityNum - currentEquityNum) / openingEquityNum) * 100 : 0;

    let status: "SAFE" | "WARNING" | "VIOLATED" = "SAFE";
    
    const maxDailyLimit = parseFloat(account.maxDailyDrawdownPct);
    const maxTotalLimit = parseFloat(account.maxTotalDrawdownPct);

    if (dailyDrawdownNum >= maxDailyLimit || totalDrawdownNum >= maxTotalLimit) {
      status = "VIOLATED";
    } else if (dailyDrawdownNum >= maxDailyLimit * 0.8 || totalDrawdownNum >= maxTotalLimit * 0.8) {
      status = "WARNING";
    }

    return {
      currentEquity: currentEquityNum,
      dailyDrawdownPct: Number(dailyDrawdownNum.toFixed(2)),
      totalDrawdownPct: Number(totalDrawdownNum.toFixed(2)),
      dailyDrawdownLimit: maxDailyLimit,
      totalDrawdownLimit: maxTotalLimit,
      status
    };
  },

  async calculateTradeImpact(accountId: string, entryPrice: number, stopLoss: number, lotSize: number) {
    const riskAmount = calculateRiskAmount(entryPrice, stopLoss, lotSize, 100); // 100 is placeholder pip size
    // in UI we return projected DD assuming full risk loss
    return riskAmount;
  }
};
