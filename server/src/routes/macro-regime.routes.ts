import { Router } from "express";
import { macroRegimeService } from "../services/macro-regime.service";
import { YieldCurveSnapshot } from "../models/YieldCurveSnapshot";

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

// GET /api/v1/macro-regime/historical?days=30
router.get("/historical", async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const snapshots = await YieldCurveSnapshot.find(
      { source: "api", fetchedAt: { $gte: cutoff } },
      {},
      { sort: { fetchedAt: 1 } }
    ).lean();

    const data = snapshots.map((s: any) => ({
      date: new Date(s.fetchedAt).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
      }),
      fullDate: s.fetchedAt,
      y5: s.y5,
      y10: s.y10,
      y30: s.y30,
      spread5y30y: s.spread5y30y,
    }));

    res.json({ success: true, data });
  } catch (error: any) {
    console.error("[MacroRegime Route] Historical Error:", error.message);
    res.status(503).json({ success: false, error: error.message });
  }
});

export default router;
