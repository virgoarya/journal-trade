import mongoose, { Schema, Document } from "mongoose";

export interface IUserSettings extends Document {
  userId: string;
  appearance: {
    theme: "dark" | "light" | "system";
    accentColor: string;
    soundEnabled: boolean;
  };
  notifications: {
    tradeAlerts: boolean;
    aiReviews: boolean;
    weeklyReports: boolean;
    achievements: boolean;
  };
}

const UserSettingsSchema = new Schema<IUserSettings>({
  userId: { type: String, required: true, unique: true, index: true },
  appearance: {
    theme: { type: String, enum: ["dark", "light", "system"], default: "dark" },
    accentColor: { type: String, default: "#D4AF37" },
    soundEnabled: { type: Boolean, default: true },
  },
  notifications: {
    tradeAlerts: { type: Boolean, default: true },
    aiReviews: { type: Boolean, default: true },
    weeklyReports: { type: Boolean, default: true },
    achievements: { type: Boolean, default: true },
  },
}, {
  timestamps: true,
  collection: "user_settings"
});

export const UserSettings = mongoose.models.UserSettings || mongoose.model<IUserSettings>("UserSettings", UserSettingsSchema);
