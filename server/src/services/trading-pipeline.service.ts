import { mt5McpService } from "./mt5-mcp.service";
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
  llmConsensus: { enabled: false, minProviders: 2, threshold: 0.5, providerTimeoutMs: 8000 },
};

// ─── Service ─────────────────────────────────────────────────────────

class TradingPipelineService {
  private activePipelines: Map<
    string,
    {
      config: PipelineConfig;
      interval: NodeJS.Timeout | null;
      logs: PipelineLog[];
      lastSignal: TradingSignal | null;
      lastAnalysis: MultiStrategySymbolAnalysis | null;
      lastError: string | null;
      lastAnalyzedCandleTimes?: Map<string, number>;
      paused: boolean;
    }
  > = new Map();

  // ─── Lifecycle ─────────────────────────────────────────────────────

  async startPipeline(
    userId: string,
    config: Partial<PipelineConfig>,
  ): Promise<void> {
    await this.stopPipeline(userId);

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
      logs: [] as PipelineLog[],
      lastSignal: null as TradingSignal | null,
      lastAnalysis: null as MultiStrategySymbolAnalysis | null,
      lastError: null as string | null,
      lastAnalyzedCandleTimes: new Map<string, number>(),
      paused: false,
    };

    this.activePipelines.set(userId, pipeline);

    this.addLog(userId, "INFO",
      `Pipeline started: ${merged.symbols.join(", ")} on ${merged.timeframe} [${merged.activeMethodologies!.length} methodologies]`
    );

    pipeline.interval = setInterval(
      () => this.pipelineLoop(userId),
      intervalMs,
    );

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

    silentLogger.info(`[PIPELINE] Started for user ${userId} on ${merged.timeframe} with ${merged.activeMethodologies!.length} methodologies`);
  }

  async stopPipeline(userId: string): Promise<void> {
    const pipeline = this.activePipelines.get(userId);
    if (pipeline?.interval) {
      clearInterval(pipeline.interval);
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

  getPipelineStatus(userId: string): PipelineStatus {
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

    return {
      running: pipeline.interval !== null,
      paused: pipeline.interval === null,
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
    };
  }

  getPipelineLogs(userId: string, limit = 100): PipelineLog[] {
    const pipeline = this.activePipelines.get(userId);
    if (!pipeline) return [];
    return pipeline.logs.slice(-limit);
  }

  // ─── Main Pipeline Loop ────────────────────────────────────────────

  private async pipelineLoop(userId: string): Promise<void> {
    const pipeline = this.activePipelines.get(userId);
    if (!pipeline) return;

    try {
      if (!this.isWithinTradingHours(pipeline.config)) return;

      await this.managePositions(userId);

      // Check which symbols actually need analysis (candle time has changed)
      const symbolsToAnalyze: string[] = [];
      const latestCandleTimes = new Map<string, number>();

      if (!pipeline.lastAnalyzedCandleTimes) {
        pipeline.lastAnalyzedCandleTimes = new Map<string, number>();
      }

      for (const symbol of pipeline.config.symbols) {
        try {
          const rates = await mt5McpService.getRates(symbol, pipeline.config.timeframe, 2);
          if (rates && rates.length > 0) {
            const latestCandleTime = rates[rates.length - 1].time;
            latestCandleTimes.set(symbol, latestCandleTime);

            const lastAnalyzedTime = pipeline.lastAnalyzedCandleTimes.get(symbol);
            if (lastAnalyzedTime === undefined || latestCandleTime !== lastAnalyzedTime) {
              symbolsToAnalyze.push(symbol);
            }
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
        const rates = await mt5McpService.getRates(pipeline.config.symbols[0], pipeline.config.timeframe, 60);
        if (rates && rates.length > 30) {
          const candles: Candle[] = rates.map((r: any) => ({
            time: r.time, open: r.open, high: r.high, low: r.low, close: r.close,
          }));
          const regimeResult = marketRegimeService.analyze(candles);
          regimeMult = marketRegimeService.getRegimeMultipliers(regimeResult.regime);
          this.addLog(userId, "CONFLUENCE",
            `[REGIME] ${regimeResult.regime} (ADX: ${regimeResult.adx}, Vol: ${regimeResult.volatility}%, Conf: ${regimeResult.confidence}%)`
          );
        }
      } catch (e: any) { silentLogger.warn(`[PIPELINE] Regime check error: ${e.message}`); }

      // Use multi-methodology analysis only for symbols with new candles
      const analyses = await aiTradingEngine.analyzeSymbols(
        symbolsToAnalyze,
        pipeline.config.timeframe,
        pipeline.config.maxRiskPerTrade,
        pipeline.config.methodologyWeights,
        pipeline.config.activeMethodologies,
      );

      for (const analysis of analyses) {
        // Store analysis for status display
        pipeline.lastAnalysis = analysis;

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

        // Log confluence breakdown
        this.addLog(userId, "CONFLUENCE",
          `${signal.direction} ${signal.symbol} @ ${signal.entry.toFixed(5)} | ` +
          `Score: ${analysis.confluence.finalSignal.confluenceScore}% → ${signal.confidence}% | ` +
          `Primary: ${analysis.confluence.finalSignal.primaryMethodology} | ` +
          `Agree: ${analysis.confluence.finalSignal.totalAgreeing}/7`,
          analysis.confluence.methodologyBreakdown,
        );

        // Risk check
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

        // ── CORRELATION: Prevent over-exposure to single currency ──────
        try {
          const corrCheck = await riskManagerService.checkCorrelationRisk(signal.symbol);
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
          const fundScore = await fundamentalResearchService.scorePair(signal.symbol);
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
            this.addLog(userId, "INFO", `[HTF] Skipped ${signal.symbol} ${signal.direction} — HTF conflict (${htfCheck.details})`);
            continue;
          }
          if (htfCheck.confidence < 80) {
            this.addLog(userId, "CONFLUENCE", `[HTF] ${signal.symbol} ${signal.direction} — ${htfCheck.details}`);
          }
        } catch (e: any) { silentLogger.warn(`[PIPELINE] HTF check error: ${e.message}`); }

        // ── OPTIONAL: LLM Consensus validation ─────────────────────
        if (pipeline.config.llmConsensus?.enabled) {
          this.addLog(userId, "INFO",
            `LLM Consensus: Validating ${signal.symbol} ${signal.direction} signal across providers...`,
          );

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
            },
            pipeline.config.llmConsensus,
          );

          // Log LLM result
          this.addLog(userId, "CONFLUENCE",
            `LLM Consensus: ${llmResult.verdict} (G:${llmResult.goodVotes}/B:${llmResult.badVotes}/S:${llmResult.skipVotes}/${llmResult.totalVotes}) — ${llmResult.details}`,
            { llmConsensus: llmResult },
          );

          // If LLMs say BAD, skip the trade
          if (llmResult.verdict === "BAD") {
            this.addLog(userId, "ERROR",
              `LLM rejected ${signal.symbol}: ${llmResult.details}`,
            );
            continue;
          }

          // If consensus says SKIP (uncertain), proceed with reduced volume or skip
          if (llmResult.verdict === "SKIP" && !llmResult.consensusReached) {
            this.addLog(userId, "ERROR",
              `LLM uncertain ${signal.symbol}: insufficient consensus — skipping`,
            );
            continue;
          }
        }

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
        }

        // Execute trade
        const orderResult = await mt5McpService.openOrder({
          symbol: signal.symbol,
          action: signal.direction,
          volume,
          sl: signal.sl,
          tp: signal.tp,
          comment: `AI-${analysis.confluence.finalSignal.primaryMethodology.toUpperCase()}-C${signal.confidence}`,
        });

        if (orderResult.success) {
          this.addLog(userId, "TRADE",
            `Opened ${signal.direction} ${signal.symbol} vol=${volume} ticket=${orderResult.ticket} [${analysis.confluence.finalSignal.primaryMethodology}]`,
            { signal, orderResult, confluence: analysis.confluence },
          );

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

  // ─── Position Management (Trailing Stop) ───────────────────────────

  private async managePositions(userId: string): Promise<void> {
    const pipeline = this.activePipelines.get(userId);
    if (!pipeline || !pipeline.config.trailingStop.enabled) return;

    try {
      const positions = await mt5McpService.getPositions();

      for (const pos of positions) {
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

        if (pos.type === "BUY" && pos.priceCurrent >= pos.priceOpen + breakevenDistance) {
          if (pos.sl < pos.priceOpen) {
            shouldBreakeven = true;
          }
        } else if (pos.type === "SELL" && pos.priceCurrent <= pos.priceOpen - breakevenDistance) {
          if (pos.sl > pos.priceOpen) {
            shouldBreakeven = true;
          }
        }

        if (shouldBreakeven) {
          await mt5McpService.modifyPosition(pos.ticket, pos.priceOpen, pos.tp);
          this.addLog(userId, "TRAILING",
            `Breakeven ${pos.symbol} ticket=${pos.ticket}: SL moved to entry ${pos.priceOpen.toFixed(5)}`,
            { ticket: pos.ticket, newSL: pos.priceOpen },
          );
          continue; // Skip trailing this cycle — breakeven happens first
        }

        // ── PARTIAL TP: Evaluasi exit strategy (partial take-profit) ──
        const partialAction = tradeExitStrategyService.evaluate(
          { symbol: pos.symbol, type: pos.type, priceOpen: pos.priceOpen, priceCurrent: pos.priceCurrent, sl: pos.sl, tp: pos.tp, volume: pos.volume, ticket: pos.ticket },
          atrValue,
        );

        if (partialAction.action === "CLOSE_PARTIAL" && partialAction.closePercent) {
          // Close partial position at market
          const closeVolume = Math.round(pos.volume * partialAction.closePercent * 100) / 100;
          if (closeVolume > 0) {
            await mt5McpService.closePosition(pos.ticket);
            this.addLog(userId, "TRADE",
              `TP1 Partial ${pos.symbol} ticket=${pos.ticket}: closed ${(partialAction.closePercent * 100).toFixed(0)}% — ${partialAction.reason}`,
            );
          }
          // Move SL to breakeven on remaining position (done via modify)
          if (partialAction.newSL) {
            await mt5McpService.modifyPosition(pos.ticket, partialAction.newSL, pos.tp);
          }
          continue;
        }

        if (partialAction.action === "MODIFY_SL" && partialAction.newSL) {
          await mt5McpService.modifyPosition(pos.ticket, partialAction.newSL, pos.tp);
          this.addLog(userId, "TRAILING",
            `Trailing ${pos.symbol} ticket=${pos.ticket}: ${partialAction.reason}`,
          );
          continue;
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
          await mt5McpService.modifyPosition(pos.ticket, result.newSL, pos.tp);
          this.addLog(userId, "TRAILING",
            `Trailing ${pos.symbol} ticket=${pos.ticket}: ${result.reason}`,
            { ticket: pos.ticket, newSL: result.newSL },
          );
        }
      }
    } catch (error: any) {
      silentLogger.error(`[PIPELINE] managePositions error: ${error.message}`);
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
    switch (timeframe) {
      case "M5": return 5_000;
      case "M15": return 15_000;
      case "H1": return 60_000;
      default: return 15_000;
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

  private calculateATRSimple(rates: { high: number; low: number; close: number }[]): number {
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
