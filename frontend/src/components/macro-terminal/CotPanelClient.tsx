"use client";

import React, { useState } from "react";
import { TrendingUp, TrendingDown, Minus, Brain, X, AlertTriangle, Zap, BarChart3, Loader2 } from "lucide-react";
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

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const map: Record<string, { icon: React.ReactNode; cls: string }> = {
    BULLISH: { icon: <TrendingUp className="w-3 h-3" />, cls: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30" },
    BEARISH: { icon: <TrendingDown className="w-3 h-3" />, cls: "text-red-400 bg-red-400/10 border-red-400/30" },
    NEUTRAL: { icon: <Minus className="w-3 h-3" />, cls: "text-zinc-400 bg-zinc-400/10 border-zinc-400/30" },
  };
  const s = map[sentiment] ?? map["NEUTRAL"];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${s.cls}`}>
      {s.icon}{sentiment}
    </span>
  );
}

function PhaseBadge({ phase }: { phase?: MarketPhase }) {
  if (!phase) return null;

  const colorMap: Record<string, string> = {
    green: "text-emerald-400",
    yellow: "text-amber-400",
    red: "text-red-400",
    blue: "text-blue-400",
    gray: "text-zinc-400",
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${colorMap[phase.color]} bg-${phase.color === "yellow" ? "amber" : phase.color}-400/10 border-${phase.color === "yellow" ? "amber" : phase.color}-400/30`}>
      {phase.label}
      {phase.isWarning && <AlertTriangle className="w-3 h-3" />}
    </span>
  );
}

function NetBar({ long, short }: { long: number; short: number }) {
  const total = long + short;
  if (total === 0) return null;
  const pct = Math.round((long / total) * 100);
  return (
    <div className="h-1 w-full bg-red-400/30 rounded-full overflow-hidden mt-1">
      <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${pct}%` }} />
    </div>
  );
}

function PositionCell({ long, short }: { long: number; short: number }) {
  const net = long - short;
  return (
    <div className="text-center min-w-[130px]">
      <div className="font-mono text-[11px] text-zinc-200">{fmt(long)} / {fmt(short)}</div>
      <div className={`font-mono text-[10px] font-bold ${netColor(net)}`}>
        Net: {net > 0 ? "+" : ""}{fmt(net)}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl glass border border-amber-400/20 rounded-xl overflow-hidden shadow-2xl shadow-amber-400/5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3 bg-amber-400/5">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-amber-400" />
            <span className="text-amber-400 font-bold text-sm uppercase tracking-wider">COT AI Analyzer</span>
            <span className="text-zinc-400 text-[11px]">· {item.name} ({item.symbol})</span>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Snapshot data */}
        <div className="grid grid-cols-3 gap-2 px-4 py-3 border-b border-border-subtle text-[10px]">
          <div className="text-center">
            <div className="text-zinc-500 mb-1 uppercase tracking-wider">Smart Money</div>
            <div className={`font-mono font-bold text-[13px] ${netColor(commNet)}`}>{commNet > 0 ? "+" : ""}{fmt(commNet)}</div>
            <div className="text-zinc-500">{commNet > 0 ? "NET LONG" : commNet < 0 ? "NET SHORT" : "FLAT"}</div>
          </div>
          <div className="text-center">
            <div className="text-zinc-500 mb-1 uppercase tracking-wider">Large Specs</div>
            <div className={`font-mono font-bold text-[13px] ${netColor(specNet)}`}>{specNet > 0 ? "+" : ""}{fmt(specNet)}</div>
            <div className="text-zinc-500">{specNet > 0 ? "NET LONG" : specNet < 0 ? "NET SHORT" : "FLAT"}</div>
          </div>
          <div className="text-center">
            <div className="text-zinc-500 mb-1 uppercase tracking-wider">Retail</div>
            <div className={`font-mono font-bold text-[13px] ${netColor(retailNet)}`}>{retailNet > 0 ? "+" : ""}{fmt(retailNet)}</div>
            <div className="text-zinc-500">{retailNet > 0 ? "NET LONG" : retailNet < 0 ? "NET SHORT" : "FLAT"}</div>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 min-h-[200px]">
          {!ran && (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <Brain className="w-10 h-10 text-amber-400/40" />
              <p className="text-zinc-400 text-sm text-center">Klik tombol di bawah untuk AI menganalisis setup COT ini dan memberikan rekomendasi.</p>
              <button
                onClick={runAnalysis}
                className="flex items-center gap-2 px-4 py-2 bg-amber-400 text-black font-bold text-sm rounded-lg hover:bg-amber-300 transition-colors"
              >
                <Zap className="w-4 h-4" /> Analyze Now
              </button>
            </div>
          )}
          {ran && loading && (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
              <p className="text-zinc-400 text-sm">Dual Engine sedang menganalisis data COT...</p>
            </div>
          )}
          {ran && !loading && error && (
            <div className="flex items-start gap-3 p-3 rounded-lg border border-red-500/20 bg-red-500/5">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}
          {ran && !loading && result && (
            <div className="space-y-3">
              {/* Momentum */}
              <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
                <div className="flex items-center gap-2 mb-1.5">
                  <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider">Momentum & Alignment</span>
                </div>
                <p className="text-zinc-200 text-[12px] leading-relaxed">{result.momentum}</p>
              </div>
              {/* Warnings */}
              <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
                <div className="flex items-center gap-2 mb-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-amber-400 text-[10px] font-bold uppercase tracking-wider">Peringatan Utama</span>
                </div>
                <p className="text-zinc-200 text-[12px] leading-relaxed">{result.warnings}</p>
              </div>
              {/* Conclusion */}
              <div className="p-3 rounded-lg border border-blue-500/20 bg-blue-500/5">
                <div className="flex items-center gap-2 mb-1.5">
                  <Zap className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-blue-400 text-[10px] font-bold uppercase tracking-wider">Kesimpulan Eksekutif</span>
                </div>
                <p className="text-zinc-200 text-[12px] leading-relaxed font-medium">{result.conclusion}</p>
              </div>
              <button
                onClick={runAnalysis}
                className="w-full flex items-center justify-center gap-2 py-2 text-[11px] text-zinc-400 hover:text-amber-400 border border-border-subtle hover:border-amber-400/30 rounded-lg transition-all"
              >
                <Loader2 className="w-3 h-3" /> Re-Analyze
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border-subtle px-4 py-2 flex items-center justify-between text-[10px] text-zinc-500">
          <span>Data CFTC · Rilis: {item.lastUpdate ? new Date(item.lastUpdate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-"}</span>
          <span className="text-amber-400/60">9Router AI Engine</span>
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
    <div className="flex flex-col h-full w-full glass-panel overflow-hidden relative">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-border-subtle p-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="font-bold text-text-primary uppercase tracking-wider text-[11px] sm:text-xs whitespace-nowrap">
            Commitment of Traders (COT)
          </h2>
        </div>
        {latestDate && (
          <span className="text-[10px] text-zinc-500 font-mono">
            Rilis CFTC: {new Date(latestDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {cotData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-text-muted text-sm">
            Data COT tidak tersedia
          </div>
        ) : (
          <table className="w-full text-[11px] border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border-subtle text-zinc-500 bg-[#0d0d0d]">
                <th className="text-left px-3 py-2 font-medium">Market</th>
                <th className="text-center px-3 py-2 font-medium">Sentimen</th>
                <th className="text-center px-3 py-2 font-medium">
                  <span className="text-zinc-300">Smart Money</span>
                  <div className="text-[9px] text-zinc-500 font-normal">Commercials</div>
                </th>
                <th className="text-center px-3 py-2 font-medium">
                  <span className="text-zinc-300">Large Specs</span>
                  <div className="text-[9px] text-zinc-500 font-normal">Non-Commercials</div>
                </th>
                <th className="text-center px-3 py-2 font-medium">
                  <span className="text-zinc-300">Retail</span>
                  <div className="text-[9px] text-zinc-500 font-normal">Small Traders</div>
                </th>
                <th className="text-center px-3 py-2 font-medium">Analyze</th>
              </tr>
            </thead>
            <tbody>
              {sortedCategories.map((category) => (
                <React.Fragment key={category}>
                  {/* Category header */}
                  <tr className="bg-zinc-900/60">
                    <td colSpan={6} className="px-3 py-1.5">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                        {CATEGORY_ICONS[category] || "📌"} {category}
                      </span>
                    </td>
                  </tr>
                  {/* Asset rows */}
                  {grouped[category].map((item) => (
                    <tr key={item.symbol} className="border-b border-border-subtle/40 hover:bg-white/[0.03] transition-colors">
                      <td className="px-3 py-2.5">
                        <div className="font-bold text-zinc-100 text-[12px]">{item.name}</div>
                        <div className="text-zinc-500 text-[10px] font-mono">{item.symbol}</div>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <PhaseBadge phase={item.phase} />
                      </td>
                      <td className="px-3 py-2.5">
                        <PositionCell long={item.commercialLong} short={item.commercialShort} />
                      </td>
                      <td className="px-3 py-2.5">
                        <PositionCell long={item.nonCommercialLong} short={item.nonCommercialShort} />
                      </td>
                      <td className="px-3 py-2.5">
                        <PositionCell long={item.retailLong} short={item.retailShort} />
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button
                          onClick={() => setAnalyzeItem(item)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-amber-400/30 text-amber-400 hover:bg-amber-400/10 text-[10px] font-medium transition-all hover:border-amber-400/60"
                          title={`Analyze ${item.name}`}
                        >
                          <Brain className="w-3 h-3" /> AI
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

      {/* COT Divergence Scanner */}
      <CotDivergenceScanner items={cotData} />

      {/* Footer */}
      <div className="shrink-0 px-3 py-1.5 text-[9px] text-zinc-600 border-t border-border-subtle">
        Sumber: CFTC Commitments of Traders Report (Socrata API) · Dirilis setiap Jumat
      </div>

      {/* AI Modal */}
      {analyzeItem && (
        <AiModal item={analyzeItem} onClose={() => setAnalyzeItem(null)} />
      )}
    </div>
  );
}
