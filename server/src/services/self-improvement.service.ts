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

  /**
   * Continuous Self-Improvement: Reflect on closed trade outcomes (TP_HIT, SL_HIT, MANUAL)
   * Dispatches reflection to 9Router, extracts persona lessons, and stores in UserAgentMemory.
   */
  reflectOnClosedTrade: async (tradeLog: any) => {
    try {
      const userId = tradeLog.userId;
      if (!userId) return;

      const symbol = tradeLog.signal?.symbol || "UNKNOWN";
      const direction = tradeLog.signal?.direction || "BUY";
      const reason = tradeLog.signal?.reason || "Signal confluence";
      const methodology = tradeLog.signal?.primaryMethodology || "CONFLUENCE";
      const closeReason = tradeLog.closeReason || "MANUAL";
      const pnl = Number(tradeLog.pnl ?? 0);
      const pnlPercent = Number(tradeLog.pnlPercent ?? 0);
      const entry = tradeLog.executionPrice || tradeLog.signal?.entry;
      const exit = tradeLog.closePrice;
      const isWin = pnl > 0;
      const isLoss = pnl < 0;

      const prompt = `Anda adalah Reflection Critic untuk Multi-Agent AI Trading (Hermes Architecture).
Analisis hasil trade tertutup berikut untuk pembelajaran agent:

[DATA HASIL TRADE]
- Symbol: ${symbol} (${direction})
- Entry Price: ${entry} | Close Price: ${exit}
- Hasil: ${closeReason} (PnL: $${pnl.toFixed(2)}, ${pnlPercent}%)
- Alasan Masuk Awal: ${reason}
- Metodologi: ${methodology}
- Status: ${isWin ? "PROFIT (WIN)" : isLoss ? "LOSS (EVALUASI)" : "BREAKEVEN"}

Buat 1 kalimat pelajaran singkat per persona dalam Bahasa Indonesia:
1. HAWK: Batas risiko, invalidation level, atau pengetatan SL.
2. DOVE: Realisasi momentum, follow-through tren, atau target TP.
3. CONTRARIAN: Deteksi sweep likuiditas, fakeout, atau jebakan retail.

Format output WAJIB persis seperti ini:
HAWK: <pelajaran 1 kalimat>
DOVE: <pelajaran 1 kalimat>
CONTRARIAN: <pelajaran 1 kalimat>`;

      let rawOutput = "";
      for (const modelConfig of NINE_ROUTER_MODELS) {
        try {
          const resp = await axios.post(
            `${env.NINE_ROUTER_URL}/chat/completions`,
            {
              model: modelConfig.model,
              messages: [{ role: "user", content: prompt }],
              max_tokens: 300,
              temperature: 0.2,
            },
            {
              headers: {
                Authorization: `Bearer ${env.NINE_ROUTER_API_KEY || "sk-dummy"}`,
                "Content-Type": "application/json",
              },
              timeout: 25000,
            }
          );
          const content = resp.data?.choices?.[0]?.message?.content;
          if (content && content.trim()) {
            rawOutput = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
            break;
          }
        } catch {
          // Fall through to next model in NINE_ROUTER_MODELS
        }
      }

      if (!rawOutput) {
        silentLogger.warn(`[SelfImprovement] 9Router models failed for trade ${symbol} reflection.`);
        return;
      }

      const hawkMatch = rawOutput.match(/HAWK:\s*([^\n]+)/i);
      const doveMatch = rawOutput.match(/DOVE:\s*([^\n]+)/i);
      const contrarianMatch = rawOutput.match(/CONTRARIAN:\s*([^\n]+)/i);

      // Higher confidence for losses so agents prioritize learning from mistakes (ADR-0001)
      const confidence = isLoss ? 0.85 : 0.7;

      if (hawkMatch && hawkMatch[1]?.trim()) {
        const fact = `[${symbol} ${closeReason}] ${hawkMatch[1].trim()}`;
        await userMemoryService.learnPersonaFact(userId, "hawk", fact, "market_insight", confidence);
      }
      if (doveMatch && doveMatch[1]?.trim()) {
        const fact = `[${symbol} ${closeReason}] ${doveMatch[1].trim()}`;
        await userMemoryService.learnPersonaFact(userId, "dove", fact, "market_insight", confidence);
      }
      if (contrarianMatch && contrarianMatch[1]?.trim()) {
        const fact = `[${symbol} ${closeReason}] ${contrarianMatch[1].trim()}`;
        await userMemoryService.learnPersonaFact(userId, "contrarian", fact, "market_insight", confidence);
      }

      await ReflectionLog.create({
        agentType: "consensus",
        userQuery: `Closed Trade ${symbol} ${direction} ${closeReason}`,
        rawOutput,
        wasCorrected: isLoss,
        dataPoint: `${symbol}_PnL`,
        expected: isWin ? "PROFIT" : "AVOID_LOSS",
        actual: closeReason,
      });

      silentLogger.info(
        `[SelfImprovement] Reflected on closed trade ${symbol} (#${tradeLog.mt5Ticket || "N/A"}), updated Hawk/Dove/Contrarian memories.`
      );
    } catch (e: any) {
      silentLogger.warn(`[SelfImprovement] Failed to reflect on closed trade: ${e.message}`);
    }
  },
};
