"use client";

import React, { useMemo, useState } from "react";
import { AlertTriangle, TrendingDown, TrendingUp, Minus, ChevronDown, ChevronUp, Zap } from "lucide-react";
import type { CotItem } from "@/types/cot";

// ─── Divergence Score Algorithm ──────────────────────────────────────────────
// Score 0-10:
//   • Base: abs(nonComm_net / total) → normalized to 0-10
//   • Divergence: nonComm and commercial on opposite extremes → +bonus
//   • Historical extreme: if net position > 75th percentile of recent → boost
// Signal: >7 = EXTREME (high probability contrarian), 4-7 = MODERATE, <4 = NEUTRAL
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

  // Ratio of net position to total (0 to 1)
  const netRatio = Math.abs(nonCommNet) / totalNonComm;
  const baseScore = netRatio * 10;

  // Divergence bonus: commercial is on OPPOSITE side of non-commercial
  const isDiverging = (nonCommNet > 0 && commNet < 0) || (nonCommNet < 0 && commNet > 0);
  const divergenceBonus = isDiverging ? 2.5 : 0;

  // Extreme bonus: ratio > 0.6
  const extremeBonus = netRatio > 0.6 ? 1.5 : netRatio > 0.4 ? 0.75 : 0;

  const rawScore = Math.min(10, baseScore + divergenceBonus + extremeBonus);
  const score = parseFloat(rawScore.toFixed(1));

  // Determine signal
  let signal: "EXTREME_LONG" | "EXTREME_SHORT" | "MODERATE_LONG" | "MODERATE_SHORT" | "NEUTRAL";
  if (score >= 7) {
    signal = nonCommNet > 0 ? "EXTREME_LONG" : "EXTREME_SHORT";
  } else if (score >= 4) {
    signal = nonCommNet > 0 ? "MODERATE_LONG" : "MODERATE_SHORT";
  } else {
    signal = "NEUTRAL";
  }

  // Contrarian signal (opposite of speculators → follow commercials/smart money)
  let contrarian: "BEARISH" | "BULLISH" | "NEUTRAL";
  let probability: number;
  let interpretation: string;

  if (signal === "EXTREME_LONG") {
    contrarian = "BEARISH";
    probability = isDiverging ? 74 : 62;
    interpretation = `Spekulan (non-commercial) extreme LONG. Smart money (commercial) ${isDiverging ? "heavy SHORT" : "mixed"}. Historical reversal probability ${probability}% dalam 4-6 minggu.`;
  } else if (signal === "EXTREME_SHORT") {
    contrarian = "BULLISH";
    probability = isDiverging ? 71 : 59;
    interpretation = `Spekulan (non-commercial) extreme SHORT. Smart money (commercial) ${isDiverging ? "heavy LONG" : "mixed"}. Historical reversal probability ${probability}% dalam 4-6 minggu.`;
  } else if (signal === "MODERATE_LONG") {
    contrarian = "BEARISH";
    probability = 52;
    interpretation = `Non-commercial positioning moderate long. Belum extreme — pantau apakah buildup berlanjut.`;
  } else if (signal === "MODERATE_SHORT") {
    contrarian = "BULLISH";
    probability = 52;
    interpretation = `Non-commercial positioning moderate short. Belum extreme — pantau apakah buildup berlanjut.`;
  } else {
    contrarian = "NEUTRAL";
    probability = 50;
    interpretation = `Positioning seimbang. Tidak ada directional signal yang kuat dari COT data.`;
  }

  return { score, signal, contrarian, probability, interpretation };
}

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 7 ? "#FF3864" :
    score >= 4 ? "#F59E0B" :
    "#10B981";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${(score / 10) * 100}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[10px] font-mono font-bold w-8 text-right" style={{ color }}>
        {score}/10
      </span>
    </div>
  );
}

function SignalBadge({ signal, contrarian }: { signal: string; contrarian: "BEARISH" | "BULLISH" | "NEUTRAL" }) {
  if (signal === "NEUTRAL") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[9px] font-mono font-bold uppercase text-text-muted border-border-subtle glass">
        <Minus className="w-2.5 h-2.5" /> NEUTRAL
      </span>
    );
  }
  const isExtreme = signal.startsWith("EXTREME");
  const isBullContrarian = contrarian === "BULLISH";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[9px] font-mono font-bold uppercase ${
        isBullContrarian
          ? "text-data-profit border-data-profit/40 bg-data-profit/10"
          : "text-data-loss border-data-loss/40 bg-data-loss/10"
      } ${isExtreme ? "animate-pulse" : ""}`}
    >
      {isBullContrarian
        ? <TrendingUp className="w-2.5 h-2.5" />
        : <TrendingDown className="w-2.5 h-2.5" />}
      CONTRARIAN {contrarian}
    </span>
  );
}

interface CotDivergenceScannerProps {
  items: CotItem[];
}

export function CotDivergenceScanner({ items }: CotDivergenceScannerProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const signals = useMemo(() => {
    return items
      .map((item) => ({ item, result: computeDivergenceScore(item) }))
      .sort((a, b) => b.result.score - a.result.score);
  }, [items]);

  const extremeSignals = signals.filter((s) => s.result.score >= 7);
  const visibleSignals = showAll ? signals : signals.slice(0, 5);

  return (
    <div className="mt-4 pt-4 border-t border-border-subtle/50">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-text-primary">
            COT Divergence Scanner
          </span>
          {extremeSignals.length > 0 && (
            <span className="text-[8px] font-mono px-1.5 py-0.5 rounded-full bg-data-loss/20 border border-data-loss/30 text-data-loss animate-pulse">
              {extremeSignals.length} EXTREME
            </span>
          )}
        </div>
        <span className="text-[8px] text-text-muted font-mono">Smart Money vs Spekulan</span>
      </div>

      {/* Signal Cards */}
      <div className="space-y-2">
        {visibleSignals.map(({ item, result }) => {
          const isOpen = expanded === item.symbol;
          const isExtreme = result.score >= 7;
          return (
            <div
              key={item.symbol}
              className={`rounded-lg border transition-all ${
                isExtreme
                  ? "border-data-loss/30 bg-data-loss/5"
                  : result.score >= 4
                  ? "border-amber-400/20 bg-amber-400/5"
                  : "border-border-subtle glass"
              }`}
            >
              {/* Card Header */}
              <button
                className="w-full flex items-center gap-3 p-2.5 text-left"
                onClick={() => setExpanded(isOpen ? null : item.symbol)}
              >
                {isExtreme && <AlertTriangle className="w-3 h-3 text-data-loss shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-mono font-bold text-text-primary">{item.name}</span>
                    <SignalBadge signal={result.signal} contrarian={result.contrarian} />
                  </div>
                  <ScoreBar score={result.score} />
                </div>
                <div className="shrink-0">
                  {isOpen
                    ? <ChevronUp className="w-3.5 h-3.5 text-text-muted" />
                    : <ChevronDown className="w-3.5 h-3.5 text-text-muted" />}
                </div>
              </button>

              {/* Expanded Detail */}
              {isOpen && (
                <div className="px-3 pb-3 pt-0 border-t border-white/5">
                  <div className="grid grid-cols-2 gap-2 mt-2 mb-2 text-[9px] font-mono">
                    <div className="p-2 rounded glass border border-border-subtle">
                      <div className="text-text-muted mb-0.5">Non-Comm (Spekulan)</div>
                      <div className="text-text-primary font-bold">
                        L: {item.nonCommercialLong.toLocaleString()} / S: {item.nonCommercialShort.toLocaleString()}
                      </div>
                      <div className={`font-bold mt-0.5 ${(item.nonCommercialLong - item.nonCommercialShort) > 0 ? "text-data-profit" : "text-data-loss"}`}>
                        Net: {((item.nonCommercialLong - item.nonCommercialShort) > 0 ? "+" : "") + (item.nonCommercialLong - item.nonCommercialShort).toLocaleString()}
                      </div>
                      {item.cotIndexLS !== undefined && (
                        <div className="text-text-muted mt-0.5">COT Index: {item.cotIndexLS}</div>
                      )}
                    </div>
                    <div className="p-2 rounded glass border border-border-subtle">
                      <div className="text-text-muted mb-0.5">Commercial (Smart Money)</div>
                      <div className="text-text-primary font-bold">
                        L: {item.commercialLong.toLocaleString()} / S: {item.commercialShort.toLocaleString()}
                      </div>
                      <div className={`font-bold mt-0.5 ${(item.commercialLong - item.commercialShort) > 0 ? "text-data-profit" : "text-data-loss"}`}>
                        Net: {((item.commercialLong - item.commercialShort) > 0 ? "+" : "") + (item.commercialLong - item.commercialShort).toLocaleString()}
                      </div>
                      {item.cotIndexSM !== undefined && (
                        <div className="text-text-muted mt-0.5">COT Index: {item.cotIndexSM}</div>
                      )}
                    </div>
                  </div>
                  {/* DBS */}
                  {item.dbs !== undefined && (
                    <div className="p-2 rounded glass border border-border-subtle mb-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] font-mono text-text-muted uppercase tracking-wider">DBS</span>
                        <span className={`text-[11px] font-mono font-black ${item.dbs >= 4 ? "text-data-profit" : item.dbs <= -4 ? "text-data-loss" : "text-text-muted"}`}>
                          {item.dbs > 0 ? `+${item.dbs}` : item.dbs} · {item.directionBias?.replace(/_/g, " ")}
                        </span>
                      </div>
                    </div>
                  )}
                  {/* WoW Δ */}
                  {item.wowDeltaSM !== undefined && (
                    <div className="p-2 rounded glass border border-border-subtle mb-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] font-mono text-text-muted uppercase tracking-wider">WoW Δ Smart Money</span>
                        <span className={`text-[11px] font-mono font-black ${item.wowDeltaSM >= 0 ? "text-data-profit" : "text-data-loss"}`}>
                          {item.wowDeltaSM > 0 ? "+" : ""}{item.wowDeltaSM.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                  {/* Probability & Interpretation */}
                  <div className="p-2 rounded glass border border-border-subtle">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[8px] font-mono text-text-muted uppercase tracking-wider">Reversal Probability</span>
                      <span className={`text-[11px] font-mono font-black ${result.probability >= 65 ? "text-data-loss" : result.probability >= 55 ? "text-amber-400" : "text-text-muted"}`}>
                        {result.probability}%
                      </span>
                    </div>
                    <p className="text-[9px] text-text-secondary font-mono leading-relaxed">{result.interpretation}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Show more toggle */}
      {signals.length > 5 && (
        <button
          className="mt-2 w-full text-[9px] font-mono text-text-muted hover:text-accent-gold transition-colors py-1.5 border border-border-subtle/50 rounded hover:border-accent-gold/30"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? "TAMPILKAN LEBIH SEDIKIT ▲" : `TAMPILKAN SEMUA ${signals.length} ASET ▼`}
        </button>
      )}

      <p className="text-[8px] text-text-muted font-mono mt-2">
        ⚠️ COT Divergence Score berdasarkan algoritma net positioning. Bukan financial advice.
      </p>
    </div>
  );
}
