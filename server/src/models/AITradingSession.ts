import mongoose, { Schema, Document } from "mongoose";

export interface IAITradingSession extends Document {
  userId: string;
  tradingAccountId: string;
  mt5Connected: boolean;
  mt5Server: string;
  mt5Login: string;
  pipelineConfig: {
    symbols: string[];
    timeframe: string;
    strategy: string;
    maxOpenPositions: number;
    maxRiskPerTrade: number;
    maxDailyRisk: number;
    tradingHours?: { start: string; end: string };
    trailingStop?: {
      enabled: boolean;
      activationATR: number;
      trailATR: number;
      breakEven: boolean;
    };
    entrySettings?: {
      atrMultiplierSL: number;
      atrMultiplierTP: number;
      rsiOversold: number;
      rsiOverbought: number;
    };
    // NEW: Methodology config
    methodologyWeights?: Record<string, number>;
    activeMethodologies?: string[];
    // NEW: LLM Consensus config
    llmConsensus?: {
      enabled: boolean;
      minProviders?: number;
      threshold?: number;
      providerTimeoutMs?: number;
    };
  };
  status: "STOPPED" | "RUNNING" | "PAUSED" | "ERROR";
  startedAt?: Date;
  stoppedAt?: Date;
  lastError?: string;
  metrics: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    totalPnL: number;
    maxDrawdown: number;
    dailyPnL: number;
    openPositions: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const AITradingSessionSchema = new Schema<IAITradingSession>(
  {
    userId: { type: String, required: true, index: true },
    tradingAccountId: { type: String },

    mt5Connected: { type: Boolean, default: false },
    mt5Server: { type: String },
    mt5Login: { type: String },

    pipelineConfig: {
      symbols: { type: [String], default: [] },
      timeframe: { type: String, default: "M15" },
      strategy: { type: String, default: "MULTI_METHODOLOGY" },
      maxOpenPositions: { type: Number, default: 3 },
      maxRiskPerTrade: { type: Number, default: 1.0 },
      maxDailyRisk: { type: Number, default: 3.0 },
      tradingHours: {
        start: String,
        end: String,
      },
      trailingStop: {
        type: {
          enabled: { type: Boolean, default: true },
          activationATR: { type: Number, default: 1.0 },
          trailATR: { type: Number, default: 0.5 },
          breakEven: { type: Boolean, default: false },
        },
        default: {},
      },
      entrySettings: {
        type: {
          atrMultiplierSL: { type: Number, default: 1.5 },
          atrMultiplierTP: { type: Number, default: 1.5 },
          rsiOversold: { type: Number, default: 30 },
          rsiOverbought: { type: Number, default: 70 },
        },
        default: {},
      },
      methodologyWeights: { type: Map, of: Number, default: {} },
      activeMethodologies: { type: [String], default: ["smc", "ict", "msnr", "crt", "quarterly", "lit", "rsiEngulf"] },
      llmConsensus: {
        type: {
          enabled: { type: Boolean, default: false },
          minProviders: { type: Number, default: 2 },
          threshold: { type: Number, default: 0.5 },
          providerTimeoutMs: { type: Number, default: 8000 },
        },
        default: {},
      },
    },

    status: {
      type: String,
      enum: ["STOPPED", "RUNNING", "PAUSED", "ERROR"],
      default: "STOPPED",
    },
    startedAt: Date,
    stoppedAt: Date,
    lastError: String,

    metrics: {
      totalTrades: { type: Number, default: 0 },
      winningTrades: { type: Number, default: 0 },
      losingTrades: { type: Number, default: 0 },
      totalPnL: { type: Number, default: 0 },
      maxDrawdown: { type: Number, default: 0 },
      dailyPnL: { type: Number, default: 0 },
      openPositions: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
    collection: "ai_trading_sessions",
  },
);

export const AITradingSession =
  mongoose.models.AITradingSession ||
  mongoose.model<IAITradingSession>(
    "AITradingSession",
    AITradingSessionSchema,
  );
