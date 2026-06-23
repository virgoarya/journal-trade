import mongoose, { Schema, Document } from "mongoose";

export interface IYieldCurveSnapshot extends Document {
  fetchedAt: Date;
  source: "api" | "cache";
  y3m: number | null;
  y2y: number | null;
  y5: number | null;
  y10: number | null;
  histY3m: number | null;
  histY2y: number | null;
  histY5: number | null;
  histY10: number | null;
  spread10y3m: number | null;
  spread10y2y: number | null;
  inverted: boolean;
  vix: number | null;
  vixSource: "yahoo" | "fred" | null;
  regime: "CALM" | "NORMAL-CAUTIOUS" | "ELEVATED" | "FEAR" | "UNKNOWN";
  curveRegime:
    | "Bear Steepener"
    | "Bull Steepener"
    | "Bear Flattener"
    | "Bull Flattener"
    | "Normal"
    | "Inverted"
    | "UNKNOWN";
  aiExplainer: string | null;
}

const YieldCurveSnapshotSchema = new Schema<IYieldCurveSnapshot>(
  {
    fetchedAt: { type: Date, required: true, default: Date.now },
    source: { type: String, enum: ["api", "cache"], default: "api" },
    y3m: { type: Number, default: null },
    y2y: { type: Number, default: null },
    y5: { type: Number, default: null },
    y10: { type: Number, default: null },
    histY3m: { type: Number, default: null },
    histY2y: { type: Number, default: null },
    histY5: { type: Number, default: null },
    histY10: { type: Number, default: null },
    spread10y3m: { type: Number, default: null },
    spread10y2y: { type: Number, default: null },
    inverted: { type: Boolean, default: false },
    vix: { type: Number, default: null },
    vixSource: { type: String, enum: ["yahoo", "fred"], default: null },
    regime: {
      type: String,
      enum: ["CALM", "NORMAL-CAUTIOUS", "ELEVATED", "FEAR", "UNKNOWN"],
      default: "UNKNOWN",
    },
    curveRegime: {
      type: String,
      enum: [
        "Bear Steepener",
        "Bull Steepener",
        "Bear Flattener",
        "Bull Flattener",
        "Normal",
        "Inverted",
        "UNKNOWN",
      ],
      default: "UNKNOWN",
    },
    aiExplainer: { type: String, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "yield_curve_snapshots",
  },
);

YieldCurveSnapshotSchema.index({ fetchedAt: -1 });

export const YieldCurveSnapshot =
  mongoose.models.YieldCurveSnapshot ||
  mongoose.model<IYieldCurveSnapshot>(
    "YieldCurveSnapshot",
    YieldCurveSnapshotSchema,
  );
