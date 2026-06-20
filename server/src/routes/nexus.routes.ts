import { Router } from "express";
import { nexusService } from "../services/nexus.service";
import { silentLogger } from "../utils/silent-logger";

const router = Router();

/**
 * GET /api/v1/nexus/snapshot
 * Returns aggregated real-time data for all Nexus diagram nodes.
 * Sources: FRED (DXY, Fed Funds, Breakeven, CPI, UMCSENT), Yahoo Finance (Gold), Finnhub (DBC/CRB)
 * UI cache: 5 minutes; volatile Yahoo fields have shorter TTLs.
 */
router.get("/snapshot", async (req, res) => {
  try {
    const snapshot = await nexusService.getSnapshot();
    res.json({ success: true, data: snapshot });
  } catch (error: any) {
    silentLogger.error("[Nexus Route] getSnapshot failed:", error.message);
    res.status(503).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/nexus/refresh
 * Force-refresh all Nexus data (bypasses cache).
 */
router.post("/refresh", async (req, res) => {
  try {
    const snapshot = await nexusService.forceRefresh();
    res.json({ success: true, data: snapshot });
  } catch (error: any) {
    silentLogger.error("[Nexus Route] forceRefresh failed:", error.message);
    res.status(503).json({ success: false, error: error.message });
  }
});

export default router;
