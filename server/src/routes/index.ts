import { Router } from "express";
import tradingAccountRoutes from "./trading-account.routes";
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
router.use("/v1/mt5", mt5Routes);
router.use("/v1/macro-ai", aiLimiter, macroAiRoutes);
router.use("/v1/macro-ai-observer", aiLimiter, macroAiObserverRoutes);
router.use("/v1/market-data", marketDataRoutes);
router.use("/v1/geo-risk", geoRiskRoutes);
router.use("/v1/quant", quantRoutes);
router.use("/v1/macro-regime", macroRegimeRoutes);
router.use("/v1/nexus", nexusRoutes);
router.use("/v1/ai-coach", aiLimiter, aiCoachRoutes);
router.use("/v1/ai-trading", aiLimiter, aiTradingRoutes);
router.use("/v1/backtest", backtestRoutes);

export default router;
