import mongoose, { Schema, Document } from "mongoose";

export interface IAITradeLog extends Document {
  userId: string;
  accountId?: string; // MT5 Login ID
  sessionId: string;

  // Signal info
  signal: {
    symbol: string;
    direction: "BUY" | "SELL";
    confidence: number;
    entry: number;
    sl: number;
    tp: number;
    reason: string;
    timeframe: string;
    indicators: {
      rsi: number;
      atr: number;
    };
    pattern: string;
    // NEW: Methodology attribution
    primaryMethodology?: string;
    methodologyBreakdown?: Record<string, { confidence: number; weight: number; contribution: number }>;
  };

  // Execution
  executed: boolean;
  executionPrice?: number;
  executionTime?: Date;
  mt5Ticket?: number;
  positionSize?: number;

  // Result
  closed: boolean;
  closedAt?: Date;
  closePrice?: number;
  closeReason?: "TP_HIT" | "SL_HIT" | "MANUAL" | "TIMEOUT" | "SIGNAL";
  pnl?: number;
  pnlPips?: number;
  pnlPercent?: number;

  // Trailing stop history
  trailingHistory: Array<{
    time: Date;
    oldSL: number;
    newSL: number;
    price: number;
  }>;

  // Analysis snapshot
  analysisSnapshot: {
    trend?: string;
    volatility?: number;
    support?: number[];
    resistance?: number[];
  };

  createdAt: Date;
}

const AITradeLogSchema = new Schema<IAITradeLog>(
  {
    userId: { type: String, required: true, index: true },
    accountId: { type: String, index: true },
    sessionId: { type: String, index: true },

    signal: {
      symbol: { type: String, required: true },
      direction: {
        type: String,
        enum: ["BUY", "SELL"],
        required: true,
      },
      confidence: { type: Number, min: 0, max: 100 },
      entry: { type: Number, required: true },
      sl: { type: Number, required: true },
      tp: { type: Number, required: true },
      reason: String,
      timeframe: String,
      indicators: {
        rsi: Number,
        atr: Number,
      },
      pattern: String,
      primaryMethodology: { type: String },
      methodologyBreakdown: { type: Map, of: Schema.Types.Mixed },
    },

    executed: { type: Boolean, default: false },
    executionPrice: Number,
    executionTime: Date,
    mt5Ticket: { type: Number, index: true },
    positionSize: Number,

    closed: { type: Boolean, default: false },
    closedAt: Date,
    closePrice: Number,
    closeReason: {
      type: String,
      enum: ["TP_HIT", "SL_HIT", "MANUAL", "TIMEOUT", "SIGNAL"],
    },
    pnl: Number,
    pnlPips: Number,
    pnlPercent: Number,

    trailingHistory: [
      {
        time: Date,
        oldSL: Number,
        newSL: Number,
        price: Number,
      },
    ],

    analysisSnapshot: {
      trend: String,
      volatility: Number,
      support: [Number],
      resistance: [Number],
    },
  },
  {
    timestamps: true,
    collection: "ai_trade_logs",
  },
);

AITradeLogSchema.index({ userId: 1, createdAt: -1 });

export const AITradeLog =
  mongoose.models.AITradeLog ||
  mongoose.model<IAITradeLog>("AITradeLog", AITradeLogSchema);
