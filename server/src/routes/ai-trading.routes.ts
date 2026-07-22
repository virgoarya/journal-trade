import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { mt5McpService } from "../services/mt5-mcp.service";
import { aiTradingEngine } from "../services/ai-trading-engine.service";
import { tradingPipelineService } from "../services/trading-pipeline.service";
import { riskManagerService } from "../services/risk-manager.service";
import { apiResponse } from "../utils/api-response";
import { AITradeLog } from "../models/AITradeLog";
import { MT5Connection } from "../models/MT5Connection";
import { autoBacktestService } from "../services/auto-backtest.service";
import { aiBacktestSkillService } from "../services/ai-backtest-skill.service";
import { llmConsensusService } from "../services/llm-consensus.service";
import { newsCalendarService } from "../services/news-calendar.service";
import { silentLogger } from "../utils/silent-logger";
import {
  mt5ConnectSchema,
  openPositionSchema,
  closePositionSchema,
  modifyPositionSchema,
  pipelineConfigSchema,
  methodologyConfigSchema,
} from "../validators/ai-trading.validator";

// Rate limiter khusus untuk endpoint berat AI Trading
const heavyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: {
    success: false,
    error: {
      code: "AI_RATE_LIMIT_EXCEEDED",
      message: "Too many AI requests, please try again later.",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Fallback symbols ketika MT5 tidak terhubung
const FALLBACK_SYMBOLS = [
  { name: "EURUSD", description: "Euro vs US Dollar", digits: 5, tradeContractSize: 100000, volumeMin: 0.01, volumeMax: 100, volumeStep: 0.01, bid: 0, ask: 0, spread: 0, point: 0.00001, visible: true },
  { name: "GBPUSD", description: "British Pound vs US Dollar", digits: 5, tradeContractSize: 100000, volumeMin: 0.01, volumeMax: 100, volumeStep: 0.01, bid: 0, ask: 0, spread: 0, point: 0.00001, visible: true },
  { name: "USDJPY", description: "US Dollar vs Japanese Yen", digits: 3, tradeContractSize: 100000, volumeMin: 0.01, volumeMax: 100, volumeStep: 0.01, bid: 0, ask: 0, spread: 0, point: 0.001, visible: true },
  { name: "AUDUSD", description: "Australian Dollar vs US Dollar", digits: 5, tradeContractSize: 100000, volumeMin: 0.01, volumeMax: 100, volumeStep: 0.01, bid: 0, ask: 0, spread: 0, point: 0.00001, visible: true },
  { name: "USDCAD", description: "US Dollar vs Canadian Dollar", digits: 5, tradeContractSize: 100000, volumeMin: 0.01, volumeMax: 100, volumeStep: 0.01, bid: 0, ask: 0, spread: 0, point: 0.00001, visible: true },
  { name: "NZDUSD", description: "New Zealand Dollar vs US Dollar", digits: 5, tradeContractSize: 100000, volumeMin: 0.01, volumeMax: 100, volumeStep: 0.01, bid: 0, ask: 0, spread: 0, point: 0.00001, visible: true },
  { name: "EURJPY", description: "Euro vs Japanese Yen", digits: 3, tradeContractSize: 100000, volumeMin: 0.01, volumeMax: 100, volumeStep: 0.01, bid: 0, ask: 0, spread: 0, point: 0.001, visible: true },
  { name: "GBPJPY", description: "British Pound vs Japanese Yen", digits: 3, tradeContractSize: 100000, volumeMin: 0.01, volumeMax: 100, volumeStep: 0.01, bid: 0, ask: 0, spread: 0, point: 0.001, visible: true },
  { name: "XAUUSD", description: "Gold vs US Dollar", digits: 2, tradeContractSize: 100, volumeMin: 0.01, volumeMax: 100, volumeStep: 0.01, bid: 0, ask: 0, spread: 0, point: 0.01, visible: true },
  { name: "XAGUSD", description: "Silver vs US Dollar", digits: 3, tradeContractSize: 5000, volumeMin: 0.01, volumeMax: 100, volumeStep: 0.01, bid: 0, ask: 0, spread: 0, point: 0.001, visible: true },
  { name: "BTCUSD", description: "Bitcoin vs US Dollar", digits: 2, tradeContractSize: 1, volumeMin: 0.01, volumeMax: 100, volumeStep: 0.01, bid: 0, ask: 0, spread: 0, point: 0.01, visible: true },
];

const router = Router();
router.use(requireAuth);

// ==================== CONNECTION ====================

/**
 * POST /api/ai-trading/connect
 * Connect to MT5 via MCP server with broker credentials.
 */
router.post(
  "/connect",
  heavyLimiter,
  validate({ body: mt5ConnectSchema }),
  async (req, res, next) => {
    try {
      const { server, login, password, save, tunnelUrl } = req.body;

      const result = await mt5McpService.connectToMT5({
        server,
        login,
        password,
        tunnelUrl,
      });

      if (!result.success) {
        return apiResponse.error(
          res,
          result.error || "Failed to connect to MT5",
          "MT5_CONNECTION_FAILED",
          400,
        );
      }

      // Securely save credentials to DB for auto-reconnect on restart
      try {
        const { MT5Connection } = require("../models/MT5Connection");
        await MT5Connection.findOneAndUpdate(
          { userId: req.user.id },
          {
            server,
            login: parseInt(login, 10) || login,
            enabled: true,
          },
          { upsert: true, returnDocument: "after" }
        ).then(async (doc: any) => {
          doc.setPassword(password);
          await doc.save();
        });
      } catch (dbErr: any) {
        console.error(`[MT5-CONNECT] Failed to save credentials: ${dbErr.message}`);
      }

      return apiResponse.success(res, {
        connected: true,
        accountInfo: result.accountInfo,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/ai-trading/disconnect
 * Disconnect from MT5 and stop pipeline.
 */
router.post("/disconnect", async (req, res, next) => {
  try {
    await tradingPipelineService.stopPipeline(req.user.id);
    await mt5McpService.disconnect();

    return apiResponse.success(res, { connected: false });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ai-trading/status
 * Get connection and pipeline status.
 */
router.get("/status", async (req, res, next) => {
  try {
    const isConnected = mt5McpService.isConnected;
    const pipelineStatus = await tradingPipelineService.getPipelineStatus(
      req.user.id,
    );

    return apiResponse.success(res, {
      connected: isConnected,
      reconnecting: mt5McpService.isReconnectingStatus,
      accountInfo: mt5McpService.account,
      pipeline: pipelineStatus,
    });
  } catch (error) {
    next(error);
  }
});

// ==================== ACCOUNT ====================

/**
 * GET /api/ai-trading/account
 * Get detailed account info with risk metrics.
 */
router.get("/account", async (req, res, next) => {
  try {
    if (!mt5McpService.isConnected) {
      return apiResponse.error(res, "MT5 not connected", "NOT_CONNECTED", 400);
    }

    const accountInfo = await mt5McpService.getAccountInfo();
    const riskMetrics = await riskManagerService.calculateRiskMetrics(
      req.user.id,
    );

    silentLogger.debug(`[ACCOUNT] API response: dailyPnL=${riskMetrics.dailyPnL}, weeklyPnL=${riskMetrics.weeklyPnL}, monthlyPnL=${riskMetrics.monthlyPnL}, winRate=${riskMetrics.winRate}, openRisk=${riskMetrics.openRisk}, marginLevel=${riskMetrics.marginLevel}`);

    return apiResponse.success(res, {
      ...accountInfo,
      ...riskMetrics,
    });
  } catch (error: any) {
    if (error.message && error.message.includes("not connected")) {
      return apiResponse.error(res, "MT5 not connected", "NOT_CONNECTED", 400);
    }
    next(error);
  }
});

// ==================== MARKET DATA ====================

/**
 * GET /api/ai-trading/symbols
 * Get tradable symbols from MT5.
 */
router.get("/symbols", async (req, res, next) => {
  try {
    if (!mt5McpService.isConnected) {
      // Return fallback symbols when MT5 not connected (for backtest purpose)
      return apiResponse.success(res, { symbols: FALLBACK_SYMBOLS });
    }

    const group = req.query.group as string | undefined;
    const symbols = await mt5McpService.getSymbols(group);

    return apiResponse.success(res, { symbols });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ai-trading/rates
 * Get OHLCV rates for a symbol.
 */
router.get("/rates", async (req, res, next) => {
  try {
    if (!mt5McpService.isConnected) {
      return apiResponse.error(res, "MT5 not connected", "NOT_CONNECTED", 400);
    }

    const { symbol, timeframe, count } = req.query as any;
    if (!symbol) {
      return apiResponse.error(res, "Symbol required", "VALIDATION", 400);
    }

    const rates = await mt5McpService.getRates(
      symbol,
      timeframe || "M15",
      Math.min(parseInt(count) || 50, 500),
    );

    return apiResponse.success(res, { symbol, rates });
  } catch (error) {
    next(error);
  }
});

// ==================== POSITIONS ====================

/**
 * GET /api/ai-trading/positions
 * Get all open positions.
 */
router.get("/positions", async (req, res, next) => {
  try {
    if (!mt5McpService.isConnected) {
      return apiResponse.error(res, "MT5 not connected", "NOT_CONNECTED", 400);
    }

    const [positions, orders] = await Promise.all([
      mt5McpService.getPositions().catch(() => [] as any[]),
      mt5McpService.call("mt5_orders_get", {}).catch(() => [] as any[]),
    ]);

    return apiResponse.success(res, {
      positions,
      orders: orders || [],
      total: positions.length + (orders ? orders.length : 0),
    });
  } catch (error: any) {
    if (error.message && error.message.includes("not connected")) {
      return apiResponse.error(res, "MT5 not connected", "NOT_CONNECTED", 400);
    }
    next(error);
  }
});

/**
 * GET /api/ai-trading/debug-positions
 * Debug endpoint — returns raw diagnostic info from MT5 about positions state.
 */
router.get("/debug-positions", async (req, res, next) => {
  try {
    if (!mt5McpService.isConnected) {
      return apiResponse.error(res, "MT5 not connected", "NOT_CONNECTED", 400);
    }

    const debug = await mt5McpService.debugInfo();

    return apiResponse.success(res, debug);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ai-trading/debug-order
 * Dry-run: compute order parameters without executing (useful for debugging).
 */
router.post(
  "/debug-order",
  heavyLimiter,
  validate({ body: openPositionSchema }),
  async (req, res, next) => {
    try {
      if (!mt5McpService.isConnected) {
        return apiResponse.error(
          res,
          "MT5 not connected",
          "NOT_CONNECTED",
          400,
        );
      }

      const { symbol, type, volume, sl, tp } = req.body;

      const result = await mt5McpService.debugOrder({
        symbol,
        action: type,
        volume,
        sl,
        tp,
      });

      if (result.error) {
        return apiResponse.error(
          res,
          result.error || "Debug order failed",
          "DEBUG_ORDER_FAILED",
          400,
        );
      }

      return apiResponse.success(res, result);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/ai-trading/open
 * Open a new market position.
 */
router.post(
  "/open",
  heavyLimiter,
  validate({ body: openPositionSchema }),
  async (req, res, next) => {
    try {
      if (!mt5McpService.isConnected) {
        return apiResponse.error(
          res,
          "MT5 not connected",
          "NOT_CONNECTED",
          400,
        );
      }

      const { symbol, type, volume, sl, tp, comment } = req.body;

      const result = await mt5McpService.openOrder({
        symbol,
        action: type,
        volume,
        sl,
        tp,
        comment: comment || "AI-Manual",
      });

      if (!result.success) {
        return apiResponse.error(
          res,
          result.error || "Order failed",
          "ORDER_FAILED",
          400,
        );
      }

      // Log the trade
      await AITradeLog.create({
        userId: req.user.id,
        signal: {
          symbol,
          direction: type,
          confidence: 0,
          entry: result.price || 0,
          sl: sl || 0,
          tp: tp || 0,
          reason: "Manual trade",
          timeframe: "M15",
          indicators: { rsi: 0, atr: 0 },
          pattern: "MANUAL",
        },
        executed: true,
        executionPrice: result.price,
        executionTime: new Date(),
        mt5Ticket: result.ticket,
        positionSize: volume,
        closed: false,
      });

      return apiResponse.success(res, {
        success: true,
        ticket: result.ticket,
        price: result.price,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/ai-trading/close
 * Close a position by ticket.
 */
router.post(
  "/close",
  validate({ body: closePositionSchema }),
  async (req, res, next) => {
    try {
      if (!mt5McpService.isConnected) {
        return apiResponse.error(
          res,
          "MT5 not connected",
          "NOT_CONNECTED",
          400,
        );
      }

      const { ticket } = req.body;

      const [positions, orders] = await Promise.all([
        mt5McpService.getPositions().catch(() => [] as any[]),
        mt5McpService.call("mt5_orders_get", {}).catch(() => [] as any[]),
      ]);

      const isPendingOrder = orders && orders.some((o: any) => o.ticket === ticket);

      let result;
      if (isPendingOrder) {
        result = await mt5McpService.call("mt5_order_cancel", { ticket });
        if (result && result.success) {
          await AITradeLog.updateOne(
            { mt5Ticket: ticket, closed: false },
            { closed: true, closedAt: new Date(), closeReason: "MANUAL", pnl: 0 }
          );
        }
      } else {
        result = await mt5McpService.closePosition(ticket);
      }

      if (!result.success) {
        return apiResponse.error(
          res,
          result.error || "Close/Cancel failed",
          "CLOSE_FAILED",
          400,
        );
      }

      return apiResponse.success(res, { success: true });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/ai-trading/modify
 * Modify SL/TP on a position.
 */
router.post(
  "/modify",
  validate({ body: modifyPositionSchema }),
  async (req, res, next) => {
    try {
      if (!mt5McpService.isConnected) {
        return apiResponse.error(
          res,
          "MT5 not connected",
          "NOT_CONNECTED",
          400,
        );
      }

      const { ticket, sl, tp } = req.body;
      const result = await mt5McpService.modifyPosition(ticket, sl, tp);

      if (!result.success) {
        return apiResponse.error(
          res,
          result.error || "Modify failed",
          "MODIFY_FAILED",
          400,
        );
      }

      return apiResponse.success(res, { success: true });
    } catch (error) {
      next(error);
    }
  },
);

// ==================== PIPELINE ====================

/**
 * POST /api/ai-trading/pipeline/start
 * Start the AI trading pipeline with config.
 */
router.post(
  "/pipeline/start",
  heavyLimiter,
  validate({ body: pipelineConfigSchema }),
  async (req, res, next) => {
    try {
      if (!mt5McpService.isConnected) {
        return apiResponse.error(
          res,
          "MT5 not connected",
          "NOT_CONNECTED",
          400,
        );
      }

      let finalConfig = req.body;
      if (req.body.useAppliedConfig) {
        const { UserSettings } = require("../models/UserSettings");
        const settings = await UserSettings.findOne({ userId: req.user.id }).lean();
        
        // Get broker-specific config: prefer savedPipelineConfigs[server], fallback to savedPipelineConfig
        const conn = await MT5Connection.findOne({ userId: req.user.id }).lean();
        const server = conn?.server || "unknown";
        const brokerConfig = settings?.savedPipelineConfigs?.[server];
        const configToUse = brokerConfig || null;
        
        if (configToUse) {
          finalConfig = { 
            ...configToUse,
            llmConsensus: {
               ...(settings.aiTrading?.llmConsensus || {}),
               ...(configToUse.llmConsensus || {}),
               enabled: true // FORCE LLM TO ALWAYS BE ACTIVE
            }
          };
          
          // Also fallback methodologies if missing
          if (!finalConfig.activeMethodologies) {
             finalConfig.activeMethodologies = settings.aiTrading?.activeMethodologies;
          }
          if (!finalConfig.methodologyWeights) {
             finalConfig.methodologyWeights = settings.aiTrading?.methodologyWeights;
          }
        } else {
          return apiResponse.error(res, "No applied config found", "NO_CONFIG", 400);
        }
      }

      // Validate symbols exist on broker
      const symbols = await mt5McpService.getSymbols();
      const reqSymbols = finalConfig.symbols || [];
      const validSymbols = reqSymbols.filter((s: string) =>
        symbols.some((sym) => sym.name === s),
      );

      if (validSymbols.length === 0) {
        return apiResponse.error(
          res,
          "No valid symbols found on broker",
          "INVALID_SYMBOLS",
          400,
        );
      }

      await tradingPipelineService.startPipeline(req.user.id, {
        ...finalConfig,
        symbols: validSymbols,
      });

      return apiResponse.success(res, {
        running: true,
        config: { ...finalConfig, symbols: validSymbols },
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/ai-trading/pipeline/stop
 * Stop the AI trading pipeline.
 */
router.post("/pipeline/stop", async (req, res, next) => {
  try {
    await tradingPipelineService.stopPipeline(req.user.id);
    return apiResponse.success(res, { running: false });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ai-trading/pipeline/pause
 * Pause the AI trading pipeline.
 */
router.post("/pipeline/pause", async (req, res, next) => {
  try {
    await tradingPipelineService.pausePipeline(req.user.id);
    return apiResponse.success(res, { paused: true });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ai-trading/pipeline/resume
 * Resume a paused pipeline.
 */
router.post("/pipeline/resume", async (req, res, next) => {
  try {
    await tradingPipelineService.resumePipeline(req.user.id);
    return apiResponse.success(res, { paused: false });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ai-trading/pipeline/status
 * Get pipeline status with metrics.
 */
router.get("/pipeline/status", async (req, res, next) => {
  try {
    const status = await tradingPipelineService.getPipelineStatus(req.user.id);
    return apiResponse.success(res, status);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ai-trading/pipeline/status-with-logs
 * Get pipeline status and logs in a single request (batch endpoint).
 */
router.get("/pipeline/status-with-logs", async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const [status, logs] = await Promise.all([
      tradingPipelineService.getPipelineStatus(req.user.id),
      Promise.resolve(tradingPipelineService.getPipelineLogs(req.user.id, limit)),
    ]);
    return apiResponse.success(res, { status, logs });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ai-trading/pipeline/logs
 * Get pipeline activity logs.
 */
router.get("/pipeline/logs", async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const logs = tradingPipelineService.getPipelineLogs(req.user.id, limit);
    return apiResponse.success(res, { logs });
  } catch (error) {
    next(error);
  }
});

// ==================== AI ANALYSIS ====================

/**
 * POST /api/ai-trading/analyze
 * Analyze a symbol and get AI signal (legacy single-method).
 */
router.post("/analyze", heavyLimiter, async (req, res, next) => {
  try {
    if (!mt5McpService.isConnected) {
      return apiResponse.error(res, "MT5 not connected", "NOT_CONNECTED", 400);
    }

    const { symbol, timeframe } = req.body;
    if (!symbol) {
      return apiResponse.error(res, "Symbol required", "VALIDATION", 400);
    }

    const analysis = await aiTradingEngine.analyzeSymbol(
      symbol,
      timeframe || "M15",
      1.0,
    );

    return apiResponse.success(res, analysis);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ai-trading/analyze-multi
 * Multi-methodology analysis with confluence breakdown.
 */
router.post("/analyze-multi", heavyLimiter, async (req, res, next) => {
  try {
    if (!mt5McpService.isConnected) {
      return apiResponse.error(res, "MT5 not connected", "NOT_CONNECTED", 400);
    }

    const { symbol, timeframe, methodologyWeights, activeMethodologies } = req.body;
    if (!symbol) {
      return apiResponse.error(res, "Symbol required", "VALIDATION", 400);
    }

    const analysis = await aiTradingEngine.analyzeSymbol(
      symbol,
      timeframe || "M15",
      req.body.riskPercent || 1.0,
      methodologyWeights,
      activeMethodologies,
    );

    return apiResponse.success(res, {
      symbol: analysis.symbol,
      marketStructure: {
        trend: analysis.marketStructure.trend,
        recentPriceAction: analysis.marketStructure.recentPriceAction,
        orderBlocksCount: analysis.marketStructure.orderBlocks.length,
        fvgCount: analysis.marketStructure.fairValueGaps.length,
        keyLevelsCount: analysis.marketStructure.keyLevels.length,
        liquidityZonesCount: analysis.marketStructure.liquidityZones.length,
      },
      methodologySignals: {
        smc: analysis.methodologySignals.smc.length > 0 ? analysis.methodologySignals.smc[0] : null,
        ict: analysis.methodologySignals.ict.length > 0 ? analysis.methodologySignals.ict[0] : null,
        msnr: analysis.methodologySignals.msnr.length > 0 ? analysis.methodologySignals.msnr[0] : null,

      },
      confluence: analysis.confluence,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ai-trading/performance
 * Get aggregated pipeline performance stats (methodology breakdown, symbol stats).
 */
router.get("/performance", async (req, res, next) => {
  try {
    let accountId;
    if (mt5McpService.isConnected) {
      try {
        const accountInfo = await mt5McpService.getAccountInfo();
        accountId = accountInfo?.login?.toString();
      } catch (e) {
        console.warn(`[PERFORMANCE] Could not get account info: ${e}`);
      }
    }

    const query: any = {
      userId: req.user.id,
      closed: true,
      pnl: { $exists: true },
    };
    if (accountId) query.accountId = accountId;

    const trades = await AITradeLog.find(query).sort({ createdAt: -1 }).lean();

    if (trades.length === 0) {
      return apiResponse.success(res, {
        totalTrades: 0,
        totalPnL: 0,
        winRate: 0,
        methodologyStats: [],
        symbolStats: [],
        equityCurve: [],
      });
    }

    // ── Overall stats ──
    const totalTrades = trades.length;
    const winningTrades = trades.filter(t => (t.pnl ?? 0) > 0).length;
    const losingTrades = trades.filter(t => (t.pnl ?? 0) < 0).length;
    const totalPnL = trades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
    const winRate = totalTrades > 0 ? Math.round((winningTrades / totalTrades) * 10000) / 100 : 0;

    // ── Methodology stats ──
    const methMap = new Map<string, { count: number; wins: number; losses: number; pnl: number; confSum: number }>();
    for (const t of trades) {
      const m = (t.signal as any)?.primaryMethodology || "unknown";
      if (!methMap.has(m)) methMap.set(m, { count: 0, wins: 0, losses: 0, pnl: 0, confSum: 0 });
      const mm = methMap.get(m)!;
      mm.count++;
      mm.pnl += (t.pnl ?? 0);
      mm.confSum += (t.signal as any)?.confidence || 0;
      if ((t.pnl ?? 0) > 0) mm.wins++;
      else if ((t.pnl ?? 0) < 0) mm.losses++;
    }
    const methodologyStats = Array.from(methMap.entries())
      .filter(([m]) => m !== "unknown")
      .map(([methodology, m]) => ({
        methodology,
        totalTrades: m.count,
        winningTrades: m.wins,
        losingTrades: m.losses,
        totalPnL: Math.round(m.pnl * 100) / 100,
        winRate: m.count > 0 ? Math.round((m.wins / m.count) * 10000) / 100 : 0,
        avgConfidence: m.count > 0 ? Math.round(m.confSum / m.count) : 0,
      }))
      .sort((a, b) => b.totalTrades - a.totalTrades);

    // ── Symbol stats ──
    const symMap = new Map<string, { count: number; wins: number; losses: number; pnl: number }>();
    for (const t of trades) {
      const s = t.signal?.symbol || "unknown";
      if (!symMap.has(s)) symMap.set(s, { count: 0, wins: 0, losses: 0, pnl: 0 });
      const ss = symMap.get(s)!;
      ss.count++;
      ss.pnl += (t.pnl ?? 0);
      if ((t.pnl ?? 0) > 0) ss.wins++;
      else if ((t.pnl ?? 0) < 0) ss.losses++;
    }
    const symbolStats = Array.from(symMap.entries())
      .map(([symbol, s]) => ({
        symbol,
        totalTrades: s.count,
        winningTrades: s.wins,
        losingTrades: s.losses,
        totalPnL: Math.round(s.pnl * 100) / 100,
        winRate: s.count > 0 ? Math.round((s.wins / s.count) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.totalTrades - a.totalTrades);

    // ── Equity curve (per day) ──
    const dayMap = new Map<string, number>();
    let runningPnl = 0;
    for (const t of trades) {
      const day = t.closedAt ? new Date(t.closedAt).toISOString().split("T")[0] : "unknown";
      runningPnl += (t.pnl ?? 0);
      dayMap.set(day, Math.round(runningPnl * 100) / 100);
    }
    const equityCurve = Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, equity]) => ({ time: day, equity }));

    return apiResponse.success(res, {
      totalTrades,
      winningTrades,
      losingTrades,
      totalPnL: Math.round(totalPnL * 100) / 100,
      winRate,
      methodologyStats,
      symbolStats,
      equityCurve,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ai-trading/skill
 * Get AI Backtest Skill — symbol rankings, methodology verdicts, recommended params.
 */
router.get("/skill", async (req, res, next) => {
  try {
    const server = (req.query.server as string) || undefined;
    silentLogger.info(`[SKILL-DEBUG] Fetching skill for user=${req.user.id}, server=${server || "auto"}`);
    const skill = await aiBacktestSkillService.getSkill(req.user.id, server);
    if (!skill) {
      silentLogger.info(`[SKILL-DEBUG] No skill found for server=${server}`);
      return apiResponse.success(res, {
        totalBacktests: 0,
        symbolRankings: [],
        methodologyRankings: [],
        globalRecoveryFactor: 0,
      });
    }
    silentLogger.info(`[SKILL-DEBUG] Found skill: totalBacktests=${skill.totalBacktests}, symbols=${skill.symbolRankings.length}, methodologies=${skill.methodologyRankings.length}`);
    return apiResponse.success(res, {
      totalBacktests: skill.totalBacktests,
      symbolRankings: skill.symbolRankings.sort((a: any, b: any) => b.score - a.score),
      methodologyRankings: skill.methodologyRankings,
      globalRecoveryFactor: skill.globalRecoveryFactor,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ai-trading/llm-status
 * Get status of all 6 LLM models (from health check).
 */
router.get("/llm-status", async (req, res, next) => {
  try {
    const status = llmConsensusService.getModelStatus();
    return apiResponse.success(res, status);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ai-trading/auto-backtest
 * Trigger AI auto-scan across all major pairs with 0.5% risk, no overtrade.
 * Results aggregated into AIBacktestSkill for live pipeline consumption.
 */
router.post("/auto-backtest", heavyLimiter, async (req, res, next) => {
  try {
    const summary = await autoBacktestService.runFullScan(req.user.id);

    if (summary.status === "error") {
      return apiResponse.error(res, summary.error || "Auto backtest failed", "AUTO_BT_ERROR", 500);
    }

    return apiResponse.success(res, summary);
  } catch (error: any) {
    next(error);
  }
});

/**
 * GET /api/ai-trading/news/upcoming
 * Get upcoming economic events (filtered by impact).
 */
router.get("/news/upcoming", async (req, res, next) => {
  try {
    const hours = parseInt(req.query.hours as string) || 48;
    const events = await newsCalendarService.getUpcomingEvents(hours);
    return apiResponse.success(res, { events, total: events.length });
  } catch (error) { next(error); }
});

/**
 * GET /api/ai-trading/news/warnings
 * Get active high-impact news warnings for currently watched pipeline pairs.
 */
router.get("/news/warnings", async (req, res, next) => {
  try {
    const ps = await tradingPipelineService.getPipelineStatus(req.user.id);
    const symbols = ps.config?.symbols || [];
    const warnings = await newsCalendarService.getActiveWarnings(symbols);
    return apiResponse.success(res, { warnings });
  } catch (error) { next(error); }
});

/**
 * GET /api/ai-trading/correlation
 * Calculate Pearson correlation matrix for main Forex pairs and Gold in real-time from MT5 rates.
 */
router.get("/correlation", async (req, res, next) => {
  try {
    const PAIRS = ["EURUSD", "GBPUSD", "AUDUSD", "USDJPY", "USDCAD", "USDCHF", "XAUUSD"];
    
    // Check if MT5 is connected
    const isConnected = mt5McpService.isConnected;
    if (!isConnected) {
      // Fallback to BASE_CORRELATIONS if not connected
      return apiResponse.success(res, { 
        source: "fallback_offline",
        correlations: {
          EURUSD: { EURUSD: 1.0, GBPUSD: 0.88, AUDUSD: 0.74, USDJPY: -0.32, USDCAD: -0.68, USDCHF: -0.92, XAUUSD: 0.42 },
          GBPUSD: { EURUSD: 0.88, GBPUSD: 1.0, AUDUSD: 0.68, USDJPY: -0.28, USDCAD: -0.62, USDCHF: -0.84, XAUUSD: 0.38 },
          AUDUSD: { EURUSD: 0.74, GBPUSD: 0.68, AUDUSD: 1.0, USDJPY: -0.22, USDCAD: -0.72, USDCHF: -0.70, XAUUSD: 0.55 },
          USDJPY: { EURUSD: -0.32, GBPUSD: -0.28, AUDUSD: -0.22, USDJPY: 1.0, USDCAD: 0.45, USDCHF: 0.38, XAUUSD: -0.48 },
          USDCAD: { EURUSD: -0.68, GBPUSD: -0.62, AUDUSD: -0.72, USDJPY: 0.45, USDCAD: 1.0, USDCHF: 0.65, XAUUSD: -0.35 },
          USDCHF: { EURUSD: -0.92, GBPUSD: -0.84, AUDUSD: -0.70, USDJPY: 0.38, USDCAD: 0.65, USDCHF: 1.0, XAUUSD: -0.38 },
          XAUUSD: { EURUSD: 0.42, GBPUSD: 0.38, AUDUSD: 0.55, USDJPY: -0.48, USDCAD: -0.35, USDCHF: -0.38, XAUUSD: 1.0 }
        }
      });
    }

    // Fetch H1 rates for all pairs (last 50 candles)
    const ratesPromises = PAIRS.map(async (sym) => {
      try {
        const rates = await mt5McpService.getRates(sym, "H1", 50);
        return { symbol: sym, rates };
      } catch (err) {
        return { symbol: sym, rates: [] };
      }
    });

    const results = await Promise.all(ratesPromises);
    
    // Check if we got enough valid data
    const validResults = results.filter(r => r.rates && r.rates.length >= 10);
    
    if (validResults.length < 2) {
      // Fallback if not enough data
      return apiResponse.success(res, {
        source: "fallback_low_data",
        correlations: {
          EURUSD: { EURUSD: 1.0, GBPUSD: 0.88, AUDUSD: 0.74, USDJPY: -0.32, USDCAD: -0.68, USDCHF: -0.92, XAUUSD: 0.42 },
          GBPUSD: { EURUSD: 0.88, GBPUSD: 1.0, AUDUSD: 0.68, USDJPY: -0.28, USDCAD: -0.62, USDCHF: -0.84, XAUUSD: 0.38 },
          AUDUSD: { EURUSD: 0.74, GBPUSD: 0.68, AUDUSD: 1.0, USDJPY: -0.22, USDCAD: -0.72, USDCHF: -0.70, XAUUSD: 0.55 },
          USDJPY: { EURUSD: -0.32, GBPUSD: -0.28, AUDUSD: -0.22, USDJPY: 1.0, USDCAD: 0.45, USDCHF: 0.38, XAUUSD: -0.48 },
          USDCAD: { EURUSD: -0.68, GBPUSD: -0.62, AUDUSD: -0.72, USDJPY: 0.45, USDCAD: 1.0, USDCHF: 0.65, XAUUSD: -0.35 },
          USDCHF: { EURUSD: -0.92, GBPUSD: -0.84, AUDUSD: -0.70, USDJPY: 0.38, USDCAD: 0.65, USDCHF: 1.0, XAUUSD: -0.38 },
          XAUUSD: { EURUSD: 0.42, GBPUSD: 0.38, AUDUSD: 0.55, USDJPY: -0.48, USDCAD: -0.35, USDCHF: -0.38, XAUUSD: 1.0 }
        }
      });
    }

    const symbolRates: Record<string, number[]> = {};
    for (const r of validResults) {
      symbolRates[r.symbol] = r.rates.map(x => x.close);
    }

    // Compute returns
    const symbolReturns: Record<string, number[]> = {};
    const symbols = Object.keys(symbolRates);
    for (const s of symbols) {
      const closes = symbolRates[s];
      const returns: number[] = [];
      for (let i = 1; i < closes.length; i++) {
        if (closes[i - 1] === 0) returns.push(0);
        else returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
      }
      symbolReturns[s] = returns;
    }

    // Build matrix
    const matrix: Record<string, Record<string, number>> = {};
    for (const s of PAIRS) {
      matrix[s] = {};
    }

    for (let i = 0; i < PAIRS.length; i++) {
      const s1 = PAIRS[i];
      matrix[s1][s1] = 1.0;

      for (let j = i + 1; j < PAIRS.length; j++) {
        const s2 = PAIRS[j];
        
        const r1 = symbolReturns[s1];
        const r2 = symbolReturns[s2];

        if (!r1 || !r2) {
          matrix[s1][s2] = 0;
          matrix[s2][s1] = 0;
          continue;
        }

        const len = Math.min(r1.length, r2.length);
        if (len < 5) {
          matrix[s1][s2] = 0;
          matrix[s2][s1] = 0;
          continue;
        }

        const x = r1.slice(0, len);
        const y = r2.slice(0, len);

        const meanX = x.reduce((a, b) => a + b, 0) / len;
        const meanY = y.reduce((a, b) => a + b, 0) / len;

        let num = 0;
        let denX = 0;
        let denY = 0;

        for (let k = 0; k < len; k++) {
          const diffX = x[k] - meanX;
          const diffY = y[k] - meanY;
          num += diffX * diffY;
          denX += diffX * diffX;
          denY += diffY * diffY;
        }

        const den = Math.sqrt(denX * denY);
        const correlation = den === 0 ? 0 : num / den;

        // Round to 2 decimal places to match base format
        const rounded = parseFloat(correlation.toFixed(2));
        matrix[s1][s2] = rounded;
        matrix[s2][s1] = rounded;
      }
    }

    return apiResponse.success(res, {
      source: "mt5_live",
      correlations: matrix
    });
  } catch (error) {
    next(error);
  }
});

export default router;
