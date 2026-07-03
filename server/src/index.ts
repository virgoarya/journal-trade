// Force Google DNS for SRV lookups (MongoDB Atlas requires SRV resolution)
// Indonesian ISPs often block or don't support SRV DNS queries
import dns from "node:dns";
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);

import express from "express";
import next from "next";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { env } from "./config/env";
import { corsMiddleware } from "./config/cors";
import apiRoutes from "./routes";
import { errorHandler } from "./middleware/error-handler";
import { connectDB } from "./db/mongoose";
import { createAuth } from "./auth";
import { toNodeHandler } from "better-auth/node";
import { setAuthInstance } from "./auth-context";
import { startMt5AutoSync } from "./services/mt5-scheduler.service";
import { marketDataService } from "./services/market-data.service";
import { quantService } from "./services/quant.service";
import { setWebSocketServer, getClientCount } from "./ws-server";
import path from "node:path";

// nextapp
const nextAppDir = path.join(__dirname, "..", "..", "frontend");
const nextApp = next({ dev: true, dir: nextAppDir });

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
  const symbols = [
    "SPY", "QQQ", "GLD", "VIXY", "IEF", "UUP", "FXY", "TIP",
    "FXE", "FXB", "FXC", "FXF", "TLT", "HYG", "XLE", "XLF", 
    "XLK", "IWM", "EFA", "EEM", "DIA", "ARKK", "XLV", "XLI", 
    "LQD", "FXA", "USO", "DBA"
  ];
  try {
    await marketDataService.getQuotes(symbols);
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

      app.use("/api", apiRoutes);
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
