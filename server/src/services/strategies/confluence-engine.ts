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
  checklistItems?: ChecklistItem[];
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
    marketStructure?: { direction: "BULL" | "BEAR" | "SIDEWAYS", strength: number }
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

    const checklistByMethodology: Record<string, ChecklistItem[]> = {};
    for (const sig of allMethodologySignals) {
      if (sig.checklistItems && sig.checklistItems.length > 0) {
        checklistByMethodology[sig.methodology] = sig.checklistItems;
      }
    }

    const mergedChecklist: ChecklistItem[] = [];
    for (const sig of allMethodologySignals) {
      if (sig.checklistItems) {
        mergedChecklist.push(...sig.checklistItems.filter(item => !item.id.endsWith("-rr")));
      }
    }

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
        checklistByMethodology,
        checklistItems: mergedChecklist,
      };
    }

    if (buySignals.length > 0 && sellSignals.length === 0) {
      winningDirection = "BUY";
      winningSignals = buySignals;
    } else if (sellSignals.length > 0 && buySignals.length === 0) {
      winningDirection = "SELL";
      winningSignals = sellSignals;
    } else {
      // Conflict Resolution: Evaluate which direction has higher total weighted confidence
      const buyTotalConf = buySignals.reduce((s, sig) => s + sig.confidence * sig.weight, 0);
      const sellTotalConf = sellSignals.reduce((s, sig) => s + sig.confidence * sig.weight, 0);
      
      const isBuyDominant = buyTotalConf > sellTotalConf;
      winningDirection = isBuyDominant ? "BUY" : "SELL";
      winningSignals = isBuyDominant ? buySignals : sellSignals;
      
      // We don't return immediately. We let the dominant side proceed,
      // but it will be flagged as a conflict and can be penalized.
    }
    // ── 5. Calculate final signal ──────────────────────────────────
    let baseScore = winningSignals.reduce((s, sig) => s + sig.confidence * sig.weight, 0)
      / winningSignals.reduce((s, sig) => s + sig.weight, 0);
      
    if (conflictDetected) {
      baseScore -= 10; // Apply penalty for conflicting signals
    }

    // Boost based on number of agreeing methodologies
    // Disesuaikan: max 4 methodology, threshold ≥6 dihapus
    const confluenceConfig = strategyConfigService.getConfluenceConfig();
    const agreeCount = winningSignals.length;
    let boost = 0;
    if (agreeCount >= 4) boost = confluenceConfig.agree4Boost;       // semua 4 agree → +15
    else if (agreeCount >= 3) boost = confluenceConfig.agree3Boost;  // 3 agree → +10
    else if (agreeCount >= 2) boost = confluenceConfig.agree2Boost;  // 2 agree → +5

    // Daily Direction Context Boost
    if (marketStructure && marketStructure.direction !== "SIDEWAYS") {
      const isAligned = 
        (winningDirection === "BUY" && marketStructure.direction === "BULL") ||
        (winningDirection === "SELL" && marketStructure.direction === "BEAR");
      
      if (isAligned) {
        // Boost +5 for normal alignment, +10 for strong trend (>70%)
        boost += (marketStructure.strength > 70) ? 10 : 5;
      } else {
        // STRICT PENALTY: If signal goes against Daily HTF structure, we must severely penalize it
        // This stops counter-trend setups from being executed unless they are incredibly strong reversals
        baseScore *= 0.5; // Cut score in half!
      }
    }

    const finalConfidence = Math.min(100, baseScore + boost);

    // Primary methodology = highest confidence × weight
    const primary = [...winningSignals].sort(
      (a, b) => (b.confidence * b.weight) - (a.confidence * a.weight),
    )[0];

    // Enforce strict R:R >= 1:2 (2.0)
    const slDist = Math.abs(primary.entry - primary.sl);
    const tpDist = Math.abs(primary.tp - primary.entry);
    const rrRatio = slDist > 0 ? tpDist / slDist : 0;


    const breakdown = this.buildBreakdown(allMethodologySignals, weights);

    // Use ONLY the primary methodology's checklist for the final pipeline execution
    if (primary && primary.checklistItems) {
      mergedChecklist.length = 0; // Clear the array
      mergedChecklist.push(...primary.checklistItems.filter(item => !item.id.endsWith("-rr")));
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
      checklistItems: mergedChecklist,
      conflictDetected,
      reason: `Confluence: ${winningDirection} with ${agreeCount} methodologies agreeing (score: ${Math.round(baseScore)} + ${boost} boost = ${Math.round(finalConfidence)})${conflictDetected ? " [CONFLICT PENALTY APPLIED]" : ""}`,
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
