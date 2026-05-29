import { Router } from "express";
import { macroAiService } from "../services/macro-ai.service";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.post("/chat", requireAuth, async (req, res) => {
  try {
    const { messages, currentRegime, assets, liquidityStatus } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ success: false, error: "Format pesan tidak valid" });
      return;
    }

    // Call the streaming service
    await macroAiService.chatStream(messages, res, currentRegime, assets, liquidityStatus);
  } catch (error: any) {
    console.error("Macro AI Chat Route Error:", error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message || "Terjadi kesalahan pada server" });
    }
  }
});

router.post("/analyze-regime", requireAuth, async (req, res) => {
  try {
    const { assets, calculatedRegime, liquidityStatus } = req.body;

    if (!assets || !Array.isArray(assets)) {
      res.status(400).json({ success: false, error: "Data aset tidak valid" });
      return;
    }

    const reasoning = await macroAiService.analyzeRegime(assets, calculatedRegime, liquidityStatus);
    res.json({ success: true, reasoning });
  } catch (error: any) {
    console.error("Macro AI Analyze Regime Route Error:", error);
    res.status(500).json({ success: false, error: error.message || "Terjadi kesalahan pada server" });
  }
});

router.post("/analyze-macro-feed", requireAuth, async (req, res) => {
  try {
    const { headline, targetAsset, context } = req.body;

    if (!headline || !targetAsset) {
      res.status(400).json({ success: false, error: "Headline dan target asset diperlukan" });
      return;
    }

    const analysis = await macroAiService.analyzeMacroFeed(headline, targetAsset, context);
    res.json({ success: true, analysis });
  } catch (error: any) {
    console.error("Macro AI Analyze Feed Route Error:", error);
    res.status(500).json({ success: false, error: error.message || "Terjadi kesalahan pada server" });
  }
});

export default router;
