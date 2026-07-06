import mongoose, { Schema, Document } from "mongoose";

export interface IBacktestExperience extends Document {
  userId: string;
  sessionId?: string;

  symbol: string;
  timeframe: string;
  dateRange: {
    from: Date;
    to: Date;
  };

  strategy: {
    name: string;
    params: Record<string, any>;
  };

  result: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    totalPnL: number;
    totalPnLPercent: number;
    maxDrawdownPercent: number;
    profitFactor: number;
    recoveryFactor: number;
    sharpeRatio: number;
    averageWin: number;
    averageLoss: number;
    equityCurve: Array<{ time: number; equity: number }>;
    symbolStats?: Array<{
      symbol: string;
      totalTrades: number;
      winningTrades: number;
      losingTrades: number;
      breakEvenTrades: number;
      totalPnL: number;
      winRate: number;
    }>;
    methodologyStats?: Array<{
      methodology: string;
      totalTrades: number;
      winningTrades: number;
      losingTrades: number;
      totalPnL: number;
      winRate: number;
      avgConfidence: number;
    }>;
  };

  aiLearningSummary?: {
    strengths: string[];
    weaknesses: string[];
    marketConditions: string[];
    recommendedAdjustments: Record<string, any>;
  };

  pipelineConfigSnapshot: Record<string, any>;

  createdAt: Date;
  updatedAt: Date;
}

const BacktestExperienceSchema = new Schema<IBacktestExperience>(
  {
    userId: { type: String, required: true, index: true },
    sessionId: { type: String },

    symbol: { type: String, required: true },
    timeframe: { type: String, required: true },
    dateRange: {
      from: { type: Date, required: true },
      to: { type: Date, required: true },
    },

    strategy: {
      name: { type: String, required: true },
      params: { type: Schema.Types.Mixed },
    },

    result: {
      totalTrades: Number,
      winningTrades: Number,
      losingTrades: Number,
      winRate: Number,
      totalPnL: Number,
      totalPnLPercent: Number,
      maxDrawdownPercent: Number,
      profitFactor: Number,
      recoveryFactor: Number,
      sharpeRatio: Number,
      averageWin: Number,
      averageLoss: Number,
      equityCurve: [
        {
          time: Number,
          equity: Number,
        },
      ],
      symbolStats: [
        {
          symbol: String,
          totalTrades: Number,
          winningTrades: Number,
          losingTrades: Number,
          breakEvenTrades: Number,
          totalPnL: Number,
          winRate: Number,
        },
      ],
      methodologyStats: [
        {
          methodology: String,
          totalTrades: Number,
          winningTrades: Number,
          losingTrades: Number,
          totalPnL: Number,
          winRate: Number,
          avgConfidence: Number,
        },
      ],
    },

    aiLearningSummary: {
      strengths: [String],
      weaknesses: [String],
      marketConditions: [String],
      recommendedAdjustments: { type: Schema.Types.Mixed },
    },

    pipelineConfigSnapshot: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
    collection: "backtest_experiences",
  },
);

BacktestExperienceSchema.index({ userId: 1, createdAt: -1 });
BacktestExperienceSchema.index({ symbol: 1, timeframe: 1 });

export const BacktestExperience =
  mongoose.models.BacktestExperience ||
  mongoose.model<IBacktestExperience>(
    "BacktestExperience",
    BacktestExperienceSchema,
  );
