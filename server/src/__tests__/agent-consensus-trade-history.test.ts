/**
 * Task 1.4: Trade History Link — TDD Test
 * 
 * Verifies that AgentConsensusService fetches and formats trade history:
 * - Fetches recent AITradeLog from MongoDB
 * - Builds trade summary (winRate, avgProfit, patterns)
 * - Injects as "past performance evidence" into agent context
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

vi.mock("../models/AITradeLog", () => ({
  AITradeLog: {
    find: vi.fn(),
  },
}));

vi.mock("../agents/specific.agents", () => ({
  HawkAgent: class {
    name = "Hawk"; personaId = "hawk"; systemPrompt = "";
    async think() { return { reply: "", toolsUsed: [] }; }
  },
  DoveAgent: class {
    name = "Dove"; personaId = "dove"; systemPrompt = "";
    async think() { return { reply: "", toolsUsed: [] }; }
  },
  ContrarianAgent: class {
    name = "Contrarian"; personaId = "contrarian"; systemPrompt = "";
    async think() { return { reply: "", toolsUsed: [] }; }
  },
}));

vi.mock("../services/tool-registry.service", () => ({
  toolRegistryService: {
    runToolsForPrompt: vi.fn().mockResolvedValue({ enrichedContext: {}, toolsUsed: [] }),
  },
}));

import { agentConsensusService } from "../services/agent-consensus.service";
import { AITradeLog } from "../models/AITradeLog";

describe("Task 1.4: Trade History Link", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should fetch recent trades and build summary", async () => {
    // Real AITradeLog shape: symbol/direction/entry nested under `signal`,
    // P&L in `pnl` (there is no top-level `profit` field).
    const mockTrades = [
      { signal: { symbol: "EURUSD", direction: "BUY", entry: 1.085 }, pnl: 100, createdAt: new Date() },
      { signal: { symbol: "GBPUSD", direction: "SELL", entry: 1.265 }, pnl: -50, createdAt: new Date() },
      { signal: { symbol: "EURUSD", direction: "BUY", entry: 1.087 }, pnl: 75, createdAt: new Date() },
    ];

    (AITradeLog.find as any).mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(mockTrades),
    });

    const result = await (agentConsensusService as any).buildTradeHistoryContext("user_123");

    expect(result).toBeDefined();
    expect(typeof result).toBe("string");
    expect(result).toContain("3"); // total trades
    expect(result).toContain("67"); // winRate (2/3 = 67%)
  });

  it("should handle empty trade history gracefully", async () => {
    (AITradeLog.find as any).mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    });

    const result = await (agentConsensusService as any).buildTradeHistoryContext("new_user");

    expect(result).toBeDefined();
    expect(typeof result).toBe("string");
    expect(result.toLowerCase()).toContain("belum");
  });

  it("should include win rate and profit metrics", async () => {
    const mockTrades = [
      { signal: { symbol: "EURUSD", direction: "BUY", entry: 1.085 }, pnl: 200, createdAt: new Date() },
      { signal: { symbol: "EURUSD", direction: "SELL", entry: 1.087 }, pnl: -100, createdAt: new Date() },
    ];

    (AITradeLog.find as any).mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(mockTrades),
    });

    const result = await (agentConsensusService as any).buildTradeHistoryContext("user_123");

    expect(result).toContain("50"); // winRate (1/2 = 50%)
    expect(result).toContain("100"); // avgProfit ((200-100)/2 = 50, but total profit = 100)
  });
});
