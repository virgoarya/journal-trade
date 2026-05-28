import { Router } from "express";
import { macroAiService } from "../services/macro-ai.service";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.post("/chat", requireAuth, async (req, res) => {
  try {
    const { messages } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ success: false, error: "Format pesan tidak valid" });
      return;
    }

    // Call the streaming service
    await macroAiService.chatStream(messages, res);
  } catch (error: any) {
    console.error("Macro AI Chat Route Error:", error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message || "Terjadi kesalahan pada server" });
    }
  }
});

export default router;
