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

    // Set headers for Server-Sent Events
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // Get the Groq stream from service (already throttled and with retry logic)
    const groqResponse = await macroAiService.chatStream(messages, currentRegime, assets, liquidityStatus);

    // Pipe the Groq stream to the HTTP response manually to ensure immediate flush
    groqResponse.data.on("data", (chunk: Buffer) => {
      res.write(chunk);
      // If the response object has a flush method (e.g., from compression middleware), call it
      if (typeof (res as any).flush === "function") {
        (res as any).flush();
      }
    });

    groqResponse.data.on("end", () => {
      res.end();
    });

    groqResponse.data.on("error", (err: any) => {
      console.error("Groq stream error:", err);
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
      }
    });
  } catch (error: any) {
    console.error("Macro AI Chat Route Error:", error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message || "Terjadi kesalahan pada server" });
    } else {
      // If headers already sent, we can't send JSON, so we send SSE error
      res.write(`data: ${JSON.stringify({ error: error.message || "Terjadi kesalahan pada server" })}\n\n`);
      res.end();
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