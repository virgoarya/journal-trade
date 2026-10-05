import { Router } from "express";
import { macroAiService } from "../services/macro-ai.service";
import { vectorMemoryService } from "../services/vector-memory.service";
import { selfImprovementService } from "../services/self-improvement.service";
import { requireAuth } from "../middleware/auth";
import { silentLogger } from "../utils/silent-logger";
import { marketDataService } from "../services/market-data.service";
import { userMemoryService } from "../services/user-memory.service";
import { resolveProfileForUser } from "../lib/agent/profile-repo";
import { ChatSession } from "../models/ChatSession";
import { ReflectionLog } from "../models/ReflectionLog";

const router = Router();

// Root POST handler — langsung handle chat request (dipanggil frontend sebagai /api/v1/chat)
router.post("/", requireAuth, async (req, res) => {
  try {
    const {
      messages,
      currentRegime,
      assets,
      liquidityStatus,
      personaId,
      context,
      sessionId,
      userId,
    } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, error: "Messages array required" });
    }

    const authUserId = (req as any).user?.id;
    const actualUserId = userId || authUserId;

    // Auto-save user name if available
    const userName = (req as any).user?.name || (req as any).user?.email || "";
    if (actualUserId && userName) {
      userMemoryService.ensureName(actualUserId, userName).catch(() => {});
    }

    // Fetch user memory context
    let userMemory = "";
    const targetUserId = actualUserId || "default_user";

    userMemory = await userMemoryService.getPromptContext(
      targetUserId,
      personaId || "hawk"
    );

    // Check if we need to ask for user's name (first interaction, no name stored)
    const memoryRecord = await userMemoryService.getOrCreate(targetUserId);
    const isFirstInteraction = !memoryRecord.name || memoryRecord.interactionCount === 0;
    const needsNamePrompt = isFirstInteraction && (!userName || userName === "");

    // If first interaction and no name, inject instruction to ask for name
    let namePromptInstruction = "";
    if (needsNamePrompt) {
      namePromptInstruction = `
[INSTRUKSI KHUSUS - INTERAKSI PERTAMA]:
User ini BELUM memiliki nama tersimpan. WAJIB tanyakan nama mereka dengan ramah di awal respons: "Halo! Sebelum kita mulai, bolehkah saya tahu nama panggilan Anda?". Simpan nama tersebut via tool/learning sistem. JANGAN lanjutkan analisis sebelum tau nama mereka.`;
    }

    // Call AI service with SSOT data + Memories + Critic Pass
    const groqResponse = await macroAiService.chatStream(
      messages,
      currentRegime,
      assets,
      liquidityStatus,
      personaId || "hawk",
      targetUserId,
      context
    );

    const text =
      typeof groqResponse === "string"
        ? groqResponse
        : (groqResponse as any).text;
    const toolsUsed =
      typeof groqResponse === "object" && (groqResponse as any).toolsUsed
        ? (groqResponse as any).toolsUsed
        : [];

    if (!text) {
      return res.status(502).json({ success: false, error: "AI response empty" });
    }

    // Save to chat session if provided
    if (sessionId) {
      const lastUserMsg = messages[messages.length - 1];
      await ChatSession.updateOne(
        { _id: sessionId },
        {
          $push: {
            messages: {
              role: lastUserMsg.role === "assistant" ? "user" : lastUserMsg.role,
              content: lastUserMsg.content,
            },
          },
          $set: { updatedAt: new Date() },
        }
      );

      // Also save assistant response
      await ChatSession.updateOne(
        { _id: sessionId },
        {
          $push: { messages: { role: "assistant", content: text } },
          $set: { updatedAt: new Date() },
        }
      );
    }

    res.json({ success: true, reply: text, toolsUsed });
  } catch (error: any) {
    silentLogger.error("[Macro AI Chat Route Error]:", error);
    res.status(500).json({ success: false, error: error.message || "Server error" });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// PHASE 3: Hermes Profile endpoint — dipakai frontend untuk badge identitas & memory
// ──────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/chat/profile
 * Return profil user (preferredName, persona, memory facts count) untuk UI badge.
 */
router.get("/profile", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id || "default_user";
    const data = await resolveProfileForUser(userId);
    const profile = data?.profile;

    return res.json({
      success: true,
      profile: profile
        ? {
            userId: profile.userId,
            preferredName: profile.preferredName,
            displayName: profile.displayName,
            legalName: profile.legalName,
            tradingStyles: profile.tradingStyles,
            favoriteAssets: profile.favoriteAssets,
            riskTolerance: profile.riskTolerance,
            agentPersona: profile.agentPersona,
          }
        : null,
      factsCount: data?.notes?.length ?? 0,
    });
  } catch (e: any) {
    silentLogger.error("[Chat Routes] Get profile failed:", e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// PHASE 4 ROUTES: Session Management & Streaming API
// ──────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/chat/sessions
 * Get all chat sessions for current user
 */
router.get("/sessions", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const sessions = await ChatSession.find({ userId })
      .sort({ updatedAt: -1 })
      .select("-messages") // Exclude full message arrays for list view
      .lean();

    res.json({ success: true, sessions });
  } catch (e: any) {
    silentLogger.error("[Chat Routes] Get sessions failed:", e);
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * POST /api/v1/chat/session
 * Create new chat session
 */
router.post("/session", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { agentType, title } = req.body;

    const session = await ChatSession.create({
      userId,
      agentType: agentType || "hawk",
      title: title || "Chat Baru",
    });

    res.json({ success: true, sessionId: session._id });
  } catch (e: any) {
    silentLogger.error("[Chat Routes] Create session failed:", e);
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * GET /api/v1/chat/session/:sessionId/messages
 * Get messages for a specific session
 */
router.get("/session/:sessionId/messages", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { sessionId } = req.params;

    const session = await ChatSession.findOne({ _id: sessionId, userId }).lean();
    if (!session) {
      return res.status(404).json({ success: false, error: "Session not found" });
    }

    res.json({ success: true, messages: session.messages || [] });
  } catch (e: any) {
    silentLogger.error("[Chat Routes] Get messages failed:", e);
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * POST /api/v1/chat
 * Main chat endpoint with SSOT injection and Critic Pass
 */
router.post("/chat", requireAuth, async (req, res) => {
  try {
    const {
      messages,
      currentRegime,
      assets,
      liquidityStatus,
      personaId,
      context,
      sessionId,
      userId,
    } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, error: "Messages array required" });
    }

    const authUserId = (req as any).user?.id;
    const actualUserId = userId || authUserId;

    // Auto-save user name if available
        const userName = req.user?.name || req.user?.email || "";
        if (actualUserId && userName) {
          userMemoryService.ensureName(actualUserId, userName).catch(() => {});
        }

        // Fetch user memory context
        let userMemory = "";
        const targetUserId = actualUserId || "default_user";
    
        userMemory = await userMemoryService.getPromptContext(
          targetUserId,
          personaId || "hawk"
        );

        // Check if we need to ask for user's name (first interaction, no name stored)
        const memoryRecord = await userMemoryService.getOrCreate(targetUserId);
        const isFirstInteraction = !memoryRecord.name || memoryRecord.interactionCount === 0;
        const needsNamePrompt = isFirstInteraction && (!userName || userName === "");
    
        // If first interaction and no name, inject instruction to ask for name
        let namePromptInstruction = "";
        if (needsNamePrompt) {
          namePromptInstruction = `\n\n[INSTRUKSI KHUSUS - INTERAKSI PERTAMA]:\nUser ini BELUM memiliki nama tersimpan. WAJIB tanyakan nama mereka dengan ramah di awal respons: "Halo! Sebelum kita mulai, bolehkah saya tahu nama panggilan Anda?". Simpan nama tersebut via tool/learning sistem. JANGAN lanjutkan analisis sebelum tau nama mereka.`;
        }

        // Call AI service with SSOT data + Memories + Critic Pass
                const groqResponse = await macroAiService.chatStream(
                  messages,
                  currentRegime,
                  assets,
                  liquidityStatus,
                  personaId || "hawk",
                  targetUserId,
                  context
                );

    const text =
      typeof groqResponse === "string"
        ? groqResponse
        : (groqResponse as any).text;
    const toolsUsed =
      typeof groqResponse === "object" && (groqResponse as any).toolsUsed
        ? (groqResponse as any).toolsUsed
        : [];

    if (!text) {
      return res.status(502).json({ success: false, error: "AI response empty" });
    }

    // Save to chat session if provided
    if (sessionId) {
      const lastUserMsg = messages[messages.length - 1];
      await ChatSession.updateOne(
        { _id: sessionId },
        {
          $push: {
            messages: {
              role: lastUserMsg.role === "assistant" ? "user" : lastUserMsg.role,
              content: lastUserMsg.content,
            },
          },
          $set: { updatedAt: new Date() },
        }
      );

      // Also save assistant response
      await ChatSession.updateOne(
        { _id: sessionId },
        {
          $push: { messages: { role: "assistant", content: text } },
          $set: { updatedAt: new Date() },
        }
      );
    }

    res.json({ success: true, reply: text, toolsUsed });
  } catch (error: any) {
    silentLogger.error("[Macro AI Chat Route Error]:", error);
    res.status(500).json({ success: false, error: error.message || "Server error" });
  }
});

/**
 * GET /api/v1/chat/reflections
 * Get recent reflection logs (for debugging/audit)
 */
router.get("/reflections", requireAuth, async (req, res) => {
  try {
    const logs = await ReflectionLog.find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({ success: true, logs });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// Existing Macro Routes
// ──────────────────────────────────────────────────────────────────────────────

router.post("/analyze-regime", requireAuth, async (req, res) => {
  try {
    const { assets, regime, calculatedRegime, liquidityStatus, context } = req.body;

    if (!assets || !Array.isArray(assets)) {
      return res.status(400).json({ success: false, error: "Data aset tidak valid" });
    }

    const reasoning = await macroAiService.analyzeRegime(
      assets,
      calculatedRegime || regime,
      liquidityStatus,
      context
    );
    res.json({ success: true, reasoning });
  } catch (error: any) {
    silentLogger.error("[Macro AI Analyze Regime Route Error]:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/analyze-macro-feed", requireAuth, async (req, res) => {
  try {
    const { headline, targetAsset, context } = req.body;

    if (!headline || !targetAsset) {
      return res.status(400).json({
        success: false,
        error: "Headline dan target asset diperlukan",
      });
    }

    const analysis = await macroAiService.analyzeMacroFeed(
      headline,
      targetAsset,
      context
    );

    if (analysis && typeof analysis === "object") {
      marketDataService.updateNewsAnalysis(headline, analysis);
      res.json({ success: true, analysis });
    } else {
      res.status(500).json({
        success: false,
        error: "Invalid analysis response from AI service",
      });
    }
  } catch (error: any) {
    silentLogger.error("[Macro AI Analyze Feed Route Error]:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/analyze-nexus", requireAuth, async (req, res) => {
  try {
    const { nodesData, context } = req.body;

    if (!nodesData) {
      return res.status(400).json({ success: false, error: "Data node Nexus diperlukan" });
    }

    const reasoning = await macroAiService.analyzeNexus(nodesData, context);
    res.json({ success: true, reasoning });
  } catch (error: any) {
    silentLogger.error("[Macro AI Analyze Nexus Route Error]:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;