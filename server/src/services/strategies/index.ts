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
  QuarterlyPivot,
} from "./market-structure.service";

export { smcStrategy } from "./smc.strategy";
export type { SMCSignal, SMCAnalysis } from "./smc.strategy";

export { ictStrategy } from "./ict.strategy";
export type { ICTSignal, ICTAnalysis, KillzoneType } from "./ict.strategy";

export { msnrStrategy } from "./msnr.strategy";
export type { MSNRSignal, MSNRAnalysis } from "./msnr.strategy";

export { crtStrategy } from "./crt.strategy";
export type { CRTSignal, CRTAnalysis } from "./crt.strategy";

export { quarterlyTheoryStrategy } from "./quarterly.strategy";
export type { QuarterlySignal, QuarterlyAnalysis } from "./quarterly.strategy";

export { litStrategy } from "./lit.strategy";
export type { LITSignal, LITAnalysis } from "./lit.strategy";

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
