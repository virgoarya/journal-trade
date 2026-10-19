/**
 * Task 1.5: Adapter Layer — TDD Test
 * Verifies AgentConsensusService.adaptDebateResult() maps DebateResult → LLMConsensusResult
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/user-memory.service", () => ({
  userMemoryService: { getOrCreate: vi.fn(), getPromptContext: vi.fn().mockResolvedValue("") },
}));

vi.mock("../models/AgentInsight", () => ({
  AgentInsight: { create: vi.fn(), find: vi.fn() },
}));

vi.mock("../models/AITradeLog", () => ({
  AITradeLog: { find: vi.fn() },
}));

import { agentConsensusService } from "../services/agent-consensus.service";

describe("Task 1.5: Adapter Layer — adaptDebateResult", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should adapt DebateResult to LLMConsensusResult format", () => {
    const debateResult = {
      hawk: { reply: "BEARISH: High risk", toolsUsed: [] },
      dove: { reply: "BULLISH: Good setup", toolsUsed: [] },
      contrarian: { reply: "NEUTRAL: Wait", toolsUsed: [] },
      consensus: "Mixed signals, wait for confirmation",
      debateMode: "parallel" as const,
    };

    const result = (agentConsensusService as any).adaptDebateResult(debateResult);

    expect(result).toBeDefined();
    expect(result.verdict).toBe("SKIP");
    expect(result.consensus).toBe("Mixed signals, wait for confirmation");
    expect(result.goodVotes).toBeDefined();
    expect(result.totalVotes).toBe(3);
  });

  it("should return GOOD verdict for bullish consensus", () => {
    const debateResult = {
      hawk: { reply: "BULLISH", toolsUsed: [] },
      dove: { reply: "BULLISH", toolsUsed: [] },
      contrarian: { reply: "NEUTRAL", toolsUsed: [] },
      consensus: "CONSENSUS: BULLISH with HIGH conviction",
      debateMode: "parallel" as const,
    };

    const result = (agentConsensusService as any).adaptDebateResult(debateResult);

    expect(result.verdict).toBe("GOOD");
    expect(result.goodVotes).toBeGreaterThanOrEqual(2);
  });

  it("should return BAD verdict for bearish consensus", () => {
    const debateResult = {
      hawk: { reply: "BEARISH", toolsUsed: [] },
      dove: { reply: "BEARISH", toolsUsed: [] },
      contrarian: { reply: "NEUTRAL", toolsUsed: [] },
      consensus: "CONSENSUS: BEARISH with HIGH conviction",
      debateMode: "parallel" as const,
    };

    const result = (agentConsensusService as any).adaptDebateResult(debateResult);

    expect(result.verdict).toBe("BAD");
  });

  it("should include per-agent votes in result", () => {
    const debateResult = {
      hawk: { reply: "BEARISH: risk", toolsUsed: [] },
      dove: { reply: "BULLISH: opportunity", toolsUsed: [] },
      contrarian: { reply: "NEUTRAL: wait", toolsUsed: [] },
      consensus: "Mixed",
      debateMode: "parallel" as const,
    };

    const result = (agentConsensusService as any).adaptDebateResult(debateResult);

    expect(result.votes).toBeDefined();
    expect(result.votes).toHaveLength(3);
    expect(result.votes[0].persona).toBe("hawk");
    expect(result.votes[1].persona).toBe("dove");
    expect(result.votes[2].persona).toBe("contrarian");
  });
});
