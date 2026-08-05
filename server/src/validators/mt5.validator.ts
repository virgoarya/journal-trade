import { z } from "zod";

export const mt5ConnectSchema = z.object({
  apiKey: z.string().optional(),
  mcpUrl: z.string().optional(),
  server: z.string().optional(),
  login: z.union([z.string(), z.number()]).optional(),
  password: z.string().optional(),
});

export const mt5UpdateSettingsSchema = z.object({
  sourcePreference: z.enum(["manual", "mt5"]).optional(),
  mt5AutoSyncEnabled: z.boolean().optional(),
  mt5SyncIntervalMinutes: z.number().min(1).max(60).optional(),
});

export const mt5SyncSchema = z.object({
  accountId: z.string().regex(/^[0-9a-fA-F]{24}$/, "ObjectId MongoDB tidak valid").optional(),
});
