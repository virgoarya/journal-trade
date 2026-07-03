"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  Asset,
  LiquidityData,
  RegimeSnapshotData,
  EconomicEvent,
  GeoRiskSummary,
  DataStatus,
} from "@/components/macro-terminal/MacroTerminalContext";

export type DataStatusState = {
  quotes: DataStatus;
  liquidity: DataStatus;
  regime: DataStatus;
  calendar: DataStatus;
  news: DataStatus;
  geoRisk: DataStatus;
  quant: DataStatus;
  nexus: DataStatus;
  tga: DataStatus;
  cot: DataStatus;
};

const DATA_FRESH_MS = 60_000;
const DATA_STALE_MS = 5 * 60 * 1000;
const RATE_LIMIT_RETRY_BASE_MS = 5000;
const FETCH_TIMEOUT_MS = 30000;

export function getFreshnessStatus(
  fetchedAt?: string | null,
  isFallback?: boolean,
): DataStatus {
  if (isFallback) return "fallback";
  if (!fetchedAt) return "stale";

  const age = Date.now() - new Date(fetchedAt).getTime();
  if (Number.isNaN(age) || age < 0) return "stale";
  if (age < DATA_FRESH_MS) return "live";
  if (age < DATA_STALE_MS) return "cache";
  return "stale";
}

export function useDataFetching() {
  const [assets, setAssets] = useState<Asset[]>([
    { ticker: "SPY", name: "S&P 500 (Equities)", change: null, weight: 1.5 },
    { ticker: "QQQ", name: "Nasdaq (Tech)", change: null, weight: 1.5 },
    { ticker: "GLD", name: "Gold (Safe Haven)", change: null, weight: 2 },
    { ticker: "VIXY", name: "VIX (Volatility)", change: null, weight: 2 },
    { ticker: "IEF", name: "US 10Y (Bonds)", change: null, weight: 1 },
    { ticker: "UUP", name: "US Dollar (DXY)", change: null, weight: 1.5 },
    { ticker: "FXY", name: "Japanese Yen", change: null, weight: 1.5 },
    { ticker: "TIP", name: "TIPS (Real Yield)", change: null, weight: 1 },
    { ticker: "FXE", name: "Euro", change: null, weight: 1.5 },
    { ticker: "FXB", name: "British Pound", change: null, weight: 1 },
    { ticker: "FXC", name: "Canadian Dollar", change: null, weight: 1 },
    { ticker: "FXF", name: "Swiss Franc", change: null, weight: 1 },
    { ticker: "TLT", name: "20+ Year Treasury", change: null, weight: 1 },
    { ticker: "HYG", name: "High Yield Bonds", change: null, weight: 1 },
    { ticker: "XLE", name: "Energy Sector", change: null, weight: 1 },
    { ticker: "XLF", name: "Financial Sector", change: null, weight: 1 },
    { ticker: "XLK", name: "Technology Sector", change: null, weight: 1 },
    { ticker: "IWM", name: "Russell 2000", change: null, weight: 1 },
    { ticker: "EFA", name: "Developed Markets", change: null, weight: 1 },
    { ticker: "EEM", name: "Emerging Markets", change: null, weight: 1 },
    { ticker: "DIA", name: "Dow Jones", change: null, weight: 1 },
    { ticker: "ARKK", name: "Innovation", change: null, weight: 1 },
    { ticker: "XLV", name: "Healthcare Sector", change: null, weight: 1 },
    { ticker: "XLI", name: "Industrial Sector", change: null, weight: 1 },
    { ticker: "LQD", name: "IG Corp Bonds", change: null, weight: 1 },
    { ticker: "FXA", name: "Australian Dollar", change: null, weight: 1 },
    { ticker: "USO", name: "US Oil", change: null, weight: 1 },
    { ticker: "DBA", name: "Agriculture", change: null, weight: 1 },
  ]);
  const [liquidity, setLiquidity] = useState<LiquidityData | null>(null);
  const [regimeData, setRegimeData] = useState<RegimeSnapshotData | null>(null);
  const [nextEvent, setNextEvent] = useState<EconomicEvent | null>(null);
  const [geoRisk, setGeoRisk] = useState<GeoRiskSummary>({
    overallScore: 0,
    topDriver: "UNKNOWN",
    scores: {},
    fetchedAt: null,
  });
  const [dataStatus, setDataStatus] = useState<DataStatusState>({
    quotes: "stale",
    liquidity: "stale",
    regime: "stale",
    calendar: "stale",
    news: "stale",
    geoRisk: "stale",
    quant: "stale",
    nexus: "stale",
    tga: "stale",
    cot: "stale",
  });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  // Use ref for retry counts to avoid triggering re-renders on every retry
  const retryCountsRef = useRef<Record<string, number>>({});

  const setStatus = useCallback(
    (key: keyof DataStatusState, status: DataStatus) => {
      setDataStatus((prev) => ({ ...prev, [key]: status }));
    },
    [],
  );

  useEffect(() => {
    fetchSnapshot();
  }, []);
  
  const fetchWithTimeout = async (
    url: string,
    key: keyof DataStatusState,
    options: RequestInit = {}
  ) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      console.log(`[DataFetch] ${key} response:`, response.status);

      if (response.status === 429) {
        console.warn(`[DataFetch] ${key} rate limited (429)`);
      }
      return response;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.warn(`[DataFetch] ${key} timeout after ${FETCH_TIMEOUT_MS}ms`);
      } else {
        console.warn(`[DataFetch] ${key} fetch error:`, error.message);
      }
      return { ok: false, status: 0, json: () => Promise.resolve(null) } as any;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const fetchWithRetry = async (
    url: string,
    key: keyof DataStatusState,
    options: RequestInit = {}
  ) => {
    const maxRetries = 2;
    const attempt = retryCountsRef.current[key] || 0;
    const delay = Math.min(RATE_LIMIT_RETRY_BASE_MS * Math.pow(2, attempt), 10000);

    try {
      const response = await fetchWithTimeout(url, key, options);
      
      if (response.status === 429) {
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delay));
          retryCountsRef.current[key] = (retryCountsRef.current[key] || 0) + 1;
          return fetchWithRetry(url, key, options);
        }
        console.warn(`[DataFetch] ${key} max retries exceeded`);
        return { ok: false, status: 429, json: () => Promise.resolve(null) } as any;
      }

      retryCountsRef.current[key] = 0;
      return response;
    } catch (error: any) {
      console.warn(`[DataFetch] ${key} retry failed:`, error.message);
      return { ok: false, status: 500, json: () => Promise.resolve(null) } as any;
    }
  };

  const fetchSnapshot = useCallback(async () => {
    // Use Promise.allSettled to ensure independent error handling
    const fetchTasks = [
      { key: "quotes" as const, url: `/api/v1/market-data/quotes?symbols=SPY,QQQ,GLD,VIXY,IEF,UUP,FXY,TIP,FXE,FXB,FXC,FXF,TLT,HYG,XLE,XLF,XLK,IWM,EFA,EEM,DIA,ARKK,XLV,XLI,LQD,FXA,USO,DBA` },
      { key: "liquidity" as const, url: `/api/v1/market-data/liquidity` },
      { key: "regime" as const, url: `/api/v1/macro-regime/snapshot` },
      { key: "calendar" as const, url: `/api/v1/market-data/economic-calendar` },
      { key: "news" as const, url: `/api/v1/market-data/news` },
      { key: "quant" as const, url: `/api/v1/quant/snapshot` },
      { key: "geoRisk" as const, url: `/api/v1/geo-risk` },
      { key: "tga" as const, url: `/api/v1/market-data/tga` },
    ];

    // Fetch all responses in parallel, settling independently
    const responseResults = await Promise.allSettled(
      fetchTasks.map(task => fetchWithRetry(task.url, task.key).catch(error => {
        console.warn(`[DataFetch] ${task.key} network error:`, error.message);
        return null;
      }))
    );

    // Extract responses or null if rejected
    const responses = responseResults.map((result, idx) => 
      result.status === "fulfilled" ? result.value : null
    );

    const [
      quotesRes,
      liquidityRes,
      regimeRes,
      calendarRes,
      newsRes,
      quantRes,
      geoRiskRes,
      tgaRes,
    ] = responses;

    // Parse JSON independently for each response
    const parseJson = async (res: any) => {
      if (!res || typeof res.json !== "function") return null;
      try {
        return await res.json();
      } catch (error: any) {
        console.warn("[DataFetch] JSON parse error:", error.message);
        return null;
      }
    };

    const [
      quotesData,
      liquidityData,
      regimeApiData,
      calendarData,
      newsData,
      quantData,
      geoRiskData,
      tgaData,
] = await Promise.all([
      parseJson(quotesRes),
      parseJson(liquidityRes),
      parseJson(regimeRes),
      parseJson(calendarRes),
      parseJson(newsRes),
      parseJson(quantRes),
      parseJson(geoRiskRes),
      parseJson(tgaRes),
    ]);

    const quoteStatus = getStatusFromResponse(quotesRes, quotesData);
    const liquidityFetchStatus = getStatusFromResponse(liquidityRes, liquidityData);
    const regimeFetchStatus = getStatusFromResponse(regimeRes, regimeApiData);
    const calendarFetchStatus = getStatusFromResponse(calendarRes, calendarData);
    const newsFetchStatus = getStatusFromResponse(newsRes, newsData);
    const quantFetchStatus = getStatusFromResponse(quantRes, quantData);
    const geoRiskFetchStatus = getStatusFromResponse(geoRiskRes, geoRiskData);
    const tgaFetchStatus = getStatusFromResponse(tgaRes, tgaData);

    // Set statuses independently - each component handles its own error state
    setStatus("quotes", quoteStatus);
    setStatus("liquidity", liquidityFetchStatus);
    setStatus("regime", regimeFetchStatus);
    setStatus("calendar", calendarFetchStatus);
    setStatus("news", newsFetchStatus);
    setStatus("quant", quantFetchStatus);
    setStatus("geoRisk", geoRiskFetchStatus);
    setStatus("tga", tgaFetchStatus);

    // Set fallback only if critical data sources error
    setIsFallback([
      quoteStatus,
      liquidityFetchStatus,
      regimeFetchStatus,
      quantFetchStatus,
      geoRiskFetchStatus,
    ].includes("error"));

    // Process quotes data
    if (quotesData?.success && quotesData.data && quotesData.data.length > 0) {
      const updatedAssets = quotesData.data.map((quote: any) => {
        const initialAsset = [
          { ticker: "SPY", name: "S&P 500 (Equities)", weight: 1.5 },
          { ticker: "QQQ", name: "Nasdaq (Tech)", weight: 1.5 },
          { ticker: "GLD", name: "Gold (Safe Haven)", weight: 2 },
          { ticker: "VIXY", name: "VIX (Volatility)", weight: 2 },
          { ticker: "IEF", name: "US 10Y (Bonds)", weight: 1 },
          { ticker: "UUP", name: "US Dollar (DXY)", weight: 1.5 },
          { ticker: "FXY", name: "Japanese Yen", weight: 1.5 },
          { ticker: "TIP", name: "TIPS (Real Yield)", weight: 1 },
          { ticker: "FXE", name: "Euro", weight: 1.5 },
          { ticker: "FXB", name: "British Pound", weight: 1 },
          { ticker: "FXC", name: "Canadian Dollar", weight: 1 },
          { ticker: "FXF", name: "Swiss Franc", weight: 1 },
          { ticker: "TLT", name: "20+ Year Treasury", weight: 1 },
          { ticker: "HYG", name: "High Yield Bonds", weight: 1 },
          { ticker: "XLE", name: "Energy Sector", weight: 1 },
          { ticker: "XLF", name: "Financial Sector", weight: 1 },
          { ticker: "XLK", name: "Technology Sector", weight: 1 },
          { ticker: "IWM", name: "Russell 2000", weight: 1 },
          { ticker: "EFA", name: "Developed Markets", weight: 1 },
          { ticker: "EEM", name: "Emerging Markets", weight: 1 },
          { ticker: "DIA", name: "Dow Jones", weight: 1 },
          { ticker: "ARKK", name: "Innovation", weight: 1 },
          { ticker: "XLV", name: "Healthcare Sector", weight: 1 },
          { ticker: "XLI", name: "Industrial Sector", weight: 1 },
          { ticker: "LQD", name: "IG Corp Bonds", weight: 1 },
          { ticker: "FXA", name: "Australian Dollar", weight: 1 },
          { ticker: "USO", name: "US Oil", weight: 1 },
          { ticker: "DBA", name: "Agriculture", weight: 1 },
        ].find((a) => a.ticker === quote.symbol);

        return {
          ...initialAsset!,
          change: typeof quote.changePercent === "number" ? quote.changePercent : null,
        };
      });
      setAssets(updatedAssets);
      setStatus("quotes", "live");
    } else {
      // Fallback: keep initial assets with null changes
      setStatus("quotes", quoteStatus === "error" ? "error" : "stale");
    }

    // Process liquidity data
    if (liquidityData?.success && liquidityData.data) {
      setLiquidity({
        ...liquidityData.data,
        status: liquidityData.data.status ?? "UNKNOWN",
        tga: tgaData?.success && tgaData.data ? tgaData.data : undefined,
      });
      setStatus("liquidity", "live");
    }

    // Process regime data
    if (regimeApiData?.success && regimeApiData.data) {
      setRegimeData({
        ...regimeApiData.data,
        fetchedAt: regimeApiData.fetchedAt ?? regimeApiData.data.fetchedAt ?? new Date().toISOString(),
      });
      setStatus("regime", "live");
    }

    // Process calendar data
    if (calendarData?.success && Array.isArray(calendarData.data)) {
      const now = Date.now();
      const upcoming = calendarData.data
        .filter(
          (event: EconomicEvent) => new Date(event.date).getTime() > now - 24 * 60 * 60 * 1000,
        )
        .sort(
          (a: EconomicEvent, b: EconomicEvent) =>
            new Date(a.date).getTime() - new Date(b.date).getTime(),
        );
      setNextEvent(upcoming[0] ?? null);
      setStatus("calendar", "live");
    }

    // Process news data
    if (newsData?.success && Array.isArray(newsData.data)) {
      setStatus("news", "live");
    }

    // Process quant data
    if (quantData?.success && quantData.data) {
      setDataStatus((prev) => ({ ...prev, quant: quantData.rateLimited ? "stale" : "live" }));
    }

    // Process geo risk data
    if (geoRiskData?.success && geoRiskData.data) {
      const rawScores = geoRiskData.data.scores ?? {};
      const scores = Object.fromEntries(
        Object.entries(rawScores).map(([key, value]) => [key, Number(value)]),
      ) as Record<string, number>;
      const scoreValues = Object.values(scores).filter((value) =>
        Number.isFinite(value),
      );
      const overallScore = scoreValues.length
        ? Math.round(
            scoreValues.reduce((acc, value) => acc + value, 0) /
              scoreValues.length,
          )
        : 0;
      setGeoRisk({
        overallScore,
        topDriver: getTopGeoDriver(scores),
        scores,
        fetchedAt: geoRiskData.data.fetchedAt ?? null,
      });
      setStatus("geoRisk", geoRiskData.rateLimited ? "stale" : "live");
      setLastUpdated(new Date());
    }
  }, [setStatus]);

  return {
    assets,
    setAssets,
    liquidity,
    setLiquidity,
    regimeData,
    setRegimeData,
    nextEvent,
    setNextEvent,
    geoRisk,
    setGeoRisk,
    dataStatus,
    setDataStatus,
    lastUpdated,
    setLastUpdated,
    isFallback,
    setIsFallback,
    fetchSnapshot,
  };
}

function getStatusFromResponse(
  res: any,
  data?: { success?: boolean; fetchedAt?: string; date?: string; rateLimited?: boolean },
): DataStatus {
  if (!res || !data) return "error";
  if (!res.ok || res.status === 429 || data?.rateLimited) return "stale";
  if (!data?.success) return "error";
  const fetchedAt = data?.fetchedAt ?? data?.date ?? undefined;
  return getFreshnessStatus(fetchedAt);
}

function getTopGeoDriver(scores: Record<string, number>): string {
  if (!scores) return "UNKNOWN";
  const entries = Object.entries(scores);
  if (!entries.length) return "UNKNOWN";
  return entries.sort((a, b) => b[1] - a[1])[0][0];
}