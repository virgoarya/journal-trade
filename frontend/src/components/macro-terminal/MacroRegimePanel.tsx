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

const REGIME_PLAYBOOKS = {
  GOLDILOCKS: [
    { asset: "SPY / QQQ", desc: "Korporasi menikmati ekspansi margin maksimal karena daya beli kuat sementara biaya input stabil. Sektor teknologi memimpin reli." },
    { asset: "BTCUSD", desc: "Likuiditas melimpah beralih agresif ke high-beta risk-on assets untuk memburu alpha return tertinggi." }
  ],
  STAGFLATION: [
    { asset: "GLD (Gold)", desc: "Berfungsi sebagai lindung nilai murni (hard asset) saat mata uang fiat terdevaluasi oleh inflasi di tengah ekonomi yang mandek." },
    { asset: "VIXY (Volatility)", desc: "Ketakutan pasar ekuitas terhadap macetnya roda ekonomi memicu lonjakan volatilitas pasar secara mendadak." },
    { asset: "UUP (US Dollar)", desc: "Suku bunga yang dipaksa tetap tinggi demi melawan inflasi membuat modal asing masuk mengamankan yield mata uang Dollar." }
  ],
  DEFLATION: [
    { asset: "IEF (US 10Y Bonds)", desc: "Saat bank sentral memotong suku bunga, harga obligasi lama berkupon tinggi langsung meroket (capital gain naik tajam)." },
    { asset: "UUP (US Dollar)", desc: "Cash is king. Semua institusi berebut mencairkan asetnya menjadi likuiditas US Dollar murni untuk mengamankan modal." }
  ],
  REFLATION: [
    { asset: "SPY (Equities)", desc: "Saham-saham sektor siklikal, industri, dan energi diuntungkan langsung dari roda ekonomi yang kembali berputar kencang." },
    { asset: "TIP (TIPS)", desc: "Melindungi nilai pokok modal dari gerusan inflasi karena nilai prinsipal obligasi ini naik mengikuti indeks CPI." },
    { asset: "BTCUSD", desc: "Berfungsi sebagai instrumen spekulasi awal karena sensitivitasnya yang tinggi terhadap ekspansi moneter baru." }
  ],
  TRANSITION: [
    { asset: "UUP / Cash", desc: "Likuiditas dijaga sekering mungkin tanpa arah bias pasar yang jelas sampai data makro (NFP, CPI) mengonfirmasi pergeseran tren selanjutnya." }
  ]
};

const GRID_LAYOUT: Record<string, { row: number; col: number }> = {
  stagflation: { row: 1, col: 1 },
  reflation: { row: 1, col: 3 },
  transition: { row: 2, col: 2 },
  deflation: { row: 3, col: 1 },
  goldilocks: { row: 3, col: 3 },
};

export function MacroRegimePanel() {
  const { currentRegime, lastRegime, lastUpdated } = useMacroTerminal();
  const [selectedRegime, setSelectedRegime] = useState<string | null>(null);

  const activeRegime = useMemo(() => {
    const fromContext = (currentRegime || lastRegime || "").toLowerCase();
    return fromContext || "";
  }, [currentRegime, lastRegime]);

  const hasRegime = !!(currentRegime || lastRegime);

  return (
    <>
      <div className="flex flex-col h-full max-h-[260px] glass border border-border-subtle rounded-xl bg-bg-void">
        <div className="flex items-center justify-between border-b border-border-subtle p-2">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-mono font-bold text-accent-gold uppercase tracking-widest">Macro Regime Matrix</h2>
            {lastUpdated && (
              <span className="text-[9px] text-text-muted font-mono whitespace-nowrap hidden sm:inline-block">
                {new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(lastUpdated)} WIB
              </span>
            )}
          </div>
          {hasRegime && (
            <span className="text-[10px] bg-accent-gold/20 text-accent-gold px-1.5 py-0.5 rounded animate-pulse">LIVE</span>
          )}
        </div>

        {!hasRegime ? (
          <div className="flex flex-1 items-center justify-center p-2">
            <span className="text-text-muted text-xs">Loading...</span>
          </div>
        ) : (
          <div className="grid grid-cols-3 grid-rows-3 gap-1.5 p-2 relative">
            <div style={{ gridColumn: 2, gridRow: 1 }} />
            <div style={{ gridColumn: 1, gridRow: 2 }} />
            <div style={{ gridColumn: 3, gridRow: 2 }} />
            {regimeCards.map((card) => {
              const isActive = activeRegime.toLowerCase().includes(card.id.toLowerCase());
              const isSelected = card.id.toLowerCase() === (selectedRegime || "").toLowerCase();
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
        )}
      </div>

      {selectedRegime && REGIME_PLAYBOOKS[selectedRegime.toUpperCase() as keyof typeof REGIME_PLAYBOOKS] && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setSelectedRegime(null)}>
          <div className="glass border border-border-subtle rounded-xl bg-bg-void max-w-2xl w-full p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-accent-gold text-sm font-mono uppercase">PLAYBOOK • {regimeCards.find(c => c.id === selectedRegime)?.title}</span>
              <button onClick={() => setSelectedRegime(null)} className="text-text-muted hover:text-text-primary text-xs">✕</button>
            </div>
            <div className="space-y-3">
              {REGIME_PLAYBOOKS[selectedRegime.toUpperCase() as keyof typeof REGIME_PLAYBOOKS].map((entry, idx) => (
                <div key={idx} className="flex flex-col gap-1.5 pb-3 border-b border-border-subtle/50 last:border-0">
                  <span className="text-[11px] bg-accent-gold/15 text-accent-gold px-2 py-1 rounded font-mono inline-block w-fit">{entry.asset}</span>
                  <p className="text-[10px] text-text-secondary leading-tight">{entry.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
