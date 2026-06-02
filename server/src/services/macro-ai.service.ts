import axios from "axios";
import { env } from "../config/env";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];

function isRetryableGroqError(error: any): boolean {
  if (!error) return false;
  const status = error.response?.status;
  return status === 429 || (typeof status === "number" && status >= 500);
}

async function callGemini(prompt: string, systemPrompt?: string): Promise<string | null> {
  if (!env.GEMINI_API_KEY) return null;

  try {
    const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
    const response = await axios.post(
      `${GEMINI_API_URL}?key=${env.GEMINI_API_KEY}`,
      {
        contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
        generationConfig: { maxOutputTokens: 300, temperature: 0.2 },
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

    let prompt = `Anda adalah analis makro institusional. 

Diberikan data:
- Regime: ${calculatedRegime || "unknown"}
- Liquidity Status: ${liquidityStatus || "unknown"}  
- Sentiment: ${sentiment}

Tuliskan narasi analisis makro yang ringkas dan profesional dalam 3 kalimat saja. KALIMAT PERTAMA WAJIB menyebut fase makro yang sedang terjadi (${calculatedRegime || "Stagflasi/Reflasi/dsb"}) agar user langsung tahu posisi regime kita. JANGAN mengulang penjelasan yang sudah tersirat dalam data. Setiap kalimat diakhiri titik. Tanpa meta-language.`;

    // Try Gemini first
    if (env.GEMINI_API_KEY) {
      try {
        const geminiRes = await axios.post(
          GEMINI_API_URL,
          {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 150 },
          },
          { headers: { "Content-Type": "application/json" }, timeout: 20000 }
        );
        const text = geminiRes.data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          return text.trim();
        }
      } catch (e) {
        // fall through to Groq
      }
    }

    if (!env.GROQ_API_KEY) {
      throw new Error("Fitur AI dinonaktifkan: GROQ_API_KEY tidak ditemukan");
    }

    // Try Groq models with caching and throttling
    const cacheKey = `regime-${JSON.stringify({ assets, calculatedRegime, liquidityStatus })}`;
    for (const model of GROQ_MODELS) {
      try {
        const response = await groqRequest<GroqResponse>(GROQ_API_URL, {
          model,
          messages: [
            { role: "system", content: "ROLE & PERSONA: Anda adalah Senior Macro Institutional Analyst untuk Hunter Trades Terminal. DEFINISI: Stagflasi = Pertumbuhan RENDAH + Inflasi TINGGI. RULES: 1. Tanpa meta-language. 2. Tanpa redundansi. 3. Kalimat diakhiri titik utuh. Balas dalam Bahasa Indonesia." },
            { role: "user", content: prompt },
          ],
          max_tokens: 150,
          temperature: 0.2,
          stream: false,
        }, { useCache: true, cacheKey });

        const text = response.choices?.[0]?.message?.content;
        if (text) {
          return text.trim();
        }
      } catch (err: any) {
        if (err.response?.status === 429) {
          // groqRequest already handles retry and backoff, so if we get here it means max retries exceeded
          continue; // try next model
        }
        // For other errors, try next model
        continue;
      }
    }

    throw new Error("Gagal mendapatkan analisis regime dari layanan AI.");
  },

  async chatStream(messages: any[], currentRegime?: string, assets?: any[], liquidityStatus?: string) {
    if (!env.GROQ_API_KEY) {
      throw new Error("Fitur AI dinonaktifkan: GROQ_API_KEY tidak ditemukan");
    }
    // Use throttler and retry with exponential backoff for 429 - return raw response for streaming
    return await groqRequestStream(
      GROQ_API_URL,
      {
        model: GROQ_MODELS[0],
        messages: [
          { role: "system", content: "ROLE & PERSONA: Anda adalah Senior Macro Institutional Analyst untuk Hunter Trades Terminal. DEFINISI: Stagflasi = Pertumbuhan RENDAH + Inflasi TINGGI. RULES: 1. Tanpa meta-language. 2. Tanpa redundansi. 3. Kalimat diakhiri titik utuh. Balas dalam Bahasa Indonesia." },
          ...messages,
        ],
        max_tokens: 150,
        temperature: 0.2,
        stream: true,
      }
    );
  },

  async analyzeMacroFeed(headline: string, targetAsset: string, context?: string) {
    if (!env.GROQ_API_KEY) {
      throw new Error("Fitur AI dinonaktifkan: GROQ_API_KEY tidak ditemukan");
    }

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

    const cacheKey = `feed-${JSON.stringify({ headline, targetAsset, context })}`;
    try {
      const response = await groqRequest<GroqResponse>(GROQ_API_URL, {
        model: GROQ_MODELS[0],
        messages: [
          { role: "system", content: "ROLE & PERSONA: Anda adalah Senior Macro Institutional Analyst untuk Hunter Trades Terminal. RULES: 1. Tanpa meta-language. 2. Tanpa redundansi. 3. Kalimat diakhiri titik utuh. 4. Output HANYA JSON valid yang diminta, tanpa penjelasan tambahan. Balas dalam Bahasa Indonesia." },
          { role: "user", content: prompt },
        ],
        max_tokens: 300,
        temperature: 0.2,
        stream: false,
      }, { useCache: true, cacheKey });

      const text = response.choices?.[0]?.message?.content || "";
      const parsed = parseMacroFeedText(text);
      return {
        fakta: parsed.fakta || "Tidak ada data",
        dampakMarket: parsed.dampakMarket || "Tidak ada data",
        logika: parsed.logika || "Tidak ada data",
        contrarian: parsed.contrarian || "Tidak ada data",
        triggerFundamentalNonTeknikal: parsed.triggerFundamentalNonTeknikal || "Tidak ada data",
        confidenceScore: parsed.confidenceScore || "Sedang",
      };
    } catch (error: any) {
      return {
        fakta: headline || "Tidak ada data",
        dampakMarket: "Analisis tidak tersedia",
        logika: "Analisis tidak tersedia",
        contrarian: "Analisis tidak tersedia",
        triggerFundamentalNonTeknikal: "Analisis tidak tersedia",
        confidenceScore: "Sedang",
      };
    }
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