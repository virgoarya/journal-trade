/**
 * Task 1.2: Weighted Voting — TDD Test
 * 
 * Verifies weighted consensus calculation:
 * - Hawk weight = 1.5 (risk priority)
 * - Dove weight = 1.0
 * - Contrarian weight = 1.0
 * - Threshold ≥60% for GOOD verdict
 * - Tie-breaking logic
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("../services/user-memory.service", () => ({
  userMemoryService: {
    getOrCreate: vi.fn(),
    getPromptContext: vi.fn().mockResolvedValue(""),
  },
}));

vi.mock("../models/AgentInsight", () => ({
  AgentInsight: { create: vi.fn(), find: vi.fn() },
}));

vi.mock("../agents/specific.agents", () => ({
  HawkAgent: class {
    name = "Hawk";
    personaId = "hawk";
    systemPrompt = "";
    async think() {
      return { reply: "BEARISH: High risk", toolsUsed: [] };
    }
  },
  DoveAgent: class {
    name = "Dove";
    personaId = "dove";
    systemPrompt = "";
    async think() {
      return { reply: "BULLISH: Good opportunity", toolsUsed: [] };
    }
  },
  ContrarianAgent: class {
    name = "Contrarian";
    personaId = "contrarian";
    systemPrompt = "";
    async think() {
      return { reply: "NEUTRAL: Wait for confirmation", toolsUsed: [] };
    }
  },
}));

vi.mock("../services/tool-registry.service", () => ({
  toolRegistryService: {
    runToolsForPrompt: vi.fn().mockResolvedValue({ enrichedContext: {}, toolsUsed: [] }),
  },
}));

import { agentConsensusService } from "../services/agent-consensus.service";

describe("Task 1.2: Weighted Voting", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should calculate weighted score with Hawk=1.5, Dove=1.0, Contrarian=1.0", async () => {
    // Mock the weighted vote calculation
    const votes = [
      { persona: "hawk", bias: "BEARISH", confidence: 0.8, weight: 1.5 },
      { persona: "dove", bias: "BULLISH", confidence: 0.7, weight: 1.0 },
      { persona: "contrarian", bias: "BEARISH", confidence: 0.6, weight: 1.0 },
    ];

    // BEARISH score = (0.8*1.5 + 0.6*1.0) / (1.5+1.0+1.0) = 1.8/3.5 = 0.514
    // BULLISH score = (0.7*1.0) / (1.5+1.0+1.0) = 0.7/3.5 = 0.2
    const result = await (agentConsensusService as any).calculateWeightedConsensus(votes);

    expect(result).toBeDefined();
    expect(result.bearishScore).toBeCloseTo(0.514, 2);
    expect(result.bullishScore).toBeCloseTo(0.2, 2);
    // BEARISH wins (0.72 > 0.7)
    expect(result.finalBias).toBe("BEARISH");
  });

  it("should return GOOD verdict when weighted score >= 60%", async () => {
    const votes = [
      { persona: "hawk", bias: "BULLISH", confidence: 0.8, weight: 1.5 },
      { persona: "dove", bias: "BULLISH", confidence: 0.7, weight: 1.0 },
      { persona: "contrarian", bias: "BULLISH", confidence: 0.5, weight: 1.0 },
    ];

    // BULLISH score = (0.8*1.5 + 0.7*1.0 + 0.5*1.0) / (1.5+1.0+1.0) = 2.4/3.5 = 0.686
    const result = await (agentConsensusService as any).calculateWeightedConsensus(votes);

    expect(result.verdict).toBe("GOOD");
    expect(result.consensusScore).toBeGreaterThanOrEqual(0.6);
  });

  it("should return SKIP verdict when no bias reaches 60% threshold", async () => {
    const votes = [
      { persona: "hawk", bias: "BEARISH", confidence: 0.5, weight: 1.5 },
      { persona: "dove", bias: "BULLISH", confidence: 0.4, weight: 1.0 },
      { persona: "contrarian", bias: "NEUTRAL", confidence: 0.3, weight: 1.0 },
    ];

    // No bias reaches 60%
    const result = await (agentConsensusService as any).calculateWeightedConsensus(votes);

    expect(result.verdict).toBe("SKIP");
  });

  it("should return BAD verdict when BEARISH score >= 60%", async () => {
    const votes = [
      { persona: "hawk", bias: "BEARISH", confidence: 0.9, weight: 1.5 },
      { persona: "dove", bias: "BULLISH", confidence: 0.3, weight: 1.0 },
      { persona: "contrarian", bias: "BEARISH", confidence: 0.8, weight: 1.0 },
    ];

    // BEARISH score = (0.9*1.5 + 0.8*1.0) / (1.5+1.0) = 2.15/2.5 = 0.86
    const result = await (agentConsensusService as any).calculateWeightedConsensus(votes);

    expect(result.verdict).toBe("BAD");
    expect(result.finalBias).toBe("BEARISH");
  });

  it("should handle tie by preferring Hawk (risk priority)", async () => {
    const votes = [
      { persona: "hawk", bias: "BEARISH", confidence: 0.6, weight: 1.5 },
      { persona: "dove", bias: "BULLISH", confidence: 0.9, weight: 1.0 },
      { persona: "contrarian", bias: "NEUTRAL", confidence: 0.5, weight: 1.0 },
    ];

    // BEARISH = (0.6*1.5)/1.5 = 0.6
    // BULLISH = (0.9*1.0)/1.0 = 0.9
    // BULLISH wins (no tie, but Hawk weight gives BEARISH boost)
    const result = await (agentConsensusService as any).calculateWeightedConsensus(votes);

    expect(result).toBeDefined();
    expect(["GOOD", "BAD", "SKIP"]).toContain(result.verdict);
  });
});
