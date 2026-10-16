/**
 * Macro Candles Service — fallback chain + stale-while-revalidate.
 * Spec: docs/design/macro-charting-and-palette-spec.md §5
 *
 * Chain: Yahoo → Stooq → Cache(stale) → Error
 */
import { silentLogger } from "../../utils/silent-logger";
import { CandleData } from "./providers/types";
import {
  yahooCandlesProvider,
  stooqCandlesProvider,
  isValidTimeframe,
  ttlForTimeframe,
  type ChartTimeframe,
} from "./providers/candles.provider";
import { getCacheEntry, isStale, setCache } from "./cache";

// ─────────────────────────────────────────────────────────────────────────────
// INSTRUMENTS (allowlist — mencegah fetch simbol arbitrer dari klien)
// ─────────────────────────────────────────────────────────────────────────────

export interface MacroInstrument {
  symbol: string;
  name: string;
  category: "Indeks" | "FX" | "Komoditas" | "Volatilitas" | "Yield";
}

export const MACRO_INSTRUMENTS: readonly MacroInstrument[] = [
  { symbol: "^GSPC",     name: "S&P 500 Index",          category: "Indeks" },
  { symbol: "^NDX",      name: "Nasdaq 100",             category: "Indeks" },
  { symbol: "DX-Y.NYB",  name: "US Dollar Index (DXY)",  category: "FX" },
  { symbol: "GC=F",      name: "Gold Futures",           category: "Komoditas" },
  { symbol: "CL=F",      name: "WTI Crude Oil",          category: "Komoditas" },
  { symbol: "^VIX",      name: "VIX Volatility Index",   category: "Volatilitas" },
  { symbol: "^TNX",      name: "10-Year Treasury Yield", category: "Yield" },
  { symbol: "^FVX",      name: "5-Year Treasury Yield",  category: "Yield" },
] as const;

const ALLOWED_SYMBOLS = new Set(MACRO_INSTRUMENTS.map((i) => i.symbol));

export function isValidSymbol(symbol: string): boolean {
  return ALLOWED_SYMBOLS.has(symbol);
}

// ─────────────────────────────────────────────────────────────────────────────
// RESULT SHAPE
// ─────────────────────────────────────────────────────────────────────────────

export interface CandlesResult {
  symbol: string;
  timeframe: ChartTimeframe;
  candles: CandleData[];
  source: "yahoo" | "stooq" | "cache";
  fromCache: boolean;
  stale: boolean;
  fetchedAt: string;
}

/** Simbol dianggap gagal bila tidak ada candle sama sekali. */
function hasData(c: CandleData[]): boolean {
  return Array.isArray(c) && c.length > 0;
}

/** Cache key: `candles:${symbol}:${tf}` (spec §5.3). */
function cacheKey(symbol: string, tf: ChartTimeframe): string {
  return `candles:${symbol}:${tf}`;
}

/** Ambil candle terbaru maksimal `limit` baris (data selalu urut naik). */
function takeLast(candles: CandleData[], limit: number): CandleData[] {
  if (limit <= 0 || candles.length <= limit) return candles;
  return candles.slice(candles.length - limit);
}

/** Set kunci yang sedang di-refresh agar tidak ada refresh paralel ganda. */
const inFlight = new Set<string>();

/**
 * Fetch dari provider chain: Yahoo → Stooq.
 * Mengembalikan `null` bila kedua provider gagal.
 */
async function fetchFromProviders(
  symbol: string,
  tf: ChartTimeframe
): Promise<{ candles: CandleData[]; source: "yahoo" | "stooq" } | null> {
  const yahoo = await yahooCandlesProvider.fetchCandles(symbol, tf);
  if (hasData(yahoo)) return { candles: yahoo, source: "yahoo" };

  const stooq = await stooqCandlesProvider.fetchCandles(symbol, tf);
  if (hasData(stooq)) return { candles: stooq, source: "stooq" };

  return null;
}

/** Refresh cache di background (fire-and-forget, tidak memblokir request). */
function revalidateInBackground(symbol: string, tf: ChartTimeframe): void {
  const key = cacheKey(symbol, tf);
  if (inFlight.has(key)) return;
  inFlight.add(key);

  void (async () => {
    try {
      const fresh = await fetchFromProviders(symbol, tf);
      if (fresh) {
        setCache(key, fresh.candles, ttlForTimeframe(tf), 5 * 60_000, fresh.source);
      }
    } catch (e: any) {
      silentLogger.warn(`[Candles] background revalidate gagal ${key}: ${e.message}`);
    } finally {
      inFlight.delete(key);
    }
  })();
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

export const macroCandlesService = {
  /**
   * Ambil candle untuk `symbol` + `timeframe`.
   * Melempar error hanya bila TIDAK ADA data sama sekali (cache kosong + semua provider gagal).
   */
  async getCandles(
    symbol: string,
    timeframe: string,
    limit = 500
  ): Promise<CandlesResult> {
    if (!isValidSymbol(symbol) || !isValidTimeframe(timeframe)) {
      throw Object.assign(new Error("Invalid symbol or timeframe"), { statusCode: 400 });
    }

    const tf = timeframe;
    const key = cacheKey(symbol, tf);
    const entry = getCacheEntry<CandleData[]>(key);

    // 1. Cache ada & masih segar → langsung pakai
    if (entry && !isStale(entry)) {
      return {
        symbol,
        timeframe: tf,
        candles: takeLast(entry.data, limit),
        source: "cache",
        fromCache: true,
        stale: false,
        fetchedAt: new Date(entry.timestamp).toISOString(),
      };
    }

    // 2. Cache ada tapi basi → sajikan sekarang, refresh di background (SWR)
    if (entry && isStale(entry)) {
      revalidateInBackground(symbol, tf);
      return {
        symbol,
        timeframe: tf,
        candles: takeLast(entry.data, limit),
        source: "cache",
        fromCache: true,
        stale: true,
        fetchedAt: new Date(entry.timestamp).toISOString(),
      };
    }

    // 3. Tidak ada cache → fetch provider chain
    const fresh = await fetchFromProviders(symbol, tf);
    if (fresh) {
      setCache(key, fresh.candles, ttlForTimeframe(tf), 5 * 60_000, fresh.source);
      return {
        symbol,
        timeframe: tf,
        candles: takeLast(fresh.candles, limit),
        source: fresh.source,
        fromCache: false,
        stale: false,
        fetchedAt: new Date().toISOString(),
      };
    }

    // 4. Semua gagal
    throw Object.assign(new Error("All providers unavailable"), { statusCode: 503 });
  },

  /** Daftar instrumen yang boleh di-chart (dipakai frontend untuk pemilih simbol). */
  listInstruments(): readonly MacroInstrument[] {
    return MACRO_INSTRUMENTS;
  },
};
