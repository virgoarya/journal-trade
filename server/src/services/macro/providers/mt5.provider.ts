/**
 * MT5 MCP provider — fallback 1 for quotes.
 * Spec: docs/design/macro-data-layer-spec.md §4.1
 */
import { mt5McpService } from "../../mt5-mcp.service";
import { mt5StreamCache } from "../../../mt5-streamer";
import { IQuoteProvider, MarketQuote } from "./types";

export const mt5Provider: IQuoteProvider = {
  name: "mt5",

  async fetchQuotes(symbols: string[]): Promise<MarketQuote[]> {
    if (!mt5StreamCache.isConnected()) {
      return symbols.map((symbol) => ({
        symbol,
        price: null,
        change: null,
        changePercent: null,
        timestamp: 0,
      }));
    }

    return Promise.all(
      symbols.map(async (symbol): Promise<MarketQuote> => {
        try {
          const tick = await mt5McpService.getTick(symbol);
          if (tick && tick.bid > 0) {
            return {
              symbol,
              price: tick.bid,
              change: null,
              changePercent: null,
              timestamp: tick.time ? tick.time * 1000 : Date.now(),
            };
          }
        } catch {
          // fall through to null
        }
        return { symbol, price: null, change: null, changePercent: null, timestamp: 0 };
      })
    );
  },
};
