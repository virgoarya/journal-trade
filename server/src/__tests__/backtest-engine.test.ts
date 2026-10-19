/**
 * Phase 3.1: Backtesting Engine — Synthetic Data Verification Test
 *
 * RED phase: tests written first, engine not yet implemented.
 *
 * Engine contract:
 *   runBacktest(trades: BacktestTradeInput[]): BacktestReport
 *
 * BacktestTradeInput (minimal shape, decoupled from Mongoose model):
 *   { symbol, direction, confidence, methodology, pnl }
 *
 * BacktestReport:
 *   { totalTrades, winRate, profitFactor, expectancy, avgWin, avgLoss,
 *     maxDrawdown, wins, losses, perMethodology, perSymbol }
 */
import { describe, it, expect } from "vitest";
import { runBacktest, type BacktestTradeInput } from "../services/backtest-engine.service";

const t = (over: Partial<BacktestTradeInput>): BacktestTradeInput => ({
  symbol: "XAUUSD",
  direction: "BUY",
  confidence: 75,
  methodology: "SMC",
  pnl: 0,
  ...over,
});

describe("Phase 3.1: Backtesting Engine", () => {
  it("returns zeroed report for empty input", () => {
    const r = runBacktest([]);
    expect(r.totalTrades).toBe(0);
    expect(r.winRate).toBe(0);
    expect(r.profitFactor).toBe(0);
    expect(r.expectancy).toBe(0);
    expect(r.wins).toBe(0);
    expect(r.losses).toBe(0);
  });

  it("single winning trade → winRate 1.0, expectancy = pnl", () => {
    const r = runBacktest([t({ pnl: 100 })]);
    expect(r.totalTrades).toBe(1);
    expect(r.wins).toBe(1);
    expect(r.winRate).toBe(1);
    expect(r.expectancy).toBe(100);
  });

  it("single losing trade → winRate 0, expectancy negative", () => {
    const r = runBacktest([t({ pnl: -50 })]);
    expect(r.totalTrades).toBe(1);
    expect(r.losses).toBe(1);
    expect(r.winRate).toBe(0);
    expect(r.expectancy).toBe(-50);
  });

  it("all wins → profitFactor is Infinity (no losses)", () => {
    const r = runBacktest([t({ pnl: 10 }), t({ pnl: 20 }), t({ pnl: 30 })]);
    expect(r.profitFactor).toBe(Infinity);
    expect(r.winRate).toBe(1);
  });

  it("all losses → profitFactor 0", () => {
    const r = runBacktest([t({ pnl: -10 }), t({ pnl: -20 })]);
    expect(r.profitFactor).toBe(0);
    expect(r.winRate).toBe(0);
  });

  it("mixed trades → correct winRate and expectancy", () => {
    // 3 wins (+100 each), 2 losses (-50 each)
    // winRate = 3/5 = 0.6
    // expectancy = (300 - 100) / 5 = 40
    const r = runBacktest([
      t({ pnl: 100 }),
      t({ pnl: 100 }),
      t({ pnl: 100 }),
      t({ pnl: -50 }),
      t({ pnl: -50 }),
    ]);
    expect(r.totalTrades).toBe(5);
    expect(r.wins).toBe(3);
    expect(r.losses).toBe(2);
    expect(r.winRate).toBeCloseTo(0.6, 5);
    expect(r.expectancy).toBeCloseTo(40, 5);
  });

  it("break-even trade (pnl 0) counts as neither win nor loss", () => {
    const r = runBacktest([t({ pnl: 100 }), t({ pnl: 0 }), t({ pnl: -50 })]);
    expect(r.totalTrades).toBe(3);
    expect(r.wins).toBe(1);
    expect(r.losses).toBe(1);
    // winRate over decided trades = 1/2 = 0.5
    expect(r.winRate).toBeCloseTo(0.5, 5);
  });

  it("profitFactor = grossProfit / grossLoss", () => {
    // grossProfit = 100+200 = 300, grossLoss = 50+50 = 100 → PF = 3
    const r = runBacktest([
      t({ pnl: 100 }),
      t({ pnl: 200 }),
      t({ pnl: -50 }),
      t({ pnl: -50 }),
    ]);
    expect(r.profitFactor).toBeCloseTo(3, 5);
  });

  it("maxDrawdown computed from cumulative equity curve", () => {
    // Equity: 0 → +100 → +50 → +150 → +100
    // Peak: 0, 100, 100, 150, 150
    // Drawdown: 0, 0, -50, 0, -50 → maxDrawdown = 50
    const r = runBacktest([
      t({ pnl: 100 }),
      t({ pnl: -50 }),
      t({ pnl: 100 }),
      t({ pnl: -50 }),
    ]);
    expect(r.maxDrawdown).toBe(50);
  });

  it("perMethodology breakdown groups trades correctly", () => {
    const r = runBacktest([
      t({ methodology: "SMC", pnl: 100 }),
      t({ methodology: "SMC", pnl: -50 }),
      t({ methodology: "ICT", pnl: 200 }),
    ]);
    expect(r.perMethodology["SMC"].trades).toBe(2);
    expect(r.perMethodology["SMC"].winRate).toBeCloseTo(0.5, 5);
    expect(r.perMethodology["ICT"].trades).toBe(1);
    expect(r.perMethodology["ICT"].winRate).toBe(1);
  });

  it("perSymbol breakdown groups trades correctly", () => {
    const r = runBacktest([
      t({ symbol: "XAUUSD", pnl: 100 }),
      t({ symbol: "XAUUSD", pnl: -50 }),
      t({ symbol: "EURUSD", pnl: 200 }),
    ]);
    expect(r.perSymbol["XAUUSD"].trades).toBe(2);
    expect(r.perSymbol["EURUSD"].trades).toBe(1);
  });

  it("avgWin and avgLoss computed correctly", () => {
    const r = runBacktest([
      t({ pnl: 100 }),
      t({ pnl: 200 }),
      t({ pnl: -50 }),
      t({ pnl: -30 }),
    ]);
    expect(r.avgWin).toBeCloseTo(150, 5);
    expect(r.avgLoss).toBeCloseTo(40, 5);
  });
});
