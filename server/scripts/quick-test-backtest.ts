import { backtestService } from "../src/services/backtest.service";
import { mt5McpService } from "../src/services/mt5-mcp.service";
import mongoose from "mongoose";

async function run() {
  console.log("Starting quick backtest verification...");
  try {
    // Ensure MT5 is connected first
    console.log("Connecting to MT5...");
    await mt5McpService.connectToMT5({
      mcpUrl: "http://127.0.0.1:22346/mcp",
      apiKey: "1oBaWtEsZuqVsfzLoHlALKBtNcTQuFHt5AHGrRS9Zw",
    });
    console.log("MT5 connected!");
    const fromDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
    const toDate = new Date();

    const config: any = {
      symbols: ["XAUUSD", "EURUSD"],
      timeframe: "H1",
      fromDate,
      toDate,
      initialBalance: 10000,
      entrySettings: {
        rsiOversold: 30,
        rsiOverbought: 70,
        atrMultiplierSL: 1.5,
        atrMultiplierTP: 2.0,
      },
      trailingStop: {
        enabled: false,
        activationATR: 1.0,
        trailATR: 1.0,
        breakEven: false,
      },
      riskPerTradePercent: 1,
      strategy: "multi",
      activeMethodologies: ["smc", "ict", "msnr"],
    };

    console.log("Running backtest for XAUUSD H1...");
    const validUserId = "650000000000000000000001";
    const result = await backtestService.runBacktest(config, validUserId);
    console.log("Backtest finished successfully!");
    console.log("Total Trades:", result.summary.totalTrades);
    console.log("Win Rate:", result.summary.winRate + "%");
    console.log("Net Profit:", result.summary.netProfit);
  } catch (err: any) {
    console.error("Backtest error:", err.message);
  } finally {
    process.exit(0);
  }
}

run();
