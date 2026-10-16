import mongoose, { Schema, Document } from "mongoose";

export type EmotionTag =
  | "FOMO"
  | "REVENGE"
  | "GREEDY"
  | "FEAR"
  | "CONFIDENT"
  | "CALM"
  | "HESITANT";

export type TradeType = "market" | "pending" | "ai-auto";

export type TradingSession = "ASIA" | "LONDON" | "NEW_YORK" | "OVERLAP";

export interface ITradeEmotion extends Document {
  userId: string;
  tradeId: string; // MT5 ticket atau AI trade log ID
  tradeType: TradeType;
  emotionTag: EmotionTag;
  notes?: string;
  timestamp: Date;
  pnl: number;
  symbol: string;
  timeframe: string;
  session: TradingSession;
  // Computed fields
  rMultiple?: number; // pnl / risk
  holdDurationMinutes?: number;
  // Market context from trade log (user input)
  marketContext?: {
    spread?: number;
    volatility?: number;
    trend?: string;
    support?: number[];
    resistance?: number[];
  };
  createdAt: Date;
  updatedAt: Date;
}

const TradeEmotionSchema = new Schema<ITradeEmotion>(
  {
    userId: { type: String, required: true, index: true },
    tradeId: { type: String, required: true, index: true },
    tradeType: {
      type: String,
      enum: ["market", "pending", "ai-auto"],
      required: true,
    },
    emotionTag: {
      type: String,
      enum: ["FOMO", "REVENGE", "GREEDY", "FEAR", "CONFIDENT", "CALM", "HESITANT"],
      required: true,
    },
    notes: { type: String },
    timestamp: { type: Date, required: true, index: true },
    pnl: { type: Number, required: true },
    symbol: { type: String, required: true },
    timeframe: { type: String, required: true },
    session: {
      type: String,
      enum: ["ASIA", "LONDON", "NEW_YORK", "OVERLAP"],
      required: true,
    },
    rMultiple: { type: Number },
    holdDurationMinutes: { type: Number },
    marketContext: {
      spread: Number,
      volatility: Number,
      trend: String,
      support: [Number],
      resistance: [Number],
    },
  },
  {
    timestamps: true,
    collection: "trade_emotions",
  }
);

// Compound indexes for common queries
TradeEmotionSchema.index({ userId: 1, timestamp: -1 });
TradeEmotionSchema.index({ userId: 1, emotionTag: 1, timestamp: -1 });
TradeEmotionSchema.index({ userId: 1, symbol: 1, timestamp: -1 });
TradeEmotionSchema.index({ tradeId: 1, userId: 1 }, { unique: true }); // One emotion per trade

export const TradeEmotion =
  mongoose.models.TradeEmotion ||
  mongoose.model<ITradeEmotion>("TradeEmotion", TradeEmotionSchema);