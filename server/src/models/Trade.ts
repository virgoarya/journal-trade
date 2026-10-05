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
  rMultiple?: number; // actual R-multiple (based on actual P&L)
  plannedRMultiple?: number; // planned R-multiple (based on TP/SL)
  result: "WIN" | "LOSS" | "BREAKEVEN";
  emotionalState?: number;
  notes?: string;
  chartLink?: string;
  exitDate?: Date;
  // New fields for playbook matching
  marketCondition?: "TRENDING" | "RANGING" | "VOLATILE" | "LIQUID" | "ALL";
  session?: "Asia" | "London" | "NY AM" | "NY PM" | "Other";
  riskPercent?: number;
  source: "manual" | "mt5";
  mt5TicketId?: string;
  sizeUnit: "LOT" | "CONTRACT"; // Added
  sizeType?: "standard" | "micro" | "mini"; // Added: for Futures CME/COMEX
  mt5OrderId?: number;
  // Institutional Prop-firm fields
  grossPnl?: number;
  commission?: number;
  swap?: number;
  maeR?: number;
  mfeR?: number;
  worstPriceReached?: number;
  bestPriceReached?: number;
  ruleViolations?: string[];
  macroSnapshot?: {
    regime?: string;
    liquidityRisk?: string;
    vix?: number;
    yieldCurveSpread?: number;
    capturedAt?: Date;
  };
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
    plannedRMultiple: { type: Number },
    sizeUnit: { type: String, enum: ["LOT", "CONTRACT"], default: "LOT" },
      sizeType: { type: String, enum: ["standard", "micro", "mini"], default: "standard" },
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
    enum: ["Asia", "London", "NY AM", "NY PM", "Other", "NY"]
  },
  riskPercent: { type: Number, min: 0, max: 100 },
  source: {
    type: String,
    enum: ["manual", "mt5"],
    default: "manual"
  },
  mt5TicketId: { type: String },
  mt5OrderId: { type: Number },
  // Institutional Prop-firm fields
  grossPnl: { type: Number },
  commission: { type: Number, default: 0 },
  swap: { type: Number, default: 0 },
  maeR: { type: Number },
  mfeR: { type: Number },
  worstPriceReached: { type: Number },
  bestPriceReached: { type: Number },
  ruleViolations: [{ type: String, enum: [
    "Moved SL", "Overleveraged", "Revenge Trade", "FOMO Entry",
    "Exited Early", "Skipped SL", "Ignored Playbook", "Overtraded"
  ]}],
  macroSnapshot: {
    regime: { type: String },
    liquidityRisk: { type: String },
    vix: { type: Number },
    yieldCurveSpread: { type: Number },
    capturedAt: { type: Date },
  },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletionReason: { type: String }
}, {
  timestamps: true,
  collection: "trades",
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

TradeSchema.index({ userId: 1, tradingAccountId: 1, isDeleted: 1, tradeDate: -1 });

export const Trade = mongoose.models.Trade || mongoose.model<ITrade>("Trade", TradeSchema);
