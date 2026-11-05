// ─── AI Coach Service (Frontend) ────────────────────────────────────
// API calls untuk Trade Emotion & Psychology Journal

const API_BASE = "/api/v1/ai-coach";

export type EmotionTag =
  | "FOMO"
  | "REVENGE"
  | "GREEDY"
  | "FEAR"
  | "CONFIDENT"
  | "CALM"
  | "HESITANT";

export type TradeType = "market" | "pending" | "ai-auto";

export type TradingSession = "ASIA" | "LONDON" | "NEW_YORK" | "OVERLAP";

export interface TradeEmotion {
  _id?: string;
  userId: string;
  tradeId: string;
  tradeType: TradeType;
  emotionTag: EmotionTag;
  notes?: string;
  timestamp: string;
  pnl: number;
  symbol: string;
  timeframe: string;
  session: TradingSession;
  rMultiple?: number;
  holdDurationMinutes?: number;
  marketContext?: {
    spread?: number;
    volatility?: number;
    trend?: string;
    support?: number[];
    resistance?: number[];
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface EmotionDistribution {
  tag: string;
  count: number;
  totalPnL: number;
  winRate: number;
  avgRMultiple: number;
}

export interface TimeOfDayHeatmap {
  hour: number;
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

export interface PaginatedEmotions {
  data: TradeEmotion[];
  total: number;
  page: number;
  totalPages: number;
}

export interface SessionDistribution {
  [key: string]: number;
}

// Emotion tag metadata
export const EMOTION_TAGS: { tag: EmotionTag; label: string; icon: string; color: string }[] = [
  { tag: "FOMO", label: "FOMO", icon: "🔥", color: "#FF9F1C" },
  { tag: "REVENGE", label: "Revenge", icon: "😤", color: "#FF3333" },
  { tag: "GREEDY", label: "Greedy", icon: "💰", color: "#FFD60A" },
  { tag: "FEAR", label: "Fear", icon: "😰", color: "#3399FF" },
  { tag: "CONFIDENT", label: "Confident", icon: "💪", color: "#2ECC71" },
  { tag: "CALM", label: "Calm", icon: "🧘", color: "#00CEC9" },
  { tag: "HESITANT", label: "Hesitant", icon: "🤔", color: "#95A5A6" },
];

export const EMOTION_COLORS: Record<EmotionTag, string> = {
  FOMO: "#FF9F1C",
  REVENGE: "#FF3333",
  GREEDY: "#FFD60A",
  FEAR: "#3399FF",
  CONFIDENT: "#2ECC71",
  CALM: "#00CEC9",
  HESITANT: "#95A5A6",
};

function formatDateRange(period: "week" | "month", startDate?: string, endDate?: string) {
  const params = new URLSearchParams();
  params.append("period", period);
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);
  return params.toString();
}

export const aiCoachService = {
  /**
   * Main analysis - generates AI coaching feedback
   */
  async analyze(
    period: "week" | "month" = "week",
    startDate?: string,
    endDate?: string
  ): Promise<{ success: boolean; data?: AIAnalysisResult; error?: string }> {
    try {
      const body: any = { period };
      if (startDate) body.startDate = startDate;
      if (endDate) body.endDate = endDate;

      const res = await fetch(`${API_BASE}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        return { success: true, data: json.data };
      }
      return { success: false, error: json.message || json.error || "Analisis gagal" };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error" };
    }
  },

  /**
   * Get emotion distribution for charts
   */
  async getEmotionDistribution(
    period: "week" | "month" = "week",
    startDate?: string,
    endDate?: string
  ): Promise<{ success: boolean; data?: EmotionDistribution[]; error?: string }> {
    try {
      const qs = formatDateRange(period, startDate, endDate);
      const res = await fetch(`${API_BASE}/emotion-distribution?${qs}`, {
        credentials: "include",
      });
      const json = await res.json();
      if (res.ok && json.success) {
        return { success: true, data: json.data };
      }
      return { success: false, error: json.message || "Gagal mengambil distribusi emosi" };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Get time-of-day heatmap
   */
  async getTimeOfDayHeatmap(
    period: "week" | "month" = "week",
    startDate?: string,
    endDate?: string
  ): Promise<{ success: boolean; data?: TimeOfDayHeatmap[]; error?: string }> {
    try {
      const qs = formatDateRange(period, startDate, endDate);
      const res = await fetch(`${API_BASE}/heatmap?${qs}`, {
        credentials: "include",
      });
      const json = await res.json();
      if (res.ok && json.success) {
        return { success: true, data: json.data };
      }
      return { success: false, error: json.message || "Gagal mengambil heatmap" };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Get session distribution
   */
  async getSessionDistribution(
    period: "week" | "month" = "week",
    startDate?: string,
    endDate?: string
  ): Promise<{ success: boolean; data?: SessionDistribution; error?: string }> {
    try {
      const qs = formatDateRange(period, startDate, endDate);
      const res = await fetch(`${API_BASE}/session-distribution?${qs}`, {
        credentials: "include",
      });
      const json = await res.json();
      if (res.ok && json.success) {
        return { success: true, data: json.data };
      }
      return { success: false, error: json.message || "Gagal mengambil distribusi sesi" };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Create or update emotion for a trade
   */
  async upsertEmotion(data: {
    tradeId: string;
    tradeType: TradeType;
    emotionTag: EmotionTag;
    notes?: string;
    timestamp: string;
    pnl: number;
    symbol: string;
    timeframe: string;
    session: TradingSession;
    rMultiple?: number;
    holdDurationMinutes?: number;
    marketContext?: any;
  }): Promise<{ success: boolean; data?: TradeEmotion; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/emotion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        return { success: true, data: json.data };
      }
      return { success: false, error: json.message || "Gagal menyimpan emosi" };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Delete emotion for a trade
   */
  async deleteEmotion(tradeId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/emotion/${tradeId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json();
      if (res.ok && json.success) {
        return { success: true };
      }
      return { success: false, error: json.message || "Gagal menghapus emosi" };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Get paginated list of emotions
   */
  async getEmotionsPaginated(
    period: "week" | "month" = "week",
    page: number = 1,
    limit: number = 50,
    startDate?: string,
    endDate?: string
  ): Promise<{ success: boolean; data?: PaginatedEmotions; error?: string }> {
    try {
      let qs = formatDateRange(period, startDate, endDate);
      qs += `&page=${page}&limit=${limit}`;
      const res = await fetch(`${API_BASE}/emotions?${qs}`, {
        credentials: "include",
      });
      const json = await res.json();
      if (res.ok && json.success) {
        return { success: true, data: json.data };
      }
      return { success: false, error: json.message || "Gagal mengambil data emosi" };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Get emotion for a specific trade
   */
  async getEmotionForTrade(tradeId: string): Promise<{ success: boolean; data?: TradeEmotion; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/emotion/${tradeId}`, {
        credentials: "include",
      });
      const json = await res.json();
      if (res.ok && json.success) {
        return { success: true, data: json.data };
      }
      if (res.status === 404) {
        return { success: true, data: undefined }; // No emotion recorded yet
      }
      return { success: false, error: json.message || "Gagal mengambil data emosi" };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};