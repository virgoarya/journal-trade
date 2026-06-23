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
      "google/gemini-pro",
      env.ANTHROPIC_MODEL || "google/gemma-2-9b-it:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "openrouter/free"
    ];

    const macroContext = macroRegime ? `
- Macro Quadrant: ${macroRegime.quadrant || "Unknown"} (Growth: ${macroRegime.growth?.status || "Unknown"}, Inflation: ${macroRegime.inflation?.status || "Unknown"})
- Liquidity Status: ${macroRegime.liquidity?.status || "Unknown"}` : "";

    const prompt = `
Anda adalah Chief Macro Strategist di sebuah hedge fund global dengan AUM $50 miliar.
Anda memiliki standar riset setara sell-side tier-1 (Goldman Sachs, JPMorgan Global Research).
Hasilkan analisis yang bisa langsung dipakai portfolio manager untuk keputusan alokasi aset hari ini.

═══════════════════════════════════
DATA PASAR (REAL-TIME)
═══════════════════════════════════
- Regime Yield Curve: ${curveRegime}
- 3-Month Yield: ${snapshot.y3m}%
- 2-Year Yield: ${snapshot.y2y}%
- 10-Year Yield: ${snapshot.y10}%
- Spread 10Y-3M (Fed's Recession Gauge): ${snapshot.spread10y3m} bps
- Spread 10Y-2Y (Market Leading Indicator): ${snapshot.spread10y2y} bps
- VIX (Market Stress Indicator): ${snapshot.vix}${macroContext}

═══════════════════════════════════
RULE-BASED LOGIC WAJIB — JANGAN DILANGGAR
═══════════════════════════════════
Gunakan definisi berikut secara KETAT dan KONSISTEN dalam seluruh narasi analisis:

BEAR FLATTENER → Yield jangka pendek (3M/2Y) naik LEBIH CEPAT dari yield panjang (10Y).
Makna: Fed hawkish, "Higher for Longer". Suku bunga pendek sedang TINGGI.
Dampak WAJIB yang benar:
  - Obligasi: SHORT-END menarik (T-Bills 3M–6M mengunci yield tinggi). HINDARI long-duration (10Y–30Y) karena harganya tertekan.
  - Ekuitas: UNDERWEIGHT growth/tech. OVERWEIGHT sektor defensif yang punya pricing power (Healthcare, Consumer Staples, Energy).
  - Emas: TERTEKAN karena opportunity cost memegang aset non-yield menjadi sangat mahal saat yield pendek tinggi.
  - USD: Cenderung KUAT.

BEAR STEEPENER → Yield jangka panjang (10Y) naik LEBIH CEPAT dari yield pendek.
Makna: Pasar khawatir inflasi struktural atau fiscal dominance. Premi risiko jangka panjang naik.
Dampak WAJIB yang benar:
  - Obligasi: SANGAT NEGATIF untuk semua durasi panjang.
  - Ekuitas: Tekanan luas, terutama saham dengan valuasi tinggi (P/E tinggi).
  - Komoditas & Energi: Cenderung OUTPERFORM sebagai hedge inflasi.
  - Emas: Bisa NAIK jika dipicu fiscal dominance, tapi tergantung real yields.

BULL FLATTENER → Yield jangka panjang (10Y) turun LEBIH CEPAT dari yield pendek.
Makna: Pasar mengantisipasi perlambatan atau resesi. "Flight to safety" ke obligasi panjang.
Dampak WAJIB yang benar:
  - Obligasi: SANGAT POSITIF untuk long-duration (10Y+). Harga naik saat yield turun.
  - Ekuitas: Rotasi DEFENSIF. Underweight cyclical, Overweight Healthcare & Consumer Staples.
  - Emas & Safe-haven: OUTPERFORM.
  - USD: Bergantung konteks, tapi safe-haven currencies (JPY, CHF) cenderung menguat.

BULL STEEPENER → Yield jangka pendek (3M/2Y) turun LEBIH CEPAT dari yield panjang.
Makna: Pasar mengantisipasi pemangkasan suku bunga (rate cuts). Fase early-recovery.
Dampak WAJIB yang benar:
  - Obligasi: Short-duration jadi kurang menarik. Long-duration bisa diakumulasi.
  - Ekuitas: POSITIF untuk growth/tech yang sensitif suku bunga. Risk-on rally.
  - Emas: Cenderung NAIK seiring ekspektasi dolar melemah.

═══════════════════════════════════
TUGAS ANALISIS (4 POIN, LANGSUNG KE INTI)
═══════════════════════════════════

**1. Sinyal Teknikal & Proyeksi Suku Bunga**
Apa yang sedang di-price-in Smart Money dari posisi yield dan spread saat ini? Apakah kurva sedang menuju flattening atau steepening lebih lanjut? Implikasi terhadap fase ekonomi (Ekspansi / Late-Cycle / Resesi)?

**2. Deteksi Smart Money & Peringatan Dini**
Apakah VIX ${snapshot.vix} mencerminkan risiko yang ada secara akurat, atau pasar sedang complacent (under-pricing risk)? Apakah ada sinyal potensi krisis likuiditas atau kegagalan sistemik yang belum ter-price-in? Ini adalah momen untuk membeli proteksi (put options) sebelum volatilitas melonjak.

**3. Strategi Alokasi Aset — SPESIFIK & ACTIONABLE**
Berdasarkan regime ${curveRegime} dan rule-based logic di atas, berikan rekomendasi yang konsisten:
- **Obligasi (DURASI SPESIFIK)**: Apakah Short-end (T-Bills 3M–6M) atau Long-duration (10Y+) yang tepat?
- **Ekuitas (ROTASI SEKTOR)**: Sektor mana yang Overweight dan Underweight? Jangan hanya bilang "hati-hati".
- **Safe-Haven (KONSISTEN DENGAN REGIME)**: Apakah Emas menarik atau justru tertekan oleh opportunity cost yield tinggi?

**4. Alignment atau Divergence Makro**
Apakah sinyal Yield Curve ini SELARAS (align) atau BERLAWANAN (diverge) dengan Macro Quadrant dan kondisi likuiditas saat ini? Jika ada divergence, ini adalah alarm transisi rezim yang harus diwaspadai sebelum pasar bergerak.
*Catatan Penting WAJIB DIIKUTI*: JANGAN PERNAH menyimpulkan bahwa Bear Flattener selaras dengan pertumbuhan tinggi (Goldilocks). Bear Flattener (Hawkish) vs Goldilocks = DIVERGENCE TOTAL. Jika kondisi ini terjadi, Anda WAJIB menyimpulkan bahwa pasar sedang dalam fase transisi. Sentimen risk-on dari likuiditas jangka pendek bisa tiba-tiba terpatahkan (rug pull) jika Fed tetap menolak memotong suku bunga. Oleh karena itu, portofolio harus bersiap untuk pergeseran rezim yang cepat. Anda harus menyebutkan istilah "rug pull" secara eksplisit!

═══════════════════════════════════
ATURAN FORMAT OUTPUT
═══════════════════════════════════
- JANGAN membuka dengan basa-basi, salam, pengantar, atau menyebutkan ulang judul regime.
- LANGSUNG MULAI hasil Anda dari nomor "1. Sinyal Teknikal & Proyeksi Suku Bunga".
- WAJIB konsisten secara internal: narasi obligasi, ekuitas, dan emas HARUS selaras dengan rule-based logic di atas.
- Bahasa Indonesia profesional setara riset Goldman Sachs/JPMorgan.
- Gunakan **bold** dan bullet points untuk keterbacaan. Tajam dan padat.
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
            max_tokens: 1500,
            messages: [
              { role: "user", content: prompt }
            ]
          });
          console.log("Success with model:", model);
          break;
        } catch (error: any) {
          lastError = error;
          console.warn(`Model ${model} failed:`, error.status || error.message);
          if (error.status !== 429 && error.status !== 502) {
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
              {
                role: "system",
                content: "You are a Chief Macro Strategist at a $50B AUM hedge fund. You follow strict institutional-grade rule-based logic for yield curve regime analysis."
              },
              { role: "user", content: prompt }
            ],
            max_tokens: 1500
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
