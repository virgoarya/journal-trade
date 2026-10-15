/**
 * Macro candles routes.
 *   GET /api/v1/macro/candles?symbol=^GSPC&tf=6M&limit=500
 *   GET /api/v1/macro/instruments
 * Spec: docs/design/macro-charting-and-palette-spec.md §5.1, §5.4
 */
import { Router } from "express";
import { macroCandlesService } from "../services/macro/macro-candles.service";
import { silentLogger } from "../utils/silent-logger";

const router = Router();

/** Daftar instrumen yang boleh di-chart. */
router.get("/instruments", (_req, res) => {
  res.json({
    success: true,
    data: macroCandlesService.listInstruments(),
    rateLimited: false,
  });
});

/** Candle OHLCV untuk satu simbol + timeframe. */
router.get("/candles", async (req, res) => {
  const symbol = typeof req.query.symbol === "string" ? req.query.symbol : "";
  const tf = typeof req.query.tf === "string" ? req.query.tf : "";
  const rawLimit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : NaN;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 5000) : 500;

  if (!symbol || !tf) {
    return res.status(400).json({
      success: false,
      error: "Invalid symbol or timeframe",
      rateLimited: false,
    });
  }

  try {
    const data = await macroCandlesService.getCandles(symbol, tf, limit);
    return res.json({ success: true, data, rateLimited: false });
  } catch (error: any) {
    const status = typeof error?.statusCode === "number" ? error.statusCode : 503;
    if (status === 400) {
      return res.status(400).json({
        success: false,
        error: "Invalid symbol or timeframe",
        rateLimited: false,
      });
    }
    silentLogger.error("[MacroCandles Route] Error:", error?.message);
    return res.status(503).json({
      success: false,
      error: error?.message ?? "All providers unavailable",
      rateLimited: true,
    });
  }
});

export default router;
