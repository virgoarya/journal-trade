"use client";

import React from "react";
import {
  Activity,
  RefreshCw,
  Droplets,
  Gauge,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MacroTerminalProvider,
  useMacroTerminal,
} from "@/components/macro-terminal/MacroTerminalContext";
import { ErrorBoundary } from "@/components/macro-terminal/ErrorBoundary";

const TABS = [
  { name: "Overview", path: "/macro-terminal/overview" },
  { name: "COT", path: "/macro-terminal/cot" },
  { name: "Quant Lab", path: "/macro-terminal/quant-lab" },
  { name: "Nexus", path: "/macro-terminal/nexus" },
  { name: "Intelligence", path: "/macro-terminal/intelligence" },
];

function StatusDot({ status }: { status: string }) {
  const colorClass =
    status === "live"
      ? "bg-data-profit animate-pulse"
      : status === "cache"
        ? "bg-data-warning"
        : status === "fallback"
          ? "bg-data-warning"
          : status === "error"
            ? "bg-data-loss"
            : status === "stale"
              ? "bg-text-muted"
              : "bg-text-muted";

  return <span className={`w-1.5 h-1.5 rounded-full ${colorClass}`} />;
}

function StatusLabel({ status }: { status?: string }) {
  const map: Record<string, string> = {
    live: "LIVE",
    cache: "CACHE",
    fallback: "FALLBACK",
    stale: "STALE",
    error: "ERROR",
  };

  const colorClass =
    status === "live"
      ? "text-data-profit"
      : status === "cache"
        ? "text-data-warning"
        : status === "fallback"
          ? "text-data-warning"
          : status === "error"
            ? "text-data-loss"
            : status === "stale"
              ? "text-text-muted"
              : "text-text-muted";

  return (
    <span className={`font-mono ${colorClass}`}>
      {map[status ?? ""] ?? (status ?? "UNKNOWN").toUpperCase()}
    </span>
  );
}

function MarketStatusBar() {
  const {
    liquidity,
    vix,
    yieldCurve,
    regimeData,
    dataStatus,
    lastUpdated,
  } = useMacroTerminal();

  const liquidityStatus = liquidity?.status ?? "UNKNOWN";
  const vixValue = vix.value === null ? "—" : vix.value.toFixed(1);
  const vixRegime = vix.regime ?? "UNKNOWN";
  const yieldCurveRegime = yieldCurve.curveRegime ?? "UNKNOWN";
  const inflationPressure = regimeData?.inflation.pressure ?? "UNKNOWN";

  const getLiquidityTone = (status: string) => {
    if (status === "DRAINING") return "text-data-loss";
    if (status === "INJECTING") return "text-data-profit";
    return "text-data-warning";
  };

  const getVixTone = (regime: string) => {
    if (regime === "ELEVATED" || regime === "FEAR") return "text-data-loss";
    if (regime === "NORMAL-CAUTIOUS") return "text-data-warning";
    return "text-data-profit";
  };

  const getInflationTone = (pressure: string) => {
    if (pressure === "HOT") return "text-data-loss";
    if (pressure === "COLD") return "text-data-profit";
    return "text-data-warning";
  };

  const getYieldCurveTone = (inverted: boolean) => {
    if (inverted) return "text-data-loss";
    return "text-data-profit";
  };

  return (
    <div className="flex items-center gap-3 text-[9px] font-mono text-text-muted px-2 py-1 rounded border border-border-subtle bg-white/5">
      <div className="flex items-center gap-1">
        <Droplets size={10} className={getLiquidityTone(liquidityStatus)} />
        <span className={getLiquidityTone(liquidityStatus)}>{liquidityStatus.toUpperCase()}</span>
      </div>
      <div className="flex items-center gap-1">
        <Gauge size={10} className={getVixTone(vixRegime)} />
        <span className={getVixTone(vixRegime)}>VIX: {vixValue}</span>
      </div>
      <div className="flex items-center gap-1">
        {yieldCurve.inverted ? <TrendingDown size={10} className="text-data-loss" /> : <TrendingUp size={10} className="text-data-profit" />}
        <span className={getYieldCurveTone(yieldCurve.inverted)}>YIELD: {yieldCurveRegime.toUpperCase()}</span>
      </div>
      <div className="flex items-center gap-1">
        <Activity size={10} className={getInflationTone(inflationPressure)} />
        <span className={getInflationTone(inflationPressure)}>INFL: {inflationPressure.toUpperCase()}</span>
      </div>
      <div className="flex items-center gap-1 ml-auto border-l border-border-subtle pl-3">
        <StatusDot status={dataStatus.quotes} />
        <span className="text-text-muted">DATA:</span>
        <StatusLabel status={dataStatus.quotes} />
      </div>
      {lastUpdated && (
        <span className="ml-auto pl-3 border-l border-border-subtle text-text-muted">
          {new Intl.DateTimeFormat("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).format(lastUpdated)}
        </span>
      )}
    </div>
  );
}

function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    refreshSnapshot,
  } = useMacroTerminal();
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshSnapshot();
    } finally {
      window.setTimeout(() => setIsRefreshing(false), 350);
    }
  };

  return (
    <div className="flex flex-col w-full gap-4">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-accent-gold/10 border border-accent-gold/20">
            <Activity className="w-6 h-6 text-accent-gold" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold font-mono text-text-primary tracking-wide">
              MACRO <span className="text-accent-gold">TERMINAL</span>
            </h1>
            <p className="text-xs text-text-secondary font-mono tracking-widest uppercase">
              Institutional Macro Control Room
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 rounded border border-accent-gold/30 bg-accent-gold/10 px-3 py-2 text-[10px] font-mono text-accent-gold transition-colors hover:bg-accent-gold/15 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
            />
            REFRESH
          </button>
          <MarketStatusBar /> {/* Consolidated Market Status Bar */}
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-border-subtle pb-0 shrink-0 overflow-x-auto scrollbar-hide">
        {TABS.map((tab) => {
          const isActive = pathname.startsWith(tab.path);
          return (
            <Link
              key={tab.path}
              href={tab.path}
              className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-mono text-sm transition-colors border-b-2 whitespace-nowrap ${
                  isActive
                    ? "border-data-profit text-data-profit bg-data-profit/5 shadow-[0_-1px_0_rgba(57,255,136,0.35)]"
                    : "border-transparent text-text-muted hover:text-text-main hover:bg-surface-elevated/50"
              }`}
            >
              {tab.name}
            </Link>
          );
        })}
      </div>

      {/* Children (Overview, COT, etc.) will render here */}
      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
    </div>
  );
}

export default function MacroTerminalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary>
      <MacroTerminalProvider>
        <LayoutContent>{children}</LayoutContent>
      </MacroTerminalProvider>
    </ErrorBoundary>
  );
}
