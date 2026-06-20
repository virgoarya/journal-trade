import axios from "axios";
import { env } from "../config/env";
import { silentLogger } from "../utils/silent-logger";
import { geoRiskService } from "./geo-risk.service";

const GEMINI_API_URL_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];

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
    const config = generationConfig || {
      maxOutputTokens: 150,
      temperature: 0.2,
    };
    const response = await axios.post(
      `${GEMINI_API_URL_BASE}/${geminiModel}:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
        generationConfig: config,
      },
      { headers: { "Content-Type": "application/json" }, timeout: 20000 },
    );

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
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
          max_tokens: generationConfig?.max_output_tokens || 150,
          temperature: generationConfig?.temperature || 0.2,
          stream: false,
        },
        { useCache: true, cacheKey },
      );

      const text = response.choices?.[0]?.message?.content;
      if (text && text.trim()) {
        return text.trim();
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
      growth?: { current?: number; ema50?: number; status?: string };
      inflation?: { current?: number; ema50?: number; status?: string };
      liquidity?: {
        current?: number;
        ema50?: number;
        status?: string;
        riskState?: string;
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
    const geminiModel = env.GEMINI_MODEL || "gemini-2.5-flash";

    const spy = assets.find((a) => a.ticker === "SPY")?.change ?? 0;
    const ief = assets.find((a) => a.ticker === "IEF")?.change ?? 0;
    const tip = assets.find((a) => a.ticker === "TIP")?.change ?? 0;
    const gld = assets.find((a) => a.ticker === "GLD")?.change ?? 0;
    const vix = assets.find((a) => a.ticker === "VIXY")?.change ?? 0;
    const uup = assets.find((a) => a.ticker === "UUP")?.change ?? 0;
    const fxy = assets.find((a) => a.ticker === "FXY")?.change ?? 0;

    const growth = spy - ief;
    const inflation = (tip + gld) / 2 - ief;

    const growthStatus = growth > 0 ? "high" : "low";
    const inflationStatus = inflation > 0 ? "high" : "low";

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

    const keyAssets = {
      SPY: spy,
      QQQ: assets.find((a) => a.ticker === "QQQ")?.change ?? 0,
      GLD: gld,
      UUP: uup,
      VIX: vix,
      IEF: ief,
      FXY: fxy,
      TIP: tip,
    };

    const stateJson = {
      regime: calculatedRegime ?? "unknown",
      growthStatus: context?.growth?.status ?? growthStatus,
      growth: context?.growth ?? null,
      inflationStatus: context?.inflation?.status ?? inflationStatus,
      inflation: context?.inflation ?? null,
      liquidityStatus: liquidityStatus ?? "unknown",
      liquidity: context?.liquidity ?? null,
      sentiment,
      vix: context?.vix ?? null,
      yieldCurve: context?.yieldCurve ?? null,
      geoRisk: context?.geoRisk ?? null,
      keyAssets,
    };

    const prompt = `Anda adalah analis makro institusional. Gunakan state berikut sebagai SSOT Macro Terminal, bukan data retail.

${JSON.stringify(stateJson, null, 2)}

Tuliskan narasi analisis makro yang ringkas dan profesional dalam 3 kalimat saja. KALIMAT PERTAMA WAJIB menyebut fase makro yang sedang terjadi (${calculatedRegime || "Stagflasi/Reflasi/dsb"}) agar user langsung tahu posisi regime kita. Kalimat kedua harus menyebut likuiditas, VIX/yield curve, atau risk appetite. Kalimat ketiga harus menyebut trigger yang dapat membatalkan tesis regime. JANGAN mengulang penjelasan yang sudah tersirat dalam data. Setiap kalimat diakhiri titik. Tanpa meta-language.`;

    const text = await callDualEngine(
      prompt,
      "ROLE & PERSONA: Anda adalah Senior Macro Institutional Analyst untuk Hunter Trades Terminal. DEFINISI: Stagflasi = Pertumbuhan RENDAH + Inflasi TINGGI. RULES: 1. Tanpa meta-language. 2. Tanpa redundansi. 3. Kalimat diakhiri titik utuh. Balas dalam Bahasa Indonesia.",
      { max_output_tokens: 150, temperature: 0.2 },
    );

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
        "Anda adalah Hawkish Quant Analyst yang sangat berhati-hati terhadap inflasi, sangat memperhatikan pengetatan likuiditas (draining), dan pesimis terhadap aset berisiko tinggi saat yield naik. Gunakan bahasa yang teknis dan waspada.";
    } else if (personaId === "dove") {
      personaDescription =
        "Anda adalah Dovish Economic Strategist yang optimis terhadap pemangkasan suku bunga, pelonggaran likuiditas, dan pertumbuhan ekuitas. Anda selalu mencari peluang 'buy the dip' di aset berisiko.";
    } else if (personaId === "contrarian") {
      personaDescription =
        "Anda adalah Contrarian Hedge Fund Manager. Anda selalu skeptis terhadap konsensus pasar (herd mentality), suka mencari anomali data, dan merekomendasikan posisi melawan arus ketika pasar terlalu serakah atau terlalu takut.";
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
      silentLogger.warn("[MacroAI] Failed to fetch nexus data for chat context", e);
    }

    const systemPrompt = `ROLE & PERSONA: ${personaDescription}
    
KONTEKS PASAR SAAT INI (BERDASARKAN DATA REAL-TIME TERMINAL):
${regimeContext}${liquidityContext}
${assetContext}
${vixContext}
${yieldCurveContext}
${resolvedGeoRiskContext}
${nextEventContext}
${nexusContext}

Gunakan konteks di atas sebagai fakta dasar untuk semua jawaban Anda. Jika ditanya tentang kondisi makro saat ini, sebutkan regime dan data di atas.

RULES: 1. Tanpa meta-language. 2. Tanpa redundansi. 3. Kalimat diakhiri titik utuh. Balas dalam Bahasa Indonesia.`;

    try {
      return await callDualEngineStream(
        [{ role: "system", content: systemPrompt }, ...messages],
        geminiModel,
      );
    } catch (error: any) {
      silentLogger.error(
        "[MacroAI] chatStream failed after all attempts:",
        error.message,
      );
      throw new Error("Gagal mendapatkan respons chat dari layanan AI.");
    }
  },

  async analyzeMacroFeed(
    headline: string,
    targetAsset: string,
    context?: string,
  ) {
    const geminiModel = env.GEMINI_MODEL || "gemini-2.5-flash";

    const prompt = `Berita ekonomi: ${headline}
Aset target: ${targetAsset}
${context ? `Konteks: ${context}` : ""}

Jawab HANYA dengan JSON valid (tanpa markdown, tanpa teks lain di luar JSON) dengan format:
{
  "fakta": "...",
  "dampakMarket": "...",
  "logika": "...",
  "contrarian": "...",
  "triggerFundamentalNonTeknikal": "...",
  "confidenceScore": "..."
}`;

    const systemPrompt =
      "ROLE & PERSONA: Anda adalah Senior Macro Institutional Analyst dengan pendekatan 'Critical Thinking'. Anda selalu skeptis terhadap berita utama dan mencari kebenaran struktural serta risiko tersembunyi di balik narasi media. RULES: 1. Tanpa meta-language. 2. Tanpa redundansi. 3. Kalimat diakhiri titik utuh. 4. Output HANYA JSON valid yang diminta, tanpa penjelasan tambahan. Balas dalam Bahasa Indonesia.";

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
            max_tokens: 300,
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
        maxOutputTokens: 300,
        temperature: 0.2,
      });
    }

    if (!text) {
      return {
        fakta: headline || "Tidak ada data",
        dampakMarket: "Analisis tidak tersedia",
        logika: "Analisis tidak tersedia",
        contrarian: "Analisis tidak tersedia",
        triggerFundamentalNonTeknikal: "Analisis tidak tersedia",
        confidenceScore: "Sedang",
      };
    }

    const parsed = parseMacroFeedText(text);
    return {
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
1. ENGINE — driver utama dari liquidity/policy/yield/fear.
2. SQUEEZE — bottleneck atau tekanan yang paling mungkin memaksa rotasi aset.
3. FLOW — arah modal institusi berikutnya dan aset yang diuntungkan/rugi.
4. TRADE RISK — risiko posisi paling mahal jika narasi ini salah.
5. INVALIDATION TRIGGER — trigger data/event yang membatalkan tesis.

JANGAN ulangi semua angka secara kaku. Gunakan angka hanya untuk mendukung narasi tajam Anda. Jangan gunakan kata-kata AI generik (misal: "Kesimpulannya", "Dinamika saat ini"). Langsung menukik ke analisis.`;

    const systemPrompt =
      "ROLE: Senior Institutional Quant Trader. TONE: Tajam, analitis, sedikit sinis jika pasar tidak rasional. WAJIB menggunakan istilah finansial (Bear Steepener, Debasement, Liquidity Drain, Defying Gravity). Balas dalam Bahasa Indonesia yang profesional namun edgy.";

    const text = await callDualEngine(prompt, systemPrompt, {
      max_output_tokens: 600,
      temperature: 0.3,
    });
    if (text) return text.trim();

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
};

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

    const result: Record<string, string> = {};
    const fields = [
      "fakta",
      "dampakMarket",
      "logika",
      "contrarian",
      "triggerFundamentalNonTeknikal",
      "confidenceScore",
    ];
    for (const field of fields) {
      result[field] =
        typeof parsed[field] === "string" ? parsed[field].trim() : "";
    }
    return result;
  } catch {
    return {};
  }
}
