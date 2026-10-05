import mongoose, { Schema, Document } from "mongoose";

export interface IChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: Date;
}

export interface IChatSession extends Document {
  userId: string;
  agentType: "hawk" | "dove" | "contrarian" | "default";
  title?: string;
  messages: IChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const ChatMessageSubSchema = new Schema<IChatMessage>(
  {
    role: {
      type: String,
      enum: ["user", "assistant", "system"],
      required: true,
    },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ChatSessionSchema = new Schema<IChatSession>(
  {
    userId: { type: String, required: true, index: true },
    agentType: {
      type: String,
      enum: ["hawk", "dove", "contrarian", "default"],
      default: "default",
      index: true,
    },
    title: { type: String, default: "" },
    messages: { type: [ChatMessageSubSchema], default: [] },
  },
  {
    timestamps: true,
    collection: "chat_sessions",
  }
);

// Compound index for efficient user+agent lookups
ChatSessionSchema.index({ userId: 1, agentType: 1, updatedAt: -1 });

export const ChatSession =
  mongoose.models.ChatSession ||
  mongoose.model<IChatSession>("ChatSession", ChatSessionSchema);
