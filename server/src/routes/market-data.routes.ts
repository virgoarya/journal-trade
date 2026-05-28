import { Router } from "express";
import { marketDataService } from "../services/market-data.service";

const router = Router();

router.get("/news", async (req, res) => {
  try {
    const data = await marketDataService.getNews();
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(503).json({ success: false, error: error.message });
  }
});

router.get("/quotes", async (req, res) => {
  try {
    // Expecting symbols as a comma-separated query param, e.g., ?symbols=AAPL,BINANCE:BTCUSDT,OANDA:EUR_USD
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

export default router;
