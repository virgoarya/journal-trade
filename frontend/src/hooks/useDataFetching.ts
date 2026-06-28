"use client";

import { useState, useEffect, useCallback } from "react";
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
};

const DATA_FRESH_MS = 60_000;
const DATA_STALE_MS = 5 * 60 * 1000;
const RATE_LIMIT_RETRY_BASE_MS = 5000;

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
  });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const [retryCounts, setRetryCounts] = useState<Record<string, number>>({});

  const setStatus = useCallback(
    (key: keyof DataStatusState, status: DataStatus) => {
      setDataStatus((prev) => ({ ...prev, [key]: status }));
    },
    [],
  );

  useEffect(() => {
    fetchSnapshot();
  }, []);
  
  const fetchWithRetry = async (
    url: string,
    key: keyof DataStatusState,
    options: RequestInit = {}
  ) => {
    const maxRetries = 3;
    const attempt = retryCounts[key] || 0;
    const delay = Math.min(RATE_LIMIT_RETRY_BASE_MS * Math.pow(2, attempt), 30000);

    const response = await fetch(url, options);
    
    if (response.status === 429) {
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay));
        setRetryCounts(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
        return fetchWithRetry(url, key, options);
      }
      return { ok: false, status: 429, json: () => Promise.resolve(null) } as any;
    }

    setRetryCounts(prev => ({ ...prev, [key]: 0 }));
    return response;
  };

  const fetchSnapshot = useCallback(async () => {
    try {
      const responses = await Promise.all([
        fetchWithRetry(`/api/v1/market-data/quotes?symbols=SPY,QQQ,GLD,VIXY,IEF,UUP,FXY,TIP`, "quotes"),
        fetchWithRetry(`/api/v1/market-data/liquidity`, "liquidity"),
        fetchWithRetry(`/api/v1/macro-regime/snapshot`, "regime"),
        fetchWithRetry(`/api/v1/market-data/economic-calendar`, "calendar"),
        fetchWithRetry(`/api/v1/market-data/news`, "news"),
        fetchWithRetry(`/api/v1/quant/snapshot`, "quant"),
        fetchWithRetry(`/api/v1/geo-risk`, "geoRisk"),
        fetchWithRetry(`/api/v1/market-data/tga`, "tga"),
      ]);

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

      const [
        quotesData,
        liquidityData,
        regimeApiData,
        calendarData,
        newsData,
        quantData,
        geoRiskData,
        tgaData,
      ] = await Promise.all(responses.map((res: any) =>
        res && typeof res.json === "function" ? res.json() : Promise.resolve(null)
      ));

      const quoteStatus = getStatusFromResponse(quotesRes, quotesData);
      const liquidityFetchStatus = getStatusFromResponse(liquidityRes, liquidityData);
      const regimeFetchStatus = getStatusFromResponse(regimeRes, regimeApiData);
      const calendarFetchStatus = getStatusFromResponse(calendarRes, calendarData);
      const newsFetchStatus = getStatusFromResponse(newsRes, newsData);
      const quantFetchStatus = getStatusFromResponse(quantRes, quantData);
      const geoRiskFetchStatus = getStatusFromResponse(geoRiskRes, geoRiskData);
      const tgaFetchStatus = getStatusFromResponse(tgaRes, tgaData);

      setStatus("quotes", quoteStatus);
      setStatus("liquidity", liquidityFetchStatus);
      setStatus("regime", regimeFetchStatus);
      setStatus("calendar", calendarFetchStatus);
      setStatus("news", newsFetchStatus);
      setStatus("quant", quantFetchStatus);
      setStatus("geoRisk", geoRiskFetchStatus);
      setStatus("tga", tgaFetchStatus);

      setIsFallback([
        quoteStatus,
        liquidityFetchStatus,
        regimeFetchStatus,
        quantFetchStatus,
        geoRiskFetchStatus,
      ].includes("error"));

      if (quotesData?.success && quotesData.data) {
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
          ].find((a) => a.ticker === quote.symbol);

          return {
            ...initialAsset!,
            change: typeof quote.changePercent === "number" ? quote.changePercent : null,
          };
        });
        setAssets(updatedAssets);
        setStatus("quotes", "live");
      }

      if (liquidityData?.success && liquidityData.data) {
        setLiquidity({
          ...liquidityData.data,
          status: liquidityData.data.status ?? "UNKNOWN",
          tga: tgaData?.success && tgaData.data ? tgaData.data : undefined,
        });
        setStatus("liquidity", "live");
      }

      if (regimeApiData?.success && regimeApiData.data) {
        setRegimeData({
          ...regimeApiData.data,
          fetchedAt: regimeApiData.fetchedAt ?? regimeApiData.data.fetchedAt ?? new Date().toISOString(),
        });
        setStatus("regime", "live");
      }

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

      if (newsData?.success && Array.isArray(newsData.data)) {
        setStatus("news", "live");
      }

      if (quantData?.success && quantData.data) {
        setDataStatus((prev) => ({ ...prev, quant: quantData.rateLimited ? "stale" : "live" }));
      }

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
    } catch {
      setIsFallback(true);
      Object.keys(dataStatus).forEach((key) => {
        setStatus(key as keyof DataStatusState, "error");
      });
    }
  }, [dataStatus, setStatus, retryCounts]);

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