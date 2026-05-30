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

    let prompt = `ROLE & PERSONA: Anda adalah Senior Macro Institutional Analyst untuk Hunter Trades Terminal.

DEFINISI REZIM (WAJIB DIPAHAMI):
- Stagflasi: Pertumbuhan ekonomi RENDAH/STAGIS + Inflasi TINGGI. JANGAN pernah menyebut pertumbuhan tinggi sebagai ciri stagflasi.
- Goldilocks: Pertumbuhan tinggi + Inflasi rendah/terkendali
- Reflation: Pertumbuhan tinggi + Inflasi tinggi (peningkatan)
- Deflation: Pertumbuhan rendah + Inflasi rendah/negatif
- Slowdown: Pertumbuhan rendah + Inflasi rendah
- Neutral Transition: Kedua indikator berada di zona netral

RULES OUTPUT:
1. JANGAN PERNAH gunakan meta-language seperti 'karena saya dapat menjelaskan', 'menurut analisis', dll
2. JANGAN ada pengulangan kata dalam satu kalimat
3. Setiap kalimat HARUS diakhiri dengan titik yang utuh
4. Fokus pada fakta objektif dari data JSON di bawah
5. Gunakan tone analis institusional yang ringkas dan akurat

Berdasarkan kalkulasi data FRED, rezim ekonomi saat ini terkonfirmasi berada dalam fase: ${calculatedRegime || "unknown"}.

Data state:
${JSON.stringify(stateJson, null, 2)}

Jelaskan secara ringkas (2-3 kalimat) mengapa rezim ${calculatedRegime || "tersebut"} terjadi, keterkaitannya dengan status ON RRP (${liquidityStatus || "unknown"}), dan implikasinya.

Kembalikan teks biasa, tanpa markdown.`;

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
      throw new Error(error.message || "Gagal menganalisis feed makro");
    }
  }
};