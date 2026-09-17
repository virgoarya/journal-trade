import mongoose, { Schema, Document } from "mongoose";

export interface IUserAgentMemory extends Document {
  userId: string;
  name?: string; // nama yang user pakai di chat
  preferences: Record<string, string>; // preferensi user (fokus trading, gaya analisis, dll)
  learnedFacts: Array<{ date: Date; fact: string }>; // fakta yang dipelajari agent dari interaksi
  interactionCount: number;
  lastInteractionAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserAgentMemorySchema = new Schema<IUserAgentMemory>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    name: { type: String, default: "" },
    preferences: { type: Map, of: String, default: {} },
    learnedFacts: [
      {
        date: { type: Date, default: Date.now },
        fact: { type: String, required: true },
      },
    ],
    interactionCount: { type: Number, default: 0 },
    lastInteractionAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    collection: "user_agent_memories",
  }
);

export const UserAgentMemory =
  mongoose.models.UserAgentMemory ||
  mongoose.model<IUserAgentMemory>("UserAgentMemory", UserAgentMemorySchema);
