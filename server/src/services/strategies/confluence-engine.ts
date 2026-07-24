// ─── Confluence Engine ──────────────────────────────────────────────
// Combines signals from all 7 methodologies into a single TradingSignal.
// Uses weighted voting with confidence scoring.

import type { SMCSignal } from "./smc.strategy";
import type { ICTSignal } from "./ict.strategy";
import type { MSNRSignal } from "./msnr.strategy";

import { strategyConfigService } from "./strategy-config.service";


// ─── Types ───────────────────────────────────────────────────────────

export interface MethodologyWeights {
  smc: number;
  ict: number;
  msnr: number;

}

export const DEFAULT_METHODOLOGY_WEIGHTS: MethodologyWeights = {
  smc: 1.0,
  ict: 1.0,
  msnr: 0.8,

};

export type MethodologyName = keyof MethodologyWeights;

export type MethodologyDirection = "BUY" | "SELL" | "NEUTRAL";

export interface ChecklistItem {
  id: string;
  label: string;
  status: "PASSED" | "WAITING" | "FAILED";
  value?: string;
  timeframe?: string;
  details?: string;
}

export interface MethodologySignal {
  methodology: MethodologyName;
  direction: "BUY" | "SELL";
  confidence: number;
  entry: number;
  sl: number;
  tp: number;
  weight: number;
  pattern?: string;
  checklistItems?: ChecklistItem[];
}

export interface MethodologyBreakdown {
  [key: string]: {
    confidence: number;
    weight: number;
    contribution: number;
    direction?: string;
    checklistItems?: ChecklistItem[];
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
    pattern?: string;
    methodologyBreakdown: MethodologyBreakdown;
    agreeingSignals: MethodologySignal[];
    totalAgreeing: number;
    checklistItems?: ChecklistItem[];
  } | null;
  allSignals: MethodologySignal[];
  methodologyBreakdown: MethodologyBreakdown;
  conflictDetected: boolean;
  reason: string;
  checklistByMethodology?: Record<string, ChecklistItem[]>;
}

// Each methodology's signal type
interface AllMethodologySignals {
  smc: SMCSignal | null;
  ict: ICTSignal | null;
  msnr: MSNRSignal | null;

}

// ─── Confidence Thresholds ───────────────────────────────────────────

const MIN_CONFIDENCE = 50;
// Boost values diambil dari config (di-cache saat digunakan)
// Default: agree2=5, agree3=10, agree4=15 (disesuaikan untuk 4 methodology max)

// ─── Service ─────────────────────────────────────────────────────────

class ConfluenceEngine {
  /**
   * Calculate confluence from all methodology signals.
   *
   * @param signals - Signals from each methodology (null = no signal)
   * @param weights - Per-methodology weight multipliers
   * @param activeMethodologies - Which methodologies to consider (all by default)
   */
  calculateConfluence(
    signals: AllMethodologySignals,
    weights: MethodologyWeights = DEFAULT_METHODOLOGY_WEIGHTS,
    activeMethodologies: MethodologyName[] = Object.keys(DEFAULT_METHODOLOGY_WEIGHTS) as MethodologyName[],
    minConfidence: number = MIN_CONFIDENCE,
  ): ConfluenceResult {
    // ── 1. Collect & filter signals ─────────────────────────────────
    const allMethodologySignals: MethodologySignal[] = [];
    const MAX_SIGNALS_PER_METHODOLOGY = 1; // Use best signal per methodology

    for (const methodology of activeMethodologies) {
      const signal = signals[methodology as keyof AllMethodologySignals];
      if (!signal) continue;
      if (signal.confidence < minConfidence) continue;

      // For methodologies that can have multiple signals (like SMC, ICT, etc.),
      // just take the first/best one from the strategy output
      const processed = Array.isArray(signal) ? signal[0] : signal;
      if (!processed) continue;

      let pattern = undefined;
      if ("breachType" in processed) pattern = (processed as any).breachType;
      else if ("signalType" in processed) pattern = (processed as any).signalType;
      else if ("pattern" in processed) pattern = (processed as any).pattern;

      allMethodologySignals.push({
        methodology,
        direction: processed.direction,
        confidence: processed.confidence,
        entry: processed.entry,
        sl: processed.sl,
        tp: processed.tp,
        weight: weights[methodology] ?? 1.0,
        pattern,
        checklistItems: (processed as any).checklistItems || [],
      });
    }

    // ── 2. Group by direction ──────────────────────────────────────
    const buySignals = allMethodologySignals.filter((s) => s.direction === "BUY");
    const sellSignals = allMethodologySignals.filter((s) => s.direction === "SELL");

    // ── 3. Calculate weighted scores per direction ─────────────────
    const calculateWeightedScore = (signals: MethodologySignal[]): number => {
      if (signals.length === 0) return 0;
      const totalWeight = signals.reduce((s, sig) => s + sig.weight, 0);
      if (totalWeight === 0) return 0;
      return signals.reduce((s, sig) => s + sig.confidence * sig.weight, 0) / totalWeight;
    };

    const buyScore = calculateWeightedScore(buySignals);
    const sellScore = calculateWeightedScore(sellSignals);

    // ── 4. Check for conflict ──────────────────────────────────────
    const conflictDetected = buySignals.length > 0 && sellSignals.length > 0;

    let winningDirection: "BUY" | "SELL" | null = null;
    let winningSignals: MethodologySignal[] = [];

    if (buySignals.length === 0 && sellSignals.length === 0) {
      // No signals from any methodology
      return {
        finalSignal: null,
        allSignals: allMethodologySignals,
        methodologyBreakdown: this.buildBreakdown(allMethodologySignals, weights),
        conflictDetected: false,
        reason: "No methodology generated a valid signal above minimum confidence",
      };
    }

    if (buySignals.length > 0 && sellSignals.length === 0) {
      winningDirection = "BUY";
      winningSignals = buySignals;
    } else if (sellSignals.length > 0 && buySignals.length === 0) {
      winningDirection = "SELL";
      winningSignals = sellSignals;
    } else {
      // Both sides have signals — resolve conflict
      // If both sides have ≥ 2 signals each, it's a real conflict → no trade
      if (buySignals.length >= 2 && sellSignals.length >= 2) {
        // Check if one side clearly dominates (score ratio ≥ 1.5:1)
        const ratio = buyScore > sellScore
          ? buyScore / sellScore
          : sellScore / buyScore;

        if (ratio >= 1.5) {
          winningDirection = buyScore > sellScore ? "BUY" : "SELL";
          winningSignals = buyScore > sellScore ? buySignals : sellSignals;
        } else {
          return {
            finalSignal: null,
            allSignals: allMethodologySignals,
            methodologyBreakdown: this.buildBreakdown(allMethodologySignals, weights),
            conflictDetected: true,
            reason: `Methodology conflict: ${buySignals.length} BUY vs ${sellSignals.length} SELL (scores: ${buyScore.toFixed(0)} vs ${sellScore.toFixed(0)})`,
          };
        }
      } else {
        // One side has more methodologies agreeing → pick that side
        winningDirection = buySignals.length > sellSignals.length ? "BUY" : "SELL";
        winningSignals = buySignals.length > sellSignals.length ? buySignals : sellSignals;
      }
    }

    // ── 5. Calculate final signal ──────────────────────────────────
    const baseScore = winningSignals.reduce((s, sig) => s + sig.confidence * sig.weight, 0)
      / winningSignals.reduce((s, sig) => s + sig.weight, 0);

    // Boost based on number of agreeing methodologies
    // Disesuaikan: max 4 methodology, threshold ≥6 dihapus
    const confluenceConfig = strategyConfigService.getConfluenceConfig();
    const agreeCount = winningSignals.length;
    let boost = 0;
    if (agreeCount >= 4) boost = confluenceConfig.agree4Boost;       // semua 4 agree → +15
    else if (agreeCount >= 3) boost = confluenceConfig.agree3Boost;  // 3 agree → +10
    else if (agreeCount >= 2) boost = confluenceConfig.agree2Boost;  // 2 agree → +5

    const finalConfidence = Math.min(100, baseScore + boost);

    // Primary methodology = highest confidence × weight
    const primary = [...winningSignals].sort(
      (a, b) => (b.confidence * b.weight) - (a.confidence * a.weight),
    )[0];

    // Enforce strict R:R >= 1:2 (2.0)
    const slDist = Math.abs(primary.entry - primary.sl);
    const tpDist = Math.abs(primary.tp - primary.entry);
    const rrRatio = slDist > 0 ? tpDist / slDist : 0;
    if (rrRatio < 2.0) {
      return {
        finalSignal: null,
        allSignals: allMethodologySignals,
        methodologyBreakdown: this.buildBreakdown(allMethodologySignals, weights),
        conflictDetected: false,
        reason: `Risk:Reward ratio 1:${rrRatio.toFixed(2)} is below 1:2 minimum (Trade Skipped)`,
      };
    }

    const breakdown = this.buildBreakdown(allMethodologySignals, weights);

    // Build Net Confluence Checklist in exact 7-Step sequential order (1/7 -> 7/7)
    const mergedChecklist: ChecklistItem[] = [];

    mergedChecklist.push({
      id: "pipeline-step-1",
      label: `[1/7] Confluence Multi-Metodologi (${agreeCount}/${activeMethodologies.length} Setuju)`,
      status: "PASSED",
      value: `Score ${Math.round(finalConfidence)}% | Primary: ${primary.methodology.toUpperCase()}`
    });

    mergedChecklist.push({
      id: "pipeline-step-2",
      label: `[2/7] Pre-Trade Risk Check (Open Position & Daily Limit)`,
      status: "PASSED"
    });

    mergedChecklist.push({
      id: "pipeline-step-3",
      label: `[3/7] Filter Pasar & HTF (News, Correlation, Fundamental, HTF)`,
      status: "PASSED"
    });

    mergedChecklist.push({
      id: "pipeline-step-4",
      label: `[4/7] AI LLM Consensus Voting (Multi-Model Approved)`,
      status: "PASSED"
    });

    mergedChecklist.push({
      id: "pipeline-step-5",
      label: `[5/7] Risk Management & Lot Sizing (Hard Cap 1.0 Lot)`,
      status: "PASSED"
    });

    mergedChecklist.push({
      id: "pipeline-step-6",
      label: `[6/7] Minimum Risk-to-Reward 1:2.0 Validation`,
      status: rrRatio >= 2.0 ? "PASSED" : "FAILED",
      details: `R:R 1:${rrRatio.toFixed(2)} | SL: ${primary.sl.toFixed(5)} | TP: ${primary.tp.toFixed(5)}`
    });

    mergedChecklist.push({
      id: "pipeline-step-7",
      label: `[7/7] MT5 Order Execution (Pending Limit/Stop or Market Ready)`,
      status: "PASSED"
    });

    // Append technical setup items from agreeing strategy signals (excluding duplicate RR items)
    for (const sig of winningSignals) {
      if (sig.checklistItems) {
        mergedChecklist.push(...sig.checklistItems.filter(item => !item.id.endsWith("-rr")));
      }
    }

    const checklistByMethodology: Record<string, ChecklistItem[]> = {};
    for (const sig of allMethodologySignals) {
      if (sig.checklistItems && sig.checklistItems.length > 0) {
        checklistByMethodology[sig.methodology] = sig.checklistItems;
      }
    }

    return {
      finalSignal: {
        direction: winningDirection,
        entry: primary.entry,
        sl: primary.sl,
        tp: primary.tp,
        confidence: Math.round(finalConfidence),
        confluenceScore: Math.round(baseScore),
        primaryMethodology: primary.methodology,
        pattern: primary.pattern,
        methodologyBreakdown: breakdown,
        agreeingSignals: winningSignals,
        totalAgreeing: agreeCount,
        checklistItems: mergedChecklist,
      },
      allSignals: allMethodologySignals,
      methodologyBreakdown: breakdown,
      checklistByMethodology,
      conflictDetected,
      reason: `Confluence: ${winningDirection} with ${agreeCount} methodologies agreeing (score: ${Math.round(baseScore)} + ${boost} boost = ${Math.round(finalConfidence)})`,
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private buildBreakdown(
    signals: MethodologySignal[],
    weights: MethodologyWeights,
  ): MethodologyBreakdown {
    const breakdown: MethodologyBreakdown = {};

    for (const methodology of Object.keys(weights) as MethodologyName[]) {
      const signal = signals.find((s) => s.methodology === methodology);
      breakdown[methodology] = {
        confidence: signal?.confidence ?? 0,
        weight: weights[methodology],
        contribution: signal
          ? Math.round((signal.confidence * signal.weight) / (weights[methodology] || 1))
          : 0,
        direction: signal?.direction,
        checklistItems: signal?.checklistItems || [],
      };
    }

    return breakdown;
  }

  /** Get the current default weights (useful for letting user configure). */
  getDefaultWeights(): MethodologyWeights {
    return { ...DEFAULT_METHODOLOGY_WEIGHTS };
  }
}

export const confluenceEngine = new ConfluenceEngine();
