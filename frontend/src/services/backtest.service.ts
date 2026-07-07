import { apiClient } from "@/lib/api-client";

// ─── SSE Stream Event Types ──────────────────────────────────────────

export interface StreamProgress {
  currentCandle: number;
  totalCandles: number;
  percent: number;
}

export interface StreamCandle {
  time: number;
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  rsi: number;
  atr: number;
  pattern: string;
  equity: number;
  floatingPnL: number;
  marginLevel: number;
}

export interface StreamTradeOpen {
  time: number;
  direction: string;
  entryPrice: number;
  sl: number;
  tp: number;
  volume: number;
  confidence: number;
  rsi: number;
  pattern: string;
}

export interface StreamTradeClose {
  entryTime: number;
  exitTime: number;
  direction: string;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  pnlPercent: number;
  reason: string;
  confidence: number;
}

export type SSEEvent =
  | { type: "progress"; data: StreamProgress }
  | { type: "candle"; data: StreamCandle }
  | { type: "trade_open"; data: StreamTradeOpen }
  | { type: "trade_close"; data: StreamTradeClose }
  | { type: "complete"; data: BacktestResult }
  | { type: "error"; data: { message: string } };

// ─── Types ───────────────────────────────────────────────────────────

export interface BacktestConfig {
  symbols: string[];
  timeframe: "M5" | "M15" | "H1" | "H4" | "D1";
  fromDate: string;
  toDate: string;
  initialBalance: number;
  entrySettings: {
    rsiOversold: number;
    rsiOverbought: number;
    atrMultiplierSL: number;
    atrMultiplierTP: number;
  };
  trailingStop: {
    enabled: boolean;
    activationATR: number;
    trailATR: number;
    breakEven: boolean;
  };
  maxRiskPerTrade: number;
  maxOpenPositions: number;
  leverage: number;
  signalInterval: number;
  speedMs?: number;
  activeMethodologies?: string[];
}
export interface BacktestTrade {
  entryTime: number;
  exitTime: number;
  symbol: string;
  direction: "BUY" | "SELL";
  entryPrice: number;
  exitPrice: number;
  sl: number;
  tp: number;
  volume: number;
  pnl: number;
  pnlPercent: number;
  closeReason: "TP_HIT" | "SL_HIT" | "SIGNAL_REVERSE" | "TIMEOUT";
  rsiAtEntry: number;
  atrAtEntry: number;
  pattern: string;
  confidence: number;
}

export interface BacktestResult {
  backtestId?: string;
  symbols: string[];
  timeframe: string;
  fromDate: string;
  toDate: string;
  totalCandles: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  totalPnLPercent: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  profitFactor: number;
  recoveryFactor: number;
  sharpeRatio: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  equityCurve: Array<{ time: number; equity: number }>;
  trades: BacktestTrade[];
  symbolStats?: Array<{
    symbol: string;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    breakEvenTrades: number;
    totalPnL: number;
    winRate: number;
  }>;
  methodologyStats?: Array<{
    methodology: string;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    totalPnL: number;
    winRate: number;
    avgConfidence: number;
  }>;
}

export interface BacktestAnalysis {
  summary: string;
  lessonsLearned: string[];
  strengths: string[];
  weaknesses: string[];
  recommendedParamChanges: Record<string, any>;
  overallGrade: "A" | "B" | "C" | "D" | "F";
  confidenceToApply: number;
  methodologyRecommendations?: Array<{
    methodology: string;
    verdict: "KEEP" | "ADJUST" | "DISABLE";
    reason: string;
  }>;
  symbolInsights?: Array<{
    symbol: string;
    verdict: "PROFITABLE" | "UNPROFITABLE" | "MIXED";
    totalTrades: number;
    totalPnL: number;
    suggestion: string;
  }>;
  recoveryFactorAnalysis?: string;
}

export interface OptimizationConfig {
  symbol: string;
  timeframe: string;
  fromDate: string;
  toDate: string;
  initialBalance: number;
  optimizationMetric: "profitFactor" | "winRate" | "sharpeRatio" | "totalPnLPercent";
  maxCombinations: number;
}

export interface OptimizationResult {
  config: OptimizationConfig;
  totalCombinationsTested: number;
  bestParams: {
    entrySettings: {
      rsiOversold: number;
      rsiOverbought: number;
      atrMultiplierSL: number;
      atrMultiplierTP: number;
    };
    trailingStop: {
      enabled: boolean;
      activationATR: number;
      trailATR: number;
    };
    maxRiskPerTrade: number;
    maxOpenPositions: number;
  };
  bestResult: {
    totalTrades: number;
    winRate: number;
    totalPnLPercent: number;
    profitFactor: number;
    maxDrawdownPercent: number;
    sharpeRatio: number;
  };
  allResults: Array<{
    params: Record<string, any>;
    metrics: Record<string, number>;
    grade: string;
  }>;
}

export interface BacktestHistoryItem {
  id: string;
  symbol: string;
  timeframe: string;
  dateRange: { from: string; to: string };
  result: {
    totalTrades: number;
    winRate: number;
    totalPnLPercent: number;
    profitFactor: number;
    maxDrawdownPercent: number;
  };
  hasAiAnalysis: boolean;
  createdAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Build an SSE stream URL from a BacktestConfig.
 * Encodes all config fields as query params for GET /api/v1/backtest/stream.
 */
export function buildStreamUrl(config: BacktestConfig): string {
  const p = new URLSearchParams();
  p.set("symbols", config.symbols.join(","));
  p.set("timeframe", config.timeframe);
  p.set("fromDate", config.fromDate);
  p.set("toDate", config.toDate);
  p.set("initialBalance", String(config.initialBalance));
  p.set("rsiOversold", String(config.entrySettings.rsiOversold));
  p.set("rsiOverbought", String(config.entrySettings.rsiOverbought));
  p.set("atrMultiplierSL", String(config.entrySettings.atrMultiplierSL));
  p.set("atrMultiplierTP", String(config.entrySettings.atrMultiplierTP));
  p.set("trailingEnabled", String(config.trailingStop.enabled));
  p.set("activationATR", String(config.trailingStop.activationATR));
  p.set("trailATR", String(config.trailingStop.trailATR));
  p.set("maxRiskPerTrade", String(config.maxRiskPerTrade));
  p.set("maxOpenPositions", String(config.maxOpenPositions));
  p.set("leverage", String(config.leverage));
  p.set("signalInterval", String(config.signalInterval));
  p.set("speedMs", String(config.speedMs ?? 0));
  if (config.activeMethodologies && config.activeMethodologies.length > 0) {
    p.set("activeMethodologies", config.activeMethodologies.join(","));
  }
  return `/api/v1/backtest/stream?${p.toString()}`;
}

// ─── Service ─────────────────────────────────────────────────────────

class BacktestService {
  async run(config: BacktestConfig) {
    const res = await apiClient.post<BacktestResult>(
      "/api/v1/backtest/run",
      config,
    );
    return res;
  }

  async analyze(backtestId: string) {
    const res = await apiClient.post<BacktestAnalysis>(
      "/api/v1/backtest/analyze",
      { backtestId },
    );
    return res;
  }

  async optimize(config: OptimizationConfig) {
    const res = await apiClient.post<OptimizationResult>(
      "/api/v1/backtest/optimize",
      config,
    );
    return res;
  }

  async applyToLivePipeline(backtestId: string) {
    const res = await apiClient.post<{ applied: boolean; changes: Record<string, any> }>(
      "/api/v1/backtest/apply",
      { backtestId },
    );
    return res;
  }

  async getHistory(limit = 20, skip = 0) {
    const res = await apiClient.get<{
      experiences: BacktestHistoryItem[];
      total: number;
    }>(`/api/v1/backtest/history?limit=${limit}&skip=${skip}`);
    return res;
  }

  async getById(id: string) {
    const res = await apiClient.get<BacktestResult>(
      `/api/v1/backtest/${id}`,
    );
    return res;
  }

  async delete(id: string) {
    const res = await apiClient.delete<{ deleted: boolean }>(
      `/api/v1/backtest/${id}`,
    );
    return res;
  }
}

export const backtestService = new BacktestService();
