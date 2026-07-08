// ─── LLM Consensus Service ──────────────────────────────────────────
// Parallel multi-model validation for trading signals.
// Calls 2-4 different LLMs simultaneously; each returns a simple verdict
// (GOOD / BAD / SKIP). ≥ majority vote = execute.
//
// Minimal token usage per call (~500 in / ~10 out per model).

import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { env } from "../config/env";
import { silentLogger } from "../utils/silent-logger";

// ─── Types ───────────────────────────────────────────────────────────

export type LLMVerdict = "GOOD" | "BAD" | "SKIP";

export interface LLMConsensusVote {
  provider: string;
  modelLabel: string;
  verdict: LLMVerdict;
  reasoning: string;
  latencyMs: number;
  error?: string;
}

export interface LLMConsensusResult {
  verdict: LLMVerdict;
  votes: LLMConsensusVote[];
  totalVotes: number;
  goodVotes: number;
  badVotes: number;
  skipVotes: number;
  consensusReached: boolean;
  details: string;
}

export interface LLMConsensusConfig {
  enabled: boolean;
  /** How many models to run in parallel (2-4, default 3). */
  minProviders?: number;
  /** Minimum ratio of GOOD votes to execute (default 0.5 = ≥50%). */
  threshold?: number;
  /** Timeout per provider in ms (default 8000). */
  providerTimeoutMs?: number;
}

export const DEFAULT_LLM_CONSENSUS_CONFIG: LLMConsensusConfig = {
  enabled: false,
  minProviders: 4,
  threshold: 0.5,
  providerTimeoutMs: 15000,
};

// ─── Available Providers ─────────────────────────────────────────────

interface LLMProvider {
  name: string;
  label: string;
  model: string;
  baseUrl?: string;
  apiKey?: string;
  /** createOpenAI-compatible or createGoogleGenerativeAI-compatible */
}

/** 6 LLM models via 9Router — all run in parallel for consensus */
const NINE_ROUTER_MODELS: Array<{ name: string; label: string; model: string }> = [
  { name: "deepseek",   label: "DeepSeek V4",      model: "oc/deepseek-v4-flash-free" },
  { name: "qwen",       label: "Qwen 3 32B",       model: "groq/qwen/qwen3-32b" },
  { name: "gemini",     label: "Gemini 2.5 Flash", model: "gemini/gemini-2.5-flash" },
  { name: "mistral",    label: "Mistral Large",    model: "mistral/mistral-large-latest" },
  { name: "nemotron",   label: "Nemotron 3 Ultra", model: "nvidia/nvidia/nemotron-3-ultra-550b-a55b" },
  { name: "claude-opus", label: "Claude Opus 4",    model: "ag/claude-opus-4-6-thinking" },
];

function getAvailableProviders(): LLMProvider[] {
  const providers: LLMProvider[] = [];

  if (env.NINE_ROUTER_URL) {
    for (const m of NINE_ROUTER_MODELS) {
      providers.push({
        name: m.name,
        label: m.label,
        model: m.model,
        baseUrl: env.NINE_ROUTER_URL,
        apiKey: env.NINE_ROUTER_API_KEY || "sk-9router-local",
      });
    }
  }

  return providers;
}

// ─── System Prompt ───────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert trading signal validator. Your role is to evaluate a trading signal and respond with ONLY a single JSON object. No other text.

Analyze the signal using:
1. **Market Structure** — Is the trend aligned with the signal direction?
2. **Methodology Confluence** — How many methodologies agree on this direction?
3. **Risk/Reward** — Is the SL/TP ratio reasonable (≥1:1.5)?
4. **Price Action** — Is there a valid entry trigger?

Respond with EXACTLY this JSON format:
{
  "verdict": "GOOD" | "BAD" | "SKIP",
  "reasoning": "One short sentence explaining your verdict"
}

Rules:
- GOOD = high probability setup with confluence
- BAD = clear reasons to avoid (wrong trend, no confluence, bad R:R)
- SKIP = uncertain or insufficient data
- Be conservative. Default to SKIP if unsure.`;

// ─── Prompt Builder ──────────────────────────────────────────────────

function buildSignalPrompt(signal: {
  symbol: string;
  direction: string;
  confidence: number;
  entry: number;
  sl: number;
  tp: number;
  reason: string;
  marketTrend: string;
  methodologyBreakdown: Record<string, { confidence: number; weight: number; contribution: number }>;
  agreeingCount: number;
  totalMethodologies: number;
  htfTrend?: string;
  htfConfidence?: number;
  symbolScore?: number;
  methodologyVerdict?: string;
  methodologyWinRate?: number;
  methodologyPnL?: number;
}): string {
  let extra = "";
  if (signal.htfTrend) extra += `\nHTF Trend: ${signal.htfTrend} (confidence: ${signal.htfConfidence}%)`;
  if (signal.symbolScore !== undefined) extra += `\nSymbol Historical Score: ${signal.symbolScore}/100`;
  if (signal.methodologyVerdict) {
    extra += `\nMethodology Verdict from Backtest: ${signal.methodologyVerdict}`;
    extra += `\nMethodology Win Rate: ${signal.methodologyWinRate}%`;
    extra += `\nMethodology PnL: ${signal.methodologyPnL}`;
  }

  return `Evaluate this trading signal. Answer in Bahasa Indonesia.

Symbol: ${signal.symbol}
Direction: ${signal.direction}
Confidence: ${signal.confidence}%
Entry: ${signal.entry}
SL: ${signal.sl}
TP: ${signal.tp}
R:R: ${Math.abs(signal.tp - signal.entry) > 0 ? (Math.abs(signal.tp - signal.entry) / Math.abs(signal.sl - signal.entry)).toFixed(2) : "N/A"}
Reason: ${signal.reason}

Market Trend: ${signal.marketTrend}
Methodologies Agreeing: ${signal.agreeingCount}/${signal.totalMethodologies}${extra}

Methodology Breakdown:
${JSON.stringify(signal.methodologyBreakdown, null, 2)}

Verdict:`;
}

// ─── Service ─────────────────────────────────────────────────────────

class LLMConsensusService {
  /**
   * Run parallel LLM consensus for a trading signal.
   * All selected providers are called simultaneously via Promise.all.
   * Includes a per-provider timeout.
   */
  async evaluate(
    signal: {
      symbol: string;
      direction: string;
      confidence: number;
      entry: number;
      sl: number;
      tp: number;
      reason: string;
      marketTrend: string;
      methodologyBreakdown: Record<string, any>;
      agreeingCount: number;
      totalMethodologies: number;
      htfTrend?: string;
      htfConfidence?: number;
      symbolScore?: number;
      methodologyVerdict?: string;
      methodologyWinRate?: number;
      methodologyPnL?: number;
    },
    config?: Partial<LLMConsensusConfig>,
  ): Promise<LLMConsensusResult> {
    const cfg: LLMConsensusConfig = {
      ...DEFAULT_LLM_CONSENSUS_CONFIG,
      ...config,
    };

    if (!cfg.enabled) {
      return {
        verdict: "GOOD",
        votes: [],
        totalVotes: 0,
        goodVotes: 0,
        badVotes: 0,
        skipVotes: 0,
        consensusReached: true,
        details: "LLM Consensus disabled — proceeding with rule-based signal",
      };
    }

    const providers = getAvailableProviders();
    if (providers.length < (cfg.minProviders || 2)) {
      silentLogger.warn(`[LLM-CONSENSUS] Only ${providers.length} providers available (need ${cfg.minProviders}). Falling back to GOOD.`);
      return {
        verdict: "GOOD",
        votes: [],
        totalVotes: 0,
        goodVotes: 0,
        badVotes: 0,
        skipVotes: 0,
        consensusReached: true,
        details: `Insufficient providers (${providers.length}/${cfg.minProviders}) — proceeding without LLM validation`,
      };
    }

    const prompt = buildSignalPrompt(signal);

    // Run all providers in PARALLEL with timeout
    const results = await Promise.all(
      providers.map((p) => this.callProvider(p, prompt, cfg.providerTimeoutMs || 8000)),
    );

    // Aggregate votes
    const validVotes = results.filter((r) => r.verdict !== "SKIP" && !r.error);
    const goodVotes = validVotes.filter((r) => r.verdict === "GOOD").length;
    const badVotes = validVotes.filter((r) => r.verdict === "BAD").length;
    const skipVotes = results.filter((r) => r.verdict === "SKIP").length;
    const totalVotes = results.length;

    const threshold = cfg.threshold ?? 0.5;
    const goodRatio = validVotes.length > 0 ? goodVotes / (goodVotes + badVotes) : 0;

    let finalVerdict: LLMVerdict;
    if (badVotes > goodVotes) {
      finalVerdict = "BAD";
    } else if (validVotes.length > 0 && goodRatio >= threshold) {
      finalVerdict = "GOOD";
    } else {
      finalVerdict = "SKIP";
    }

    const details = validVotes.map((v) => `${v.provider}(${v.modelLabel}): ${v.verdict} — ${v.reasoning}`).join(" | ");

    silentLogger.info(
      `[LLM-CONSENSUS] Verdict=${finalVerdict} (G:${goodVotes}/B:${badVotes}/S:${skipVotes}/${totalVotes}) ${signal.symbol} ${signal.direction}`,
    );

    return {
      verdict: finalVerdict,
      votes: results,
      totalVotes,
      goodVotes,
      badVotes,
      skipVotes,
      consensusReached: finalVerdict !== "SKIP",
      details,
    };
  }

  /**
   * Get list of available providers with their status.
   */
  getAvailableProviders(): { name: string; label: string; available: boolean }[] {
    return getAvailableProviders().map((p) => ({
      name: p.name,
      label: p.label,
      available: true,
    }));
  }

  /**
   * Check if LLM consensus is possible (enough providers configured).
   */
  isAvailable(): boolean {
    return getAvailableProviders().length >= 2;
  }

  // ─── Single Provider Call ──────────────────────────────────────────

  private async callProvider(
    provider: LLMProvider,
    prompt: string,
    timeoutMs: number,
  ): Promise<LLMConsensusVote> {
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      let model: any;

      if (provider.name === "gemini") {
        const google = createGoogleGenerativeAI({ apiKey: provider.apiKey || "" });
        model = google(provider.model);
      } else {
        const openai = createOpenAI({
          baseURL: provider.baseUrl || "https://openrouter.ai/api/v1",
          apiKey: provider.apiKey || "",
        });
        model = openai.chat(provider.model);
      }

      const response = await generateText({
        model,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
        maxTokens: 80 as any,
        temperature: 0.1,
        abortSignal: controller.signal,
      } as any);

      clearTimeout(timeout);

      const parsed = this.parseVerdict(response.text);
      const latencyMs = Date.now() - startTime;

      return {
        provider: provider.name,
        modelLabel: provider.label,
        verdict: parsed.verdict,
        reasoning: parsed.reasoning,
        latencyMs,
      };
    } catch (error: any) {
      const latencyMs = Date.now() - startTime;
      const errorMsg = error.name === "AbortError"
        ? `Timeout after ${timeoutMs}ms`
        : error.message || "Unknown error";

      silentLogger.warn(`[LLM-CONSENSUS] ${provider.name}(${provider.label}) failed: ${errorMsg}`);

      return {
        provider: provider.name,
        modelLabel: provider.label,
        verdict: "SKIP",
        reasoning: `Error: ${errorMsg}`,
        latencyMs,
        error: errorMsg,
      };
    }
  }

  /**
   * Parse the model's response into a structured verdict.
   * Handles both strict JSON and free-form text.
   */
  private parseVerdict(text: string): { verdict: LLMVerdict; reasoning: string } {
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        const verdict = (parsed.verdict || "").toUpperCase();
        if (["GOOD", "BAD", "SKIP"].includes(verdict)) {
          return {
            verdict: verdict as LLMVerdict,
            reasoning: parsed.reasoning || text.slice(0, 100),
          };
        }
      } catch {
        // fall through
      }
    }

    // Fallback: keyword detection
    const upper = text.toUpperCase();
    if (upper.includes('"GOOD"') || upper.includes("'GOOD'") || upper.startsWith("GOOD")) {
      return { verdict: "GOOD", reasoning: text.slice(0, 100) };
    }
    if (upper.includes('"BAD"') || upper.includes("'BAD'") || upper.startsWith("BAD")) {
      return { verdict: "BAD", reasoning: text.slice(0, 100) };
    }

    return { verdict: "SKIP", reasoning: text.slice(0, 100) };
  }
}

export const llmConsensusService = new LLMConsensusService();
