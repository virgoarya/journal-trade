import { Router } from "express";
import { execFile } from "child_process";
import tradingAccountRoutes from "./trading-account.routes";
import brokerRegistrationRoutes from "./broker-registration-v1.routes";
import tradeRoutes from "./trade.routes";
import playbookRoutes from "./playbook.routes";
import analyticsRoutes from "./analytics.routes";
import aiReviewRoutes from "./ai-review.routes";
import notificationRoutes from "./notification.routes";
import settingsRoutes from "./settings.routes";
import authV1Routes from "./auth-v1.routes";
import mt5Routes from "./mt5.routes";
import macroAiRoutes from "./macro-ai.routes";
import macroAiObserverRoutes from "./macro-ai-observer.routes";
import marketDataRoutes from "./market-data.routes";
import geoRiskRoutes from "./geo-risk.routes";
import quantRoutes from "./quant.routes";
import macroRegimeRoutes from "./macro-regime.routes";
import nexusRoutes from "./nexus.routes";
import aiCoachRoutes from "./ai-coach.routes";
import aiTradingRoutes from "./ai-trading.routes";
import backtestRoutes from "./backtest.routes";
import devTestRoutes from "./dev-test.routes";
import paymentRoutes from "./payment.routes";
import { aiLimiter } from "../middleware/rate-limit";

const router = Router();

// Auth routes are mounted directly in index.ts after DB connection
// router.use("/auth", authRoutes);

// Auth V1 API routes
router.use("/v1/auth", authV1Routes);

router.use("/v1/trading-accounts", tradingAccountRoutes);
router.use("/v1/trades", tradeRoutes);
router.use("/v1/playbooks", playbookRoutes);
router.use("/v1/analytics", analyticsRoutes);
router.use("/v1/ai-reviews", aiLimiter, aiReviewRoutes);
router.use("/v1/notifications", notificationRoutes);
router.use("/v1/settings", settingsRoutes);

// Development-only helper: launch a locally installed MetaTrader 5 terminal.
router.get("/v1/mt5/open-desktop", (_req, res) => {
  if (process.env.NODE_ENV !== "development") {
    return res.status(404).json({ success: false, message: "Not found" });
  }

  const candidates = [
    "C:\\Program Files\\MetaTrader 5\\terminal64.exe",
    "C:\\Program Files (x86)\\MetaTrader 5\\terminal.exe",
  ];
  const executable = candidates.find((candidate) => require("fs").existsSync(candidate));

  if (!executable) {
    return res.status(404).json({ success: false, message: "MT5 Desktop tidak ditemukan" });
  }

  // Fire-and-forget launch so proxy never waits on MT5 startup.
  execFile(executable, (error) => {
    if (error) {
      console.error("MT5 Desktop launch error:", error.message);
    }
  });

  return res.json({ success: true, message: "MT5 Desktop sedang dibuka" });
});

router.use("/v1/mt5", mt5Routes);
router.use("/v1/macro-ai", aiLimiter, macroAiRoutes);
router.use("/v1/macro-ai-observer", aiLimiter, macroAiObserverRoutes);
router.use("/v1/market-data", marketDataRoutes);
router.use("/v1/geo-risk", geoRiskRoutes);
router.use("/v1/quant", quantRoutes);
router.use("/v1/macro-regime", macroRegimeRoutes);
router.use("/v1/nexus", nexusRoutes);
router.use("/v1/ai-coach", aiLimiter, aiCoachRoutes);
router.use("/v1/ai-trading", aiTradingRoutes);
router.use("/v1/backtest", backtestRoutes);
router.use("/v1/dev", devTestRoutes);
router.use("/v1/broker-registration", brokerRegistrationRoutes);
router.use("/v1/payment", paymentRoutes);

export default router;
