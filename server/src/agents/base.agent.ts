import axios from "axios";
import { env } from "../config/env";
import { NINE_ROUTER_MODELS } from "../config/llm-models.config";
import { silentLogger } from "../utils/silent-logger";
import { selfImprovementService } from "../services/self-improvement.service";
import { userMemoryService } from "../services/user-memory.service";

export interface AgentContext {
  currentRegime?: string;
  liquidityStatus?: string;
  assets?: any[];
  macroData?: any;
  userId?: string;
}

export abstract class BaseAgent {
  abstract name: string;
  abstract personaId: string;
  abstract systemPrompt: string;

  async think(userPrompt: string, context: AgentContext): Promise<{ reply: string; toolsUsed: string[] }> {
    const toolsUsed: string[] = ["internal_data_fetch"];
    
    // Load user memory if userId provided
    const userMemory = context.userId ? await userMemoryService.getPromptContext(context.userId) : "";

    // Build contextual prompt
    const enrichedPrompt = `
[MEMORI USER]
${userMemory}

[CONTEXT MAKRO]
Regime: ${context.currentRegime || "Unknown"}
Liquidity: ${context.liquidityStatus || "Unknown"}
Assets: ${JSON.stringify(context.assets || [])}

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

    if (!replyText) {
      replyText = "Agent mengalami kendala koneksi ke 9Router LLM consensus.";
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
      toolsUsed,
      toolOutputs: context
    });

    return { reply: replyText, toolsUsed };
  }
}
