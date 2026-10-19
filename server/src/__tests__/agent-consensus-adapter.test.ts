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
      hawk: { reply: "BULLISH trend with 90% confidence", toolsUsed: [] },
      dove: { reply: "BULLISH breakout, 85% sure", toolsUsed: [] },
      contrarian: { reply: "NEUTRAL: wait", toolsUsed: [] },
      consensus: "CONSENSUS: BULLISH",
      debateMode: "parallel" as const,
    };

    const result = (agentConsensusService as any).adaptDebateResult(debateResult);

    expect(result.verdict).toBe("GOOD");
    expect(result.goodVotes).toBeGreaterThanOrEqual(2);
  });

  it("should return BAD verdict for bearish consensus", () => {
    const debateResult = {
      hawk: { reply: "BEARISH reversal, 90% confidence", toolsUsed: [] },
      dove: { reply: "BEARISH continuation, 85% sure", toolsUsed: [] },
      contrarian: { reply: "NEUTRAL: wait", toolsUsed: [] },
      consensus: "CONSENSUS: BEARISH",
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

  // ── Weighted voting enforcement (ADR-0001) ──

  it("verdict must come from weighted votes, not the consensus text keywords", () => {
    // Consensus text screams "BULLISH with HIGH conviction", but votes are weak
    // (default 0.5): (0.5*1.5 + 0.5*1.0)/3.5 = 0.357 < 0.6 → SKIP.
    // Under the old keyword-matching implementation this returned GOOD.
    const result = (agentConsensusService as any).adaptDebateResult({
      hawk: { reply: "BULLISH", toolsUsed: [] },
      dove: { reply: "BULLISH", toolsUsed: [] },
      contrarian: { reply: "NEUTRAL", toolsUsed: [] },
      consensus: "CONSENSUS: BULLISH with HIGH conviction",
      debateMode: "parallel" as const,
    });

    expect(result.verdict).toBe("SKIP");
  });

  it("Hawk 1.5x weight is not enough alone to clear the threshold", () => {
    // Only hawk is directional at 0.9: bearish = 0.9*1.5/3.5 = 0.386 < 0.6.
    const below = (agentConsensusService as any).adaptDebateResult({
      hawk: { reply: "BEARISH, 90%", toolsUsed: [] },
      dove: { reply: "NEUTRAL", toolsUsed: [] },
      contrarian: { reply: "NEUTRAL", toolsUsed: [] },
      consensus: "BEARISH",
      debateMode: "parallel" as const,
    });
    expect(below.verdict).toBe("SKIP");

    // hawk 1.0 + dove 0.9: bearish = (1.0*1.5 + 0.9*1.0)/3.5 = 0.686 >= 0.6.
    const above = (agentConsensusService as any).adaptDebateResult({
      hawk: { reply: "BEARISH, 100%", toolsUsed: [] },
      dove: { reply: "BEARISH, 90%", toolsUsed: [] },
      contrarian: { reply: "NEUTRAL", toolsUsed: [] },
      consensus: "BEARISH",
      debateMode: "parallel" as const,
    });
    expect(above.verdict).toBe("BAD");
  });

  it("custom threshold overrides the 0.6 default", () => {
    // Weak votes: bullish = 0.357 → SKIP at 0.6, GOOD at 0.3.
    const debateResult = {
      hawk: { reply: "BULLISH", toolsUsed: [] },
      dove: { reply: "BULLISH", toolsUsed: [] },
      contrarian: { reply: "NEUTRAL", toolsUsed: [] },
      consensus: "BULLISH",
      debateMode: "parallel" as const,
    };

    const strict = (agentConsensusService as any).adaptDebateResult(debateResult, 0.6);
    const loose = (agentConsensusService as any).adaptDebateResult(debateResult, 0.3);

    expect(strict.verdict).toBe("SKIP");
    expect(loose.verdict).toBe("GOOD");
  });

  it("handles empty replies without throwing", () => {
    const result = (agentConsensusService as any).adaptDebateResult({
      hawk: { reply: "", toolsUsed: [] },
      dove: { reply: "", toolsUsed: [] },
      contrarian: { reply: "", toolsUsed: [] },
      consensus: "",
      debateMode: "parallel" as const,
    });

    expect(result.verdict).toBe("SKIP");
    expect(result.totalVotes).toBe(3);
  });
});
