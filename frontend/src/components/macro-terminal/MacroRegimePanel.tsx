"use client";

import React, { useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { useMacroTerminal } from "./MacroTerminalContext";
import { X, Activity, Shield, Clock } from "lucide-react";
import { RegimeHistoryTimeline } from "./RegimeHistoryTimeline";

const QUADRANT_CONFIG: Record<
  string,
  { title: string; desc: string; color: string; longDesc: string }
> = {
  goldilocks: { title: "GOLDILOCKS", desc: "Growth↑ / Inflasi↓", color: "#22c55e", longDesc: "Pertumbuhan Kuat, Inflasi Stabil. Lingkungan ideal untuk ekuitas dan aset berisiko." },
  reflation: { title: "REFLATION", desc: "Growth↑ / Inflasi↑", color: "#3b82f6", longDesc: "Pertumbuhan Meningkat, Inflasi Meningkat. Aset komoditas dan siklikal sering berkinerja baik." },
  stagflation: { title: "STAGFLATION", desc: "Growth↓ / Inflasi↑", color: "#f59e0b", longDesc: "Pertumbuhan Lambat, Inflasi Tinggi. Periode sulit dengan tekanan pada profitabilitas." },
  deflation: { title: "DEFLATION", desc: "Growth↓ / Inflasi↓", color: "#94a3b8", longDesc: "Pertumbuhan Lambat, Inflasi Menurun/Negatif. Obligasi pemerintah cenderung diuntungkan." },
  transition: { title: "TRANSITION", desc: "Uncertain", color: "#8b5cf6", longDesc: "Periode ketidakpastian saat pasar beralih antar rezim. Volatilitas tinggi." },
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
      <div className="p-1.5 flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] text-text-muted font-mono uppercase tracking-widest">{label}</span>
        </div>
        <div className="flex items-baseline justify-between">
          <div className="text-sm sm:text-base font-mono font-bold text-text-primary leading-tight break-all" title={value}>{value}</div>
          {roc5d !== undefined && roc5d !== 0 && (
            <span className={`text-[10px] font-mono font-bold ${roc5d > 0 ? 'text-data-profit' : 'text-data-loss'}`}>
              {roc5d > 0 ? '▲' : '▼'} {Math.abs(roc5d).toFixed(2)}%
            </span>
          )}
        </div>
        <div className="mt-1">
          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border inline-block ${status === 'TURNING' ? 'animate-pulse' : ''}`} style={{ color, borderColor: `${color}40`, backgroundColor: `${color}12` }}>
            {status}{pressure ? ` · ${pressure}` : ''}
          </span>
        </div>
      </div>
      {hasSubScores && (
        <div className="px-2 pb-2 pt-1.5 border-t border-border-subtle bg-black/20 text-[10px] font-mono space-y-1">
          {Object.entries(subScores).map(([key, data]) => (
            <div key={key} className="flex justify-between items-center text-text-secondary gap-2">
              <span className="truncate flex-1 font-bold">{key.replace(/([A-Z])/g, ' $1').trim().toUpperCase()}</span>
              <div className="flex items-center gap-2">
                <span className="text-text-muted font-medium">
                  {data.ratio !== undefined ? data.ratio.toFixed(4) : data.value !== null && data.value !== undefined ? data.value.toFixed(2) + '%' : 'N/A'}
                </span>
                <span className="px-1.5 py-0.5 rounded font-bold" style={{ color: getStatusColor(data.status), backgroundColor: `${getStatusColor(data.status)}15` }}>
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

      <div className="shrink-0 grid grid-cols-3 gap-2 px-3 pt-3 pb-2">
        {Object.entries(QUADRANT_CONFIG).map(([q, qCfg]) => {
          const isActive = activeQuadrant === q;
          return (
            <div 
              key={q} 
              className={`group flex flex-col items-center justify-center rounded-lg border py-3 px-2 text-center transition-all ${isActive ? "cursor-pointer animate-heartbeat" : "cursor-default duration-200"}`} 
              style={{ 
                backgroundColor: isActive ? qCfg.color + "15" : "#050505", 
                borderColor: isActive ? qCfg.color + "60" : "#262626",
                ...(isActive ? { 
                  '--glow-color': qCfg.color + "40",
                  '--glow-border-dim': qCfg.color + "60",
                  '--glow-border-bright': qCfg.color
                } as React.CSSProperties : {})
              }} 
              onClick={() => { if (isActive && !observerState.show && !observerState.isObserving) openObserver(); }}
            >
              <span className="text-[10px] sm:text-xs font-black font-mono uppercase tracking-wider transition-colors duration-200 leading-tight" style={{ color: isActive ? qCfg.color : "#a1a1aa", textShadow: isActive ? `0 0 10px ${qCfg.color}80` : "none" }}>{qCfg.title}</span>
            </div>
          );
        })}
      </div>

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
            <div className="grid grid-cols-2 gap-1 mt-1.5">
              <MetricStrip label="Growth" value={`${regimeData?.growth.current.toFixed(4) ?? "—"} / ${regimeData?.growth.ema50.toFixed(4) ?? "EMA"}`} status={regimeData?.growth.status ?? "N/A"} roc5d={regimeData?.growth.roc5d} subScores={regimeData?.growth.subScores} color={regimeData?.growth.status === "ACCELERATING" || regimeData?.growth.status === "TURNING" ? "#22c55e" : regimeData?.growth.status === "DECELERATING" ? "#ef4444" : "#94a3b8"} />
              <MetricStrip label="Inflation" value={`${regimeData?.inflation.current.toFixed(4) ?? "—"} / ${regimeData?.inflation.ema50.toFixed(4) ?? "EMA"}`} status={`${regimeData?.inflation.status ?? "N/A"}`} pressure={regimeData?.inflation.pressure ?? "N/A"} roc5d={regimeData?.inflation.roc5d} subScores={regimeData?.inflation.subScores} color={regimeData?.inflation.pressure === "HOT" ? "#ef4444" : regimeData?.inflation.pressure === "COLD" ? "#22c55e" : regimeData?.inflation.status === "ACCELERATING" || regimeData?.inflation.status === "TURNING" ? "#ef4444" : regimeData?.inflation.status === "DECELERATING" ? "#22c55e" : "#94a3b8"} />
              <MetricStrip label="Liquidity Risk" value={regimeData?.liquidity.riskState ?? liquidity?.status ?? "N/A"} status={regimeData?.liquidity.riskState === "STRESSED" ? "DRAINING" : "INJECTING"} roc5d={regimeData?.liquidity.roc5d} color={regimeData?.liquidity.riskState === "STRESSED" ? "#ef4444" : "#22c55e"} />
              <MetricStrip label="Confidence" value={`${confidenceScore}%`} status={regimeData?.confidence?.label ?? (shift ? "SHIFTED" : "STABLE")} color={regimeData?.confidence?.label === "VERY HIGH" ? "#f59e0b" : regimeData?.confidence?.label === "HIGH" ? "#22c55e" : regimeData?.confidence?.label === "MODERATE" ? "#eab308" : "#ef4444"} />
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