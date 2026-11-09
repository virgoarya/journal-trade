"use client";

import React, { useState } from "react";
import { TrendingUp, TrendingDown, Minus, Brain, X, AlertTriangle, Zap, BarChart3, Loader2, ArrowUpRight, ArrowDownRight } from "lucide-react";
import type { CotItem, CotAnalysis, MarketPhase } from "@/types/cot";
import { analyzeCotData } from "@/lib/cot-service";
import { CotDivergenceScanner } from "./CotDivergenceScanner";

const CATEGORY_ORDER = ["Energy", "Metals", "Currencies", "Indices"];

const CATEGORY_ICONS: Record<string, string> = {
  Energy: "⚡",
  Metals: "🥇",
  Currencies: "💱",
  Indices: "📊",
};

function fmt(v: number) {
  return v.toLocaleString("en-US");
}

function netColor(net: number) {
  if (net > 0) return "text-emerald-400";
  if (net < 0) return "text-red-400";
  return "text-zinc-400";
}

function getPhaseReasoning(item: CotItem): string {
  const smNet = item.commercialLong - item.commercialShort;
  const lsNet = item.nonCommercialLong - item.nonCommercialShort;
  const retailNet = item.retailLong - item.retailShort;
  const phaseLabel = item.phase?.label || "NEUTRAL";
  const lsIndex = item.cotIndexLS ?? 50;

  const smText = smNet > 0 ? `Net Long (+${fmt(smNet)})` : `Net Short (${fmt(smNet)})`;
  const lsText = lsNet > 0 ? `Net Long (+${fmt(lsNet)})` : `Net Short (${fmt(lsNet)})`;
  const retailText = retailNet > 0 ? `Net Long (+${fmt(retailNet)})` : `Net Short (${fmt(retailNet)})`;

  const smDesc = smNet > 0 ? "Smart Money Akumulasi" : "Smart Money Hedging/Distribusi";
  const lsDesc = lsIndex >= 75 ? "Spekulan Extreme Long (FOMO)" : lsIndex <= 25 ? "Spekulan Extreme Short (Panik)" : "Spekulan Posisi Moderat";
  const retailIndex = item.cotIndexRetail ?? 50;
  const retailDesc = retailIndex >= 75 ? "Retail Extreme Long (Euphoria)" : retailIndex <= 25 ? "Retail Extreme Short (Kapitulasi)" : "Retail Posisi Moderat";

  if (phaseLabel === "ACCUMULATION") {
    return `[ACCUMULATION]\n• Smart Money: ${smText} (${smDesc})\n• Large Specs: ${lsText} (${lsDesc})\n• Retail: ${retailText} (Index ${retailIndex}%)\n• Reasoning: Konfirmasi institusional membeli saat spekulan & retail panik jual. Smart traders follow SM entry.`;
  }
  if (phaseLabel === "DISTRIBUTION") {
    return `[DISTRIBUTION]\n• Smart Money: ${smText} (${smDesc})\n• Large Specs: ${lsText} (${lsDesc})\n• Retail: ${retailText} (Index ${retailIndex}%)\n• Reasoning: Institusi melepas inventory saat spekulan & retail euphoria/FOMO. Waspada reversal.`;
  }
  if (phaseLabel === "MARK UP") {
    return `[MARK UP]\n• Smart Money: ${smText} (Anchor Long)\n• Large Specs: ${lsText} (Trend Participation)\n• Retail: ${retailText} (Index ${retailIndex}%)\n• Reasoning: Tren naik sehat. Institusi mempertahankan long, spekulan mulai ikut mendorong harga.`;
  }
  if (phaseLabel === "MARK DOWN") {
    return `[MARK DOWN]\n• Smart Money: ${smText} (Anchor Short)\n• Large Specs: ${lsText} (Trend Participation)\n• Retail: ${retailText} (Index ${retailIndex}%)\n• Reasoning: Tren turun kuat. Institusi mempertahankan short, spekulan ikut menekan harga.`;
  }
  return `[NEUTRAL]\n• Smart Money: ${smText}\n• Large Specs: ${lsText}\n• Retail: ${retailText} (Index ${retailIndex}%)\n• Reasoning: Tidak ada arah institusional yang dominan. Pasar konsolidasi.`;
}

function getDbsReasoning(item: CotItem): string {
  const dbs = item.dbs ?? 0;
  const bias = item.directionBias?.replace(/_/g, " ") || "NEUTRAL";
  let action = "Wait / Sideways";
  if (dbs >= 4) action = "High Conviction BUY";
  else if (dbs <= -4) action = "High Conviction SELL";
  else if (dbs > 0) action = "Mild Bullish";
  else if (dbs < 0) action = "Mild Bearish";

  return `Direction Bias Score: ${dbs > 0 ? `+${dbs}` : dbs} (${bias})\n• Rekomendasi: ${action}\n• Kalkulasi: Berdasarkan posisi Smart Money, divergensi dengan Large Specs, dan perubahan mingguan (WoW).`;
}

function PhaseBadge({ phase }: { phase?: MarketPhase }) {
  if (!phase) return null;

  const colorMap: Record<string, string> = {
    green: "text-emerald-400 border-emerald-400/30 bg-emerald-400/5",
    yellow: "text-amber-400 border-amber-400/30 bg-amber-400/5",
    red: "text-red-400 border-red-400/30 bg-red-400/5",
    blue: "text-blue-400 border-blue-400/30 bg-blue-400/5",
    gray: "text-zinc-400 border-zinc-400/30 bg-zinc-400/5",
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-tighter ${colorMap[phase.color]}`}>
      {phase.label}
      {phase.isWarning && <AlertTriangle className="w-2.5 h-2.5" />}
    </span>
  );
}

function NetBar({ long, short }: { long: number; short: number }) {
  const total = long + short;
  if (total === 0) return null;
  const pct = Math.round((long / total) * 100);
  return (
    <div className="h-1 w-full bg-black/40 rounded-full overflow-hidden mt-1.5 border border-white/5">
      <div
        className="h-full bg-gradient-to-r from-emerald-500/80 to-emerald-400 rounded-full transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function PositionCell({ long, short, label, cotIndex }: { long: number; short: number; label: string; cotIndex?: number }) {
  const net = long - short;
  const idxColor = cotIndex !== undefined
    ? cotIndex >= 75 || cotIndex <= 25 ? "text-amber-400 border-amber-400/30" : "text-zinc-400 border-white/5"
    : "text-zinc-600 border-white/5";
  return (
    <div className="flex flex-col gap-0.5 min-w-[120px]">
      <div className="flex justify-between items-end font-mono text-[10px]">
        <span className="text-zinc-500 uppercase tracking-tighter">{label}</span>
        <span className="text-zinc-300 font-medium">{fmt(long)} / {fmt(short)}</span>
      </div>
      <div className="flex justify-end items-center gap-2">
        <div className={`font-mono text-[11px] font-bold tabular-nums ${netColor(net)}`}>
          {net > 0 ? "+" : ""}{fmt(net)}
        </div>
        {cotIndex !== undefined && (
          <span className={`text-[8px] font-mono font-bold tabular-nums px-1 py-0.5 rounded bg-black/40 ${idxColor}`}>
            {cotIndex}%
          </span>
        )}
      </div>
      <NetBar long={long} short={short} />
    </div>
  );
}

function AiModal({ item, onClose }: { item: CotItem; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CotAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ran, setRan] = useState(false);

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    setRan(true);
    try {
      const res = await analyzeCotData(item);
      if (res) setResult(res);
      else setError("AI tidak dapat menghasilkan analisis. Coba lagi.");
    } catch {
      setError("Terjadi kesalahan saat menghubungi AI Engine.");
    } finally {
      setLoading(false);
    }
  }

  const commNet = item.commercialLong - item.commercialShort;
  const specNet = item.nonCommercialLong - item.nonCommercialShort;
  const retailNet = item.retailLong - item.retailShort;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-hidden" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity duration-300" />
      <div
        className="relative w-full max-w-xl glass border border-accent-gold/20 rounded-2xl overflow-hidden shadow-2xl shadow-accent-gold/5 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4 bg-accent-gold/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent-gold/10 border border-accent-gold/20">
              <Brain className="w-5 h-5 text-accent-gold" />
            </div>
            <div>
              <h3 className="text-accent-gold font-bold text-sm uppercase tracking-widest">COT Intelligence Analyzer</h3>
              <p className="text-zinc-500 text-[10px] font-mono">{item.name} • {item.symbol}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/5 text-zinc-500 hover:text-white transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Snapshot data */}
        <div className="grid grid-cols-3 gap-4 px-6 py-4 border-b border-white/5 bg-black/20 shrink-0">
          <div className="p-2 rounded-lg border border-white/5 bg-white/5">
            <div className="text-zinc-500 text-[9px] mb-1 uppercase tracking-widest font-bold">Smart Money</div>
            <div className={`font-mono font-bold text-base tabular-nums ${netColor(commNet)}`}>{commNet > 0 ? "+" : ""}{fmt(commNet)}</div>
            <div className="text-zinc-500 text-[8px] uppercase">{commNet > 0 ? "Net Long" : commNet < 0 ? "Net Short" : "Neutral"}</div>
          </div>
          <div className="p-2 rounded-lg border border-white/5 bg-white/5">
            <div className="text-zinc-500 text-[9px] mb-1 uppercase tracking-widest font-bold">Large Specs</div>
            <div className={`font-mono font-bold text-base tabular-nums ${netColor(specNet)}`}>{specNet > 0 ? "+" : ""}{fmt(specNet)}</div>
            <div className="text-zinc-500 text-[8px] uppercase">{specNet > 0 ? "Net Long" : specNet < 0 ? "Net Short" : "Neutral"}</div>
          </div>
          <div className="p-2 rounded-lg border border-white/5 bg-white/5">
            <div className="text-zinc-500 text-[9px] mb-1 uppercase tracking-widest font-bold">Retail</div>
            <div className={`font-mono font-bold text-base tabular-nums ${netColor(retailNet)}`}>{retailNet > 0 ? "+" : ""}{fmt(retailNet)}</div>
            <div className="text-zinc-500 text-[8px] uppercase">{item.retailLong > item.retailShort ? "Net Long" : "Net Short"}</div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          {!ran && (
            <div className="flex flex-col items-center justify-center py-10 gap-4">
              <div className="relative">
                <Brain className="w-16 h-16 text-accent-gold/20" />
                <Zap className="w-6 h-6 text-accent-gold absolute -top-1 -right-1 animate-pulse" />
              </div>
              <p className="text-zinc-400 text-sm text-center max-w-sm">Menganalisis data positioning institusi dan divergence untuk memberikan rekomendasi bias trading.</p>
              <button
                onClick={runAnalysis}
                className="flex items-center gap-2 px-8 py-3 bg-accent-gold text-black font-bold text-sm rounded-xl hover:bg-yellow-400 transition-all shadow-lg shadow-accent-gold/20 active:scale-95"
              >
                RUN AI ANALYSIS
              </button>
            </div>
          )}
          {ran && loading && (
            <div className="flex flex-col items-center justify-center py-10 gap-4">
              <Loader2 className="w-10 h-10 text-accent-gold animate-spin" />
              <p className="text-zinc-400 text-sm animate-pulse tracking-widest font-mono text-[10px]">CORRELATING DATA FLOWS...</p>
            </div>
          )}
          {ran && !loading && error && (
            <div className="flex items-start gap-3 p-4 rounded-xl border border-data-loss/20 bg-data-loss/5">
              <AlertTriangle className="w-5 h-5 text-data-loss shrink-0" />
              <p className="text-data-loss text-sm">{error}</p>
            </div>
          )}
          {ran && !loading && result && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-emerald-500/10 bg-emerald-500/5 transition-all hover:border-emerald-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest">Momentum Analysis</span>
                </div>
                <p className="text-zinc-200 text-xs leading-relaxed">{result.momentum}</p>
              </div>
              <div className="p-4 rounded-xl border border-accent-gold/10 bg-accent-gold/5 transition-all hover:border-accent-gold/30">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-accent-gold" />
                  <span className="text-accent-gold text-[10px] font-bold uppercase tracking-widest">Critical Warnings</span>
                </div>
                <p className="text-zinc-200 text-xs leading-relaxed">{result.warnings}</p>
              </div>
              <div className="p-4 rounded-xl border border-blue-500/10 bg-blue-500/5 transition-all hover:border-blue-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-blue-400" />
                  <span className="text-blue-400 text-[10px] font-bold uppercase tracking-widest">Executive Summary</span>
                </div>
                <p className="text-zinc-200 text-xs leading-relaxed font-medium">{result.conclusion}</p>
              </div>
              <button
                onClick={runAnalysis}
                className="w-full py-2 text-[10px] font-mono text-zinc-500 hover:text-accent-gold border border-white/5 hover:border-accent-gold/30 rounded-lg transition-all uppercase tracking-widest"
              >
                Re-Scan Market Data
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/5 px-6 py-3 flex items-center justify-between text-[9px] text-zinc-500 bg-black/40 shrink-0 font-mono">
          <span>SOURCE: CFTC DATA STREAM</span>
          <span>SYSTEM: 9ROUTER AI • v2.1</span>
        </div>
      </div>
    </div>
  );
}

interface CotPanelClientProps {
  cotData: CotItem[];
}

export function CotPanelClient({ cotData }: CotPanelClientProps) {
  const [analyzeItem, setAnalyzeItem] = useState<CotItem | null>(null);

  // Group by category
  const grouped: Record<string, CotItem[]> = {};
  for (const item of cotData) {
    const cat = item.category || "Other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  }
  const sortedCategories = CATEGORY_ORDER.filter((c) => grouped[c]).concat(
    Object.keys(grouped).filter((c) => !CATEGORY_ORDER.includes(c))
  );

  // Find latest release date overall
  const latestDate = cotData.reduce((acc, item) => {
    if (!item.lastUpdate) return acc;
    return item.lastUpdate > acc ? item.lastUpdate : acc;
  }, "");

  return (
    <div className="flex flex-col h-full w-full glass overflow-hidden relative border border-white/5">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-3 shrink-0 bg-white/5">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
          </div>
          <h2 className="font-bold text-zinc-100 uppercase tracking-[0.2em] text-[11px]">
            Institutional Positioning (COT)
          </h2>
        </div>
        {latestDate && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/40 border border-white/5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] text-zinc-400 font-mono tracking-widest uppercase">
              CFTC RELEASE: {new Date(latestDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </div>
        )}
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {cotData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-zinc-500">
            <AlertTriangle className="w-8 h-8 opacity-20" />
            <p className="text-sm font-mono tracking-widest uppercase opacity-50">No Data Stream Available</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-20">
              <tr className="bg-[#080808] border-b border-white/10">
                <th className="px-5 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Asset</th>
                <th className="px-3 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-center">Bias</th>
                <th className="px-3 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-center">Score (SM/LS)</th>
                <th className="px-3 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-center">DBS</th>
                <th className="px-4 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Commercials</th>
                <th className="px-4 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Large Specs</th>
                <th className="px-4 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Small Retail</th>
                <th className="px-3 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-center">WoW</th>
                <th className="px-5 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right">Intel</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {sortedCategories.map((category) => (
                <React.Fragment key={category}>
                  {/* Category Separator */}
                  <tr className="bg-white/5 border-y border-white/5">
                    <td colSpan={9} className="px-5 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px]">{CATEGORY_ICONS[category] || "📌"}</span>
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">
                          {category}
                        </span>
                      </div>
                    </td>
                  </tr>
                  {/* Rows */}
                  {grouped[category].map((item) => (
                    <tr
                      key={item.symbol}
                      className="group border-b border-white/5 hover:bg-white/[0.03] transition-all duration-300"
                    >
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-zinc-100 text-[13px] tracking-tight group-hover:text-accent-gold transition-colors">{item.name}</span>
                          <span className="text-zinc-500 text-[10px] font-mono tracking-widest">{item.symbol}</span>
                        </div>
                      </td>
                      <td className="px-3 py-4 text-center">
                        <div title={getPhaseReasoning(item)}>
                          <PhaseBadge phase={item.phase} />
                        </div>
                      </td>
                      <td className="px-3 py-4 text-center">
                        <div className="flex flex-col items-center gap-0.5" title={`COT Index (0-100% over 52w):\n- Smart Money: ${item.cotIndexSM ?? 50}%\n- Large Specs: ${item.cotIndexLS ?? 50}%\n- Retail: ${item.cotIndexRetail ?? 50}%`}>
                          <div className="flex items-center justify-center gap-1">
                            <span className={`w-7 h-6 flex items-center justify-center rounded bg-black/40 border border-white/5 font-mono text-[9px] font-bold tabular-nums ${(item.cotIndexSM ?? 50) >= 70 ? "text-emerald-400" : (item.cotIndexSM ?? 50) <= 30 ? "text-red-400" : "text-zinc-400"}`}>
                              {item.cotIndexSM ?? "—"}
                            </span>
                            <span className="text-zinc-700 font-mono text-[9px]">/</span>
                            <span className={`w-7 h-6 flex items-center justify-center rounded bg-black/40 border border-white/5 font-mono text-[9px] font-bold tabular-nums ${(item.cotIndexLS ?? 50) >= 70 ? "text-emerald-400" : (item.cotIndexLS ?? 50) <= 30 ? "text-red-400" : "text-zinc-400"}`}>
                              {item.cotIndexLS ?? "—"}
                            </span>
                          </div>
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-[7px] font-mono text-zinc-600 uppercase tracking-wider">Rtl</span>
                            <span className={`w-7 h-4 flex items-center justify-center rounded bg-black/40 border border-white/5 font-mono text-[8px] font-bold tabular-nums ${(item.cotIndexRetail ?? 50) >= 70 ? "text-emerald-400" : (item.cotIndexRetail ?? 50) <= 30 ? "text-red-400" : "text-zinc-400"}`}>
                              {item.cotIndexRetail ?? "—"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-4 text-center">
                        {item.dbs !== undefined ? (
                          <div title={getDbsReasoning(item)} className={`inline-flex items-center justify-center min-w-[32px] h-6 px-1.5 rounded-md font-mono text-[11px] font-black tabular-nums border ${
                            item.dbs >= 4 ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_10px_rgba(52,211,153,0.1)]" :
                            item.dbs >= 1 ? "text-emerald-400/80 bg-emerald-500/5 border-emerald-500/10" :
                            item.dbs <= -4 ? "text-red-400 bg-red-500/10 border-red-500/30 shadow-[0_0_10px_rgba(248,113,113,0.1)]" :
                            item.dbs <= -1 ? "text-red-400/70 bg-red-500/5 border-red-500/10" :
                            "text-zinc-500 bg-white/5 border-white/10"
                          }`}>
                            {item.dbs > 0 ? `+${item.dbs}` : item.dbs}
                          </div>
                        ) : (
                          <span className="text-zinc-800 font-mono text-[10px]">EMPTY</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div title={`Smart Money (Commercials Net: ${(item.commercialLong - item.commercialShort).toLocaleString()}): Long ${item.commercialLong.toLocaleString()} vs Short ${item.commercialShort.toLocaleString()}\nSmart Money COT Index (52w): ${item.cotIndexSM ?? 50}%`}>
                          <PositionCell long={item.commercialLong} short={item.commercialShort} label="Smart Money" cotIndex={item.cotIndexSM} />
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div title={`Large Specs Net: ${(item.nonCommercialLong - item.nonCommercialShort).toLocaleString()}: Long ${item.nonCommercialLong.toLocaleString()} vs Short ${item.nonCommercialShort.toLocaleString()}\nLarge Specs COT Index (52w): ${item.cotIndexLS ?? 50}%`}>
                          <PositionCell long={item.nonCommercialLong} short={item.nonCommercialShort} label="Large Specs" cotIndex={item.cotIndexLS} />
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div title={`Retailers Net: ${(item.retailLong - item.retailShort).toLocaleString()}: Long ${item.retailLong.toLocaleString()} vs Short ${item.retailShort.toLocaleString()}\nRetail COT Index (52w): ${item.cotIndexRetail ?? 50}%`}>
                          <PositionCell long={item.retailLong} short={item.retailShort} label="Retailers" cotIndex={item.cotIndexRetail} />
                        </div>
                      </td>
                      <td className="px-3 py-4 text-center">
                        <div className="flex flex-col items-center justify-center" title={`WoW Change Smart Money: ${item.wowDeltaSM !== undefined ? (item.wowDeltaSM > 0 ? `+${item.wowDeltaSM.toLocaleString()}` : item.wowDeltaSM.toLocaleString()) : "0"} kontrak dibanding minggu lalu`}>
                          {item.wowDeltaSM !== undefined ? (
                            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${item.wowDeltaSM >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                              {item.wowDeltaSM >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                              <span className="font-mono text-[9px] font-bold tabular-nums">
                                {Math.abs(Math.round(item.wowDeltaSM / 1000))}K
                              </span>
                            </div>
                          ) : (
                            <Minus className="w-3 h-3 text-zinc-700" />
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => setAnalyzeItem(item)}
                          className="p-2 rounded-lg border border-white/5 bg-white/5 text-zinc-400 hover:text-accent-gold hover:border-accent-gold/40 hover:bg-accent-gold/5 transition-all group/btn"
                        >
                          <Brain className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Diversion Scanner Section - Made more compact */}
      <div className="border-t border-white/10 bg-black/40 px-4 py-3">
        <CotDivergenceScanner items={cotData} />
      </div>

      {/* Unified Footer */}
      <div className="px-5 py-2 text-[9px] text-zinc-600 border-t border-white/5 flex justify-between items-center bg-black/60 font-mono tracking-widest">
        <span>CFTC SOCRATA DATA ENGINE • WEEKLY SYNC</span>
        <span className="flex items-center gap-1">
          <div className="w-1 h-1 rounded-full bg-emerald-500" />
          SYSTEM STABLE
        </span>
      </div>

      {analyzeItem && (
        <AiModal item={analyzeItem} onClose={() => setAnalyzeItem(null)} />
      )}
    </div>
  );
}
