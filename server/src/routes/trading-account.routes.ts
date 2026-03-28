import { Router } from "express";
import { tradingAccountService } from "../services/trading-account.service";
import { validate } from "../middleware/validate";
import { createTradingAccountSchema, updateTradingAccountSchema, updateRiskRulesSchema } from "../validators/trading-account.validator";
import { apiResponse } from "../utils/api-response";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

router.get("/active", async (req, res, next) => {
  try {
    const account = await tradingAccountService.getActiveAccount(req.user.id);
    if (!account) return apiResponse.notFound(res, "Akun trading aktif tidak ditemukan");
    return apiResponse.success(res, account);
  } catch (error) { next(error); }
});

router.post("/", validate({ body: createTradingAccountSchema }), async (req, res, next) => {
  try {
    const account = await tradingAccountService.create(req.user.id, req.body);
    return apiResponse.success(res, account, 201);
  } catch (error) { next(error); }
});

router.patch("/:id", validate({ body: updateTradingAccountSchema }), async (req, res, next) => {
  try {
    const account = await tradingAccountService.updateInfo(req.params.id, req.user.id, req.body);
    return apiResponse.success(res, account);
  } catch (error) { next(error); }
});

router.patch("/:id/risk-rules", validate({ body: updateRiskRulesSchema }), async (req, res, next) => {
  try {
    const account = await tradingAccountService.updateRiskRules(req.params.id, req.user.id, req.body);
    return apiResponse.success(res, account);
  } catch (error) { next(error); }
});

// NOTE: Reset data route will be implemented in settings.routes.ts

export default router;
