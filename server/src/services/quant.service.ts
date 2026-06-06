import { YieldCurveSnapshot, IYieldCurveSnapshot } from "../models/YieldCurveSnapshot";
import { fredLatest } from "../utils/fred-api.helper";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

const FRED_SERIES = {
  DGS2: "DGS2",
  DGS5: "DGS5",
  DGS10: "DGS10",
  VIX: "VIXCLS",
} as const;

function classifyRegime(vix: number | null): IYieldCurveSnapshot["regime"] {
  if (vix === null) return "UNKNOWN";
  if (vix < 15) return "GOLDILOCKS"; // Calm
  if (vix >= 15 && vix < 20) return "REFLATION"; // Normal / Rising
  if (vix >= 20 && vix < 30) return "STAGFLATION"; // Elevated / Stress
  if (vix >= 30) return "DEFLATION"; // Fear / Crash
  return "TRANSITION";
}

async function fetchFreshQuantSnapshot(): Promise<IYieldCurveSnapshot> {
  console.log("[QuantLab] Fetching fresh data from FRED APIs…");

  const [y2, y5, y10] = await Promise.all([
    fredLatest(FRED_SERIES.DGS2, 6),
    fredLatest(FRED_SERIES.DGS5, 6),
    fredLatest(FRED_SERIES.DGS10, 6),
  ]);

  let vix: number | null = null;
  try {
    const res = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/^VIX');
    if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
    const data = (await res.json()) as any;
    vix = data?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
    if (typeof vix !== 'number') throw new Error('Invalid VIX format');
  } catch (err: any) {
    console.warn("[QuantLab] Failed to fetch live VIX from Yahoo Finance, falling back to FRED:", err.message);
    vix = await fredLatest(FRED_SERIES.VIX, 6);
  }

  let spread2y10y = null;
  let inverted = false;

  if (y2 !== null && y10 !== null) {
    spread2y10y = parseFloat(((y10 - y2) * 100).toFixed(2)); // in basis points
    inverted = spread2y10y < 0;
  }

  const regime = classifyRegime(vix);

  const snapshot = await YieldCurveSnapshot.create({
    fetchedAt: new Date(),
    source: "api",
    y2,
    y5,
    y10,
    spread2y10y,
    inverted,
    vix,
    regime,
  });

  return snapshot;
}

export const quantService = {
  async getSnapshot() {
    const recent = await YieldCurveSnapshot.findOne(
      { source: "api" },
      {},
      { sort: { fetchedAt: -1 } }
    ).lean();

    const now = Date.now();
    const isStale =
      !recent || now - new Date(recent.fetchedAt).getTime() > CACHE_TTL_MS;

    let snapshot: IYieldCurveSnapshot | (typeof recent & {}) = recent as any;

    if (isStale || !recent) {
      try {
        snapshot = await fetchFreshQuantSnapshot();
      } catch (err: any) {
        console.error("[QuantLab] Fresh fetch failed:", err.message);
        if (recent) {
          snapshot = recent;
        } else {
          throw new Error("Quant data unavailable: no cache and API fetch failed.");
        }
      }
    }

    return {
      data: {
        y2: (snapshot as any).y2,
        y5: (snapshot as any).y5,
        y10: (snapshot as any).y10,
        spread2y10y: (snapshot as any).spread2y10y,
        inverted: (snapshot as any).inverted,
        vix: (snapshot as any).vix,
        regime: (snapshot as any).regime,
      },
      fetchedAt: new Date((snapshot as any).fetchedAt),
      fromCache: !isStale && !!recent,
    };
  },

  async forceRefresh() {
    return fetchFreshQuantSnapshot();
  },
};
