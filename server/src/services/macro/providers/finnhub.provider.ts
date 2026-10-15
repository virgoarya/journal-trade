/**
 * Finnhub news provider (butuh API key — opsional).
 * Spec: docs/design/macro-data-layer-spec.md §3
 */
import axios from "axios";
import { silentLogger } from "../../../utils/silent-logger";
import { env } from "../../../config/env";
import type { INewsProvider, NewsItem } from "./types";

export const finnhubNewsProvider: INewsProvider = {
  name: "finnhub",

  async fetchNews(limit: number): Promise<NewsItem[]> {
    const key = env.FINNHUB_API_KEY;
    if (!key) return [];

    try {
      const resp = await axios.get(
        "https://finnhub.io/api/v1/news",
        { params: { category: "general", token: key }, timeout: 12_000 }
      );

      return (resp.data ?? [])
        .slice(0, limit)
        .map((item: any) => ({
          id: item.id,
          datetime: item.datetime,
          headline: item.headline,
          summary: item.summary,
          source: "Finnhub",
        }));
    } catch (error: any) {
      silentLogger.warn(`[News/Finnhub] gagal: ${error.message}`);
      return [];
    }
  },
};
