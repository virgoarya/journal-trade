"use client";

import React, { useEffect, useState } from "react";
import { useMacroTerminal } from "./MacroTerminalContext";
import {
  classifyMacroRegime,
  MacroRegime,
} from "@/lib/macro/classifiers";
import { calculateInflationMomentum, aggregateMacroScores } from "@/lib/macro/calculations";
import type { MacroRawInputs } from "@/lib/macro/calculations";

const regimes = [
  {
    id: "Stagflation",
    title: "Stagflation",
    growth: "Low",
    inflation: "High",
    assets: "Gold, Cmdty, CHF",
    colorClass: "bg-data-warning/20 border-data-warning/50 text-data-warning",
    activeColorClass: "bg-data-warning/30 border-data-warning shadow-[0_0_15px_rgba(255,167,38,0.3)]",
  },
  {
    id: "Goldilocks",
    title: "Goldilocks",
    growth: "High",
    inflation: "Optimal",
    assets: "Tech, Crypto, HY",
    colorClass: "bg-data-profit/20 border-data-profit/50 text-data-profit",
    activeColorClass: "bg-data-profit/30 border-data-profit shadow-[0_0_15px_rgba(0,230,118,0.3)]",
  },
  {
    id: "Deflation",
    title: "Deflation",
    growth: "Low",
    inflation: "Low",
    assets: "Bonds, USD, JPY",
    colorClass: "bg-blue-500/20 border-blue-500/50 text-blue-400",
    activeColorClass: "bg-blue-500/30 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]",
  },
  {
    id: "Reflation",
    title: "Reflation",
    growth: "High",
    inflation: "Rising",
    assets: "Value, Ind, EM",
    colorClass: "bg-purple-500/20 border-purple-500/50 text-purple-400",
    activeColorClass: "bg-purple-500/30 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)]",
  },
  {
    id: "Slowdown",
    title: "Slowdown",
    growth: "Low",
    inflation: "Low",
    assets: "Bonds, Defensive, USD",
    colorClass: "bg-gray-500/20 border-gray-500/50 text-gray-400",
    activeColorClass: "bg-gray-500/30 border-gray-500 shadow-[0_0_15px_rgba(107,114,128,0.3)]",
  },
  {
    id: "Neutral Transition",
    title: "Netral",
    growth: "Netral",
    inflation: "Netral",
    assets: "Campuran",
    colorClass: "bg-gray-600/20 border-gray-600/50 text-gray-300",
    activeColorClass: "bg-gray-600/30 border-gray-600 shadow-[0_0_15px_rgba(75,85,99,0.3)]",
  },
];

export function MacroRegimePanel() {
  const { currentRegime } = useMacroTerminal();
  const [activeId, setActiveId] = useState<MacroRegime | null>(null);
  const [inflationMomentum, setInflationMomentum] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMacroData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/macro");
        
        if (!response.ok) {
          throw new Error(`API error: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.success && result.data && result.cpiMoM) {
          const macroInputs: MacroRawInputs = result.data;
          const cpiMoM: number[] = result.cpiMoM;
          
          // Calculate inflation momentum
          const momentum = calculateInflationMomentum(cpiMoM);
          setInflationMomentum(momentum);
          
          // Aggregate macro scores
          const { growthScore, inflationScore } = aggregateMacroScores(macroInputs);
          
          // Classify regime using the calculated scores
          const macroResult = classifyMacroRegime({
            growth: growthScore,
            inflation: inflationScore,
            assetSignals: {}, // will be populated from asset context
          });
          
          setActiveId(macroResult.regime);
        }
      } catch (err) {
        console.error("Failed to fetch macro data:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchMacroData();
    const interval = setInterval(fetchMacroData, 60000); // Refresh every 60 seconds
    
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full glass border border-border-subtle rounded-xl overflow-hidden">
        <div className="bg-bg-surface/80 border-b border-border-subtle p-3">
          <h2 className="text-xs font-mono font-bold text-accent-gold uppercase tracking-widest">
            Macro Regime Matrix
          </h2>
        </div>
        <div className="flex-1 p-4 flex items-center justify-center">
          <span className="text-text-muted text-xs">Memuat data makro...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full glass border border-border-subtle rounded-xl overflow-hidden">
        <div className="bg-bg-surface/80 border-b border-border-subtle p-3">
          <h2 className="text-xs font-mono font-bold text-accent-gold uppercase tracking-widest">
            Macro Regime Matrix
          </h2>
        </div>
        <div className="flex-1 p-4 flex items-center justify-center">
          <span className="text-data-warning text-xs">Error: {error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full glass border border-border-subtle rounded-xl overflow-hidden">
      <div className="bg-bg-surface/80 border-b border-border-subtle p-3 flex justify-between items-center">
        <h2 className="text-xs font-mono font-bold text-accent-gold uppercase tracking-widest flex items-center gap-2">
          Macro Regime Matrix
          {currentRegime === "Unknown" && (
            <span className="text-[9px] text-text-muted lowercase tracking-normal bg-bg-void/50 px-1.5 py-0.5 rounded border border-border-subtle animate-pulse">
              analyzing market...
            </span>
          )}
        </h2>
        <span className="text-[10px] bg-accent-gold/20 text-accent-gold px-2 py-0.5 rounded animate-pulse">
          LIVE
        </span>
      </div>
      <div className="flex-1 p-4 flex flex-col items-center justify-center relative">
        {/* Y-Axis Label */}
        <div className="absolute left-1 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] text-text-muted font-mono tracking-widest uppercase">
          Inflation
        </div>
        {/* X-Axis Label */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-text-muted font-mono tracking-widest uppercase">
          Growth
        </div>

        <div className="grid grid-cols-2 grid-rows-2 gap-2 w-[85%] h-[85%]">
          {regimes.map((regime) => {
            const isActive = activeId === regime.id;
            return (
              <div
                key={regime.id}
                className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all duration-500 ${
                  isActive ? regime.activeColorClass : `${regime.colorClass} opacity-40 grayscale-[50%]`
                }`}
              >
                <span className="text-xs font-bold uppercase tracking-wider mb-1">
                  {regime.title}
                </span>
                {/* Growth and Inflation labels with momentum arrow on inflation */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider">G: {regime.growth}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-text-primary/70">I: {regime.inflation}</span>
                    {inflationMomentum !== 0 && (
                      <>
                        {inflationMomentum < 0 ? (
                          <>
                            <span role="img" aria-label="down" className="text-emerald-500">▼</span>
                            <span className="text-[8px] text-emerald-500">Cooling</span>
                          </>
                        ) : (
                          <>
                            <span role="img" aria-label="up" className="text-rose-500">▲</span>
                            <span className="text-[8px] text-rose-500">Heating</span>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <div className="text-[9px] bg-bg-void/50 px-2 py-1 rounded w-full text-center truncate">
                  {regime.assets}
                </div>
              </div>
            );
          })}
        </div>

        {/* Center Crosshair */}
        <div className="absolute top-1/2 left-[calc(50%+6px)] w-[85%] h-px bg-border-subtle -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
        <div className="absolute top-[calc(50%-6px)] left-1/2 w-px h-[85%] bg-border-subtle -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
      </div>
    </div>
  );
}