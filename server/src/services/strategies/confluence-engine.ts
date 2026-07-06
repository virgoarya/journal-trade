// ─── Confluence Engine ──────────────────────────────────────────────
// Combines signals from all 7 methodologies into a single TradingSignal.
// Uses weighted voting with confidence scoring.

import type { SMCSignal } from "./smc.strategy";
import type { ICTSignal } from "./ict.strategy";
import type { MSNRSignal } from "./msnr.strategy";
import type { CRTSignal } from "./crt.strategy";
import type { QuarterlySignal } from "./quarterly.strategy";
import type { LITSignal } from "./lit.strategy";

// ─── Types ───────────────────────────────────────────────────────────

export interface MethodologyWeights {
  smc: number;
  ict: number;
  msnr: number;
  crt: number;
  quarterly: number;
  lit: number;
  rsiEngulf: number;
}

export const DEFAULT_METHODOLOGY_WEIGHTS: MethodologyWeights = {
  smc: 1.0,
  ict: 1.0,
  msnr: 0.8,
  crt: 0.8,
  quarterly: 0.6,
  lit: 1.0,
  rsiEngulf: 0.5,
};

export type MethodologyName = keyof MethodologyWeights;

export type MethodologyDirection = "BUY" | "SELL" | "NEUTRAL";

export interface MethodologySignal {
  methodology: MethodologyName;
  direction: "BUY" | "SELL";
  confidence: number;
  entry: number;
  sl: number;
  tp: number;
  weight: number;
}

export interface MethodologyBreakdown {
  [key: string]: {
    confidence: number;
    weight: number;
    contribution: number; // weighted contribution to final score
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
    methodologyBreakdown: MethodologyBreakdown;
    agreeingSignals: MethodologySignal[];
    totalAgreeing: number;
  } | null;
  allSignals: MethodologySignal[];
  methodologyBreakdown: MethodologyBreakdown;
  conflictDetected: boolean;
  reason: string;
}

// Each methodology's signal type
interface AllMethodologySignals {
  smc: SMCSignal | null;
  ict: ICTSignal | null;
  msnr: MSNRSignal | null;
  crt: CRTSignal | null;
  quarterly: QuarterlySignal | null;
  lit: LITSignal | null;
  rsiEngulf: { direction: "BUY" | "SELL"; confidence: number; entry: number; sl: number; tp: number } | null;
}

// ─── Confidence Thresholds ───────────────────────────────────────────

const MIN_CONFIDENCE = 50;
const AGREE_2_BOOST = 5;
const AGREE_4_BOOST = 10;
const AGREE_6_BOOST = 15;

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
  ): ConfluenceResult {
    // ── 1. Collect & filter signals ─────────────────────────────────
    const allMethodologySignals: MethodologySignal[] = [];
    const MAX_SIGNALS_PER_METHODOLOGY = 1; // Use best signal per methodology

    for (const methodology of activeMethodologies) {
      const signal = signals[methodology as keyof AllMethodologySignals];
      if (!signal) continue;
      if (signal.confidence < MIN_CONFIDENCE) continue;

      // For methodologies that can have multiple signals (like SMC, ICT, etc.),
      // just take the first/best one from the strategy output
      const processed = Array.isArray(signal) ? signal[0] : signal;
      if (!processed) continue;

      allMethodologySignals.push({
        methodology,
        direction: processed.direction,
        confidence: processed.confidence,
        entry: processed.entry,
        sl: processed.sl,
        tp: processed.tp,
        weight: weights[methodology] ?? 1.0,
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
    const agreeCount = winningSignals.length;
    let boost = 0;
    if (agreeCount >= 6) boost = AGREE_6_BOOST;
    else if (agreeCount >= 4) boost = AGREE_4_BOOST;
    else if (agreeCount >= 2) boost = AGREE_2_BOOST;

    const finalConfidence = Math.min(100, baseScore + boost);

    // Primary methodology = highest confidence × weight
    const primary = [...winningSignals].sort(
      (a, b) => (b.confidence * b.weight) - (a.confidence * a.weight),
    )[0];

    const breakdown = this.buildBreakdown(allMethodologySignals, weights);

    return {
      finalSignal: {
        direction: winningDirection,
        entry: primary.entry,
        sl: primary.sl,
        tp: primary.tp,
        confidence: Math.round(finalConfidence),
        confluenceScore: Math.round(baseScore),
        primaryMethodology: primary.methodology,
        methodologyBreakdown: breakdown,
        agreeingSignals: winningSignals,
        totalAgreeing: agreeCount,
      },
      allSignals: allMethodologySignals,
      methodologyBreakdown: breakdown,
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
