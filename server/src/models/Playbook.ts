import mongoose, { Schema, Document } from "mongoose";

export interface IPlaybook extends Document {
  userId: string;
  name: string;
  description?: string;
  markets: string[]; // formerly applicablePairs
  timeframe?: string;
  category?: "breakout" | "reversal" | "scalping" | "swing" | "news";
  tags: string[];
  rules: string[];
  isArchived: boolean;
  avgRr?: number; // Computed field
  createdAt: Date;
  updatedAt: Date;
}

const PlaybookSchema = new Schema<IPlaybook>({
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  description: { type: String },
  markets: { type: [String], default: [] }, // renamed from applicablePairs
  timeframe: { type: String },
  category: { type: String, enum: ["breakout", "reversal", "scalping", "swing", "news"] },
  tags: { type: [String], default: [] },
  rules: { type: [String], default: [] },
  isArchived: { type: Boolean, required: true, default: false },
  avgRr: { type: Number, default: 0 } // cached/computed value
}, {
  timestamps: true,
  collection: "playbooks"
});

export const Playbook = mongoose.models.Playbook || mongoose.model<IPlaybook>("Playbook", PlaybookSchema);
