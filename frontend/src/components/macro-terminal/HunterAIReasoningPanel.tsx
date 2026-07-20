"use client";

import React from "react";
import { BrainCircuit, RefreshCw, BarChart3, Shield, Zap } from "lucide-react";
import { useMacroTerminal } from "./MacroTerminalContext";

export function HunterAIReasoningPanel({ className }: { className?: string }) {
  const { aiReasoning, isAnalyzing, lastUpdated, analyzeRegime, regimeData, dataStatus } = useMacroTerminal();

  return (
    <div className={`flex flex-col w-full glass overflow-hidden relative ${className ?? ""}`}>
      <div className="flex items-center justify-between border-b border-border-subtle p-2 shrink-0">
        <h2 className="font-bold text-text-primary uppercase tracking-wider text-[11px] sm:text-xs flex items-center gap-2 min-w-0">
          <BrainCircuit size={14} className="text-accent-gold flex-shrink-0" />
          AI REASONING
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => analyzeRegime()}
            disabled={isAnalyzing}
            aria-busy={isAnalyzing}
            aria-label="Analisis ulang regime makro"
            className="text-[9px] bg-accent-gold/10 hover:bg-accent-gold/20 text-accent-gold px-2 py-1 rounded font-mono font-medium disabled:opacity-50 border border-accent-gold/30"
          >
            <RefreshCw size={10} className={`inline-block ${isAnalyzing ? "animate-spin" : ""}`} />
            {isAnalyzing ? "ANALYZING..." : "RE-ANALYZE"}
          </button>
          {dataStatus.regime === "stale" || dataStatus.regime === "error" ? (
            <span className="flex items-center gap-1.5 text-[8px] sm:text-[9px] font-mono font-medium text-text-muted bg-white/5 px-2 py-0.5 rounded border border-white/10 uppercase tracking-widest whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-gold/50 animate-pulse"></span>
              Connecting...
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[8px] sm:text-[9px] font-mono font-bold text-data-profit bg-data-profit/10 px-2 py-0.5 rounded border border-data-profit/20 uppercase tracking-widest whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-data-profit animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
              LIVE
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 min-h-0 custom-scrollbar">
        <div className="h-full">
          {aiReasoning ? (
            <div className="animate-in fade-in duration-500 pb-4">
              {(() => {
                const cleanedText = aiReasoning.replace(/\*\*/g, "");
                const parts = cleanedText.split(/\[(.*?)\]/);
                const elements = [];
                
                if (parts[0].trim()) {
                  elements.push(
                    <p key="intro" className="mb-3 text-xs text-text-secondary leading-relaxed font-mono break-words whitespace-pre-wrap">
                      {parts[0].trim()}
                    </p>
                  );
                }
                
                for (let i = 1; i < parts.length; i += 2) {
                  const header = parts[i].trim();
                  const content = parts[i+1] ? parts[i+1].trim() : "";
                  
                  elements.push(
                    <div key={`section-${i}`} className="mb-3 glass border border-border-subtle rounded p-3">
                      <span className="text-accent-gold font-bold block mb-2 text-[10px] tracking-widest uppercase">{header}</span>
                      <div className="text-xs text-text-secondary leading-relaxed font-mono break-words whitespace-pre-wrap">
                        {content}
                      </div>
                    </div>
                  );
                }
                
                return elements;
              })()}
            </div>
          ) : isAnalyzing ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-accent-gold">
              <div className="w-5 h-5 border-2 border-accent-gold/30 border-t-accent-gold rounded-full animate-spin" />
              <span className="text-xs font-mono">Connecting to Hunter Desk AI...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-text-muted">
              <span className="text-sm">○</span>
              <span className="text-[10px] font-mono text-center">Menunggu pergerakan pasar untuk dianalisis...</span>
            </div>
          )}
        </div>
      </div>

      {lastUpdated && (
        <div className="shrink-0 px-2 pb-2 text-[8px] text-text-muted font-mono text-right">
          Last Sync:{" "}
          {new Intl.DateTimeFormat("id-ID", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).format(lastUpdated)}
        </div>
      )}
    </div>
  );
}