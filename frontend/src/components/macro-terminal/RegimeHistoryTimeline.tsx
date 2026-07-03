"use client";

import React, { useMemo } from "react";
import { Clock, ArrowRight } from "lucide-react";

type HistoryPoint = {
  date: string;
  quadrant: string;
};

const REGIME_CONFIG: Record<string, { color: string; short: string }> = {
  goldilocks:  { color: "#10B981", short: "GL" },
  reflation:   { color: "#3B82F6", short: "RF" },
  stagflation: { color: "#F59E0B", short: "SF" },
  deflation:   { color: "#94A3B8", short: "DF" },
  transition:  { color: "#8B5CF6", short: "TR" },
};

// Historical asset performance by regime (institutional research-based)
const REGIME_PLAYBOOK: Record<string, { asset: string; bias: "bullish" | "bearish" | "neutral"; note: string }[]> = {
  goldilocks: [
    { asset: "SPX / Equities", bias: "bullish", note: "Best environment — growth without inflation premium" },
    { asset: "High-Yield Credit (HYG)", bias: "bullish", note: "Spread compression, risk appetite high" },
    { asset: "Gold (XAU)", bias: "neutral", note: "Muted — real yields stable, no fear premium" },
    { asset: "USD (DXY)", bias: "neutral", note: "Mixed — depends on relative growth differentials" },
    { asset: "Long-Duration Bonds (TLT)", bias: "neutral", note: "Low duration risk, but not exciting" },
    { asset: "Commodities (DJP)", bias: "bullish", note: "Growth-driven demand supports" },
  ],
  reflation: [
    { asset: "Commodities (Oil, Copper)", bias: "bullish", note: "Primary beneficiary — inflation + growth" },
    { asset: "Gold (XAU)", bias: "bullish", note: "Inflation hedge in demand" },
    { asset: "SPX / Equities", bias: "neutral", note: "Value > Growth in this regime" },
    { asset: "Long-Duration Bonds (TLT)", bias: "bearish", note: "Rising inflation expectations → yield pressure" },
    { asset: "USD (DXY)", bias: "bearish", note: "Reflation typically weakens dollar" },
    { asset: "Emerging Markets (EEM)", bias: "bullish", note: "Commodity exporters benefit" },
  ],
  stagflation: [
    { asset: "Gold (XAU)", bias: "bullish", note: "Classic stagflation safe haven — 1970s proven" },
    { asset: "Oil / Energy (XLE)", bias: "bullish", note: "Stagflation driven by supply shock — energy wins" },
    { asset: "SPX / Equities", bias: "bearish", note: "Margin compression + slowing growth = P/E contraction" },
    { asset: "Long-Duration Bonds (TLT)", bias: "bearish", note: "Worst environment — no growth, high inflation" },
    { asset: "Cash / Short Duration", bias: "bullish", note: "Preservation > return-seeking" },
    { asset: "USD (DXY)", bias: "neutral", note: "Depends on Fed response — could go either way" },
  ],
  deflation: [
    { asset: "Long-Duration Bonds (TLT)", bias: "bullish", note: "Flight to safety + rate cut expectations" },
    { asset: "Gold (XAU)", bias: "bullish", note: "Fear + negative real rates support" },
    { asset: "SPX / Equities", bias: "bearish", note: "Earnings recession risk" },
    { asset: "Commodities", bias: "bearish", note: "Demand collapse" },
    { asset: "USD (DXY)", bias: "bullish", note: "Safe haven flows" },
    { asset: "Emerging Markets (EEM)", bias: "bearish", note: "Capital outflows, dollar strength" },
  ],
  transition: [
    { asset: "All Asset Classes", bias: "neutral", note: "Uncertainty premium — reduce size, wait for clarity" },
    { asset: "Gold (XAU)", bias: "neutral", note: "Hedge allocation appropriate" },
    { asset: "Short Duration Bonds", bias: "neutral", note: "Defensive positioning" },
  ],
};

function computeRegimeDuration(history: HistoryPoint[], currentRegime: string) {
  if (!history?.length) return null;
  const sorted = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Find the last point where regime changed TO current
  let startDate: Date | null = null;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].quadrant.toLowerCase() === currentRegime.toLowerCase()) {
      startDate = new Date(sorted[i].date);
    } else {
      break;
    }
  }
  if (!startDate) return null;
  const days = Math.floor((Date.now() - startDate.getTime()) / 86400000);
  return { days, startDate };
}

function computeTransitions(history: HistoryPoint[]): Array<{ from: string; to: string; date: string }> {
  if (!history?.length) return [];
  const sorted = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const transitions: { from: string; to: string; date: string }[] = [];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].quadrant !== sorted[i - 1].quadrant) {
      transitions.push({ from: sorted[i - 1].quadrant, to: sorted[i].quadrant, date: sorted[i].date });
    }
  }
  return transitions.slice(-5).reverse(); // Last 5 transitions
}

interface RegimeHistoryTimelineProps {
  history: HistoryPoint[] | undefined;
  currentRegime: string;
}

export function RegimeHistoryTimeline({ history, currentRegime }: RegimeHistoryTimelineProps) {
  const [showPlaybook, setShowPlaybook] = React.useState(false);

  const duration = useMemo(() => computeRegimeDuration(history ?? [], currentRegime), [history, currentRegime]);
  const transitions = useMemo(() => computeTransitions(history ?? []), [history]);

  // Build weekly bars (last 16 weeks)
  const weeklyBars = useMemo(() => {
    if (!history?.length) return [];
    const sorted = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    // Group into weekly buckets
    const bars: { label: string; regime: string; date: string }[] = [];
    const step = Math.max(1, Math.floor(sorted.length / 16));
    for (let i = 0; i < sorted.length; i += step) {
      const pt = sorted[i];
      bars.push({
        label: new Date(pt.date).toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
        regime: pt.quadrant.toLowerCase(),
        date: pt.date,
      });
    }
    return bars.slice(-16);
  }, [history]);

  const cfg = REGIME_CONFIG[currentRegime?.toLowerCase()] ?? { color: "#94A3B8", short: "??" };
  const playbook = REGIME_PLAYBOOK[currentRegime?.toLowerCase()] ?? [];

  return (
    <>
      <div className="mt-2 pt-2 border-t border-border-subtle/50">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-accent-gold" />
            <span className="text-[9px] font-mono uppercase tracking-widest text-text-muted">Regime History Trail</span>
          </div>
          <button
            onClick={() => setShowPlaybook(true)}
            className="text-[9px] font-mono px-2 py-0.5 rounded border border-accent-gold/30 text-accent-gold hover:bg-accent-gold/10 transition-colors"
          >
            LIHAT PLAYBOOK ↗
          </button>
        </div>

        {/* Duration & Last Shift Info */}
        {duration && (
          <div className="flex flex-col gap-1.5 rounded border border-border-subtle bg-surface-elevated/30 p-2">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono text-text-muted">DURASI REZIM AKTIF:</span>
              <span className="text-xs font-mono font-bold" style={{ color: cfg.color }}>
                {duration.days} hari
              </span>
              <span className="text-[9px] text-text-muted font-mono ml-auto">
                (sejak {duration.startDate.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })})
              </span>
            </div>
            
            {transitions.length > 0 ? (
              <div className="flex items-center gap-1.5 text-[9px] font-mono text-text-muted border-t border-border-subtle/50 pt-1.5">
                <span>SHIFT TERAKHIR:</span>
                <span style={{ color: REGIME_CONFIG[transitions[0].from.toLowerCase()]?.color ?? "#94A3B8" }}>
                  {transitions[0].from.toUpperCase()}
                </span>
                <ArrowRight className="w-2.5 h-2.5 opacity-50" />
                <span style={{ color: REGIME_CONFIG[transitions[0].to.toLowerCase()]?.color ?? "#94A3B8" }}>
                  {transitions[0].to.toUpperCase()}
                </span>
                <span className="ml-auto font-bold opacity-80">
                  {new Date(transitions[0].date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[9px] font-mono text-text-muted border-t border-border-subtle/50 pt-1.5">
                <span>SHIFT TERAKHIR:</span>
                <span className="opacity-80">Belum ada transisi dalam riwayat data ini.</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Playbook Modal */}
      {showPlaybook && (
        <RegimeTransitionPlaybook
          regime={currentRegime}
          playbook={playbook}
          color={cfg.color}
          onClose={() => setShowPlaybook(false)}
        />
      )}
    </>
  );
}

interface RegimeTransitionPlaybookProps {
  regime: string;
  playbook: { asset: string; bias: "bullish" | "bearish" | "neutral"; note: string }[];
  color: string;
  onClose: () => void;
}

export function RegimeTransitionPlaybook({ regime, playbook, color, onClose }: RegimeTransitionPlaybookProps) {
  const biasStyle = (bias: "bullish" | "bearish" | "neutral") => {
    if (bias === "bullish") return "text-data-profit bg-data-profit/10 border-data-profit/30";
    if (bias === "bearish") return "text-data-loss bg-data-loss/10 border-data-loss/30";
    return "text-text-muted bg-surface-elevated border-border-subtle";
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.88)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[85vh] flex flex-col rounded-xl border glass overflow-hidden"
        style={{ backgroundColor: "#080808", borderColor: color + "40" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-800 shrink-0">
          <div>
            <span className="text-xs font-mono font-bold uppercase tracking-widest" style={{ color }}>
              REGIME PLAYBOOK — {regime.toUpperCase()}
            </span>
            <p className="text-[10px] text-text-muted font-mono mt-0.5">
              Alokasi aset historis berdasarkan riset institutional desk
            </p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-white p-2 rounded-lg hover:bg-neutral-800 transition-colors text-[10px] font-mono">
            ESC
          </button>
        </div>

        {/* Asset Table */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {playbook.map((item, i) => (
            <div key={i} className="flex items-start gap-3 p-4 rounded-lg border border-neutral-800 bg-neutral-900/40 hover:bg-neutral-800/60 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm font-mono font-bold text-text-primary">{item.asset}</span>
                  <span className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${biasStyle(item.bias)}`}>
                    {item.bias}
                  </span>
                </div>
                <p className="text-[11px] text-text-secondary font-mono leading-relaxed">{item.note}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-neutral-800 shrink-0">
          <p className="text-[9px] text-text-muted font-mono">
            ⚠️ Bukan financial advice. Berdasarkan analisis historis. Selalu lakukan risk management.
          </p>
        </div>
      </div>
    </div>
  );
}