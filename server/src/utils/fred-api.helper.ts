import axios from "axios";
import { env } from "../config/env";

const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";

/**
 * Shared FRED API helper — reused by geo-risk.service and quant.service
 * Fetches the latest non-"." observation for any FRED series.
 * @param seriesId - FRED series ID (e.g., "DGS10")
 * @param limit    - how many observations to scan (default 12)
 */
export async function fredLatest(
  seriesId: string,
  limit = 12
): Promise<number | null> {
  if (!env.FRED_API_KEY) return null;
  try {
    const resp = await axios.get(FRED_BASE, {
      params: {
        series_id: seriesId,
        api_key: env.FRED_API_KEY,
        file_type: "json",
        sort_order: "desc",
        limit,
        observation_start: "2020-01-01",
      },
      timeout: 10000,
    });
    const obs: Array<{ value: string; date: string }> =
      resp.data?.observations ?? [];
    for (const o of obs) {
      if (o.value && o.value !== ".") {
        const parsed = parseFloat(o.value);
        if (!isNaN(parsed)) return parsed;
      }
    }
    return null;
  } catch (err: any) {
    console.warn(`[FRED] fetch failed for ${seriesId}:`, err.message);
    return null;
  }
}

/**
 * Fetch historical observation approximately `limit` trading days ago.
 */
export async function fredHistorical(
  seriesId: string,
  limit = 22
): Promise<number | null> {
  if (!env.FRED_API_KEY) return null;
  try {
    const resp = await axios.get(FRED_BASE, {
      params: {
        series_id: seriesId,
        api_key: env.FRED_API_KEY,
        file_type: "json",
        sort_order: "desc",
        limit,
        observation_start: "2020-01-01",
      },
      timeout: 10000,
    });
    const obs: Array<{ value: string; date: string }> =
      resp.data?.observations ?? [];
    const valid = obs.filter((o) => o.value && o.value !== ".");
    if (valid.length === 0) return null;
    
    // oldest in the window
    const oldest = valid[valid.length - 1];
    const parsed = parseFloat(oldest.value);
    if (!isNaN(parsed)) return parsed;
    return null;
  } catch (err: any) {
    console.warn(`[FRED] historical fetch failed for ${seriesId}:`, err.message);
    return null;
  }
}

/**
 * Fetch YoY change by comparing latest vs 12-month-ago observation.
 */
export async function fredYoY(seriesId: string): Promise<number | null> {
  if (!env.FRED_API_KEY) return null;
  try {
    const resp = await axios.get(FRED_BASE, {
      params: {
        series_id: seriesId,
        api_key: env.FRED_API_KEY,
        file_type: "json",
        sort_order: "desc",
        limit: 24,
      },
      timeout: 10000,
    });
    const obs: Array<{ value: string; date: string }> =
      resp.data?.observations ?? [];
    const valid = obs
      .filter((o) => o.value !== "." && !isNaN(parseFloat(o.value)))
      .map((o) => ({ value: parseFloat(o.value), date: o.date }));

    if (valid.length < 13) return null;

    const latest = valid[0].value;
    const latestDate = new Date(valid[0].date);
    const oneYearAgo = new Date(latestDate);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const yearAgoEntry = valid.find((entry) => {
      const entryDate = new Date(entry.date);
      return entryDate <= oneYearAgo;
    });

    if (!yearAgoEntry) return null;
    const yearAgo = yearAgoEntry.value;
    return parseFloat((((latest - yearAgo) / yearAgo) * 100).toFixed(2));
  } catch (err: any) {
    console.warn(`[FRED] YoY fetch failed for ${seriesId}:`, err.message);
    return null;
  }
}
