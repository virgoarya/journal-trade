import { Router, Request, Response } from "express";
import { agentConsensusService } from "../services/agent-consensus.service";
import { proactiveAlertService } from "../services/proactive-alert.service";
import { silentLogger } from "../utils/silent-logger";

const router = Router();

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

    silentLogger.info(`[API] Agent consensus request (${mode})`);

    const result = mode === "sequential"
      ? await agentConsensusService.runSequentialDebate(prompt, context || {})
      : await agentConsensusService.runParallelDebate(prompt, context || {});

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
    const result = await agentConsensusService.runSequentialDebate(prompt, context || {});
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
    if (!["hawk", "dove", "contrarian"].includes(persona)) {
      return res.status(400).json({ error: "Persona harus: hawk, dove, atau contrarian" });
    }

    silentLogger.info(`[API] Single agent request: ${persona}`);
    const result = await agentConsensusService.runSingleAgent(persona, prompt, context || {});
    return res.status(200).json(result);
  } catch (error: any) {
    silentLogger.error(`[API] Single agent error: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /v1/agent-consensus/proactive
 * Get latest proactive insights dari semua agent
 * Query: ?limit=10
 */
router.get("/v1/agent-consensus/proactive", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const insights = await proactiveAlertService.getLatestInsights(limit);
    return res.status(200).json({ success: true, data: insights });
  } catch (error: any) {
    silentLogger.error(`[API] Proactive insights error: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /v1/agent-consensus/proactive/latest
 * Get latest 1 insight per agent (terbaru)
 */
router.get("/v1/agent-consensus/proactive/latest", async (req: Request, res: Response) => {
  try {
    const insights = await proactiveAlertService.getLatestPerAgent();
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
