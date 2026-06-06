"use client";

import React, { useMemo } from "react";
import { useMacroTerminal } from "./MacroTerminalContext";
import { ArrowDown, ArrowUp, Play, X } from "lucide-react";

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

const QUADRANT_CONFIG: Record<string, { title: string; color: string; icon: string }> = {
  goldilocks: { title: "GOLDILOCKS", color: "#10B981", icon: "🌱" },
  reflation: { title: "REFLATION", color: "#3B82F6", icon: "🔥" },
  stagflation: { title: "STAGFLATION", color: "#F59E0B", icon: "⚠️" },
  deflation: { title: "DEFLATION", color: "#94A3B8", icon: "❄️" },
};

export function MacroRegimePanel() {
  const { currentRegime, lastUpdated, regimeData } = useMacroTerminal();
  const [showPlaybook, setShowPlaybook] = React.useState(false);

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
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-neutral-400 font-mono text-xs tracking-widest uppercase">Macro Regime Matrix</h2>
        {hasRegime && (
          <span className="text-green-500 text-xs font-mono flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            LIVE
          </span>
        )}
      </div>

      {/* Main Content: Clean Indicators */}
      <div className="flex flex-col space-y-3 flex-grow justify-center">
        
        {/* Growth Indicator */}
        <div className="flex justify-between items-center bg-neutral-900/50 p-4 rounded-lg border border-neutral-800/50">
          <span className="text-neutral-500 font-mono text-sm tracking-wide">GROWTH</span>
          <span className={`font-bold text-sm tracking-wider flex items-center gap-2 ${isGrowthUp ? "text-green-500" : "text-red-500"}`}>
            {growthStatus} {isGrowthUp ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
          </span>
        </div>

        {/* Inflation Indicator */}
        <div className="flex justify-between items-center bg-neutral-900/50 p-4 rounded-lg border border-neutral-800/50">
          <span className="text-neutral-500 font-mono text-sm tracking-wide">INFLATION</span>
          <span className={`font-bold text-sm tracking-wider flex items-center gap-2 ${isInflationUp ? "text-green-500" : "text-red-500"}`}>
            {inflationStatus} {isInflationUp ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
          </span>
        </div>

      </div>

      {/* Bottom Section: Liquidity & Overall Status */}
      <div className="mt-6 space-y-3">
        
        {/* Liquidity Alert */}
        <div className="bg-red-950/20 border border-red-900/50 p-3 rounded-lg flex justify-center items-center">
          <span className="text-red-500 font-mono font-bold text-xs tracking-[0.2em]">
            LIQUIDITY HEALTH: {liquidityRisk}
          </span>
        </div>

        {/* Active Regime */}
        <div className="text-center pt-2">
          <span className="text-neutral-600 font-mono text-xs uppercase tracking-widest">Active Regime: </span>
          {cfg && (
            <span className="font-bold text-sm tracking-widest" style={{ color: cfg.color }}>
              {cfg.title}
            </span>
          )}
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
