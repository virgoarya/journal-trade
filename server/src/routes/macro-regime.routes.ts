import { Router } from "express";
import { macroRegimeService } from "../services/macro-regime.service";

const router = Router();

// GET /api/v1/macro-regime/snapshot
router.get("/snapshot", async (req, res) => {
  try {
    const data = await macroRegimeService.getSnapshot();
    res.json({ success: true, data });
  } catch (error: any) {
    console.error("[MacroRegime Route] Error:", error.message);
    res.status(503).json({ success: false, error: error.message });
  }
});

export default router;
