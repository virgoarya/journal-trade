import axios from "axios";
import { env } from "../config/env";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];

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

// Try Groq models
    for (const model of GROQ_MODELS) {
      try {
        const response = await axios.post(
          GROQ_API_URL,
          {
            model,
            messages: [
              { role: "system", content: "ROLE & PERSONA: Anda adalah Senior Macro Institutional Analyst untuk Hunter Trades Terminal. DEFINISI: Stagflasi = Pertumbuhan RENDAH + Inflasi TINGGI. RULES: 1. Tanpa meta-language. 2. Tanpa redundansi. 3. Kalimat diakhiri titik utuh. Balas dalam Bahasa Indonesia." },
              { role: "user", content: prompt },
            ],
            max_tokens: 150,
            temperature: 0.2,
            stream: false,
          },
          {
            headers: {
              "Authorization": `Bearer ${env.GROQ_API_KEY}`,
              "Content-Type": "application/json",
            },
            timeout: 20000,
          }
        );
        const text = response.data.choices?.[0]?.message?.content;
        if (text) {
          return text.trim();
        }
      } catch (err: any) {
        if (err.response?.status === 429) {
          await new Promise(resolve => setTimeout(resolve, 1500));
          continue;
        }
        throw err;
      }
    }

    throw new Error("Gagal mendapatkan analisis regime dari layanan AI.");
  },

  async chatStream(messages: any[], res: any, currentRegime?: string, assets?: any[], liquidityStatus?: string) {
    if (!env.GROQ_API_KEY) {
      res.status(500).json({ success: false, error: "Fitur AI dinonaktifkan: GROQ_API_KEY tidak ditemukan" });
      return;
    }

    try {
      const response = await axios.post(
        GROQ_API_URL,
        {
          model: GROQ_MODELS[0],
          messages,
          max_tokens: 150,
          temperature: 0.2,
          stream: false,
        },
        {
          headers: {
            "Authorization": `Bearer ${env.GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 20000,
        }
      );
      const text = response.data.choices?.[0]?.message?.content || "Tidak ada respons dari AI";
      res.json({ success: true, text });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || "Kesalahan pada layanan AI" });
    }
  },

async analyzeMacroFeed(headline: string, targetAsset: string, context?: string) {
    if (!env.GROQ_API_KEY) {
      throw new Error("Fitur AI dinonaktifkan: GROQ_API_KEY tidak ditemukan");
    }

    const prompt = `Berita ekonomi: ${headline}
Aset target: ${targetAsset}
${context ? `Konteks: ${context}` : ''}

Berikan analisis institusional singkat (1-2 kalimat) dalam Bahasa Indonesia tentang dampak berita ini terhadap aset. Tanpa meta-language, tanpa redundansi, setiap kalimat diakhiri titik utuh.`;

    try {
      const response = await axios.post(
        GROQ_API_URL,
        {
          model: GROQ_MODELS[0],
          messages: [
            { role: "system", content: "ROLE & PERSONA: Anda adalah Senior Macro Institutional Analyst untuk Hunter Trades Terminal. RULES: 1. Tanpa meta-language. 2. Tanpa redundansi. 3. Kalimat diakhiri titik utuh. Balas dalam Bahasa Indonesia." },
            { role: "user", content: prompt },
          ],
          max_tokens: 150,
          temperature: 0.2,
          stream: false,
        },
        {
          headers: {
            "Authorization": `Bearer ${env.GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 20000,
        }
      );
      return response.data.choices?.[0]?.message?.content || "Analisis tidak tersedia";
    } catch (error: any) {
      // Handle rate limit retry
      if (error.response?.status === 429) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        try {
          const retryResponse = await axios.post(
            GROQ_API_URL,
            {
              model: GROQ_MODELS[1], // Try alternative model
              messages: [
                { role: "system", content: "ROLE & PERSONA: Anda adalah Senior Macro Institutional Analyst untuk Hunter Trades Terminal. RULES: 1. Tanpa meta-language. 2. Tanpa redundansi. 3. Kalimat diakhiri titik utuh. Balas dalam Bahasa Indonesia." },
                { role: "user", content: prompt },
              ],
              max_tokens: 150,
              temperature: 0.2,
              stream: false,
            },
            {
              headers: {
                "Authorization": `Bearer ${env.GROQ_API_KEY}`,
                "Content-Type": "application/json",
              },
              timeout: 20000,
            }
          );
          return retryResponse.data.choices?.[0]?.message?.content || "Analisis tidak tersedia";
        } catch (retryError: any) {
          throw new Error(retryError.message || "Gagal menganalisis feed makro setelah retry");
        }
      }
      throw new Error(error.message || "Gagal menganalisis feed makro");
    }
  }
};