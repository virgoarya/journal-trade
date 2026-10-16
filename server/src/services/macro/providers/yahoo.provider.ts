/**
 * Yahoo Finance provider — primary source for quotes.
 * Spec: docs/design/macro-data-layer-spec.md §4.1
 */
import axios from "axios";
import { IQuoteProvider, MarketQuote } from "./types";

const YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

export const yahooProvider: IQuoteProvider = {
  name: "yahoo",

  async fetchQuotes(symbols: string[]): Promise<MarketQuote[]> {
    const fetchWithTimeout = (symbol: string) =>
      Promise.race([
        axios.get(`${YAHOO_BASE}/${symbol}`, { timeout: 3000 }).then((res) => {
          const result = res.data?.chart?.result?.[0];
          const price = result?.meta?.regularMarketPrice;
          const prevClose = result?.meta?.chartPreviousClose ?? result?.meta?.previousClose;
          if (price != null) {
            const change = prevClose != null ? price - prevClose : 0;
            const changePercent =
              prevClose != null && prevClose !== 0 ? (change / prevClose) * 100 : 0;
            return { symbol, price, change, changePercent, timestamp: Date.now() };
          }
          return { symbol, price: null, change: null, changePercent: null, timestamp: 0 };
        }),
        new Promise<any>((resolve) =>
          setTimeout(
            () => resolve({ symbol, price: null, change: null, changePercent: null, timestamp: 0 }),
            2000
          )
        ),
      ]).catch(() => ({
        symbol,
        price: null,
        change: null,
        changePercent: null,
        timestamp: 0,
      }));

    return Promise.all(symbols.map(fetchWithTimeout));
  },
};
