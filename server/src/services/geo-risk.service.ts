import axios from "axios";
import { env } from "../config/env";
import { GeoRiskSnapshot, IGeoRiskSnapshot } from "../models/GeoRiskSnapshot";
import { fredLatest, fredYoY } from "../utils/fred-api.helper";

// ── Constants ─────────────────────────────────────────────────────────────────
const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

// FRED series IDs
const FRED_SERIES = {
  CPI: "CPIAUCSL",          // Consumer Price Index – All Urban Consumers
  FEDFUNDS: "FEDFUNDS",     // Effective Federal Funds Rate
  VIX: "VIXCLS",            // CBOE Volatility Index (geopolitics proxy)
  PMI: "NAPM",              // ISM Manufacturing PMI
  PMI_FALLBACK: "MANEMP",   // All Employees Manufacturing (fallback proxy)
  ONRRP: "RRPONTSYD",       // Fed ON RRP Balance (liquidity drain)
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
  return Math.round(Math.min(100, Math.max(0, (50 - pmi) * 5 + 50)));
}

function scoreLiquidityDrain(onRrpB: number | null): number {
  if (onRrpB === null) return 50;
  // When ON RRP → 0 the buffer is gone → maximum drain risk
  // ON RRP in billions: 0B=100, 500B=80, 2500B=0
  return Math.round(Math.min(100, Math.max(0, 100 - (onRrpB / 2500) * 100)));
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

async function fetchFreshSnapshot(): Promise<IGeoRiskSnapshot> {
  console.log("[GeoRisk] Fetching fresh data from FRED APIs…");

  // Parallel fetch – partial failure is acceptable
  // Use limit=12 for PMI to reliably skip pending "." entries
  let [cpi_yoy, fedfunds_raw, pmi_raw, onRrp_raw] = await Promise.all([
    fredYoY(FRED_SERIES.CPI),
    fredLatest(FRED_SERIES.FEDFUNDS, 6),
    fredLatest(FRED_SERIES.PMI, 12),
    fredLatest(FRED_SERIES.ONRRP, 6),
  ]);

  // VIX: fetch LIVE from Yahoo Finance, fallback to FRED if unavailable
  let vix: number | null = null;
  try {
    const vixRes = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/^VIX');
    if (!vixRes.ok) throw new Error(`Yahoo HTTP ${vixRes.status}`);
    const vixData = (await vixRes.json()) as any;
    vix = vixData?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
    if (typeof vix !== 'number') throw new Error('Invalid VIX format');
    console.log(`[GeoRisk] Live VIX from Yahoo Finance: ${vix}`);
  } catch (err: any) {
    console.warn("[GeoRisk] Yahoo Finance VIX failed, falling back to FRED:", err.message);
    vix = await fredLatest(FRED_SERIES.VIX, 6);
  }

  // Fallback: if ISM NAPM returns null, try Manufacturing Employment as proxy
  // Store the RAW value before rounding so UI shows the real number
  let pmiSource: "NAPM" | "MANEMP_SYNTHETIC" = "NAPM";
  if (pmi_raw === null) {
    console.warn("[GeoRisk] NAPM returned null, trying MANEMP fallback…");
    const manemp = await fredLatest(FRED_SERIES.PMI_FALLBACK, 6);
    // MANEMP is in thousands of employees; normalize around ~12,500k (expansion)
    // >12500 ≈ expansion (PMI>50 equiv), <12000 ≈ contraction
    if (manemp !== null) {
      // Map to a synthetic PMI: 13000k → 55, 12500k → 50, 12000k → 45
      pmi_raw = parseFloat((50 + ((manemp - 12500) / 100)).toFixed(1));
      pmi_raw = Math.min(65, Math.max(35, pmi_raw));
      pmiSource = "MANEMP_SYNTHETIC";
      console.log(`[GeoRisk] MANEMP fallback: ${manemp}k → synthetic PMI ${pmi_raw}`);
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

  console.log("[GeoRisk] Scores computed:", scores);
  console.log("[GeoRisk] Raw values:", { cpi_yoy, fedfunds_rate, vix, globalPmi, onRrpBalance });

  const snapshot = await GeoRiskSnapshot.create({
    fetchedAt: new Date(),
    source: "api",
    cpi_yoy,
    fedfunds_rate,
    vix,
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
   * Returns MongoDB-cached data if < 12h old, otherwise fetches fresh.
   */
  async getScores(): Promise<{
    scores: IGeoRiskSnapshot["scores"];
    raw: {
      cpi_yoy: number | null;
      fedfunds_rate: number | null;
      vix: number | null;
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
      { sort: { fetchedAt: -1 } }
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
        console.error("[GeoRisk] Fresh fetch failed:", err.message);
        // Fallback to last cached if exists
        if (recent) {
          console.warn("[GeoRisk] Falling back to stale cache.");
          snapshot = recent;
        } else {
          throw new Error("Geo-Risk data unavailable: no cache and API fetch failed.");
        }
      }
    }

    return {
      scores: (snapshot as any).scores,
      raw: {
        cpi_yoy: (snapshot as any).cpi_yoy ?? null,
        fedfunds_rate: (snapshot as any).fedfunds_rate ?? null,
        vix: (snapshot as any).vix ?? null,
        globalPmi: (snapshot as any).globalPmi ?? null,
        onRrpBalance: (snapshot as any).onRrpBalance ?? null,
      },
      fetchedAt: new Date((snapshot as any).fetchedAt),
      fromCache: !isStale && !!recent,
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
