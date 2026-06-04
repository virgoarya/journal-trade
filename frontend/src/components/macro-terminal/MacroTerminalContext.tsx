"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from "react";
import {
  classifyMacroRegime,
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
}

export type RegimeType = "Goldilocks" | "Reflation" | "Stagflation" | "Slowdown" | "Deflation" | "Neutral Transition";

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
  analyzeRegime: (currentAssets: Asset[], currentLiquidity: LiquidityData | null) => Promise<void>;
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
  const hasAnalyzedInitially = useRef(false);
  const currentRegimeRef = useRef<RegimeType | null>(null);
  const aiReasoningRef = useRef<string | null>(null);

  const getChange = (currentAssets: Asset[], ticker: string) => {
    const asset = currentAssets.find(a => a.ticker === ticker);
    return asset?.change ?? 0;
  };

  const analyzeRegime = async (currentAssetsToAnalyze: Asset[], currentLiquidity: LiquidityData | null) => {
    setIsAnalyzing(true);
    try {
      const spy = getChange(currentAssetsToAnalyze, "SPY");
      const ief = getChange(currentAssetsToAnalyze, "IEF");
      const tip = getChange(currentAssetsToAnalyze, "TIP");
      const gld = getChange(currentAssetsToAnalyze, "GLD");
      const vix = getChange(currentAssetsToAnalyze, "VIXY");
      const fxy = getChange(currentAssetsToAnalyze, "FXY");

      const growth = spy - ief;
      const inflation = (tip + gld) / 2 - ief;

      const assetSignals = {
        gldUp: gld > 0,
        vixUp: vix > 0,
        iefDown: ief < 0,
        fxyUp: fxy > 0,
      };

      const macroResult = classifyMacroRegime({ growth, inflation, assetSignals });

      let liquidityStatus: OnRrpStatus = 'Neutral';
      if (currentLiquidity) {
        if (currentLiquidity.status === 'DRAINING') {
          liquidityStatus = 'Draining';
        } else if (currentLiquidity.status === 'INJECTING') {
          liquidityStatus = 'Refilling';
        }
      }

      const { sentiment } = deriveSentimentAndImpact(macroResult.regime, liquidityStatus);

      const previousRegime = currentRegimeRef.current;
      const isInitialAnalysis = !hasAnalyzedInitially.current;
      const isRegimeChanged = previousRegime !== null && previousRegime !== macroResult.regime;
      const shouldFetchAI = isInitialAnalysis || isRegimeChanged;

      let aiReasoningText: string;
      if (shouldFetchAI) {
        const assetsForService = currentAssetsToAnalyze.map(a => ({
          ticker: a.ticker,
          name: a.name,
          change: a.change,
        }));
        const aiResponse = await fetch("/api/v1/macro-ai/analyze-regime", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assets: assetsForService,
            calculatedRegime: macroResult.regime,
            liquidityStatus: liquidityStatus,
            sentiment: sentiment,
          }),
        });
        const aiData = await aiResponse.json();
        aiReasoningText = aiData.success && aiData.reasoning ? aiData.reasoning.trim() : `Regime: ${macroResult.regime}, Liquidity: ${liquidityStatus}`;
      } else {
        aiReasoningText = aiReasoningRef.current ?? `Regime: ${macroResult.regime}, Liquidity: ${liquidityStatus}`;
      }

      if (isRegimeChanged) {
        setSystemAlert(`[SYSTEM ALERT]: MACRO REGIME SHIFT DETECTED. TRANSITIONED FROM ${previousRegime!.toUpperCase()} TO ${macroResult.regime.toUpperCase()}.`);
        setLastRegime(previousRegime);
      } else if (currentRegimeRef.current === null) {
        setLastRegime(macroResult.regime);
      }

      setCurrentRegime(macroResult.regime);
      currentRegimeRef.current = macroResult.regime;
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
      const [quotesRes, liquidityRes] = await Promise.all([
        fetch(`/api/v1/market-data/quotes?symbols=${symbols}`),
        fetch("/api/v1/market-data/liquidity"),
      ]);

      const quotesData = await quotesRes.json();
      const liquidityData = await liquidityRes.json();

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
        
        await analyzeRegime(updatedAssets, newLiquidity);
      } else {
        throw new Error("Invalid API response from quotes API");
      }
    } catch (error) {
      console.error("Live Market data API failed:", error);
      setIsFallback(true);
      
      // Fallback to fundamental only
      try {
        const res = await fetch("/api/macro");
        const fallbackData = await res.json();
        if (fallbackData.success) {
          const updatedAssets = initialAssets.map(asset => ({ ...asset, change: null }));
          setAssets(updatedAssets);
          setLiquidity(fallbackData.liquidity ?? null);
          await analyzeRegime(updatedAssets, fallbackData.liquidity ?? null);
        }
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