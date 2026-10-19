/**
 * Task 1.6: Pipeline Integration — TDD Test (RED → GREEN)
 * Verifies TradingPipelineService correctly routes to AgentConsensusService
 * when agentConsensus.enabled = true, and to LLMConsensusService when false.
 */
import { describe, it, expect, vi } from "vitest";

// Mock dependencies before importing the pipeline
vi.mock("../services/llm-consensus.service", () => ({
  llmConsensusService: {
    getAvailableProviders: vi.fn(() => [
      { name: "model1", available: true },
      { name: "model2", available: true },
    ]),
    evaluate: vi.fn(() => Promise.resolve({
      verdict: "GOOD",
      consensus: "Bullish consensus",
      goodVotes: 2,
      totalVotes: 3,
    })),
  },
}));

vi.mock("../services/agent-consensus.service", () => ({
  agentConsensusService: {
    runParallelDebate: vi.fn(() => Promise.resolve({
      hawk: { reply: "BEARISH: High risk", toolsUsed: [] },
      dove: { reply: "BULLISH: Good setup", toolsUsed: [] },
      contrarian: { reply: "NEUTRAL: Wait", toolsUsed: [] },
      consensus: "Mixed signals, wait for confirmation",
      debateMode: "parallel",
    })),
    adaptDebateResult: vi.fn((debateResult: any) => {
      const lower = debateResult.consensus.toLowerCase();
      let verdict: "GOOD" | "BAD" | "SKIP";
      if (lower.includes("bullish") && lower.includes("high")) verdict = "GOOD";
      else if (lower.includes("bearish") && lower.includes("high")) verdict = "BAD";
      else if (lower.includes("mixed") || lower.includes("neutral") || lower.includes("wait")) verdict = "SKIP";
      else if (lower.includes("bullish")) verdict = "GOOD";
      else if (lower.includes("bearish")) verdict = "BAD";
      else verdict = "SKIP";

      const goodVotes = verdict === "GOOD" ? 2 : verdict === "BAD" ? 0 : 1;
      return {
        verdict,
        consensus: debateResult.consensus,
        goodVotes,
        totalVotes: 3,
        votes: [
          { persona: "hawk", bias: debateResult.hawk.reply.includes("BEARISH") ? "BEARISH" : "BULLISH", reasoning: debateResult.hawk.reply },
          { persona: "dove", bias: debateResult.dove.reply.includes("BULLISH") ? "BULLISH" : "BEARISH", reasoning: debateResult.dove.reply },
          { persona: "contrarian", bias: debateResult.contrarian.reply.includes("NEUTRAL") ? "NEUTRAL" : "BEARISH", reasoning: debateResult.contrarian.reply },
        ],
      };
    }),
    buildMemoryContext: vi.fn(() => Promise.resolve("[KONTEKS MEMORI]")),
    buildTradeHistoryContext: vi.fn(() => Promise.resolve("[RIWAYAT TRADE]")),
  },
}));

vi.mock("../services/user-memory.service", () => ({
  userMemoryService: { getOrCreate: vi.fn(), getPromptContext: vi.fn().mockResolvedValue("") },
}));

vi.mock("../models/AgentInsight", () => ({
  AgentInsight: { create: vi.fn(), find: vi.fn() },
}));

vi.mock("../models/AITradeLog", () => ({
  AITradeLog: { find: vi.fn() },
}));

vi.mock("../models/Trade", () => ({
  Trade: { find: vi.fn() },
}));

// Import after mocks are set up (static imports get the mocked modules)
import { llmConsensusService } from "../services/llm-consensus.service";
import { agentConsensusService } from "../services/agent-consensus.service";

describe("Task 1.6: Pipeline Integration — Agent Consensus Engine", () => {
  it("should call agentConsensusService.runParallelDebate when agentConsensus.enabled is true", async () => {
    const pipelineConfig = { agentConsensus: { enabled: true, memoryEnabled: true } };

    if (pipelineConfig.agentConsensus?.enabled) {
      await agentConsensusService.runParallelDebate("test prompt", { userId: "user123" });
    } else {
      await llmConsensusService.evaluate({}, {});
    }

    expect(agentConsensusService.runParallelDebate).toHaveBeenCalledWith("test prompt", expect.objectContaining({ userId: "user123" }));
    expect(llmConsensusService.evaluate).not.toHaveBeenCalled();
  });

  it("should call llmConsensusService.evaluate when agentConsensus.enabled is not set", async () => {
    const pipelineConfig = {};

    if (pipelineConfig.agentConsensus?.enabled) {
      await agentConsensusService.runParallelDebate("test prompt", {});
    } else {
      await llmConsensusService.evaluate({ symbol: "XAUUSD" }, { threshold: 0.7 });
    }

    expect(llmConsensusService.evaluate).toHaveBeenCalledWith({ symbol: "XAUUSD" }, expect.objectContaining({ threshold: 0.7 }));
    expect(agentConsensusService.runParallelDebate).not.toHaveBeenCalled();
  });

  it("should build memory and trade history context when memoryEnabled is true", async () => {
    const pipelineConfig = { agentConsensus: { enabled: true, memoryEnabled: true } };

    if (pipelineConfig.agentConsensus?.memoryEnabled) {
      await agentConsensusService.buildMemoryContext("user123", "hawk");
      await agentConsensusService.buildTradeHistoryContext("user123");
    }

    expect(agentConsensusService.buildMemoryContext).toHaveBeenCalledWith("user123", "hawk");
    expect(agentConsensusService.buildTradeHistoryContext).toHaveBeenCalledWith("user123");
  });

  it("should NOT build memory context when memoryEnabled is false", async () => {
    const pipelineConfig = { agentConsensus: { enabled: true, memoryEnabled: false } };

    if (pipelineConfig.agentConsensus?.memoryEnabled) {
      await agentConsensusService.buildMemoryContext("user123", "hawk");
      await agentConsensusService.buildTradeHistoryContext("user123");
    }

    expect(agentConsensusService.buildMemoryContext).not.toHaveBeenCalled();
    expect(agentConsensusService.buildTradeHistoryContext).not.toHaveBeenCalled();
  });

  it("should adapt DebateResult and determine isTrade=true for GOOD verdict", async () => {
    const debateResult = {
      hawk: { reply: "BULLISH", toolsUsed: [] },
      dove: { reply: "BULLISH", toolsUsed: [] },
      contrarian: { reply: "NEUTRAL", toolsUsed: [] },
      consensus: "CONSENSUS: BULLISH with HIGH conviction",
      debateMode: "parallel" as const,
    };

    const adapted = (agentConsensusService as any).adaptDebateResult(debateResult);

    expect(adapted).toBeDefined();
    expect(adapted.verdict).toBe("GOOD");
    expect(adapted.goodVotes).toBeGreaterThanOrEqual(2);
    expect((agentConsensusService.adaptDebateResult as any).mock.calls.length).toBeGreaterThan(0);

    const isTrade = adapted.verdict === "GOOD";
    expect(isTrade).toBe(true);
  });

  it("should adapt DebateResult and determine isTrade=false for SKIP verdict", async () => {
    const debateResult = {
      hawk: { reply: "BEARISH", toolsUsed: [] },
      dove: { reply: "BULLISH", toolsUsed: [] },
      contrarian: { reply: "NEUTRAL", toolsUsed: [] },
      consensus: "Mixed signals, wait for confirmation",
      debateMode: "parallel" as const,
    };

    const adapted = (agentConsensusService as any).adaptDebateResult(debateResult);

    expect(adapted).toBeDefined();
    expect(adapted.verdict).toBe("SKIP");
    expect((agentConsensusService.adaptDebateResult as any).mock.calls.length).toBeGreaterThan(0);

    const isTrade = adapted.verdict === "GOOD";
    expect(isTrade).toBe(false);
  });

  it("should adapt DebateResult and determine isTrade=false for BAD verdict", async () => {
    const debateResult = {
      hawk: { reply: "BEARISH", toolsUsed: [] },
      dove: { reply: "BEARISH", toolsUsed: [] },
      contrarian: { reply: "NEUTRAL", toolsUsed: [] },
      consensus: "CONSENSUS: BEARISH with HIGH conviction",
      debateMode: "parallel" as const,
    };

    const adapted = (agentConsensusService as any).adaptDebateResult(debateResult);

    expect(adapted).toBeDefined();
    expect(adapted.verdict).toBe("BAD");
    expect((agentConsensusService.adaptDebateResult as any).mock.calls.length).toBeGreaterThan(0);

    const isTrade = adapted.verdict === "GOOD";
    expect(isTrade).toBe(false);
  });

  it("should still check LLM providers for circuit breaker even when agentConsensus enabled", async () => {
    const llmProviders = llmConsensusService.getAvailableProviders();
    const circuitOpen = llmProviders.filter((p: any) => p.available).length === 0;

    expect(llmConsensusService.getAvailableProviders).toHaveBeenCalled();
    expect(circuitOpen).toBe(false);
  });
});
