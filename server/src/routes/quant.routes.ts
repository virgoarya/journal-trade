import { Router } from "express";
import { quantService } from "../services/quant.service";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/snapshot", async (req, res) => {
  try {
    const data = await quantService.getSnapshot();
    res.json({ success: true, ...data });
  } catch (error: any) {
    console.error("[Quant Route] getSnapshot failed:", error.message);
    res.status(503).json({ success: false, error: error.message });
  }
});

router.post("/refresh", requireAuth, async (req, res) => {
  try {
    const snapshot = await quantService.forceRefresh();
    res.json({
      success: true,
      data: {
        y2: snapshot.y2,
        y5: snapshot.y5,
        y10: snapshot.y10,
        spread2y10y: snapshot.spread2y10y,
        inverted: snapshot.inverted,
        vix: snapshot.vix,
        regime: snapshot.regime,
      },
      fetchedAt: snapshot.fetchedAt,
      fromCache: false,
    });
  } catch (error: any) {
    console.error("[Quant Route] forceRefresh failed:", error.message);
    res.status(503).json({ success: false, error: error.message });
  }
});

export default router;
