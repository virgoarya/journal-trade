/**
 * Task 1.1: Memory Integration — TDD Test
 * 
 * Verifies that AgentConsensusService builds persona-specific memory context:
 * - Hawk → risk preference, past stop-outs, liquidity sensitivity
 * - Dove → opportunity patterns, winning trades, momentum signals
 * - Contrarian → past consensus failures, anomaly detection
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock userMemoryService
vi.mock("../services/user-memory.service", () => ({
  userMemoryService: {
    getPromptContext: vi.fn(),
    getOrCreate: vi.fn(),
  },
}));

// Mock AgentInsight model
vi.mock("../models/AgentInsight", () => ({
  AgentInsight: {
    create: vi.fn(),
    find: vi.fn(),
  },
}));

import { agentConsensusService } from "../services/agent-consensus.service";
import { userMemoryService } from "../services/user-memory.service";

describe("Task 1.1: Memory Integration — buildMemoryContext", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should build memory context for Hawk persona (risk-focused)", async () => {
    const mockMemory = {
      userId: "user_123",
      name: "Bang Vir",
      learnedFacts: [
        { date: new Date(), fact: "Risk tolerance conservative" },
        { date: new Date(), fact: "Prefers tight stop losses" },
      ],
      agentMemories: [
        {
          personaId: "hawk",
          facts: [
            { date: new Date(), fact: "Previous stop-out at 2% drawdown", category: "market_insight" },
            { date: new Date(), fact: "Liquidity sensitivity high during Fed meetings", category: "user_preference" },
          ],
        },
      ],
      interactionCount: 15,
    };

    (userMemoryService.getOrCreate as any).mockResolvedValue(mockMemory);

    const context = await (agentConsensusService as any).buildMemoryContext("user_123", "hawk");

    expect(context).toBeDefined();
    expect(typeof context).toBe("string");
    // Hawk should get risk-related memory
    expect(context.toLowerCase()).toContain("risiko");
    expect(context.toLowerCase()).toContain("stop-out");
    expect(context.toLowerCase()).toContain("likuiditas");
  });

  it("should build memory context for Dove persona (opportunity-focused)", async () => {
    const mockMemory = {
      userId: "user_123",
      name: "Bang Vir",
      learnedFacts: [
        { date: new Date(), fact: "Prefers momentum trading" },
        { date: new Date(), fact: "Wins trending markets" },
      ],
      agentMemories: [
        {
          personaId: "dove",
          facts: [
            { date: new Date(), fact: "Previous win in trending EURUSD", category: "market_insight" },
            { date: new Date(), fact: "Good at identifying breakouts", category: "user_preference" },
          ],
        },
      ],
      interactionCount: 20,
    };

    (userMemoryService.getOrCreate as any).mockResolvedValue(mockMemory);

    const context = await (agentConsensusService as any).buildMemoryContext("user_123", "dove");

    expect(context).toBeDefined();
    expect(typeof context).toBe("string");
    // Dove should get opportunity-related memory
    expect(context.toLowerCase()).toContain("peluang");
    expect(context.toLowerCase()).toContain("breakout");
  });

  it("should build memory context for Contrarian persona (skeptic-focused)", async () => {
    const mockMemory = {
      userId: "user_123",
      name: "Bang Vir",
      learnedFacts: [
        { date: new Date(), fact: "Often disagrees with consensus" },
      ],
      agentMemories: [
        {
          personaId: "contrarian",
          facts: [
            { date: new Date(), fact: "Previous consensus failed during reversal", category: "market_insight" },
          ],
        },
      ],
      interactionCount: 10,
    };

    (userMemoryService.getOrCreate as any).mockResolvedValue(mockMemory);

    const context = await (agentConsensusService as any).buildMemoryContext("user_123", "contrarian");

    expect(context).toBeDefined();
    expect(typeof context).toBe("string");
    // Contrarian should get skeptic-related memory
    expect(context.toLowerCase()).toContain("skeptis");
    expect(context.toLowerCase()).toContain("konsensus");
  });

  it("should return empty context when no memory exists", async () => {
    (userMemoryService.getOrCreate as any).mockResolvedValue({
      userId: "new_user",
      name: "",
      learnedFacts: [],
      agentMemories: [],
      interactionCount: 0,
    });

    const context = await (agentConsensusService as any).buildMemoryContext("new_user", "hawk");

    expect(context).toBeDefined();
    expect(typeof context).toBe("string");
    // Should return a minimal context, not throw
  });

  it("should include persona-specific instructions", async () => {
    const mockMemory = {
      userId: "user_123",
      name: "Bang Vir",
      learnedFacts: [],
      agentMemories: [],
      interactionCount: 5,
    };

    (userMemoryService.getOrCreate as any).mockResolvedValue(mockMemory);

    const hawkContext = await (agentConsensusService as any).buildMemoryContext("user_123", "hawk");
    const doveContext = await (agentConsensusService as any).buildMemoryContext("user_123", "dove");
    const contrarianContext = await (agentConsensusService as any).buildMemoryContext("user_123", "contrarian");

    // Each persona should get different instructions
    expect(hawkContext).not.toBe(doveContext);
    expect(doveContext).not.toBe(contrarianContext);
    expect(hawkContext).not.toBe(contrarianContext);
  });
});
