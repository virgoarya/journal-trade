"use client";

import React from "react";
import { ShieldAlert, BrainCircuit, RefreshCw } from "lucide-react";
import { useMacroTerminal } from "./MacroTerminalContext";

export function HeatmapPanel() {
  const { assets, isFallback, aiReasoning, isAnalyzing, lastUpdated, analyzeRegime } = useMacroTerminal();

  const getColor = (change: number) => {
    if (change > 2) return "bg-data-profit text-white";
    if (change > 1) return "bg-data-profit/80 text-white";
    if (change > 0) return "bg-data-profit/40 text-data-profit";
    if (change < -2) return "bg-data-loss text-white";
    if (change < -1) return "bg-data-loss/80 text-white";
    if (change < 0) return "bg-data-loss/40 text-data-loss";
    return "bg-text-muted/20 text-white";
  };

  return (
    <div className="flex flex-col h-full glass border border-border-subtle rounded-xl overflow-hidden relative">
      <div className="flex items-center justify-between border-b border-border-subtle p-3">
        <h2 className="text-xs font-mono font-bold text-accent-gold uppercase tracking-widest" id="heatmap-heading">
          Macro ETFs Heatmap
        </h2>
        <div className="flex items-center gap-3" role="status">
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
              <span className="text-[9px] opacity-80 truncate w-full text-center mt-0.5">{asset.name}</span>
              <span className="text-sm font-mono font-bold mt-1">
                {isPositive ? "+" : ""}{asset.change.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex-1 border-t border-border-subtle p-3 flex flex-col min-h-0 overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-accent-gold text-[10px] font-mono tracking-widest uppercase">
            <BrainCircuit size={12} aria-hidden />
            <span>Hunter AI Reasoning</span>
          </div>
          <button
            onClick={analyzeRegime}
            disabled={isAnalyzing}
            aria-busy={isAnalyzing}
            aria-label="Analisis ulang regime makro"
            className="text-[10px] bg-white/5 hover:bg-white/10 px-2 py-1 rounded transition-colors flex items-center gap-1 disabled:opacity-50"
          >
            <RefreshCw size={10} className={isAnalyzing ? "animate-spin" : ""} />
            {isAnalyzing ? "ANALYZING..." : "RE-ANALYZE"}
          </button>
        </div>
        <div className="text-xs text-text-secondary leading-relaxed font-mono">
          {aiReasoning ? (
            <div className="animate-in fade-in duration-500">{aiReasoning}</div>
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
