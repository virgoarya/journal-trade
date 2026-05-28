"use client";

import React, { useState, useEffect } from "react";
import { ShieldAlert, BrainCircuit, RefreshCw } from "lucide-react";

interface Asset {
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

export function HeatmapPanel() {
  const [assets, setAssets] = useState<Asset[]>(initialAssets);
  const [isFallback, setIsFallback] = useState(false);
  const [reasoning, setReasoning] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const analyzeRegime = async (currentAssets: Asset[]) => {
    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/v1/macro-ai/analyze-regime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assets: currentAssets }),
      });
      const data = await res.json();
      if (data.success) {
        setReasoning(data.reasoning);
      }
    } catch (error) {
      console.error("Failed to analyze regime:", error);
      setReasoning("Gagal mendapatkan analisis regime. Coba lagi nanti.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const fetchQuotes = async () => {
    try {
      const symbols = initialAssets.map(a => a.ticker).join(",");
      const res = await fetch(`/api/v1/market-data/quotes?symbols=${symbols}`);
      const data = await res.json();
      
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

        // Otomatis analisa flow tiap kali data update
        analyzeRegime(updatedAssets);
      } else {
        throw new Error("Invalid quote API response");
      }
    } catch (error) {
      console.warn("Finnhub quotes failed, using mock ticker fallback");
      setIsFallback(true);
      // Fallback manual jika gagal
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
  }, []);

  const getColor = (change: number) => {
    if (change > 2) return "bg-green-600 text-white";
    if (change > 1) return "bg-green-700/80 text-white";
    if (change > 0) return "bg-green-900/60 text-green-100";
    if (change < -2) return "bg-red-600 text-white";
    if (change < -1) return "bg-red-700/80 text-white";
    if (change < 0) return "bg-red-900/60 text-red-100";
    return "bg-gray-700 text-white";
  };

  return (
    <div className="flex flex-col h-full glass border border-border-subtle rounded-xl overflow-hidden relative">
      <div className="bg-bg-surface/80 border-b border-border-subtle p-3 flex justify-between items-center shrink-0">
        <h2 className="text-xs font-mono font-bold text-accent-gold uppercase tracking-widest">
          Macro ETFs Heatmap
        </h2>
        <div className="flex items-center gap-3">
          {isFallback ? (
            <span className="flex items-center gap-1 text-[10px] text-data-warning font-mono bg-data-warning/10 px-2 py-0.5 rounded border border-data-warning/30">
              <ShieldAlert size={10} /> MOCK FALLBACK
            </span>
          ) : (
            <span className="text-[10px] text-data-profit font-mono animate-pulse">LIVE API</span>
          )}
        </div>
      </div>
      
      <div className="p-2 grid grid-cols-2 sm:grid-cols-4 gap-1 shrink-0">
        {assets.map((asset) => {
          const isPositive = asset.change > 0;
          return (
            <div
              key={asset.ticker}
              className={`flex flex-col items-center justify-center rounded p-2 transition-colors duration-300 ${getColor(asset.change)}`}
            >
              <span className="text-xs font-bold tracking-wide">{asset.ticker}</span>
              <span className="text-[9px] opacity-80 truncate w-full text-center mt-0.5">
                {asset.name}
              </span>
              <span className="text-sm font-mono font-bold mt-1">
                {isPositive ? "+" : ""}{asset.change.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex-1 bg-black/40 border-t border-border-subtle p-3 flex flex-col min-h-0 overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-accent-gold text-[10px] font-mono tracking-widest uppercase">
            <BrainCircuit size={12} />
            <span>Hunter AI Reasoning</span>
          </div>
          <button 
            onClick={() => analyzeRegime(assets)} 
            disabled={isAnalyzing}
            className="text-[10px] bg-white/5 hover:bg-white/10 px-2 py-1 rounded transition-colors flex items-center gap-1 disabled:opacity-50"
          >
            <RefreshCw size={10} className={isAnalyzing ? "animate-spin" : ""} /> 
            {isAnalyzing ? "ANALYZING..." : "RE-ANALYZE"}
          </button>
        </div>
        <div className="text-xs text-text-secondary leading-relaxed font-mono">
          {reasoning ? (
            <div className="animate-in fade-in duration-500">{reasoning}</div>
          ) : isAnalyzing ? (
            <div className="text-accent-gold animate-pulse">Connecting to Hunter Desk Terminal...</div>
          ) : (
            <div className="text-text-muted">Menunggu pergerakan pasar untuk dianalisis...</div>
          )}
        </div>
        {lastUpdated && (
          <div className="mt-auto pt-2 text-[9px] text-text-muted text-right">
            Last Sync: {lastUpdated.toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}
