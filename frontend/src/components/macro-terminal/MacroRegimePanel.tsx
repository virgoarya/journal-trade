"use client";

import React, { useEffect, useState } from "react";
import { useMacroTerminal } from "./MacroTerminalContext";
import { calculateInflationMomentum, aggregateMacroScores } from "@/lib/macro/calculations";
import type { MacroRawInputs } from "@/lib/macro/types";

type RegimeCardData = {
  id: string;
  title: string;
  growth: string;
  inflation: string;
  assets: string;
};

export function MacroRegimePanel() {
  const { currentRegime } = useMacroTerminal();
  const [inflationMomentum, setInflationMomentum] = useState<number>(0);

  // Regime cards for 2x3 grid
  const regimeCards: RegimeCardData[] = [
    { id: "stagflation", title: "Stagflation", growth: "Low", inflation: "High", assets: "Gold, Cmdty, CHF" },
    { id: "goldilocks", title: "Goldilocks", growth: "High", inflation: "Optimal", assets: "Tech, Crypto, HY" },
    { id: "deflation", title: "Deflation", growth: "Low", inflation: "Low", assets: "Bonds, USD, JPY" },
    { id: "reflation", title: "Reflation", growth: "High", inflation: "Rising", assets: "Value, Ind, EM" },
    { id: "slowdown", title: "Slowdown", growth: "Low", inflation: "Low", assets: "Bonds, Defensive, USD" },
    { id: "neutral transition", title: "Netral", growth: "Netral", inflation: "Netral", assets: "Campuran" },
  ];

  // Get current regime from context for matching
  const normalizedRegime = (currentRegime || "").toLowerCase().trim();

  return (
    <div className="h-full max-h-[260px] flex flex-col glass border border-border-subtle rounded-xl bg-[#020202]">
      <div className="bg-bg-surface/80 border-b border-border-subtle p-2 shrink-0 flex justify-between items-center">
        <h2 className="text-xs font-mono font-bold text-accent-gold uppercase tracking-widest">Macro Regime Matrix</h2>
        <span className="text-[10px] bg-accent-gold/20 text-accent-gold px-1.5 py-0 rounded animate-pulse">LIVE</span>
      </div>
      
      <div className="grid grid-cols-2 grid-rows-3 gap-1.5 p-2 flex-1">
        {regimeCards.map((card) => {
          const isActive = card.id.toLowerCase() === normalizedRegime;
          return (
            <div
              key={card.id}
              className={`flex flex-col items-center justify-center p-1.5 rounded border transition-all duration-300 ${
                isActive 
                  ? 'opacity-100 border-emerald-500 bg-neutral-800/60 ring-1 ring-emerald-500/30' 
                  : 'opacity-30 border border-neutral-800/60 bg-[#0d0d0d]'
              }`}
            >
              <span className={`text-[11px] font-bold uppercase tracking-wider leading-tight ${isActive ? 'text-neutral-100' : 'text-neutral-400'}`}>
                {card.title}
              </span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className={`text-[10px] ${isActive ? 'text-neutral-100' : 'text-neutral-400'}`}>G:{card.growth}</span>
                <span className={`text-[10px] ${isActive ? 'text-neutral-100' : 'text-neutral-400'}`}>I:{card.inflation}</span>
              </div>
              <span className={`text-[9px] font-medium mt-0.5 truncate max-w-full ${isActive ? 'text-neutral-300' : 'text-neutral-500'}`}>
                {card.assets}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}