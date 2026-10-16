import { silentLogger } from "../utils/silent-logger";
import { geoRiskService } from "./geo-risk.service";
import { agentConsensusService } from "./agent-consensus.service";
import mongoose from "mongoose";

// ── Alert Schema ─────────────────────────────────────────────────────────────
const MacroAlertSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    message: { type: String, required: true },
    severity: { type: String, enum: ["INFO", "WARNING", "CRITICAL"], default: "INFO" },
    sourceAgent: { type: String, default: "hawk" },
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "macro_alerts" }
);

export const MacroAlert =
  mongoose.models.MacroAlert || mongoose.model("MacroAlert", MacroAlertSchema);

class ProactiveWatcherService {
  private timer: NodeJS.Timeout | null = null;
  private readonly INTERVAL_MS = 60 * 60 * 1000; // Check every 1 hour

  start(): void {
    if (this.timer) return;
    silentLogger.info("[ProactiveWatcher] Background market & liquidity watcher started (interval: 1 hour).");

    // Run once after startup (delayed by 10 seconds)
    setTimeout(() => {
      this.checkMarketAnomaly().catch((err) =>
        silentLogger.error("[ProactiveWatcher] Initial check failed:", err)
      );
    }, 10000);

    // Schedule periodic check
    this.timer = setInterval(() => {
      this.checkMarketAnomaly().catch((err) =>
        silentLogger.error("[ProactiveWatcher] Periodic check failed:", err)
      );
    }, this.INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      silentLogger.info("[ProactiveWatcher] Background watcher stopped.");
    }
  }

  private async checkMarketAnomaly(): Promise<void> {
    silentLogger.info("[ProactiveWatcher] Running market & liquidity anomaly scan...");
    try {
      const scoresData = await geoRiskService.getScores();
      const raw = scoresData.raw;
      const scores = scoresData.scores;

      // Rule 1: High Liquidity Drain (> 85)
      if (scores.liquidityDrain >= 85) {
        await this.createAlert(
          "🚨 CRITICAL LIQUIDITY DRAIN",
          `Skor Liquidity Drain mencapai ${scores.liquidityDrain}. ON RRP balance menyusut ke $${raw.onRrpBalance}B. Risiko margin call dan likuiditas ketat meningkat signifikan di pasar.`,
          "CRITICAL",
          "hawk"
        );
      }

      // Rule 2: High VIX (> 20)
      if (raw.vix && raw.vix > 20) {
        await this.createAlert(
          "⚠️ ELEVATED GEOPOLITICAL / VIX RISK",
          `VIX melonjak ke level ${raw.vix}. Volatilitas pasar saham dan komoditas (termasuk XAUUSD) berpotensi mengalami spike mendadak.`,
          "WARNING",
          "contrarian"
        );
      }

      // Rule 3: High Inflation / Hot CPI (> 3.5%)
      if (raw.cpi_yoy && raw.cpi_yoy > 3.5) {
        await this.createAlert(
          "🔥 STICKY INFLATION WARNING",
          `Inflasi CPI YoY bertahan di angka ${raw.cpi_yoy}%. Ekspektasi suku bunga higher-for-longer menekan aset non-yield.`,
          "WARNING",
          "hawk"
        );
      }

      silentLogger.info("[ProactiveWatcher] Market anomaly scan completed successfully.");
    } catch (err: any) {
      silentLogger.error("[ProactiveWatcher] Error during anomaly check:", err.message);
    }
  }

  private async createAlert(title: string, message: string, severity: "INFO" | "WARNING" | "CRITICAL", sourceAgent: string): Promise<void> {
    try {
      // Avoid duplicate alert within last 4 hours
      const recent = await MacroAlert.findOne({
        title,
        createdAt: { $gte: new Date(Date.now() - 4 * 60 * 60 * 1000) },
      }).lean();

      if (!recent) {
        await MacroAlert.create({ title, message, severity, sourceAgent });
        silentLogger.info(`[ProactiveWatcher] Alert created: ${title} (${severity})`);
      }
    } catch (err: any) {
      silentLogger.warn(`[ProactiveWatcher] Failed to save alert: ${err.message}`);
    }
  }
}

export const proactiveWatcherService = new ProactiveWatcherService();
