/**
 * Candles provider — Yahoo Finance (primary) + Stooq (fallback).
 * Spec: docs/design/macro-charting-and-palette-spec.md §5.2
 *
 * Kedua provider mengembalikan `CandleData[]` (timestamp detik, OHLCV) dan
 * TIDAK melempar error: kegagalan mengembalikan array kosong agar fallback
 * chain bisa lanjut.
 */
import axios from "axios";
import { silentLogger } from "../../../utils/silent-logger";
import { CandleData, ICandleProvider } from "./types";

const YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const STOOQ_BASE = "https://stooq.com/q/d/l/";

// ─────────────────────────────────────────────────────────────────────────────
// TIMEFRAMES
// ─────────────────────────────────────────────────────────────────────────────

export type ChartTimeframe = "1D" | "5D" | "1M" | "3M" | "6M" | "1Y" | "5Y" | "MAX";

export const CHART_TIMEFRAMES: readonly ChartTimeframe[] = [
  "1D", "5D", "1M", "3M", "6M", "1Y", "5Y", "MAX",
] as const;

export function isValidTimeframe(tf: string): tf is ChartTimeframe {
  return (CHART_TIMEFRAMES as readonly string[]).includes(tf);
}

/** Mapping timeframe → { range, interval } untuk Yahoo Finance. */
export function mapTimeframeToYahoo(tf: ChartTimeframe): { range: string; interval: string } {
  switch (tf) {
    case "1D":  return { range: "1d",  interval: "1m" };
    case "5D":  return { range: "5d",  interval: "5m" };
    case "1M":  return { range: "1mo", interval: "15m" };
    case "3M":  return { range: "3mo", interval: "1h" };
    case "6M":  return { range: "6mo", interval: "1h" };
    case "1Y":  return { range: "1y",  interval: "1d" };
    case "5Y":  return { range: "5y",  interval: "1wk" };
    case "MAX": return { range: "max", interval: "1wk" };
  }
}

/** Mapping timeframe → interval Stooq (`d` | `w` | `m`). */
export function mapTimeframeToStooqInterval(tf: ChartTimeframe): "d" | "w" | "m" {
  switch (tf) {
    case "1D":
    case "5D":
    case "1M":
    case "3M":
    case "6M":
    case "1Y":
      return "d";
    case "5Y":
      return "w";
    case "MAX":
      return "m";
  }
}

/** TTL cache per timeframe (ms). Spec §5.3. */
export function ttlForTimeframe(tf: ChartTimeframe): number {
  switch (tf) {
    case "1D":  return 30_000;
    case "5D":  return 2 * 60_000;
    case "1M":  return 5 * 60_000;
    case "3M":  return 15 * 60_000;
    case "6M":  return 30 * 60_000;
    case "1Y":  return 2 * 60 * 60_000;
    case "5Y":  return 6 * 60 * 60_000;
    case "MAX": return 12 * 60 * 60_000;
  }
}

/** Simbol Yahoo → simbol Stooq. `null` bila tidak ada padanan. */
export function mapToStooqSymbol(symbol: string): string | null {
  const map: Record<string, string> = {
    "^GSPC": "^spx",
    "^NDX": "^ndq",
    "^DJI": "^dji",
    "^VIX": "^vix",
    "^TNX": "10usy.b",
    "^FVX": "5usy.b",
    "GC=F": "gc.f",
    "CL=F": "cl.f",
    "SI=F": "si.f",
  };
  return map[symbol] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSERS
// ─────────────────────────────────────────────────────────────────────────────

/** Parse respons chart Yahoo menjadi CandleData[] (membuang baris tidak valid). */
export function parseYahooChart(payload: any): CandleData[] {
  const result = payload?.chart?.result?.[0];
  if (!result) return [];

  const timestamps: number[] = result.timestamp ?? [];
  const q = result.indicators?.quote?.[0] ?? {};

  const out: CandleData[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const open = q.open?.[i];
    const high = q.high?.[i];
    const low = q.low?.[i];
    const close = q.close?.[i];
    const volume = q.volume?.[i] ?? 0;

    // Yahoo menyisipkan null untuk bar yang belum selesai — buang.
    if (
      !Number.isFinite(open) || !Number.isFinite(high) ||
      !Number.isFinite(low)  || !Number.isFinite(close) || close <= 0
    ) {
      continue;
    }
    out.push({ time: timestamps[i], open, high, low, close, volume: Number.isFinite(volume) ? volume : 0 });
  }
  return out;
}

/** Parse CSV Stooq (`Date,Open,High,Low,Close,Volume`) menjadi CandleData[]. */
export function parseStooqCsv(csv: string): CandleData[] {
  if (!csv || typeof csv !== "string") return [];
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  // Header harus memuat "Date" — kalau tidak, ini bukan CSV data (mis. halaman error)
  if (!/date/i.test(lines[0])) return [];

  const out: CandleData[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length < 5) continue;

    const ts = Math.floor(new Date(`${cols[0]}T00:00:00Z`).getTime() / 1000);
    const open = parseFloat(cols[1]);
    const high = parseFloat(cols[2]);
    const low = parseFloat(cols[3]);
    const close = parseFloat(cols[4]);
    const volume = cols[5] != null ? parseFloat(cols[5]) : 0;

    if (!Number.isFinite(ts) || !Number.isFinite(open) || !Number.isFinite(high) ||
        !Number.isFinite(low) || !Number.isFinite(close) || close <= 0) {
      continue;
    }
    out.push({
      time: ts, open, high, low, close,
      volume: Number.isFinite(volume) ? volume : 0,
    });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDERS
// ─────────────────────────────────────────────────────────────────────────────

export const yahooCandlesProvider: ICandleProvider = {
  name: "yahoo",

  async fetchCandles(symbol: string, timeframe: string): Promise<CandleData[]> {
    if (!isValidTimeframe(timeframe)) return [];
    const { range, interval } = mapTimeframeToYahoo(timeframe);
    const url = `${YAHOO_BASE}/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;

    try {
      const res = await axios.get(url, {
        timeout: 6000,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; HunterTrades/1.0)" },
      });
      return parseYahooChart(res.data);
    } catch (e: any) {
      silentLogger.warn(`[Candles/Yahoo] ${symbol} ${timeframe} gagal: ${e.message}`);
      return [];
    }
  },
};

export const stooqCandlesProvider: ICandleProvider = {
  name: "stooq",

  async fetchCandles(symbol: string, timeframe: string): Promise<CandleData[]> {
    if (!isValidTimeframe(timeframe)) return [];
    const stooqSymbol = mapToStooqSymbol(symbol);
    if (!stooqSymbol) return [];

    const interval = mapTimeframeToStooqInterval(timeframe);
    const url = `${STOOQ_BASE}?s=${encodeURIComponent(stooqSymbol)}&i=${interval}`;

    try {
      const res = await axios.get(url, { timeout: 6000, responseType: "text" });
      return parseStooqCsv(typeof res.data === "string" ? res.data : String(res.data));
    } catch (e: any) {
      silentLogger.warn(`[Candles/Stooq] ${symbol} ${timeframe} gagal: ${e.message}`);
      return [];
    }
  },
};
