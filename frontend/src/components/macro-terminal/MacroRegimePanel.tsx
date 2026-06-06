"use client";

import React, { useMemo, useState } from "react";
import { useMacroTerminal } from "./MacroTerminalContext";
import { X, Play } from "lucide-react";

const QUADRANT_PLAYBOOKS = {
  goldilocks: [
    { asset: "SPY / QQQ", desc: "Korporasi menikmati ekspansi margin karena daya beli kuat." },
    { asset: "BTCUSD", desc: "Likuiditas melimpah beralih ke high-beta assets." }
  ],
  stagflation: [
    { asset: "GLD (Gold)", desc: "Lindung nilai saat fiat terdevaluasi oleh inflasi." },
    { asset: "VIXY (Vol)", desc: "Ketakutan pasar memicu lonjakan volatilitas." },
    { asset: "UUP (USD)", desc: "Modal asing masuk mengamankan yield Dollar." }
  ],
  deflation: [
    { asset: "IEF (10Y)", desc: "Obligasi berkupon tinggi meroket saat suku bunga dipotong." },
    { asset: "UUP (USD)", desc: "Cash is king, likuiditas Dollar dijaga." }
  ],
  reflation: [
    { asset: "SPY (Equities)", desc: "Sektor siklikal untung dari roda ekonomi yang berputar." },
    { asset: "TIP (TIPS)", desc: "Melindungi nilai pokok dari inflasi." },
    { asset: "BTCUSD", desc: "Spekulasi dari ekspansi moneter baru." }
  ],
};

const QUADRANT_CONFIG: Record<string, { title: string; desc: string; color: string }> = {
  goldilocks: { title: "GOLDILOCKS", desc: "Growth / Inflation", color: "#10B981" },
  reflation: { title: "REFLATION", desc: "Growth / Inflation", color: "#3B82F6" },
  stagflation: { title: "STAGFLATION", desc: "Growth / Inflation", color: "#F59E0B" },
  deflation: { title: "DEFLATION", desc: "Growth / Inflation", color: "#94A3B8" },
};

export function MacroRegimePanel() {
  const { currentRegime, lastUpdated, regimeData } = useMacroTerminal();
  const [showPlaybook, setShowPlaybook] = useState(false);

  const activeQuadrant = useMemo(() => {
    if (!currentRegime) return "";
    const q = currentRegime.toLowerCase();
    if (["goldilocks", "reflation", "stagflation", "deflation"].includes(q)) return q;
    return "";
  }, [currentRegime]);

  const hasRegime = !!activeQuadrant;
  const cfg = activeQuadrant ? QUADRANT_CONFIG[activeQuadrant] : null;

  return (
    <div className="flex flex-col h-full bg-[#020202] border border-neutral-800 rounded-xl p-4 overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center mb-4 shrink-0">
        <h2 className="text-neutral-400 font-mono text-xs tracking-widest uppercase">Macro Regime Matrix</h2>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[9px] text-neutral-500 font-mono whitespace-nowrap">
              {new Intl.DateTimeFormat('en-US', {
                month: 'short', day: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit',
                hour12: false, timeZone: 'Asia/Jakarta'
              }).format(lastUpdated)} WIB
            </span>
          )}
          {hasRegime && (
            <span className="text-green-500 text-[10px] font-mono flex items-center gap-1.5 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              LIVE
            </span>
          )}
        </div>
      </div>

      {/* Main Content: 2 Columns */}
      <div className="flex flex-row gap-4 flex-grow min-h-0">
        {/* Left Half: 2x2 Grid */}
        <div className="grid grid-cols-2 gap-2 w-1/2">
          {(["goldilocks", "reflation", "stagflation", "deflation"] as const).map((q) => {
            const qCfg = QUADRANT_CONFIG[q];
            const isActive = activeQuadrant === q;

            return (
              <div
                key={q}
                className="flex flex-col items-center justify-center rounded-lg border p-2 transition-all duration-200 cursor-pointer"
                style={{
                  backgroundColor: isActive ? qCfg.color + "18" : "#0a0a0a",
                  borderColor: isActive ? qCfg.color + "80" : "#262626",
                  boxShadow: isActive ? "0 0 12px " + qCfg.color + "30" : "none",
                }}
                onClick={() => { if (isActive) setShowPlaybook(true); }}
              >
                <span className="text-[10px] font-bold font-mono uppercase tracking-wider" style={{ color: isActive ? qCfg.color : "#525252" }}>
                  {qCfg.title}
                </span>
                <span className="text-[8px] text-neutral-500 mt-0.5 font-mono">{qCfg.desc}</span>
                {isActive && (
                  <span className="text-[8px] font-mono font-bold mt-1" style={{ color: qCfg.color }}>
                    ACTIVE
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Right Half: Active Regime Panel */}
        <div className="flex flex-col justify-center w-1/2 p-2">
          <span className="text-neutral-500 font-mono text-[10px] tracking-widest uppercase mb-1">Active Regime</span>
          {cfg && (
            <>
              <span className="text-2xl font-black font-mono uppercase tracking-tight mb-2" style={{ color: cfg.color }}>
                {cfg.title}
              </span>
              <p className="text-[10px] text-neutral-400 leading-relaxed font-mono">
                Growth / Inflation — Contraction: weakening economy and falling prices.
              </p>
            </>
          )}
          <button
            onClick={() => setShowPlaybook(true)}
            className="mt-3 flex items-center gap-2 px-3 py-1.5 rounded-lg border border-neutral-700 text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-300 hover:bg-neutral-800 transition-colors"
          >
            <Play className="w-3 h-3" />
            View Playbook
          </button>
        </div>
      </div>

      {/* Playbook Modal */}
      {showPlaybook && activeQuadrant && cfg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)" }}
          onClick={() => setShowPlaybook(false)}
        >
          <div
            className="w-full max-w-xl rounded-xl border p-5"
            style={{ backgroundColor: "#0a0a0a", borderColor: cfg.color + "40" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-mono font-bold uppercase tracking-widest" style={{ color: cfg.color }}>
                Playbook / {cfg.title}
              </span>
              <button onClick={() => setShowPlaybook(false)} className="text-neutral-500 hover:text-white text-xs">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              {(QUADRANT_PLAYBOOKS[activeQuadrant as keyof typeof QUADRANT_PLAYBOOKS] || []).map((entry, idx) => (
                <div key={idx} className="flex flex-col gap-1 p-3 rounded-lg border border-neutral-800 bg-neutral-900/40">
                  <span className="text-[10px] font-mono font-bold inline-block w-fit px-2 py-0.5 rounded" style={{ color: cfg.color, backgroundColor: cfg.color + "15" }}>{entry.asset}</span>
                  <p className="text-[10px] text-neutral-400 leading-relaxed font-mono">{entry.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
