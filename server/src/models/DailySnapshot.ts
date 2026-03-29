import mongoose, { Schema, Document } from "mongoose";

export interface IDailySnapshot extends Document {
  tradingAccountId: mongoose.Types.ObjectId;
  userId: string;
  snapshotDate: Date;
  openingEquity: number;
  closingEquity: number;
  dailyPnl: number;
  dailyDrawdownPct: number;
  totalDrawdownPct: number;
  tradeCount: number;
  winCount: number;
  lossCount: number;
  createdAt: Date;
}

const DailySnapshotSchema = new Schema<IDailySnapshot>({
  tradingAccountId: { type: Schema.Types.ObjectId, ref: "TradingAccount", required: true },
  userId: { type: String, required: true, index: true },
  snapshotDate: { type: Date, required: true },
  openingEquity: { type: Number, required: true },
  closingEquity: { type: Number, required: true },
  dailyPnl: { type: Number, required: true },
  dailyDrawdownPct: { type: Number, required: true },
  totalDrawdownPct: { type: Number, required: true },
  tradeCount: { type: Number, default: 0 },
  winCount: { type: Number, default: 0 },
  lossCount: { type: Number, default: 0 }
}, {
  timestamps: { createdAt: true, updatedAt: false },
  collection: "daily_snapshots"
});

// Index to ensure 1 snapshot per account per date
DailySnapshotSchema.index({ tradingAccountId: 1, snapshotDate: 1 }, { unique: true });

export const DailySnapshot = mongoose.models.DailySnapshot || mongoose.model<IDailySnapshot>("DailySnapshot", DailySnapshotSchema);
