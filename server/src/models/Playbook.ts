import mongoose, { Schema, Document } from "mongoose";

export interface IPlaybook extends Document {
  userId: string;
  tradingAccountId: string; // Tautan ke akun broker
  name: string;
  description?: string;
  markets: string[]; // formerly applicablePairs
  timeframe?: string;
  // Primary methodology category
  methodology: "ICT" | "CRT" | "MSNR" | "SMC" | "PA" | "IND" | "HYBRID";
  // Market condition filter (optional)
  marketCondition?: "TRENDING" | "RANGING" | "VOLATILE" | "LIQUID" | "ALL";
  // Legacy compatibility
  legacyCategory?: "breakout" | "reversal" | "scalping" | "swing" | "news";
  tags: string[];
  rules: string[];
  isArchived: boolean;
  // Computed performance stats
  stats: {
    totalTrades: number;
    wins: number;
    losses: number;
    totalPnL: number;
    avgRr: number;
    winRate: number;
  };
  htfKeyLevel?: string;
  ictPoi?: string;
  msnrLevel?: string;
  htfTimeframe?: string;
  entryTimeframe?: string;
  entryChecklist: string[];
  createdAt: Date;
  updatedAt: Date;
}

const PlaybookSchema = new Schema<IPlaybook>({
  userId: { type: String, required: true, index: true },
  tradingAccountId: { type: String, index: true },
  name: { type: String, required: true },
  description: { type: String },
  markets: { type: [String], default: [] }, // renamed from applicablePairs
  timeframe: { type: String },
  methodology: {
    type: String,
    enum: ["ICT", "CRT", "MSNR", "SMC", "PA", "IND", "HYBRID"],
    required: true
  },
  marketCondition: {
    type: String,
    enum: ["TRENDING", "RANGING", "VOLATILE", "LIQUID", "ALL"],
    default: "ALL"
  },
  legacyCategory: {
    type: String,
    enum: ["breakout", "reversal", "scalping", "swing", "news"]
  },
  tags: { type: [String], default: [] },
  rules: { type: [String], default: [] },
  isArchived: { type: Boolean, required: true, default: false },
  stats: {
    totalTrades: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    totalPnL: { type: Number, default: 0 },
    avgRr: { type: Number, default: 0 },
    winRate: { type: Number, default: 0 }
  },
  htfKeyLevel: { type: String },
  ictPoi: { type: String, enum: ["OrderBlock", "FVG", "Breaker", "Rejection", "iFVG"] },
  msnrLevel: { type: String, enum: ["APEX", "QM", "OCL", "TrendLine", "SBR", "RBS"] },
  htfTimeframe: { type: String },
  entryTimeframe: { type: String },
  entryChecklist: { type: [String], default: [] }
}, {
  timestamps: true,
  collection: "playbooks",
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

export const Playbook = mongoose.models.Playbook || mongoose.model<IPlaybook>("Playbook", PlaybookSchema);
