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
  type: "INFO" | "SIGNAL" | "TRADE" | "ERROR" | "TRAILING" | "CONFLUENCE";
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
  llmConsensus: { enabled: false, minProviders: 4, threshold: 0.5, providerTimeoutMs: 15000 },
};

// ─── Service ─────────────────────────────────────────────────────────

class TradingPipelineService {
  private activePipelines: Map<
    string,
    {
      config: PipelineConfig;
      interval: NodeJS.Timeout | null;
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
    }
  > = new Map();

  private llmCircuitBreaker = new LLMCircuitBreaker();

  // ─── Cache ────────────────────────────────────────────────────────────
  private regimeCache = new Map<string, { regime: string; multipliers: Record<string, number>; timestamp: number }>();
  private fundamentalCache = new Map<string, { score: any; timestamp: number }>();
  private readonly REGIME_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
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
      interval: null as NodeJS.Timeout | null,
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
    };

    this.activePipelines.set(userId, pipeline);

    try {
      const accountInfo = await mt5McpService.getAccountInfo();
      const positions = await mt5McpService.getPositions();
      const symbolPositions = positions.filter(p => merged.symbols.includes(p.symbol));
      this.addLog(userId, "INFO",
        `Pipeline started: ${merged.symbols.join(", ")} on ${merged.timeframe} [${merged.activeMethodologies!.length} methodologies] | Risk: ${merged.maxRiskPerTrade}% | Balance: $${accountInfo?.balance?.toFixed(2) || 0} | Positions: ${symbolPositions.length}/${merged.maxOpenPositions}`
      );
    } catch (e: any) {
      this.addLog(userId, "INFO",
        `Pipeline started: ${merged.symbols.join(", ")} on ${merged.timeframe} [${merged.activeMethodologies!.length} methodologies] | Risk: ${merged.maxRiskPerTrade}% | MT5 Info unavailable`
      );
    }

    // Trigger the first execution immediately instead of waiting for the first interval tick
    setTimeout(() => this.pipelineLoop(userId), 0);

    pipeline.interval = setInterval(
      () => this.pipelineLoop(userId),
      intervalMs,
    );

    // Trailing stop & pending order management runs more frequently (every 10s)
    pipeline.trailingInterval = setInterval(
      () => this.managePositions(userId),
      10_000,
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
    if (pipeline?.interval) {
      clearInterval(pipeline.interval);
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
    if (pipeline?.interval) {
      clearInterval(pipeline.interval);
      pipeline.interval = null;
    }
    this.addLog(userId, "INFO", "Pipeline paused");
  }

  async resumePipeline(userId: string): Promise<void> {
    const pipeline = this.activePipelines.get(userId);
    if (!pipeline?.paused) {
      throw new Error("Pipeline is not paused");
    }

    const intervalMs = this.getIntervalMs(pipeline.config.timeframe);
    pipeline.interval = setInterval(
      () => this.pipelineLoop(userId),
      intervalMs,
    );
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
      // Open positions langsung dari MT5
      const positions = await mt5McpService.getPositions();
      openPositions = positions.length;
      // Hitung total floating PnL dari semua posisi
      totalPnL = positions.reduce((sum, p) => sum + (p.profit || 0), 0);

      // Trade history dari DB (closed trades)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const closedTrades = await AITradeLog.find({
        userId,
        closed: true,
      }).lean();

      totalTrades = closedTrades.length;
      let allTimePnL = 0;
      let dailyPnLSum = 0;

      for (const t of closedTrades) {
        const pnl = (t as any).pnl || 0;
        allTimePnL += pnl;
        if (t.executionTime && new Date(t.executionTime) >= today) {
          dailyPnLSum += pnl;
        }
        if (pnl > 0) winningTrades++;
        else if (pnl < 0) losingTrades++;
      }

      // Combine floating PnL + closed PnL
      totalPnL += allTimePnL;
      dailyPnL = dailyPnLSum;

      // Drawdown sederhana: negatif dari total floating
      currentDrawdown = positions
        .filter(p => p.profit < 0)
        .reduce((sum, p) => sum + Math.abs(p.profit), 0);

    } catch (err) {
      silentLogger.warn(`[PIPELINE] Status metrics query error: ${err}`);
    }

    return {
      running: pipeline.interval !== null,
      paused: pipeline.interval === null,
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

  private async validateOrderParams(symbol: string, action: "BUY" | "SELL", volume: number, sl?: number, tp?: number): Promise<{ valid: boolean; error?: string }> {
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

        const entryPrice = action === "BUY" ? tick.ask : tick.bid;
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

        // Cek R:R ratio minimal 1:1
        if (slDistance > 0) {
          const rrRatio = tpDistance / slDistance;
          if (rrRatio < 1.0) {
            return { valid: false, error: `Risk:Reward ratio terlalu rendah (${rrRatio.toFixed(2)}:1, minimal 1:1)` };
          }
        }
      }

      return { valid: true };
    } catch (error: any) {
      return { valid: false, error: `Validasi gagal: ${error.message}` };
    }
  }

  // ─── Main Pipeline Loop ────────────────────────────────────────────

  private async pipelineLoop(userId: string): Promise<void> {
    const pipeline = this.activePipelines.get(userId);
    if (!pipeline) return;

    try {
      // Handle MT5 disconnections by auto-pausing without killing the timer
      // Check MT5 circuit breaker state
      const mt5CircuitState = mt5McpService.circuitBreakerState;
      pipeline.mt5CircuitOpen = mt5CircuitState === "OPEN";
      if (!mt5McpService.isConnected) {
    pipeline.waitingReconnect = true;
    this.addLog(userId, "ERROR", `[PIPELINE] Koneksi MT5 terputus. Pipeline di-pause sementara sambil menunggu koneksi pulih (Auto-pause).`);
    pipeline.mt5CircuitOpen = true; // Set MT5 circuit breaker to OPEN
    return; // Skip this tick silently
      } else if (pipeline.waitingReconnect) {
        pipeline.waitingReconnect = false;
        pipeline.mt5CircuitOpen = false; // Close MT5 circuit breaker
        this.addLog(userId, "INFO", `[PIPELINE] Koneksi MT5 pulih. Pipeline dilanjutkan (Auto-resume).`);
      }

      if (!this.isWithinTradingHours(pipeline.config)) return;

      await this.managePositions(userId);
      await this.syncClosedPositions(userId);

      // Check which symbols actually need analysis (candle time has changed)
      const symbolsToAnalyze: string[] = [];
      const latestCandleTimes = new Map<string, number>();

      if (!pipeline.lastAnalyzedCandleTimes) {
        pipeline.lastAnalyzedCandleTimes = new Map<string, number>();
      }

      for (const symbol of pipeline.config.symbols) {
        // Skip Forex/Commodities/Indices on weekends (Saturday & Sunday) to save API tokens and avoid locked market errors
        const day = new Date().getDay();
        const isWeekend = day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
        const isCrypto = /^(BTC|ETH|LTC|XRP|SOL|DOGE|ADA|BCH|DOT|LINK|UNI)/i.test(symbol);
        if (isWeekend && !isCrypto) {
          continue; // Skip non-crypto pairs on weekends
        }

        try {
          const rates = await mt5McpService.getRates(symbol, pipeline.config.timeframe, 2);
          if (rates && rates.length > 0) {
            const latestCandleTime = rates[rates.length - 1].time;
            latestCandleTimes.set(symbol, latestCandleTime);

            // ALWAYS push the symbol for analysis in fractal strategies.
            // The underlying engine needs to check smaller timeframes (M15, M5) 
            // inside the H1 candle for dynamic entries (e.g. MSNR Top-Down).
            symbolsToAnalyze.push(symbol);
          } else {
            symbolsToAnalyze.push(symbol);
          }
        } catch (err: any) {
          symbolsToAnalyze.push(symbol);
        }
      }

      if (symbolsToAnalyze.length === 0) {
        pipeline.lastError = null;
        return;
      }

      // ── MARKET REGIME: Detect current market conditions ────────────
      let regimeMult: Record<string, number> = {};
      try {
        const activeSymbolForRegime = symbolsToAnalyze[0] || pipeline.config.symbols[0];
        const cacheKey = `${activeSymbolForRegime}_${pipeline.config.timeframe}`;
        
        // Check cache first
        const cachedRegime = this.getCachedRegime(cacheKey);
        if (cachedRegime) {
          regimeMult = cachedRegime.multipliers;
          this.addLog(userId, "SIGNAL",
            `[REGIME] ${cachedRegime.regime} (cached) - Adjusted weights applied`
          );
        } else {
          const rates = await mt5McpService.getRates(activeSymbolForRegime, pipeline.config.timeframe, 60);
          if (rates && rates.length > 30) {
            const candles: Candle[] = rates.map((r: any) => ({
              time: r.time, open: r.open, high: r.high, low: r.low, close: r.close,
            }));
            const regimeResult = marketRegimeService.analyze(candles);
            regimeMult = marketRegimeService.getRegimeMultipliers(regimeResult.regime);
            this.setCachedRegime(cacheKey, regimeResult.regime, regimeMult);
            this.addLog(userId, "SIGNAL",
              `[REGIME] ${regimeResult.regime} (ADX: ${regimeResult.adx}, Vol: ${regimeResult.volatility}%, Conf: ${regimeResult.confidence}%)`
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
        this.addLog(userId, "SIGNAL",
          `[REGIME] Adjusted weights: ${Object.entries(adjustedWeights).map(([k, v]) => `${k}=${(v as number).toFixed(2)}`).join(", ")}`
        );
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
            const min = new Date().getMinutes();
            if (min % 15 === 0 && !pipeline.logs.find(l => l.message.includes(`[${analysis.symbol}] Memantau market`) && new Date(l.time).getTime() > Date.now() - 60000)) {
               this.addLog(userId, "INFO", `[${analysis.symbol}] Memantau market... menunggu setup teknikal valid.`);
            }
          }
          continue;
        }

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

        // Ambil current positions
        let currentPosCount = 0;
        let symbolPosCount = 0;
        try {
          const positions = await mt5McpService.getPositions();
          currentPosCount = positions.length;
          symbolPosCount = positions.filter(p => p.symbol === signal.symbol).length;
        } catch {}

        // Risk check
        this.addLog(userId, "INFO", 
          `Menghitung risk per trade (Max ${pipeline.config.maxRiskPerTrade}%) dan total open positions (Akun: ${currentPosCount}/${pipeline.config.maxOpenPositions}, Pair ${signal.symbol}: ${symbolPosCount}).`
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
            `Risk rejected ${signal.symbol}: ${riskCheck.reason}`,
          );
          continue;
        }

        // Log confluence breakdown (Signal Direction)
        const slDist = Math.abs(signal.entry - signal.sl);
        const tpDist = Math.abs(signal.tp - signal.entry);
        const rrRatio = slDist > 0 ? (tpDist / slDist) : 0;

        this.addLog(userId, "SIGNAL",
          `Arah signal ${signal.symbol} ${signal.direction === "BUY" ? "BULLISH" : "BEARISH"} sesuai regime market. ` +
          `R:R: 1:${rrRatio.toFixed(2)} | ` +
          `Score: ${analysis.confluence.finalSignal.confluenceScore}% → ${signal.confidence}% | ` +
          `Primary: ${analysis.confluence.finalSignal.primaryMethodology}`,
          analysis.confluence.methodologyBreakdown,
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
            ["deepseek", "qwen", "gemini", "mistral", "nemotron", "claude-opus"]
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
               methodologyBreakdown: analysis.confluence.methodologyBreakdown,
               agreeingCount: analysis.confluence.finalSignal?.totalAgreeing ?? 0,
               totalMethodologies: Object.keys(analysis.confluence.methodologyBreakdown).length,
               htfTrend: llmHtfTrend,
               htfConfidence: llmHtfConf,
               symbolScore: llmSymScore,
               methodologyVerdict: llmMethV,
               methodologyWinRate: llmMethWR,
               methodologyPnL: llmMethPnL,
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

        let volume = pipeline.config.maxRiskPerTrade;
        if (symbolInfo) {
          volume = aiTradingEngine.calculatePositionSize({
            accountBalance: accountInfo.balance,
            riskPercent: pipeline.config.maxRiskPerTrade,
            entryPrice: signal.entry,
            stopLoss: signal.sl,
            contractSize: symbolInfo.tradeContractSize,
            volumeMin: symbolInfo.volumeMin,
            volumeMax: symbolInfo.volumeMax,
            volumeStep: symbolInfo.volumeStep,
          });

          if (volume === 0) {
            this.addLog(userId, "ERROR",
              `Risk rejected ${signal.symbol}: Stop Loss terlalu jauh (${Math.abs(signal.entry - signal.sl).toFixed(5)} poin). Lot terkecil (${symbolInfo.volumeMin}) akan mengakibatkan kerugian melebihi max risk per trade (${pipeline.config.maxRiskPerTrade}%).`
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

        const validation = await this.validateOrderParams(
          signal.symbol,
          signal.direction,
          volume,
          signal.sl,
          signal.tp
        );

        if (!validation.valid) {
          this.addLog(userId, "ERROR", `Order dibatalkan: ${validation.error}`);
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
          this.addLog(userId, "TRADE",
            `${isPending ? "Placed pending" : "Opened"} ${finalAction} ${signal.symbol} vol=${volume} ticket=${orderResult.ticket} | R:R: 1:${rrRatio.toFixed(2)} [${analysis.confluence.finalSignal.primaryMethodology}]`,
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

          await AITradeLog.create({
            userId,
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

    try {
      const positions = await mt5McpService.getPositions();

      for (const pos of positions) {
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
      // 1. Fetch all trade logs that are still marked as OPEN (closed: false)
      const openLogs = await AITradeLog.find({ userId, closed: false });
      if (openLogs.length === 0) return;

      // 2. Fetch active positions from MT5
      const activePositions = await mt5McpService.getPositions();
      const activeTickets = new Set(activePositions.map(p => p.ticket));

      // 3. Find trade logs whose positions are no longer in MT5 active positions (meaning they closed)
      const closedLogs = openLogs.filter(log => log.mt5Ticket && !activeTickets.has(log.mt5Ticket));
      if (closedLogs.length === 0) return;

      // 4. Fetch last 24h deal history from MT5
      const oneDayAgo = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);
      const deals = await mt5McpService.getHistory(oneDayAgo);

      for (const log of closedLogs) {
        if (!log.mt5Ticket) continue;

        // Find the OUT deal (entry === 1) that closed this position
        const closingDeal = deals.find(
          d => d.position_id === log.mt5Ticket && d.entry === 1
        );

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
          // Fallback if no deal found in 24h deals history
          log.closed = true;
          log.closedAt = new Date();
          log.closeReason = "MANUAL";
          log.pnl = 0;
          await log.save();
          
          this.addLog(userId, "INFO",
            `[SYNC] Posisi #${log.mt5Ticket} (${log.signal.symbol}) terdeteksi tutup tanpa catatan deal.`
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
