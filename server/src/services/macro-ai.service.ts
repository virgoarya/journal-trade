import axios from "axios";
import { env } from "../config/env";
import { silentLogger } from "../utils/silent-logger";
import { geoRiskService } from "./geo-risk.service";
import { generateText, tool, jsonSchema } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { mcpService } from "./mcp.service";

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

async function callGeminiDirect(
  systemPrompt: string,
  userPrompt: string,
  geminiModel: string,
  generationConfig?: Record<string, any>,
): Promise<string | null> {
  if (!env.GEMINI_API_KEY) return null;

  try {
    const fullPrompt = systemPrompt
      ? `${systemPrompt}\n\n${userPrompt}`
      : userPrompt;

    const payload: any = {
      contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
    };

    if (generationConfig) {
      payload.generationConfig = {};
      if (generationConfig.maxOutputTokens !== undefined)
        payload.generationConfig.maxOutputTokens =
          generationConfig.maxOutputTokens;
      if (generationConfig.temperature !== undefined)
        payload.generationConfig.temperature = generationConfig.temperature;
      if (generationConfig.responseMimeType !== undefined)
        payload.generationConfig.responseMimeType =
          generationConfig.responseMimeType;
    }

    const response = await axios.post(
      `${GEMINI_API_URL_BASE}/${geminiModel}:generateContent?key=${env.GEMINI_API_KEY}`,
      payload,
      { headers: { "Content-Type": "application/json" }, timeout: 20000 },
    );

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    silentLogger.info(
      `[MacroAI] Gemini generated ${text?.length} chars. Finish reason: ${response.data?.candidates?.[0]?.finishReason}`,
    );
    return typeof text === "string" && text.trim() ? text.trim() : null;
  } catch (error) {
    silentLogger.error(
      "[MacroAI] Gemini fallback failed:",
      (error as any)?.message,
    );
    return null;
  }
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
  const geminiModel = env.GEMINI_MODEL || "gemini-2.5-flash";

  let lastError: any = null;

  // 1. Try 9Router first if URL is configured
  if (env.NINE_ROUTER_URL) {
    try {
      const modelName = env.NINE_ROUTER_MODEL || "free";
      const response = await axios.post(
        `${env.NINE_ROUTER_URL}/chat/completions`,
        {
          model: modelName,
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
            "Authorization": `Bearer ${env.NINE_ROUTER_API_KEY || "sk-9router-local"}`,
            "Content-Type": "application/json",
          },
          timeout: 20000,
        }
      );
      const text = response.data?.choices?.[0]?.message?.content;
      if (text && text.trim()) {
        // Bersihkan <think> block dari model reasoning
        const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
        if (cleaned) {
          silentLogger.info(`[MacroAI] 9Router (${modelName}) generated ${cleaned.length} chars.`);
          return cleaned;
        }
      }
    } catch (error: any) {
      silentLogger.warn(`[MacroAI] 9Router failed, falling back to Groq/Gemini: ${error.message}`);
      lastError = error;
    }
  }

  // 2. Try Groq fallback
  for (const model of GROQ_MODELS) {
    if (!env.GROQ_API_KEY) break;
    try {
      const cacheKey = `dual-${JSON.stringify({ model, userPrompt, systemPrompt })}`;
      const response = await groqRequest<GroqResponse>(
        GROQ_API_URL,
        {
          model,
          messages: [
            { role: "system", content: systemPrompt || "" },
            { role: "user", content: userPrompt },
          ],
          max_tokens: generationConfig?.max_output_tokens || 1500,
          temperature: generationConfig?.temperature || 0.2,
          stream: false,
        },
        { useCache: true, cacheKey },
      );

      const text = response.choices?.[0]?.message?.content;
      silentLogger.info(
        `[MacroAI] Groq ${model} generated ${text?.length} chars. Finish reason: ${response.choices?.[0]?.finish_reason}`,
      );
      if (text && text.trim()) {
        const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
        if (cleaned) return cleaned;
      }
    } catch (error: any) {
      lastError = error;
      if (!isRetryableGroqError(error)) {
        break;
      }
      silentLogger.warn(
        `[MacroAI] Groq model ${model} failed (${error.response?.status}), trying next...`,
      );
      continue;
    }
  }

  const geminiText = await callGeminiDirect(
    systemPrompt || "",
    userPrompt,
    geminiModel,
    generationConfig,
  );
  if (geminiText) {
    return geminiText;
  }

  silentLogger.error(
    "[MacroAI] All engines failed. Groq:",
    lastError?.message,
    "Gemini: no response",
  );
  return null;
}

async function callDualEngineStream(
  messages: any[],
  geminiModel: string,
): Promise<any> {
  if (env.GROQ_API_KEY) {
    try {
      return await groqRequestStream(GROQ_API_URL, {
        model: GROQ_MODELS[0],
        messages,
        max_tokens: 1000,
        temperature: 0.2,
        stream: true,
      });
    } catch (error: any) {
      if (!isRetryableGroqError(error)) {
        throw error;
      }
      silentLogger.warn(
        "[MacroAI] Groq stream error, switching to Gemini fallback:",
        error.response?.status,
      );
    }
  }

  if (!env.GEMINI_API_KEY) {
    throw new Error(
      "Fitur AI dinonaktifkan: GROQ_API_KEY dan GEMINI_API_KEY tidak ditemukan",
    );
  }

  const systemPrompt = messages.find((m) => m.role === "system")?.content || "";
  const chatMessages = messages.filter((m) => m.role !== "system");

  const geminiContents = [];
  if (systemPrompt) {
    geminiContents.push({ role: "user", parts: [{ text: systemPrompt }] });
  }
  for (const msg of chatMessages) {
    const role = msg.role === "assistant" ? "model" : "user";
    geminiContents.push({ role, parts: [{ text: msg.content }] });
  }

  try {
    const response = await axios.post(
      `${GEMINI_API_URL_BASE}/${geminiModel}:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        contents: geminiContents,
        generationConfig: { maxOutputTokens: 1000, temperature: 0.2 },
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 20000,
        responseType: "stream",
      },
    );

    return response.data;
  } catch (error) {
    silentLogger.error(
      "[MacroAI] Gemini stream fallback failed:",
      (error as any)?.message,
    );
    throw new Error("Gagal mendapatkan respons AI dari semua mesin.");
  }
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
    for (const a of assets) {
      keyAssets[a.ticker] = a.change ?? 0;
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

    throw new Error("Gagal mendapatkan analisis regime dari layanan AI.");
  },

  async chatStream(
    messages: any[],
    currentRegime?: string,
    assets?: any[],
    liquidityStatus?: string,
    personaId: string = "default",
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
    const geminiModel = env.GEMINI_MODEL || "gemini-2.5-flash";

    const regimeContext = currentRegime
      ? `Macro Regime Saat Ini: ${currentRegime}. `
      : "";
    const liquidityContext = liquidityStatus
      ? `Status Likuiditas ON RRP: ${liquidityStatus}. `
      : "";

    const assetData =
      assets && Array.isArray(assets)
        ? assets
            .map(
              (a) =>
                `${a.ticker}: ${a.change !== null ? a.change + "%" : "N/A"}`,
            )
            .join(", ")
        : "";
    const assetContext = assetData
      ? `Performa Aset Hari Ini: ${assetData}.`
      : "";
    const vixContext = context?.vix
      ? `VIX: ${context.vix.value ?? "N/A"} (${context.vix.regime ?? "UNKNOWN"}, source: ${context.vix.source ?? "unknown"}).`
      : "";
    const yieldCurveContext = context?.yieldCurve
      ? `Yield Curve: 10Y-2Y ${context.yieldCurve.spread10y2y ?? "N/A"} bps, curve regime ${context.yieldCurve.curveRegime ?? "UNKNOWN"}${context.yieldCurve.inverted ? ", inverted overlay" : ""}.`
      : "";
    const geoRiskContextBuilt = context?.geoRisk
      ? `Geo-Risk top driver: ${context.geoRisk.topDriver ?? "unknown"}; scores ${JSON.stringify(context.geoRisk.scores ?? {})}.`
      : "";
    const nextEventContext = context?.nextEvent
      ? `Next high-impact event: ${context.nextEvent.title ?? "unknown"} at ${context.nextEvent.date ?? "unknown"} (${context.nextEvent.impact ?? "unknown"}).`
      : "";

    let personaDescription =
      "Anda adalah Senior Macro Institutional Analyst untuk Hunter Trades Terminal.";
    if (personaId === "hawk") {
      personaDescription =
        "Anda adalah Hawkish Quant Analyst (The Hawk). Fokus utama Anda adalah BAHAYA inflasi lengket, pengetatan likuiditas dari Nexus (TGA/RRP), dan lonjakan Real Yields. Anda selalu melihat anomali di Yield Curve (Bear Flattener/Steepener) sebagai sinyal bahwa suku bunga akan menekan valuasi saham. Anda pesimis terhadap narasi 'soft landing'.";
    } else if (personaId === "dove") {
      personaDescription =
        "Anda adalah Dovish Economic Strategist (The Dove). Fokus utama Anda adalah PERTUMBUHAN dan pelonggaran kebijakan. Anda mencari sinyal di Nexus (Net Liquidity naik) dan Quant Lab (Bull Steepener) yang mengindikasikan Fed akan pivot atau mencetak uang. Anda selalu mencari setup 'buy the dip' di aset berisiko saat data inflasi mendingin.";
    } else if (personaId === "contrarian") {
      personaDescription =
        "Anda adalah Contrarian Hedge Fund Manager (The Maverick). Fokus utama Anda adalah MISPRICING dan anomali pasar. Anda menggabungkan data Quant Lab (VIX complacency vs Yield Curve Inversion) dan Nexus (DXY/Gold divergence) untuk membongkar narasi konsensus yang salah. Jika semua serakah, Anda mencari alasan untuk short, dan sebaliknya.";
    }

    const geoRiskContext =
      geoRiskContextBuilt ||
      (async () => {
        try {
          const geoRisk = await geoRiskService.getScores();
          if (geoRisk && geoRisk.scores) {
            const entries = Object.entries(geoRisk.scores);
            const top = entries.sort((a, b) => b[1] - a[1])[0];
            return `\nDATA GEO-RISK RADAR (0-100, 100 = Kritis/Bahaya Ekstrem):
- Dominant Driver: ${top?.[0] ?? "unknown"} (${top?.[1] ?? 0})
- Inflation Risk: ${geoRisk.scores.inflation}
- Rate Hike Risk: ${geoRisk.scores.rateHike}
- Geopolitics Risk: ${geoRisk.scores.geopolitics}
- Supply Chain Risk: ${geoRisk.scores.supplyChain}
- Liquidity Drain Risk: ${geoRisk.scores.liquidityDrain}`;
          }
          return "";
        } catch (e) {
          silentLogger.warn(
            "[MacroAI] Failed to fetch geo-risk scores for chat context",
            e,
          );
          return "";
        }
      })();
    const resolvedGeoRiskContext =
      typeof geoRiskContext === "string"
        ? geoRiskContext
        : await geoRiskContext;

    let nexusContext = "";
    try {
      const { nexusService } = require("./nexus.service");
      const nexus = await nexusService.getSnapshot();
      if (nexus) {
        nexusContext = `\nDATA NEXUS TAB:
- Net Liquidity (WALCL): ${nexus.walcl?.value}B (${nexus.walcl?.delta}B)
- Fed Funds Rate: ${nexus.fedFundsRate?.value}%
- DXY: ${nexus.dxy?.value}
- CRB Commodities: ${nexus.crb?.value}
- Gold (GLD): ${nexus.gold?.value} (${nexus.gold?.delta}%)
- CPI YoY: ${nexus.cpiYoY}%
- Growth Sentiment (UMCSENT): ${nexus.growthSentiment}
- Real Yields: ${nexus.realYields?.value}%`;
      }
    } catch (e) {
      silentLogger.warn(
        "[MacroAI] Failed to fetch nexus data for chat context",
        e,
      );
    }

    const systemPrompt = `ROLE & PERSONA: ${personaDescription}
    
TUGAS UTAMA: Analisis kondisi pasar secara HOLISTIK dengan menyatukan kepingan puzzle dari 3 dimensi:
1. Overview (Macro Regime, Liquidity, Assets)
2. Quant Lab (VIX, Yield Curve Regime)
3. Nexus (Real Yields, Fed Funds, DXY, Net Liquidity)
JANGAN pernah membatasi argumen Anda hanya pada satu sumber (seperti GeoRisk). Buat kesimpulan kausalitas (sebab-akibat) lintas-tab yang tajam sesuai persona Anda.

KONTEKS PASAR SAAT INI (DATA TERMINAL REAL-TIME):
${regimeContext}${liquidityContext}
${assetContext}
${vixContext}
${yieldCurveContext}
${resolvedGeoRiskContext}
${nextEventContext}
${nexusContext}

Gunakan data lintas-dimensi di atas sebagai satu-satunya landasan argumen Anda. Jika ditanya, sebutkan dan kaitkan metrik-metrik dari Nexus, Quant Lab, dan Overview untuk mendukung tesis Anda.

Anda MEMILIKI AKSES ke external TOOLS via Model Context Protocol (MCP). 
INSTRUKSI PENTING TOOLS:
- Jika Anda membutuhkan data/berita/search, Anda WAJIB memanggil function/tools yang disediakan melalui mekanisme function calling API. 
- DILARANG KERAS merespon dengan teks pengantar seperti "Saya akan menggunakan tool..." atau "Tunggu sebentar...". Jika butuh tool, LANGSUNG panggil tool tersebut TANPA mengeluarkan teks/kata-kata tambahan apapun!
- JANGAN HANYA menulis teks seperti "[Menggunakan Model Context Protocol]" tanpa benar-benar memanggil function. Anda harus mengeksekusi tool tersebut!
- Jika tool meminta input seperti 'query', berikan input yang relevan secara lengkap.

RULES: 1. Tanpa meta-language. 2. Tanpa redundansi. 3. Kalimat lugas dan berdampak. Balas dalam Bahasa Indonesia institusional.`;

    try {
      const openRouter = createOpenAI({
        baseURL: env.ANTHROPIC_BASE_URL?.includes("/v1") ? env.ANTHROPIC_BASE_URL : "https://openrouter.ai/api/v1",
        apiKey: env.ANTHROPIC_AUTH_TOKEN,
      });

      const groq = createOpenAI({
        baseURL: env.GROQ_BASE_URL,
        apiKey: env.GROQ_API_KEY,
      });

      const google = createGoogleGenerativeAI({
        apiKey: env.GEMINI_API_KEY,
      });

      const dashscope = createOpenAI({
        baseURL: env.DASHSCOPE_BASE_URL || "https://ws-u59n2if85mr2x9mq.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1",
        apiKey: env.DASHSCOPE_API_KEY,
      });

      // Always prioritize models that have native robust function calling in Vercel AI SDK
      let aiModel;
      
      // 9Router acts as the ultimate fallback proxy to handle rate limits automatically
      if (env.NINE_ROUTER_URL) {
        const nineRouter = createOpenAI({
          baseURL: env.NINE_ROUTER_URL,
          apiKey: env.NINE_ROUTER_API_KEY || "sk-9router-local",
        });
        // You can specify a generic model name or the specific one 9Router is configured to route
        aiModel = nineRouter.chat(env.NINE_ROUTER_MODEL || "free");
        silentLogger.info(`[MacroAI] Using 9Router as the primary AI gateway (${env.NINE_ROUTER_MODEL || "free"}).`);
      } else if (env.ANTHROPIC_AUTH_TOKEN) {
        aiModel = openRouter.chat(env.ANTHROPIC_MODEL || "claude-3-opus-20240229");
      } else if (env.GEMINI_API_KEY) {
        aiModel = google(geminiModel);
      } else if (env.GROQ_API_KEY) {
        aiModel = groq.chat(GROQ_MODELS[0]);
      } else {
        aiModel = openRouter.chat("openai/gpt-oss-120b:free");
      }

      // Build MCP Tools Map
      const mcpTools = mcpService.getTools();
      const toolsConfig: Record<string, any> = {};
      
      console.log(`[DEBUG MacroAI] Fetched ${mcpTools.length} tools from MCP Service.`);
      if (mcpTools.length > 0) {
        console.log(`[DEBUG MacroAI] Tool Names: ${mcpTools.map(t => t.name).join(', ')}`);
      }
      
      for (const t of mcpTools) {
        if (t.name === 'dashscope_search' || t.name === 'mock_search') {
          silentLogger.info(`[MacroAI] Skipping tool ${t.name} to avoid poor AI tool choice`);
          continue;
        }
        try {
          // Sanitize tool name for LLM compatibility (only alphanumeric, _, -)
          const safeName = t.name.replace(/[^a-zA-Z0-9_-]/g, '_');
          
          // Build a clean schema - remove fields that confuse AI models
          const rawSchema = t.inputSchema || { type: "object", properties: {} };
          const cleanSchema: Record<string, any> = {
            type: "object",
            properties: rawSchema.properties || {},
          };
          if (rawSchema.required) cleanSchema.required = rawSchema.required;
          // Log what we're registering
          silentLogger.info(`[MacroAI Agent] Registering tool '${safeName}' with schema: ${JSON.stringify(cleanSchema)}`);
          
          toolsConfig[safeName] = tool({
            description: t.description || `Tool: ${t.name}`,
            parameters: jsonSchema(cleanSchema, {
              // Permissive validate: accept whatever the AI model sends
              validate: (value: unknown) => ({ success: true as const, value: value as any }),
            }) as any,
            execute: async (args: any) => {
            silentLogger.info(`[MacroAI Agent] Executing MCP Tool: ${t.name} (as ${safeName}), args: ${JSON.stringify(args)}`);
            try {
              const result = await mcpService.executeTool(t.name, args);
              // MCP results usually have { content: [{ type: "text", text: "..." }] }
              if (result && Array.isArray(result.content)) {
                const texts = result.content
                  .map((c: any) => c.text || JSON.stringify(c))
                  .filter((txt: string) => txt && txt.trim())
                  .join("\n");
                if (texts.trim()) return texts;
                return "No data returned from tool.";
              }
              return JSON.stringify(result);
            } catch (err: any) {
              silentLogger.error(`[MacroAI Agent] Tool ${t.name} execution error: ${err.message}`);
              return `Error executing tool ${t.name}: ${err.message}`;
            }
          },
          } as any);
        } catch (err: any) {
          silentLogger.warn(`[MacroAI Agent] Failed to parse tool ${t.name}:`, err.message);
        }
      }

      // Add Native AlphaVantage Tool for Technical Analysis
      if (env.ALPHA_VANTAGE_API_KEY) {
        toolsConfig['get_technical_indicator'] = tool({
          description: "Get technical indicator data (RSI, SMA, EMA) for a given symbol using AlphaVantage. e.g. for Bitcoin use 'BTC', for Apple use 'AAPL'.",
          parameters: jsonSchema({
            type: "object",
            properties: {
              function_name: { type: "string", description: "The indicator function to call: RSI, SMA, EMA", enum: ["RSI", "SMA", "EMA"] },
              symbol: { type: "string", description: "The ticker symbol (e.g. BTC, AAPL)" },
              interval: { type: "string", description: "Time interval: daily, weekly, monthly", enum: ["daily", "weekly", "monthly"] },
              time_period: { type: "number", description: "Time period for calculation (e.g. 14 for RSI, 50 for SMA50)" }
            },
            required: ["function_name", "symbol", "interval", "time_period"]
          }) as any,
          execute: async (args: any) => {
             silentLogger.info(`[MacroAI Agent] Executing Native Tool get_technical_indicator: ${JSON.stringify(args)}`);
             try {
                // If the user asks for crypto like BTC, AlphaVantage requires the market (e.g. BTCUSD) or sometimes just BTC works if it's an exchange symbol. But for technical indicators, typically it accepts standard symbols.
                const url = `https://www.alphavantage.co/query?function=${args.function_name}&symbol=${args.symbol}&interval=${args.interval}&time_period=${args.time_period}&series_type=close&apikey=${env.ALPHA_VANTAGE_API_KEY}`;
                const response = await fetch(url);
                const data = await response.json();

                if (data["Information"] || data["Note"] || data["Error Message"]) {
                   return JSON.stringify(data); // Limit reached or error
                }

                // AlphaVantage returns huge JSONs, let's just return the last 10 data points to save tokens
                const timeSeriesKey = Object.keys(data).find(k => k.startsWith("Technical Analysis"));
                if (!timeSeriesKey) return JSON.stringify(data);

                const timeSeries = data[timeSeriesKey];
                const dates = Object.keys(timeSeries).slice(0, 10);
                const recentData: any = {};
                for (const d of dates) {
                   recentData[d] = timeSeries[d];
                }
                return JSON.stringify({ symbol: args.symbol, indicator: args.function_name, recent_data: recentData });
             } catch (err: any) {
                return `Error fetching indicator: ${err.message}`;
             }
          }
        } as any);
      }

      const cleanMessages = messages.map((m: any) => ({
        role: m.role,
        content: String(m.content)
      }));

      // Ensure the first message is a user message (some providers reject leading assistant messages)
      while (cleanMessages.length > 0 && cleanMessages[0].role !== "user") {
        cleanMessages.shift();
      }

      silentLogger.info("[MacroAI] cleanMessages length:", cleanMessages.length);

      // --- Helper: Extract text from generateText response robustly ---
      function isToolError(text: string): boolean {
        if (!text) return true;
        const errorPatterns = [
          '{"type":"missing","loc":["query"],"msg":"Field required"',
          'pydantic.error_wrappers.ValidationError',
          'Error executing tool: ',
        ];
        return errorPatterns.some(p => text.toLowerCase().includes(p.toLowerCase()));
      }

      function extractResponseText(res: any): string {
        // 1. Direct text is available
        if (res.text && res.text.trim()) return res.text.trim();

        // 2. Walk all steps to collect any text or tool results
        const collectedTexts: string[] = [];
        const collectedToolData: string[] = [];
        if (res.steps && Array.isArray(res.steps)) {
          for (const step of res.steps) {
            // Check for text content in the step
            if (step.text && step.text.trim()) {
              collectedTexts.push(step.text.trim());
            }
            // Check tool results in step content
            if (step.content && Array.isArray(step.content)) {
              for (const item of step.content) {
                if (item.type === "tool-result" && item.output) {
                  const output = typeof item.output === "string" ? item.output : JSON.stringify(item.output);
                  if (output && output.trim() && !isToolError(output)) {
                    collectedToolData.push(output);
                  }
                }
              }
            }
            // Also check toolResults array
            if (step.toolResults && Array.isArray(step.toolResults)) {
              for (const tr of step.toolResults) {
                const output = tr.output || tr.result;
                if (output) {
                  const str = typeof output === "string" ? output : JSON.stringify(output);
                  if (str.trim() && !isToolError(str)) {
                    collectedToolData.push(str);
                  }
                }
              }
            }
          }
        }

        // 3. Top-level toolResults fallback
        if (res.toolResults && Array.isArray(res.toolResults)) {
          for (const tr of res.toolResults) {
            const output = tr.output || tr.result;
            if (output) {
              const str = typeof output === "string" ? output : JSON.stringify(output);
              if (str.trim() && !isToolError(str)) {
                collectedToolData.push(str);
              }
            }
          }
        }

        if (collectedTexts.length > 0) return collectedTexts.join("\n\n");
        if (collectedToolData.length > 0) return "Berikut data yang ditemukan oleh tools:\n\n" + collectedToolData.join("\n\n");
        return "";
      }

      // --- Helper: Extract tool names used across all steps ---
      function extractToolNames(res: any): string[] {
        const names: string[] = [];
        if (res?.steps && Array.isArray(res.steps)) {
          for (const step of res.steps) {
            if (step.toolCalls && Array.isArray(step.toolCalls)) {
              for (const tc of step.toolCalls) names.push(tc.toolName);
            }
          }
        }
        return names;
      }

      // --- Agent Models (Adjusted for Rate Limits) ---
      // Primary Researcher: Try Flatkey (GPT-4o) first, fallback to DashScope (Qwen-Plus), then Gemini
      const researcherModel = env.ANTHROPIC_AUTH_TOKEN ? openRouter.chat(env.ANTHROPIC_MODEL || "gpt-4o") : google(geminiModel || "gemini-2.5-flash");
      const reviewerModel = env.DASHSCOPE_API_KEY ? dashscope.chat(env.DASHSCOPE_MODEL || "qwen3.7-max") : researcherModel;
      const synthesizerModel = env.ANTHROPIC_AUTH_TOKEN ? openRouter.chat(env.ANTHROPIC_MODEL || "gpt-4o") : reviewerModel;

      // --- STAGE 1: The Researcher (Tool Execution) ---
      silentLogger.info(`[MacroAI] Stage 1: The Researcher - Gathering Context`);
      
      const researcherCandidates = [
        { model: researcherModel, label: "primary-researcher" }
      ];
      // Add DashScope Qwen-Plus as a robust fallback for tool calling if GPT-4o/Gemini fails
      if (env.DASHSCOPE_API_KEY) {
         researcherCandidates.push({ model: dashscope.chat("qwen-plus"), label: "fallback-qwen-plus" });
      }
      if (env.GEMINI_API_KEY) {
         researcherCandidates.push({ model: google(geminiModel || "gemini-2.5-flash"), label: "fallback-gemini" });
      }

      let researcherRes;
      let researcherError: any = null;

      for (const candidate of researcherCandidates) {
        try {
          silentLogger.info(`[MacroAI] Researcher using: ${candidate.label}`);
          researcherRes = await generateText({
            model: candidate.model,
            system: systemPrompt,
            messages: cleanMessages,
            tools: Object.keys(toolsConfig).length > 0 ? toolsConfig : undefined,
            maxSteps: 1, // Stop immediately after tool execution
            temperature: 0.2,
          } as any);
          researcherError = null; // Success
          break;
        } catch (err: any) {
          silentLogger.warn(`[MacroAI] Researcher ${candidate.label} failed: ${err.message}`);
          researcherError = err;
        }
      }

      if (researcherError || !researcherRes) {
        throw new Error(`The Researcher AI failed after all fallbacks. Last error: ${researcherError?.message}`);
      }

      const researcherText = extractResponseText(researcherRes);
      const toolsUsed = extractToolNames(researcherRes);

      // If no tools were used, the Researcher answered the user directly. We can return immediately.
      if (toolsUsed.length === 0 && researcherText.trim().length > 0) {
        silentLogger.info(`[MacroAI] No tools used by Researcher. Returning direct response.`);
        return { text: researcherText, toolsUsed: [] };
      }

      // If tools were used, researcherText contains raw JSON data.
      let dataToSynthesize = researcherText;

      // --- STAGE 2: The Reviewer (Data Extraction & Analysis) ---
      if (dataToSynthesize.trim()) {
        silentLogger.info(`[MacroAI] Stage 2: The Reviewer - Analyzing Data`);
        try {
          const reviewerRes = await generateText({
            model: reviewerModel,
            system: "Anda adalah analis kuantitatif makroekonomi senior. Tugas Anda adalah mengekstrak data dan angka-angka kunci dari teks JSON mentah berikut, lalu membuat laporan eksekutif pendek yang menyoroti temuan fakta tanpa opini berlebihan. Gunakan Bahasa Indonesia.",
            messages: [
              ...cleanMessages,
              { role: "assistant", content: `RAW TOOL DATA:\n${dataToSynthesize}` }
            ],
            temperature: 0.1,
          });
          
          if (reviewerRes.text && reviewerRes.text.trim()) {
            dataToSynthesize = reviewerRes.text.trim();
          }
        } catch (err: any) {
          silentLogger.warn(`[MacroAI] Stage 2 (Reviewer) failed, bypassing Reviewer: ${err.message}`);
          // Bypassing Reviewer, will pass raw JSON directly to Synthesizer
        }
      }

      // --- STAGE 3: The Synthesizer (Persona Formatting) ---
      silentLogger.info(`[MacroAI] Stage 3: The Synthesizer - Formatting Output`);
      try {
        const synthesizerRes = await generateText({
          model: synthesizerModel,
          system: systemPrompt, // Re-apply the strict Persona prompt
          messages: [
            ...cleanMessages,
            { role: "assistant", content: `Laporan Data / Fakta:\n${dataToSynthesize}\n\nInstruksi: Tuliskan respons akhir Anda kepada user berdasarkan Laporan Fakta di atas. Gunakan gaya bahasa telegraphic dan sinis sesuai Persona Anda. DILARANG memuntahkan JSON mentah.` }
          ],
          temperature: 0.3,
        });

        if (synthesizerRes.text && synthesizerRes.text.trim()) {
          let finalText = synthesizerRes.text.trim();
          silentLogger.info(`[MacroAI Agent] Multi-Agent Pipeline Completed. Tools used: ${toolsUsed.join(', ')}`);
          return { text: finalText, toolsUsed };
        }
      } catch (err: any) {
        silentLogger.error(`[MacroAI] Stage 3 (Synthesizer) failed: ${err.message}`);
        // Ultimate fallback
        return { text: dataToSynthesize, toolsUsed };
      }

      throw new Error("All AI agents in the pipeline failed to generate a response");
    } catch (error: any) {
      silentLogger.error(
        "[MacroAI] chatStream Agent Loop failed with details:",
        error.message,
        error.stack || error
      );
      if (error.cause) {
        silentLogger.error("[MacroAI] Error cause:", JSON.stringify(error.cause, null, 2));
      }
      throw new Error("Gagal mendapatkan respons chat dari layanan AI: " + (error.message || "Unknown error"));
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
      text = await callGeminiDirect(systemPrompt, prompt, geminiModel, {
        temperature: 0.2,
        responseMimeType: "application/json",
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

      // 1. Try 9Router first if URL is configured
      if (env.NINE_ROUTER_URL) {
        try {
          const modelName = env.NINE_ROUTER_MODEL || "free";
          const response = await axios.post(
            `${env.NINE_ROUTER_URL}/chat/completions`,
            {
              model: modelName,
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
                "Authorization": `Bearer ${env.NINE_ROUTER_API_KEY || "sk-9router-local"}`,
                "Content-Type": "application/json",
              },
              timeout: 30000,
            }
          );
          text = response.data?.choices?.[0]?.message?.content || null;
          if (text) {
            silentLogger.info(`[MacroAI] batchAnalyzeNews 9Router (${modelName}) succeeded.`);
          }
        } catch (error: any) {
          silentLogger.warn("[MacroAI] batchAnalyzeNews 9Router failed, trying Groq/Gemini:", error.message);
        }
      }

      // 2. Try Groq fallback
      if (!text && env.GROQ_API_KEY) {
        try {
          const response = await groqRequest<GroqResponse>(
            GROQ_API_URL,
            {
              model: GROQ_MODELS[0],
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt },
              ],
              max_tokens: 4000,
              temperature: 0.2,
              stream: false,
            },
            { useCache: false }
          );
          text = response.choices?.[0]?.message?.content || null;
        } catch (groqError: any) {
          silentLogger.warn("[MacroAI] batchAnalyzeNews Groq failed, switching to Gemini:", groqError.response?.status);
        }
      }

      if (!text && env.GEMINI_API_KEY) {
        text = await callGeminiDirect(systemPrompt, prompt, geminiModel, {
          temperature: 0.2,
        });
      }

      if (!text) return {};

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

  const systemPrompt = `Anda adalah professional quant analyst. Saat menganalisis data COT, gunakan persis logika Market Phases yang sama dengan dashboard:

FASE PASAR (WAJIB DITERAPKAN):
- MARK UP (Hijau): ManagedMoney > 0 DAN Commercials BUKAN net short ekstrem.
- DISTRIBUTION (Kuning): ManagedMoney > 0 DAN Commercials Net Short DAN |CommercialsNet| > 1.5x ManagedMoneyNet (commercial melawan tren secara ekstrem).
- MARK DOWN (Merah): ManagedMoney < 0 DAN Commercials BUKAN net long ekstrem.
- ACCUMULATION (Biru): ManagedMoney < 0 DAN Commercials Net Long DAN CommercialsNet > 1.5x |ManagedMoneyNet| (commercial melawan tren secara ekstrem).
- NEUTRAL: Kondisi lain.

INSTRUKSI KRITIS: MULAI analisis Anda dengan menyatakan Fase Pasar yang telah dihitung, lalu lanjutkan ke analisis mendalam.

WAJIB output format JSON (tanpa markdown):
{
  "momentum": "Analisis 1-2 kalimat tentang siapa yang mengontrol tren (Managed Money) dan bagaimana posisi Commercial dan Retail.",
  "warnings": "Risiko utama 1-2 kalimat berdasarkan hedging Commercial (Smart Money) dan posisi Retail (kontrarian).",
  "conclusion": "Kesimpulan eksekutif definitif dan seimbang, contoh: 'Tren masih Bullish didorong Large Specs, namun risiko koreksi tinggi karena Smart Money mulai hedging massal.'"
}

WAJIB gunakan Bahasa Indonesia institusional.`;

  const userPrompt = `Analisis data COT untuk ${cotData.name} (${cotData.symbol}) menggunakan framework Multi-Dimensional Market Phase.

DATA POSISI:
- Managed Money (Large Specs): Net = ${largeSpecsNet > 0 ? "+" : ""}${largeSpecsNet.toLocaleString()} (${largeSpecsNet > 0 ? "NET LONG" : "NET SHORT"})
- Commercials (Smart Money): Net = ${commercialNet > 0 ? "+" : ""}${commercialNet.toLocaleString()} (${commercialNet > 0 ? "NET LONG" : "NET SHORT"})
- Retail (Small Traders): Net = ${retailNet > 0 ? "+" : ""}${retailNet.toLocaleString()} (${retailNet > 0 ? "NET LONG" : "NET SHORT"})

FASE PASAR TERHITUNG: ${marketPhase}
Kategori: ${cotData.category} | Tanggal: ${cotData.lastUpdate}

MULAI dengan menyatakan Fase Pasar di atas, lalu berikan analisis momentum, peringatan, dan kesimpulan.`;

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
