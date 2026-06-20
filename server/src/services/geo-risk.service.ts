import axios from "axios";
import { env } from "../config/env";
import { GeoRiskSnapshot, IGeoRiskSnapshot } from "../models/GeoRiskSnapshot";
import { fredLatest, fredYoY } from "../utils/fred-api.helper";
import { silentLogger } from "../utils/silent-logger";

// ── Constants ─────────────────────────────────────────────────────────────────
const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";
const TRADING_ECONOMICS_BASE = "https://api.tradingeconomics.com";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const PMI_CACHE_TTL_MS = 30 * 1000; // 30 seconds for real-time PMI
const VIX_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
const FETCH_TIMEOUT_MS = 8000;
const YAHOO_RETRY_DELAY_MS = 1200;

const inMemoryCache: Record<string, { value: any; fetchedAt: number }> = {};

function getCache<T>(key: string, ttlMs: number): T | null {
  const cached = inMemoryCache[key];
  if (!cached) return null;
  if (Date.now() - cached.fetchedAt > ttlMs) return null;
  return cached.value as T;
}

function setCache<T>(key: string, value: T): void {
  inMemoryCache[key] = { value, fetchedAt: Date.now() };
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timeout`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer!));
}

async function fetchJsonWithRetry<T>(
  url: string,
  label: string,
  retries = 1,
): Promise<T> {
  let lastError: any = new Error("No fetch attempts made");
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await withTimeout(fetch(url), FETCH_TIMEOUT_MS, label);
      if (!res.ok) {
        if (res.status === 429) {
          const retryAfter =
            Number(res.headers.get("Retry-After")) ||
            Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, retryAfter));
          continue;
        }
        throw new Error(`${label} HTTP ${res.status}`);
      }
      return (await withTimeout(
        res.json(),
        FETCH_TIMEOUT_MS,
        `${label} json`,
      )) as T;
    } catch (err: any) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((resolve) =>
          setTimeout(resolve, YAHOO_RETRY_DELAY_MS * Math.pow(2, attempt)),
        );
      }
    }
  }
  throw lastError;
}

function extractYahooPrice(data: any): number | null {
  const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
  return typeof price === "number" ? price : null;
}

// FRED series IDs
const FRED_SERIES = {
  CPI: "CPIAUCSL", // Consumer Price Index – All Urban Consumers
  FEDFUNDS: "FEDFUNDS", // Effective Federal Funds Rate
  VIX: "VIXCLS", // CBOE Volatility Index (geopolitics proxy)
  PMI: "NAPM", // ISM Manufacturing PMI
  PMI_FALLBACK: "MANEMP", // All Employees Manufacturing (fallback proxy)
  ONRRP: "RRPONTSYD", // Fed ON RRP Balance (liquidity drain)
} as const;

// ── Score Formula ─────────────────────────────────────────────────────────────
// All formulas output 0–100 (integer)

function scoreInflation(cpiYoy: number | null): number {
  if (cpiYoy === null) return 50;
  // 0%=0, 2%=22, 5%=56, 9%=100 (clamp)
  return Math.round(Math.min(100, Math.max(0, (cpiYoy / 9) * 100)));
}

function scoreRateHike(fedfunds: number | null): number {
  if (fedfunds === null) return 50;
  // 0%=0, 2.5%=45, 5.5%=100 (clamp)
  return Math.round(Math.min(100, Math.max(0, (fedfunds / 5.5) * 100)));
}

function scoreGeopolitics(vix: number | null): number {
  if (vix === null) return 50;
  // VIX: 12=calm(10), 20=moderate(40), 30=elevated(60), 50=extreme(90)
  // Formula: score = (vix / 45) * 100, clamped to 10–100
  return Math.round(Math.min(100, Math.max(10, (vix / 45) * 100)));
}

function scoreSupplyChain(pmi: number | null): number {
  if (pmi === null) return 50;
  // PMI < 50 = contraction (risk). Score inverted: 60=0, 50=50, 40=100
  const inverted = (50 - pmi) * 5 + 50;
  return Math.round(Math.min(100, Math.max(0, inverted)));
}

function scoreLiquidityDrain(onRrpB: number | null): number {
  if (onRrpB === null) return 50;
  // When ON RRP → 0 the buffer is gone → maximum drain risk
  // ON RRP in billions: 0B=100, 500B=80, 2500B=0
  return Math.round(Math.min(100, Math.max(0, 100 - (onRrpB / 2500) * 100)));
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

async function fetchFreshVix(
  allowFredFallback = true,
): Promise<{ vix: number | null; vixSource: "yahoo" | "fred" | null }> {
  const cachedVix = getCache<number>("vix:yahoo", VIX_CACHE_TTL_MS);
  if (cachedVix != null) {
    return { vix: cachedVix, vixSource: "yahoo" };
  }

  try {
    const vixData = await fetchJsonWithRetry<any>(
      "https://query1.finance.yahoo.com/v8/finance/chart/^VIX",
      "Yahoo VIX",
      2,
    );
    const vix = extractYahooPrice(vixData);
    if (vix == null) throw new Error("Invalid Yahoo VIX format");
    setCache("vix:yahoo", vix);
    return { vix, vixSource: "yahoo" };
  } catch (err: any) {
    silentLogger.warn("[GeoRisk] Yahoo Finance VIX failed:", err.message);
    if (!allowFredFallback) {
      return { vix: null, vixSource: null };
    }
    const fredVix = await fredLatest(FRED_SERIES.VIX, 6);
    return { vix: fredVix, vixSource: fredVix != null ? "fred" : null };
  }
}

async function fetchFreshSnapshot(): Promise<IGeoRiskSnapshot> {
  // Parallel fetch – partial failure is acceptable
  // Use limit=12 for PMI to reliably skip pending "." entries
  let [cpi_yoy, fedfunds_raw, pmi_raw, onRrp_raw] = await Promise.all([
    fredYoY(FRED_SERIES.CPI),
    fredLatest(FRED_SERIES.FEDFUNDS, 6),
    // Primary PMI source
    fredLatest(FRED_SERIES.PMI, 12),
    fredLatest(FRED_SERIES.ONRRP, 6),
  ]);
  // If primary PMI missing, try secondary proxy (Trading Economics)
  if (pmi_raw === null) {
    try {
      const teResp = await fetchJsonWithRetry<any>(
        `https://api.tradingeconomics.com/commodity/PMI?c=${process.env.TE_API_KEY}`,
        "TradingEconomics PMI",
        2,
      );
      // Expected format: { PMI: number }
      if (teResp && typeof teResp.PMI === "number") {
        pmi_raw = teResp.PMI;
      }
    } catch (e) {
      silentLogger.warn("[GeoRisk] TradingEconomics PMI fallback failed");
    }
  }

  // VIX: fetch LIVE from Yahoo Finance with short cache, fallback to FRED only if Yahoo unavailable
  const vixData = await fetchFreshVix(true);
  let vix: number | null = vixData.vix;
  let vixSource: "yahoo" | "fred" | null = vixData.vixSource;

  // Fallback: if ISM NAPM returns null, try Manufacturing Employment as proxy
  // Store the RAW value before rounding so UI shows the real number
  let pmiSource: "NAPM" | "MANEMP_SYNTHETIC" = "NAPM";
  if (pmi_raw === null) {
    silentLogger.warn("[GeoRisk] NAPM returned null, trying MANEMP fallback…");
    const manemp = await fredLatest(FRED_SERIES.PMI_FALLBACK, 6);
    // MANEMP is in thousands of employees; normalize around ~12,500k (expansion)
    // >12500 ≈ expansion (PMI>50 equiv), <12000 ≈ contraction
    if (manemp !== null) {
      // Map to a synthetic PMI: 13000k → 55, 12500k → 50, 12000k → 45
      pmi_raw = parseFloat((50 + (manemp - 12500) / 100).toFixed(1));
      pmi_raw = Math.min(65, Math.max(35, pmi_raw));
      pmiSource = "MANEMP_SYNTHETIC";
    }
  }

  const fedfunds_rate = fedfunds_raw;
  const globalPmi = pmi_raw;
  // ON RRP from FRED is in billions of USD
  const onRrpBalance = onRrp_raw;

  const scores = {
    inflation: scoreInflation(cpi_yoy),
    rateHike: scoreRateHike(fedfunds_rate),
    geopolitics: scoreGeopolitics(vix),
    supplyChain: scoreSupplyChain(globalPmi),
    liquidityDrain: scoreLiquidityDrain(onRrpBalance),
  };

  const snapshot = await GeoRiskSnapshot.create({
    fetchedAt: new Date(),
    source: "api",
    cpi_yoy,
    fedfunds_rate,
    vix,
    vixSource,
    globalPmi,
    onRrpBalance,
    scores,
  });

  return snapshot;
}

// ── Public Service ────────────────────────────────────────────────────────────

export const geoRiskService = {
  /**
   * Get the latest Geo-Risk scores.
   * Returns MongoDB-cached data if < 1h old, otherwise fetches fresh.
   * VIX is cached separately for 2 minutes to stay near real-time.
   */
  async getScores(): Promise<{
    scores: IGeoRiskSnapshot["scores"];
    raw: {
      cpi_yoy: number | null;
      fedfunds_rate: number | null;
      vix: number | null;
      vixSource: "yahoo" | "fred" | null;
      globalPmi: number | null;
      onRrpBalance: number | null;
    };
    fetchedAt: Date;
    fromCache: boolean;
  }> {
    // Check MongoDB for a recent snapshot
    const recent = await GeoRiskSnapshot.findOne(
      { source: "api" },
      {},
      { sort: { fetchedAt: -1 } },
    ).lean();

    const now = Date.now();
    const isStale =
      !recent ||
      now - new Date(recent.fetchedAt).getTime() > CACHE_TTL_MS ||
      recent.globalPmi === null; // force refresh if PMI was missing

    let snapshot: IGeoRiskSnapshot | (typeof recent & {}) = recent as any;

    if (isStale || !recent) {
      try {
        snapshot = await fetchFreshSnapshot();
      } catch (err: any) {
        silentLogger.error("[GeoRisk] Fresh fetch failed:", err.message);
        // Fallback to last cached if exists
        if (recent) {
          silentLogger.warn("[GeoRisk] Falling back to stale cache.");
          snapshot = recent;
        } else {
          throw new Error(
            "Geo-Risk data unavailable: no cache and API fetch failed.",
          );
        }
      }
    }

    const recentVixAge = recent
      ? now - new Date(recent.fetchedAt).getTime()
      : Number.POSITIVE_INFINITY;
    const shouldRefreshVixOnly =
      recent &&
      !isStale &&
      (recentVixAge > VIX_CACHE_TTL_MS ||
        recent.vix == null ||
        recent.vixSource === "fred");

    if (shouldRefreshVixOnly) {
      try {
        const freshVix = await fetchFreshVix(false);
        if (freshVix.vix != null && freshVix.vixSource) {
          const raw = {
            cpi_yoy: (snapshot as any).cpi_yoy ?? null,
            fedfunds_rate: (snapshot as any).fedfunds_rate ?? null,
            vix: freshVix.vix,
            vixSource: freshVix.vixSource,
            globalPmi: (snapshot as any).globalPmi ?? null,
            onRrpBalance: (snapshot as any).onRrpBalance ?? null,
          };
          const scores = {
            inflation: scoreInflation(raw.cpi_yoy),
            rateHike: scoreRateHike(raw.fedfunds_rate),
            geopolitics: scoreGeopolitics(raw.vix),
            supplyChain: scoreSupplyChain(raw.globalPmi),
            liquidityDrain: scoreLiquidityDrain(raw.onRrpBalance),
          };
          return {
            scores,
            raw,
            fetchedAt: new Date(),
            fromCache: false,
          };
        }
      } catch (err: any) {
        silentLogger.warn(
          "[GeoRisk] VIX-only refresh failed, keeping recent cached VIX:",
          err.message,
        );
      }
    }

    return {
      scores: (snapshot as any).scores,
      raw: {
        cpi_yoy: (snapshot as any).cpi_yoy ?? null,
        fedfunds_rate: (snapshot as any).fedfunds_rate ?? null,
        vix: (snapshot as any).vix ?? null,
        vixSource: (snapshot as any).vixSource ?? null,
        globalPmi: (snapshot as any).globalPmi ?? null,
        onRrpBalance: (snapshot as any).onRrpBalance ?? null,
      },
      fetchedAt: new Date((snapshot as any).fetchedAt),
      fromCache: snapshot === recent && !!recent,
    };
  },

  /**
   * Force-refresh the snapshot (ignores cache TTL).
   * For use by admin endpoint or cron.
   */
  async forceRefresh() {
    return fetchFreshSnapshot();
  },
};
