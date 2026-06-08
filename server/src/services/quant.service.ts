import { YieldCurveSnapshot, IYieldCurveSnapshot } from "../models/YieldCurveSnapshot";
import { fredLatest } from "../utils/fred-api.helper";

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

const FRED_SERIES = {
  DGS2: "DGS2",
  DGS5: "DGS5",
  DGS10: "DGS10",
  VIX: "VIXCLS",
} as const;

function classifyRegime(vix: number | null): IYieldCurveSnapshot["regime"] {
  if (vix === null) return "UNKNOWN";
  if (vix < 15) return "CALM";
  if (vix >= 15 && vix < 20) return "NORMAL";
  if (vix >= 20 && vix < 30) return "ELEVATED";
  if (vix >= 30) return "FEAR";
  return "UNKNOWN";
}

async function fetchYahooYield(symbol: string): Promise<number | null> {
  const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`);
  if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
  const data = (await res.json()) as any;
  return data?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
}

async function fetchYahooHistorical(symbol: string): Promise<number | null> {
  const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1mo&interval=1d`);
  if (!res.ok) throw new Error(`Yahoo Historical HTTP ${res.status}`);
  const data = (await res.json()) as any;
  const closes = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
  const validCloses = closes.filter((v: any) => typeof v === "number" && !Number.isNaN(v));
  if (validCloses.length === 0) return null;
  return validCloses[0]; // oldest close (1 month ago)
}

async function fetchFreshQuantSnapshot(): Promise<IYieldCurveSnapshot> {
  console.log("[QuantLab] Fetching fresh data from Yahoo Finance…");

  const [y3m, y5, y10, y30] = await Promise.all([
    fetchYahooYield("^IRX"),
    fetchYahooYield("^FVX"),
    fetchYahooYield("^TNX"),
    fetchYahooYield("^TYX"),
  ]);

  let y2y: number | null = null;
  try {
    y2y = await fredLatest("DGS2", 6);
  } catch (err) {
    console.warn("[QuantLab] FRED 2Y fetch failed:", err);
  }

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

  const spread10y3m = y10 != null && y3m != null ? Math.round((y10 - y3m) * 100) : null;
  const spread10y2y = y10 != null && y2y != null ? Math.round((y10 - y2y) * 100) : null;
  const spread30y5y = y30 != null && y5 != null ? Math.round((y30 - y5) * 100) : null;
  const inverted = spread10y2y != null && spread10y2y < 0;

  const regime = classifyRegime(vix);

  const snapshot = await YieldCurveSnapshot.create({
    fetchedAt: new Date(),
    source: "api",
    y3m,
    y2y,
    y5,
    y10,
    y30,
    spread10y3m,
    spread10y2y,
    spread30y5y,
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

    const prevCursor = await YieldCurveSnapshot.find(
      { source: "api" },
      {},
      { sort: { fetchedAt: -1 }, limit: 2 }
    ).lean();
    const prev = prevCursor.length >= 2 ? prevCursor[1] : null;
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
        y3m: (snapshot as any).y3m,
        y2y: (snapshot as any).y2y,
        y5: (snapshot as any).y5,
        y10: (snapshot as any).y10,
        y30: (snapshot as any).y30,
        spread10y3m: (snapshot as any).spread10y3m,
        spread10y2y: (snapshot as any).spread10y2y,
        spread30y5y: (snapshot as any).spread30y5y,
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
