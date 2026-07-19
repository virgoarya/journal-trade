// Force Google DNS for SRV lookups (MongoDB Atlas requires SRV resolution)
// Indonesian ISPs often block or don't support SRV DNS queries
import dns from "node:dns";
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);

process.env.PYTHONIOENCODING = "utf-8";

import express from "express";
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
import { tradingPipelineService } from "./services/trading-pipeline.service";
import { apiLimiter, authLimiter } from "./middleware/rate-limit";
import { initAutoBacktestCron } from "./cron/auto-backtest.cron";
import path from "node:path";

// System Monitor Agent
import { systemMonitorAgent } from "./agents/system-monitor-agent";

// Next.js frontend has been moved to Vercel.
// This Express app now acts strictly as an API and WebSocket server.

const app = express();
app.set('trust proxy', 1);
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
      startMt5AutoSync().catch((e) => console.error("[MT5 Scheduler] Startup sync failed:", e));
      initAutoBacktestCron();

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

      // Auto-reconnect MT5 with saved credentials if any and restore active pipelines
      mt5McpService.tryAutoReconnect()
        .then(async () => {
          console.log("🚀 [MT5] Connected/Checked credentials. Restoring pipelines...");
          await tradingPipelineService.recoverPipelines();
        })
        .catch((e) => {
          console.warn("⚠️ [MT5] Auto-reconnect skipped:", e.message);
          // Still try to recover the pipelines so they run and can wait/reconnect
          tradingPipelineService.recoverPipelines().catch((err) => console.error("⚠️ Pipeline recovery failed:", err));
        });

// LLM Health Check — test all 6 models, disable rate-limited ones
      llmConsensusService.startupHealthCheck?.();

      // System Monitor Agent — periodic health checks & hourly reports
      await systemMonitorAgent.start();



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

// Graceful shutdown handling to prevent EADDRINUSE
      const gracefulShutdown = () => {
        console.log("Shutting down gracefully...");

        // Stop system monitor agent
        systemMonitorAgent.stop().catch((e: any) => console.error("Monitor agent stop error:", e));

        // Stop stream timers
        stopMacroMarketStream();

        // Close WebSocket Server
        wss.close(() => {
          console.log("WebSocket server closed.");

          // Close HTTP Server
          server.close(() => {
            console.log("HTTP server closed.");
            process.exit(0);
          });
        });

        // Force exit after 5 seconds if not closed
        setTimeout(() => {
          console.error("Forcefully shutting down because connections took too long to close");
          process.exit(1);
        }, 5000);
      };

      process.on("SIGTERM", gracefulShutdown);
      process.on("SIGINT", gracefulShutdown);
    } catch (e) {
      console.error("Init failed:", e);
      process.exit(1);
    }
  })
  .catch((e) => {
    console.error("DB connection failed:", e);
    process.exit(1);
  });

// Trigger tsx watch restart

// Trigger restart for rate limit fix
