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
  bio?: string;
  discordWebhook?: string;
  apiKey?: string;
  riskTier?: "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE" | "SPECULATIVE";
  defaultRiskPercent?: number;
  riskNotificationEnabled?: boolean;
  mt5Config?: {
    server: string;
    login: string;
    password: string;
  };
  sourcePreference: "manual" | "mt5";
  lastMt5SyncAt?: Date;
  mt5AutoSyncEnabled?: boolean;
  mt5SyncIntervalMinutes?: number;
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
  onboardingCompleted: { type: Boolean, required: true, default: false },
  bio: { type: String, default: "" },
  discordWebhook: { type: String, default: "" },
  apiKey: { type: String, unique: true, sparse: true },
  riskTier: {
    type: String,
    enum: ["CONSERVATIVE", "MODERATE", "AGGRESSIVE", "SPECULATIVE"],
    default: "MODERATE"
  },
  defaultRiskPercent: {
    type: Number,
    min: 0.1,
    max: 10,
    default: 1.0
  },
  riskNotificationEnabled: {
    type: Boolean,
    default: true
  },
  mt5Config: {
    server: { type: String },
    login: { type: String },
    password: { type: String }
  },
  sourcePreference: {
    type: String,
    enum: ["manual", "mt5"],
    default: "manual"
  },
  lastMt5SyncAt: { type: Date },
  mt5AutoSyncEnabled: {
    type: Boolean,
    default: false
  },
  mt5SyncIntervalMinutes: {
    type: Number,
    min: 1,
    max: 60,
    default: 5
  }
}, {
  timestamps: true,
  collection: "trading_accounts",
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

export const TradingAccount = mongoose.models.TradingAccount || mongoose.model<ITradingAccount>("TradingAccount", TradingAccountSchema);
