import { Router } from "express";
import { macroAiService } from "../services/macro-ai.service";
import { requireAuth } from "../middleware/auth";
import { silentLogger } from "../utils/silent-logger";

const router = Router();

function extractAssistantText(combined: string): string {
  const lines = combined.split(/\r?\n/);
  const parts: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === "data: [DONE]") continue;
    if (!trimmed.startsWith("data:")) continue;
    const payload = trimmed.slice(5).trim();
    try {
      const parsed = JSON.parse(payload);
      const text = parsed.choices?.[0]?.delta?.content || parsed.text;
      if (typeof text === "string" && text.length > 0) {
        parts.push(text);
      }
    } catch {
      // ignore incomplete SSE chunks
    }
  }
  return parts.join("").trim();
}

router.post("/chat", requireAuth, async (req, res) => {
  try {
    const {
      messages,
      currentRegime,
      assets,
      liquidityStatus,
      personaId,
      context,
    } = req.body;

    if (!messages || !Array.isArray(messages)) {
      res
        .status(400)
        .json({ success: false, error: "Format pesan tidak valid" });
      return;
    }

    res.setHeader("Content-Type", "application/json");

    const groqResponse = await macroAiService.chatStream(
      messages,
      currentRegime,
      assets,
      liquidityStatus,
      personaId,
      context,
    );

    const chunks: string[] = [];
    await new Promise<void>((resolve, reject) => {
      groqResponse.data.on("data", (chunk: Buffer) => {
        chunks.push(chunk.toString("utf-8"));
      });
      groqResponse.data.on("end", () => resolve());
      groqResponse.data.on("error", (err: any) => reject(err));
    });

    const combined = chunks.join("");
    const text = extractAssistantText(combined);

    if (!text) {
      res.status(502).json({ success: false, error: "Respons AI kosong" });
      return;
    }

    res.json({ success: true, reply: text });
  } catch (error: any) {
    silentLogger.error("Macro AI Chat Route Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Terjadi kesalahan pada server",
    });
  }
});

router.post("/analyze-regime", requireAuth, async (req, res) => {
  try {
    const { assets, regime, calculatedRegime, liquidityStatus, context } =
      req.body;

    if (!assets || !Array.isArray(assets)) {
      res.status(400).json({ success: false, error: "Data aset tidak valid" });
      return;
    }

    const reasoning = await macroAiService.analyzeRegime(
      assets,
      calculatedRegime || regime,
      liquidityStatus,
      context,
    );
    res.json({ success: true, reasoning });
  } catch (error: any) {
    silentLogger.error("Macro AI Analyze Regime Route Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Terjadi kesalahan pada server",
    });
  }
});

router.post("/analyze-macro-feed", requireAuth, async (req, res) => {
  try {
    const { headline, targetAsset, context } = req.body;

    if (!headline || !targetAsset) {
      res.status(400).json({
        success: false,
        error: "Headline dan target asset diperlukan",
      });
      return;
    }

    const analysis = await macroAiService.analyzeMacroFeed(
      headline,
      targetAsset,
      context,
    );

    if (analysis && typeof analysis === "object") {
      res.json({ success: true, analysis });
    } else {
      res.status(500).json({
        success: false,
        error: "Invalid analysis response from AI service",
      });
    }
  } catch (error: any) {
    silentLogger.error("Macro AI Analyze Feed Route Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Terjadi kesalahan pada server",
    });
  }
});

router.post("/analyze-nexus", requireAuth, async (req, res) => {
  try {
    const { nodesData, context } = req.body;

    if (!nodesData) {
      res
        .status(400)
        .json({ success: false, error: "Data node Nexus diperlukan" });
      return;
    }

    const reasoning = await macroAiService.analyzeNexus(nodesData, context);
    res.json({ success: true, reasoning });
  } catch (error: any) {
    silentLogger.error("Macro AI Analyze Nexus Route Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Terjadi kesalahan pada server",
    });
  }
});

export default router;
