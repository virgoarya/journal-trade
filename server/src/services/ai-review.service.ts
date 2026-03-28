import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { aiReview, trade } from "../db/schema";
import { env } from "../config/env";
// import gemini library (placeholder if no formal SDK configured here)

export const aiReviewService = {
  
  async getFeed(userId: string, limit = 10, offset = 0) {
    return await db.query.aiReview.findMany({
      where: eq(aiReview.userId, userId),
      limit,
      offset,
      orderBy: (rev, { desc }) => [desc(rev.createdAt)],
      with: { trade: true } // assuming relationship exists in schema relations
    });
  },

  async generateReview(tradeId: string, userId: string) {
    if (!env.GEMINI_API_KEY) throw new Error("Fitur AI dinonaktifkan");
    
    const existing = await db.query.aiReview.findFirst({
        where: and(eq(aiReview.tradeId, tradeId), eq(aiReview.userId, userId))
    });
    if (existing) return existing;

    // Fetch trade context
    // const t = await tradeService.getById(tradeId, userId);
    
    // Call Gemini API placeholder
    const mockGeminiResponse = {
      score: 8.2,
      strengths: ["Manajemen risiko kuat", "Masuk di zona diskon"],
      improvements: ["Evaluasi emosi saat trade", "Abaikan FOMO"],
      summary: "Trade yang cukup disiplin.",
      recommendation: "Pertahankan ukuran lot pada level saat ini."
    };

    const [review] = await db.insert(aiReview).values({
      tradeId,
      userId,
      score: mockGeminiResponse.score.toString(),
      strengths: mockGeminiResponse.strengths,
      improvements: mockGeminiResponse.improvements,
      summary: mockGeminiResponse.summary,
      recommendation: mockGeminiResponse.recommendation
    }).returning();

    return review;
  }
};
