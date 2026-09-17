import { TradeEmotion } from "../models/TradeEmotion";
import { AITradeLog } from "../models/AITradeLog";
import { AIBacktestSkill } from "../models/AIBacktestSkill";
import { llmConsensusService } from "./llm-consensus.service";
import { silentLogger } from "../utils/silent-logger";

export interface PatternInsight {
  emotionPatterns: Array<{
    emotionTag: string;
    count: number;
    winRate: number;
    avgR: number;
    totalPnL: number;
  }>;
  timePatterns: Array<{
    hour: number;
    symbol: string;
    count: number;
    winRate: number;
    avgR: number;
  }>;
  methodologyDelta: Array<{
    methodology: string;
    backtestWR: number;
    realWR: number;
    delta: number;
    recommendation: string;
  }>;
  llmInsights: {
    summary: string;
    strengths: string[];
    weaknesses: string[];
    actionItems: Array<{
      priority: "high" | "medium" | "low";
      action: string;
      reason: string;
    }>;
  };
}

class JournalInsightService {
  private cache = new Map<string, { data: PatternInsight; timestamp: number }>();
  private CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  async analyze(userId: string, period: "week" | "month"): Promise<PatternInsight> {
    const cacheKey = `${userId}:${period}`;
    
    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      silentLogger.info(`[JOURNAL-INSIGHT] Cache hit for ${cacheKey}`);
      return cached.data;
    }

    const startDate = new Date();
    if (period === "week") startDate.setDate(startDate.getDate() - 7);
    else startDate.setMonth(startDate.getMonth() - 1);

    const [emotions, aiTrades] = await Promise.all([
      TradeEmotion.find({ userId, timestamp: { $gte: startDate } }).lean(),
      AITradeLog.find({ userId, closed: true, executionTime: { $gte: startDate } }).lean()
    ]);

    const emotionPatterns = this.detectEmotionPatterns(emotions, aiTrades);
    const timePatterns = this.detectTimePatterns(aiTrades);
    const methodologyDelta = await this.detectMethodologyDelta(userId, aiTrades);

    const llmInsights = await this.getLLMInsights({
      userId,
      emotionPatterns,
      timePatterns,
      methodologyDelta,
      totalTrades: aiTrades.length
    });

    await this.updateBacktestSkill(userId, llmInsights);

    const result: PatternInsight = {
      emotionPatterns,
      timePatterns,
      methodologyDelta,
      llmInsights
    };

    this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  }

  private detectEmotionPatterns(emotions: any[], aiTrades: any[]) {
    const grouped = emotions.reduce((acc, e) => {
      if (!acc[e.emotionTag]) acc[e.emotionTag] = [];
      acc[e.emotionTag].push(e);
      return acc;
    }, {} as Record<string, any[]>);

    return Object.keys(grouped).map(tag => {
      const trades = grouped[tag];
      const wins = trades.filter(t => t.pnl > 0).length;
      const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
      const avgR = trades.length > 0 
        ? trades.reduce((sum, t) => sum + (t.rMultiple || 0), 0) / trades.length 
        : 0;

      return {
        emotionTag: tag,
        count: trades.length,
        winRate: trades.length > 0 ? (wins / trades.length) * 100 : 0,
        avgR: Math.round(avgR * 100) / 100,
        totalPnL: Math.round(totalPnL * 100) / 100
      };
    });
  }

  private detectTimePatterns(aiTrades: any[]) {
    const grouped: Record<string, any[]> = {};
    for (const trade of aiTrades) {
      if (!trade.executionTime) continue;
      const hour = new Date(trade.executionTime).getHours();
      const key = `${hour}:${trade.signal.symbol}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(trade);
    }

    return Object.keys(grouped).map(key => {
      const [hourStr, symbol] = key.split(":");
      const hour = parseInt(hourStr);
      const trades = grouped[key];
      const wins = trades.filter(t => (t.pnl || 0) > 0).length;
      const avgR = trades.length > 0
        ? trades.reduce((sum, t) => {
            const risk = Math.abs(t.signal.entry - t.signal.sl);
            const rMultiple = risk > 0 ? (t.pnl || 0) / risk : 0;
            return sum + rMultiple;
          }, 0) / trades.length
        : 0;

      return {
        hour,
        symbol,
        count: trades.length,
        winRate: trades.length > 0 ? (wins / trades.length) * 100 : 0,
        avgR: Math.round(avgR * 100) / 100
      };
    });
  }

  private async detectMethodologyDelta(userId: string, aiTrades: any[]) {
    const skill = await AIBacktestSkill.findOne({ userId });
    if (!skill) return [];

    const result = [];
    for (const methRank of skill.methodologyRankings) {
      const realTrades = aiTrades.filter(
        t => t.signal.primaryMethodology === methRank.methodology
      );
      if (realTrades.length < 5) continue; // VERA: Min sample ≥ 5 trades

      const wins = realTrades.filter(t => (t.pnl || 0) > 0).length;
      const realWR = (wins / realTrades.length) * 100;
      const delta = realWR - methRank.avgWinRate;

      let recommendation = "MAINTAIN";
      if (delta > 10) recommendation = "INCREASE_WEIGHT";
      else if (delta < -10) recommendation = "DECREASE_WEIGHT";
      else if (delta < -20 && realTrades.length >= 15) recommendation = "DISABLE"; // VERA: sample ≥ 15 untuk DISABLE

      result.push({
        methodology: methRank.methodology,
        backtestWR: Math.round(methRank.avgWinRate * 100) / 100,
        realWR: Math.round(realWR * 100) / 100,
        delta: Math.round(delta * 100) / 100,
        recommendation
      });
    }

    return result;
  }

  private async getLLMInsights(data: any) {
    const prompt = this.buildPrompt(data);
    
    try {
      // AXIS: Reuse llm-consensus voting mechanism
      // VERA: Timeout > 5s → fallback
      const result = await llmConsensusService.callSingleProvider(
        "9router",
        "auto-free-model",
        prompt,
        { timeoutMs: 25000 } // VERA: LLM response time ≤ 2s, but give a generous timeout for 9router
      );
      
      return this.parseInsights(result.reasoning);
    } catch (err: any) {
      silentLogger.error(`[JOURNAL-INSIGHT] LLM call failed: ${err.message}`);
      return { // VERA: Fallback message
        summary: "LLM analysis unavailable. Please try again later.",
        strengths: [],
        weaknesses: [],
        actionItems: []
      };
    }
  }

  private buildPrompt(data: any): string {
    const worstTimePatterns = data.timePatterns.filter((t: any) => t.winRate < 40).map((t: any) => 
      `- ${t.symbol} jam ${t.hour}:00 NY (UTC-4): ${t.count} trades, win rate ${t.winRate.toFixed(1)}%`
    ).join("\n");

    return `Analisis trading journal berikut, fokus pada pola kerugian dan insight yang dapat ditindaklanjuti untuk meningkatkan performa. Sajikan rekomendasi spesifik dan prioritas. Semua waktu adalah dalam New York Time (UTC-4).

Total trades yang dianalisis: ${data.totalTrades}

Emosi patterns:
${data.emotionPatterns.map((e: any) => `- ${e.emotionTag}: ${e.count} trades, win rate ${e.winRate.toFixed(1)}%, avg R ${e.avgR}`).join("\n")}

Waktu trading dengan performa terburuk (win rate < 40%):
${worstTimePatterns || "Tidak ada pola waktu signifikan yang ditemukan."}

Perbandingan methodology (real vs backtest):
${data.methodologyDelta.map((m: any) => `- ${m.methodology}: backtest ${m.backtestWR}% \u2192 real ${m.realWR}% (delta ${m.delta > 0 ? "+" : ""}${m.delta}%)`).join("\n")}

Berikan analisis dalam format JSON:
{
  "summary": "ringkasan 2 kalimat tentang performa dan pola umum.",
  "strengths": ["kekuatan trading yang terdeteksi, contoh: disiplin pada kondisi X"],
  "weaknesses": ["kelemahan atau pola kerugian berulang, contoh: FOMO di sesi volatile"],
  "actionItems": [
    { "priority": "high", "action": "aksi konkret yang dapat dilakukan", "reason": "alasan/bukti dari data" }
  ]
} Contoh priority: high, medium, low.`;
  }

  private parseInsights(text: string) {
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("No JSON found in LLM response");
      return JSON.parse(match[0]);
    } catch (e: any) {
      silentLogger.error(`[JOURNAL-INSIGHT] Failed to parse LLM JSON: ${e.message}, Raw: ${text.substring(0, 500)}...`);
      return { // VERA: Fallback message
        summary: `LLM parsing error. Raw response: ${text.substring(0, 100)}...`, 
        strengths: [], 
        weaknesses: [], 
        actionItems: []
      };
    }
  }

  private async updateBacktestSkill(userId: string, insights: any) {
    const skill = await AIBacktestSkill.findOne({ userId });
    if (!skill) return;

    for (const item of insights.actionItems || []) {
      if (item.action.includes("Kurangi weight") || item.action.includes("Disable")) {
        const match = item.action.match(/(SMC|ICT|MSNR)/i);
        if (match) {
          const methodology = match[1].toUpperCase();
          const rank = skill.methodologyRankings.find(r => r.methodology === methodology);
          if (rank) {
            rank.verdict = item.action.includes("Disable") ? "DISABLE" : "ADJUST";
            silentLogger.info(`[JOURNAL-INSIGHT] Auto-adjusted ${methodology} to ${rank.verdict}`);
          }
        }
      }
    }

    await skill.save();
  }
}

export const journalInsightService = new JournalInsightService();