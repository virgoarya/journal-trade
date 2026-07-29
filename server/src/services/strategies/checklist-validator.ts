import type { ChecklistItem } from "./confluence-engine";
import type { FractalContext, Candle } from "./market-structure.service";

export interface WaterfallStepDef {
  id: string;
  label: (status: "PASSED" | "WAITING" | "FAILED", isPassed: boolean) => string;
  timeframe?: string;
  condition: boolean;
  isFailable?: boolean;
  isIndependent?: boolean;
  value?: string | ((status: "PASSED" | "WAITING" | "FAILED") => string | undefined);
  details?: string | ((status: "PASSED" | "WAITING" | "FAILED") => string | undefined);
}

export interface Daily3CandleBias {
  type: "CONTINUATION" | "REVERSAL" | "RANGING";
  direction: "BULL" | "BEAR" | "SIDEWAYS";
  label: string;
  details: string;
  targetLevel: number;
  targetLabel: "PDH" | "PDL" | "EQUILIBRIUM" | "N/A";
  pdh: number;
  pdl: number;
  eq50: number;
}

/**
 * Evaluates a sequence of checklist steps using cascading waterfall logic.
 * A non-independent step only passes if its condition is true AND all prior non-independent steps passed.
 * Zero hardcoded statuses; all items are dynamically evaluated.
 */
export function evaluateWaterfall(
  steps: WaterfallStepDef[]
): { items: ChecklistItem[]; passed: boolean } {
  let priorAllPassed = true;
  let hasFailed = false;

  const items: ChecklistItem[] = steps.map((step) => {
    let status: "PASSED" | "WAITING" | "FAILED";

    if (step.isIndependent) {
      status = step.condition ? "PASSED" : "WAITING";
    } else {
      if (!priorAllPassed) {
        status = "WAITING";
      } else if (step.condition) {
        status = "PASSED";
      } else if (step.isFailable) {
        status = "FAILED";
      } else {
        status = "WAITING";
      }

      if (status !== "PASSED") {
        priorAllPassed = false;
      }
      if (status === "FAILED") {
        hasFailed = true;
      }
    }

    const valueStr = typeof step.value === "function" ? step.value(status) : step.value;
    const detailsStr = typeof step.details === "function" ? step.details(status) : step.details;

    const item: ChecklistItem = {
      id: step.id,
      label: step.label(status, status === "PASSED"),
      status,
      timeframe: step.timeframe,
    };
    if (valueStr !== undefined) item.value = valueStr;
    if (detailsStr !== undefined) item.details = detailsStr;

    return item;
  });

  // Overall checklist is considered passed if no required step FAILED
  const passed = !hasFailed;
  return { items, passed };
}

/**
 * Analyzes 3 consecutive daily candles to determine pattern bias:
 * 1. Continuation: Candle 2 breaks structure of Candle 1, Candle 3 holds above 50% Eq -> Targets PDH/PDL.
 * 2. Reversal: Candle 2/3 sweeps PDL/PDH and closes with rejection -> Targets PDH/PDL.
 * 3. Ranging: Default sideways.
 */
export function analyzeDaily3CandleBias(candles?: Candle[]): Daily3CandleBias {
  if (!candles || candles.length < 3) {
    return {
      type: "RANGING",
      direction: "SIDEWAYS",
      label: "HTF Bias : Sideways (Ranging)",
      details: "Candle data < 3 bars.",
      targetLevel: 0,
      targetLabel: "N/A",
      pdh: 0,
      pdl: 0,
      eq50: 0,
    };
  }

  const c1 = candles[candles.length - 3]; // 2 days ago
  const c2 = candles[candles.length - 2]; // yesterday
  const c3 = candles[candles.length - 1]; // latest closed daily candle

  const pdh = Math.max(c2.high, c3.high);
  const pdl = Math.min(c2.low, c3.low);

  // Equilibrium (50%) of c2 expansion candle
  const c2Eq = c2.low + (c2.high - c2.low) * 0.5;

  const isC2Bullish = c2.close > c2.open;
  const isC2Bearish = c2.close < c2.open;
  const isC3Bullish = c3.close > c3.open;
  const isC3Bearish = c3.close < c3.open;

  // 1. Check Bullish Continuation (Diagram 1):
  // c2 broke c1 high (BOS) AND c3 closed above 50% Eq of c2, targeting PDH
  const isBullBOS = c2.high > c1.high && c2.close > c1.high;
  const isHoldingAbove50EqBull = c3.close >= c2Eq || c3.low >= c2Eq;
  if (isBullBOS && isC2Bullish && isHoldingAbove50EqBull) {
    return {
      type: "CONTINUATION",
      direction: "BULL",
      label: `HTF Continuation Bullish (BOS + 50% Eq) — Target PDH (${pdh.toFixed(5)})`,
      details: `BOS c2 over c1, c3 holding above 50% Eq (${c2Eq.toFixed(5)}). Target PDH: ${pdh.toFixed(5)}`,
      targetLevel: pdh,
      targetLabel: "PDH",
      pdh,
      pdl,
      eq50: c2Eq,
    };
  }

  // 2. Check Bearish Continuation (Inverse Diagram 1):
  // c2 broke c1 low (BOS) AND c3 closed below 50% Eq of c2, targeting PDL
  const isBearBOS = c2.low < c1.low && c2.close < c1.low;
  const isHoldingBelow50EqBear = c3.close <= c2Eq || c3.high <= c2Eq;
  if (isBearBOS && isC2Bearish && isHoldingBelow50EqBear) {
    return {
      type: "CONTINUATION",
      direction: "BEAR",
      label: `HTF Continuation Bearish (BOS + 50% Eq) — Target PDL (${pdl.toFixed(5)})`,
      details: `BOS c2 under c1, c3 holding below 50% Eq (${c2Eq.toFixed(5)}). Target PDL: ${pdl.toFixed(5)}`,
      targetLevel: pdl,
      targetLabel: "PDL",
      pdh,
      pdl,
      eq50: c2Eq,
    };
  }

  // 3. Check Bullish Reversal (Diagram 2):
  // c3 or c2 swept PDL (low below c2/c1 low) AND c3 closed bullish or rejected (closing above c2 low)
  const isPdlSwept = c3.low < c2.low || c2.low < c1.low;
  const isBullishRejection = isC3Bullish || c3.close > c2.low;
  if (isPdlSwept && isBullishRejection) {
    return {
      type: "REVERSAL",
      direction: "BULL",
      label: `HTF Reversal Bullish (PDL Sweep + Close Bullish) — Target PDH (${pdh.toFixed(5)})`,
      details: `Swept PDL (${Math.min(c2.low, c3.low).toFixed(5)}) and closed Bullish. Target PDH: ${pdh.toFixed(5)}`,
      targetLevel: pdh,
      targetLabel: "PDH",
      pdh,
      pdl,
      eq50: c2Eq,
    };
  }

  // 4. Check Bearish Reversal (Inverse Diagram 2):
  // c3 or c2 swept PDH (high above c2/c1 high) AND c3 closed bearish or rejected (closing below c2 high)
  const isPdhSwept = c3.high > c2.high || c2.high > c1.high;
  const isBearishRejection = isC3Bearish || c3.close < c2.high;
  if (isPdhSwept && isBearishRejection) {
    return {
      type: "REVERSAL",
      direction: "BEAR",
      label: `HTF Reversal Bearish (PDH Sweep + Close Bearish) — Target PDL (${pdl.toFixed(5)})`,
      details: `Swept PDH (${Math.max(c2.high, c3.high).toFixed(5)}) and closed Bearish. Target PDL: ${pdl.toFixed(5)}`,
      targetLevel: pdl,
      targetLabel: "PDL",
      pdh,
      pdl,
      eq50: c2Eq,
    };
  }

  // 5. Fallback Ranging / Sideways
  const lastCloseDir = c3.close >= c1.open ? "BULL" : "BEAR";
  return {
    type: "RANGING",
    direction: lastCloseDir,
    label: `HTF Direction : ${lastCloseDir === "BULL" ? "Bullish" : "Bearish"} (Ranging)`,
    details: `Consolidation in 3-candle range [PDL: ${pdl.toFixed(5)}, PDH: ${pdh.toFixed(5)}]`,
    targetLevel: lastCloseDir === "BULL" ? pdh : pdl,
    targetLabel: lastCloseDir === "BULL" ? "PDH" : "PDL",
    pdh,
    pdl,
    eq50: c2Eq,
  };
}

/**
 * Calculates Risk-to-Reward ratio dynamically.
 */
export function calculateRR(entry: number, sl: number, tp: number): { rrRatio: number; isRRValid: boolean } {
  const slDist = Math.abs(entry - sl);
  const tpDist = Math.abs(tp - entry);
  const rrRatio = slDist > 0 ? tpDist / slDist : 0;
  return {
    rrRatio,
    isRRValid: rrRatio >= 2.0,
  };
}

/**
 * Dynamically checks whether market price has retested the entry zone.
 */
export function checkEntryRetest(currentPrice: number, entry: number, isBuy: boolean): boolean {
  return (
    currentPrice > 0 &&
    entry > 0 &&
    (isBuy ? currentPrice <= entry : currentPrice >= entry)
  );
}

/**
 * Safely extracts latest Swing High and Swing Low price strings.
 */
export function getSwingPrices(fractal?: FractalContext): { relHigh: string; relLow: string } {
  if (!fractal || !fractal.directionStr) return { relHigh: "N/A", relLow: "N/A" };
  const highs = fractal.directionStr.swingHighs;
  const lows = fractal.directionStr.swingLows;
  const relHigh = highs && highs.length > 0 ? highs[highs.length - 1].price.toFixed(5) : "N/A";
  const relLow = lows && lows.length > 0 ? lows[lows.length - 1].price.toFixed(5) : "N/A";
  return { relHigh, relLow };
}
