import { mt5McpService, CircuitBreaker } from "./mt5-mcp.service";
import { aiTradingEngine, type TradingSignal, type Timeframe, type MultiStrategySymbolAnalysis, type Candle } from "./ai-trading-engine.service";
import { riskManagerService } from "./risk-manager.service";
import { llmConsensusService, type LLMConsensusConfig, type LLMConsensusResult } from "./llm-consensus.service";
import { marketRegimeService } from "./market-regime.service";

import { tradeExitStrategyService } from "./trade-exit-strategy.service";
import { AITradingSession } from "../models/AITradingSession";
import { AITradeLog } from "../models/AITradeLog";
import { silentLogger } from "../utils/silent-logger";
import type { MethodologyWeights, MethodologyName } from "./strategies/index";
import { DEFAULT_METHODOLOGY_WEIGHTS } from "./strategies/index";



// ─── Types ───────────────────────────────────────────────────────────

export interface PipelineConfig {
  symbols: string[];
  timeframe: Timeframe;
  strategy: string;
  maxOpenPositions: number;
  maxRiskPerTrade: number;
  maxDailyRisk: number;
  tradingHours?: {
    start: string; // "HH:mm"
    end: string;
  };
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
  // NEW: Multi-methodology settings
  methodologyWeights?: MethodologyWeights;
  activeMethodologies?: MethodologyName[];
  // NEW: LLM Consensus settings
  llmConsensus?: LLMConsensusConfig;
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
  lastAnalysis: MultiStrategySymbolAnalysis | null;
  allAnalyses: MultiStrategySymbolAnalysis[];
  lastError: string | null;
  // Circuit breaker states
  mt5CircuitState?: string;
  llmCircuitStates?: Record<string, string>;
  /** If pipeline was auto-stopped by a circuit breaker, this is the reason shown to the user */
  circuitBreakerReason?: string;
  busySymbols: Set<string>;
}

export interface PipelineLog {
  time: string;
  type: "INFO" | "SIGNAL" | "CANDIDATE" | "TRADE" | "ERROR" | "WARN" | "TRAILING" | "CONFLUENCE" | "IPDA";
  message: string;
  data?: any;
}

interface ActivePipeline {
  config: PipelineConfig;
  intervals: Map<string, NodeJS.Timeout>;
  trailingInterval: NodeJS.Timeout | null;
  logs: PipelineLog[];
  lastSignal: TradingSignal | null;
  lastAnalysis: MultiStrategySymbolAnalysis | null;
  lastError: string | null;
  lastAnalyzedCandleTimes: Map<string, number>;
  waitingReconnect: boolean;
  paused: boolean;
  mt5CircuitOpen: boolean;
  llmCircuitOpen: boolean;
  llmCircuitStates: Record<string, string>;
  pendingOrders: Map<number, { symbol: string; direction: string; entry: number; tp: number; sl: number; placedAt: number; expiryAt: number }>;
  startOfDayEquity: number;
  currentDayStr: string;
  peakEquity: number;
  initialBalance: number;
  dailyTradingBlocked: boolean;
  currentDrawdownPct: number;
  currentGrowthPct: number;
  currentRiskMultiplier: number;
  lastLlmSignalKey: string | null;
  lastLlmVerdictTime: number;
  allAnalyses: MultiStrategySymbolAnalysis[];
  busySymbols: Set<string>;
  running: boolean;
  circuitBreakerReason?: string;
}

const DEFAULT_CONFIG: PipelineConfig = {
  symbols: [],
  timeframe: "M15",
  strategy: "MULTI_METHODOLOGY",
  maxOpenPositions: 3,
  maxRiskPerTrade: 0.5,
  maxDailyRisk: 1.5,
  trailingStop: {
    enabled: true,
    activationATR: 1.0,
    trailATR: 0.5,
    breakEven: false,
  },
  entrySettings: {
    atrMultiplierSL: 1.5,
    atrMultiplierTP: 1.5,
    rsiOversold: 30,
    rsiOverbought: 70,
  },
  methodologyWeights: { ...DEFAULT_METHODOLOGY_WEIGHTS },
  activeMethodologies: Object.keys(DEFAULT_METHODOLOGY_WEIGHTS) as MethodologyName[],
  llmConsensus: { enabled: false, minProviders: 4, threshold: 0.7, providerTimeoutMs: 45000 },
};

// ─── Service ─────────────────────────────────────────────────────────

class TradingPipelineService {
  private activePipelines: Map<
    string,
    {
      config: PipelineConfig;
      intervals: Map<string, NodeJS.Timeout>;
      trailingInterval: NodeJS.Timeout | null;
      logs: PipelineLog[];
      lastSignal: TradingSignal | null;
      lastAnalysis: MultiStrategySymbolAnalysis | null;
      lastError: string | null;
      lastAnalyzedCandleTimes?: Map<string, number>;
      waitingReconnect?: boolean;
      paused: boolean;
      /** Track pending orders for expiry management */
      pendingOrders: Map<number, { symbol: string; direction: string; entry: number; tp: number; sl: number; placedAt: number; expiryAt: number }>;
      /** Circuit breaker states */
      mt5CircuitOpen: boolean;
      llmCircuitOpen: boolean;
      llmCircuitStates: Record<string, string>;
      /** Smart Risk Management States */
      startOfDayEquity?: number;
      currentDayStr?: string;
      peakEquity?: number;
      initialBalance?: number;
      dailyTradingBlocked?: boolean;
      currentDrawdownPct?: number;
      currentGrowthPct?: number;
      currentRiskMultiplier?: number;
      /** Circuit breaker auto-stop reason, if any */
      circuitBreakerReason?: string;
      cachedMetrics?: {
        totalTrades: number;
        winningTrades: number;
        losingTrades: number;
        allTimePnL: number;
        dailyPnLSum: number;
      };
      lastMetricsUpdate?: number;
      /** Dedup LLM voting — prevents re-evaluating the same signal */
      lastLlmSignalKey: string | null;
      lastLlmVerdictTime: number;
      /** All analyses from latest cycle, keyed by symbol for per-pair display */
      allAnalyses: MultiStrategySymbolAnalysis[];
      /** Per-symbol lock to prevent race condition: signals arriving between gate check and order placement */
      busySymbols: Set<string>;
      running: boolean;
    }
  > = new Map();


  // ─── Cache ────────────────────────────────────────────────────────────
  private regimeCache = new Map<string, { regime: string; multipliers: Record<string, number>; timestamp: number }>();
  private readonly REGIME_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

  /** Temporary store for circuit breaker reasons after pipeline stops (max 60s) */
  private circuitBreakerCache = new Map<string, { reason: string; at: number }>();

  private getCachedRegime(key: string): { regime: string; multipliers: Record<string, number> } | null {
    const cached = this.regimeCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.REGIME_CACHE_TTL_MS) {
      return { regime: cached.regime, multipliers: cached.multipliers };
    }
    if (cached) this.regimeCache.delete(key);
    return null;
  }

  private setCachedRegime(key: string, regime: string, multipliers: Record<string, number>): void {
    this.regimeCache.set(key, { regime, multipliers, timestamp: Date.now() });
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────

  async startPipeline(
    userId: string,
    config: Partial<PipelineConfig>,
    isRecovery = false,
  ): Promise<void> {
    if (!isRecovery) {
      await this.stopPipeline(userId);
    }

    const merged: PipelineConfig = {
      ...DEFAULT_CONFIG,
      ...config,
      trailingStop: {
        ...DEFAULT_CONFIG.trailingStop,
        ...(config.trailingStop || {}),
      },
      entrySettings: {
        ...DEFAULT_CONFIG.entrySettings,
        ...(config.entrySettings || {}),
      },
      methodologyWeights: {
        ...DEFAULT_CONFIG.methodologyWeights!,
        ...(config.methodologyWeights || {}),
      },
      activeMethodologies: config.activeMethodologies ?? DEFAULT_CONFIG.activeMethodologies,
      llmConsensus: {
        ...DEFAULT_CONFIG.llmConsensus!,
        ...(config.llmConsensus || {}),
      },
    };

    if (merged.symbols.length === 0) {
      throw new Error("At least one symbol required");
    }

    const intervalMs = this.getIntervalMs(merged.timeframe);

const pipeline = {
      config: merged,
      intervals: new Map<string, NodeJS.Timeout>(),
      trailingInterval: null as NodeJS.Timeout | null,
      logs: [] as PipelineLog[],
      lastSignal: null as TradingSignal | null,
      lastAnalysis: null as MultiStrategySymbolAnalysis | null,
      lastError: null as string | null,
      lastAnalyzedCandleTimes: new Map<string, number>(),
      waitingReconnect: false,
      paused: false,
      mt5CircuitOpen: false,
      llmCircuitOpen: false,
      llmCircuitStates: {},
      /** Track pending orders for expiry management */
      pendingOrders: new Map<number, { symbol: string; direction: string; entry: number; tp: number; sl: number; placedAt: number; expiryAt: number }>(),
      startOfDayEquity: 0,
      currentDayStr: new Date().toLocaleDateString(),
      peakEquity: 0,
      initialBalance: 0,
      dailyTradingBlocked: false,
      currentDrawdownPct: 0,
      currentGrowthPct: 0,
      currentRiskMultiplier: 1,
      lastLlmSignalKey: null,
      lastLlmVerdictTime: 0,
      allAnalyses: [],
      busySymbols: new Set<string>(),
      running: false,
    };

    this.activePipelines.set(userId, pipeline);

    try {
      const accountInfo = await mt5McpService.getAccountInfo();
      const positions = await mt5McpService.getPositions();
      const symbolPositions = positions.filter(p => merged.symbols.includes(p.symbol));
      
      pipeline.initialBalance = accountInfo?.balance || 0;
      pipeline.startOfDayEquity = accountInfo?.equity || 0;
      pipeline.peakEquity = accountInfo?.equity || 0;

      for (const symbol of merged.symbols) {
        this.addLog(userId, "INFO",
          `Pipeline started: ${symbol} on ${merged.timeframe} [${merged.activeMethodologies!.length} methodologies] | Risk: ${merged.maxRiskPerTrade}% | Balance: $${accountInfo?.balance?.toFixed(2) || 0} | Positions: ${symbolPositions.length}/${merged.maxOpenPositions}`
        );
      }
      } catch (e: any) {
        for (const symbol of merged.symbols) {
          this.addLog(userId, "INFO",
            `Pipeline started: ${symbol} on ${merged.timeframe} [${merged.activeMethodologies!.length} methodologies] | Risk: ${merged.maxRiskPerTrade}% | MT5 Info unavailable`
          );
        }
      }

    // Trigger the first execution immediately instead of waiting for the first interval tick
    merged.symbols.forEach((symbol, index) => {
      // Stagger execution by 1.5s per symbol
      setTimeout(() => {
        const p = this.activePipelines.get(userId);
        if (p) this.pipelineLoop(userId, symbol);
      }, index * 1500);

      const intervalId = setInterval(
        () => this.pipelineLoop(userId, symbol),
        intervalMs,
      );
      pipeline.intervals.set(symbol, intervalId);
    });

    // Trailing stop & pending order management runs more frequently (every 2s for realtime floating PnL)
    pipeline.trailingInterval = setInterval(
      async () => {
        await this.managePositions(userId);
        await this.syncClosedPositions(userId);
      },
      2_000,
    );

    if (!isRecovery) {
      await AITradingSession.findOneAndUpdate(
        { userId, status: "RUNNING" },
        {
          userId,
          status: "RUNNING",
          pipelineConfig: merged as any,
          startedAt: new Date(),
          mt5Connected: true,
        },
        { upsert: true },
      );
    } else {
      await AITradingSession.findOneAndUpdate(
        { userId, status: "RUNNING" },
        { mt5Connected: true }
      );
    }

    silentLogger.info(`[PIPELINE] Started for user ${userId} on ${merged.timeframe} with ${merged.activeMethodologies!.length} methodologies (isRecovery=${isRecovery})`);
  }

  async stopPipeline(userId: string, circuitBreakerReason?: string): Promise<void> {
    const pipeline = this.activePipelines.get(userId);
    if (pipeline?.intervals) {
      for (const interval of pipeline.intervals.values()) {
        clearInterval(interval);
      }
      pipeline.intervals.clear();
    }
    if (pipeline?.trailingInterval) {
      clearInterval(pipeline.trailingInterval);
    }

    if (pipeline) {
      this.addLog(userId, "INFO", circuitBreakerReason ? `Pipeline auto-stopped: ${circuitBreakerReason}` : "Pipeline stopped");
      // Keep circuitBreakerReason accessible for a brief window so frontend can pick it up
      if (circuitBreakerReason) {
        pipeline.circuitBreakerReason = circuitBreakerReason;
        // After deletion below, we store it in a temporary map for 60 seconds
        this.circuitBreakerCache.set(userId, { reason: circuitBreakerReason, at: Date.now() });
      }
    }

    this.activePipelines.delete(userId);

    await AITradingSession.findOneAndUpdate(
      { userId, status: "RUNNING" },
      { status: "STOPPED", stoppedAt: new Date(), lastError: circuitBreakerReason },
    );
  }

  async recoverPipelines(): Promise<void> {
    try {
      const activeSessions = await AITradingSession.find({ status: "RUNNING" }).lean();
      if (activeSessions.length === 0) {
        silentLogger.info("[PIPELINE-RECOVERY] No active pipelines found in database to recover.");
        return;
      }

      silentLogger.info(`[PIPELINE-RECOVERY] Found ${activeSessions.length} active pipeline(s) to recover.`);

      for (const session of activeSessions) {
        try {
          silentLogger.info(`[PIPELINE-RECOVERY] Auto-restoring pipeline for user ${session.userId}...`);
          
          // Re-start the pipeline loop with saved config
          await this.startPipeline(session.userId, session.pipelineConfig as any);
          
          this.addLog(session.userId, "INFO", "Pipeline auto-restored after server restart");
        } catch (err: any) {
          silentLogger.error(`[PIPELINE-RECOVERY] Failed to restore pipeline for user ${session.userId}: ${err.message}`);
        }
      }
    } catch (err: any) {
      silentLogger.error(`[PIPELINE-RECOVERY] Database lookup error during recovery: ${err.message}`);
    }
  }

  async pausePipeline(userId: string): Promise<void> {
    const pipeline = this.activePipelines.get(userId);
    if (pipeline?.intervals) {
      for (const interval of pipeline.intervals.values()) {
        clearInterval(interval);
      }
      pipeline.intervals.clear();
      pipeline.paused = true;
    }
    this.addLog(userId, "INFO", "Pipeline paused");
  }

  async resumePipeline(userId: string): Promise<void> {
    const pipeline = this.activePipelines.get(userId);
    if (!pipeline?.paused) {
      throw new Error("Pipeline is not paused");
    }

    const intervalMs = this.getIntervalMs(pipeline.config.timeframe);
    pipeline.config.symbols.forEach((symbol, index) => {
      const intervalId = setInterval(
        () => this.pipelineLoop(userId, symbol),
        intervalMs,
      );
      pipeline.intervals.set(symbol, intervalId);
    });
    pipeline.paused = false;

    this.addLog(userId, "INFO", "Pipeline resumed");
  }

  async updateConfig(userId: string, updates: Partial<PipelineConfig>): Promise<void> {
    const pipeline = this.activePipelines.get(userId);
    if (!pipeline) return;

    if (updates.entrySettings) {
      pipeline.config.entrySettings = {
        ...pipeline.config.entrySettings,
        ...updates.entrySettings,
      };
    }
    if (updates.trailingStop) {
      pipeline.config.trailingStop = {
        ...pipeline.config.trailingStop,
        ...updates.trailingStop,
      };
    }
    if (updates.methodologyWeights) {
      pipeline.config.methodologyWeights = {
        ...pipeline.config.methodologyWeights,
        ...updates.methodologyWeights,
      };
    }
    if (updates.activeMethodologies) {
      pipeline.config.activeMethodologies = updates.activeMethodologies;
    }
    if (updates.llmConsensus) {
      pipeline.config.llmConsensus = {
        ...pipeline.config.llmConsensus,
        ...updates.llmConsensus,
      };
    }
    if (updates.symbols) pipeline.config.symbols = updates.symbols;
    if (updates.timeframe) pipeline.config.timeframe = updates.timeframe;
    if (updates.maxOpenPositions !== undefined) pipeline.config.maxOpenPositions = updates.maxOpenPositions;
    if (updates.maxRiskPerTrade !== undefined) pipeline.config.maxRiskPerTrade = updates.maxRiskPerTrade;
    if (updates.maxDailyRisk !== undefined) pipeline.config.maxDailyRisk = updates.maxDailyRisk;
    if (updates.tradingHours) pipeline.config.tradingHours = updates.tradingHours;

    this.addLog(userId, "INFO", `Config updated: ${JSON.stringify(updates)}`);
    silentLogger.info(`[PIPELINE] Config updated for ${userId}`);
  }

  async getPipelineStatus(userId: string): Promise<PipelineStatus> {
    const pipeline = this.activePipelines.get(userId);
    if (!pipeline) {
      // Check if a circuit breaker recently fired for this user (last 60s)
      const cbCache = this.circuitBreakerCache.get(userId);
      const circuitBreakerReason = cbCache && (Date.now() - cbCache.at < 60_000)
        ? cbCache.reason
        : undefined;

return {
         running: false,
         paused: false,
         startedAt: null,
         config: null,
         metrics: {
           totalTrades: 0,
           winningTrades: 0,
           losingTrades: 0,
           totalPnL: 0,
           dailyPnL: 0,
           openPositions: 0,
           currentDrawdown: 0,
         },
         lastSignal: null,
         lastAnalysis: null,
         allAnalyses: [],
         lastError: null,
         circuitBreakerReason,
busySymbols: new Set<string>(),
    };
  }

    // Query real metrics dari DB + MT5
    let openPositions = 0;
    let totalPnL = 0;
    let totalTrades = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    let dailyPnL = 0;
    let currentDrawdown = 0;

    try {
      if (!mt5McpService.isConnected) {
        return {
          running: pipeline.intervals.size > 0 && !pipeline.paused,
          paused: pipeline.paused,
          startedAt: null,
          config: pipeline.config,
          metrics: {
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            totalPnL: 0,
            dailyPnL: 0,
            openPositions: 0,
            currentDrawdown: 0,
          },
        lastSignal: pipeline.lastSignal,
        lastAnalysis: pipeline.lastAnalysis,
        allAnalyses: pipeline.allAnalyses || [],
        lastError: pipeline.lastError,
        mt5CircuitState: "CONNECTED",
        llmCircuitStates: pipeline.llmCircuitStates,
        busySymbols: pipeline.busySymbols,
      };
      }
      // Get current MT5 account ID
      let accountId;
      if (mt5McpService.isConnected) {
        try {
          const accountInfo = await mt5McpService.getAccountInfo();
          accountId = accountInfo?.login?.toString();

          // Open positions langsung dari MT5 (filter only AI trades)
          const positions = await mt5McpService.getPositions();
          const aiPositions = positions.filter(p => p.comment && (p.comment.startsWith("AI-") || p.comment.toLowerCase().includes("ai-")));
          openPositions = aiPositions.length;
          // Hitung total floating PnL dari semua posisi AI
          totalPnL = aiPositions.reduce((sum, p) => sum + (p.profit || 0), 0);

          // Drawdown sederhana: negatif dari total floating
          currentDrawdown = aiPositions
            .filter(p => p.profit < 0)
            .reduce((sum, p) => sum + Math.abs(p.profit), 0);
        } catch (e: any) {
          if (e.message !== "MT5 not connected") {
            silentLogger.warn(`[PIPELINE] Could not get MT5 stats: ${e}`);
          }
        }
      }

      // Trade history dari DB (closed trades) - Cache for 10s to avoid DB spam during realtime polling
      const now = Date.now();
      if (!pipeline.cachedMetrics || now - (pipeline.lastMetricsUpdate || 0) > 10_000) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const query: any = { userId, closed: true };
        if (accountId) query.accountId = accountId;

        const closedTrades = await AITradeLog.find(query).lean();

        let tTrades = closedTrades.length;
        let aPnL = 0;
        let dPnL = 0;
        let wTrades = 0;
        let lTrades = 0;

        for (const t of closedTrades) {
          const pnl = (t as any).pnl || 0;
          aPnL += pnl;
          if (t.executionTime && new Date(t.executionTime) >= today) {
            dPnL += pnl;
          }
          if (pnl > 0) wTrades++;
          else if (pnl < 0) lTrades++;
        }

        pipeline.cachedMetrics = {
          totalTrades: tTrades,
          winningTrades: wTrades,
          losingTrades: lTrades,
          allTimePnL: aPnL,
          dailyPnLSum: dPnL,
        };
        pipeline.lastMetricsUpdate = now;
      }

      totalTrades = pipeline.cachedMetrics.totalTrades;
      winningTrades = pipeline.cachedMetrics.winningTrades;
      losingTrades = pipeline.cachedMetrics.losingTrades;
      let allTimePnL = pipeline.cachedMetrics.allTimePnL;
      let dailyPnLSum = pipeline.cachedMetrics.dailyPnLSum;

      // Combine floating PnL + closed PnL
      totalPnL += allTimePnL;
      dailyPnL = dailyPnLSum;


    } catch (err) {
      silentLogger.warn(`[PIPELINE] Status metrics query error: ${err}`);
    }

    return {
      running: pipeline.intervals.size > 0 && !pipeline.paused,
      paused: pipeline.paused,
      startedAt: null,
      config: pipeline.config,
      metrics: {
        totalTrades,
        winningTrades,
        losingTrades,
        totalPnL: Math.round(totalPnL * 100) / 100,
        dailyPnL: Math.round(dailyPnL * 100) / 100,
        openPositions,
        currentDrawdown: Math.round(currentDrawdown * 100) / 100,
        smartRisk: {
          currentDrawdownPct: pipeline.currentDrawdownPct || 0,
          currentGrowthPct: pipeline.currentGrowthPct || 0,
          currentRiskMultiplier: pipeline.currentRiskMultiplier || 1,
          dailyTradingBlocked: pipeline.dailyTradingBlocked || false,
        }
      },
      lastSignal: pipeline.lastSignal,
      lastAnalysis: pipeline.lastAnalysis,
          allAnalyses: pipeline.allAnalyses || [],
          lastError: pipeline.lastError,
          mt5CircuitState: mt5McpService.circuitBreakerState,
          llmCircuitStates: llmConsensusService.getCircuitStates(),
          busySymbols: pipeline.busySymbols,
        };
  }

  getPipelineLogs(userId: string, limit = 100): PipelineLog[] {
    const pipeline = this.activePipelines.get(userId);
    if (!pipeline) return [];
    return pipeline.logs.slice(-limit);
  }

  // ─── Order Validation ─────────────────────────────────────────────

  private async validateOrderParams(
    symbol: string,
    action: "BUY" | "SELL",
    volume: number,
    sl?: number,
    tp?: number,
    minRRRatio: number = 1.0,
    isPending: boolean = false,
    signalEntry?: number,
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      // 1. Cek symbol ada di broker
      const symbolInfo = await mt5McpService.getSymbolInfo(symbol);
      if (!symbolInfo) {
        return { valid: false, error: `Symbol ${symbol} tidak ditemukan di broker` };
      }

      // 2. Cek volume sesuai dengan symbol limits
      if (volume < symbolInfo.volumeMin || volume > symbolInfo.volumeMax) {
        return { valid: false, error: `Volume ${volume} di luar range (min: ${symbolInfo.volumeMin}, max: ${symbolInfo.volumeMax})` };
      }

      // 3. Cek SL/TP valid jika disediakan
      if (sl !== undefined && tp !== undefined) {
        const tick = await mt5McpService.getTick(symbol);
        if (!tick) {
          return { valid: false, error: `Tidak bisa mendapatkan tick untuk ${symbol}` };
        }

        const entryPrice = isPending && signalEntry !== undefined
          ? signalEntry
          : (action === "BUY" ? tick.ask : tick.bid);
        const slDistance = Math.abs(entryPrice - sl);
        const tpDistance = Math.abs(tp - entryPrice);

        // Hitung minimum distance dalam unit HARGA (bukan point!)
        // SL at wick — cukup cek SL != entry, spread offset di pipeline level
        const minSlDistance = symbolInfo.point * 10;

        if (slDistance < minSlDistance) {
          return {
            valid: false,
            error: `Stop Loss terlalu dekat entry (jarak SL=${slDistance.toFixed(symbolInfo.digits)}, min=${minSlDistance.toFixed(symbolInfo.digits)})`,
          };
        }

        // TP harus lebih baik dari SL
        if (action === "BUY" && tp <= sl) {
          return { valid: false, error: "Take Profit harus di atas Stop Loss untuk posisi BUY" };
        }
        if (action === "SELL" && tp >= sl) {
          return { valid: false, error: "Take Profit harus di bawah Stop Loss untuk posisi SELL" };
        }

        // Cek R:R ratio minimal (lebih longgar untuk market execution)
        if (slDistance > 0) {
          const rrRatio = tpDistance / slDistance;
          if (isPending) {
            // Pending order: strict minimum from config (default 1:1)
            if (rrRatio < minRRRatio) {
              return { valid: false, error: `Risk:Reward ratio terlalu rendah (${rrRatio.toFixed(2)}:1, minimal ${minRRRatio}:1)` };
            }
          } else {
            // Market execution: strict minimum from config (default 1:2)
            if (rrRatio < minRRRatio) {
              return { valid: false, error: `Risk:Reward ratio terlalu rendah (${rrRatio.toFixed(2)}:1, minimal ${minRRRatio}:1). Eksekusi ditolak.` };
            }
          }
        }
      }

      return { valid: true };
    } catch (error: any) {
      return { valid: false, error: `Validasi gagal: ${error.message}` };
    }
  }

  // ─── Main Pipeline Loop ────────────────────────────────────────────

  private async pipelineLoop(userId: string, symbol: string): Promise<void> {
    const pipeline = this.activePipelines.get(userId);
    if (!pipeline) return;

    let currentSymbol: string | undefined = symbol; // Initialize with the symbol parameter

    try {
      // Handle MT5 disconnections by auto-pausing without killing the timer
      // Check MT5 circuit breaker state
      const mt5CircuitState = mt5McpService.circuitBreakerState;
      pipeline.mt5CircuitOpen = mt5CircuitState === "OPEN";
      if (!mt5McpService.isConnected) {
        pipeline.waitingReconnect = true;
        if (pipeline.config.symbols[0] === symbol) {
          this.addLog(userId, "ERROR", `[PIPELINE] Koneksi MT5 terputus. Pipeline di-pause sementara sambil menunggu koneksi pulih (Auto-pause).`);
        }
        pipeline.mt5CircuitOpen = true; // Set MT5 circuit breaker to OPEN
        return; // Skip this tick silently
      } else if (pipeline.waitingReconnect) {
        pipeline.waitingReconnect = false;
        pipeline.mt5CircuitOpen = false; // Close MT5 circuit breaker
        if (pipeline.config.symbols[0] === symbol) {
          this.addLog(userId, "INFO", `[PIPELINE] Koneksi MT5 pulih. Pipeline dilanjutkan (Auto-resume).`);
        }
      }

      if (!this.isWithinTradingHours(pipeline.config)) return;

      // ── MARKET SESSION: Skip volatile session switches ──────────
      if (this.isInVolatileSessionWindow(pipeline.config.symbols[0] || "")) {
        if (pipeline.config.symbols[0] === symbol) {
          this.addLog(userId, "INFO", `[SESSION] Volatile session window — skipping analysis until market stabilizes`);
        }
        return;
      }

      // ── Smart Risk Management State Updates ──
      try {
        const acc = await mt5McpService.getAccountInfo();
        if (acc && acc.equity) {
          const todayStr = new Date().toLocaleDateString();
          if (pipeline.currentDayStr !== todayStr) {
            pipeline.currentDayStr = todayStr;
            pipeline.startOfDayEquity = acc.equity;
            pipeline.dailyTradingBlocked = false; // Reset block on new day
            this.addLog(userId, "INFO", `[SMART-RISK] Daily state reset. Start of day equity: $${acc.equity.toFixed(2)}`);
          }
          if (acc.equity > (pipeline.peakEquity || 0)) {
            pipeline.peakEquity = acc.equity;
          }
          
          if (pipeline.peakEquity && pipeline.peakEquity > 0) {
            pipeline.currentDrawdownPct = ((pipeline.peakEquity - acc.equity) / pipeline.peakEquity) * 100;
          }
          
          if (pipeline.initialBalance && pipeline.initialBalance > 0) {
            pipeline.currentGrowthPct = ((acc.equity - pipeline.initialBalance) / pipeline.initialBalance) * 100;
          }

          // Check Daily Limits
          if (pipeline.config.smartRisk?.enabled && pipeline.config.smartRisk.dailyLimits?.enabled) {
            const dailyLimits = pipeline.config.smartRisk.dailyLimits;
            const startOfDay = pipeline.startOfDayEquity || acc.equity;
            const currentDailyGainPct = ((acc.equity - startOfDay) / startOfDay) * 100;

            if (currentDailyGainPct >= dailyLimits.profitTargetPct) {
               if (!pipeline.dailyTradingBlocked) {
                 pipeline.dailyTradingBlocked = true;
                 this.addLog(userId, "INFO", `[SMART-RISK] Daily Profit Target tercapai (+${currentDailyGainPct.toFixed(2)}%). Trading dihentikan untuk hari ini.`);
               }
            } else if (currentDailyGainPct <= -dailyLimits.lossLimitPct) {
               if (!pipeline.dailyTradingBlocked) {
                 pipeline.dailyTradingBlocked = true;
                 this.addLog(userId, "INFO", `[SMART-RISK] Daily Loss Limit tercapai (${currentDailyGainPct.toFixed(2)}%). Trading dihentikan untuk hari ini.`);
               }
            }
          }
        }
      } catch (err) {
        // silently skip state update if MT5 fails
      }

      if (pipeline.dailyTradingBlocked) {
        return; // Skip trading loop if blocked by Smart Risk
      }


      // Note: managePositions and syncClosedPositions are handled by trailingInterval globally now.

      // Check which symbols actually need analysis (candle time has changed)
      const symbolsToAnalyze: string[] = [];
      const latestCandleTimes = new Map<string, number>();

      if (!pipeline.lastAnalyzedCandleTimes) {
        pipeline.lastAnalyzedCandleTimes = new Map<string, number>();
      }

      // ── SMART WEEKEND PAUSE: Skip forex on Saturday & Sunday to save LLM tokens ──
      const now = new Date();
      const utcDay = now.getUTCDay();
      const utcHour = now.getUTCHours();
      // Forex closes Friday 22:00 UTC, opens Sunday 22:00 UTC
      const isForexClosed = (utcDay === 6) || // Saturday all day
                            (utcDay === 0 && utcHour < 22) || // Sunday before 22:00 UTC
                            (utcDay === 5 && utcHour >= 22);  // Friday after 22:00 UTC

      const isCryptoSymbol = (sym: string) => /^(BTC|ETH|LTC|XRP|SOL|DOGE|ADA|BCH|DOT|LINK|UNI|BNB|AVAX|MATIC)/i.test(sym);

      if (isForexClosed && !isCryptoSymbol(symbol)) {
        // Log once per hour to avoid spam
        const pauseLogKey = `weekend_pause_${symbol}_${utcDay}_${utcHour}`;
        if (!pipeline.lastAnalyzedCandleTimes.has(pauseLogKey)) {
          pipeline.lastAnalyzedCandleTimes.set(pauseLogKey, Date.now());
          const reopenTime = utcDay === 5 ? "Sunday 22:00 UTC (Mon 05:00 WIB)" : "Sunday 22:00 UTC (Mon 05:00 WIB)";
          
          this.addLog(userId, "INFO",
            `⏸️ MARKET CLOSED: Forex paused (${symbol}). Reopens ${reopenTime}.`
          );
        }
        return; // Fully skip this symbol
      }

      try {
        const rates = await mt5McpService.getRates(symbol, pipeline.config.timeframe, 2);
        if (rates && rates.length > 0) {
          const latestCandleTime = rates[rates.length - 1].time;
          latestCandleTimes.set(symbol, latestCandleTime);
          symbolsToAnalyze.push(symbol);
        } else {
          symbolsToAnalyze.push(symbol);
        }
      } catch (err: any) {
        symbolsToAnalyze.push(symbol);
      }

      if (symbolsToAnalyze.length === 0) {
        pipeline.lastError = null;
        return;
      }

      // ── MARKET REGIME: Detect current market conditions ────────────
      let regimeMult: Record<string, number> = {};
      let currentRegime: string = "UNKNOWN";
      try {
        const activeSymbolForRegime = symbolsToAnalyze[0] || pipeline.config.symbols[0];
        const cacheKey = `${activeSymbolForRegime}_${pipeline.config.timeframe}`;
        
        // Check cache first
        const cachedRegime = this.getCachedRegime(cacheKey);
        if (cachedRegime) {
          regimeMult = cachedRegime.multipliers;
          currentRegime = cachedRegime.regime;
          this.addLog(userId, "SIGNAL",
            `[REGIME] ${currentRegime} (cached) - Adjusted weights applied`
          );
        } else {
          const rates = await mt5McpService.getRates(activeSymbolForRegime, pipeline.config.timeframe, 60);
          if (rates && rates.length > 30) {
            const candles: Candle[] = rates.map((r: any) => ({
              time: r.time, open: r.open, high: r.high, low: r.low, close: r.close,
            }));
            const regimeResult = marketRegimeService.analyze(candles);
            currentRegime = regimeResult.regime;
            regimeMult = marketRegimeService.getRegimeMultipliers(currentRegime as any);
            this.setCachedRegime(cacheKey, currentRegime, regimeMult);
            this.addLog(userId, "SIGNAL",
              `[REGIME] ${currentRegime} (ADX: ${regimeResult.adx}, Vol: ${regimeResult.volatility}%, Conf: ${regimeResult.confidence}%)`
            );
          }
        }
      } catch (e: any) { silentLogger.warn(`[PIPELINE] Regime check error: ${e.message}`); }

      // ── Apply regime multipliers to methodology weights ────────────
      let adjustedWeights = pipeline.config.methodologyWeights;
      if (Object.keys(regimeMult).length > 0 && adjustedWeights) {
        adjustedWeights = { ...adjustedWeights };
        for (const [key, mult] of Object.entries(regimeMult)) {
          if (key in adjustedWeights) {
            (adjustedWeights as any)[key] = ((adjustedWeights as any)[key] || 1.0) * mult;
          }
        }
        const activeMeth = pipeline.config.activeMethodologies || ["smc", "ict", "msnr"];
        const filteredWeightsStr = Object.entries(adjustedWeights)
          .filter(([k]) => activeMeth.includes(k as any))
          .map(([k, v]) => `${k}=${(v as number).toFixed(2)}`)
          .join(", ");
        if (filteredWeightsStr) {
          this.addLog(userId, "SIGNAL", `[REGIME] Adjusted weights: ${filteredWeightsStr}`);
        }
      }

      // Provide visual feedback for scanning process in the UI
      this.addLog(userId, "SIGNAL",
        `Scanning ${symbolsToAnalyze.join(", ")} using ${pipeline.config.activeMethodologies?.length || 0} methodologies...`
      );

      let analyses: MultiStrategySymbolAnalysis[] = [];
      try {
          // Use multi-methodology analysis with regime-adjusted weights
          analyses = await aiTradingEngine.analyzeSymbols(
            symbolsToAnalyze,
            pipeline.config.timeframe,
            pipeline.config.maxRiskPerTrade,
            adjustedWeights,
            pipeline.config.activeMethodologies || ["smc", "ict", "msnr"],
          );

      } catch (err: any) {
        silentLogger.error(`[PIPELINE] Error analyzing symbols: ${err.message}`);
        if (err.message.includes("MT5") || err.message.includes("connect") || err.message.includes("timeout") || err.message.includes("32001")) {
          mt5McpService.forceDisconnect();
        }
        return;
      }

      let bestAnalysisForUI = analyses.find(a => a.confluence.finalSignal) 
                           || analyses.find(a => a.confluence.conflictDetected)
                           || analyses[0];

      if (bestAnalysisForUI) {
        pipeline.lastAnalysis = bestAnalysisForUI;
      }
      // Update per-symbol slot so allAnalyses accumulates across parallel pipelineLoop calls
      for (const a of analyses) {
        const idx = pipeline.allAnalyses.findIndex(x => x.symbol === a.symbol);
        if (idx >= 0) pipeline.allAnalyses[idx] = a;
        else pipeline.allAnalyses.push(a);
      }

      for (const analysis of analyses) {
        const latestTime = latestCandleTimes.get(analysis.symbol);
        if (latestTime !== undefined) {
          pipeline.lastAnalyzedCandleTimes.set(analysis.symbol, latestTime);
        }

        try {
          const { aiBacktestSkillService } = require("./ai-backtest-skill.service");
          currentSymbol = analysis.symbol;
          const skill = await aiBacktestSkillService.getSkill(userId);
          if (skill) {
            const symRanking = skill.symbolRankings?.find((s: any) => s.symbol === analysis.symbol);
            if (symRanking && symRanking.totalBacktests >= 3 && symRanking.score < 40) {
              this.addLog(userId, "INFO", `[1/7] [${analysis.symbol}] SKIPPED (AI-SKILL): Low backtest rating (Score: ${symRanking.score})`);
              continue;
            }

            const primaryMeth = analysis.confluence.finalSignal?.primaryMethodology;
            if (primaryMeth) {
              const methRanking = skill.methodologyRankings?.find((m: any) => m.methodology === primaryMeth);
              if (methRanking && methRanking.verdict === "DISABLE") {
                this.addLog(userId, "INFO", `[1/7] [${analysis.symbol}] SKIPPED (AI-SKILL): Methodology [${primaryMeth}] disabled by backtest performance`);
                continue;
              }
            }
          }
        } catch (skillErr: any) {
          silentLogger.error(`[PIPELINE] AI Skill filtering failed: ${skillErr.message}`);
        }

        if (!analysis.confluence.finalSignal) {
          if (analysis.confluence.conflictDetected) {
            this.addLog(userId, "CONFLUENCE",
              `[2/4] [${analysis.symbol}] NO TRADE: ${analysis.confluence.reason}`,
              analysis.confluence.methodologyBreakdown,
            );
          } else {
            const breakdown = analysis.confluence.methodologyBreakdown;
            const votes = Object.entries(breakdown)
              .filter(([, v]) => (v as any).confidence > 0)
              .map(([k, v]) => `${k}=${(v as any).direction ?? '-'}(${(v as any).confidence ?? 0}%)`)
              .join(", ");
            const alignInfo = analysis.methodologySignals
              ? ` | SMC:${analysis.methodologySignals.smc.length} ICT:${analysis.methodologySignals.ict.length} MSNR:${analysis.methodologySignals.msnr.length} raw`
              : "";
            this.addLog(userId, "SIGNAL",
              `[1/4] [${analysis.symbol}] NO SIGNAL. Votes: ${votes || "none"}${alignInfo}`,
              breakdown,
            );
          }
          continue;
        }

        const finalSig = analysis.confluence.finalSignal;
        const slDistInitial = Math.abs(finalSig.entry - finalSig.sl);
        const tpDistInitial = Math.abs(finalSig.tp - finalSig.entry);
        const rrInitial = slDistInitial > 0 ? (tpDistInitial / slDistInitial) : 0;

        const sigChecklist = finalSig.checklistItems || [];
        const coreChecklist = sigChecklist.filter(c => 
          !c.id.endsWith("-daily") && 
          c.id !== "ict-kz" &&
          !c.id.endsWith("-entry-rejection") &&
          !c.id.endsWith("-entry") &&
          !c.id.endsWith("-rr")
        );
        const hasFailedCoreStep = coreChecklist.some(c => c.status === "FAILED");
        const allCorePassed = coreChecklist.length > 0 && coreChecklist.every(c => c.status === "PASSED");

        const signal: TradingSignal = {
          symbol: analysis.symbol,
          direction: finalSig.direction,
          confidence: finalSig.confidence,
          entry: finalSig.entry,
          sl: finalSig.sl,
          tp: finalSig.tp,
          reason: analysis.confluence.reason,
          riskPercent: pipeline.config.maxRiskPerTrade,
          timeframe: pipeline.config.timeframe,
          indicators: { rsi: 50, atr: 0 },
          pattern: `MULTI_${finalSig.primaryMethodology.toUpperCase()}`,
        };

        pipeline.lastSignal = signal;

        // ── STAGE 1: SIGNAL FORMED (OR CANDIDATE SETUP) ─────────────────────
        if (hasFailedCoreStep || !allCorePassed) {
          this.addLog(userId, "CANDIDATE",
            `[1/4] [${analysis.symbol}] CANDIDATE SETUP: ${finalSig.direction} | ` +
            `Score: ${finalSig.confluenceScore}% → ${finalSig.confidence}% | ` +
            `Primary: ${finalSig.primaryMethodology.toUpperCase()} | Checklist Incomplete`,
            analysis.confluence.methodologyBreakdown,
          );
          // Do not proceed to Confluence & LLM if checklist is incomplete.
          continue;
        }

        this.addLog(userId, "SIGNAL",
          `[1/4] [${analysis.symbol}] SIGNAL FORMED: ${finalSig.direction} | ` +
          `Score: ${finalSig.confluenceScore}% → ${finalSig.confidence}% | ` +
          `Primary: ${finalSig.primaryMethodology.toUpperCase()} | ` +
          `Agreeing: ${finalSig.totalAgreeing}/${pipeline.config.activeMethodologies?.length ?? 0} | ` +
          `R:R 1:${rrInitial.toFixed(2)}`,
          analysis.confluence.methodologyBreakdown,
        );

        // ── STAGE 2: POSITION GATE & LLM CONSENSUS VOTING ─────────────────────
        // Cek posisi + pending order dulu sebelum LLM — buang2 token klo udah ada
        let symbolPosCount = 0;
        let currentPosCount = 0;
        try {
          const positions = await mt5McpService.getPositions();
          currentPosCount = positions.length;
          symbolPosCount = positions.filter(p => p.symbol === signal.symbol).length;
        } catch {}
        const symbolPendingCount = Array.from(pipeline.pendingOrders.values())
          .filter(o => o.symbol === signal.symbol).length;
        if (symbolPosCount > 0 || symbolPendingCount > 0) {
          this.addLog(userId, "CANDIDATE",
            `[1/4] [${analysis.symbol}] SKIP LLM: Already ${symbolPosCount} position + ${symbolPendingCount} pending on ${signal.symbol}. Waiting for close.`,
          );
          continue;
        }
        // Per-symbol lock: prevent race condition between gate check and order placement
        if (pipeline.busySymbols.has(signal.symbol)) {
          this.addLog(userId, "CANDIDATE",
            `[1/4] [${analysis.symbol}] SKIP: ${signal.symbol} is busy processing another signal.`);
          continue;
        }
        pipeline.busySymbols.add(signal.symbol);

        const llmProviders = llmConsensusService.getAvailableProviders();
        pipeline.llmCircuitOpen = llmProviders.filter(p => p.available).length === 0;

        if (pipeline.config.llmConsensus?.enabled) {
          if (pipeline.llmCircuitOpen) {
            this.addLog(userId, "ERROR", `[2/4] [${signal.symbol}] All LLM providers circuit OPEN. Skipping LLM Voting, relying on technicals.`);
          } else {
            // Dedup: skip LLM voting if same signal entry already evaluated within 1 hour
            const llmSignalKey = `${signal.symbol}_${signal.direction}_${Math.round(signal.entry * 100000)}`;
            const LLM_DEDUP_TTL_MS = 60 * 60 * 1000; // 1 hour
            if (pipeline.lastLlmSignalKey === llmSignalKey && Date.now() - pipeline.lastLlmVerdictTime < LLM_DEDUP_TTL_MS) {
              this.addLog(userId, "CONFLUENCE",
                `[2/4] [${signal.symbol}] LLM SKIPPED: ${signal.direction} @ ${signal.entry.toFixed(5)} already evaluated. Waiting for next candle.`
              );
              continue;
            }
            pipeline.lastLlmSignalKey = llmSignalKey;
            pipeline.lastLlmVerdictTime = Date.now();

            this.addLog(userId, "CONFLUENCE",
              `[2/4] [${signal.symbol}] LLM CONSENSUS: Initiating AI voting across multi-LLM models...`,
            );

            let llmSymScore: number | undefined;
            let llmMethV: string | undefined;
            let llmMethWR: number | undefined;
            let llmMethPnL: number | undefined;
            try { const { aiBacktestSkillService } = require("./ai-backtest-skill.service"); const s = await aiBacktestSkillService.getSkill(userId); if (s) { const sr = s.symbolRankings?.find((x: any) => x.symbol === signal.symbol); if (sr) llmSymScore = sr.score; const mr = s.methodologyRankings?.find((x: any) => x.methodology === analysis.confluence.finalSignal?.primaryMethodology); if (mr) { llmMethV = mr.verdict; llmMethWR = mr.avgWinRate; llmMethPnL = mr.totalPnL; } } } catch {}

            const activeMeth = pipeline.config.activeMethodologies || ["smc", "ict", "msnr"];
            const checklist = analysis.confluence.finalSignal?.checklistItems || [];
            const methChecklist = checklist.filter(c => !c.id.startsWith("pipeline-step-"));
            
            const llmResult = await llmConsensusService.evaluate(
              {
                symbol: signal.symbol,
                direction: signal.direction,
                confidence: signal.confidence,
                entry: signal.entry,
                sl: signal.sl,
                tp: signal.tp,
                reason: signal.reason,
                marketTrend: analysis.marketStructure.trend.direction,
                marketRegime: currentRegime,
                methodologyBreakdown: Object.fromEntries(
                  Object.entries(analysis.confluence.methodologyBreakdown).filter(([k]) => activeMeth.includes(k as any))
                ),
                agreeingCount: analysis.confluence.finalSignal?.totalAgreeing ?? 0,
                totalMethodologies: activeMeth.length,

                symbolScore: llmSymScore,
                methodologyVerdict: llmMethV,
                methodologyWinRate: llmMethWR,
                methodologyPnL: llmMethPnL,
                pattern: analysis.confluence.finalSignal?.pattern,
                checklist: methChecklist,

              },
              pipeline.config.llmConsensus,
            );

            const isTrade = llmResult.verdict === "GOOD";
            this.addLog(userId, "CONFLUENCE",
              `[2/4] [${signal.symbol}] LLM CONSENSUS RESULT: ${isTrade ? "TRADE APPROVED" : "TRADE REJECTED"}`,
              { llmConsensus: llmResult },
            );
            this.addLog(userId, "CONFLUENCE",
              `[2/4] [${signal.symbol}] Consensus Ratio: ${llmResult.goodVotes}/${llmResult.totalVotes} GOOD votes (Threshold: ${Math.round((pipeline.config.llmConsensus?.threshold ?? 0.5) * 100)}%)`,
            );
            for (const vote of (llmResult.votes || [])) {
              if (vote.error) continue;
              this.addLog(userId, "CONFLUENCE",
                `[2/4] [${signal.symbol}] ${vote.provider}(${vote.modelLabel}): ${vote.verdict} — ${vote.reasoning}`,
              );
            }

            const llmProvidersAfter = llmConsensusService.getAvailableProviders();
            pipeline.llmCircuitOpen = llmProvidersAfter.filter(p => p.available).length === 0;

            if (!isTrade) {
              continue;
            }
          }
        }

        // ── STAGE 3: PRE-TRADE RISK CHECK & POSITION SIZING ─────────────────────
        const riskCheck = await riskManagerService.checkTradeAllowed(
          userId,
          signal,
          {
            maxOpenPositions: pipeline.config.maxOpenPositions,
            maxDailyRisk: pipeline.config.maxDailyRisk,
            maxRiskPerTrade: pipeline.config.maxRiskPerTrade,
            smartRisk: pipeline.config.smartRisk,
          },
        );

        if (!riskCheck.allowed) {
          this.addLog(userId, "ERROR",
            `[3/4] [${signal.symbol}] REJECTED (RISK): ${riskCheck.reason} (Open: ${currentPosCount}/${pipeline.config.maxOpenPositions})`,
          );
          
          if (riskCheck.circuitBreaker) {
            await this.stopPipeline(userId, riskCheck.reason);
            this.addLog(userId, "ERROR", `[CIRCUIT BREAKER] Pipeline automatically STOPPED due to: ${riskCheck.reason}`);
          }
          continue;
        }

        this.addLog(userId, "INFO", `[3/4] [${signal.symbol}] RISK CHECK: Passed (Open: ${currentPosCount}/${pipeline.config.maxOpenPositions})`);

        let volume = 0;
        let accountInfo: any;
        let symbolInfo: any;

        try {
          accountInfo = await mt5McpService.getAccountInfo();
          symbolInfo = await mt5McpService.getSymbolInfo(analysis.symbol);
        } catch (e: any) {
          this.addLog(userId, "ERROR", `[3/4] [${signal.symbol}] MT5 DATA FAILED: Cannot retrieve account/symbol info — ${e.message}`);
          continue;
        }

        let riskMultiplier = 1;
        if (pipeline.config.smartRisk?.enabled) {
          const smart = pipeline.config.smartRisk;
          
          if (smart.drawdownRecovery?.enabled && pipeline.currentDrawdownPct !== undefined) {
             if (pipeline.currentDrawdownPct >= smart.drawdownRecovery.activationDrawdownPct) {
               riskMultiplier = smart.drawdownRecovery.riskReductionMultiplier;
               this.addLog(userId, "INFO", `[3/4] [SMART-RISK] Drawdown Recovery Active (DD: ${pipeline.currentDrawdownPct.toFixed(2)}%). Risk reduced to ${riskMultiplier}x.`);
             }
          }
          
          if (riskMultiplier === 1 && smart.capitalPreservation?.enabled && pipeline.currentGrowthPct !== undefined) {
             if (pipeline.currentGrowthPct >= smart.capitalPreservation.activationGrowthPct) {
               riskMultiplier = smart.capitalPreservation.riskReductionMultiplier;
               this.addLog(userId, "INFO", `[3/4] [SMART-RISK] Capital Preservation Active (Growth: ${pipeline.currentGrowthPct.toFixed(2)}%). Risk reduced to ${riskMultiplier}x to protect profit.`);
             }
          }
        }
        
        pipeline.currentRiskMultiplier = riskMultiplier;
        const finalRiskPercent = pipeline.config.maxRiskPerTrade * riskMultiplier;

        volume = finalRiskPercent;
        if (symbolInfo) {
          volume = aiTradingEngine.calculatePositionSize({
            accountBalance: accountInfo.balance,
            riskPercent: finalRiskPercent,
            entryPrice: signal.entry,
            stopLoss: signal.sl,
            contractSize: symbolInfo.tradeContractSize,
            volumeMin: symbolInfo.volumeMin,
            volumeMax: symbolInfo.volumeMax,
            volumeStep: symbolInfo.volumeStep,
            symbol: signal.symbol,
          });

          if (volume === 0) {
            this.addLog(userId, "ERROR",
              `[3/4] [${signal.symbol}] REJECTED (POSITION SIZE): SL distance (${Math.abs(signal.entry - signal.sl).toFixed(5)}) too wide for minimum volume (${symbolInfo.volumeMin}) within ${finalRiskPercent}% risk limit.`
            );
            continue;
          }
        }

        this.addLog(userId, "INFO",
          `[3/4] [${signal.symbol}] POSITION SIZE: ${volume} Lot (Risk: ${finalRiskPercent}%, Balance: $${accountInfo.balance.toFixed(2)}, Cap: 1.0 Lot)`
        );

        if (pipeline.mt5CircuitOpen || !mt5McpService.isConnected) {
          this.addLog(userId, "ERROR", `[3/4] [${signal.symbol}] MT5 circuit breaker OPEN or disconnected. Skipping execution.`);
          continue;
        }

        let finalAction: any = signal.direction;
        let orderPrice: number | undefined = undefined;

        try {
          const tickData = await mt5McpService.getTick(signal.symbol);
          if (!tickData) {
            throw new Error("No tick data available");
          }
          const currentPrice = signal.direction === "BUY" ? tickData.ask : tickData.bid;
          const pointDist = Math.abs(currentPrice - signal.entry);
          
          const symInfoForThreshold = await mt5McpService.getSymbolInfo(signal.symbol);
          const minPendingDist = symInfoForThreshold
            ? symInfoForThreshold.spread * symInfoForThreshold.point
            : 0.0003;
          
          if (pointDist > minPendingDist) { 
            if (signal.direction === "BUY") {
              finalAction = currentPrice > signal.entry ? "BUY_LIMIT" : "BUY_STOP";
            } else {
              finalAction = currentPrice < signal.entry ? "SELL_LIMIT" : "SELL_STOP";
            }
            orderPrice = signal.entry;
          }
        } catch (e: any) {
          this.addLog(userId, "WARN", `[3/4] [${signal.symbol}] Failed to get tick or determine order type, fallback to Market Order. Error: ${e.message}`);
        }

        const isPending = finalAction !== signal.direction;

        let validation: { valid: boolean; error?: string };
        try {
          validation = await this.validateOrderParams(
            signal.symbol,
            signal.direction,
            volume,
            signal.sl,
            signal.tp,
            2.0,
            isPending,
            signal.entry,
          );
        } catch (e: any) {
          this.addLog(userId, "ERROR", `[3/4] [${signal.symbol}] VALIDATION ERROR: ${e.message}`);
          continue;
        }

        if (!validation.valid) {
          this.addLog(userId, "ERROR", `[3/4] [${signal.symbol}] REJECTED (VALIDATION): ${validation.error}`);
          continue;
        }

        this.addLog(userId, "INFO", `[3/4] [${signal.symbol}] ORDER VALIDATED: Action: ${finalAction} | Vol: ${volume} | Entry: ${signal.entry} | SL: ${signal.sl} | TP: ${signal.tp}`);

        // ── STAGE 3 EXECUTION: ORDER EXECUTION ───────────────────────────────
        // Offset SL by broker spread: BUY SL in BID, SELL SL in ASK
        // SL di-offset supaya spread tidak eat SL distance saat entry
        const sym = symbolInfo;
        const spreadPrice = sym ? sym.spread * sym.point : 0;
        const adjustedSl = spreadPrice > 0 && signal.sl > 0
          ? (finalAction.startsWith("BUY") ? signal.sl - spreadPrice : signal.sl + spreadPrice)
          : signal.sl;

        let orderResult: any;
        try {
          orderResult = await mt5McpService.openOrder({
            symbol: signal.symbol,
            action: finalAction,
            volume,
            price: orderPrice,
            sl: adjustedSl,
            tp: signal.tp,
            comment: `AI-${analysis.confluence.finalSignal.primaryMethodology.toUpperCase()}-C${signal.confidence}`,
          });
        } catch (e: any) {
          this.addLog(userId, "ERROR", `[3/4] [${signal.symbol}] MT5 ORDER EXCEPTION: ${e.message}`);
          continue;
        }

        if (orderResult.success) {
            const slDist = Math.abs(signal.entry - signal.sl);
            const tpDist = Math.abs(signal.tp - signal.entry);
            const rrRatio = slDist > 0 ? (tpDist / slDist) : 0;
            const primaryMethodology = analysis.confluence?.finalSignal?.primaryMethodology?.toUpperCase() || "UNKNOWN";
            const patternStr = analysis.confluence?.finalSignal?.pattern ? ` (${analysis.confluence.finalSignal.pattern})` : '';

            // For pending orders, if we got ticket=0, we need to poll for the actual ticket
            let finalTicket = orderResult.ticket;
            if (isPending && finalTicket === 0) {
                // Small delay then check positions for the newly created pending order
                await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
                const positions = await mt5McpService.getPositions();
                const newPosition = positions.find(pos => {
                    if (!pos) return false;
                    if (pos.symbol !== signal.symbol) return false;
                    if (pos.type !== finalAction) return false;
                    if (Math.abs(pos.volume - volume) >= 0.001) return false;
                    // Safely check comment including
                    const comment = pos.comment || '';
                    const expectedCommentPrefix = `AI-${analysis.confluence?.finalSignal?.primaryMethodology?.toUpperCase() || 'UNKNOWN'}-C${signal.confidence}`;
                    if (!comment.includes(expectedCommentPrefix)) return false;
                    return true;
                });
                if (newPosition) {
                    finalTicket = newPosition.ticket;
                    this.addLog(userId, "INFO", `[3/4] [${signal.symbol}] Found pending ticket via polling: #${finalTicket}`);
                } else {
                    this.addLog(userId, "WARN", `[3/4] [${signal.symbol}] Could not find pending order via polling after placement`);
                }
            }

            this.addLog(userId, "TRADE",
                `[3/4] [${signal.symbol}] EXECUTION SUCCESS: ${isPending ? "Placed pending" : "Opened"} ${finalAction} vol=${volume} ticket=#${finalTicket} | R:R 1:${rrRatio.toFixed(2)} [${primaryMethodology}]${patternStr}`,
                { signal, orderResult: {...orderResult, ticket: finalTicket}, confluence: analysis.confluence },
            );

            if (isPending && finalTicket) {
                const expiryMs = this.getIntervalMs(pipeline.config.timeframe) * 2 * 60;
                pipeline.pendingOrders.set(finalTicket, {
                    symbol: signal.symbol,
                    direction: signal.direction,
                    entry: signal.entry,
                    tp: signal.tp,
                    sl: signal.sl,
                    placedAt: Date.now(),
                    expiryAt: Date.now() + expiryMs,
                });
            }

          const accInfo = await mt5McpService.getAccountInfo();
          
          await AITradeLog.create({
            userId,
            accountId: accInfo?.login?.toString(),
            signal: {
              symbol: signal.symbol,
              direction: signal.direction,
              confidence: signal.confidence,
              entry: signal.entry,
              sl: signal.sl,
              tp: signal.tp,
              reason: signal.reason,
              timeframe: signal.timeframe,
              indicators: signal.indicators,
              pattern: signal.pattern,
              primaryMethodology: analysis.confluence.finalSignal.primaryMethodology,
              methodologyBreakdown: analysis.confluence.methodologyBreakdown,
            },
            executed: true,
            executionPrice: orderResult.price,
            executionTime: new Date(),
            mt5Ticket: orderResult.ticket,
            positionSize: volume,
            closed: false,
          });
        } else {
          this.addLog(userId, "ERROR",
            `[7/7] [${signal.symbol}] EXECUTION FAILED: ${orderResult.error}`,
            orderResult,
          );
        }
      }

      pipeline.lastError = null;
      } catch (error: any) {
        pipeline.lastError = error.message;
        this.addLog(userId, "ERROR", `Pipeline error: ${error.message} [symbol: ${currentSymbol}]`);
        silentLogger.error(`[PIPELINE] Error for ${userId}: ${error.message}`);
      } finally {
        if (currentSymbol) pipeline.busySymbols.delete(currentSymbol);
        pipeline.running = false;
      }
    }
  private marketClosedCache = new Map<string, number>();

  private async managePositions(userId: string): Promise<void> {
    const pipeline = this.activePipelines.get(userId);
    if (!pipeline) return;

    // ── Concurrency Lock: Skip if pipelineLoop is processing orders for any symbol ──
    if (pipeline.busySymbols.size > 0) {
      silentLogger.debug(`[TRAILING] Skipped managePositions due to busySymbols: ${Array.from(pipeline.busySymbols).join(", ")}`);
      return;
    }

    // ── Pending Order Expiry Management ──────────────────────────────
    if (pipeline.pendingOrders.size > 0) {
      try {
        const orders = await mt5McpService.call("mt5_orders_get", {});
        const activeTickets = new Set((orders || []).map((o: any) => o.ticket));

        for (const [ticket, info] of pipeline.pendingOrders) {
          // Remove if already filled (no longer in pending orders list)
          if (!activeTickets.has(ticket)) {
            pipeline.pendingOrders.delete(ticket);
            continue;
          }
          // Cancel if expired
          if (Date.now() >= info.expiryAt) {
            try {
              await mt5McpService.call("mt5_order_cancel", { ticket });
              this.addLog(userId, "INFO",
                `[EXPIRY] Pending order #${ticket} (${info.symbol}) expired after 2 candles — cancelled.`
              );
              await AITradeLog.updateOne(
                { mt5Ticket: ticket, closed: false },
                { closed: true, closedAt: new Date(), closeReason: "TIMEOUT", pnl: 0 }
              );
            } catch (cancelErr: any) {
              silentLogger.warn(`[PIPELINE] Failed to cancel expired order #${ticket}: ${cancelErr.message}`);
            }
            pipeline.pendingOrders.delete(ticket);
            continue;
          }
          // Cancel if TP target already hit (price went past TP before entry filled)
          try {
            const tick = await mt5McpService.getTick(info.symbol);
            if (tick) {
              const isBuy = info.direction === "BUY";
              const spot = isBuy ? tick.bid : tick.ask;
              if (isBuy && spot >= info.tp) {
                await mt5McpService.call("mt5_order_cancel", { ticket });
                this.addLog(userId, "INFO",
                  `[INVALID] Pending order #${ticket} (${info.symbol}) cancelled — TP ${info.tp} already reached before entry ${info.entry}.`
                );
                await AITradeLog.updateOne(
                  { mt5Ticket: ticket, closed: false },
                  { closed: true, closedAt: new Date(), closeReason: "TP_ALREADY_HIT", pnl: 0 }
                );
                pipeline.pendingOrders.delete(ticket);
                continue;
              }
              if (!isBuy && spot <= info.tp) {
                await mt5McpService.call("mt5_order_cancel", { ticket });
                this.addLog(userId, "INFO",
                  `[INVALID] Pending order #${ticket} (${info.symbol}) cancelled — TP ${info.tp} already reached before entry ${info.entry}.`
                );
                await AITradeLog.updateOne(
                  { mt5Ticket: ticket, closed: false },
                  { closed: true, closedAt: new Date(), closeReason: "TP_ALREADY_HIT", pnl: 0 }
                );
                pipeline.pendingOrders.delete(ticket);
                continue;
              }
            }
          } catch (tickErr: any) {
            silentLogger.warn(`[PIPELINE] TP check failed for pending order #${ticket}: ${tickErr.message}`);
          }
        }
      } catch (e: any) {
        silentLogger.warn(`[PIPELINE] Pending order check error: ${e.message}`);
      }
    }

    // ── Trailing Stop Management ─────────────────────────────────────
    if (!pipeline.config.trailingStop.enabled) return;
    if (!mt5McpService.isConnected) return;

    try {
      const allPositions = await mt5McpService.getPositions();

      // Build AI ticket set dari AITradeLog (sumber kebenaran) karena broker bisa clear comment
      const aiOpenLogs = await AITradeLog.find({ userId, closed: false, mt5Ticket: { $exists: true, $gt: 0 } }).lean();
      const aiTickets = new Set(aiOpenLogs.map(t => t.mt5Ticket));

      // Hanya kelola posisi yang dibuka AI: match via AITradeLog ticket, fallback ke comment
      const aiPositions = allPositions.filter(p =>
        aiTickets.has(p.ticket) ||
        (p.comment && (p.comment.startsWith("AI-") || p.comment.toLowerCase().includes("ai-")))
      );

      if (aiPositions.length === 0) {
        silentLogger.debug(`[TRAILING] No AI positions found. Total positions: ${allPositions.length}, AI tickets in DB: ${aiTickets.size}`);
      }

      for (const pos of aiPositions) {
        // Cek cooldown market closed (30 menit)
        const closedTime = this.marketClosedCache.get(pos.symbol);
        if (closedTime && Date.now() - closedTime < 1000 * 60 * 30) {
          continue; 
        }

        const rates = await mt5McpService.getRates(
          pos.symbol,
          pipeline.config.timeframe,
          15,
        );
        const atrValue = this.calculateATRSimple(rates);

        if (atrValue === 0) continue;

        // ── BREAKEVEN: Jika harga bergerak 1× ATR sesuai prediksi → SL geser ke entry
        // Hanya jika breakEven di-enabled di config
        let shouldBreakeven = false;
        if (pipeline.config.trailingStop.breakEven) {
          const breakevenDistance = atrValue * 1.0;

          // Memberikan toleransi floating point MT5 untuk mencegah spam 'No changes'
          const EPSILON = 0.00001;
          if (pos.type === "BUY" && pos.priceCurrent >= pos.priceOpen + breakevenDistance) {
            if (pos.sl < pos.priceOpen - EPSILON) {
              shouldBreakeven = true;
            }
          } else if (pos.type === "SELL" && pos.priceCurrent <= pos.priceOpen - breakevenDistance) {
            if (pos.sl > pos.priceOpen + EPSILON) {
              shouldBreakeven = true;
            }
          }
        }

        // Helper untuk mencegah spam saat gagal
        const safeMt5Call = async (callFn: () => Promise<any>): Promise<boolean> => {
          try {
            await callFn();
            return true;
          } catch (err: any) {
            const msg = err.message || "";
            if (msg.includes("Market closed") || msg.includes("10018")) {
              this.marketClosedCache.set(pos.symbol, Date.now());
              silentLogger.warn(`[Pipeline] Market closed untuk ${pos.symbol}, menunda operasi selama 30 menit.`);
            } else if (msg.includes("10025") || msg.includes("No changes")) {
              // Jika tidak ada perubahan SL/TP karena harganya sama persis, abaikan secara diam-diam.
              return true;
            } else {
              silentLogger.error(`[Pipeline] Failed MT5 operation pada tiket ${pos.ticket}: ${msg}`);
            }
            return false;
          }
        };

        if (shouldBreakeven) {
          const success = await safeMt5Call(() => mt5McpService.modifyPosition(pos.ticket, pos.priceOpen, pos.tp));
          if (success) {
            this.addLog(userId, "TRAILING",
              `Trailing: Memodifikasi posisi nomor ticket ${pos.ticket} (${pos.symbol}) — Breakeven, SL digeser ke entry ${pos.priceOpen.toFixed(5)}`,
              { ticket: pos.ticket, newSL: pos.priceOpen },
            );
          }
          continue; // Skip trailing this cycle — breakeven happens first
        }


        // ── TRAILING STOP: Geser SL mengikuti harga (existing logic) ──────
        const result = aiTradingEngine.calculateTrailingStopSL({
          positionType: pos.type,
          currentPrice: pos.priceCurrent,
          currentSL: pos.sl,
          atrValue,
          trailATR: pipeline.config.trailingStop.trailATR,
          activationATR: pipeline.config.trailingStop.activationATR,
          entryPrice: pos.priceOpen,
        });

        if (result.shouldUpdate) {
          const success = await safeMt5Call(() => mt5McpService.modifyPosition(pos.ticket, result.newSL!, pos.tp));
          if (success) {
            this.addLog(userId, "TRAILING",
              `Trailing: Memodifikasi posisi nomor ticket ${pos.ticket} (${pos.symbol}) — ${result.reason}`,
              { ticket: pos.ticket, newSL: result.newSL },
            );
          }
        }
      }
    } catch (error: any) {
      silentLogger.error(`[PIPELINE] managePositions error: ${error.message}`);
    }
  }

  /**
   * Synchronize closed MT5 positions with the AI trade logs DB.
   */
  private async syncClosedPositions(userId: string): Promise<void> {
    const pipeline = this.activePipelines.get(userId);
    if (!pipeline) return;

    try {
      if (!mt5McpService.isConnected) return;
      const accountInfo = await mt5McpService.getAccountInfo();
      const accountId = accountInfo?.login?.toString();

      const query: any = { userId, closed: false };
      if (accountId) query.accountId = accountId;

      // 1. Fetch all trade logs that are still marked as OPEN (closed: false)
      const openLogs = await AITradeLog.find(query);
      if (openLogs.length === 0) return;

      // 2. Fetch active positions from MT5
      const activePositions = await mt5McpService.getPositions();
      const activeTickets = new Set(activePositions.map(p => p.ticket));
      silentLogger.debug(`[PIPELINE] syncClosedPositions: ${openLogs.length} open logs, ${activePositions.length} active positions`);

      // 3. Find trade logs whose positions are no longer in MT5 active positions (meaning they closed)
      const closedLogs = openLogs.filter(log => log.mt5Ticket && !activeTickets.has(log.mt5Ticket));
      if (closedLogs.length === 0) return;
      silentLogger.debug(`[PIPELINE] syncClosedPositions: ${closedLogs.length} logs detected as closed`);

      // 4. Fetch last 7 days of deal history from MT5 (fast path)
      const sevenDaysAgo = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
      const deals = await mt5McpService.getHistory(sevenDaysAgo);

      // 4b. Also fetch full history as fallback for older trades
      let fullDeals: any[] | null = null;

      for (const log of closedLogs) {
        if (!log.mt5Ticket) continue;

        // Find the OUT deal (entry === 1) that closed this position
        let closingDeal = deals.find(
          d => String(d.position_id) === String(log.mt5Ticket) && d.entry === 1
        );

        // Fallback: if not found in 7-day window, try full history
        if (!closingDeal) {
          if (!fullDeals) {
            fullDeals = await mt5McpService.getHistory(0); // fetch all available
          }
          closingDeal = fullDeals.find(
            d => String(d.position_id) === String(log.mt5Ticket) && d.entry === 1
          );
        }

        if (closingDeal) {
          const pnl = closingDeal.profit + closingDeal.commission + closingDeal.swap;
          
          let closeReason: "TP_HIT" | "SL_HIT" | "MANUAL" = "MANUAL";
          const commentLower = (closingDeal.comment || "").toLowerCase();
          if (commentLower.includes("take profit") || commentLower.includes("tp") || commentLower.includes("[tp]")) {
            closeReason = "TP_HIT";
          } else if (commentLower.includes("stop loss") || commentLower.includes("sl") || commentLower.includes("[sl]")) {
            closeReason = "SL_HIT";
          } else {
            // Compare closing price with log's SL/TP
            const closePrice = closingDeal.price;
            const EPSILON = 0.0001;
            if (log.signal.tp > 0 && Math.abs(closePrice - log.signal.tp) < EPSILON) {
              closeReason = "TP_HIT";
            } else if (log.signal.sl > 0 && Math.abs(closePrice - log.signal.sl) < EPSILON) {
              closeReason = "SL_HIT";
            }
          }

          // Calculate pips
          const entryPrice = log.executionPrice || log.signal.entry;
          const closePrice = closingDeal.price;
          const pipsDiff = log.signal.direction === "BUY" ? (closePrice - entryPrice) : (entryPrice - closePrice);
          const isJpy = log.signal.symbol.toLowerCase().includes("jpy");
          const pipSize = isJpy ? 0.01 : 0.0001;
          const pnlPips = Math.round(pipsDiff / pipSize * 10) / 10;

          // PnL Percent
          const accountInfo = await mt5McpService.getAccountInfo();
          const balance = accountInfo?.balance || 10000;
          const pnlPercent = Math.round((pnl / balance) * 100 * 100) / 100;

          // Save to DB
          log.closed = true;
          log.closedAt = new Date(closingDeal.time * 1000);
          log.closePrice = closePrice;
          log.closeReason = closeReason;
          log.pnl = Math.round(pnl * 100) / 100;
          log.pnlPips = pnlPips;
          log.pnlPercent = pnlPercent;

          await log.save();

          this.addLog(userId, "INFO",
            `[SYNC] Posisi #${log.mt5Ticket} (${log.signal.symbol}) terdeteksi tutup. Hasil: ${closeReason} | PnL: $${log.pnl.toFixed(2)} (${log.pnlPercent}%)`
          );
        } else {
          // Fallback: jangan tutup paksa — biarkan retry di siklus berikutnya tanpa spamming UI
          silentLogger.debug(
            `[PIPELINE] [SYNC] Posisi #${log.mt5Ticket} (${log.signal.symbol}) menunggu konfirmasi deal di MT5. Akan retry siklus berikutnya.`
          );
        }
      }
    } catch (err: any) {
      silentLogger.warn(`[PIPELINE] syncClosedPositions error: ${err.message}`);
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────

  private addLog(
    userId: string,
    type: PipelineLog["type"],
    message: string,
    data?: any,
  ): void {
    const pipeline = this.activePipelines.get(userId);
    if (!pipeline) return;

    pipeline.logs.push({
      time: new Date().toISOString(),
      type,
      message,
      data,
    });

    if (pipeline.logs.length > 1000) {
      pipeline.logs = pipeline.logs.slice(-1000);
    }
  }

  private getIntervalMs(timeframe: string): number {
    // Signal analysis interval — check ~2× per candle (trailing runs separately at 10s)
    switch (timeframe) {
      case "M1": return 15_000;    // 15s — check 4× per M1 candle
      case "M5": return 60_000;    // 60s — check ~5× per M5 candle
      case "M15": return 120_000;  // 120s — check ~7× per M15 candle
      case "M30": return 180_000;  // 180s — check ~10× per M30 candle
      case "H1": return 300_000;   // 300s — check ~12× per H1 candle
      case "H4": return 600_000;   // 600s — check ~24× per H4 candle
      default: return 120_000;
    }
  }

  private isInVolatileSessionWindow(symbol: string): boolean {
    // Skip session filter for crypto (24/7 market)
    if (/^(BTC|ETH|LTC|XRP|SOL|DOGE|ADA|BCH|DOT|LINK|UNI)/i.test(symbol)) return false;

    // Use NY time (EST/EDT = UTC-4/5). Daylight saving auto-handled by Intl API.
    const now = new Date();
    const nyFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit", minute: "2-digit", hour12: false,
    });
    const parts = nyFormatter.formatToParts(now);
    const nyHour = parseInt(parts.find(p => p.type === "hour")?.value ?? "0");
    const nyMinutes = parseInt(parts.find(p => p.type === "minute")?.value ?? "0");
    const nyMinutesOfDay = nyHour * 60 + nyMinutes;

    // Volatile windows (NY time):
    // 03:00-04:00 — London open (first hour, spike volatility)
    // 08:30-09:30 — NY open + major US data releases (NFP, CPI, FOMC)
    // 15:30-16:30 — London close (liquidity withdrawal)
    const volatileWindows = [
      { start: 3 * 60, end: 4 * 60 },           // 03:00-04:00 NY
      { start: 8 * 60 + 30, end: 9 * 60 + 30 }, // 08:30-09:30 NY
      { start: 15 * 60 + 30, end: 16 * 60 + 30 }, // 15:30-16:30 NY
    ];

    for (const w of volatileWindows) {
      if (nyMinutesOfDay >= w.start && nyMinutesOfDay < w.end) return true;
    }
    return false;
  }

  private isWithinTradingHours(config: PipelineConfig): boolean {
    if (!config.tradingHours) return true;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startH, startM] = config.tradingHours.start.split(":").map(Number);
    const [endH, endM] = config.tradingHours.end.split(":").map(Number);
    const startMin = startH * 60 + startM;
    const endMin = endH * 60 + endM;

    if (startMin <= endMin) {
      return currentMinutes >= startMin && currentMinutes <= endMin;
    }
    return currentMinutes >= startMin || currentMinutes <= endMin;
  }

  calculateATRSimple(rates: { high: number; low: number; close: number }[]): number {
    if (rates.length < 2) return 0;
    let sum = 0;
    for (let i = 1; i < rates.length; i++) {
      const tr = Math.max(
        rates[i].high - rates[i].low,
        Math.abs(rates[i].high - rates[i - 1].close),
        Math.abs(rates[i].low - rates[i - 1].close),
      );
      sum += tr;
    }
    return sum / (rates.length - 1);
  }
}
 
export const tradingPipelineService = new TradingPipelineService();
