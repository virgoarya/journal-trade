"use client";

import { useState } from "react";
import { Brain, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Clock, XCircle, ListChecks } from "lucide-react";
import type {
  ConfluenceResult,
  MarketStructureSummary,
  MethodologyName,
  ChecklistItem,
} from "@/services/ai-trading.service";
import { SkeletonLoader } from "./SkeletonLoader";
import { EmptyState } from "./EmptyState";
import { METHODOLOGY_LABELS, METHODOLOGY_COLORS } from "../types";

interface Props {
  confluence?: ConfluenceResult;
  marketStructure?: MarketStructureSummary;
  symbol?: string;
  isRunning?: boolean;
}

type TabType = "NET" | "smc" | "ict" | "msnr";

export function MethodologyConfluence({ confluence, marketStructure, symbol, isRunning }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>("NET");

  if (!confluence) {
    return (
      <div className="glass p-4 space-y-3 font-mono">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-bold text-accent-gold flex items-center gap-2 uppercase tracking-widest drop-shadow-[0_0_4px_rgba(212,175,55,0.4)]">
            <Brain className="w-4 h-4" />
            Methodology Confluence {symbol ? <span className="text-accent-gold bg-accent-gold/10 px-2 py-0.5 rounded border border-accent-gold/30">{symbol}</span> : ""}
          </h3>
          <span className="text-[10px] text-text-muted flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded border border-accent-gold/10">
            <Clock className={`w-3 h-3 ${isRunning ? "text-accent-gold animate-spin" : "text-gray-500"}`} />
            {isRunning ? "Scanning..." : "Idle"}
          </span>
        </div>

        {/* Methodology Tabs Placeholder */}
        <div className="grid grid-cols-4 gap-1 border-b border-accent-gold/10 pb-2 opacity-60">
          <button className="text-[10px] font-mono px-2 py-1 rounded bg-accent-gold/20 text-accent-gold border border-accent-gold/40 font-bold text-center">
            NET
          </button>
          <button className="text-[10px] font-mono px-2 py-1 rounded text-text-muted bg-black/30 text-center">SMC</button>
          <button className="text-[10px] font-mono px-2 py-1 rounded text-text-muted bg-black/30 text-center">ICT</button>
          <button className="text-[10px] font-mono px-2 py-1 rounded text-text-muted bg-black/30 text-center">MSNR</button>
        </div>

        {/* Body Placeholder */}
        <div className="bg-black/40 border border-accent-gold/10 rounded-lg p-4 text-center space-y-2">
          <Brain className={`w-6 h-6 mx-auto ${isRunning ? "text-accent-gold/60 animate-pulse" : "text-gray-600"}`} />
          <p className="text-xs text-text-muted">
            {isRunning ? "Memindai struktur pasar D1/H4/H1/M5 & konfluensi metodologi..." : "Pipeline AI belum berjalan. Jalankan pipeline untuk menampilkan analisis konfluensi real-time."}
          </p>
        </div>
      </div>
    );
  }

  const finalSignal = confluence.finalSignal;

  const trendColor = (dir: string) => {
    switch (dir) {
      case "BULL": return "text-green-400 border-green-500/30 bg-green-500/10";
      case "BEAR": return "text-red-400 border-red-500/30 bg-red-500/10";
      default: return "text-gray-400 border-gray-500/30 bg-gray-500/10";
    }
  };

  // Get active checklist based on selected tab
  const getActiveChecklist = (): ChecklistItem[] => {
    if (activeTab === "NET") {
      if (confluence.priorityChecklist && confluence.priorityChecklist.length > 0) {
        return confluence.priorityChecklist;
      }
      if (finalSignal?.checklistItems && finalSignal.checklistItems.length > 0) {
        return finalSignal.checklistItems;
      }
      const primaryMeth = finalSignal?.primaryMethodology;
      if (primaryMeth && confluence.checklistByMethodology?.[primaryMeth]) {
        return confluence.checklistByMethodology[primaryMeth];
      }
      return confluence.checklistByMethodology?.["smc"] || confluence.checklistByMethodology?.["ict"] || confluence.checklistByMethodology?.["msnr"] || [];
    }
    const breakdownData = confluence.methodologyBreakdown?.[activeTab];
    if (breakdownData?.checklistItems && breakdownData.checklistItems.length > 0) {
      return breakdownData.checklistItems;
    }
    if (confluence.checklistByMethodology?.[activeTab] && confluence.checklistByMethodology[activeTab].length > 0) {
      return confluence.checklistByMethodology[activeTab];
    }
    return [];
  };

  const currentChecklist = getActiveChecklist();
  const hasFailedItems = currentChecklist.some(c => c.status === "FAILED");
  const allChecklistPassed = currentChecklist.length > 0 && !hasFailedItems && currentChecklist.some(c => c.status === "PASSED");

  return (
    <div className="glass p-4 space-y-3 font-mono">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-bold text-accent-gold flex items-center gap-2 uppercase tracking-widest drop-shadow-[0_0_4px_rgba(212,175,55,0.4)]">
          <Brain className="w-4 h-4" />
          Methodology Confluence {symbol ? <span className="text-accent-gold bg-accent-gold/10 px-2 py-0.5 rounded border border-accent-gold/30">{symbol}</span> : ""}
        </h3>
        <div className="flex items-center gap-2">
          {confluence.spread !== undefined && (
            <span className="text-[10px] text-accent-gold/90 font-mono bg-accent-gold/10 px-2 py-0.5 rounded border border-accent-gold/30 flex items-center gap-1 shadow-[0_0_8px_rgba(212,175,55,0.15)]">
              <span className="text-gray-400">SPREAD:</span>
              <span className="font-bold text-accent-gold">
                {confluence.point ? (confluence.spread * confluence.point >= 0.0001 ? (confluence.spread / 10).toFixed(1) : confluence.spread.toFixed(1)) : confluence.spread}
              </span>
              <span className="text-[9px] text-gray-400">PIPS</span>
            </span>
          )}
          {confluence.conflictDetected && (
            <span className="text-[10px] text-yellow-400 flex items-center gap-1 bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/30">
              <AlertTriangle className="w-3 h-3" />
              Conflict
            </span>
          )}
        </div>
      </div>

      {/* Market Structure Summary */}
      {marketStructure && (
        <div className="flex flex-wrap gap-1.5">
          <span className={`text-[10px] px-2.5 py-0.5 rounded-full border ${trendColor(marketStructure.trend.direction)}`}>
            HTF Direction: {marketStructure.trend.direction === "BULL" ? "Bullish" : marketStructure.trend.direction === "BEAR" ? "Bearish" : "Ranging"} ({marketStructure.trend.strength}%)
          </span>
        </div>
      )}

      {/* Methodology Tabs (Uniform 4-Grid) */}
      <div className="grid grid-cols-4 gap-1.5 border-b border-accent-gold/10 pb-2">
        <button
          onClick={() => setActiveTab("NET")}
          className={`text-[10px] py-1.5 px-1 rounded text-center transition-all truncate font-bold ${
            activeTab === "NET"
              ? "bg-accent-gold/20 text-accent-gold border border-accent-gold/40 shadow-[0_0_8px_rgba(212,175,55,0.2)]"
              : "text-text-muted hover:text-white bg-black/30 border border-transparent"
          }`}
        >
          NET (Confluence)
        </button>
        {(["smc", "ict", "msnr"] as MethodologyName[]).map((mKey) => {
          const color = METHODOLOGY_COLORS[mKey] || "#6B7280";
          const isActive = activeTab === mKey;
          return (
            <button
              key={mKey}
              onClick={() => setActiveTab(mKey as TabType)}
              className={`text-[10px] py-1.5 px-1 rounded transition-all uppercase flex items-center justify-center gap-1 truncate ${
                isActive
                  ? "bg-black border font-bold shadow-md"
                  : "text-text-muted hover:text-white bg-black/30 border border-transparent"
              }`}
              style={{
                borderColor: isActive ? color : "transparent",
                color: isActive ? color : undefined,
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className="truncate">{METHODOLOGY_LABELS[mKey]}</span>
            </button>
          );
        })}
      </div>

      {/* Final Signal Banner — Terminal Noir Approved / Candidate Signal Box */}
      {activeTab === "NET" && (
        finalSignal ? (
          <div className="bg-black/80 border border-accent-gold/30 rounded-xl p-3.5 space-y-2.5 relative overflow-hidden shadow-[0_0_15px_rgba(212,175,55,0.15)]">
            {/* Left accent bar */}
            <div className={`absolute top-0 left-0 bottom-0 w-1 ${
              allChecklistPassed
                ? (finalSignal.direction === "BUY" ? "bg-neon-green shadow-[0_0_8px_#00ff66]" : "bg-neon-red shadow-[0_0_8px_#ff0033]")
                : "bg-yellow-500 shadow-[0_0_8px_#eab308]"
            }`} />

            <div className="flex items-center justify-between border-b border-accent-gold/15 pb-2">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-2 py-0.5 rounded border font-bold uppercase tracking-wider ${
                  allChecklistPassed
                    ? "bg-accent-gold/10 text-accent-gold border-accent-gold/30"
                    : "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                }`}>
                  {allChecklistPassed ? "APPROVED SIGNAL" : "CANDIDATE SETUP (CHECKLIST INCOMPLETE)"}
                </span>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded ${
                  finalSignal.direction === "BUY" ? "bg-neon-green/20 text-neon-green border border-neon-green/40" : "bg-neon-red/20 text-neon-red border border-neon-red/40"
                }`}>
                  {finalSignal.direction}
                </span>
              </div>
              <span className="text-[10px] text-accent-gold/80 font-bold tabular-nums">
                SCORE: {finalSignal.confluenceScore}%
              </span>
            </div>

            {/* Clean 2-Column Key-Value Grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-text-muted text-[11px]">PAIR</span>
                <span className="text-white font-bold tracking-wider">{symbol || "XAUUSD"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted text-[11px]">METHOD</span>
                <span className="text-accent-gold font-bold truncate max-w-[120px] text-right">
                  {finalSignal.primaryMethodology ? (METHODOLOGY_LABELS[finalSignal.primaryMethodology as MethodologyName] || finalSignal.primaryMethodology.toUpperCase()) : "UNKNOWN"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted text-[11px]">ENTRY</span>
                <span className="text-white font-bold tabular-nums">{finalSignal.entry.toFixed(5)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted text-[11px]">SL</span>
                <span className="text-neon-red font-bold tabular-nums">{finalSignal.sl.toFixed(5)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted text-[11px]">TP</span>
                <span className="text-neon-green font-bold tabular-nums">{finalSignal.tp.toFixed(5)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted text-[11px]">RR</span>
                <span className="text-accent-gold font-bold tabular-nums">
                  1:{(Math.abs(finalSignal.entry - finalSignal.sl) > 0 ? (Math.abs(finalSignal.tp - finalSignal.entry) / Math.abs(finalSignal.entry - finalSignal.sl)).toFixed(2) : "0.00")}
                </span>
              </div>
              <div className="flex items-center justify-between col-span-2 pt-1.5 border-t border-accent-gold/10">
                <span className="text-text-muted text-[11px]">CONFIDENCE</span>
                <span className="text-neon-green font-bold text-sm tabular-nums">{finalSignal.confidence}%</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-black/60 border border-accent-gold/15 rounded-xl p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between border-b border-accent-gold/15 pb-2">
              <span className="text-[10px] bg-black/40 text-text-muted px-2 py-0.5 rounded border border-accent-gold/10 uppercase">
                SIGNAL STATUS
              </span>
              <span className="text-[10px] text-accent-gold/70">SCANNING / PENDING LLM APPROVAL</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs opacity-70">
              <div className="flex items-center justify-between"><span className="text-text-muted text-[11px]">PAIR</span><span className="text-white">{symbol || "XAUUSD"}</span></div>
              <div className="flex items-center justify-between"><span className="text-text-muted text-[11px]">METHOD</span><span className="text-text-muted">N/A</span></div>
              <div className="flex items-center justify-between"><span className="text-text-muted text-[11px]">ENTRY</span><span className="text-text-muted">N/A</span></div>
              <div className="flex items-center justify-between"><span className="text-text-muted text-[11px]">SL</span><span className="text-text-muted">N/A</span></div>
              <div className="flex items-center justify-between"><span className="text-text-muted text-[11px]">TP</span><span className="text-text-muted">N/A</span></div>
              <div className="flex items-center justify-between"><span className="text-text-muted text-[11px]">RR</span><span className="text-text-muted">N/A</span></div>
              <div className="flex items-center justify-between col-span-2 pt-1 border-t border-accent-gold/10"><span className="text-text-muted text-[11px]">CONF</span><span className="text-text-muted">N/A</span></div>
            </div>
          </div>
        )
      )}

      {/* ── Trading Plan Checklist Section ──────────────────────────────── */}
      <div className="bg-black/50 border border-accent-gold/15 rounded-lg p-3 space-y-2.5">
        <div className="flex items-center justify-between border-b border-accent-gold/10 pb-1.5">
          <h4 className="text-[10px] font-bold text-accent-gold uppercase tracking-wider flex items-center gap-1.5">
            <ListChecks className="w-3.5 h-3.5 text-accent-gold shrink-0" />
            <span>Validasi Sinyal (Checklist)</span>
          </h4>
          <span className="text-[9px] text-text-muted font-bold tabular-nums">
            {currentChecklist.filter(c => c.status === "PASSED").length}/{currentChecklist.length} Valid
          </span>
        </div>

        {currentChecklist.length > 0 ? (
          <div className="space-y-1.5">
            {currentChecklist.map((item, idx) => {
              const isPassed = item.status === "PASSED";
              const isWaiting = item.status === "WAITING";
              const isFailed = item.status === "FAILED";

              const icon = isPassed ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-neon-green shrink-0" />
              ) : isWaiting ? (
                <Clock className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-neon-red shrink-0" />
              );

              const textClass = isPassed
                ? "text-gray-200"
                : isWaiting
                ? "text-yellow-400/90"
                : "text-gray-500 line-through opacity-70";

              const badgeBg = isPassed
                ? "bg-neon-green/10 text-neon-green border-neon-green/30"
                : isWaiting
                ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                : "bg-neon-red/10 text-neon-red border-neon-red/30";

              const cardBorder = isPassed
                ? "border-neon-green/20 bg-black/40"
                : isWaiting
                ? "border-yellow-500/20 bg-yellow-500/5"
                : "border-white/5 bg-black/20";

              return (
                <div
                  key={item.id || idx}
                  className={`flex items-start gap-2.5 p-2 rounded border ${cardBorder} text-[11px] leading-tight transition-colors`}
                >
                  <div className="mt-0.5">{icon}</div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`${textClass} font-medium leading-tight`}>
                        {item.label}
                      </span>
                      {item.timeframe && (
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${badgeBg} shrink-0`}>
                          {item.timeframe}
                        </span>
                      )}
                    </div>
                    {item.value && (
                      <div className="text-[10px] text-accent-gold font-bold tabular-nums">
                        {item.value}
                      </div>
                    )}
                    {item.details && (
                      <div className="text-[10px] text-text-muted leading-normal">
                        {item.details}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-[10px] text-text-muted italic py-1">
            Checklist validasi belum tersedia untuk metodologi ini.
          </p>
        )}
      </div>

      {/* Individual Methodology Breakdown Bars */}
      {confluence && Object.keys(confluence.methodologyBreakdown || {}).length > 0 && (
        <div className="space-y-1.5 pt-1">
          <span className="text-[9px] text-accent-gold-dim uppercase tracking-widest font-mono">
            Individual Methodology Scores
          </span>
          <div className="space-y-1">
            {Object.entries(confluence.methodologyBreakdown || {})
              .filter(([key]) => key in METHODOLOGY_LABELS)
              .map(([key, data]) => {
                const method = key as MethodologyName;
                const color = METHODOLOGY_COLORS[method] || "#6B7280";
                return (
                  <div
                    key={key}
                    className="grid grid-cols-[auto_1fr_64px_36px_32px] items-center gap-2 bg-black/30 px-2 py-1.5 rounded border border-white/5"
                  >
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-[10px] text-text-muted truncate flex items-center gap-1">
                      <span className="truncate">{METHODOLOGY_LABELS[method]}</span>
                      {data.direction === "BUY" && <TrendingUp className="w-3 h-3 text-neon-green shrink-0" />}
                      {data.direction === "SELL" && <TrendingDown className="w-3 h-3 text-neon-red shrink-0" />}
                    </span>
                    {/* Confidence bar */}
                    <div className="h-1.5 bg-black rounded-full overflow-hidden border border-accent-gold/10">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${data.confidence}%`,
                          backgroundColor: color,
                          opacity: data.confidence > 0 ? 1 : 0.2,
                        }}
                      />
                    </div>
                    <span className="text-right text-[10px] tabular-nums font-bold" style={{ color }}>
                      {data.confidence > 0 ? `${data.confidence}%` : "—"}
                    </span>
                    <span className="text-[9px] text-text-muted text-right tabular-nums">
                      ×{data.weight.toFixed(1)}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}