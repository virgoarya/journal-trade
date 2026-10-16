import mongoose, { Schema, Document } from 'mongoose';

export interface ISubscription extends Document {
  user_id: mongoose.Types.ObjectId;
  plan: string; // 'basic', 'premium', 'enterprise'
  status: string; // 'active', 'cancelled', 'expired'
  start_date: Date;
  end_date: Date;
  auto_renew: boolean;
  created_at: Date;
  updated_at: Date;
}

const SubscriptionSchema = new Schema<ISubscription>({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  plan: { type: String, enum: ['basic', 'premium', 'enterprise'], default: 'basic' },
  status: { type: String, enum: ['active', 'cancelled', 'expired'], default: 'active' },
  start_date: { type: Date, default: Date.now },
  end_date: { type: Date },
  auto_renew: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
}, {
  timestamps: false,
  collection: "subscriptions",
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

export const Subscription = mongoose.models.Subscription || mongoose.model<ISubscription>('Subscription', SubscriptionSchema);
