import React, { useEffect, useMemo, useState } from "react";
import { useMacroTerminal } from "./MacroTerminalContext";

type RegimeCardData = {
  id: string;
  title: string;
  growth: string;
  inflation: string;
};

const regimeCards: RegimeCardData[] = [
  { id: "stagflation", title: "Stagflation", growth: "Low", inflation: "High" },
  { id: "reflation", title: "Reflation", growth: "High", inflation: "Rising" },
  { id: "transition", title: "Transition", growth: "—", inflation: "—" },
  { id: "deflation", title: "Deflation", growth: "Low", inflation: "Low" },
  { id: "goldilocks", title: "Goldilocks", growth: "High", inflation: "Low" },
];

const REGIME_PLAYBOOKS: Record<string, { assets: string[]; reasoning: string }> = {
  stagflation: {
    assets: ["GLD (Gold)", "VIXY (Volatility)", "UUP (US Dollar)"],
    reasoning:
      "Inflasi tinggi disertai perlambatan ekonomi membuat safe-haven seperti Emas diuntungkan. Ekuitas cenderung tertekan karena margin terpangkas, sementara volatilitas (VIX) berpotensi melonjak.",
  },
  goldilocks: {
    assets: ["SPY (S&P 500)", "QQQ (Nasdaq)", "BTCUSD (Bitcoin)"],
    reasoning:
      "Kombinasi pertumbuhan ekonomi kuat dan inflasi terkendali adalah surga bagi aset berisiko (Risk-On). Aliran likuiditas akan deras masuk ke sektor teknologi, saham pertumbuhan, dan kripto.",
  },
  deflation: {
    assets: ["IEF (US 10Y Bonds)", "UUP (US Dollar)"],
    reasoning:
      "Saat pertumbuhan ekonomi dan inflasi anjlok, instrumen obligasi pemerintah (bonds) menjadi instrumen terbaik karena penurunan suku bunga. Uang tunai (USD) juga menguat karena pelarian modal dari pasar ekuitas.",
  },
  reflation: {
    assets: ["SPY (S&P 500)", "BTCUSD (Bitcoin)", "TIP (TIPS Real Yield)"],
    reasoning:
      "Pertumbuhan ekonomi naik diikuti naiknya inflasi mendorong rotasi modal ke aset komoditas dan ekuitas. Kripto dan saham siklikal biasanya memimpin reli pada fase ini.",
  },
  transition: {
    assets: ["UUP (US Dollar)", "Cash / Wait & See"],
    reasoning:
      "Pasar sedang beralih fase makro. Likuiditas cenderung tidak menentu dan arah market belum terkonfirmasi jelas. Memegang tunai atau memperhatikan pergerakan DXY adalah langkah paling aman.",
  },
};

const GRID_LAYOUT: Record<string, { row: number; col: number }> = {
  stagflation: { row: 1, col: 1 },
  reflation: { row: 1, col: 3 },
  transition: { row: 2, col: 2 },
  deflation: { row: 3, col: 1 },
  goldilocks: { row: 3, col: 3 },
};

export function MacroRegimePanel() {
  const { currentRegime, lastRegime, isAnalyzing } = useMacroTerminal();
  const [selectedRegime, setSelectedRegime] = useState<string>("");

  const activeRegime = useMemo(() => {
    const fromContext = (currentRegime || lastRegime || "").toLowerCase();
    return fromContext || "";
  }, [currentRegime, lastRegime]);

  useEffect(() => {
    const regime = (currentRegime || lastRegime || "").toLowerCase();
    if (regime && selectedRegime === "") {
      setSelectedRegime(regime);
    }
  }, [currentRegime, lastRegime]);

  const hasRegime = !!(currentRegime || lastRegime);

  return (
    <div className="flex h-full max-h-[260px] flex-col glass border border-border-subtle rounded-xl bg-bg-void">
      <div className="flex items-center justify-between border-b border-border-subtle p-2">
        <h2 className="text-xs font-mono font-bold text-accent-gold uppercase tracking-widest">Macro Regime Matrix</h2>
        {hasRegime && (
          <span className="text-[10px] bg-accent-gold/20 text-accent-gold px-1.5 py-0.5 rounded animate-pulse">LIVE</span>
        )}
      </div>

      {!hasRegime ? (
        <div className="flex flex-1 items-center justify-center p-2">
          <span className="text-text-muted text-xs">Loading...</span>
        </div>
      ) : (
        <>
          {/* Grid Layout - Cross Pattern */}
          <div className="grid grid-cols-3 grid-rows-3 gap-1.5 p-2 relative">
            {/* Empty placeholder cells */}
            <div style={{ gridColumn: 2, gridRow: 1 }} />
            <div style={{ gridColumn: 1, gridRow: 2 }} />
            <div style={{ gridColumn: 3, gridRow: 2 }} />
            {/* Regime Cards */}
            {regimeCards.map((card) => {
              const isActive = card.id.toLowerCase() === activeRegime.toLowerCase();
              const isSelected = card.id.toLowerCase() === selectedRegime.toLowerCase();
              const layout = GRID_LAYOUT[card.id] || { row: 2, col: 2 };

              return (
                <div
                  key={card.id}
                  onClick={() => setSelectedRegime(card.id.toLowerCase())}
                  style={{ gridColumn: layout.col, gridRow: layout.row }}
                  className={`flex flex-col items-center justify-center rounded border p-1.5 transition-all duration-300 cursor-pointer ${
                    isActive ? "border-data-profit ring-2 ring-data-profit/50 shadow-lg shadow-data-profit/20" : ""
                  } ${isSelected && !isActive ? "border-accent-gold/50 bg-surface-elevated/80" : "border-border-subtle bg-surface-elevated"} ${
                    !isActive && !isSelected ? "opacity-50 hover:opacity-75" : "opacity-100"
                  }`}
                >
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider leading-tight ${
                      isActive ? "text-text-primary" : isSelected ? "text-accent-gold" : "text-text-secondary"
                    }`}
                  >
                    {card.title}
                  </span>
                  <div className="mt-0.5 flex items-center gap-1">
                    <span className={`text-[10px] ${isActive ? "text-text-primary" : isSelected ? "text-accent-gold/80" : "text-text-secondary"}`}>
                      G:{card.growth}
                    </span>
                    <span className={`text-[10px] ${isActive ? "text-text-primary" : isSelected ? "text-accent-gold/80" : "text-text-secondary"}`}>
                      I:{card.inflation}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Playbook Panel */}
          {selectedRegime && REGIME_PLAYBOOKS[selectedRegime] && (
            <div className="border-t border-border-subtle px-2 py-1.5 bg-surface-elevated/30">
              <div className="mb-1">
                <span className="text-accent-gold text-[10px] font-mono uppercase">Playbook:</span>
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap gap-1">
                  {REGIME_PLAYBOOKS[selectedRegime].assets.map((asset) => (
                    <span key={asset} className="text-[9px] bg-accent-gold/10 text-accent-gold px-1 py-0.5 rounded font-mono">
                      {asset}
                    </span>
                  ))}
                </div>
                <p className="text-[9px] text-text-secondary leading-tight">{REGIME_PLAYBOOKS[selectedRegime].reasoning}</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
