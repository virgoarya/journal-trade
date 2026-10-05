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
        memory = await UserAgentMemory.create({
          userId,
          // JANGAN hardcode nama user. Biarkan kosong → diisi dari session auth
          // (ensureName) atau dari profil. Nama spesifik seperti "Bang Vir"
          // membuat SEMUA user dipanggil dengan nama yang sama.
          name: "",
          preferences: {},
          learnedFacts: [],
          agentMemories: [],
          interactionCount: 0,
        });
        silentLogger.info(`[UserMemory] Created new memory for user ${userId}`);
      }
      this.cache.set(userId, { data: memory as any, fetchedAt: Date.now() });
      return memory as any;
    } catch (err: any) {
      silentLogger.warn(`[UserMemory] Failed to get memory for ${userId}: ${err.message}`);
      return {
        userId,
        name: "",
        preferences: {},
        learnedFacts: [],
        agentMemories: [],
        interactionCount: 0,
      } as any;
    }
  }

  /**
   * Learn a general fact about the user from the interaction
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
      this.cache.delete(userId);
      silentLogger.info(`[UserMemory] Learned general fact for user ${userId}: ${fact}`);
    } catch (err: any) {
      silentLogger.warn(`[UserMemory] Failed to learn fact: ${err.message}`);
    }
  }

  /**
   * Learn a persona-specific memory fact (for Hawk, Dove, or Contrarian)
   */
  async learnPersonaFact(
    userId: string,
    personaId: string,
    fact: string,
    category: "user_preference" | "market_insight" | "persona_feedback" = "user_preference"
  ): Promise<void> {
    if (!fact || !fact.trim()) return;
    try {
      const memory = await this.getOrCreate(userId);
      const existingEntries = memory.agentMemories || [];
      const entryIdx = existingEntries.findIndex((e) => e.personaId === personaId);

      const newFactItem = { date: new Date(), fact: fact.trim(), category };

      if (entryIdx >= 0) {
        await UserAgentMemory.updateOne(
          { userId, "agentMemories.personaId": personaId },
          {
            $push: { "agentMemories.$.facts": newFactItem },
            $inc: { interactionCount: 1 },
            $set: { lastInteractionAt: new Date() },
          }
        );
      } else {
        await UserAgentMemory.updateOne(
          { userId },
          {
            $push: {
              agentMemories: {
                personaId,
                facts: [newFactItem],
              },
            },
            $inc: { interactionCount: 1 },
            $set: { lastInteractionAt: new Date() },
          },
          { upsert: true }
        );
      }

      this.cache.delete(userId);
      silentLogger.info(`[UserMemory] Persona ${personaId} learned fact for ${userId}: ${fact}`);
    } catch (err: any) {
      silentLogger.warn(`[UserMemory] Failed to learn persona fact: ${err.message}`);
    }
  }

  /**
   * Update user's name
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
   * Build prompt context for this user (injected into system prompt)
   *
   * PENTING: kalau nama user belum diketahui, JANGAN memakai nama hardcode.
   * Instruksikan agent memanggil user secara netral sampai nama tersedia.
   */
  async getPromptContext(userId: string, personaId?: string): Promise<string> {
    const memory = await this.getOrCreate(userId);
    const activeName = (memory.name || "").trim();

    const generalFacts = memory.learnedFacts.length > 0
      ? memory.learnedFacts.slice(-5).map((f) => `- ${f.fact}`).join("\n")
      : "";

    let personaFactsText = "";
    if (personaId && memory.agentMemories) {
      const personaMemory = memory.agentMemories.find((m) => m.personaId === personaId);
      if (personaMemory && personaMemory.facts && personaMemory.facts.length > 0) {
        personaFactsText = personaMemory.facts
          .slice(-5)
          .map((f) => `- [${f.category || "insight"}] ${f.fact}`)
          .join("\n");
      }
    }

    const factsSection = [
      generalFacts ? `Fakta umum:\n${generalFacts}` : "",
      personaFactsText ? `Konteks spesifik untuk Anda (${personaId}):\n${personaFactsText}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    // Nama tersedia → panggil dengan nama. Tidak tersedia → placeholder "Trader"
    // (netral, tidak mengarang nama user lain).
    const displayName = activeName || "Trader";
    const nameKnown = Boolean(activeName);

    const nameLine = nameKnown
      ? `- Nama user yang sedang Anda ajak bicara: ${displayName}\n- Anda MENGENAL user ini dengan baik. Panggil beliau "${displayName}" secara alami di setiap respon.`
      : `- Nama user belum diisi di profil. Gunakan sapaan "${displayName}" (placeholder netral).\n- JANGAN mengarang atau menebak nama user. JANGAN memakai nama spesifik yang tidak diberikan user.`;

    const callRule = nameKnown
      ? `- Selalu panggil beliau "${displayName}" secara bersahabat & profesional.`
      : `- Panggil user dengan "${displayName}" sampai user memperkenalkan nama aslinya.`;

    return `
[MEMORI TENTANG USER INI - WAJIB DIKENALI SECARA ALAMI]:
${nameLine}
- JANGAN PERNAH mengatakan "Identitas Anda tidak tersimpan", "tidak mengenal Anda", atau "sistem tidak menyimpan identitas".
- Total interaksi sebelumnya: ${memory.interactionCount || 1} kali.
${factsSection ? `\n[CATATAN PERSISTEN TENTANG USER]:\n${factsSection}` : ""}

ATURAN KOMUNIKASI MEMORI:
${callRule}
- JANGAN PERNAH bertanya "Siapa nama Anda?" atau bertingkah seolah tidak tahu.
- Integrasikan pemahaman konteks makro dan riwayat interaksi dalam analisis Anda.
- DILARANG KERAS menyertakan komentar developer atau meta-language.`;
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
