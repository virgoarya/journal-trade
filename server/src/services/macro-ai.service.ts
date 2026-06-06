import axios from "axios";
import { env } from "../config/env";
import { geoRiskService } from "./geo-risk.service";

const GEMINI_API_URL_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];

async function callGeminiDirect(systemPrompt: string, userPrompt: string, geminiModel: string, generationConfig?: Record<string, any>): Promise<string | null> {
  if (!env.GEMINI_API_KEY) return null;

  try {
    const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${userPrompt}` : userPrompt;
    const config = generationConfig || { maxOutputTokens: 150, temperature: 0.2 };
    const response = await axios.post(
      `${GEMINI_API_URL_BASE}/${geminiModel}:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
        generationConfig: config,
      },
      { headers: { "Content-Type": "application/json" }, timeout: 20000 }
    );

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return typeof text === "string" && text.trim() ? text.trim() : null;
  } catch (error) {
    console.error("[MacroAI] Gemini fallback failed:", (error as any)?.message);
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
  generationConfig?: Record<string, any>
): Promise<string | null> {
  const geminiModel = env.GEMINI_MODEL || "gemini-2.5-flash";

  let lastError: any = null;
  for (const model of GROQ_MODELS) {
    if (!env.GROQ_API_KEY) break;
    try {
      const cacheKey = `dual-${JSON.stringify({ model, userPrompt, systemPrompt })}`;
      const response = await groqRequest<GroqResponse>(GROQ_API_URL, {
        model,
        messages: [
          { role: "system", content: systemPrompt || "" },
          { role: "user", content: userPrompt },
        ],
        max_tokens: generationConfig?.max_output_tokens || 150,
        temperature: generationConfig?.temperature || 0.2,
        stream: false,
      }, { useCache: true, cacheKey });

      const text = response.choices?.[0]?.message?.content;
      if (text && text.trim()) {
        return text.trim();
      }
    } catch (error: any) {
      lastError = error;
      if (!isRetryableGroqError(error)) {
        break;
      }
      console.warn(`[MacroAI] Groq model ${model} failed (${error.response?.status}), trying next...`);
      continue;
    }
  }

  const geminiText = await callGeminiDirect(systemPrompt || "", userPrompt, geminiModel, generationConfig);
  if (geminiText) {
    return geminiText;
  }

  console.error("[MacroAI] All engines failed. Groq:", lastError?.message, "Gemini: no response");
  return null;
}

async function callDualEngineStream(
  messages: any[],
  geminiModel: string
): Promise<any> {
  if (env.GROQ_API_KEY) {
    try {
      return await groqRequestStream(
        GROQ_API_URL,
        {
          model: GROQ_MODELS[0],
          messages,
          max_tokens: 1000,
          temperature: 0.2,
          stream: true,
        }
      );
    } catch (error: any) {
      if (!isRetryableGroqError(error)) {
        throw error;
      }
      console.warn("[MacroAI] Groq stream error, switching to Gemini fallback:", error.response?.status);
    }
  }

  if (!env.GEMINI_API_KEY) {
    throw new Error("Fitur AI dinonaktifkan: GROQ_API_KEY dan GEMINI_API_KEY tidak ditemukan");
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
      }
    );

    return response.data;
  } catch (error) {
    console.error("[MacroAI] Gemini stream fallback failed:", (error as any)?.message);
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
async function groqRequest<T>(url: string, data: any, options: { useCache?: boolean; cacheKey?: string } = {}): Promise<T> {
  const { useCache = false, cacheKey = '' } = options;
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
          const retryAfter = err.response.headers['retry-after'];
          const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.pow(2, attempts) * 1000 + Math.random() * 1000;
          attempts++;
          if (attempts > 3) throw err;
          await new Promise(resolve => setTimeout(resolve, delay));
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
          const retryAfter = err.response.headers['retry-after'];
          const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.pow(2, attempts) * 1000 + Math.random() * 1000;
          attempts++;
          if (attempts > 3) throw err;
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw err;
      }
    }
  });
}

export const macroAiService = {
  async analyzeRegime(assets: { ticker: string; name: string; change: number }[], calculatedRegime?: string, liquidityStatus?: string) {
    const geminiModel = env.GEMINI_MODEL || "gemini-2.5-flash";

    const spy = assets.find(a => a.ticker === "SPY")?.change ?? 0;
    const ief = assets.find(a => a.ticker === "IEF")?.change ?? 0;
    const tip = assets.find(a => a.ticker === "TIP")?.change ?? 0;
    const gld = assets.find(a => a.ticker === "GLD")?.change ?? 0;
    const vix = assets.find(a => a.ticker === "VIXY")?.change ?? 0;
    const uup = assets.find(a => a.ticker === "UUP")?.change ?? 0;
    const fxy = assets.find(a => a.ticker === "FXY")?.change ?? 0;

    const growth = spy - ief;
    const inflation = (tip + gld) / 2 - ief;

    const growthStatus = growth > 0 ? "high" : "low";
    const inflationStatus = inflation > 0 ? "high" : "low";

    let sentiment: "RISK-ON" | "RISK-OFF" | "NEUTRAL" = "NEUTRAL";
    if (calculatedRegime === "Reflation" || calculatedRegime === "Goldilocks") {
      sentiment = liquidityStatus === "Draining" ? "NEUTRAL" : "RISK-ON";
    } else if (calculatedRegime === "Stagflation" || calculatedRegime === "Deflation" || calculatedRegime === "Inflation") {
      sentiment = liquidityStatus === "Refilling" ? "NEUTRAL" : "RISK-OFF";
    }

    const keyAssets = {
      SPY: spy,
      QQQ: assets.find(a => a.ticker === "QQQ")?.change ?? 0,
      GLD: gld,
      UUP: uup,
      VIX: vix,
      IEF: ief,
      FXY: fxy,
      TIP: tip,
    };

    const stateJson = {
      regime: calculatedRegime ?? "unknown",
      growthStatus,
      inflationStatus,
      liquidityStatus: liquidityStatus ?? "unknown",
      sentiment,
      keyAssets,
    };

    const prompt = `Anda adalah analis makro institusional. 

Diberikan data:
- Regime: ${calculatedRegime || "unknown"}
- Liquidity Status: ${liquidityStatus || "unknown"}  
- Sentiment: ${sentiment}

Tuliskan narasi analisis makro yang ringkas dan profesional dalam 3 kalimat saja. KALIMAT PERTAMA WAJIB menyebut fase makro yang sedang terjadi (${calculatedRegime || "Stagflasi/Reflasi/dsb"}) agar user langsung tahu posisi regime kita. JANGAN mengulang penjelasan yang sudah tersirat dalam data. Setiap kalimat diakhiri titik. Tanpa meta-language.`;

    const text = await callDualEngine(
      prompt,
      "ROLE & PERSONA: Anda adalah Senior Macro Institutional Analyst untuk Hunter Trades Terminal. DEFINISI: Stagflasi = Pertumbuhan RENDAH + Inflasi TINGGI. RULES: 1. Tanpa meta-language. 2. Tanpa redundansi. 3. Kalimat diakhiri titik utuh. Balas dalam Bahasa Indonesia.",
      { max_output_tokens: 150, temperature: 0.2 }
    );

    if (text) {
      return text.trim();
    }

    throw new Error("Gagal mendapatkan analisis regime dari layanan AI.");
  },

  async chatStream(messages: any[], currentRegime?: string, assets?: any[], liquidityStatus?: string, personaId: string = "default") {
    const geminiModel = env.GEMINI_MODEL || "gemini-2.5-flash";

    const regimeContext = currentRegime ? `Macro Regime Saat Ini: ${currentRegime}. ` : "";
    const liquidityContext = liquidityStatus ? `Status Likuiditas ON RRP: ${liquidityStatus}. ` : "";
    
    // Simplifikasi data aset agar tidak membebani token
    const assetData = assets && Array.isArray(assets) 
      ? assets.map(a => `${a.ticker}: ${a.change !== null ? a.change + '%' : 'N/A'}`).join(', ')
      : "";
    const assetContext = assetData ? `Performa Aset Hari Ini: ${assetData}.` : "";

    let personaDescription = "Anda adalah Senior Macro Institutional Analyst untuk Hunter Trades Terminal.";
    if (personaId === "hawk") {
      personaDescription = "Anda adalah Hawkish Quant Analyst yang sangat berhati-hati terhadap inflasi, sangat memperhatikan pengetatan likuiditas (draining), dan pesimis terhadap aset berisiko tinggi saat yield naik. Gunakan bahasa yang teknis dan waspada.";
    } else if (personaId === "dove") {
      personaDescription = "Anda adalah Dovish Economic Strategist yang optimis terhadap pemangkasan suku bunga, pelonggaran likuiditas, dan pertumbuhan ekuitas. Anda selalu mencari peluang 'buy the dip' di aset berisiko.";
    } else if (personaId === "contrarian") {
      personaDescription = "Anda adalah Contrarian Hedge Fund Manager. Anda selalu skeptis terhadap konsensus pasar (herd mentality), suka mencari anomali data, dan merekomendasikan posisi melawan arus ketika pasar terlalu serakah atau terlalu takut.";
    }

    let geoRiskContext = "";
    try {
      const geoRisk = await geoRiskService.getScores();
      if (geoRisk && geoRisk.scores) {
        geoRiskContext = `\nDATA GEO-RISK RADAR (0-100, 100 = Kritis/Bahaya Ekstrem):
- Inflation Risk: ${geoRisk.scores.inflation} (100 = Hiperinflasi)
- Rate Hike Risk: ${geoRisk.scores.rateHike} (100 = Suku bunga sangat tinggi)
- Geopolitics Risk (VIX): ${geoRisk.scores.geopolitics} (100 = Kepanikan global)
- Supply Chain Risk (PMI): ${geoRisk.scores.supplyChain} (100 = Kontraksi rantai pasok)
- Liquidity Drain Risk: ${geoRisk.scores.liquidityDrain} (PENTING: 100 berarti Saldo ON RRP di The Fed sudah HABIS total / $0, yang berarti sistem perbankan kekurangan bantalan likuiditas darurat, memicu krisis likuiditas sistemik. Jika 0 berarti kas berlimpah.)`;
      }
    } catch (e) {
      console.warn("[MacroAI] Failed to fetch geo-risk scores for chat context", e);
    }

    const systemPrompt = `ROLE & PERSONA: ${personaDescription}
    
KONTEKS PASAR SAAT INI (BERDASARKAN DATA REAL-TIME TERMINAL):
${regimeContext}${liquidityContext}
${assetContext}${geoRiskContext}

Gunakan konteks di atas sebagai fakta dasar untuk semua jawaban Anda. Jika ditanya tentang kondisi makro saat ini, sebutkan regime dan data di atas.

RULES: 1. Tanpa meta-language. 2. Tanpa redundansi. 3. Kalimat diakhiri titik utuh. Balas dalam Bahasa Indonesia.`;

    try {
      return await callDualEngineStream(
        [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        geminiModel
      );
    } catch (error: any) {
      console.error("[MacroAI] chatStream failed after all attempts:", error.message);
      throw new Error("Gagal mendapatkan respons chat dari layanan AI.");
    }
  },

  async analyzeMacroFeed(headline: string, targetAsset: string, context?: string) {
    const geminiModel = env.GEMINI_MODEL || "gemini-2.5-flash";

    const prompt = `Berita ekonomi: ${headline}
Aset target: ${targetAsset}
${context ? `Konteks: ${context}` : ''}

Jawab HANYA dengan JSON valid (tanpa markdown, tanpa teks lain di luar JSON) dengan format:
{
  "fakta": "...",
  "dampakMarket": "...",
  "logika": "...",
  "contrarian": "...",
  "triggerFundamentalNonTeknikal": "...",
  "confidenceScore": "..."
}`;

    const systemPrompt = "ROLE & PERSONA: Anda adalah Senior Macro Institutional Analyst untuk Hunter Trades Terminal. RULES: 1. Tanpa meta-language. 2. Tanpa redundansi. 3. Kalimat diakhiri titik utuh. 4. Output HANYA JSON valid yang diminta, tanpa penjelasan tambahan. Balas dalam Bahasa Indonesia.";

    let text: string | null = null;
    try {
      if (env.GROQ_API_KEY) {
        const cacheKey = `feed-${JSON.stringify({ headline, targetAsset, context })}`;
        const response = await groqRequest<GroqResponse>(GROQ_API_URL, {
          model: GROQ_MODELS[0],
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
          max_tokens: 300,
          temperature: 0.2,
          stream: false,
        }, { useCache: true, cacheKey });

        text = response.choices?.[0]?.message?.content || null;
      }
    } catch (error: any) {
      if (!isRetryableGroqError(error) || !env.GEMINI_API_KEY) {
        if (!env.GROQ_API_KEY && !env.GEMINI_API_KEY) {
          throw new Error("Fitur AI dinonaktifkan: GROQ_API_KEY dan GEMINI_API_KEY tidak ditemukan");
        }
        if (!isRetryableGroqError(error)) {
          throw error;
        }
      }
      console.warn("[MacroAI] Groq macro feed error, switching to Gemini fallback:", error.response?.status);
    }

    if (!text) {
      text = await callGeminiDirect(systemPrompt, prompt, geminiModel, { maxOutputTokens: 300, temperature: 0.2 });
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
      triggerFundamentalNonTeknikal: parsed.triggerFundamentalNonTeknikal || "Tidak ada data",
      confidenceScore: parsed.confidenceScore || "Sedang",
    };
  },

  async analyzeNexus(nodesData: Record<string, any>) {
    const prompt = `Anda adalah Head of Institutional Macro Desk. Berikut adalah status Causal Loop makroekonomi saat ini secara real-time:
${Object.entries(nodesData).map(([k, v]) => {
      let status = "Netral";
      if (v.color === "#ef4444") status = "Merah (Negatif/Bahaya/Kontraksi)";
      if (v.color === "#22c55e") status = "Hijau (Positif/Aman/Ekspansi)";
      if (v.color === "#f97316" || v.color === "#f59e0b") status = "Kuning/Oranye (Waspada)";
      if (v.color === "#3b82f6") status = "Biru (Informasi)";
      return `- ${v.label}: ${v.value} [Status: ${status}]`;
    }).join('\n')}

CATATAN LOGIKA ABSOLUT (DILARANG BERHALUSINASI):
- Node "Liquidity (RRP)" membaca likuiditas sistem. Jika statusnya "Hijau" berarti The Fed sedang MENGINJEKSI likuiditas ke pasar (saldo RRP turun/rendah). Jika statusnya "Merah" berarti The Fed MENYEDOT (Draining) likuiditas (saldo RRP naik/tinggi).
- Jangan pernah mengatakan "menyedot likuiditas" jika status RRP adalah Hijau.
- Angka RRP di bawah $10B ($0.xxB) sangat rendah, artinya The Fed TIDAK menyedot likuiditas, melainkan uang sudah masuk semua ke pasar (Injeksi penuh).
- Lihat status warna dari masing-masing node untuk menentukan apakah itu sentimen positif atau negatif, jangan menebak sendiri.

Tugas Anda:
1. Jelaskan arah aliran dana (capital flow) yang sedang terjadi (sebab-akibat antar node).
2. Sebutkan node mana yang menjadi driver utama atau risiko terbesar saat ini.
3. Berikan satu kesimpulan taktis.

Tulis dalam format 1 paragraf padat (maksimal 4-5 kalimat). Gunakan bahasa institusional yang tajam dan langsung pada intinya. JANGAN gunakan pengantar seperti "Berdasarkan data...". Langsung tembak ke analisis.`;

    const systemPrompt = "ROLE & PERSONA: Head of Institutional Macro Desk untuk Hunter Trades. RULES: 1. Tanpa meta-language. 2. Fokus pada cause-and-effect aliran likuiditas. 3. Balas dalam Bahasa Indonesia.";

    const text = await callDualEngine(prompt, systemPrompt, { max_output_tokens: 250, temperature: 0.3 });
    if (text) return text.trim();
    
    throw new Error("Gagal mendapatkan analisis Nexus dari layanan AI.");
  }
};

function parseMacroFeedText(text: string | null | undefined) {
  if (typeof text !== 'string' || !text.trim()) {
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
    const fields = ["fakta", "dampakMarket", "logika", "contrarian", "triggerFundamentalNonTeknikal", "confidenceScore"];
    for (const field of fields) {
      result[field] = typeof parsed[field] === "string" ? parsed[field].trim() : "";
    }
    return result;
  } catch {
    return {};
  }
}