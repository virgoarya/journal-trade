import { describe, it, expect, vi, beforeEach } from 'vitest';
import { selfImprovementService } from "../self-improvement.service";
import { userMemoryService } from "../user-memory.service";
import { ReflectionLog } from "../../models/ReflectionLog";

vi.mock('../../models/ReflectionLog', () => ({
  ReflectionLog: {
    create: vi.fn(),
    findOne: vi.fn(),
  },
}));

vi.mock('../user-memory.service', () => ({
  userMemoryService: {
    learnPersonaFact: vi.fn(),
    getOrCreate: vi.fn(),
  },
}));

describe("Self Improvement Service", () => {
  beforeEach(() => {
    vi.mocked(ReflectionLog.create).mockResolvedValue({ wasCorrected: true });
    vi.mocked(ReflectionLog.findOne).mockResolvedValue({ wasCorrected: true });
    vi.mocked(userMemoryService.learnPersonaFact).mockResolvedValue(undefined);
    vi.mocked(userMemoryService.getOrCreate).mockResolvedValue({ agentMemories: [] });
  });
  it("should enqueue a job, log reflection, and learn persona fact when corrected", async () => {
    await selfImprovementService.enqueueJob({
      personaId: "hawk",
      userId: "test_user_123",
      prompt: "Berapa CPI?",
      finalReply: "CPI 5%",
      wasCorrected: true,
      dataPoint: "CPI YoY",
      expected: "2.5",
      actual: "5",
    });

    // ReflectionLog.create should have been called
    expect(ReflectionLog.create).toHaveBeenCalled();
    // learnPersonaFact should be called because wasCorrected
    expect(userMemoryService.learnPersonaFact).toHaveBeenCalled();
  });
});
