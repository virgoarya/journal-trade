import React, { useEffect, useMemo, useState } from "react";
import { useMacroTerminal } from './MacroTerminalContext';

type RegimeCardData = {
  id: string;
  title: string;
  description: string;
};

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
  borderColor: string;
  textColor: string;
  bgColor: string;
  dotColor: string;
  position: { row: number; col: number };
}> = {
  goldilocks: {
    title: "Goldilocks",
    description: "Growth ↑ Inflation ↓",
    color: "text-emerald-400",
    borderColor: "border-emerald-500/60",
    textColor: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    dotColor: "bg-emerald-400",
    position: { row: 1, col: 2 },
  },
  reflation: {
    title: "Reflation",
    description: "Growth ↑ Inflation ↑",
    color: "text-cyan-400",
    borderColor: "border-cyan-500/60",
    textColor: "text-cyan-400",
    bgColor: "bg-cyan-500/10",
    dotColor: "bg-cyan-400",
    position: { row: 2, col: 2 },
  },
  stagflation: {
    title: "Stagflation",
    description: "Growth ↓ Inflation ↑",
    color: "text-red-400",
    borderColor: "border-red-500/60",
    textColor: "text-red-400",
    bgColor: "bg-red-500/10",
    dotColor: "bg-red-400",
    position: { row: 2, col: 1 },
  },
  deflation: {
    title: "Deflation",
    description: "Growth ↓ Inflation ↓",
    color: "text-slate-400",
    borderColor: "border-slate-500/60",
    textColor: "text-slate-400",
    bgColor: "bg-slate-500/10",
    dotColor: "bg-slate-400",
    position: { row: 1, col: 1 },
  },
};

export function MacroRegimePanel() {
  const { currentRegime, lastUpdated, regimeData, assets } = useMacroTerminal();
  const [selectedQuadrant, setSelectedQuadrant] = useState<string | null>(null);
  const [showPlaybook, setShowPlaybook] = useState(false);

  const activeQuadrant = useMemo(() => {
    if (!currentRegime) return "";
    const q = currentRegime.toLowerCase();
    if (["goldilocks", "reflation", "stagflation", "deflation"].includes(q)) return q;
    return "";
  }, [currentRegime]);

  const hasRegime = !!activeQuadrant;

  const formatPercent = (val: number | null | undefined) => {
    if (val === null || val === undefined || Number.isNaN(val)) return "—";
    return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;
  };

  const statusColor = (status: string) => {
    if (status === "ACCELERATING") return "text-emerald-400";
    if (status === "DECELERATING") return "text-red-400";
    return "text-text-muted";
  };

  const riskBadge = (risk: string) => {
    if (risk === "HEALTHY") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/40";
    if (risk === "STRESSED") return "bg-red-500/15 text-red-400 border-red-500/40";
    return "bg-text-muted/10 text-text-muted border-border-subtle";
  };

  const quadrantList = ["goldilocks", "reflation", "stagflation", "deflation"] as const;

  return (
    <div className="flex flex-col h-full max-h-[280px] glass border border-border-subtle rounded-xl bg-bg-void">
      {/* Header */}
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

      {!hasRegime || !regimeData ? (
        <div className="flex flex-1 items-center justify-center p-2">
          <span className="text-text-muted text-xs">Loading...</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2 p-2 overflow-y-auto">
          {/* Row 1: Quadrant Grid + Hero */}
          <div className="grid grid-cols-2 gap-2">
            {/* 2x2 Quadrant Grid */}
            <div className="col-span-1">
              <div className="grid grid-cols-2 grid-rows-2 gap-1 h-[140px]">
                {/* Y-axis label */}
                <div className="col-span-2 flex items-center justify-center">
                  <span className="text-[8px] text-text-muted font-mono uppercase tracking-widest rotate-0">Inflation →</span>
                </div>

                {quadrantList.map((q) => {
                  const cfg = QUADRANT_CONFIG[q];
                  const isActive = activeQuadrant === q;
                  const isSelected = selectedQuadrant === q;

                  return (
                    <button
                      key={q}
                      onClick={() => {
                        setSelectedQuadrant(q);
                        if (isActive) setShowPlaybook(true);
                      }}
                      className={`
                        relative flex flex-col items-center justify-center rounded border p-1 transition-all duration-300
                        ${isActive
                          ? `${cfg.borderColor} ${cfg.bgColor} shadow-lg scale-[1.02]`
                          : isSelected
                            ? "border-accent-gold/50 bg-surface-elevated/80"
                            : "border-border-subtle bg-surface-elevated opacity-60 hover:opacity-80"
                        }
                      `}
                    >
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? cfg.textColor : "text-text-secondary"}`}>
                        {cfg.title}
                      </span>
                      <span className="text-[8px] text-text-muted mt-0.5">{cfg.description}</span>

                      {/* Active dot indicator */}
                      {isActive && (
                        <div className="absolute top-1 right-1">
                          <div className={`h-2 w-2 rounded-full ${cfg.dotColor} animate-pulse shadow-lg`} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hero Widget */}
            <div className="col-span-1 flex flex-col items-center justify-center rounded border border-border-subtle bg-surface-elevated/50 p-2">
              <span className="text-[9px] text-text-muted font-mono uppercase tracking-widest mb-1">Active Regime</span>
              <span className={`text-2xl font-bold font-mono uppercase tracking-wider ${QUADRANT_CONFIG[activeQuadrant]?.color || 'text-text-primary'}`}>
                {activeQuadrant}
              </span>
              <span className="text-[10px] text-text-secondary mt-1 text-center">
                {regimeData.description}
              </span>
              <button
                onClick={() => setShowPlaybook(true)}
                className="mt-2 text-[9px] bg-accent-gold/10 hover:bg-accent-gold/20 text-accent-gold px-2 py-1 rounded border border-accent-gold/30 transition-colors"
              >
                View Playbook
              </button>
            </div>
          </div>

          {/* Row 2: Metrics Row */}
          <div className="grid grid-cols-3 gap-2">
            {/* Growth Metric */}
            <div className="flex flex-col rounded border border-border-subtle bg-surface-elevated/50 p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] text-text-muted font-mono uppercase">Growth</span>
                <span className={`text-[9px] font-mono font-bold ${statusColor(regimeData.growth.status)}`}>
                  {regimeData.growth.status}
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-mono font-bold text-text-primary">
                  {regimeData.growth.current.toFixed(4)}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[8px] text-text-muted">EMA-50: {regimeData.growth.ema50.toFixed(4)}</span>
                <span className="text-[8px] text-text-muted">XLY/XLP</span>
              </div>
            </div>

            {/* Inflation Metric */}
            <div className="flex flex-col rounded border border-border-subtle bg-surface-elevated/50 p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] text-text-muted font-mono uppercase">Inflation</span>
                <span className={`text-[9px] font-mono font-bold ${statusColor(regimeData.inflation.status)}`}>
                  {regimeData.inflation.status}
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-mono font-bold text-text-primary">
                  {regimeData.inflation.current.toFixed(4)}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[8px] text-text-muted">EMA-50: {regimeData.inflation.ema50.toFixed(4)}</span>
                <span className="text-[8px] text-text-muted">TIP/TLT</span>
              </div>
            </div>

            {/* Liquidity Health */}
            <div className="flex flex-col rounded border border-border-subtle bg-surface-elevated/50 p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] text-text-muted font-mono uppercase">Liquidity</span>
                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${riskBadge(regimeData.liquidity.riskState)}`}>
                  {regimeData.liquidity.riskState}
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-mono font-bold text-text-primary">
                  {regimeData.liquidity.current.toFixed(4)}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[8px] text-text-muted">EMA-50: {regimeData.liquidity.ema50.toFixed(4)}</span>
                <span className="text-[8px] text-text-muted">HYG/SHY</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Playbook Modal */}
      {showPlaybook && activeQuadrant && QUADRANT_PLAYBOOKS[activeQuadrant as keyof typeof QUADRANT_PLAYBOOKS] && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => { setShowPlaybook(false); setSelectedQuadrant(null); }}>
          <div className="glass border border-border-subtle rounded-xl bg-bg-void max-w-2xl w-full p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-mono uppercase ${QUADRANT_CONFIG[activeQuadrant]?.color}`}>
                  PLAYBOOK • {QUADRANT_CONFIG[activeQuadrant]?.title}
                </span>
                <span className="text-[9px] text-text-muted font-mono">{regimeData?.description}</span>
              </div>
              <button onClick={() => { setShowPlaybook(false); setSelectedQuadrant(null); }} className="text-text-muted hover:text-text-primary text-xs">✕</button>
            </div>
            <div className="space-y-3">
              {(QUADRANT_PLAYBOOKS[activeQuadrant as keyof typeof QUADRANT_PLAYBOOKS] || []).map((entry, idx) => (
                <div key={idx} className="flex flex-col gap-1.5 pb-3 border-b border-border-subtle/50 last:border-0">
                  <span className="text-[11px] bg-accent-gold/15 text-accent-gold px-2 py-1 rounded font-mono inline-block w-fit">{entry.asset}</span>
                  <p className="text-[10px] text-text-secondary leading-tight">{entry.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
