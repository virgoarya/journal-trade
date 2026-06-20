import { Router, Request, Response } from "express";
import { macroAiService } from "../services/macro-ai.service";
import { requireAuth } from "../middleware/auth";
import { silentLogger } from "../utils/silent-logger";

const router = Router();

router.post(
  "/observe-playbook",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { regime, assets, liquidityStatus, regimeDescription, context } =
        req.body as {
          regime: string;
          assets: Array<{
            ticker: string;
            name: string;
            change: number | null;
          }>;
          liquidityStatus: string;
          regimeDescription: string;
          context?: {
            vix?: string;
            yieldCurve?: string;
            geoRiskTopDriver?: string;
          };
        };

      const allowed = [
        "Goldilocks",
        "Reflation",
        "Stagflation",
        "Deflation",
        "Transition",
      ];
      if (!allowed.includes(regime)) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid regime" });
      }

      const playbook = await macroAiService.observePlaybook(
        regime,
        assets,
        liquidityStatus,
        regimeDescription,
        context,
      );

      return res.json({ success: true, data: playbook });
    } catch (e: any) {
      silentLogger.error("[MacroTerminal] Observe playbook failed:", e);
      return res.status(500).json({ success: false, error: e.message });
    }
  },
);

// Clear cache when regime shifts
router.post("/clear-cache", (_req: Request, res: Response) => {
  macroAiService.clearPlaybookCache();
  res.json({ success: true, message: "Cache cleared" });
});

export default router;
