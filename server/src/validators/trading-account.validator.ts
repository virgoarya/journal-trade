import { z } from "zod";

export const createTradingAccountSchema = z.object({
  accountName: z.string().min(2, "Nama akun minimal 2 karakter").max(50),
  initialBalance: z.number().positive("Saldo awal harus lebih dari 0"),
  currency: z.enum(["USD", "IDR"]).default("USD"),
  broker: z.string().optional(),
  maxDailyDrawdownPct: z.number().min(0).max(100).default(5),
  maxTotalDrawdownPct: z.number().min(0).max(100).default(10),
  maxDailyTrades: z.number().int().positive().optional(),
});

export const updateRiskRulesSchema = z.object({
  maxDailyDrawdownPct: z.number().min(0).max(100),
  maxTotalDrawdownPct: z.number().min(0).max(100),
  maxDailyTrades: z.number().int().positive().optional(),
});

export const updateTradingAccountSchema = z.object({
  accountName: z.string().min(2).max(50).optional(),
  currency: z.enum(["USD", "IDR"]).optional(),
  broker: z.string().optional(),
});
