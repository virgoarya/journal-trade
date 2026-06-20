import { Router } from "express";
import { macroRegimeService } from "../services/macro-regime.service";
import { silentLogger } from "../utils/silent-logger";

const router = Router();

router.get("/snapshot", async (req, res) => {
  try {
    const data = await macroRegimeService.getSnapshot();
    res.json({ 
      success: true, 
      data: {
        ...data,
        source: data.source ?? "YAHOO",
      },
      fetchedAt: data.fetchedAt ?? new Date().toISOString(),
      rateLimited: false,
    });
  } catch (error: any) {
    silentLogger.error("[MacroRegime Route] Error:", error.message);
    res.status(503).json({ success: false, error: error.message, rateLimited: true });
  }
});

router.get("/historical", async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const snapshot = await macroRegimeService.getSnapshot();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const data = snapshot.history
      .filter((item) => new Date(item.date) >= cutoff)
      .map((item) => ({
        date: new Date(item.date).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "short",
        }),
        fullDate: item.date,
        quadrant: item.quadrant,
        growthRatio: item.growthRatio,
        growthEma: item.growthEma,
        inflationRatio: item.inflationRatio,
        inflationEma: item.inflationEma,
        liquidityRatio: item.liquidityRatio,
        liquidityEma: item.liquidityEma,
      }));

    res.json({ success: true, data, rateLimited: false });
  } catch (error: any) {
    silentLogger.error("[MacroRegime Route] Historical Error:", error.message);
    res.status(503).json({ success: false, error: error.message, rateLimited: true });
  }
});

export default router;
