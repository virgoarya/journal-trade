import mongoose, { Schema, Document } from "mongoose";

export interface ISymbolSkill {
  symbol: string;
  score: number;
  totalBacktests: number;
  avgWinRate: number;
  avgProfitFactor: number;
  avgRecoveryFactor: number;
  totalPnL: number;
  totalTrades: number;
  bestMethodology: string;
  recommendedParams: {
    rsiOversold: number;
    rsiOverbought: number;
    atrMultiplierSL: number;
    atrMultiplierTP: number;
    signalInterval: number;
  };
  lastTested: Date;
}

export interface IMethodologySkill {
  methodology: string;
  totalTrades: number;
  totalPnL: number;
  avgWinRate: number;
  bestSymbol: string;
  verdict: "KEEP" | "ADJUST" | "DISABLE";
}

export interface IAIBacktestSkill extends Document {
  userId: string;
  symbolRankings: ISymbolSkill[];
  methodologyRankings: IMethodologySkill[];
  globalRecoveryFactor: number;
  totalBacktests: number;
  lastUpdated: Date;
}

const SymbolSkillSchema = new Schema<ISymbolSkill>({
  symbol: { type: String, required: true },
  score: { type: Number, required: true, default: 0 },
  totalBacktests: { type: Number, required: true, default: 0 },
  avgWinRate: { type: Number, required: true, default: 0 },
  avgProfitFactor: { type: Number, required: true, default: 0 },
  avgRecoveryFactor: { type: Number, required: true, default: 0 },
  totalPnL: { type: Number, required: true, default: 0 },
  totalTrades: { type: Number, required: true, default: 0 },
  bestMethodology: { type: String, default: "unknown" },
  recommendedParams: {
    rsiOversold: { type: Number, default: 30 },
    rsiOverbought: { type: Number, default: 70 },
    atrMultiplierSL: { type: Number, default: 1.5 },
    atrMultiplierTP: { type: Number, default: 1.5 },
    signalInterval: { type: Number, default: 4 },
  },
  lastTested: { type: Date, default: Date.now },
});

const MethodologySkillSchema = new Schema<IMethodologySkill>({
  methodology: { type: String, required: true },
  totalTrades: { type: Number, required: true, default: 0 },
  totalPnL: { type: Number, required: true, default: 0 },
  avgWinRate: { type: Number, required: true, default: 0 },
  bestSymbol: { type: String, default: "unknown" },
  verdict: {
    type: String,
    enum: ["KEEP", "ADJUST", "DISABLE"],
    default: "KEEP",
  },
});

const AIBacktestSkillSchema = new Schema<IAIBacktestSkill>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    symbolRankings: [SymbolSkillSchema],
    methodologyRankings: [MethodologySkillSchema],
    globalRecoveryFactor: { type: Number, required: true, default: 0 },
    totalBacktests: { type: Number, required: true, default: 0 },
  },
  {
    timestamps: { createdAt: false, updatedAt: "lastUpdated" },
    collection: "ai_backtest_skills",
  }
);

export const AIBacktestSkill =
  mongoose.models.AIBacktestSkill ||
  mongoose.model<IAIBacktestSkill>("AIBacktestSkill", AIBacktestSkillSchema);
