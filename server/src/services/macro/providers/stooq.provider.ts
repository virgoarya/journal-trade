/**
 * Stooq provider — fallback 2 for quotes.
 * Spec: docs/design/macro-data-layer-spec.md §4.1
 */
import axios from "axios";
import { IQuoteProvider, MarketQuote } from "./types";

const STOOQ_BASE = "https://stooq.com/q/l";

export const stooqProvider: IQuoteProvider = {
  name: "stooq",

  async fetchQuotes(symbols: string[]): Promise<MarketQuote[]> {
    const fetchOne = async (symbol: string): Promise<MarketQuote> => {
      try {
        const stooqSym = symbol.replace("^", "").replace("=", "");
        const resp = await axios.get(
          `${STOOQ_BASE}/?s=${encodeURIComponent(stooqSym)}&f=sd2t2ohlcv&h&e=json`,
          { timeout: 5000 }
        );
        const data = resp.data?.symbols?.[0];
        const price = data?.close != null ? parseFloat(data.close) : null;
        const open = data?.open != null ? parseFloat(data.open) : null;

        if (price != null) {
          const change = open != null ? price - open : null;
          const changePercent = open != null && open !== 0 ? (change! / open) * 100 : null;
          return { symbol, price, change, changePercent, timestamp: Date.now() };
        }
      } catch {
        // fall through
      }
      return { symbol, price: null, change: null, changePercent: null, timestamp: 0 };
    };

    return Promise.all(symbols.map(fetchOne));
  },
};
