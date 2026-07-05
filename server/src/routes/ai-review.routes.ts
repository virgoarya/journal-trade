import { Router } from "express";
import { aiReviewService } from "../services/ai-review.service";
import { apiResponse } from "../utils/api-response";
import { requireAuth } from "../middleware/auth";
import { objectIdParamSchema } from "../validators/common.validator";
import { validate } from "../middleware/validate";
import { Trade } from "../models/Trade";
import { AiReview } from "../models/AiReview";

// Helper to map emotionalState & notes into psychologyNotes
const getPsychologyNotes = (trade: any): string => {
  if (!trade || typeof trade !== 'object') return "Tidak ada data psikologi";
  const emotionalStateMap: Record<number, string> = {
    1: "Sangat Tertekan / FOMO tinggi",
    2: "Cemas / Kurang percaya diri",
    3: "Netral / Tenang",
    4: "Disiplin / Fokus baik",
    5: "Sangat Tenang / Eksekusi objektif"
  };
  const emotionalRating = trade.emotionalState ? emotionalStateMap[trade.emotionalState] : "Tidak dicatat";
  const notesText = trade.notes ? ` | Catatan: ${trade.notes}` : "";
  return `Kondisi Emosi: ${emotionalRating}${notesText}`;
};

// Helper to map marketCondition & session into marketContext
const getMarketContext = (trade: any): string => {
  if (!trade || typeof trade !== 'object') return "Tidak ada data konteks pasar";
  const condition = trade.marketCondition || "ALL";
  const session = trade.session || "Other";
  return `Kondisi Pasar: ${condition} | Sesi: ${session}`;
};

const router = Router();

// Log all routes for debugging
router.use((req, res, next) => {
  console.log(`[AI Review Route] ${req.method} ${req.path}`);
  next();
});

router.use(requireAuth);

router.post("/generate/:id", validate({ params: objectIdParamSchema }), async (req, res, next) => {
  try {
    const review = await aiReviewService.generateReview(req.params.id as string, req.user.id);
    const trade = await Trade.findById(review.tradeId);
    // Transform to frontend format
    const formattedReview = {
      id: review._id.toString(),
      tradeId: review.tradeId.toString(),
      date: review.createdAt.toISOString().split('T')[0],
      pair: trade?.pair || "Unknown",
      overallScore: review.score,
      summary: review.summary || "No summary available",
      strengths: review.strengths || [],
      improvements: review.improvements || [],
      suggestions: review.recommendation ? [review.recommendation] : [],
      psychologyNotes: getPsychologyNotes(trade),
      marketContext: getMarketContext(trade),
      riskManagement: review.riskWarning || "",
      timestamp: review.createdAt.toISOString()
    };
    return apiResponse.success(res, formattedReview, 201);
  } catch (error) { next(error); }
});

router.get("/", async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (parseInt(req.query.page as string) || 1 - 1) * limit;

    const list = await aiReviewService.getFeed(req.user.id, limit, offset);

    // Transform to frontend format
    const formatted = list.map((review) => {
      const t = review.tradeId as any;
      const tradeIdStr = t && t._id ? t._id.toString() : review.tradeId.toString();
      const pair = t && t.pair ? t.pair : "Unknown";

      return {
        id: review._id.toString(),
        date: review.createdAt.toISOString().split('T')[0],
        tradeId: tradeIdStr,
        pair: pair,
        overallScore: review.score,
        summary: review.summary || "",
        strengths: review.strengths || [],
        improvements: review.improvements || [],
        suggestions: review.recommendation ? [review.recommendation] : [],
        psychologyNotes: getPsychologyNotes(t),
        marketContext: getMarketContext(t),
        riskManagement: review.riskWarning || "",
        timestamp: review.createdAt.toISOString()
      };
    });

    return apiResponse.success(res, formatted);
  } catch (error) { next(error); }
});

router.get("/:id", validate({ params: objectIdParamSchema }), async (req, res, next) => {
  try {
    const review = await aiReviewService.getFeed(req.user.id, 1, 0, { _id: req.params.id });
    if (!review || review.length === 0) {
      return apiResponse.notFound(res, "Review not found");
    }
    const r = review[0];
    const t = r.tradeId as any;
    const tradeIdStr = t && t._id ? t._id.toString() : r.tradeId.toString();
    const pair = t && t.pair ? t.pair : "Unknown";

    const formatted = {
      id: r._id.toString(),
      tradeId: tradeIdStr,
      date: r.createdAt.toISOString().split('T')[0],
      pair: pair,
      overallScore: r.score,
      summary: r.summary || "",
      strengths: r.strengths || [],
      improvements: r.improvements || [],
      suggestions: r.recommendation ? [r.recommendation] : [],
      psychologyNotes: getPsychologyNotes(t),
      marketContext: getMarketContext(t),
      riskManagement: r.riskWarning || "",
      timestamp: r.createdAt.toISOString()
    };
    return apiResponse.success(res, formatted);
  } catch (error) { next(error); }
});

// TEMPORARY: Clear all AI reviews for current user
// MUST come before /:id route to avoid routing conflict
router.delete("/clear-all", async (req, res, next) => {
  try {
    console.log("Clear AI reviews requested by user:", req.user?.id);
    const result = await AiReview.deleteMany({ userId: req.user.id });
    console.log("Deleted count:", result.deletedCount);
    return apiResponse.success(res, { message: `Cleared ${result.deletedCount} reviews` });
  } catch (error) {
    console.error("Clear AI reviews error:", error);
    next(error);
  }
});

router.get("/trade/:tradeId", validate({ params: objectIdParamSchema }), async (req, res, next) => {
  try {
    const review = await aiReviewService.getFeed(req.user.id, 1, 0, { tradeId: req.params.tradeId });
    if (!review || review.length === 0) {
      return apiResponse.notFound(res, "No review for this trade");
    }
    const r = review[0];
    const t = r.tradeId as any;
    const tradeIdStr = t && t._id ? t._id.toString() : r.tradeId.toString();
    const pair = t && t.pair ? t.pair : "Unknown";

    const formatted = {
      id: r._id.toString(),
      tradeId: tradeIdStr,
      date: r.createdAt.toISOString().split('T')[0],
      pair: pair,
      overallScore: r.score,
      summary: r.summary || "",
      strengths: r.strengths || [],
      improvements: r.improvements || [],
      suggestions: r.recommendation ? [r.recommendation] : [],
      psychologyNotes: getPsychologyNotes(t),
      marketContext: getMarketContext(t),
      riskManagement: r.riskWarning || "",
      timestamp: r.createdAt.toISOString()
    };
    return apiResponse.success(res, formatted);
  } catch (error) { next(error); }
});

router.delete("/:id", validate({ params: objectIdParamSchema }), async (req, res, next) => {
  try {
    await aiReviewService.deleteReview(req.params.id as string, req.user.id);
    return apiResponse.success(res, { message: "Review deleted" });
  } catch (error) { next(error); }
});

export default router;
