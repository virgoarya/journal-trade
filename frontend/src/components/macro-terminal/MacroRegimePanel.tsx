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
  title: string;
  growth: string;
  inflation: string;
  assets: string;
  isActive: boolean;
  inflationMomentum: number;
};

const RegimeCard = ({
  title,
  growth,
  inflation,
  assets,
  isActive,
  inflationMomentum,
}: RegimeCardProps) => {
  const getActiveStyles = () => {
    if (isActive) {
      return "opacity-100 border-emerald-500/80 bg-[#161616] shadow-[0_0_10px_rgba(52,211,153,0.25)]";
    }
    return "opacity-30 border border-neutral-800/60 bg-[#0d0d0d]";
  };

  const getTextColor = () => isActive ? "text-neutral-100" : "text-neutral-400";

  return (
    <div
      className={`flex flex-col items-center justify-center p-1.5 rounded border transition-all duration-300 ${getActiveStyles()}`}
    >
      <span className={`text-[11px] font-bold uppercase tracking-wider leading-tight ${getTextColor()}`}>{title}</span>
      <div className="flex items-center gap-1 mt-0.5">
        <span className={`text-[10px] ${getTextColor()}`}>G:{growth}</span>
        <span className={`text-[10px] ${getTextColor()}`}>I:{inflation}</span>
        {inflationMomentum < 0 && <span className="text-emerald-500 text-[9px]">▼</span>}
        {inflationMomentum > 0 && <span className="text-rose-500 text-[9px]">▲</span>}
      </div>
      <span className={`text-[9px] font-medium mt-0.5 truncate max-w-full ${isActive ? "text-neutral-300" : "text-neutral-500"}`}>{assets}</span>
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
          const momentum = calculateInflationMomentum(result.cpiMoM);
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
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchMacroData();
    const interval = setInterval(fetchMacroData, 60000);
    
    return () => clearInterval(interval);
  }, []);

  const allRegimes = [
    { id: "Stagflation", title: "Stagflation", growth: "Low", inflation: "High", assets: "Gold, Cmdty, CHF" },
    { id: "Goldilocks", title: "Goldilocks", growth: "High", inflation: "Optimal", assets: "Tech, Crypto, HY" },
    { id: "Deflation", title: "Deflation", growth: "Low", inflation: "Low", assets: "Bonds, USD, JPY" },
    { id: "Reflation", title: "Reflation", growth: "High", inflation: "Rising", assets: "Value, Ind, EM" },
    { id: "Slowdown", title: "Slowdown", growth: "Low", inflation: "Low", assets: "Bonds, Defensive, USD" },
    { id: "Neutral Transition", title: "Netral", growth: "Netral", inflation: "Netral", assets: "Campuran" },
  ];

  if (isLoading) {
    return (
      <div className="h-full max-h-[260px] flex flex-col glass border border-border-subtle rounded-xl bg-[#020202]">
        <div className="bg-bg-surface/80 border-b border-border-subtle p-2 shrink-0">
          <h2 className="text-xs font-mono font-bold text-accent-gold uppercase tracking-widest">Macro Regime Matrix</h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-2">
          <span className="text-text-muted text-xs">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full max-h-[260px] flex flex-col glass border border-border-subtle rounded-xl bg-[#020202]">
        <div className="bg-bg-surface/80 border-b border-border-subtle p-2 shrink-0">
          <h2 className="text-xs font-mono font-bold text-accent-gold uppercase tracking-widest">Macro Regime Matrix</h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-2">
          <span className="text-data-warning text-xs">Error: {error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full max-h-[260px] flex flex-col glass border border-border-subtle rounded-xl bg-[#020202]">
      <div className="bg-bg-surface/80 border-b border-border-subtle p-2 shrink-0 flex justify-between items-center">
        <h2 className="text-xs font-mono font-bold text-accent-gold uppercase tracking-widest">Macro Regime Matrix</h2>
        <span className="text-[10px] bg-accent-gold/20 text-accent-gold px-1.5 py-0 rounded animate-pulse">LIVE</span>
      </div>
      
      <div className="grid grid-cols-2 grid-rows-3 gap-1.5 p-2 flex-1">
        {allRegimes.map((regime) => (
          <RegimeCard
            key={regime.id}
            {...regime}
            isActive={activeId?.toLowerCase() === regime.id.toLowerCase()}
            inflationMomentum={inflationMomentum}
          />
        ))}
      </div>
    </div>
  );
}