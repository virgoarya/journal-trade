"use client";

import React, { useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { useMacroTerminal } from "./MacroTerminalContext";
import { X, Activity } from "lucide-react";

const QUADRANT_CONFIG: Record<string, { title: string; desc: string; color: string }> = {
  goldilocks: { title: "GOLDILOCKS", desc: "Growth / Inflation", color: "#10B981" },
  reflation: { title: "REFLATION", desc: "Growth / Inflation", color: "#3B82F6" },
  stagflation: { title: "STAGFLATION", desc: "Growth / Inflation", color: "#F59E0B" },
  deflation: { title: "DEFLATION", desc: "Growth / Inflation", color: "#94A3B8" },
  transition: { title: "TRANSITION", desc: "Growth / Inflation", color: "#8B5CF6" },
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
    if (bias === "bullish") return <Activity className="w-3 h-3 text-data-profit" />;
    if (bias === "bearish") return <Activity className="w-3 h-3 text-data-loss" />;
    return <Activity className="w-3 h-3 text-text-muted" />;
  };

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-xl border glass overflow-hidden"
        style={{ backgroundColor: "#0a0a0a", borderColor: cfg.color + "40" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg" style={{ backgroundColor: cfg.color + "20" }}>
              <Activity className="w-4 h-4" style={{ color: cfg.color }} />
            </div>
            <div>
              <span className="text-xs font-mono font-bold uppercase tracking-widest" style={{ color: cfg.color }}>
                AI Observer / {cfg.title}
              </span>
              <p className="text-[9px] text-text-muted font-mono mt-0.5">
                Structural asset allocation based on current regime & liquidity
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
              <button onClick={onRetry} className="mt-3 text-[10px] text-accent-gold font-mono hover:underline">
                Coba lagi
              </button>
            </div>
          ) : !entries || entries.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-text-muted text-[10px] font-mono">
                Tidak ada structural edge yang terdeteksi untuk regime ini.
              </p>
              <p className="text-neutral-600 text-[9px] font-mono mt-1">
                AI tidak menemukan aset dengan confidence cukup tinggi untuk direkomendasikan.
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
                      <span className="text-[11px] font-mono font-bold tracking-tight" style={{ color: cfg.color }}>
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
                  <p className="text-[10px] text-text-secondary leading-relaxed font-mono">{entry.desc}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-3 border-t border-neutral-800 shrink-0 flex items-center justify-between">
          <span className="text-[9px] text-text-muted font-mono">
            Generated by Hunter Desk AI · Not financial advice
          </span>
          <button onClick={onClose} className="text-[10px] text-text-muted font-mono hover:text-white transition-colors">
            Close [ESC]
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function MacroRegimePanel() {
  const { currentRegime, regimeData, assets, liquidity } = useMacroTerminal();
  const [observerState, setObserverState] = useState({
    show: false,
    isObserving: false,
    error: null as string | null,
    entries: null as PlaybookEntry[] | null,
  });

  const activeQuadrant = useMemo(() => {
    if (!currentRegime) return "";
    return ["goldilocks", "reflation", "stagflation", "deflation", "transition"].includes(
      currentRegime.toLowerCase()
    )
      ? currentRegime.toLowerCase()
      : "";
  }, [currentRegime]);

  const hasRegime = !!activeQuadrant && activeQuadrant !== "transition";
  const cfg = activeQuadrant ? QUADRANT_CONFIG[activeQuadrant] : null;

  const inferBias = (asset: string, desc: string): "bullish" | "bearish" | "neutral" => {
    const bullishSignals = ["bullish", "long", "buy", "strong", "positive", "naik", "menguat", "rebound", "recovery", "expansion"];
    const bearishSignals = ["bearish", "short", "sell", "weak", "negative", "turun", "melemah", "crash", "fear", "drain", "stress"];

    const combined = `${asset} ${desc}`.toLowerCase();
    if (bullishSignals.some((s) => combined.includes(s))) return "bullish";
    if (bearishSignals.some((s) => combined.includes(s))) return "bearish";
    return "neutral";
  };

  const openObserver = async () => {
    if (!activeQuadrant || observerState.show) return;

    setObserverState({ show: true, isObserving: true, error: null, entries: null });

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
        setObserverState((prev) => ({ ...prev, isObserving: false, entries: [] }));
      }
    } catch (e) {
      setObserverState((prev) => ({
        ...prev,
        isObserving: false,
        error: "Gagal memuat observasi AI.",
        entries: [],
      }));
    }
  };

  return (
    <div className="flex flex-col h-full glass border border-border-subtle rounded-xl p-3 relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 z-10 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Activity className="w-3.5 h-3.5 text-accent-gold flex-shrink-0" />
          <h2 className="font-bold text-text-primary uppercase tracking-wider text-[10px] sm:text-xs whitespace-nowrap">
            Macro Regime Matrix
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-text-muted font-mono bg-surface-elevated/50 px-1.5 py-0.5 rounded border border-border-subtle whitespace-nowrap">
            LIVE
          </span>
        </div>
      </div>

      {/* Main Content: 2 Columns */}
      <div className="flex flex-row gap-4 flex-grow min-h-0">
        {/* Left Half: Regime Grid */}
        <div className="grid grid-cols-2 gap-2 w-1/2">
          {(["goldilocks", "reflation", "stagflation", "deflation", "transition"] as const).map((q) => {
            const qCfg = QUADRANT_CONFIG[q];
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
                  if (isActive && !observerState.show && !observerState.isObserving) {
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

        {/* Right Half: Active Regime Panel */}
        <div className="flex flex-col justify-center w-1/2 p-2 mt-2">
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-text-muted font-mono text-[9px] tracking-widest uppercase">Active Regime</span>
          </div>
          {cfg && (
            <>
              <span className="text-2xl font-black font-mono uppercase tracking-tight mb-2" style={{ color: cfg.color }}>
                {cfg.title}
              </span>
              <p className="text-[10px] text-text-secondary leading-relaxed font-mono">
                {regimeData?.description || `${cfg.title} — Loading...`}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[9px] text-text-muted font-mono">Assets:</span>
                <div className="flex flex-wrap gap-1">
                  {assets.slice(0, 4).map((a) => (
                    <span
                      key={a.ticker}
                      className={`text-[8px] font-mono px-1.5 py-0.5 rounded border ${
                        a.change && a.change > 0
                          ? "border-data-profit/30 text-data-profit"
                          : a.change && a.change < 0
                          ? "border-data-loss/30 text-data-loss"
                          : "border-neutral-700 text-text-muted"
                      }`}
                    >
                      {a.ticker} {a.change !== null ? `${a.change > 0 ? "+" : ""}${a.change.toFixed(1)}%` : "—"}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* AI Observer Modal - rendered via portal */}
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