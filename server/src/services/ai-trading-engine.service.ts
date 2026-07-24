// ─── AI Trading Engine v2 — Multi-Methodology ───────────────────────
// Combines all 7 trading methodologies via the Confluence Engine.

import { mt5McpService, type MT5Rate, type MT5Symbol } from "./mt5-mcp.service";
import { silentLogger } from "../utils/silent-logger";
import {
  marketStructureService,
  smcStrategy,
  ictStrategy,
  msnrStrategy,

  confluenceEngine,
  atrService,
  ipdaContextService,
  type MarketStructure,
  type MethodologyWeights,
  type MethodologyName,
  type ConfluenceResult,
  type IPDAContext,
  DEFAULT_METHODOLOGY_WEIGHTS,
} from "./strategies/index";

// ─── Incremental Indicator Types ──────────────────────────────────────

export interface RSIState {
  avgGain: number;
  avgLoss: number;
  period: number;
  count: number;
  previousClose: number | null;
}

export interface ATRState {
  atr: number;
  period: number;
  count: number;
  previousClose: number;
}

// ─── Legacy Types (kept for backwards compatibility) ─────────────────

export interface SignalAnalysis {
  rsi: number;
  atr: number;
  pattern: "BULLISH_ENGULFING" | "BEARISH_ENGULFING" | "NONE";
  currentPrice: number;
  signal: TradingSignal | null;
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
  indicators: {
    rsi: number;
    atr: number;
  };
  pattern: string;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface EngulfingResult {
  type: "BULLISH_ENGULFING" | "BEARISH_ENGULFING" | "NONE";
  candle1: Candle;
// ─── AI Trading Engine v2 — Multi-Methodology ───────────────────────
// Combines all 7 trading methodologies via the Confluence Engine.

import { mt5McpService, type MT5Rate, type MT5Symbol } from "./mt5-mcp.service";
import { silentLogger } from "../utils/silent-logger";
import {
  marketStructureService,
  smcStrategy,
  ictStrategy,
  msnrStrategy,

  confluenceEngine,
  atrService,
  ipdaContextService,
  type MarketStructure,
  type MethodologyWeights,
  type MethodologyName,
  type ConfluenceResult,
  type IPDAContext,
  DEFAULT_METHODOLOGY_WEIGHTS,
} from "./strategies/index";

// ─── Incremental Indicator Types ──────────────────────────────────────

export interface RSIState {
  avgGain: number;
  avgLoss: number;
  period: number;
  count: number;
  previousClose: number | null;
}

export interface ATRState {
  atr: number;
  period: number;
  count: number;
  previousClose: number;
}

// ─── Legacy Types (kept for backwards compatibility) ─────────────────

export interface SignalAnalysis {
  rsi: number;
  atr: number;
  pattern: "BULLISH_ENGULFING" | "BEARISH_ENGULFING" | "NONE";
  currentPrice: number;
  signal: TradingSignal | null;
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
  indicators: {
    rsi: number;
    atr: number;
  };
  pattern: string;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface EngulfingResult {
  type: "BULLISH_ENGULFING" | "BEARISH_ENGULFING" | "NONE";
  candle1: Candle;
  candle2: Candle;
}

export interface SymbolAnalysis {
  symbol: string;
  signal: SignalAnalysis;
  symbolInfo: MT5Symbol | null;
}

export type Timeframe = "M1" | "M5" | "M15" | "M30" | "H1" | "H4" | "D1";

// ─── NEW: Multi-Strategy Analysis Types ─────────────────────────────

export interface MultiStrategySymbolAnalysis {
  symbol: string;
  marketStructure: MarketStructure;
  methodologySignals: {
    smc: ReturnType<typeof smcStrategy.analyze>;
    ict: ReturnType<typeof ictStrategy.analyze>;
    msnr: ReturnType<typeof msnrStrategy.analyze>;
  };
  confluence: ConfluenceResult;
  ipdaContext?: IPDAContext;
  /** Legacy backwards‑compat shape */
  signal: SignalAnalysis;
}

interface EngulfingAnalysisResult {
  direction: "BUY" | "SELL";
  confidence: number;
  entry: number;
  sl: number;
  tp: number;
}

// ─── Constants ───────────────────────────────────────────────────────

const RSI_PERIOD = 14;
const ATR_PERIOD = 14;
const RSI_OVERSOLD = 30;
const RSI_OVERBOUGHT = 70;

// ─── Service ─────────────────────────────────────────────────────────

class AITradingEngine {
  getFractalTimeframes(baseTf: Timeframe): { direction: Timeframe; setup: Timeframe; entry: Timeframe } {
    switch (baseTf) {
      case "H4": return { direction: "H4", setup: "H1", entry: "M15" };
      case "H1": return { direction: "H1", setup: "M15", entry: "M5" };
      case "M30": return { direction: "H4", setup: "H1", entry: "M5" };
      case "M15": return { direction: "H1", setup: "M15", entry: "M5" };
      case "M5": return { direction: "H1", setup: "M5", entry: "M5" };
      default: return { direction: "D1", setup: "H4", entry: "M15" };
    }
  }

  async analyzeSymbol(
    symbol: string,
    timeframe: Timeframe,
    riskPercent: number,
    methodologyWeights?: MethodologyWeights,
    activeMethodologies?: MethodologyName[],
  ): Promise<MultiStrategySymbolAnalysis> {
    const fractals = this.getFractalTimeframes(timeframe);
    const [dailyRates, directionRates, setupRates, entryRates] = await Promise.all([
      mt5McpService.getRates(symbol, "D1", 100),
      mt5McpService.getRates(symbol, fractals.direction, 100),
      mt5McpService.getRates(symbol, fractals.setup, 100),
      mt5McpService.getRates(symbol, fractals.entry, 100)
    ]);

    if (directionRates.length < RSI_PERIOD + 2 || setupRates.length < 10 || entryRates.length < 10) {
      return {
        symbol,
        marketStructure: null as any,
        methodologySignals: { smc: [], ict: [], msnr: [] },
        confluence: { finalSignal: null, allSignals: [], methodologyBreakdown: {}, conflictDetected: false, reason: "Insufficient data" },
        signal: this.emptySignal(directionRates),
      };
    }

    const dailyCandles: Candle[] = (dailyRates.length > 0 ? dailyRates : directionRates).map((r) => ({ time: r.time, open: r.open, high: r.high, low: r.low, close: r.close }));
    const directionCandles: Candle[] = directionRates.map((r) => ({ time: r.time, open: r.open, high: r.high, low: r.low, close: r.close }));
    const setupCandles: Candle[] = setupRates.map((r) => ({ time: r.time, open: r.open, high: r.high, low: r.low, close: r.close }));
    const entryCandles: Candle[] = entryRates.map((r) => ({ time: r.time, open: r.open, high: r.high, low: r.low, close: r.close }));

    const closes = directionRates.map((r) => r.close);
    const rsi = this.calculateRSI(closes, RSI_PERIOD);
    const atrPattern = atrService.calculate(directionRates);
    const pattern = this.detectEngulfing(directionCandles);
    const currentPrice = entryCandles[entryCandles.length - 1].close; // Use entry TF for most precise current price

    // ── 1. Market Structure Analysis & Alignment ───────────────────
    const dailyStructure = marketStructureService.analyzeMarketStructure(dailyCandles);
    const directionStructure = marketStructureService.analyzeMarketStructure(directionCandles);
    const setupStructure = marketStructureService.analyzeMarketStructure(setupCandles);
    const entryStructure = marketStructureService.analyzeMarketStructure(entryCandles);

    // Relax alignment: allow 2-of-3 TF aligned OR direction TF aligned (major trend dominates)
    const dirTrend = directionStructure.trend.direction;
    const setupAligned = setupStructure.trend.direction === dirTrend;
    const entryAligned = entryStructure.trend.direction === dirTrend;
    const alignedCount = (dirTrend !== "SIDEWAYS" ? 1 : 0) + (setupAligned ? 1 : 0) + (entryAligned ? 1 : 0);
    const isAligned = alignedCount >= 2;

    // Build fractal object to pass into methodologies
    const fractalCtx = { 
      daily: dailyCandles,
      direction: directionCandles, 
      setup: setupCandles, 
      entry: entryCandles, 
      dailyStr: dailyStructure,
      directionStr: directionStructure,
      setupStr: setupStructure,
      entryStr: entryStructure,
      isAligned,
      dailyTimeframeStr: "D1",
      directionTimeframeStr: fractals.direction,
      setupTimeframeStr: fractals.setup,
      entryTimeframeStr: fractals.entry,
    };

    // ── IPDA Context for strategies ───────────────────────────────
    const ipdaCtx = ipdaContextService.buildContext(
      directionCandles, directionStructure,
      entryCandles, entryStructure,
      entryCandles[entryCandles.length - 1]?.time || 0,
    );

    // ── 2. Run all strategies in parallel ────────────────────────
    const [smcSignals, ictSignals, msnrSignals] =
      await Promise.all([
        Promise.resolve(smcStrategy.analyze(fractalCtx, ipdaCtx)),
        Promise.resolve(ictStrategy.analyze(fractalCtx, ipdaCtx)),
        Promise.resolve(msnrStrategy.analyze(fractalCtx, ipdaCtx)),
      ]);

    const confluence = confluenceEngine.calculateConfluence(
      { smc: smcSignals[0] ?? null, ict: ictSignals[0] ?? null, msnr: msnrSignals[0] ?? null },
      methodologyWeights,
      activeMethodologies,
    );

    const legacySignal = confluence.finalSignal
      ? {
          symbol, direction: confluence.finalSignal.direction, confidence: confluence.finalSignal.confidence, entry: confluence.finalSignal.entry, sl: confluence.finalSignal.sl, tp: confluence.finalSignal.tp, reason: confluence.reason, riskPercent, timeframe, indicators: { rsi, atr: atrPattern }, pattern: confluence.finalSignal.pattern ? `MULTI_STRATEGY_${confluence.finalSignal.primaryMethodology.toUpperCase()}_${confluence.finalSignal.pattern.toUpperCase()}` : `MULTI_STRATEGY_${confluence.finalSignal.primaryMethodology.toUpperCase()}`,
        }
      : null;

    return {
      symbol,
      marketStructure: directionStructure,
      methodologySignals: { smc: smcSignals, ict: ictSignals, msnr: msnrSignals },
      confluence,
      ipdaContext: ipdaCtx,
      signal: { rsi, atr: atrPattern, pattern: pattern.type, currentPrice, signal: legacySignal },
    };
  }

  /**
   * Analyze multiple symbols in parallel.
   */
  async analyzeSymbols(
    symbols: string[],
    timeframe: Timeframe,
    riskPercent: number,
    methodologyWeights?: MethodologyWeights,
    activeMethodologies?: MethodologyName[],
  ): Promise<MultiStrategySymbolAnalysis[]> {
    const results: MultiStrategySymbolAnalysis[] = [];
    const concurrency = 2;
    for (let i = 0; i < symbols.length; i += concurrency) {
      const batch = symbols.slice(i, i + concurrency);
      const batchPromises = batch.map((s) =>
        this.analyzeSymbol(s, timeframe, riskPercent, methodologyWeights, activeMethodologies).catch(err => {
          silentLogger.warn(`[AI-Engine] Failed to analyze ${s}: ${(err as Error).message}`);
          return null;
        })
      );
      const batchResults = await Promise.all(batchPromises);
      for (const res of batchResults) {
        if (res) results.push(res);
      }
    }
    return results;
  }

  /**
   * @deprecated Use analyzeSymbol() instead for multi‑strategy.
   */
  async analyzeSymbolLegacy(
    symbol: string,
    timeframe: Timeframe,
    riskPercent: number,
  ): Promise<SymbolAnalysis> {
    const multi = await this.analyzeSymbol(symbol, timeframe, riskPercent);
    return {
      symbol,
      signal: multi.signal,
      symbolInfo: null,
    };
  }

  /**
   * Calculate position size based on account risk.
   * Enforces HARD CAP of 1.0 LOT per position for all forex & crypto (BTCUSD) pairs.
   */
  calculatePositionSize(params: {
    accountBalance: number;
    riskPercent: number;
    entryPrice: number;
    stopLoss: number;
    atr?: number;
    contractSize: number;
    volumeMin: number;
    volumeMax: number;
    volumeStep: number;
    symbol?: string;
  }): number {
    const {
      accountBalance,
      riskPercent,
      entryPrice,
      stopLoss,
      atr,
      contractSize,
      volumeMin,
      volumeMax,
      volumeStep,
      symbol = "",
    } = params;

    const riskAmount = accountBalance * (riskPercent / 100);
    let slDistance = Math.abs(entryPrice - stopLoss);

    if (atr && atr > 0) {
      const minSlByAtr = atr * 1.5;
      const maxOverride = slDistance * 2;
      slDistance = Math.max(slDistance, Math.min(minSlByAtr, maxOverride));
    }

    let effectiveContractSize = contractSize > 0 ? contractSize : 100000;
    const cleanSym = symbol.toUpperCase();

    if (cleanSym.endsWith("JPY")) {
      const approxJpyRate = entryPrice > 50 ? entryPrice : 155;
      effectiveContractSize = effectiveContractSize / approxJpyRate;
    } else if (cleanSym.endsWith("CAD")) {
      effectiveContractSize = effectiveContractSize / 1.35;
    } else if (cleanSym.endsWith("GBP")) {
      effectiveContractSize = effectiveContractSize * 1.27;
    } else if (cleanSym.endsWith("EUR")) {
      effectiveContractSize = effectiveContractSize * 1.08;
    } else if (cleanSym.endsWith("AUD")) {
      effectiveContractSize = effectiveContractSize * 0.65;
    } else if (cleanSym.includes("BTC") || cleanSym.includes("CRYPTO")) {
      effectiveContractSize = contractSize > 0 ? contractSize : 1;
    }

    let lotSize = 0;
    if (slDistance > 0 && effectiveContractSize > 0) {
      lotSize = riskAmount / (slDistance * effectiveContractSize);
    }

    const rounded = Math.floor(lotSize / volumeStep) * volumeStep;
    const decimals = volumeStep.toString().split('.')[1]?.length || 0;
    let finalLot = parseFloat(rounded.toFixed(decimals));
    
    if (finalLot < volumeMin) {
      return 0;
    }
    
    // HARD CAP: Max 1.0 lot per position for all forex & crypto pairs (User Rule)
    const MAX_LOT_CAP = 1.0;
    return Math.min(finalLot, volumeMax, MAX_LOT_CAP);
  }
    positionType: "BUY" | "SELL";
    currentPrice: number;
    currentSL: number;
    atrValue: number;
    trailATR: number;
    activationATR: number;
    entryPrice: number;
  }): { shouldUpdate: boolean; newSL: number; reason: string } {
    const {
      positionType,
      currentPrice,
      currentSL,
      atrValue,
      trailATR,
      activationATR,
      entryPrice,
    } = params;

    const profitPrice =
      positionType === "BUY"
        ? currentPrice - entryPrice
        : entryPrice - currentPrice;
    const profitATR = atrValue > 0 ? profitPrice / atrValue : 0;

    if (profitATR < activationATR) {
      return {
        shouldUpdate: false,
        newSL: currentSL,
        reason: `Profit ${profitATR.toFixed(2)} ATR < activation ${activationATR} ATR`,
      };
    }

    const trailDist = atrValue * trailATR;
    const newSL =
      positionType === "BUY"
        ? currentPrice - trailDist
        : currentPrice + trailDist;

    let shouldUpdate = false;
    const EPSILON = 0.00001; // Toleransi pembulatan mikro
    if (positionType === "BUY" && newSL > currentSL + EPSILON) {
      shouldUpdate = true;
    } else if (positionType === "SELL" && (newSL < currentSL - EPSILON || currentSL === 0)) {
      shouldUpdate = true;
    }

    return {
      shouldUpdate,
      newSL: shouldUpdate ? newSL : currentSL,
      reason: shouldUpdate
        ? `Trailing SL ${positionType === "BUY" ? "up" : "down"} from ${currentSL.toFixed(5)} to ${newSL.toFixed(5)}`
        : "No trailing update needed",
    };
  }

  // ─── Technical Indicators (public for reuse by backtest) ──────────

  // ── Incremental RSI ────────────────────────────────────────────

  /** State object for incremental RSI tracking */
  createRSIState(): RSIState {
    return { avgGain: 0, avgLoss: 0, period: 14, count: 0, previousClose: null };
  }

  /**
   * Feed a close price through the incremental RSI calculator.
   * Must call `createRSIState()` first, then feed `period + 1` initial
   * closes, after which `rsi` holds the live value.
   * Returns the updated state (mutated in-place for perf).
   */
  feedRSI(state: RSIState, close: number): void {
    if (state.previousClose === null) {
      state.previousClose = close;
      state.count++;
      return;
    }

    const change = close - state.previousClose;
    state.previousClose = close;

    if (state.count < state.period + 1) {
      // Warmup phase: accumulate raw gains/losses
      if (change > 0) state.avgGain += change;
      else state.avgLoss -= change;
      state.count++;
      if (state.count === state.period + 1) {
        state.avgGain /= state.period;
        state.avgLoss /= state.period;
      }
    } else {
      // Steady state: Wilder's smoothing O(1)
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? -change : 0;
      state.avgGain = (state.avgGain * (state.period - 1) + gain) / state.period;
      state.avgLoss = (state.avgLoss * (state.period - 1) + loss) / state.period;
    }
  }

  /** Get current RSI value from incremental state, or 50 if not ready */
  getRSIValue(state: RSIState): number {
    if (state.count < state.period + 1) return 50;
    if (state.avgLoss === 0) return 100;
    const rs = state.avgGain / state.avgLoss;
    return 100 - 100 / (1 + rs);
  }

  // ── Incremental ATR ────────────────────────────────────────────

  createATRState(period: number): ATRState {
    return { atr: 0, period, count: 0, previousClose: 0 };
  }

  /** Feed one candle through incremental ATR. Returns updated state. */
  feedATR(state: ATRState, high: number, low: number, close: number): void {
    if (state.count === 0) {
      state.previousClose = close;
      state.count++;
      return;
    }

    const tr = Math.max(
      high - low,
      Math.abs(high - state.previousClose),
      Math.abs(low - state.previousClose),
    );
    state.previousClose = close;

    if (state.count <= state.period) {
      state.atr += tr;
      state.count++;
      if (state.count === state.period) {
        state.atr /= state.period;
      }
    } else {
      state.atr = (state.atr * (state.period - 1) + tr) / state.period;
    }
  }

  /** Get current ATR value, or 0 if not ready */
  getATRValue(state: ATRState): number {
    if (state.count < state.period) return 0;
    return state.atr;
  }

  // ── Legacy full-scan methods (kept for backward compat) ────────

  calculateRSI(closes: number[], period: number): number {
    if (closes.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = period + 1; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) {
        avgGain = (avgGain * (period - 1) + change) / period;
        avgLoss = (avgLoss * (period - 1)) / period;
      } else {
        avgGain = (avgGain * (period - 1)) / period;
        avgLoss = (avgLoss * (period - 1) - change) / period;
      }
    }

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }

  calculateATR(rates: MT5Rate[], period: number): number {
    if (rates.length < period + 1) return 0;

    let trSum = 0;
    const start = rates.length - period - 1;

    for (let i = start + 1; i < rates.length; i++) {
      const high = rates[i].high;
      const low = rates[i].low;
      const prevClose = rates[i - 1].close;
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose),
      );
      trSum += tr;
    }

    return trSum / period;
  }

  detectEngulfing(candles: Candle[]): EngulfingResult {
    const len = candles.length;
    if (len < 2) {
      return { type: "NONE", candle1: candles[len - 1], candle2: candles[len - 1] };
    }

    const prev = candles[len - 2];
    const curr = candles[len - 1];

    if (
      prev.close < prev.open &&
      curr.close > curr.open &&
      curr.open <= prev.close &&
      curr.close >= prev.open
    ) {
      return { type: "BULLISH_ENGULFING", candle1: prev, candle2: curr };
    }

    if (
      prev.close > prev.open &&
      curr.close < curr.open &&
      curr.open >= prev.close &&
      curr.close <= prev.open
    ) {
      return { type: "BEARISH_ENGULFING", candle1: prev, candle2: curr };
    }

    return { type: "NONE", candle1: prev, candle2: curr };
  }

  private calcConfidence(
    rsi: number,
    pattern: EngulfingResult,
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

  private emptySignal(rates: MT5Rate[]): SignalAnalysis {
    const closes = rates.map((r) => r.close);
    return {
      rsi: closes.length > 0 ? this.calculateRSI(closes, RSI_PERIOD) : 50,
      atr: this.calculateATR(rates, ATR_PERIOD),
      pattern: "NONE",
      currentPrice: closes[closes.length - 1] ?? 0,
      signal: null,
    };
  }
}

export const aiTradingEngine = new AITradingEngine();
