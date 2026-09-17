// Minimal Self‑Improvement Service stub (required by BaseAgent)
// In production this logs insights to LESSONS.md – here we just store them.
import { silentLogger } from "../utils/silent-logger";
import fs from "fs";
import path from "path";

const LESSONS_PATH = path.resolve(__dirname, "../../LESSONS.md");

export const selfImprovementService = {
  enqueueJob: async (job: any) => {
    // Append a simple entry to LESSONS.md for debugging
    const entry = `\n## Self‑Improvement Log – ${new Date().toISOString()}\n- Persona: ${job.personaId}\n- Prompt: ${job.prompt}\n- Reply: ${job.finalReply}\n`;
    try {
      fs.appendFileSync(LESSONS_PATH, entry, "utf-8");
      silentLogger.info(`[SelfImprovement] Logged job for ${job.personaId}`);
    } catch (e: any) {
      silentLogger.warn(`[SelfImprovement] Failed to write log: ${e.message}`);
    }
  },
};
