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
import { autoBacktestService } from "../services/auto-backtest.service";
import { aiBacktestSkillService } from "../services/ai-backtest-skill.service";
import { llmConsensusService } from "../services/llm-consensus.service";
import { newsCalendarService } from "../services/news-calendar.service";
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
      const { server, login, password, save } = req.body;

      const result = await mt5McpService.connectToMT5({
        server,
        login,
        password,
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
          { upsert: true, new: true }
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

    return apiResponse.success(res, {
      ...accountInfo,
      ...riskMetrics,
    });
  } catch (error) {
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

    const positions = await mt5McpService.getPositions();

    return apiResponse.success(res, {
      positions,
      total: positions.length,
    });
  } catch (error) {
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
      const result = await mt5McpService.closePosition(ticket);

      if (!result.success) {
        return apiResponse.error(
          res,
          result.error || "Close failed",
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

      // Validate symbols exist on broker
      const symbols = await mt5McpService.getSymbols();
      const validSymbols = req.body.symbols.filter((s: string) =>
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
        ...req.body,
        symbols: validSymbols,
      });

      return apiResponse.success(res, {
        running: true,
        config: { ...req.body, symbols: validSymbols },
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
        crt: analysis.methodologySignals.crt.length > 0 ? analysis.methodologySignals.crt[0] : null,
        quarterly: analysis.methodologySignals.quarterly.length > 0 ? analysis.methodologySignals.quarterly[0] : null,
        lit: analysis.methodologySignals.lit.length > 0 ? analysis.methodologySignals.lit[0] : null,
        rsiEngulf: analysis.methodologySignals.rsiEngulf,
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
    const trades = await AITradeLog.find({
      userId: req.user.id,
      closed: true,
      pnl: { $exists: true },
    }).sort({ createdAt: -1 }).lean();

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
    const skill = await aiBacktestSkillService.getSkill(req.user.id);
    if (!skill) {
      return apiResponse.success(res, {
        totalBacktests: 0,
        symbolRankings: [],
        methodologyRankings: [],
        globalRecoveryFactor: 0,
      });
    }
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

export default router;
