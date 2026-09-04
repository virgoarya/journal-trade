import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { aiCoachService } from "../services/ai-coach.service";
import { apiResponse } from "../utils/api-response";

const router = Router();
router.use(requireAuth);

// ─── Validation Schemas ──────────────────────────────────────────────

// Body schemas
const analyzeBodySchema = z.object({
  period: z.enum(["week", "month"]),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

const upsertEmotionBodySchema = z.object({
  tradeId: z.string().min(1, "Trade ID wajib diisi"),
  tradeType: z.enum(["market", "pending", "ai-auto"]),
  emotionTag: z.enum(["FOMO", "REVENGE", "GREEDY", "FEAR", "CONFIDENT", "CALM", "HESITANT"]),
  notes: z.string().optional(),
  timestamp: z.string().datetime(),
  pnl: z.number(),
  symbol: z.string().min(1),
  timeframe: z.string().min(1),
  session: z.enum(["ASIA", "LONDON", "NEW_YORK", "OVERLAP"]),
  rMultiple: z.number().optional(),
  holdDurationMinutes: z.number().optional(),
  marketContext: z.object({
    spread: z.number().optional(),
    volatility: z.number().optional(),
    trend: z.string().optional(),
    support: z.array(z.number()).optional(),
    resistance: z.array(z.number()).optional(),
  }).optional(),
});

const chatRequestBodySchema = z.object({
  message: z.string().min(1, "Pesan obrolan tidak boleh kosong"),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .optional(),
});

// Query schemas
const emotionDistributionQuerySchema = z.object({
  period: z.enum(["week", "month"]).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

const paginatedEmotionsQuerySchema = z.object({
  period: z.enum(["week", "month"]).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

// Params schemas
const deleteEmotionParamsSchema = z.object({
  tradeId: z.string().min(1),
});

// ─── Helper: Calculate date range ────────────────────────────────────

function getDateRange(period?: "week" | "month", startDate?: string, endDate?: string): { startDate: Date; endDate: Date } {
  const now = new Date();
  let start: Date;
  let end: Date;

  if (startDate && endDate) {
    start = new Date(startDate);
    end = new Date(endDate);
  } else if (period === "week") {
    start = new Date(now);
    start.setDate(now.getDate() - 7);
    start.setHours(0, 0, 0, 0);
    end = new Date(now);
    end.setHours(23, 59, 59, 999);
  } else {
    // month default
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  return { startDate: start, endDate: end };
}

// ─── Routes ──────────────────────────────────────────────────────────

/**
 * POST /api/v1/ai-coach/analyze
 * Main analysis endpoint - generates AI coaching feedback for a period
 */
router.post("/analyze", validateRequest({ body: analyzeBodySchema }), async (req, res, next) => {
  try {
    const { period, startDate, endDate } = req.body;
    const userId = req.user.id;

    const { startDate: start, endDate: end } = getDateRange(period, startDate, endDate);

    const result = await aiCoachService.analyze({
      userId,
      period: period || "month",
      startDate: start,
      endDate: end,
    });

    return apiResponse.success(res, result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/ai-coach/emotion-distribution
 * Get emotion distribution data for charts
 */
router.get("/emotion-distribution", validateRequest({ query: emotionDistributionQuerySchema }), async (req, res, next) => {
  try {
    const { period, startDate, endDate } = req.query;
    const userId = req.user.id;

    const { startDate: start, endDate: end } = getDateRange(
      period as "week" | "month" | undefined,
      startDate as string,
      endDate as string
    );

    const data = await aiCoachService.getEmotionDistribution(userId, start, end);
    return apiResponse.success(res, data);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/ai-coach/heatmap
 * Get time-of-day heatmap data
 */
router.get("/heatmap", validateRequest({ query: emotionDistributionQuerySchema }), async (req, res, next) => {
  try {
    const { period, startDate, endDate } = req.query;
    const userId = req.user.id;

    const { startDate: start, endDate: end } = getDateRange(
      period as "week" | "month" | undefined,
      startDate as string,
      endDate as string
    );

    const data = await aiCoachService.getTimeOfDayHeatmap(userId, start, end);
    return apiResponse.success(res, data);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/ai-coach/session-distribution
 * Get trading session distribution
 */
router.get("/session-distribution", validateRequest({ query: emotionDistributionQuerySchema }), async (req, res, next) => {
  try {
    const { period, startDate, endDate } = req.query;
    const userId = req.user.id;

    const { startDate: start, endDate: end } = getDateRange(
      period as "week" | "month" | undefined,
      startDate as string,
      endDate as string
    );

    const data = await aiCoachService.getSessionDistribution(userId, start, end);
    return apiResponse.success(res, data);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/ai-coach/emotion
 * Create or update emotion for a trade
 */
router.post("/emotion", validateRequest({ body: upsertEmotionBodySchema }), async (req, res, next) => {
  try {
    const userId = req.user.id;
    const data = req.body;

    const emotion = await aiCoachService.upsertEmotion({
      ...data,
      userId,
      timestamp: new Date(data.timestamp),
    });

    return apiResponse.success(res, emotion, 201);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/ai-coach/emotion/:tradeId
 * Delete emotion for a trade
 */
router.delete("/emotion/:tradeId", validateRequest({ params: deleteEmotionParamsSchema }), async (req, res, next) => {
  try {
    const userId = req.user.id;
    const tradeId = Array.isArray(req.params.tradeId) ? req.params.tradeId[0] : req.params.tradeId;

    const deleted = await aiCoachService.deleteEmotion(userId, tradeId);

    if (!deleted) {
      return apiResponse.notFound(res, "Emotion record not found");
    }

    return apiResponse.success(res, { message: "Emotion deleted successfully" });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/ai-coach/emotions
 * Get paginated list of emotions for a period
 */
router.get("/emotions", validateRequest({ query: paginatedEmotionsQuerySchema }), async (req, res, next) => {
  try {
    const { period, startDate, endDate, page, limit } = req.query;
    const userId = req.user.id;

    const { startDate: start, endDate: end } = getDateRange(
      period as "week" | "month" | undefined,
      (Array.isArray(startDate) ? startDate[0] : startDate) as string,
      (Array.isArray(endDate) ? endDate[0] : endDate) as string
    );

    const pageNum = Number(Array.isArray(page) ? page[0] : page) || 1;
    const limitNum = Number(Array.isArray(limit) ? limit[0] : limit) || 50;

    const result = await aiCoachService.getEmotionsPaginated(userId, start, end, pageNum, limitNum);
    return apiResponse.success(res, result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/ai-coach/emotion/:tradeId
 * Get emotion for a specific trade
 */
router.get("/emotion/:tradeId", validateRequest({ params: deleteEmotionParamsSchema }), async (req, res, next) => {
  try {
    const userId = req.user.id;
    const tradeId = Array.isArray(req.params.tradeId) ? req.params.tradeId[0] : req.params.tradeId;

    const emotion = await aiCoachService.getEmotionForTrade(userId, tradeId);

    if (!emotion) {
      return apiResponse.notFound(res, "Emotion not found for this trade");
    }

    return apiResponse.success(res, emotion);
  } catch (error) {
    next(error);
  }
});

// ─── Existing Chat Endpoint (keep for backward compatibility) ───────

const chatRequestSchema = z.object({
  body: z.object({
    message: z.string().min(1, "Pesan obrolan tidak boleh kosong"),
    history: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string(),
        })
      )
      .optional(),
  }),
});

router.post("/chat", validateRequest({ body: chatRequestBodySchema }), async (req, res, next) => {
  try {
    const { message, history = [] } = req.body;
    const userId = req.user.id;

    const reply = await aiCoachService.chatWithAI(userId, message, history);

    return apiResponse.success(res, { reply });
  } catch (error) {
    next(error);
  }
});

export default router;