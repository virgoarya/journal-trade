import { describe, it, expect, vi, beforeEach } from "vitest";
import { userMemoryService } from "../user-memory.service";
import { UserAgentMemory } from "../../models/UserAgentMemory";

// Mock UserAgentMemory model methods
vi.mock("../../models/UserAgentMemory", () => ({
  UserAgentMemory: {
    findOne: vi.fn(),
    create: vi.fn(),
    findOneAndUpdate: vi.fn(),
    updateOne: vi.fn(),
  },
}));

describe("UserAgentMemory & Persona Persistence Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create user memory dengan nama KOSONG (tidak hardcode nama user)", async () => {
    (UserAgentMemory.findOne as any).mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    });
    (UserAgentMemory.create as any).mockResolvedValueOnce({
      userId: "user_test_123",
      name: "",
      preferences: {},
      learnedFacts: [],
      agentMemories: [],
      interactionCount: 0,
    });

    const memory = await userMemoryService.getOrCreate("user_test_123");
    expect(memory.userId).toBe("user_test_123");
    // PENTING: nama harus KOSONG, bukan nama user lain.
    // Nama diisi dari session auth (ensureName) atau profil.
    expect(memory.name).toBe("");
    expect(memory.name).not.toBe("Bang Vir");
  });

  it("should learn persona-specific fact for Hawk, Dove, or Contrarian", async () => {
    (UserAgentMemory.findOne as any).mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        userId: "user_test_123",
        name: "Siti",
        agentMemories: [],
      }),
    });
    (UserAgentMemory.updateOne as any).mockResolvedValueOnce({ modifiedCount: 1 });

    await userMemoryService.learnPersonaFact(
      "user_test_123",
      "hawk",
      "User lebih menyukai analisis kuantitatif suku bunga dan RRP",
      "user_preference"
    );

    expect(UserAgentMemory.updateOne).toHaveBeenCalled();
  });

  it("should build prompt context dengan nama user asli + persona memories", async () => {
    (UserAgentMemory.findOne as any).mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        userId: "user_test_123",
        name: "Siti",
        learnedFacts: [{ date: new Date(), fact: "User fokus trading XAUUSD" }],
        agentMemories: [
          {
            personaId: "hawk",
            facts: [
              {
                date: new Date(),
                fact: "Hawk mencatat user suka metrik RRP",
                category: "user_preference",
              },
            ],
          },
        ],
        interactionCount: 5,
      }),
    });

    const contextPrompt = await userMemoryService.getPromptContext("user_test_123", "hawk");

    // Nama user asli dipakai, BUKAN hardcode
    expect(contextPrompt).toContain("Siti");
    expect(contextPrompt).not.toContain("Bang Vir");
    expect(contextPrompt).toContain("User fokus trading XAUUSD");
    expect(contextPrompt).toContain("Hawk mencatat user suka metrik RRP");
  });

  it("should pakai placeholder 'Trader' kalau nama user belum diisi", async () => {
    (UserAgentMemory.findOne as any).mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        userId: "user_baru",
        name: "",
        learnedFacts: [],
        agentMemories: [],
        interactionCount: 0,
      }),
    });

    const contextPrompt = await userMemoryService.getPromptContext("user_baru", "hawk");

    // Placeholder netral, tidak mengarang nama
    expect(contextPrompt).toContain("Trader");
    expect(contextPrompt).not.toContain("Bang Vir");
    // Harus melarang mengarang nama
    expect(contextPrompt.toLowerCase()).toContain("jangan mengarang");
  });
});
