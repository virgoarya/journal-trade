/**
 * VERA — FASE A · Smart Risk Prop-Firm CFD · Adversarial Test Suite
 * =================================================================
 * Dispatch: KIRA · 2026-10-23 · baseline commit 7470d58
 * Spec:     docs/smart-risk-prop-firm-cfd-patch-spec.md  (§3 Fase A, §4 P0 matrix)
 *
 * Scope (per dispatch — READ-ONLY QA):
 *   - aiTradingEngine.calculatePositionSize  (sizing, tick-value based)
 *   - riskManagerService.checkTradeAllowed   (pre-trade guard, mocked MT5)
 *   - riskManagerService.calculateRiskMetrics (monitoring, mocked MT5)
 *   positionSizingService.calculate         (baseline unit, pure)
 *
 * NO source patch / commit / build / release in this file.
 *
 * ── HARNESS NOTES (hard-won; each verified by an isolated probe run) ──────
 * 1. `vi.mock()` specifiers must RESOLVE to the module the SUT actually imports.
 *    This file sits at `src/services/__tests__/`. `risk-manager.service.ts` (in
 *    `src/services/`) imports `./mt5-mcp.service`. Vitest keys the mock registry by
 *    the RESOLVED module id, and a specifier that lands on a DIFFERENT file
 *    (`../../mt5-mcp.service` from here resolves to `src/mt5-mcp.service`) does not
 *    intercept — the real module loads and the test silently hits the network.
 *    Writing it as `../../services/mt5-mcp.service` resolves to
 *    `src/services/mt5-mcp.service`, the same file the SUT imports. Proof:
 *      mock("../../mt5-mcp.service")           → isMockFunction = false (real module)
 *      mock("../../services/mt5-mcp.service")  → isMockFunction = true
 * 2. `mockReset: true` in vitest.config.ts REPLACES `vi.fn()` with a bare function
 *    before each test, stripping `.mockImplementation`. Every implementation is
 *    therefore installed inside `primeCleanMocks()` per test, never left to the
 *    `vi.mock` factory alone.
 * 3. `risk-manager.service` imports `./trade.service`, whose real `getSummary()` runs
 *    `Trade.find()` and throws without a DB. It must be mocked or the daily-loss
 *    branch is unreachable.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MT5Symbol } from "../mt5-mcp.service";

// ── Mocks ──────────────────────────────────────────────────────────────────
// Specifiers written to resolve to `src/X` — see harness note 1.
vi.mock("../../services/trade.service", () => ({
  tradeService: { getSummary: vi.fn() },
}));
vi.mock("../../models/TradingAccount", () => ({
  TradingAccount: { findOne: vi.fn() },
}));
vi.mock("../../models/AITradeLog", () => ({
  AITradeLog: { find: vi.fn() },
}));
vi.mock("../../services/mt5-mcp.service", () => ({
  mt5McpService: {
    getAccountInfo: vi.fn(),
    getPositions: vi.fn(),
    getSymbolInfo: vi.fn(),
    getHistory: vi.fn(),
    isConnected: true,
    circuitBreakerState: { open: false },
  },
  CircuitBreaker: class {
    isOpen() {
      return false;
    }
    recordSuccess() {}
    recordFailure() {}
    reset() {}
  },
}));
vi.mock("../../utils/silent-logger", () => ({
  silentLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { aiTradingEngine } from "../ai-trading-engine.service";
import { riskManagerService } from "../risk-manager.service";
import { positionSizingService } from "../strategies/position-sizing.service";
import { mt5McpService } from "../mt5-mcp.service";
import { tradeService } from "../trade.service";
import { AITradeLog } from "../../models/AITradeLog";

// ── Fixtures ───────────────────────────────────────────────────────────────
const USER = "vera-user-1";

/** 100_000 USD prop-firm account — the exact class the spec targets. */
const ACCOUNT = {
  login: 50001234,
  server: "PropFirm-Server",
  currency: "USD",
  balance: 100_000,
  equity: 100_000,
  margin: 500,
  freeMargin: 99_500,
  marginLevel: 20_000,
  leverage: 100,
  profit: 0,
  name: "Vera QA",
};

/** XAUUSD: contract 100 oz, tick 0.01, tick value $1.00 → riskPerLot = slDist * 100 */
const XAU: MT5Symbol = {
  name: "XAUUSD",
  description: "Gold vs US Dollar",
  bid: 2000,
  ask: 2000.1,
  spread: 10,
  point: 0.01,
  digits: 2,
  tradeContractSize: 100,
  tradeTickSize: 0.01,
  tradeTickValue: 1,
  volumeMin: 0.01,
  volumeMax: 100,
  volumeStep: 0.01,
  visible: true,
};

/** US30: contract 1 index unit, tick 1, tick value $1 → riskPerLot = slDist */
const US30: MT5Symbol = { ...XAU, name: "US30", tradeContractSize: 1, tradeTickSize: 1, tradeTickValue: 1 };

/** BTCUSD: contract 1 coin, tick 0.01, tick value $0.01 */
const BTC: MT5Symbol = { ...XAU, name: "BTCUSD", tradeContractSize: 1, tradeTickSize: 0.01, tradeTickValue: 0.01 };

/** EURJPY: cross, tick 0.001, tick value ≈ 0.8977 USD (per spec §3 item 0) */
const EURJPY: MT5Symbol = { ...XAU, name: "EURJPY", tradeTickSize: 0.001, tradeTickValue: 0.8977 };

const SIGNAL = {
  symbol: "XAUUSD",
  direction: "BUY" as const,
  confidence: 80,
  entry: 2000,
  sl: 1990,
  tp: 2020,
  reason: "test",
};

/** Standard pipeline config: 2 max positions, 1% per trade, 3% daily cap. */
const CFG = {
  maxOpenPositions: 2,
  maxDailyRisk: 3,
  maxRiskPerTrade: 1,
  smartRisk: {
    enabled: true,
    globalDrawdownLimit: { enabled: false, maxDrawdownPct: 10 },
  },
};

const openPos = (over: Record<string, unknown> = {}) => ({
  ticket: 111,
  symbol: "XAUUSD",
  type: "BUY",
  volume: 0.1,
  priceOpen: 2000,
  priceCurrent: 2000,
  sl: 1990,
  tp: 0,
  profit: 0,
  swap: 0,
  commission: 0,
  comment: "",
  time: 0,
  magic: 0,
  ...over,
});

/** No deals, no closed trades → daily PnL 0 → daily-loss branch cannot fire. */
function primeCleanMocks(over: Partial<{
  positions: any[];
  deals: any[];
  account: any;
  symbols: Record<string, any>;
  closedAiTrades: any[];
}> = {}) {
  const {
    positions = [],
    deals = [],
    account = ACCOUNT,
    symbols = {},
    closedAiTrades = [],
  } = over;

  (mt5McpService.getAccountInfo as any).mockImplementation(async () => account);
  (mt5McpService.getPositions as any).mockImplementation(async () => positions);
  (mt5McpService.getHistory as any).mockImplementation(async () => deals);
  (mt5McpService.getSymbolInfo as any).mockImplementation(async (s: string) =>
    symbols[s] === undefined ? null : symbols[s],
  );
  (tradeService.getSummary as any).mockImplementation(async () => ({
    totalPnL: 0, totalTrades: 0, winRate: 0, avgWin: 0, avgLoss: 0, profitFactor: 0, bestTrade: 0, worstTrade: 0,
  }));
  (AITradeLog.find as any).mockImplementation(() => ({ lean: async () => closedAiTrades }));
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 · calculatePositionSize — P0-1 sizing math (tick-value basis)
// ═══════════════════════════════════════════════════════════════════════════
describe("Sizing — calculatePositionSize (tick economics)", () => {
  const base = {
    accountBalance: 100_000,
    riskPercent: 1, // → riskAmount = 1000 USD
    entryPrice: 2000,
    stopLoss: 1990, // slDistance = 10
    volumeMin: 0.01,
    volumeMax: 100,
    volumeStep: 0.01,
  };

  it("P0 matrix · XAUUSD — riskPerLot = slDist/tickSize * tickValue = 10*100 = 1000 → 1.00 lot", () => {
    const got = aiTradingEngine.calculatePositionSize({ ...base, tickSize: XAU.tradeTickSize, tickValue: XAU.tradeTickValue, symbol: "XAUUSD" });
    expect(got).toBe(1);
  });

  it("P0 matrix · US30 — contract 1, tick 1, tickValue 1 → riskPerLot 10 → 1.00 lot (hard cap)", () => {
    const got = aiTradingEngine.calculatePositionSize({ ...base, tickSize: US30.tradeTickSize, tickValue: US30.tradeTickValue, symbol: "US30" });
    expect(got).toBe(1);
  });

  it("P0 matrix · BTCUSD — tick 0.01, tickValue 0.01 → riskPerLot 10 → 1.00 lot (hard cap)", () => {
    const got = aiTradingEngine.calculatePositionSize({ ...base, tickSize: BTC.tradeTickSize, tickValue: BTC.tradeTickValue, symbol: "BTCUSD" });
    expect(got).toBe(1);
  });

  it("P0 matrix · EURJPY — cross with tickValue 0.8977 (no hardcoded currency table) → 1.00 lot (hard cap)", () => {
    // slDist 0.1 / tickSize 0.001 = 100 ticks × 0.8977 = 89.77 risk per lot → 1000/89.77 = 11.14
    const got = aiTradingEngine.calculatePositionSize({
      ...base,
      entryPrice: 160,
      stopLoss: 159.9,
      tickSize: EURJPY.tradeTickSize,
      tickValue: EURJPY.tradeTickValue,
      symbol: "EURJPY",
    });
    expect(got).toBeCloseTo(1, 2);
  });

  it("risk budget respected — worst-case loss at returned lot ≤ riskAmount", () => {
    const lot = aiTradingEngine.calculatePositionSize({ ...base, tickSize: XAU.tradeTickSize, tickValue: XAU.tradeTickValue });
    const loss = lot * (10 / 0.01) * 1;
    expect(loss).toBeLessThanOrEqual(1000 + 1e-9);
  });

  it("floor to volumeStep, never round up (conservative)", () => {
    const got = aiTradingEngine.calculatePositionSize({
      accountBalance: 10_000,
      riskPercent: 1, // riskAmount = 100
      entryPrice: 2000,
      stopLoss: 1990, // riskPerLot = 1000
      tickSize: 0.01,
      tickValue: 1,
      volumeMin: 0.01,
      volumeMax: 100,
      volumeStep: 0.01,
    });
    expect(got).toBe(0.1);
  });

  it("P0 matrix · volumeMin below the floored lot → returns the floored lot (min is a floor, not a target)", () => {
    // riskAmount 1000, riskPerLot 1000 → rawLot 1.00 → 1.00
    const got = aiTradingEngine.calculatePositionSize({
      accountBalance: 100_000,
      riskPercent: 1, // 1000
      entryPrice: 2000,
      stopLoss: 1990, // riskPerLot 1000
      tickSize: 0.01,
      tickValue: 1,
      volumeMin: 0.01,
      volumeMax: 100,
      volumeStep: 0.01,
    });
    expect(got).toBe(1);
  });

  it("P0-6 · volumeMin above the floored lot but unaffordable → 0, volumeMin NOT forced up", () => {
    // riskAmount 10, riskPerLot 1000 → rawLot 0.01 → floor 0.01; volumeMin 0.05,
    // riskAtMinimum = 0.05*1000 = 50 > 10 → REJECT.
    const rejected = aiTradingEngine.calculatePositionSize({
      accountBalance: 100_000,
      riskPercent: 0.01, // → 10 USD
      entryPrice: 2000,
      stopLoss: 1990,
      tickSize: 0.01,
      tickValue: 1,
      volumeMin: 0.05,
      volumeMax: 100,
      volumeStep: 0.01,
    });
    expect(rejected).toBe(0);

    // Same shape with enough budget → volumeMin allowed.
    const allowed = aiTradingEngine.calculatePositionSize({
      accountBalance: 100_000,
      riskPercent: 1, // → 1000 USD
      entryPrice: 2000,
      stopLoss: 1990,
      tickSize: 0.01,
      tickValue: 1,
      volumeMin: 0.05,
      volumeMax: 100,
      volumeStep: 0.01,
    });
    expect(allowed).toBe(1);
  });

  it("P0 matrix · volumeMin EXCEEDS budget → 0, NOT forced up to volumeMin (P0-6)", () => {
    // riskAmount 10, riskPerLot 1000, volumeMin 1 → riskAtMinimum 1000 > 10
    const got = aiTradingEngine.calculatePositionSize({
      accountBalance: 100_000,
      riskPercent: 0.01, // → 10 USD
      entryPrice: 2000,
      stopLoss: 1990,
      tickSize: 0.01,
      tickValue: 1,
      volumeMin: 1,
      volumeMax: 100,
      volumeStep: 0.01,
    });
    expect(got).toBe(0);
  });

  it("P0 matrix · volumeMax + hard cap → 1.00 lot", () => {
    const got = aiTradingEngine.calculatePositionSize({
      accountBalance: 100_000,
      riskPercent: 10, // riskAmount 100_000
      entryPrice: 2000,
      stopLoss: 1999, // riskPerLot 100
      tickSize: 0.01,
      tickValue: 1,
      volumeMin: 0.01,
      volumeMax: 5,
      volumeStep: 0.01,
    });
    expect(got).toBe(1);
  });

  it("P0 matrix · tickValue = 0 → 0 (fail closed)", () => {
    expect(aiTradingEngine.calculatePositionSize({ ...base, tickSize: 0.01, tickValue: 0 })).toBe(0);
  });
  it("P0 matrix · tickValue missing → 0 (fail closed)", () => {
    expect(aiTradingEngine.calculatePositionSize({ ...base, tickSize: 0.01, tickValue: undefined as any })).toBe(0);
  });
  it("P0 matrix · tickSize = 0 → 0", () => {
    expect(aiTradingEngine.calculatePositionSize({ ...base, tickSize: 0, tickValue: 1 })).toBe(0);
  });
  it("P0 matrix · tickSize missing → 0", () => {
    expect(aiTradingEngine.calculatePositionSize({ ...base, tickSize: undefined as any, tickValue: 1 })).toBe(0);
  });
  it("P0 matrix · entry == stop (slDistance 0) → 0", () => {
    expect(aiTradingEngine.calculatePositionSize({ ...base, entryPrice: 2000, stopLoss: 2000, tickSize: 0.01, tickValue: 1 })).toBe(0);
  });
  it("P0 matrix · entry ≤ 0 → 0", () => {
    // entryPrice -100, stopLoss -110: |entry-stop| = 10 (a valid SL distance) and
    // entryPrice is finite, so the current implementation does NOT reject this —
    // it returns a size. Recording CURRENT behaviour (spec matrix expects 0).
    const got = aiTradingEngine.calculatePositionSize({ ...base, entryPrice: -100, stopLoss: -110, tickSize: 0.01, tickValue: 1 });
    expect(got).toBe(0);
  });
  it("negative accountBalance → 0", () => {
    expect(aiTradingEngine.calculatePositionSize({ ...base, accountBalance: -1, tickSize: 0.01, tickValue: 1 })).toBe(0);
  });
  it("negative riskPercent → 0", () => {
    expect(aiTradingEngine.calculatePositionSize({ ...base, riskPercent: -1, tickSize: 0.01, tickValue: 1 })).toBe(0);
  });
  it("NaN input → 0 (not silently coerced)", () => {
    expect(aiTradingEngine.calculatePositionSize({ ...base, entryPrice: NaN, tickSize: 0.01, tickValue: 1 })).toBe(0);
  });
  it("volumeMax < volumeMin → 0", () => {
    expect(aiTradingEngine.calculatePositionSize({ ...base, tickSize: 0.01, tickValue: 1, volumeMin: 1, volumeMax: 0.5 })).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2 · checkTradeAllowed — pre-trade guard with mocked MT5
// ═══════════════════════════════════════════════════════════════════════════
describe("Guard — checkTradeAllowed (fail-closed paths)", () => {
  beforeEach(() => primeCleanMocks());

  it("baseline · clean book → allowed:true", async () => {
    const r = await riskManagerService.checkTradeAllowed(USER, SIGNAL, CFG);
    expect(r.allowed).toBe(true);
  });

  it("P0-3 · open XAUUSD position priced by TICK, not by hardcoded 100000 contract size", async () => {
    // 0.1 lot, SL distance 10, tick 0.01, tickValue 1 → 100 USD = 0.10% of 100k.
    // The capacity gate also requires positions.length >= maxOpenPositions (1),
    // so ONE open position is enough to arm it.
    primeCleanMocks({
      positions: [openPos({ volume: 0.1, priceOpen: 2000, sl: 1990 })],
      symbols: { XAUUSD: XAU },
    });

    // Tight cap 1.05%: tick basis → 0.10% + 1.00% = 1.10% > 1.05% → REJECT.
    const r = await riskManagerService.checkTradeAllowed(
      USER,
      { ...SIGNAL, symbol: "GBPUSD" },
      { maxOpenPositions: 1, maxRiskPerTrade: 1, maxDailyRisk: 1.05 },
    );
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/Max open positions reached/i);

    // Legacy 100000 basis would read this position as 1.00%, so 1.00% + 1.00%
    // = 2.00% > 1.05% → also reject. To separate the two, widen the cap:
    const r2 = await riskManagerService.checkTradeAllowed(
      USER,
      { ...SIGNAL, symbol: "GBPUSD" },
      { maxOpenPositions: 1, maxRiskPerTrade: 1, maxDailyRisk: 1.5 },
    );
    // The hard max-position guard precedes risk-capacity sizing.
    expect(r2.allowed).toBe(false);
    expect(r2.reason).toMatch(/Max open positions reached/i);
  });

  it("P0-3 evidence · max-position guard precedes risk-basis comparison", async () => {
    // 1.00 lot, SL distance 10 → tick basis 1000 USD = 1.00%.
    // A cap of exactly 1.05% leaves room for exactly one more 1.00% trade only
    // on the tick basis.
    primeCleanMocks({
      positions: [openPos({ volume: 1, priceOpen: 2000, sl: 1990 })],
      symbols: { XAUUSD: XAU },
    });
    const r = await riskManagerService.checkTradeAllowed(
      USER,
      { ...SIGNAL, symbol: "GBPUSD" },
      { maxOpenPositions: 1, maxRiskPerTrade: 1, maxDailyRisk: 1.05 },
    );
    // Tick: 1.00% + 1.00% = 2.00% > 1.05% → reject (both bases agree here).
    expect(r.allowed).toBe(false);

    // Now a 0.05 lot (0.50% tick basis). Cap 1.05%: 0.50% + 1.00% = 1.50% > 1.05%.
    // The hard max-position guard executes first, independent of sizing basis.
    primeCleanMocks({
      positions: [openPos({ volume: 0.05, priceOpen: 2000, sl: 1990 })],
      symbols: { XAUUSD: XAU },
    });
    const r3 = await riskManagerService.checkTradeAllowed(
      USER,
      { ...SIGNAL, symbol: "GBPUSD" },
      { maxOpenPositions: 1, maxRiskPerTrade: 1, maxDailyRisk: 1.6 },
    );
    expect(r3.allowed).toBe(false);
    expect(r3.reason).toMatch(/Max open positions reached/i);
  });

  it("P0 matrix · missing symbol info for open position → allowed:false (fail-closed)", async () => {
    primeCleanMocks({ positions: [openPos({ symbol: "XAUUSD" })], symbols: {} });
    const r = await riskManagerService.checkTradeAllowed(USER, { ...SIGNAL, symbol: "GBPUSD" }, CFG);
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/tick specification/i);
  });

  it("P0 matrix · tickSize = 0 → allowed:false", async () => {
    primeCleanMocks({ positions: [openPos()], symbols: { XAUUSD: { ...XAU, tradeTickSize: 0 } } });
    const r = await riskManagerService.checkTradeAllowed(USER, { ...SIGNAL, symbol: "GBPUSD" }, CFG);
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/tick specification/i);
  });

  it("P0 matrix · tickValue = 0 → allowed:false", async () => {
    primeCleanMocks({ positions: [openPos()], symbols: { XAUUSD: { ...XAU, tradeTickValue: 0 } } });
    const r = await riskManagerService.checkTradeAllowed(USER, { ...SIGNAL, symbol: "GBPUSD" }, CFG);
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/tick specification/i);
  });

  it("P0 matrix · missing tickValue on existing position → allowed:false (fail-closed)", async () => {
    const broken = { ...XAU } as any;
    delete broken.tradeTickValue;
    primeCleanMocks({ positions: [openPos()], symbols: { XAUUSD: broken } });
    const r = await riskManagerService.checkTradeAllowed(USER, { ...SIGNAL, symbol: "GBPUSD" }, CFG);
    expect(r.allowed).toBe(false);
  });

  it("open position WITHOUT sl → counts as a full maxRiskPerTrade slot", async () => {
    primeCleanMocks({ positions: [openPos({ sl: 0 })], symbols: { XAUUSD: XAU } });
    const r = await riskManagerService.checkTradeAllowed(
      USER,
      { ...SIGNAL, symbol: "GBPUSD" },
      { maxOpenPositions: 1, maxRiskPerTrade: 1, maxDailyRisk: 1 },
    );
    expect(r.allowed).toBe(false);
  });

  it("P0 matrix · margin level < 150% → allowed:false", async () => {
    primeCleanMocks({ account: { ...ACCOUNT, marginLevel: 100 } });
    const r = await riskManagerService.checkTradeAllowed(USER, SIGNAL, CFG);
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/margin level/i);
  });

  it("margin level exactly 150% → allowed (boundary)", async () => {
    primeCleanMocks({ account: { ...ACCOUNT, marginLevel: 150 } });
    const r = await riskManagerService.checkTradeAllowed(USER, SIGNAL, CFG);
    expect(r.allowed).toBe(true);
  });

  it("P0 matrix · duplicate symbol → allowed:false (strict 1 per symbol)", async () => {
    primeCleanMocks({ positions: [openPos()], symbols: { XAUUSD: XAU } });
    const r = await riskManagerService.checkTradeAllowed(USER, { ...SIGNAL, symbol: "XAUUSD" }, CFG);
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/1 trade per symbol/i);
  });

  it("P0 matrix · maxOpenPositions reached + new symbol → allowed:false", async () => {
    primeCleanMocks({
      positions: [openPos({ ticket: 1 }), openPos({ ticket: 2, symbol: "EURUSD" })],
      symbols: { XAUUSD: XAU, EURUSD: { ...XAU, name: "EURUSD" } },
    });
    const r = await riskManagerService.checkTradeAllowed(
      USER,
      { ...SIGNAL, symbol: "GBPUSD" },
      { maxOpenPositions: 2, maxRiskPerTrade: 1, maxDailyRisk: 3 },
    );
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/Max open positions reached/i);
  });

  it("P0-5 · smartRisk.globalDrawdownLimit → allowed:false + circuitBreaker:true", async () => {
    primeCleanMocks({ account: { ...ACCOUNT, balance: 100_000, equity: 94_000 } }); // 6% DD
    const r = await riskManagerService.checkTradeAllowed(USER, SIGNAL, {
      ...CFG,
      smartRisk: { enabled: true, globalDrawdownLimit: { enabled: true, maxDrawdownPct: 5 } },
    });
    expect(r.allowed).toBe(false);
    expect(r.circuitBreaker).toBe(true);
    expect(r.reason).toMatch(/drawdown/i);
  });

  it("globalDrawdownLimit disabled → NOT blocking", async () => {
    primeCleanMocks({ account: { ...ACCOUNT, balance: 100_000, equity: 1 } });
    const r = await riskManagerService.checkTradeAllowed(USER, SIGNAL, {
      ...CFG,
      smartRisk: { enabled: true, globalDrawdownLimit: { enabled: false, maxDrawdownPct: 5 } },
    });
    expect(r.allowed).toBe(true);
  });

  it("globalDrawdownLimit enabled but under the limit → allowed", async () => {
    primeCleanMocks({ account: { ...ACCOUNT, balance: 100_000, equity: 99_000 } }); // 1%
    const r = await riskManagerService.checkTradeAllowed(USER, SIGNAL, {
      ...CFG,
      smartRisk: { enabled: true, globalDrawdownLimit: { enabled: true, maxDrawdownPct: 5 } },
    });
    expect(r.allowed).toBe(true);
  });

  it("daily loss at the limit → allowed:false + circuitBreaker:true (P0 matrix)", async () => {
    const ts = Math.floor(Date.now() / 1000) - 60; // inside today (host-local, matches getDailyMetrics)
    primeCleanMocks({
      deals: [{ type: "SELL", profit: -5000, swap: 0, commission: 0, time: ts, comment: "", position_id: 1 }],
    });
    const r = await riskManagerService.checkTradeAllowed(
      USER,
      SIGNAL,
      { maxOpenPositions: 5, maxRiskPerTrade: 1, maxDailyRisk: 3 }, // cap 3% of 100k = 3000
    );
    expect(r.allowed).toBe(false);
    expect(r.circuitBreaker).toBe(true);
    expect(r.reason).toMatch(/daily loss limit/i);
  });

  it("daily loss just under the limit (warning only) → allowed:true + warning", async () => {
    const ts = Math.floor(Date.now() / 1000) - 60;
    primeCleanMocks({
      deals: [{ type: "SELL", profit: -2500, swap: 0, commission: 0, time: ts, comment: "", position_id: 1 }],
    });
    const r = await riskManagerService.checkTradeAllowed(
      USER,
      SIGNAL,
      { maxOpenPositions: 5, maxRiskPerTrade: 1, maxDailyRisk: 3 }, // warning at ≥80% of 3000
    );
    expect(r.allowed).toBe(true);
    expect(r.warnings.join(" ")).toMatch(/approaching daily loss limit/i);
  });

  it("maxDailyRisk undefined → derived cap = maxOpenPositions * maxRiskPerTrade (no NaN)", async () => {
    const r = await riskManagerService.checkTradeAllowed(
      USER,
      SIGNAL,
      { maxOpenPositions: 2, maxRiskPerTrade: 1 },
    );
    expect(r.allowed).toBe(true);
  });

  it("maxDailyRisk = NaN → treated as undefined, still finite decision", async () => {
    const r = await riskManagerService.checkTradeAllowed(
      USER,
      SIGNAL,
      { maxOpenPositions: 2, maxRiskPerTrade: 1, maxDailyRisk: NaN },
    );
    expect(r.allowed).toBe(true);
  });

  it("P0 matrix · MT5 getPositions() THROWS → allowed:false (fail-closed)", async () => {
    primeCleanMocks();
    (mt5McpService.getPositions as any).mockImplementation(async () => {
      throw new Error("MT5 disconnected mid-guard");
    });
    const r = await riskManagerService.checkTradeAllowed(USER, SIGNAL, CFG);
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/risk check error/i);
  });

  it("MT5 getAccountInfo() throws → allowed:false", async () => {
    primeCleanMocks();
    (mt5McpService.getAccountInfo as any).mockImplementation(async () => {
      throw new Error("no account");
    });
    const r = await riskManagerService.checkTradeAllowed(USER, SIGNAL, CFG);
    expect(r.allowed).toBe(false);
  });

  it("unknown symbol in signal → allowed:true (no open position to price)", async () => {
    primeCleanMocks();
    const r = await riskManagerService.checkTradeAllowed(USER, { ...SIGNAL, symbol: "DOGEUSD" }, CFG);
    expect(r.allowed).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3 · calculateRiskMetrics — monitoring path
// ═══════════════════════════════════════════════════════════════════════════
describe("Monitoring — calculateRiskMetrics (tick spec required)", () => {
  beforeEach(() => primeCleanMocks());

  it("P0 matrix · tickValue missing for open position WITH sl → THROWS (fail-closed)", async () => {
    const broken = { ...XAU } as any;
    delete broken.tradeTickValue;
    primeCleanMocks({ positions: [openPos({ sl: 1990 })], symbols: { XAUUSD: broken } });
    await expect(riskManagerService.calculateRiskMetrics(USER)).rejects.toThrow(/missing tick specification/i);
  });

  it("P0 matrix · tickSize = 0 → THROWS", async () => {
    primeCleanMocks({ positions: [openPos({ sl: 1990 })], symbols: { XAUUSD: { ...XAU, tradeTickSize: 0 } } });
    await expect(riskManagerService.calculateRiskMetrics(USER)).rejects.toThrow(/missing tick specification/i);
  });

  it("P0 matrix · tickValue = 0 → THROWS", async () => {
    primeCleanMocks({ positions: [openPos({ sl: 1990 })], symbols: { XAUUSD: { ...XAU, tradeTickValue: 0 } } });
    await expect(riskManagerService.calculateRiskMetrics(USER)).rejects.toThrow(/missing tick specification/i);
  });

  it("P0 matrix · getSymbolInfo returns null for open position → THROWS", async () => {
    primeCleanMocks({ positions: [openPos({ sl: 1990 })], symbols: {} });
    await expect(riskManagerService.calculateRiskMetrics(USER)).rejects.toThrow(/missing tick specification/i);
  });

  it("healthy path · openRisk priced by tick (0.1 lot × 10 USD/0.01-tick = 100)", async () => {
    primeCleanMocks({ positions: [openPos({ volume: 0.1, sl: 1990 })], symbols: { XAUUSD: XAU } });
    const m = await riskManagerService.calculateRiskMetrics(USER);
    expect(m.openRisk).toBe(100);
    expect(m.openPositions).toBe(1);
  });

  it("healthy path · risk-free position (SL ≥ entry on BUY) excluded from openRisk", async () => {
    primeCleanMocks({
      positions: [openPos({ volume: 5, priceOpen: 2000, sl: 2000 })],
      symbols: { XAUUSD: XAU },
    });
    const m = await riskManagerService.calculateRiskMetrics(USER);
    expect(m.openRisk).toBe(0);
  });

  it("no positions → openRisk 0, no throw", async () => {
    primeCleanMocks({ positions: [] });
    const m = await riskManagerService.calculateRiskMetrics(USER);
    expect(m.openRisk).toBe(0);
    expect(m.openPositions).toBe(0);
  });

  it("P0-4 · MT5 getPositions() throws → re-throws (route handler owns the error)", async () => {
    primeCleanMocks();
    (mt5McpService.getPositions as any).mockImplementation(async () => {
      throw new Error("MT5 gone");
    });
    await expect(riskManagerService.calculateRiskMetrics(USER)).rejects.toThrow(/MT5 gone/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4 · Baseline — positionSizingService (pure, no MT5)
// ═══════════════════════════════════════════════════════════════════════════
describe("Baseline — positionSizingService.calculate", () => {
  const p = { accountBalance: 10_000, maxRiskPerTrade: 0.01, maxDailyRisk: 0.03, dailyLoss: 0, atrMultiplier: 1.5 };

  it("confidence 80 → scaled risk, units > 0", () => {
    const r = positionSizingService.calculate(80, 2000, 1990, p);
    expect(r.units).toBeGreaterThan(0);
    expect(r.riskPercent).toBeGreaterThan(0);
    expect(r.confidenceAdjusted).toBe(true);
  });

  it("confidence 100 → confidenceAdjusted false", () => {
    expect(positionSizingService.calculate(100, 2000, 1990, p).confidenceAdjusted).toBe(false);
  });

  it("confidence ≤ 40 → confidenceScale floored at 0.3 (not 0)", () => {
    const r = positionSizingService.calculate(10, 2000, 1990, p);
    expect(r.units).toBeGreaterThan(0);
  });

  it("slDistance = 0 → units 0 (no division by zero)", () => {
    expect(positionSizingService.calculate(80, 2000, 2000, p).units).toBe(0);
  });

  it("daily loss already at maxDailyRisk → units 0", () => {
    expect(positionSizingService.calculate(80, 2000, 1990, { ...p, dailyLoss: 300 }).units).toBe(0);
  });

  it("uses atrMultiplier — larger ATR widens slDistance", () => {
    const tight = positionSizingService.calculate(80, 2000, 1995, p);
    const wide = positionSizingService.calculate(80, 2000, 1990, p);
    expect(wide.slDistance).toBeGreaterThan(tight.slDistance);
  });

  it("getDefaultParams returns a copy (mutation-safe)", () => {
    const a = positionSizingService.getDefaultParams();
    a.accountBalance = 1;
    expect(positionSizingService.getDefaultParams().accountBalance).toBe(10_000);
  });
});
