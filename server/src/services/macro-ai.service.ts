import axios from "axios";
import { env } from "../config/env";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];

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
const requestQueue: Array<{ resolve: (value: unknown) => void; reject: (reason?: any) => void }> = {};

function enqueueRequest<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    requestQueue.push({ resolve, reject });
    processQueue();
  });
}

async function processQueue() {
  if (requestQueue.length === 0) return;
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_INTERVAL_MS - elapsed));
  }
  const { resolve, reject } = requestQueue.shift()!;
  try {
    const result = await fn(); // actual request
    lastRequestTime = Date.now();
    resolve(result);
    // Process next after a short delay to avoid burst
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
        return resultData;
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
        const response = await groqRequest(GROQ_API_URL, {
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
    // Use throttler and retry with exponential backoff for 429
    return await enqueueRequest(async () => {
      let attempts = 0;
      while (true) {
        try {
          const response = await axios.post(
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
            },
            {
              headers: {
                Authorization: `Bearer ${env.GROQ_API_KEY}`,
                "Content-Type": "application/json",
              },
              responseType: "stream",
              timeout: 20000,
            }
          );
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
  },

  async analyzeMacroFeed(headline: string, targetAsset: string, context?: string) {
    if (!env.GROQ_API_KEY) {
      throw new Error("Fitur AI dinonaktifkan: GROQ_API_KEY tidak ditemukan");
    }

    const prompt = `Berita ekonomi: ${headline}
Aset target: ${targetAsset}
${context ? `Konteks: ${context}` : ''}

Berikan analisis institusional singkat (1-2 kalimat) dalam Bahasa Indonesia tentang dampak berita ini terhadap aset. Tanpa meta-language, tanpa redundansi, setiap kalimat diakhiri titik utuh.`;

    const cacheKey = `feed-${JSON.stringify({ headline, targetAsset, context })}`;
    try {
      const response = await groqRequest(GROQ_API_URL, {
        model: GROQ_MODELS[0],
        messages: [
          { role: "system", content: "ROLE & PERSONA: Anda adalah Senior Macro Institutional Analyst untuk Hunter Trades Terminal. RULES: 1. Tanpa meta-language. 2. Tanpa redundansi. 3. Kalimat diakhiri titik utuh. Balas dalam Bahasa Indonesia." },
          { role: "user", content: prompt },
        ],
        max_tokens: 150,
        temperature: 0.2,
        stream: false,
      }, { useCache: true, cacheKey });

      return response.data.choices?.[0]?.message?.content || "Analisis tidak tersedia";
    } catch (error: any) {
      // If all models fail, throw error
      throw new Error(error.message || "Gagal menganalisis feed makro");
    }
  }
};