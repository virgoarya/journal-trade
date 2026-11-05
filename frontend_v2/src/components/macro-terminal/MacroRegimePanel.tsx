"use client";

import React, { useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { useMacroTerminal } from "./MacroTerminalContext";
import { X, Activity, Shield, Clock } from "lucide-react";
import { RegimeHistoryTimeline } from "./RegimeHistoryTimeline";

const QUADRANT_CONFIG: Record<
  string,
  { title: string; desc: string; growth: string; inflation: string; color: string; longDesc: string }
> = {
  goldilocks: { title: "GOLDILOCKS", desc: "Growth↑ / Inflasi↓", growth: "Growth ↑", inflation: "Inflasi ↓", color: "#22c55e", longDesc: "Pertumbuhan Kuat, Inflasi Stabil. Lingkungan ideal untuk ekuitas dan aset berisiko." },
  reflation: { title: "REFLATION", desc: "Growth↑ / Inflasi↑", growth: "Growth ↑", inflation: "Inflasi ↑", color: "#3b82f6", longDesc: "Pertumbuhan Meningkat, Inflasi Meningkat. Aset komoditas dan siklikal sering berkinerja baik." },
  stagflation: { title: "STAGFLATION", desc: "Growth↓ / Inflasi↑", growth: "Growth ↓", inflation: "Inflasi ↑", color: "#f59e0b", longDesc: "Pertumbuhan Lambat, Inflasi Tinggi. Periode sulit dengan tekanan pada profitabilitas." },
  deflation: { title: "DEFLATION", desc: "Growth↓ / Inflasi↓", growth: "Growth ↓", inflation: "Inflasi ↓", color: "#94a3b8", longDesc: "Pertumbuhan Lambat, Inflasi Menurun/Negatif. Obligasi pemerintah cenderung diuntungkan." },
  transition: { title: "TRANSITION", desc: "Uncertain / Shifting", growth: "Mixed", inflation: "Mixed", color: "#8b5cf6", longDesc: "Periode ketidakpastian saat pasar beralih antar rezim. Volatilitas tinggi." },
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }} onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-xl border glass overflow-hidden" style={{ backgroundColor: "#0a0a0a", borderColor: cfg.color + "40" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: cfg.color + "20" }}>
              <Activity className="w-5 h-5" style={{ color: cfg.color }} />
            </div>
            <div>
              <span className="text-xs font-mono font-bold uppercase tracking-widest" style={{ color: cfg.color }}>AI Observer / {cfg.title}</span>
              <p className="text-[10px] text-text-muted font-mono mt-0.5">Alokasi aset struktural berdasarkan rezim, likuiditas, VIX, dan kurva imbal hasil.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-white p-2 rounded-lg hover:bg-neutral-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {isObserving ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-10 h-10 border-2 border-neutral-700 border-t-accent-gold rounded-full animate-spin" />
              <span className="text-[11px] text-text-muted font-mono animate-pulse">Hunter AI sedang mengobservasi struktur aset di regime ini...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-data-loss text-sm font-mono">{error}</p>
              <button onClick={onRetry} className="mt-4 text-xs text-accent-gold font-mono hover:underline">Coba Lagi</button>
            </div>
          ) : !entries || entries.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-text-muted text-sm font-mono">Tidak ada structural edge yang terdeteksi untuk regime ini.</p>
              <p className="text-[10px] text-text-muted/60 font-mono mt-2">Perdagangkan hanya apa yang Anda lihat, bukan apa yang Anda inginkan.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {entries.map((entry, idx) => (
                <div key={idx} className="p-4 rounded-lg border border-neutral-800 bg-neutral-900/40 hover:border-neutral-700 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-bold tracking-tight" style={{ color: cfg.color }}>{entry.asset}</span>
                      {getBiasIcon(entry.bias)}
                    </div>
                    {entry.bias && (
                      <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded ${entry.bias === "bullish" ? "bg-data-profit/10 text-data-profit border border-data-profit/20" : entry.bias === "bearish" ? "bg-data-loss/10 text-data-loss border border-data-loss/20" : "bg-neutral-800 text-text-muted border border-neutral-700"}`}>
                        {entry.bias}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-text-secondary leading-relaxed font-mono break-words">{entry.desc}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-4 border-t border-neutral-800 shrink-0 flex items-center justify-between">
          <span className="text-[10px] text-text-muted font-mono">Generated by Hunter Desk AI · Not financial advice</span>
          <button onClick={onClose} className="text-[11px] text-text-muted font-mono hover:text-white transition-colors">Tutup [ESC]</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function MetricStrip({
  label,
  value,
  curValue,
  baselineValue,
  baselineLabel = "EMA",
  status,
  color,
  roc5d,
  subScores,
  pressure,
  gaugeScore,
  gaugeColor,
}: {
  label: string;
  value?: string;
  curValue?: number | string;
  baselineValue?: number | string;
  baselineLabel?: string;
  status: string;
  color: string;
  roc5d?: number;
  subScores?: Record<string, { ratio?: number; value?: number | null; status: string }>;
  pressure?: string;
  gaugeScore?: number;
  gaugeColor?: string;
}) {
  const hasSubScores = subScores && Object.keys(subScores).length > 0;
  const hasGauge = gaugeScore !== undefined;

  const getStatusColor = (s: string) => {
    if (s.includes("ACCELERATING")) return "#22c55e";
    if (s.includes("DECELERATING")) return "#ef4444";
    if (s.includes("TURNING")) return "#eab308";
    if (s.includes("HOT")) return "#ef4444";
    if (s.includes("COLD")) return "#22c55e";
    if (s.includes("DRAINING") || s.includes("STRESSED")) return "#ef4444";
    if (s.includes("INJECTING")) return "#22c55e";
    return "#94a3b8";
  };

  return (
    <div className="rounded-lg border border-border-subtle bg-bg-elevated/35 min-w-0 flex flex-col transition-all overflow-hidden">
      <div className="p-2 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-text-muted font-mono uppercase tracking-widest font-semibold">{label}</span>
            {roc5d !== undefined && roc5d !== 0 && (
              <span className={`text-[10px] font-mono font-bold ${roc5d > 0 ? 'text-data-profit' : 'text-data-loss'}`}>
                {roc5d > 0 ? '▲' : '▼'} {Math.abs(roc5d).toFixed(2)}%
              </span>
            )}
          </div>

          {/* Dual value format with explicit micro-labels */}
          {curValue !== undefined && baselineValue !== undefined ? (
            <div className="flex items-baseline flex-wrap gap-1 font-mono">
              <div className="flex items-baseline gap-1">
                <span className="text-xs sm:text-sm font-bold text-text-primary tabular-nums tracking-tight">
                  {typeof curValue === "number" ? curValue.toFixed(4) : curValue}
                </span>
                <span className="text-[7px] text-text-muted font-bold px-1 py-0.2 rounded bg-white/5 border border-white/10">CUR</span>
              </div>
              <span className="text-text-muted/40 text-xs">/</span>
              <div className="flex items-baseline gap-1">
                <span className="text-xs sm:text-sm font-medium text-text-secondary tabular-nums">
                  {typeof baselineValue === "number" ? baselineValue.toFixed(4) : baselineValue}
                </span>
                <span className="text-[7px] text-text-muted font-medium px-1 py-0.2 rounded bg-white/5 border border-white/10">{baselineLabel}</span>
              </div>
            </div>
          ) : (
            <div className="text-xs sm:text-sm font-mono font-bold text-text-primary leading-tight break-all tabular-nums" title={value}>
              {value}
            </div>
          )}
        </div>

        {/* Progress Bar / Gauge Meter if specified */}
        {hasGauge && (
          <div className="mt-2 w-full space-y-0.5">
            <div className="h-1.5 w-full bg-neutral-900 rounded-full overflow-hidden border border-white/5">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, Math.max(0, gaugeScore))}%`,
                  backgroundColor: gaugeColor || color,
                  boxShadow: `0 0 6px ${(gaugeColor || color)}60`,
                }}
              />
            </div>
          </div>
        )}

        <div className="mt-1.5 flex items-center justify-between">
          <span
            className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border inline-block ${status === 'TURNING' ? 'animate-pulse' : ''}`}
            style={{ color, borderColor: `${color}40`, backgroundColor: `${color}12` }}
          >
            {status}{pressure ? ` · ${pressure}` : ''}
          </span>
        </div>
      </div>

      {/* Sub-metrics list with clean alignment & fixed-width badge */}
      {hasSubScores && (
        <div className="border-t border-white/5 bg-black/30 text-[10px] font-mono divide-y divide-white/5">
          {Object.entries(subScores).map(([key, data]) => {
            const statusColor = getStatusColor(data.status);
            // Institutional label format with Leading/Lagging indicator tags
            const labelMap: Record<string, string> = {
              tipIef: 'TIP/IEF (10Y BE PROXY)',
              cpiYoY: 'CPI YOY (LAGGING ANCHOR)',
              gldUup: 'GLD/UUP (COMMODITY/FX)',
              xlyXlp: 'XLY/XLP (CONS. DISCR)',
              iwmTlt: 'IWM/TLT (SM-CAP/BONDS)',
              xliXlu: 'XLI/XLU (IND/UTIL)',
            };
            const displayLabel = labelMap[key] || key.replace(/([A-Z])/g, ' $1').trim().toUpperCase();

            return (
              <div key={key} className="flex justify-between items-center py-1.5 px-2 hover:bg-white/[0.02] transition-colors">
                <span className="truncate flex-1 text-text-secondary font-semibold text-[9px] tracking-wide">
                  {displayLabel}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-text-primary font-mono tabular-nums text-[9px]">
                    {data.ratio !== undefined
                      ? data.ratio.toFixed(4)
                      : data.value !== null && data.value !== undefined
                      ? data.value.toFixed(2) + '%'
                      : 'N/A'}
                  </span>
                  <span
                    className="w-28 text-center px-1.5 py-0.5 rounded font-mono font-bold text-[8px] border shrink-0 flex items-center justify-center gap-1"
                    style={{
                      color: statusColor,
                      borderColor: `${statusColor}30`,
                      backgroundColor: `${statusColor}15`,
                    }}
                  >
                    <span>
                      {data.status.includes('ACCEL') || data.status.includes('HOT') || data.status.includes('BULLISH') || data.status.includes('EXPANSION')
                        ? '▲'
                        : data.status.includes('DECEL') || data.status.includes('COLD') || data.status.includes('BEARISH') || data.status.includes('CONTRACTION')
                        ? '▼'
                        : '▶'}
                    </span>
                    <span>{data.status}</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function lastShift(history: Array<{ date: string; quadrant: string }> | undefined, current: string) {
  if (!history?.length) return null;
  for (let i = history.length - 2; i >= 0; i -= 1) {
    if (history[i].quadrant !== current) {
      return { from: history[i].quadrant, to: history[i + 1]?.quadrant ?? current, date: history[i + 1]?.date ?? history[i].date };
    }
  }
  return null;
}

export function MacroRegimePanel({ className }: { className?: string }) {
  const { currentRegime, regimeData, assets, liquidity, dataStatus, vix, yieldCurve } = useMacroTerminal();
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
    return ["goldilocks", "reflation", "stagflation", "deflation", "transition"].includes(regime) ? regime : "";
  }, [regimeData?.quadrant, currentRegime]);

  const hasRegime = !!activeQuadrant;
  const cfg = activeQuadrant ? QUADRANT_CONFIG[activeQuadrant] : null;
  const shift = lastShift(regimeData?.history, currentRegime ?? "");
  const confidenceScore = regimeData?.confidence?.score ?? 0;

  const openObserver = async () => {
    if (!cfg || !activeQuadrant) return;
    setObserverState((prev) => ({ ...prev, show: true, isObserving: true, error: null }));
    try {
      const token = localStorage.getItem("token") || "";
      const regimeName = cfg.title.charAt(0).toUpperCase() + cfg.title.slice(1).toLowerCase();
      
      const payload = {
        regime: regimeName,
        assets: assets.map(a => ({ ticker: a.ticker, name: a.name, change: a.change })),
        liquidityStatus: liquidity?.status || "NEUTRAL",
        regimeDescription: cfg.desc,
        context: {
          vix: vix?.value ? vix.value.toString() : undefined,
          yieldCurve: yieldCurve?.spread10y2y ? yieldCurve.spread10y2y.toString() : undefined,
        }
      };

      const res = await fetch("/api/v1/macro-ai-observer/observe-playbook", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || json.message || "API error");
      }
      setObserverState((prev) => ({ ...prev, isObserving: false, entries: json.data }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal mengambil data observer";
      setObserverState((prev) => ({ ...prev, isObserving: false, error: msg }));
    }
  };

  return (
    <div className={`flex flex-col w-full glass overflow-hidden relative ${className ?? ""}`}>
      <div className="flex items-center justify-between border-b border-border-subtle p-2">
        <div className="flex items-center gap-2 min-w-0">
          <Activity size={14} className="text-accent-gold flex-shrink-0" />
          <h2 className="font-bold text-text-primary uppercase tracking-wider text-[11px] sm:text-xs whitespace-nowrap">Macro Regime Matrix SSOT</h2>
        </div>
        <div className="flex items-center gap-2">
          {dataStatus.regime === "stale" || dataStatus.regime === "error" ? (
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

      {/* 2x2 Matrix Visualizer — Sumbu X: Growth, Sumbu Y: Inflation */}
      <div className="shrink-0 px-3 pt-3 pb-2">
        {/* Axis labels */}
        <div className="flex items-center justify-between mb-1 px-0.5">
          <span className="text-[8px] font-mono text-text-muted uppercase tracking-widest">↓ Inflasi</span>
          <span className="text-[8px] font-mono text-text-muted uppercase tracking-widest">Growth →</span>
        </div>
        {/* 2x2 Grid: [deflation, goldilocks] / [stagflation, reflation] */}
        <div className="grid grid-cols-2 gap-1.5 relative">
          {/* Trajectory Vector overlay — SVG arrow pointing to highest-prob target quadrant */}
          {regimeData?.vector && regimeData.vector.magnitude > 0.08 && (() => {
            // Determine highest-probability target quadrant for enhanced arrow color
            const probs = regimeData.probabilities;
            const targetColor = probs
              ? probs.goldilocks >= probs.reflation && probs.goldilocks >= probs.stagflation && probs.goldilocks >= probs.deflation
                ? QUADRANT_CONFIG.goldilocks.color
                : probs.reflation >= probs.stagflation && probs.reflation >= probs.deflation
                ? QUADRANT_CONFIG.reflation.color
                : probs.stagflation >= probs.deflation
                ? QUADRANT_CONFIG.stagflation.color
                : QUADRANT_CONFIG.deflation.color
              : '#eab308';

            // Quadrant center coords in SVG 200x200 space: [deflation, goldilocks] / [stagflation, reflation]
            const quadrantCenters: Record<string, { x: number; y: number }> = {
              goldilocks:  { x: 150, y:  50 },
              deflation:   { x:  50, y:  50 },
              stagflation: { x:  50, y: 150 },
              reflation:   { x: 150, y: 150 },
            };

            // Highest probability non-transition quadrant
            const highestQ = probs
              ? (['goldilocks', 'reflation', 'stagflation', 'deflation'] as const).reduce((a, b) =>
                  (probs[a] ?? 0) >= (probs[b] ?? 0) ? a : b)
              : regimeData.vector.targetQuadrant?.toLowerCase() || 'reflation';
            const targetCenter = quadrantCenters[highestQ] || { x: 100 + regimeData.vector.x * 70, y: 100 - regimeData.vector.y * 70 };

            return (
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none z-10"
                viewBox="0 0 200 200"
                preserveAspectRatio="none"
              >
                <defs>
                  <marker
                    id="vector-arrow"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill={targetColor} />
                  </marker>
                  {/* Neon Glow Filter */}
                  <filter id="glow-target" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                {/* Expanding pulse ring at target quadrant center */}
                <circle
                  cx={targetCenter.x}
                  cy={targetCenter.y}
                  r="16"
                  fill="none"
                  stroke={targetColor}
                  strokeWidth="1.2"
                  opacity="0.4"
                >
                  <animate attributeName="r" values="8;20;8" dur="2.2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.6;0.05;0.6" dur="2.2s" repeatCount="indefinite" />
                </circle>
                {/* Secondary inner ring */}
                <circle
                  cx={targetCenter.x}
                  cy={targetCenter.y}
                  r="7"
                  fill="none"
                  stroke={targetColor}
                  strokeWidth="0.8"
                  opacity="0.5"
                />
                {/* Glowing Pulse Dot at target endpoint */}
                <circle
                  cx={targetCenter.x}
                  cy={targetCenter.y}
                  r="4"
                  fill={targetColor}
                  filter="url(#glow-target)"
                >
                  <animate attributeName="r" values="3.5;5;3.5" dur="1.8s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.85;1;0.85" dur="1.8s" repeatCount="indefinite" />
                </circle>
                {/* Trajectory arrow from center to target */}
                <line
                  x1="100"
                  y1="100"
                  x2={targetCenter.x}
                  y2={targetCenter.y}
                  stroke={targetColor}
                  strokeWidth="1.5"
                  strokeDasharray="5 3"
                  markerEnd="url(#vector-arrow)"
                  opacity="0.8"
                />
                {/* Current position origin dot */}
                <circle cx="100" cy="100" r="3" fill={targetColor} opacity="0.8">
                  <animate attributeName="opacity" values="0.8;0.3;0.8" dur="1.5s" repeatCount="indefinite" />
                </circle>
              </svg>
            );
          })()}
          {[
            ["deflation", "goldilocks"],
            ["stagflation", "reflation"],
          ].map((row, ri) =>
            row.map((q) => {
              const qCfg = QUADRANT_CONFIG[q];
              const isActive = activeQuadrant === q;
              return (
                <div
                  key={q}
                  className={`group relative flex flex-col items-center justify-center rounded-lg border py-2.5 px-2 text-center transition-all ${isActive ? "cursor-pointer" : "cursor-default opacity-65 hover:opacity-85 duration-200"}`}
                  style={{
                    backgroundColor: isActive ? qCfg.color + "18" : "#070707",
                    borderColor: isActive ? qCfg.color + "70" : "#262626",
                    boxShadow: isActive ? `0 0 12px ${qCfg.color}25` : "none",
                  }}
                  onClick={() => { if (isActive && !observerState.show && !observerState.isObserving) openObserver(); }}
                >
                  {/* Glowing dot for active */}
                  {isActive && (
                    <span
                      className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full animate-pulse"
                      style={{ backgroundColor: qCfg.color, boxShadow: `0 0 6px ${qCfg.color}` }}
                    />
                  )}
                  <span
                    className="text-[10px] sm:text-[11px] font-black font-mono uppercase tracking-wider leading-tight"
                    style={{ color: isActive ? qCfg.color : "#737373", textShadow: isActive ? `0 0 8px ${qCfg.color}70` : "none" }}
                  >
                    {qCfg.title}
                  </span>
                  <span className="text-[8px] font-mono mt-0.5" style={{ color: isActive ? qCfg.color + "aa" : "#525252" }}>
                    {ri === 0 ? "Inflasi↓" : "Inflasi↑"} · {q === "deflation" || q === "stagflation" ? "Growth↓" : "Growth↑"}
                  </span>
                </div>
              );
            })
          )}
        </div>
        {/* TRANSITION badge — full width beneath */}
        {(() => {
          const q = "transition";
          const qCfg = QUADRANT_CONFIG[q];
          const isActive = activeQuadrant === q;
          return (
            <div
              className={`relative flex items-center justify-center rounded-lg border py-1.5 mt-1.5 transition-all ${isActive ? "cursor-pointer" : "cursor-default opacity-40 duration-200"}`}
              style={{
                backgroundColor: isActive ? qCfg.color + "15" : "#050505",
                borderColor: isActive ? qCfg.color + "60" : "#1f1f1f",
                boxShadow: isActive ? `0 0 10px ${qCfg.color}20` : "none",
              }}
              onClick={() => { if (isActive && !observerState.show && !observerState.isObserving) openObserver(); }}
            >
              {isActive && (
                <span
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: qCfg.color, boxShadow: `0 0 6px ${qCfg.color}` }}
                />
              )}
              <span
                className="text-[10px] font-black font-mono uppercase tracking-widest"
                style={{ color: isActive ? qCfg.color : "#3a3a3a", textShadow: isActive ? `0 0 8px ${qCfg.color}70` : "none" }}
              >
                ⟁ TRANSITION — Uncertain / Shifting
              </span>
            </div>
          );
        })()}
      </div>

      {/* Divergence Badge (Early Warning) */}
              {regimeData?.probabilities?.divergenceBadge && (
                <div className="px-3 mt-1.5 flex items-center gap-2">
                  <span className="text-[9px] font-mono text-data-loss uppercase tracking-widest bg-data-loss/10 border border-data-loss/20 px-2 py-0.5 rounded">
                    ⚠ {regimeData.probabilities.divergenceBadge}
                  </span>
                  <span className="text-[9px] font-mono text-text-muted flex-1">
                    Prob: G {regimeData.probabilities.goldilocks}% · R {regimeData.probabilities.reflation}% · S {regimeData.probabilities.stagflation}% · D {regimeData.probabilities.deflation}% · T {regimeData.probabilities.transition}%
                  </span>
                </div>
              )}

              {/* Markov Probability Mini Bars */}
              {regimeData?.probabilities && (
                <div className="px-3 mt-1.5 grid grid-cols-2 gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[8px] font-mono text-text-muted w-14">GOLD</span>
                    <div className="flex-1 h-1.5 bg-neutral-800 rounded overflow-hidden">
                      <div
                        className="h-full rounded bg-green-500/80 transition-all"
                        style={{ width: `${regimeData.probabilities.goldilocks}%` }}
                      />
                    </div>
                    <span className="text-[8px] font-mono text-text-muted w-8 text-right">{regimeData.probabilities.goldilocks}%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[8px] font-mono text-text-muted w-14">REFL</span>
                    <div className="flex-1 h-1.5 bg-neutral-800 rounded overflow-hidden">
                      <div
                        className="h-full rounded bg-blue-500/80 transition-all"
                        style={{ width: `${regimeData.probabilities.reflation}%` }}
                      />
                    </div>
                    <span className="text-[8px] font-mono text-text-muted w-8 text-right">{regimeData.probabilities.reflation}%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[8px] font-mono text-text-muted w-14">STAG</span>
                    <div className="flex-1 h-1.5 bg-neutral-800 rounded overflow-hidden">
                      <div
                        className="h-full rounded bg-amber-500/80 transition-all"
                        style={{ width: `${regimeData.probabilities.stagflation}%` }}
                      />
                    </div>
                    <span className="text-[8px] font-mono text-text-muted w-8 text-right">{regimeData.probabilities.stagflation}%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[8px] font-mono text-text-muted w-14">DEFL</span>
                    <div className="flex-1 h-1.5 bg-neutral-800 rounded overflow-hidden">
                      <div
                        className="h-full rounded bg-slate-500/80 transition-all"
                        style={{ width: `${regimeData.probabilities.deflation}%` }}
                      />
                    </div>
                    <span className="text-[8px] font-mono text-text-muted w-8 text-right">{regimeData.probabilities.deflation}%</span>
                  </div>
                </div>
              )}

              <div className="flex-1 p-2 border-t border-border-subtle">
        {!hasRegime ? (
          <div className="flex flex-col items-center justify-center gap-2 text-text-muted text-[9px] font-mono py-4">
            {dataStatus.regime === 'error' ? (
              <>
                <span className="text-data-loss text-[10px]">⚠ Gagal memuat data regime.</span>
                <button onClick={() => window.location.reload()} className="text-accent-gold hover:underline text-[9px]">REFRESH</button>
              </>
            ) : (
              <>
                <div className="w-4 h-4 border-2 border-accent-gold/30 border-t-accent-gold rounded-full animate-spin" />
                <span className="text-[9px]">Mengambil data macro regime...</span>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-baseline mb-1.5">
              <span className="text-text-muted font-mono text-[9px] uppercase tracking-widest">Regime Aktif</span>
            </div>
            {cfg && (
              <span className="text-xl font-black font-mono uppercase tracking-tight leading-none" style={{ color: cfg.color }}>{cfg.title}</span>
            )}
            <div className="grid grid-cols-2 gap-2 mt-2">
              <MetricStrip
                label="Growth"
                curValue={regimeData?.growth.current}
                baselineValue={regimeData?.growth.ema50}
                baselineLabel="EMA50"
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
                curValue={regimeData?.inflation.current}
                baselineValue={regimeData?.inflation.ema50}
                baselineLabel="EMA50"
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
                value={regimeData?.liquidity.riskState ?? liquidity?.status ?? "N/A"}
                status={regimeData?.liquidity.riskState === "STRESSED" ? "DRAINING" : "INJECTING"}
                roc5d={regimeData?.liquidity.roc5d}
                color={regimeData?.liquidity.riskState === "STRESSED" ? "#ef4444" : "#22c55e"}
                gaugeScore={regimeData?.liquidity.riskState === "STRESSED" ? 25 : 80}
                gaugeColor={regimeData?.liquidity.riskState === "STRESSED" ? "#ef4444" : "#22c55e"}
              />
              <MetricStrip
                label="Confidence"
                value={`${confidenceScore}% · ${regimeData?.confidence?.label ?? (shift ? "SHIFTED" : "STABLE")}`}
                status={regimeData?.confidence?.label ?? (shift ? "SHIFTED" : "STABLE")}
                color={
                  confidenceScore >= 70
                    ? "#22c55e"
                    : confidenceScore >= 30
                    ? "#f59e0b"
                    : "#ef4444"
                }
                gaugeScore={confidenceScore}
                gaugeColor={
                  confidenceScore >= 70
                    ? "#22c55e"
                    : confidenceScore >= 30
                    ? "#f59e0b"
                    : "#ef4444"
                }
              />
            </div>

          </>
        )}
      </div>

      {/* Regime History Trail */}
      {hasRegime && currentRegime && (
        <RegimeHistoryTimeline
          history={regimeData?.history}
          currentRegime={currentRegime.toLowerCase()}
        />
      )}
      {observerState.show && activeQuadrant && cfg && (
        <ObserverModal show={observerState.show} cfg={cfg} entries={observerState.entries} error={observerState.error} isObserving={observerState.isObserving} onClose={() => setObserverState((prev) => ({ ...prev, show: false }))} onRetry={openObserver} />
      )}
    </div>
  );
}