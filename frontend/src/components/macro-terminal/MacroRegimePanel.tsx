"use client";

import React, { useEffect, useState } from "react";
import { useMacroTerminal } from "./MacroTerminalContext";
import {
  classifyMacroRegime,
  MacroRegime,
} from "@/lib/macro/classifiers";
import { calculateInflationMomentum, aggregateMacroScores } from "@/lib/macro/calculations";
import type { MacroRawInputs } from "@/lib/macro/types";

type RegimeCardProps = {
  id: string;
  title: string;
  growth: string;
  inflation: string;
  assets: string;
  activeColorClass: string;
  inactiveColorClass: string;
  isActive: boolean;
  inflationMomentum: number;
};

const RegimeCard = ({ 
  title, 
  growth, 
  inflation, 
  assets, 
  activeColorClass, 
  inactiveColorClass, 
  isActive,
  inflationMomentum 
}: RegimeCardProps) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all duration-500 ${
        isActive 
          ? `${activeColorClass} shadow-lg` 
          : `${inactiveColorClass} opacity-40 grayscale-[50%]`
      }`}
    >
      <span className="text-xs font-bold uppercase tracking-wider mb-1.5">{title}</span>
      <div className="flex flex-col items-center gap-1 mb-1.5">
        <span className="text-[9px] text-text-primary/70">G: {growth}</span>
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-text-primary/70">I: {inflation}</span>
          {inflationMomentum < 0 ? (
            <span className="text-emerald-500 text-[8px] font-mono">▼ Cooling</span>
          ) : inflationMomentum > 0 ? (
            <span className="text-rose-500 text-[8px] font-mono">▲ Heating</span>
          ) : null}
        </div>
      </div>
      <div className="text-[8px] bg-bg-void/50 px-2 py-0.5 rounded w-full text-center truncate">
        {assets}
      </div>
    </div>
  );
};

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
          
          const momentum = calculateInflationMomentum(cpiMoM);
          setInflationMomentum(momentum);
          
          const { growthScore, inflationScore } = aggregateMacroScores(macroInputs);
          
          const macroResult = classifyMacroRegime({
            growth: growthScore,
            inflation: inflationScore,
            assetSignals: {},
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
    const interval = setInterval(fetchMacroData, 60000);
    
    return () => clearInterval(interval);
  }, []);

  // Regime configurations based on 2x2 matrix (top-left to bottom-right)
  const quadrantRegimes = [
    {
      id: "Stagflation",
      title: "Stagflation",
      growth: "Low",
      inflation: "High",
      assets: "Gold, Cmdty, CHF",
      inactiveColorClass: "bg-data-warning/20 border-data-warning/50 text-data-warning",
      activeColorClass: "bg-data-warning/40 border-data-warning shadow-[0_0_15px_rgba(255,167,38,0.4)]",
    },
    {
      id: "Goldilocks",
      title: "Goldilocks",
      growth: "High",
      inflation: "Optimal",
      assets: "Tech, Crypto, HY",
      inactiveColorClass: "bg-data-profit/20 border-data-profit/50 text-data-profit",
      activeColorClass: "bg-data-profit/40 border-data-profit shadow-[0_0_15px_rgba(0,230,118,0.4)]",
    },
    {
      id: "Deflation",
      title: "Deflation",
      growth: "Low",
      inflation: "Low",
      assets: "Bonds, USD, JPY",
      inactiveColorClass: "bg-blue-500/20 border-blue-500/50 text-blue-400",
      activeColorClass: "bg-blue-500/40 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.4)]",
    },
    {
      id: "Reflation",
      title: "Reflation",
      growth: "High",
      inflation: "Rising",
      assets: "Value, Ind, EM",
      inactiveColorClass: "bg-purple-500/20 border-purple-500/50 text-purple-400",
      activeColorClass: "bg-purple-500/40 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.4)]",
    },
  ];

  const extraRegimes = [
    {
      id: "Slowdown",
      title: "Slowdown",
      growth: "Low",
      inflation: "Low",
      assets: "Bonds, Defensive, USD",
      inactiveColorClass: "bg-gray-500/20 border-gray-500/50 text-gray-400",
      activeColorClass: "bg-gray-500/40 border-gray-500 shadow-[0_0_15px_rgba(107,114,128,0.4)]",
    },
    {
      id: "Neutral Transition",
      title: "Netral",
      growth: "Netral",
      inflation: "Netral",
      assets: "Campuran",
      inactiveColorClass: "bg-gray-600/20 border-gray-600/50 text-gray-300",
      activeColorClass: "bg-gray-600/40 border-gray-600 shadow-[0_0_15px_rgba(75,85,99,0.4)]",
    },
  ];

  if (isLoading) {
    return (
      <div className="flex flex-col h-full glass border border-border-subtle rounded-xl overflow-hidden bg-[#020202]">
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
      <div className="flex flex-col h-full glass border border-border-subtle rounded-xl overflow-hidden bg-[#020202]">
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
    <div className="flex flex-col h-full glass border border-border-subtle rounded-xl overflow-hidden bg-[#020202]">
      <div className="bg-bg-surface/80 border-b border-border-subtle p-3 flex justify-between items-center shrink-0">
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
      
      <div className="flex-1 p-4 flex flex-col min-h-0">
        {/* Y-Axis Label */}
        <div className="pl-8 text-[9px] text-text-muted font-mono tracking-widest uppercase mb-2 shrink-0">
          Inflation ↑
        </div>
        
        {/* Main 2x2 Grid */}
        <div className="grid grid-cols-2 gap-2 pl-8 shrink-0">
          {quadrantRegimes.map((regime) => (
            <RegimeCard
              key={regime.id}
              {...regime}
              isActive={activeId === regime.id}
              inflationMomentum={inflationMomentum}
            />
          ))}
        </div>

        {/* Extra Regimes Row */}
        <div className="grid grid-cols-2 gap-2 pl-8 mt-2 shrink-0">
          {extraRegimes.map((regime) => (
            <RegimeCard
              key={regime.id}
              {...regime}
              isActive={activeId === regime.id}
              inflationMomentum={inflationMomentum}
            />
          ))}
        </div>

        {/* X-Axis Label */}
        <div className="pl-8 text-[9px] text-text-muted font-mono tracking-widest uppercase mt-2 shrink-0">
          Growth →
        </div>
      </div>
    </div>
  );
}