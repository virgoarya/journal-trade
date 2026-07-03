"use client";

import React, { useState, useEffect } from "react";
import { useMacroTerminal } from "./MacroTerminalContext";
import { ArrowDownRight, ArrowUpRight, Droplets } from "lucide-react";

function useCountdown(targetHourET: number, targetMinuteET: number) {
  const [timeLeft, setTimeLeft] = useState<string>("--h --m --s");

  useEffect(() => {
    const calculateTimeLeft = () => {
      const nowStr = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
      const nowET = new Date(nowStr);
      let targetET = new Date(nowStr);
      targetET.setHours(targetHourET, targetMinuteET, 0, 0);

      if (nowET.getTime() >= targetET.getTime()) {
        targetET.setDate(targetET.getDate() + 1);
      }
      if (targetET.getDay() === 6) {
        targetET.setDate(targetET.getDate() + 2);
      } else if (targetET.getDay() === 0) {
        targetET.setDate(targetET.getDate() + 1);
      }

      const diffMs = targetET.getTime() - nowET.getTime();
      if (diffMs <= 0) return "00h 00m 00s";

      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diffMs % (1000 * 60)) / 1000);

      return `${hours.toString().padStart(2, "0")}h ${mins.toString().padStart(2, "0")}m ${secs.toString().padStart(2, "0")}s`;
    };

    setTimeLeft(calculateTimeLeft());
    const interval = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(interval);
  }, [targetHourET, targetMinuteET]);

  return timeLeft;
}

const MAX_RRP_REF = 500;
const MAX_TGA_REF = 1000;
const GAUGE_RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS;

// Default liquidity state for safe rendering
const DEFAULT_LIQUIDITY = {
  value: 0,
  change: 0,
  status: "UNKNOWN" as const,
  date: "",
  trend: [] as ("injecting" | "draining" | "neutral")[],
  history: [] as { date: string; value: number; status: string }[],
  tga: undefined,
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
  targetHourET,
  targetMinuteET,
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
  targetHourET: number;
  targetMinuteET: number;
}) {
  const countdown = useCountdown(targetHourET, targetMinuteET);
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
    const w = 96;
    const h = 48;

    const points = curveData.map((d, i) => {
      const x = (i / (curveData.length - 1)) * w;
      const y = 2 + (1 - (d.value - minVal) / range) * (h - 4);
      return `${x},${y}`;
    });

    sparklinePath = `M ${points.join(" L ")}`;
  }

  return (
    <div className="flex flex-col items-center gap-3 relative z-10 w-full">
      <span className="text-[10px] text-text-muted font-mono bg-white/5 px-2 py-1 rounded border border-border-subtle whitespace-nowrap w-fit">
        {title}
      </span>
      
      {/* Gauge */}
      <div className="relative flex-shrink-0 mx-auto mt-2" style={{ width: 130, height: 130 }}>
        <svg width="130" height="130" viewBox="0 0 130 130" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="65" cy="65" r={GAUGE_RADIUS} fill="none" stroke={trackColor} strokeWidth="10" />
          <circle
            cx="65"
            cy="65"
            r={GAUGE_RADIUS}
            fill="none"
            stroke={gaugeColor}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={strokeOffset}
            style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-1">
          <span className="font-mono font-black leading-none tracking-tight text-base sm:text-lg" style={{ color: gaugeColor }}>
            {formattedValue}
          </span>
          <span className="text-[9px] sm:text-[10px] font-mono text-text-muted mt-1 tracking-widest uppercase">
            {pct < 1 && pct > 0 ? "<1%" : `${Math.round(pct)}%`}
          </span>
        </div>
      </div>

      {/* Change */}
      <div className="flex items-center justify-center gap-2 mt-1">
        <div className="flex items-center gap-1">
          <span className="text-text-muted font-mono text-[9px] uppercase tracking-widest">Change</span>
          <div className={`flex items-center gap-0.5 font-mono font-black leading-none text-sm ${change > 0 ? 'text-data-loss' : change < 0 ? 'text-data-profit' : 'text-text-muted'}`}>
            {change > 0 ? (
              <ArrowUpRight className="w-4 h-4 flex-shrink-0" />
            ) : change < 0 ? (
              <ArrowDownRight className="w-4 h-4 flex-shrink-0" />
            ) : null}
            <span className="font-mono font-bold text-sm">{changeFormatted}</span>
          </div>
        </div>
        <span className={`text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border ${
          isInjecting 
            ? 'text-data-profit border-data-profit/30 bg-data-profit/10' 
            : isDraining 
              ? 'text-data-loss border-data-loss/30 bg-data-loss/10' 
              : 'text-text-muted border-border-subtle bg-white/5'
        }`}>
          {isInjecting ? "INJECTING" : isDraining ? "DRAINING" : "NEUTRAL"}
        </span>
      </div>

      {/* Countdown */}
      <div className="flex flex-col items-center justify-center mt-3">
        <span className="text-[8px] text-text-muted font-mono uppercase tracking-widest mb-0.5">Next Release</span>
        <span className="text-[10px] text-accent-gold font-mono tracking-wider">{countdown}</span>
      </div>

      {/* Trend */}
      <div className="flex items-center justify-center w-full mt-3">
        <span className="text-text-muted font-mono text-[9px] uppercase tracking-widest mr-2">Trend</span>
        <div className="flex items-center justify-center flex-1">
          {curveData.length > 1 ? (
            <svg width="96" height="32" viewBox="0 0 96 48" preserveAspectRatio="none" className="overflow-visible flex-shrink-0">
              <path
                d={sparklinePath}
                fill="none"
                stroke={gaugeColor}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ filter: `drop-shadow(0px 1px 2px ${gaugeColor}40)` }}
              />
              {(() => {
                const minVal = Math.min(...curveData.map((d) => d.value));
                const maxVal = Math.max(...curveData.map((d) => d.value));
                const range = maxVal - minVal || 1;
                const lastVal = curveData[curveData.length - 1].value;
                const cy = 2 + (1 - (lastVal - minVal) / range) * 44;
                return <circle cx="96" cy={cy} r="2.5" fill={gaugeColor} />;
              })()}
            </svg>
          ) : trendDots.length === 0 ? (
            <span className="text-[9px] text-text-muted">—</span>
          ) : (
            <div className="flex items-center gap-1.5">
              {trendDots.map((dot, idx) => (
                <span key={idx} className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${dot === "injecting" ? "bg-data-profit" : dot === "draining" ? "bg-data-loss" : "bg-text-muted"}`} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function LiquidityGaugePanel({ className }: { className?: string }) {
  const { liquidity, dataStatus } = useMacroTerminal();
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

  // TGA: delta > 0 means Treasury withdrawing from banking system (DRAINING liquidity)
  // TGA: delta < 0 means Treasury injecting into banking system (INJECTING liquidity)
  const tgaStatus = tga ? (tga.delta > 0 ? "DRAINING" : tga.delta < 0 ? "INJECTING" : "NEUTRAL") : "UNKNOWN";
  const tgaChangeFormatted = tga 
    ? (Math.abs(tga.delta) >= 1000 
        ? `${(Math.abs(tga.delta)/1000).toFixed(2)}T` 
        : `${tga.delta > 0 ? "+" : ""}${tga.delta.toFixed(2)}B`)
    : "0B";

  const isAnyInjecting = onRrpStatus === "INJECTING" || tgaStatus === "INJECTING";
  const isAnyDraining = onRrpStatus === "DRAINING" || tgaStatus === "DRAINING";

  return (
    <div className={`flex flex-col w-full glass-panel overflow-hidden relative ${className ?? ""}`}>
      <div className="flex items-center justify-between border-b border-border-subtle p-2">
        <div className="flex items-center gap-2 min-w-0">
          <Droplets size={14} className="text-accent-gold flex-shrink-0" />
          <h2 className="font-bold text-text-primary uppercase tracking-wider text-[11px] sm:text-xs whitespace-nowrap">
            Liquidity Flow
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {dataStatus.liquidity === "stale" || dataStatus.liquidity === "error" ? (
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

      <div className="grid grid-cols-2 gap-2 flex-1 min-h-0 p-2">
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
          targetHourET={13}
          targetMinuteET={15}
        />
        
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
            targetHourET={16}
            targetMinuteET={0}
          />
        ) : (
          <div className="flex items-center justify-center text-text-muted text-[9px] font-mono">
            TGA Data Loading...
          </div>
        )}
      </div>

      {/* Ambient glow */}
      <div
        className={`absolute top-0 right-0 h-20 w-20 blur-3xl pointer-events-none ${
          isAnyInjecting ? "bg-data-profit" : isAnyDraining ? "bg-data-loss" : "bg-transparent"
        }`}
        style={{ opacity: 0.05, zIndex: 0 }}
      />
      <div
        className={`absolute bottom-0 left-0 h-20 w-20 blur-3xl pointer-events-none ${
          isAnyInjecting ? "bg-data-profit" : isAnyDraining ? "bg-data-loss" : "bg-transparent"
        }`}
        style={{ opacity: 0.05, zIndex: 0 }}
      />
    </div>
  );
}
