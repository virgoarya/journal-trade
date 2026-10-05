import { ReflectionLog } from "../models/ReflectionLog";
import { userMemoryService } from "./user-memory.service";
import { silentLogger } from "../utils/silent-logger";
import axios from "axios";
import { env } from "../config/env";
import { NINE_ROUTER_MODELS } from "../config/llm-models.config";

export interface IReflexionJob {
  personaId: string;
  userId?: string;
  prompt: string;
  finalReply: string;
  wasCorrected?: boolean;
  dataPoint?: string;
  expected?: string;
  actual?: string;
  correctedReply?: string;
}

export const selfImprovementService = {
  /**
   * Log reflection data for post-execution critic & continuous self-learning
   */
  enqueueJob: async (job: IReflexionJob) => {
    try {
      const log = await ReflectionLog.create({
        agentType: (job.personaId as any) || "default",
        userQuery: job.prompt || "",
        rawOutput: job.finalReply || "",
        correctedOutput: job.correctedReply || "",
        wasCorrected: !!job.wasCorrected,
        dataPoint: job.dataPoint || "",
        expected: job.expected || "",
        actual: job.actual || "",
      });

      silentLogger.info(
        `[SelfImprovement] Logged reflection for ${job.personaId} (wasCorrected=${log.wasCorrected})`
      );

      // If a correction was made (e.g. CPI mismatch), instantly learn a memory rule for that user/persona
      if (job.wasCorrected && job.userId && job.dataPoint) {
        const factText = `RULE PERBAIKAN: Angka ${job.dataPoint} WAJIB persis ${job.expected}% (bukan ${job.actual}%).`;
        await userMemoryService.learnPersonaFact(
          job.userId,
          job.personaId,
          factText,
          "market_insight"
        );
      }
    } catch (e: any) {
      silentLogger.warn(`[SelfImprovement] Failed to log reflection: ${e.message}`);
    }
  },

  /**
   * Run nightly learning cycle: batch process un-reflected discrepancies
   * and distill them into permanent Agent System Rules
   */
  runNightlyReflectionCycle: async (userId: string = "system") => {
    try {
      const unhandled = await ReflectionLog.find({ wasCorrected: true })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();

      if (unhandled.length === 0) {
        silentLogger.info("[SelfImprovement] No discrepancies to reflect upon.");
        return { success: true, message: "No discrepancies found" };
      }

      const summaryText = unhandled
        .map(
          (u) =>
            `- Persona ${u.agentType}: ${u.dataPoint || "Data"} expected ${u.expected} but generated ${u.actual}. Query: "${u.userQuery.slice(0, 80)}"`
        )
        .join("\n");

      const prompt = `Analisis log kesalahan halusinasi angka/data dari AI agent berikut:
${summaryText}

Buat 1-3 aturan singkat (System Rules) dalam Bahasa Indonesia agar agent tidak mengulangi kesalahan konsistensi data tersebut.`;

      let newRule = "";
      for (const modelConfig of NINE_ROUTER_MODELS) {
        try {
          const resp = await axios.post(
            `${env.NINE_ROUTER_URL}/chat/completions`,
            {
              model: modelConfig.model,
              messages: [{ role: "user", content: prompt }],
              max_tokens: 500,
              temperature: 0.2,
            },
            {
              headers: {
                Authorization: `Bearer ${env.NINE_ROUTER_API_KEY || "sk-dummy"}`,
                "Content-Type": "application/json",
              },
              timeout: 20000,
            }
          );
          const content = resp.data?.choices?.[0]?.message?.content;
          if (content && content.trim()) {
            newRule = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
            break;
          }
        } catch {
          // try next
        }
      }

      if (newRule) {
        await userMemoryService.learnFact(userId, `[NIGHTLY REFLECTION] ${newRule}`);
        silentLogger.info(`[SelfImprovement] Nightly reflection learned rule: ${newRule}`);
        return { success: true, newRule };
      }

      return { success: false, error: "Failed to generate reflection rule" };
    } catch (e: any) {
      silentLogger.error("[SelfImprovement] Nightly cycle error:", e);
      return { success: false, error: e.message };
    }
  },
};
