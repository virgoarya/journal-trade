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
import { setWebSocketServer, startWebSocketHeartbeat, getClientCount, authenticateWebSocket, type AuthenticatedWebSocket } from "./ws-server";
import { initMt5NativeMcp } from "./mt5-streamer";
import { silentLogger } from "./utils/silent-logger";
import { tradingPipelineService } from "./services/trading-pipeline.service";
import { apiLimiter, authLimiter } from "./middleware/rate-limit";
import { initAutoBacktestCron } from "./cron/auto-backtest.cron";
import path from "node:path";
import fs from "node:fs";

// System Monitor Agent
import { systemMonitorAgent } from "./agents/system-monitor-agent";

// Next.js frontend has been moved to Vercel.
// This Express app now acts strictly as an API and WebSocket server.

const app = express();
app.set('trust proxy', false); // req.ip = socket address; rate limiter keys not spoofable via X-Forwarded-For
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

let authHandler: any = null;

app.use("/api/auth", authLimiter);

app.use((req, res, next) => {
  if (req.url.startsWith("/api/auth")) {
    if (authHandler) {
      authHandler(req, res).catch((err: any) => {
        console.error("Auth error:", err);
        next(err);
      });
    } else {
      res.status(503).json({ error: "Database connecting, please retry in a moment" });
    }
  } else {
    next();
  }
});

// Apply general API rate limiter to all API routes
app.use("/api", apiLimiter, apiRoutes);
app.use(errorHandler);

const server = createServer(app);
const wss = new WebSocketServer({ server });
wss.on("connection", async (socket, req) => {
  const ws = socket as AuthenticatedWebSocket;
  ws.channels = new Set();

  // Reject connections from unexpected origins (Electron loads file:// or localhost)
  const origin = req.headers.origin;
  if (origin && !/^(https?:\/\/localhost(:\d+)?|file:\/\/.*|null)$/i.test(origin)) {
    silentLogger.warn(`[WS] Rejected connection from origin: ${origin}`);
    socket.close(4003, "origin not allowed");
    return;
  }

  // Real authentication — no more bypass. Unauthenticated sockets get nothing.
  const { userId, isAuthenticated } = await authenticateWebSocket(req);
  if (!isAuthenticated || !userId) {
    silentLogger.warn("[WS] Rejected unauthenticated WebSocket connection");
    socket.close(4001, "unauthorized");
    return;
  }
  ws.isAuthenticated = true;
  ws.userId = userId;
  ws.channels.add("mt5");
  ws.channels.add("all");

  socket.on("close", syncMacroMarketStream);
  syncMacroMarketStream();
});
setWebSocketServer(wss);
startWebSocketHeartbeat(wss);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`API running on port ${PORT}`);
  console.log(`Auth ready at ${env.BETTER_AUTH_URL}/api/auth`);
  console.log(`WebSocket server running on port ${PORT}`);
});

// Connect to Database & initialize background services
connectDB()
  .then(async () => {
try {
    console.log("[STARTUP] Initializing Better Auth...");
    const auth = createAuth();
    setAuthInstance(auth);
    authHandler = toNodeHandler(auth);
    console.log("[STARTUP] Better Auth initialized.");

    console.log("[STARTUP] Initializing MT5 native MCP stream...");
    await initMt5NativeMcp(); // This starts the 9router and MT5 MCP connections
    console.log("[STARTUP] MT5 native MCP stream initialized.");

    console.log("[STARTUP] Starting MT5 auto-sync...");
    startMt5AutoSync().catch((e) => console.error("[MT5 Scheduler] Startup sync failed:", e));
    console.log("[STARTUP] MT5 auto-sync started.");

    console.log("[STARTUP] Initializing auto-backtest cron...");
    initAutoBacktestCron();
    console.log("[STARTUP] Auto-backtest cron initialized.");

    console.log("[STARTUP] Registering additional MCP servers (FlowLLM, Aitrados)...");
    const mcpBinPath = (name: string) => {
      if (process.platform === "win32") {
        return path.join(__dirname, "..", ".venv-mcp", "Scripts", `${name}.exe`);
      }
      const candidates = [`/usr/local/bin/${name}`, `/usr/bin/${name}`];
      return candidates.find(fs.existsSync) || `/usr/local/bin/${name}`;
    };

    if (env.FLOW_LLM_API_KEY || env.TUSHARE_API_TOKEN || env.DASHSCOPE_API_KEY || env.TAVILY_API_KEY) {
      const financeMcpPath = mcpBinPath("finance-mcp");
      if (!fs.existsSync(financeMcpPath)) {
        console.warn(`[MCP] FlowLLM-Finance binary not found at ${financeMcpPath}, skipping`);
      } else {
        console.log("Starting FlowLLM MCP Server (this may take 10-20 seconds)...");
        mcpService.registerServer(
          "FlowLLM-Finance",
          financeMcpPath,
          ["config=default", "mcp.transport=stdio", "llm.default.model_name=qwen3-30b-a3b-thinking-2507"],
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
    }

    if (env.AITRADOS_SECRET_KEY) {
      const aitradosMcpPath = mcpBinPath("finance-trading-ai-agents-mcp");
      if (!fs.existsSync(aitradosMcpPath)) {
        console.warn(`[MCP] Aitrados binary not found at ${aitradosMcpPath}, skipping`);
      } else {
        console.log("Starting Aitrados MCP Server...");
        mcpService.registerAitrados(aitradosMcpPath, 11999, "127.0.0.1")
          .catch(e => console.warn("Aitrados MCP (non-critical):", e.message));
      }
    }
    console.log("[STARTUP] Additional MCP servers registration complete.");

    // Auto-reconnect MT5 with saved credentials if any and restore active pipelines
    console.log("[STARTUP] Attempting MT5 auto-reconnect and pipeline recovery...");
    mt5McpService.tryAutoReconnect()
      .then(async () => {
        console.log("🚀 [MT5] Connected/Checked credentials. Restoring pipelines...");
        await tradingPipelineService.recoverPipelines();
        console.log("[STARTUP] Pipeline recovery complete.");
      })
      .catch((e) => {
        console.warn("⚠️ [MT5] Auto-reconnect skipped (no saved credentials or connection failed):", e.message);
        // Still try to recover the pipelines so they run and can wait/reconnect
        tradingPipelineService.recoverPipelines().catch((err) => console.error("⚠️ Pipeline recovery failed:", err));
        console.log("[STARTUP] Pipeline recovery attempted despite MT5 auto-reconnect issue.");
      });

    // LLM Health Check — test all 6 models, disable rate-limited ones
    console.log("[STARTUP] Running LLM health check...");
    llmConsensusService.startupHealthCheck?.();
    console.log("[STARTUP] LLM health check complete.");

    // System Monitor Agent — periodic health checks & hourly reports
    console.log("[STARTUP] Starting System Monitor Agent...");
    await systemMonitorAgent.start();
    console.log("[STARTUP] System Monitor Agent started.");

  } catch (e) {
    console.error("❌ [STARTUP] Critical backend initialization failed:", e);
    process.exit(1); // Exit if critical services fail to start
  }
  })
  .catch((e) => {
    console.error("❌ [STARTUP] DB connection failed. Server is useless without DB, exiting.", e);
    process.exit(1);
  });

// Graceful shutdown handling to prevent EADDRINUSE
const gracefulShutdown = () => {
  console.log("Shutting down gracefully...");

  // Stop system monitor agent
  systemMonitorAgent.stop().catch((e: any) => console.error("Monitor agent stop error:", e));

  // Stop stream timers
  stopMacroMarketStream();

  // Kill MCP child processes
  mcpService.shutdown().catch((e: any) => console.error("MCP shutdown error:", e));

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

// Trigger tsx watch restart

// Trigger restart for rate limit fix
