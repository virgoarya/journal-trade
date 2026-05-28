"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from "react";

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

export type RegimeType = "Goldilocks" | "Reflation" | "Stagflation" | "Deflation" | "Unknown";

interface MacroTerminalContextProps {
  assets: Asset[];
  liquidity: LiquidityData | null;
  isFallback: boolean;
  currentRegime: RegimeType;
  lastRegime: RegimeType;
  aiReasoning: string | null;
  isAnalyzing: boolean;
  lastUpdated: Date | null;
  systemAlert: string | null;
  clearSystemAlert: () => void;
  analyzeRegime: () => Promise<void>;
}

const MacroTerminalContext = createContext<MacroTerminalContextProps | undefined>(undefined);

export function MacroTerminalProvider({ children }: { children: ReactNode }) {
  const [assets, setAssets] = useState<Asset[]>(initialAssets);
  const [liquidity, setLiquidity] = useState<LiquidityData | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const [currentRegime, setCurrentRegime] = useState<RegimeType>("Unknown");
  const [lastRegime, setLastRegime] = useState<RegimeType>("Unknown");
  
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const [systemAlert, setSystemAlert] = useState<string | null>(null);

  // Helper untuk mendapatkan persentase ubahan berdasarkan ticker
  const getChange = (currentAssets: Asset[], ticker: string) => {
    return currentAssets.find(a => a.ticker === ticker)?.change || 0;
  };

  // Rumus Kuantitatif (Bridgewater / Hedgeye 4-Quads logic)
  const calculateRegime = (currentAssets: Asset[]): RegimeType => {
    const spy = getChange(currentAssets, "SPY");
    const ief = getChange(currentAssets, "IEF");
    const tip = getChange(currentAssets, "TIP");
    const gld = getChange(currentAssets, "GLD");

    // Sumbu Growth
    const isGrowthHigh = spy > ief;
    
    // Sumbu Inflasi
    const avgInflationProxies = (tip + gld) / 2;
    const isInflationHigh = avgInflationProxies > ief;

    if (isGrowthHigh && !isInflationHigh) return "Goldilocks";
    if (isGrowthHigh && isInflationHigh) return "Reflation";
    if (!isGrowthHigh && !isInflationHigh) return "Deflation";
    if (!isGrowthHigh && isInflationHigh) return "Stagflation";
    
    return "Unknown";
  };

  const analyzeRegime = async (currentAssetsToAnalyze: Asset[] = assets, currentLiquidity: LiquidityData | null = liquidity) => {
    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/v1/macro-ai/analyze-regime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          assets: currentAssetsToAnalyze,
          calculatedRegime: calculateRegime(currentAssetsToAnalyze),
          liquidityStatus: currentLiquidity?.status
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAiReasoning(data.reasoning);
      }
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

        // Hitung Regime
        const newlyCalculatedRegime = calculateRegime(updatedAssets);
        
        setCurrentRegime((prev) => {
          if (prev !== "Unknown" && prev !== newlyCalculatedRegime) {
            // Regime Shift Terdeteksi!
            setSystemAlert(`[SYSTEM ALERT]: MACRO REGIME SHIFT DETECTED. TRANSITIONED FROM ${prev.toUpperCase()} TO ${newlyCalculatedRegime.toUpperCase()}.`);
            setLastRegime(prev);
          } else if (prev === "Unknown") {
            setLastRegime(newlyCalculatedRegime);
          }
          return newlyCalculatedRegime;
        });

        // Trigger AI Analysis
        analyzeRegime(updatedAssets, newLiquidity);
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
    let mockInterval: NodeJS.Timeout;
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
        analyzeRegime: () => analyzeRegime(assets, liquidity),
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
