import { Router } from "express";
import { tradeService } from "../services/trade.service";
import { tradingAccountService } from "../services/trading-account.service";
import { validate } from "../middleware/validate";
import { logTradeSchema, updateTradeSchema, getTradesQuerySchema } from "../validators/trade.validator";
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
    // Manual validation with defaults
    const limit = parseInt(req.query.limit as string) || 20;
    const page = parseInt(req.query.page as string) || 1;
    const sortBy = (req.query.sortBy as string) || "tradeDate";
    const sortOrder = (req.query.sortOrder as string) || "desc";
    const includeDeleted = req.query.includeDeleted === "true";

    const account = await tradingAccountService.getActiveAccount(req.user.id);
    if (!account) return apiResponse.success(res, [], 200, { page, limit, total: 0 });

    // Build query object explicitly (avoid spreading req.query in Express 5)
    const query: any = { limit, page, sortBy, sortOrder, includeDeleted, tradingAccountId: account.id };
    if (req.query.pair) query.pair = req.query.pair;
    if (req.query.playbookId) query.playbookId = req.query.playbookId;
    if (req.query.result) query.result = req.query.result;

    const { list, count } = await tradeService.getAll(req.user.id, query);
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
    const account = await tradingAccountService.getActiveAccount(req.user.id);
    if (!account) return apiResponse.success(res, []);

    const limit = parseInt(req.query.limit as string) || 5;
    const trades = await tradeService.getRecent(req.user.id, account.id, limit);
    return apiResponse.success(res, trades);
  } catch (error) { next(error); }
});

router.get("/:id", validate({ params: objectIdParamSchema }), async (req, res, next) => {
  try {
    const trade = await tradeService.getById(req.params.id as string, req.user.id);
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
    const account = await tradingAccountService.getActiveAccount(req.user.id);
    if (!account) return apiResponse.success(res, { totalTrades: 0, totalPnL: 0, winRate: 0, avgR: 0 });

    const summary = await tradeService.getSummary(req.user.id, account.id);
    return apiResponse.success(res, summary);
  } catch (error) { next(error); }
});

// Update trade (partial update)
router.patch("/:id", validate({ params: objectIdParamSchema, body: updateTradeSchema }), async (req, res, next) => {
  try {
    const trade = await tradeService.update(req.params.id as string, req.user.id, req.body);
    if (!trade) return apiResponse.notFound(res, "Data trade tidak ditemukan");
    // Transform result enum to lowercase for frontend compatibility
    if (trade) {
      trade.result = trade.result === "WIN" ? "win" : trade.result === "LOSS" ? "loss" : "breakeven";
      trade.direction = trade.direction === "LONG" ? "Long" : "Short";
    }
    return apiResponse.success(res, trade);
  } catch (error) { next(error); }
});

// Get deleted trades
router.get("/deleted", async (req, res, next) => {
  try {
    const account = await tradingAccountService.getActiveAccount(req.user.id);
    if (!account) return apiResponse.success(res, [], 200, { page: 1, limit: 20, total: 0 });

    const limit = parseInt(req.query.limit as string) || 20;
    const page = parseInt(req.query.page as string) || 1;
    const offset = ((page) - 1) * limit;
    const { list, count } = await tradeService.getDeleted(req.user.id, account.id, limit, offset);
    return apiResponse.success(res, list, 200, {
      page,
      limit,
      total: count
    });
  } catch (error) { next(error); }
});

// Restore soft-deleted trade
router.patch("/:id/restore", validate({ params: objectIdParamSchema }), async (req, res, next) => {
  try {
    const restored = await tradeService.restore(req.params.id as string, req.user.id);
    if (!restored) return apiResponse.notFound(res, "Trade tidak ditemukan atau belum dihapus");
    return apiResponse.success(res, { message: "Trade restored successfully" });
  } catch (error) { next(error); }
});

// Delete trade (archive/soft delete)
router.delete("/:id", validate({ params: objectIdParamSchema }), async (req, res, next) => {
  try {
    const reason = req.query.reason as string | undefined;
    const deleted = await tradeService.delete(req.params.id as string, req.user.id, reason);
    if (!deleted) return apiResponse.notFound(res, "Data trade gagal dihapus, mungkin data tidak ditemukan.");
    return apiResponse.success(res, { message: "Trade deleted successfully" });
  } catch (error) { next(error); }
});

// Permanently delete trade (hard delete - irreversible)
router.delete("/:id/permanent", validate({ params: objectIdParamSchema }), async (req, res, next) => {
  try {
    const hardDeleted = await tradeService.hardDelete(req.params.id as string, req.user.id);
    if (!hardDeleted) return apiResponse.notFound(res, "Trade tidak ditemukan atau sudah dihapus permanen.");
    return apiResponse.success(res, { message: "Trade permanently deleted" });
  } catch (error) { next(error); }
});

export default router;
