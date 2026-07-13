import mongoose, { Schema, Document } from "mongoose";

export type MethodologyName = "smc" | "ict" | "msnr" | "crt" | "quarterly" | "lit" | "rsiEngulf";

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
  // NEW: AI Trading preferences
  aiTrading: {
    methodologyWeights: Record<MethodologyName, number>;
    activeMethodologies: MethodologyName[];
    llmConsensus: {
      enabled: boolean;
      minProviders: number;
      threshold: number;
      providerTimeoutMs: number;
    };
  };
}

const DEFAULT_METHODOLOGY_WEIGHTS: Record<MethodologyName, number> = {
  smc: 1.0,
  ict: 1.0,
  msnr: 0.8,
  crt: 0.8,
  quarterly: 0.6,
  lit: 1.0,
  rsiEngulf: 0.5,
};

const DEFAULT_ACTIVE_METHODOLOGIES: MethodologyName[] = [
  "smc", "ict", "msnr", "crt", "quarterly", "lit", "rsiEngulf"
];

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
  // NEW: AI Trading preferences
  aiTrading: {
    methodologyWeights: {
      type: Map,
      of: Number,
      default: () => DEFAULT_METHODOLOGY_WEIGHTS,
    },
    activeMethodologies: {
      type: [String],
      enum: ["smc", "ict", "msnr", "crt", "quarterly", "lit", "rsiEngulf"],
      default: () => DEFAULT_ACTIVE_METHODOLOGIES,
    },
    llmConsensus: {
      enabled: { type: Boolean, default: false },
      minProviders: { type: Number, default: 2 },
      threshold: { type: Number, default: 0.5 },
      providerTimeoutMs: { type: Number, default: 8000 },
    },
  },
}, {
  timestamps: true,
  collection: "user_settings"
});

export const UserSettings = mongoose.models.UserSettings || mongoose.model<IUserSettings>("UserSettings", UserSettingsSchema);
export { DEFAULT_METHODOLOGY_WEIGHTS, DEFAULT_ACTIVE_METHODOLOGIES };
