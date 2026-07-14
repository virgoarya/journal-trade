import { z } from "zod";

// ─── Methodology Config ──────────────────────────────────────────────

export const methodologyWeightsSchema = z.object({
  smc: z.number().min(0).max(2).default(1.0).optional(),
  ict: z.number().min(0).max(2).default(1.0).optional(),
  msnr: z.number().min(0).max(2).default(0.8).optional(),
  crt: z.number().min(0).max(2).default(0.8).optional(),
  quarterly: z.number().min(0).max(2).default(0.6).optional(),
  lit: z.number().min(0).max(2).default(1.0).optional(),
  rsiEngulf: z.number().min(0).max(2).default(0.5).optional(),
});

export const activeMethodologiesSchema = z
  .array(z.enum(["smc", "ict", "msnr", "crt", "quarterly", "lit", "rsiEngulf"]))
  .min(1, "At least one methodology required")
  .default(["smc", "ict", "msnr", "crt", "quarterly", "lit", "rsiEngulf"]);

export const methodologyConfigSchema = z.object({
  weights: methodologyWeightsSchema.optional(),
  active: activeMethodologiesSchema.optional(),
});

// ─── Connection ──────────────────────────────────────────────────────

export const mt5ConnectSchema = z.object({
  server: z.string().min(1, "Server required (e.g. ICMarkets-Demo)"),
  login: z.string().min(1, "Login required"),
  password: z.string().min(1, "Password required"),
});

// ─── Trading ─────────────────────────────────────────────────────────

export const openPositionSchema = z.object({
  symbol: z.string().min(1, "Symbol required"),
  type: z.enum(["BUY", "SELL"]),
  volume: z.number().positive("Volume must be positive"),
  sl: z.number().optional(),
  tp: z.number().optional(),
  comment: z.string().max(32).optional(),
});

export const closePositionSchema = z.object({
  ticket: z.number().int().positive(),
});

export const modifyPositionSchema = z.object({
  ticket: z.number().int().positive(),
  sl: z.number().optional(),
  tp: z.number().optional(),
});

// ─── Pipeline Config ─────────────────────────────────────────────────

export const trailingStopSchema = z.object({
  enabled: z.boolean().default(true),
  activationATR: z.number().positive().default(1.0),
  trailATR: z.number().positive().default(0.5),
  breakEven: z.boolean().default(false),
});

export const entrySettingsSchema = z.object({
  atrMultiplierSL: z.number().positive().default(1.5),
  atrMultiplierTP: z.number().positive().default(1.5),
  rsiOversold: z.number().min(10).max(50).default(30),
  rsiOverbought: z.number().min(50).max(90).default(70),
});

export const tradingHoursSchema = z.object({
  start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid time (HH:mm)"),
  end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid time (HH:mm)"),
});

export const llmConsensusSchema = z.object({
  enabled: z.boolean().default(false),
  minProviders: z.number().int().min(1).max(6).default(2).optional(),
  threshold: z.number().min(0.1).max(1.0).default(0.5).optional(),
  providerTimeoutMs: z.number().int().min(1000).max(30000).default(8000).optional(),
});

export const pipelineConfigSchema = z.object({
  useAppliedConfig: z.boolean().optional(),
  symbols: z.array(z.string()).min(1, "At least one symbol required").optional(),
  timeframe: z.enum(["M5", "M15", "H1"]).default("M15").optional(),
  strategy: z
    .enum(["RSI_ENGULFING_SCALPING", "RSI_ENGULFING_INTRADAY", "MULTI_METHODOLOGY"])
    .default("MULTI_METHODOLOGY").optional(),
  maxOpenPositions: z.number().int().min(1).max(10).default(3).optional(),
  maxRiskPerTrade: z.number().min(0.1).max(5).default(1.0).optional(),
  maxDailyRisk: z.number().min(1).max(10).default(3.0).optional(),
  tradingHours: tradingHoursSchema.optional(),
  trailingStop: trailingStopSchema.optional(),
  entrySettings: entrySettingsSchema.optional(),
  methodologyWeights: methodologyWeightsSchema.optional(),
  activeMethodologies: activeMethodologiesSchema.optional(),
  llmConsensus: llmConsensusSchema.optional(),
});
