// Force Google DNS for SRV lookups (MongoDB Atlas requires SRV resolution)
// Indonesian ISPs often block or don't support SRV DNS queries
import dns from "node:dns";
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);

process.env.PYTHONIOENCODING = "utf-8";

import express from "express";
import next from "next";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { env } from "./config/env";
import { corsMiddleware } from "./config/cors";
import { MARKET_SYMBOLS } from "./config/market.config";
import apiRoutes from "./routes";
import { errorHandler } from "./middleware/error-handler";
import { connectDB } from "./db/mongoose";
import { createAuth } from "./auth";
import { toNodeHandler } from "better-auth/node";
import { setAuthInstance } from "./auth-context";
import { startMt5AutoSync } from "./services/mt5-scheduler.service";
import { marketDataService } from "./services/market-data.service";
import { quantService } from "./services/quant.service";
import { mcpService } from "./services/mcp.service";
import { mt5McpService } from "./services/mt5-mcp.service";
import { llmConsensusService } from "./services/llm-consensus.service";
import { setWebSocketServer, getClientCount } from "./ws-server";
import { apiLimiter, authLimiter } from "./middleware/rate-limit";
import path from "node:path";

// nextapp
const nextAppDir = path.join(__dirname, "..", "..", "frontend");
const isDev = process.env.NODE_ENV !== 'production';
const nextApp = next({ dev: isDev, dir: nextAppDir });

const app = express();
app.use(corsMiddleware);
app.use(express.json());

app.get("/health", (req, res) => res.status(200).json({ status: "OK", timestamp: new Date().toISOString() }));

const PORT = env.PORT || 5000;
const QUOTE_STREAM_INTERVAL_MS = 15_000;
const VIX_STREAM_INTERVAL_MS = 30_000;

let quoteStreamTimer: NodeJS.Timeout | null = null;
let vixStreamTimer: NodeJS.Timeout | null = null;

const refreshMarketStream = async () => {
  try {
    await marketDataService.getQuotes(MARKET_SYMBOLS);
  } catch (error) {
    console.warn("Macro market stream quote refresh failed:", error);
  }
};

const refreshVixStream = async () => {
  try {
    await quantService.refreshVix();
  } catch (error) {
    console.warn("Macro market stream VIX refresh failed:", error);
  }
};

const startMacroMarketStream = () => {
  if (quoteStreamTimer || vixStreamTimer) return;

  void refreshMarketStream();
  void refreshVixStream();

  quoteStreamTimer = setInterval(refreshMarketStream, QUOTE_STREAM_INTERVAL_MS);
  vixStreamTimer = setInterval(refreshVixStream, VIX_STREAM_INTERVAL_MS);
};

const stopMacroMarketStream = () => {
  if (quoteStreamTimer) clearInterval(quoteStreamTimer);
  if (vixStreamTimer) clearInterval(vixStreamTimer);
  quoteStreamTimer = null;
  vixStreamTimer = null;
};

const syncMacroMarketStream = () => {
  if (getClientCount() > 0) {
    startMacroMarketStream();
  } else {
    stopMacroMarketStream();
  }
};

connectDB()
  .then(async () => {
    try {
      const auth = createAuth();
      setAuthInstance(auth);
      const authHandler = toNodeHandler(auth);
      await startMt5AutoSync();

      // Register Multi-MCP Servers
      if (env.FLOW_LLM_API_KEY || env.TUSHARE_API_TOKEN || env.DASHSCOPE_API_KEY || env.TAVILY_API_KEY) {
        console.log("Starting FlowLLM MCP Server (this may take 10-20 seconds)...");
         mcpService.registerServer(
          "FlowLLM-Finance",
          path.join(__dirname, "..", ".venv-mcp", "Scripts", "finance-mcp.exe"),
          [
            "config=default",
            "mcp.transport=stdio",
            "llm.default.model_name=qwen3-30b-a3b-thinking-2507"
          ],
          {
            FLOW_LLM_API_KEY: env.FLOW_LLM_API_KEY || "",
            TUSHARE_API_TOKEN: env.TUSHARE_API_TOKEN || "",
            TAVILY_API_KEY: env.TAVILY_API_KEY || "",
            DASHSCOPE_API_KEY: env.DASHSCOPE_API_KEY || "",
            PYTHONIOENCODING: "utf-8",
            PYTHONUNBUFFERED: "1",
          }
        ).catch(e => console.error("FlowLLM MCP error:", e));
      }

      if (env.AITRADOS_SECRET_KEY) {
        console.log("Starting Aitrados MCP Server...");
        mcpService.registerServer(
          "Aitrados",
          path.join(__dirname, "..", ".venv-mcp", "Scripts", "finance-trading-ai-agents-mcp.exe"),
          [],
          {
            AITRADOS_SECRET_KEY: env.AITRADOS_SECRET_KEY,
            PYTHONIOENCODING: "utf-8",
            PYTHONUNBUFFERED: "1",
          }
        ).catch(e => console.warn("Aitrados MCP (non-critical):", e.message));
      }

      // Initialize MT5 MCP Service (lazy - connects on first use)
      mt5McpService.init().catch((e) => console.warn("MT5 MCP init delayed:", e.message));

      // Auto-reconnect MT5 with saved credentials if any
      mt5McpService.tryAutoReconnect().catch((e) => console.warn("[MT5] Auto-reconnect skipped:", e.message));

      // LLM Health Check — test all 6 models, disable rate-limited ones
      llmConsensusService.startupHealthCheck?.();

      // Apply auth rate limiter to auth endpoints
      app.use("/api/auth", authLimiter);

      app.use((req, res, next) => {
        if (req.url.startsWith("/api/auth")) {
          authHandler(req, res).catch((err) => {
            console.error("Auth error:", err);
            next(err);
          });
        } else {
          next();
        }
      });

      // Apply general API rate limiter to all API routes
      app.use("/api", apiLimiter, apiRoutes);
      app.use(errorHandler);

      const server = createServer(app);
      const wss = new WebSocketServer({ server });
      wss.on("connection", (socket) => {
        socket.on("close", syncMacroMarketStream);
        syncMacroMarketStream();
      });
      setWebSocketServer(wss);

      server.listen(PORT, () => {
        console.log(`API running on port ${PORT}`);
        console.log(`Auth ready at ${env.BETTER_AUTH_URL}/api/auth`);
        console.log(`WebSocket server running on port ${PORT}`);
      });
    } catch (e) {
      console.error("Init failed:", e);
      process.exit(1);
    }
  })
  .catch((e) => {
    console.error("DB connection failed:", e);
    process.exit(1);
  });
