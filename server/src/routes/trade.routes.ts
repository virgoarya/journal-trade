import { Router } from "express";
import { tradeService } from "../services/trade.service";
import { validate } from "../middleware/validate";
import { logTradeSchema, getTradesQuerySchema } from "../validators/trade.validator";
import { apiResponse } from "../utils/api-response";
import { requireAuth } from "../middleware/auth";
import { objectIdParamSchema } from "../validators/common.validator";

const router = Router();
router.use(requireAuth);

router.post("/", validate({ body: logTradeSchema }), async (req, res, next) => {
  try {
    const trade = await tradeService.create(req.user.id, req.body);
    return apiResponse.success(res, trade, 201);
  } catch (error) { next(error); }
});

router.get("/", async (req, res, next) => {
  try {
    // Manual validation
    const limit = parseInt(req.query.limit as string) || 20;
    const page = parseInt(req.query.page as string) || 1;
    const { list, count } = await tradeService.getAll(req.user.id, { limit, page, ...req.query });
    return apiResponse.success(res, list, 200, {
      page,
      limit,
      total: count
    });
  } catch (error) { next(error); }
});

// Get recent trades (shortcut for dashboard)
router.get("/recent", async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit as string) || 5;
    const trades = await tradeService.getRecent(req.user.id, limit);
    return apiResponse.success(res, trades);
  } catch (error) { next(error); }
});

router.get("/:id", validate({ params: objectIdParamSchema }), async (req, res, next) => {
  try {
    const trade = await tradeService.getById(req.params.id, req.user.id);
    if (!trade) return apiResponse.notFound(res, "Data trade tidak ditemukan");
    // Transform result enum to lowercase for frontend compatibility
    if (trade) {
      trade.result = trade.result === "WIN" ? "win" : trade.result === "LOSS" ? "loss" : "breakeven";
      trade.direction = trade.direction === "LONG" ? "Long" : "Short";
    }
    return apiResponse.success(res, trade);
  } catch (error) { next(error); }
});

// Get trade summary
router.get("/summary", async (req, res, next) => {
  try {
    const summary = await tradeService.getSummary(req.user.id);
    return apiResponse.success(res, summary);
  } catch (error) { next(error); }
});

// Update trade
router.patch("/:id", validate({ params: objectIdParamSchema, body: logTradeSchema }), async (req, res, next) => {
  try {
    const trade = await tradeService.update(req.params.id, req.user.id, req.body);
    if (!trade) return apiResponse.notFound(res, "Data trade tidak ditemukan");
    // Transform result enum to lowercase for frontend compatibility
    if (trade) {
      trade.result = trade.result === "WIN" ? "win" : trade.result === "LOSS" ? "loss" : "breakeven";
      trade.direction = trade.direction === "LONG" ? "Long" : "Short";
    }
    return apiResponse.success(res, trade);
  } catch (error) { next(error); }
});

// Delete trade (archive/soft delete)
router.delete("/:id", validate({ params: objectIdParamSchema }), async (req, res, next) => {
  try {
    await tradeService.delete(req.params.id, req.user.id);
    return apiResponse.success(res, { message: "Trade deleted successfully" });
  } catch (error) { next(error); }
});

export default router;
