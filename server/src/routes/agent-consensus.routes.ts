import { Router, Request, Response } from "express";
import { agentConsensusService } from "../services/agent-consensus.service";
import { proactiveAlertService } from "../services/proactive-alert.service";
import { deepResearchService } from "../services/deep-research.service";
import { silentLogger } from "../utils/silent-logger";
import { requireAuth } from "../middleware/auth";

const router = Router();

// PENTING: tanpa requireAuth, `req.user` selalu undefined → filter userId di
// endpoint proactive tidak pernah diterapkan → semua user melihat insight yang
// sama. Middleware ini WAJIB supaya insight benar-benar terpisah per user.
router.use(requireAuth);

/**
 * POST /v1/agent-consensus/deep-research
 * Jalankan siklus thinking kritis tingkat tinggi.
 */
router.post("/v1/agent-consensus/deep-research", async (req: Request, res: Response) => {
  try {
    silentLogger.info(`[API] Triggering Deep Research cycle`);
    const results = await deepResearchService.runDeepResearch();
    return res.status(200).json({ success: true, data: results });
  } catch (error: any) {
    silentLogger.error(`[API] Deep Research error: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /v1/agent-consensus/insights
 * Ambil riwayat insight terbaru — MILIK USER yang login.
 */
router.get("/v1/agent-consensus/insights", async (req: Request, res: Response) => {
  try {
    const { type = "proactive", personaId, limit = 10 } = req.query;
    const userId = (req as any).user?.id;
    const filter: any = {};
    if (type) filter.insightType = type;
    if (personaId) filter.personaId = personaId;
    // Filter per-user supaya tidak menampilkan insight milik user lain
    if (userId) filter.userId = userId;

    const insights = await (await import("../models/AgentInsight")).AgentInsight.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .lean();

    return res.status(200).json({ success: true, data: insights });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /v1/agent-consensus
 * MODE: parallel (default) atau sequential
 * Body: { prompt: string, context?: any, mode?: "parallel" | "sequential" }
 */
router.post("/v1/agent-consensus", async (req: Request, res: Response) => {
  try {
    const { prompt, context, mode = "parallel" } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const userId = (req as any).user?.id || "default_user";
    const enrichedContext = { ...(context || {}), userId };

    silentLogger.info(`[API] Agent consensus request (${mode}) for ${userId}`);

    const result = mode === "sequential"
      ? await agentConsensusService.runSequentialDebate(prompt, enrichedContext)
      : await agentConsensusService.runParallelDebate(prompt, enrichedContext);

    silentLogger.info(`[API] Agent consensus completed. Mode: ${mode}`);
    return res.status(200).json(result);
  } catch (error: any) {
    silentLogger.error(`[API] Agent consensus error: ${error.message}`);
    return res.status(500).json({ error: "Gagal menjalankan debate agent: " + error.message });
  }
});

/**
 * POST /v1/agent-consensus/parallel
 */
router.post("/parallel", async (req: Request, res: Response) => {
  try {
    const { prompt, context } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });
    const result = await agentConsensusService.runParallelDebate(prompt, context || {});
    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /parallel
 */
router.post("/sequential", async (req: Request, res: Response) => {
  try {
    const { prompt, context } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });
    const result = await agentConsensusService.runSequentialDebate(prompt, context || {});
    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /v1/agent-consensus/debate
 * Sequential debate chain (Hawk → Dove → Contrarian → Consensus)
 * Body: { prompt: string, context?: any }
 */
router.post("/v1/agent-consensus/debate", async (req: Request, res: Response) => {
  try {
    const { prompt, context } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    silentLogger.info(`[API] Sequential debate request`);
    const userId = (req as any).user?.id || "default_user";
    const enrichedContext = { ...(context || {}), userId };
    const result = await agentConsensusService.runSequentialDebate(prompt, enrichedContext);
    return res.status(200).json(result);
  } catch (error: any) {
    silentLogger.error(`[API] Sequential debate error: ${error.message}`);
    return res.status(500).json({ error: "Gagal menjalankan sequential debate: " + error.message });
  }
});

/**
 * POST /v1/agent-consensus/single/:persona
 * Jalankan satu agent saja
 * Body: { prompt: string, context?: any }
 * Params: persona = hawk | dove | contrarian
 */
router.post("/v1/agent-consensus/single/:persona", async (req: Request, res: Response) => {
  try {
    const { persona } = req.params;
    const { prompt, context } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }
    if (!["hawk", "dove", "contrarian"].includes(persona as string)) {
      return res.status(400).json({ error: "Persona harus: hawk, dove, atau contrarian" });
    }

    silentLogger.info(`[API] Single agent request: ${persona}`);
    const userId = (req as any).user?.id || "default_user";
    const enrichedContext = { ...(context || {}), userId };
    const result = await agentConsensusService.runSingleAgent(persona as string, prompt, enrichedContext);
    return res.status(200).json(result);
  } catch (error: any) {
    silentLogger.error(`[API] Single agent error: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /v1/agent-consensus/proactive
 * Get latest proactive insights MILIK USER yang login (difilter by userId).
 * Query: ?limit=10
 */
router.get("/v1/agent-consensus/proactive", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const userId = (req as any).user?.id;
    const insights = await proactiveAlertService.getLatestInsights(limit, userId);
    return res.status(200).json({ success: true, data: insights });
  } catch (error: any) {
    silentLogger.error(`[API] Proactive insights error: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /v1/agent-consensus/proactive/latest
 * Get latest 1 insight per agent (terbaru) — untuk user yang login.
 */
router.get("/v1/agent-consensus/proactive/latest", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const insights = await proactiveAlertService.getLatestPerAgent(userId);
    return res.status(200).json({ success: true, data: insights });
  } catch (error: any) {
    silentLogger.error(`[API] Latest proactive insights error: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /v1/agent-consensus/proactive/run
 * Trigger proactive analysis cycle manually
 */
router.post("/v1/agent-consensus/proactive/run", async (req: Request, res: Response) => {
  try {
    silentLogger.info(`[API] Manual proactive cycle triggered`);
    // Run async - don't wait
    proactiveAlertService.runCycle();
    return res.status(202).json({ success: true, message: "Proactive cycle dimulai" });
  } catch (error: any) {
    silentLogger.error(`[API] Proactive run error: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
