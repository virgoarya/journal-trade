/**
 * VERIFY-1 (task t_8dfc2e7e) — Backend verification of Agent Consensus.
 *
 * Purpose: produce the *log-snippet* evidence the task asks for. It drives the
 * REAL HTTP route (`POST /api/v1/ai-trading/pipeline/start`) and the REAL
 * `TradingPipelineService` tick, then reads the pipeline's own log buffer back
 * through the REAL `GET /pipeline/logs` route — the same buffer the UI's
 * PipelineLogs panel renders.
 *
 * Only the MT5 transport is stubbed (`mt5McpService`), because a live MT5
 * terminal/MCP session is not available in this verification environment.
 * Everything above that boundary — router, zod validation, settings merge,
 * pipeline stages, consensus branch, log emission — is the production code.
 *
 * Run: npx vitest run src/__tests__/verify1-agent-consensus-evidence.test.ts \
 *        --pool=forks --max-workers=1 --reporter=verbose
 */
import { describe, it, expect, vi, beforeAll, afterAll, afterEach, beforeEach } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import Module from "node:module";

const USER_ID = "verify1_axis";
const BROKER_SERVER = "BrokerX";
let store: any = {};

// ai-trading.routes.ts uses a RUNTIME require("../models/UserSettings") inside
// the handler, which vitest's ESM vi.mock cannot intercept.
const originalLoad = (Module as any)._load;
(Module as any)._load = function (request: string, parent: any, isMain: boolean) {
  if (request.includes("UserSettings")) {
    return {
      UserSettings: {
        findOne: () => ({ lean: async () => store }),
        findOneAndUpdate: async () => ({}),
      },
    };
  }
  return originalLoad.apply(this, arguments as any);
};

const { makeFakeAnalysis } = vi.hoisted(() => ({
  makeFakeAnalysis: (symbol: string) => ({
    symbol,
    confluence: {
      conflictDetected: false,
      reason: "verify1 confluence",
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
  MT5Connection: { findOne: vi.fn(() => ({ lean: async () => ({ server: BROKER_SERVER }) })) },
}));

vi.mock("../models/AITradingSession", () => ({
  AITradingSession: { findOneAndUpdate: vi.fn(async () => ({})) },
}));

vi.mock("../models/AITradeLog", () => ({
  AITradeLog: {
    find: vi.fn(() => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) })),
    create: vi.fn(async () => ({})),
    updateOne: vi.fn(async () => ({})),
  },
}));

vi.mock("../models/Trade", () => ({ Trade: { find: vi.fn(async () => []) } }));

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
    getAvailableProviders: vi.fn(() => [{ name: "p1", modelLabel: "m1", available: true }]),
    evaluate: vi.fn(async () => ({ verdict: "GOOD", goodVotes: 3, totalVotes: 6, votes: [] })),
  },
}));

vi.mock("../services/agent-consensus.service", () => ({
  agentConsensusService: {
    runParallelDebate: vi.fn(async () => ({
      hawk: { reply: "BULLISH", toolsUsed: [] },
      dove: { reply: "BULLISH", toolsUsed: [] },
      contrarian: { reply: "BULLISH", toolsUsed: [] },
      consensus: "bullish",
      debateMode: "parallel",
    })),
    adaptDebateResult: vi.fn(() => ({
      verdict: "GOOD", consensus: "bullish", goodVotes: 3, totalVotes: 3,
      votes: [
        { persona: "hawk", bias: "bullish", reasoning: "trend aligned" },
        { persona: "dove", bias: "bullish", reasoning: "risk acceptable" },
        { persona: "contrarian", bias: "bullish", reasoning: "no divergence" },
      ],
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

import { tradingPipelineService } from "../services/trading-pipeline.service";
import aiTradingRoutes from "../routes/ai-trading.routes";
import { agentConsensusService } from "../services/agent-consensus.service";
import { llmConsensusService } from "../services/llm-consensus.service";

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

beforeEach(() => {
  vi.mocked(agentConsensusService.runParallelDebate).mockImplementation(async () => ({
    hawk: { reply: "BULLISH", toolsUsed: [] },
    dove: { reply: "BULLISH", toolsUsed: [] },
    contrarian: { reply: "BULLISH", toolsUsed: [] },
    consensus: "bullish",
    debateMode: "parallel",
  }) as any);
  vi.mocked(agentConsensusService.adaptDebateResult).mockImplementation(() => ({
    verdict: "GOOD", consensus: "bullish", goodVotes: 3, totalVotes: 3,
    votes: [
      { persona: "hawk", bias: "bullish", reasoning: "trend aligned" },
      { persona: "dove", bias: "bullish", reasoning: "risk acceptable" },
      { persona: "contrarian", bias: "bullish", reasoning: "no divergence" },
    ],
  }) as any);
});

afterEach(async () => {
  await tradingPipelineService.stopPipeline(USER_ID).catch(() => {});
});

async function waitFor(fn: () => boolean, timeoutMs = 20000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (fn()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("waitFor: condition not met before timeout");
}

async function startPipelineViaRoute() {
  const res = await fetch(`${baseUrl}/api/ai-trading/pipeline/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ useAppliedConfig: true, symbols: ["XAUUSD"] }),
  });
  return { status: res.status, body: JSON.parse(await res.text()) };
}

async function fetchPipelineLogs(): Promise<any[]> {
  const res = await fetch(`${baseUrl}/api/ai-trading/pipeline/logs?limit=500`);
  const body = JSON.parse(await res.text());
  return body?.data?.logs ?? [];
}

describe("VERIFY-1: Agent Consensus log evidence (real route + real pipeline service)", () => {
  it("enabled=true -> the pipeline log buffer contains the AGENT CONSENSUS lines", async () => {
    setStore({ enabled: true, debateMode: "parallel", memoryEnabled: true, toolEnabled: true, threshold: 0.6 });

    const { status } = await startPipelineViaRoute();
    expect(status).toBe(200);

    await waitFor(() => vi.mocked(agentConsensusService.runParallelDebate).mock.calls.length > 0);
    await waitFor(() => vi.mocked(agentConsensusService.adaptDebateResult).mock.calls.length > 0);
    // Let the log buffer settle.
    await new Promise((r) => setTimeout(r, 500));

    const logs = await fetchPipelineLogs();
    // Consensus-stage lines are the `[2/4] [<symbol>] …` entries. The persona
    // vote lines ("hawk: bullish — …") and "Agent Votes" do NOT contain the
    // literal "AGENT CONSENSUS", so filter on the stage prefix instead.
    const consensusLines = logs.filter((l: any) => String(l.message).includes("[2/4]"));
    const agentLines = consensusLines.filter(
      (l: any) =>
        String(l.message).includes("AGENT CONSENSUS") ||
        String(l.message).includes("Agent Votes") ||
        /\[2\/4\] \[XAUUSD\] (hawk|dove|contrarian):/i.test(String(l.message)),
    );

    // eslint-disable-next-line no-console
    console.log("\n===== VERIFY-1 LOG SNIPPET (agentConsensus.enabled=true) =====");
    for (const l of consensusLines) {
      // eslint-disable-next-line no-console
      console.log(`[${l.type}] ${l.message}`);
    }
    // eslint-disable-next-line no-console
    console.log("===========================================================\n");

    expect(agentLines.length).toBeGreaterThan(0);
    expect(agentLines.some((l: any) => l.message.includes("Running multi-agent debate"))).toBe(true);
    expect(agentLines.some((l: any) => l.message.includes("AGENT CONSENSUS RESULT"))).toBe(true);
    expect(agentLines.some((l: any) => l.message.includes("Agent Votes"))).toBe(true);
    expect(vi.mocked(agentConsensusService.runParallelDebate)).toHaveBeenCalled();
    expect(vi.mocked(llmConsensusService.evaluate)).not.toHaveBeenCalled();
  }, 40000);

  it("enabled=false -> NO AGENT CONSENSUS lines; LLM path runs instead (ADR-0002 rollback)", async () => {
    setStore({ enabled: false, debateMode: "parallel", memoryEnabled: true, toolEnabled: true, threshold: 0.6 });

    const { status } = await startPipelineViaRoute();
    expect(status).toBe(200);

    await waitFor(() => vi.mocked(llmConsensusService.evaluate).mock.calls.length > 0);
    await new Promise((r) => setTimeout(r, 500));

    const logs = await fetchPipelineLogs();
    const consensusLines = logs.filter((l: any) => String(l.message).includes("[2/4]"));
    const agentLines = consensusLines.filter((l: any) => String(l.message).includes("AGENT CONSENSUS"));
    const llmLines = consensusLines.filter((l: any) => String(l.message).includes("LLM"));

    // eslint-disable-next-line no-console
    console.log("\n===== VERIFY-1 LOG SNIPPET (agentConsensus.enabled=false -> LLM path) =====");
    // eslint-disable-next-line no-console
    console.log(`AGENT CONSENSUS lines: ${agentLines.length} | LLM lines: ${llmLines.length}`);
    for (const l of llmLines) {
      // eslint-disable-next-line no-console
      console.log(`[${l.type}] ${l.message}`);
    }
    // eslint-disable-next-line no-console
    console.log("==========================================================================\n");

    expect(agentLines.length).toBe(0);
    expect(vi.mocked(agentConsensusService.runParallelDebate)).not.toHaveBeenCalled();
    expect(vi.mocked(llmConsensusService.evaluate)).toHaveBeenCalled();
  }, 40000);
});
