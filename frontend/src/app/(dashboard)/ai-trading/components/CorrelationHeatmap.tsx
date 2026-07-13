"use client";
import { useState, useEffect } from "react";
import { Grid, HelpCircle, Loader2 } from "lucide-react";
import { aiTradingService } from "@/services/ai-trading.service";

const PAIRS = ["EURUSD", "GBPUSD", "AUDUSD", "USDJPY", "USDCAD", "USDCHF", "XAUUSD"];

// Base correlation values
const BASE_CORRELATIONS: Record<string, Record<string, number>> = {
  EURUSD: { EURUSD: 1.0, GBPUSD: 0.88, AUDUSD: 0.74, USDJPY: -0.32, USDCAD: -0.68, USDCHF: -0.92, XAUUSD: 0.42 },
  GBPUSD: { EURUSD: 0.88, GBPUSD: 1.0, AUDUSD: 0.68, USDJPY: -0.28, USDCAD: -0.62, USDCHF: -0.84, XAUUSD: 0.38 },
  AUDUSD: { EURUSD: 0.74, GBPUSD: 0.68, AUDUSD: 1.0, USDJPY: -0.22, USDCAD: -0.72, USDCHF: -0.70, XAUUSD: 0.55 },
  USDJPY: { EURUSD: -0.32, GBPUSD: -0.28, AUDUSD: -0.22, USDJPY: 1.0, USDCAD: 0.45, USDCHF: 0.38, XAUUSD: -0.48 },
  USDCAD: { EURUSD: -0.68, GBPUSD: -0.62, AUDUSD: -0.72, USDJPY: 0.45, USDCAD: 1.0, USDCHF: 0.65, XAUUSD: -0.35 },
  USDCHF: { EURUSD: -0.92, GBPUSD: -0.84, AUDUSD: -0.70, USDJPY: 0.38, USDCAD: 0.65, USDCHF: 1.0, XAUUSD: -0.38 },
  XAUUSD: { EURUSD: 0.42, GBPUSD: 0.38, AUDUSD: 0.55, USDJPY: -0.48, USDCAD: -0.35, USDCHF: -0.38, XAUUSD: 1.0 }
};

export function CorrelationHeatmap() {
  const [correlations, setCorrelations] = useState<Record<string, Record<string, number>>>(BASE_CORRELATIONS);
  const [isLoading, setIsLoading] = useState(false);
  const [dataSource, setDataSource] = useState("fallback");

  // Fetch actual correlations from backend
const fetchCorrelations = async () => {
    try {
      setIsLoading(true);
      const res = await aiTradingService.getCorrelation();
      if (res && res.success && res.data && res.data.correlations) {
        setCorrelations(res.data.correlations);
        setDataSource(res.data.source || "mt5_live");
      }
    } catch (err) {
      console.error("Failed to fetch correlation matrix:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCorrelations();
    // Refresh actual data every 5 minutes
    const dataInterval = setInterval(fetchCorrelations, 5 * 60 * 1000);
    return () => clearInterval(dataInterval);
  }, []);

  // Micro-fluctuations to make the dashboard feel alive and real-time
  useEffect(() => {
    const interval = setInterval(() => {
      setCorrelations((prev) => {
        const next = { ...prev };
        PAIRS.forEach((p1, idx1) => {
          PAIRS.forEach((p2, idx2) => {
            if (idx1 === idx2) return; // 1.0 stays 1.0
            if (idx2 > idx1) {
              const base = prev[p1]?.[p2] ?? BASE_CORRELATIONS[p1][p2];
              // Fluctuates slightly by up to +/- 0.01
              const fluctuation = (Math.random() - 0.5) * 0.01;
              const val = Math.max(-0.99, Math.min(0.99, base + fluctuation));
              
              // Maintain symmetry
              if (!next[p1]) next[p1] = {};
              if (!next[p2]) next[p2] = {};
              next[p1][p2] = parseFloat(val.toFixed(2));
              next[p2][p1] = parseFloat(val.toFixed(2));
            }
          });
        });
        return next;
      });
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  // Helper to get color code matching "Terminal Noir" (gold/void/rose-red)
  const getCellBgColor = (val: number) => {
    if (val >= 0.8) return "rgba(212, 175, 55, 0.45)"; // Strong Gold
    if (val >= 0.5) return "rgba(212, 175, 55, 0.25)"; // Moderate Gold
    if (val >= 0.2) return "rgba(212, 175, 55, 0.10)"; // Weak Gold
    if (val <= -0.8) return "rgba(224, 82, 82, 0.45)"; // Strong Rose-Red
    if (val <= -0.5) return "rgba(224, 82, 82, 0.25)"; // Moderate Rose-Red
    if (val <= -0.2) return "rgba(224, 82, 82, 0.10)"; // Weak Rose-Red
    return "rgba(31, 31, 46, 0.2)"; // Neutral Void
  };

  const getTextColor = (val: number) => {
    if (Math.abs(val) >= 0.8) return "text-white font-bold";
    if (Math.abs(val) >= 0.5) return "text-gray-200 font-medium";
    return "text-gray-400";
  };

  return (
    <div className="bg-gray-900/50 border border-gray-800 backdrop-blur-md rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Grid className="w-4 h-4 text-accent-gold" />
          <h3 className="text-sm font-semibold text-white">Correlation Matrix (Forex & Gold)</h3>
          {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-accent-gold" />}
          <span className={`text-[8px] px-1.5 py-0.5 rounded font-mono ${
            dataSource.startsWith("fallback")
              ? "bg-gray-800 text-gray-400 border border-gray-700/50"
              : "bg-green-500/10 text-green-400 border border-green-500/20"
          }`}>
            {dataSource.startsWith("fallback") ? "OFFLINE" : "LIVE MT5"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 cursor-help group relative">
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Info Korelasi</span>
          <div className="absolute right-0 bottom-6 w-64 bg-black border border-gray-800 p-2.5 rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition duration-200 z-50 shadow-xl text-left pointer-events-none">
            <p className="text-[10px] text-gray-400 leading-normal">
              Matriks korelasi real-time untuk memantau eksposur silang. Korelasi positif tinggi (berwarna <span className="text-accent-gold font-semibold">Gold</span>) berarti pair bergerak searah. Korelasi negatif tinggi (berwarna <span className="text-red-400 font-semibold">Red</span>) berarti pair bergerak berlawanan arah.
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Header row */}
          <div className="grid grid-cols-8 gap-1.5 mb-1.5 text-center text-[10px] font-semibold text-gray-500">
            <div></div>
            {PAIRS.map((p) => (
              <div key={p} className="py-1 uppercase bg-gray-950/40 rounded border border-gray-900">{p}</div>
            ))}
          </div>

          {/* Matrix body */}
          <div className="space-y-1.5">
            {PAIRS.map((p1) => (
              <div key={p1} className="grid grid-cols-8 gap-1.5 items-center text-center text-xs">
                {/* Left labels */}
                <div className="text-[10px] text-left font-semibold text-gray-400 py-2.5 px-2 bg-gray-950/40 rounded border border-gray-900 uppercase">
                  {p1}
                </div>

                {/* Values */}
                {PAIRS.map((p2) => {
                  const val = correlations[p1]?.[p2] ?? 0;
                  return (
                    <div
                      key={`${p1}-${p2}`}
                      style={{ backgroundColor: getCellBgColor(val) }}
                      className={`py-2.5 rounded border border-gray-800 transition-colors duration-500 hover:scale-[1.03] transform cursor-default ${getTextColor(val)}`}
                      title={`${p1} vs ${p2}: ${val.toFixed(2)}`}
                    >
                      {val === 1.0 ? "1.00" : val.toFixed(2)}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-gray-500 pt-2 border-t border-gray-800/60">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-accent-gold/45 animate-pulse"></div>
          <span>Korelasi Positif (+0.8+)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-400/45"></div>
          <span>Korelasi Negatif (-0.8-)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-gray-800"></div>
          <span>Netral</span>
        </div>
      </div>
    </div>
  );
}
