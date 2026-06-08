import { Router, Request, Response } from "express";
import { macroAiService } from "../services/macro-ai.service";

const router = Router();

router.post("/observe-playbook", async (req: Request, res: Response) => {
  try {
    const { regime, assets, liquidityStatus, regimeDescription } = req.body as {
      regime: string;
      assets: Array<{ ticker: string; name: string; change: number | null }>;
      liquidityStatus: string;
      regimeDescription: string;
    };

    const allowed = ["Goldilocks", "Reflation", "Stagflation", "Deflation", "Transition"];
    if (!allowed.includes(regime)) {
      return res.status(400).json({ success: false, error: "Invalid regime" });
    }

    const playbook = await macroAiService.observePlaybook(
      regime,
      assets,
      liquidityStatus,
      regimeDescription
    );

    return res.json({ success: true, data: playbook });
  } catch (e: any) {
    console.error("[MacroTerminal] Observe playbook failed:", e);
    return res.status(500).json({ success: false, error: e.message });
  }
});

// Clear cache when regime shifts
router.post("/clear-cache", (_req: Request, res: Response) => {
  macroAiService.clearPlaybookCache();
  res.json({ success: true, message: "Cache cleared" });
});

export default router;
