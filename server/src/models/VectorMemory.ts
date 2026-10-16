import mongoose, { Schema, Document } from "mongoose";

export interface IVectorMemory extends Document {
  userId: string;
  personaId: string; // "hawk" | "dove" | "contrarian" | "default"
  queryText: string;
  replyText: string;
  vector: number[];
  intentTag?: string;
  createdAt: Date;
}

const VectorMemorySchema = new Schema<IVectorMemory>(
  {
    userId: { type: String, required: true, index: true },
    personaId: {
      type: String,
      enum: ["hawk", "dove", "contrarian", "default"],
      default: "default",
      index: true,
    },
    queryText: { type: String, required: true },
    replyText: { type: String, required: true },
    vector: { type: [Number], required: true },
    intentTag: { type: String, default: "" },
  },
  {
    timestamps: true,
    collection: "vector_memories",
  }
);

VectorMemorySchema.index({ userId: 1, personaId: 1, createdAt: -1 });

export const VectorMemory =
  mongoose.models.VectorMemory ||
  mongoose.model<IVectorMemory>("VectorMemory", VectorMemorySchema);
