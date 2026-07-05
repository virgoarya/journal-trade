import mongoose, { Schema, Document } from "mongoose";

// ── Interface ─────────────────────────────────────────────────────────────────
export interface IMacroIndicator extends Document {
  indicatorName: string; // e.g. "ISM Manufacturing PMI"
  country: string; // e.g. "US"
  actualValue: number;
  releaseDate: Date;
  updatedAt: Date;
}

// ── Schema ────────────────────────────────────────────────────────────────────
const MacroIndicatorSchema = new Schema<IMacroIndicator>(
  {
    indicatorName: { type: String, required: true },
    country: { type: String, required: true },
    actualValue: { type: Number, required: true },
    releaseDate: { type: Date, required: true },
  },
  {
    timestamps: true, // Will add createdAt and updatedAt
    collection: "macro_indicators",
  },
);

// We want fast lookup by indicator name and country
MacroIndicatorSchema.index({ indicatorName: 1, country: 1 }, { unique: true });
MacroIndicatorSchema.index({ releaseDate: -1 });

export const MacroIndicator =
  mongoose.models.MacroIndicator ||
  mongoose.model<IMacroIndicator>("MacroIndicator", MacroIndicatorSchema);
