import { Router } from "express";
import { analyticsService } from "../services/analytics.service";
import { apiResponse } from "../utils/api-response";
import { requireAuth } from "../middleware/auth";
import { z } from "zod";
import { validate } from "../middleware/validate";
import { riskService } from "../services/risk.service";
import { tradingAccountService } from "../services/trading-account.service";

const router = Router();
router.use(requireAuth);

const activeAccountCheck = async (req: any, res: any, next: any) => {
  try {
    const account = await tradingAccountService.getActiveAccount(req.user.id);
    if (!account) return apiResponse.notFound(res, "Tidak ada akun aktif");
    req.activeAccount = account;
    next();
  } catch(e) { next(e); }
};

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
        riskMetrics: { sharpeRatio: 0, maxDrawdown: 0, avgRR: 0, expectancy: 0 },
        tradingBehaviour: { avgTradeDuration: "0h 0m", avgPnlPerTrade: 0, tradesPerDay: 0, planAdherence: 0 }
      });
    }
    const data = await analyticsService.getOverview(req.user.id, account.id);
    return apiResponse.success(res, data);
  } catch (error) { next(error); }
});

// Monthly P&L for charting (frontend expects separate endpoint)
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

// Streak statistics
router.get("/streaks", async (req: any, res, next) => {
  try {
    const account = await tradingAccountService.getActiveAccount(req.user.id);
    if (!account) return apiResponse.success(res, { longestWin: 0, longestLoss: 0, currentStreak: { type: "win" as const, count: 0 }, avgConsecutiveWins: 0, avgConsecutiveLosses: 0 });
    const overview = await analyticsService.getOverview(req.user.id, account.id);
    return apiResponse.success(res, overview.streakStats);
  } catch (error) { next(error); }
});

// Heatmap data (last N days)
router.get("/heatmap", async (req: any, res, next) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const account = await tradingAccountService.getActiveAccount(req.user.id);
    if (!account) return apiResponse.success(res, []);

    // Simplified: return mock intensity data for now
    const heatmapData = Array.from({ length: days }, (_, i) => ({
      day: i + 1,
      intensity: Math.floor(Math.random() * 3) // 0-2 intensity levels
    }));
    return apiResponse.success(res, heatmapData);
  } catch (error) { next(error); }
});

router.get("/equity-curve", async (req: any, res, next) => {
  try {
    const account = await tradingAccountService.getActiveAccount(req.user.id);
    if (!account) {
      return apiResponse.success(res, { points: [], highWaterMark: 0, maxDrawdown: { value: 0, date: "" } });
    }
    const data = await analyticsService.getEquityCurve(req.user.id, account.id);
    return apiResponse.success(res, data);
  } catch (error) { next(error); }
});

router.get("/risk-status", async (req: any, res, next) => {
  try {
    const account = await tradingAccountService.getActiveAccount(req.user.id);
    if (!account) {
      return apiResponse.success(res, { level: "safe", drawdown: 0, limit: 5, marginUsed: 0, marginAvailable: 0 });
    }
    const data = await riskService.getRiskStatus(account.id, req.user.id);
    return apiResponse.success(res, data);
  } catch (error) { next(error); }
});

export default router;
