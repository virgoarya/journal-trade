import mongoose, { Schema, Document } from "mongoose";

// ── Interface ─────────────────────────────────────────────────────────────────
export interface IGeoRiskSnapshot extends Document {
  fetchedAt: Date;
  source: "api" | "cache";
  // Raw API values
  cpi_yoy: number | null; // US CPI YoY (inflation)
  fedfunds_rate: number | null; // Fed Funds Rate
  vix: number | null; // VIX (fear index → geopolitics proxy)
  vixSource: "yahoo" | "fred" | null;
  globalPmi: number | null; // Global Manufacturing PMI (supply chain)
  onRrpBalance: number | null; // Fed ON RRP balance (liquidity drain)
  // Derived scores 0–100
  scores: {
    inflation: number;
    rateHike: number;
    geopolitics: number;
    supplyChain: number;
    liquidityDrain: number;
  };
}

// ── Schema ────────────────────────────────────────────────────────────────────
const GeoRiskSnapshotSchema = new Schema<IGeoRiskSnapshot>(
  {
    fetchedAt: { type: Date, required: true, default: Date.now },
    source: { type: String, enum: ["api", "cache"], default: "api" },
    cpi_yoy: { type: Number, default: null },
    fedfunds_rate: { type: Number, default: null },
    vix: { type: Number, default: null },
    vixSource: { type: String, enum: ["yahoo", "fred"], default: null },
    globalPmi: { type: Number, default: null },
    onRrpBalance: { type: Number, default: null },
    scores: {
      inflation: { type: Number, required: true },
      rateHike: { type: Number, required: true },
      geopolitics: { type: Number, required: true },
      supplyChain: { type: Number, required: true },
      liquidityDrain: { type: Number, required: true },
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "geo_risk_snapshots",
  },
);

// Keep only last 180 days worth of snapshots (1 per hour = 4320 max docs)
GeoRiskSnapshotSchema.index({ fetchedAt: -1 });

export const GeoRiskSnapshot =
  mongoose.models.GeoRiskSnapshot ||
  mongoose.model<IGeoRiskSnapshot>("GeoRiskSnapshot", GeoRiskSnapshotSchema);
