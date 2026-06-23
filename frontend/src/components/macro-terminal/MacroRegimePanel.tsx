"use client";

import React, { useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { useMacroTerminal } from "./MacroTerminalContext";
import { X, Activity, Shield, TrendingUp, Clock } from "lucide-react";

const QUADRANT_CONFIG: Record<
  string,
  { title: string; desc: string; color: string }
> = {
  goldilocks: {
    title: "GOLDILOCKS",
    desc: "Growth / Inflation",
    color: "#10B981",
  },
  reflation: {
    title: "REFLATION",
    desc: "Growth / Inflation",
    color: "#3B82F6",
  },
  stagflation: {
    title: "STAGFLATION",
    desc: "Growth / Inflation",
    color: "#F59E0B",
  },
  deflation: {
    title: "DEFLATION",
    desc: "Growth / Inflation",
    color: "#94A3B8",
  },
  transition: {
    title: "TRANSITION",
    desc: "Growth / Inflation",
    color: "#8B5CF6",
  },
};

type PlaybookEntry = {
  asset: string;
  desc: string;
  bias?: "bullish" | "bearish" | "neutral";
};

function ObserverModal({
  show,
  cfg,
  entries,
  error,
  isObserving,
  onClose,
  onRetry,
}: {
  show: boolean;
  cfg: { title: string; color: string };
  entries: PlaybookEntry[] | null;
  error: string | null;
  isObserving: boolean;
  onClose: () => void;
  onRetry: () => void;
}) {
  if (!show) return null;

  const getBiasIcon = (bias?: string) => {
    if (bias === "bullish")
      return <Activity className="w-3 h-3 text-data-profit" />;
    if (bias === "bearish")
      return <Activity className="w-3 h-3 text-data-loss" />;
    return <Activity className="w-3 h-3 text-text-muted" />;
  };

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{
        backgroundColor: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(8px)",
      }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-xl border glass overflow-hidden"
        style={{ backgroundColor: "#0a0a0a", borderColor: cfg.color + "40" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="p-1.5 rounded-lg"
              style={{ backgroundColor: cfg.color + "20" }}
            >
              <Activity className="w-4 h-4" style={{ color: cfg.color }} />
            </div>
            <div>
              <span
                className="text-xs font-mono font-bold uppercase tracking-widest"
                style={{ color: cfg.color }}
              >
                AI Observer / {cfg.title}
              </span>
              <p className="text-[9px] text-text-muted font-mono mt-0.5">
                Structural asset allocation based on current regime, liquidity,
                VIX, and curve state
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-white p-1.5 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isObserving ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-8 h-8 border-2 border-neutral-700 border-t-accent-gold rounded-full animate-spin" />
              <span className="text-[10px] text-text-muted font-mono animate-pulse">
                Hunter AI sedang mengobservasi struktur aset di regime ini...
              </span>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-data-loss text-[10px] font-mono">{error}</p>
              <button
                onClick={onRetry}
                className="mt-3 text-[10px] text-accent-gold font-mono hover:underline"
              >
                Retry
              </button>
            </div>
          ) : !entries || entries.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-text-muted text-[10px] font-mono">
                Tidak ada structural edge yang terdeteksi untuk regime ini.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-lg border border-neutral-800 bg-neutral-900/40 hover:border-neutral-700 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[11px] font-mono font-bold tracking-tight"
                        style={{ color: cfg.color }}
                      >
                        {entry.asset}
                      </span>
                      {getBiasIcon(entry.bias)}
                    </div>
                    {entry.bias && (
                      <span
                        className={`text-[8px] font-mono uppercase px-2 py-0.5 rounded ${
                          entry.bias === "bullish"
                            ? "bg-data-profit/10 text-data-profit border border-data-profit/20"
                            : entry.bias === "bearish"
                              ? "bg-data-loss/10 text-data-loss border border-data-loss/20"
                              : "bg-neutral-800 text-text-muted border border-neutral-700"
                        }`}
                      >
                        {entry.bias}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-text-secondary leading-relaxed font-mono break-words">
                    {entry.desc}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-3 border-t border-neutral-800 shrink-0 flex items-center justify-between">
          <span className="text-[9px] text-text-muted font-mono">
            Generated by Hunter Desk AI · Not financial advice
          </span>
          <button
            onClick={onClose}
            className="text-[10px] text-text-muted font-mono hover:text-white transition-colors"
          >
            Close [ESC]
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function MetricStrip({
  label,
  value,
  status,
  color,
  roc5d,
  subScores,
  pressure,
}: {
  label: string;
  value: string;
  status: string;
  color: string;
  roc5d?: number;
  subScores?: Record<string, { ratio?: number; value?: number | null; status: string }>;
  pressure?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasSubScores = subScores && Object.keys(subScores).length > 0;

  const getStatusColor = (s: string) => {
    if (s.includes("ACCELERATING")) return "#22c55e";
    if (s.includes("DECELERATING")) return "#ef4444";
    if (s.includes("TURNING")) return "#eab308";
    if (s.includes("HOT")) return "#ef4444";
    if (s.includes("COLD")) return "#22c55e";
    return "#94a3b8";
  };

  return (
    <div className="rounded border border-border-subtle bg-surface-elevated/35 min-w-0 flex flex-col transition-all">
      <div
        className={`p-2 flex-1 ${hasSubScores ? 'cursor-pointer hover:bg-surface-elevated/50' : ''}`}
        onClick={() => hasSubScores && setExpanded(!expanded)}
      >
        {/* Row 1: Label + ROC */}
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[8px] text-text-muted font-mono uppercase tracking-widest">
            {label}
          </span>
          {roc5d !== undefined && (
            <span className={`text-[8px] font-mono font-bold ${roc5d > 0 ? 'text-green-500' : roc5d < 0 ? 'text-red-500' : 'text-text-muted'}`}>
              {roc5d > 0 ? '▲' : roc5d < 0 ? '▼' : '·'}{Math.abs(roc5d).toFixed(2)}%
            </span>
          )}
          {hasSubScores && (
            <span className="text-[8px] text-text-muted ml-auto">{expanded ? '▾' : '▸'}</span>
          )}
        </div>
        {/* Row 2: Value */}
        <div className="text-xs font-mono font-bold text-text-primary leading-tight break-all" title={value}>
          {value}
        </div>
        {/* Row 3: Status badge */}
        <div className="mt-1">
          <span
            className={`text-[8px] font-mono px-1.5 py-0.5 rounded border inline-block ${status === 'TURNING' ? 'animate-pulse' : ''}`}
            style={{
              color,
              borderColor: `${color}40`,
              backgroundColor: `${color}12`,
            }}
          >
            {status}{pressure ? ` · ${pressure}` : ''}
          </span>
        </div>
      </div>

      {expanded && hasSubScores && (
        <div className="px-2 pb-2 pt-1 border-t border-border-subtle bg-black/20 text-[9px] font-mono space-y-1">
          {Object.entries(subScores).map(([key, data]) => (
            <div key={key} className="flex justify-between items-center text-text-secondary gap-1">
              <span className="truncate max-w-[70px]">{key.replace(/([A-Z])/g, ' $1').trim().toUpperCase()}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-text-muted">
                  {data.ratio !== undefined ? data.ratio.toFixed(4) : data.value !== null && data.value !== undefined ? data.value.toFixed(2) + '%' : 'N/A'}
                </span>
                <span
                  className="px-1 rounded"
                  style={{
                    color: getStatusColor(data.status),
                    backgroundColor: `${getStatusColor(data.status)}15`
                  }}
                >
                  {data.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function lastShift(
  history: Array<{ date: string; quadrant: string }> | undefined,
  current: string,
) {
  if (!history?.length) return null;
  for (let i = history.length - 2; i >= 0; i -= 1) {
    if (history[i].quadrant !== current) {
      return {
        from: history[i].quadrant,
        to: history[i + 1]?.quadrant ?? current,
        date: history[i + 1]?.date ?? history[i].date,
      };
    }
  }
  return null;
}

export function MacroRegimePanel() {
  const {
    currentRegime,
    regimeData,
    assets,
    liquidity,
    dataStatus,
    vix,
    yieldCurve,
  } = useMacroTerminal();
  const [observerState, setObserverState] = useState({
    show: false,
    isObserving: false,
    error: null as string | null,
    entries: null as PlaybookEntry[] | null,
  });

  const activeQuadrant = useMemo(() => {
    const regimeFromData = regimeData?.quadrant?.toLowerCase();
    const regimeFromState = currentRegime?.toLowerCase();
    const regime = regimeFromData || regimeFromState;
    if (!regime) return "";
    return [
      "goldilocks",
      "reflation",
      "stagflation",
      "deflation",
      "transition",
    ].includes(regime)
      ? regime
      : "";
  }, [regimeData?.quadrant, currentRegime]);

  const hasRegime = !!activeQuadrant && activeQuadrant !== "transition";
  const cfg = activeQuadrant ? QUADRANT_CONFIG[activeQuadrant] : null;
  const shift = lastShift(regimeData?.history, currentRegime ?? "");
  const confidenceScore = regimeData?.confidence?.score ?? 0;

  const inferBias = (
    asset: string,
    desc: string,
  ): "bullish" | "bearish" | "neutral" => {
    const bullishSignals = [
      "bullish",
      "long",
      "buy",
      "strong",
      "positive",
      "naik",
      "menguat",
      "rebound",
      "recovery",
      "expansion",
    ];
    const bearishSignals = [
      "bearish",
      "short",
      "sell",
      "weak",
      "negative",
      "turun",
      "melemah",
      "crash",
      "fear",
      "drain",
      "stress",
    ];
    const combined = `${asset} ${desc}`.toLowerCase();
    if (bullishSignals.some((s) => combined.includes(s))) return "bullish";
    if (bearishSignals.some((s) => combined.includes(s))) return "bearish";
    return "neutral";
  };

  const openObserver = async () => {
    if (!activeQuadrant || observerState.show) return;

    setObserverState({
      show: true,
      isObserving: true,
      error: null,
      entries: null,
    });

    try {
      const liquidityStatus = liquidity?.status?.toLowerCase() || "unknown";
      const activeAssets = assets.map((a) => ({
        ticker: a.ticker,
        name: a.name,
        change: a.change,
      }));

      const res = await fetch("/api/v1/macro-ai-observer/observe-playbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          regime: currentRegime,
          assets: activeAssets,
          liquidityStatus,
          regimeDescription: regimeData?.description || "",
          context: {
            vix: vix.regime,
            yieldCurve: yieldCurve.curveRegime,
            geoRiskTopDriver: "UNKNOWN",
          },
        }),
      });

      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setObserverState((prev) => ({
          ...prev,
          isObserving: false,
          entries: json.data.map((item: PlaybookEntry) => ({
            ...item,
            bias: inferBias(item.asset, item.desc),
          })),
        }));
      } else {
        setObserverState((prev) => ({
          ...prev,
          isObserving: false,
          entries: [],
        }));
      }
    } catch {
      setObserverState((prev) => ({
        ...prev,
        isObserving: false,
        error: "Gagal memuat observasi AI.",
        entries: [],
      }));
    }
  };

   return (
    <div className="flex flex-col h-full glass border border-border-subtle rounded-xl p-3 relative overflow-hidden">
      <div className="flex items-center justify-between mb-3 z-10 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Activity className="w-3.5 h-3.5 text-accent-gold flex-shrink-0" />
          <h2 className="font-bold text-text-primary uppercase tracking-wider text-[10px] sm:text-xs whitespace-nowrap">
            Macro Regime Matrix SSOT
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border whitespace-nowrap ${regimeData ? 'text-data-profit border-data-profit/30 bg-data-profit/10' : 'border-border-subtle bg-surface-elevated/50 text-text-muted'}`}>
            {regimeData ? "LIVE" : "LOADING..."}
          </span>
        </div>
      </div>

      <div className="flex flex-row gap-3 flex-grow min-h-0">
        <div className="grid grid-cols-2 gap-2 w-1/2">
          {[
            "goldilocks",
            "reflation",
            "stagflation",
            "deflation",
            "transition",
          ].map((q) => {
            const qCfg = QUADRANT_CONFIG[q as string];
            const isActive = activeQuadrant === q;

            return (
              <div
                key={q}
                className={`flex items-center justify-center rounded-lg border p-2 transition-all duration-200 ${
                  isActive ? "cursor-pointer" : "cursor-default"
                }`}
                style={{
                  backgroundColor: isActive ? qCfg.color + "18" : "#0a0a0a",
                  borderColor: isActive ? qCfg.color + "80" : "#262626",
                  boxShadow: isActive ? `0 0 12px ${qCfg.color}30` : "none",
                }}
                onClick={() => {
                  if (
                    isActive &&
                    !observerState.show &&
                    !observerState.isObserving
                  ) {
                    openObserver();
                  }
                }}
              >
                <span
                  className="text-[10px] font-bold font-mono uppercase tracking-wider"
                  style={{ color: isActive ? qCfg.color : "#a1a1aa" }}
                >
                  {qCfg.title}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col justify-center w-1/2 p-2 mt-1 gap-2">
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-text-muted font-mono text-[10px] tracking-widest uppercase">
              Active Regime
            </span>
          </div>
          {cfg && (
            <>
              <span
                className="text-3xl font-black font-mono uppercase tracking-tight"
                style={{ color: cfg.color }}
              >
                {cfg.title}
              </span>
              <p className="text-xs text-text-secondary leading-relaxed font-mono">
                {regimeData?.description || `${cfg.title} — Loading...`}
              </p>
            </>
          )}
          <div className="grid grid-cols-2 gap-2">
            <MetricStrip
              label="Growth"
              value={`${regimeData?.growth.current.toFixed(4) ?? "—"} / ${regimeData?.growth.ema50.toFixed(4) ?? "EMA"}`}
              status={regimeData?.growth.status ?? "N/A"}
              roc5d={regimeData?.growth.roc5d}
              subScores={regimeData?.growth.subScores}
              color={
                regimeData?.growth.status === "ACCELERATING" || regimeData?.growth.status === "TURNING"
                  ? "#22c55e"
                  : regimeData?.growth.status === "DECELERATING"
                    ? "#ef4444"
                    : "#94a3b8"
              }
            />
            <MetricStrip
              label="Inflation"
              value={`${regimeData?.inflation.current.toFixed(4) ?? "—"} / ${regimeData?.inflation.ema50.toFixed(4) ?? "EMA"}`}
              status={`${regimeData?.inflation.status ?? "N/A"}`}
              pressure={regimeData?.inflation.pressure ?? "N/A"}
              roc5d={regimeData?.inflation.roc5d}
              subScores={regimeData?.inflation.subScores}
              color={
                regimeData?.inflation.pressure === "HOT"
                  ? "#ef4444"
                  : regimeData?.inflation.pressure === "COLD"
                    ? "#22c55e"
                    : regimeData?.inflation.status === "ACCELERATING" || regimeData?.inflation.status === "TURNING"
                      ? "#ef4444"
                      : regimeData?.inflation.status === "DECELERATING"
                        ? "#22c55e"
                        : "#94a3b8"
              }
            />
            <MetricStrip
              label="Liquidity Risk"
              value={
                regimeData?.liquidity.riskState ?? liquidity?.status ?? "N/A"
              }
              status={regimeData?.liquidity.status ?? "N/A"}
              roc5d={regimeData?.liquidity.roc5d}
              color={
                regimeData?.liquidity.riskState === "STRESSED"
                  ? "#ef4444"
                  : "#22c55e"
              }
            />
            <MetricStrip
              label="Confidence"
              value={`${confidenceScore}%`}
              status={regimeData?.confidence?.label ?? (shift ? "SHIFTED" : "STABLE")}
              color={
                regimeData?.confidence?.label === "VERY HIGH" ? "#f59e0b" :
                regimeData?.confidence?.label === "HIGH" ? "#22c55e" :
                regimeData?.confidence?.label === "MODERATE" ? "#eab308" :
                "#ef4444"
              }
            />
          </div>
          {shift && (
            <div className="flex items-center gap-2 rounded border border-accent-gold/20 bg-accent-gold/5 p-2 text-[10px] font-mono text-text-muted">
              <Shield className="w-3 h-3 text-accent-gold" />
              Last shift: {shift.from} → {shift.to} · {shift.date}
            </div>
          )}
        </div>
      </div>

      {observerState.show && activeQuadrant && cfg && (
        <ObserverModal
          show={observerState.show}
          cfg={cfg}
          entries={observerState.entries}
          error={observerState.error}
          isObserving={observerState.isObserving}
          onClose={() => setObserverState((prev) => ({ ...prev, show: false }))}
          onRetry={openObserver}
        />
      )}
    </div>
  );
}
