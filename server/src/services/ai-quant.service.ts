import { env } from "../config/env";
import Anthropic from "@anthropic-ai/sdk";

export const aiQuantService = {
  async generateYieldCurveExplainer(curveRegime: string, snapshot: any, macroRegime?: any): Promise<string> {
    console.log("Generating AI Yield Curve Explainer for regime:", curveRegime);
    if (!env.ANTHROPIC_AUTH_TOKEN && !env.GROQ_API_KEY) {
      console.warn("No AI API keys configured. Skipping AI Explainer.");
      return "Fitur penjelasan AI dinonaktifkan karena API key tidak dikonfigurasi.";
    }

    const anthropic = new Anthropic({
      apiKey: env.ANTHROPIC_AUTH_TOKEN || "dummy",
      baseURL: env.ANTHROPIC_BASE_URL,
      defaultHeaders: {
        'HTTP-Referer': env.FRONTEND_URL || 'http://localhost:3000',
        'X-Title': 'Journal Trade AI Quant'
      }
    });

    const fallbackModels = [
      env.PRIMARY_AI_MODEL || "google/gemini-pro", // Changed to gemini as per user request
      env.ANTHROPIC_MODEL || "google/gemma-2-9b-it:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "openrouter/free"
    ];

    const macroContext = macroRegime ? `
- Macro Quadrant Saat Ini: ${macroRegime.quadrant || "Unknown"} (Growth: ${macroRegime.growth?.status || "Unknown"}, Inflation: ${macroRegime.inflation?.status || "Unknown"})
- Liquidity Status: ${macroRegime.liquidity?.status || "Unknown"}` : "";

    const prompt = `
Anda adalah seorang analis makroekonomi ahli dan Spesialis Yield Curve.
Analisislah keadaan Yield Curve saat ini berdasarkan data berikut:

- Regime Yield Curve Saat Ini: ${curveRegime}
- 3-Month Yield: ${snapshot.y3m}%
- 2-Year Yield: ${snapshot.y2y}%
- 10-Year Yield: ${snapshot.y10}%
- 30-Year Yield: ${snapshot.y30}%
- Spread 10Y-2Y: ${snapshot.spread10y2y} bps
- VIX (Indikator Stres): ${snapshot.vix}${macroContext}

TUGAS ANDA:
Berikan penjelasan mendalam (namun mudah dipahami trader) mengenai:
1. Apa arti dari regime "${curveRegime}" ini secara teknikal.
2. Kesimpulan mengenai prospek pertumbuhan atau perlambatan ekonomi (recession risk) berdasarkan pergerakan spread dan yield saat ini.
3. Dampak spesifik ke berbagai aset: Ekuitas (Stocks), Obligasi (Bonds), dan Safe-haven (seperti Emas/Gold).
4. ALIGNMENT/DIVERGENCE: Identifikasi apakah kondisi makro saat ini (Kuadran/Inflasi/Growth) sudah selaras (align) atau berlawanan (divergence) dengan pergerakan Yield Curve ini. Berikan kesimpulan ringkas yang bisa dipakai trader mengambil keputusan.

ATURAN:
- Gunakan bahasa Indonesia profesional.
- Penjelasan harus ringkas tapi berbobot (maksimal 4 paragraf singkat).
- Anda boleh menggunakan sedikit format Markdown standar (seperti bold atau bullet points).
`;

    let msg: any;
    let lastError: Error | undefined;

    // Try primary and fallback models through OpenRouter/Anthropic SDK
    if (env.ANTHROPIC_AUTH_TOKEN) {
      for (const model of fallbackModels) {
        try {
          console.log("Trying AI model for Quant:", model);
          msg = await anthropic.messages.create({
            model: model,
            max_tokens: 1000,
            messages: [
              { role: "user", content: prompt }
            ]
          });
          console.log("Success with model:", model);
          break; // Stop trying if successful
        } catch (error: any) {
          lastError = error;
          console.warn(`Model ${model} failed:`, error.status || error.message);
          if (error.status !== 429 && error.status !== 502) {
            // Only fallback on rate limit or server errors, otherwise throw
            break;
          }
        }
      }
    }

    // If OpenRouter failed or key not present, try Groq as fallback
    if (!msg && env.GROQ_API_KEY) {
      console.log("Trying Groq as fallback for Quant...");
      try {
        const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.GROQ_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: env.GROQ_MODEL || "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: "You are a professional yield curve specialist." },
              { role: "user", content: prompt }
            ],
            max_tokens: 1000
          })
        });

        const groqData: any = await groqResponse.json();
        
        if (groqData.choices && groqData.choices[0]?.message?.content) {
          console.log("Success with Groq for Quant");
          msg = { content: groqData.choices[0].message.content };
        } else {
          console.warn("Groq response invalid:", groqData);
        }
      } catch (groqError: any) {
        console.warn("Groq also failed:", groqError.message);
      }
    }

    if (!msg) {
      console.error("All AI providers failed for Quant Explainer");
      return "Analisis AI saat ini tidak tersedia akibat gangguan koneksi penyedia model (API limit).";
    }

    // Extract text
    let text = "";
    if ('content' in msg && typeof msg.content === 'string') {
      text = msg.content;
    } else if (Array.isArray(msg.content)) {
      const textBlock = msg.content.find((block: any) => block.type === 'text');
      if (textBlock && 'text' in textBlock) {
        text = textBlock.text;
      }
    }

    return text.trim() || "Analisis gagal dihasilkan.";
  }
};
