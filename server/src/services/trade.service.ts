import { eq, and, sql } from "drizzle-orm";
import { db } from "../db";
import { trade, tradingAccount, dailySnapshot } from "../db/schema";
import { z } from "zod";
import { logTradeSchema, getTradesQuerySchema } from "../validators/trade.validator";
import { calculateRMultiple, calculateRiskAmount } from "../utils/calculations";

export const tradeService = {
  
  async create(userId: string, data: z.infer<typeof logTradeSchema>) {
    return await db.transaction(async (tx) => {
      // 1. Validate Account
      const [account] = await tx.select().from(tradingAccount).where(and(eq(tradingAccount.id, data.tradingAccountId), eq(tradingAccount.userId, userId)));
      if (!account) throw { status: 404, message: "Akun tidak valid" };

      // 2. Auto-calc rMultiple if missing
      let rMult = data.rMultiple;
      if (rMult == null) {
        const riskAmount = calculateRiskAmount(data.entryPrice, data.stopLoss, data.lotSize);
        rMult = calculateRMultiple(data.actualPnl, riskAmount);
      }

      // 3. Insert Trade
      const [newTrade] = await tx.insert(trade).values({
        userId,
        tradingAccountId: data.tradingAccountId,
        playbookId: data.playbookId ?? null,
        tradeDate: new Date(data.tradeDate),
        pair: data.pair,
        direction: data.direction,
        entryPrice: data.entryPrice.toString(),
        stopLoss: data.stopLoss.toString(),
        takeProfit: data.takeProfit?.toString(),
        lotSize: data.lotSize.toString(),
        actualPnl: data.actualPnl.toString(),
        rMultiple: rMult?.toString(),
        result: data.result,
        emotionalState: data.emotionalState,
        notes: data.notes,
        chartLink: data.chartLink,
      }).returning();

      // 4. Update Account Equity (simplified: currentEquity + actualPnl)
      const newEquity = parseFloat(account.currentEquity) + data.actualPnl;
      const newHwm = Math.max(parseFloat(account.highWaterMark), newEquity);

      await tx.update(tradingAccount)
        .set({
          currentEquity: newEquity.toString(),
          highWaterMark: newHwm.toString(),
        })
        .where(eq(tradingAccount.id, data.tradingAccountId));

      return newTrade;
    });
  },

  async getAll(userId: string, query: z.infer<typeof getTradesQuerySchema>) {
    // Pagination placeholder
    const limit = query.limit || 20;
    const offset = ((query.page || 1) - 1) * limit;

    const list = await db.query.trade.findMany({
      where: eq(trade.userId, userId),
      limit,
      offset,
      orderBy: (trade, { desc }) => [desc(trade.tradeDate)],
      with: { playbook: true }
    });

    const [{ count }] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(trade).where(eq(trade.userId, userId));
    
    return { list, count };
  },

  async getById(id: string, userId: string) {
    const t = await db.query.trade.findFirst({
      where: and(eq(trade.id, id), eq(trade.userId, userId)),
      with: { playbook: true }
    });
    return t;
  }
};
