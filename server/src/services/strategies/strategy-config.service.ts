// ─── Strategy Config Service ──────────────────────────────────────────
// Centralized, tunable parameters for all methodologies. Values can be
// loaded from env/DB/user-settings at runtime.

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
    fvgKillzoneBoost: 10,
    oteFibLevels: [0.618, 0.79],
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
    structureBreakMinBodyAtr: 1.5,
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

class StrategyConfigService {
  private config: StrategyConfig = { ...DEFAULT_STRATEGY_CONFIG };

  getConfig(): StrategyConfig {
    return { ...this.config };
  }

  getICTConfig() {
    return { ...this.config.ict };
  }

  getSMCConfig() {
    return { ...this.config.smc };
  }

  getMSNRConfig() {
    return { ...this.config.msnr };
  }



  getConfluenceConfig() {
    return { ...this.config.confluence };
  }

  getRiskConfig() {
    return { ...this.config.risk };
  }

  /**
   * Update config at runtime (e.g., from user settings or optimization)
   */
  updateConfig(partial: Partial<StrategyConfig>): void {
    this.config = this.deepMerge(this.config, partial);
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

    if (Object.keys(updates).length > 0) {
      this.updateConfig(updates);
    }
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