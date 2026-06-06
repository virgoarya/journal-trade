"use client";

import React, { useMemo, useState } from "react";
import { useMacroTerminal } from "./MacroTerminalContext";
import { ArrowDown, ArrowUp, Play, X, Activity } from "lucide-react";

const QUADRANT_PLAYBOOKS = {
  goldilocks: [
    { asset: "SPY / QQQ", desc: "Korporasi menikmati ekspansi margin maksimal karena daya beli kuat sementara biaya input stabil. Sektor teknologi memimpin reli." },
    { asset: "BTCUSD", desc: "Likuiditas melimpah beralih agresif ke high-beta risk-on assets untuk memburu alpha return tertinggi." }
  ],
  stagflation: [
    { asset: "GLD (Gold)", desc: "Berfungsi sebagai lindung nilai murni (hard asset) saat mata uang fiat terdevaluasi oleh inflasi di tengah ekonomi yang mandek." },
    { asset: "VIXY (Volatility)", desc: "Ketakutan pasar ekuitas terhadap macetnya roda ekonomi memicu lonjakan volatilitas pasar secara mendadak." },
    { asset: "UUP (US Dollar)", desc: "Suku bunga yang dipaksa tetap tinggi demi melawan inflasi membuat modal asing masuk mengamankan yield mata uang Dollar." }
  ],
  deflation: [
    { asset: "IEF (US 10Y Bonds)", desc: "Saat bank sentral memotong suku bunga, harga obligasi lama berkupon tinggi langsung meroket (capital gain naik tajam)." },
    { asset: "UUP (US Dollar)", desc: "Cash is king. Semua institusi berebut mencairkan asetnya menjadi likuiditas US Dollar murni untuk mengamankan modal." }
  ],
  reflation: [
    { asset: "SPY (Equities)", desc: "Saham-saham sektor siklikal, industri, dan energi diuntungkan langsung dari roda ekonomi yang kembali berputar kencang." },
    { asset: "TIP (TIPS)", desc: "Melindungi nilai pokok modal dari gerusan inflasi karena nilai prinsipal obligasi ini naik mengikuti indeks CPI." },
    { asset: "BTCUSD", desc: "Berfungsi sebagai instrumen spekulasi awal karena sensitivitasnya yang tinggi terhadap ekspansi moneter baru." }
  ],
};

const QUADRANT_CONFIG: Record<string, {
  title: string;
  description: string;
  color: string;
  bgActive: string;
  borderActive: string;
  glow: string;
  icon: string;
}> = {
  goldilocks: {
    title: "GOLDILOCKS",
    description: "Growth ⬆️ · Inflation ⬇️",
    color: "#10B981",
    bgActive: "rgba(16, 185, 129, 0.15)",
    borderActive: "rgba(16, 185, 129, 0.6)",
    glow: "rgba(16, 185, 129, 0.25)",
    icon: "🌱",
  },
  reflation: {
    title: "REFLATION",
    description: "Growth ⬆️ · Inflation ⬆️",
    color: "#3B82F6",
    bgActive: "rgba(59, 130, 246, 0.15)",
    borderActive: "rgba(59, 130, 246, 0.6)",
    glow: "rgba(59, 130, 246, 0.25)",
    icon: "🔥",
  },
  stagflation: {
    title: "STAGFLATION",
    description: "Growth ⬇️ · Inflation ⬆️",
    color: "#F59E0B",
    bgActive: "rgba(245, 158, 11, 0.15)",
    borderActive: "rgba(245, 158, 11, 0.6)",
    glow: "rgba(245, 158, 11, 0.25)",
    icon: "⚠️",
  },
  deflation: {
    title: "DEFLATION",
    description: "Growth ⬇️ · Inflation ⬇️",
    color: "#94A3B8",
    bgActive: "rgba(148, 163, 184, 0.15)",
    borderActive: "rgba(148, 163, 184, 0.6)",
    glow: "rgba(148, 163, 184, 0.25)",
    icon: "❄️",
  },
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

  // Map API status to display values
  const growthStatus = regimeData?.growth?.status === "ACCELERATING" ? "ACCELERATING" : "DECELERATING";
  const inflationStatus = regimeData?.inflation?.status === "ACCELERATING" ? "ACCELERATING" : "DECELERATING";
  const liquidityRisk = regimeData?.liquidity?.riskState || "STRESSED";

  const isGrowthUp = growthStatus === "ACCELERATING";
  const isInflationUp = inflationStatus === "ACCELERATING";

  return (
    <div className="flex flex-col h-full bg-[#020202] border border-neutral-800 rounded-xl p-5">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-neutral-400 font-mono text-xs tracking-widest uppercase">Macro Regime Matrix</h2>
        {lastUpdated && (
          <span className="text-[9px] text-neutral-500 font-mono">
            {new Intl.DateTimeFormat('en-US', {
              month: 'short', day: '2-digit', year: 'numeric',
              hour: '2-digit', minute: '2-digit', second: '2-digit',
              hour12: false, timeZone: 'Asia/Jakarta'
            }).format(lastUpdated)} WIB
          </span>
        )}
        {hasRegime && (
          <span className="text-green-500 text-xs font-mono flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            LIVE
          </span>
        )}
      </div>

      {/* Full Visual 2x2 Quadrant Grid */}
      <div className="grid grid-cols-2 grid-rows-2 gap-2 mb-4">
        {(["goldilocks", "reflation", "stagflation", "deflation"] as const).map((q) => {
          const qCfg = QUADRANT_CONFIG[q];
          const isActive = activeQuadrant === q;
          const isDecel = q === "deflation";

          return (
            <div
              key={q}
              className="relative flex flex-col items-center justify-center rounded-xl border transition-all duration-300 cursor-pointer"
              style={{
                backgroundColor: isActive ? qCfg.bgActive : "#0a0a0a",
                borderColor: isActive ? qCfg.borderActive : "#262626",
                boxShadow: isActive ? `0 0 20px ${qCfg.glow}, inset 0 0 10px ${qCfg.glow}` : "none",
              }}
              onClick={() => {
                if (isActive) setShowPlaybook(true);
              }}
            >
              {/* Active indicator */}
              {isActive && (
                <div
                  className="absolute top-2 right-2 h-2 w-2 rounded-full animate-pulse"
                  style={{ backgroundColor: qCfg.color, boxShadow: `0 0 8px ${qCfg.color}` }}
                />
              )}

              {/* Icon */}
              <span className="text-2xl mb-1">{qCfg.icon}</span>

              {/* Title */}
              <span
                className="text-xs font-bold font-mono uppercase tracking-wider"
                style={{ color: isActive ? qCfg.color : "#525252" }}
              >
                {qCfg.title}
              </span>

              {/* Description */}
              <span className="text-[10px] text-neutral-500 mt-1 font-mono tracking-wide">
                {qCfg.description}
              </span>

              {/* Deceleration indicator for deflation */}
              {isDecel && isActive && (
                <div className="mt-2 flex items-center gap-1">
                  <ArrowDown className="w-3 h-3 text-red-500" />
                  <span className="text-[9px] text-red-500 font-mono font-bold">DECELERATING</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Integrated Status Panels */}
      <div className="space-y-2 mt-auto">
        {/* Growth Status */}
        <div className="flex justify-between items-center bg-neutral-900/50 p-3 rounded-lg border border-neutral-800/50">
          <span className="text-neutral-500 font-mono text-xs tracking-widest uppercase">Growth</span>
          <span className={`font-bold text-xs tracking-wider flex items-center gap-2 ${isGrowthUp ? "text-green-500" : "text-red-500"}`}>
            {growthStatus} {isGrowthUp ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
          </span>
        </div>

        {/* Inflation Status */}
        <div className="flex justify-between items-center bg-neutral-900/50 p-3 rounded-lg border border-neutral-800/50">
          <span className="text-neutral-500 font-mono text-xs tracking-widest uppercase">Inflation</span>
          <span className={`font-bold text-xs tracking-wider flex items-center gap-2 ${isInflationUp ? "text-green-500" : "text-red-500"}`}>
            {inflationStatus} {isInflationUp ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
          </span>
        </div>

        {/* Liquidity Health */}
        <div className="bg-red-950/20 border border-red-900/50 p-3 rounded-lg flex justify-center items-center">
          <span className="text-red-500 font-mono font-bold text-xs tracking-[0.2em]">
            LIQUIDITY HEALTH: {liquidityRisk}
          </span>
        </div>
      </div>

      {/* Playbook Modal */}
      {showPlaybook && activeQuadrant && cfg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.8)", backdropFilter: "blur(8px)" }}
          onClick={() => setShowPlaybook(false)}
        >
          <div
            className="w-full max-w-xl rounded-2xl border p-6 relative"
            style={{ backgroundColor: "#0a0a0a", borderColor: cfg.color + "40" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <span className="text-xl">{cfg.icon}</span>
                <span className="text-xs font-mono font-bold uppercase tracking-[0.15em]" style={{ color: cfg.color }}>
                  Playbook / {cfg.title}
                </span>
              </div>
              <button
                onClick={() => setShowPlaybook(false)}
                className="p-1.5 rounded-lg border border-neutral-800 text-neutral-500 hover:text-white hover:border-neutral-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              {(QUADRANT_PLAYBOOKS[activeQuadrant as keyof typeof QUADRANT_PLAYBOOKS] || []).map((entry, idx) => (
                <div key={idx} className="flex flex-col gap-1.5 p-3 rounded-xl border border-neutral-800 bg-neutral-900/30">
                  <span className="text-[10px] font-mono font-bold px-2 py-1 rounded-md inline-block w-fit" style={{ color: cfg.color, backgroundColor: cfg.color + "15", border: `1px solid ${cfg.color}30` }}>
                    {entry.asset}
                  </span>
                  <p className="text-[10px] text-neutral-400 leading-relaxed font-mono">
                    {entry.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
