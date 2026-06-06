"use client";

import React, { useState, useMemo } from "react";
import { useMacroTerminal } from "./MacroTerminalContext";
import { Activity, TrendingDown, TrendingUp, AlertTriangle, Play, X } from "lucide-react";

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
    title: "Goldilocks",
    description: "Growth ↑ · Inflation ↓",
    color: "#10B981",
    bgActive: "rgba(16, 185, 129, 0.12)",
    borderActive: "rgba(16, 185, 129, 0.6)",
    glow: "rgba(16, 185, 129, 0.25)",
    icon: "🌱",
  },
  reflation: {
    title: "Reflation",
    description: "Growth ↑ · Inflation ↑",
    color: "#3B82F6",
    bgActive: "rgba(59, 130, 246, 0.12)",
    borderActive: "rgba(59, 130, 246, 0.6)",
    glow: "rgba(59, 130, 246, 0.25)",
    icon: "🔥",
  },
  stagflation: {
    title: "Stagflation",
    description: "Growth ↓ · Inflation ↑",
    color: "#F59E0B",
    bgActive: "rgba(245, 158, 11, 0.12)",
    borderActive: "rgba(245, 158, 11, 0.6)",
    glow: "rgba(245, 158, 11, 0.25)",
    icon: "⚠️",
  },
  deflation: {
    title: "Deflation",
    description: "Growth ↓ · Inflation ↓",
    color: "#94A3B8",
    bgActive: "rgba(148, 163, 184, 0.12)",
    borderActive: "rgba(148, 163, 184, 0.6)",
    glow: "rgba(148, 163, 184, 0.25)",
    icon: "❄️",
  },
};

const STATUS_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  ACCELERATING: { text: "#10B981", bg: "rgba(16, 185, 129, 0.12)", border: "rgba(16, 185, 129, 0.3)" },
  DECELERATING: { text: "#EF4444", bg: "rgba(239, 68, 68, 0.12)", border: "rgba(239, 68, 68, 0.3)" },
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

  const formatNumber = (val: number | null | undefined, digits = 4) => {
    if (val === null || val === undefined || Number.isNaN(val)) return "—";
    return val.toFixed(digits);
  };

  const TrendBar = ({ label, value, ema, status, ratioLabel, invert = false }: {
    label: string;
    value: number;
    ema: number;
    status: string;
    ratioLabel: string;
    invert?: boolean;
  }) => {
    const colors = STATUS_COLORS[status] || STATUS_COLORS.DECELERATING;
    const pct = Math.min(100, Math.max(0, ((value - ema) / ema) * 100 + 50));
    const isAccel = status === "ACCELERATING";

    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold text-text-muted uppercase tracking-widest">
              {label}
            </span>
            <span
              className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border"
              style={{ color: colors.text, backgroundColor: colors.bg, borderColor: colors.border }}
            >
              {status}
            </span>
          </div>
          <span className="text-[10px] font-mono text-text-muted">
            {ratioLabel}
          </span>
        </div>

        <div className="relative h-2 rounded-full bg-[#1a1a24] overflow-hidden">
          <div
            className="absolute inset-y-0 left-1/2 rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${Math.abs(pct - 50) * 2}%`,
              marginLeft: isAccel ? "50%" : "auto",
              marginRight: isAccel ? "auto" : "50%",
              backgroundColor: colors.text,
              opacity: 0.8,
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-px h-3 bg-white/20" />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[9px] font-mono text-text-muted">
            EMA-50: {formatNumber(ema)}
          </span>
          <span className="text-[9px] font-mono" style={{ color: colors.text }}>
            {isAccel ? "+" : ""}{formatNumber((value - ema) / ema * 100, 2)}%
          </span>
        </div>
      </div>
    );
  };

  return (
    <div
      className="flex flex-col h-full rounded-2xl overflow-hidden border border-[#1a1a24]"
      style={{ backgroundColor: "#0a0a0f", maxHeight: "380px" }}
    >
      {/* ========== HEADER ========== */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1a1a24]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-[#D4AF37]" />
            <h2 className="text-[11px] font-mono font-bold text-[#D4AF37] uppercase tracking-[0.15em]">
              Macro Regime Matrix
            </h2>
          </div>
          {lastUpdated && (
            <span className="text-[9px] font-mono text-[#5a5a6e] tracking-wide">
              {new Intl.DateTimeFormat('en-US', {
                month: 'short', day: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit',
                hour12: false, timeZone: 'Asia/Jakarta'
              }).format(lastUpdated)} WIB
            </span>
          )}
        </div>
        {hasRegime && (
          <div className="flex items-center gap-1.5">
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10B981]" />
            </div>
            <span className="text-[9px] font-mono font-bold text-[#10B981] uppercase tracking-widest">
              Live
            </span>
          </div>
        )}
      </div>

      {/* ========== MAIN CONTENT ========== */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4" style={{ scrollbarWidth: "none" }}>
        {/* Hide scrollbar */}
        <style jsx>{`
          div::-webkit-scrollbar { display: none; }
        `}</style>

        {!hasRegime || !regimeData ? (
          <div className="flex items-center justify-center h-32">
            <span className="text-[#5a5a6e] text-xs font-mono">Initializing matrix...</span>
          </div>
        ) : (
          <>
            {/* ROW 1: 2x2 Grid + Active Hero */}
            <div className="grid grid-cols-2 gap-3">
              {/* 2x2 Quadrant Grid */}
              <div className="grid grid-cols-2 grid-rows-2 gap-2">
                {(["goldilocks", "reflation", "stagflation", "deflation"] as const).map((q) => {
                  const qCfg = QUADRANT_CONFIG[q];
                  const isActive = activeQuadrant === q;

                  return (
                    <button
                      key={q}
                      onClick={() => {
                        if (isActive) {
                          setShowPlaybook(true);
                        }
                      }}
                      className="relative flex flex-col items-center justify-center rounded-xl border transition-all duration-300 group"
                      style={{
                        backgroundColor: "#111118",
                        borderColor: isActive ? qCfg.borderActive : "#1a1a24",
                        boxShadow: isActive
                          ? `0 0 24px ${qCfg.glow}, inset 0 0 12px ${qCfg.glow}`
                          : "none",
                      }}
                    >
                      {/* Active indicator dot */}
                      {isActive && (
                        <div
                          className="absolute top-2.5 right-2.5 h-2.5 w-2.5 rounded-full animate-pulse"
                          style={{ backgroundColor: qCfg.color, boxShadow: `0 0 10px ${qCfg.color}` }}
                        />
                      )}

                      <span className="text-lg mb-1 opacity-80 group-hover:scale-110 transition-transform duration-300">
                        {qCfg.icon}
                      </span>
                      <span
                        className="text-[11px] font-bold font-mono uppercase tracking-wider"
                        style={{ color: isActive ? qCfg.color : "#6b7280" }}
                      >
                        {qCfg.title}
                      </span>
                      <span className="text-[9px] text-[#6b7280] mt-1 font-mono tracking-wide">
                        {qCfg.description}
                      </span>

                      {/* Hover effect */}
                      <div
                        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                        style={{
                          background: `linear-gradient(135deg, ${qCfg.bgActive}, transparent 60%)`,
                        }}
                      />
                    </button>
                  );
                })}
              </div>

              {/* Active Regime Hero */}
              <div
                className="flex flex-col items-center justify-center rounded-xl border relative overflow-hidden"
                style={{
                  backgroundColor: "#111118",
                  borderColor: cfg ? cfg.borderActive : "#1a1a24",
                  boxShadow: cfg ? `0 0 30px ${cfg.glow}` : "none",
                }}
              >
                {cfg && (
                  <>
                    <div
                      className="absolute inset-0 opacity-30 pointer-events-none"
                      style={{
                        background: `radial-gradient(circle at center, ${cfg.bgActive}, transparent 70%)`,
                      }}
                    />
                    <div className="relative z-10 flex flex-col items-center gap-2 p-3">
                      <span className="text-[10px] font-mono font-bold text-[#5a5a6e] uppercase tracking-[0.2em]">
                        Active Regime
                      </span>
                      <span
                        className="text-3xl font-black font-mono uppercase tracking-tight"
                        style={{ color: cfg.color, textShadow: `0 0 20px ${cfg.glow}` }}
                      >
                        {cfg.title}
                      </span>
                      <span className="text-[10px] text-[#9ca3af] font-mono text-center leading-relaxed">
                        {regimeData.description}
                      </span>

                      <button
                        onClick={() => setShowPlaybook(true)}
                        className="mt-3 flex items-center gap-2 px-4 py-2 rounded-lg border transition-all duration-200 hover:brightness-125 active:scale-95"
                        style={{
                          backgroundColor: cfg.bgActive,
                          borderColor: cfg.borderActive,
                          color: cfg.color,
                        }}
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span className="text-[10px] font-mono font-bold uppercase tracking-widest">
                          View Playbook
                        </span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ROW 2: Metrics / Trend Gauges */}
            <div className="grid grid-cols-2 gap-3">
              {regimeData.growth && (
                <TrendBar
                  label="Growth Trend"
                  value={regimeData.growth.current}
                  ema={regimeData.growth.ema50}
                  status={regimeData.growth.status}
                  ratioLabel="XLY / XLP"
                />
              )}
              {regimeData.inflation && (
                <TrendBar
                  label="Inflation Trend"
                  value={regimeData.inflation.current}
                  ema={regimeData.inflation.ema50}
                  status={regimeData.inflation.status}
                  ratioLabel="TIP / TLT"
                />
              )}
            </div>

            {/* ROW 3: Liquidity Health Badge */}
            {regimeData.liquidity && (
              <div
                className="flex items-center justify-between rounded-xl border px-4 py-3"
                style={{
                  backgroundColor: "#111118",
                  borderColor: "#1a1a24",
                }}
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-4 h-4" style={{ color: regimeData.liquidity.riskState === "STRESSED" ? "#EF4444" : "#10B981" }} />
                  <div>
                    <span className="text-[9px] font-mono font-bold text-[#5a5a6e] uppercase tracking-widest block">
                      Liquidity Health
                    </span>
                    <span className="text-[10px] font-mono text-[#9ca3af]">
                      HYG / SHY
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-[10px] font-mono text-[#9ca3af] block">
                      Ratio: {formatNumber(regimeData.liquidity.current)}
                    </span>
                    <span className="text-[9px] font-mono text-[#5a5a6e]">
                      EMA-50: {formatNumber(regimeData.liquidity.ema50)}
                    </span>
                  </div>
                  <span
                    className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border"
                    style={{
                      color: regimeData.liquidity.riskState === "HEALTHY" ? "#10B981" : "#EF4444",
                      backgroundColor: regimeData.liquidity.riskState === "HEALTHY"
                        ? "rgba(16, 185, 129, 0.12)"
                        : "rgba(239, 68, 68, 0.12)",
                      borderColor: regimeData.liquidity.riskState === "HEALTHY"
                        ? "rgba(16, 185, 129, 0.3)"
                        : "rgba(239, 68, 68, 0.3)",
                    }}
                  >
                    {regimeData.liquidity.riskState}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ========== PLAYBOOK MODAL ========== */}
      {showPlaybook && activeQuadrant && cfg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.75)", backdropFilter: "blur(8px)" }}
          onClick={() => setShowPlaybook(false)}
        >
          <div
            className="w-full max-w-xl rounded-2xl border p-6 relative"
            style={{
              backgroundColor: "#0f0f16",
              borderColor: cfg.borderActive,
              boxShadow: `0 0 40px ${cfg.glow}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <span className="text-xl">{cfg.icon}</span>
                <div>
                  <span className="text-xs font-mono font-bold uppercase tracking-[0.15em]" style={{ color: cfg.color }}>
                    Playbook
                  </span>
                  <span className="text-[10px] text-[#5a5a6e] font-mono ml-2">
                    {regimeData?.description}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowPlaybook(false)}
                className="p-1.5 rounded-lg border border-[#1a1a24] text-[#5a5a6e] hover:text-white hover:border-[#2a2a34] transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-3">
              {(QUADRANT_PLAYBOOKS[activeQuadrant as keyof typeof QUADRANT_PLAYBOOKS] || []).map((entry, idx) => (
                <div
                  key={idx}
                  className="flex flex-col gap-1.5 p-3 rounded-xl border border-[#1a1a24]"
                  style={{ backgroundColor: "#111118" }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[10px] font-mono font-bold px-2 py-1 rounded-md"
                      style={{ backgroundColor: cfg.bgActive, color: cfg.color, border: `1px solid ${cfg.borderActive}` }}
                    >
                      {entry.asset}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#9ca3af] leading-relaxed font-mono">
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
