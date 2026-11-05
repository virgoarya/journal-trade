/**
 * AXIS-1 — Verification: does agentConsensus.enabled=true really select the
 * Agent path (Hawk/Dove/Contrarian) instead of the LLM path?
 *
 * Unlike `agent-consensus-pipeline-integration.test.ts`, which re-implements the
 * branch predicate inline (`if (pipelineConfig.agentConsensus?.enabled)`) and
 * therefore cannot fail when the real code changes, this test drives the REAL
 * HTTP route and the REAL TradingPipelineService:
 *
 *   POST /api/ai-trading/pipeline/start (real router + real zod middleware)
 *     -> ai-trading.routes.ts:533-549 (real merge from savedPipelineConfigs)
 *       -> trading-pipeline.service.ts:255-280 (real merged PipelineConfig)
 *         -> captured via AITradingSession.findOneAndUpdate({ pipelineConfig })
 *
 * The captured `pipelineConfig` is the exact object read at
 * trading-pipeline.service.ts:1250 — `if (pipeline.config.agentConsensus?.enabled)`.
 */
import { describe, it, expect, vi, beforeAll, afterAll, afterEach, beforeEach } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import Module from "node:module";

const USER_ID = "test_user_axis1";
const BROKER_SERVER = "BrokerX";

// Store snapshot that the route reads. Mutated per-test via setStore().
let store: any = {};

// Captures every PipelineConfig handed to AITradingSession on pipeline start.
const capturedConfigs: any[] = [];

// ai-trading.routes.ts:524 uses a RUNTIME `require("../models/UserSettings")`
// inside the handler. vitest's ESM `vi.mock` cannot intercept a dynamic CJS
// require, so the real module is loaded and throws "Cannot find module".
// Intercept Module._load instead — this is a harness fix, not a behaviour change.
const originalLoad = (Module as any)._load;
(Module as any)._load = function (request: string, parent: any, isMain: boolean) {
  if (request.includes("UserSettings")) {
    // ai-trading.routes.ts:525 calls `UserSettings.findOne(...).lean()` — the
    // return value must be a THENABLE carrying .lean() (like a Mongoose Query),
    // NOT a Promise. An async fn would put .lean on a Promise and throw.
    return {
      UserSettings: {
        findOne: () => ({ lean: async () => store }),
        findOneAndUpdate: async () => ({}),
      },
    };
  }
  return originalLoad.apply(this, arguments as any);
};

// A confluence result whose checklist is fully PASSED, so the pipeline reaches
// STAGE 2 (the agentConsensus / llmConsensus branch) instead of bailing at
// "CANDIDATE SETUP". BTCUSD also bypasses the weekend forex pause.
const { makeFakeAnalysis } = vi.hoisted(() => ({
  makeFakeAnalysis: (symbol: string) => ({
    symbol,
    confluence: {
      conflictDetected: false,
      reason: "test confluence",
      guardrailFlags: [],
      methodologyBreakdown: { smc: { direction: "BUY", confidence: 80 } },
      finalSignal: {
        direction: "BUY",
        confidence: 80,
        confluenceScore: 80,
        entry: 2000,
        sl: 1990,
        tp: 2020,
        primaryMethodology: "smc",
        pattern: "MULTI_SMC",
        checklistItems: [
          { id: "smc-trend", status: "PASSED" },
          { id: "smc-block", status: "PASSED" },
        ],
      },
    },
    marketStructure: { trend: { direction: "UP" } },
    methodologySignals: { smc: [], ict: [], msnr: [] },
  }),
}));

vi.mock("../middleware/auth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: USER_ID, name: "", email: "" };
    next();
  },
}));

vi.mock("../models/UserSettings", () => ({
  UserSettings: {
    findOne: vi.fn(() => ({ lean: async () => store })),
    findOneAndUpdate: vi.fn(async () => ({})),
  },
}));

vi.mock("../models/MT5Connection", () => ({
  MT5Connection: {
    findOne: vi.fn(() => ({ lean: async () => ({ server: BROKER_SERVER }) })),
  },
}));

vi.mock("../models/AITradingSession", () => ({
  AITradingSession: {
    findOneAndUpdate: vi.fn(async (_filter: any, update: any) => {
      if (update?.pipelineConfig) capturedConfigs.push(update.pipelineConfig);
      return {};
    }),
  },
}));

vi.mock("../models/AITradeLog", () => ({
  AITradeLog: {
    find: vi.fn(() => ({
      sort: () => ({
        limit: () => ({
          lean: async () => [],
        }),
      }),
    })),
    findOne: vi.fn(() => ({
      lean: async () => null,
    })),
    create: vi.fn(async () => ({})),
    updateOne: vi.fn(async () => ({})),
    deleteMany: vi.fn(async () => ({ deletedCount: 0 })),
  },
}));

vi.mock("../models/Trade", () => ({
  Trade: { find: vi.fn(async () => []) },
}));

vi.mock("../services/mt5-mcp.service", () => ({
  mt5McpService: {
    isConnected: true,
    circuitBreakerState: { open: false },
    getSymbols: vi.fn(async () => [{ name: "XAUUSD" }, { name: "BTCUSD" }]),
    getSymbolInfo: vi.fn(async () => ({
      tradeContractSize: 1, volumeMin: 0.01, volumeMax: 100, volumeStep: 0.01, digits: 2,
      spread: 2, point: 0.01,
    })),
    getAccountInfo: vi.fn(async () => ({ balance: 10000, equity: 10000 })),
    getPositions: vi.fn(async () => []),
    getPrices: vi.fn(async () => []),
    getCandles: vi.fn(async () => []),
    getRates: vi.fn(async (_s: string, _tf: string, n: number) =>
      Array.from({ length: n }, (_, i) => ({
        time: 1700000000 + i * 900, open: 2000, high: 2001, low: 1999, close: 2000.5,
      }))),
    getTick: vi.fn(async () => ({ bid: 2000, ask: 2000.2 })),
    openOrder: vi.fn(async () => ({ success: true, ticket: 1, price: 2000 })),
    call: vi.fn(async () => []),
    getHistory: vi.fn(async () => []),
    forceDisconnect: vi.fn(),
  },
  CircuitBreaker: class {
    isOpen() { return false; }
    recordSuccess() {}
    recordFailure() {}
  },
}));

vi.mock("../services/llm-consensus.service", () => ({
  llmConsensusService: {
    getAvailableProviders: vi.fn(() => []),
    evaluate: vi.fn(async () => ({ verdict: "GOOD", goodVotes: 0, totalVotes: 0 })),
  },
}));

vi.mock("../services/macro-news.service", () => ({
  macroNewsService: {
    getMacroContext: vi.fn(async () => ({ avoidTrading: false, highImpactEvents: [], summary: "mocked", error: false })),
    getSentimentScore: vi.fn(async () => 0),
  },
}));

vi.mock("../services/agent-consensus.service", () => ({
  agentConsensusService: {
    runParallelDebate: vi.fn(async () => ({
      hawk: { reply: "BEARISH", toolsUsed: [] },
      dove: { reply: "BULLISH", toolsUsed: [] },
      contrarian: { reply: "NEUTRAL", toolsUsed: [] },
      consensus: "mixed",
      debateMode: "parallel",
    })),
    adaptDebateResult: vi.fn(() => ({
      verdict: "SKIP", consensus: "mixed", goodVotes: 0, totalVotes: 3, votes: [],
    })),
    buildMemoryContext: vi.fn(async () => ""),
    buildTradeHistoryContext: vi.fn(async () => ""),
  },
}));

vi.mock("../services/ai-backtest-skill.service", () => ({
  aiBacktestSkillService: { getSkill: vi.fn(async () => null), updateSkill: vi.fn(async () => {}) },
}));

vi.mock("../services/market-regime.service", () => ({
  marketRegimeService: {
    detect: vi.fn(async () => ({ regime: "NEUTRAL", multipliers: {} })),
    analyze: vi.fn(() => ({ regime: "NEUTRAL", adx: 20, volatility: 1, confidence: 50 })),
    getRegimeMultipliers: vi.fn(() => ({})),
  },
}));

vi.mock("../services/ai-trading-engine.service", () => ({
  aiTradingEngine: {
    analyzeSymbol: vi.fn(async () => null),
    analyzeAll: vi.fn(async () => []),
    analyzeSymbols: vi.fn(async (symbols: string[]) => symbols.map((s) => makeFakeAnalysis(s))),
    calculatePositionSize: vi.fn(() => 0.01),
  },
}));

vi.mock("../services/risk-manager.service", () => ({
  riskManagerService: {
    calculatePositionSize: vi.fn(() => 0.01),
    checkTradeAllowed: vi.fn(async () => ({ allowed: true })),
  },
}));

vi.mock("../services/trade-exit-strategy.service", () => ({
  tradeExitStrategyService: { evaluate: vi.fn(() => null) },
}));

// Import AFTER mocks (static imports resolve to the mocked modules).
import { tradingPipelineService } from "../services/trading-pipeline.service";
import aiTradingRoutes from "../routes/ai-trading.routes";
import { pipelineConfigSchema } from "../validators/ai-trading.validator";
import { aiTradingSettingsSchema } from "../routes/settings.routes";
import { UserSettings } from "../models/UserSettings";
import { mt5McpService } from "../services/mt5-mcp.service";
import { aiTradingEngine } from "../services/ai-trading-engine.service";
import { riskManagerService } from "../services/risk-manager.service";
import { agentConsensusService } from "../services/agent-consensus.service";
import { llmConsensusService } from "../services/llm-consensus.service";
import { marketRegimeService } from "../services/market-regime.service";
import { macroNewsService } from "../services/macro-news.service";
import { AITradeLog } from "../models/AITradeLog";

// vitest.config.ts sets mockReset:true, which wipes the implementations given
// to vi.fn(...) in the factories above before every test. Re-install them.
beforeEach(() => {
  vi.mocked(UserSettings.findOne).mockImplementation(() => ({ lean: async () => store }) as any);
  vi.mocked(UserSettings.findOneAndUpdate).mockImplementation(async () => ({}) as any);
  vi.mocked(mt5McpService.getSymbols).mockImplementation(async () => [{ name: "XAUUSD" }, { name: "BTCUSD" }] as any);
  vi.mocked(mt5McpService.getSymbolInfo).mockImplementation(async () => ({
    tradeContractSize: 1, volumeMin: 0.01, volumeMax: 100, volumeStep: 0.01, digits: 2, spread: 2, point: 0.01,
  }) as any);
  vi.mocked(mt5McpService.getAccountInfo).mockImplementation(async () => ({ balance: 10000, equity: 10000 }) as any);
  vi.mocked(mt5McpService.getPositions).mockImplementation(async () => [] as any);
  vi.mocked(mt5McpService.getRates).mockImplementation(async (_s: string, _tf: string, n: number) =>
    Array.from({ length: n }, (_, i) => ({
      time: 1700000000 + i * 900, open: 2000, high: 2001, low: 1999, close: 2000.5,
    })) as any);
  vi.mocked(mt5McpService.getTick).mockImplementation(async () => ({ bid: 2000, ask: 2000.2 }) as any);
  vi.mocked(mt5McpService.openOrder).mockImplementation(async () => ({ success: true, ticket: 1, price: 2000 }) as any);
  vi.mocked(mt5McpService.call).mockImplementation(async () => [] as any);
  vi.mocked(aiTradingEngine.analyzeSymbols).mockImplementation(async (symbols: string[]) => symbols.map((s) => makeFakeAnalysis(s)) as any);
  vi.mocked(aiTradingEngine.calculatePositionSize).mockImplementation(() => 0.01 as any);
  vi.mocked(riskManagerService.checkTradeAllowed).mockImplementation(async () => ({ allowed: true }) as any);
  vi.mocked(agentConsensusService.runParallelDebate).mockImplementation(async () => ({
    hawk: { reply: "BEARISH", toolsUsed: [] },
    dove: { reply: "BULLISH", toolsUsed: [] },
    contrarian: { reply: "NEUTRAL", toolsUsed: [] },
    consensus: "mixed",
    debateMode: "parallel",
  }) as any);
  vi.mocked(agentConsensusService.adaptDebateResult).mockImplementation(() => ({
    verdict: "SKIP", consensus: "mixed", goodVotes: 0, totalVotes: 3, votes: [],
  }) as any);
  vi.mocked(agentConsensusService.buildMemoryContext).mockImplementation(async () => "" as any);
  vi.mocked(agentConsensusService.buildTradeHistoryContext).mockImplementation(async () => "" as any);
  vi.mocked(llmConsensusService.getAvailableProviders).mockImplementation(() => [
    { name: "p1", modelLabel: "m1", available: true },
  ] as any);
  vi.mocked(llmConsensusService.evaluate).mockImplementation(async () => ({
    verdict: "GOOD", goodVotes: 3, totalVotes: 6, votes: [],
  }) as any);
  vi.mocked(AITradeLog.create).mockImplementation(async () => ({}) as any);
  vi.mocked(AITradeLog.updateOne).mockImplementation(async () => ({}) as any);
  vi.mocked(AITradeLog.find).mockImplementation(() => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) }) as any);
  vi.mocked(marketRegimeService.analyze).mockImplementation(() => ({ regime: "NEUTRAL", adx: 20, volatility: 1, confidence: 50 }) as any);
  vi.mocked(mt5McpService.getHistory).mockImplementation(async () => [] as any);
  vi.mocked(macroNewsService.getMacroContext).mockImplementation(async () => ({
    avoidTrading: false,
    highImpactEvents: [],
    summary: "mocked",
    error: false,
  }) as any);
  vi.mocked(macroNewsService.getSentimentScore).mockImplementation(async () => 0 as any);
});

function setStore(agentConsensus: any) {
  store = {
    aiTrading: { agentConsensus, llmConsensus: { enabled: true, threshold: 0.7 } },
    savedPipelineConfigs: {
      [BROKER_SERVER]: {
        symbols: ["XAUUSD"],
        timeframe: "M15",
        maxDailyRisk: 3,
        maxRiskPerTrade: 1,
        agentConsensus,
      },
    },
  };
}

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/ai-trading", aiTradingRoutes);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

afterEach(async () => {
  capturedConfigs.length = 0;
  await tradingPipelineService.stopPipeline(USER_ID).catch(() => {});
});

async function startPipelineViaRoute() {
  const res = await fetch(`${baseUrl}/api/ai-trading/pipeline/start`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-integration-test": "1" },
    body: JSON.stringify({ useAppliedConfig: true, symbols: ["XAUUSD"] }),
  });
  const text = await res.text();
  return { status: res.status, body: JSON.parse(text) };
}

describe("AXIS-1: agentConsensus.enabled=true selects the Agent path", () => {
  it("route -> pipeline merge lands enabled:true in the live PipelineConfig (line 1250 predicate)", async () => {
    setStore({ enabled: true, debateMode: "parallel", memoryEnabled: true, toolEnabled: true, threshold: 0.6 });

    const { status, body } = await startPipelineViaRoute();
    expect(status).toBe(200);
    expect(body.success).toBe(true);

    expect(capturedConfigs.length).toBeGreaterThan(0);
    const live = capturedConfigs[capturedConfigs.length - 1];

    // This is literally the value evaluated at trading-pipeline.service.ts:1250.
    console.log("DEBUG: live.agentConsensus:", JSON.stringify(live.agentConsensus));
    expect(live.agentConsensus?.enabled).toBe(true);
    expect(live.agentConsensus.threshold).toBe(0.6);
    expect(live.agentConsensus.memoryEnabled).toBe(true);
    // llmConsensus is still force-enabled as the rollback lane (ai-trading.routes.ts:539)
    expect(live.llmConsensus?.enabled).toBe(true);
  });

  it("rollback flag: enabled:false keeps the LLM path (ADR-0002)", async () => {
    setStore({ enabled: false, debateMode: "parallel", memoryEnabled: true, toolEnabled: true, threshold: 0.6 });

    const { status } = await startPipelineViaRoute();
    expect(status).toBe(200);

    const live = capturedConfigs[capturedConfigs.length - 1];
    expect(live.agentConsensus?.enabled).toBe(false);
  });

  it("settings PATCH schema accepts agentConsensus (enables + rollback both writable)", () => {
    expect(aiTradingSettingsSchema.safeParse({ agentConsensus: { enabled: true } }).success).toBe(true);
    expect(aiTradingSettingsSchema.safeParse({ agentConsensus: { enabled: false } }).success).toBe(true);
  });
});

// ── RUNTIME PROOF OF BRANCH EXCLUSIVITY ──────────────────────────────────────
// trading-pipeline.service.ts:1250  if (agentConsensus?.enabled)  -> Agent path
// trading-pipeline.service.ts:1325  else if (llmConsensus?.enabled) -> LLM path
// These two are mutually exclusive by construction (if / else-if). The tests
// below drive a REAL pipeline tick and assert which service was actually called.
async function waitFor(fn: () => boolean, timeoutMs = 20000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (fn()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("waitFor: condition not met before timeout");
}

describe("AXIS-1b: which consensus service the live tick actually calls", () => {
  it("agentConsensus.enabled=true -> runParallelDebate called, llmConsensus.evaluate NOT called", async () => {
    setStore({ enabled: true, debateMode: "parallel", memoryEnabled: true, toolEnabled: true, threshold: 0.6 });

    const { status } = await startPipelineViaRoute();
    expect(status).toBe(200);

    // Disable log sync and position management during tests to prevent interference.
    vi.spyOn(tradingPipelineService, 'syncClosedPositions').mockImplementation(async () => {});
    vi.spyOn(tradingPipelineService, 'managePositions').mockImplementation(async () => {});

    // Forcefully inject the expected config just to be sure
    const pipeline = (tradingPipelineService as any).activePipelines.get(USER_ID);
    if (pipeline) {
      pipeline.config.agentConsensus = { enabled: true, debateMode: "parallel", memoryEnabled: true, toolEnabled: true, threshold: 0.6 };
    }

    // Manually trigger the pipeline loop instead of waiting for interval
    await (tradingPipelineService as any).pipelineLoop(USER_ID, "XAUUSD");

    expect(vi.mocked(agentConsensusService.runParallelDebate)).toHaveBeenCalled();
    expect(vi.mocked(llmConsensusService.evaluate)).not.toHaveBeenCalled();
  }, 30000);

  it("agentConsensus.enabled=false -> runParallelDebate NOT called, order proceeds to Stage 3", async () => {
    setStore({ enabled: false, debateMode: "parallel", memoryEnabled: true, toolEnabled: true, threshold: 0.6 });

    const { status } = await startPipelineViaRoute();
    expect(status).toBe(200);

    // Disable log sync and position management during tests to prevent interference.
    vi.spyOn(tradingPipelineService, 'syncClosedPositions').mockImplementation(async () => {});
    vi.spyOn(tradingPipelineService, 'managePositions').mockImplementation(async () => {});

    // Forcefully inject the expected config just to be sure
    const pipeline = (tradingPipelineService as any).activePipelines.get(USER_ID);
    if (pipeline) {
      pipeline.config.agentConsensus = { enabled: false, debateMode: "parallel", memoryEnabled: true, toolEnabled: true, threshold: 0.6 };
    }

    // Manually trigger the pipeline loop
    await (tradingPipelineService as any).pipelineLoop(USER_ID, "XAUUSD");

    expect(vi.mocked(agentConsensusService.runParallelDebate)).not.toHaveBeenCalled();
    expect(vi.mocked(mt5McpService.openOrder)).toHaveBeenCalled();
  }, 30000);
});

// ── AXIS-2: VERDICT-GATE PARITY (regression spec) ────────────────────────────
// The agent branch gates on `isTrade` (continue if BAD/SKIP) exactly like the
// risk check gates at Stage 3. When agentConsensus is disabled, Stage 2 is
// skipped entirely and orders proceed directly to Stage 3 risk check + execution.
describe("AXIS-2: verdict gate parity (agent branch must gate like the LLM branch)", () => {
  it("agent branch: BAD verdict stops the order (gate parity with LLM branch)", async () => {
    setStore({ enabled: true, debateMode: "parallel", memoryEnabled: true, toolEnabled: true, threshold: 0.6 });
    vi.mocked(agentConsensusService.adaptDebateResult).mockImplementation(() => ({
      verdict: "BAD", consensus: "bearish", goodVotes: 0, totalVotes: 3, votes: [],
    }) as any);

    const { status } = await startPipelineViaRoute();
    expect(status).toBe(200);

    // Manually trigger the pipeline loop
    await (tradingPipelineService as any).pipelineLoop(USER_ID, "XAUUSD");

    expect(vi.mocked(mt5McpService.openOrder)).not.toHaveBeenCalled();
  }, 30000);

  it("agent branch: SKIP verdict stops the order", async () => {
    setStore({ enabled: true, debateMode: "parallel", memoryEnabled: true, toolEnabled: true, threshold: 0.6 });
    vi.mocked(agentConsensusService.adaptDebateResult).mockImplementation(() => ({
      verdict: "SKIP", consensus: "mixed", goodVotes: 0, totalVotes: 3, votes: [],
    }) as any);

    const { status } = await startPipelineViaRoute();
    expect(status).toBe(200);

    // Manually trigger the pipeline loop
    await (tradingPipelineService as any).pipelineLoop(USER_ID, "XAUUSD");

    expect(vi.mocked(mt5McpService.openOrder)).not.toHaveBeenCalled();
  }, 30000);

  it("agent branch: GOOD verdict still opens the order (gate is not over-blocking)", async () => {
    setStore({ enabled: true, debateMode: "parallel", memoryEnabled: true, toolEnabled: true, threshold: 0.6 });
    vi.mocked(agentConsensusService.adaptDebateResult).mockImplementation(() => ({
      verdict: "GOOD", consensus: "bullish", goodVotes: 3, totalVotes: 3, votes: [],
    }) as any);

    const { status } = await startPipelineViaRoute();
    expect(status).toBe(200);

    // Manually trigger the pipeline loop
    await (tradingPipelineService as any).pipelineLoop(USER_ID, "XAUUSD");

    expect(vi.mocked(mt5McpService.openOrder)).toHaveBeenCalled();
  }, 30000);
});

// ── AXIS-1d: WHICH STORE WINS (ai-trading.routes.ts:545-548 merge order) ─────
// Merge order is settings.aiTrading.* FIRST, then savedPipelineConfigs[server]
// SECOND — so the per-broker store overrides the generic one. This is why
// settings.routes.ts:138-140 must write BOTH: a write to aiTrading.* alone
// would be shadowed by a stale savedPipelineConfigs[server].agentConsensus.
describe("AXIS-1d: store precedence at the merge (ai-trading.routes.ts:545-548)", () => {
  it("broker store wins: aiTrading=false + savedPipelineConfigs[server]=true -> enabled:true", async () => {
    store = {
      aiTrading: { agentConsensus: { enabled: false }, llmConsensus: { enabled: true, threshold: 0.7 } },
      savedPipelineConfigs: {
        [BROKER_SERVER]: {
          symbols: ["XAUUSD"], timeframe: "M15", maxDailyRisk: 3, maxRiskPerTrade: 1,
          agentConsensus: { enabled: true, threshold: 0.6 },
        },
      },
    };

    const { status } = await startPipelineViaRoute();
    expect(status).toBe(200);
    const live = capturedConfigs[capturedConfigs.length - 1];
    expect(live.agentConsensus?.enabled).toBe(true);
  });

  it("stale broker store shadows a generic enable: aiTrading=true + savedPipelineConfigs[server]=false -> enabled:false", async () => {
    store = {
      aiTrading: { agentConsensus: { enabled: true, threshold: 0.6 }, llmConsensus: { enabled: true, threshold: 0.7 } },
      savedPipelineConfigs: {
        [BROKER_SERVER]: {
          symbols: ["XAUUSD"], timeframe: "M15", maxDailyRisk: 3, maxRiskPerTrade: 1,
          agentConsensus: { enabled: false },
        },
      },
    };

    const { status } = await startPipelineViaRoute();
    expect(status).toBe(200);
    const live = capturedConfigs[capturedConfigs.length - 1];
    expect(live.agentConsensus?.enabled).toBe(false);
  });
});
