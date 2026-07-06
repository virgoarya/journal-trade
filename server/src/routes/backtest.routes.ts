import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { backtestService } from "../services/backtest.service";
import { aiLearningService } from "../services/ai-learning.service";
import { BacktestExperience } from "../models/BacktestExperience";
import { apiResponse } from "../utils/api-response";
import {
  backtestRunSchema,
  backtestApplySchema,
  backtestOptimizeSchema,
} from "../validators/backtest.validator";
import { z } from "zod";

const router = Router();
router.use(requireAuth);

// ─── SSE Streaming Helpers ──────────────────────────────────────────

/**
 * Send an SSE event to the client.
 */
function sendSSE(res: Response, event: string, data: any) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * Zod schema for streaming query params (same shape as POST /run body,
 * but passed as query string).
 */
const streamQuerySchema = z.object({
  symbols: z.string().min(1, "At least one symbol required").transform((s) =>
    s.split(",").map((x) => x.trim()).filter(Boolean)
  ),
  timeframe: z.enum(["M5", "M15", "H1", "H4", "D1"]).default("M15"),
  fromDate: z.string().min(1, "Start date required"),
  toDate: z.string().min(1, "End date required"),
  initialBalance: z.coerce.number().positive().default(10000),
  rsiOversold: z.coerce.number().min(10).max(50).default(30),
  rsiOverbought: z.coerce.number().min(50).max(90).default(70),
  atrMultiplierSL: z.coerce.number().positive().default(1.5),
  atrMultiplierTP: z.coerce.number().positive().default(1.5),
  trailingEnabled: z.preprocess(
    (v) => v === "true" || v === "1" || v === true,
    z.boolean().default(true),
  ),
  activationATR: z.coerce.number().positive().default(1.0),
  trailATR: z.coerce.number().positive().default(0.5),
  maxRiskPerTrade: z.coerce.number().min(0.1).max(10).default(1.0),
  maxOpenPositions: z.coerce.number().int().min(1).max(10).default(3),
  speedMs: z.coerce.number().int().min(0).max(5000).default(0),
  leverage: z.coerce.number().int().min(1).max(500).default(100),
  signalInterval: z.coerce.number().int().min(1).max(20).default(4),
});

/**
 * GET /api/v1/backtest/stream
 * Live streaming backtest via Server-Sent Events.
 *
 * The backtest processes each candle and emits real-time events:
 *   - progress  → { currentCandle, totalCandles, percent }
 *   - candle    → { time, open, high, low, close, rsi, atr, pattern, equity, floatingPnL }
 *   - trade_open  → { time, direction, entryPrice, sl, tp, volume, confidence }
 *   - trade_close → { entryTime, exitTime, direction, pnl, reason }
 *   - complete  → { full BacktestResult }
 *   - error     → { message }
 */
router.get("/stream", async (req: Request, res: Response) => {
  // ── 1. Set SSE headers ──────────────────────────────────────────
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
  res.flushHeaders();

  // ── 2. Validate query params ────────────────────────────────────
  const parsed = streamQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    sendSSE(res, "error", {
      message: `Invalid params: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`,
    });
    res.end();
    return;
  }

  const q = parsed.data;

  // ── 3. Build config ─────────────────────────────────────────────
  const config = {
    symbols: q.symbols,
    timeframe: q.timeframe as any,
    fromDate: new Date(q.fromDate),
    toDate: new Date(q.toDate),
    initialBalance: q.initialBalance,
    entrySettings: {
      rsiOversold: q.rsiOversold,
      rsiOverbought: q.rsiOverbought,
      atrMultiplierSL: q.atrMultiplierSL,
      atrMultiplierTP: q.atrMultiplierTP,
    },
    trailingStop: {
      enabled: q.trailingEnabled,
      activationATR: q.activationATR,
      trailATR: q.trailATR,
      breakEven: false,
    },
    maxRiskPerTrade: q.maxRiskPerTrade,
    maxOpenPositions: q.maxOpenPositions,
    leverage: q.leverage,
    signalInterval: q.signalInterval,
    speedMs: q.speedMs,
  };

  // ── 4. Track client disconnect ──────────────────────────────────
  let aborted = false;
  req.on("close", () => {
    aborted = true;
  });

  // ── 5. Run streaming backtest ───────────────────────────────────
  try {
    await backtestService.runBacktestStream(req.user.id, config, (event) => {
      if (aborted) return;
      switch (event.type) {
        case "progress":
          sendSSE(res, "progress", event.data);
          break;
        case "candle":
          sendSSE(res, "candle", event.data);
          break;
        case "trade_open":
          sendSSE(res, "trade_open", event.data);
          break;
        case "trade_close":
          sendSSE(res, "trade_close", event.data);
          break;
        case "equity":
          sendSSE(res, "equity", event.data);
          break;
        case "complete":
          sendSSE(res, "complete", event.data);
          break;
        case "error":
          sendSSE(res, "error", event.data);
          break;
      }
    });
  } catch (error: any) {
    if (!aborted) {
      sendSSE(res, "error", {
        message: error.message || "Backtest streaming failed",
      });
    }
  } finally {
    if (!aborted) {
      res.end();
    }
  }
});

/**
 * POST /api/v1/backtest/run
 * Run a full backtest simulation (synchronous — returns complete result).
 */
router.post(
  "/run",
  validate({ body: backtestRunSchema }),
  async (req, res, next) => {
    try {
      const { symbols, timeframe, fromDate, toDate, initialBalance, entrySettings, trailingStop, maxRiskPerTrade, maxOpenPositions } = req.body;

      const result = await backtestService.runBacktest(req.user.id, {
        symbols,
        timeframe,
        fromDate: new Date(fromDate),
        toDate: new Date(toDate),
        initialBalance,
        entrySettings,
        trailingStop,
        maxRiskPerTrade,
        maxOpenPositions,
      });

      return apiResponse.success(res, result);
    } catch (error: any) {
      if (error.message?.includes("Not enough data") || error.message?.includes("Failed to fetch")) {
        return apiResponse.error(res, error.message, "BACKTEST_ERROR", 400);
      }
      next(error);
    }
  },
);

/**
 * POST /api/v1/backtest/analyze
 * Get AI analysis of a completed backtest.
 */
router.post("/analyze", async (req, res, next) => {
  try {
    const { backtestId } = req.body;
    if (!backtestId) {
      return apiResponse.error(res, "backtestId required", "VALIDATION", 400);
    }

    const analysis = await aiLearningService.analyzeBacktest(backtestId, req.user.id);
    return apiResponse.success(res, analysis);
  } catch (error: any) {
    if (error.message?.includes("not found")) {
      return apiResponse.error(res, error.message, "NOT_FOUND", 404);
    }
    next(error);
  }
});

/**
 * POST /api/v1/backtest/optimize
 * Run AI parameter optimization — test many param combos automatically
 * and return the best preset (like an Expert Advisor).
 */
router.post(
  "/optimize",
  validate({ body: backtestOptimizeSchema }),
  async (req, res, next) => {
    try {
      const result = await aiLearningService.optimize(req.user.id, req.body);
      return apiResponse.success(res, result);
    } catch (error: any) {
      if (error.message?.includes("wide date range") || error.message?.includes("No valid")) {
        return apiResponse.error(res, error.message, "OPTIMIZE_ERROR", 400);
      }
      next(error);
    }
  },
);

/**
 * POST /api/v1/backtest/apply
 * Apply backtest learnings to the live pipeline config.
 */
router.post(
  "/apply",
  validate({ body: backtestApplySchema }),
  async (req, res, next) => {
    try {
      const result = await aiLearningService.applyToLivePipeline(
        req.user.id,
        req.body.backtestId,
      );
      return apiResponse.success(res, result);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return apiResponse.error(res, error.message, "NOT_FOUND", 404);
      }
      next(error);
    }
  },
);

/**
 * GET /api/v1/backtest/history
 * Get user's backtest history.
 */
router.get("/history", async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = parseInt(req.query.skip as string) || 0;

    const experiences = await BacktestExperience.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-pipelineConfigSnapshot"); // Don't send full config in list

    const total = await BacktestExperience.countDocuments({
      userId: req.user.id,
    });

    return apiResponse.success(res, {
      experiences: experiences.map((e) => ({
        id: e._id.toString(),
        symbol: e.symbol,
        timeframe: e.timeframe,
        dateRange: e.dateRange,
        result: e.result,
        strategy: e.strategy,
        hasAiAnalysis: !!e.aiLearningSummary,
        createdAt: e.createdAt,
      })),
      total,
      limit,
      skip,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/backtest/:id
 * Get a specific backtest result with full detail.
 */
router.get("/:id", async (req, res, next) => {
  try {
    const experience = await BacktestExperience.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!experience) {
      return apiResponse.notFound(res, "Backtest not found");
    }

    return apiResponse.success(res, experience);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/backtest/:id
 * Delete a backtest experience.
 */
router.delete("/:id", async (req, res, next) => {
  try {
    const result = await BacktestExperience.deleteOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (result.deletedCount === 0) {
      return apiResponse.notFound(res, "Backtest not found");
    }

    return apiResponse.success(res, { deleted: true });
  } catch (error) {
    next(error);
  }
});

export default router;
