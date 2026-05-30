"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from "react";
import {
  classifyMacroRegime,
  MacroRegime,
  MacroRegimeResult,
  classifyOnRrpLiquidity,
  OnRrpResult,
  deriveSentimentAndImpact,
  buildNarrativeTemplate,
} from '@/lib/macro/classifiers';

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
}

export type RegimeType = "Goldilocks" | "Reflation" | "Stagflation" | "Inflation" | "Deflation" | "Unknown";

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
      const liquidityResult = classifyOnRrpLiquidity({
        currentBalance: currentLiquidity ? currentLiquidity.value / 1000 : 0,
        deltaDaily: currentLiquidity ? currentLiquidity.change : 0,
      });

      const { sentiment, impactOnRisk } = deriveSentimentAndImpact(macroResult.regime, liquidityResult.status);
      
      // Call the macro-ai endpoint to get shortReason (1-2 sentences) in Indonesian
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
          liquidityStatus: liquidityResult.status,
        }),
      });
      const aiData = await aiResponse.json();
      const aiShortReason = aiData.success && aiData.reasoning ? aiData.reasoning.trim() : "";
      
      // If AI failed to return a reason, fallback to the rule-based shortReason from macroResult
      const finalShortReason = aiShortReason || macroResult.shortReason;

      const narrative = buildNarrativeTemplate(
        macroResult.regime,
        finalShortReason,
        liquidityResult.status,
        { sentiment, impactOnRisk }
      );

      // Determine regime shift using currentRegimeRef
      const isInitialAnalysis = !hasAnalyzedInitially.current;
      const isRegimeShift = currentRegimeRef.current !== null && currentRegimeRef.current !== macroResult.regime;
      if (isRegimeShift) {
        setSystemAlert(`[SYSTEM ALERT]: MACRO REGIME SHIFT DETECTED. TRANSITIONED FROM ${currentRegimeRef.current!.toUpperCase()} TO ${macroResult.regime.toUpperCase()}.`);
        setLastRegime(currentRegimeRef.current);
      } else if (currentRegimeRef.current === null) {
        setLastRegime(macroResult.regime);
      }
      setCurrentRegime(macroResult.regime);
      currentRegimeRef.current = macroResult.regime;

      setAiReasoning(narrative);
      setLastUpdated(new Date());
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
      const data = await res.json();
      
      const newLiquidity = await fetchLiquidity();
      
      if (data.success && data.data) {
        const updatedAssets = initialAssets.map(asset => {
          const apiQuote = data.data.find((q: any) => q.symbol === asset.ticker);
          let change = asset.change;
          
          if (apiQuote && apiQuote.data && apiQuote.data.dp !== undefined && apiQuote.data.dp !== null) {
            change = apiQuote.data.dp;
          }
          
          return {
            ...asset,
            change: parseFloat(change.toFixed(2))
          };
        });
        
        setAssets(updatedAssets);
        setIsFallback(false);
        setLastUpdated(new Date());
        
        // Analisis regime dan likuiditas (memanggil fungsi analisis yang sudah mencakup deteksi shift dan narrative)
        await analyzeRegime(updatedAssets, newLiquidity);
      } else {
        throw new Error("Invalid quote API response");
      }
    } catch (error) {
      console.warn("Finnhub quotes failed, using mock ticker fallback");
      setIsFallback(true);
      // Fallback dummy
      setAssets((current) =>
        current.map((asset) => {
          const jitter = (Math.random() - 0.5) * 0.1;
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