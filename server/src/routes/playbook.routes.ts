import { Router } from "express";
import { playbookService } from "../services/playbook.service";
import { tradingAccountService } from "../services/trading-account.service";
import { validate } from "../middleware/validate";
import { createPlaybookSchema, updatePlaybookSchema } from "../validators/playbook.validator";
import { objectIdParamSchema } from "../validators/common.validator";
import { apiResponse } from "../utils/api-response";
import { requireAuth } from "../middleware/auth";
import { IPlaybook } from "../models/Playbook";
import { z } from "zod";

const router = Router();
router.use(requireAuth);

/**
 * Standardize Playbook response for frontend
 */
const formatPlaybookResponse = (pb: any) => {
  const doc = pb.toObject ? pb.toObject() : pb;
  return {
    ...doc,
    id: pb.id || pb._id?.toString(),
    markets: pb.markets || [],
    timeframe: pb.timeframe || "",
    methodology: pb.methodology || "ICT",
    marketCondition: pb.marketCondition || "ALL",
    legacyCategory: pb.legacyCategory,
    stats: pb.stats || {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      totalPnL: 0,
      avgRr: 0,
      winRate: 0
    },
    createdAt: pb.createdAt instanceof Date ? pb.createdAt.toISOString().split('T')[0] : pb.createdAt,
    // Explicit technical fields mapping
    ictPoi: pb.ictPoi || "",
    msnrLevel: pb.msnrLevel || "",
    htfKeyLevel: pb.htfKeyLevel || "",
    htfTimeframe: pb.htfTimeframe || "",
    entryTimeframe: pb.entryTimeframe || "",
    entryChecklist: pb.entryChecklist || [],
  };
};

router.post("/", validate({ body: createPlaybookSchema }), async (req, res, next) => {
  try {
    const account = await tradingAccountService.getActiveAccount(req.user.id);
    if (!account) return apiResponse.notFound(res, "Akun trading aktif tidak ditemukan");
    
    const playbook = await playbookService.create(req.user.id, account.id, req.body);
    return apiResponse.success(res, formatPlaybookResponse(playbook), 201);
  } catch (error) { next(error); }
});

router.get("/", async (req, res, next) => {
  try {
    const account = await tradingAccountService.getActiveAccount(req.user.id);
    if (!account) return apiResponse.success(res, []);
    
    const list = await playbookService.getAll(req.user.id, account.id);
    const formatted = list.map(pb => formatPlaybookResponse(pb));
    return apiResponse.success(res, formatted);
  } catch (error) { next(error); }
});

router.get("/:id", validate({ params: objectIdParamSchema }), async (req, res, next) => {
  try {
    const account = await tradingAccountService.getActiveAccount(req.user.id);
    if (!account) return apiResponse.notFound(res, "Akun trading tidak ditemukan");

    const playbook = await playbookService.getById(req.params.id as string, req.user.id, account.id);
    if (!playbook) return apiResponse.notFound(res, "Playbook tidak ditemukan");
    return apiResponse.success(res, formatPlaybookResponse(playbook));
  } catch (error) { next(error); }
});

router.patch("/:id", validate({ params: objectIdParamSchema, body: updatePlaybookSchema }), async (req, res, next) => {
  try {
    const account = await tradingAccountService.getActiveAccount(req.user.id);
    if (!account) return apiResponse.notFound(res, "Akun trading tidak ditemukan");

    const playbook = await playbookService.update(req.params.id as string, req.user.id, account.id, req.body);
    if (!playbook) return apiResponse.notFound(res, "Playbook tidak valid atau gagal update");
    return apiResponse.success(res, formatPlaybookResponse(playbook));
  } catch (error) { next(error); }
});

router.delete("/:id", validate({ params: objectIdParamSchema }), async (req, res, next) => {
  try {
    const account = await tradingAccountService.getActiveAccount(req.user.id);
    if (!account) return apiResponse.notFound(res, "Akun trading tidak ditemukan");

    const archived = await playbookService.archive(req.params.id as string, req.user.id, account.id);
    if (!archived) {
        return apiResponse.notFound(res, "Playbook tidak ditemukan atau sudah dihapus");
    }
    return apiResponse.success(res, { message: "Playbook Diarsipkan" });
  } catch (error) { next(error); }
});

router.post("/:id/duplicate", validate({ params: objectIdParamSchema }), async (req, res, next) => {
  try {
    const account = await tradingAccountService.getActiveAccount(req.user.id);
    if (!account) return apiResponse.notFound(res, "Akun trading tidak ditemukan");

    const duplicated = await playbookService.duplicate(req.params.id as string, req.user.id, account.id);
    if (!duplicated) return apiResponse.notFound(res, "Playbook tidak ditemukan");
    return apiResponse.success(res, formatPlaybookResponse(duplicated), 201);
  } catch (error) { next(error); }
});

// Assign playbook to trade and update stats
router.post("/:id/assign-trade", validate({ params: objectIdParamSchema, body: z.object({ tradeId: z.string() }) }), async (req, res, next) => {
  try {
    const { tradeId } = req.body;
    const playbookId = req.params.id as string;

    const account = await tradingAccountService.getActiveAccount(req.user.id);
    if (!account) return apiResponse.notFound(res, "Akun trading tidak ditemukan");

    const playbook = await playbookService.assignTrade(playbookId, tradeId, req.user.id, account.id);
    if (!playbook) return apiResponse.notFound(res, "Playbook atau trade tidak ditemukan");

    return apiResponse.success(res, formatPlaybookResponse(playbook));
  } catch (error) { next(error); }
});

export default router;
