"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useRef,
  useCallback,
} from "react";
import { useDataFetching } from "@/hooks/useDataFetching";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useRegimeAnalysis } from "@/hooks/useRegimeAnalysis";
import { OnRrpStatus, deriveSentimentAndImpact } from "@/lib/macro/classifiers";
import type {
  QuoteApiResponse,
  RegimeMetricData,
  RegimeConfidenceData,
  RegimeSnapshotData,
} from "@/lib/macro/types";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
export type { RegimeMetricData, RegimeConfidenceData, RegimeSnapshotData };

export type DataStatus = "live" | "cache" | "fallback" | "stale" | "error";

export interface DataStatusState {
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
}

export interface Asset {
  ticker: string;
  name: string;
  change: number | null;
  weight?: number;
}

export interface LiquidityData {
  value: number;
  change: number;
  status: "INJECTING" | "DRAINING" | "UNKNOWN" | "NEUTRAL";
  date: string;
  trend: ("injecting" | "draining" | "neutral")[];
  history?: { date: string; value: number; status: string }[];
  tga?: {
    value: number;
    delta: number;
    displayValue: string;
    date: string;
    history?: { date: string; value: number; status: string }[];
    trend?: ("injecting" | "draining" | "neutral")[];
  };
}

export type RegimeType =
  "Goldilocks" | "Reflation" | "Stagflation" | "Deflation" | "Transition";

export interface VixState {
  value: number | null;
  regime: string;
  source: string | null;
  fetchedAt: string | null;
}

export interface YieldCurveState {
  spread10y2y: number | null;
  spread30y3m: number | null;
  curveRegime: string;
  inverted: boolean;
  aiExplainer: string | null;
  fetchedAt: string | null;
}

export interface EconomicEvent {
  title: string;
  country: string;
  date: string;
  impact: string;
  forecast: string;
  previous: string;
  actual: string;
  direction?: "higher_is_better" | "lower_is_better" | "neutral";
}

export interface GeoRiskSummary {
  overallScore: number;
  topDriver: string;
  scores: Record<string, number>;
  fetchedAt: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT
// ─────────────────────────────────────────────────────────────────────────────
interface MacroTerminalContextProps {
  assets: Asset[];
  liquidity: LiquidityData | null;
  isFallback: boolean;
  currentRegime: RegimeType | null;
  lastRegime: RegimeType | null;
  aiReasoning: string | null;
  isAnalyzing: boolean;
  lastUpdated: Date | null;
  systemAlert: string | null;
  clearSystemAlert: () => void;
  regimeData: RegimeSnapshotData | null;
  analyzeRegime: () => Promise<void>;
  dataStatus: DataStatusState;
  nextEvent: EconomicEvent | null;
  vix: VixState;
  yieldCurve: YieldCurveState;
  geoRisk: GeoRiskSummary;
  refreshSnapshot: () => Promise<void>;
}

const MacroTerminalContext = createContext<
  MacroTerminalContextProps | undefined
>(undefined);

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────────────────────────────────────
const initialAssets: Asset[] = [
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
];

function normalizeOnRrpStatus(status?: string): OnRrpStatus {
  if (status === "DRAINING") return "Draining";
  if (status === "INJECTING") return "Refilling";
  return "Neutral";
}

function getVixRegime(vix: number | null): string {
  if (vix === null || Number.isNaN(vix)) return "UNKNOWN";
  if (vix < 15) return "CALM";
  if (vix < 20) return "NORMAL-CAUTIOUS";
  if (vix < 30) return "ELEVATED";
  return "FEAR";
}

export function MacroTerminalProvider({ children }: { children: ReactNode }) {
  // ── Use custom hooks ─────────────────────────────────────────────────────────
  const {
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
  } = useDataFetching();

  const [currentRegime, setCurrentRegime] = useState<RegimeType | null>(null);
  const [lastRegime, setLastRegime] = useState<RegimeType | null>(null);
  const [systemAlert, setSystemAlert] = useState<string | null>(null);
  const [vix, setVix] = useState<VixState>({
    value: null,
    regime: "UNKNOWN",
    source: null,
    fetchedAt: null,
  });
  const [yieldCurve, setYieldCurve] = useState<YieldCurveState>({
    spread10y2y: null,
    spread30y3m: null,
    curveRegime: "UNKNOWN",
    inverted: false,
    aiExplainer: null,
    fetchedAt: null,
  });

  const {
    isAnalyzing,
    reasoning: aiReasoning,
    setReasoning,
    analyzeRegime,
    analyzeNexus,
  } = useRegimeAnalysis();

  const analyzeRegimeWrapper = useCallback(async () => {
    if (!regimeData) return;
    const liquidityStatus = normalizeOnRrpStatus(liquidity?.status);
    const regime = (regimeData.quadrant as RegimeType) || null;
    const { sentiment } = deriveSentimentAndImpact(
      regime || "Deflation",
      liquidityStatus,
    );
    const assetsForService = assets.map((a) => ({
      ticker: a.ticker,
      name: a.name,
      change: a.change,
    }));
    await analyzeRegime({
      assets: assetsForService,
      regime: regime,
      liquidityStatus,
      sentiment,
      context: {
        growth: regimeData.growth,
        inflation: regimeData.inflation,
        liquidity: regimeData.liquidity,
        confidence: regimeData.confidence,
        vix,
        yieldCurve,
        geoRisk,
      },
    });
    setLastUpdated(new Date());
  }, [
    regimeData,
    liquidity?.status,
    assets,
    vix,
    yieldCurve,
    geoRisk,
    analyzeRegime,
  ]);

  const currentRegimeRef = useRef<RegimeType | null>(null);
  const initialAnalysisDone = useRef<boolean>(false);

  // ── WebSocket handlers (batched debounce) ──────────────────────────────────
  const quoteBatchRef = useRef<Map<string, number | null>>(new Map());
  const quoteFlushTimerRef = useRef<NodeJS.Timeout | null>(null);

  const flushQuoteBatch = useCallback(() => {
    const batch = quoteBatchRef.current;
    if (batch.size === 0) return;
    const updates = new Map(batch);
    batch.clear();
    setAssets((prev) =>
      prev.map((asset) =>
        updates.has(asset.ticker)
          ? { ...asset, change: updates.get(asset.ticker) ?? null }
          : asset,
      ),
    );
    setDataStatus((prev) => ({ ...prev, quotes: "live" }));
    setLastUpdated(new Date());
  }, [setAssets, setDataStatus, setLastUpdated]);

  const applyQuoteUpdate = useCallback(
    (payload: { symbol: string; data: { dp?: number } }) => {
      quoteBatchRef.current.set(
        payload.symbol,
        typeof payload.data?.dp === "number" ? payload.data.dp : null,
      );
      if (quoteFlushTimerRef.current) clearTimeout(quoteFlushTimerRef.current);
      quoteFlushTimerRef.current = setTimeout(flushQuoteBatch, 500);
    },
    [flushQuoteBatch],
  );

  const applyLiquidityUpdate = (payload: LiquidityData) => {
    setLiquidity({
      ...payload,
      status: payload.status,
    });
    setDataStatus((prev) => ({ ...prev, liquidity: "live" }));
    setLastUpdated(new Date());
  };

  const applyVixUpdate = (payload: {
    value: number;
    source: "yahoo" | "fred";
  }) => {
    setVix({
      value: payload.value,
      regime: getVixRegime(payload.value),
      source: payload.source,
      fetchedAt: new Date().toISOString(),
    });
    setDataStatus((prev) => ({ ...prev, quant: "live" }));
    setLastUpdated(new Date());
  };

  const { status: wsStatus } = useWebSocket(
    applyQuoteUpdate,
    applyLiquidityUpdate,
    applyVixUpdate,
  );

  // ── Quant data sync ─────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function fetchQuant() {
      try {
        const res = await fetch("/api/v1/quant/snapshot");
        const json = await res.json();
        if (!cancelled && res.ok && json.success && json.data) {
          const d = json.data;
          setVix({
            value: typeof d.vix === "number" ? d.vix : null,
            regime:
              d.regime ??
              getVixRegime(typeof d.vix === "number" ? d.vix : null),
            source: d.vixSource ?? null,
            fetchedAt: json.fetchedAt ?? null,
          });
          setYieldCurve({
            spread10y2y:
              typeof d.spread10y2y === "number" ? d.spread10y2y : null,
            spread30y3m:
              typeof d.spread30y3m === "number" ? d.spread30y3m : null,
            curveRegime: d.curveRegime ?? "UNKNOWN",
            inverted: Boolean(d.inverted),
            aiExplainer: d.aiExplainer ?? null,
            fetchedAt: json.fetchedAt ?? null,
          });
          setDataStatus((prev) => ({
            ...prev,
            quant: json.fromCache ? "cache" : "live",
          }));
        }
      } catch {
        setDataStatus((prev) => ({ ...prev, quant: "error" }));
      }
    }

    fetchQuant();
    const interval = setInterval(fetchQuant, 3 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [setDataStatus]);

  // ── Regime analysis effect ──────────────────────────────────────────────────
  useEffect(() => {
    if (!regimeData) return;

    const regime = (regimeData.quadrant as RegimeType) || null;

    if (regime) {
      setCurrentRegime(regime);
    }

    const previousRegime = currentRegimeRef.current;
    const isRegimeChanged =
      previousRegime !== null && previousRegime !== regime;

    if (isRegimeChanged && previousRegime) {
      setSystemAlert(
        `[SYSTEM ALERT]: MACRO REGIME SHIFT DETECTED. TRANSITIONED FROM ${previousRegime.toUpperCase()} TO ${regime?.toUpperCase()}.`,
      );
      setLastRegime(previousRegime);
      fetch("/api/v1/macro-ai-observer/clear-cache", {
        method: "POST",
      }).catch(() => undefined);

      // Auto re-analyze on regime shift
      analyzeRegimeWrapper();
    } else if (currentRegimeRef.current === null && regime) {
      setLastRegime(regime);
    }

    if (regime) {
      currentRegimeRef.current = regime;
    }
  }, [regimeData, analyzeRegimeWrapper]);

  // ── Initial Analysis ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!initialAnalysisDone.current && regimeData && assets.length > 0) {
      initialAnalysisDone.current = true;
      analyzeRegimeWrapper();
    }
  }, [regimeData, assets.length, analyzeRegimeWrapper]);

  // ── Refresh snapshot ────────────────────────────────────────────────────────
  const refreshSnapshot = async () => {
    await fetchSnapshot();
  };

  // ── Clear system alert ─────────────────────────────────────────────────────
  const clearSystemAlert = () => setSystemAlert(null);

  // ── Build context value ────────────────────────────────────────────────────
  const contextValue: MacroTerminalContextProps = {
    assets,
    liquidity,
    isFallback,
    currentRegime,
    lastRegime,
    aiReasoning,
    isAnalyzing,
    lastUpdated,
    systemAlert,
    clearSystemAlert,
    regimeData,
    analyzeRegime: analyzeRegimeWrapper,
    dataStatus,
    nextEvent,
    vix,
    yieldCurve,
    geoRisk,
    refreshSnapshot,
  };

  return (
    <MacroTerminalContext.Provider value={contextValue}>
      {children}
    </MacroTerminalContext.Provider>
  );
}

export const useMacroTerminal = () => {
  const context = useContext(MacroTerminalContext);
  if (context === undefined) {
    throw new Error(
      "useMacroTerminal must be used within a MacroTerminalProvider",
    );
  }
  return context;
};
