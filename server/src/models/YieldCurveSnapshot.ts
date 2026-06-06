import mongoose, { Schema, Document } from "mongoose";

export interface IYieldCurveSnapshot extends Document {
  fetchedAt: Date;
  source: "api" | "cache";
  y2: number | null;
  y5: number | null;
  y10: number | null;
  spread2y10y: number | null;
  inverted: boolean;
  vix: number | null;
  regime: "GOLDILOCKS" | "STAGFLATION" | "DEFLATION" | "REFLATION" | "TRANSITION" | "UNKNOWN";
}

const YieldCurveSnapshotSchema = new Schema<IYieldCurveSnapshot>(
  {
    fetchedAt: { type: Date, required: true, default: Date.now },
    source: { type: String, enum: ["api", "cache"], default: "api" },
    y2: { type: Number, default: null },
    y5: { type: Number, default: null },
    y10: { type: Number, default: null },
    spread2y10y: { type: Number, default: null },
    inverted: { type: Boolean, default: false },
    vix: { type: Number, default: null },
    regime: { 
      type: String, 
      enum: ["GOLDILOCKS", "STAGFLATION", "DEFLATION", "REFLATION", "TRANSITION", "UNKNOWN"],
      default: "UNKNOWN" 
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "yield_curve_snapshots",
  }
);

YieldCurveSnapshotSchema.index({ fetchedAt: -1 });

export const YieldCurveSnapshot =
  mongoose.models.YieldCurveSnapshot ||
  mongoose.model<IYieldCurveSnapshot>("YieldCurveSnapshot", YieldCurveSnapshotSchema);
