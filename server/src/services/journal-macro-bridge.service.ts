/**
 * Journal–Macro Bridge Service
 * ────────────────────────────────────────────────────────────────
 * When a trade is opened (manual or MT5 import), this service
 * captures a lightweight snapshot of the current macro regime and
 * attaches it to the Trade document under `macroSnapshot`.
 *
 * This enables cross-dimensional analytics:
 *   "What is my XAUUSD win-rate during Stagflation vs Goldilocks?"
 *   "Does my SMC BUY bias break down when liquidity is STRESSED?"
 *
 * Data captured at the moment of trade entry:
 *  - Macro Regime Quadrant   (Goldilocks / Reflation / Stagflation / Deflation / Transition)
 *  - Liquidity Risk State    (HEALTHY / STRESSED)
 *  - VIX Level               (numeric)
 *  - 10Y–2Y Yield Spread     (bps)
 *  - capturedAt              (timestamp for audit trail)
 */

import axios from "axios";
import { silentLogger } from "../utils/silent-logger";

import { selfApiUrl } from "../config/env";

export interface TradesMacroSnapshot {
  regime?: string;
  liquidityRisk?: string;
  vix?: number;
  yieldCurveSpread?: number;
  capturedAt: Date;
}

class JournalMacroBridgeService {
  /**
   * Call this when creating a new trade.
   * Returns null silently if Macro Terminal is offline — never blocks trade creation.
   */
  async captureSnapshot(): Promise<TradesMacroSnapshot | null> {
    try {
      const res = await axios.get(`${selfApiUrl}/api/v1/macro-regime/snapshot`, {
        timeout: 3000,
      });

      if (!res.data?.success || !res.data?.data) return null;

      const d = res.data.data;

      const snapshot: TradesMacroSnapshot = {
        regime:           d.quadrant        ?? undefined,
        liquidityRisk:    d.liquidity?.riskState ?? undefined,
        vix:              typeof d.vix?.value === "number" ? parseFloat(d.vix.value.toFixed(2)) : undefined,
        yieldCurveSpread: typeof d.yieldCurve?.spread10y2y === "number"
          ? parseFloat(d.yieldCurve.spread10y2y.toFixed(2))
          : undefined,
        capturedAt: new Date(),
      };

      return snapshot;
    } catch (err) {
      silentLogger.warn("[JournalMacroBridge] Macro Terminal offline, skipping snapshot capture:", err);
      return null;
    }
  }
}

export const journalMacroBridgeService = new JournalMacroBridgeService();
