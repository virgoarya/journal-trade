import { z } from "zod";

export const backtestRunSchema = z.object({
  symbols: z.array(z.string().min(1)).min(1, "At least one symbol required").default(["EURUSD"]),
  timeframe: z.enum(["M5", "M15", "H1", "H4", "D1"]).default("M15"),
  fromDate: z.string().min(1, "Start date required"),
  toDate: z.string().min(1, "End date required"),
  initialBalance: z.number().positive().default(10000),

  entrySettings: z
    .object({
      rsiOversold: z.number().min(10).max(50).default(30),
      rsiOverbought: z.number().min(50).max(90).default(70),
      atrMultiplierSL: z.number().positive().default(1.5),
      atrMultiplierTP: z.number().positive().default(1.5),
    })
    .optional(),

  trailingStop: z
    .object({
      enabled: z.boolean().default(true),
      activationATR: z.number().positive().default(1.0),
      trailATR: z.number().positive().default(0.5),
      breakEven: z.boolean().default(false),
    })
    .optional(),

  maxRiskPerTrade: z.number().min(0.1).max(10).default(1.0),
  maxOpenPositions: z.number().int().min(1).max(10).default(3),
});

export const backtestApplySchema = z.object({
  backtestId: z.string().min(1),
});

export const backtestOptimizeSchema = z.object({
  symbol: z.string().min(1, "Symbol required"),
  timeframe: z.enum(["M5", "M15", "H1", "H4", "D1"]).default("M15"),
  fromDate: z.string().min(1, "Start date required"),
  toDate: z.string().min(1, "End date required"),
  initialBalance: z.number().positive().default(10000),
  optimizationMetric: z.enum(["profitFactor", "winRate", "sharpeRatio", "totalPnLPercent"]).default("profitFactor"),
  maxCombinations: z.number().int().min(5).max(100).default(20),
});
