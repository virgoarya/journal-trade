"use client";

import React from "react";
import { useMacroTerminal } from "./MacroTerminalContext";
import { Activity, ArrowDownRight, ArrowUpRight, Droplets } from "lucide-react";

// Historical peak context: Post-QT, ON RRP drained from ~$2.5T to near-zero.
// We use 500B as the reference range so the gauge is meaningful at current levels.
const MAX_RRP_REF = 500;
const CIRCUMFERENCE = 2 * Math.PI * 38; // r = 38

export function LiquidityGaugePanel() {
  const { liquidity, lastUpdated } = useMacroTerminal();

  if (!liquidity) {
    return (
      <div className="flex flex-col h-full glass border border-border-subtle rounded-xl p-4 relative overflow-hidden">
        <div className="flex items-center gap-2 mb-2">
          <Droplets className="w-4 h-4 text-accent-gold" />
          <h2 className="text-xs font-bold font-mono tracking-widest text-accent-gold uppercase">
            Liquidity Flow
          </h2>
          <span className="text-[10px] text-text-muted font-mono bg-surface-elevated/50 px-1.5 py-0.5 rounded border border-border-subtle ml-auto">ON RRP</span>
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

  const pct = Math.min(Math.max((liquidity.value / MAX_RRP_REF) * 100, 0), 100);
  const strokeOffset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE;
  const gaugeColor = isInjecting ? "#22c55e" : "#ef4444";
  const trackColor = isInjecting ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)";

  return (
    <div className="flex flex-col h-full glass border border-border-subtle rounded-xl p-3 relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 z-10 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Droplets className="w-3.5 h-3.5 text-accent-gold flex-shrink-0" />
          <h2 className="text-xs font-bold font-mono tracking-widest text-accent-gold uppercase whitespace-nowrap">
            Liquidity Flow
          </h2>
        </div>
        <div className="flex items-center gap-2 ml-2 flex-shrink-0">
          {lastUpdated && (
            <span className="text-[9px] text-text-muted font-mono whitespace-nowrap hidden lg:inline-block">
              {new Intl.DateTimeFormat("id-ID", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              }).format(lastUpdated)}{" "}
              WIB
            </span>
          )}
          <span className="text-[10px] text-text-muted font-mono bg-surface-elevated/50 px-1.5 py-0.5 rounded border border-border-subtle whitespace-nowrap">
            ON RRP
          </span>
        </div>
      </div>

      {/* Content: donut + stats */}
      <div className="flex-1 flex items-center gap-4 z-10 min-h-0">
        {/* Donut Gauge */}
        <div className="relative flex-shrink-0" style={{ width: 96, height: 96 }}>
          <svg
            width="96"
            height="96"
            viewBox="0 0 96 96"
            style={{ transform: "rotate(-90deg)" }}
          >
            {/* Background track */}
            <circle
              cx="48"
              cy="48"
              r="38"
              fill="none"
              stroke={trackColor}
              strokeWidth="10"
            />
            {/* Progress arc */}
            <circle
              cx="48"
              cy="48"
              r="38"
              fill="none"
              stroke={gaugeColor}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={strokeOffset}
              style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)" }}
            />
          </svg>
          {/* Center label */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{ pointerEvents: "none" }}
          >
            <span
              className="font-mono font-black leading-none"
              style={{ fontSize: 15, color: gaugeColor }}
            >
              {pct < 1 && pct > 0 ? "<1" : Math.round(pct)}%
            </span>
            <span className="text-[8px] font-mono text-text-muted mt-0.5 uppercase tracking-widest">
              capacity
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-col justify-between flex-1 h-full py-1 min-w-0">
          {/* Balance */}
          <div>
            <div className="text-xl font-mono font-black text-text-primary leading-none tracking-tight">
              {formattedValue}
            </div>
            <div className="text-[10px] font-mono text-text-muted mt-1 uppercase tracking-widest">
              Current Balance
            </div>
          </div>

          {/* Daily Change */}
          <div>
            <div
              className={`flex items-center gap-1 text-sm font-mono font-bold leading-none ${
                isInjecting ? "text-data-profit" : "text-data-loss"
              }`}
            >
              {isInjecting ? (
                <ArrowDownRight className="w-3.5 h-3.5" />
              ) : (
                <ArrowUpRight className="w-3.5 h-3.5" />
              )}
              {changeFormatted}
            </div>
            <div className="text-[10px] font-mono text-text-muted mt-1 uppercase tracking-widest">
              Daily Change
            </div>
          </div>

          {/* 5-Day Trend */}
          <div>
            <div className="text-[9px] font-mono text-text-muted mb-1.5 uppercase tracking-widest">
              5-Day Trend
            </div>
            <div className="flex items-center gap-1.5">
              {trendDots.length === 0 && (
                <span className="text-[10px] text-text-muted">—</span>
              )}
              {trendDots.map((dot, idx) => (
                <span
                  key={idx}
                  className={`h-2 w-2 rounded-full flex-shrink-0 ${
                    dot === "injecting" ? "bg-data-profit" : "bg-data-loss"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Status label */}
      <div className="flex items-center justify-center mt-3 z-10 flex-shrink-0">
        <span
          className={`text-[10px] font-mono font-bold tracking-widest px-3 py-1 rounded-full border ${
            isInjecting
              ? "text-data-profit border-data-profit/30 bg-data-profit/10"
              : "text-data-loss border-data-loss/30 bg-data-loss/10"
          }`}
        >
          {isInjecting ? "⬇ INJECTION — RISK ON" : "⬆ DRAINING — RISK OFF"}
        </span>
      </div>

      {/* Ambient glow */}
      <div
        className={`absolute top-0 right-0 h-28 w-28 blur-3xl pointer-events-none ${
          isInjecting ? "bg-data-profit" : isDraining ? "bg-data-loss" : "bg-transparent"
        }`}
        style={{ opacity: 0.06, zIndex: 0 }}
      />
      <div
        className={`absolute bottom-0 left-0 h-28 w-28 blur-3xl pointer-events-none ${
          isInjecting ? "bg-data-profit" : isDraining ? "bg-data-loss" : "bg-transparent"
        }`}
        style={{ opacity: 0.06, zIndex: 0 }}
      />
    </div>
  );
}
