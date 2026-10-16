/**
 * @deprecated Import from "./macro/macro-data.service" instead.
 * This file is a thin re-export to maintain backward compatibility.
 * Spec: docs/design/macro-data-layer-spec.md §11
 */
export {
  macroDataService,
} from "./macro/macro-data.service";

// Re-export types for backward compatibility
export type { MarketQuote, EconomicEvent, NewsItem, LiquidityData } from "./macro/providers/types";
