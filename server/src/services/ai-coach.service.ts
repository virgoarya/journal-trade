// ─── AI Coach Service ───────────────────────────────────────────────
// Analisis psikologi trading + AI feedback actionable menggunakan 9Router
// Market context diambil dari trade log yang diinput user

import { TradeEmotion } from "../models/TradeEmotion";
import { AITradeLog } from "../models/AITradeLog";
import { Trade } from "../models/Trade";
import { env } from "../config/env";
import { silentLogger } from "../utils/silent-logger";

export interface EmotionDistribution {
  tag: string;
  count: number;
  totalPnL: number;
  winRate: number;
  avgRMultiple: number;
}

export interface TimeOfDayHeatmap {
  hour: number; // 0-23
  emotionTag: string;
  count: number;
}

export interface AIAnalysisResult {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  actionItems: Array<{
    priority: "high" | "medium" | "low";
    action: string;
    reason: string;
  }>;
}

export interface AnalyzeParams {
  userId: string;
  period: "week" | "month";
  startDate: Date;
  endDate: Date;
}

const EMOTION_TAGS = [
  "FOMO",
  "REVENGE",
  "GREEDY",
  "FEAR",
  "CONFIDENT",
  "CALM",
  "HESITANT",
] as const;

const EMOTION_COLORS: Record<string, string> = {
  FOMO: "#FF9F1C", // Orange
  REVENGE: "#FF3333", // Red
  GREEDY: "#FFD60A", // Gold
  FEAR: "#3399FF", // Blue
  CONFIDENT: "#2ECC71", // Green
  CALM: "#00CEC9", // Teal
  HESITANT: "#95A5A6", // Gray
};

function getSessionFromDate(date: Date): "ASIA" | "LONDON" | "NEW_YORK" | "OVERLAP" {
  const hour = date.getUTCHours();
  // Asia: 00-08 UTC, London: 08-16 UTC, NY: 13-21 UTC, Overlap: 13-16 UTC
  if (hour >= 13 && hour < 16) return "OVERLAP";
  if (hour >= 8 && hour < 13) return "LONDON";
  if (hour >= 13 && hour < 21) return "NEW_YORK";
  return "ASIA";
}

function buildEmotionDistribution(emotions: any[]): EmotionDistribution[] {
  const map = new Map<string, { count: number; pnl: number; wins: number; rMults: number[] }>();

  for (const e of emotions) {
    const tag = e.emotionTag;
    const existing = map.get(tag) || { count: 0, pnl: 0, wins: 0, rMults: [] };
    existing.count++;
    existing.pnl += e.pnl || 0;
    if ((e.pnl || 0) > 0) existing.wins++;
    if (e.rMultiple !== undefined) existing.rMults.push(e.rMultiple);
    map.set(tag, existing);
  }

  return Array.from(map.entries()).map(([tag, data]) => ({
    tag,
    count: data.count,
    totalPnL: data.pnl,
    winRate: data.count > 0 ? (data.wins / data.count) * 100 : 0,
    avgRMultiple:
      data.rMults.length > 0
        ? data.rMults.reduce((a, b) => a + b, 0) / data.rMults.length
        : 0,
  }));
}

function buildTimeOfDayHeatmap(emotions: any[]): TimeOfDayHeatmap[] {
  const map = new Map<string, number>(); // key: `${hour}-${emotionTag}`

  for (const e of emotions) {
    const hour = new Date(e.timestamp).getHours();
    const key = `${hour}-${e.emotionTag}`;
    map.set(key, (map.get(key) || 0) + 1);
  }

  return Array.from(map.entries()).map(([key, count]) => {
    const [hour, emotionTag] = key.split("-");
    return { hour: parseInt(hour), emotionTag, count };
  });
}

function calculateSessionDistribution(emotions: any[]): Record<string, number> {
  const dist: Record<string, number> = {
    ASIA: 0,
    LONDON: 0,
    NEW_YORK: 0,
    OVERLAP: 0,
  };
  for (const e of emotions) {
    dist[e.session] = (dist[e.session] || 0) + 1;
  }
  return dist;
}

async function call9Router(prompt: string): Promise<string> {
  const baseUrl = env.NINE_ROUTER_URL || "http://localhost:20128/v1";
  const apiKey = env.NINE_ROUTER_API_KEY || "sk-dummy";

  // Gunakan model prioritas tertinggi (gemini)
  const model = "gemini/gemini-3.5-flash-lite";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: `Kamu adalah AI Trade Coach untuk trader forex/crypto. Tugasmu menganalisis data trading + emosi trader, lalu memberikan saran actionable konkret dalam Bahasa Indonesia natural. Jangan menilai moral. Fokus pada pola perilaku & improvement. Output HANYA JSON valid.`,
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 2000,
        temperature: 0.3,
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`9Router error ${response.status}: ${errorText}`);
    }

    const data: any = await response.json();
    return data.choices?.[0]?.message?.content || "";
  } catch (error) {
    silentLogger.error(`[AI-COACH] 9Router call failed: ${error}`);
    throw error;
  }
}

function buildAnalysisPrompt(params: {
  userId: string;
  period: string;
  totalTrades: number;
  winRate: number;
  totalPnL: number;
  avgRMultiple: number;
  emotionDistribution: EmotionDistribution[];
  timeOfDayHeatmap: TimeOfDayHeatmap[];
  sessionDistribution: Record<string, number>;
  tradeDetails: Array<{
      tradeId: string;
      symbol: string;
      pnl: number;
      emotionTag: string;
      notes?: string;
      session: string;
      holdDurationMinutes?: number;
      rMultiple?: number;
      plannedRMultiple?: number;
      marketContext?: any;
    }>;
}): string {
  const { emotionDistribution, timeOfDayHeatmap, sessionDistribution, tradeDetails, ...rest } = params;

  let prompt = `ANALISIS PSIKOLOGI TRADING - ${params.period.toUpperCase()}

DATA RINGKASAN:
- Total Trades: ${params.totalTrades}
- Win Rate: ${params.winRate.toFixed(1)}%
- Total PnL: ${params.totalPnL.toFixed(2)}
- Avg R-Multiple: ${params.avgRMultiple.toFixed(2)}

DISTRIBUSI EMOSI:
`;

  for (const ed of emotionDistribution) {
    prompt += `- ${ed.tag}: ${ed.count}x | PnL: ${ed.totalPnL.toFixed(2)} | WR: ${ed.winRate.toFixed(1)}% | Avg R: ${ed.avgRMultiple.toFixed(2)}\n`;
  }

  prompt += `
DISTRIBUSI SESI TRADING:
`;

  for (const [session, count] of Object.entries(sessionDistribution)) {
    prompt += `- ${session}: ${count} trades\n`;
  }

  prompt += `
HEATMAP JAM vs EMOSI (Top 10):
`;

  const topHeatmap = timeOfDayHeatmap.sort((a, b) => b.count - a.count).slice(0, 10);
  for (const h of topHeatmap) {
    prompt += `- Jam ${h.hour.toString().padStart(2, "0")}:00 - ${h.emotionTag} (${h.count}x)\n`;
  }

  prompt += `
DETAIL TRADE + EMOSI (${tradeDetails.length} trades):
`;

  for (const td of tradeDetails) {
      prompt += `- ${td.symbol} | PnL: ${td.pnl.toFixed(2)} | Planned R: ${td.plannedRMultiple?.toFixed(2) || "N/A"} | Actual R: ${td.rMultiple?.toFixed(2) || "N/A"} | ${td.emotionTag} | ${td.session} | Hold: ${td.holdDurationMinutes || "?"}m | Notes: ${td.notes || "-"}\n`;
      if (td.marketContext) {
        prompt += `  Market: Spread=${td.marketContext.spread?.toFixed(1) || "?"} | Vol=${td.marketContext.volatility?.toFixed(2) || "?"} | Trend=${td.marketContext.trend || "?"}\n`;
      }
    }

  prompt += `
INSTRUKSI:
Analisis data di atas dan berikan output JSON HANYA dengan struktur berikut:
{
  "summary": "Ringkasan 2-3 kalimat Bahasa Indonesia natural tentang kondisi psikologi & performa trader periode ini",
  "strengths": ["Kekuatan 1", "Kekuatan 2", "Kekuatan 3"],
  "weaknesses": ["Kelemahan 1", "Kelemahan 2", "Kelemahan 3"],
  "actionItems": [
    {"priority": "high", "action": "Aksi konkret yang harus dilakukan", "reason": "Alasan mengapa aksi ini penting berdasarkan data"},
    {"priority": "medium", "action": "Aksi konkret", "reason": "Alasan"},
    {"priority": "low", "action": "Aksi konkret", "reason": "Alasan"}
  ]
}

ATURAN:
1. Semua teks dalam Bahasa Indonesia natural (bukan terjemahan kaku)
2. actionItems MESTI actionable & spesifik (contoh: "Kurangi ukuran posisi saat emosi FOMO muncul", bukan "Perbaiki risk management")
3. Prioritas high = pola berbahaya berulang, medium = area improvement, low = fine-tuning
4. Jangan menilai moral trader (hindari kata "salah", "bodoh", gunakan "perlu diperbaiki", "polanya berisiko")
5. Berikan reasoning berbasis DATA yang terlihat di atas
6. Output HANYA JSON, tanpa markdown, tanpa penjelasan tambahan`;

  return prompt;
}

function parseAIResponse(response: string): AIAnalysisResult {
  try {
    // Extract JSON from response (handle potential markdown code blocks)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : response;
    const parsed = JSON.parse(jsonStr);

    // Validate structure
    if (
      !parsed.summary ||
      !Array.isArray(parsed.strengths) ||
      !Array.isArray(parsed.weaknesses) ||
      !Array.isArray(parsed.actionItems)
    ) {
      throw new Error("Invalid response structure");
    }

    // Validate actionItems
    for (const item of parsed.actionItems) {
      if (!item.priority || !["high", "medium", "low"].includes(item.priority)) {
        item.priority = "medium";
      }
      if (!item.action) item.action = "Tindakan belum ditentukan";
      if (!item.reason) item.reason = "Alasan belum tersedia";
    }

    return parsed as AIAnalysisResult;
  } catch (error) {
    silentLogger.error(`[AI-COACH] Failed to parse AI response: ${error}`);
    // Fallback response
    return {
      summary: "Analisis AI gagal diproses. Silakan coba lagi nanti.",
      strengths: ["Data tersedia untuk analisis"],
      weaknesses: ["Gagal memproses respons AI"],
      actionItems: [
        {
          priority: "medium",
          action: "Coba jalankan analisis ulang nanti",
          reason: "Terjadi error saat memproses respons LLM",
        },
      ],
    };
  }
}

// Simple in-memory cache (24h TTL)
const analysisCache = new Map<string, { data: AIAnalysisResult; expiresAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function getCacheKey(userId: string, period: string, startDate: Date): string {
  return `${userId}:${period}:${startDate.toISOString().split("T")[0]}`;
}

export const aiCoachService = {
  /**
   * Main analysis function - fetches trade emotions, builds prompt, calls 9Router, returns structured analysis
   */
  async analyze(params: AnalyzeParams): Promise<AIAnalysisResult> {
    const cacheKey = getCacheKey(params.userId, params.period, params.startDate);
    const cached = analysisCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      silentLogger.info(`[AI-COACH] Cache hit for ${cacheKey}`);
      return cached.data;
    }

    silentLogger.info(`[AI-COACH] Starting analysis for user ${params.userId}, period ${params.period}`);

    // 1. Fetch TradeEmotion documents
    const emotions = await TradeEmotion.find({
      userId: params.userId,
      timestamp: { $gte: params.startDate, $lte: params.endDate },
    }).sort({ timestamp: -1 }).lean();

    if (emotions.length === 0) {
      return {
        summary: `Belum ada data emosi trading untuk periode ${params.period} ini. Mulai catat emosi di setiap trade untuk mendapat analisis AI.`,
        strengths: ["Siap mencatat emosi trade"],
        weaknesses: ["Belum ada data emosi"],
        actionItems: [
          {
            priority: "high",
            action: "Catat emosi di trade selanjutnya menggunakan tombol 'Catat Emosi'",
            reason: "Tanpa data emosi, AI Coach tidak bisa memberikan analisis psikologi",
          },
        ],
      };
    }

    // 2. Fetch related trade data (AITradeLog + Trade) for market context
    const tradeIds = emotions.map((e) => e.tradeId);
    const [aiLogs, manualTrades] = await Promise.all([
      AITradeLog.find({ mt5Ticket: { $in: tradeIds.map(Number).filter((n) => !isNaN(n)) } }).lean(),
      Trade.find({ mt5TicketId: { $in: tradeIds } }).lean(),
    ]);

    // Build trade details with market context from logs
    const tradeDetails = emotions.map((e) => {
      const aiLog = aiLogs.find((l) => l.mt5Ticket?.toString() === e.tradeId);
      const mTrade = manualTrades.find((t) => t.mt5TicketId === e.tradeId);

      return {
        tradeId: e.tradeId,
        symbol: e.symbol,
        pnl: e.pnl,
        emotionTag: e.emotionTag,
        notes: e.notes,
        session: e.session,
        holdDurationMinutes: e.holdDurationMinutes,
        rMultiple: e.rMultiple,
        marketContext: e.marketContext || aiLog?.analysisSnapshot || mTrade ? {
          spread: undefined,
          volatility: aiLog?.analysisSnapshot?.volatility,
          trend: aiLog?.analysisSnapshot?.trend,
          support: aiLog?.analysisSnapshot?.support,
          resistance: aiLog?.analysisSnapshot?.resistance,
        } : undefined,
      };
    });

    // 3. Calculate statistics
    const totalTrades = emotions.length;
    const wins = emotions.filter((e) => e.pnl > 0).length;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
    const totalPnL = emotions.reduce((sum, e) => sum + e.pnl, 0);
    const rMultiples = emotions.filter((e) => e.rMultiple !== undefined).map((e) => e.rMultiple!);
    const avgRMultiple = rMultiples.length > 0 ? rMultiples.reduce((a, b) => a + b, 0) / rMultiples.length : 0;

    const emotionDistribution = buildEmotionDistribution(emotions);
    const timeOfDayHeatmap = buildTimeOfDayHeatmap(emotions);
    const sessionDistribution = calculateSessionDistribution(emotions);

    // 4. Build prompt & call 9Router
    const prompt = buildAnalysisPrompt({
      userId: params.userId,
      period: params.period,
      totalTrades,
      winRate,
      totalPnL,
      avgRMultiple,
      emotionDistribution,
      timeOfDayHeatmap,
      sessionDistribution,
      tradeDetails,
    });

    let aiResult: AIAnalysisResult;
    try {
      const response = await call9Router(prompt);
      aiResult = parseAIResponse(response);
    } catch (error) {
      silentLogger.error(`[AI-COACH] LLM call failed, using fallback: ${error}`);
      aiResult = {
        summary: `Analisis AI gagal (${error instanceof Error ? error.message : "unknown error"}). Data menunjukkan ${totalTrades} trade dengan WR ${winRate.toFixed(1)}%.`,
        strengths: winRate > 50 ? ["Win rate di atas 50%"] : ["Memiliki data untuk dianalisis"],
        weaknesses: ["Gagal mendapatkan analisis AI otomatis"],
        actionItems: [
          {
            priority: "high",
            action: "Periksa koneksi 9Router dan coba analisis ulang",
            reason: "LLM tidak merespons, mungkin service 9Router down atau rate limited",
          },
        ],
      };
    }

    // 5. Cache result
    analysisCache.set(cacheKey, { data: aiResult, expiresAt: Date.now() + CACHE_TTL_MS });

    silentLogger.info(`[AI-COACH] Analysis complete for ${params.userId}`);
    return aiResult;
  },

  /**
   * Get emotion distribution for charts
   */
  async getEmotionDistribution(userId: string, startDate: Date, endDate: Date): Promise<EmotionDistribution[]> {
    const emotions = await TradeEmotion.find({
      userId,
      timestamp: { $gte: startDate, $lte: endDate },
    }).lean();
    return buildEmotionDistribution(emotions);
  },

  /**
   * Get time-of-day heatmap data
   */
  async getTimeOfDayHeatmap(userId: string, startDate: Date, endDate: Date): Promise<TimeOfDayHeatmap[]> {
    const emotions = await TradeEmotion.find({
      userId,
      timestamp: { $gte: startDate, $lte: endDate },
    }).lean();
    return buildTimeOfDayHeatmap(emotions);
  },

  /**
   * Get session distribution
   */
  async getSessionDistribution(userId: string, startDate: Date, endDate: Date): Promise<Record<string, number>> {
    const emotions = await TradeEmotion.find({
      userId,
      timestamp: { $gte: startDate, $lte: endDate },
    }).lean();
    return calculateSessionDistribution(emotions);
  },

  /**
   * Get emotion stats for a specific trade (for UI)
   */
  async getEmotionForTrade(userId: string, tradeId: string): Promise<any | null> {
    return TradeEmotion.findOne({ userId, tradeId }).lean();
  },

  /**
   * Create or update emotion for a trade
   */
  async upsertEmotion(data: {
    userId: string;
    tradeId: string;
    tradeType: "market" | "pending" | "ai-auto";
    emotionTag: string;
    notes?: string;
    timestamp: Date;
    pnl: number;
    symbol: string;
    timeframe: string;
    session: "ASIA" | "LONDON" | "NEW_YORK" | "OVERLAP";
    rMultiple?: number;
    holdDurationMinutes?: number;
    marketContext?: any;
  }): Promise<any> {
    // Invalidate cache for this user
    for (const key of analysisCache.keys()) {
      if (key.startsWith(`${data.userId}:`)) {
        analysisCache.delete(key);
      }
    }

    return TradeEmotion.findOneAndUpdate(
      { userId: data.userId, tradeId: data.tradeId },
      {
        ...data,
        timestamp: data.timestamp,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  },

  /**
   * Delete emotion for a trade
   */
  async deleteEmotion(userId: string, tradeId: string): Promise<boolean> {
    // Invalidate cache
    for (const key of analysisCache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        analysisCache.delete(key);
      }
    }

    const result = await TradeEmotion.deleteOne({ userId, tradeId });
    return result.deletedCount > 0;
  },

  /**
   * Get list of emotions for a period (paginated)
   */
  async getEmotionsPaginated(
    userId: string,
    startDate: Date,
    endDate: Date,
    page: number = 1,
    limit: number = 50
  ): Promise<{ data: any[]; total: number; page: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      TradeEmotion.find({ userId, timestamp: { $gte: startDate, $lte: endDate } })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      TradeEmotion.countDocuments({ userId, timestamp: { $gte: startDate, $lte: endDate } }),
    ]);

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  },

  /**
     * Get basic trading context for chat endpoint (backward compat)
     */
    async getUserTradingContext(userId: string) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const trades = await Trade.find({
        userId,
        createdAt: { $gte: thirtyDaysAgo },
      }).sort({ createdAt: -1 }).lean();

      const evaluatedTrades = trades.length;
      const wins = trades.filter((t: any) => t.pnl > 0).length;
      const losses = trades.filter((t: any) => t.pnl < 0).length;
      const breakevens = trades.filter((t: any) => t.pnl === 0).length;
      const totalPnL = trades.reduce((sum: number, t: any) => sum + (t.pnl || 0), 0);
      const emotionalSum = trades.reduce((sum: number, t: any) => sum + (t.emotionalState || 0), 0);
      const avgEmotional = evaluatedTrades > 0 ? (emotionalSum / evaluatedTrades).toFixed(1) : "Tidak dicatat";

      // Get active account
      const { TradingAccount } = await import("../models/TradingAccount");
      const activeAccount = await TradingAccount.findOne({ userId, isActive: true }).lean();

      // Get playbooks
      const { Playbook } = await import("../models/Playbook");
      const playbooks = await Playbook.find({ userId }).select("name methodology marketCondition rules stats").lean();

      return {
        account: activeAccount
          ? {
              name: activeAccount.name,
              balance: activeAccount.balance,
              currency: activeAccount.currency,
              riskTier: activeAccount.riskTier,
            }
          : null,
        performanceSummary: {
          evaluatedTradesCount: evaluatedTrades,
          winRate: evaluatedTrades > 0 ? ((wins / evaluatedTrades) * 100).toFixed(1) + "%" : "0%",
          accumulatedPnL: totalPnL.toFixed(2),
          averageEmotionalRating: avgEmotional,
        },
        playbooks: playbooks.map((p: any) => ({
          name: p.name,
          methodology: p.methodology,
          marketCondition: p.marketCondition,
          rulesCount: p.rules?.length || 0,
          stats: p.stats,
        })),
        recentTrades: trades.slice(0, 10).map((t: any) => ({
          id: t._id.toString(),
          pair: t.pair,
          direction: t.direction,
          result: t.result,
          pnl: t.pnl,
          rMultiple: t.rMultiple,
          session: t.session,
          emotionalState: t.emotionalState,
          notes: t.notes,
          createdAt: t.createdAt,
        })),
      };
    },

  /**
   * Chat with AI Coach - conversational endpoint
   */
  async chatWithAI(userId: string, message: string, history: Array<{role: string, content: string}> = []): Promise<string> {
    const tradingContext = await this.getUserTradingContext(userId);

    const contextStr = JSON.stringify(tradingContext, null, 2);
    const historyStr = history.length > 0
      ? history.map(h => `${h.role}: ${h.content}`).join("\n")
      : "Belum ada riwayat obrolan.";

    const prompt = `Anda adalah AI Trading Coach untuk platform Hunter Trades Journal.
Berbicaralah dalam Bahasa Indonesia yang natural, profesional, dan suportif.

KONTEKS TRADING USER (30 hari terakhir):
${contextStr}

RIWAYAT OBROLAN:
${historyStr}

PESAN USER SAAT INI:
${message}

TUGAS ANDA:
- Jawab pertanyaan user berdasarkan konteks trading mereka
- Berikan analisis, saran, atau perhitungan yang relevan (misal: RR, position sizing, risk management)
- Jika user meminta perhitungan (seperti RR/R-multiple), hitung berdasarkan data trade mereka
- Gunakan data aktual dari konteks (jangan mengarang angka)
- Jika data tidak cukup, minta info tambahan dengan sopan
- Tetap dalam karakter AI Trading Coach yang empatik dan berbasis data`;

    const baseUrl = env.NINE_ROUTER_URL || "http://localhost:20128/v1";
    const apiKey = env.NINE_ROUTER_API_KEY || "sk-dummy";
    const model = "gemini/gemini-3.5-flash-lite";

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: "Anda adalah AI Trading Coach yang membantu trader menganalisis performa dan psikologi trading mereka. Selalu jawab dalam Bahasa Indonesia.",
            },
            ...history.map(h => ({ role: h.role, content: h.content })),
            { role: "user", content: prompt },
          ],
          max_tokens: 2000,
          temperature: 0.7,
          stream: false,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`9Router error ${response.status}: ${errorText}`);
      }

      const data: any = await response.json();
      const reply = data.choices?.[0]?.message?.content || "Maaf, saya tidak bisa memproses pesan Anda saat ini.";

      return reply;
    } catch (error) {
      clearTimeout(timeout);
      silentLogger.error(`[AI-COACH] Chat LLM call failed: ${error}`);
      throw error;
    }
  },

  EMOTION_TAGS,
    EMOTION_COLORS,
    getSessionFromDate,
  };
