import { Router } from "express";
import { analyticsService } from "../services/analytics.service";
import { apiResponse } from "../utils/api-response";
import { requireAuth } from "../middleware/auth";
import { z } from "zod";
import { validate } from "../middleware/validate";
import { riskService } from "../services/risk.service";
import { tradingAccountService } from "../services/trading-account.service";

const router = Router();
router.use(requireAuth);

const activeAccountCheck = async (req: any, res: any, next: any) => {
  try {
    const account = await tradingAccountService.getActiveAccount(req.user.id);
    if (!account) return apiResponse.notFound(res, "Tidak ada akun aktif");
    req.activeAccount = account;
    next();
  } catch(e) { next(e); }
};

router.get("/overview", activeAccountCheck, async (req: any, res, next) => {
  try {
    const data = await analyticsService.getOverview(req.user.id, req.activeAccount.id);
    return apiResponse.success(res, data);
  } catch (error) { next(error); }
});

router.get("/equity-curve", activeAccountCheck, async (req: any, res, next) => {
  try {
    const data = await analyticsService.getEquityCurve(req.user.id, req.activeAccount.id);
    return apiResponse.success(res, data);
  } catch (error) { next(error); }
});

router.get("/risk-status", activeAccountCheck, async (req: any, res, next) => {
  try {
    const data = await riskService.getRiskStatus(req.activeAccount.id, req.user.id);
    return apiResponse.success(res, data);
  } catch (error) { next(error); }
});

export default router;
