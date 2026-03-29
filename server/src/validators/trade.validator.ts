import { z } from "zod";
import { TRADE_RESULTS, TRADE_DIRECTIONS } from "../utils/constants";
import { paginationQuerySchema, dateRangeQuerySchema } from "./common.validator";

export const logTradeSchema = z.object({
  tradingAccountId: z.string().regex(/^[0-9a-fA-F]{24}$/, "ID Akun tidak valid"),
  playbookId: z.string().regex(/^[0-9a-fA-F]{24}$/, "ID Playbook tidak valid").optional().nullable(),
  tradeDate: z.string().datetime("Format tanggal tidak valid (gunakan ISO-8601)"),
  pair: z.string().min(2, "Pair minimal 2 karakter"),
  direction: z.enum(TRADE_DIRECTIONS as [string, ...string[]]),
  
  entryPrice: z.number().positive("Harga entry harus lebih dari 0"),
  stopLoss: z.number().positive("Stop loss harus lebih dari 0"),
  takeProfit: z.number().positive("Take profit harus lebih dari 0").optional().nullable(),
  lotSize: z.number().positive("Ukuran lot harus positif"),
  actualPnl: z.number(),
  
  result: z.enum(TRADE_RESULTS as [string, ...string[]]),
  rMultiple: z.number().optional().nullable(),
  
  emotionalState: z.number().min(1).max(5).optional().nullable(),
  notes: z.string().optional().nullable(),
  chartLink: z.string().url("Format URL tidak valid").optional().nullable(),
});

export const getTradesQuerySchema = paginationQuerySchema.merge(dateRangeQuerySchema).extend({
  pair: z.string().optional(),
  playbookId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  result: z.enum(TRADE_RESULTS as [string, ...string[]]).optional(),
  sortBy: z.enum(["tradeDate", "actualPnl", "pair", "createdAt"]).default("tradeDate"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});
