import { Router } from "express";
import { aiReviewService } from "../services/ai-review.service";
import { apiResponse } from "../utils/api-response";
import { requireAuth } from "../middleware/auth";
import { uuidParamSchema } from "../validators/common.validator";
import { validate } from "../middleware/validate";

const router = Router();
router.use(requireAuth);

router.post("/generate/:id", validate({ params: uuidParamSchema }), async (req, res, next) => {
  try {
    const review = await aiReviewService.generateReview(req.params.id, req.user.id);
    return apiResponse.success(res, review, 201);
  } catch (error) { next(error); }
});

router.get("/", async (req, res, next) => {
  try {
    // Pagination placeholder
    const limit = Number(req.query.limit) || 10;
    const offset = (Number(req.query.page || 1) - 1) * limit;

    const list = await aiReviewService.getFeed(req.user.id, limit, offset);
    return apiResponse.success(res, list);
  } catch (error) { next(error); }
});

router.get("/weekly-summary", async (req, res, next) => {
  try {
    // Placeholder for actual aggregation
    return apiResponse.success(res, {
      averageScore: 7.8,
      disciplineLevel: 85,
      playbookAdherence: 92,
      winRate: 64.5,
      recommendation: "Pertahankan ukuran lot pada level saat ini.",
      reviewCount: 14
    });
  } catch (error) { next(error); }
});

export default router;
