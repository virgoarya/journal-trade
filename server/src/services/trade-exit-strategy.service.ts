import { mt5McpService } from "./mt5-mcp.service";
import { silentLogger } from "../utils/silent-logger";

export interface PartialTPConfig {
  tp1Ratio: number;      // R:R ratio for first partial (default 1.0)
  tp1Size: number;       // % of position to close (default 0.3 = 30%)
  tp2Ratio: number;      // R:R ratio for second partial (default 2.0)
  tp2Size: number;       // % to close (default 0.4 = 40%)
  trailActivation: number; // ATR multiplier for trailing activation on remainder
}

export interface PartialTPAction {
  action: "CLOSE_PARTIAL" | "CLOSE_ALL" | "MODIFY_SL" | "NONE";
  closePercent?: number;
  newSL?: number;
  reason: string;
}

const DEFAULT_CONFIG: PartialTPConfig = {
  tp1Ratio: 1.0,
  tp1Size: 0.3,
  tp2Ratio: 2.0,
  tp2Size: 0.4,
  trailActivation: 1.0,
};

class TradeExitStrategyService {
  /**
   * Evaluate a position and determine if any partial TP action should be taken.
   * Called each cycle from managePositions().
   */
  evaluate(
    position: {
      symbol: string;
      type: "BUY" | "SELL";
      priceOpen: number;
      priceCurrent: number;
      sl: number;
      tp: number;
      volume: number;
      ticket: number;
    },
    atrValue: number,
    config: PartialTPConfig = DEFAULT_CONFIG,
  ): PartialTPAction {
    const entry = position.priceOpen;
    const current = position.priceCurrent;
    const direction = position.type;
    const slDistance = Math.abs(entry - position.sl);

    if (slDistance <= 0) return { action: "NONE", reason: "No SL distance" };

    const currentRR = Math.abs(current - entry) / slDistance;

    // TP1: Take first partial profit
    if (currentRR >= config.tp1Ratio && config.tp1Size > 0) {
      // Set breakeven SL on remaining position
      const slBreakeven = direction === "BUY" ? entry : entry;
      return {
        action: "CLOSE_PARTIAL",
        closePercent: config.tp1Size,
        newSL: slBreakeven,
        reason: `TP1 triggered at ${currentRR.toFixed(1)}R: closing ${(config.tp1Size * 100).toFixed(0)}%, SL→breakeven`,
      };
    }

    // Trailing: if price moved beyond activation distance, trail SL
    const activationDistance = config.trailActivation * atrValue;
    const priceMoved = Math.abs(current - entry);

    if (priceMoved >= activationDistance && position.sl < current) {
      const trailDistance = atrValue * 0.5;
      if (direction === "BUY") {
        const newSL = Math.max(position.sl, current - trailDistance);
        if (newSL > position.sl + atrValue * 0.1) {
          return { action: "MODIFY_SL", newSL, reason: `Trailing SL up by ${(newSL - position.sl).toFixed(5)}` };
        }
      } else {
        const newSL = Math.min(position.sl, current + trailDistance);
        if (newSL < position.sl - atrValue * 0.1) {
          return { action: "MODIFY_SL", newSL, reason: `Trailing SL down by ${(position.sl - newSL).toFixed(5)}` };
        }
      }
    }

    return { action: "NONE", reason: "No exit signal" };
  }
}

export const tradeExitStrategyService = new TradeExitStrategyService();
