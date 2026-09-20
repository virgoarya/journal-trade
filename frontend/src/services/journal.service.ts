import { apiClient } from "@/lib/api-client";

export interface EmotionPattern {
  emotionTag: string;
  count: number;
  winRate: number;
  avgR: number;
  totalPnL: number;
}

export interface TimePattern {
  hour: number;
  symbol: string;
  count: number;
  winRate: number;
  avgR: number;
}

export interface MethodologyDelta {
  methodology: string;
  backtestWR: number;
  realWR: number;
  delta: number;
  recommendation: string;
}

export interface LLMInsight {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  actionItems: Array<{
    priority: "high" | "medium" | "low";
    action: string;
    reason: string;
  }>;
}

export interface PatternData {
  emotionPatterns: EmotionPattern[];
  timePatterns: TimePattern[];
  methodologyDelta: MethodologyDelta[];
  llmInsights: LLMInsight;
}

class JournalService {
  async getPatterns(period: "week" | "month" = "month"): Promise<{ success: boolean; data: PatternData | null; error?: string }> {
    try {
      const response = await apiClient.get(`/analytics/patterns?period=${period}`);
      return response.data as { success: boolean; data: PatternData | null; error?: string };
    } catch (error: any) {
      console.error("[JournalService] getPatterns error:", error);
      return { success: false, data: null, error: error.message || "Failed to fetch patterns" };
    }
  }
}

export const journalService = new JournalService();