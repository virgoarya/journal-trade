import { Router } from "express";
import { marketDataService } from "../services/market-data.service";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/news", async (req, res) => {
  try {
    const data = await marketDataService.getNews();
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(503).json({ success: false, error: error.message });
  }
});

router.get("/tga", async (req, res) => {
  try {
    const data = await marketDataService.getTGA();
    res.json({
      success: true,
      data: {
        value: data.balance,
        delta: data.delta,
        displayValue: data.displayValue,
        date: data.date,
      },
    });
  } catch (error: any) {
    res.status(503).json({ success: false, error: error.message });
  }
});

router.get("/quotes", async (req, res) => {
  try {
    const symbolsParam = req.query.symbols as string;
    if (!symbolsParam) {
      res.status(400).json({ success: false, error: "Missing symbols parameter" });
      return;
    }
    
    const symbols = symbolsParam.split(",").map(s => s.trim()).filter(Boolean);
    const data = await marketDataService.getQuotes(symbols);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(503).json({ success: false, error: error.message });
  }
});

router.get("/liquidity", async (req, res) => {
  try {
    const data = await marketDataService.getLiquidity();
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(503).json({ success: false, error: error.message });
  }
});

router.get("/economic-calendar", async (req, res) => {
  try {
    const data = await marketDataService.getEconomicCalendar();
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(503).json({ success: false, error: error.message });
  }
});

// Temporary mock endpoint for testing - inject mock liquidity change to trigger notification
router.post("/liquidity/mock-trigger", requireAuth, async (req, res) => {
  try {
    const { value, change } = req.body;
    const data = await marketDataService.getLiquidity(); // Get current cached
    const mockValue = value || 12000; // 12000B = $12T as test
    const mockChange = change || 5.5; // +5.5B increase to trigger DRAINING
    
    // Manually trigger notification by updating cache and calling the logic
    const cacheKey = "liquidity_onrrp";
    const cache = (marketDataService as any).cache || {};
    
    // Simulate a change for notification
    if (cache[cacheKey]) {
      const prevValue = cache[cacheKey].data?.value || 11500;
      const absChange = Math.abs(mockValue - prevValue);
      
      if (absChange > 0.1) {
        const isDraining = mockChange > 0;
        const { notificationService } = await import("../services/notification.service");
        await notificationService.create({
          userId: "system",
          type: "RISK_WARNING",
          title: "⚠️ Institutional Liquidity Draining",
          message: `Dana ON RRP meningkat sebesar $${absChange.toFixed(2)}B. Institusi memarkir uang ke Fed, likuiditas pasar berpotensi mengetat.`,
          metadata: {
            currentValue: mockValue,
            previousValue: prevValue,
            change: mockChange,
            status: isDraining ? "DRAINING" : "INJECTING",
            source: "FRED_ON_RRP_MOCK"
          }
        });
      }
    }
    
    res.json({ success: true, message: "Mock notification triggered" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
