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

import { type Candle } from "./strategies/market-structure.service";
export { type Candle };

export type Timeframe = "M1" | "M5" | "M15" | "M30" | "H1" | "H4" | "D1";

export interface TradingSignal {
  symbol: string;
  direction: "BUY" | "SELL";
  confidence: number;
  entry: number;
  sl: number;
  tp: number;
  reason: string;
  riskPercent?: number;
  timeframe?: string;
  pattern?: string;
  indicators?: { rsi?: number; atr?: number };
}

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
}

// ─── Constants ───────────────────────────────────────────────────────

// ─── Service ─────────────────────────────────────────────────────────

class AITradingEngine {
  getFractalTimeframes(baseTf: Timeframe): { direction: Timeframe; setup: Timeframe; entry: Timeframe } {
    switch (baseTf) {
      case "H4": return { direction: "H4", setup: "H1", entry: "M15" };
      case "H1": return { direction: "H1", setup: "M15", entry: "M5" };
      case "M30": return { direction: "H4", setup: "H1", entry: "M5" };
      case "M15": return { direction: "H1", setup: "M15", entry: "M5" };
      case "M5": return { direction: "H1", setup: "M15", entry: "M5" };
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
      mt5McpService.getRates(symbol, fractals.direction, 500),
      mt5McpService.getRates(symbol, fractals.setup, 500),
      mt5McpService.getRates(symbol, fractals.entry, 500)
    ]);

    if (directionRates.length < 10 || setupRates.length < 10 || entryRates.length < 10) {
      return {
        symbol,
        marketStructure: null as any,
        methodologySignals: { smc: [], ict: [], msnr: [] },
        confluence: { finalSignal: null, allSignals: [], methodologyBreakdown: {}, conflictDetected: false, reason: "Insufficient data" }
      };
    }

    const dailyCandles: Candle[] = (dailyRates.length > 0 ? dailyRates : directionRates).map((r) => ({ time: r.time, open: r.open, high: r.high, low: r.low, close: r.close }));
    const directionCandles: Candle[] = directionRates.map((r) => ({ time: r.time, open: r.open, high: r.high, low: r.low, close: r.close }));
    const setupCandles: Candle[] = setupRates.map((r) => ({ time: r.time, open: r.open, high: r.high, low: r.low, close: r.close }));
    const entryCandles: Candle[] = entryRates.map((r) => ({ time: r.time, open: r.open, high: r.high, low: r.low, close: r.close }));

    // ── 1. Market Structure Analysis & Alignment ───────────────────
    const dailyStructure = marketStructureService.analyzeMarketStructure(dailyCandles);
    // Use Pure Price Action for Daily Trend (Intraday Bias) instead of Macro Swing Structure
    dailyStructure.trend = marketStructureService.analyzeDailyPriceAction(dailyCandles);
    const directionStructure = marketStructureService.analyzeMarketStructure(directionCandles);
    const setupStructure = marketStructureService.analyzeMarketStructure(setupCandles);
    const entryStructure = marketStructureService.analyzeMarketStructure(entryCandles);

    // Relax alignment: allow 2-of-3 TF aligned OR direction TF aligned (major trend dominates)
    const dirTrend = directionStructure.trend.direction;
    const setupAligned = setupStructure.trend.direction === dirTrend;
    const entryAligned = entryStructure.trend.direction === dirTrend;
    const alignedCount = (dirTrend !== "SIDEWAYS" ? 1 : 0) + (setupAligned ? 1 : 0) + (entryAligned ? 1 : 0);
    const isAligned = alignedCount >= 2;

    const symbolInfo = await mt5McpService.getSymbolInfo(symbol);

    // Build fractal object to pass into methodologies
    const fractalCtx: import("./strategies/market-structure.service").FractalContext = { 
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
      spread: symbolInfo?.spread || 0,
      point: symbolInfo?.point || 0.00001,
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
      { smc: smcSignals as any, ict: ictSignals as any, msnr: msnrSignals as any },
      methodologyWeights,
      activeMethodologies,
      undefined, // minConfidence (use default)
      directionStructure.trend
    );

    return {
      symbol,
      marketStructure: directionStructure,
      methodologySignals: { smc: smcSignals, ict: ictSignals, msnr: msnrSignals },
      confluence,
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
      finalLot = volumeMin;
    }
    
    // HARD CAP: Max 1.0 lot per position for all forex & crypto pairs (User Rule)
    const MAX_LOT_CAP = 1.0;
    return Math.min(finalLot, volumeMax, MAX_LOT_CAP);
  }

  /**
   * Calculate trailing stop SL in price units.
   */
  calculateTrailingStopSL(params: {
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
}

export const aiTradingEngine = new AITradingEngine();
