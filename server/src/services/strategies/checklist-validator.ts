import type { ChecklistItem } from "./confluence-engine";
import type { FractalContext } from "./market-structure.service";

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
