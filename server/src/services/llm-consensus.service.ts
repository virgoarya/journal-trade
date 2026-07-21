// ─── LLM Consensus Service ──────────────────────────────────────────
// Parallel multi-model validation for trading signals.
// Calls 2-4 different LLMs simultaneously; each returns a simple verdict
// (GOOD / BAD / SKIP). ≥ majority vote = execute.
//
// Minimal token usage per call (~500 in / ~10 out per model).

import { env } from "../config/env";
import { silentLogger } from "../utils/silent-logger";
import { mt5McpService, CircuitBreaker } from "./mt5-mcp.service";

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
  minProviders: 3,
  threshold: 0.7,
  providerTimeoutMs: 25000,
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

const NINE_ROUTER_MODELS: Array<{ name: string; label: string; model: string }> = [
  { name: "deepseek",   label: "DeepSeek V4",      model: "oc/deepseek-v4-flash-free" },
  { name: "gpt",          label: "GPT OSS 120B",     model: "groq/openai/gpt-oss-120b" },
  { name: "gemini",     label: "Gemini 2.5 Flash", model: "gc/gemini-2.5-flash" },
  { name: "mistral",    label: "Mistral Large",    model: "mistral/mistral-large-latest" },
  { name: "nemotron",   label: "Nemotron 3 Ultra", model: "nvidia/nvidia/nemotron-3-ultra-550b-a55b" },
  { name: "claude-opus", label: "Claude Opus 4.7",    model: "kc/kilo-auto/free" },
];

/** Additional providers requiring direct API keys */
const DIRECT_MODELS: Array<{ name: string; label: string; model: string; baseURL: string; apiKeyEnv: string }> = [];

// Cache untuk menyimpan status rate-limit LLM beserta timestamp kapan terkena limit
const rateLimitedModels = new Map<string, number>();
const RATE_LIMIT_COOLDOWN_MS = 1000 * 60 * 30; // 30 Menit

// Provider reliability tracking
const providerReliability = new Map<string, { success: number; total: number; lastError: number }>();

/** Update provider reliability metrics */
function updateProviderReliability(name: string, success: boolean): void {
  const current = providerReliability.get(name) || { success: 0, total: 0, lastError: 0 };
  current.total++;
  if (success) current.success++;
  else current.lastError = Date.now();
  providerReliability.set(name, current);
}

/** Get provider reliability score (0-1) */
function getProviderReliability(name: string): number {
  const stats = providerReliability.get(name);
  if (!stats || stats.total < 3) return 1.0; // Default to 1.0 for new/untested providers
  return stats.success / stats.total;
}

/** Check if provider is reliable enough to use */
function isProviderReliable(name: string): boolean {
  const reliability = getProviderReliability(name);
  return reliability >= 0.5; // At least 50% success rate
}

/** Mengecek apakah model masih dalam masa penalti (hibernasi) */
function isRateLimited(name: string): boolean {
  if (!rateLimitedModels.has(name)) return false;
  const bannedAt = rateLimitedModels.get(name)!;
  if (Date.now() - bannedAt > RATE_LIMIT_COOLDOWN_MS) {
    rateLimitedModels.delete(name);
    silentLogger.info(`[LLM-HEALTH] 🔄 Model ${name} bangun dari hibernasi (cooldown selesai).`);
    return false;
  }
  return true;
}

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
      body: JSON.stringify({ model: m.model, messages: [{ role: "user", content: "ok" }], max_tokens: 5, stream: false }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    let body = "";
    try {
      body = await r.text();
    } catch {}
    
    const bodyLower = body.toLowerCase();
    const isRateLimited = 
      r.status === 429 || 
      r.status === 422 ||
      bodyLower.includes("quota") ||
      bodyLower.includes("exceeded") ||
      bodyLower.includes("limit") ||
      bodyLower.includes("exhausted");

    if (isRateLimited) {
      silentLogger.warn(`[LLM-HEALTH] ${m.name} (${m.model}) rate-limited — dinonaktifkan sampai server restart`);
      return false;
    }
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * Startup health check — test all available models.
 * Any model that returns 429 (rate-limited) or fails gets disabled for this session.
 */
async function startupHealthCheck(): Promise<void> {
  const useNineRouter = !!env.NINE_ROUTER_URL;
  silentLogger.info(
    `[LLM-HEALTH] 🔍 Mengecek model (timeout 10s masing-masing) - Mode: ${
      useNineRouter ? "9Router" : "Direct APIs"
    }...`
  );

  const results: Array<{ name: string; label: string; ok: boolean }> = [];
  const providers = getAvailableProviders();

  if (providers.length === 0) {
    silentLogger.warn("[LLM-HEALTH] ⚠️ Tidak ada provider LLM yang terkonfigurasi!");
    return;
  }

  await Promise.all(
    providers.map(async (p) => {
      const ok = await testModelProvider({ name: p.name, model: p.model }, p.baseUrl, p.apiKey);
      if (!ok) rateLimitedModels.set(p.name, Date.now());
      results.push({ name: p.name, label: p.label, ok });
    })
  );

  for (const r of results) {
    if (r.ok) silentLogger.info(`[LLM-HEALTH] ✅ ${r.label} (${r.name}) — OK`);
    else silentLogger.warn(`[LLM-HEALTH] ❌ ${r.label} (${r.name}) — LIMITED / OFFLINE — dinonaktifkan`);
  }
  
  const activeCount = results.filter(r => r.ok).length;
  silentLogger.info(`[LLM-HEALTH] ${activeCount}/${results.length} model aktif`);
}

function getAvailableProviders(): LLMProvider[] {
  const providers: LLMProvider[] = [];
  const useNineRouter = !!env.NINE_ROUTER_URL;
  const nineRouterUrl = env.NINE_ROUTER_URL;
  const nineRouterApiKey = env.NINE_ROUTER_API_KEY || "sk-9router-local";

  // 1. Tambahkan model 9Router spesifik
  if (useNineRouter) {
    for (const m of NINE_ROUTER_MODELS) {
      if (isRateLimited(m.name) || !isProviderReliable(m.name)) continue;
      providers.push({
        name: m.name,
        label: m.label,
        model: m.model,
        baseUrl: nineRouterUrl!,
        apiKey: nineRouterApiKey,
      });
    }
  }

  // 2. Tambahkan model Direct (Gemini, Mistral, Nemotron, Claude Opus)
  for (const m of DIRECT_MODELS) {
    if (isRateLimited(m.name) || !isProviderReliable(m.name)) continue;

    if (useNineRouter) {
      // Jika menggunakan 9Router, lewatkan semua model direct melalui 9Router
      providers.push({
        name: m.name,
        label: m.label,
        model: m.model,
        baseUrl: nineRouterUrl!,
        apiKey: nineRouterApiKey,
        isDirect: false,
      });
    } else {
      // Jika tidak menggunakan 9Router, pakai konfigurasi langsung (direct)
      const apiKeyRaw = m.apiKeyEnv && (env[m.apiKeyEnv as keyof typeof env] || "");
      const apiKey = String(apiKeyRaw);
      if (!apiKey || apiKey === "null" || apiKey === "undefined") {
        silentLogger.warn(`[LLM-CONSENSUS] API key ${m.name} tidak ditemukan, skip direct call`);
        continue;
      }

      // Bersihkan awalan model jika panggilan langsung (direct)
      let directModel = m.model;
      if (m.name === "gemini") {
        directModel = "gemini-2.5-flash";
      } else if (directModel.startsWith("groq/")) {
        directModel = directModel.replace("groq/", "");
      } else if (directModel.startsWith("mistral/")) {
        directModel = directModel.replace("mistral/", "");
      }

      providers.push({
        name: m.name,
        label: m.label,
        model: directModel,
        baseUrl: m.baseURL,
        apiKey,
        isDirect: true,
      });
    }
  }

  return providers;
}

/** Periodic health check - can be called during runtime */
export async function periodicHealthCheck(): Promise<void> {
  const useNineRouter = !!env.NINE_ROUTER_URL;
  const nineRouterUrl = env.NINE_ROUTER_URL;
  const nineRouterApiKey = env.NINE_ROUTER_API_KEY || "sk-9router-local";
  const providers = getAvailableProviders();

  await Promise.all(
    providers.map(async (p) => {
      const ok = await testModelProvider({ name: p.name, model: p.model }, p.baseUrl, p.apiKey);
      updateProviderReliability(p.name, ok);
      if (!ok) {
        rateLimitedModels.set(p.name, Date.now());
        silentLogger.warn(`[LLM-HEALTH] ${p.name} failed periodic check — moved to hibernation`);
      } else {
        silentLogger.info(`[LLM-HEALTH] ${p.name} periodic check — OK (reliability: ${getProviderReliability(p.name).toFixed(2)})`);
      }
    })
  );
}

// ─── System Prompt ───────────────────────────────────────────────────

const SYSTEM_PROMPT = `Kamu adalah seorang ahli strategi trading profesional dengan pengalaman 15+ tahun. Tugasmu adalah menganalisis sinyal trading yang diberikan dan menghasilkan keputusan dalam format JSON dengan kunci "verdict" dan "reasoning".

Aturan Analisis Sinyal (WAJIB diikuti):
1. **Struktur Pasar (Market Structure)** — Apakah arah tren mendukung arah sinyal? (BULL/BEAR/SIDEWAYS)
2. **Pola Teknikal Spesifik (Technical Pattern)** — Jika ada pola teknikal yang dikirim (seperti Orderblock (OB) dari SMC, Fair Value Gap (FVG) dari ICT, atau RBS/SBR/QML dari MSNR), kamu WAJIB menyebutkannya secara eksplisit dalam argumentasi.
3. **Konfluensi Metodologi (Methodology Confluence)** — Seberapa banyak metode yang setuju dengan sinyal ini?
   - Sistem menggunakan 3 methodology (SMC, ICT, MSNR). Tidak harus semua sepakat.
   - Bobot tertinggi: SMC (1.0) dan ICT (1.0). MSNR (0.8) sedikit lebih rendah.
   - 2 methodology berbobot tinggi setuju (misal SMC + ICT) sudah cukup kuat untuk GOOD.
   - Jika hanya 1 methodology yang setuju, itu lemah → SKIP atau BAD.
4. **Rasio Risiko/Hasil (Risk/Reward)** — Apakah perbandingan SL/TP masuk akal? (minimal R:R 1:1.5 untuk GOOD, 1:1 untuk SKIP)
5. **Aksi Harga (Price Action)** — Apakah ada konfirmasi nyata dari struktur harga? (breakout, penolakan/rejection, pola harga)
6. **Risiko Korelasi (Correlation Risk)** — Apakah sinyal ini berkorelasi tinggi dengan posisi terbuka lainnya?
7. **Konfirmasi Timeframe Lebih Tinggi (HTF Confirmation)** — Apakah timeframe yang lebih besar mengkonfirmasi arah sinyal?

Format Output (Kamu WAJIB membalas dengan JSON block berikut, jangan ada teks lain):
\`\`\`json
{
  "verdict": "GOOD",
  "reasoning": "Tren besar searah sinyal. Terkonfirmasi entry di area Orderblock (SMC) dan FVG (ICT) setuju. Risk/Reward 1:2 rasional."
}
\`\`\`
PENTING: Nilai "reasoning" WAJIB ditulis DALAM BAHASA INDONESIA. JANGAN gunakan bahasa Inggris untuk reasoning. Contoh yang benar: "Tren besar searah sinyal. Terkonfirmasi entry di area Orderblock (SMC) dan FVG (ICT) setuju. Risk/Reward 1:2 rasional."
ATURAN KERAS: JANGAN menulis analisis langkah-demi-langkah (step-by-step), JANGAN menerjemahkan ulang aturan prompt, dan JANGAN memberikan penjelasan panjang lebar di dalam nilai "reasoning". Langsung berikan kesimpulan akhir yang padat dalam Bahasa Indonesia.

Definisi Verdict (isi "verdict" hanya dengan salah satu dari ini):
- GOOD: Sinyal kuat, ≥2 methodology berbobot setuju (terutama SMC/ICT), R:R >= 1:1.5, searah tren HTF.
- BAD: Sinyal buruk, melawan tren dominan, R:R < 1:1, hanya 1 atau 0 methodology setuju, atau korelasi berisiko.
- SKIP: Data meragukan, kondisi sideways berisiko, R:R 1:1–1:1.5, hanya 1 methodology low-weight setuju, atau fundamental bertentangan.`;


// Base correlation values for offline fallback
const BASE_CORRELATIONS: Record<string, Record<string, number>> = {
  EURUSD: { EURUSD: 1.0, GBPUSD: 0.88, AUDUSD: 0.74, USDJPY: -0.32, USDCAD: -0.68, USDCHF: -0.92, XAUUSD: 0.42 },
  GBPUSD: { EURUSD: 0.88, GBPUSD: 1.0, AUDUSD: 0.68, USDJPY: -0.28, USDCAD: -0.62, USDCHF: -0.84, XAUUSD: 0.38 },
  AUDUSD: { EURUSD: 0.74, GBPUSD: 0.68, AUDUSD: 1.0, USDJPY: -0.22, USDCAD: -0.72, USDCHF: -0.70, XAUUSD: 0.55 },
  USDJPY: { EURUSD: -0.32, GBPUSD: -0.28, AUDUSD: -0.22, USDJPY: 1.0, USDCAD: 0.45, USDCHF: 0.38, XAUUSD: -0.48 },
  USDCAD: { EURUSD: -0.68, GBPUSD: -0.62, AUDUSD: -0.72, USDJPY: 0.45, USDCAD: 1.0, USDCHF: 0.65, XAUUSD: -0.35 },
  USDCHF: { EURUSD: -0.92, GBPUSD: -0.84, AUDUSD: -0.70, USDJPY: 0.38, USDCAD: 0.65, USDCHF: 1.0, XAUUSD: -0.38 },
  XAUUSD: { EURUSD: 0.42, GBPUSD: 0.38, AUDUSD: 0.55, USDJPY: -0.48, USDCAD: -0.35, USDCHF: -0.38, XAUUSD: 1.0 }
};

/**
 * Calculates Pearson correlation coefficient between two symbols based on H1 returns.
 */
async function getCorrelationCoefficient(s1: string, s2: string): Promise<number> {
  if (s1 === s2) return 1.0;
  try {
    const [r1, r2] = await Promise.all([
      mt5McpService.getRates(s1, "H1", 50),
      mt5McpService.getRates(s2, "H1", 50),
    ]);
    if (!r1 || !r2 || r1.length < 10 || r2.length < 10) return 0;

    const closes1 = r1.map(x => x.close);
    const closes2 = r2.map(x => x.close);

    const getReturns = (closes: number[]) => {
      const returns: number[] = [];
      for (let i = 1; i < closes.length; i++) {
        returns.push(closes[i - 1] === 0 ? 0 : (closes[i] - closes[i - 1]) / closes[i - 1]);
      }
      return returns;
    };

    const ret1 = getReturns(closes1);
    const ret2 = getReturns(closes2);

    const len = Math.min(ret1.length, ret2.length);
    const x = ret1.slice(0, len);
    const y = ret2.slice(0, len);

    const meanX = x.reduce((a, b) => a + b, 0) / len;
    const meanY = y.reduce((a, b) => a + b, 0) / len;

    let num = 0;
    let denX = 0;
    let denY = 0;

    for (let k = 0; k < len; k++) {
      const diffX = x[k] - meanX;
      const diffY = y[k] - meanY;
      num += diffX * diffY;
      denX += diffX * diffX;
      denY += diffY * diffY;
    }

    const den = Math.sqrt(denX * denY);
    return den === 0 ? 0 : parseFloat((num / den).toFixed(2));
  } catch {
    // Fallback to static base correlations
    const base1 = BASE_CORRELATIONS[s1];
    if (base1 && base1[s2] !== undefined) {
      return base1[s2];
    }
    const base2 = BASE_CORRELATIONS[s2];
    if (base2 && base2[s1] !== undefined) {
      return base2[s1];
    }
    return 0;
  }
}

// ─── Prompt Builder ──────────────────────────────────────────────────

function buildSignalPrompt(
  signal: {
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
    pattern?: string;
  },
  correlationWarnings?: string,
  candleContext?: string
): string {
  let extra = "";
  if (signal.htfTrend) extra += `\nTren HTF (Timeframe Tinggi): ${signal.htfTrend} (keyakinan: ${signal.htfConfidence}%)`;
  if (signal.symbolScore !== undefined) extra += `\nSkor Historis Simbol: ${signal.symbolScore}/100`;
  if (signal.methodologyVerdict) {
    extra += `\nHasil Keputusan Backtest Metodologi: ${signal.methodologyVerdict}`;
    extra += `\nWin Rate Metodologi: ${signal.methodologyWinRate}%`;
    extra += `\nPnL Metodologi: ${signal.methodologyPnL}`;
  }

  return `Evaluasi sinyal trading berikut secara objektif dan teknikal:

Simbol/Aset: ${signal.symbol}
Arah Posisi: ${signal.direction}
Pola Teknikal Spesifik: ${signal.pattern ? signal.pattern : "Tergantung dominasi confluences"}
Tingkat Keyakinan (Confidence): ${signal.confidence}%
Entry Price: ${signal.entry}
Stop Loss (SL): ${signal.sl}
Take Profit (TP): ${signal.tp}
Rasio Risk/Reward: ${Math.abs(signal.tp - signal.entry) > 0 ? (Math.abs(signal.tp - signal.entry) / Math.abs(signal.sl - signal.entry)).toFixed(2) : "N/A"}
Alasan Dasar: ${signal.reason}

Struktur Tren Market: ${signal.marketTrend}
Jumlah Metode yang Menyetujui: ${signal.agreeingCount}/${signal.totalMethodologies}${extra}${correlationWarnings ? `\n${correlationWarnings}` : ""}${candleContext ? `\n${candleContext}` : ""}

Rincian Detail Metode:
${JSON.stringify(signal.methodologyBreakdown, null, 2)}

Instruksi Tambahan: Jika data candle menunjukkan pembalikan tren, divergensi, atau breakdown struktur yang bertentangan dengan sinyal, utamakan FAKTOR GABUNGAN (metodologi + candle). Berikan verdict dan reasoning tetap singkat, padat, dan berbasis bukti teknikal.

Ingat: Berikan keputusan akhir (verdict) dan analisis teknikal (reasoning) eksklusif dalam Bahasa Indonesia. Balas hanya dengan format JSON yang valid, tanpa teks pengantar maupun penutup.`;
}

// ─── Service ─────────────────────────────────────────────────────────

class LLMConsensusService {
  private providerCircuitBreakers: Map<string, CircuitBreaker> = new Map();
  
  constructor() {
    // Initialize circuit breakers for all known providers
    const allProviders = getAvailableProviders(); // Note: This gets ALL providers, active or not
    for (const p of allProviders) {
      this.providerCircuitBreakers.set(p.name, new CircuitBreaker(3, 2, 60000)); // 3 failures, 2 successes, 60s timeout
    }
  }
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
      pattern?: string;
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

    const providers = getAvailableProviders().filter(p => {
      const circuit = this.providerCircuitBreakers.get(p.name);
      // Provider is usable if it's not rate-limited AND its circuit breaker is not OPEN
      return !isRateLimited(p.name) && circuit?.canExecute();
    });
    if (providers.length < (cfg.minProviders || 2)) {
      silentLogger.warn(`[LLM-CONSENSUS] Cuma ${providers.length} provider tersedia (butuh ${cfg.minProviders}). SKIP trade.`);
      return {
        verdict: "SKIP",
        votes: [],
        totalVotes: 0,
        goodVotes: 0,
        badVotes: 0,
        skipVotes: 0,
        consensusReached: false,
        details: `Insufficient active providers (${providers.length}/${cfg.minProviders}) — skipping trade due to missing LLM validation`,
      };
    }

    // Fetch active open positions to analyze correlation risk
    let correlationWarnings = "";
    let candleContext = "";
    try {
      const isConnected = mt5McpService.isConnected;
      if (isConnected) {
        // --- Fetch recent candles for LLM context ---
        const rates = await mt5McpService.getRates(signal.symbol, "H1", 5);
        if (rates && rates.length > 0) {
          const candleLines = rates.slice(-5).map((r: any) => {
            const time = new Date(r.time * 1000).toISOString().slice(11, 16);
            return `${time} O:${r.open.toFixed(5)} H:${r.high.toFixed(5)} L:${r.low.toFixed(5)} C:${r.close.toFixed(5)} V:${r.volume}`;
          });
          candleContext = `\n\nCandle Terbaru (H1 x5):\n${candleLines.join("\n")}`;
        }
        // --- End candle fetch ---

        const positions = await mt5McpService.getPositions();
        if (positions && positions.length > 0) {
          const warningsList: string[] = [];
          for (const pos of positions) {
            if (pos.symbol === signal.symbol) continue;

            const coeff = await getCorrelationCoefficient(signal.symbol, pos.symbol);
            if (Math.abs(coeff) >= 0.7) {
              const relation = coeff > 0 ? "Positif Kuat (bergerak searah)" : "Negatif Kuat (bergerak berlawanan)";
              warningsList.push(
                `- Posisi Aktif: ${pos.type} ${pos.symbol} (Korelasi dengan ${signal.symbol}: ${coeff} [${relation}])`
              );
            }
          }
          if (warningsList.length > 0) {
            correlationWarnings = `\nPERINGATAN PORTFOLIO CORRELATION RISK (Sinyal memiliki korelasi tinggi dengan posisi terbuka):\n${warningsList.join("\n")}\nEvaluasi apakah mengeksekusi sinyal ${signal.symbol} ini akan melipatgandakan risiko portofolio secara berlebihan. Jika ya, Anda disarankan memilih SKIP atau BAD.`;
          }
        }
      }
    } catch (e: any) {
      silentLogger.warn(`[LLM-CONSENSUS] Gagal menganalisis korelasi portofolio: ${e.message}`);
    }

    const prompt = buildSignalPrompt(signal, correlationWarnings, candleContext || undefined);

    // Run all providers in PARALLEL with timeout (minimum 15s, maximum 45s for slow/thinking models)
    const results = await Promise.all(
      providers.map((p) => this.callProvider(p, prompt, Math.min(Math.max(cfg.providerTimeoutMs || 25000, 15000), 45000))),
    );

    // Aggregate votes
    const validVotes = results.filter((r) => r.verdict !== "SKIP" && !r.error);
    const goodVotes = results.filter((r) => r.verdict === "GOOD" && !r.error).length;
    const badVotes = results.filter((r) => r.verdict === "BAD" && !r.error).length;
    const skipVotes = results.filter((r) => r.verdict === "SKIP" && !r.error).length;
    const totalVotes = results.length;
    const activeCount = results.filter((r) => !r.error).length;
    const threshold = cfg.threshold ?? 0.5;
    
    // Approval ratio: Good votes divided by the total number of successfully responded models (including SKIPs)
    const approvalRatio = activeCount > 0 ? goodVotes / activeCount : 0;

    let finalVerdict: LLMVerdict;
    if (badVotes > goodVotes) {
      finalVerdict = "BAD";
    } else if (activeCount > 0 && approvalRatio >= threshold) {
      finalVerdict = "GOOD";
    } else {
      finalVerdict = "SKIP";
    }

    const ratioPct = Math.round(approvalRatio * 100);
    const thresholdPct = Math.round(threshold * 100);
    const details = `Consensus Ratio: ${ratioPct}% / Threshold: ${thresholdPct}% | ` + 
      validVotes.map((v) => `${v.provider}(${v.modelLabel}): ${v.verdict} — ${v.reasoning}`).join(" | ");

    silentLogger.info(
      `[LLM-CONSENSUS] ${finalVerdict} (G:${goodVotes}/B:${badVotes}/S:${skipVotes}/${totalVotes}) [Ratio: ${ratioPct}% vs Threshold: ${thresholdPct}%] ${signal.symbol} ${signal.direction}`,
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
    await startupHealthCheck();
    // After health check, update circuit breakers based on rateLimitedModels
    const allProviders = getAvailableProviders();
    for (const p of allProviders) {
      if (isRateLimited(p.name)) {
        this.providerCircuitBreakers.get(p.name)?.recordFailure();
      } else {
        this.providerCircuitBreakers.get(p.name)?.recordSuccess();
      }
    }
  }

  /**
   * Get status of all 6 models (active / rate-limited).
   */
  getModelStatus(): Array<{ name: string; label: string; model: string; status: "active" | "hibernasi" | "circuit_open" }> {
    const status: Array<{ name: string; label: string; model: string; status: "active" | "hibernasi" | "circuit_open" }> = [];

    const allModels = [...NINE_ROUTER_MODELS, ...DIRECT_MODELS];
    for (const m of allModels) {
      const circuit = this.providerCircuitBreakers.get(m.name);
      let s: "active" | "hibernasi" | "circuit_open" = "active";
      if (isRateLimited(m.name)) {
        s = "hibernasi";
      } else if (circuit?.getState() === "OPEN") {
        s = "circuit_open";
      }
      status.push({
        name: m.name,
        label: m.label,
        model: m.model,
        status: s,
      });
    }
    return status;
  }

  /**
   * Get list of available providers with their status.
   */
  getAvailableProviders(): { name: string; label: string; available: boolean; reliability: number }[] {
    const allProviders = getAvailableProviders();
    return allProviders.map((p) => ({
      name: p.name,
      label: p.label,
      available: (this.providerCircuitBreakers.get(p.name)?.canExecute() ?? true) && isProviderReliable(p.name),
      reliability: getProviderReliability(p.name),
    }));
  }

  /**
   * Check if LLM consensus is possible (enough providers configured).
   */
isAvailable(): boolean {
    return this.getAvailableProviders().filter(p => p.available).length >= 2;
  }

  // ─── Single Provider Call ──────────────────────────────────────────

  private async callProvider(
    provider: LLMProvider,
    prompt: string,
    timeoutMs: number,
  ): Promise<LLMConsensusVote> {
    const startTime = Date.now();
    const circuit = this.providerCircuitBreakers.get(provider.name)!;

    if (!circuit.canExecute()) {
      const errorMessage = `Circuit breaker OPEN for LLM provider ${provider.name}. Fast-failing.`;
      silentLogger.warn(`[LLM-CONSENSUS] ${errorMessage}`);
      return {
        provider: provider.name,
        modelLabel: provider.label,
        verdict: "SKIP",
        reasoning: `Circuit breaker OPEN: ${errorMessage}`,
        latencyMs: Date.now() - startTime,
        error: errorMessage,
      };
    }

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
          max_tokens: 1500,
          temperature: 0.1,
          stream: false,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const latency = Date.now() - startTime;
        let errorBody = "";
        try {
          errorBody = await res.text();
        } catch {}
        silentLogger.warn(`[LLM-CONSENSUS] ${provider.name} HTTP ${res.status}: ${errorBody}`);

        // Dynamic rate-limit/quota detection (RESOURCE_EXHAUSTED / 429 / 422 from 9Router)
        const errLower = errorBody.toLowerCase();
        const isRateLimited =
          res.status === 429 ||
          res.status === 422 ||
          errLower.includes("resource_exhausted") ||
          errLower.includes("rate_limit") ||
          errLower.includes("rate limit") ||
          errLower.includes("quota") ||
          errLower.includes("exceeded") ||
          errLower.includes("credit");

        if (isRateLimited) {
          rateLimitedModels.set(provider.name, Date.now());
          updateProviderReliability(provider.name, false);
          silentLogger.warn(`[LLM-CONSENSUS] ${provider.name} (${provider.label}) dynamically entered hibernation due to rate limit/quota.`);
        }

        let friendlyError = `HTTP ${res.status}`;
        if (errorBody) {
          try {
            const parsedErr = JSON.parse(errorBody);
            const msg = parsedErr.error?.message || parsedErr.message || parsedErr.error;
            if (typeof msg === "string") {
              friendlyError = `HTTP ${res.status}: ${msg}`;
            } else {
              friendlyError = `HTTP ${res.status}: ${errorBody.slice(0, 80)}`;
            }
          } catch {
            friendlyError = `HTTP ${res.status}: ${errorBody.slice(0, 80)}`;
          }
        }

        return {
          provider: provider.name,
          modelLabel: provider.label,
          verdict: "SKIP",
          reasoning: isRateLimited 
            ? `Hibernasi: Kuota/Rate-Limit terlampaui` 
            : friendlyError,
          latencyMs: latency,
          error: friendlyError,
        };
      }

      const json: any = await res.json();
      let rawText = "";

      // Multi-strategy extraction: handle different provider response formats
      const msg = json?.choices?.[0]?.message;
      if (msg) {
        // 1. Standard content field (string)
        if (typeof msg.content === "string" && msg.content.trim()) {
          rawText = msg.content.trim();
        }
        // 2. Content as array (Claude/Anthropic style)
        if (!rawText && Array.isArray(msg.content)) {
          rawText = msg.content
            .filter((block: any) => block.type === "text" && block.text)
            .map((block: any) => block.text)
            .join("\n")
            .trim();
        }
        // 3. Reasoning content (DeepSeek/Qwen thinking models)
        if (!rawText && msg.reasoning_content) {
          rawText = String(msg.reasoning_content).trim();
        }
        // 4. Thought field (some models)
        if (!rawText && msg.thought) {
          rawText = String(msg.thought).trim();
        }
        // 5. Text field (some wrappers)
        if (!rawText && msg.text) {
          rawText = String(msg.text).trim();
        }
      }
      // 6. Top-level text field (non-standard wrappers)
      if (!rawText && json?.text) {
        rawText = String(json.text).trim();
      }
      // 7. Output field (some providers)
      if (!rawText && json?.output) {
        rawText = typeof json.output === "string" ? json.output.trim() : JSON.stringify(json.output);
      }

      console.log("[LLM-CONSENSUS] Raw response before parsing:", rawText || "[EMPTY]", "provider:", provider.name); const parsed = this.parseVerdict(rawText);
      const latency = Date.now() - startTime;

      circuit.recordSuccess(); // Record success
      updateProviderReliability(provider.name, true); // Track reliability

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

      circuit.recordFailure(); // Record failure
      updateProviderReliability(provider.name, false); // Track reliability

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

    // Extract <think>...</think> reasoning tags (DeepSeek/Qwen style)
    let thinkBlock = "";
    const thinkMatch = text.match(/<think>([\s\S]*?)<\/think>/i);
    if (thinkMatch && thinkMatch[1]) {
      thinkBlock = thinkMatch[1].trim();
    }

    // Strip <think>...</think> tags for JSON parsing
    let cleaned = text.trim();
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

    // Strip markdown code fences (```json ... ```)
    cleaned = cleaned.replace(/```(?:json)?\s*/gi, "").replace(/\s*```/gi, "").trim();

    // Strip zero-width chars and other invisible unicode
    cleaned = cleaned.replace(/[​-‍﻿]/g, "").trim();

    // If after stripping everything is empty, return SKIP (or use think block)
    if (!cleaned) {
      if (thinkBlock.length > 5) {
        // If we only got a think block and no verdict, we still don't know the verdict
        return { verdict: "SKIP", reasoning: thinkBlock.slice(0, 300) + "..." };
      }
      return { verdict: "SKIP", reasoning: "Empty response after cleaning" };
    }

    const tryParse = (raw: string): { verdict: LLMVerdict; reasoning: string } | null => {
      try {
        const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0] || raw;
        const parsed = JSON.parse(jsonStr);
        const verdict = (parsed.verdict || "").toString().toUpperCase();
        if (["GOOD", "BAD", "SKIP"].includes(verdict)) {
          let reasoning = (parsed.reasoning || "").toString().trim();
          
          // Fallback to think block if JSON reasoning is missing/too short
          if ((reasoning.length < 5 || reasoning === ".") && thinkBlock.length > 5) {
            reasoning = thinkBlock.slice(0, 300) + (thinkBlock.length > 300 ? "..." : "");
          }
          
          if (reasoning.length < 5 || reasoning === ".") {
            reasoning = "Analisis teknikal tidak disediakan oleh model.";
          }
          return {
            verdict: verdict as LLMVerdict,
            reasoning,
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
    let verdict: LLMVerdict | null = null;

    if (/(?:VERDICT|KEPUTUSAN|KESIMPULAN|STATUS)["*\s:\-]*GOOD/i.test(cleaned) || /^\s*["*\-]*\s*GOOD\b/i.test(cleaned)) {
      verdict = "GOOD";
    } else if (/(?:VERDICT|KEPUTUSAN|KESIMPULAN|STATUS)["*\s:\-]*BAD/i.test(cleaned) || /^\s*["*\-]*\s*BAD\b/i.test(cleaned)) {
      verdict = "BAD";
    } else if (/(?:VERDICT|KEPUTUSAN|KESIMPULAN|STATUS)["*\s:\-]*SKIP/i.test(cleaned) || /^\s*["*\-]*\s*SKIP\b/i.test(cleaned)) {
      verdict = "SKIP";
    }

    if (verdict) {
      let reasoning = "";
      const reasonMatch = cleaned.match(/(?:REASONING|ALASAN|PENJELASAN|KARENA)[*\s:\-]*([\s\S]+)/i);
      
      if (reasonMatch && reasonMatch[1] && reasonMatch[1].length > 5) {
        reasoning = reasonMatch[1].trim();
      } else {
        // Ambil sisa teks setelah membersihkan kata kunci verdict di depan
        reasoning = cleaned.replace(/^(?:\s*[\*\-]*\s*(?:VERDICT|KEPUTUSAN|KESIMPULAN)?[*\s:\-]*(?:GOOD|BAD|SKIP)\b)/i, '').trim();
      }
      
      reasoning = reasoning.replace(/[\n\r]+/g, ' ').slice(0, 300);
      
      // Fallback to think block if free-form reasoning is missing/too short
      if ((reasoning.length < 5 || reasoning === ".") && thinkBlock.length > 5) {
        reasoning = thinkBlock.slice(0, 300) + (thinkBlock.length > 300 ? "..." : "");
      }
      
      if (reasoning.length < 5 || reasoning === ".") {
        reasoning = "Analisis teknikal tidak disediakan oleh model.";
      }
      
      // Force Bahasa Indonesia: if reasoning contains English patterns, wrap with ID prefix
      reasoning = forceIndonesian(reasoning);
      
      return { verdict, reasoning };
    }

    // Fallback: If no structured JSON or recognized format, check for common patterns or just use the cleaned text.
    if (verdict === null) {
      // Try to find verdict in text directly if no keywords were found
      if (/\bGOOD\b/i.test(cleaned)) verdict = "GOOD";
      else if (/\bBAD\b/i.test(cleaned)) verdict = "BAD";
      else if (/\bSKIP\b/i.test(cleaned)) verdict = "SKIP";
    }

    if (verdict) {
      let reasoning = "";
      // Attempt to extract reasoning more broadly from remaining text if verdict found
      const potentialReasoning = cleaned
        .replace(new RegExp(verdict, "i"), "") // Remove the verdict itself
        .replace(/(?:VERDICT|KEPUTUSAN|KESIMPULAN|STATUS|REASONING|ALASAN|PENJELASAN|KARENA)[\s:\-]*/gi, '') // Remove keywords
        .trim();

      if (potentialReasoning.length > 5) {
        reasoning = potentialReasoning;
      } else if (thinkBlock.length > 5) {
        reasoning = thinkBlock;
      } else {
        reasoning = "Analisis teknikal tidak disediakan oleh model.";
      }
      return { verdict, reasoning: reasoning.slice(0, 300) + (reasoning.length > 300 ? "..." : "") };
    }


    // Jika tidak ada JSON dan tidak ada format baku, tapi kita punya thinkBlock,
    // asumsikan SKIP dan gunakan thinkBlock sebagai alasannya (daripada false positive)
    if (thinkBlock.length > 5) {
      return { verdict: "SKIP", reasoning: thinkBlock.slice(0, 300) + "..." };
    }

    // Jika kita tidak bisa menyimpulkan sinyal dengan format baku/pasti, 
    // gunakan teks asli (cleaned) sebagai reasoning agar hasil analisis model tidak hilang.
    const fallbackReasoning = cleaned.length > 5 
      ? cleaned.replace(/[\n\r]+/g, ' ').slice(0, 300) + (cleaned.length > 300 ? "..." : "")
      : "Format output tidak dikenali dan teks terlalu pendek.";
      
    return { verdict: "SKIP", reasoning: fallbackReasoning };
  }
}

/**
 * Minimal heuristic to detect English and convert common trading terms to ID
 */
function forceIndonesian(text: string): string {
  if (!text) return "";
  
  // Detection: if common EN words exist but common ID words don't
  const enWords = ["the", "and", "is", "trend", "with", "buy", "sell", "entry", "strong", "weak"];
  const idWords = ["dan", "adalah", "tren", "dengan", "beli", "jual", "kuat", "lemah"];
  
  const hasEn = enWords.some(w => new RegExp(`\\b${w}\\b`, "i").test(text));
  const hasId = idWords.some(w => new RegExp(`\\b${w}\\b`, "i").test(text));
  
  if (hasEn && !hasId) {
    // Simple replacement for common trading phrases to make it "look" like ID if model fails
    return text
      .replace(/\bthe trend is\b/gi, "tren adalah")
      .replace(/\bstrong buy\b/gi, "beli kuat")
      .replace(/\bstrong sell\b/gi, "jual kuat")
      .replace(/\bconfirm\b/gi, "konfirmasi")
      .replace(/\bagree\b/gi, "setuju")
      .replace(/\breasoning\b/gi, "alasan")
      .replace(/\bwith\b/gi, "dengan")
      .replace(/\bsignal\b/gi, "sinyal");
  }
  
  return text;
}

export const llmConsensusService = new LLMConsensusService();
