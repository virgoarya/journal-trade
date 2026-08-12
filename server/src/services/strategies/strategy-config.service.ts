// ─── Strategy Config Service ──────────────────────────────────────────
// Centralized, tunable parameters for all methodologies. Values can be
// loaded from env/DB/user-settings at runtime.

import { AsyncLocalStorage } from "async_hooks";

export interface StrategyConfig {
  ict: {
    fvgProximityAtrMult: number;
    fvgKillzoneBoost: number;
    oteFibLevels: number[];
    judasSwingLookback: number;
    minConfidence: number;
  };
  smc: {
    impulseThreshold: number;
    obMitigationBufferAtr: number;
    breakerProximityAtr: number;   // ATR multiplier for breaker block proximity
    liquidityGrabLookback: number;
    minConfidence: number;
  };
  msnr: {
    keyLevelMinStrength: number;
    levelProximityAtrMult: number;
    sbrRbsProximityPct: number;
    qmlLookback: number;
    structureBreakMinBodyAtr: number;
    minConfidence: number;
  };

  confluence: {
    minSignalConfidence: number;
    agree2Boost: number;  // ≥2 methodology agree
    agree3Boost: number;  // ≥3 methodology agree
    agree4Boost: number;  // all 4 methodology agree
    macroTimeBoost: number;
    conflictThreshold: number; // ratio of scores for conflict resolution
  };
  risk: {
    maxRiskPerTrade: number;
    maxDailyRisk: number;
    atrMultiplier: number;
    confidenceScaleLow: number;
    confidenceScaleHigh: number;
  };
}

export const DEFAULT_STRATEGY_CONFIG: StrategyConfig = {
  ict: {
    fvgProximityAtrMult: 1.5,
    fvgKillzoneBoost: 15,   // was 10 — kill zone is core ICT edge (time of day)
    oteFibLevels: [0.618, 0.705, 0.79],
    judasSwingLookback: 6,
    minConfidence: 50,
  },
  smc: {
    impulseThreshold: 1.8,
    obMitigationBufferAtr: 0.5,    // was 0.2 – terlalu tipis, dinaikkan
    breakerProximityAtr: 1.0,      // was hardcoded 0.003% – sekarang berbasis ATR
    liquidityGrabLookback: 8,
    minConfidence: 50,
  },
  msnr: {
    keyLevelMinStrength: 2,
    levelProximityAtrMult: 1.2,
    sbrRbsProximityPct: 0.002,
    qmlLookback: 4,
    structureBreakMinBodyAtr: 0.5,  // was 1.5 — terlalu ketat utk MSS M15
    minConfidence: 55,   // was 50 — naik agar hanya level kuat yang diambil
  },

  confluence: {
    minSignalConfidence: 55,  // was 50 — filter out weak signals sebelum voting
    agree2Boost: 5,
    agree3Boost: 10,
    agree4Boost: 15,
    macroTimeBoost: 10,
    conflictThreshold: 1.5,
  },
  risk: {
    maxRiskPerTrade: 0.01,
    maxDailyRisk: 0.03,
    atrMultiplier: 1.5,
    confidenceScaleLow: 40,
    confidenceScaleHigh: 90,
  },
};

// Backtest-local config snapshot. While a simulation runs inside
// runWithScopedConfig, every getter returns the scoped copy, so the strategy
// modules read per-backtest thresholds WITHOUT mutating the shared config
// consumed by the live engine. AsyncLocalStorage isolates concurrent
// backtests from each other.
const strategyConfigScope = new AsyncLocalStorage<StrategyConfig>();

class StrategyConfigService {
  private config: StrategyConfig = { ...DEFAULT_STRATEGY_CONFIG };

  getConfig(): StrategyConfig {
    const scoped = strategyConfigScope.getStore();
    return scoped ? { ...scoped } : { ...this.config };
  }

  getICTConfig() {
    const scoped = strategyConfigScope.getStore();
    return { ...(scoped ? scoped.ict : this.config.ict) };
  }

  getSMCConfig() {
    const scoped = strategyConfigScope.getStore();
    return { ...(scoped ? scoped.smc : this.config.smc) };
  }

  getMSNRConfig() {
    const scoped = strategyConfigScope.getStore();
    return { ...(scoped ? scoped.msnr : this.config.msnr) };
  }



  getConfluenceConfig() {
    const scoped = strategyConfigScope.getStore();
    return { ...(scoped ? scoped.confluence : this.config.confluence) };
  }

  getRiskConfig() {
    const scoped = strategyConfigScope.getStore();
    return { ...(scoped ? scoped.risk : this.config.risk) };
  }

  /**
   * Update config at runtime (e.g., from user settings or optimization)
   */
  updateConfig(partial: Partial<StrategyConfig>): void {
    this.config = this.deepMerge(this.config, partial);
  }

  /**
   * Compute the config deltas derived from backtest entrySettings. Shared by
   * the live mutation path (updateFromBacktestConfig) and the backtest-local
   * snapshot builder (buildScopedConfig) so both stay in sync.
   */
  private computeBacktestUpdates(entrySettings: {
    rsiOversold?: number;
    rsiOverbought?: number;
    atrMultiplierSL?: number;
    atrMultiplierTP?: number;
  }): Partial<StrategyConfig> {
    // Map backtest entrySettings to strategy configs where applicable
    const updates: Partial<StrategyConfig> = {};

    if (entrySettings.atrMultiplierSL !== undefined || entrySettings.atrMultiplierTP !== undefined) {
      const atrMultSL = entrySettings.atrMultiplierSL ?? this.config.risk.atrMultiplier;
      const atrMultTP = entrySettings.atrMultiplierTP ?? this.config.risk.atrMultiplier;

      // Update risk config
      updates.risk = {
        ...this.config.risk,
        atrMultiplier: atrMultSL, // use SL multiplier as base
        // could add atrMultiplierTP if needed
      };

      // Update strategy-specific ATR multipliers
      updates.ict = { ...this.config.ict, fvgProximityAtrMult: atrMultSL };
      updates.msnr = { ...this.config.msnr, levelProximityAtrMult: atrMultSL };
    }

    if (entrySettings.rsiOversold !== undefined || entrySettings.rsiOverbought !== undefined) {
      // RSI thresholds don't directly map to strategies, but could adjust minConfidence
      const oversold = entrySettings.rsiOversold ?? 30;
      const overbought = entrySettings.rsiOverbought ?? 70;
      const rsiRange = overbought - oversold;

      // Tighter RSI range = more selective = higher min confidence
      const confidenceBoost = rsiRange < 30 ? 5 : 0;

      updates.ict = { ...updates.ict, ...this.config.ict, minConfidence: (this.config.ict?.minConfidence ?? 50) + confidenceBoost };
      updates.msnr = { ...updates.msnr, ...this.config.msnr, minConfidence: (this.config.msnr?.minConfidence ?? 50) + confidenceBoost };
      updates.smc = { ...updates.smc, ...this.config.smc, minConfidence: (this.config.smc?.minConfidence ?? 50) + confidenceBoost };
    }

    return updates;
  }

  /**
   * Update config from backtest config entrySettings
   */
  updateFromBacktestConfig(entrySettings: {
    rsiOversold?: number;
    rsiOverbought?: number;
    atrMultiplierSL?: number;
    atrMultiplierTP?: number;
  }): void {
    // Map backtest entrySettings to strategy configs where applicable
    const updates = this.computeBacktestUpdates(entrySettings);

    if (Object.keys(updates).length > 0) {
      this.updateConfig(updates);
    }
  }

  /**
   * Build a full StrategyConfig snapshot for ONE backtest run without
   * touching the shared config. Base = current live config (keeps user-tuned
   * values); the same deltas as updateFromBacktestConfig are layered on top,
   * so backtest thresholds stay identical to before — deterministically, no
   * matter what other backtests are doing.
   */
  buildScopedConfig(entrySettings: {
    rsiOversold?: number;
    rsiOverbought?: number;
    atrMultiplierSL?: number;
    atrMultiplierTP?: number;
  }): StrategyConfig {
    const scoped = JSON.parse(JSON.stringify(this.config)) as StrategyConfig;
    const updates = this.computeBacktestUpdates(entrySettings);

    if (Object.keys(updates).length > 0) {
      scoped.ict = { ...scoped.ict, ...updates.ict };
      scoped.smc = { ...scoped.smc, ...updates.smc };
      scoped.msnr = { ...scoped.msnr, ...updates.msnr };
      scoped.risk = { ...scoped.risk, ...updates.risk };
      scoped.confluence = { ...scoped.confluence, ...updates.confluence };
    }

    return scoped;
  }

  /**
   * Run fn with a backtest-local strategy config visible only to this async
   * context. The shared config is never modified, and concurrent backtests
   * each see their own snapshot (AsyncLocalStorage).
   */
  runWithScopedConfig<T>(config: StrategyConfig, fn: () => T): T {
    return strategyConfigScope.run(config, fn);
  }

  /**
   * Reset to defaults
   */
  reset(): void {
    this.config = { ...DEFAULT_STRATEGY_CONFIG };
  }

  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }
}

export const strategyConfigService = new StrategyConfigService();