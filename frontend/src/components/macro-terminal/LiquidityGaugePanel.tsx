"use client";

import React from "react";
import { useMacroTerminal } from "./MacroTerminalContext";
import { Activity, ArrowDownRight, ArrowUpRight, Droplets } from "lucide-react";

export function LiquidityGaugePanel() {
  const { liquidity, lastUpdated } = useMacroTerminal();

  if (!liquidity) {
    return (
      <div className="flex flex-col h-full glass border border-border-subtle rounded-xl p-4 relative overflow-hidden">
        <div className="flex items-center gap-2 mb-2">
          <Droplets className="w-4 h-4 text-accent-gold" />
          <h2 className="text-sm font-bold font-mono tracking-wider text-text-primary uppercase">
            Liquidity Flow (ON RRP)
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Activity className="w-5 h-5 text-text-muted animate-pulse" />
        </div>
      </div>
    );
  }

  const isInjecting = liquidity.status === "INJECTING";
  const isDraining = liquidity.status === "DRAINING";

  const formattedValue = liquidity.value >= 1000 ? `$${(liquidity.value / 1000).toFixed(2)}T` : `$${liquidity.value.toFixed(2)}B`;
  const absChange = Math.abs(liquidity.change);
  const changeFormatted = absChange >= 1000 ? `${(liquidity.change / 1000).toFixed(2)}T` : `${liquidity.change > 0 ? "+" : ""}${liquidity.change.toFixed(2)}B`;

  const trend = Array.isArray(liquidity.trend) ? liquidity.trend : [];
  const trendDots = trend.slice(0, 5);

  const MAX_RRP = 3000;
  const percentage = Math.min((liquidity.value / MAX_RRP) * 100, 100);
  const strokeDasharray = 226; // 2 * PI * 36
  const strokeDashoffset = strokeDasharray - (percentage / 100) * strokeDasharray;

  return (
    <div className="flex flex-col h-full glass border border-border-subtle rounded-xl p-4 relative overflow-hidden">
      <div className="flex items-center justify-between mb-4 z-10">
        <div className="flex items-center gap-2">
          <Droplets className="w-4 h-4 text-accent-gold" />
          <h2 className="text-sm font-bold font-mono tracking-wider text-text-primary uppercase">Liquidity Flow</h2>
          {lastUpdated && (
            <span className="text-[9px] text-text-muted font-mono whitespace-nowrap ml-2 hidden sm:inline-block">
              {new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(lastUpdated)} WIB
            </span>
          )}
        </div>
        <div className="text-[10px] text-text-muted font-mono tracking-widest bg-surface-elevated/50 px-2 py-0.5 rounded border border-border-subtle">ON RRP</div>
      </div>

      <div className="flex-1 flex items-center gap-5 z-10 md:px-2">
        <div className="relative w-24 h-24 flex-shrink-0 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90 transform drop-shadow-md" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="36" fill="none" className="stroke-bg-surface" strokeWidth="12" />
            <circle 
              cx="50" 
              cy="50" 
              r="36" 
              fill="none" 
              className={isInjecting ? "stroke-data-profit" : "stroke-data-loss"} 
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
            />
          </svg>
          <div className="absolute flex flex-col items-center justify-center">
            <span className="text-sm font-mono font-bold text-text-primary">{Math.round(percentage)}%</span>
            <span className="text-[8px] font-mono text-text-muted mt-0.5">CAPACITY</span>
          </div>
        </div>

        <div className="flex flex-col justify-center gap-4 flex-1">
          <div>
            <div className="text-xl font-mono font-bold text-text-primary leading-none">{formattedValue}</div>
            <div className="text-[10px] font-mono text-text-secondary mt-1.5 uppercase tracking-wide">Current Balance</div>
          </div>
          
          <div className="flex justify-between items-end">
            <div>
              <div className={`flex items-center gap-1 text-sm font-mono font-bold ${isInjecting ? "text-data-profit" : "text-data-loss"} leading-none`}>
                {isInjecting ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                {changeFormatted}
              </div>
              <div className="text-[10px] font-mono text-text-secondary mt-1.5 uppercase tracking-wide">Daily Change</div>
            </div>
            
            <div className="text-right">
              <div className="text-[9px] font-mono text-text-muted mb-1.5 uppercase tracking-widest">Trend</div>
              <div className="flex items-center justify-end gap-1.5">
                {trendDots.length === 0 && <span className="text-[10px] text-text-muted">-</span>}
                {trendDots.map((dot, idx) => (
                  <span
                    key={idx}
                    className={`h-2 w-2 rounded-full ${dot === "injecting" ? "bg-data-profit" : "bg-data-loss"}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={`absolute top-0 right-0 h-32 w-32 blur-3xl -z-0 opacity-10 ${isInjecting ? "bg-data-profit" : isDraining ? "bg-data-loss" : "bg-transparent"}`} />
      <div className={`absolute bottom-0 left-0 h-32 w-32 blur-3xl -z-0 opacity-10 ${isInjecting ? "bg-data-profit" : isDraining ? "bg-data-loss" : "bg-transparent"}`} />
    </div>
  );
}
