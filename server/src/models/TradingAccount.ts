import mongoose, { Schema, Document } from "mongoose";

export interface ITradingAccount extends Document {
  userId: string;
  accountName: string;
  initialBalance: number;
  currentEquity: number;
  currency: string;
  broker?: string;
  maxDailyDrawdownPct: number;
  maxTotalDrawdownPct: number;
  maxDailyTrades?: number;
  highWaterMark: number;
  isActive: boolean;
  onboardingCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TradingAccountSchema = new Schema<ITradingAccount>({
  userId: { type: String, required: true, index: true },
  accountName: { type: String, required: true },
  initialBalance: { type: Number, required: true },
  currentEquity: { type: Number, required: true },
  currency: { type: String, required: true, default: "USD" },
  broker: { type: String },
  maxDailyDrawdownPct: { type: Number, required: true, default: 5.00 },
  maxTotalDrawdownPct: { type: Number, required: true, default: 10.00 },
  maxDailyTrades: { type: Number },
  highWaterMark: { type: Number, required: true },
  isActive: { type: Boolean, required: true, default: true },
  onboardingCompleted: { type: Boolean, required: true, default: false }
}, {
  timestamps: true,
  collection: "trading_accounts"
});

export const TradingAccount = mongoose.models.TradingAccount || mongoose.model<ITradingAccount>("TradingAccount", TradingAccountSchema);
