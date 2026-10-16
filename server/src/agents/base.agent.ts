import axios from "axios";
import { env } from "../config/env";
import { NINE_ROUTER_MODELS } from "../config/llm-models.config";
import { silentLogger } from "../utils/silent-logger";
import { selfImprovementService } from "../services/self-improvement.service";
import { userMemoryService } from "../services/user-memory.service";
import { toolRegistryService } from "../services/tool-registry.service";

export interface AgentContext {
  currentRegime?: string;
  liquidityStatus?: string;
  assets?: any[];
  macroData?: any;
  userId?: string;
  enrichedContext?: Record<string, any>;
}

export abstract class BaseAgent {
  abstract name: string;
  abstract personaId: string;
  abstract systemPrompt: string;

  async think(userPrompt: string, context: AgentContext): Promise<{ reply: string; toolsUsed: string[]; failed?: boolean }> {
    // Jalankan tools berdasarkan prompt secara otomatis
    const { enrichedContext, toolsUsed } = await toolRegistryService.runToolsForPrompt(userPrompt, context);

    // Load user memory (general + persona-specific)
    const targetUserId = context.userId || "default_user";
    const userMemory = await userMemoryService.getPromptContext(targetUserId, this.personaId);

    // Build contextual prompt yang menyertakan hasil tool
    const enrichedPrompt = `
[MEMORI USER]
${userMemory}

[CONTEXT MAKRO INTERNAL]
Regime: ${context.currentRegime || "Unknown"}
Liquidity: ${context.liquidityStatus || "Unknown"}
Assets: ${JSON.stringify(context.assets || [])}

[DATA TERBARU DARI TOOLS (MARKET PRICE, KALENDER, DLL)]
${JSON.stringify(enrichedContext, null, 2)}

[PERTANYAAN USER]
${userPrompt}
`;

    let replyText: string | null = null;
    const messages = [
      { role: "system", content: this.systemPrompt },
      { role: "user", content: enrichedPrompt }
    ];

    for (const modelConfig of NINE_ROUTER_MODELS) {
      try {
        const response = await axios.post(
                  `${env.NINE_ROUTER_URL}/chat/completions`,
                  {
                    model: modelConfig.model,
                    messages,
                    max_tokens: 1500,
                    temperature: 0.3,
                  },
                  {
                    timeout: 45000,
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${env.NINE_ROUTER_API_KEY || "sk-dummy"}`,
                    },
                  }
                );
        const content = response.data?.choices?.[0]?.message?.content;
        if (content && content.trim()) {
          replyText = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
          break;
        }
      } catch (err: any) {
        silentLogger.warn(`[Agent ${this.name}] ${modelConfig.name} failed: ${err.message}`);
      }
    }

    // Kalau semua model gagal, JANGAN simpan pesan error sebagai insight.
    // Pesan error bukan analisis — menyimpannya membuat feed penuh sampah
    // dan user mengira agent benar-benar menganalisis.
    if (!replyText) {
      silentLogger.warn(`[Agent ${this.name}] Semua model gagal — insight dilewati.`);
      return { reply: "", toolsUsed, failed: true };
    }

    // Clean artifacts — aggressively strip ALL meta-language
    replyText = replyText
      // Strip "Pilihan malas:" / "Alternatif malas:" / "Alternatif lebih malas:"
      .replace(/(?:Pilihan|Alternatif)\s*(?:lebih\s*)?malas:[^\n]*/gi, "")
      // Strip ponytail (with or without // prefix)
      .replace(/(?:\/\/\s*)?ponytail:?[^\n]*/gi, "")
      // Strip "skipped:" lines
      .replace(/(?:→\s*)?skipped:\s*[^\n]*/gi, "")
      // Strip "Add when:" developer notes
      .replace(/Add when:[^\n]*/gi, "")
      // Strip code blocks (```python ... ```)
      .replace(/```[a-z]*[\s\S]*?```/gi, "")
      // Strip bare Python/JS lines (def, assert, import, return)
      .replace(/^(?:def\s+\w+|assert\s+|import\s+|return\s+|if\s+|for\s+)[^\n]*/gim, "")
      // Strip any remaining "ponytail" or "malas" standalone words
      .replace(/\bponytail\b/gi, "")
      .replace(/\bmalas\b/gi, "")
      // Strip "skor [teks]" labels from agent output
      .replace(/skor\s+\w+/gi, "")
      // Collapse multiple blank lines
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // Log to self-improvement
    selfImprovementService.enqueueJob({
      personaId: this.personaId,
      prompt: userPrompt,
      finalReply: replyText,
    });

    return { reply: replyText, toolsUsed };
  }
}
