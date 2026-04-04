import mongoose, { Schema, Document } from "mongoose";

export interface ITrade extends Document {
  userId: string;
  tradingAccountId: mongoose.Types.ObjectId;
  playbookId?: mongoose.Types.ObjectId;
  tradeDate: Date;
  pair: string;
  direction: "LONG" | "SHORT";
  entryPrice: number;
  stopLoss: number;
  takeProfit?: number;
  lotSize: number;
  actualPnl: number;
  rMultiple?: number;
  result: "WIN" | "LOSS" | "BREAKEVEN";
  emotionalState?: number;
  notes?: string;
  chartLink?: string;
  exitDate?: Date;
  // New fields for playbook matching
  marketCondition?: "TRENDING" | "RANGING" | "VOLATILE" | "LIQUID" | "ALL";
  session?: "Asia" | "London" | "NY" | "Sydney" | "Other";
  riskPercent?: number; // Risk exposure as percentage of account equity
  // Soft delete
  isDeleted?: boolean;
  deletedAt?: Date;
  deletionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TradeSchema = new Schema<ITrade>({
  userId: { type: String, required: true, index: true },
  tradingAccountId: { type: Schema.Types.ObjectId, ref: "TradingAccount", required: true, index: true },
  playbookId: { type: Schema.Types.ObjectId, ref: "Playbook" },
  tradeDate: { type: Date, required: true, index: true },
  pair: { type: String, required: true },
  direction: { type: String, enum: ["LONG", "SHORT"], required: true },
  entryPrice: { type: Number, required: true },
  stopLoss: { type: Number, required: true },
  takeProfit: { type: Number },
  lotSize: { type: Number, required: true },
  actualPnl: { type: Number, required: true },
  rMultiple: { type: Number },
  result: { type: String, enum: ["WIN", "LOSS", "BREAKEVEN"], required: true },
  emotionalState: { type: Number, min: 1, max: 5 },
  notes: { type: String },
  chartLink: { type: String },
  exitDate: { type: Date },
  marketCondition: {
    type: String,
    enum: ["TRENDING", "RANGING", "VOLATILE", "LIQUID", "ALL"],
    default: "ALL"
  },
  session: {
    type: String,
    enum: ["Asia", "London", "NY", "Sydney", "Other"]
  },
  riskPercent: { type: Number, min: 0, max: 100 },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletionReason: { type: String }
}, {
  timestamps: true,
  collection: "trades",
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

export const Trade = mongoose.models.Trade || mongoose.model<ITrade>("Trade", TradeSchema);
