import mongoose, { Schema, Document } from "mongoose";

export interface IAiReview extends Document {
  tradeId: mongoose.Types.ObjectId;
  userId: string;
  score: number;
  strengths: string[];
  improvements: string[];
  summary?: string;
  recommendation?: string;
  createdAt: Date;
}

const AiReviewSchema = new Schema<IAiReview>({
  tradeId: { type: Schema.Types.ObjectId, ref: "Trade", required: true, unique: true },
  userId: { type: String, required: true, index: true },
  score: { type: Number, required: true },
  strengths: { type: [String], required: true },
  improvements: { type: [String], required: true },
  summary: { type: String },
  recommendation: { type: String },
}, {
  timestamps: { createdAt: true, updatedAt: false },
  collection: "ai_reviews"
});

export const AiReview = mongoose.models.AiReview || mongoose.model<IAiReview>("AiReview", AiReviewSchema);
