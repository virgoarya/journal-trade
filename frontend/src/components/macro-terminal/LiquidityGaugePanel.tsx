"use client";

import React from "react";
import { useMacroTerminal } from "./MacroTerminalContext";
import { Activity, ArrowDownRight, ArrowUpRight, Droplets } from "lucide-react";

export function LiquidityGaugePanel() {
  const { liquidity } = useMacroTerminal();

  if (!liquidity) {
    return (
      <div className="flex flex-col h-full bg-surface-primary border border-surface-border rounded-xl p-4 relative overflow-hidden">
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

  // Format value dynamically - show in Billions if < 1000, else Trillions
  const formattedValue = liquidity.value >= 1000
    ? `$${(liquidity.value / 1000).toFixed(2)}T`
    : `$${liquidity.value.toFixed(2)}B`;
  // Format change dynamically - show in Billions if < 1000, else Trillions  
  const absChange = Math.abs(liquidity.change);
  const changeFormatted = absChange >= 1000 
    ? `${(liquidity.change / 1000).toFixed(2)}T`
    : `${liquidity.change > 0 ? "+" : ""}${liquidity.change.toFixed(2)}B`;

  return (
    <div className="flex flex-col h-full bg-surface-primary border border-surface-border rounded-xl p-4 relative overflow-hidden">
      
      <div className="flex items-center justify-between mb-3 z-10">
        <div className="flex items-center gap-2">
          <Droplets className="w-4 h-4 text-accent-gold" />
          <h2 className="text-sm font-bold font-mono tracking-wider text-text-primary uppercase">
            Liquidity Flow
          </h2>
        </div>
        <div className="text-[10px] text-text-muted font-mono tracking-widest bg-surface-secondary/50 px-2 py-0.5 rounded border border-surface-border">
          ON RRP
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center gap-3 z-10">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-2xl font-mono font-bold text-text-primary">
              {formattedValue}
            </div>
            <div className="text-xs font-mono text-text-secondary mt-1">
              Current Balance
            </div>
          </div>

          <div className="text-right">
            <div className={`flex items-center justify-end gap-1 text-sm font-mono font-bold ${
              isInjecting ? "text-data-profit" : "text-data-loss"
            }`}>
              {isInjecting ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
              {changeFormatted}
            </div>
            <div className="text-xs font-mono text-text-secondary mt-1">
              Daily Change
            </div>
          </div>
        </div>

        {/* Gauge Bar */}
        <div className="w-full h-2 rounded-full bg-surface-secondary overflow-hidden relative mt-2 border border-surface-border">
          {isInjecting ? (
            <div 
              className="absolute right-1/2 top-0 bottom-0 bg-data-profit transition-all duration-1000"
              style={{ width: "50%" }}
            />
          ) : (
            <div 
              className="absolute left-1/2 top-0 bottom-0 bg-data-loss transition-all duration-1000"
              style={{ width: "50%" }}
            />
          )}
          {/* Center Marker */}
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-surface-border z-10 -translate-x-1/2" />
        </div>

        <div className="flex justify-between text-[10px] font-mono text-text-muted font-bold tracking-widest mt-1">
          <span className={isInjecting ? "text-data-profit" : ""}>INJECTION (BULLISH)</span>
          <span className={isDraining ? "text-data-loss" : ""}>DRAIN (BEARISH)</span>
        </div>
      </div>
      
      {/* Background glow */}
      <div className={`absolute top-0 right-0 w-32 h-32 blur-3xl -z-0 opacity-10 ${
        isInjecting ? "bg-data-profit" : isDraining ? "bg-data-loss" : "bg-transparent"
      }`} />
      <div className={`absolute bottom-0 left-0 w-32 h-32 blur-3xl -z-0 opacity-10 ${
        isInjecting ? "bg-data-profit" : isDraining ? "bg-data-loss" : "bg-transparent"
      }`} />
    </div>
  );
}
