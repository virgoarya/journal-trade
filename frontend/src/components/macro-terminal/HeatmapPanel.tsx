"use client";

import React from "react";
import { ShieldAlert, BrainCircuit, RefreshCw } from "lucide-react";
import { useMacroTerminal } from "./MacroTerminalContext";

export type MarketSession = "LIVE" | "PRE-MARKET" | "AFTER-HOURS" | "CLOSED";

export function getMarketSessionStatus(): {
  label: MarketSession;
  color: string;
  textColor: string;
} {
  const now = new Date();

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });

  const parts = formatter.formatToParts(now);

  let weekday = "";
  let hour = 0;
  let minute = 0;

  for (const part of parts) {
    if (part.type === "weekday") weekday = part.value;
    if (part.type === "hour") hour = parseInt(part.value, 10);
    if (part.type === "minute") minute = parseInt(part.value, 10);
  }

  // 1. Filter Weekend
  if (weekday === "Sat" || weekday === "Sun") {
    return {
      label: "CLOSED",
      color: "bg-gray-500",
      textColor: "text-gray-400",
    };
  }

  const timeAsFloat = hour + minute / 60;

  if (timeAsFloat >= 4.0 && timeAsFloat < 9.5) {
    return {
      label: "PRE-MARKET",
      color: "bg-yellow-600",
      textColor: "text-yellow-400",
    };
  }
  if (timeAsFloat >= 9.5 && timeAsFloat < 16.0) {
    return {
      label: "LIVE",
      color: "bg-data-profit",
      textColor: "text-data-profit",
    };
  }
  if (timeAsFloat >= 16.0 && timeAsFloat < 20.0) {
    return {
      label: "AFTER-HOURS",
      color: "bg-yellow-600",
      textColor: "text-yellow-400",
    };
  }

  return { label: "CLOSED", color: "bg-gray-500", textColor: "text-gray-400" };
}

export function HeatmapPanel() {
  const {
    assets,
    isFallback,
    aiReasoning,
    isAnalyzing,
    lastUpdated,
    analyzeRegime,
    dataStatus,
  } = useMacroTerminal();
  const sessionStatus = getMarketSessionStatus();

  const renderChange = (change: number | null | undefined) => {
    if (change === null || change === undefined || Number.isNaN(change)) {
      return "0.00%";
    }

    const isPositive = change > 0;
    const prefix = isPositive ? "+" : "";
    return `${prefix}${change.toFixed(2)}%`;
  };

  const getColor = (change: number | null | undefined) => {
    if (change === null || change === undefined || Number.isNaN(change)) {
      return "bg-surface-elevated text-text-muted";
    }

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
        <h2
          className="font-bold text-text-primary uppercase tracking-wider text-[10px] sm:text-xs"
          id="heatmap-heading"
        >
          Macro ETFs Heatmap
        </h2>
        <div className="flex items-center gap-3" role="status">
          <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border border-border-subtle">
            <span
              className={`h-1.5 w-1.5 rounded-full ${sessionStatus.color}`}
              aria-hidden
            />
            <span className={`${sessionStatus.textColor}`}>
              {sessionStatus.label}
            </span>
          </span>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
              dataStatus.quotes === "live"
                ? "text-data-profit border-data-profit/30 bg-data-profit/10"
                : dataStatus.quotes === "cache"
                  ? "text-data-warning border-data-warning/30 bg-data-warning/10"
                  : dataStatus.quotes === "fallback"
                    ? "text-data-warning border-data-warning/30 bg-data-warning/10"
                    : dataStatus.quotes === "error"
                      ? "text-data-loss border-data-loss/30 bg-data-loss/10"
                      : "text-text-muted border-border-subtle bg-surface-elevated/50"
            }`}
          >
            {dataStatus.quotes.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="p-2 grid grid-cols-2 sm:grid-cols-4 gap-1 shrink-0">
        {assets.map((asset) => {
          const change = asset.change ?? null;
          return (
            <div
              key={asset.ticker}
              title={`${asset.ticker} · ${asset.name} · ${renderChange(change)}`}
              className={`flex flex-col items-center justify-center rounded p-2 transition-all duration-300 hover:scale-[1.02] hover:ring-2 hover:ring-white/20 ${getColor(change)}`}
            >
              <span className="text-xs font-bold tracking-wide">
                {asset.ticker}
              </span>
              <span className="text-[9px] opacity-80 truncate w-full text-center mt-0.5">
                {asset.name}
              </span>
              <span className="text-sm font-mono font-bold mt-1">
                {renderChange(change)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex-1 border-t border-border-subtle flex flex-col min-h-0">
        <div className="flex items-center justify-between p-3 pb-1.5 shrink-0">
          <div className="flex items-center gap-2 text-accent-gold text-[10px] font-mono tracking-widest uppercase">
            <BrainCircuit size={12} aria-hidden />
            <span>Hunter AI Reasoning</span>
          </div>
          <button
            onClick={() => analyzeRegime()}
            disabled={isAnalyzing}
            aria-busy={isAnalyzing}
            aria-label="Analisis ulang regime makro"
            className="text-[10px] bg-white/5 hover:bg-white/10 px-2 py-1 rounded transition-colors flex items-center gap-1 disabled:opacity-50"
          >
            <RefreshCw
              size={10}
              className={isAnalyzing ? "animate-spin" : ""}
            />
            {isAnalyzing ? "ANALYZING..." : "RE-ANALYZE"}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-2 min-h-0">
          <div className="text-[10px] text-text-secondary leading-relaxed font-mono break-words whitespace-pre-wrap">
            {aiReasoning ? (
              <div className="animate-in fade-in duration-500">{aiReasoning.replace(/\*\*/g, "")}</div>
            ) : isAnalyzing ? (
              <div className="text-accent-gold animate-pulse">
                Connecting to Hunter Desk Terminal...
              </div>
            ) : (
              <div className="text-text-muted">
                Menunggu pergerakan pasar untuk dianalisis...
              </div>
            )}
          </div>
        </div>
        {lastUpdated && (
          <div className="shrink-0 px-3 pb-2 text-[9px] text-text-muted text-right">
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
    </div>
  );
}
