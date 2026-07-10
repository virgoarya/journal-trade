// ─── LLM Consensus Service ──────────────────────────────────────────
// Parallel multi-model validation for trading signals.
// Calls 2-4 different LLMs simultaneously; each returns a simple verdict
// (GOOD / BAD / SKIP). ≥ majority vote = execute.
//
// Minimal token usage per call (~500 in / ~10 out per model).

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
  baseUrl: string;
  apiKey: string;
  isDirect?: boolean;
}

/** 6 LLM models via different providers (some via 9Router, some direct) */
const NINE_ROUTER_MODELS: Array<{ name: string; label: string; model: string }> = [
  { name: "deepseek",   label: "DeepSeek V4",      model: "oc/deepseek-v4-flash-free" },
  { name: "qwen",       label: "Qwen 3 32B",       model: "groq/qwen/qwen3-32b" },
];

/** Additional providers requiring direct API keys */
const DIRECT_MODELS: Array<{ name: string; label: string; model: string; baseURL: string; apiKeyEnv: string }> = [
  { name: "gemini",     label: "Gemini 2.5 Flash", model: "gemini/gemini-2.5-flash",    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai", apiKeyEnv: "GEMINI_API_KEY" },
  { name: "mistral",    label: "Mistral Large",    model: "mistral/mistral-large-latest", baseURL: "https://api.mistral.ai", apiKeyEnv: "GROQ_API_KEY" },
  { name: "nemotron",   label: "Nemotron 3 Ultra", model: "nvidia/nvidia/nemotron-3-ultra-550b-a55b", baseURL: "https://integrate.api.nvidia.com/v1", apiKeyEnv: "ANTHROPIC_AUTH_TOKEN" },
  { name: "claude-opus", label: "Claude Opus 4",    model: "claude-3-opus-20240229",    baseURL: "https://router.flatkey.ai/v1", apiKeyEnv: "ANTHROPIC_AUTH_TOKEN" },
];

/** Models that are rate-limited and should be skipped temporarily */
const rateLimitedModels = new Set<string>();

/**
 * Test a single model by sending a minimal prompt.
 * Returns true if the model responds OK, false if rate-limited/error.
 */
async function testModelProvider(m: { name: string; model: string }, baseUrl: string, apiKey: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const r = await fetch(baseUrl + "/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ model: m.model, messages: [{ role: "user", content: "ok" }], max_tokens: 2, stream: false }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (r.status === 429) {
      silentLogger.warn(`[LLM-HEALTH] ${m.name} (${m.model}) rate-limited (429) — dinonaktifkan sampai server restart`);
      return false;
    }
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * Startup health check — test all 6 models.
 * Any model that returns 429 (rate-limited) gets disabled for this session.
 */
async function startupHealthCheck(): Promise<void> {
  silentLogger.info("[LLM-HEALTH] 🔍 Mengecek 6 model (timeout 10s masing-masing)...");

  const results: Array<{ name: string; label: string; ok: boolean }> = [];

  // Test 9Router models
  if (env.NINE_ROUTER_URL) {
    const baseUrl = env.NINE_ROUTER_URL;
    const apiKey = env.NINE_ROUTER_API_KEY || "sk-9router-local";
    const routerResults = await Promise.all(
      NINE_ROUTER_MODELS.map(async (m) => {
        const ok = await testModelProvider(m, baseUrl, apiKey);
        if (!ok) rateLimitedModels.add(m.name);
        return { name: m.name, label: m.label, ok };
      }),
    );
    results.push(...routerResults);
  }

  // Test direct models
  for (const m of DIRECT_MODELS) {
    const apiKeyRaw = m.apiKeyEnv ? (env[m.apiKeyEnv as keyof typeof env] ?? "") : "";
    const apiKey = String(apiKeyRaw);
    if (!apiKey) {
      rateLimitedModels.add(m.name);
      results.push({ name: m.name, label: m.label, ok: false });
      continue;
    }
    const ok = await testModelProvider(m, m.baseURL, apiKey);
    if (!ok) rateLimitedModels.add(m.name);
    results.push({ name: m.name, label: m.label, ok });
  }

  for (const r of results) {
    if (r.ok) silentLogger.info(`[LLM-HEALTH] ✅ ${r.label} (${r.name}) — OK`);
    else silentLogger.warn(`[LLM-HEALTH] ❌ ${r.label} (${r.name}) — LIMITED / OFFLINE — dinonaktifkan`);
  }
  silentLogger.info(`[LLM-HEALTH] ${results.filter(r => r.ok).length}/${results.length} model aktif`);
}

function getAvailableProviders(): LLMProvider[] {
  const providers: LLMProvider[] = [];

  // 9Router models
  if (env.NINE_ROUTER_URL) {
    for (const m of NINE_ROUTER_MODELS) {
      if (rateLimitedModels.has(m.name)) continue; // skip rate-limited
      providers.push({
        name: m.name,
        label: m.label,
        model: m.model,
        baseUrl: env.NINE_ROUTER_URL,
        apiKey: env.NINE_ROUTER_API_KEY || "sk-9router-local",
      });
    }
  }

  // Direct models (Gemini, Mistral, Nemotron, Claude Opus)
  for (const m of DIRECT_MODELS) {
    if (rateLimitedModels.has(m.name)) continue;
    const apiKeyRaw = m.apiKeyEnv && (env[m.apiKeyEnv as keyof typeof env] || "");
    const apiKey = String(apiKeyRaw);
    if (!apiKey || apiKey === "null" || apiKey === "undefined") {
      silentLogger.warn(`[LLM-CONSENSUS] API key ${m.name} gak ada, skip`);
      continue;
    }
    providers.push({
      name: m.name,
      label: m.label,
      model: m.model,
      baseUrl: m.baseURL,
      apiKey,
      isDirect: true,
    });
  }

  return providers;
}

// ─── System Prompt ───────────────────────────────────────────────────

const SYSTEM_PROMPT = `Halo! Kamu adalah ahli strategi trading yang siap bantu. Tugasmu adalah menganalisis sinyal trading dan kasih respons dalam format JSON aja, nggak pake ngomong yang lain ya.

Cek sinyal pakai ini:
1.  **Market Structure** — Trennya searah sama sinyal nggak?
2.  **Methodology Confluence** — Berapa banyak metode yang setuju?
3.  **Risk/Reward** — SL/TP-nya masuk akal kan? (minimal 1:1.5)
4.  **Price Action** — Ada trigger entry yang oke nggak?

Balasnya cuma pake JSON gini ya:
{
  "verdict": "GOOD" | "BAD" | "SKIP",
  "reasoning": "Kasih alasan singkat kenapa kamu pilih itu, santai aja bahasanya."
}

Aturannya simpel:
- GOOD = Sinyal bagus, konvergen, peluang tinggi.
- BAD = Hindari! Tren lawan, nggak konvergen, R:R jelek.
- SKIP = Masih ragu, data kurang, atau ada yang aneh.
- Kalau ragu, mending SKIP aja biar aman.`;

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

  return `Halo! Tolong evaluasi sinyal trading ini. Balas dengan santai ya.

Symbol: ${signal.symbol}
Arah: ${signal.direction}
Confidence: ${signal.confidence}%
Entry: ${signal.entry}
SL: ${signal.sl}
TP: ${signal.tp}
R:R: ${Math.abs(signal.tp - signal.entry) > 0 ? (Math.abs(signal.tp - signal.entry) / Math.abs(signal.sl - signal.entry)).toFixed(2) : "N/A"}
Alasan: ${signal.reason}

Tren Market: ${signal.marketTrend}
Metode yang setuju: ${signal.agreeingCount}/${signal.totalMethodologies}${extra}

Detail Metode:
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
        details: "LLM Consensus dimatikan — pakai sinyal rule-based aja",
      };
    }

    const providers = getAvailableProviders();
    if (providers.length < (cfg.minProviders || 2)) {
      silentLogger.warn(`[LLM-CONSENSUS] Cuma ${providers.length} provider tersedia (butuh ${cfg.minProviders}). Pakai GOOD aja.`);
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
      providers.map((p) => this.callProvider(p, prompt, cfg.providerTimeoutMs || 15000)),
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
      `[LLM-CONSENSUS] ${finalVerdict} (G:${goodVotes}/B:${badVotes}/S:${skipVotes}/${totalVotes}) ${signal.symbol} ${signal.direction}`,
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
   * Test all models at startup and disable rate-limited ones.
   */
  async startupHealthCheck(): Promise<void> {
    return startupHealthCheck();
  }

  /**
   * Get status of all 6 models (active / rate-limited).
   */
  getModelStatus(): Array<{ name: string; label: string; model: string; status: "active" | "hibernasi" }> {
    const status: Array<{ name: string; label: string; model: string; status: "active" | "hibernasi" }> = [];

    // Tambahkan status untuk model 9Router
    for (const m of NINE_ROUTER_MODELS) {
      status.push({
        name: m.name,
        label: m.label,
        model: m.model,
        status: rateLimitedModels.has(m.name) ? "hibernasi" as const : "active" as const,
      });
    }

    // Tambahkan status untuk model langsung
    for (const m of DIRECT_MODELS) {
      status.push({
        name: m.name,
        label: m.label,
        model: m.model,
        status: rateLimitedModels.has(m.name) ? "hibernasi" as const : "active" as const,
      });
    }
    return status;
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

      // Direct fetch to avoid @ai-sdk/openai parsing issues with non-standard endpoints
      const res = await fetch(provider.baseUrl + "/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + provider.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
          max_tokens: 200,
          temperature: 0.1,
          stream: false,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const latency = Date.now() - startTime;
        silentLogger.warn(`[LLM-CONSENSUS] ${provider.name} HTTP ${res.status}`);
        return {
          provider: provider.name,
          modelLabel: provider.label,
          verdict: "SKIP",
          reasoning: `HTTP ${res.status}`,
          latencyMs: latency,
          error: `HTTP ${res.status}`,
        };
      }

      const json: any = await res.json();
      const rawText = json?.choices?.[0]?.message?.content ?? "";
      const parsed = this.parseVerdict(rawText);
      const latency = Date.now() - startTime;

      return {
        provider: provider.name,
        modelLabel: provider.label,
        verdict: parsed.verdict,
        reasoning: parsed.reasoning,
        latencyMs: latency,
      };
    } catch (error: any) {
      const latencyMs = Date.now() - startTime;
      const errorMsg = error.name === "AbortError"
        ? `Timeout setelah ${timeoutMs}ms`
        : error.message || "Error tak diketahui";

      silentLogger.warn(`[LLM-CONSENSUS] ${provider.name}(${provider.label}) gagal: ${errorMsg}`);

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
    if (!text) return { verdict: "SKIP", reasoning: "Empty response" };

    // Strip markdown code fences (```json ... ```)
    let cleaned = text.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    // Strip <think>...</think> reasoning tags (DeepSeek/Qwen style)
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

    // Strip ​ (zero-width chars) and other invisible unicode
    cleaned = cleaned.replace(/[​-‍﻿]/g, "").trim();

    // If after stripping everything is empty, return SKIP
    if (!cleaned) return { verdict: "SKIP", reasoning: "Empty response after cleaning" };

    const tryParse = (raw: string): { verdict: LLMVerdict; reasoning: string } | null => {
      try {
        // Try to extract just the JSON object from the text if it's embedded
        const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0] || raw;
        const parsed = JSON.parse(jsonStr);
        const verdict = (parsed.verdict || "").toString().toUpperCase();
        if (["GOOD", "BAD", "SKIP"].includes(verdict)) {
          const reasoning = (parsed.reasoning || "").toString().trim();
          return {
            verdict: verdict as LLMVerdict,
            reasoning: reasoning || "Model provided verdict without reasoning",
          };
        }
      } catch {
        // ignore
      }
      return null;
    };

    // 1. Whole cleaned string is valid JSON (greedy match)
    const whole = tryParse(cleaned);
    if (whole) return whole;

    // 2. Extract first {...} block (non-greedy)
    const jsonMatch = cleaned.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      const fromFirst = tryParse(jsonMatch[0]);
      if (fromFirst) return fromFirst;
    }

    // 3. Try greedy match for outermost braces (handles nested quotes)
    const greedyMatch = cleaned.match(/\{[\s\S]*\}/);
    if (greedyMatch) {
      const fromGreedy = tryParse(greedyMatch[0]);
      if (fromGreedy) return fromGreedy;
    }

    // 4. Fallback: extract verdict and reasoning from free-form text
    // Look for verdict keywords
    const upper = cleaned.toUpperCase();
    let verdict: LLMVerdict | null = null;
    if (upper.includes("GOOD") || upper.startsWith("GOOD")) {
      verdict = "GOOD";
    } else if (upper.includes("BAD") || upper.startsWith("BAD")) {
      verdict = "BAD";
    } else if (upper.includes("SKIP") || upper.startsWith("SKIP")) {
      verdict = "SKIP";
    }

    if (verdict) {
      // Try to extract reasoning after the verdict keyword
      const match = cleaned.match(/(?:GOOD|BAD|SKIP)[:\s-]*(.+)/i);
      const reasoning = match && match[1] ? match[1].trim().slice(0, 200) : "No reasoning extracted";
      return { verdict, reasoning: reasoning || "No reasoning provided" };
    }

    // 5. Last resort: keyword detection
    if (/\bgood\b/i.test(cleaned)) return { verdict: "GOOD", reasoning: "Detected GOOD from text" };
    if (/\bbad\b/i.test(cleaned)) return { verdict: "BAD", reasoning: "Detected BAD from text" };

    return { verdict: "SKIP", reasoning: "Could not parse verdict from response" };
  }
}

export const llmConsensusService = new LLMConsensusService();
