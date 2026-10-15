/**
 * FRED provider — primary for yield curve & ON RRP series.
 * Spec: docs/design/macro-data-layer-spec.md §4.2
 */
import axios from "axios";
import { env } from "../../../config/env";
import { ISeriesProvider, FredObservation } from "./types";

const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";

export const fredProvider: ISeriesProvider = {
  name: "fred",

  async fetchSeries(
    seriesId: string,
    options?: { limit?: number; sortOrder?: "asc" | "desc" }
  ): Promise<FredObservation[]> {
    const fredKey = env.FRED_API_KEY;
    if (!fredKey) return [];

    const limit = options?.limit ?? 1;
    const sortOrder = options?.sortOrder ?? "desc";

    const resp = await axios.get(FRED_BASE, {
      params: {
        series_id: seriesId,
        api_key: fredKey,
        file_type: "json",
        sort_order: sortOrder,
        limit,
      },
      timeout: 5000,
    });

    const observations = resp.data?.observations ?? [];
    return observations
      .map((obs: any) => ({
        date: obs.date,
        value: parseFloat(obs.value),
      }))
      .filter((item: FredObservation) => !Number.isNaN(item.value));
  },
};
