/**
 * CODE-1 + CODE-2 regression tests (Sage findings #4 and #5)
 *
 * CODE-2 — buildMemoryContext must rank facts by confidence (ADR-0001
 *          "top-5 by confidence"), not by recency.
 * CODE-1 — runParallelDebate must give each persona its OWN memory block.
 *          Previously a single persona's memory was appended to the shared
 *          prompt, so Dove and Contrarian never saw their own memory.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { thinkCalls, mockGetOrCreate } = vi.hoisted(() => ({
  thinkCalls: [] as Array<{ persona: string; prompt: string }>,
  mockGetOrCreate: vi.fn(),
}));

vi.mock("../services/user-memory.service", () => ({
  userMemoryService: {
    getOrCreate: mockGetOrCreate,
    getPromptContext: vi.fn().mockResolvedValue(""),
  },
}));

vi.mock("../models/AgentInsight", () => ({
  AgentInsight: { create: vi.fn(), find: vi.fn() },
}));

vi.mock("../models/AITradeLog", () => ({
  AITradeLog: { find: vi.fn() },
}));

vi.mock("../services/tool-registry.service", () => ({
  toolRegistryService: {
    runToolsForPrompt: vi.fn().mockResolvedValue({ enrichedContext: {}, toolsUsed: [] }),
  },
}));

vi.mock("../agents/specific.agents", () => {
  const make = (persona: string) =>
    class {
      name = persona;
      personaId = persona;
      systemPrompt = "";
      async think(prompt: string) {
        thinkCalls.push({ persona, prompt });
        return { reply: `${persona} reply`, toolsUsed: [] };
      }
    };
  return {
    HawkAgent: make("hawk"),
    DoveAgent: make("dove"),
    ContrarianAgent: make("contrarian"),
  };
});

import { agentConsensusService } from "../services/agent-consensus.service";

const memoryWith = (over: Record<string, any> = {}) => ({
  userId: "u1",
  name: "Trader",
  preferences: {},
  learnedFacts: [],
  agentMemories: [],
  interactionCount: 0,
  ...over,
});

describe("CODE-2: buildMemoryContext ranks facts by confidence", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    thinkCalls.length = 0;
  });

  it("orders persona facts by confidence desc, not by recency", async () => {
    // Recency order is deliberately the reverse of confidence order.
    mockGetOrCreate.mockResolvedValue(
      memoryWith({
        agentMemories: [
          {
            personaId: "hawk",
            facts: [
              { fact: "HAWK-LOW", confidence: 0.1, date: new Date("2026-01-03") },
              { fact: "HAWK-MID", confidence: 0.5, date: new Date("2026-01-02") },
              { fact: "HAWK-TOP", confidence: 0.95, date: new Date("2026-01-01") },
            ],
          },
        ],
      })
    );

    const ctx = await agentConsensusService.buildMemoryContext("u1", "hawk");

    const iTop = ctx.indexOf("HAWK-TOP");
    const iMid = ctx.indexOf("HAWK-MID");
    const iLow = ctx.indexOf("HAWK-LOW");

    expect(iTop).toBeGreaterThan(-1);
    expect(iMid).toBeGreaterThan(-1);
    expect(iLow).toBeGreaterThan(-1);
    expect(iTop).toBeLessThan(iMid);
    expect(iMid).toBeLessThan(iLow);
  });

  it("keeps only the top 5 facts per bucket", async () => {
    const facts = Array.from({ length: 7 }, (_, i) => ({
      fact: `FACT-${i}`,
      confidence: i / 10, // FACT-6 highest … FACT-0 lowest
      date: new Date("2026-01-01"),
    }));
    mockGetOrCreate.mockResolvedValue(memoryWith({ learnedFacts: facts }));

    const ctx = await agentConsensusService.buildMemoryContext("u1", "hawk");

    // Top 5 = FACT-6..FACT-2 present; FACT-1 and FACT-0 dropped.
    expect(ctx).toContain("FACT-6");
    expect(ctx).toContain("FACT-2");
    expect(ctx).not.toContain("FACT-1");
    expect(ctx).not.toContain("FACT-0");
  });

  it("treats facts without confidence as neutral 0.5 (legacy rows survive)", async () => {
    mockGetOrCreate.mockResolvedValue(
      memoryWith({
        learnedFacts: [
          { fact: "LEGACY", date: new Date("2026-01-01") }, // no confidence
          { fact: "WEAK", confidence: 0.2, date: new Date("2026-01-02") },
          { fact: "STRONG", confidence: 0.9, date: new Date("2026-01-03") },
        ],
      })
    );

    const ctx = await agentConsensusService.buildMemoryContext("u1", "hawk");

    expect(ctx).toContain("LEGACY"); // 0.5 neutral → still included
    expect(ctx.indexOf("STRONG")).toBeLessThan(ctx.indexOf("LEGACY"));
    expect(ctx.indexOf("LEGACY")).toBeLessThan(ctx.indexOf("WEAK"));
  });
});

describe("CODE-1: runParallelDebate gives each persona its own memory", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    thinkCalls.length = 0;
  });

  it("appends the matching persona memory block to each agent prompt", async () => {
    await agentConsensusService.runParallelDebate("BASE PROMPT", {
      currentRegime: "trending",
      assets: [],
      userId: "u1",
      personaMemory: {
        hawk: "HAWK-MEM",
        dove: "DOVE-MEM",
        contrarian: "CONTRARIAN-MEM",
      },
    });

    const promptsFor = (persona: string) =>
      thinkCalls.filter((c) => c.persona === persona).map((c) => c.prompt);

    // Each persona received its own block, appended to the base prompt.
    expect(promptsFor("hawk").some((p) => p.includes("HAWK-MEM") && p.includes("BASE PROMPT"))).toBe(true);
    expect(promptsFor("dove").some((p) => p.includes("DOVE-MEM") && p.includes("BASE PROMPT"))).toBe(true);
    expect(promptsFor("contrarian").some((p) => p.includes("CONTRARIAN-MEM") && p.includes("BASE PROMPT"))).toBe(true);

    // ...and did NOT receive another persona's memory.
    expect(promptsFor("dove").some((p) => p.includes("HAWK-MEM"))).toBe(false);
    expect(promptsFor("contrarian").some((p) => p.includes("DOVE-MEM"))).toBe(false);
  });

  it("falls back to the bare prompt when no personaMemory is supplied", async () => {
    await agentConsensusService.runParallelDebate("BARE PROMPT", {
      currentRegime: "ranging",
      assets: [],
      userId: "u1",
    });

    for (const call of thinkCalls) {
      expect(call.prompt).toContain("BARE PROMPT");
    }
  });
});
