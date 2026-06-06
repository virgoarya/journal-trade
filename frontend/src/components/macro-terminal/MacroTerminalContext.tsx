"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from "react";
import {
  OnRrpStatus,
  deriveSentimentAndImpact,
} from '@/lib/macro/classifiers';
import type { QuoteApiResponse } from '@/lib/macro/types';

export interface Asset {
  ticker: string;
  name: string;
  change: number | null;
  weight: number;
}

export interface RegimeMetricData {
  current: number;
  ema50: number;
  status: "ACCELERATING" | "DECELERATING";
  label: string;
}

export interface RegimeSnapshotData {
  quadrant: string;
  quadNumber: number;
  description: string;
  growth: RegimeMetricData;
  inflation: RegimeMetricData;
  liquidity: RegimeMetricData & { riskState: "HEALTHY" | "STRESSED" };
  position: { x: number; y: number };
  history: Array<{
    date: string;
    growthRatio: number;
    growthEma: number;
    inflationRatio: number;
    inflationEma: number;
    liquidityRatio: number;
    liquidityEma: number;
    quadrant: string;
  }>;
  fetchedAt: string;
}

const initialAssets: Asset[] = [
  { ticker: "SPY", name: "S&P 500 (Equities)", change: null, weight: 1.5 },
  { ticker: "QQQ", name: "Nasdaq (Tech)", change: null, weight: 1.5 },
  { ticker: "GLD", name: "Gold (Safe Haven)", change: null, weight: 2 },
  { ticker: "VIXY", name: "VIX (Volatility)", change: null, weight: 2 },
  { ticker: "IEF", name: "US 10Y (Bonds)", change: null, weight: 1 },
  { ticker: "UUP", name: "US Dollar (DXY)", change: null, weight: 1.5 },
  { ticker: "FXY", name: "Japanese Yen", change: null, weight: 1.5 },
  { ticker: "TIP", name: "TIPS (Real Yield)", change: null, weight: 1 },
];

export interface LiquidityData {
  value: number;
  change: number;
  status: "INJECTING" | "DRAINING" | "UNKNOWN";
  date: string;
  trend: ("injecting" | "draining")[];
  history?: { date: string; value: number; status: string }[];
}

export type RegimeType = "Goldilocks" | "Reflation" | "Stagflation" | "Deflation";

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
}

const MacroTerminalContext = createContext<MacroTerminalContextProps | undefined>(undefined);

export function MacroTerminalProvider({ children }: { children: ReactNode }) {
  const [assets, setAssets] = useState<Asset[]>(initialAssets);
  const [liquidity, setLiquidity] = useState<LiquidityData | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const [currentRegime, setCurrentRegime] = useState<RegimeType | null>(null);
  const [lastRegime, setLastRegime] = useState<RegimeType | null>(null);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [systemAlert, setSystemAlert] = useState<string | null>(null);
  const [regimeData, setRegimeData] = useState<RegimeSnapshotData | null>(null);
  const hasAnalyzedInitially = useRef(false);
  const currentRegimeRef = useRef<RegimeType | null>(null);
  const aiReasoningRef = useRef<string | null>(null);

  const analyzeRegime = async () => {
    setIsAnalyzing(true);
    try {
      let liquidityStatus: OnRrpStatus = 'Neutral';
      if (liquidity) {
        if (liquidity.status === 'DRAINING') {
          liquidityStatus = 'Draining';
        } else if (liquidity.status === 'INJECTING') {
          liquidityStatus = 'Refilling';
        }
      }

      const regime = regimeData?.quadrant as RegimeType | null || null;
      const { sentiment } = deriveSentimentAndImpact(regime || 'Deflation', liquidityStatus);

      const previousRegime = currentRegimeRef.current;
      const isInitialAnalysis = !hasAnalyzedInitially.current;
      const isRegimeChanged = previousRegime !== null && previousRegime !== regime;

      let aiReasoningText: string;
      if (isInitialAnalysis || isRegimeChanged) {
        const assetsForService = assets.map(a => ({
          ticker: a.ticker,
          name: a.name,
          change: a.change,
        }));
        const aiResponse = await fetch("/api/v1/macro-ai/analyze-regime", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assets: assetsForService,
            calculatedRegime: regime,
            liquidityStatus: liquidityStatus,
            sentiment: sentiment,
          }),
        });
        const aiData = await aiResponse.json();
        aiReasoningText = aiData.success && aiData.reasoning ? aiData.reasoning.trim() : `Regime: ${regime}, Liquidity: ${liquidityStatus}`;
      } else {
        aiReasoningText = aiReasoningRef.current ?? `Regime: ${regime}, Liquidity: ${liquidityStatus}`;
      }

      if (isRegimeChanged && previousRegime) {
        setSystemAlert(`[SYSTEM ALERT]: MACRO REGIME SHIFT DETECTED. TRANSITIONED FROM ${previousRegime.toUpperCase()} TO ${regime?.toUpperCase()}.`);
        setLastRegime(previousRegime);
      } else if (currentRegimeRef.current === null && regime) {
        setLastRegime(regime);
      }

      if (regime) {
        setCurrentRegime(regime);
        currentRegimeRef.current = regime;
      }
      aiReasoningRef.current = aiReasoningText;
      setAiReasoning(aiReasoningText);
      setLastUpdated(new Date());
      hasAnalyzedInitially.current = true;
    } catch (error) {
      console.error("Failed to analyze regime:", error);
      setAiReasoning(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const fetchQuotes = async () => {
    try {
      const symbols = initialAssets.map(a => a.ticker).join(",");
      const [quotesRes, liquidityRes, regimeRes] = await Promise.all([
        fetch(`/api/v1/market-data/quotes?symbols=${symbols}`),
        fetch("/api/v1/market-data/liquidity"),
        fetch("/api/v1/macro-regime/snapshot"),
      ]);

      const quotesData = await quotesRes.json();
      const liquidityData = await liquidityRes.json();
      const regimeApiData = await regimeRes.json();

      if (quotesData.success) {
        const updatedAssets = initialAssets.map(asset => {
          const quote = quotesData.data?.find((q: any) => q.symbol === asset.ticker);
          return {
            ...asset,
            change: quote?.data?.dp ?? null
          };
        });
        setAssets(updatedAssets);
        setIsFallback(false);
        setLastUpdated(new Date());

        const newLiquidity = liquidityData.success ? liquidityData.data : null;
        setLiquidity(newLiquidity);

        if (regimeApiData.success && regimeApiData.data) {
          setRegimeData(regimeApiData.data);
          const quad = regimeApiData.data.quadrant as RegimeType;
          setCurrentRegime(quad);
          currentRegimeRef.current = quad;
        }

        await analyzeRegime();
      } else {
        throw new Error("Invalid API response from quotes API");
      }
    } catch (error) {
      console.error("Live Market data API failed:", error);
      setIsFallback(true);

      try {
        const [regimeRes, macroRes] = await Promise.all([
          fetch("/api/v1/macro-regime/snapshot"),
          fetch("/api/macro"),
        ]);
        const regimeApiData = await regimeRes.json();
        const fallbackData = await macroRes.json();

        const updatedAssets = initialAssets.map(asset => ({ ...asset, change: null }));
        setAssets(updatedAssets);

        if (regimeApiData.success && regimeApiData.data) {
          setRegimeData(regimeApiData.data);
          const quad = regimeApiData.data.quadrant as RegimeType;
          setCurrentRegime(quad);
          currentRegimeRef.current = quad;
        }

        setLiquidity(fallbackData.liquidity ?? null);
        await analyzeRegime();
      } catch (e) {
        console.error("Fallback macro API also failed", e);
      }
    }
  };

  useEffect(() => {
    fetchQuotes();
    const liveInterval = setInterval(fetchQuotes, 60000);

    return () => {
      clearInterval(liveInterval);
    };
  }, []);

  const clearSystemAlert = () => setSystemAlert(null);

  return (
    <MacroTerminalContext.Provider
      value={{
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
        analyzeRegime,
      }}
    >
      {children}
    </MacroTerminalContext.Provider>
  );
}

export const useMacroTerminal = () => {
  const context = useContext(MacroTerminalContext);
  if (context === undefined) {
    throw new Error("useMacroTerminal must be used within a MacroTerminalProvider");
  }
  return context;
};