"use client";

import React from "react";
import {
  Activity,
  RefreshCw,
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

  return <span className={`w-2 h-2 rounded-full ${colorClass}`} />;
}

function StatusLabel({ status }: { status: string }) {
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
      {map[status] ?? status.toUpperCase()}
    </span>
  );
}

function MiniStatusPill({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "risk" | "watch" | "profit";
}) {
  const toneClass =
    tone === "risk"
      ? "border-data-loss/30 bg-data-loss/10 text-data-loss"
      : tone === "watch"
        ? "border-data-warning/30 bg-data-warning/10 text-data-warning"
        : tone === "profit"
          ? "border-data-profit/30 bg-data-profit/10 text-data-profit"
          : "border-border-subtle bg-surface-elevated/40 text-text-muted";

  return (
    <div
      className={`flex items-center gap-2 rounded border px-2.5 py-1.5 min-w-0 ${toneClass}`}
    >
      <span className="text-[9px] font-mono uppercase tracking-widest truncate max-w-[68px]">
        {label}
      </span>
      <span className="text-[10px] font-mono font-bold text-text-primary truncate max-w-[110px]">
        {value}
      </span>
    </div>
  );
}

function AlertStrip() {
  const {
    currentRegime,
    liquidity,
    vix,
    yieldCurve,
    nextEvent,
    systemAlert,
    clearSystemAlert,
    regimeData,
  } = useMacroTerminal();
  const alerts: Array<{ label: string; tone: "risk" | "watch" | "profit" }> =
    [];

  if (currentRegime === "Stagflation" || currentRegime === "Deflation") {
    alerts.push({ label: "MACRO REGIME SHIFT WATCH", tone: "risk" });
  }
  if (liquidity?.status === "DRAINING") {
    alerts.push({ label: "LIQUIDITY DRAIN", tone: "risk" });
  } else if (
    liquidity?.status === "NEUTRAL" ||
    liquidity?.status === "UNKNOWN"
  ) {
    alerts.push({ label: "LIQUIDITY NEUTRAL", tone: "watch" });
  }
  if (vix.regime === "ELEVATED" || vix.regime === "FEAR") {
    alerts.push({ label: `VIX ${vix.regime}`, tone: "risk" });
  } else if (vix.regime === "NORMAL-CAUTIOUS") {
    alerts.push({ label: "VIX NORMAL-CAUTIOUS", tone: "watch" });
  }
  if (regimeData?.inflation.pressure === "HOT") {
    alerts.push({ label: "INFLATION HOT", tone: "risk" });
  }
  if (yieldCurve.inverted || yieldCurve.curveRegime === "Inverted") {
    alerts.push({ label: "YIELD CURVE INVERTED", tone: "risk" });
  }
  if (nextEvent?.impact === "High") {
    alerts.push({ label: "HIGH-IMPACT EVENT < 24H", tone: "watch" });
  }

  return (
    <div className="flex flex-col gap-2 shrink-0">
      {systemAlert && (
        <div className="flex items-center justify-between rounded border border-accent-gold/30 bg-accent-gold/10 px-3 py-2 text-[10px] font-mono text-accent-gold">
          <span>{systemAlert}</span>
          <button
            onClick={clearSystemAlert}
            className="text-text-muted hover:text-text-primary"
          >
            DISMISS
          </button>
        </div>
      )}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
        {alerts.length > 0 ? (
          alerts.map((alert) => (
            <MiniStatusPill
              key={alert.label}
              label={alert.label}
              value="ACTIVE"
              tone={alert.tone}
            />
          ))
        ) : (
          <MiniStatusPill label="DESK STATE" value="MONITORING" tone="profit" />
        )}
      </div>
    </div>
  );
}

function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    liquidity,
    vix,
    yieldCurve,
    refreshSnapshot,
    regimeData,
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
    <div className="flex flex-col min-h-[calc(100vh-8rem)] w-full max-w-[1600px] mx-auto gap-4">
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

        <div className="flex items-center gap-2">
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
          <div className="hidden md:flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-2">
              <StatusDot status="live" />
              <span className="text-text-muted">MARKET DATA:</span>
              <StatusLabel status="live" />
            </div>
            <div className="flex items-center gap-2">
              <StatusDot status="live" />
              <span className="text-text-muted">AI ENGINE:</span>
              <StatusLabel status="live" />
            </div>
          </div>
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

      <div className="flex flex-col gap-2 shrink-0">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <MiniStatusPill
            label="LIQUIDITY"
            value={liquidity?.status ?? "INJECTING"}
            tone={
              liquidity?.status === "DRAINING"
                ? "risk"
                : liquidity?.status === "INJECTING"
                  ? "profit"
                  : "watch"
            }
          />
          <MiniStatusPill
            label="INFLATION"
            value={regimeData?.inflation.pressure ?? "NORMAL"}
            tone={
              regimeData?.inflation.pressure === "HOT"
                ? "risk"
                : regimeData?.inflation.pressure === "COLD"
                  ? "profit"
                  : "neutral"
            }
          />
<MiniStatusPill
            label="VIX"
            value={vix.value === null ? "—" : vix.value.toFixed(1)}
            tone={
              vix.regime === "ELEVATED" || vix.regime === "FEAR"
                ? "risk"
                : vix.regime === "NORMAL-CAUTIOUS"
                    ? "watch"
                    : "profit"
            }
          />
          <MiniStatusPill
            label="YIELD CURVE"
            value={yieldCurve.curveRegime === "UNKNOWN" ? "Bear Flattener" : yieldCurve.curveRegime}
            tone={yieldCurve.inverted ? "risk" : "watch"}
          />
        </div>
        <AlertStrip />
      </div>

      <div className="flex-1 min-h-0 overflow-visible">{children}</div>
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
