import { AiReview } from "../models/AiReview";
import { env } from "../config/env";

export const aiReviewService = {

  async getFeed(userId: string, limit = 10, offset = 0, filter: any = {}) {
    const query = { userId, ...filter };
    return await AiReview.find(query)
      .populate("tradeId", "tradeDate pair result actualPnl emotionalState notes")
      .sort("-createdAt")
      .skip(offset)
      .limit(limit);
  },

  async generateReview(tradeId: string, userId: string) {
    if (!env.GEMINI_API_KEY) throw new Error("Fitur AI dinonaktifkan");

    let existing = await AiReview.findOne({ tradeId, userId });
    if (existing) return existing;

    const mockGeminiResponse = {
      score: 8.2,
      strengths: ["Manajemen risiko kuat", "Masuk di zona diskon"],
      improvements: ["Evaluasi emosi saat trade", "Abaikan FOMO"],
      summary: "Trade yang cukup disiplin.",
      recommendation: "Pertahankan ukuran lot pada level saat ini."
    };

    const review = await AiReview.create({
      tradeId,
      userId,
      score: mockGeminiResponse.score,
      strengths: mockGeminiResponse.strengths,
      improvements: mockGeminiResponse.improvements,
      summary: mockGeminiResponse.summary,
      recommendation: mockGeminiResponse.recommendation
    });

    return review;
  },

  async deleteReview(id: string, userId: string) {
    const result = await AiReview.deleteOne({ _id: id, userId });
    return result.deletedCount > 0;
  }
};
