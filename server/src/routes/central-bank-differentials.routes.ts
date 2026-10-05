import { Router } from "express";
import { centralBankDifferentialsService } from "../services/central-bank-differentials.service";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

/**
 * GET /v1/central-bank-differentials
 * Returns FX Central Bank Differentials Table
 */
router.get("/", async (req, res, next) => {
  try {
    const differentials = await centralBankDifferentialsService.getDifferentials();
    res.json({ success: true, data: differentials });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
