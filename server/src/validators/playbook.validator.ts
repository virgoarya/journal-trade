import { z } from "zod";

export const createPlaybookSchema = z.object({
  name: z.string().min(2, "Nama playbook minimal 2 karakter").max(100),
  description: z.string().optional(),
  markets: z.array(z.string()).default([]),
  timeframe: z.string().optional(),
  category: z.enum(["breakout", "reversal", "scalping", "swing", "news"]).optional(),
  tags: z.array(z.string()).default([]),
  rules: z.array(z.string().min(1, "Aturan tidak boleh kosong")).min(1, "Minimal harus ada 1 aturan"),
});

export const updatePlaybookSchema = createPlaybookSchema.partial();
