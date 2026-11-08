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
      className={`rounded-xl border transition-all duration-200 ${
        isExtreme
          ? "border-red-500/25 bg-red-500/[0.03]"
          : result.score >= 4
          ? "border-amber-400/15 bg-amber-400/[0.03]"
          : "border-white/5 bg-white/[0.02]"
      } hover:border-white/10`}
    >
      {/* Card Header */}
      <button
        className="w-full flex items-center gap-3 p-3 text-left"
        onClick={handleToggle}
      >
        {isExtreme && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-semibold text-zinc-100 truncate">{item.name}</span>
            <ContrarianTag contrarian={result.contrarian} />
          </div>
          <ScoreBar score={result.score} />
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          <span
            className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border ${
              isExtreme
                ? "text-red-400 bg-red-400/10 border-red-500/20"
                : result.score >= 4
                ? "text-amber-400 bg-amber-400/10 border-amber-400/20"
                : "text-zinc-500 bg-zinc-500/5 border-white/5"
            }`}
          >
            {isExtreme ? "EXTREME" : result.score >= 4 ? "HIGH" : "MOD"}
          </span>
          {open ? (
            <ChevronUp className="w-3.5 h-3.5 text-zinc-500" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
          )}
        </div>
      </button>

      {/* Expanded Detail */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: open ? "500px" : "0px", opacity: open ? 1 : 0 }}
      >
        <div className="px-3 pb-3 pt-0 border-t border-white/5 space-y-2.5 mt-2">
          {/* Position summary — 2 col */}
          <div className="grid grid-cols-2 gap-2 text-[9px] font-mono">
            <div className="p-2.5 rounded-lg border border-white/5 bg-black/30">
              <div className="text-zinc-400 font-medium mb-1 uppercase tracking-wider text-[8px]">Spekulan (Non-Comm)</div>
              <div className="text-zinc-200 font-semibold tabular-nums">
                L: {item.nonCommercialLong.toLocaleString()}
              </div>
              <div className="text-zinc-200 font-semibold tabular-nums">
                S: {item.nonCommercialShort.toLocaleString()}
              </div>
              <div className={`font-bold mt-1 text-[10px] tabular-nums ${specNet > 0 ? "text-emerald-400" : "text-red-400"}`}>
                Net: {specNet > 0 ? "+" : ""}{specNet.toLocaleString()}
              </div>
            </div>
            <div className="p-2.5 rounded-lg border border-white/5 bg-black/30">
              <div className="text-zinc-400 font-medium mb-1 uppercase tracking-wider text-[8px]">Smart Money (Comm)</div>
              <div className="text-zinc-200 font-semibold tabular-nums">
                L: {item.commercialLong.toLocaleString()}
              </div>
              <div className="text-zinc-200 font-semibold tabular-nums">
                S: {item.commercialShort.toLocaleString()}
              </div>
              <div className={`font-bold mt-1 text-[10px] tabular-nums ${commNet > 0 ? "text-emerald-400" : "text-red-400"}`}>
                Net: {commNet > 0 ? "+" : ""}{commNet.toLocaleString()}
              </div>
            </div>
          </div>

          {/* WoW Delta + DBS row */}
          <div className="grid grid-cols-2 gap-2 text-[9px] font-mono">
            {item.wowDeltaSM !== undefined && (
              <div className="p-2 rounded-lg border border-white/5 bg-black/30">
                <div className="text-zinc-400 font-medium uppercase tracking-wider text-[8px]">WoW Δ SM</div>
                <div className={`font-bold mt-0.5 text-[10px] tabular-nums ${item.wowDeltaSM >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {item.wowDeltaSM > 0 ? "+" : ""}{item.wowDeltaSM.toLocaleString()}
                </div>
              </div>
            )}
            {item.dbs !== undefined && (
              <div className="p-2 rounded-lg border border-white/5 bg-black/30">
                <div className="text-zinc-400 font-medium uppercase tracking-wider text-[8px]">DBS Score</div>
                <div className={`font-bold mt-0.5 text-[10px] tabular-nums ${item.dbs >= 4 ? "text-emerald-400" : item.dbs <= -4 ? "text-red-400" : "text-zinc-300"}`}>
                  {item.dbs > 0 ? "+" : ""}{item.dbs} · {item.directionBias?.replace(/_/g, " ")}
                </div>
              </div>
            )}
          </div>

          {/* Probability & Interpretation */}
          <div className="p-3 rounded-lg border border-white/5 bg-black/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[8px] font-mono text-zinc-400 font-semibold uppercase tracking-wider">Reversal Probability</span>
              <span className={`text-[12px] font-mono font-bold tabular-nums ${
                result.probability >= 65 ? "text-red-400" : result.probability >= 55 ? "text-amber-400" : "text-zinc-300"
              }`}>
                {result.probability}%
              </span>
            </div>
            {/* Probability Gauge Bar */}
            <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden mb-2 border border-white/5">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  result.probability >= 65
                    ? "bg-gradient-to-r from-amber-500 to-red-500"
                    : "bg-amber-400"
                }`}
                style={{ width: `${result.probability}%` }}
              />
            </div>
            <p className="text-[9px] text-zinc-300 font-mono leading-relaxed">{result.interpretation}</p>
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
  const [expandedAll, setExpandedAll] = useState<boolean>(false);
  const [filter, setFilter] = useState<FilterKey>("all");

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
    <div className="mt-2 pt-4 pb-3 px-6 border-t border-border-subtle/50">
      {/* Section Header + Filter Tabs */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-200">
            COT Divergence
          </span>
          {extremeCount > 0 && (
            <span className="text-[7px] font-mono px-1.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/20 text-red-400 animate-pulse">
              {extremeCount} EXTREME
            </span>
          )}
        </div>
        <span className="text-[8px] text-zinc-500 font-mono hidden sm:inline">Smart Money vs Spekulan</span>
      </div>

      {/* Filter Pills */}
      <div className="flex items-center gap-1.5 mb-3 overflow-x-auto custom-scrollbar pb-0.5">
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
              className={`shrink-0 px-2.5 py-1 rounded-lg text-[8px] font-mono font-bold uppercase transition-all border ${
                isActive
                  ? "bg-amber-400/10 border-amber-400/30 text-amber-400"
                  : "border-white/5 text-zinc-500 hover:text-zinc-300 hover:border-white/10 bg-white/[0.02]"
              }`}
            >
              {tab.label}
              <span className={`ml-1 ${isActive ? "text-amber-400/70" : "text-zinc-600"}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Signal Grid — 2 columns compact */}
      {filteredSignals.length === 0 ? (
        <div className="text-center py-8 text-[10px] font-mono text-zinc-600">
          Tidak ada aset yang cocok dengan filter ini.
        </div>
      ) : (
        <div className="space-y-2">
          {/* Global Toggle Header */}
          <div className="flex items-center justify-between px-1">
            <span className="text-[8px] font-mono text-zinc-600 uppercase tracking-wider">
              {filteredSignals.length} markets
            </span>
            <button
              onClick={() => setExpandedAll(!expandedAll)}
              className="text-[8px] font-mono text-zinc-500 hover:text-amber-400 transition-colors bg-white/[0.03] hover:bg-amber-400/10 px-2.5 py-1 rounded-lg border border-white/5 hover:border-amber-400/20"
            >
              {expandedAll ? "COLLAPSE ALL" : "EXPAND ALL"}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
            {filteredSignals.map(({ item, result }) => (
              <CompactCard
                key={item.symbol}
                item={item}
                result={result}
                isOpen={expandedAll}
                onToggle={() => {
                  // If user toggles individual, we can just let CompactCard handle its own state if needed, or keep it simple with expandedAll
                }}
              />
            ))}
          </div>
        </div>
      )}

      <p className="text-[7px] text-zinc-600 font-mono mt-3 text-center">
        ⚠️ COT Divergence Score berdasarkan algoritma net positioning. Bukan financial advice.
      </p>
    </div>
  );
}
