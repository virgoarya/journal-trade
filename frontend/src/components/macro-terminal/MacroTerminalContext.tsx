"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from "react";
import {
   classifyMacroRegime,
   MacroRegime,
   MacroRegimeResult,
   classifyOnRrpLiquidity,
   OnRrpInputs,
   OnRrpStatus,
   OnRrpResult,
   RegimeTransitionAlert,
   MarketSentiment,
   deriveSentimentAndImpact,
   buildNarrativeTemplate,
} from '@/lib/macro/classifiers';
import type { QuoteApiResponse } from '@/lib/macro/types';

export interface Asset {
  ticker: string;
  name: string;
  change: number;
  weight: number; 
}

const initialAssets: Asset[] = [
  { ticker: "SPY", name: "S&P 500 (Equities)", change: 0, weight: 1.5 },
  { ticker: "QQQ", name: "Nasdaq (Tech)", change: 0, weight: 1.5 },
  { ticker: "GLD", name: "Gold (Safe Haven)", change: 0, weight: 2 },
  { ticker: "VIXY", name: "VIX (Volatility)", change: 0, weight: 2 },
  { ticker: "IEF", name: "US 10Y (Bonds)", change: 0, weight: 1 },
  { ticker: "UUP", name: "US Dollar (DXY)", change: 0, weight: 1.5 },
  { ticker: "FXY", name: "Japanese Yen", change: 0, weight: 1.5 },
  { ticker: "TIP", name: "TIPS (Real Yield)", change: 0, weight: 1 },
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

  // Helper untuk mendapatkan persentase ubahan berdasarkan ticker
  const getChange = (currentAssets: Asset[], ticker: string) => {
    return currentAssets.find(a => a.ticker === ticker)?.change || 0;
  };

  const analyzeRegime = async (currentAssetsToAnalyze: Asset[], currentLiquidity: LiquidityData | null) => {
    setIsAnalyzing(true);
    try {
      // Compute growth, inflation, assetSignals
      const spy = getChange(currentAssetsToAnalyze, "SPY");
      const ief = getChange(currentAssetsToAnalyze, "IEF");
      const tip = getChange(currentAssetsToAnalyze, "TIP");
      const gld = getChange(currentAssetsToAnalyze, "GLD");
      const vix = getChange(currentAssetsToAnalyze, "VIXY");
      const uup = getChange(currentAssetsToAnalyze, "UUP");
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
      const rawLiquidity = currentLiquidity;

      // Normalize liquidity status to match OnRrpStatus type
      let liquidityStatus: OnRrpStatus = 'Neutral';
      if (rawLiquidity) {
        if (rawLiquidity.status === 'DRAINING') {
          liquidityStatus = 'Draining';
        } else if (rawLiquidity.status === 'INJECTING') {
          liquidityStatus = 'Refilling';
        }
      }

      const { sentiment, impactOnRisk } = deriveSentimentAndImpact(macroResult.regime, liquidityStatus);

      // Determine regime shift using currentRegimeRef
      const previousRegime = currentRegimeRef.current;
      const isInitialAnalysis = !hasAnalyzedInitially.current;
      const isRegimeChanged = previousRegime !== null && previousRegime !== macroResult.regime;
      const shouldFetchAI = isInitialAnalysis || isRegimeChanged;

      let aiReasoning: string;
      if (shouldFetchAI) {
        const assetsForService = currentAssetsToAnalyze.map(a => ({
          ticker: a.ticker,
          name: a.name,
          change: a.change,
        }));
        const aiResponse = await fetch(`/api/v1/macro-ai/analyze-regime`, {
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

        // AI now generates full narrative, pass template data for context
        const narrativeContext = buildNarrativeTemplate(
          macroResult.regime,
          macroResult.shortReason,
          liquidityStatus,
          { sentiment, impactOnRisk }
        );

        // Use AI output directly, fallback is just the raw data context
        aiReasoning = aiData.success && aiData.reasoning ? aiData.reasoning.trim() : `Regime: ${macroResult.regime}, Liquidity: ${liquidityStatus}`;
      } else {
        // Keep existing reasoning to avoid unnecessary API call
        aiReasoning = aiReasoningRef.current ?? `Regime: ${macroResult.regime}, Liquidity: ${liquidityStatus}`;
      }

      if (isRegimeChanged) {
        setSystemAlert(`[SYSTEM ALERT]: MACRO REGIME SHIFT DETECTED. TRANSITIONED FROM ${previousRegime!.toUpperCase()} TO ${macroResult.regime.toUpperCase()}.`);
        setLastRegime(previousRegime);

        // Create system notification for regime shift
        try {
          await fetch("/api/v1/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: "system",
              type: "SYSTEM",
              title: "⚠️ MACRO REGIME SHIFT",
              message: `Market telah memasuki fase ${macroResult.regime}.`,
            }),
          });
        } catch (notifyError) {
          console.error("Failed to create regime shift notification:", notifyError);
        }
      } else if (currentRegimeRef.current === null) {
        setLastRegime(macroResult.regime);
      }

      setCurrentRegime(macroResult.regime);
      currentRegimeRef.current = macroResult.regime;
      aiReasoningRef.current = aiReasoning;

      setAiReasoning(aiReasoning);
      setLastUpdated(new Date());
      hasAnalyzedInitially.current = true;
    } catch (error) {
      console.error("Failed to analyze regime:", error);
      setAiReasoning("Gagal mendapatkan analisis regime. Coba lagi nanti.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const fetchLiquidity = async () => {
    try {
      const res = await fetch("/api/v1/market-data/liquidity");
      const data = await res.json();
      if (data.success && data.data) {
        setLiquidity(data.data);
        return data.data;
      }
    } catch (error) {
      console.error("Failed to fetch liquidity data:", error);
    }
    return null;
  };

  const fetchQuotes = async () => {
    try {
      const symbols = initialAssets.map(a => a.ticker).join(",");
      const res = await fetch(`/api/v1/market-data/quotes?symbols=${symbols}`);
      const data = (await res.json()) as QuoteApiResponse;

      const newLiquidity = await fetchLiquidity();

      if (data.success && data.data) {
        const updatedAssets = initialAssets.map(asset => {
          const apiQuote = data.data.find((q) => q.symbol === asset.ticker);
          let change: number | null = null;

          if (apiQuote?.data?.dp !== undefined && apiQuote.data.dp !== null) {
            change = apiQuote.data.dp;
          }

          return {
            ...asset,
            change: change !== null ? parseFloat(change.toFixed(2)) : null
          };
        });

        setAssets(updatedAssets);
        setIsFallback(false);
        setLastUpdated(new Date());

        await analyzeRegime(updatedAssets, newLiquidity);
      } else {
        console.warn("Yahoo Finance quotes returned empty or invalid data");
      }
    } catch (error) {
      console.warn("Stooq quotes failed, using mock ticker fallback");
      setIsFallback(true);
      setAssets((current) =>
        current.map((asset) => {
          const jitter = (Math.random() - 0.5) * 0.8;
          return { ...asset, change: parseFloat((asset.change + jitter).toFixed(2)) };
        })
      );
    }
  };

  useEffect(() => {
    let mockInterval: NodeJS.Timeout | null = null;
    fetchQuotes();
    const liveInterval = setInterval(fetchQuotes, 60000);
    
    return () => {
      clearInterval(liveInterval);
      if (mockInterval) clearInterval(mockInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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