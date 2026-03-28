import { eq } from "drizzle-orm";
import { db } from "../db";
import { trade } from "../db/schema";

export const exportService = {
  async getCsvData(userId: string) {
    const list = await db.query.trade.findMany({
      where: eq(trade.userId, userId),
      orderBy: (t, { asc }) => [asc(t.tradeDate)]
    });

    if (list.length === 0) return "";

    const headers = ["Waktu", "Pair", "Arah", "Entry", "StopLoss", "Lot", "PnL", "Hasil", "Catatan"];
    const rows = list.map(t => [
      new Date(t.tradeDate).toISOString(),
      t.pair,
      t.direction,
      t.entryPrice,
      t.stopLoss,
      t.lotSize,
      t.actualPnl,
      t.result,
      t.notes ? `"${t.notes.replace(/"/g, '""')}"` : ""
    ].join(","));

    return [headers.join(","), ...rows].join("\n");
  }
};
