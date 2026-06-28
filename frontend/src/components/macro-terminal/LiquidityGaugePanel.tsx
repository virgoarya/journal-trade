"use client";

import React from "react";
import { useMacroTerminal } from "./MacroTerminalContext";
import { ArrowDownRight, ArrowUpRight, Droplets } from "lucide-react";

const MAX_RRP_REF = 500;
const MAX_TGA_REF = 1000;
const CIRCUMFERENCE = 2 * Math.PI * 34; // r = 34

// Default liquidity state for safe rendering
const DEFAULT_LIQUIDITY = {
  value: 0,
  change: 0,
  status: "UNKNOWN" as const,
  trend: [],
  history: [],
};

function GaugeRow({
  title,
  value,
  formattedValue,
  change,
  changeFormatted,
  status,
  history,
  trend,
  maxRef,
}: {
  title: string;
  value: number;
  formattedValue: string;
  change: number;
  changeFormatted: string;
  status: "INJECTING" | "DRAINING" | "UNKNOWN" | "NEUTRAL";
  history: any[];
  trend: string[];
  maxRef: number;
}) {
  const isInjecting = status === "INJECTING";
  const isDraining = status === "DRAINING";

  const pct = Math.min(Math.max((value / maxRef) * 100, 0), 100);
  const strokeOffset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE;
  const gaugeColor = isInjecting ? "#22c55e" : isDraining ? "#ef4444" : "#94a3b8";
  const trackColor = isInjecting
    ? "rgba(34,197,94,0.12)"
    : isDraining
      ? "rgba(239,68,68,0.12)"
      : "rgba(148,163,184,0.12)";

  const trendDots = trend.slice(0, 5);
  const curveData = Array.isArray(history) ? [...history].slice(0, 5).reverse() : [];
  let sparklinePath = "";
  if (curveData.length > 1) {
    const minVal = Math.min(...curveData.map((d) => d.value));
    const maxVal = Math.max(...curveData.map((d) => d.value));
    const range = maxVal - minVal || 1;
    const w = 48;
    const h = 24;

    const points = curveData.map((d, i) => {
      const x = (i / (curveData.length - 1)) * w;
      const y = 2 + (1 - (d.value - minVal) / range) * (h - 4);
      return `${x},${y}`;
    });

    sparklinePath = `M ${points.join(" L ")}`;
  }

  return (
    <div className="flex flex-col gap-2 relative z-10 w-full mb-3 last:mb-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-text-muted font-mono bg-surface-elevated/50 px-1.5 py-0.5 rounded border border-border-subtle whitespace-nowrap">
          {title}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        {/* Col 1: Donut with balance inside */}
        <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
          <div className="relative" style={{ width: 84, height: 84 }}>
            <svg width="84" height="84" viewBox="0 0 84 84" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="42" cy="42" r="34" fill="none" stroke={trackColor} strokeWidth="9" />
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
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono font-black leading-none tracking-tight" style={{ fontSize: 13, color: gaugeColor }}>
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
        <div className="w-px h-16 self-center bg-border-subtle/50 flex-shrink-0" />

        {/* Col 2: Daily Change */}
        <div className="flex flex-col items-center justify-center gap-1.5 flex-1">
          <div
            className={`flex items-center gap-1 font-mono font-black leading-none ${
              isInjecting ? "text-data-profit" : isDraining ? "text-data-loss" : "text-text-muted"
            }`}
            style={{ fontSize: 18 }}
          >
            {change > 0 ? (
              <ArrowUpRight className="w-4 h-4 flex-shrink-0" />
            ) : change < 0 ? (
              <ArrowDownRight className="w-4 h-4 flex-shrink-0" />
            ) : null}
            {changeFormatted}
          </div>
          <span className="text-[9px] font-mono text-text-muted uppercase tracking-widest whitespace-nowrap">
            Daily Change
          </span>
          <span
            className={`mt-1 text-[9px] font-mono font-bold tracking-wider px-2 py-0.5 rounded-full border whitespace-nowrap ${
              isInjecting
                ? "text-data-profit border-data-profit/30 bg-data-profit/10"
                : isDraining
                  ? "text-data-loss border-data-loss/30 bg-data-loss/10"
                  : "text-text-muted border-text-muted/30 bg-surface-elevated/10"
            }`}
          >
            {isInjecting ? "⬇ INJECTION" : isDraining ? "⬆ DRAINING" : "● NEUTRAL"}
          </span>
        </div>

        {/* Divider */}
        <div className="w-px h-16 self-center bg-border-subtle/50 flex-shrink-0" />

        {/* Col 3: 5-Day Trend */}
        <div className="flex flex-col items-center justify-center gap-2 flex-shrink-0 min-w-[48px]">
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
                <circle
                  cx="48"
                  cy={
                    2 +
                    (1 -
                      (curveData[curveData.length - 1].value - Math.min(...curveData.map((d) => d.value))) /
                        (Math.max(...curveData.map((d) => d.value)) - Math.min(...curveData.map((d) => d.value)) || 1)) *
                      20
                  }
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
                      dot === "injecting" ? "bg-data-profit" : dot === "draining" ? "bg-data-loss" : "bg-text-muted"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function LiquidityGaugePanel() {
  const { liquidity } = useMacroTerminal();
  const safeLiquidity = liquidity ?? DEFAULT_LIQUIDITY;
  const tga = safeLiquidity.tga;

  // ON RRP
  const onRrpFormattedValue = safeLiquidity.value >= 1000
    ? `$${(safeLiquidity.value / 1000).toFixed(2)}T`
    : `$${safeLiquidity.value.toFixed(2)}B`;
  const onRrpChangeFormatted = Math.abs(safeLiquidity.change) >= 1000
    ? `${(Math.abs(safeLiquidity.change) / 1000).toFixed(2)}T`
    : `${safeLiquidity.change > 0 ? "+" : ""}${safeLiquidity.change.toFixed(2)}B`;
  
  // Note: ON RRP injects when it decreases (change < 0 => INJECTING)
  // The service normalizes this, but we rely on safeLiquidity.status
  const onRrpStatus = safeLiquidity.status as any;

  // TGA
  const tgaStatus = tga ? (tga.delta > 0 ? "DRAINING" : tga.delta < 0 ? "INJECTING" : "NEUTRAL") : "UNKNOWN";
  const tgaChangeFormatted = tga 
    ? (Math.abs(tga.delta) >= 1000 
        ? `${(Math.abs(tga.delta)/1000).toFixed(2)}T` 
        : `${tga.delta > 0 ? "+" : ""}${tga.delta.toFixed(2)}B`)
    : "0B";

  const isAnyInjecting = onRrpStatus === "INJECTING" || tgaStatus === "INJECTING";
  const isAnyDraining = onRrpStatus === "DRAINING" || tgaStatus === "DRAINING";

  return (
    <div className="flex flex-col h-full glass border border-border-subtle rounded-xl p-3 relative overflow-hidden overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 z-10 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Droplets className="w-3.5 h-3.5 text-accent-gold flex-shrink-0" />
          <h2 className="font-bold text-text-primary uppercase tracking-wider text-[10px] sm:text-xs whitespace-nowrap">
            Liquidity Flow
          </h2>
        </div>
      </div>

      <div className="flex flex-col flex-1">
        <GaugeRow 
          title="ON RRP"
          value={safeLiquidity.value}
          formattedValue={onRrpFormattedValue}
          change={safeLiquidity.change}
          changeFormatted={onRrpChangeFormatted}
          status={onRrpStatus}
          history={safeLiquidity.history || []}
          trend={safeLiquidity.trend || []}
          maxRef={MAX_RRP_REF}
        />
        
        <div className="w-full h-px bg-border-subtle/50 my-2 z-10 flex-shrink-0" />

        {tga ? (
          <GaugeRow 
            title="Treasury General Account (TGA)"
            value={tga.value}
            formattedValue={tga.displayValue}
            change={tga.delta}
            changeFormatted={tgaChangeFormatted}
            status={tgaStatus}
            history={tga.history || []}
            trend={tga.trend || []}
            maxRef={MAX_TGA_REF}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-text-muted text-[10px] font-mono">
            TGA Data Loading...
          </div>
        )}
      </div>

      {/* Ambient glow */}
      <div
        className={`absolute top-0 right-0 h-24 w-24 blur-3xl pointer-events-none ${
          isAnyInjecting ? "bg-data-profit" : isAnyDraining ? "bg-data-loss" : "bg-transparent"
        }`}
        style={{ opacity: 0.05, zIndex: 0 }}
      />
      <div
        className={`absolute bottom-0 left-0 h-24 w-24 blur-3xl pointer-events-none ${
          isAnyInjecting ? "bg-data-profit" : isAnyDraining ? "bg-data-loss" : "bg-transparent"
        }`}
        style={{ opacity: 0.05, zIndex: 0 }}
      />
    </div>
  );
}
