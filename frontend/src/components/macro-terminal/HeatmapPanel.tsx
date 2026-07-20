"use client";

import React from "react";
import { LayoutGrid } from "lucide-react";
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

export function HeatmapPanel({ className }: { className?: string }) {
  const {
    assets,
    isFallback,
    dataStatus,
    lastUpdated,
  } = useMacroTerminal();
  
  const [sessionStatus, setSessionStatus] = React.useState<{
    label: MarketSession;
    color: string;
    textColor: string;
  }>({
    label: "CLOSED",
    color: "bg-gray-500",
    textColor: "text-gray-400",
  });

  React.useEffect(() => {
    setSessionStatus(getMarketSessionStatus());
    const interval = setInterval(() => {
      setSessionStatus(getMarketSessionStatus());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

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
      return "bg-[#1a1a1a] text-text-muted";
    }

    if (change > 2) return "bg-data-profit text-white";
    if (change > 1) return "bg-data-profit/80 text-white";
    if (change > 0) return "bg-data-profit/40 text-data-profit";
    if (change < -2) return "bg-data-loss text-white";
    if (change < -1) return "bg-data-loss/80 text-white";
    if (change < 0) return "bg-data-loss/40 text-data-loss";
    return "bg-[#1a1a1a] text-white";
  };

  return (
    <div className={`flex flex-col w-full glass overflow-hidden relative ${className ?? ""}`}>
      <div className="flex items-center justify-between border-b border-border-subtle p-2">
        <div className="flex items-center gap-2 min-w-0">
          <h2
            className="font-bold text-text-primary uppercase tracking-wider text-[11px] sm:text-xs whitespace-nowrap flex items-center gap-2"
            id="heatmap-heading"
          >
            <LayoutGrid size={14} className="text-accent-gold flex-shrink-0" /> Macro ETFs Heatmap
          </h2>
        </div>
        <div className="flex items-center gap-2" role="status">
          {dataStatus.quotes === "live" || dataStatus.quotes === "cache" ? (
            <span className="flex items-center gap-1.5 text-[8px] sm:text-[9px] font-mono font-bold text-data-profit bg-data-profit/10 px-2 py-0.5 rounded border border-data-profit/20 uppercase tracking-widest whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-data-profit animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
              LIVE
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[8px] sm:text-[9px] font-mono font-medium text-text-muted bg-white/5 px-2 py-0.5 rounded border border-white/10 uppercase tracking-widest whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-gold/50 animate-pulse"></span>
              {dataStatus.quotes === "error" ? "ERROR" : dataStatus.quotes === "stale" ? "STALE" : "CONNECTING..."}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 p-2 flex flex-col justify-between gap-1">
        {[
          {
            title: "• SAFE HAVEN & DEFENSIVE",
            tickers: ["GLD", "UUP", "IEF", "TLT", "FXY", "FXF", "VIXY"],
            color: "text-blue-400"
          },
          {
            title: "• RISK-ON (EQUITIES)",
            tickers: ["SPY", "QQQ", "IWM", "EFA", "EEM", "DIA", "ARKK"],
            color: "text-green-400"
          },
          {
            title: "• SECTORS & CREDIT",
            tickers: ["XLK", "XLF", "XLE", "HYG", "XLV", "XLI", "LQD"],
            color: "text-purple-400"
          },
          {
            title: "• OTHER FX & REAL YIELD",
            tickers: ["FXE", "FXB", "FXC", "TIP", "FXA", "USO", "DBA"],
            color: "text-orange-400"
          }
        ].map((category) => {
          const categoryAssets = assets.filter(a => category.tickers.includes(a.ticker));
          if (categoryAssets.length === 0) return null;

          return (
            <div key={category.title} className="flex flex-col gap-1.5 flex-1">
              <h3 className={`text-[9px] font-bold font-mono uppercase tracking-wider ${category.color} px-1 border-b border-border-subtle pb-0.5`}>
                {category.title}
              </h3>
              <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-7 gap-1.5 flex-1">
                {category.tickers.map(ticker => {
                  const asset = categoryAssets.find(a => a.ticker === ticker);
                  if (!asset) return null;
                  const change = asset.change ?? null;
                  return (
                    <div
                      key={asset.ticker}
                      title={`${asset.ticker} · ${asset.name} · ${renderChange(change)}`}
                      className={`flex flex-col items-center justify-center rounded p-2 h-full transition-all duration-300 hover:scale-[1.02] hover:ring-1 hover:ring-white/20 ${getColor(change)}`}
                    >
                      <span className="text-[13px] font-extrabold tracking-widest">
                        {asset.ticker}
                      </span>
                      <span className="text-[8px] opacity-90 w-full text-center mt-0.5 truncate">
                        {asset.name}
                      </span>
                      <span className="text-sm font-mono font-bold mt-1">
                        {renderChange(change)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {lastUpdated && (
        <div className="shrink-0 px-2 pb-1 text-[8px] text-text-muted text-right border-t border-border-subtle/50 pt-1">
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
