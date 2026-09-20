import { HawkAgent, DoveAgent, ContrarianAgent } from "../agents/specific.agents";
import { AgentInsight } from "../models/AgentInsight";
import { silentLogger } from "../utils/silent-logger";
import axios from "axios";
import { env } from "../config/env";

export interface DeepResearchResult {
  personaId: "hawk" | "dove" | "contrarian";
  analysis: string;
  selfImprovement: string;
  marketComparison: string;
  conviction: "TINGGI" | "SEDANG" | "RENDAH";
}

class DeepResearchService {
  /**
   * Run Deep Research for all agents
   * Aggregates ALL overview data and enforces critical thinking.
   */
  async runDeepResearch(userId?: string): Promise<DeepResearchResult[]> {
    silentLogger.info("[DeepResearch] Starting deep research thinking cycle...");

    // 1. Aggregasi SEMUA data overview
    const macroSnapshot = await this.fetchAllOverviewData();
    
    const personas = [
      { id: "hawk", agent: new HawkAgent() },
      { id: "dove", agent: new DoveAgent() },
      { id: "contrarian", agent: new ContrarianAgent() }
    ];

    const results: DeepResearchResult[] = [];

    for (const p of personas) {
      // 2. Ambil riwayat insight terakhir untuk perbandingan
      const previousInsight = await AgentInsight.findOne({ 
        personaId: p.id, 
        insightType: { $in: ["proactive", "deep_research"] } 
      }).sort({ createdAt: -1 }).lean();

      // 3. Bangun prompt Deep Research yang kritis
      const prompt = this.buildDeepResearchPrompt(p.id, macroSnapshot, previousInsight);

      // 4. Jalankan thinking process
      const result = await p.agent.think(prompt, { 
        currentRegime: macroSnapshot.regime, 
        liquidityStatus: macroSnapshot.liquidityDrain,
        macroData: macroSnapshot,
        userId
      });

      // 5. Simpan hasil sebagai "deep_research" type
      const conviction = this.extractConviction(result.reply);
      const savedDoc = await AgentInsight.create({
        personaId: p.id,
        insightType: "deep_research",
        content: result.reply,
        conviction,
        regime: macroSnapshot.regime,
        metadata: {
          macroSnapshot,
          previousInsightId: previousInsight?._id,
          isDeepResearch: true
        }
      });

      results.push({
        personaId: p.id as any,
        analysis: result.reply,
        selfImprovement: this.parseSection(result.reply, "Post-Hoc Analysis"),
        marketComparison: this.parseSection(result.reply, "Critical Synthesis"),
        conviction
      });
    }

    return results;
  }

  private buildDeepResearchPrompt(personaId: string, snapshot: any, previous: any): string {
    return `
[DEEP RESEARCH THINKING MODE]
Tugas Anda adalah melakukan analisis makroekonomi kritis tingkat tinggi. 
Anda TIDAK boleh memberikan jawaban standar atau 'halusinasi' tanpa bukti data.

DATA SNAPSHOT TERKINI (ALL OVERVIEW DATA):
- Regime: ${snapshot.regime || "N/A"}
- Liquidity Drain Score: ${snapshot.liquidityDrain || "N/A"}
- CPI YoY: ${snapshot.cpi || "N/A"}%
- Fed Funds: ${snapshot.fedRate || "N/A"}%
- VIX: ${snapshot.vix || "N/A"}
- Top News: ${snapshot.topNews || "N/A"}
- Heatmap Context: ${JSON.stringify(snapshot.heatmap || {})}
- Economic Calendar: ${JSON.stringify(snapshot.calendar || [])}

RIWAYAT STATEMENT ANDA SEBELUMNYA (${previous?.createdAt ? new Date(previous.createdAt).toLocaleString() : "Tidak ada riwayat"}):
---
${previous?.content || "Tidak ada statement sebelumnya untuk dibandingkan."}
---

INSTRUKSI KRITIS:
1. **Post-Hoc Analysis & Self-Improvement**: 
   Bandingkan statement Anda sebelumnya dengan data market saat ini. Apakah prediksi Anda akurat? 
   Jika meleset, identifikasi variabel yang Anda lewatkan (misal: "Saya mengabaikan lonjakan VIX" atau "Saya meremehkan ketahanan PMI").
   AKUI kesalahan dan perbaiki bias Anda di sini.

2. **Critical Synthesis (Non-Hallucinatory)**:
   Gunakan data di atas untuk membangun narasi yang koheren. Jangan asal menyebut "bullish" jika Liquidity Drain di atas 90. 
   Hubungkan korelasi antara data Heatmap (gejolak aset) dengan berita terbaru dan Regime makro.

3. **Phenomena Comparison**:
   Bandingkan fenomena global (misal: De-dollarization, Fed Pivot, Credit Crunch) dengan pergerakan harga aset yang terlihat di Heatmap.

Format Output Wajib (Plain Text, Bahasa Indonesia):
### ${personaId.toUpperCase()} DEEP RESEARCH ANALYSIS

**1. Post-Hoc Analysis (Self-Improvement):**
[Isi analisis perbandingan statement lalu vs market sekarang]

**2. Critical Synthesis:**
[Isi sintesis data makro dan fenomena global secara kritis]

**3. Probabilistic Outlook:**
[Isi proyeksi 24-72 jam ke depan berdasarkan data konklusif]
`;
  }

  private async fetchAllOverviewData() {
    try {
      const [geoResp, regimeResp, newsResp, heatmapResp, calResp] = await Promise.all([
        axios.get("http://localhost:5000/api/v1/geo-risk", { timeout: 5000 }).catch(() => null),
        axios.get("http://localhost:5000/api/v1/macro-regime/snapshot", { timeout: 5000 }).catch(() => null),
        axios.get("http://localhost:5000/api/v1/market-data/news", { timeout: 5000 }).catch(() => null),
        axios.get("http://localhost:5000/api/v1/market-data/quotes?symbols=XAUUSD,USDJPY,EURUSD,GBPUSD,BTCUSD,NDX,SPX", { timeout: 5000 }).catch(() => null),
        axios.get("http://localhost:5000/api/v1/market-data/economic-calendar", { timeout: 5000 }).catch(() => null),
      ]);

      const geoRaw = geoResp?.data?.data?.raw || {};
      const regimeData = regimeResp?.data?.data || {};
      const newsItems = newsResp?.data?.data || [];
      const heatmap = heatmapResp?.data?.data || {};
      const calendar = calResp?.data?.data || [];

      return {
        cpi: regimeData?.cpiYoY ?? geoRaw?.cpi_yoy ?? null,
        fedRate: geoRaw?.fedfunds_rate ?? null,
        vix: geoRaw?.vix ?? null,
        pmi: geoRaw?.globalPmi ?? null,
        liquidityDrain: geoResp?.data?.data?.scores?.liquidityDrain ?? null,
        regime: regimeData?.quadrant || null,
        topNews: newsItems.slice(0, 5).map((n: any) => n.headline || n.title).join("; "),
        heatmap,
        calendar: calendar.slice(0, 5),
      };
    } catch (err: any) {
      silentLogger.warn("[DeepResearch] Data fetch failed:", err.message);
      return {};
    }
  }

  private parseSection(text: string, sectionName: string): string {
    const regex = new RegExp(`\\*\\*\\d+\\.\\s*${sectionName}.*?:\\*\\*([\\s\\S]*?)(?=\\n\\*\\*|$)`, "i");
    const match = text.match(regex);
    return match ? match[1].trim() : "Analysis sections formatted as plain text.";
  }

  private extractConviction(text: string): "TINGGI" | "SEDANG" | "RENDAH" {
    const lower = text.toLowerCase();
    if (lower.includes("conviction tinggi") || lower.includes("high conviction") || lower.includes("sangat yakin")) return "TINGGI";
    if (lower.includes("conviction rendah") || lower.includes("low conviction") || lower.includes("ragu")) return "RENDAH";
    return "SEDANG";
  }
}

export const deepResearchService = new DeepResearchService();
