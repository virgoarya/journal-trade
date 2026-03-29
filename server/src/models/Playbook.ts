import mongoose, { Schema, Document } from "mongoose";

export interface IPlaybook extends Document {
  userId: string;
  name: string;
  description?: string;
  applicablePairs: string[];
  session?: string;
  tags: string[];
  rules: string[]; // Embedded array rather than separate table
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PlaybookSchema = new Schema<IPlaybook>({
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  description: { type: String },
  applicablePairs: { type: [String], default: [] },
  session: { type: String },
  tags: { type: [String], default: [] },
  rules: { type: [String], default: [] },
  isArchived: { type: Boolean, required: true, default: false }
}, {
  timestamps: true,
  collection: "playbooks"
});

export const Playbook = mongoose.models.Playbook || mongoose.model<IPlaybook>("Playbook", PlaybookSchema);
