  async analyzeRegime(assets: { ticker: string; name: string; change: number }[], calculatedRegime?: string, liquidityStatus?: string) {
    // Compute growth and inflation proxies from assets
    const spy = assets.find(a => a.ticker === "SPY")?.change ?? 0;
    const iief = assets.find(a => a.ticker === "IEF")?.change ?? 0;
    const tip = assets.find(a => a.ticker === "TIP")?.change ?? 0;
    const gld = assets.find(a => a.ticker === "GLD")?.change ?? 0;
    const vix = assets.find(a => a.ticker === "VIXY")?.change ?? 0;
    const uup = assets.find(a => a.ticker === "UUP")?.change ?? 0;
    const fxy = assets.find(a => a.ticker === "FXY")?.change ?? 0;

    const growth = spy - iief;
    const inflation = (tip + gld) / 2 - iief;

    const growthStatus = growth > 0 ? "high" : "low";
    const inflationStatus = inflation > 0 ? "high" : "low";

    // Determine sentiment based on regime and liquidity (simple mapping)
    let sentiment: "RISK-ON" | "RISK-OFF" | "NEUTRAL" = "NEUTRAL";
    if (calculatedRegime === "Reflation" || calculatedRegime === "Goldilocks") {
      sentiment = liquidityStatus === "Draining" ? "NEUTRAL" : "RISK-ON";
    } else if (calculatedRegime === "Stagflation" || calculatedRegime === "Deflation" || calculatedRegime === "Inflation") {
      sentiment = liquidityStatus === "Refilling" ? "NEUTRAL" : "RISK-OFF";
    }

    // Key assets performance map
    const keyAssets = {
      SPY: spy,
      QQQ: assets.find(a => a.ticker === "QQQ")?.change ?? 0,
      GLD: gld,
      UUP: uup,
      VIX: vix,
      IEF: iief,
      FXY: fxy,
      TIP: tip,
    };

    // Build JSON-like state string for the prompt
    const stateJson = {
      regime: calculatedRegime ?? "unknown",
      growthStatus,
      inflationStatus,
      liquidityStatus: liquidityStatus ?? "unknown",
      sentiment,
      keyAssets,
    };

    let prompt = `Anda adalah analyst macro yang memberikan komentar singkat untuk dashboard trading.
HANYA gunakan data dari JSON state berikut, jangan menambah atau mengubah apa pun:

${JSON.stringify(stateJson, null, 2)}

KETERBATASAN
- Tidak boleh mengubah label regime atau status sentiment.
- Tidak boleh menyebutkan transisi regime (hal tersebut ditangani di tempat lain).
- Jawaban harus dalam Bahasa Indonesia, maksimal 3 kalimat.
- JANGAN mengarang angka atau indikator yang tidak ada dalam JSON.

TUGAS
Berdasarkan state JSON di atas, tulis sebuah paragraf singkat yang menjelaskan:
1. Mengapa regime saat ini masuk akal.
2. Apa implikasi status likuiditas ON RRP terhadap sentimen risiko.
3. Satu implikasi konkret untuk instrumen ekuitas atau mata uang asing (FX).

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
              { role: "system", content: "Anda adalah seorang analyst macro yang ahli dalam memberikan penjelasan singkat dan akurat dalam Bahasa Indonesia, mengikuti ketat instruksi yang diberikan." },
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
          // rate limit, try next model
          await new Promise(resolve => setTimeout(resolve, 1500));
          continue;
        }
        throw err;
      }
    }

    throw new Error("Gagal mendapatkan analisis regime dari layanan AI.");
  }