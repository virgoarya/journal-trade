"use client";

import React, { useState, useEffect } from "react";
import { ShieldAlert } from "lucide-react";

interface Asset {
  ticker: string;
  name: string;
  change: number;
  weight: number; 
}

const initialAssets: Asset[] = [
  { ticker: "BINANCE:BTCUSDT", name: "Bitcoin", change: -3.45, weight: 1.5 },
  { ticker: "OANDA:EUR_USD", name: "Euro", change: -0.55, weight: 1 },
  { ticker: "OANDA:XAU_USD", name: "Gold", change: 1.45, weight: 2 },
  { ticker: "AAPL", name: "Apple", change: 0.82, weight: 1.5 },
  { ticker: "MSFT", name: "Microsoft", change: 2.15, weight: 1.5 },
  { ticker: "TSLA", name: "Tesla", change: -1.25, weight: 2 },
  { ticker: "META", name: "Meta", change: -2.10, weight: 1.5 },
  { ticker: "GOOGL", name: "Google", change: 0.65, weight: 1 },
];

export function HeatmapPanel() {
  const [assets, setAssets] = useState<Asset[]>(initialAssets);
  const [isFallback, setIsFallback] = useState(false);

  useEffect(() => {
    let mockInterval: NodeJS.Timeout;

    const fetchQuotes = async () => {
      try {
        const symbols = initialAssets.map(a => a.ticker).join(",");
        const res = await fetch(\`/api/v1/market-data/quotes?symbols=\${symbols}\`);
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
        } else {
          throw new Error("Invalid quote API response");
        }
      } catch (error) {
        console.warn("Finnhub quotes failed, using mock ticker fallback");
        setIsFallback(true);
        mockInterval = setInterval(() => {
          setAssets((current) =>
            current.map((asset) => {
              const jitter = (Math.random() - 0.5) * 0.1;
              return { ...asset, change: parseFloat((asset.change + jitter).toFixed(2)) };
            })
          );
        }, 3000);
      }
    };

    fetchQuotes();
    const liveInterval = setInterval(fetchQuotes, 60000); // refresh every minute

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

  const getDisplayTicker = (ticker: string) => {
    if (ticker.includes(":")) return ticker.split(":")[1].replace("_", "/");
    return ticker;
  };

  return (
    <div className="flex flex-col h-full glass border border-border-subtle rounded-xl overflow-hidden relative">
      <div className="bg-bg-surface/80 border-b border-border-subtle p-3 flex justify-between items-center">
        <h2 className="text-xs font-mono font-bold text-accent-gold uppercase tracking-widest">
          Sector Assets Heatmap
        </h2>
        {isFallback ? (
          <span className="flex items-center gap-1 text-[10px] text-data-warning font-mono bg-data-warning/10 px-2 py-0.5 rounded border border-data-warning/30">
            <ShieldAlert size={10} /> MOCK FALLBACK
          </span>
        ) : (
          <span className="text-[10px] text-data-profit">LIVE API</span>
        )}
      </div>
      <div className="flex-1 p-2 grid grid-cols-2 sm:grid-cols-4 gap-1 auto-rows-fr">
        {assets.map((asset) => {
          const isPositive = asset.change > 0;
          return (
            <div
              key={asset.ticker}
              className={\`flex flex-col items-center justify-center rounded p-1 transition-colors duration-300 \${getColor(asset.change)}\`}
            >
              <span className="text-xs font-bold tracking-wide">{getDisplayTicker(asset.ticker)}</span>
              <span className="text-[10px] opacity-80 truncate w-full text-center hidden sm:block">
                {asset.name}
              </span>
              <span className="text-xs font-mono font-semibold mt-1">
                {isPositive ? "+" : ""}{asset.change.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
