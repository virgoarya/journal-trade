import mongoose, { Schema, Document } from "mongoose";

export interface IAgentMemoryEntry {
  personaId: string; // "hawk" | "dove" | "contrarian"
  facts: Array<{
    date: Date;
    fact: string;
    category?: "user_preference" | "market_insight" | "persona_feedback";
  }>;
}

export interface IUserAgentMemory extends Document {
  userId: string;
  name?: string; // nama yang user pakai di chat
  preferences: Record<string, string>; // preferensi user (fokus trading, gaya analisis, dll)
  learnedFacts: Array<{ date: Date; fact: string }>; // fakta umum yang dipelajari agent dari interaksi
  agentMemories?: IAgentMemoryEntry[]; // memori spesifik per persona (Hawk, Dove, Contrarian)
  marketPreferences?: {
    preferredRegimes?: string[];
    preferredAssets?: string[];
    analysisDepth?: "brief" | "detailed";
    riskTolerance?: "conservative" | "moderate" | "aggressive";
  };
  interactionCount: number;
  lastInteractionAt: Date;
  lastRegime?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AgentMemoryEntrySchema = new Schema(
  {
    personaId: { type: String, required: true },
    facts: [
      {
        date: { type: Date, default: Date.now },
        fact: { type: String, required: true },
        category: {
          type: String,
          enum: ["user_preference", "market_insight", "persona_feedback"],
          default: "user_preference",
        },
      },
    ],
  },
  { _id: false }
);

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
    agentMemories: { type: [AgentMemoryEntrySchema], default: [] },
    marketPreferences: {
      preferredRegimes: { type: [String], default: [] },
      preferredAssets: { type: [String], default: [] },
      analysisDepth: {
        type: String,
        enum: ["brief", "detailed"],
        default: "detailed",
      },
      riskTolerance: {
        type: String,
        enum: ["conservative", "moderate", "aggressive"],
        default: "moderate",
      },
    },
    interactionCount: { type: Number, default: 0 },
    lastInteractionAt: { type: Date, default: Date.now },
    lastRegime: { type: String, default: "" },
  },
  {
    timestamps: true,
    collection: "user_agent_memories",
  }
);

export const UserAgentMemory =
  mongoose.models.UserAgentMemory ||
  mongoose.model<IUserAgentMemory>("UserAgentMemory", UserAgentMemorySchema);
