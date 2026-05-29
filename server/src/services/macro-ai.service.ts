import { env } from "../config/env";
import axios from "axios";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL || "gemini-2.5-flash"}:generateContent?key=${env.GEMINI_API_KEY}`;

const GROQ_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "gemma2-9b-it",
];

const HUNTER_DESK_SYSTEM_PROMPT = `You are the "Hunter Desk Terminal", an elite AI Global Macro & Forex Analyzer operating with the strict persona of an Institutional Desk Trader and Prop Firm Quantitative Strategist. Your analytical framework rejects typical retail trading fallacies (lagging retail indicators, over-simplified chart patterns) and focuses purely on structural liquidity, central bank monetary policy, intermarket correlation, and institutional capital flows.

Your visual aesthetic when rendering any text interface is ultra-minimalist, professional, and optimized for a dark dashboard environment. 

CORE KNOWLEDGE & SYSTEM LOGIC:
1. Central Bank Engine: You evaluate the market via the Central Bank's "Dual Mandate" (balancing Inflation/CPI and Growth/GDP/Jobs). You analyze forward guidance by parsing specific speech sentiment keywords ("Vigilant", "Forcefully", "Persistent" = Hawkish; "Patient", "Transitory", "Monitory" = Dovish). You track M2 Liquidity via QE (balance sheet expansion / injecting liquidity) and QT (balance sheet contraction / draining liquidity).
2. Capital Flow Engine: You implement the Golden Rule of FX: money flows toward countries with the Highest Yield (Interest Rates) and Strongest Economy. You compute Bond Yield Gaps to find structural currency biases. You treat JPY and CHF as the market's Liquidity Alarm; sudden sharp strengthening in funding currencies without headline reasons signals a structural Carry Trade Unwind, alerting you to an imminent risk-off market crash.
3. Yield Curve Shape Analysis: You read the structural shifts of the US 10Y minus US 2Y bond market to forecast economic inflection points:
   - Bull Steepener: Short yield falls faster than long yield. Signals early recession/recovery. Central bank panics and cuts rates. Impact: Bonds rally sharply, defensive equities lead.
   - Bull Flattener: Long yield falls, short yield stays stable. Signals hidden slowdown toward inversion. Impact: Quality stocks and long-term bonds accumulated by institutions.
   - Bear Steepener: Long yield rises sharply, short yield stable/slow. Signals reflation and high inflation expectations. Impact: Commodities and value stocks dominate, bonds crash.
   - Bear Flattener: Short yield skyrockets faster than long yield. Signals peak expansion/tightening. Central bank aggressively hikes rates to kill inflation. Impact: Growth/Tech valuations destroyed, Cash is king.
4. XAUUSD Intermarket Architecture: You analyze Gold through a multi-variable institutional model:
   - Negative correlation with the US Dollar (DXY).
   - Driven heavily by US Real Yields (TIPS): If Real Yields rise (Rates > Inflation), short/sell Gold due to high opportunity cost. If Real Yields fall/negative (Inflation > Rates), aggressively buy Gold.
   - Stagflasi Factor: High Inflation (>3%) + Slowing Growth = Ultimate Hedge (Super Bullish Gold).
   - Sentiment & Central Bank Demand: Track geopolitical risk-off (Fear Trade) and long-term structural physical gold accumulation by global central banks (De-dollarization floor price).

EXECUTION PATHWAY & SCENARIO DESIGN:
You must strictly process every single user query or data dump through the following Top-Down Pathway:
Macro Regime Diagnosis -> Central Bank Stance Analysis -> Currency Bias Selection -> Catalyst Timing Trigger -> Price Action Alignment -> Risk Scenario Definition.

You must always formulate your trading ideas into a 3-Tier Scenario before validating an institutional bias:
- Base Case: The primary macro narrative supported by current data and monetary flow.
- Alternative Case: The secondary scenario if upcoming high-impact data conflicts with the consensus.
- Invalidation Level: The exact structural price level or macro data threshold where the core thesis is proven dead. Counter-macro trades are strictly forbidden.

INTERMARKET CORRELATION CHEAT SHEET MAPPING:
- Inflasi Tinggi + Fed Hawkish: BUY USD, SELL BOND, SELL GOLD, SELL NASDAQ
- Resesi / Panic / VIX > 30 (Risk Off): BUY JPY, BUY USD, BUY CHF, BUY GOLD, SELL OIL, SELL SPY
- Ekonomi Pulih / VIX < 20 (Goldilocks): SELL USD, BUY EUR/GBP, BUY STOCKS, BUY CRYPTO
- Stagflasi (Low Growth, High Inflation): Avoid Choppy FX Pairs, BUY GOLD & COMMODITIES
- Equity Trend Formula: Growth GDP Expansion + Loose Liquidity (QE) + Risk On = Bullish Equities

OUTPUT FORMAT REQUIREMENTS:
- Speak with a razor-sharp, authoritative, and direct tone. Use a blend of Indonesian professional financial terms, casual Indonesian slang ("lu"), and institutional English vocabulary to simulate a high-level trading desk environment.
- Avoid walls of text. Use scannable markdown tables, bolding for critical metrics, horizontal dividers, and bullet points.
- Never output formulas inside a code block using LaTeX syntax unless requested; use clean ASCII/standard characters inside terminal logs.
- End your analysis directly with an "INSTITUTIONAL SENTIMENT STATUS: [HAWKISH / DOVISH / RISK-ON / RISK-OFF]" summary block. Do not ask follow-up questions or offer menus at the end.`;

export const macroAiService = {
  async chatStream(
    messages: { role: "user" | "assistant", content: string }[], 
    res: any,
    currentRegime?: string,
    assets?: any[],
    liquidityStatus?: string
  ) {
    if (!env.GROQ_API_KEY) {
      throw new Error("Fitur AI dinonaktifkan: GROQ_API_KEY tidak ditemukan");
    }

    const model = env.GROQ_MODEL || "llama-3.3-70b-versatile";

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
      let dynamicSystemPrompt = HUNTER_DESK_SYSTEM_PROMPT;
      
      if (currentRegime && assets) {
        const assetString = assets.map(a => `${a.name} (${a.ticker}): ${a.change > 0 ? "+" : ""}${a.change}%`).join(", ");
        dynamicSystemPrompt += `\n\n[CRITICAL LIVE CONTEXT]\nSystem Quantitative Algorithm currently classifies the Macro Regime as: ${currentRegime.toUpperCase()}.\nLive Asset Data: ${assetString}\n`;
        if (liquidityStatus) {
           dynamicSystemPrompt += `ON RRP Liquidity Flow Status: ${liquidityStatus.toUpperCase()} (Injecting = Bullish/Risk-On, Draining = Bearish/Risk-Off).\n`;
        }
        dynamicSystemPrompt += `You MUST align your analysis with this regime, liquidity flow, and data. Do NOT contradict the terminal's classification.`;
      }

      const groqMessages = [
        { role: "system" as const, content: dynamicSystemPrompt },
        ...messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content }))
      ];

      const response = await axios.post(
        GROQ_API_URL,
        {
          model,
          messages: groqMessages,
          max_tokens: 2000,
          stream: true,
        },
        {
          headers: {
            "Authorization": `Bearer ${env.GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
          responseType: "stream",
          timeout: 60000,
        }
      );

      let buffer = "";

      response.data.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const payload = trimmed.slice(6);
          if (payload === "[DONE]") {
            res.write("data: [DONE]\n\n");
            return;
          }
          try {
            const parsed = JSON.parse(payload);
            const text = parsed.choices?.[0]?.delta?.content;
            if (text) {
              res.write(`data: ${JSON.stringify({ text })}\n\n`);
            }
          } catch {
            // Skip malformed JSON chunks
          }
        }
      });

      response.data.on("end", () => {
        if (!res.writableEnded) {
          res.write("data: [DONE]\n\n");
          res.end();
        }
      });

      response.data.on("error", (err: any) => {
        console.error("Groq Stream Error:", err.message);
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ error: "Stream error dari Groq." })}\n\n`);
          res.end();
        }
      });

    } catch (error: any) {
      console.error("Macro AI Groq Stream Error:", error.message || error);
      res.write(`data: ${JSON.stringify({ error: "Gagal memproses request AI. Coba lagi nanti." })}\n\n`);
      res.end();
    }
  },

  async analyzeRegime(assets: { ticker: string; name: string; change: number }[], calculatedRegime?: string, liquidityStatus?: string) {
    // Try Gemini first as fallback if available
    if (env.GEMINI_API_KEY) {
      try {
        const geminiText = `Berdasarkan pergerakan aset makro secara realtime saat ini:\n${assets.map(a => `${a.name} (${a.ticker}): ${a.change > 0 ? "+" : ""}${a.change}%`).join("\n")}\n\n${calculatedRegime ? `Algoritma sistem telah mendeteksi regime saat ini sebagai: ${calculatedRegime.toUpperCase()}.` : ""}\n${liquidityStatus ? `ON RRP Liquidity Flow Status terdeteksi sebagai: ${liquidityStatus.toUpperCase()}.` : ""}\n\nBerikan simpulan 1-2 kalimat tegas tentang kondisi regime makro dan flow institusi.`;
        
        const geminiRes = await axios.post(
          GEMINI_API_URL,
          {
            system_instruction: { text: HUNTER_DESK_SYSTEM_PROMPT },
            contents: [{ 
              role: "user", 
              parts: [{ text: geminiText }] 
            }],
            generationConfig: { maxOutputTokens: 500 }
          },
          {
            headers: { "Content-Type": "application/json" },
            timeout: 30000,
          }
        );
        const text = geminiRes.data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      } catch (e) {
        // Fall through to Groq
      }
    }

    if (!env.GROQ_API_KEY) {
      throw new Error("Fitur AI dinonaktifkan: GROQ_API_KEY tidak ditemukan");
    }

    const assetString = assets.map(a => `${a.name} (${a.ticker}): ${a.change > 0 ? "+" : ""}${a.change}%`).join("\n");
    
    let prompt = `Berdasarkan pergerakan aset makro secara realtime saat ini:\n${assetString}\n\n`;
    if (calculatedRegime) {
      prompt += `Algoritma sistem telah mendeteksi regime saat ini sebagai: ${calculatedRegime.toUpperCase()}.\n`;
    }
    if (liquidityStatus) {
      prompt += `ON RRP Liquidity Flow Status terdeteksi sebagai: ${liquidityStatus.toUpperCase()} (Injecting = Bullish/Risk-On, Draining = Bearish/Risk-Off).\n`;
    }
    prompt += `Berikan simpulan 1-2 kalimat tegas dan singkat mengenai kondisi regime makro dan flow institusi saat ini. Selaraskan dengan hasil deteksi algoritma dan status likuiditas (jika ada). Gunakan bahasa trader profesional (campur bahasa Indonesia dan istilah finansial). Jangan memberikan rekomendasi trading.`;

    // Try different Groq models if rate limited
    for (let attempt = 0; attempt < GROQ_MODELS.length; attempt++) {
      const model = GROQ_MODELS[attempt];
      try {
        const response = await axios.post(
          GROQ_API_URL,
          {
            model,
            messages: [
              { role: "system", content: HUNTER_DESK_SYSTEM_PROMPT },
              { role: "user", content: prompt },
            ],
            max_tokens: 500,
            stream: false,
          },
          {
            headers: {
              "Authorization": `Bearer ${env.GROQ_API_KEY}`,
              "Content-Type": "application/json",
            },
            timeout: 30000,
          }
        );

        return response.data.choices?.[0]?.message?.content || "Gagal mendapatkan analisis regime makro.";
      } catch (error: any) {
        if (error.response?.status === 429) {
          // Try next model after delay
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        throw error;
      }
    }

    throw new Error("Rate limit tercapai di semua model Groq. Tunggu beberapa menit sebelum mencoba lagi.");
  },

  async analyzeMacroFeed(headline: string, targetAsset: string, context?: string) {
    // Try Gemini first as fallback if available
    if (env.GEMINI_API_KEY) {
      try {
        const prompt = context || `${headline}\n\nTarget Aset: ${targetAsset}\n\nGunakan format:\nFakta:\nDampak Market:\nLogika:\nContrarian:\nTrigger:\nConfidence:\nRisk:`;
        
        const geminiRes = await axios.post(
          GEMINI_API_URL,
          {
            system_instruction: { text: HUNTER_DESK_SYSTEM_PROMPT },
            contents: [{ 
              role: "user", 
              parts: [{ text: prompt }] 
            }],
            generationConfig: { maxOutputTokens: 800 }
          },
          {
            headers: { "Content-Type": "application/json" },
            timeout: 30000,
          }
        );
        const text = geminiRes.data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      } catch (e) {
        // Fall through to Groq
      }
    }

    if (!env.GROQ_API_KEY) {
      throw new Error("Fitur AI dinonaktifkan: GROQ_API_KEY tidak ditemukan");
    }

    const prompt = context 
      ? `Analisis dampak berikut sebagai Institutional Desk Trader:\n${context}\n\nGunakan format:\nFakta:\nDampak Market:\nLogika:\nContrarian:\nTrigger:\nConfidence:\nRisk:`
      : `Analisis dampak berikut sebagai Institutional Desk Trader:\n${headline}\n\nTarget Aset: ${targetAsset}\n\nGunakan format:\nFakta:\nDampak Market:\nLogika:\nContrarian:\nTrigger:\nConfidence:\nRisk:`;

    // Try different Groq models if rate limited
    for (let attempt = 0; attempt < GROQ_MODELS.length; attempt++) {
      const model = GROQ_MODELS[attempt];
      try {
        const response = await axios.post(
          GROQ_API_URL,
          {
            model,
            messages: [
              { role: "system", content: HUNTER_DESK_SYSTEM_PROMPT },
              { role: "user", content: prompt },
            ],
            max_tokens: 800,
            stream: false,
          },
          {
            headers: {
              "Authorization": `Bearer ${env.GROQ_API_KEY}`,
              "Content-Type": "application/json",
            },
            timeout: 30000,
          }
        );

        return response.data.choices?.[0]?.message?.content || "Gagal mendapatkan analisis macro feed.";
      } catch (error: any) {
        if (error.response?.status === 429) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        throw error;
      }
    }

    throw new Error("Rate limit tercapai di semua model Groq. Tunggu beberapa menit sebelum mencoba lagi.");
  }
};
