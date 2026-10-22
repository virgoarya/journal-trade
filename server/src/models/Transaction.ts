import mongoose, { Schema, Document } from 'mongoose';

export interface ITransaction extends Document {
  user_id: mongoose.Types.ObjectId;
  type: string; // 'registration', 'token_topup', 'consumption', 'refund'
  amount: number;
  currency: string; // 'IDR', 'USD'
  status: string; // 'completed', 'pending', 'failed'
  reference_id: string; // Midtrans transaction ID
  order_id?: string; // Midtrans order ID; unique when present
  created_at: Date;
  updated_at: Date;
  description: string;
}

const TransactionSchema = new Schema<ITransaction>({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['registration', 'token_topup', 'package', 'consumption', 'refund'], required: true },
  amount: { type: Number, required: true },
  currency: { type: String, enum: ['IDR', 'USD'], default: 'IDR' },
  status: { type: String, enum: ['completed', 'pending', 'failed'], default: 'pending' },
  reference_id: { type: String, required: true, index: true },
  order_id: { type: String },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  description: { type: String },
}, {
  timestamps: false,
  collection: "transactions",
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

TransactionSchema.index(
  { order_id: 1 },
  { unique: true, partialFilterExpression: { order_id: { $exists: true, $type: "string" } } }
);

export const Transaction = mongoose.models.Transaction || mongoose.model<ITransaction>('Transaction', TransactionSchema);