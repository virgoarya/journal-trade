"use client";

import { useAiTrading } from "../context/AiTradingContext";
import { useMemo } from "react";
import { Activity } from "lucide-react";

export function SymbolRankings() {
  const { skillConfig } = useAiTrading();
  
  const rankings = useMemo(() => {
    if (!skillConfig || !skillConfig.symbolRankings || skillConfig.symbolRankings.length === 0) return null;
    
    // Sort and assign grades based on win rate for display
    const sorted = [...skillConfig.symbolRankings].sort((a, b) => b.avgWinRate - a.avgWinRate);
    
    return sorted.map(r => {
      let grade = "C";
      let color = "text-yellow-400";
      if (r.avgWinRate >= 60) {
        grade = "A";
        color = "text-neon-green";
      } else if (r.avgWinRate >= 50) {
        grade = "B";
        color = "text-accent-gold";
      } else if (r.avgWinRate < 40) {
        grade = "D";
        color = "text-neon-red";
      }
      
      return { ...r, grade, color };
    });
  }, [skillConfig]);

  if (!rankings) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 xl:left-auto xl:w-[800px] xl:left-1/2 xl:-translate-x-1/2 xl:bottom-8 z-30 pointer-events-none">
      <div className="bg-black/80 backdrop-blur-md border border-accent-gold/20 rounded-lg p-2 shadow-[0_0_15px_rgba(0,0,0,0.8)] overflow-hidden flex items-center gap-3">
        <div className="flex items-center gap-2 pr-3 border-r border-accent-gold/20 shrink-0">
          <Activity className="w-4 h-4 text-accent-gold animate-pulse" />
          <span className="text-[10px] font-bold text-accent-gold uppercase tracking-widest">Live Sync</span>
        </div>
        
        <div className="flex-1 overflow-hidden relative">
          <div className="flex gap-8 whitespace-nowrap animate-marquee will-change-transform items-center">
            {/* Double the array for seamless scrolling */}
            {[...rankings, ...rankings].map((rank, i) => (
              <div key={`${rank.symbol}-${i}`} className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold text-text-primary tracking-widest">{rank.symbol.split('.')[0]}</span>
                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border border-current/30 bg-current/10 ${rank.color}`}>
                  {rank.grade}
                </span>
                <span className="text-[9px] font-mono text-text-muted ml-2">WR: {Math.round(rank.avgWinRate)}%</span>
                <span className="text-accent-gold/30 mx-2">•</span>
              </div>
            ))}
          </div>
          
          {/* Fading edges */}
          <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-black/80 to-transparent" />
          <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-black/80 to-transparent" />
        </div>
      </div>
    </div>
  );
}
