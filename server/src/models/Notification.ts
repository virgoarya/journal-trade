import mongoose, { Schema, Document } from "mongoose";

export interface INotification extends Document {
  userId: string;
  type: "AI_REVIEW_READY" | "TRADE_LOGGED" | "RISK_WARNING" | "SYSTEM";
  title: string;
  message: string;
  link?: string;
  read: boolean;
  metadata?: any;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>({
  userId: { type: String, required: true, index: true },
  type: {
    type: String,
    enum: ["AI_REVIEW_READY", "TRADE_LOGGED", "RISK_WARNING", "SYSTEM"],
    required: true
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  link: { type: String },
  read: { type: Boolean, default: false },
  metadata: { type: Schema.Types.Mixed },
}, {
  timestamps: true,
  collection: "notifications",
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for efficient query
NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

export const Notification = mongoose.models.Notification || mongoose.model<INotification>("Notification", NotificationSchema);
