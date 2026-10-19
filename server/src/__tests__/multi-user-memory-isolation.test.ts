/**
 * Phase 3.3: Multi-User Memory Isolation Verification Test
 *
 * Verifies that memory queries are properly isolated per user.
 * Uses vi.hoisted() to avoid vi.mock hoisting issues.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFindOne, mockCreate, mockFindOneAndUpdate, mockUpdateOne } = vi.hoisted(() => ({
  mockFindOne: vi.fn(),
  mockCreate: vi.fn(),
  mockFindOneAndUpdate: vi.fn(),
  mockUpdateOne: vi.fn(),
}));

vi.mock("../models/UserAgentMemory", () => ({
  UserAgentMemory: {
    findOne: mockFindOne,
    create: mockCreate,
    findOneAndUpdate: mockFindOneAndUpdate,
    updateOne: mockUpdateOne,
  },
}));

import { userMemoryService } from "../services/user-memory.service";

/** findOne() returns a query object; the service chains `.lean()` on it. */
const findOneReturning = (doc: any) => ({ lean: vi.fn().mockResolvedValue(doc) });

const emptyMemory = (userId: string, over: Record<string, any> = {}) => ({
  userId,
  name: "",
  preferences: {},
  learnedFacts: [],
  agentMemories: [],
  interactionCount: 0,
  ...over,
});

describe("Phase 3.3: Multi-User Memory Isolation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Reset singleton cache — otherwise a user cached in an earlier test leaks.
    (userMemoryService as any).cache.clear();
  });

  it("getOrCreate should filter by userId", async () => {
    mockFindOne.mockReturnValue(findOneReturning(null));
    mockCreate.mockResolvedValue(emptyMemory("user_a"));

    await userMemoryService.getOrCreate("user_a");

    expect(mockFindOne).toHaveBeenCalledWith({ userId: "user_a" });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user_a" })
    );
  });

  it("learnFact should only update the specified user", async () => {
    mockFindOneAndUpdate.mockResolvedValue({ modifiedCount: 1 });

    await userMemoryService.learnFact("user_a", "Prefers conservative risk");

    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { userId: "user_a" },
      expect.objectContaining({
        $push: { learnedFacts: expect.objectContaining({ fact: "Prefers conservative risk" }) },
      }),
      { upsert: true }
    );
  });

  it("learnPersonaFact should only update the specified user", async () => {
    mockFindOne.mockReturnValue(
      findOneReturning(
        emptyMemory("user_b", { agentMemories: [{ personaId: "hawk", facts: [] }] })
      )
    );
    mockUpdateOne.mockResolvedValue({ modifiedCount: 1 });

    await userMemoryService.learnPersonaFact("user_b", "hawk", "Likes tight stops");

    expect(mockUpdateOne).toHaveBeenCalledWith(
      { userId: "user_b", "agentMemories.personaId": "hawk" },
      expect.any(Object)
    );
  });

  it("updateName should only update the specified user", async () => {
    mockFindOneAndUpdate.mockResolvedValue({ modifiedCount: 1 });

    await userMemoryService.updateName("user_c", "Bang Vir");

    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { userId: "user_c" },
      { $set: { name: "Bang Vir" } },
      { upsert: true }
    );
  });

  it("incrementInteraction should only update the specified user", async () => {
    mockFindOneAndUpdate.mockResolvedValue({ modifiedCount: 1 });

    await userMemoryService.incrementInteraction("user_d");

    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { userId: "user_d" },
      expect.objectContaining({ $inc: { interactionCount: 1 } }),
      { upsert: true }
    );
  });

  it("different users should have separate cache entries", async () => {
    mockFindOne
      .mockReturnValueOnce(
        findOneReturning(emptyMemory("user_a", { name: "Alice", interactionCount: 5 }))
      )
      .mockReturnValueOnce(
        findOneReturning(emptyMemory("user_b", { name: "Bob", interactionCount: 3 }))
      );

    const memA = await userMemoryService.getOrCreate("user_a");
    const memB = await userMemoryService.getOrCreate("user_b");

    expect(memA.userId).toBe("user_a");
    expect(memB.userId).toBe("user_b");
    expect(memA.name).toBe("Alice");
    expect(memB.name).toBe("Bob");
  });
});
