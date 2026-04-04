import { Router } from "express";
import { analyticsService } from "../services/analytics.service";
import { apiResponse } from "../utils/api-response";
import { requireAuth } from "../middleware/auth";
import { tradingAccountService } from "../services/trading-account.service";
import { riskService } from "../services/risk.service";

const router = Router();

// Secure all analytics routes
router.use(requireAuth);

/**
 * GET /api/v1/analytics/overview
 * Returns a comprehensive dashboard overview
 */
router.get("/overview", async (req: any, res, next) => {
  try {
    const account = await tradingAccountService.getActiveAccount(req.user.id);
    if (!account) {
      return apiResponse.success(res, {
        monthlyPnL: [],
        weeklyStats: [],
        sessionPerformance: [],
        streakStats: { longestWin: 0, longestLoss: 0, currentStreak: { type: "win" as const, count: 0 }, avgConsecutiveWins: 0, avgConsecutiveLosses: 0 },
        totalPnL: 0,
        totalTrades: 0,
        winRate: 0,
        profitFactor: 0,
        bestPerformingPairs: [],
        riskMetrics: { sharpeRatio: 0, maxDrawdown: 0, avgRR: 0, expectancy: 0, avgWin: 0, avgLoss: 0 },
        tradingBehaviour: { avgTradeDuration: "0h 0m", avgPnlPerTrade: 0, tradesPerDay: 0, planAdherence: 0 }
      });
    }
    const data = await analyticsService.getOverview(req.user.id, account.id);
    return apiResponse.success(res, data);
  } catch (error) { next(error); }
});

// Monthly P&L for charting
router.get("/monthly-pnl", async (req: any, res, next) => {
  try {
    const account = await tradingAccountService.getActiveAccount(req.user.id);
    if (!account) return apiResponse.success(res, []);
    const overview = await analyticsService.getOverview(req.user.id, account.id);
    return apiResponse.success(res, overview.monthlyPnL || []);
  } catch (error) { next(error); }
});

// Weekly stats
router.get("/weekly", async (req: any, res, next) => {
  try {
    const account = await tradingAccountService.getActiveAccount(req.user.id);
    if (!account) return apiResponse.success(res, []);
    const overview = await analyticsService.getOverview(req.user.id, account.id);
    return apiResponse.success(res, overview.weeklyStats || []);
  } catch (error) { next(error); }
});

// Session performance
router.get("/sessions", async (req: any, res, next) => {
  try {
    const account = await tradingAccountService.getActiveAccount(req.user.id);
    if (!account) return apiResponse.success(res, []);
    const overview = await analyticsService.getOverview(req.user.id, account.id);
    return apiResponse.success(res, overview.sessionPerformance || []);
  } catch (error) { next(error); }
});

// Heatmap data
router.get("/heatmap", async (req: any, res, next) => {
  try {
    const account = await tradingAccountService.getActiveAccount(req.user.id);
    if (!account) return apiResponse.success(res, []);
    const overview = await analyticsService.getOverview(req.user.id, account.id);
    return apiResponse.success(res, overview.heatmap || []);
  } catch (error) { next(error); }
});

// Equity curve
router.get("/equity-curve", async (req: any, res, next) => {
  try {
    const account = await tradingAccountService.getActiveAccount(req.user.id);
    if (!account) return apiResponse.success(res, { points: [], highWaterMark: 0, maxDrawdown: { value: 0, date: "" } });
    const data = await analyticsService.getEquityCurve(req.user.id, account.id);
    return apiResponse.success(res, data);
  } catch (error) { next(error); }
});

// Risk status
router.get("/risk-status", async (req: any, res, next) => {
  try {
    const account = await tradingAccountService.getActiveAccount(req.user.id);
    if (!account) return apiResponse.success(res, { level: "safe", drawdown: 0, limit: 5, marginUsed: 0, marginAvailable: 0 });
    const data = await riskService.getRiskStatus(account.id, req.user.id);
    return apiResponse.success(res, data);
  } catch (error) { next(error); }
});

export default router;
