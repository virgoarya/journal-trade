import mongoose, { Schema, Document } from "mongoose";

export interface IYieldCurveSnapshot extends Document {
  fetchedAt: Date;
  source: "api" | "cache";
  y3m: number | null;
  y2y: number | null;
  y5: number | null;
  y10: number | null;
  y30: number | null;
  spread10y3m: number | null;
  spread10y2y: number | null;
  spread30y5y: number | null;
  inverted: boolean;
  vix: number | null;
  regime: "CALM" | "NORMAL" | "ELEVATED" | "FEAR" | "UNKNOWN";
}

const YieldCurveSnapshotSchema = new Schema<IYieldCurveSnapshot>(
  {
    fetchedAt: { type: Date, required: true, default: Date.now },
    source: { type: String, enum: ["api", "cache"], default: "api" },
    y3m: { type: Number, default: null },
    y2y: { type: Number, default: null },
    y5: { type: Number, default: null },
    y10: { type: Number, default: null },
    y30: { type: Number, default: null },
    spread10y3m: { type: Number, default: null },
    spread10y2y: { type: Number, default: null },
    spread30y5y: { type: Number, default: null },
    inverted: { type: Boolean, default: false },
    vix: { type: Number, default: null },
    regime: {
      type: String,
      enum: ["CALM", "NORMAL", "ELEVATED", "FEAR", "UNKNOWN"],
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
