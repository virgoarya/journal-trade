import { Trade } from "../models/Trade";

export const exportService = {
  async getCsvData(userId: string) {
    const list = await Trade.find({ userId }).sort('tradeDate');

    if (list.length === 0) return "";

    const headers = ["Waktu", "Pair", "Arah", "Entry", "StopLoss", "Lot", "PnL", "Hasil", "Catatan"];
    const rows = list.map(t => [
      t.tradeDate.toISOString(),
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
