import { TradingAccount } from "../models/TradingAccount";
import { calculateRiskAmount } from "../utils/calculations";

export const riskService = {
  
  async getRiskStatus(accountId: string, userId: string) {
    const account = await TradingAccount.findOne({ _id: accountId, userId });
      
    if (!account) throw { status: 404, message: "Akun tidak ditemukan" };

    const currentEquityNum = account.currentEquity;
    const highWaterMarkNum = account.highWaterMark;
    
    // Total DD
    const totalDrawdownNum = highWaterMarkNum > 0 ? ((highWaterMarkNum - currentEquityNum) / highWaterMarkNum) * 100 : 0;
    
    // Daily DD 
    const openingEquityNum = account.initialBalance; // simplified stub
    const dailyDrawdownNum = openingEquityNum > 0 && openingEquityNum > currentEquityNum ? ((openingEquityNum - currentEquityNum) / openingEquityNum) * 100 : 0;

    let status: "SAFE" | "WARNING" | "VIOLATED" = "SAFE";
    
    const maxDailyLimit = account.maxDailyDrawdownPct;
    const maxTotalLimit = account.maxTotalDrawdownPct;

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
    return calculateRiskAmount(entryPrice, stopLoss, lotSize, 100);
  }
};
