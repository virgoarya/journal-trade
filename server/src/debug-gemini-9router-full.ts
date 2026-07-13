import axios from "axios";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../.env") });

const SYSTEM_PROMPT = `Kamu adalah seorang ahli strategi trading profesional dengan pengalaman 15+ tahun. Tugasmu adalah menganalisis sinyal trading yang diberikan dan menghasilkan keputusan dalam format JSON dengan kunci "verdict" dan "reasoning".

Aturan Analisis Sinyal (WAJIB diikuti):
1. **Struktur Pasar (Market Structure)** — Apakah arah tren mendukung arah sinyal? (BULL/BEAR/SIDEWAYS)
2. **Konfluensi Metodologi (Methodology Confluence)** — Seberapa banyak metode/indikator yang setuju dengan sinyal ini? (minimal 3 untuk GOOD)
3. **Rasio Risiko/Hasil (Risk/Reward)** — Apakah perbandingan SL/TP masuk akal? (minimal R:R 1:1.5 untuk GOOD, 1:1 untuk SKIP)
4. **Aksi Harga (Price Action)** — Apakah ada konfirmasi nyata dari struktur harga? (breakout, penolakan/rejection, pola harga)
5. **Risiko Korelasi (Correlation Risk)** — Apakah sinyal ini berkorelasi tinggi dengan posisi terbuka lainnya?
6. **Keselarasan Fundamental (Fundamental Alignment)** — Apakah sentimen fundamental mendukung arah teknikal?
7. **Konfirmasi Timeframe Lebih Tinggi (HTF Confirmation)** — Apakah timeframe yang lebih besar mengkonfirmasi arah sinyal?

Format Output (Kamu WAJIB membalas dengan JSON block berikut, jangan ada teks lain):
\`\`\`json
{
  "verdict": "GOOD",
  "reasoning": "Tren besar searah sinyal. Konfluensi 3 metode mendukung. Risk/Reward 1:2 rasional."
}
\`\`\`
PENTING: Nilai "reasoning" WAJIB ditulis DALAM BAHASA INDONESIA dan harus singkat (maksimal 2 kalimat) tentang faktor teknikal pasar pendukung.
ATURAN KERAS: JANGAN menulis analisis langkah-demi-langkah (step-by-step), JANGAN menerjemahkan ulang aturan prompt, dan JANGAN memberikan penjelasan panjang lebar di dalam nilai "reasoning". Langsung berikan kesimpulan akhir yang padat.`;

const prompt = `Evaluasi sinyal trading berikut secara objektif dan teknikal:

Simbol/Aset: XAUUSD
Arah Posisi: SELL
Tingkat Keyakinan (Confidence): 82%
Entry Price: 2058.17
Stop Loss (SL): 2083.08
Take Profit (TP): 2043.95
Rasio Risk/Reward: 0.57
Alasan Dasar: Trend is bearish

Struktur Tren Market: BEAR
Jumlah Metode yang Menyetujui: 2/4

Rincian Detail Metode:
{
  "smc": { "confidence": 75, "weight": 1.5, "contribution": 112.5 },
  "ict": { "confidence": 80, "weight": 1.2, "contribution": 96 }
}

Ingat: Berikan keputusan akhir (verdict) dan analisis teknikal (reasoning) eksklusif dalam Bahasa Indonesia. Balas hanya dengan format JSON yang valid, tanpa teks pengantar maupun penutup.`;

async function debugGemini() {
  const nineRouterUrl = process.env.NINE_ROUTER_URL || "https://retvnja.abc-tunnel.us/v1";
  const nineRouterApiKey = process.env.NINE_ROUTER_API_KEY || "";

  try {
    const res = await axios.post(
      nineRouterUrl + "/chat/completions",
      {
        model: "gc/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt }
        ],
        max_tokens: 4096,
        temperature: 0.1
      },
      {
        headers: {
          "Authorization": "Bearer " + nineRouterApiKey,
          "Content-Type": "application/json"
        }
      }
    );
    console.log("RAW RESPONSE:");
    console.log(JSON.stringify(res.data, null, 2));
    console.log("\nCONTENT:");
    console.log(res.data.choices?.[0]?.message?.content);
  } catch (error: any) {
    console.log("FAILED:", error.response?.status, JSON.stringify(error.response?.data || error.message));
  }
}

debugGemini();
