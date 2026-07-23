import { mt5McpService, CircuitBreaker } from "./mt5-mcp.service";
import { aiTradingEngine, type TradingSignal, type Timeframe, type MultiStrategySymbolAnalysis, type Candle } from "./ai-trading-engine.service";
import { riskManagerService } from "./risk-manager.service";
import { llmConsensusService, type LLMConsensusConfig, type LLMConsensusResult } from "./llm-consensus.service";
import { newsCalendarService } from "./news-calendar.service";
import { fundamentalResearchService } from "./fundamental-research.service";
import { marketRegimeService } from "./market-regime.service";
import { multiTimeframeService } from "./multi-timeframe.service";
import { tradeExitStrategyService } from "./trade-exit-strategy.service";
import { AITradingSession } from "../models/AITradingSession";
import { AITradeLog } from "../models/AITradeLog";
import { silentLogger } from "../utils/silent-logger";
import type { MethodologyWeights, MethodologyName } from "./strategies/index";
import { DEFAULT_METHODOLOGY_WEIGHTS } from "./strategies/index";

// ─── Circuit Breaker for LLM Consensus ────────────────────────────────────
class LLMCircuitBreaker {
  private circuits: Map<string, CircuitBreaker> = new Map();
  
  getCircuit(providerName: string): CircuitBreaker {
    if (!this.circuits.has(providerName)) {
      this.circuits.set(providerName, new CircuitBreaker(3, 2, 60000)); // Lower threshold for LLM
    }
    return this.circuits.get(providerName)!;
  }
  
  canExecute(providerName: string): boolean {
    return this.getCircuit(providerName).canExecute();
  }
  
  recordSuccess(providerName: string): void {
    this.getCircuit(providerName).recordSuccess();
  }
  
  recordFailure(providerName: string): void {
    this.getCircuit(providerName).recordFailure();
  }
  
  getAllStates(): Record<string, string> {
    const states: Record<string, string> = {};
    for (const [name, circuit] of this.circuits) {
      states[name] = circuit.getState();
    }
    return states;
  }
  
  getAvailableProviders(allProviders: string[]): string[] {
    return allProviders.filter(p => this.getCircuit(p).canExecute());
  }
}

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
  lastError: string | null;
  // Circuit breaker states
  mt5CircuitState?: string;
  llmCircuitStates?: Record<string, string>;
}

export interface PipelineLog {
  time: string;
  type: "INFO" | "SIGNAL" | "TRADE" | "ERROR" | "TRAILING" | "CONFLUENCE" | "IPDA";
  message: string;
  data?: any;
}

const DEFAULT_CONFIG: PipelineConfig = {
  symbols: [],
  timeframe: "M15",
  strategy: "MULTI_METHODOLOGY",
  maxOpenPositions: 3,
  maxRiskPerTrade: 1.0,
  maxDailyRisk: 3.0,
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
      pendingOrders: Map<number, { symbol: string; placedAt: number; expiryAt: number }>;
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
      cachedMetrics?: {
        totalTrades: number;
        winningTrades: number;
        losingTrades: number;
        allTimePnL: number;
        dailyPnLSum: number;
      };
      lastMetricsUpdate?: number;
    }
  > = new Map();

  private llmCircuitBreaker = new LLMCircuitBreaker();

  // ─── Cache ────────────────────────────────────────────────────────────
  private regimeCache = new Map<string, { regime: string; multipliers: Record<string, number>; timestamp: number }>();
  private fundamentalCache = new Map<string, { score: any; timestamp: number }>();
  private readonly REGIME_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
  private readonly FUNDAMENTAL_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

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

  private getCachedFundamental(symbol: string): any | null {
    const cached = this.fundamentalCache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.FUNDAMENTAL_CACHE_TTL_MS) {
      return cached.score;
    }
    if (cached) this.fundamentalCache.delete(symbol);
    return null;
  }

  private setCachedFundamental(symbol: string, score: any): void {
    this.fundamentalCache.set(symbol, { score, timestamp: Date.now() });
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
      pendingOrders: new Map<number, { symbol: string; placedAt: number; expiryAt: number }>(),
      startOfDayEquity: 0,
      currentDayStr: new Date().toLocaleDateString(),
      peakEquity: 0,
      initialBalance: 0,
      dailyTradingBlocked: false,
      currentDrawdownPct: 0,
      currentGrowthPct: 0,
      currentRiskMultiplier: 1,
    };

    this.activePipelines.set(userId, pipeline);

    try {
      const accountInfo = await mt5McpService.getAccountInfo();
      const positions = await mt5McpService.getPositions();
      const symbolPositions = positions.filter(p => merged.symbols.includes(p.symbol));
      
      pipeline.initialBalance = accountInfo?.balance || 0;
      pipeline.startOfDayEquity = accountInfo?.equity || 0;
      pipeline.peakEquity = accountInfo?.equity || 0;

      this.addLog(userId, "INFO",
        `Pipeline started: ${merged.symbols.join(", ")} on ${merged.timeframe} [${merged.activeMethodologies!.length} methodologies] | Risk: ${merged.maxRiskPerTrade}% | Balance: $${accountInfo?.balance?.toFixed(2) || 0} | Positions: ${symbolPositions.length}/${merged.maxOpenPositions}`
      );
    } catch (e: any) {
      this.addLog(userId, "INFO",
        `Pipeline started: ${merged.symbols.join(", ")} on ${merged.timeframe} [${merged.activeMethodologies!.length} methodologies] | Risk: ${merged.maxRiskPerTrade}% | MT5 Info unavailable`
      );
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

  async stopPipeline(userId: string): Promise<void> {
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
      this.addLog(userId, "INFO", "Pipeline stopped");
    }

    this.activePipelines.delete(userId);

    await AITradingSession.findOneAndUpdate(
      { userId, status: "RUNNING" },
      { status: "STOPPED", stoppedAt: new Date() },
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
        lastError: null,
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
          lastError: pipeline.lastError,
          mt5CircuitState: "DISCONNECTED",
          llmCircuitStates: pipeline.llmCircuitStates,
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
      lastError: pipeline.lastError,
      mt5CircuitState: mt5McpService.circuitBreakerState,
      llmCircuitStates: this.llmCircuitBreaker.getAllStates(),
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
        // spread dari MT5 sudah dalam unit point, kalikan dengan point untuk dapat satuan harga
        const spreadPrice = symbolInfo.spread * symbolInfo.point;
        const minSlDistance = Math.max(spreadPrice * 2, symbolInfo.point * 10);

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
            // Market execution: warn if below min, block only if extreme
            if (rrRatio < 0.3) {
              return { valid: false, error: `Risk:Reward ratio sangat rendah (${rrRatio.toFixed(2)}:1). Trade ditolak karena risiko berlebihan.` };
            }
            if (rrRatio < minRRRatio) {
              silentLogger.warn(`[PIPELINE] Market order RR ${rrRatio.toFixed(2)}:1 (below min ${minRRRatio}:1) — executing anyway`);
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

      // Skip Forex/Commodities/Indices on weekends (Saturday & Sunday) to save API tokens and avoid locked market errors
      const day = new Date().getDay();
      const isWeekend = day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
      const isCrypto = /^(BTC|ETH|LTC|XRP|SOL|DOGE|ADA|BCH|DOT|LINK|UNI)/i.test(symbol);
      if (isWeekend && !isCrypto) {
        return; // Skip non-crypto pairs on weekends
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
            regimeMult = marketRegimeService.getRegimeMultipliers(currentRegime);
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
        const filteredWeightsStr = Object.entries(adjustedWeights)
          .filter(([k]) => pipeline.config.activeMethodologies?.includes(k as any))
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
            pipeline.config.activeMethodologies,
          );

          if (analyses.length > 0 && analyses[0].ipdaContext) {
            const ipda = analyses[0].ipdaContext;
            this.addLog(userId, "IPDA",
              `[${analyses[0].symbol}] Bias: ${ipda.dailyBias.bias} (${ipda.dailyBias.confidence}%) | State: ${ipda.intraday.state} (${ipda.intraday.confidence}%) | KZ: ${ipda.currentKillzone} | Retrace: ${(ipda.intraday.retracementRatio * 100).toFixed(0)}%`,
              { ipdaContext: ipda },
            );
          }
      } catch (err: any) {
        silentLogger.error(`[PIPELINE] Error analyzing symbols: ${err.message}`);
        // Jika error jaringan MT5, putuskan status agar tick berikutnya masuk ke Auto-Pause
        if (err.message.includes("MT5") || err.message.includes("connect") || err.message.includes("timeout") || err.message.includes("32001")) {
          mt5McpService.forceDisconnect();
        }
        return; // Abort this iteration gracefully
      }

      for (const analysis of analyses) {
        // Store analysis for status display only if it contains a valid signal
        if (analysis.confluence.finalSignal) {
          pipeline.lastAnalysis = analysis;
        }

        // Update the last analyzed candle time for this symbol
        const latestTime = latestCandleTimes.get(analysis.symbol);
        if (latestTime !== undefined) {
          pipeline.lastAnalyzedCandleTimes.set(analysis.symbol, latestTime);
        }

        // Apply AI Backtest Skill filters (dynamically skip unprofitable pairs or methodologies)
        try {
          const { aiBacktestSkillService } = require("./ai-backtest-skill.service");
          const skill = await aiBacktestSkillService.getSkill(userId);
          if (skill) {
            // Check if symbol is marked unprofitable
            const symRanking = skill.symbolRankings.find((s: any) => s.symbol === analysis.symbol);
            if (symRanking && symRanking.totalBacktests >= 3 && symRanking.score < 40) {
              this.addLog(userId, "INFO", `[AI-SKILL] Skipped trade signal on ${analysis.symbol} due to low backtest rating (Score: ${symRanking.score})`);
              continue;
            }

            // Skip signal if the primary methodology is marked as DISABLE
            const primaryMeth = analysis.confluence.finalSignal?.primaryMethodology;
            if (primaryMeth) {
              const methRanking = skill.methodologyRankings.find((m: any) => m.methodology === primaryMeth);
              if (methRanking && methRanking.verdict === "DISABLE") {
                this.addLog(userId, "INFO", `[AI-SKILL] Skipped trade signal on ${analysis.symbol} - methodology [${primaryMeth}] is disabled based on backtest performance`);
                continue;
              }
            }
          }
        } catch (skillErr: any) {
          silentLogger.error(`[PIPELINE] AI Skill filtering failed: ${skillErr.message}`);
        }

        if (!analysis.confluence.finalSignal) {
          // Log methodology breakdown even when no trade
          if (analysis.confluence.conflictDetected) {
            this.addLog(userId, "CONFLUENCE",
              `No trade: ${analysis.confluence.reason}`,
              analysis.confluence.methodologyBreakdown,
            );
          } else {
            // Log methodology votes even if no final signal
            const breakdown = analysis.confluence.methodologyBreakdown;
            const votes = Object.entries(breakdown)
              .filter(([, v]) => (v as any).confidence > 0)
              .map(([k, v]) => `${k}=${(v as any).direction ?? '-'}(${(v as any).confidence ?? 0}%)`)
              .join(", ");
            const alignInfo = analysis.methodologySignals
              ? ` | SMC:${analysis.methodologySignals.smc.length} ICT:${analysis.methodologySignals.ict.length} MSNR:${analysis.methodologySignals.msnr.length} raw signals`
              : "";
            this.addLog(userId, "CONFLUENCE",
              `[${analysis.symbol}] No signal. Votes: ${votes || "none"}${alignInfo}`,
              breakdown,
            );
          }
          continue;
        }

        // ── Signal Accepted: Log confluence details ──────────────
        this.addLog(userId, "CONFLUENCE",
          `[${analysis.symbol}] Signal: ${analysis.confluence.finalSignal.direction} | ` +
          `Score: ${analysis.confluence.finalSignal.confluenceScore}% → ${analysis.confluence.finalSignal.confidence}% | ` +
          `Primary: ${analysis.confluence.finalSignal.primaryMethodology} | ` +
          `Agreeing: ${analysis.confluence.finalSignal.totalAgreeing}/${pipeline.config.activeMethodologies?.length ?? 0}`,
          analysis.confluence.methodologyBreakdown,
        );

        const signal: TradingSignal = {
          symbol: analysis.symbol,
          direction: analysis.confluence.finalSignal.direction,
          confidence: analysis.confluence.finalSignal.confidence,
          entry: analysis.confluence.finalSignal.entry,
          sl: analysis.confluence.finalSignal.sl,
          tp: analysis.confluence.finalSignal.tp,
          reason: analysis.confluence.reason,
          riskPercent: pipeline.config.maxRiskPerTrade,
          timeframe: pipeline.config.timeframe,
          indicators: { rsi: analysis.signal.rsi, atr: analysis.signal.atr },
          pattern: `MULTI_${analysis.confluence.finalSignal.primaryMethodology.toUpperCase()}`,
        };

        pipeline.lastSignal = signal;

        // ── DATA FEED LOG: current bid/ask vs signal entry ─────────
        try {
          const tick = await mt5McpService.call("mt5_symbol_tick", { symbol: signal.symbol });
          const feedBid = tick?.bid ?? 0;
          const feedAsk = tick?.ask ?? 0;
          const feedMid = (feedBid + feedAsk) / 2;
          const entryDiff = Math.abs(feedMid - signal.entry);
          const spreadPips = Math.abs(feedAsk - feedBid) / (tick?.point || 0.00001);
          if (entryDiff > 0) {
            this.addLog(userId, "SIGNAL",
              `[FEED] ${signal.symbol} bid=${feedBid} ask=${feedAsk} spread=${spreadPips.toFixed(1)}pips | Signal entry=${signal.entry} diff=${(entryDiff * 10000).toFixed(1)}pips`
            );
          }
        } catch {}

        // Ambil current positions
        let currentPosCount = 0;
        let symbolPosCount = 0;
        try {
          const positions = await mt5McpService.getPositions();
          currentPosCount = positions.length;
          symbolPosCount = positions.filter(p => p.symbol === signal.symbol).length;
        } catch {}

        // Risk check
        this.addLog(userId, "SIGNAL",
          `[RISK] Checking ${signal.symbol}: Max ${pipeline.config.maxRiskPerTrade}% | Open: ${currentPosCount}/${pipeline.config.maxOpenPositions} | Pair: ${symbolPosCount}`
        );
        const riskCheck = await riskManagerService.checkTradeAllowed(
          userId,
          signal,
          {
            maxOpenPositions: pipeline.config.maxOpenPositions,
            maxDailyRisk: pipeline.config.maxDailyRisk,
            maxRiskPerTrade: pipeline.config.maxRiskPerTrade,
          },
        );

        if (!riskCheck.allowed) {
          this.addLog(userId, "ERROR",
            `[RISK] Rejected ${signal.symbol}: ${riskCheck.reason}`,
          );
          continue;
        }

        this.addLog(userId, "INFO", `[RISK] ${signal.symbol} passed risk check. Proceeding to filters...`);

        // Log confluence breakdown (Signal Direction)
        const slDist = Math.abs(signal.entry - signal.sl);
        const tpDist = Math.abs(signal.tp - signal.entry);
        const rrRatio = slDist > 0 ? (tpDist / slDist) : 0;

        this.addLog(userId, "SIGNAL",
          `[SIGNAL] ${signal.symbol} ${signal.direction} | R:R 1:${rrRatio.toFixed(2)} | ` +
          `Conf: ${signal.confidence}% | Entry: ${signal.entry} SL: ${signal.sl} TP: ${signal.tp}`
        );



        // ── CORRELATION: Prevent over-exposure to single currency ──────
        try {
          const symbolsCount = pipeline.config.symbols.length;
          const maxBase = symbolsCount <= 1 
            ? pipeline.config.maxOpenPositions 
            : Math.max(2, Math.ceil(pipeline.config.maxOpenPositions * 0.7));
          const maxQuote = symbolsCount <= 1
            ? pipeline.config.maxOpenPositions
            : Math.max(3, Math.ceil(pipeline.config.maxOpenPositions * 0.8));

          const corrCheck = await riskManagerService.checkCorrelationRisk(
            signal.symbol,
            maxBase,
            maxQuote
          );
          if (!corrCheck.allowed) {
            this.addLog(userId, "ERROR", `[RISK] Skipped ${signal.symbol}: ${corrCheck.reason}`);
            continue;
          }
        } catch (e: any) { silentLogger.warn(`[PIPELINE] Correlation check error: ${e.message}`); }

        // ── NEWS: Skip if high-impact event within ±30 minutes ────────
        try {
          const newsWindow = await newsCalendarService.isHighImpactWindow(signal.symbol, 30);
          if (newsWindow) {
            this.addLog(userId, "INFO", `[NEWS] Skipped ${signal.symbol} ${signal.direction} — high-impact event within 30 min`);
            continue;
          }
        } catch (e: any) { silentLogger.warn(`[PIPELINE] News check error: ${e.message}`); }

        // ── FUNDAMENTAL: Skip if against strong trend ─────────────────
        try {
          // Check cache first
          const cachedFundamental = this.getCachedFundamental(signal.symbol);
          let fundScore;
          if (cachedFundamental) {
            fundScore = cachedFundamental;
            this.addLog(userId, "SIGNAL", `[FUNDAMENTAL] ${signal.symbol} (cached)`);
          } else {
            fundScore = await fundamentalResearchService.scorePair(signal.symbol);
            this.setCachedFundamental(signal.symbol, fundScore);
          }
          const aligned = !(
            (signal.direction === "BUY" && fundScore.trendAlignment === "BEARISH") ||
            (signal.direction === "SELL" && fundScore.trendAlignment === "BULLISH")
          );
          if (!aligned && Math.abs(fundScore.compositeScore) >= 30) {
            this.addLog(userId, "INFO", `[NEWS] Skipped ${signal.symbol} — against fundamental trend (${fundScore.trendAlignment}, score: ${fundScore.compositeScore})`);
            continue;
          }
        } catch (e: any) { silentLogger.warn(`[PIPELINE] Fundamental check error: ${e.message}`); }

        // ── MULTI-TIMEFRAME: Verifikasi sinyal di higher timeframe ─────
        try {
          const htfCheck = await multiTimeframeService.checkConfluence(
            signal.symbol, pipeline.config.timeframe, signal.direction,
          );
          if (!htfCheck.isAligned && htfCheck.confidence < 50) {
            this.addLog(userId, "SIGNAL", `[HTF] Skipped ${signal.symbol} ${signal.direction} — HTF conflict (${htfCheck.details})`);
            continue;
          }
          if (htfCheck.confidence < 80) {
            this.addLog(userId, "SIGNAL", `[HTF] ${signal.symbol} ${signal.direction} — ${htfCheck.details}`);
          }
        } catch (e: any) { silentLogger.warn(`[PIPELINE] HTF check error: ${e.message}`); }

        // ── OPTIONAL: LLM Consensus validation ─────────────────────
        // Check LLM circuit breaker
        const llmProviders = llmConsensusService.getAvailableProviders();
        pipeline.llmCircuitOpen = llmProviders.filter(p => p.available).length === 0;

        if (pipeline.config.llmConsensus?.enabled && !pipeline.llmCircuitOpen) {
          // Check LLM circuit breaker - skip if all providers are OPEN
          const availableLLMProviders = this.llmCircuitBreaker.getAvailableProviders(
            ["deepseek", "gpt", "gemini", "mistral", "nemotron", "claude-opus"]
          );
          if (availableLLMProviders.length === 0) {
            this.addLog(userId, "ERROR", `[${signal.symbol}] All LLM providers circuit OPEN. Skipping LLM Consensus.`);
          } else {
            this.addLog(userId, "CONFLUENCE",
              `[${signal.symbol}] Meneruskan sinyal ke Confluence untuk memeriksa metodologi yang cocok. AI LLM memulai proses voting...`,
            );

          // ── HTF conformance data ──
          let llmHtfTrend: string | undefined;
          let llmHtfConf: number | undefined;
          try { const h = await multiTimeframeService.checkConfluence(signal.symbol, pipeline.config.timeframe, signal.direction); llmHtfTrend = h.htfTrend; llmHtfConf = h.confidence; } catch {}
          let llmSymScore: number | undefined;
          let llmMethV: string | undefined;
          let llmMethWR: number | undefined;
          let llmMethPnL: number | undefined;
          try { const { aiBacktestSkillService } = require("./ai-backtest-skill.service"); const s = await aiBacktestSkillService.getSkill(userId); if (s) { const sr = s.symbolRankings?.find((x: any) => x.symbol === signal.symbol); if (sr) llmSymScore = sr.score; const mr = s.methodologyRankings?.find((x: any) => x.methodology === analysis.confluence.finalSignal?.primaryMethodology); if (mr) { llmMethV = mr.verdict; llmMethWR = mr.avgWinRate; llmMethPnL = mr.totalPnL; } } } catch {}

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
               methodologyBreakdown: Object.fromEntries(
                 Object.entries(analysis.confluence.methodologyBreakdown).filter(([k]) => pipeline.config.activeMethodologies?.includes(k as any))
               ),
               agreeingCount: analysis.confluence.finalSignal?.totalAgreeing ?? 0,
               totalMethodologies: pipeline.config.activeMethodologies?.length ?? 1,
               htfTrend: llmHtfTrend,
               htfConfidence: llmHtfConf,
               symbolScore: llmSymScore,
               methodologyVerdict: llmMethV,
               methodologyWinRate: llmMethWR,
               methodologyPnL: llmMethPnL,
               pattern: analysis.confluence.finalSignal?.pattern,
             },
             pipeline.config.llmConsensus,
           );

           // Update LLM circuit breaker based on result
           // Note: In actual implementation, we'd track per-provider, but for now we track overall
           // We'll just log the state
           this.llmCircuitBreaker.getAllStates(); // Update pipeline state

// Log LLM result
           const isTrade = llmResult.verdict === "GOOD";
           this.addLog(userId, "CONFLUENCE",
             `[${signal.symbol}] LLM Consensus Result: ${isTrade ? "TRADE" : "NO TRADE"} | Reasoning: ${llmResult.details}`,
             { llmConsensus: llmResult },
           );

           // Update LLM circuit breaker state based on available providers
           const llmProvidersAfter = llmConsensusService.getAvailableProviders();
           pipeline.llmCircuitOpen = llmProvidersAfter.filter(p => p.available).length === 0;

            // If LLMs say BAD or SKIP, skip the trade
            if (!isTrade) {
              continue;
            }
          }
        } // End of LLM Consensus enabled block

        // Position sizing
        const accountInfo = await mt5McpService.getAccountInfo();
        const symbolInfo = await mt5McpService.getSymbolInfo(analysis.symbol);

        // Calculate Smart Risk Multiplier
        let riskMultiplier = 1;
        if (pipeline.config.smartRisk?.enabled) {
          const smart = pipeline.config.smartRisk;
          
          // 1. Drawdown Recovery (Priority 1)
          if (smart.drawdownRecovery?.enabled && pipeline.currentDrawdownPct !== undefined) {
             if (pipeline.currentDrawdownPct >= smart.drawdownRecovery.activationDrawdownPct) {
               riskMultiplier = smart.drawdownRecovery.riskReductionMultiplier;
               this.addLog(userId, "INFO", `[SMART-RISK] Drawdown Recovery aktif (DD: ${pipeline.currentDrawdownPct.toFixed(2)}%). Risk diturunkan menjadi ${riskMultiplier}x.`);
             }
          }
          
          // 2. Capital Preservation (Tiered Scaling)
          if (riskMultiplier === 1 && smart.capitalPreservation?.enabled && pipeline.currentGrowthPct !== undefined) {
             if (pipeline.currentGrowthPct >= smart.capitalPreservation.activationGrowthPct) {
               riskMultiplier = smart.capitalPreservation.riskReductionMultiplier;
               this.addLog(userId, "INFO", `[SMART-RISK] Capital Preservation aktif (Growth: ${pipeline.currentGrowthPct.toFixed(2)}%). Risk diturunkan menjadi ${riskMultiplier}x untuk melindungi profit.`);
             }
          }
        }
        
        pipeline.currentRiskMultiplier = riskMultiplier;
        const finalRiskPercent = pipeline.config.maxRiskPerTrade * riskMultiplier;

        let volume = finalRiskPercent;
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
          });

          if (volume === 0) {
            this.addLog(userId, "ERROR",
              `Risk rejected ${signal.symbol}: Stop Loss terlalu jauh (${Math.abs(signal.entry - signal.sl).toFixed(5)} poin). Lot terkecil (${symbolInfo.volumeMin}) akan mengakibatkan kerugian melebihi max risk per trade (${finalRiskPercent}%).`
            );
            continue;
          }
        }


        // Execute trade
        // Check MT5 circuit breaker before executing
        if (pipeline.mt5CircuitOpen || !mt5McpService.isConnected) {
          this.addLog(userId, "ERROR", `[${signal.symbol}] MT5 circuit breaker OPEN or not connected. Skipping trade execution.`);
          continue;
        }

        // ── Tentukan Jenis Order (Market / Limit / Stop) berdasarkan Tick ──
        let finalAction: any = signal.direction;
        let orderPrice: number | undefined = undefined;

        try {
          const tickData = await mt5McpService.call("mt5_symbol_tick", { symbol: signal.symbol });
          const currentPrice = signal.direction === "BUY" ? tickData.ask : tickData.bid;
          const pointDist = Math.abs(currentPrice - signal.entry);
          
          // Threshold: hanya jadikan pending order jika jarak entry > 3× spread
          // Jika dekat, gunakan market order langsung agar tidak miss entry
          const symInfoForThreshold = await mt5McpService.getSymbolInfo(signal.symbol);
          const minPendingDist = symInfoForThreshold
            ? symInfoForThreshold.spread * symInfoForThreshold.point * 3
            : 0.0003; // fallback ~3 pips
          
          if (pointDist > minPendingDist) { 
            if (signal.direction === "BUY") {
              finalAction = currentPrice > signal.entry ? "BUY_LIMIT" : "BUY_STOP";
            } else {
              finalAction = currentPrice < signal.entry ? "SELL_LIMIT" : "SELL_STOP";
            }
            orderPrice = signal.entry;
          }
        } catch (e: any) {
          silentLogger.warn(`[Pipeline] Gagal mendapatkan tick untuk ${signal.symbol}, fallback ke Market Order. Error: ${e.message}`);
        }

        const isPending = finalAction !== signal.direction; // BUY_LIMIT/BUY_STOP etc
        const minRR = pipeline.config.maxRiskPerTrade; // Re-use maxRiskPerTrade as minRRRatio for now

        const validation = await this.validateOrderParams(
          signal.symbol,
          signal.direction,
          volume,
          signal.sl,
          signal.tp,
          minRR,
          isPending,
          signal.entry,
        );

        if (!validation.valid) {
          this.addLog(userId, "ERROR", `Order dibatalkan: ${validation.error}`);
          continue;
        }

        const orderResult = await mt5McpService.openOrder({
          symbol: signal.symbol,
          action: finalAction,
          volume,
          price: orderPrice,
          sl: signal.sl,
          tp: signal.tp,
          comment: `AI-${analysis.confluence.finalSignal.primaryMethodology.toUpperCase()}-C${signal.confidence}`,
        });

        if (orderResult.success) {
          const slDist = Math.abs(signal.entry - signal.sl);
          const tpDist = Math.abs(signal.tp - signal.entry);
          const rrRatio = slDist > 0 ? (tpDist / slDist) : 0;

          const isPending = finalAction !== signal.direction; // BUY_LIMIT/BUY_STOP etc
          const methodologyStr = analysis.confluence.finalSignal.primaryMethodology.toUpperCase();
          const patternStr = analysis.confluence.finalSignal.pattern ? ` (${analysis.confluence.finalSignal.pattern})` : '';

          this.addLog(userId, "TRADE",
            `${isPending ? "Placed pending" : "Opened"} ${finalAction} ${signal.symbol} vol=${volume} ticket=${orderResult.ticket} | R:R: 1:${rrRatio.toFixed(2)} [${methodologyStr}]${patternStr}`,
            { signal, orderResult, confluence: analysis.confluence },
          );

          // Track pending orders for expiry management
          if (isPending && orderResult.ticket) {
            const expiryMs = this.getIntervalMs(pipeline.config.timeframe) * 2 * 60; // 2 candles worth in real time
            pipeline.pendingOrders.set(orderResult.ticket, {
              symbol: signal.symbol,
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
            `Order failed ${signal.symbol}: ${orderResult.error}`,
            orderResult,
          );
        }
      }

      pipeline.lastError = null;
    } catch (error: any) {
      pipeline.lastError = error.message;
      this.addLog(userId, "ERROR", `Pipeline error: ${error.message}`);
      silentLogger.error(`[PIPELINE] Error for ${userId}: ${error.message}`);
    }
  }

  // ─── Position & Pending Order Management ──────────────────────────
  private marketClosedCache = new Map<string, number>();

  private async managePositions(userId: string): Promise<void> {
    const pipeline = this.activePipelines.get(userId);
    if (!pipeline) return;

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
      // Hanya kelola posisi (Trailing/Breakeven) yang dibuka oleh AI
      const aiPositions = allPositions.filter(p => p.comment && (p.comment.startsWith("AI-") || p.comment.toLowerCase().includes("ai-")));

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
        const breakevenDistance = atrValue * 1.0;
        let shouldBreakeven = false;

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
          if (commentLower.includes("tp") || commentLower.includes("[tp]")) {
            closeReason = "TP_HIT";
          } else if (commentLower.includes("sl") || commentLower.includes("[sl]")) {
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
          // Fallback: jangan tutup paksa — biarkan retry di siklus berikutnya
          this.addLog(userId, "INFO",
            `[SYNC] Posisi #${log.mt5Ticket} (${log.signal.symbol}) menunggu konfirmasi deal. Akan retry siklus berikutnya.`
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
