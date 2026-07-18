// ─── Strategy Modules Barrel Export ──────────────────────────────────

export { marketStructureService } from "./market-structure.service";
export type {
  Candle,
  MarketStructure,
  SwingHigh,
  SwingLow,
  OrderBlock,
  BreakerBlock,
  FVG,
  KeyLevel,
  LiquidityZone,
  Trend,
  CandleRangeAnalysis,
  KillzoneType,
} from "./market-structure.service";

export { smcStrategy } from "./smc.strategy";
export type { SMCSignal, SMCAnalysis } from "./smc.strategy";

export { ictStrategy } from "./ict.strategy";
export type { ICTSignal, ICTAnalysis } from "./ict.strategy";

export { msnrStrategy } from "./msnr.strategy";
export type { MSNRSignal, MSNRAnalysis } from "./msnr.strategy";





export { confluenceEngine } from "./confluence-engine";
export type {
  ConfluenceResult,
  MethodologyWeights,
  MethodologyName,
  MethodologySignal,
  MethodologyBreakdown,
  MethodologyDirection,
} from "./confluence-engine";
export { DEFAULT_METHODOLOGY_WEIGHTS } from "./confluence-engine";

export { atrService } from "./atr.service";
