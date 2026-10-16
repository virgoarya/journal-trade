import mongoose, { Schema, Document } from "mongoose";

export interface IReflectionLog extends Document {
  agentType: "hawk" | "dove" | "contrarian" | "default";
  userQuery: string;
  rawOutput: string;
  correctedOutput?: string;
  wasCorrected: boolean;
  dataPoint?: string; // e.g. "CPI YoY", "Fed Funds Rate"
  expected?: string;
  actual?: string;
  createdAt: Date;
}

const ReflectionLogSchema = new Schema<IReflectionLog>(
  {
    agentType: {
      type: String,
      enum: ["hawk", "dove", "contrarian", "default"],
      required: true,
    },
    userQuery: { type: String, required: true },
    rawOutput: { type: String, required: true },
    correctedOutput: { type: String, default: "" },
    wasCorrected: { type: Boolean, default: false },
    dataPoint: { type: String, default: "" },
    expected: { type: String, default: "" },
    actual: { type: String, default: "" },
  },
  {
    timestamps: true,
    collection: "reflection_logs",
  }
);

ReflectionLogSchema.index({ agentType: 1, createdAt: -1 });
ReflectionLogSchema.index({ wasCorrected: 1, createdAt: -1 });

export const ReflectionLog =
  mongoose.models.ReflectionLog ||
  mongoose.model<IReflectionLog>("ReflectionLog", ReflectionLogSchema);