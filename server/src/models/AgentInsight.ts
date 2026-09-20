import mongoose, { Schema, Document } from "mongoose";

export interface IAgentInsight extends Document {
  personaId: "hawk" | "dove" | "contrarian" | "consensus";
  insightType: "proactive" | "debate" | "alert";
  content: string;
  conviction: "TINGGI" | "SEDANG" | "RENDAH";
  regime?: string;
  triggers?: string[]; // indikator yang memicu insight
  assets?: string[];   // aset terkait
  metadata?: Record<string, any>;
  createdAt: Date;
}

const AgentInsightSchema = new Schema<IAgentInsight>(
  {
    personaId: {
      type: String,
      enum: ["hawk", "dove", "contrarian", "consensus"],
      required: true,
      index: true,
    },
    insightType: {
      type: String,
      enum: ["proactive", "debate", "alert", "deep_research"],
      required: true,
      index: true,
    },
    content: { type: String, required: true },
    conviction: {
      type: String,
      enum: ["TINGGI", "SEDANG", "RENDAH"],
      default: "SEDANG",
    },
    regime: { type: String },
    triggers: [{ type: String }],
    assets: [{ type: String }],
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Index compound untuk query cepat
AgentInsightSchema.index({ personaId: 1, insightType: 1, createdAt: -1 });
AgentInsightSchema.index({ createdAt: -1 }, { expireAfterSeconds: 7 * 24 * 3600 }); // Auto-delete setelah 7 hari

export const AgentInsight =
  mongoose.models.AgentInsight ||
  mongoose.model<IAgentInsight>("AgentInsight", AgentInsightSchema);
