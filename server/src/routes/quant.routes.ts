import { Router } from "express";
import { quantService } from "../services/quant.service";
import { requireAuth } from "../middleware/auth";
import { silentLogger } from "../utils/silent-logger";

const router = Router();

router.get("/snapshot", async (req, res) => {
  try {
    const data = await quantService.getSnapshot();
    res.json({ success: true, ...data });
  } catch (error: any) {
    silentLogger.error("[Quant Route] getSnapshot failed:", error.message);
    res.status(503).json({ success: false, error: error.message });
  }
});

router.post("/refresh", requireAuth, async (req, res) => {
  try {
    const snapshot = await quantService.forceRefresh();
    res.json({
      success: true,
      data: {
        y3m: snapshot.y3m,
        y2y: snapshot.y2y,
        y5: snapshot.y5,
        y10: snapshot.y10,
        y30: snapshot.y30,
        spread10y2y: snapshot.spread10y2y,
        spread10y3m: snapshot.spread10y3m,
        spread30y5y: snapshot.spread30y5y,
        spread30y3m: snapshot.spread30y3m,
        inverted: snapshot.inverted,
        vix: snapshot.vix,
        vixSource: snapshot.vixSource,
        regime: snapshot.regime,
        curveRegime: snapshot.curveRegime,
      },
      fetchedAt: snapshot.fetchedAt,
      fromCache: false,
    });
  } catch (error: any) {
    silentLogger.error("[Quant Route] forceRefresh failed:", error.message);
    res.status(503).json({ success: false, error: error.message });
  }
});

router.get("/vix", async (req, res) => {
  try {
    const data = await quantService.refreshVix();
    res.json({ success: true, data });
  } catch (error: any) {
    silentLogger.error("[Quant Route] refreshVix failed:", error.message);
    res.status(503).json({ success: false, error: error.message });
  }
});

export default router;
