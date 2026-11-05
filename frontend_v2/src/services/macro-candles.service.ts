/**
 * Macro Candles service — client untuk endpoint charting.
 * Backend: GET /api/v1/macro/candles & /api/v1/macro/instruments
 * Spec: docs/design/macro-charting-and-palette-spec.md §5.1
 */
import type { Candle } from "@/lib/indicators";

export const CHART_TIMEFRAMES = ["1D", "5D", "1M", "3M", "6M", "1Y", "5Y", "MAX"] as const;
export type ChartTimeframe = (typeof CHART_TIMEFRAMES)[number];

export interface MacroInstrument {
  symbol: string;
  name: string;
  category: "Indeks" | "FX" | "Komoditas" | "Volatilitas" | "Yield";
}

export interface CandlesResponse {
  symbol: string;
  timeframe: ChartTimeframe;
  candles: Candle[];
  source: "yahoo" | "stooq" | "cache";
  fromCache: boolean;
  stale: boolean;
  fetchedAt: string;
}

/** Fallback daftar instrumen bila endpoint /instruments tidak tersedia. */
export const DEFAULT_INSTRUMENTS: readonly MacroInstrument[] = [
  { symbol: "^GSPC", name: "S&P 500 Index", category: "Indeks" },
  { symbol: "^NDX", name: "Nasdaq 100", category: "Indeks" },
  { symbol: "DX-Y.NYB", name: "US Dollar Index (DXY)", category: "FX" },
  { symbol: "GC=F", name: "Gold Futures", category: "Komoditas" },
  { symbol: "CL=F", name: "WTI Crude Oil", category: "Komoditas" },
  { symbol: "^VIX", name: "VIX Volatility Index", category: "Volatilitas" },
  { symbol: "^TNX", name: "10-Year Treasury Yield", category: "Yield" },
  { symbol: "^FVX", name: "5-Year Treasury Yield", category: "Yield" },
] as const;

export const DEFAULT_SYMBOL = "^GSPC";
export const DEFAULT_TIMEFRAME: ChartTimeframe = "6M";

/**
 * TTL cache per timeframe (ms) — mirror dari backend `ttlForTimeframe`.
 * Dipakai frontend untuk interval auto-refresh.
 */
export const TTL_MS: Record<ChartTimeframe, number> = {
  "1D": 30_000,
  "5D": 2 * 60_000,
  "1M": 5 * 60_000,
  "3M": 15 * 60_000,
  "6M": 30 * 60_000,
  "1Y": 2 * 60 * 60_000,
  "5Y": 6 * 60 * 60_000,
  "MAX": 12 * 60 * 60_000,
};

/** Interval re-fetch saat data sedang stale (jangan tunggu satu TTL penuh). */
export const STALE_POLL_MS = 10_000;

/**
 * Key sessionStorage untuk simbol yang diminta Command Palette **lintas halaman**.
 * Ditulis oleh layout Macro Terminal saat chart belum ter-mount (user memilih
 * instrumen dari tab lain), lalu dibaca sekali oleh MacroPriceChart saat mount.
 */
export const PENDING_INSTRUMENT_KEY = "macro:pending-instrument";

/** Ambil daftar instrumen yang boleh di-chart. Tidak pernah melempar. */
export async function fetchInstruments(signal?: AbortSignal): Promise<MacroInstrument[]> {
  try {
    const res = await fetch("/api/v1/macro/instruments", { signal, cache: "no-store" });
    if (!res.ok) return [...DEFAULT_INSTRUMENTS];
    const json = await res.json();
    if (json?.success && Array.isArray(json.data) && json.data.length > 0) {
      return json.data as MacroInstrument[];
    }
    return [...DEFAULT_INSTRUMENTS];
  } catch {
    return [...DEFAULT_INSTRUMENTS];
  }
}

/** Ambil candle OHLCV. Melempar Error dengan pesan yang bisa ditampilkan. */
export async function fetchCandles(
  symbol: string,
  timeframe: ChartTimeframe,
  limit = 500,
  signal?: AbortSignal
): Promise<CandlesResponse> {
  const url = `/api/v1/macro/candles?symbol=${encodeURIComponent(symbol)}&tf=${timeframe}&limit=${limit}`;
  const res = await fetch(url, { signal, cache: "no-store" });

  const json = await res.json().catch(() => null);

  if (!res.ok || !json?.success || !json?.data) {
    throw new Error(json?.error || `Gagal memuat data (HTTP ${res.status})`);
  }

  const data = json.data as CandlesResponse;
  if (!Array.isArray(data.candles) || data.candles.length === 0) {
    throw new Error("Tidak ada data candle untuk simbol/timeframe ini");
  }
  return data;
}
