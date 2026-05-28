import { z } from "zod";

export const mt5ConnectSchema = z.object({
  server: z.string().min(1, "Server MT5 wajib diisi"),
  login: z.string().min(1, "Login MT5 wajib diisi"),
  password: z.string().min(1, "Password MT5 wajib diisi"),
});

export const mt5UpdateSettingsSchema = z.object({
  sourcePreference: z.enum(["manual", "mt5"]).optional(),
  mt5AutoSyncEnabled: z.boolean().optional(),
  mt5SyncIntervalMinutes: z.number().min(1).max(60).optional(),
});

export const mt5SyncSchema = z.object({
  accountId: z.string().regex(/^[0-9a-fA-F]{24}$/, "ObjectId MongoDB tidak valid").optional(),
});
