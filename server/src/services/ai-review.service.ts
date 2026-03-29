import { AiReview } from "../models/AiReview";
import { env } from "../config/env";

export const aiReviewService = {
  
  async getFeed(userId: string, limit = 10, offset = 0) {
    return await AiReview.find({ userId })
      .populate("tradeId", "tradeDate pair result actualPnl")
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
  }
};
