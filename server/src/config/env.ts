import { z } from "zod";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { silentLogger } from "../utils/silent-logger";

// Try multiple candidate paths for .env
const envCandidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(__dirname, "../../.env"),
  path.resolve(__dirname, "../.env"),
  path.resolve(__dirname, ".env"),
];
for (const cand of envCandidates) {
  if (fs.existsSync(cand)) {
    dotenv.config({ path: cand });
    break;
  }
}

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("production"),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().min(1),

  // Encryption key for credentials at rest (MT5 passwords, API keys). REQUIRED in production.
  ENCRYPTION_KEY: z.string().min(32).optional(),

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
  GEMINI_MODEL: z.string().min(1).optional().default("gemini-2.5-flash"),
  ANTHROPIC_AUTH_TOKEN: z.string().min(1).optional(),
  ANTHROPIC_BASE_URL: z
    .string()
    .url()
    .optional()
    .default("https://api.anthropic.com"),
  ANTHROPIC_MODEL: z
    .string()
    .min(1)
    .optional()
    .default("anthropic/claude-3-5-haiku-latest"),

  // Alibaba DashScope
  DASHSCOPE_API_KEY: z.string().min(1).optional(),
  DASHSCOPE_BASE_URL: z.string().url().optional(),
  DASHSCOPE_MODEL: z.string().min(1).optional().default("qwen3.7-max"),

  // Groq (fallback for free AI)
  GROQ_API_KEY: z.string().min(1).optional(),
  GROQ_BASE_URL: z.string().optional().default("https://api.groq.com/openai/v1"),
  GROQ_MODEL: z.string().optional().default("llama-3.3-70b-versatile"),
  GROQ_API_URL: z
    .string()
    .url()
    .default("https://api.groq.com/openai/v1/chat/completions"),

  // FRED API for Liquidity Flow (ON RRP)
  FRED_API_KEY: z.string().min(1).optional(),

  // Macro Terminal CPI override in percent, e.g. 4.2
  MACRO_CPI_YOY_OVERRIDE: z.coerce.number().optional(),

  // Trading Economics API for PMI fallback
  TE_API_KEY: z.string().min(1).optional(),

  // Alpha Vantage for leading economic indicators
  ALPHA_VANTAGE_API_KEY: z.string().min(1).optional(),

  // Twelve Data for real-time quotes and economic data
  TWELVE_DATA_API_KEY: z.string().min(1).optional(),

  // Finnhub (already exists but ensure it's required for leading indicator)
  FINNHUB_API_KEY: z.string().min(1).optional(),

  // FlowLLM & Aitrados MCP dependencies
  TUSHARE_API_TOKEN: z.string().optional(),
  TAVILY_API_KEY: z.string().optional(),
  AITRADOS_SECRET_KEY: z.string().optional(),
  FLOW_LLM_API_KEY: z.string().optional(),

  // 9Router
  NINE_ROUTER_URL: z.string().optional(),
  NINE_ROUTER_API_KEY: z.string().optional(),
  NINE_ROUTER_MODEL: z.string().optional().default("free"),

  // Dev whitelist emails (comma-separated) — skip broker registration
  DEV_WHITELIST_EMAILS: z.string().optional().default(""),

  // Native MT5 MCP Server (built-in MetaTrader 5)
  MT5_MCP_URL: z.string().url().optional().default("http://127.0.0.1:22346/mcp"),
  MT5_MCP_API_KEY: z.string().optional().default(""),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("❌ Invalid environment variables:", JSON.stringify(_env.error.format(), null, 2));
  silentLogger.error("❌ Invalid environment variables:", _env.error.format());
  throw new Error("Invalid environment variables: " + JSON.stringify(_env.error.format()));
}

export const env = _env.data;

