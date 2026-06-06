import { Router } from "express";
import { geoRiskService } from "../services/geo-risk.service";
import { requireAuth } from "../middleware/auth";

const router = Router();

/**
 * GET /api/v1/geo-risk
 * Returns latest Geo-Risk scores (from MongoDB cache or fresh FRED fetch).
 */
router.get("/", async (req, res) => {
  try {
    const data = await geoRiskService.getScores();
    res.json({ success: true, data });
  } catch (error: any) {
    console.error("[GeoRisk Route] getScores failed:", error.message);
    res.status(503).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/geo-risk/refresh
 * Force-refreshes the Geo-Risk snapshot (requires auth).
 */
router.post("/refresh", requireAuth, async (req, res) => {
  try {
    const snapshot = await geoRiskService.forceRefresh();
    res.json({
      success: true,
      message: "Geo-Risk snapshot refreshed from FRED APIs.",
      data: {
        scores: snapshot.scores,
        fetchedAt: snapshot.fetchedAt,
      },
    });
  } catch (error: any) {
    console.error("[GeoRisk Route] forceRefresh failed:", error.message);
    res.status(503).json({ success: false, error: error.message });
  }
});

export default router;
