import axios from "axios";
import { env } from "../config/env";
import { fredLatest } from "../utils/fred-api.helper";
import { silentLogger } from "../utils/silent-logger";

// ─────────────────────────────────────────────────────────────────────────────
// CACHE CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache: Record<string, CacheEntry<any>> = {};

// TTLs (milliseconds) — tuned per data volatility
const TTL = {
  DXY: 15 * 60 * 1000, // 15 min (Yahoo quote)
  DBC: 15 * 60 * 1000, // 15 min (Finnhub quote)
  GOLD: 5 * 60 * 1000, // 5 min (Yahoo intraday)
  FED_FUNDS: 4 * 60 * 60 * 1000, // 4 hours (changes rarely)
  BREAKEVEN: 15 * 60 * 1000, // 15 min
  CPI: 60 * 60 * 1000, // 1 hour
  UMCSENT: 60 * 60 * 1000, // 1 hour
  WALCL: 60 * 60 * 1000, // 1 hour
} as const;

function getCached<T>(key: string, ttl: number): T | null {
  const entry = cache[key];
  if (entry && Date.now() - entry.timestamp < ttl) {
    return entry.data as T;
  }
  return null;
}

function setCache<T>(key: string, data: T): void {
  cache[key] = { data, timestamp: Date.now() };
}

// ─────────────────────────────────────────────────────────────────────────────
// RATE-LIMIT PROTECTION: Staggered sleep between requests
// ─────────────────────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const FRED_STAGGER_MS = 350; // 350ms between FRED calls (~170 req/min, under 120/min limit with margin)
const YAHOO_STAGGER_MS = 200;

// ─────────────────────────────────────────────────────────────────────────────
// YAHOO FINANCE HELPERS (no API key needed)
// ─────────────────────────────────────────────────────────────────────────────
interface YahooQuote {
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
}

async function fetchYahooQuote(symbol: string): Promise<YahooQuote | null> {
  try {
    const res = await axios.get(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`,
      { timeout: 10000 },
    );
    const result = res.data?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const price = meta?.regularMarketPrice ?? null;
    const previousClose =
      meta?.chartPreviousClose ?? meta?.previousClose ?? null;

    if (price == null) return null;

    const change = previousClose != null ? price - previousClose : 0;
    const changePercent =
      previousClose != null && previousClose !== 0
        ? (change / previousClose) * 100
        : 0;

    return {
      price: Math.round(price * 100) / 100,
      previousClose:
        previousClose != null ? Math.round(previousClose * 100) / 100 : price,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
    };
  } catch (err: any) {
    silentLogger.warn(
      `[NexusService] Yahoo fetch failed for ${symbol}:`,
      err.message,
    );
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FINNHUB HELPER
// ─────────────────────────────────────────────────────────────────────────────
async function fetchFinnhubQuote(
  symbol: string,
): Promise<{ c: number; dp: number; pc: number } | null> {
  const finnhubKey = process.env.FINNHUB_API_KEY;
  if (!finnhubKey) {
    silentLogger.warn(
      "[NexusService] FINNHUB_API_KEY not set, skipping Finnhub fetch",
    );
    return null;
  }

  try {
    const res = await axios.get(
      `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${finnhubKey}`,
      { timeout: 10000 },
    );
    const data = res.data;
    if (data && typeof data.c === "number") {
      return { c: data.c, dp: data.dp ?? 0, pc: data.pc ?? data.c };
    }
    return null;
  } catch (err: any) {
    silentLogger.warn(
      `[NexusService] Finnhub fetch failed for ${symbol}:`,
      err.message,
    );
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FRED HELPERS (with delta calculation)
// ─────────────────────────────────────────────────────────────────────────────
async function fetchFredWithDelta(
  seriesId: string,
): Promise<{ value: number; delta: number } | null> {
  if (!env.FRED_API_KEY) return null;

  try {
    const resp = await axios.get(
      "https://api.stlouisfed.org/fred/series/observations",
      {
        params: {
          series_id: seriesId,
          api_key: env.FRED_API_KEY,
          file_type: "json",
          sort_order: "desc",
          limit: 10,
          observation_start: "2020-01-01",
        },
        timeout: 10000,
      },
    );

    const obs: Array<{ value: string; date: string }> =
      resp.data?.observations ?? [];
    const valid = obs
      .filter((o) => o.value !== "." && !isNaN(parseFloat(o.value)))
      .map((o) => parseFloat(o.value));

    if (valid.length === 0) return null;

    const current = valid[0];
    const previous = valid.length >= 2 ? valid[1] : current;
    const delta = Math.round((current - previous) * 100) / 100;

    return { value: Math.round(current * 100) / 100, delta };
  } catch (err: any) {
    silentLogger.warn(
      `[NexusService] FRED fetch failed for ${seriesId}:`,
      err.message,
    );
    return null;
  }
}

async function fetchFredYoY(seriesId: string): Promise<number | null> {
  if (!env.FRED_API_KEY) return null;
  try {
    const resp = await axios.get(
      "https://api.stlouisfed.org/fred/series/observations",
      {
        params: {
          series_id: seriesId,
          api_key: env.FRED_API_KEY,
          file_type: "json",
          sort_order: "desc",
          limit: 13,
        },
        timeout: 10000,
      },
    );
    const obs: Array<{ value: string; date: string }> =
      resp.data?.observations ?? [];
    const valid = obs.filter(
      (o) => o.value !== "." && !isNaN(parseFloat(o.value)),
    );
    if (valid.length < 13) return null;
    const current = parseFloat(valid[0].value);
    const lastYear = parseFloat(valid[12].value); // 12 months ago
    return Math.round(((current - lastYear) / lastYear) * 10000) / 100;
  } catch (err: any) {
    silentLogger.warn(
      `[NexusService] FRED YoY fetch failed for ${seriesId}:`,
      err.message,
    );
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SNAPSHOT OUTPUT TYPE
// ─────────────────────────────────────────────────────────────────────────────
export interface NexusSnapshot {
  dxy: { value: number; delta: number } | null;
  crb: { value: number; delta: number } | null;
  gold: { value: number; delta: number } | null;
  /** Effective Fed Funds Rate harian (FRED DFF) — rate aktual */
  fedFundsRate: { value: number; delta: number } | null;
  /** Target range FOMC (DFEDTARL–DFEDTARU) — konteks kebijakan, bukan rate efektif */
  fedTargetRange?: { lower: number; upper: number } | null;
  breakeven5y: number | null;
  /** Breakeven inflation 10Y (T10YIE) — proksi ekspektasi inflasi harian */
  breakeven10y?: number | null;
  cpiYoY: number | null;
  growthSentiment: number | null;
  ismPmi: number | null;
  walcl: { value: number; delta: number } | null;
  realYields: { value: number; delta: number } | null;
  fetchedAt: string;
  fromCache: boolean;
  quality: {
    source: Record<string, string>;
    freshness: "live" | "cache" | "stale" | "error";
    errors: string[];
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SERVICE
// ─────────────────────────────────────────────────────────────────────────────
async function fetchFreshSnapshot(): Promise<NexusSnapshot> {
  const errors: string[] = [];
  const source: Record<string, string> = {};

  // ── 1. DXY from Yahoo Finance (DX-Y.NYB = US Dollar Index)
  let dxy = getCached<{ value: number; delta: number }>("nexus_dxy", TTL.DXY);
  if (!dxy) {
    const dxyQuote = await fetchYahooQuote("DX-Y.NYB");
    if (dxyQuote) {
      dxy = {
        value: dxyQuote.price,
        delta: dxyQuote.changePercent,
      };
      setCache("nexus_dxy", dxy);
      source.dxy = "yahoo";
    }
    await sleep(YAHOO_STAGGER_MS);
  }

  // ── 2. CRB / Commodities via Finnhub DBC ETF
  let crb = getCached<{ value: number; delta: number }>("nexus_crb", TTL.DBC);
  if (!crb) {
    const dbcQuote = await fetchFinnhubQuote("DBC");
    if (dbcQuote) {
      crb = {
        value: Math.round(dbcQuote.c * 100) / 100,
        delta: Math.round(dbcQuote.dp * 100) / 100,
      };
      setCache("nexus_crb", crb);
      source.crb = "finnhub";
    }
    await sleep(200); // Finnhub stagger
  }

  // ── 3. Gold Spot via Yahoo Finance GLD
  let gold = getCached<{ value: number; delta: number }>(
    "nexus_gold",
    TTL.GOLD,
  );
  if (!gold) {
    const goldQuote = await fetchYahooQuote("GLD");
    if (goldQuote) {
      gold = {
        value: goldQuote.price,
        delta: goldQuote.changePercent,
      };
      setCache("nexus_gold", gold);
      source.gold = "yahoo";
    }
    await sleep(YAHOO_STAGGER_MS);
  }

  // ── 4. Fed Funds Rate — DFF (daily effective rate, update harian)
  // CATATAN: sebelumnya pakai DFEDTARU (target upper). Sekarang pakai DFF supaya
  // konsisten dengan Geo Risk Radar & macro-regime — semuanya = rate EFEKTIF harian.
  let fedFundsRate = getCached<{ value: number; delta: number }>(
    "nexus_fedrate",
    TTL.FED_FUNDS,
  );
  if (!fedFundsRate) {
    fedFundsRate = await fetchFredWithDelta("DFF");
    if (fedFundsRate) {
      setCache("nexus_fedrate", fedFundsRate);
      source.fedFundsRate = "fred";
    }
    await sleep(FRED_STAGGER_MS);
  }

  // ── 5. Breakeven Inflation 5Y from FRED
  let breakeven5y = getCached<number>("nexus_be5y", TTL.BREAKEVEN);
  if (breakeven5y == null) {
    breakeven5y = await fredLatest("T5YIE", 6);
    if (breakeven5y != null) {
      setCache("nexus_be5y", breakeven5y);
      source.breakeven5y = "fred";
    }
    await sleep(FRED_STAGGER_MS);
  }

  // ── 6. CPI YoY from FRED (most reliable source for US CPI)
    // Try GeoRisk first if available, fallback to FRED CPIAUCSL
    let cpiYoY = getCached<number>("nexus_cpi", TTL.CPI);
    if (cpiYoY == null) {
      // Direct FRED fallback (doesn't depend on geo-risk service)
      cpiYoY = await fetchFredYoY("CPIAUCSL");
      if (cpiYoY != null) {
        setCache("nexus_cpi", cpiYoY);
        source.cpiYoY = "fred:CPIAUCSL";
      } else {
        // Ultra-fallback: PCE inflation. PENTING: series-nya "PCEPI", bukan "PCECPI"
        // (PCECPI tidak ada di FRED → fallback selalu gagal).
        const pceYoY = await fetchFredYoY("PCEPI");
        if (pceYoY != null) {
          cpiYoY = pceYoY;
          setCache("nexus_cpi", cpiYoY);
          source.cpiYoY = "fred:PCEPI";
        }
      }
      await sleep(FRED_STAGGER_MS);
    }

  // ── 6b. Breakeven Inflation 10Y (T10YIE) — proksi inflasi ekspektasi HARIAN
  // CPI resmi (CPIAUCSL) adalah series BULANAN dengan lag ~2 bulan. Breakeven
  // harian dipakai sebagai indikator inflasi forward-looking yang selalu segar.
  let breakeven10y = getCached<number>("nexus_be10y", TTL.BREAKEVEN);
  if (breakeven10y == null) {
    breakeven10y = await fredLatest("T10YIE", 6);
    if (breakeven10y != null) {
      setCache("nexus_be10y", breakeven10y);
      source.breakeven10y = "fred:T10YIE";
    }
    await sleep(FRED_STAGGER_MS);
  }

  // ── 7. Growth Leading Indicator: U. of Michigan Consumer Sentiment (UMCSENT)
  // Scale: 0-110+, >70 = Optimistic, 60-70 = Cautious, <60 = Pessimistic, <50 = Recession Alert
  // Consumer spending = 70% of US GDP, so consumer confidence is the EARLIEST leading indicator
  let growthSentiment = getCached<number>("nexus_growth", TTL.UMCSENT);
  if (growthSentiment == null) {
    growthSentiment = await fredLatest("UMCSENT", 6);
    if (growthSentiment != null) {
      setCache("nexus_growth", growthSentiment);
      source.growthSentiment = "fred:UMCSENT";
    }
    await sleep(FRED_STAGGER_MS);
  }

  // ── 8. Fed Balance Sheet (Total Assets = WALCL) from FRED
  let walcl = getCached<{ value: number; delta: number }>(
    "nexus_walcl",
    TTL.WALCL,
  );
  if (!walcl) {
    const rawWalcl = await fetchFredWithDelta("WALCL");
    if (rawWalcl) {
      walcl = {
        value: Math.round((rawWalcl.value / 1000) * 10) / 10, // Convert to Billions
        delta: Math.round((rawWalcl.delta / 1000) * 10) / 10,
      };
      setCache("nexus_walcl", walcl);
      source.walcl = "fred";
    }
    await sleep(FRED_STAGGER_MS);
  }

  // ── 9. Real Yields (10Y TIPS) from FRED
  let realYields = getCached<{ value: number; delta: number }>(
    "nexus_real_yields",
    TTL.BREAKEVEN,
  );
  if (!realYields) {
    realYields = await fetchFredWithDelta("DFII10");
    if (realYields) {
      setCache("nexus_real_yields", realYields);
      source.realYields = "fred";
    }
    await sleep(FRED_STAGGER_MS);
  }

  // ── 9b. Fed Target Range (DFEDTARL–DFEDTARU) — konteks kebijakan
  // Ini BUKAN rate efektif; hanya rentang target FOMC. Dipakai sebagai info tambahan
  // supaya UI bisa menampilkan "target 3.75–4.00% | effective 3.88%".
  let fedTargetRange = getCached<{ lower: number; upper: number }>(
    "nexus_fed_target_range",
    TTL.FED_FUNDS,
  );
  if (!fedTargetRange) {
    const [lower, upper] = await Promise.all([
      fetchFredWithDelta("DFEDTARL"),
      fetchFredWithDelta("DFEDTARU"),
    ]);
    if (lower && upper) {
      fedTargetRange = { lower: lower.value, upper: upper.value };
      setCache("nexus_fed_target_range", fedTargetRange);
      source.fedTargetRange = "fred";
    }
    await sleep(FRED_STAGGER_MS);
  }

  // ── Fetch ISM PMI
  // PENTING: "NAPM" DIHAPUS dari FRED sejak Juni 2016 (ISM menarik lisensinya).
  // Memakainya = selalu null. Pakai IPMAN (Industrial Production: Manufacturing)
  // sebagai proxy aktivitas manufaktur — seri valid, update bulanan.
  // Sumber PMI utama (DBnomics) ada di geo-risk.service; di sini pakai FRED.
    let ismPmi = getCached<number>("nexus_pmi", TTL.UMCSENT);
    if (ismPmi == null) {
      ismPmi = await fredLatest("IPMAN", 6);
      if (ismPmi != null) {
        setCache("nexus_pmi", ismPmi);
        source.ismPmi = "fred:IPMAN";
      }
      await sleep(FRED_STAGGER_MS);
    }

    const snapshot: NexusSnapshot = {
      dxy,
      crb,
      gold,
      fedFundsRate,
      fedTargetRange: fedTargetRange ?? null,
      breakeven5y: breakeven5y ?? null,
      breakeven10y: breakeven10y ?? null,
      cpiYoY: cpiYoY != null ? Math.round(cpiYoY * 100) / 100 : null,
      growthSentiment:
        growthSentiment != null ? Math.round(growthSentiment * 10) / 10 : null,
      ismPmi:
        ismPmi != null ? Math.round(ismPmi * 10) / 10 : null,
      walcl,
      realYields,
      fetchedAt: new Date().toISOString(),
      fromCache: false,
      quality: {
        source,
        freshness: errors.length ? "error" : "live",
        errors,
      },
    };

  // Cache the entire snapshot for fast subsequent reads
  setCache("nexus_full_snapshot", snapshot);

  return snapshot;
}

export const nexusService = {
  async getSnapshot(): Promise<NexusSnapshot> {
    // Check full-snapshot cache first (5-minute TTL for aggregate UI freshness)
    const cached = getCached<NexusSnapshot>(
      "nexus_full_snapshot",
      5 * 60 * 1000,
    );
    if (cached) {
      return {
        ...cached,
        fromCache: true,
        quality: { ...cached.quality, freshness: "cache" },
      };
    }

    try {
      return await fetchFreshSnapshot();
    } catch (err: any) {
      silentLogger.error(
        "[NexusService] Failed to fetch fresh snapshot:",
        err.message,
      );

      // Fallback: return stale cache if available
      const stale = cache["nexus_full_snapshot"];
      if (stale) {
        silentLogger.warn("[NexusService] Returning stale cached snapshot");
        return {
          ...stale.data,
          fromCache: true,
          quality: { ...stale.data.quality, freshness: "stale" },
        };
      }

      // Ultimate fallback: return nulls (frontend will use its own fallbacks)
      return {
        dxy: null,
        crb: null,
        gold: null,
        fedFundsRate: null,
        breakeven5y: null,
        cpiYoY: null,
        growthSentiment: null,
        ismPmi: null,
        walcl: null,
        realYields: null,
        fetchedAt: new Date().toISOString(),
        fromCache: false,
        quality: {
          source: {},
          freshness: "error",
          errors: ["Nexus data unavailable"],
        },
      };
    }
  },

  async forceRefresh(): Promise<NexusSnapshot> {
    // Clear all individual caches
    Object.keys(cache).forEach((key) => {
      if (key.startsWith("nexus_")) delete cache[key];
    });
    return fetchFreshSnapshot();
  },
};
