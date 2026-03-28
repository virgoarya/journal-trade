import { Router } from "express";
import { tradeService } from "../services/trade.service";
import { validate } from "../middleware/validate";
import { logTradeSchema, getTradesQuerySchema } from "../validators/trade.validator";
import { apiResponse } from "../utils/api-response";
import { requireAuth } from "../middleware/auth";
import { uuidParamSchema } from "../validators/common.validator";

const router = Router();
router.use(requireAuth);

router.post("/", validate({ body: logTradeSchema }), async (req, res, next) => {
  try {
    const trade = await tradeService.create(req.user.id, req.body);
    return apiResponse.success(res, trade, 201);
  } catch (error) { next(error); }
});

router.get("/", validate({ query: getTradesQuerySchema }), async (req, res, next) => {
  try {
    const { list, count } = await tradeService.getAll(req.user.id, req.query as any);
    return apiResponse.success(res, list, 200, {
      page: req.query.page || 1,
      limit: req.query.limit || 20,
      total: count
    });
  } catch (error) { next(error); }
});

router.get("/:id", validate({ params: uuidParamSchema }), async (req, res, next) => {
  try {
    const trade = await tradeService.getById(req.params.id, req.user.id);
    if (!trade) return apiResponse.notFound(res, "Data trade tidak ditemukan");
    return apiResponse.success(res, trade);
  } catch (error) { next(error); }
});

// Additional update/delete routes omitted for brevity but fit similar pattern

export default router;
