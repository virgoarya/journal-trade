import { apiClient, ApiResponse } from "@/lib/api-client";

export interface MonthlyPnL {
  month: string;
  pnl: number;
  wins: number;
  losses: number;
}

export interface WeeklyStats {
  day: string;
  avgPnl: number;
  trades: number;
}

export interface SessionPerformance {
  session: string;
  pnl: number;
  trades: number;
}

export interface StreakStats {
  longestWin: number;
  longestLoss: number;
  currentStreak: {
    type: "win" | "loss";
    count: number;
  };
  avgConsecutiveWins: number;
  avgConsecutiveLosses: number;
}

export interface AnalyticsData {
  monthlyPnL: MonthlyPnL[];
  weeklyStats: WeeklyStats[];
  sessionPerformance: SessionPerformance[];
  heatmap: Array<{
    day: string;
    sessions: Array<{
      name: string;
      pnl: number;
      count: number;
    }>;
  }>;
  streakStats: StreakStats;
  totalPnL: number;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  bestPerformingPairs: Array<{ pair: string; pnl: number; winRate: number }>;
  riskMetrics: {
    sharpeRatio: number;
    maxDrawdown: number;
    avgRR: number;
    expectancy: number;
    avgWin: number;
    avgLoss: number;
  };
  tradingBehaviour: {
    avgTradeDuration: string;
    avgPnlPerTrade: number;
    tradesPerDay: number;
    planAdherence: number;
  };
  assetDistribution: Array<{
    asset: string;
    count: number;
    percentage: number;
  }>;
}

export interface EquityPoint {
  date: string;
  equity: number;
}

export interface EquityCurveData {
  points: EquityPoint[];
  highWaterMark: number;
  maxDrawdown: { value: number; date: string };
}

export class AnalyticsService {
  private basePath = "/api/v1/analytics";

  async getOverview(timeRange?: string): Promise<ApiResponse<AnalyticsData>> {
    const params = timeRange ? `?timeRange=${timeRange}` : "";
    return apiClient.get<AnalyticsData>(`${this.basePath}/overview${params}`);
  }

  async getEquityCurve(): Promise<ApiResponse<EquityCurveData>> {
    return apiClient.get<EquityCurveData>(`${this.basePath}/equity-curve`);
  }

  async getMonthlyPnL(): Promise<ApiResponse<MonthlyPnL[]>> {
    return apiClient.get<MonthlyPnL[]>(`${this.basePath}/monthly-pnl`);
  }

  async getWeeklyPattern(): Promise<ApiResponse<WeeklyStats[]>> {
    return apiClient.get<WeeklyStats[]>(`${this.basePath}/weekly`);
  }

  async getSessionPerformance(): Promise<ApiResponse<SessionPerformance[]>> {
    return apiClient.get<SessionPerformance[]>(`${this.basePath}/sessions`);
  }

  async getStreakStats(): Promise<ApiResponse<StreakStats>> {
    return apiClient.get<StreakStats>(`${this.basePath}/streaks`);
  }

  async getHeatmapData(days: number = 30): Promise<ApiResponse<Array<{ day: number; intensity: number }>>> {
    return apiClient.get<Array<{ day: number; intensity: number }>>(`${this.basePath}/heatmap?days=${days}`);
  }
}

export const analyticsService = new AnalyticsService();
