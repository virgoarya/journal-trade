import { macroAiService } from './src/services/macro-ai.service';
const news = [{ id: "1", headline: "Dutch military invests millions in drone software platform", source: "Reuters" }];
(macroAiService as any).batchAnalyzeNews = async function(newsItems: any, context?: string) {
    const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const newsListStr = newsItems
      .map((n: any) => `[${n.id}] ${n.source}: ${n.headline}`)
      .join("\n");

    const prompt = `Lakukan bedah berita makro secara institusional untuk daftar berita berikut:\n${newsListStr}\n${context ? `Konteks Tambahan: ${context}` : ""}\n\nJawab HANYA dengan array of JSON valid. Analisis SETIAP berita, JANGAN ADA yang terlewat. Jika berita singkat, tetap berikan ekstrapolasi logis. JANGAN PERNAH mengisi dengan "Tidak ada data". Setiap objek di dalam array merepresentasikan satu berita dan HARUS menggunakan struktur persis seperti berikut (perhatikan kapitalisasi huruf pada "Fakta"):\n[\n  {\n    "id": "id berita sesuai input",\n    "assets": "Tuliskan 1-3 ticker/aset yang paling terdampak",\n    "regime": "Pilih SATU: Reflation, Deflation, Goldilocks, Stagflation, atau Neutral",\n    "Fakta": "1-2 kalimat fakta absolut dari berita",\n    "dampakMarket": "Arah aliran modal (capital flow) dan dampak orde-kedua",\n    "logika": "Mekanisme makro yang mendasari dampak tersebut",\n    "contrarian": "Skenario kegagalan narasi",\n    "triggerFundamentalNonTeknikal": "Data makro/event berikutnya",\n    "confidenceScore": "Pilih SATU: TINGGI, SEDANG, atau RENDAH"\n  }\n]`;

    const systemPrompt =
      "ROLE: Institutional Macro Strategist. RULES: 1. Selalu berikan analisis (jangan jawab 'Tidak ada data'). 2. Output HARUS array of JSON valid. 3. Jangan potong respon, selesaikan seluruh daftar.";

    let text: string | null = null;
    try {
        const { default: axios } = require("axios");
        // We just use Gemini for testing directly
        text = await (macroAiService as any).callGeminiDirect(systemPrompt, prompt, geminiModel, {
          maxOutputTokens: 4000,
          temperature: 0.2,
        });
        console.log("RAW TEXT:", text);
    } catch(e: any) {
        console.error(e.message);
    }
}
macroAiService.batchAnalyzeNews(news, "General").then(console.log).catch(console.error);
