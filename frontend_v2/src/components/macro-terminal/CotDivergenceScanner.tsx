"use client";

import React, { useMemo, useState } from "react";
import { AlertTriangle, TrendingDown, TrendingUp, Minus, ChevronDown, ChevronUp, Zap, Filter } from "lucide-react";
import type { CotItem } from "@/types/cot";

// ─── Divergence Score Algorithm ──────────────────────────────────────────────
function computeDivergenceScore(item: CotItem): {
  score: number;
  signal: "EXTREME_LONG" | "EXTREME_SHORT" | "MODERATE_LONG" | "MODERATE_SHORT" | "NEUTRAL";
  contrarian: "BEARISH" | "BULLISH" | "NEUTRAL";
  probability: number;
  interpretation: string;
} {
  const nonCommNet = item.nonCommercialLong - item.nonCommercialShort;
  const commNet = item.commercialLong - item.commercialShort;
  const totalNonComm = item.nonCommercialLong + item.nonCommercialShort;

  if (totalNonComm === 0) {
    return { score: 0, signal: "NEUTRAL", contrarian: "NEUTRAL", probability: 50, interpretation: "Data tidak tersedia." };
  }

  const netRatio = Math.abs(nonCommNet) / totalNonComm;
  const baseScore = netRatio * 10;
  const isDiverging = (nonCommNet > 0 && commNet < 0) || (nonCommNet < 0 && commNet > 0);
  const divergenceBonus = isDiverging ? 2.5 : 0;
  const extremeBonus = netRatio > 0.6 ? 1.5 : netRatio > 0.4 ? 0.75 : 0;
  const rawScore = Math.min(10, baseScore + divergenceBonus + extremeBonus);
  const score = parseFloat(rawScore.toFixed(1));

  let signal: "EXTREME_LONG" | "EXTREME_SHORT" | "MODERATE_LONG" | "MODERATE_SHORT" | "NEUTRAL";
  if (score >= 7) {
    signal = nonCommNet > 0 ? "EXTREME_LONG" : "EXTREME_SHORT";
  } else if (score >= 4) {
    signal = nonCommNet > 0 ? "MODERATE_LONG" : "MODERATE_SHORT";
  } else {
    signal = "NEUTRAL";
  }

  let contrarian: "BEARISH" | "BULLISH" | "NEUTRAL";
  let probability: number;
  let interpretation: string;

  if (signal === "EXTREME_LONG") {
    contrarian = "BEARISH";
    probability = isDiverging ? 74 : 62;
    interpretation = `Spekulan extreme LONG. Smart money ${isDiverging ? "heavy SHORT" : "mixed"}. Reversal prob ${probability}% dalam 4-6 minggu.`;
  } else if (signal === "EXTREME_SHORT") {
    contrarian = "BULLISH";
    probability = isDiverging ? 71 : 59;
    interpretation = `Spekulan extreme SHORT. Smart money ${isDiverging ? "heavy LONG" : "mixed"}. Reversal prob ${probability}% dalam 4-6 minggu.`;
  } else if (signal === "MODERATE_LONG") {
    contrarian = "BEARISH";
    probability = 52;
    interpretation = `Non-commercial moderate long. Belum extreme — pantau buildup.`;
  } else if (signal === "MODERATE_SHORT") {
    contrarian = "BULLISH";
    probability = 52;
    interpretation = `Non-commercial moderate short. Belum extreme — pantau buildup.`;
  } else {
    contrarian = "NEUTRAL";
    probability = 50;
    interpretation = `Positioning seimbang. Tidak ada directional signal kuat.`;
  }

  return { score, signal, contrarian, probability, interpretation };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  const color = score >= 7 ? "#FF3864" : score >= 4 ? "#F59E0B" : "#10B981";
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${(score / 10) * 100}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[9px] font-mono font-bold w-7 text-right shrink-0" style={{ color }}>
        {score}
      </span>
    </div>
  );
}

function ContrarianTag({ contrarian }: { contrarian: "BEARISH" | "BULLISH" | "NEUTRAL" }) {
  if (contrarian === "NEUTRAL") return null;
  const isBull = contrarian === "BULLISH";
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-px rounded text-[7px] font-mono font-bold uppercase ${
        isBull ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10"
      }`}
    >
      {isBull ? <TrendingUp className="w-2 h-2" /> : <TrendingDown className="w-2 h-2" />}
      {contrarian}
    </span>
  );
}

function CompactCard({
  item,
  result,
  isOpen,
  onToggle,
}: {
  item: CotItem;
  result: ReturnType<typeof computeDivergenceScore>;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const [localOpen, setLocalOpen] = React.useState(isOpen);

  // Sync with expandedAll override
  React.useEffect(() => {
    setLocalOpen(isOpen);
  }, [isOpen]);

  const open = localOpen;
  const handleToggle = () => setLocalOpen((v) => !v);

  const isExtreme = result.score >= 7;
  const commNet = item.commercialLong - item.commercialShort;
  const specNet = item.nonCommercialLong - item.nonCommercialShort;

  return (
    <div
      className={`rounded-lg border transition-all ${
        isExtreme
          ? "border-red-500/30 bg-red-500/5 shadow-sm shadow-red-500/10"
          : result.score >= 4
          ? "border-amber-400/20 bg-amber-400/5"
          : "border-border-subtle glass"
      }`}
    >
      {/* Card Header — compact */}
      <button
        className="w-full flex items-center gap-2 p-2 text-left"
        onClick={handleToggle}
      >
        {isExtreme && <AlertTriangle className="w-2.5 h-2.5 text-red-400 shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-mono font-bold text-zinc-100 truncate">{item.name}</span>
            <ContrarianTag contrarian={result.contrarian} />
          </div>
          <ScoreBar score={result.score} />
        </div>
        <div className="shrink-0 flex items-center gap-1">
          <span
            className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded ${
              isExtreme ? "text-red-400 bg-red-400/15 border border-red-500/30" : result.score >= 4 ? "text-amber-400 bg-amber-400/15" : "text-zinc-400 bg-zinc-500/10"
            }`}
          >
            {isExtreme ? "EXTREME" : result.score >= 4 ? "HIGH" : ""}
          </span>
          {open ? (
            <ChevronUp className="w-3 h-3 text-zinc-400" />
          ) : (
            <ChevronDown className="w-3 h-3 text-zinc-400" />
          )}
        </div>
      </button>

      {/* Expanded Detail Drawer — smooth accordion */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: open ? "400px" : "0px", opacity: open ? 1 : 0 }}
      >
        <div className="px-2.5 pb-2.5 pt-0 border-t border-white/10 space-y-2 mt-1">
          {/* Position summary — 2 col */}
          <div className="grid grid-cols-2 gap-1.5 mt-2 text-[8px] font-mono">
            <div className="p-1.5 rounded glass border border-border-subtle bg-black/20">
              <div className="text-zinc-300 font-medium mb-0.5">Spekulan (Non-Comm)</div>
              <div className="text-zinc-100 font-semibold">
                L: {item.nonCommercialLong.toLocaleString()} / S: {item.nonCommercialShort.toLocaleString()}
              </div>
              <div className={`font-bold mt-0.5 text-[9px] ${specNet > 0 ? "text-emerald-400" : "text-red-400"}`}>
                Net: {specNet > 0 ? "+" : ""}{specNet.toLocaleString()}
              </div>
            </div>
            <div className="p-1.5 rounded glass border border-border-subtle bg-black/20">
              <div className="text-zinc-300 font-medium mb-0.5">Smart Money (Comm)</div>
              <div className="text-zinc-100 font-semibold">
                L: {item.commercialLong.toLocaleString()} / S: {item.commercialShort.toLocaleString()}
              </div>
              <div className={`font-bold mt-0.5 text-[9px] ${commNet > 0 ? "text-emerald-400" : "text-red-400"}`}>
                Net: {commNet > 0 ? "+" : ""}{commNet.toLocaleString()}
              </div>
            </div>
          </div>

          {/* WoW Delta + DBS row */}
          <div className="grid grid-cols-2 gap-1.5 text-[8px] font-mono">
            {item.wowDeltaSM !== undefined && (
              <div className="p-1.5 rounded glass border border-border-subtle bg-black/20">
                <div className="text-zinc-300 font-medium">WoW Δ Smart Money</div>
                <div className={`font-bold mt-0.5 text-[9px] ${item.wowDeltaSM >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {item.wowDeltaSM > 0 ? "+" : ""}{item.wowDeltaSM.toLocaleString()}
                </div>
              </div>
            )}
            {item.dbs !== undefined && (
              <div className="p-1.5 rounded glass border border-border-subtle bg-black/20">
                <div className="text-zinc-300 font-medium">DBS Score</div>
                <div className={`font-bold mt-0.5 text-[9px] ${item.dbs >= 4 ? "text-emerald-400" : item.dbs <= -4 ? "text-red-400" : "text-zinc-300"}`}>
                  {item.dbs > 0 ? "+" : ""}{item.dbs} · {item.directionBias?.replace(/_/g, " ")}
                </div>
              </div>
            )}
          </div>

          {/* Probability & Interpretation */}
          <div className="p-2 rounded glass border border-border-subtle bg-black/30">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[8px] font-mono text-zinc-300 font-semibold uppercase tracking-wider">Reversal Probability</span>
              <span className={`text-[11px] font-mono font-black ${result.probability >= 65 ? "text-red-400 drop-shadow-[0_0_8px_rgba(255,56,100,0.5)]" : result.probability >= 55 ? "text-amber-400" : "text-zinc-300"}`}>
                {result.probability}%
              </span>
            </div>
            {/* Probability Gauge Bar */}
            <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden mb-1.5 border border-white/10">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  result.probability >= 65 ? "bg-gradient-to-r from-amber-500 to-red-500 shadow-[0_0_10px_rgba(255,56,100,0.6)]" : "bg-amber-400"
                }`}
                style={{ width: `${result.probability}%` }}
              />
            </div>
            <p className="text-[8px] text-zinc-300 font-mono leading-relaxed">{result.interpretation}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Filter Tabs ─────────────────────────────────────────────────────────────

type FilterKey = "all" | "extreme" | "metals" | "currencies" | "indices" | "energy";

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "extreme", label: "Extreme" },
  { key: "metals", label: "Metals" },
  { key: "currencies", label: "Forex" },
  { key: "indices", label: "Indices" },
  { key: "energy", label: "Energy" },
];

function matchesFilter(item: CotItem, filter: FilterKey, score: number): boolean {
  if (filter === "all") return true;
  if (filter === "extreme") return score >= 7;
  if (filter === "metals") return item.category === "Metals";
  if (filter === "currencies") return item.category === "Currencies";
  if (filter === "indices") return item.category === "Indices";
  if (filter === "energy") return item.category === "Energy";
  return true;
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface CotDivergenceScannerProps {
  items: CotItem[];
}

export function CotDivergenceScanner({ items }: CotDivergenceScannerProps) {
  const [expandedAll, setExpandedAll] = useState<boolean>(true);
  const [filter, setFilter] = useState<FilterKey>("extreme");

  const signals = useMemo(() => {
    return items
      .map((item) => ({ item, result: computeDivergenceScore(item) }))
      .sort((a, b) => b.result.score - a.result.score);
  }, [items]);

  const filteredSignals = useMemo(
    () => signals.filter(({ item, result }) => matchesFilter(item, filter, result.score)),
    [signals, filter]
  );

  const extremeCount = signals.filter((s) => s.result.score >= 7).length;

  return (
    <div className="mt-4 pt-4 border-t border-border-subtle/50">
      {/* Section Header + Filter Tabs */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-text-primary">
            COT Divergence
          </span>
          {extremeCount > 0 && (
            <span className="text-[8px] font-mono px-1.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 animate-pulse">
              {extremeCount} EXTREME
            </span>
          )}
        </div>
        <span className="text-[8px] text-text-muted font-mono hidden sm:inline">Smart Money vs Spekulan</span>
      </div>

      {/* Filter Pills */}
      <div className="flex items-center gap-1 mb-2.5 overflow-x-auto custom-scrollbar pb-0.5">
        <Filter className="w-2.5 h-2.5 text-text-muted shrink-0 mr-0.5" />
        {FILTER_TABS.map((tab) => {
          const isActive = filter === tab.key;
          const count = tab.key === "all"
            ? signals.length
            : tab.key === "extreme"
            ? extremeCount
            : signals.filter((s) => matchesFilter(s.item, tab.key, s.result.score)).length;
          return (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`shrink-0 px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase transition-all border ${
                isActive
                  ? "bg-amber-400/15 border-amber-400/40 text-amber-400"
                  : "border-border-subtle/50 text-text-muted hover:text-text-primary hover:border-border-subtle"
              }`}
            >
              {tab.label}
              <span className="ml-0.5 opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Signal Grid — 2 columns compact */}
      {filteredSignals.length === 0 ? (
        <div className="text-center py-4 text-[9px] font-mono text-text-muted">
          Tidak ada aset yang cocok dengan filter ini.
        </div>
      ) : (
        <div className="space-y-2">
          {/* Global Toggle Header */}
          <div className="flex items-center justify-between px-1">
            <span className="text-[8px] font-mono text-zinc-500 uppercase">Showing {filteredSignals.length} markets</span>
            <button
              onClick={() => setExpandedAll(!expandedAll)}
              className="text-[8px] font-mono text-amber-400 hover:underline bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/25"
            >
              {expandedAll ? "COLLAPSE ALL" : "EXPAND ALL"}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
            {filteredSignals.map(({ item, result }) => (
              <CompactCard
                key={item.symbol}
                item={item}
                result={result}
                isOpen={expandedAll || result.score >= 7}
                onToggle={() => {
                  // If user toggles individual, we can just let CompactCard handle its own state if needed, or keep it simple with expandedAll
                }}
              />
            ))}
          </div>
        </div>
      )}

      <p className="text-[7px] text-text-muted font-mono mt-2">
        ⚠️ COT Divergence Score berdasarkan algoritma net positioning. Bukan financial advice.
      </p>
    </div>
  );
}
