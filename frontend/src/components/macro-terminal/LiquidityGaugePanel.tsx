"use client";

import React from "react";
import { useMacroTerminal } from "./MacroTerminalContext";
import { Activity, ArrowDownRight, ArrowUpRight, Droplets } from "lucide-react";

const MAX_RRP_REF = 500;
const CIRCUMFERENCE = 2 * Math.PI * 34; // r = 34

export function LiquidityGaugePanel() {
  const { liquidity, lastUpdated } = useMacroTerminal();

  if (!liquidity) {
    return (
      <div className="flex flex-col h-full glass border border-border-subtle rounded-xl p-3 relative overflow-hidden">
        <div className="flex items-center gap-2 mb-2">
          <Droplets className="w-3.5 h-3.5 text-accent-gold" />
          <h2 className="font-semibold text-text-primary uppercase tracking-wider text-xs sm:text-sm">Liquidity Flow</h2>
          <span className="ml-auto text-[10px] text-text-muted font-mono bg-surface-elevated/50 px-1.5 py-0.5 rounded border border-border-subtle">ON RRP</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Activity className="w-5 h-5 text-text-muted animate-pulse" />
        </div>
      </div>
    );
  }

  const isInjecting = liquidity.status === "INJECTING";
  const isDraining = liquidity.status === "DRAINING";

  const formattedValue =
    liquidity.value >= 1000
      ? `$${(liquidity.value / 1000).toFixed(2)}T`
      : `$${liquidity.value.toFixed(2)}B`;

  const absChange = Math.abs(liquidity.change);
  const changeFormatted =
    absChange >= 1000
      ? `${(liquidity.change / 1000).toFixed(2)}T`
      : `${liquidity.change > 0 ? "+" : ""}${liquidity.change.toFixed(2)}B`;

  const trend = Array.isArray(liquidity.trend) ? liquidity.trend : [];
  const trendDots = trend.slice(0, 5);

  const curveData = Array.isArray(liquidity.history) ? [...liquidity.history].slice(0, 5).reverse() : [];
  let sparklinePath = "";
  if (curveData.length > 1) {
    const minVal = Math.min(...curveData.map(d => d.value));
    const maxVal = Math.max(...curveData.map(d => d.value));
    const range = maxVal - minVal || 1;
    const w = 48;
    const h = 24;

    const points = curveData.map((d, i) => {
      const x = (i / (curveData.length - 1)) * w;
      const y = 2 + (1 - (d.value - minVal) / range) * (h - 4);
      return `${x},${y}`;
    });

    // Create a smooth curve using cubic bezier approximation or just simple lines
    // For a sparkline, straight lines with rounded joins usually look good
    sparklinePath = `M ${points.join(" L ")}`;
  }

  const pct = Math.min(Math.max((liquidity.value / MAX_RRP_REF) * 100, 0), 100);
  const strokeOffset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE;
  const gaugeColor = isInjecting ? "#22c55e" : "#ef4444";
  const trackColor = isInjecting ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)";

return (
    <div className="flex flex-col h-full glass border border-border-subtle rounded-xl p-3 relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 z-10 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Droplets className="w-3.5 h-3.5 text-accent-gold flex-shrink-0" />
          <h2 className="font-bold text-text-primary uppercase tracking-wider text-[10px] sm:text-xs whitespace-nowrap">
            Liquidity Flow
          </h2>
        </div>
        <span className="text-[10px] text-text-muted font-mono bg-surface-elevated/50 px-1.5 py-0.5 rounded border border-border-subtle whitespace-nowrap flex-shrink-0 ml-2">
          ON RRP
        </span>
      </div>

      {/* 3-Column Content */}
      <div className="flex-1 flex items-center justify-between gap-2 z-10 min-h-0">

        {/* Col 1: Donut with balance inside + "Current Balance" below */}
        <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
          <div className="relative" style={{ width: 84, height: 84 }}>
            <svg width="84" height="84" viewBox="0 0 84 84" style={{ transform: "rotate(-90deg)" }}>
              {/* Track */}
              <circle cx="42" cy="42" r="34" fill="none" stroke={trackColor} strokeWidth="9" />
              {/* Progress */}
              <circle
                cx="42"
                cy="42"
                r="34"
                fill="none"
                stroke={gaugeColor}
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={strokeOffset}
                style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)" }}
              />
            </svg>
            {/* Center: balance value */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className="font-mono font-black leading-none tracking-tight"
                style={{ fontSize: 13, color: gaugeColor }}
              >
                {formattedValue}
              </span>
              <span className="text-[7px] font-mono text-text-muted mt-0.5 tracking-widest uppercase">
                {pct < 1 && pct > 0 ? "<1%" : `${Math.round(pct)}%`}
              </span>
            </div>
          </div>
          <span className="text-[9px] font-mono text-text-muted uppercase tracking-widest whitespace-nowrap">
            Current Balance
          </span>
        </div>

        {/* Divider */}
        <div className="w-px self-stretch bg-border-subtle/50 flex-shrink-0" />

        {/* Col 2: Daily Change (center) */}
        <div className="flex flex-col items-center justify-center gap-1.5 flex-1">
          <div
            className={`flex items-center gap-1 font-mono font-black leading-none ${
              isInjecting ? "text-data-profit" : "text-data-loss"
            }`}
            style={{ fontSize: 18 }}
          >
            {isInjecting ? (
              <ArrowDownRight className="w-4 h-4 flex-shrink-0" />
            ) : (
              <ArrowUpRight className="w-4 h-4 flex-shrink-0" />
            )}
            {changeFormatted}
          </div>
          <span className="text-[9px] font-mono text-text-muted uppercase tracking-widest whitespace-nowrap">
            Daily Change
          </span>

          {/* Status pill under daily change */}
          <span
            className={`mt-1 text-[9px] font-mono font-bold tracking-wider px-2 py-0.5 rounded-full border whitespace-nowrap ${
              isInjecting
                ? "text-data-profit border-data-profit/30 bg-data-profit/10"
                : "text-data-loss border-data-loss/30 bg-data-loss/10"
            }`}
          >
            {isInjecting ? "⬇ INJECTION" : "⬆ DRAINING"}
          </span>
        </div>

        {/* Divider */}
        <div className="w-px self-stretch bg-border-subtle/50 flex-shrink-0" />

        {/* Col 3: 5-Day Trend (right) */}
        <div className="flex flex-col items-center justify-center gap-2 flex-shrink-0">
          <span className="text-[9px] font-mono text-text-muted uppercase tracking-widest whitespace-nowrap">
            5-Day Trend
          </span>
          <div className="flex items-center justify-center h-8">
            {curveData.length > 1 ? (
              <svg width="48" height="24" className="overflow-visible">
                <path
                  d={sparklinePath}
                  fill="none"
                  stroke={gaugeColor}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ filter: `drop-shadow(0px 2px 4px ${gaugeColor}40)` }}
                />
                {/* Endpoint dot */}
                <circle 
                  cx="48" 
                  cy={2 + (1 - (curveData[curveData.length - 1].value - Math.min(...curveData.map(d => d.value))) / (Math.max(...curveData.map(d => d.value)) - Math.min(...curveData.map(d => d.value)) || 1)) * 20} 
                  r="2.5" 
                  fill={gaugeColor} 
                />
              </svg>
            ) : trendDots.length === 0 ? (
              <span className="text-[10px] text-text-muted">—</span>
            ) : (
              <div className="flex items-center gap-1.5">
                {trendDots.map((dot, idx) => (
                  <span
                    key={idx}
                    className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                      dot === "injecting" ? "bg-data-profit" : "bg-data-loss"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Ambient glow */}
      <div
        className={`absolute top-0 right-0 h-24 w-24 blur-3xl pointer-events-none ${
          isInjecting ? "bg-data-profit" : isDraining ? "bg-data-loss" : "bg-transparent"
        }`}
        style={{ opacity: 0.06, zIndex: 0 }}
      />
      <div
        className={`absolute bottom-0 left-0 h-24 w-24 blur-3xl pointer-events-none ${
          isInjecting ? "bg-data-profit" : isDraining ? "bg-data-loss" : "bg-transparent"
        }`}
        style={{ opacity: 0.06, zIndex: 0 }}
      />
    </div>
  );
}
