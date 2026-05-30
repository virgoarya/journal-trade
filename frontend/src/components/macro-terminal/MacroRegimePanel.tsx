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
    if (!isActive) return "bg-[#0a0a0a] border border-neutral-800 opacity-40";
    
    const styles: Record<string, string> = {
      Stagflation: "bg-amber-500/15 border-emerald-500/40 shadow-[0_0_12px_rgba(255,167,38,0.3)]",
      Goldilocks: "bg-emerald-500/15 border-emerald-500/40 shadow-[0_0_12px_rgba(0,230,118,0.3)]",
      Deflation: "bg-blue-500/15 border-neutral-400 shadow-[0_0_12px_rgba(59,130,246,0.3)]",
      Reflation: "bg-purple-500/15 border-neutral-400 shadow-[0_0_12px_rgba(168,85,247,0.3)]",
      Slowdown: "bg-gray-500/15 border-neutral-400 shadow-[0_0_12px_rgba(107,114,128,0.3)]",
      "Neutral Transition": "bg-gray-600/15 border-neutral-400 shadow-[0_0_12px_rgba(75,85,99,0.3)]",
    };
    return styles[title] || "bg-neutral-900 border border-neutral-800";
  };

  const getAssetColor = () => isActive ? "text-neutral-300" : "text-neutral-500";

  return (
    <div
      className={`flex flex-col items-center justify-center p-3 rounded-lg transition-all duration-300 ${getActiveStyles()}`}
    >
      <span className="text-xs font-bold uppercase tracking-wider mb-1">{title}</span>
      <div className="flex flex-col items-center space-y-1 mb-1">
        <span className="text-[11px] text-neutral-400">G: {growth}</span>
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-neutral-400">I: {inflation}</span>
          {inflationMomentum < 0 && (
            <span className="text-emerald-500 text-[9px] font-mono">▼</span>
          )}
          {inflationMomentum > 0 && (
            <span className="text-rose-500 text-[9px] font-mono">▲</span>
          )}
        </div>
      </div>
      <div className={`text-[10px] font-medium px-2 py-0.5 rounded w-full text-center truncate ${getAssetColor()}`}>
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

  const quadrantRegimes = [
    { id: "Stagflation", title: "Stagflation", growth: "Low", inflation: "High", assets: "Gold, Cmdty, CHF" },
    { id: "Goldilocks", title: "Goldilocks", growth: "High", inflation: "Optimal", assets: "Tech, Crypto, HY" },
    { id: "Deflation", title: "Deflation", growth: "Low", inflation: "Low", assets: "Bonds, USD, JPY" },
    { id: "Reflation", title: "Reflation", growth: "High", inflation: "Rising", assets: "Value, Ind, EM" },
  ];

  const extraRegimes = [
    { id: "Slowdown", title: "Slowdown", growth: "Low", inflation: "Low", assets: "Bonds, Defensive, USD" },
    { id: "Neutral Transition", title: "Netral", growth: "Netral", inflation: "Netral", assets: "Campuran" },
  ];

  if (isLoading) {
    return (
      <div className="flex flex-col h-full glass border border-border-subtle rounded-xl bg-[#020202]">
        <div className="bg-bg-surface/80 border-b border-border-subtle p-3 shrink-0">
          <h2 className="text-xs font-mono font-bold text-accent-gold uppercase tracking-widest">
            Macro Regime Matrix
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <span className="text-text-muted text-xs">Memuat data makro...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full glass border border-border-subtle rounded-xl bg-[#020202]">
        <div className="bg-bg-surface/80 border-b border-border-subtle p-3 shrink-0">
          <h2 className="text-xs font-mono font-bold text-accent-gold uppercase tracking-widest">
            Macro Regime Matrix
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <span className="text-data-warning text-xs">Error: {error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full glass border border-border-subtle rounded-xl bg-[#020202]">
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
      
      <div className="flex-1 p-4 flex flex-col">
        <div className="flex items-start gap-3">
          <div className="text-[10px] text-neutral-500 font-mono tracking-widest uppercase -rotate-180 [writing-mode:vertical-lr] pt-2 shrink-0">
            Inflation
          </div>
          
          <div className="flex-1 flex flex-col">
            <div className="grid grid-cols-2 gap-2 mb-2 w-full">
              {quadrantRegimes.map((regime) => (
                <RegimeCard
                  key={regime.id}
                  {...regime}
                  isActive={activeId === regime.id}
                  inflationMomentum={inflationMomentum}
                />
              ))}
            </div>
            
            <div className="grid grid-cols-2 gap-2 w-full">
              {extraRegimes.map((regime) => (
                <RegimeCard
                  key={regime.id}
                  {...regime}
                  isActive={activeId === regime.id}
                  inflationMomentum={inflationMomentum}
                />
              ))}
            </div>
          </div>
        </div>
        
        <div className="text-[10px] text-neutral-500 font-mono tracking-widest uppercase mt-2 pl-11 shrink-0">
          Growth
        </div>
      </div>
    </div>
  );
}