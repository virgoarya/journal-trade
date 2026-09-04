import mongoose, { Schema, Document } from 'mongoose';

export interface IRegistration extends Document {
  user_id: mongoose.Types.ObjectId;
  discord_id: string;
  username: string;
  email: string;
  created_at: Date;
  updated_at: Date;
  is_booster: boolean;
  booster_expiry?: Date;
  registration_status: string; // 'pending', 'active', 'failed'
  registration_paid_at?: Date;
  plan: string; // 'basic', 'pro', 'premium'
  access_start_date?: Date; // Aktif saat pipeline run pertama kali
  access_end_date?: Date; // Kalkulasi: start_date + durasi paket
  is_lifetime: boolean; // Premium = true
  ea_active_until?: Date; // Free EA 1 bulan (Premium/Pro)
}

const RegistrationSchema = new Schema<IRegistration>({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  discord_id: { type: String, required: true, index: true },
  username: { type: String, required: true },
  email: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  is_booster: { type: Boolean, default: false },
  booster_expiry: { type: Date },
  registration_status: { type: String, enum: ['pending', 'active', 'failed'], default: 'pending' },
  registration_paid_at: { type: Date },
  plan: { type: String, enum: ['basic', 'pro', 'premium'], default: 'basic' },
  access_start_date: { type: Date },
  access_end_date: { type: Date },
  is_lifetime: { type: Boolean, default: false },
  ea_active_until: { type: Date },
}, {
  timestamps: false, // Using explicit timestamps fields
  collection: "registrations",
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

export const Registration = mongoose.models.Registration || mongoose.model<IRegistration>('Registration', RegistrationSchema);
