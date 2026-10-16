import axios from "axios";
import { env } from "../config/env";
import { NINE_ROUTER_MODELS, TOOL_CAPABLE_MODELS, NINE_ROUTER_EMERGENCY_FALLBACK } from "../config/llm-models.config";
import { selfImprovementService } from "./self-improvement.service";
import { silentLogger } from "../utils/silent-logger";
import { geoRiskService } from "./geo-risk.service";
import { macroRegimeService } from "./macro-regime.service";
import { generateText, tool, jsonSchema } from "ai";
import { vectorMemoryService } from "./vector-memory.service";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { mcpService } from "./mcp.service";
import { userMemoryService } from "./user-memory.service";
import { MacroIndicator } from "../models/MacroIndicator";
import { GeoRiskSnapshot } from "../models/GeoRiskSnapshot";

// Hermes context injection imports
import { getUserProfileWithNotes, resolveProfileForUser } from "../lib/agent/profile-repo";
import { assembleHermesPrompt, DEFAULT_MACRO_SSOT, MacroSSOT } from "../lib/agent/hermes-prompt";
import { extractUserFacts, saveFactsToUserProfile } from "./memory-extractor.service";

const GEMINI_API_URL_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODELS = [env.GROQ_MODEL || "llama-3.3-70b-versatile", "llama-3.1-8b-instant"];

// Cache for playbook per regime - cleared on regime change
const playbookCache: Record<
  string,
  { playbook: Array<{ asset: string; desc: string }> }
> = {};

function clearPlaybookCache() {
  for (const key of Object.keys(playbookCache)) {
    delete playbookCache[key];
  }
}

// (callGeminiDirect removed)


/**
 * Helper: dapatkan tanggal rilis CPI secara dinamis tanpa hardcode
 * - Coba dari MacroIndicator.CPI (releaseDate)
 * - Kalau tidak ada, gunakan GeoRiskSnapshot terbaru (fetchedAt)
 * - Fallback: "terbaru"
 */
async function getCpiReleaseDate(): Promise<string> {
  try {
    const cpiDoc = await MacroIndicator.findOne({
      indicatorName: "CPI",
      country: "US"
    }).sort({ releaseDate: -1 }).lean();
    if (cpiDoc?.releaseDate) {
      return new Date(cpiDoc.releaseDate).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric"
      });
    }
  } catch (e) {
    // ignore
  }
  // Fallback: GeoRiskSnapshot terbaru
  try {
    const snapshot = await GeoRiskSnapshot.findOne({}).sort({ fetchedAt: -1 }).lean();
    if (snapshot?.fetchedAt) {
      return new Date(snapshot.fetchedAt).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric"
      });
    }
  } catch (e) {
    // ignore
  }
  return "terbaru";
}

/**
 * Helper: dapatkan tanggal event CPI dari calendar db
 */
async function getCpiEventDateFromCalendar(calItems: any[]): Promise<string> {
  // Jika ada event CPI, gunakan tanggalnya. Jika tidak ada atau tanggal sudah lewat jauh, gunakan tanggal hari ini (real-time)
  if (Array.isArray(calItems) && calItems.length > 0) {
    const cpiEvent = calItems.find((e: any) =>
      (e.title || e.event || "").toLowerCase().includes("cpi") ||
      (e.title || e.event || "").toLowerCase().includes("inflation")
    );
    if (cpiEvent?.date) {
      try {
        const evDate = new Date(cpiEvent.date);
        const now = new Date();
        // Jika selisih kurang dari 10 hari, gunakan tanggal event
        if (Math.abs(now.getTime() - evDate.getTime()) < 10 * 24 * 60 * 60 * 1000) {
          return evDate.toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric"
          });
        }
      } catch (e) {
        // ignore
      }
    }
  }
  // Fallback ke tanggal hari ini real-time
  return new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function isRetryableGroqError(error: any): boolean {
  if (!error) return false;
  const status = error.response?.status;
  return status === 429 || (typeof status === "number" && status >= 500);
}

async function callDualEngine(
  userPrompt: string,
  systemPrompt?: string,
  generationConfig?: Record<string, any>,
): Promise<string | null> {
  const modelConfigs = NINE_ROUTER_MODELS;

  for (const modelConfig of modelConfigs) {
    try {
      const response = await axios.post(
        `${env.NINE_ROUTER_URL}/chat/completions`,
        {
          model: modelConfig.model,
          messages: [
            ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
            { role: "user", content: userPrompt },
          ],
          max_tokens: generationConfig?.max_output_tokens || 1000,
          temperature: generationConfig?.temperature || 0.2,
          stream: false,
        },
        {
          headers: {
            Authorization: `Bearer ${env.NINE_ROUTER_API_KEY || "sk-dummy"}`,
            "Content-Type": "application/json",
          },
          timeout: generationConfig?.timeout || 35000,
        },
      );

      const text = response.data?.choices?.[0]?.message?.content;
      if (text && text.trim()) {
        const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
        if (cleaned) {
          silentLogger.info(`[MacroAI] 9Router (${modelConfig.name} - ${modelConfig.model}) generated ${cleaned.length} chars.`);
          return cleaned;
        }
      }
    } catch (error: any) {
      silentLogger.warn(`[MacroAI] 9Router model ${modelConfig.name} failed: ${error.message}, trying next...`);
    }
  }

  // Emergency fallback: 9Router meta-router auto-picks working free model
  try {
    silentLogger.warn("[MacroAI] All named models failed — attempting emergency fallback: auto-free-model");
    const response = await axios.post(
      `${env.NINE_ROUTER_URL}/chat/completions`,
      {
        model: NINE_ROUTER_EMERGENCY_FALLBACK,
        messages: [
          ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
          { role: "user", content: userPrompt },
        ],
        max_tokens: generationConfig?.max_output_tokens || 1000,
        temperature: generationConfig?.temperature || 0.2,
        stream: false,
      },
      {
        headers: {
          Authorization: `Bearer ${env.NINE_ROUTER_API_KEY || "sk-dummy"}`,
          "Content-Type": "application/json",
        },
        timeout: generationConfig?.timeout || 35000,
      },
    );
    const text = response.data?.choices?.[0]?.message?.content;
    if (text && text.trim()) {
      const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
      if (cleaned) {
        silentLogger.info(`[MacroAI] Emergency fallback (auto-free-model) generated ${cleaned.length} chars.`);
        return cleaned;
      }
    }
  } catch (error: any) {
    silentLogger.error(`[MacroAI] Emergency fallback (auto-free-model) failed: ${error.message}`);
  }

  silentLogger.error("[MacroAI] All 9Router models + emergency fallback failed.");
  return null;
}

async function callDualEngineStream(
  messages: any[],
): Promise<any> {
  let lastError: any;

  for (const modelConfig of NINE_ROUTER_MODELS) {
    try {
      const response = await axios.post(
        `${env.NINE_ROUTER_URL}/chat/completions`,
        {
          model: modelConfig.model,
          messages,
          max_tokens: 1000,
          temperature: 0.2,
          stream: true,
        },
        {
          headers: {
            Authorization: `Bearer ${env.NINE_ROUTER_API_KEY || "sk-dummy"}`,
            "Content-Type": "application/json",
          },
          timeout: 45000,
        },
      );
      return response.data;
    } catch (error: any) {
      silentLogger.warn(`[MacroAI] 9Router stream model ${modelConfig.name} failed: ${error.message}, trying next...`);
      lastError = error;
    }
  }

  silentLogger.error(`[MacroAI] All 9Router stream models failed.`);
  return null;
}

// Groq API response interface
interface GroqResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Simple in-memory cache for non-streaming AI responses
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}
const cache = new Map<string, CacheEntry<any>>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Request throttler to enforce minimum interval between Groq requests
const MIN_INTERVAL_MS = 2000; // 2 seconds between requests
let lastRequestTime = 0;
interface QueueItem<T> {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: any) => void;
}
const requestQueue: QueueItem<any>[] = [];

function enqueueRequest<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    requestQueue.push({ fn, resolve, reject });
    processQueue();
  });
}

async function processQueue() {
  const item = requestQueue.shift();
  if (!item) {
    return;
  }
  const { fn, resolve, reject } = item;
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise((res) => setTimeout(res, MIN_INTERVAL_MS - elapsed));
  }
  try {
    const result = await fn();
    lastRequestTime = Date.now();
    resolve(result);
    setTimeout(processQueue, MIN_INTERVAL_MS);
  } catch (err) {
    reject(err);
    setTimeout(processQueue, MIN_INTERVAL_MS);
  }
}

// Wrapper for Groq requests with caching, throttling, and exponential backoff retry
async function groqRequest<T>(
  url: string,
  data: any,
  options: { useCache?: boolean; cacheKey?: string } = {},
): Promise<T> {
  const { useCache = false, cacheKey = "" } = options;
  // Check cache
  if (useCache && cacheKey) {
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  // Perform request with throttling and retry logic
  const result = await enqueueRequest(async () => {
    let attempts = 0;
    while (true) {
      try {
        const response = await axios.post(url, data, {
          headers: {
            Authorization: `Bearer ${env.GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 20000,
        });
        const resultData = response.data;
        // Store in cache if needed
        if (useCache && cacheKey) {
          cache.set(cacheKey, { data: resultData, timestamp: Date.now() });
        }
        return resultData as unknown as T;
      } catch (err: any) {
        if (err.response?.status === 429) {
          const retryAfter = err.response.headers["retry-after"];
          const delay = retryAfter
            ? parseInt(retryAfter, 10) * 1000
            : Math.pow(2, attempts) * 1000 + attempts * 1000;
          if (delay > 5000) throw err;
          attempts++;
          if (attempts > 3) throw err;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw err;
      }
    }
  });

  return result;
}

// Wrapper for Groq streaming requests with throttling and exponential backoff retry
async function groqRequestStream(url: string, data: any): Promise<any> {
  // Perform request with throttling and retry logic
  return await enqueueRequest(async () => {
    let attempts = 0;
    while (true) {
      try {
        const response = await axios.post(url, data, {
          headers: {
            Authorization: `Bearer ${env.GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
          responseType: "stream",
          timeout: 20000,
        });
        return response;
      } catch (err: any) {
        if (err.response?.status === 429) {
          const retryAfter = err.response.headers["retry-after"];
          const delay = retryAfter
            ? parseInt(retryAfter, 10) * 1000
            : Math.pow(2, attempts) * 1000 + attempts * 1000;
          if (delay > 5000) throw err;
          attempts++;
          if (attempts > 3) throw err;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw err;
      }
    }
  });
}

export const macroAiService = {
  // Clear cache when regime changes (call this from frontend on regime transition)
  clearPlaybookCache,

  async analyzeRegime(
    assets: { ticker: string; name: string; change: number | null }[],
    calculatedRegime?: string,
    liquidityStatus?: string,
    context?: {
      growth?: {
        current?: number;
        ema10?: number;
        ema50?: number;
        roc5d?: number;
        status?: string;
        subScores?: Record<string, any>;
      };
      inflation?: {
        current?: number;
        ema10?: number;
        ema50?: number;
        roc5d?: number;
        status?: string;
        pressure?: string;
        subScores?: Record<string, any>;
      };
      liquidity?: {
        current?: number;
        ema10?: number;
        ema50?: number;
        roc5d?: number;
        status?: string;
        riskState?: string;
      };
      confidence?: {
        score?: number;
        conviction?: number;
        agreement?: number;
        persistence?: number;
        label?: string;
      };
      vix?: { value?: number | null; regime?: string; source?: string | null };
      yieldCurve?: {
        spread10y2y?: number | null;
        curveRegime?: string;
        inverted?: boolean;
      };
      geoRisk?: { scores?: Record<string, number>; topDriver?: string };
    },
  ) {
    // â”€â”€ Derive sentiment from regime + liquidity (deterministic, not AI) â”€â”€
    let sentiment: "RISK-ON" | "RISK-OFF" | "NEUTRAL" = "NEUTRAL";
    if (calculatedRegime === "Reflation" || calculatedRegime === "Goldilocks") {
      sentiment = liquidityStatus === "Draining" ? "NEUTRAL" : "RISK-ON";
    } else if (
      calculatedRegime === "Stagflation" ||
      calculatedRegime === "Deflation" ||
      calculatedRegime === "Inflation"
    ) {
      sentiment = liquidityStatus === "Refilling" ? "NEUTRAL" : "RISK-OFF";
    }

    // â”€â”€ Build key assets map from heatmap data â”€â”€
    const keyAssets: Record<string, number> = {};
    if (assets && assets.length > 0) {
      // Gunakan data dari assets yang sudah ada
      for (const a of assets) {
        keyAssets[a.ticker] = a.change ?? 0;
      }
    } else {
          // Fallback ke marketDataService.getQuotes()
          const { macroDataService } = require("./market-data.service");
          const symbols = ["SPY", "QQQ", "IWM", "GLD", "SLV", "TLT", "IEF", "USO", "XLE", "XLU"];
          const quotes = await macroDataService.getQuotes(symbols);
          quotes.forEach((q: any) => {
            keyAssets[q.symbol] = q.changePercent ?? 0;
          });
        }

    // â”€â”€ Build unified state JSON using SAME data as classifier (SSOT) â”€â”€
    const stateJson = {
      regime: calculatedRegime ?? "unknown",
      confidence: context?.confidence ?? null,
      sentiment,
      growth: context?.growth
        ? {
            composite: context.growth.current,
            ema10: context.growth.ema10,
            ema50: context.growth.ema50,
            roc5d: context.growth.roc5d,
            status: context.growth.status,
            breakdown: context.growth.subScores ?? null,
          }
        : null,
      inflation: context?.inflation
        ? {
            composite: context.inflation.current,
            ema10: context.inflation.ema10,
            ema50: context.inflation.ema50,
            roc5d: context.inflation.roc5d,
            status: context.inflation.status,
            pressure: context.inflation.pressure,
            breakdown: context.inflation.subScores ?? null,
          }
        : null,
      liquidity: context?.liquidity
        ? {
            current: context.liquidity.current,
            ema10: context.liquidity.ema10,
            ema50: context.liquidity.ema50,
            roc5d: context.liquidity.roc5d,
            status: context.liquidity.status,
            riskState: context.liquidity.riskState,
          }
        : null,
      liquidityStatus: liquidityStatus ?? "unknown",
      vix: context?.vix ?? null,
      yieldCurve: context?.yieldCurve ?? null,
      geoRisk: context?.geoRisk ?? null,
      keyAssets,
    };

    let externalContext = "";
    try {
      const { marketDataService } = require("./market-data.service");
      const news = await marketDataService.getNews();
      const calendar = await marketDataService.getEconomicCalendar();
      const liquidityData = await marketDataService.getLiquidity();
      const tgaData = await marketDataService.getTGA();

      const newsStr = news?.length
        ? news
            .slice(0, 3)
            .map((n: any) => `- ${n.headline}`)
            .join("\n")
        : "Tidak ada berita.";
      const nextHighImpact = calendar?.find(
        (c: any) => c.impact === "High" && new Date(c.date) > new Date(),
      );
      const calStr = nextHighImpact
        ? `- ${nextHighImpact.title} (${nextHighImpact.currency})`
        : "Tidak ada event high-impact.";
      const formatLiquidity = (val: number | undefined) => {
        if (val === undefined) return "N/A";
        return val >= 1000
          ? (val / 1000).toFixed(2) + "T"
          : val.toFixed(2) + "B";
      };

      const rrpVal = formatLiquidity(liquidityData?.value);
      const rrpChange = liquidityData?.change || 0;
      const rrpDeltaStr = rrpChange >= 0 ? `+${formatLiquidity(rrpChange)}` : `-${formatLiquidity(Math.abs(rrpChange))}`;
      const rrpStatus = rrpChange > 0 ? "Ekspansi/Naik (Liquidity Draining/Menyedot)" : rrpChange < 0 ? "Kontraksi/Turun (Liquidity Injecting/Menyuntik)" : "Flat";
      
      const tgaVal = tgaData?.displayValue
        ? tgaData.displayValue.replace("$", "")
        : formatLiquidity(tgaData?.value);
      const tgaChange = tgaData?.delta || 0;
      const tgaDeltaStr = tgaChange >= 0 ? `+${formatLiquidity(tgaChange)}` : `-${formatLiquidity(Math.abs(tgaChange))}`;
      const tgaStatus = tgaChange > 0 ? "Ekspansi/Naik (Liquidity Draining/Menyedot)" : tgaChange < 0 ? "Kontraksi/Turun (Liquidity Injecting/Menyuntik)" : "Flat";

      const tgaRrpStr = `- ON RRP: Total $${rrpVal} (Perubahan: ${rrpDeltaStr}) [${rrpStatus}]\n- TGA: Total $${tgaVal} (Perubahan: ${tgaDeltaStr}) [${tgaStatus}]`;

      externalContext = `\nDATA OVERVIEW TAMBAHAN:\n[MACRO FEED]:\n${newsStr}\n[NEXT CALENDAR EVENT]:\n${calStr}\n[LIQUIDITY FLOW]:\n${tgaRrpStr}`;
    } catch (e) {
      silentLogger.warn("[MacroAI] Failed to fetch external context", e);
    }

    const prompt = `Anda adalah analis makro institusional. Gunakan state berikut sebagai SSOT Macro Terminal.
Data Utama:
${JSON.stringify(stateJson, null, 2)}
${externalContext}

INSTRUKSI ANALISIS HOLISTIK (WAJIB GUNAKAN BULLET POINTS, GAYA TELEGRAFIS/FLASH NOTE TERMINAL):

[ REGIME & MOMENTUM ]
- Nyatakan regime makro (${calculatedRegime || "unknown"}) dan skor confidence secara ringkas.
- Hubungkan delta ROC-5d Growth & Inflation dengan prospek ke depan (Gunakan panah atau metrik langsung). WAJIB sertakan catatan analitis yang memperjelas dinamika "Momentum vs Absolute Level" jika terjadi divergensi (Contoh: "Meskipun CPI YoY secara absolut masih HOT, namun momentum (ROC) DECELERATING yang berarti ekspektasi inflasi mulai turun").
- Jika ada divergensi, nyatakan potensi rotasi sektoral atau pergeseran postur makro dalam 1 kalimat padat.

[ LIQUIDITY FLOW ]
- Kondisi likuiditas agregat (${context?.liquidity?.riskState ?? "N/A"}).
- Laporkan dinamika harian ON RRP dan TGA menggunakan angka *Perubahan* (bukan angka Total).
- Sebutkan secara eksplisit apakah perubahan harian tersebut berakibat *liquidity drain* (menyedot) atau *liquidity injection* (menyuntik) berdasarkan data yang disediakan. JANGAN PERNAH tertukar logika ini.
- Nyatakan dampak langsung tekanan likuiditas ini ke risk-appetite pasar secara *to-the-point*.

[ MACRO HEATMAP ]
- Identifikasi *capital flow* institusional agresif dari data ETF Heatmap hari ini (keyAssets).
- Hubungkan flow ini dengan narasi regime & likuiditas di atas (Validasi vs Divergensi).

[ BERITA & EVENT ]
- Sintesis katalis fundamental dari Macro Feed & Economic Calendar.
- Jangan mengulang judul berita! Berikan *takeaway* analitis: Apakah berita secara kolektif memvalidasi (Risk-On/Off) atau mengancam stabilitas regime makro saat ini?

[ MACRO SYNTHESIS ]
- Jelaskan secara tajam MENGAPA data di atas saling terkait dan apa dampaknya secara keseluruhan (Causal Loop).
- Hubungkan interaksi antara Regime saat ini dengan kondisi Likuiditas dan News. (Contoh: "Likuiditas yang *draining* memaksa rotasi dari aset berisiko meskipun Regime menunjukkan Growth stabil, karena...").
- Ini membantu *user* memahami "benang merah" dari seluruh metrik yang disajikan.

[ INVALIDATION ]
- Sebutkan metrik teknikal/sub-indikator spesifik yang bertindak sebagai titik invalidasi tesis makro ini.`;

    const systemPrompt =
      "ROLE & PERSONA: Anda adalah Senior Macro Institutional Analyst di Hunter Trades. Anda menyajikan 'Flash Note' ke terminal kuantitatif elit. RULES MUTLAK: 1. DILARANG KERAS menggunakan kalimat naratif panjang, pengantar (seperti 'Regime makro saat ini adalah...', 'Berdasarkan data...'). 2. WAJIB menggunakan format telegraphic / bullet points (-) murni ala Bloomberg Terminal (Contoh: '- Active Regime: Goldilocks. - Momentum: Growth akselerasi, Inflasi tertekan.'). 3. Gunakan jargon finansial profesional (misal: 'Risk-On posture', 'Defensive rotation', 'Liquidity drain'). 4. JANGAN ulangi header dengan teks naratif di bawahnya, langsung masuk ke bullet point. 5. Gunakan header persis seperti yang diminta TANPA tambahan asteris markdown (tulis [ REGIME & MOMENTUM ]).";

    const text = await callDualEngine(prompt, systemPrompt, {
      max_output_tokens: 2500,
      temperature: 0.3,
    });

    if (text) {
      return text.trim();
    }

    // Fallback: deterministic Flash Note based on stateJson
    const fallbackNote = `[ REGIME & MOMENTUM ]
- Active Regime: ${stateJson.regime || "unknown"}
- Momentum: Growth ${((stateJson.growth as any)?.roc5d ?? 0) >= 0 ? "akselerasi" : "decelerasi"}, Inflasi ${((stateJson.inflation as any)?.roc5d ?? 0) >= 0 ? "meningkat" : "menurun"}
- Divergensi: ${(((stateJson.growth as any)?.roc5d ?? 0) * ((stateJson.inflation as any)?.roc5d ?? 0)) < 0 ? "YA" : "TIDAK"}

[ LIQUIDITY FLOW ]
- Kondisi likuiditas: ${stateJson.liquidityStatus || "N/A"}
- Likuiditas ${((stateJson.liquidity as any)?.roc5d ?? 0) >= 0 ? "menyuntik" : "menyedot"} (${((stateJson.liquidity as any)?.roc5d ?? 0).toFixed(2)}%)
- Dampak: ${((stateJson.liquidity as any)?.roc5d ?? 0) >= 0 ? "Risk-On" : "Risk-Off"} posture

[ MACRO SYNTHESIS ]
- Causal Loop: ${stateJson.regime} + ${stateJson.liquidityStatus} + ${stateJson.sentiment} memaksa rotasi ke ${stateJson.sentiment === "RISK-ON" ? "aset berisiko" : "aset defensif"}`;

    silentLogger.warn(`[MacroAI] AI analysis failed — returning deterministic fallback note: ${fallbackNote.slice(0, 120)}...`);
    return fallbackNote.trim();

    throw new Error("Gagal mendapatkan analisis regime dari layanan AI.");
  },
  async chatStream(
      messages: any[],
      currentRegime?: string,
      assets?: any[],
      liquidityStatus?: string,
      personaId: string = "default",
      userId?: string,
      context?: {
      vix?: { value?: number | null; regime?: string; source?: string | null };
      yieldCurve?: {
        spread10y2y?: number | null;
        curveRegime?: string;
        inverted?: boolean;
      };
      geoRisk?: { scores?: Record<string, number>; topDriver?: string };
      nextEvent?: { title?: string; date?: string; impact?: string };
    },
  ) {
    // ─── Pre-fetch LIVE Data into Prompt ───
    let liveNews = "";
    let liveCalendar = "";
    let cpiReleaseDate = "terbaru";  // akan diupdate dari MongoDB/FRED
    try {
      const { marketDataService } = require("./market-data.service");
      const [news, calendar] = await Promise.all([
        marketDataService.getNews(),
        marketDataService.getEconomicCalendar()
      ]);
      
      if (news && news.length > 0) {
        liveNews = news.slice(0, 5).map((n: any) => `- ${n.headline} (${n.source})`).join("\n");
      }
      if (calendar && calendar.length > 0) {
        liveCalendar = calendar.slice(0, 5).map((e: any) => `- ${e.date}: ${e.title} (${e.impact}) - Actual: ${e.actual || 'N/A'}, Forecast: ${e.forecast || 'N/A'}`).join("\n");
      }
    } catch (e) {
      silentLogger.warn("[MacroAI Chat] Failed to fetch live data for prompt", e);
    }

    const regimeContext = currentRegime ? `Macro Regime: ${currentRegime}. ` : "";
    const liquidityContext = liquidityStatus ? `Liquidity ON RRP: ${liquidityStatus}. ` : "";
    const assetData = assets && Array.isArray(assets) 
      ? `Assets: ${assets.map((a: any) => `${a.symbol || a.ticker} (${a.changePercent || a.change || 0}% ${a.changeDirection || ''})`).join(", ")}. ` 
      : "";

    let personaDescription = "Anda adalah AI Assistant Market global.";
    if (personaId === "hawk") {
      personaDescription = "Anda adalah Hawk Kuantitatif yang fokus pada data pengetatan moneter, risiko inflasi, dan crash likuiditas. Sampaikan pandangan bearish/inflasi jika data mendukung.";
    } else if (personaId === "dove") {
      personaDescription = "Anda adalah Dove yang fokus pada peluang akomodasi moneter, potensi rally risk-on, dan stimulus. Sampaikan pandangan bullish/akomodatif jika data mendukung.";
    } else if (personaId === "contrarian") {
      personaDescription = "Anda adalah analis kontrarian yang mencari kelemahan dalam konsensus pasar.";
    }

    // Agent Tools Execution (Live Price, Market Regime, Economic Calendar, Liquidity)
    let agentToolsResultText = "";
    try {
      const { agentTools } = require("../helpers/agent-tools.helper");
      const agentContext = { userId, personaId, currentRegime, assets, liquidityStatus };

      const [priceData, regimeData, calData, liqData] = await Promise.all([
        agentTools.get_price(agentContext, ["XAUUSD", "DXY"]).catch(() => null),
        agentTools.get_market_regime(agentContext).catch(() => null),
        agentTools.get_economic_calendar(agentContext).catch(() => null),
        agentTools.get_liquidity(agentContext).catch(() => null),
      ]);

      agentToolsResultText = `
DATA HASIL EXECUTION AGENT TOOLS (REALTIME):
- Price Data (XAUUSD): ${JSON.stringify(priceData || "N/A")}
- Market Regime: ${JSON.stringify(regimeData || "N/A")}
- Economic Calendar (3 hari kedepan): ${JSON.stringify(calData || "N/A")}
- Liquidity Status: ${JSON.stringify(liqData || "N/A")}
`;
    } catch (err: any) {
      silentLogger.warn("[MacroAI Chat] Failed to execute Agent Tools for Chat Stream", err);
    }

        let macroDataContext = "";
    let cpiVal = "3.57"; // outer scope for Critic Pass access (CPI YoY Sep 2026: ~3.57%)
    let fedRateLive = "4.25"; // outer scope — dipakai untuk Live MacroSSOT
    let vixLive = "18.00"; // outer scope — dipakai untuk Live MacroSSOT
    // Liquidity live values (ON RRP & TGA) — dipakai untuk Live MacroSSOT
    let onRrpLive: number | null = null;
    let tgaLive: number | null = null;
    let onRrpDisplay = "N/A";
    let tgaDisplay = "N/A";
    let liquidityStatusLive = "UNKNOWN";
        try {
          // Direct in-process SSOT fetch (instant & fail-safe)
          const [geoRes, regimeRes] = await Promise.all([
            geoRiskService.getScores().catch(() => null),
            macroRegimeService.getSnapshot().catch(() => null),
          ]);

          const rawGeo = (geoRes?.raw || {}) as Record<string, any>;
          const regimeData = (regimeRes || {}) as Record<string, any>;

          cpiVal = regimeData?.cpiYoY != null
            ? regimeData.cpiYoY.toFixed(2)
            : (rawGeo?.cpi_yoy != null ? rawGeo.cpi_yoy.toFixed(2) : "3.57");
          const fedRate = rawGeo?.fedfunds_rate != null ? rawGeo.fedfunds_rate.toFixed(2) : "N/A";
          const vixVal = rawGeo?.vix != null ? rawGeo.vix.toFixed(2) : "18.00";
          fedRateLive = fedRate;
          vixLive = vixVal;
          const pmiVal = rawGeo?.globalPmi != null ? rawGeo.globalPmi : "48.7";
          const regime = regimeData?.quadrant || currentRegime || "Reflation";
          const inflationStatus = regimeData?.inflation?.pressure || "NORMAL";

      // News & Economic Calendar fallbacks
      let newsText = "Tidak ada berita tersedia.";
      let calText = "Tidak ada event ekonomi tersedia.";
      try {
        const { marketDataService } = require("./market-data.service");
        const [news, calendar] = await Promise.all([
          marketDataService.getNews(),
          marketDataService.getEconomicCalendar()
        ]);
        if (news?.length) newsText = news.slice(0, 5).map((n: any) => `- [${n.source || "News"}] ${n.headline}`).join("\n");
        if (calendar?.length) calText = calendar.slice(0, 5).map((e: any) => `- ${e.date || ""} | ${e.title || e.event} | Impact: ${e.impact || "N/A"}`).join("\n");
      } catch (e) {
        // ignore
      }

      // ─── LIQUIDITY LIVE: ON RRP & TGA (sumber yang sama dengan dashboard UI) ───
      // PENTING: tanpa ini, liveMacroSSOT.liquidity masih memakai angka MOCK
      // (ondRP 69.8 / tga 0.0) → jawaban AI mismatch dengan dashboard.
      try {
        const { marketDataService } = require("./market-data.service");
        const [rrpData, tgaData] = await Promise.all([
          marketDataService.getLiquidity().catch(() => null),
          marketDataService.getTGA().catch(() => null),
        ]);

        const fmtLiquidity = (val: number | undefined | null): string => {
          if (val === undefined || val === null || !Number.isFinite(val)) return "N/A";
          return val >= 1000 ? `${(val / 1000).toFixed(2)}T` : `${val.toFixed(2)}B`;
        };

        if (rrpData && Number.isFinite(rrpData.value)) {
          onRrpLive = rrpData.value;
          // Format sama dengan dashboard UI (2 desimal)
          onRrpDisplay = `$${fmtLiquidity(rrpData.value)}`;
        }
        if (tgaData && Number.isFinite(tgaData.value)) {
          tgaLive = tgaData.value;
          // Pakai displayValue dari service supaya PERSIS sama dengan dashboard
          tgaDisplay = tgaData.displayValue
            ? tgaData.displayValue.replace("$", "")
            : fmtLiquidity(tgaData.value);
        }

        // Status likuiditas agregat — TGA naik = draining, RRP naik = draining
        const tgaDelta = tgaData?.delta ?? 0;
        const rrpDelta = rrpData?.change ?? 0;
        const netDelta = (tgaDelta || 0) + (rrpDelta || 0);
        liquidityStatusLive =
          Math.abs(netDelta) < 0.1 ? "NEUTRAL" : netDelta > 0 ? "DRAINING" : "INJECTING";

        silentLogger.info(
          `[MacroAI Chat] Liquidity live — ON RRP=${onRrpDisplay}, TGA=${tgaDisplay}, status=${liquidityStatusLive}`
        );
      } catch (e) {
        silentLogger.warn("[MacroAI Chat] Gagal fetch liquidity live (ON RRP/TGA):", e);
      }

      // Ambil tanggal rilis CPI dari database (MacroIndicator → GeoRiskSnapshot → calendar)
      cpiReleaseDate = await getCpiReleaseDate();

      macroDataContext = `
        DATA MAKRO AKTUAL (AS) — SUMBER KEBENARAN MUTLAK (SSOT):
        - Inflasi AS CPI YoY: ${cpiVal}% (Rilis: ${cpiReleaseDate})
        - Regime Pasar: ${regime} | Tekanan Inflasi: ${inflationStatus}
        - Suku Bunga Fed Funds: ${fedRate}%
        - ISM Manufacturing PMI: ${pmiVal}
        - VIX: ${vixVal}
        - ON RRP (Overnight Reverse Repo): ${onRrpDisplay}
        - TGA (Treasury General Account): ${tgaDisplay}
        - Status Likuiditas: ${liquidityStatusLive}

BERITA MAKRO TERBARU:
${newsText}

EVENT EKONOMI MENDATANG:
${calText}`;
      silentLogger.info(`[MacroAI Chat] Injected SSOT: CPI=${cpiVal}%, Fed=${fedRate}%, Regime=${regime}, ON_RRP=${onRrpDisplay}, TGA=${tgaDisplay}`);
    } catch (e) {
      silentLogger.warn("[MacroAI Chat] Error fetching macroDataContext", e);
    }

    // ─── 3. Fetch UserProfile & Memory Notes dari PostgreSQL ───
    let userProfile = null as any;
    let memoryNotes: any[] = [];
    try {
      if (userId) {
        const profileData = await resolveProfileForUser(userId);
        userProfile = profileData?.profile;
        memoryNotes = profileData?.notes || [];
        silentLogger.info(`[Hermes] Profile loaded — userId=${userId}, resolved=${userProfile?.userId ?? "none"}, notes=${memoryNotes.length}, persona=${userProfile?.agentPersona ?? "hawk"}`);
      }
    } catch (err) {
      silentLogger.warn("[Hermes] Gagal fetch profile dari PostgreSQL:", err);
    }

    // ─── 4. Build extra context untuk Hermes prompt ───
    // CATATAN: macroDataContext sudah punya header "DATA MAKRO AKTUAL ... SSOT" sendiri,
    // jadi jangan tambahkan header duplikat di sini (membingungkan LLM).
    const contextLines: string[] = [
      macroDataContext || "DATA MAKRO AKTUAL (AS) — SUMBER KEBENARAN MUTLAK (SSOT):\nData makro tidak tersedia",
      "",
      "LIVE MACRO FEED (BERITA):",
      liveNews || "Tidak ada berita terbaru.",
      "",
      "EVENT EKONOMI MENDATANG:",
      liveCalendar || "Tidak ada jadwal event ekonomi.",
      "",
      "AGENT TOOLS RESULT:",
      agentToolsResultText || "Tidak ada data dari tools.",
    ];

    // Yield curve & regime dari context frontend (data live, sama dengan banner UI)
    if (context?.yieldCurve) {
      contextLines.push(
        "",
        "YIELD CURVE (LIVE dari terminal):",
        `- Regime: ${context.yieldCurve.curveRegime ?? "UNKNOWN"}${
          context.yieldCurve.inverted ? " (INVERTED)" : ""
        }`,
        `- Spread 10Y-2Y: ${
          typeof context.yieldCurve.spread10y2y === "number"
            ? `${context.yieldCurve.spread10y2y}%`
            : "N/A"
        }`
      );
    }

    // Regime pasar live dari frontend
    if (currentRegime || liquidityStatus) {
      contextLines.push(
        "",
        "REGIME & LIKUIDITAS (LIVE dari terminal):",
        `- Regime: ${currentRegime ?? "UNKNOWN"}`,
        `- Status Likuiditas (UI): ${liquidityStatus ?? liquidityStatusLive}`
      );
    }

    const extraContext = contextLines.join("\n");

    // ─── 5. Assemble Hermes Prompt ───
    // PENTING: pakai LIVE SSOT (bukan DEFAULT_MACRO_SSOT mock) supaya angka yang
    // di-inject ke system prompt konsisten dengan data live di extraContext.
    // Mock hanya dipakai sebagai fallback kalau fetch live gagal total.
    const liveMacroSSOT: MacroSSOT = {
      ...DEFAULT_MACRO_SSOT,
      timestamp: new Date().toISOString(),
      cpi: {
        yoy: parseFloat(cpiVal) || DEFAULT_MACRO_SSOT.cpi.yoy,
        mom: DEFAULT_MACRO_SSOT.cpi.mom,
      },
      // VIX: utamakan data live dari server; kalau tidak ada, pakai dari context frontend
      vix:
        parseFloat(vixLive) ||
        (typeof context?.vix?.value === "number" ? context.vix.value : DEFAULT_MACRO_SSOT.vix),
      // Fed Funds: parseFloat("N/A") = NaN → jangan fallback ke mock usang (4.5).
      // Kalau tidak tersedia, biarkan null supaya prompt menampilkan "N/A".
      fedFundsRate: (() => {
        const parsed = parseFloat(fedRateLive);
        return Number.isFinite(parsed) ? parsed : null;
      })(),
      // Yield curve: pakai data live dari context frontend (bukan mock 0.28/-0.09)
      yieldCurve: {
        tenor10y2y:
          typeof context?.yieldCurve?.spread10y2y === "number"
            ? context.yieldCurve.spread10y2y
            : DEFAULT_MACRO_SSOT.yieldCurve.tenor10y2y,
        tenor10y3m: DEFAULT_MACRO_SSOT.yieldCurve.tenor10y3m,
      },
      // Liquidity: pakai nilai live kalau tersedia; JANGAN fallback ke mock 69.8/0.0
      // karena itu bikin jawaban AI mismatch dengan dashboard UI.
      liquidity: {
        // Dibulatkan 2 desimal supaya identik dengan tampilan dashboard
        ondRP: onRrpLive !== null ? Math.round(onRrpLive * 100) / 100 : null,
        tga: tgaLive !== null ? Math.round(tgaLive * 100) / 100 : null,
        reserveBalance: DEFAULT_MACRO_SSOT.liquidity.reserveBalance,
      },
    };

    const systemPrompt = assembleHermesPrompt({
      agentId: "chat-agent",
      userProfile,
      macroSSOT: liveMacroSSOT,
      memoryNotes,
      userMessage: messages.length > 0 ? messages[messages.length - 1].content : "",
      chatHistory: messages.slice(0, -1),
      extraContext,
    });

    // Log skill yang ter-auto-load (untuk debugging & verifikasi)
    try {
      const { selectSkills } = require("../lib/agent/skill-loader");
      const loaded = selectSkills({
        userMessage: messages.length > 0 ? String(messages[messages.length - 1].content) : "",
        recentMessages: messages.slice(-3, -1).map((m: any) => String(m.content)),
        limit: 3,
      });
      if (loaded.length > 0) {
        silentLogger.info(
          `[Hermes] Skills auto-loaded: ${loaded.map((s: any) => `${s.skill.name}(${s.matchedTriggers.join("/")})`).join(", ")}`
        );
      } else {
        silentLogger.info("[Hermes] Skills auto-loaded: (none matched)");
      }
    } catch (e) {
      silentLogger.warn("[Hermes] Skill loader logging gagal:", e);
    }
    try {
      // ─── Build messages untuk LLM ───
      const chatHistory = messages.slice(0, -1);
      const formattedMessages = [
        { role: "system", content: systemPrompt },
        ...chatHistory.map((m: any) => ({
          role: m.role === "system" ? "user" : m.role,
          content: String(m.content)
            .replace(/(?:Pilihan|Alternatif)\s*(?:lebih\s*)?malas:[^\n]*/gi, "")
            .replace(/(?:\/\/\s*)?ponytail:?[^\n]*/gi, "")
            .replace(/(?:→\s*)?skipped:\s*[^\n]*/gi, "")
            .replace(/Add when:[^\n]*/gi, "")
            .trim(),
        })),
      ];

      // CATATAN: JANGAN buang system prompt. Array dimulai dengan [system, ...history].
      // Hanya pastikan ada minimal satu pesan user setelah system prompt.
      const hasUserMessage = formattedMessages.some((m: any) => m.role === "user");
      if (!hasUserMessage) {
        formattedMessages.push({
          role: "user",
          content: messages.length > 0 ? String(messages[messages.length - 1].content) : "Halo",
        });
      }

      // ─── Call LLM dengan fallback model chain ───
      // CATATAN: 9router (model "free") TIDAK mendukung response_format json_object
      // (menyebabkan HTTP 400/410). Format JSON diminta lewat instruksi di system prompt.
      // Model "free" kadang return 410 Gone (upstream habis) → coba model fallback.
      const primaryModel = env.NINE_ROUTER_MODEL || "free";
      const modelChain = [primaryModel, "auto-free-model", "claude-opus-4.6"].filter(
        (m, i, arr) => arr.indexOf(m) === i
      );

      let response: any = null;
      let lastLlmError: any = null;
      for (const model of modelChain) {
        try {
          response = await axios.post(
            `${env.NINE_ROUTER_URL}/chat/completions`,
            {
              model,
              messages: formattedMessages,
              max_tokens: 4096,
              temperature: 0.5,
              stream: false,
            },
            {
              timeout: 60000,
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${env.NINE_ROUTER_API_KEY || "sk-dummy"}`,
              },
            }
          );
          // Deteksi respons "error message" dari upstream yang dikirim sebagai content
          // (mis. "Gemini 3.5 Flash is no longer available...") — bukan jawaban valid.
          const rawContent: string =
            response?.data?.choices?.[0]?.message?.content || "";
          const looksLikeUpstreamError =
            rawContent.length < 300 &&
            /(no longer available|not available|please switch to|deprecated|model .* (not found|unavailable)|quota|rate limit)/i.test(
              rawContent
            ) &&
            !rawContent.trim().startsWith("{");

          if (looksLikeUpstreamError) {
            silentLogger.warn(
              `[MacroAI Chat] Model "${model}" mengembalikan pesan error upstream sebagai content: "${rawContent.slice(0, 120)}" — coba model berikutnya.`
            );
            lastLlmError = new Error(`Upstream error message: ${rawContent.slice(0, 120)}`);
            response = null;
            continue;
          }

          if (model !== primaryModel) {
            silentLogger.warn(`[MacroAI Chat] Fallback model "${model}" berhasil (primary "${primaryModel}" gagal).`);
          }
          break;
        } catch (e: any) {
          lastLlmError = e;
          const status = e?.response?.status;
          silentLogger.warn(`[MacroAI Chat] Model "${model}" gagal (status=${status ?? "n/a"}): ${e.message}`);
        }
      }

      if (!response) {
        throw new Error(
          `Semua model gagal. Terakhir: ${lastLlmError?.response?.status ?? ""} ${lastLlmError?.message ?? ""}`
        );
      }

      const raw = response.data?.choices?.[0]?.message?.content || "{}";
      let parsed: any = {};
      try {
        parsed = JSON.parse(raw);
      } catch {
        // LLM sering membungkus JSON dalam markdown code fence (```json ... ```)
        const cleaned = raw
          .replace(/^\s*```(?:json)?\s*/i, "")
          .replace(/\s*```\s*$/, "")
          .trim();
        try {
          parsed = JSON.parse(cleaned);
        } catch {
          // JSON terpotong (max_tokens habis) — salvage isi field pakai regex
          const salvage = (key: string): string => {
            const re = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, "s");
            const m = cleaned.match(re);
            if (!m) return "";
            try {
              return JSON.parse(`"${m[1]}"`);
            } catch {
              return m[1];
            }
          };
          const salvagedReasoning = salvage("reasoning");
          const salvagedContent = salvage("content");
          if (salvagedContent || salvagedReasoning) {
            parsed = { reasoning: salvagedReasoning, content: salvagedContent };
            silentLogger.warn("[MacroAI Chat] JSON terpotong — field diselamatkan via regex salvage.");
          } else {
            parsed = {};
          }
        }
      }

      let replyText: string = "";
      let reasoningText: string = "";

      if (parsed.reasoning && typeof parsed.content === "string") {
        reasoningText = parsed.reasoning;
        replyText = parsed.content;
      } else if (typeof parsed.content === "string") {
        replyText = parsed.content;
      } else if (raw.trim()) {
        replyText = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
      }

      if (!replyText) throw new Error("Empty response");

      // Critic Pass (CPI verification)
      const cpiMatch = replyText.match(/CPI[^\n\d]*?(\d+(?:\.\d+)?)\s*%/gi);
      if (cpiMatch) {
        for (const m of cpiMatch) {
          const numMatch = m.match(/(\d+(?:\.\d+)?)/);
          if (numMatch) {
            const foundNum = parseFloat(numMatch[1]);
            if (!isNaN(parseFloat(cpiVal)) && Math.abs(foundNum - parseFloat(cpiVal)) > 0.01) {
              replyText = replyText.replace(numMatch[1], String(cpiVal));
              silentLogger.warn(`[Critic Pass] CPI ${numMatch[1]}% → ${cpiVal}%`);
            }
          }
        }
      }

      selfImprovementService.enqueueJob({
        personaId,
        userId,
        prompt: messages.map((m: any) => String(m.content)).join(" | "),
        finalReply: replyText,
        wasCorrected: false,
        dataPoint: "CPI YoY",
        expected: `${cpiVal}%`,
      });

      const toolsUsed: string[] = ["hermes_context", "in_process_fetch", "critic_pass"];

      // Background Memory Extraction (async, non-blocking)
      if (userId) {
        setImmediate(async () => {
          try {
            const extractedFacts = await extractUserFacts({
              chatHistory: [...messages],
              userProfile,
            });
            if (extractedFacts.length > 0) {
              const saved = await saveFactsToUserProfile(userId, extractedFacts);
              silentLogger.info(`[Hermes] Background extraction — facts=${extractedFacts.length}, saved=${saved}, userId=${userId}`);
            }
          } catch (e) {
            silentLogger.error("[Hermes] Background extraction gagal:", e);
          }
        });
      }

      return { text: replyText, reasoning: reasoningText, toolsUsed };
    } catch (error: any) {
      silentLogger.error("[MacroAI Chat] failed:", error.message);
      throw new Error("Gagal mendapatkan respons AI.");
    }
  },


  async analyzeMacroFeed(
  headline: string,
    targetAsset: string,
    context?: string,
  ) {
    const geminiModel = env.GEMINI_MODEL || "gemini-2.5-flash";

    const prompt = `Lakukan bedah berita makro berikut secara institusional:
Berita: "${headline}"
Aset Terkait: ${targetAsset}
${context ? `Konteks Tambahan: ${context}` : ""}

Jawab HANYA dengan JSON valid (tanpa markdown blok, tanpa teks apa pun di luar JSON) yang menggunakan struktur berikut (JANGAN mengisi dengan "Tidak ada data"):
{
  "topic": "Kategori/Topik berita (contoh: OIL, GEOPOLITICS, FED, INFLATION, atau nama negara)",
  "assets": "Tuliskan 1-3 TICKER KEUANGAN (contoh: SPY, USO, DXY) atau kelas aset. JANGAN tulis nama negara di sini.",
  "regime": "Pilih SATU: Reflation, Deflation, Goldilocks, Stagflation, atau Neutral",
  "Fakta": "Ekstrak 1-2 kalimat fakta absolut dari berita (angka, data, atau aksi nyata). Jangan tambahkan opini.",
  "dampakMarket": "Arah aliran modal (capital flow) dan dampak orde-kedua terhadap aset ${targetAsset}, DXY, maupun Yields.",
  "logika": "Mekanisme makro yang mendasari dampak tersebut (hubungkan dengan suku bunga, likuiditas, atau premi risiko).",
  "contrarian": "Skenario kegagalan narasi (contoh: sudah di-price in, reaksi algoritma sesaat, atau anomali data musiman).",
  "triggerFundamentalNonTeknikal": "Data makro atau event berikutnya yang akan memvalidasi/menggagalkan tesis ini.",
  "confidenceScore": "Pilih SATU saja: TINGGI, SEDANG, atau RENDAH"
}`;

    const systemPrompt =
      "ROLE & PERSONA: Anda adalah Institutional Macro Strategist (Hedge Fund). Analisis Anda tajam, to-the-point.\n" +
      "ATURAN MUTLAK:\n" +
      "1. SELALU berikan analisis (jangan jawab 'Tidak ada data').\n" +
      "2. DILARANG mengulang fakta berita di kolom analisis. Berikan turunan efek orde-kedua (second-order thinking).\n" +
      "3. Output HARUS murni format JSON string, tanpa backticks (```json), tanpa teks awalan/akhiran. Parsing akan gagal jika ada karakter selain JSON.\n" +
      "4. WAJIB gunakan Bahasa Indonesia untuk semua isi analisis.";

    let text: string | null = null;
    try {
      if (env.GROQ_API_KEY) {
        const cacheKey = `feed-${JSON.stringify({ headline, targetAsset, context })}`;
        const response = await groqRequest<GroqResponse>(
          GROQ_API_URL,
          {
            model: GROQ_MODELS[0],
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: prompt },
            ],
            max_tokens: 1000,
            temperature: 0.2,
            stream: false,
          },
          { useCache: true, cacheKey },
        );

        text = response.choices?.[0]?.message?.content || null;
      }
    } catch (error: any) {
      if (!isRetryableGroqError(error) || !env.GEMINI_API_KEY) {
        if (!env.GROQ_API_KEY && !env.GEMINI_API_KEY) {
          throw new Error(
            "Fitur AI dinonaktifkan: GROQ_API_KEY dan GEMINI_API_KEY tidak ditemukan",
          );
        }
        if (!isRetryableGroqError(error)) {
          throw error;
        }
      }
      silentLogger.warn(
        "[MacroAI] Groq macro feed error, switching to Gemini fallback:",
        error.response?.status,
      );
    }

    if (!text) {
      text = await callDualEngine(prompt, systemPrompt, {
        max_output_tokens: 1000,
        temperature: 0.2,
      });
    }

    if (!text) {
      return {
        assets: "Tidak ada data",
        regime: "Tidak ada data",
        fakta: headline || "Tidak ada data",
        dampakMarket: "Analisis tidak tersedia",
        logika: "Analisis tidak tersedia",
        contrarian: "Analisis tidak tersedia",
        triggerFundamentalNonTeknikal: "Analisis tidak tersedia",
        confidenceScore: "Sedang",
      };
    }

    const parsed = parseMacroFeedText(text);
    silentLogger.info("[MacroAI] Single Analysis Raw Response:", text);
    silentLogger.info("[MacroAI] Parsed Result:", parsed);
    return {
      topic: parsed.topic || "NEWS",
      assets: parsed.assets || "General",
      regime: parsed.regime || "Neutral",
      fakta: parsed.fakta || "Tidak ada data",
      dampakMarket: parsed.dampakMarket || "Tidak ada data",
      logika: parsed.logika || "Tidak ada data",
      contrarian: parsed.contrarian || "Tidak ada data",
      triggerFundamentalNonTeknikal:
        parsed.triggerFundamentalNonTeknikal || "Tidak ada data",
      confidenceScore: parsed.confidenceScore || "Sedang",
    };
  },

  async analyzeNexus(
    nodesData: Record<string, any>,
    context?: {
      currentRegime?: string | null;
      liquidityStatus?: string | null;
      vixRegime?: string | null;
      yieldCurveRegime?: string | null;
      geoRiskTopDriver?: string | null;
      nextHighImpactEvent?: {
        title?: string;
        date?: string;
        impact?: string;
      } | null;
    },
  ) {
    const institutionalContext = {
      currentRegime: context?.currentRegime ?? "unknown",
      liquidityStatus: context?.liquidityStatus ?? "unknown",
      vixRegime: context?.vixRegime ?? "unknown",
      yieldCurveRegime: context?.yieldCurveRegime ?? "unknown",
      geoRiskTopDriver: context?.geoRiskTopDriver ?? "unknown",
      nextHighImpactEvent: context?.nextHighImpactEvent ?? null,
    };

    const prompt = `Anda adalah Senior Head of Institutional Macro Desk di sebuah hedge fund ternama. Anda berbicara dengan gaya lugas, tajam, dan penuh wawasan (institutional tone). Berhentilah memberikan ringkasan angka yang kaku bagaikan robot. Tugas Anda adalah memberikan INSIGHT sebab-akibat (causal inference) mengapa angka-angka ini terjadi dan kemana arah pergerakan uang institusi selanjutnya.

Konteks Institutional Desk:
${JSON.stringify(institutionalContext, null, 2)}

Data Live Causal Loop Makro:
${Object.entries(nodesData)
  .map(([k, v]) => {
    let status = "Netral";
    if (v.color === "#ef4444")
      status = "Merah (Negatif/Bahaya/Kontraksi/Bearish/Wrecking Ball)";
    if (v.color === "#22c55e") status = "Hijau (Positif/Aman/Ekspansi/Bullish)";
    if (v.color === "#f97316" || v.color === "#f59e0b")
      status = "Kuning (Waspada/Sticky)";
    return `- ${v.label}: ${v.value} [Kondisi: ${status}]`;
  })
  .join("\n")}

ATURAN DOMAIN EXPERTISE (SANGAT KRITIS):
1. BACA ALIRAN UANG (HULU KE HILIR): TGA yang menyedot likuiditas (merah) ditambah RRP yang pasif akan membuat Net Liquidity kontraksi. Ini adalah 'headwind' (angin sakal) struktural bagi pasar saham.
2. YIELD CURVE BUKAN SEKADAR NORMAL: Jika spread positif (contoh: +136 bps) tetapi warnanya Merah, itu adalah "Bear Steepener" (Aksi jual agresif di obligasi tenor panjang). Ini menandakan kepanikan pasar obligasi terhadap inflasi struktural atau suplai utang pemerintah yang berlebih, BUKAN hal yang normal!
3. ANOMALI EMAS VS REAL YIELD: Jika Real Yield tinggi/merah (misal > 2.0%) tapi Emas (Gold) tetap reli/hijau, JANGAN sebut ini wajar. Ini adalah anomali langka yang disebut "Debasement Fear" (Ketakutan hilangnya daya beli uang fiat akibat utang), di mana Emas mengabaikan yield tinggi dan fokus pada risiko sistemik.
4. SP500 VS LIQUIDITY: Jika SP500 hijau sementara Net Liquidity kontraksi, pasar saham sedang "Defying Gravity" (bergerak naik murni karena momentum, mengabaikan realita likuiditas yang mengering).

TUGAS: Hasilkan analisis desk brief dengan format eksplisit berikut:
1. ENGINE â€” driver utama dari liquidity/policy/yield/fear.
2. SQUEEZE â€” bottleneck atau tekanan yang paling mungkin memaksa rotasi aset.
3. FLOW â€” arah modal institusi berikutnya dan aset yang diuntungkan/rugi.
4. TRADE RISK â€” risiko posisi paling mahal jika narasi ini salah.
5. INVALIDATION TRIGGER â€” trigger data/event yang membatalkan tesis.

JANGAN ulangi semua angka secara kaku. Gunakan angka hanya untuk mendukung narasi tajam Anda. Jangan gunakan kata-kata AI generik (misal: "Kesimpulannya", "Dinamika saat ini"). Langsung menukik ke analisis.`;

    const systemPrompt =
      "ROLE: Senior Institutional Quant Trader. TONE: Tajam, analitis, sedikit sinis jika pasar tidak rasional. WAJIB menggunakan istilah finansial (Bear Steepener, Debasement, Liquidity Drain, Defying Gravity).\n\nBAHASA: WAJIB 100% Bahasa Indonesia profesional. DILARANG KERAS menggunakan bahasa Inggris untuk analisis. Jika ada istilah Inggris, tulis dalam Bahasa Indonesia atau beri padanannya.\n\nFORMAT: Langsung ke inti analisis. Jangan gunakan kata pengantar seperti 'Kesimpulannya', 'Dinamika saat ini', 'Berdasarkan data'. Jangan ulangi semua angka mentah â€” gunakan angka hanya untuk mendukung insight.";

    const text = await callDualEngine(prompt, systemPrompt, {
      max_output_tokens: 2000,
      temperature: 0.3,
    });
    if (text) {
      // Bersihkan <think> block dari model reasoning (misal qwen, deepseek)
      return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    }

    throw new Error("Gagal mendapatkan analisis Nexus dari layanan AI.");
  },

  async observePlaybook(
    regime: string,
    assets: Array<{ ticker: string; name: string; change: number | null }>,
    liquidityStatus: string,
    regimeDescription: string,
    context?: { vix?: string; yieldCurve?: string; geoRiskTopDriver?: string },
  ): Promise<Array<{ asset: string; desc: string }>> {
    // Check cache first
    const cacheKey = `playbook-${regime.toLowerCase()}`;
    if (playbookCache[cacheKey]) {
      return playbookCache[cacheKey].playbook;
    }

    const prompt = `Anda adalah observer meja makro institusi. Diberikan regime makro "${regime}" beserta data aset dan status likuiditas "${liquidityStatus}", identifikasi aset/ETF yang secara struktural menguntungkan di regime ini berdasarkan performa terkini atau peran strukturalnya.

Deskripsi regime: ${regimeDescription}

Snapshot aset:
${assets.map((a) => `- ${a.ticker} (${a.name}) pergerakan: ${a.change ?? "N/A"}%`).join("\n")}

Desk context: VIX ${context?.vix ?? "unknown"}, Yield Curve ${context?.yieldCurve ?? "unknown"}, Geo-risk driver ${context?.geoRiskTopDriver ?? "unknown"}.

Kembalikan HANYA JSON yang valid dengan skema:
{
  "playbook": [
    { "asset": "TICKER", "desc": "satu kalimat alasan (dalam bahasa Indonesia)" }
  ]
}

Aturan:
- Maksimal 2-4 entri
- Fokus pada alokasi aset dan mekanik hedging, bukan teori makro umum
- Jika tidak ada edge yang jelas, kembalikan playbook kosong []`;

    const systemPrompt =
      "Anda adalah strategis perdagangan makro. Selalu kembalikan JSON yang valid tanpa teks tambahan.";

    const text = await callDualEngine(prompt, systemPrompt, {
      max_output_tokens: 300,
      temperature: 0.2,
    });
    if (!text) {
      return [];
    }

    const cleaned = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      return [];
    }

    const jsonText = cleaned.slice(firstBrace, lastBrace + 1);
    const parsed = JSON.parse(jsonText);
    if (!parsed || typeof parsed !== "object") {
      return [];
    }

    const playbook = Array.isArray(parsed.playbook) ? parsed.playbook : [];
    const result = playbook.slice(0, 4);

    // Cache the result
    playbookCache[cacheKey] = { playbook: result };

    return result;
  },

  async batchAnalyzeNews(
    newsItems: { id: string | number; headline: string; source: string }[],
    context?: string,
  ): Promise<Record<string, any>> {
    if (newsItems.length === 0) return {};

    const geminiModel = env.GEMINI_MODEL || "gemini-2.5-flash";
    const newsListStr = newsItems
      .map((n, i) => `[${n.id}] ${n.source}: ${n.headline}`)
      .join("\n");

    const prompt = `Lakukan bedah berita makro secara institusional untuk daftar berita berikut:
${newsListStr}
${context ? `Konteks Tambahan: ${context}` : ""}

Jawab HANYA dengan array of JSON valid. Analisis SETIAP berita, JANGAN ADA yang terlewat. Jika berita singkat, tetap berikan ekstrapolasi logis. JANGAN PERNAH mengisi dengan "Tidak ada data". Setiap objek di dalam array merepresentasikan satu berita dan HARUS menggunakan struktur persis seperti berikut (perhatikan kapitalisasi huruf pada "Fakta"):
[
  {
    "id": "id berita sesuai input",
    "topic": "Kategori/Topik berita (contoh: OIL, GEOPOLITICS, FED, INFLATION, atau nama negara)",
    "assets": "Tuliskan 1-3 TICKER KEUANGAN (contoh: SPY, USO, DXY) atau kelas aset. JANGAN tulis nama negara di sini.",
    "regime": "Pilih SATU: Reflation, Deflation, Goldilocks, Stagflation, atau Neutral",
    "Fakta": "1-2 kalimat fakta absolut dari berita",
    "dampakMarket": "Arah aliran modal (capital flow) dan dampak orde-kedua",
    "logika": "Mekanisme makro yang mendasari dampak tersebut",
    "contrarian": "Skenario kegagalan narasi",
    "triggerFundamentalNonTeknikal": "Data makro/event berikutnya",
    "confidenceScore": "Pilih SATU: TINGGI, SEDANG, atau RENDAH"
  }
]`;

    const systemPrompt =
      "ROLE: Institutional Macro Strategist. RULES: 1. Selalu berikan analisis (jangan jawab 'Tidak ada data'). 2. Output HARUS array of JSON valid. 3. Jangan potong respon, selesaikan seluruh daftar. 4. WAJIB gunakan Bahasa Indonesia untuk semua isi analisis.";

    try {
      let text: string | null = null;

      // Use 9Router with NINE_ROUTER_MODELS failover
      const startTime = Date.now();
      let lastError: any = null;
      for (const modelConfig of NINE_ROUTER_MODELS) {
        try {
          const response = await axios.post(
            `${env.NINE_ROUTER_URL}/chat/completions`,
            {
              model: modelConfig.model,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt },
              ],
              max_tokens: 4000,
              temperature: 0.2,
              stream: false,
            },
            {
              headers: {
                Authorization: `Bearer ${env.NINE_ROUTER_API_KEY || "sk-dummy"}`,
                "Content-Type": "application/json",
              },
              timeout: 45000,
            }
          );
          text = response.data?.choices?.[0]?.message?.content || null;
          if (text && text.trim()) {
            silentLogger.info(`[MacroAI] batchAnalyzeNews 9Router (${modelConfig.name} - ${modelConfig.model}) succeeded after ${Date.now() - startTime}ms.`);
            break;
          }
        } catch (error: any) {
          lastError = error;
          silentLogger.warn(`[MacroAI] batchAnalyzeNews 9Router model ${modelConfig.name} failed: ${error.message}, trying next...`);
        }
      }

      if (!text) {
        silentLogger.error(`[MacroAI] All LLM models failed after ${Date.now() - startTime}ms. Last error: ${lastError?.message || "Unknown error"}`);
        // Fallback: return raw news items with minimal analysis
        const fallbackMap: Record<string, any> = {};
        for (const item of newsItems) {
          fallbackMap[item.id] = {
            id: item.id,
            topic: "NEWS",
            assets: "",
            regime: "Neutral",
            Fakta: item.headline,
            dampakMarket: "",
            logika: "",
            contrarian: "",
            triggerFundamentalNonTeknikal: "",
            confidenceScore: "RENDAH"
          };
        }
        silentLogger.warn("[MacroAI] Using fallback analysis due to LLM failure");
        return fallbackMap;
      }

      // Parse array JSON and convert to map
      const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
      const firstBracket = cleaned.indexOf('[');
      const lastBracket = cleaned.lastIndexOf(']');
      if (firstBracket >= 0 && lastBracket > firstBracket) {
        const arr = JSON.parse(cleaned.substring(firstBracket, lastBracket + 1));
        const map: Record<string, any> = {};
        for (const item of arr) {
          if (item.id) map[item.id] = item;
        }
        return map;
      }
      return {};
    } catch (error) {
      silentLogger.error("[MacroAI] batchAnalyzeNews failed:", error);
      return {};
    }
  },
};

function parseCotJson(text: string | null | undefined): { momentum: string; warnings: string; conclusion: string } | null {
  if (typeof text !== "string" || !text.trim()) return null;

  try {
    const cleaned = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;

    const jsonText = cleaned.slice(firstBrace, lastBrace + 1);
    const parsed = JSON.parse(jsonText);

    return {
      momentum: typeof parsed.momentum === "string" ? parsed.momentum.trim() : "",
      warnings: typeof parsed.warnings === "string" ? parsed.warnings.trim() : "",
      conclusion: typeof parsed.conclusion === "string" ? parsed.conclusion.trim() : "",
    };
  } catch {
    return null;
  }
}

const EXTREME_THRESHOLD = 1.5;

function calculateMarketPhase(managedMoneyNet: number, commercialsNet: number): "MARK UP" | "DISTRIBUTION" | "MARK DOWN" | "ACCUMULATION" | "NEUTRAL" {
  const mmPositive = managedMoneyNet > 0;
  const commNetShort = commercialsNet < 0;
  const commNetLong = commercialsNet > 0;
  const commAbs = Math.abs(commercialsNet);
  const mmAbs = Math.abs(managedMoneyNet);

  if (mmPositive && !commNetShort) return "MARK UP";
  if (mmPositive && commNetShort && commAbs > managedMoneyNet * EXTREME_THRESHOLD) return "DISTRIBUTION";
  if (!mmPositive && !commNetLong) return "MARK DOWN";
  if (!mmPositive && commNetLong && commercialsNet > mmAbs * EXTREME_THRESHOLD) return "ACCUMULATION";
  return "NEUTRAL";
}

export async function analyzeCotAsset(cotData: {
  symbol: string;
  name: string;
  category: string;
  commercialLong: number;
  commercialShort: number;
  nonCommercialLong: number;
  nonCommercialShort: number;
  retailLong: number;
  retailShort: number;
  sentiment: string;
  lastUpdate: string;
}): Promise<{ momentum: string; warnings: string; conclusion: string } | null> {
  const commercialNet = cotData.commercialLong - cotData.commercialShort;
  const largeSpecsNet = cotData.nonCommercialLong - cotData.nonCommercialShort;
  const retailNet = cotData.retailLong - cotData.retailShort;

  const marketPhase = calculateMarketPhase(largeSpecsNet, commercialNet);

  const systemPrompt = `Anda adalah professional quant analyst spesialis COT dengan pengalaman 12+ tahun di hedge fund. Output Anda langsung digunakan oleh trader institusi untuk decision making — harus presisi, berbasis data, dan actionable.

FRAMEWORK ANALISIS — Ikut urutan ini persis:

Step 1 — Kontrol Tren (momentum)
→ Siapa yang mengontrol: Managed Money (spec) atau Commercials (smart money)?
→ Apakah COT Index mendekati ekstrem (<15 atau >85)? Jika iya, sebut potensi reversal.
→ WoW Δ: Apakah posisi menguat atau melemah dibanding minggu lalu? Momentum searah atau berlawanan?
→ Sebut angka spesifik (COT Index, WoW Δ) dalam kalimat.

Step 2 — Risiko & Peringatan (warnings)
→ Divergence: Jika SM dan LS berlawanan arah, sebut secara eksplisit siapa long dan siapa short.
→ Ekstrem COT Index: Jika <15 atau >85, peringatkan potensi reversal.
→ Retail: Apakah retail searah atau berlawanan dengan smart money? (Retail biasanya salah).
→ DBS: Jika DBS lemah (±1-3), sebut bahwa bias masih lemah.

Step 3 — Kesimpulan Eksekutif (conclusion)
→ Satu kalimat utama: Bias arah + conviction (TINGGI/SEDANG/RENDAH).
→ Satu kalimat follow: Rekomendasi follow trend / wait for ekstrem / reversal watch.
→ Satu kalimat conditional: "Jika [kondisi] terjadi, maka [aksi]."

CONTOH OUTPUT IDEAL:
{
  "momentum": "Smart Money menguasai shorts dengan COT Index 86 mendekati ekstrem. WoW Δ +13,4k mengkonfirmasi akselerasi short. Managed Money masih long tipis di COT Index 60, mulai tertekan. Momentum bearish menguat.",
  "warnings": "Divergence terdeteksi: SM short (COT 86) vs LS long (COT 12). Retail net long kontrarian. DBS -6 menunjukkan bias bearish cukup kuat, namun SM mulai mendekati zona ekstrem (>85) — waspadai potential exhaustion dalam 2-3 minggu.",
  "conclusion": "Bias bearish dengan conviction TINGGI. Follow short selama COT Index SM di atas 70 dan WoW tetap negatif. Jika SM menembus COT Index >90, kurangi posisi — ekstrem sering mendahului reversal."
}

WAJIB: Output HANYA JSON valid tanpa teks lain. Gunakan Bahasa Indonesia institusional. Jangan gunakan "saya" atau "kami".`;

  const cotSM = (cotData as any).cotIndexSM;
  const cotLS = (cotData as any).cotIndexLS;
  const wowSM = (cotData as any).wowDeltaSM;
  const wowLS = (cotData as any).wowDeltaLS;
  const dbs = (cotData as any).dbs;
  const divergence = (cotData as any).divergence;

  const userPrompt = `Analisis data COT berikut dengan framework 3-step:

INSTRUMEN: ${cotData.name} (${cotData.symbol}) — ${cotData.category}

NET POSITION:
- Commercials (Smart Money): ${commercialNet > 0 ? "+" : ""}${commercialNet.toLocaleString()} (${commercialNet > 0 ? "LONG" : (commercialNet < 0 ? "SHORT" : "FLAT")})
- Managed Money (Large Specs): ${largeSpecsNet > 0 ? "+" : ""}${largeSpecsNet.toLocaleString()} (${largeSpecsNet > 0 ? "LONG" : (largeSpecsNet < 0 ? "SHORT" : "FLAT")})
- Retail: ${retailNet > 0 ? "+" : ""}${retailNet.toLocaleString()} (${retailNet > 0 ? "LONG" : (retailNet < 0 ? "SHORT" : "FLAT")})

METRIK ANALISIS:
- COT Index Smart Money: ${cotSM ?? "N/A"} | COT Index Large Specs: ${cotLS ?? "N/A"}
- WoW Δ Smart Money: ${wowSM !== undefined ? (wowSM > 0 ? "+" : "") + wowSM.toLocaleString() : "N/A"} | WoW Δ Large Specs: ${wowLS !== undefined ? (wowLS > 0 ? "+" : "") + wowLS.toLocaleString() : "N/A"}
- DBS: ${dbs !== undefined ? (dbs > 0 ? "+" : "") + dbs + " dari -10 s/d +10" : "N/A"}
- Divergence: ${divergence === true ? "YA" : "TIDAK"} | Market Phase: ${marketPhase}

Berikan analisis step-by-step sesuai framework.`;

  try {
    const raw = await callDualEngine(userPrompt, systemPrompt, {
      max_output_tokens: 1500,
      temperature: 0.3,
    });
    if (!raw) return null;

    // Clean thinking tags from response (some models output thinking)
    const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

    const parsed = parseCotJson(cleaned);
    if (!parsed) return null;

    return parsed;
  } catch (e: any) {
    silentLogger.error("[COT AI] analyzeCotAsset failed:", e.message);
    return null;
  }
}

function parseMacroFeedText(text: string | null | undefined) {
  if (typeof text !== "string" || !text.trim()) {
    return {};
  }

  try {
    const cleaned = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error("No JSON object found");
    }

    const jsonText = cleaned.slice(firstBrace, lastBrace + 1);
    const parsed = JSON.parse(jsonText);
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Parsed value is not an object");
    }

    const lowerParsed: Record<string, string> = {};
    for (const key of Object.keys(parsed)) {
      if (typeof parsed[key] === "string") {
        lowerParsed[key.toLowerCase()] = parsed[key].trim();
      }
    }

    const result: Record<string, string> = {
      topic: lowerParsed.topic || "",
      assets: lowerParsed.assets || "",
      regime: lowerParsed.regime || "",
      fakta: lowerParsed.fakta || "",
      dampakMarket: lowerParsed.dampakmarket || lowerParsed.dampak_market || "",
      logika: lowerParsed.logika || "",
      contrarian: lowerParsed.contrarian || "",
      triggerFundamentalNonTeknikal: lowerParsed.triggerfundamentalnonteknikal || lowerParsed.trigger_fundamental || "",
      confidenceScore: lowerParsed.confidencescore || lowerParsed.score || "",
    };
    return result;
  } catch {
    return {};
  }
}