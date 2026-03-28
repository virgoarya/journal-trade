import { Router } from "express";
import { apiResponse } from "../utils/api-response";
import { requireAuth } from "../middleware/auth";
import { exportService } from "../services/export.service";
import { tradingAccountService } from "../services/trading-account.service";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { trade, tradingAccount, playbook } from "../db/schema";

const router = Router();
router.use(requireAuth);

router.get("/profile", async (req, res) => {
  // Return Better Auth session user
  return apiResponse.success(res, req.user);
});

router.get("/export/csv", async (req, res, next) => {
  try {
    const csvContent = await exportService.getCsvData(req.user.id);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="hunter_trades_${new Date().toISOString().slice(0,10)}.csv"`);
    res.status(200).send(csvContent);
  } catch (error) { next(error); }
});

router.post("/reset-data", async (req, res, next) => {
  try {
    const userId = req.user.id;
    // WARNING: Destructive operation
    await db.transaction(async (tx) => {
      await tx.delete(trade).where(eq(trade.userId, userId));
      await tx.delete(playbook).where(eq(playbook.userId, userId));
      await tx.delete(tradingAccount).where(eq(tradingAccount.userId, userId));
    });

    return apiResponse.success(res, { message: "Seluruh data trading dan pengaturan berhasil dihapus" });
  } catch (error) { next(error); }
});

export default router;
