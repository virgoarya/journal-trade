import { z } from "zod";

export const StreamCandleSchema = z.object({
  time: z.number().refine((n) => !Number.isNaN(n), "Time cannot be NaN"),
  symbol: z.string(),
  open: z.number().refine((n) => !Number.isNaN(n), "Open cannot be NaN"),
  high: z.number().refine((n) => !Number.isNaN(n), "High cannot be NaN"),
  low: z.number().refine((n) => !Number.isNaN(n), "Low cannot be NaN"),
  close: z.number().refine((n) => !Number.isNaN(n), "Close cannot be NaN"),
  rsi: z.number().refine((n) => !Number.isNaN(n), "RSI cannot be NaN"),
  atr: z.number().refine((n) => !Number.isNaN(n), "ATR cannot be NaN"),
  pattern: z.string(),
  equity: z.number().refine((n) => !Number.isNaN(n), "Equity cannot be NaN"),
  floatingPnL: z.number().refine((n) => !Number.isNaN(n), "FloatingPnL cannot be NaN"),
  marginLevel: z.number().refine((n) => !Number.isNaN(n), "MarginLevel cannot be NaN"),
});
