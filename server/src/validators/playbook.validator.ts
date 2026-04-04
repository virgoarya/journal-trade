import { z } from "zod";

export const createPlaybookSchema = z.object({
  name: z.string().min(2, "Playbook name must be at least 2 characters").max(100),
  description: z.string().optional(),
  markets: z.array(z.string()).default([]),
  timeframe: z.string().optional(),
  methodology: z.enum(["ICT", "CRT", "MSNR", "SMC", "PA", "IND", "HYBRID"]),
  marketCondition: z.enum(["TRENDING", "RANGING", "VOLATILE", "LIQUID", "ALL"]).default("ALL"),
  legacyCategory: z.enum(["breakout", "reversal", "scalping", "swing", "news"]).optional(),
  tags: z.array(z.string()).default([]),
  rules: z.array(z.string().min(1, "Rules cannot be empty")).min(1, "At least 1 rule required"),
  htfKeyLevel: z.string().optional(),
  ictPoi: z.preprocess((val) => (val === "" ? undefined : val), z.enum(["OrderBlock", "FVG", "Breaker", "Rejection", "iFVG"]).optional()),
  msnrLevel: z.preprocess((val) => (val === "" ? undefined : val), z.enum(["APEX", "QM", "OCL", "TrendLine", "SBR", "RBS"]).optional()),
  htfTimeframe: z.string().optional(),
  entryTimeframe: z.string().optional(),
  entryChecklist: z.array(z.string()).default([]),
});

export const updatePlaybookSchema = createPlaybookSchema.partial();
