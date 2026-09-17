import { UserAgentMemory, IUserAgentMemory } from "../models/UserAgentMemory";
import { silentLogger } from "../utils/silent-logger";

class UserMemoryService {
  private cache = new Map<string, { data: IUserAgentMemory; fetchedAt: number }>();
  private CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Get or create memory for a user. Called on every chat interaction.
   */
  async getOrCreate(userId: string): Promise<IUserAgentMemory> {
    const cached = this.cache.get(userId);
    if (cached && Date.now() - cached.fetchedAt < this.CACHE_TTL_MS) {
      return cached.data;
    }

    try {
      let memory = await UserAgentMemory.findOne({ userId }).lean();
      if (!memory) {
        memory = await UserAgentMemory.create({ userId, name: "", preferences: {}, learnedFacts: [], interactionCount: 0 });
        silentLogger.info(`[UserMemory] Created new memory for user ${userId}`);
      }
      this.cache.set(userId, { data: memory as any, fetchedAt: Date.now() });
      return memory as any;
    } catch (err: any) {
      silentLogger.warn(`[UserMemory] Failed to get memory for ${userId}: ${err.message}`);
      // Return dummy object
      return { userId, name: "", preferences: {}, learnedFacts: [], interactionCount: 0 } as any;
    }
  }

  /**
   * Learn a new fact about the user from the interaction
   */
  async learnFact(userId: string, fact: string): Promise<void> {
    if (!fact || !fact.trim()) return;
    try {
      await UserAgentMemory.findOneAndUpdate(
        { userId },
        {
          $push: { learnedFacts: { date: new Date(), fact: fact.trim() } },
          $inc: { interactionCount: 1 },
          $set: { lastInteractionAt: new Date() },
        },
        { upsert: true }
      );
      // Invalidate cache
      this.cache.delete(userId);
      silentLogger.info(`[UserMemory] Learned fact for user ${userId}: ${fact}`);
    } catch (err: any) {
      silentLogger.warn(`[UserMemory] Failed to learn fact: ${err.message}`);
    }
  }

  /**
   * Ensure user name is saved from auth session
   */
  async ensureName(userId: string, name: string): Promise<void> {
    try {
      const mem = await this.getOrCreate(userId);
      if (!mem.name) {
        await this.updateName(userId, name);
      }
    } catch (err: any) {
      // ignore
    }
  }

  /**
   * Update user's name (if they mention it in conversation)
   */
  async updateName(userId: string, name: string): Promise<void> {
    if (!name) return;
    try {
      await UserAgentMemory.findOneAndUpdate(
        { userId },
        { $set: { name } },
        { upsert: true }
      );
      this.cache.delete(userId);
    } catch (err: any) {
      // ignore
    }
  }

  /**
   * Build prompt context for this user (injected into system prompt)
   */
  async getPromptContext(userId: string): Promise<string> {
    const memory = await this.getOrCreate(userId);

    const activeName = memory.name || "Bang Vir";
    const factsLine = memory.learnedFacts.length > 0
      ? `\nFakta tentang user dari interaksi sebelumnya:\n${memory.learnedFacts.slice(-5).map(f => `- ${f.fact}`).join("\n")}`
      : "";

    return `
[MEMORI TENTANG USER INI - WAJIB DIKENALI SECARA ALAMI]:
- Nama user yang sedang Anda ajak bicara: ${activeName}
- Anda MENGENAL user ini dengan baik. Panggil beliau "${activeName}" secara alami.
- JANGAN PERNAH mengatakan "Identitas Anda tidak tersimpan" atau "sistem tidak menyimpan identitas pengguna". Anda SUDAH mengingat dan mengenalnya sebagai ${activeName}.
- Total interaksi sebelumnya: ${memory.interactionCount} kali.${factsLine}

ATURAN KOMUNIKASI:
- Selalu panggil beliau "${activeName}" saat menyapa atau menjawab.
- JANGAN PERNAH bertanya "Siapa nama Anda?" atau bertingkah seolah tidak tahu.
- Gaya: Lugas, to-the-point, data-driven, profesional tanpa basa-basi teknis.
- DILARANG KERAS menyertakan catatan teknis developer seperti "Pilihan malas:", "Alternatif malas:", "ponytail:", atau "skipped:".`;
  }

  /**
   * Increment interaction count
   */
  async incrementInteraction(userId: string): Promise<void> {
    try {
      await UserAgentMemory.findOneAndUpdate(
        { userId },
        {
          $inc: { interactionCount: 1 },
          $set: { lastInteractionAt: new Date() },
        },
        { upsert: true }
      );
      this.cache.delete(userId);
    } catch (err: any) {
      // ignore
    }
  }
}

export const userMemoryService = new UserMemoryService();
