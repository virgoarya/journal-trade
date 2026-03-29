import { Router } from "express";
import tradingAccountRoutes from "./trading-account.routes";
import tradeRoutes from "./trade.routes";
import playbookRoutes from "./playbook.routes";
import analyticsRoutes from "./analytics.routes";
import aiReviewRoutes from "./ai-review.routes";
import settingsRoutes from "./settings.routes";

const router = Router();

// Auth routes are mounted directly in index.ts after DB connection
// router.use("/auth", authRoutes);

router.use("/v1/trading-accounts", tradingAccountRoutes);
router.use("/v1/trades", tradeRoutes);
router.use("/v1/playbooks", playbookRoutes);
router.use("/v1/analytics", analyticsRoutes);
router.use("/v1/ai-reviews", aiReviewRoutes);
router.use("/v1/settings", settingsRoutes);

export default router;
