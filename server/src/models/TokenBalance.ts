import mongoose, { Schema, Document } from 'mongoose';

export interface ITokenBalance extends Document {
  user_id: mongoose.Types.ObjectId;
  balance: number;
  last_updated: Date;
  monthly_reset_date: Date;
  is_unlimited: boolean; // Premium = true
  refill_count: number; // Tracking berapa kali refill
}

const TokenBalanceSchema = new Schema<ITokenBalance>({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  balance: { type: Number, default: 0 },
  last_updated: { type: Date, default: Date.now },
  monthly_reset_date: { type: Date },
  is_unlimited: { type: Boolean, default: false },
  refill_count: { type: Number, default: 0 },
}, {
  timestamps: false,
  collection: "token_balances",
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

export const TokenBalance = mongoose.models.TokenBalance || mongoose.model<ITokenBalance>('TokenBalance', TokenBalanceSchema);
