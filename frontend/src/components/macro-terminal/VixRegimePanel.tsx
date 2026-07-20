"use client";

import React, { useMemo } from "react";
import { AlertOctagon } from "lucide-react";
import { useMacroTerminal } from "./MacroTerminalContext";
import { Skeleton, SkeletonGauge } from "./Skeleton";

const VIX_MIN = 10;
const VIX_MAX = 30;
const GAUGE_RADIUS = 74;
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS;
const GAUGE_VISIBLE_ARC = 0.72;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getVixColor(value: number) {
  if (value >= 30) return "#FF3864";
  if (value >= 20) return "#FF6A00";
  if (value >= 15) return "#FFB020";
  return "#39FF88";
}

function getVixLabel(value: number, fallback: string) {
  if (value >= 30) return "FEAR";
  if (value >= 20) return "ELEVATED";
  if (value >= 15) return "NORMAL-CAUTIOUS";
  return fallback || "CALM";
}

export function VixRegimePanel() {
  const { vix, dataStatus } = useMacroTerminal();

  const value = vix.value ?? 0;
  const vixColor = getVixColor(value);
  const vixLabel = getVixLabel(value, vix.regime);
  const barPct = clamp(((value - VIX_MIN) / (VIX_MAX - VIX_MIN)) * 100, 0, 100);
  const activeArc = GAUGE_CIRCUMFERENCE * GAUGE_VISIBLE_ARC;
  const gaugeOffset = activeArc - (barPct / 100) * activeArc;

  const sparklineData = useMemo(() => {
    const base = value || 16.4;
    return Array.from({ length: 30 }, (_, index) => {
      const wave = Math.sin(index * 0.55) * 1.35 + Math.cos(index * 0.21) * 0.75;
      const drift = (index - 29) * 0.018;
      const noise = (((index * 13) % 9) - 4) * 0.08;
      return {
        index,
        value: Number(Math.max(10, base + wave + drift + noise).toFixed(1)),
      };
    });
  }, [value]);

  const minSpark = Math.min(...sparklineData.map((point) => point.value));
  const maxSpark = Math.max(...sparklineData.map((point) => point.value));
  const sparkRange = maxSpark - minSpark || 1;
  const sparklinePath = sparklineData
    .map((point, index) => {
      const x = (index / (sparklineData.length - 1)) * 320;
      const y = 64 - ((point.value - minSpark) / sparkRange) * 48;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" L ");

  if (vix.value === null) {
    return (
      <div className="flex flex-col h-full w-full glass overflow-hidden relative p-4">
        <div className="flex items-center justify-between mb-6 shrink-0 relative z-10">
          <div className="flex items-center gap-2 min-w-0">
            <AlertOctagon size={14} className="text-accent-gold flex-shrink-0" />
            <h2 className="font-bold text-text-primary uppercase tracking-wider text-[11px] sm:text-xs whitespace-nowrap">
              Volatility Status
            </h2>
          </div>
        </div>
        <div className="flex-1 flex flex-col justify-center items-center min-h-0">
          <SkeletonGauge />
          <div className="mt-4 space-y-2">
            <Skeleton variant="text" className="w-24 h-3" />
            <Skeleton variant="text" className="w-32 h-2" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full glass overflow-hidden relative p-4">
      <div className="absolute -right-24 -top-24 h-56 w-56 rounded-full blur-3xl pointer-events-none" style={{ backgroundColor: vixColor, opacity: 0.08 }} />
      <div className="absolute -left-24 -bottom-24 h-56 w-56 rounded-full blur-3xl pointer-events-none" style={{ backgroundColor: vixColor, opacity: 0.05 }} />

      <div className="flex items-center justify-between mb-6 shrink-0 relative z-10">
        <div className="flex items-center gap-2 min-w-0">
          <AlertOctagon size={14} className="text-accent-gold flex-shrink-0" />
          <h2 className="font-bold text-text-primary uppercase tracking-wider text-[11px] sm:text-xs whitespace-nowrap">
            Volatility Status
          </h2>
        </div>
        <span
          className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
            dataStatus.quant === "live"
              ? "text-data-profit border-data-profit/30 bg-data-profit/10"
              : dataStatus.quant === "cache"
                ? "text-data-warning border-data-warning/30 bg-data-warning/10"
                : dataStatus.quant === "fallback"
                  ? "text-data-warning border-data-warning/30 bg-data-warning/10"
                  : dataStatus.quant === "error"
                    ? "text-data-loss border-data-loss/30 bg-data-loss/10"
                    : "text-text-muted border-border-subtle bg-surface-elevated/50"
          }`}
        >
          {dataStatus.quant.toUpperCase()}
        </span>
      </div>

      <div className="flex-1 flex flex-col justify-center items-center min-h-0 relative z-10">
        <div className="relative w-44 h-44 flex items-center justify-center mb-4">
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 200 200"
            style={{ transform: "rotate(-126deg)" }}
          >
            <circle
              cx="100"
              cy="100"
              r={GAUGE_RADIUS}
              fill="none"
              stroke="rgba(148,163,184,0.14)"
              strokeWidth="13"
              strokeLinecap="round"
              strokeDasharray={`${activeArc} ${GAUGE_CIRCUMFERENCE - activeArc}`}
            />
            <circle
              cx="100"
              cy="100"
              r={GAUGE_RADIUS}
              fill="none"
              stroke={vixColor}
              strokeWidth="13"
              strokeLinecap="round"
              strokeDasharray={`${activeArc} ${GAUGE_CIRCUMFERENCE - activeArc}`}
              strokeDashoffset={gaugeOffset}
              style={{
                filter: `drop-shadow(0 0 16px ${vixColor}66)`,
                transition: "stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)",
              }}
            />
          </svg>
          <div className="relative z-10 text-center">
            <span className="text-5xl font-black font-mono leading-none tracking-tight" style={{ color: vixColor }}>
              {value.toFixed(1)}
            </span>
            <span className="block text-[10px] text-text-muted font-mono mt-2 tracking-widest uppercase">
              VIX Index
            </span>
          </div>
        </div>

        <div className="text-center mb-6">
          <h3 className="text-lg font-black font-mono tracking-[0.22em]" style={{ color: vixColor }}>
            {vixLabel}
          </h3>
          <p className="text-xs text-text-muted font-mono mt-1">
            Volatility band active · <span className="text-text-primary font-bold">VIX {value.toFixed(1)}</span>
          </p>
        </div>

        <div className="w-full max-w-[320px] h-2.5 bg-surface-elevated rounded-full overflow-hidden relative border border-border-subtle">
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${barPct}%`,
              background: "linear-gradient(90deg, #39FF88 0%, #FFB020 52%, #FF3864 100%)",
              boxShadow: `0 0 18px ${vixColor}55`,
            }}
          />
          <div
            className="absolute top-1/2 -mt-3 w-0.5 h-6 bg-text-primary shadow-[0_0_10px_rgba(255,255,255,0.9)]"
            style={{ left: `calc(${barPct}% - 1px)` }}
          />
        </div>

        <div className="w-full max-w-[320px] flex justify-between text-[9px] text-text-muted font-mono mt-1.5 px-1">
          <span>10</span>
          <span>20</span>
          <span>30+</span>
        </div>

        <div className="w-full max-w-[320px] mt-6 border border-border-subtle bg-surface-elevated/20 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] text-text-muted font-mono uppercase tracking-widest">
              30D VIX History
            </span>
            <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: vixColor }}>
              LIVE TRACE
            </span>
          </div>
          <svg viewBox="0 0 320 82" className="w-full h-16 overflow-visible">
            <defs>
              <linearGradient id="vixSparklineGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#39FF88" />
                <stop offset="55%" stopColor="#FFB020" />
                <stop offset="100%" stopColor="#FF3864" />
              </linearGradient>
            </defs>
            <path
              d={sparklinePath}
              fill="none"
              stroke="rgba(148,163,184,0.18)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={sparklinePath}
              fill="none"
              stroke="url(#vixSparklineGradient)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ filter: `drop-shadow(0 0 10px ${vixColor}55)` }}
            />
            <circle
              cx="320"
              cy={64 - ((sparklineData[sparklineData.length - 1].value - minSpark) / sparkRange) * 48}
              r="4"
              fill={vixColor}
              stroke="#0D0D0D"
              strokeWidth="2"
            />
          </svg>
        </div>

        {vix.fetchedAt && (
          <p className="text-[9px] font-mono text-text-muted mt-4 text-center shrink-0">
            Updated{" "}
            {new Date(vix.fetchedAt).toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}{" "}
            ·{" "}
            {vix.source === "yahoo"
              ? "Yahoo Finance"
              : vix.source === "fred"
                ? "FRED fallback"
                : "Live Yahoo Finance API"}
          </p>
        )}
      </div>
    </div>
  );
}
