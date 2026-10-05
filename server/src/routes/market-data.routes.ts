import { Router } from "express";
import { marketDataService } from "../services/market-data.service";
import { requireAuth } from "../middleware/auth";
import { analyzeCotAsset } from "../services/macro-ai.service";

const router = Router();

/**
 * GET /v1/market-data/ohlc-range?symbol=XAUUSD&from=ISO&to=ISO
 * Returns { high, low } spanning [from, to] for MAE/MFE auto-calc.
 */
router.get("/ohlc-range", async (req, res) => {
  try {
    const { symbol, from, to } = req.query as Record<string, string>;
    if (!symbol || !from || !to) {
      return res.status(400).json({ success: false, error: "symbol, from, to are required" });
    }
    const range = await marketDataService.getOhlcRange(symbol, from, to);
    if (!range) {
      return res.status(404).json({ success: false, error: "No OHLC data available for the given range" });
    }
    res.json({ success: true, data: range });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/news", async (req, res) => {
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timeout")), 20000)
    );
    const data = await Promise.race([
      marketDataService.getNews(),
      timeoutPromise
    ]);
    res.json({ success: true, data, fetchedAt: new Date().toISOString(), rateLimited: false });
  } catch (error: any) {
    if (error.message && error.message.includes("Rate limited")) {
      return res.status(429).json({ success: false, error: error.message, retryAfter: 60, rateLimited: true });
    }
    const fallbackData = marketDataService.getMockNews();
    res.json({ success: true, data: fallbackData, fetchedAt: new Date().toISOString(), rateLimited: false, fallback: true });
  }
});

router.get("/tga", async (req, res) => {
  try {
    const data = await marketDataService.getTGA();
    res.json({
      success: true,
      data: {
        value: data.value,
        delta: data.delta,
        displayValue: data.displayValue,
        date: data.date,
        history: data.history,
        trend: data.trend,
      },
      fetchedAt: new Date().toISOString(),
      rateLimited: false,
    });
  } catch (error: any) {
    if (error.message.includes("Rate limited")) {
      return res.status(429).json({ success: false, error: error.message, retryAfter: 60, rateLimited: true });
    }
    res.status(503).json({ success: false, error: error.message, rateLimited: true });
  }
});

router.get("/quotes", async (req, res) => {
  try {
    const symbolsParam = req.query.symbols as string;
    if (!symbolsParam) {
      res.status(400).json({ success: false, error: "Missing symbols parameter", rateLimited: false });
      return;
    }
    
    const symbols = symbolsParam.split(",").map(s => s.trim()).filter(Boolean);
    const data = await marketDataService.getQuotes(symbols);
    res.json({ success: true, data, fetchedAt: new Date().toISOString(), rateLimited: false });
  } catch (error: any) {
    if (error.message.includes("Rate limited")) {
      return res.status(429).json({ success: false, error: error.message, retryAfter: 60, rateLimited: true });
    }
    res.status(503).json({ success: false, error: error.message, rateLimited: true });
  }
});

router.get("/liquidity", async (req, res) => {
  try {
    const data = await marketDataService.getLiquidity();
    res.json({ success: true, data, fetchedAt: new Date().toISOString(), rateLimited: false });
  } catch (error: any) {
    if (error.message.includes("Rate limited")) {
      return res.status(429).json({ success: false, error: error.message, retryAfter: 60, rateLimited: true });
    }
    res.status(503).json({ success: false, error: error.message, rateLimited: true });
  }
});

router.get("/economic-calendar", async (req, res) => {
  try {
    const data = await marketDataService.getEconomicCalendar();
    res.json({ success: true, data, fetchedAt: new Date().toISOString(), rateLimited: false });
  } catch (error: any) {
    if (error.message.includes("Rate limited")) {
      return res.status(429).json({ success: false, error: error.message, retryAfter: 60, rateLimited: true });
    }
    res.status(503).json({ success: false, error: error.message, rateLimited: true });
  }
});

router.get("/cot", async (req, res) => {
  try {
    const result = await marketDataService.getCommitmentOfTraders();
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(503).json({ success: false, error: error.message, rateLimited: true });
  }
});

router.post("/cot/analyze", async (req, res) => {
  try {
    const cotData = req.body;
    if (!cotData || !cotData.symbol) {
      return res.status(400).json({ success: false, error: "Missing COT data" });
    }
    const analysis = await analyzeCotAsset(cotData);
    if (!analysis) {
      return res.status(503).json({ success: false, error: "AI analysis failed" });
    }
    res.json({ success: true, data: analysis });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/liquidity/mock-trigger", requireAuth, async (req, res) => {
  try {
    const { value, change } = req.body;
    const data = await marketDataService.getLiquidity();
    const mockValue = value || 12000;
    const mockChange = change || 5.5;
    
    const prevValue = data.value;
    const absChange = Math.abs(mockValue - prevValue);
    
    if (absChange > 0.1) {
      const isDraining = mockChange > 0;
      const { notificationService } = await import("../services/notification.service");
      await notificationService.create({
        userId: "system",
        type: "RISK_WARNING",
        title: "⚠️ Institutional Liquidity Draining",
        message: isDraining
          ? `Dana ON RRP meningkat sebesar $${absChange.toFixed(2)}B. Institusi memarkir uang ke Fed, likuiditas pasar berpotensi mengetat.`
          : `Dana ON RRP menurun sebesar $${absChange.toFixed(2)}B. Likuiditas kembali disuntikkan ke pasar bursa!`,
        metadata: {
          currentValue: mockValue,
          previousValue: prevValue,
          change: mockChange,
          status: isDraining ? "DRAINING" : "INJECTING",
          source: "FRED_ON_RRP_MOCK"
        }
      });
    }
    
    res.json({ success: true, message: "Mock notification triggered" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;