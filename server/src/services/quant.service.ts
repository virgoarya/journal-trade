import {
  YieldCurveSnapshot,
  IYieldCurveSnapshot,
} from "../models/YieldCurveSnapshot";
import { fredLatest, fredHistorical } from "../utils/fred-api.helper";
import { silentLogger } from "../utils/silent-logger";
import { broadcast } from "../ws-server";

const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes
const VIX_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
const YIELD_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const FETCH_TIMEOUT_MS = 8000;
const YAHOO_RETRY_DELAY_MS = 1200;
const YAHOO_STAGGER_MS = 350;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
      if (!res.ok) throw new Error(`${label} HTTP ${res.status}`);
      return (await withTimeout(
        res.json(),
        FETCH_TIMEOUT_MS,
        `${label} json`,
      )) as T;
    } catch (err: any) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((resolve) =>
          setTimeout(resolve, YAHOO_RETRY_DELAY_MS),
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

const FRED_SERIES = {
  DGS2: "DGS2",
  DGS5: "DGS5",
  DGS10: "DGS10",
  VIX: "VIXCLS",
} as const;

function classifyRegime(vix: number | null): IYieldCurveSnapshot["regime"] {
  if (vix === null) return "UNKNOWN";
  if (vix < 15) return "CALM";
  if (vix >= 15 && vix < 20) return "NORMAL-CAUTIOUS";
  if (vix >= 20 && vix < 30) return "ELEVATED";
  if (vix >= 30) return "FEAR";
  return "UNKNOWN";
}

async function fetchYahooYield(symbol: string): Promise<number | null> {
  const cached = getCache<number>(`yield:${symbol}`, YIELD_CACHE_TTL_MS);
  if (cached != null) return cached;

  const data = await fetchJsonWithRetry<any>(
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`,
    `Yahoo Yield ${symbol}`,
  );
  const price = extractYahooPrice(data);
  if (price != null) setCache(`yield:${symbol}`, price);
  return price;
}

async function fetchYahooHistorical(symbol: string): Promise<number | null> {
  const cached = getCache<number>(`yield-hist:${symbol}`, 30 * 60 * 1000);
  if (cached != null) return cached;

  const data = await fetchJsonWithRetry<any>(
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1mo&interval=1d`,
    `Yahoo Historical ${symbol}`,
  );
  const closes = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
  const validCloses = closes.filter(
    (v: any) => typeof v === "number" && !Number.isNaN(v),
  );
  if (validCloses.length === 0) return null;
  const oldest = validCloses[0];
  setCache(`yield-hist:${symbol}`, oldest);
  return oldest;
}

async function fetchYahooVix(): Promise<number | null> {
  const cached = getCache<number>("vix:yahoo", VIX_CACHE_TTL_MS);
  if (cached != null) return cached;

  const data = await fetchJsonWithRetry<any>(
    "https://query1.finance.yahoo.com/v8/finance/chart/^VIX",
    "Yahoo VIX",
    2,
  );
  const price = extractYahooPrice(data);
  if (price == null) throw new Error("Invalid Yahoo VIX format");
  setCache("vix:yahoo", price);
  broadcast("vix_update", { value: price, source: "yahoo" });
  return price;
}

async function fetchFreshQuantSnapshot(): Promise<IYieldCurveSnapshot> {
  const y3m = await fetchYahooYield("^IRX");
  await sleep(YAHOO_STAGGER_MS);
  const y5 = await fetchYahooYield("^FVX");
  await sleep(YAHOO_STAGGER_MS);
  const y10 = await fetchYahooYield("^TNX");

  await sleep(YAHOO_STAGGER_MS);

  const histY3m = await fetchYahooHistorical("^IRX");
  await sleep(YAHOO_STAGGER_MS);
  const histY5 = await fetchYahooHistorical("^FVX");
  await sleep(YAHOO_STAGGER_MS);
  const histY10 = await fetchYahooHistorical("^TNX");

  let y2y: number | null = null;
  let histY2y: number | null = null;
  try {
    y2y = await fredLatest("DGS2", 6);
    histY2y = await fredHistorical("DGS2", 22);
  } catch (err) {
    silentLogger.warn("[QuantLab] FRED 2Y fetch failed:", err);
  }

  await sleep(YAHOO_STAGGER_MS);

  let vix: number | null = null;
  let vixSource: "yahoo" | "fred" | null = null;

  try {
    vix = await fetchYahooVix();
    vixSource = "yahoo";
  } catch (err: any) {
    silentLogger.warn(
      "[QuantLab] Yahoo VIX failed, falling back to FRED:",
      err.message,
    );
    vix = await fredLatest(FRED_SERIES.VIX, 6);
    vixSource = "fred";
    broadcast("vix_update", { value: vix, source: "fred" });
  }

  const spread10y3m =
    y10 != null && y3m != null ? Math.round((y10 - y3m) * 100) : null;
  const spread10y2y =
    y10 != null && y2y != null ? Math.round((y10 - y2y) * 100) : null;
  const inverted = spread10y2y != null && spread10y2y < 0;

  const regime = classifyRegime(vix);

  let curveRegime: IYieldCurveSnapshot["curveRegime"] = "UNKNOWN";
  if (y10 != null && y3m != null && histY10 != null && histY3m != null) {
    const delta10 = y10 - histY10;
    const delta3m = y3m - histY3m;
    const currentSpread = y10 - y3m;
    const histSpread = histY10 - histY3m;
    const spreadDelta = currentSpread - histSpread;

    // Inverted overlay is exposed separately as `inverted`; keep curve move label for flow interpretation.

    if (spreadDelta > 0) {
      // Steepening (spread widening)
      if (delta10 > 0) {
        curveRegime = "Bear Steepener"; // Long rates rising → bearish for bonds
      } else {
        curveRegime = "Bull Steepener"; // Short rates falling faster → bullish (Fed cutting)
      }
    } else {
      // Flattening (spread narrowing)
      if (delta3m > 0 && delta3m > delta10) {
        curveRegime = "Bear Flattener"; // Short rates rising faster → bearish (Fed hiking)
      } else {
        curveRegime = "Bull Flattener"; // Long rates falling faster → bullish (flight to safety)
      }
    }
  }

  const snapshot = await YieldCurveSnapshot.create({
    fetchedAt: new Date(),
    source: "api",
    y3m,
    y2y,
    y5,
    y10,
    histY3m,
    histY2y,
    histY5,
    histY10,
    spread10y3m,
    spread10y2y,
    inverted,
    vix,
    vixSource,
    regime,
    curveRegime,
    aiExplainer: null,
  });

  return snapshot;
}

import { aiQuantService } from "./ai-quant.service";

export const quantService = {
  async getSnapshot() {
    const recent = await YieldCurveSnapshot.findOne(
      { source: "api" },
      {},
      { sort: { fetchedAt: -1 } },
    ).lean();

    const prevCursor = await YieldCurveSnapshot.find(
      { source: "api" },
      {},
      { sort: { fetchedAt: -1 }, limit: 2 },
    ).lean();
    const prev = prevCursor.length >= 2 ? prevCursor[1] : null;
    const now = Date.now();
    let isStale =
      !recent || now - new Date(recent.fetchedAt).getTime() > CACHE_TTL_MS;

    const isOutdatedAnalysis = recent?.aiExplainer && (
      !recent.aiExplainer.includes("rug pull") ||
      !recent.aiExplainer.includes("DIVERGENCE TOTAL") ||
      recent.aiExplainer.includes("Analisis Regime Yield")
    );

    if (isOutdatedAnalysis) {
      console.log("[QuantLab] Stale AI explainer detected (old prompt). Forcing regeneration.");
      isStale = true;
    }

    let snapshot: IYieldCurveSnapshot | (typeof recent & {}) = recent as any;

    if (isStale) {
      try {
        snapshot = await fetchFreshQuantSnapshot();
        
        let aiExplainer = recent?.aiExplainer;
        if (isOutdatedAnalysis) {
          aiExplainer = null;
        }

        if (!recent || recent.curveRegime !== snapshot.curveRegime || !aiExplainer) {
          try {
            const { macroRegimeService } = await import("./macro-regime.service");
            const macroRegime = await macroRegimeService.getSnapshot();
            aiExplainer = await aiQuantService.generateYieldCurveExplainer(snapshot.curveRegime, snapshot, macroRegime);
          } catch(e: any) {
            silentLogger.warn("[QuantLab] AI Explainer generation failed:", e.message);
          }
        }
        
        if (aiExplainer) {
          (snapshot as any).aiExplainer = aiExplainer;
          await YieldCurveSnapshot.updateOne({ _id: (snapshot as any)._id }, { $set: { aiExplainer } });
        }
      } catch (err: any) {
        silentLogger.error("[QuantLab] Fresh fetch failed:", err.message);
        if (recent) {
          snapshot = recent;
        } else {
          throw new Error(
            "Quant data unavailable: no cache and API fetch failed.",
          );
        }
      }
    }

    const s = snapshot as any;
    const curveRegime = s.curveRegime ?? "UNKNOWN";

    return {
      data: {
        y3m: s.y3m,
        y2y: s.y2y,
        y5: s.y5,
        y10: s.y10,
        histY3m: s.histY3m,
        histY2y: s.histY2y,
        histY5: s.histY5,
        histY10: s.histY10,
        spread10y3m: s.spread10y3m,
        spread10y2y: s.spread10y2y,
        inverted: s.inverted,
        vix: s.vix,
        vixSource: s.vixSource,
        regime: s.regime,
        curveRegime,
        aiExplainer: s.aiExplainer,
      },
      fetchedAt: new Date(s.fetchedAt),
      fromCache: snapshot === recent && !!recent,
    };
  },

  async forceRefresh() {
    return fetchFreshQuantSnapshot();
  },

  async refreshVix() {
    let vix: number | null = null;
    let vixSource: "yahoo" | "fred" | null = null;

    try {
      vix = await fetchYahooVix();
      vixSource = "yahoo";
    } catch (err: any) {
      silentLogger.warn(
        "[QuantLab] Yahoo VIX refresh failed, falling back to FRED:",
        err.message,
      );
      vix = await fredLatest(FRED_SERIES.VIX, 6);
      vixSource = "fred";
    }

    if (vix !== null) {
      broadcast("vix_update", { value: vix, source: vixSource ?? "yahoo" });
    }

    return {
      vix,
      vixSource,
      fetchedAt: new Date().toISOString(),
    };
  },
};
