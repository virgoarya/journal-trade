import { z } from "zod";
import "dotenv/config";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().min(1),

  // Database name (default: journal_trade_dev)
  DATABASE_NAME: z.string().optional().default("journal_trade_dev"),

  // Better Auth config (Discord required, Better Auth requires URL/Secret)
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.string().url(),

  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_CLIENT_SECRET: z.string().min(1),
  DISCORD_GUILD_ID: z.string().min(1), // Guild ID to verify membership
  
  // App
  FRONTEND_URL: z.string().url(),
  
  // AI
  // Support for Claude via OpenRouter (ANTHROPIC_* vars) or Gemini (GEMINI_API_KEY)
  GEMINI_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_AUTH_TOKEN: z.string().min(1).optional(),
  ANTHROPIC_BASE_URL: z.string().url().optional().default("https://api.anthropic.com"),
  ANTHROPIC_MODEL: z.string().min(1).optional().default("anthropic/claude-3-5-haiku-latest"),

  // Groq (fallback for free AI)
  GROQ_API_KEY: z.string().min(1).optional(),
  GROQ_MODEL: z.string().optional().default("llama-3.3-70b-versatile"),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("❌ Invalid environment variables:", _env.error.format());
  throw new Error("Invalid environment variables");
}

export const env = _env.data;
