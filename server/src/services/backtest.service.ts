import { mt5McpService, type MT5Rate } from "./mt5-mcp.service";
import { backtestSessionManager, type BacktestSession } from './backtest-session.manager';
import { aiTradingEngine, type Timeframe, type RSIState, type ATRState } from "./ai-trading-engine.service";
import { marketStructureService } from "./strategies/market-structure.service";
import { smcStrategy } from "./strategies/smc.strategy";
import { ictStrategy } from "./strategies/ict.strategy";
import { msnrStrategy } from "./strategies/msnr.strategy";
import { crtStrategy } from "./strategies/crt.strategy";
import { quarterlyTheoryStrategy } from "./strategies/quarterly.strategy";
import { litStrategy } from "./strategies/lit.strategy";
import { confluenceEngine } from "./strategies/confluence-engine";
import { atrService } from "./strategies/atr.service";
import { BacktestExperience } from "../models/BacktestExperience";
import { silentLogger } from "../utils/silent-logger";
import type { MethodologyWeights, MethodologyName } from "./strategies/index";
import { DEFAULT_METHODOLOGY_WEIGHTS } from "./strategies/index";

// ─── Types ───────────────────────────────────────────────────────────

export interface BacktestConfig {
  symbols: string[];
  timeframe: Timeframe;
  fromDate: Date;
  toDate: Date;
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
  /** Delay in ms between candle processing in streaming mode. 0 = as fast as possible. */
  speedMs?: number;
  /** Run full strategy evaluation every N candles per symbol. Higher = faster but fewer signals. */
  signalInterval: number;
  /** Spread in pips simulated on entry/exit (e.g. 1.5 pips). Default is 0. */
  spreadPips?: number;
  /** Slippage in pips simulated on entry and adverse exits (e.g. 0.5 pips). Default is 0. */
  slippagePips?: number;
  // NEW: Multi-methodology config
  methodologyWeights?: MethodologyWeights;
  activeMethodologies?: MethodologyName[];
    /** Session ID for two-phase mode — when set, runBacktestStream uses pre-loaded session data. */
  sessionId?: string;
}

export interface SimulatedTrade {
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
  trailingHistory: Array<{
    time: number;
    oldSL: number;
    newSL: number;
  }>;
  // NEW: Methodology attribution
  primaryMethodology?: string;
  methodologyConfidence?: number;
  methodologyCount?: number;
}

export interface SymbolStat {
  symbol: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakEvenTrades: number;
  totalPnL: number;
  winRate: number;
}

export interface MethodologyStat {
  methodology: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalPnL: number;
  winRate: number;
  avgConfidence: number;
}

export interface BacktestResult {
  backtestId?: string;
  symbols: string[];
  timeframe: string;
  fromDate: Date;
  toDate: Date;
  config: BacktestConfig;
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
  averageBarsHeld: number;
  equityCurve: Array<{ time: number; equity: number; floatingPnL: number; openTrades: number }>;
  trades: SimulatedTrade[];
  symbolStats: SymbolStat[];
  methodologyStats: MethodologyStat[];
}

interface OpenSimTrade {
  symbol: string;
  direction: "BUY" | "SELL";
  entryPrice: number;
  entryTime: number;
  sl: number;
  tp: number;
  volume: number;
  rsiAtEntry: number;
  atrAtEntry: number;
  pattern: string;
  confidence: number;
  barsHeld: number;
  trailingHistory: Array<{ time: number; oldSL: number; newSL: number }>;
  // NEW: Methodology attribution
  primaryMethodology?: string;
  methodologyConfidence?: number;
  methodologyCount?: number;
}

// Per-symbol state for indicator calculations — shared with backtest-session.manager
interface SymbolState {
  rates: MT5Rate[];
  closes: number[];
  contractSize: number;
  volumeMin: number;
  volumeMax: number;
  volumeStep: number;
  candleIndex: number; // how many candles of this symbol we've processed
}

export type { SymbolState };

interface TimelineCandle {
  time: number;
  symbol: string;
}

// ─── Streaming Event Types ───────────────────────────────────────────

export type BacktestStreamEvent =
  | {
      type: "progress";
      data: { currentCandle: number; totalCandles: number; percent: number };
    }
  | { // NEW: Event to signal that data is ready
      type: "data_ready";
      data: { sessionId: string; symbols: string[]; timeframe: string; fromDate: string; toDate: string; totalCandles: number; totalSymbols: number; };
    }
  | {
      type: "candle";
      data: {
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
      };
    }
  | {
      type: "trade_open";
      data: {
        time: number;
        symbol: string;
        direction: string;
        entryPrice: number;
        sl: number;
        tp: number;
        volume: number;
        confidence: number;
        rsi: number;
        pattern: string;
        primaryMethodology?: string;
      };
    }
  | {
      type: "trade_close";
      data: {
        entryTime: number;
        exitTime: number;
        symbol: string;
        direction: string;
        entryPrice: number;
        exitPrice: number;
        pnl: number;
        pnlPercent: number;
        reason: string;
        confidence: number;
        primaryMethodology?: string;
      };
    }
  | {
      type: "equity";
      data: { time: number; equity: number; floatingPnL: number };
    }
  | {
      type: "complete";
      data: BacktestResult;
    }
  | {
      type: "error";
      data: { message: string };
    };

export type StreamEventCallback = (event: BacktestStreamEvent) => boolean | void | Promise<boolean | void>;
/** If the callback returns false, the simulation should abort (client disconnected). */

const DEFAULT_CONFIG: BacktestConfig = {
  symbols: ["EURUSD"],
  timeframe: "M15",
  fromDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  toDate: new Date(),
  initialBalance: 10000,
  entrySettings: {
    rsiOversold: 30,
    rsiOverbought: 70,
    atrMultiplierSL: 1.5,
    atrMultiplierTP: 1.5,
  },
  trailingStop: {
    enabled: true,
    activationATR: 1.0,
    trailATR: 0.5,
    breakEven: false,
  },
  maxRiskPerTrade: 1.0,
  maxOpenPositions: 3,
  leverage: 100,
  signalInterval: 4,
  speedMs: 0,
  spreadPips: 2.0,
  slippagePips: 0.5,
};

// ─── Service ─────────────────────────────────────────────────────────

class BacktestService {
  async runBacktest(userId: string, config: Partial<BacktestConfig>): Promise<BacktestResult> {
    // Synchronous path: prepare data then run simulation immediately
    const { sessionId } = await this.prepareBacktestData(userId, config);
    const { backtestSessionManager } = require("./backtest-session.manager");
    const session = backtestSessionManager.getSession(sessionId, userId);
    if (!session) throw new Error("Session creation failed");
    // Auto-start (no waiting) — synchronous run
    const result = await this.runSimulationCore(userId, session.config, session.symbolStates, () => {});
    backtestSessionManager.removeSession(sessionId, userId);
    return result;
  }

  /**
   * Phase 1: Fetch and prepare historical data without starting simulation.
   * Returns sessionId that can be used to start the simulation later.
   */
  async prepareBacktestData(userId: string, config: Partial<BacktestConfig>, emitProgress?: StreamEventCallback): Promise<{
    sessionId: string;
    symbolSummaries: Array<{ symbol: string; candles: number; fromDate: string; toDate: string }>;
  }> {
    const merged: BacktestConfig = {
      ...DEFAULT_CONFIG,
      ...config,
      symbols: config.symbols && config.symbols.length > 0 ? config.symbols : DEFAULT_CONFIG.symbols,
      entrySettings: { ...DEFAULT_CONFIG.entrySettings, ...config.entrySettings },
      trailingStop: { ...DEFAULT_CONFIG.trailingStop, ...config.trailingStop },
    };

    const fromTs = Math.floor(merged.fromDate.getTime() / 1000);
    const toTs = Math.floor(merged.toDate.getTime() / 1000);

    const symbolStates = new Map<string, SymbolState>();
    const totalSymbols = merged.symbols.length;

    // Emit helper for progress during fetch
    const emit = (current: number) => {
      const percent = Math.min(Math.round((current / totalSymbols) * 10), 10); // 0-10% = fetching
      if (emitProgress) {
        emitProgress({ type: "progress", data: { currentCandle: current, totalCandles: totalSymbols, percent } });
      }
    };

    // Fetch all symbols sequentially (so progress is real)
    const fetchResults: Array<{ sym: string; rates: MT5Rate[]; closes: number[]; contractSize: number; volumeMin: number; volumeMax: number; volumeStep: number; error: string | null }> = [];
    for (let idx = 0; idx < merged.symbols.length; idx++) {
      const sym = merged.symbols[idx];
      emit(idx);
      let rates: MT5Rate[] = [];
      try {
        rates = await mt5McpService.getRatesRange(sym, merged.timeframe, fromTs, toTs);
      } catch (error: any) {
        const msg = `Failed to fetch data for ${sym}: ${error.message}`;
        fetchResults.push({ sym, rates: [], closes: [], contractSize: 100000, volumeMin: 0.01, volumeMax: 100, volumeStep: 0.01, error: msg });
        continue;
      }

      if (rates.length < 50) {
        const msg = `Not enough data for ${sym} ${merged.timeframe}: got ${rates.length} candles, skipping`;
        fetchResults.push({ sym, rates: [], closes: [], contractSize: 100000, volumeMin: 0.01, volumeMax: 100, volumeStep: 0.01, error: msg });
        continue;
      }

      // Fetch symbol info for broker-agnostic positioning
      let contractSize = 100000;
      let volumeMin = 0.01;
      let volumeMax = 100;
      let volumeStep = 0.01;
      try {
        const info = await mt5McpService.getSymbolInfo(sym);
        if (info) {
          contractSize = info.tradeContractSize;
          volumeMin = info.volumeMin;
          volumeMax = info.volumeMax;
          volumeStep = info.volumeStep;
        }
      } catch {
        // fallback
      }

      fetchResults.push({
        sym, rates, closes: rates.map((r) => r.close),
        contractSize, volumeMin, volumeMax, volumeStep, error: null,
      });
    }
    emit(totalSymbols); // 100% fetching done

    for (const r of fetchResults) {
      if (r.error || !r.rates || !r.closes) continue;
      symbolStates.set(r.sym, {
        rates: r.rates,
        closes: r.closes,
        contractSize: r.contractSize,
        volumeMin: r.volumeMin,
        volumeMax: r.volumeMax,
        volumeStep: r.volumeStep,
        candleIndex: 0,
      });
    }

    if (symbolStates.size === 0) {
      throw new Error("No valid symbols with enough data");
    }

    // Create session
    const { backtestSessionManager } = require("./backtest-session.manager");
    const sessionId = backtestSessionManager.createSession(merged, symbolStates, userId);

    // Build summaries
    const symbolSummaries = Array.from(symbolStates.entries()).map(([sym, state]) => ({
      symbol: sym,
      candles: state.rates.length,
      fromDate: new Date(state.rates[0]?.time * 1000).toISOString(),
      toDate: new Date(state.rates[state.rates.length - 1]?.time * 1000).toISOString(),
    }));

    return { sessionId, symbolSummaries };
  }

  async runBacktestStream(
    userId: string,
    config: Partial<BacktestConfig>,
    onEvent: StreamEventCallback,
  ): Promise<BacktestResult> {
    // If sessionId is provided in config, run in two-phase mode
    if (config.sessionId) {
      return this.runBacktestFromSession(userId, config.sessionId, onEvent);
    }
    // ── Unified stream: fetch data WITH progress → data_ready → auto-simulate ──
    const { sessionId } = await this.prepareBacktestData(userId, config, onEvent);

    const { backtestSessionManager } = require("./backtest-session.manager");
    const session = backtestSessionManager.getSession(sessionId, userId);
    if (!session) throw new Error("Session creation failed");

    // Emit data_ready so frontend knows data size
    const totalDataCandles = Array.from(session.symbolStates.values()).reduce((sum: number, s: any) => sum + s.rates.length, 0);
    onEvent({
      type: "data_ready",
      data: {
        sessionId,
        symbols: session.config.symbols,
        timeframe: session.config.timeframe,
        fromDate: session.config.fromDate.toISOString(),
        toDate: session.config.toDate.toISOString(),
        totalCandles: totalDataCandles,
        totalSymbols: session.config.symbols.length,
      },
    });
    await new Promise(r => setTimeout(r, 30)); // flush SSE

    // Mark as running and immediately simulate (with abort check)
    backtestSessionManager.updateStatus(sessionId, 'running');
    const isAborted = () => backtestSessionManager.isAborted(sessionId);
    try {
      return this.runSimulationCore(userId, session.config, session.symbolStates, onEvent, isAborted);
    } finally {
      backtestSessionManager.removeSession(sessionId, userId);
    }
  }

  /**
   * Direct streaming path (no prepare phase): data already fetched via prepareBacktestData,
   * wrap the runSimulationCore to emit through onEvent.
   */
  private async runBacktestStreamDirect(
    userId: string,
    sessionId: string,
    onEvent: StreamEventCallback,
  ): Promise<BacktestResult> {
    const { backtestSessionManager } = require("./backtest-session.manager");
    const session = backtestSessionManager.getSession(sessionId, userId);
    if (!session) throw new Error("Session not found or expired");

    const result = await this.runSimulationCore(userId, session.config, session.symbolStates, onEvent);
    backtestSessionManager.removeSession(sessionId, userId);
    return result;
  }

  /**
   * Phase 2: Run backtest simulation using pre-loaded session data.
   * Waits for triggerStart signal before beginning simulation.
   */
  private async runBacktestFromSession(
    userId: string,
    sessionId: string,
    onEvent: StreamEventCallback,
  ): Promise<BacktestResult> {
    const { backtestSessionManager } = require("./backtest-session.manager");
    const session = backtestSessionManager.getSession(sessionId, userId);

    if (!session) {
      throw new Error("Backtest session not found or expired");
    }

    if (session.status !== 'prepared') {
      throw new Error("Session is not in prepared state");
    }

    const merged = session.config;
    const symbolStates = session.symbolStates;

    // Abort check — checks both signal + session manager flag
    const isAborted = () => {
      if (backtestSessionManager.isAborted(sessionId)) return true;
      return false;
    };

    const emit = (event: BacktestStreamEvent): boolean => {
      if (isAborted()) return false;
      if (onEvent) {
        void onEvent(event);
      }
      return !isAborted();
    };

    // ── 0. Emit data_ready event ─────────────────────────────────────
    const totalDataCandles = Array.from(symbolStates.values()).reduce((sum: number, s: any) => sum + s.rates.length, 0);
    emit({
      type: "data_ready",
      data: {
        sessionId,
        symbols: merged.symbols,
        timeframe: merged.timeframe,
        fromDate: merged.fromDate.toISOString(),
        toDate: merged.toDate.toISOString(),
        totalCandles: totalDataCandles,
        totalSymbols: merged.symbols.length,
      },
    });
    await new Promise(r => setTimeout(r, 30)); // flush SSE

    // Wait for start signal from frontend (or immediate abort)
    await new Promise<void>((resolve, reject) => {
      // Poll abort every 500ms while waiting
      const interval = setInterval(() => {
        if (isAborted()) {
          clearInterval(interval);
          reject(new Error("Backtest cancelled by user"));
        }
      }, 500);
      backtestSessionManager.setStartResolver(sessionId, () => {
        clearInterval(interval);
        resolve();
      });
    });

    // Mark session as running
    backtestSessionManager.updateStatus(sessionId, 'running');

    // ── Now run the simulation using pre-loaded data ──
    return this.runSimulationCore(userId, merged, symbolStates, emit, isAborted);
  }

  private async runSimulationCore(
    userId: string,
    merged: BacktestConfig,
    symbolStates: Map<string, SymbolState>,
    emit: StreamEventCallback,
    /** Optional abort check — return true to stop simulation early */
    abortCheck?: () => boolean,
  ): Promise<BacktestResult> {

    // ── Emit sim-start progress ──────────────────────────────
    emit({ type: "progress", data: { currentCandle: 0, totalCandles: 100, percent: 0 } });
    await new Promise(r => setTimeout(r, 30)); // flush SSE

    // ── Build interleaved timeline ───────────────────────────────
    const RSI_PERIOD = 14;
    const ATR_PERIOD = 14;
    const warmupCandles = Math.max(RSI_PERIOD, ATR_PERIOD) + 2;
    /** Limit strategy analysis to last N candles for performance */
    const MAX_STRATEGY_CANDLES = 300;

    let allTimelineCandles: TimelineCandle[] = [];
    for (const [sym, state] of symbolStates) {
      for (let i = warmupCandles; i < state.rates.length; i++) {
        allTimelineCandles.push({
          time: state.rates[i].time,
          symbol: sym,
        });
      }
    }

    // Sort by time, then by symbol name for deterministic order
    allTimelineCandles.sort((a, b) => {
      if (a.time !== b.time) return a.time - b.time;
      return a.symbol.localeCompare(b.symbol);
    });

    // Group by unique time (for progress tracking)
    const uniqueTimeline = allTimelineCandles.length > 0
      ? [allTimelineCandles[0].time, ...allTimelineCandles.filter((c, i) => i > 0 && c.time !== allTimelineCandles[i - 1].time).map(c => c.time)]
      : [];

    const totalTimelineSteps = uniqueTimeline.length;
    if (totalTimelineSteps === 0) {
      throw new Error("No timeline data available after warmup");
    }

    // ── Simulation state ───────────────────────────────────────────
    const tradeResults: SimulatedTrade[] = [];
    const equityCurve: Array<{ time: number; equity: number; floatingPnL: number; openTrades: number }> = [];
    let equity = merged.initialBalance;
    let peakEquity = equity;
    let maxDrawdown = 0;
    let openTrades: Map<string, OpenSimTrade> = new Map();
    let totalWin = 0;
    let totalLoss = 0;
    let winCount = 0;
    let lossCount = 0;
    let largestWin = 0;
    let largestLoss = 0;
    let allReturns: number[] = [];

    let lastProgressPct = -1;
    const MIN_PROGRESS_INTERVAL_PCT = 0.25;
    const PROGRESS_FLUSH_MS = 5;

    // Track which candle index each symbol is at
    const symbolCandleIdx = new Map<string, number>();
    for (const sym of merged.symbols) {
      symbolCandleIdx.set(sym, warmupCandles);
    }

    // Incremental indicator state per symbol (pre-initialized with warmup data)
    const symbolRSIState = new Map<string, RSIState>();
    const symbolATRState = new Map<string, ATRState>();
    for (const [sym, state] of symbolStates) {
      const rsiSt = aiTradingEngine.createRSIState();
      rsiSt.period = RSI_PERIOD;
      const warmupCloses = state.closes.slice(0, warmupCandles);
      for (const c of warmupCloses) aiTradingEngine.feedRSI(rsiSt, c);
      symbolRSIState.set(sym, rsiSt);

      const atrSt = aiTradingEngine.createATRState(ATR_PERIOD);
      const warmupRates = state.rates.slice(0, warmupCandles);
      for (const r of warmupRates) aiTradingEngine.feedATR(atrSt, r.high, r.low, r.close);
      symbolATRState.set(sym, atrSt);
    }

    // Signal interval counter per symbol
    const signalCounters = new Map<string, number>();
    for (const sym of merged.symbols) {
      signalCounters.set(sym, 0);
    }

    // Map of visible symbols (those with enough data)
    const activeSymbols = Array.from(symbolStates.keys());

    // ── Iterate by timeline ───────────────────────────────────────
    let timelineStep = 0;

    // Group timeline candles by unique time
    const timelineGroups: Array<{ time: number; candles: TimelineCandle[] }> = [];
    for (const tc of allTimelineCandles) {
      const last = timelineGroups[timelineGroups.length - 1];
      if (last && last.time === tc.time) {
        last.candles.push(tc);
      } else {
        timelineGroups.push({ time: tc.time, candles: [tc] });
      }
    }

    for (const group of timelineGroups) {
      timelineStep++;

      // Abort check
      if (abortCheck && abortCheck()) {
        silentLogger.info(`[BACKTEST] Aborted by user at step ${timelineStep}/${totalTimelineSteps}`);
        break;
      }

      // Speed control: yield to event loop so SSE flushes
      if (merged.speedMs && merged.speedMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, merged.speedMs!));
      } else {
        // Yield every step to keep SSE keepalive / event loop responsive
        await new Promise<void>((resolve) => setImmediate(resolve));
      }

      // ─────────────────────────────────────────────────────────────
      // PHASE A — Process ALL symbols at this time step
      //   • Close TP/SL hits
      //   • Trail stops
      //   • Evaluate entry signals
      //   • Store candle snapshot per symbol
      // ─────────────────────────────────────────────────────────────
      const perSymbol: Map<string, {
        candle: MT5Rate;
        open: number; high: number; low: number; close: number;
        rsi: number; atr: number; pattern: { type: string; candle1: any; candle2: any };
        idx: number;
      }> = new Map();

      for (const tc of group.candles) {
        const symState = symbolStates.get(tc.symbol);
        if (!symState) continue;

        const idx = symbolCandleIdx.get(tc.symbol) ?? warmupCandles;
        const currentCandle = symState.rates[idx];
        const currentPrice = currentCandle.close;

        // ── Incremental RSI (O(1)) ────────────────────────────────
        const rsiState = symbolRSIState.get(tc.symbol)!;
        aiTradingEngine.feedRSI(rsiState, currentPrice);
        const rsi = aiTradingEngine.getRSIValue(rsiState);

        // ── Incremental ATR (O(1)) ────────────────────────────────
        const atrState = symbolATRState.get(tc.symbol)!;
        aiTradingEngine.feedATR(atrState, currentCandle.high, currentCandle.low, currentPrice);
        const atr = aiTradingEngine.getATRValue(atrState);

        // ── Engulfing (always O(1), just last 2 candles) ─────────
        const prevCandle = idx > 0 ? symState.rates[idx - 1] : currentCandle;
        const pattern = aiTradingEngine.detectEngulfing([
          { time: prevCandle.time, open: prevCandle.open, high: prevCandle.high, low: prevCandle.low, close: prevCandle.close },
          { time: currentCandle.time, open: currentCandle.open, high: currentCandle.high, low: currentCandle.low, close: currentCandle.close },
        ]);

        // Store snapshot
        perSymbol.set(tc.symbol, {
          candle: currentCandle, open: currentCandle.open, high: currentCandle.high,
          low: currentCandle.low, close: currentCandle.close,
          rsi, atr, pattern, idx,
        });

        // ── Manage open trades for THIS symbol ───────────────────
        const toClose: Array<{ key: string; exitPrice: number; reason: SimulatedTrade["closeReason"] }> = [];
        for (const [key, trade] of openTrades) {
          if (trade.symbol !== tc.symbol) continue;
          trade.barsHeld++;

          let hitSL = false;
          let hitTP = false;

          // Spread + slippage for exit simulation
          const spreadVal = (merged.spreadPips || 0) * 0.0001;
          const slippageVal = (merged.slippagePips || 0) * 0.0001;

          // 1. Check Standard SL/TP using accurate Bid/Ask representation
          // In MT5, OHLC is based on Bid prices.
          const candleLowBid = currentCandle.low;
          const candleHighBid = currentCandle.high;
          const candleLowAsk = currentCandle.low + spreadVal;
          const candleHighAsk = currentCandle.high + spreadVal;

          if (trade.direction === "BUY") {
            // BUY closed by selling at BID
            if (candleLowBid <= trade.sl) hitSL = true;
            if (candleHighBid >= trade.tp) hitTP = true;
          } else {
            // SELL closed by buying at ASK
            if (candleHighAsk >= trade.sl) hitSL = true;
            if (candleLowAsk <= trade.tp) hitTP = true;
          }

          if (hitSL && hitTP) {
            // Both hit in the same candle: assume SL hit (conservative)
            // The SL price is already the trigger price, just add adverse slippage
            const slExit = trade.direction === "BUY"
              ? trade.sl - slippageVal  // closed at BID, worse
              : trade.sl + slippageVal; // closed at ASK, worse
            toClose.push({ key, exitPrice: slExit, reason: "SL_HIT" });
            continue;
          } else if (hitSL) {
            const slExit = trade.direction === "BUY"
              ? trade.sl - slippageVal
              : trade.sl + slippageVal;
            toClose.push({ key, exitPrice: slExit, reason: "SL_HIT" });
            continue;
          } else if (hitTP) {
            // TP hit exactly at TP price (no slippage on favorable exit)
            const tpExit = trade.tp;
            toClose.push({ key, exitPrice: tpExit, reason: "TP_HIT" });
            continue;
          }

          // 2. Trailing stop (cheap — O(1))
          if (merged.trailingStop.enabled) {
            const trailResult = aiTradingEngine.calculateTrailingStopSL({
              positionType: trade.direction, 
              currentPrice, // trail updates based on Close
              currentSL: trade.sl, 
              atrValue: atr,
              trailATR: merged.trailingStop.trailATR,
              activationATR: merged.trailingStop.activationATR,
              entryPrice: trade.entryPrice,
            });
            if (trailResult.shouldUpdate) {
              const oldSL = trade.sl;
              trade.sl = trailResult.newSL;
              trade.trailingHistory.push({ time: currentCandle.time, oldSL, newSL: trailResult.newSL });
            }

            // Check if trailing SL is hit using candle High/Low
            if (trade.direction === "BUY" && currentCandle.low <= trade.sl) {
              toClose.push({ key, exitPrice: trade.sl, reason: "SL_HIT" });
              continue;
            }
            if (trade.direction === "SELL" && currentCandle.high >= trade.sl) {
              toClose.push({ key, exitPrice: trade.sl, reason: "SL_HIT" });
              continue;
            }
          }

          // 3. Reverse signal
          if (trade.direction === "BUY" && pattern.type === "BEARISH_ENGULFING") {
            toClose.push({ key, exitPrice: currentPrice, reason: "SIGNAL_REVERSE" });
            continue;
          }
          if (trade.direction === "SELL" && pattern.type === "BULLISH_ENGULFING") {
            toClose.push({ key, exitPrice: currentPrice, reason: "SIGNAL_REVERSE" });
            continue;
          }
        }

        for (const item of toClose) {
          const { key, exitPrice, reason } = item;
          const trade = openTrades.get(key)!;
          const pnl = this.calculatePnL(trade.direction, trade.entryPrice, exitPrice, trade.volume, symState.contractSize);
          const pnlPercent = trade.volume > 0 ? (pnl / (trade.entryPrice * trade.volume)) * 100 : 0;

          tradeResults.push({
            entryTime: trade.entryTime, exitTime: currentCandle.time,
            symbol: trade.symbol, direction: trade.direction,
            entryPrice: trade.entryPrice, exitPrice,
            sl: trade.sl, tp: trade.tp, volume: trade.volume,
            pnl, pnlPercent, closeReason: reason,
            rsiAtEntry: trade.rsiAtEntry, atrAtEntry: trade.atrAtEntry,
            pattern: trade.pattern, confidence: trade.confidence,
            trailingHistory: trade.trailingHistory,
            primaryMethodology: trade.primaryMethodology,
            methodologyConfidence: trade.methodologyConfidence,
            methodologyCount: trade.methodologyCount,
          });

          equity += pnl;
          allReturns.push(pnlPercent);
          if (pnl > 0) { winCount++; totalWin += pnl; if (pnl > largestWin) largestWin = pnl; }
          else { lossCount++; totalLoss += Math.abs(pnl); if (Math.abs(pnl) > largestLoss) largestLoss = Math.abs(pnl); }

          openTrades.delete(key);

          emit({
            type: "trade_close",
            data: {
              entryTime: trade.entryTime, exitTime: currentCandle.time,
              symbol: trade.symbol, direction: trade.direction,
              entryPrice: trade.entryPrice, exitPrice,
              pnl, pnlPercent, reason, confidence: trade.confidence,
              primaryMethodology: trade.primaryMethodology,
            },
          });
        }

        // ── Check for new entry signals (multi-methodology) ──
        const signalCounter = signalCounters.get(tc.symbol) ?? 0;
        const doEval = signalCounter % merged.signalInterval === 0;
        signalCounters.set(tc.symbol, (signalCounter + 1) % merged.signalInterval);

        if (doEval && openTrades.size < merged.maxOpenPositions) {
          let newTrade: OpenSimTrade | null = null;
          const volumeBuy = openTrades.size === 0 || !Array.from(openTrades.values()).some(t => t.direction === "BUY");
          const volumeSell = openTrades.size === 0 || !Array.from(openTrades.values()).some(t => t.direction === "SELL");

          const strategyCandles = symState.rates.slice(Math.max(0, idx + 1 - MAX_STRATEGY_CANDLES), idx + 1).map((r: MT5Rate) => ({
            time: r.time, open: r.open, high: r.high, low: r.low, close: r.close,
          }));

          // Build proper fractal context for multi-timeframe approximation
          // In backtest we don't have separate TF data, so we simulate:
          //   - direction: full candle window (HTF perspective)
          //   - setup: last 2/3 of candles (MTF perspective)
          //   - entry: last 1/3 of candles (LTF perspective)
          const dirCandles = strategyCandles;
          const setupCandles = strategyCandles.slice(Math.max(0, strategyCandles.length - Math.floor(strategyCandles.length * 2 / 3)));
          const entryCandles = strategyCandles.slice(Math.max(0, strategyCandles.length - Math.floor(strategyCandles.length / 3)));

          const dirMs = marketStructureService.analyzeMarketStructure(dirCandles);
          const setupMs = marketStructureService.analyzeMarketStructure(setupCandles);
          const entryMs = marketStructureService.analyzeMarketStructure(entryCandles);

          // Compute alignment properly instead of hardcoding true
          const isAligned = dirMs.trend.direction === setupMs.trend.direction &&
                            setupMs.trend.direction === entryMs.trend.direction;

          const fractalCtx = {
            direction: dirCandles,
            setup: setupCandles,
            entry: entryCandles,
            directionStr: dirMs,
            setupStr: setupMs,
            entryStr: entryMs,
            isAligned,
          };
          const [smcSignals, ictSignals, msnrSignals, crtSignals, quarterlySignals, litSignals] = [
            smcStrategy.analyze(fractalCtx),
            ictStrategy.analyze(fractalCtx),
            msnrStrategy.analyze(fractalCtx),
            crtStrategy.analyze(fractalCtx),
            quarterlyTheoryStrategy.analyze(fractalCtx),
            litStrategy.analyze(fractalCtx),
          ];

          let rsiEngulfSignal: any = null;
          if (rsi < merged.entrySettings.rsiOversold && pattern.type === "BULLISH_ENGULFING" && volumeBuy) {
            rsiEngulfSignal = {
              direction: "BUY", entry: currentPrice,
              sl: currentPrice - atr * merged.entrySettings.atrMultiplierSL,
              tp: currentPrice + atr * merged.entrySettings.atrMultiplierTP,
              confidence: this.calcConfidence(rsi, pattern, merged.entrySettings.rsiOversold),
            };
          } else if (rsi > merged.entrySettings.rsiOverbought && pattern.type === "BEARISH_ENGULFING" && volumeSell) {
            rsiEngulfSignal = {
              direction: "SELL", entry: currentPrice,
              sl: currentPrice + atr * merged.entrySettings.atrMultiplierSL,
              tp: currentPrice - atr * merged.entrySettings.atrMultiplierTP,
              confidence: this.calcConfidence(rsi, pattern, merged.entrySettings.rsiOverbought),
            };
          }

          const mw = merged.methodologyWeights ?? DEFAULT_METHODOLOGY_WEIGHTS;
          const am = merged.activeMethodologies ?? (Object.keys(DEFAULT_METHODOLOGY_WEIGHTS) as MethodologyName[]);

          const confluence = confluenceEngine.calculateConfluence(
            {
              smc: smcSignals[0] ?? null, ict: ictSignals[0] ?? null,
              msnr: msnrSignals[0] ?? null, crt: crtSignals[0] ?? null,
              quarterly: quarterlySignals[0] ?? null, lit: litSignals[0] ?? null,
              rsiEngulf: rsiEngulfSignal,
            }, mw, am,
          );

          if (confluence.finalSignal) {
            const fs = confluence.finalSignal;
            const dirOk = fs.direction === "BUY" ? volumeBuy : volumeSell;
            if (dirOk) {
              // Apply spread + slippage to entry price
              const spreadValue = (merged.spreadPips || 0) * 0.0001;
              const slippageValue = (merged.slippagePips || 0) * 0.0001;
              const simulatedEntry = fs.direction === "BUY"
                ? fs.entry + spreadValue + slippageValue
                : fs.entry - spreadValue - slippageValue;
              const vol = aiTradingEngine.calculatePositionSize({
                accountBalance: equity, riskPercent: merged.maxRiskPerTrade,
                entryPrice: simulatedEntry, stopLoss: fs.sl,
                atr,
                contractSize: symState.contractSize, volumeMin: symState.volumeMin,
                volumeMax: symState.volumeMax, volumeStep: symState.volumeStep,
              });
              newTrade = {
                symbol: tc.symbol, direction: fs.direction,
                entryPrice: simulatedEntry, entryTime: currentCandle.time,
                sl: fs.sl, tp: fs.tp, volume: vol,
                rsiAtEntry: rsi, atrAtEntry: atr,
                pattern: `MULTI_${fs.primaryMethodology.toUpperCase()}`,
                confidence: fs.confidence, barsHeld: 0, trailingHistory: [],
                primaryMethodology: fs.primaryMethodology,
                methodologyConfidence: fs.confluenceScore,
                methodologyCount: fs.totalAgreeing,
              };
            }
          }

          // Fallback RSI+Engulf (only if rsiEngulf is in activeMethodologies)
          if (!newTrade && am.includes("rsiEngulf")) {
            if (rsi < merged.entrySettings.rsiOversold && pattern.type === "BULLISH_ENGULFING" && volumeBuy) {
              const spreadValue = (merged.spreadPips || 0) * 0.0001;
              const entryPrice = currentPrice + spreadValue;
              const sl = entryPrice - atr * merged.entrySettings.atrMultiplierSL;
              const tp = entryPrice + atr * merged.entrySettings.atrMultiplierTP;
              const confidence = this.calcConfidence(rsi, pattern, merged.entrySettings.rsiOversold);
              const vol = aiTradingEngine.calculatePositionSize({
                accountBalance: equity, riskPercent: merged.maxRiskPerTrade,
                entryPrice: entryPrice, stopLoss: sl, atr,
                contractSize: symState.contractSize, volumeMin: symState.volumeMin,
                volumeMax: symState.volumeMax, volumeStep: symState.volumeStep,
              });
              newTrade = {
                symbol: tc.symbol, direction: "BUY", entryPrice: entryPrice,
                entryTime: currentCandle.time, sl, tp, volume: vol,
                rsiAtEntry: rsi, atrAtEntry: atr, pattern: pattern.type, confidence,
                barsHeld: 0, trailingHistory: [],
                primaryMethodology: "rsiEngulf", methodologyConfidence: confidence, methodologyCount: 1,
              };
            } else if (rsi > merged.entrySettings.rsiOverbought && pattern.type === "BEARISH_ENGULFING" && volumeSell) {
              const spreadValue = (merged.spreadPips || 0) * 0.0001;
              const entryPrice = currentPrice - spreadValue;
              const sl = entryPrice + atr * merged.entrySettings.atrMultiplierSL;
              const tp = entryPrice - atr * merged.entrySettings.atrMultiplierTP;
              const confidence = this.calcConfidence(rsi, pattern, merged.entrySettings.rsiOverbought);
              const vol = aiTradingEngine.calculatePositionSize({
                accountBalance: equity, riskPercent: merged.maxRiskPerTrade,
                entryPrice: entryPrice, stopLoss: sl, atr,
                contractSize: symState.contractSize, volumeMin: symState.volumeMin,
                volumeMax: symState.volumeMax, volumeStep: symState.volumeStep,
              });
              newTrade = {
                symbol: tc.symbol, direction: "SELL", entryPrice: entryPrice,
                entryTime: currentCandle.time, sl, tp, volume: vol,
                rsiAtEntry: rsi, atrAtEntry: atr, pattern: pattern.type, confidence,
                barsHeld: 0, trailingHistory: [],
                primaryMethodology: "rsiEngulf", methodologyConfidence: confidence, methodologyCount: 1,
              };
            }
          }

          if (newTrade) {
            const key = `${newTrade.direction}_${newTrade.symbol}`;
            openTrades.set(key, newTrade);
            emit({
              type: "trade_open",
              data: {
                time: newTrade.entryTime, symbol: newTrade.symbol,
                direction: newTrade.direction, entryPrice: newTrade.entryPrice,
                sl: newTrade.sl, tp: newTrade.tp, volume: newTrade.volume,
                confidence: newTrade.confidence, rsi: newTrade.rsiAtEntry,
                pattern: newTrade.pattern, primaryMethodology: newTrade.primaryMethodology,
              },
            });
          }
        }

        // Advance candle index for this symbol
        symbolCandleIdx.set(tc.symbol, idx + 1);
      }

      // ─────────────────────────────────────────────────────────────
      // PHASE B — Calculate global floating PnL across ALL positions
      //           using each symbol's current candle close
      // ─────────────────────────────────────────────────────────────
      let floatingPnL = 0;
      let totalUsedMargin = 0;
      for (const [_, trade] of openTrades) {
        const symState = symbolStates.get(trade.symbol);
        if (!symState) continue;
        const idx = symbolCandleIdx.get(trade.symbol);
        if (idx === undefined || idx < 1) continue;
        // idx was already advanced past this symbol's candle in Phase A,
        // so idx - 1 is the current candle (the same one the trade was evaluated against)
        const latestC = symState.rates[idx - 1];
        if (!latestC) continue;

        const pnl = this.calculatePnL(trade.direction, trade.entryPrice, latestC.close, trade.volume, symState.contractSize);
        floatingPnL += pnl;
        totalUsedMargin += this.calculateMarginRequired(trade.entryPrice, trade.volume, symState.contractSize, merged.leverage);
      }

      const currentEquity = equity + floatingPnL;
      if (currentEquity > peakEquity) peakEquity = currentEquity;
      const drawdown = peakEquity - currentEquity;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;

      const globalMarginLevel = totalUsedMargin > 0
        ? Math.round((currentEquity / totalUsedMargin) * 10000) / 100
        : 0;

      // ─────────────────────────────────────────────────────────────
      // PHASE C — Emit candle events for ALL symbols at this time step
      //           with the SAME global equity (smooth, consistent curve)
      // ─────────────────────────────────────────────────────────────
      for (const [sym, snap] of perSymbol) {
        emit({
          type: "candle",
          data: {
            time: snap.candle.time,
            symbol: sym,
            open: snap.open,
            high: snap.high,
            low: snap.low,
            close: snap.close,
            rsi: Math.round(snap.rsi * 100) / 100,
            atr: Math.round(snap.atr * 100000) / 100000,
            pattern: snap.pattern.type,
            equity: Math.round(currentEquity * 100) / 100,
            floatingPnL: Math.round(floatingPnL * 100) / 100,
            marginLevel: globalMarginLevel,
          },
        });
      }

      // ── Record equity curve (one point per time step) ──
      const equityPoint = {
        time: group.time,
        equity: Math.round(currentEquity * 100) / 100,
        floatingPnL: Math.round(floatingPnL * 100) / 100,
        openTrades: openTrades.size,
      };
      equityCurve.push(equityPoint);

      // Emit equity event for global PnL tracking
      emit({
        type: "equity",
        data: {
          time: group.time,
          equity: Math.round(currentEquity * 100) / 100,
          floatingPnL: Math.round(floatingPnL * 100) / 100,
        },
      });
      const progressPct = Math.round((timelineStep / totalTimelineSteps) * 100);
      if (progressPct - lastProgressPct >= MIN_PROGRESS_INTERVAL_PCT || timelineStep === totalTimelineSteps) {
        lastProgressPct = progressPct;

        if (merged.sessionId) {
          const { backtestSessionManager } = require('./backtest-session.manager');
          backtestSessionManager.saveCheckpoint(merged.sessionId, {
            progressPercent: progressPct,
            timelineStep,
            totalSteps: totalTimelineSteps,
            lastEquity: Math.round(currentEquity * 100) / 100,
            openTradeCount: openTrades.size,
            completedTradeCount: tradeResults.length,
          });
        }

        emit({
          type: "progress",
          data: {
            currentCandle: timelineStep,
            totalCandles: totalTimelineSteps,
            percent: progressPct,
          },
        });
        // Progress flush not needed — every step already yields
      }

      // Stop if account blown
      if (currentEquity <= merged.initialBalance * 0.01) {
        silentLogger.info(`[BACKTEST] Account blown at step ${timelineStep}, equity: ${currentEquity}`);
        break;
      }
    }

    // ── 6. Force close any remaining open trades ───────────────────
    for (const [key, trade] of openTrades) {
      const symState = symbolStates.get(trade.symbol);
      if (!symState) continue;
      const lastCandle = symState.rates[symState.rates.length - 1];
      const pnl = this.calculatePnL(trade.direction, trade.entryPrice, lastCandle.close, trade.volume, symState.contractSize);

      tradeResults.push({
        entryTime: trade.entryTime,
        exitTime: lastCandle.time,
        symbol: trade.symbol,
        direction: trade.direction,
        entryPrice: trade.entryPrice,
        exitPrice: lastCandle.close,
        sl: trade.sl,
        tp: trade.tp,
        volume: trade.volume,
        pnl,
        pnlPercent: trade.volume > 0 ? (pnl / (trade.entryPrice * trade.volume)) * 100 : 0,
        closeReason: "TIMEOUT",
        rsiAtEntry: trade.rsiAtEntry,
        atrAtEntry: trade.atrAtEntry,
        pattern: trade.pattern,
        confidence: trade.confidence,
        trailingHistory: trade.trailingHistory,
        primaryMethodology: trade.primaryMethodology,
        methodologyConfidence: trade.methodologyConfidence,
        methodologyCount: trade.methodologyCount,
      });

      emit({
        type: "trade_close",
        data: {
          entryTime: trade.entryTime,
          exitTime: lastCandle.time,
          symbol: trade.symbol,
          direction: trade.direction,
          entryPrice: trade.entryPrice,
          exitPrice: lastCandle.close,
          pnl,
          pnlPercent: trade.volume > 0 ? (pnl / (trade.entryPrice * trade.volume)) * 100 : 0,
          reason: "TIMEOUT",
          confidence: trade.confidence,
          primaryMethodology: trade.primaryMethodology,
        },
      });
    }

    // ── 7. Calculate final metrics ─────────────────────────────────
    // Emit final progress before calculations
    emit({
      type: "progress",
      data: {
        currentCandle: totalTimelineSteps,
        totalCandles: totalTimelineSteps,
        percent: 100,
      },
    });

    const totalTrades = tradeResults.length;
    const endEquity = equity;
    const totalPnL = endEquity - merged.initialBalance;
    const totalPnLPercent = (totalPnL / merged.initialBalance) * 100;
    const maxDrawdownPercent = peakEquity > 0 ? (maxDrawdown / peakEquity) * 100 : 0;
    const winRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0;
    const profitFactor = totalLoss > 0 ? totalWin / totalLoss : totalWin > 0 ? Infinity : 0;
    const recoveryFactor = maxDrawdown > 0 ? totalPnL / maxDrawdown : totalPnL > 0 ? Infinity : 0;
    const avgWin = winCount > 0 ? totalWin / winCount : 0;
    const avgLoss = lossCount > 0 ? totalLoss / lossCount : 0;

    // ── Calculate symbol stats ───────────────────────────────────────
    const symMap = new Map<string, { wins: number; losses: number; breakEven: number; pnl: number }>();
    for (const t of tradeResults) {
      if (!symMap.has(t.symbol)) symMap.set(t.symbol, { wins: 0, losses: 0, breakEven: 0, pnl: 0 });
      const s = symMap.get(t.symbol)!;
      s.pnl += t.pnl;
      if (t.pnl > 0) s.wins++;
      else if (t.pnl < 0) s.losses++;
      else s.breakEven++;
    }
    const symbolStats: SymbolStat[] = Array.from(symMap.entries()).map(([symbol, s]) => {
      const total = s.wins + s.losses + s.breakEven;
      return {
        symbol,
        totalTrades: total,
        winningTrades: s.wins,
        losingTrades: s.losses,
        breakEvenTrades: s.breakEven,
        totalPnL: Math.round(s.pnl * 100) / 100,
        winRate: total > 0 ? Math.round((s.wins / total) * 10000) / 100 : 0,
      };
    }).sort((a, b) => b.totalTrades - a.totalTrades);

    // ── Calculate methodology stats ───────────────────────────────────
    const methMap = new Map<string, { wins: number; losses: number; pnl: number; confSum: number; count: number }>();
    for (const t of tradeResults) {
      const m = t.primaryMethodology || "unknown";
      if (!methMap.has(m)) methMap.set(m, { wins: 0, losses: 0, pnl: 0, confSum: 0, count: 0 });
      const mm = methMap.get(m)!;
      mm.count++;
      mm.pnl += t.pnl;
      mm.confSum += t.confidence;
      if (t.pnl > 0) mm.wins++;
      else if (t.pnl < 0) mm.losses++;
    }
    const methodologyStats: MethodologyStat[] = Array.from(methMap.entries())
      .filter(([methodology]) => methodology !== "unknown")
      .map(([methodology, m]) => ({
      methodology,
      totalTrades: m.count,
      winningTrades: m.wins,
      losingTrades: m.losses,
      totalPnL: Math.round(m.pnl * 100) / 100,
      winRate: m.count > 0 ? Math.round((m.wins / m.count) * 10000) / 100 : 0,
      avgConfidence: m.count > 0 ? Math.round(m.confSum / m.count) : 0,
    })).sort((a, b) => b.totalTrades - a.totalTrades);

    const avgReturn = allReturns.length > 0
      ? allReturns.reduce((a, b) => a + b, 0) / allReturns.length
      : 0;
    const variance = allReturns.length > 1
      ? allReturns.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) / (allReturns.length - 1)
      : 0;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

    const avgBarsHeld = tradeResults.length > 0
      ? tradeResults.reduce((sum, t) => sum + (t.exitTime - t.entryTime), 0) / tradeResults.length
      : 0;

    // ── 8. Persist to DB ───────────────────────────────────────────
    let savedDocId: string | undefined;
    try {
      const saved = await BacktestExperience.create({
        userId,
        symbol: merged.symbols.join(","),
        symbols: merged.symbols,
        timeframe: merged.timeframe,
        dateRange: { from: merged.fromDate, to: merged.toDate },
        strategy: {
          name: `MULTI_METHODOLOGY${merged.methodologyWeights ? "_WEIGHTED" : ""}`,
          params: merged,
        },
        result: {
          totalTrades,
          winningTrades: winCount,
          losingTrades: lossCount,
          winRate: Math.round(winRate * 100) / 100,
          totalPnL: Math.round(totalPnL * 100) / 100,
          totalPnLPercent: Math.round(totalPnLPercent * 100) / 100,
          maxDrawdownPercent: Math.round(maxDrawdownPercent * 100) / 100,
          profitFactor: Math.round(profitFactor * 100) / 100,
          sharpeRatio: Math.round(sharpeRatio * 100) / 100,
          averageWin: Math.round(avgWin * 100) / 100,
          averageLoss: Math.round(avgLoss * 100) / 100,
          equityCurve,
          recoveryFactor: Math.round(recoveryFactor * 100) / 100,
          symbolStats,
          methodologyStats,
        },
        pipelineConfigSnapshot: merged,
      });
      savedDocId = saved._id?.toString();
    } catch (dbError: any) {
      silentLogger.error(`[BACKTEST] Failed to save result: ${dbError.message}`);
    }

    silentLogger.info(
      `[BACKTEST] ${merged.symbols.join(",")} ${merged.timeframe}: ${totalTrades} trades, ${Math.round(winRate)}% win rate, ${Math.round(totalPnLPercent)}% return`,
    );

    const result: BacktestResult = {
      backtestId: savedDocId,
      symbols: merged.symbols,
      timeframe: merged.timeframe,
      fromDate: merged.fromDate,
      toDate: merged.toDate,
      config: merged,
      totalCandles: totalTimelineSteps,
      totalTrades,
      winningTrades: winCount,
      losingTrades: lossCount,
      winRate: Math.round(winRate * 100) / 100,
      totalPnL: Math.round(totalPnL * 100) / 100,
      totalPnLPercent: Math.round(totalPnLPercent * 100) / 100,
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
      maxDrawdownPercent: Math.round(maxDrawdownPercent * 100) / 100,
      profitFactor: Math.round(profitFactor * 100) / 100,
      sharpeRatio: Math.round(sharpeRatio * 100) / 100,
      averageWin: Math.round(avgWin * 100) / 100,
      averageLoss: Math.round(avgLoss * 100) / 100,
      largestWin: Math.round(largestWin * 100) / 100,
      largestLoss: Math.round(largestLoss * 100) / 100,
      averageBarsHeld: Math.round(avgBarsHeld),
      recoveryFactor: Math.round(recoveryFactor * 100) / 100,
      equityCurve,
      trades: tradeResults,
      symbolStats,
      methodologyStats,
    };

    emit({ type: "complete", data: result });

    // Auto-save the aggregated result to AI Backtest Skill database
    try {
      const { aiBacktestSkillService } = require("./ai-backtest-skill.service");
      await aiBacktestSkillService.updateSkill(userId, result);
    } catch (err: any) {
      silentLogger.error(`[BACKTEST] Failed to trigger skill aggregation: ${err.message}`);
    }

    return result;
  }

  // ─── Helpers ─────────────────────────────────────────────────────

  private calculateMarginRequired(
    price: number,
    volume: number,
    contractSize: number,
    leverage: number,
  ): number {
    return (price * volume * contractSize) / leverage;
  }

  calculatePnL(
    direction: "BUY" | "SELL",
    entry: number,
    exit: number,
    volume: number,
    contractSizeArg?: number,
  ): number {
    const cs = contractSizeArg ?? 100000;
    if (direction === "BUY") {
      return (exit - entry) * volume * cs;
    }
    return (entry - exit) * volume * cs;
  }

  private calcConfidence(
    rsi: number,
    pattern: { type: string; candle1: any; candle2: any },
    threshold: number,
  ): number {
    let confidence = 50;
    const extremity = Math.abs(rsi - threshold);
    confidence += Math.min(25, extremity * 2);

    const currBody = Math.abs(pattern.candle2.close - pattern.candle2.open);
    const prevBody = Math.abs(pattern.candle1.close - pattern.candle1.open);
    if (prevBody > 0) {
      const ratio = currBody / prevBody;
      confidence += Math.min(25, ratio * 10);
    }

    return Math.round(Math.max(0, Math.min(100, confidence)));
  }
}

export const backtestService = new BacktestService();
