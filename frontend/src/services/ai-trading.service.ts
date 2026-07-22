import { apiClient } from "@/lib/api-client";

// ─── Types ───────────────────────────────────────────────────────────

export interface MT5ConnectPayload {
  server: string;
  login: string;
  password: string;
}

export interface ACCOUNTInfo {
  login: number;
  server: string;
  currency: string;
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  leverage: number;
  profit: number;
  name: string;

  // Risk metrics (from riskManagerService)
  dailyPnL: number;
  monthlyPnL: number;
  dailyDrawdown: number;
  openRisk: number;
  openPositions: number;
  weeklyPnL: number;
  winRate: number;
}

export interface Position {
  ticket: number;
  symbol: string;
  type: "BUY" | "SELL";
  volume: number;
  priceOpen: number;
  priceCurrent: number;
  sl: number;
  tp: number;
  profit: number;
  swap: number;
  commission: number;
  comment: string;
  time: number;
  magic: number;
}

export interface SymbolInfo {
  name: string;
  description: string;
  bid: number;
  ask: number;
  spread: number;
  point: number;
  digits: number;
  tradeContractSize: number;
  volumeMin: number;
  volumeMax: number;
  volumeStep: number;
  visible: boolean;
}

export interface Rate {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PipelineConfig {
  symbols: string[];
  timeframe: "M5" | "M15" | "H1";
  strategy: string;
  maxOpenPositions: number;
  maxRiskPerTrade: number;
  maxDailyRisk: number;
  tradingHours?: { start: string; end: string };
  trailingStop: {
    enabled: boolean;
    activationATR: number;
    trailATR: number;
    breakEven: boolean;
  };
  entrySettings: {
    atrMultiplierSL: number;
    atrMultiplierTP: number;
    rsiOversold: number;
    rsiOverbought: number;
  };
  methodologyWeights?: MethodologyWeights;
  activeMethodologies?: MethodologyName[];
  // NEW: LLM Consensus config
  llmConsensus?: {
    enabled: boolean;
    minProviders?: number;
    threshold?: number;
    providerTimeoutMs?: number;
  };
  smartRisk?: {
    enabled: boolean;
    capitalPreservation?: {
      enabled: boolean;
      activationGrowthPct: number;
      riskReductionMultiplier: number;
    };
    dailyLimits?: {
      enabled: boolean;
      profitTargetPct: number;
      lossLimitPct: number;
    };
    drawdownRecovery?: {
      enabled: boolean;
      activationDrawdownPct: number;
      riskReductionMultiplier: number;
    };
  };
}

export interface LLMConsensusVote {
  provider: string;
  modelLabel: string;
  verdict: "GOOD" | "BAD" | "SKIP";
  reasoning: string;
  latencyMs: number;
  error?: string;
}

export interface LLMConsensusResult {
  verdict: "GOOD" | "BAD" | "SKIP";
  votes: LLMConsensusVote[];
  totalVotes: number;
  goodVotes: number;
  badVotes: number;
  skipVotes: number;
  consensusReached: boolean;
  details: string;
}

export interface PipelineStatus {
  running: boolean;
  paused: boolean;
  startedAt: string | null;
  config: PipelineConfig | null;
  metrics: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    totalPnL: number;
    dailyPnL: number;
    openPositions: number;
    currentDrawdown: number;
    smartRisk?: {
      currentDrawdownPct: number;
      currentGrowthPct: number;
      currentRiskMultiplier: number;
      dailyTradingBlocked: boolean;
    };
  };
  lastSignal: TradingSignal | null;
  lastAnalysis: MultiStrategyAnalysis | null;
  lastError: string | null;
}

export interface TradingSignal {
  symbol: string;
  direction: "BUY" | "SELL";
  confidence: number;
  entry: number;
  sl: number;
  tp: number;
  reason: string;
  riskPercent: number;
  timeframe: string;
  indicators: { rsi: number; atr: number };
  pattern: string;
}

export interface AnalysisResult {
  symbol: string;
  signal: {
    rsi: number;
    atr: number;
    pattern: "BULLISH_ENGULFING" | "BEARISH_ENGULFING" | "NONE";
    currentPrice: number;
    signal: TradingSignal | null;
  };
  symbolInfo: SymbolInfo | null;
}

export interface OrderResult {
  success: boolean;
  ticket?: number;
  price?: number;
  error?: string;
}

export interface PipelineLog {
  time: string;
  type: "INFO" | "SIGNAL" | "TRADE" | "ERROR" | "TRAILING" | "CONFLUENCE";
  message: string;
  data?: any;
}

// ─── NEW: Methodology Types ──────────────────────────────────────────

export type MethodologyName = "smc" | "ict" | "msnr";

export interface MethodologyWeights {
  smc: number;
  ict: number;
  msnr: number;

}

export interface MethodologySignalResult {
  methodology?: MethodologyName;
  direction: "BUY" | "SELL";
  confidence: number;
  entry: number;
  sl: number;
  tp: number;
  signalType?: string;
  reason: string;
}

export interface MethodologyBreakdown {
  [key: string]: {
    confidence: number;
    weight: number;
    contribution: number;
    direction?: string;
  };
}

export interface ConfluenceResult {
  finalSignal: {
    direction: "BUY" | "SELL";
    entry: number;
    sl: number;
    tp: number;
    confidence: number;
    confluenceScore: number;
    primaryMethodology: MethodologyName;
    methodologyBreakdown: MethodologyBreakdown;
    agreeingSignals: MethodologySignalResult[];
    totalAgreeing: number;
  } | null;
  allSignals: MethodologySignalResult[];
  methodologyBreakdown: MethodologyBreakdown;
  conflictDetected: boolean;
  reason: string;
}

export interface MarketStructureSummary {
  trend: { direction: "BULL" | "BEAR" | "SIDEWAYS"; strength: number };
  recentPriceAction: "RANGING" | "EXPANSION_BULL" | "EXPANSION_BEAR" | "CONTRACTION";
  orderBlocksCount: number;
  fvgCount: number;
  keyLevelsCount: number;
  liquidityZonesCount: number;
}

export interface MultiStrategyAnalysis {
  symbol: string;
  marketStructure: MarketStructureSummary;
  methodologySignals: {
    smc: MethodologySignalResult | null;
    ict: MethodologySignalResult | null;
    msnr: MethodologySignalResult | null;
    crt: MethodologySignalResult | null;
  };
  confluence: ConfluenceResult;
}

// ─── Methodology Display Config ──────────────────────────────────────

export const METHODOLOGY_LABELS: Record<MethodologyName, string> = {
  smc: "Smart Money Concept",
  ict: "Inner Circle Trader",
  msnr: "Malaysian S&R",

};

export const METHODOLOGY_COLORS: Record<MethodologyName, string> = {
  smc: "#8B5CF6",      // violet
  ict: "#3B82F6",      // blue
  msnr: "#10B981",     // emerald

};

export const DEFAULT_METHODOLOGY_WEIGHTS: MethodologyWeights = {
  smc: 1.0,
  ict: 1.0,
  msnr: 0.8,

};

// ─── Service ─────────────────────────────────────────────────────────

class AITradingService {
  // ── Connection ─────────────────────────────────────────────────────
  async connect(payload: MT5ConnectPayload) {
    const res = await apiClient.post<{
      connected: boolean;
      accountInfo: ACCOUNTInfo;
    }>("/api/v1/ai-trading/connect", payload);
    return res;
  }

  async disconnect() {
    const res = await apiClient.post<{ connected: boolean }>(
      "/api/v1/ai-trading/disconnect",
      {},
    );
    return res;
  }

  async getStatus() {
    const res = await apiClient.get<{
      connected: boolean;
      accountInfo: ACCOUNTInfo | null;
      pipeline: PipelineStatus;
    }>("/api/v1/ai-trading/status");
    return res;
  }

  // ── Account ────────────────────────────────────────────────────────
  async getAccountInfo() {
    const res = await apiClient.get<ACCOUNTInfo>(
      "/api/v1/ai-trading/account",
    );
    return res;
  }

  // ── Market Data ────────────────────────────────────────────────────
  async getSymbols(group?: string) {
    const query = group ? `?group=${encodeURIComponent(group)}` : "";
    const res = await apiClient.get<{ symbols: SymbolInfo[] }>(
      `/api/v1/ai-trading/symbols${query}`,
    );
    return res;
  }

  async getRates(symbol: string, timeframe?: string, count?: number) {
    const params = new URLSearchParams({ symbol });
    if (timeframe) params.set("timeframe", timeframe);
    if (count) params.set("count", String(count));
    const res = await apiClient.get<{ rates: Rate[] }>(
      `/api/v1/ai-trading/rates?${params}`,
    );
    return res;
  }

  // ── Positions ──────────────────────────────────────────────────────
  async getPositions() {
    const res = await apiClient.get<{ positions: Position[]; orders?: any[]; total: number }>(
      "/api/v1/ai-trading/positions",
    );
    return res;
  }

  async openOrder(params: {
    symbol: string;
    type: "BUY" | "SELL";
    volume: number;
    sl?: number;
    tp?: number;
    comment?: string;
  }) {
    const res = await apiClient.post<OrderResult>(
      "/api/v1/ai-trading/open",
      params,
    );
    return res;
  }

  async closeOrder(ticket: number) {
    const res = await apiClient.post<{ success: boolean }>(
      "/api/v1/ai-trading/close",
      { ticket },
    );
    return res;
  }

  async modifyOrder(ticket: number, sl?: number, tp?: number) {
    const res = await apiClient.post<{ success: boolean }>(
      "/api/v1/ai-trading/modify",
      { ticket, sl, tp },
    );
    return res;
  }

  // ── AI Analysis ────────────────────────────────────────────────────
  async analyze(symbol: string, timeframe: string) {
    const res = await apiClient.post<AnalysisResult>(
      "/api/v1/ai-trading/analyze",
      { symbol, timeframe },
    );
    return res;
  }

  /** NEW: Multi-methodology analysis */
  async analyzeMulti(params: {
    symbol: string;
    timeframe?: string;
    riskPercent?: number;
    methodologyWeights?: MethodologyWeights;
    activeMethodologies?: MethodologyName[];
  }) {
    const res = await apiClient.post<MultiStrategyAnalysis>(
      "/api/v1/ai-trading/analyze-multi",
      params,
    );
    return res;
  }

  // ── Pipeline ───────────────────────────────────────────────────────
  async startPipeline(config: PipelineConfig) {
    const res = await apiClient.post<{ running: boolean; config: any }>(
      "/api/v1/ai-trading/pipeline/start",
      config,
    );
    return res;
  }

  async stopPipeline() {
    const res = await apiClient.post<{ running: boolean }>(
      "/api/v1/ai-trading/pipeline/stop",
      {},
    );
    return res;
  }

  async pausePipeline() {
    const res = await apiClient.post<{ paused: boolean }>(
      "/api/v1/ai-trading/pipeline/pause",
      {},
    );
    return res;
  }

  async resumePipeline() {
    const res = await apiClient.post<{ paused: boolean }>(
      "/api/v1/ai-trading/pipeline/resume",
      {},
    );
    return res;
  }

  async getPipelineStatus() {
    const res = await apiClient.get<PipelineStatus>(
      "/api/v1/ai-trading/pipeline/status",
    );
    return res;
  }

  async getPipelineLogs(limit = 100) {
    const res = await apiClient.get<{ logs: PipelineLog[] }>(
      `/api/v1/ai-trading/pipeline/logs?limit=${limit}`,
    );
    return res;
  }

  /** Combined endpoint: status + logs in one request */
  async getPipelineStatusWithLogs(limit = 100) {
    const res = await apiClient.get<{
      status: PipelineStatus;
      logs: PipelineLog[];
    }>(`/api/v1/ai-trading/pipeline/status-with-logs?limit=${limit}`);
    return res;
  }

  // ── Performance ──────────────────────────────────────────────────
  async getPerformance() {
    const res = await apiClient.get<PipelinePerformance>(
      "/api/v1/ai-trading/performance",
    );
    return res;
  }

  // ── Auto Backtest & Skill ──────────────────────────────────────────
  async autoBacktest() {
    const res = await apiClient.post<AutoBacktestSummary>(
      "/api/v1/ai-trading/auto-backtest",
      {},
    );
    return res;
  }

  async getSkill(server?: string) {
    const query = server ? `?server=${encodeURIComponent(server)}` : "";
    const res = await apiClient.get<AIBacktestSkill>(
      `/api/v1/ai-trading/skill${query}`,
    );
    return res;
  }

  async getLlmStatus() {
    const res = await apiClient.get<Array<{
      name: string;
      label: string;
      model: string;
      status: "active" | "hibernasi";
    }>>("/api/v1/ai-trading/llm-status");
    return res;
  }

  async getCorrelation() {
    const res = await apiClient.get<{
      source: string;
      correlations: Record<string, Record<string, number>>;
    }>("/api/v1/ai-trading/correlation");
    return res;
  }

  // ── AI Trading Settings ────────────────────────────────────────────
  async getAiTradingSettings() {
    const res = await apiClient.get<{
      methodologyWeights: MethodologyWeights;
      activeMethodologies: MethodologyName[];
      llmConsensus: {
        enabled: boolean;
        minProviders: number;
        threshold: number;
        providerTimeoutMs: number;
      };
      savedPipelineConfig?: PipelineConfig;
      lastAutoBacktestAt?: string;
    }>("/api/v1/settings/ai-trading");
    return res;
  }

  async updateAiTradingSettings(params: {
    methodologyWeights?: MethodologyWeights;
    activeMethodologies?: MethodologyName[];
    llmConsensus?: {
      enabled?: boolean;
      minProviders?: number;
      threshold?: number;
      providerTimeoutMs?: number;
    };
  }) {
    const res = await apiClient.patch<{
      methodologyWeights: MethodologyWeights;
      activeMethodologies: MethodologyName[];
      llmConsensus: {
        enabled: boolean;
        minProviders: number;
        threshold: number;
        providerTimeoutMs: number;
      };
    }>("/api/v1/settings/ai-trading", params);
    return res;
  }
}

export interface AutoBacktestSummary {
  status: "running" | "complete" | "error";
  totalSymbols: number;
  processedSymbols: number;
  qualifiedSymbols: number;
  results: Array<{
    symbol: string;
    totalTrades: number;
    winRate: number;
    totalPnL: number;
    totalPnLPercent: number;
    profitFactor: number;
    recoveryFactor: number;
    score: number;
    qualified: boolean;
    reason?: string;
  }>;
  topPairs: Array<{ symbol: string; score: number; totalPnL: number }>;
  error?: string;
}

export interface AIBacktestSkill {
  totalBacktests: number;
  symbolRankings: Array<{
    symbol: string;
    score: number;
    totalBacktests: number;
    avgWinRate: number;
    avgProfitFactor: number;
    avgRecoveryFactor: number;
    totalPnL: number;
    totalTrades: number;
    bestMethodology: string;
    recommendedParams: {
      rsiOversold: number;
      rsiOverbought: number;
      atrMultiplierSL: number;
      atrMultiplierTP: number;
      signalInterval: number;
    };
    lastTested: string;
  }>;
  methodologyRankings: Array<{
    methodology: string;
    totalTrades: number;
    totalPnL: number;
    avgWinRate: number;
    bestSymbol: string;
    verdict: "KEEP" | "ADJUST" | "DISABLE";
  }>;
  globalRecoveryFactor: number;
}

export interface PipelinePerformance {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalPnL: number;
  winRate: number;
  methodologyStats: Array<{
    methodology: string;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    totalPnL: number;
    winRate: number;
    avgConfidence: number;
  }>;
  symbolStats: Array<{
    symbol: string;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    totalPnL: number;
    winRate: number;
  }>;
  equityCurve: Array<{ time: string; equity: number }>;
}

export const aiTradingService = new AITradingService();
