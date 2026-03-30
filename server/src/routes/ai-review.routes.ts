import { Router } from "express";
import { aiReviewService } from "../services/ai-review.service";
import { apiResponse } from "../utils/api-response";
import { requireAuth } from "../middleware/auth";
import { objectIdParamSchema } from "../validators/common.validator";
import { validate } from "../middleware/validate";
import { Trade } from "../models/Trade";

const router = Router();
router.use(requireAuth);

router.post("/generate/:id", validate({ params: objectIdParamSchema }), async (req, res, next) => {
  try {
    const review = await aiReviewService.generateReview(req.params.id as string, req.user.id);
    // Transform to frontend format
    const formattedReview = {
      id: review._id.toString(),
      tradeId: review.tradeId.toString(),
      date: review.createdAt.toISOString().split('T')[0],
      pair: (await Trade.findById(review.tradeId))?.pair || "Unknown",
      overallScore: review.score,
      summary: review.summary || "No summary available",
      strengths: review.strengths || [],
      improvements: review.improvements || [],
      suggestions: review.recommendation ? [review.recommendation] : [],
      psychologyNotes: "", // TODO: extract from trade emotionalState
      marketContext: "", // TODO: derive from trade context
      riskManagement: "", // TODO: derive from risk metrics
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
    const formatted = await Promise.all(list.map(async (review) => {
      const trade = await Trade.findById(review.tradeId);
      return {
        id: review._id.toString(),
        date: review.createdAt.toISOString().split('T')[0],
        tradeId: review.tradeId.toString(),
        pair: trade?.pair || "Unknown",
        overallScore: review.score,
        summary: review.summary || "",
        strengths: review.strengths || [],
        improvements: review.improvements || [],
        suggestions: review.recommendation ? [review.recommendation] : [],
        psychologyNotes: "",
        marketContext: "",
        riskManagement: "",
        timestamp: review.createdAt.toISOString()
      };
    }));

    return apiResponse.success(res, formatted);
  } catch (error) { next(error); }
});

router.get("/:id", validate({ params: objectIdParamSchema }), async (req, res, next) => {
  try {
    const review = await aiReviewService.getFeed(req.user.id, 1, 0, { _id: req.params.id });
    if (!review || review.length === 0) {
      return apiResponse.notFound(res, "Review not found");
    }
    const trade = await Trade.findById(review[0].tradeId);
    const r = review[0];
    const formatted = {
      id: r._id.toString(),
      tradeId: r.tradeId.toString(),
      date: r.createdAt.toISOString().split('T')[0],
      pair: trade?.pair || "Unknown",
      overallScore: r.score,
      summary: r.summary || "",
      strengths: r.strengths || [],
      improvements: r.improvements || [],
      suggestions: r.recommendation ? [r.recommendation] : [],
      psychologyNotes: "",
      marketContext: "",
      riskManagement: "",
      timestamp: r.createdAt.toISOString()
    };
    return apiResponse.success(res, formatted);
  } catch (error) { next(error); }
});

router.get("/trade/:tradeId", validate({ params: objectIdParamSchema }), async (req, res, next) => {
  try {
    const review = await aiReviewService.getFeed(req.user.id, 1, 0, { tradeId: req.params.tradeId });
    if (!review || review.length === 0) {
      return apiResponse.notFound(res, "No review for this trade");
    }
    const trade = await Trade.findById(req.params.tradeId);
    const r = review[0];
    const formatted = {
      id: r._id.toString(),
      tradeId: r.tradeId.toString(),
      date: r.createdAt.toISOString().split('T')[0],
      pair: trade?.pair || "Unknown",
      overallScore: r.score,
      summary: r.summary || "",
      strengths: r.strengths || [],
      improvements: r.improvements || [],
      suggestions: r.recommendation ? [r.recommendation] : [],
      psychologyNotes: "",
      marketContext: "",
      riskManagement: "",
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
